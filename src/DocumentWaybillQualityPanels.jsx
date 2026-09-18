import {ControlledModelConfig,ModelConfigGroup} from './ModelConfigField';
import React, { useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Collapse, Descriptions, Flex, Form, Input, InputNumber, Row, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, PlayCircleOutlined, PlusOutlined } from '@ant-design/icons';

const { Text } = Typography;

export function UnifiedWaybillQualityPanel({ baseRuleRows, privacyRuleRows, qualityRules, patchQuality, setQualityRules, enabled, setEnabled }) {
  const toRule=([id,name,target,method,severity,description])=>({id,name,target,method,severity,description});

  const baseRules=baseRuleRows.map(row=>({...toRule(row),enabled:enabled[row[0]]!==false}));
  const privacyRules=privacyRuleRows.map(toRule);
  const all=baseRules.every(rule=>rule.enabled); const some=baseRules.some(rule=>rule.enabled);
  const columns=[
    {title:<Checkbox checked={all} indeterminate={some&&!all} onChange={event=>setEnabled(Object.fromEntries(baseRuleRows.map(([id])=>[id,event.target.checked])))}/>,width:48,render:(_,rule)=><Checkbox checked={rule.enabled} onChange={event=>setEnabled(current=>({...current,[rule.id]:event.target.checked}))}/>},
    {title:'规则包 / 检测项',dataIndex:'name',width:260,render:(value,rule)=><><Text strong>{value}</Text><br/><Text type="secondary" style={{fontSize:12}}>{rule.id}</Text></>},
    {title:'检查范围',dataIndex:'target',width:260,render:value=><Tag color="blue">{value}</Tag>},
    {title:'检测方法',dataIndex:'method',width:220},
    {title:'处理级别',dataIndex:'severity',width:110,render:value=><Tag color={value==='BLOCK'?'red':'orange'}>{value}</Tag>},
    {title:'说明',dataIndex:'description'},
  ];
  const privacyColumns=columns.map((column,index)=>index===0?{title:<Checkbox checked disabled/>,width:48,render:()=><Checkbox checked disabled/>}:column);
  const scene=<><Alert type="info" showIcon message="按国内运单场景配置模型质检" description="结构化字段之间的业务关系使用语义模型；必须直接观察成品像素、版面、图文对应或遮挡情况的规则使用 VLM；确定性检查由系统预置基础规则执行。"/>{qualityRules.map((rule,index)=><Card key={rule.ruleId} size="small" className="section-title conversation-quality-rule" title={<Space><Checkbox checked={rule.enabled!==false} onChange={event=>patchQuality(index,{enabled:event.target.checked})}/><Text strong>{rule.name}</Text></Space>} extra={<Button type="text" danger icon={<DeleteOutlined/>} onClick={()=>setQualityRules(current=>current.filter((_,i)=>i!==index))}>删除</Button>}><Row gutter={12}><Col span={8}><Text type="secondary">规则名称</Text><Input placeholder="请输入内容" value={rule.name} onChange={event=>patchQuality(index,{name:event.target.value})}/></Col><Col span={6}><Text type="secondary">检查对象</Text><Select placeholder="请选择选项" style={{width:'100%'}} value={rule.target} onChange={target=>patchQuality(index,{target})} options={['版面结构','字段内容','两者'].map(value=>({value,label:value}))}/></Col><Col span={5}><Text type="secondary">检测方法</Text><Select placeholder="请选择选项" style={{width:'100%'}} value={rule.mode} onChange={mode=>patchQuality(index,{mode})} options={[{value:'semantic',label:'语义模型 / Prompt'},{value:'vlm',label:'VLM / 图像 Prompt'}]}/></Col><Col span={5}><Text type="secondary">处理级别</Text><Select placeholder="请选择选项" style={{width:'100%'}} value={rule.handling||'REVIEW'} onChange={handling=>patchQuality(index,{handling})} options={['BLOCK','REVIEW'].map(value=>({value,label:value}))}/></Col></Row>{rule.mode==='function'?<><Text type="secondary">Python 判断函数</Text><Input.TextArea placeholder="请输入内容" className="coldchain-code-textarea" rows={6} value={rule.pythonCode||'def validate(waybill, context):\n    return True'} onChange={event=>patchQuality(index,{pythonCode:event.target.value})}/></>:<><Text type="secondary">{rule.mode==='vlm'?'图像判断 Prompt':'语义判断 Prompt'}</Text><Input.TextArea placeholder="请输入内容" rows={4} value={rule.prompt} onChange={event=>patchQuality(index,{prompt:event.target.value})}/></>}</Card>)}</>;
  return <div className="waybill-quality-panel section-title"><Collapse defaultActiveKey={['base','privacy','scene']} items={[
    {key:'base',label:<Space><Text strong>基础质检</Text><Text type="secondary">（{baseRules.filter(rule=>rule.enabled).length}/{baseRules.length}）</Text></Space>,children:<Table rowKey="id" size="small" pagination={false} dataSource={baseRules} columns={columns} scroll={{x:1250,y:520}}/>},
    {key:'privacy',label:<Space><Text strong>隐私质检</Text><Text type="secondary">（{privacyRules.length}/{privacyRules.length}）</Text></Space>,children:<Table rowKey="id" size="small" pagination={false} dataSource={privacyRules} columns={privacyColumns} scroll={{x:1250}}/>},
    {key:'scene',label:<Space><Text strong>场景质检</Text><Text type="secondary">（{qualityRules.filter(r=>r.enabled!==false).length}/{qualityRules.length}）</Text></Space>,children:<><div className="template-section-heading"><strong>场景规则</strong><Button type="primary" icon={<PlusOutlined/>} onClick={()=>setQualityRules(current=>[...current,{ruleId:`SCENE-${Date.now().toString(36).toUpperCase()}`,name:'自定义场景规则',target:'两者',mode:'semantic',handling:'REVIEW',threshold:0.8,prompt:'',enabled:true}])}>添加自定义质检规则</Button></div>{scene}</>},
  ]}/></div>;
}

