import React, { useState } from 'react';
import { Divider, Input, Table, Tabs, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import customsSeed from '../public/mock-data/document-draft.json';
import { DOCUMENT_BASE_QUALITY_RULES, DOCUMENT_PRIVACY_QUALITY_RULES, DOCUMENT_SCENE_QUALITY_RULES } from './documentQualityCatalog';
import { initialFields, initialFixedTexts } from './WaybillSeedMockEditor';

export const customsTemplateSnapshot = customsSeed;
export function documentSnapshot(template) {
  if(template?.method==='底图生成法'&&!template?.documentSnapshot&&!template?.configuration?.fields){
    const fields=initialFields();
    return {
      texts:initialFixedTexts().map(item=>({id:item.id,kind:'fixed_label',sample_text:item.text})),
      fields:fields.map(item=>({id:item.key,name:item.zh,bindingName:fields.find(field=>field.key===item.boundKey)?.zh,sample_text:item.sample,generator:{type:item.generation,rule:item.rule}})),
    };
  }
  return template?.documentSnapshot || template?.configuration || {};
}
export function documentTemplateRules(template) {
  const snapshot=documentSnapshot(template);
  const configured=snapshot.quality_rules||{};
  const normalize=(rule,category)=>({
    id:rule.id||rule.rule_id, name:rule.name, category, privacy:category==='隐私质检',
    target:rule.target, method:rule.method||(rule.mode==='vlm'?'VLM 图像判断':'语义判断'),
    engine:rule.method||'', severity:rule.severity||rule.handling,
    threshold:rule.threshold??'-', content:rule.content||rule.description||rule.prompt||'',
    passExample:rule.positive_example, failExample:rule.negative_example,
  });
  const base=(catalog,stored,category)=>catalog.map(([id,name,target,method,severity,description])=>({
    id,name,target,method,severity,description,...(stored||[]).find(rule=>(rule.id||rule.rule_id)===id),
  })).filter(rule=>rule.enabled!==false).map(rule=>normalize(rule,category));
  const scenes=DOCUMENT_SCENE_QUALITY_RULES.map(rule=>({...rule,...(configured.scene_rules||[]).find(item=>item.rule_id===rule.rule_id)}))
    .concat((configured.scene_rules||[]).filter(rule=>!DOCUMENT_SCENE_QUALITY_RULES.some(item=>item.rule_id===rule.rule_id)));
  return [
    ...base(DOCUMENT_BASE_QUALITY_RULES,configured.base_rules,'基础质检'),
    ...base(DOCUMENT_PRIVACY_QUALITY_RULES,configured.privacy_rules,'隐私质检'),
    ...scenes.filter(rule=>rule.enabled!==false).map(rule=>normalize(rule,'场景质检')),
  ];
}
const labels={dictionary_rule:'字典 + 规则',computed:'计算值',llm_prompt:'模型 + Prompt',fixed_asset:'固定素材',stamp:'印章',qrcode:'二维码',barcode:'条形码',fixed_image:'固定图案'};
const pretty=value=>typeof value==='object'?JSON.stringify(value,null,2):String(value??'');
function Generator({value={}}) {
  return <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{labels[value.type]||value.type||'-'}
    {Object.entries(value).filter(([key,v])=>key!=='type'&&v!==''&&v!=null&&(!Array.isArray(v)||v.length)).map(([key,v])=><div key={key}><Typography.Text type="secondary">{({rule:'规则',prompt:'Prompt',expression:'表达式',dictionary:'字典',candidates:'候选值',stamp:'印章配置',code:'码内容配置',asset_source:'素材来源',asset_path:'素材引用'}[key]||key)}：</Typography.Text>{pretty(v)}</div>)}
  </div>;
}
export function DocumentTemplateFields({snapshot={}}) {
  const [query,setQuery]=useState('');
  const [tab,setTab]=useState('fixed');
  const fixed=(snapshot.texts||[]).filter(text=>text.kind==='fixed_label');
  const dynamic=(snapshot.fields||[]).map(field=>{
    const texts=(snapshot.texts||[]).filter(text=>text.field_id===field.id);
    const bindings=[...new Set(texts.map(text=>fixed.find(label=>label.id===text.binding_object_id)?.sample_text).filter(Boolean))];
    return {...field,binding:bindings.join('、')||field.bindingName||'未绑定',example:field.sample_text||texts[0]?.sample_text||'-'};
  });
  const matches=row=>!query||[row.id,row.name,row.sample_text,row.binding].join(' ').toLowerCase().includes(query.toLowerCase());
  const pagination={pageSize:10,showSizeChanger:false};
  return <>
    <Divider orientation="left">字段列表</Divider>
    <Input allowClear prefix={<SearchOutlined/>} placeholder="搜索字段名称或 ID" value={query} onChange={event=>setQuery(event.target.value)} style={{marginBottom:12}}/>
    <Tabs activeKey={tab} onChange={setTab} items={[
      {key:'fixed',label:`固定字段（${fixed.length}）`,children:<Table size="small" rowKey="id" pagination={pagination} dataSource={fixed.filter(matches)} columns={[{title:'字段 ID',dataIndex:'id',width:120},{title:'固定文字',dataIndex:'sample_text'}]}/>},
      {key:'dynamic',label:`动态字段（${dynamic.length}）`,children:<Table size="small" rowKey="id" pagination={pagination} scroll={{x:680}} dataSource={dynamic.filter(matches)} columns={[
        {title:'字段名（绑定的固定字段）',width:200,render:(_,row)=><div>{row.name}<div>{row.binding}</div><Typography.Text type="secondary">{row.id}</Typography.Text></div>},
        {title:'值的生成规则',width:300,render:(_,row)=><Generator value={row.generator}/>},
        {title:'示例',dataIndex:'example',width:180},
      ]}/>},
    ]}/>
    {!!snapshot.assets?.length&&<><Divider orientation="left">图形及生成规则</Divider><Table size="small" rowKey="id" pagination={false} dataSource={snapshot.assets} columns={[
      {title:'图形',width:120,render:(_,row)=><div>{labels[row.asset_type]||row.asset_type}<div>{row.id}</div></div>},
      {title:'生成规则',render:(_,row)=><Generator value={row.generator}/>},
    ]}/></>}
  </>;
}