export function DocumentQualityModelSettings({ config, setConfig, semanticCount, vlmCount }) {
  const count=config.sampleCount||1;
  return <Card className="section-title" size="small" title="质检模型配置">
<ModelConfigGroup><ControlledModelConfig label="语义质检模型" options={[{value:'qwen3-14b',label:'qwen3-14b'}]} value={config.semanticQualityModel||'qwen3-14b'} onChange={semanticQualityModel=>setConfig(current=>({...current,semanticQualityModel}))} enabled={!!config.semanticQualityParamsEnabled} onEnabledChange={semanticQualityParamsEnabled=>setConfig(current=>({...current,semanticQualityParamsEnabled}))} parameters={config.semanticQualityParamsJson||'{\n  "temperature": 0.1\n}'} onParametersChange={semanticQualityParamsJson=>setConfig(current=>({...current,semanticQualityParamsJson}))}/><ControlledModelConfig label="图像理解模型（VLM）" options={[{value:'qwen3-vl-8b-instruct',label:'qwen3-vl-8b-instruct'}]} value={config.vlmQualityModel||'qwen3-vl-8b-instruct'} onChange={vlmQualityModel=>setConfig(current=>({...current,vlmQualityModel}))} enabled={!!config.vlmQualityParamsEnabled} onEnabledChange={vlmQualityParamsEnabled=>setConfig(current=>({...current,vlmQualityParamsEnabled}))} parameters={config.vlmQualityParamsJson||'{\n  "temperature": 0.1,\n  "max_tokens": 256\n}'} onParametersChange={vlmQualityParamsJson=>setConfig(current=>({...current,vlmQualityParamsJson}))}/></ModelConfigGroup>
    <Descriptions className="section-title" bordered size="small" column={3} items={[{key:'semantic',label:'语义质检调用预估',children:`${count*semanticCount} 次`},{key:'vlm',label:'VLM 质检调用预估',children:`${count*vlmCount} 次`},{key:'total',label:'质检模型调用合计',children:<Text strong>{count*(semanticCount+vlmCount)} 次</Text>}]}/>
  </Card>;
}
