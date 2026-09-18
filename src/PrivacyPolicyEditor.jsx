import React from 'react';
import {Button,Input,Select,Table,Tooltip,Typography} from 'antd';
import {InfoCircleOutlined,PlusOutlined} from '@ant-design/icons';
export default function PrivacyPolicyEditor({value=[],onChange,disabled,fieldOptions=[]}) {
  const patch=(index,key,next)=>onChange?.(value.map((row,i)=>i===index?{...row,[key]:next}:row));
  const options=Array.from(new Map(fieldOptions.filter(item=>item?.value).map(item=>[item.value,item])).values());
  return <section className="privacy-policy-editor"><div className="template-section-heading"><Typography.Title level={5}>合成字段豁免隐私质检</Typography.Title>{!disabled&&<Button type="primary" icon={<PlusOutlined/>} disabled={!options.length} onClick={()=>onChange?.([...value,{fieldId:'',privacyType:'姓名',region:''}])}>添加字段</Button>}</div><Typography.Paragraph type="secondary" className="form-help">仅在字段、允许区域和可信生成来源同时匹配时豁免；区域外、上传内容或来源无法确认时仍检查。{!options.length?'请先配置模板字段或有效 JSON，解析后可选择字段。':''}</Typography.Paragraph>
    <Table size="small" rowKey={(_,i)=>i} pagination={false} dataSource={value} columns={[
      {title:'字段 ID',render:(_,r,i)=><Select aria-label={`豁免字段 ${i+1} ID`} showSearch optionFilterProp="label" disabled={disabled} style={{width:"100%",minWidth:180}} value={r.fieldId||undefined} onChange={v=>patch(i,'fieldId',v)} options={options} placeholder="选择解析出的字段"/>},
      {title:'隐私类型',render:(_,r,i)=><Select placeholder="请选择隐私类型" aria-label={`预期合成字段 ${i+1} 隐私类型`} disabled={disabled} style={{width:'100%'}} value={r.privacyType} onChange={v=>patch(i,'privacyType',v)} options={['姓名','电话','地址','证件号','其他'].map(value=>({value,label:value}))}/>},
      {title:<Tooltip title="只在指定位置豁免，例如 JSON 路径 customer.name，或文档图片中的收件人区域 ID；同一个值出现在其他位置仍检查。"><span>允许区域 / 结构路径 <InfoCircleOutlined/></span></Tooltip>,render:(_,r,i)=><Input aria-label={`预期合成字段 ${i+1} 区域`} disabled={disabled} value={r.region} onChange={e=>patch(i,'region',e.target.value)} placeholder="精确区域 ID 或字段路径"/>},
      {title:<Tooltip title="系统验证该值确实由合成流程生成；上传内容或无法确认来源的值不豁免，无需手动填写。"><span>来源要求 <InfoCircleOutlined/></span></Tooltip>,render:()=> '生成流程验证'},
      ...(!disabled?[{title:'操作',render:(_,r,i)=><Button type="text" onClick={()=>onChange?.(value.filter((_,n)=>n!==i))}>移除</Button>}]:[])
    ]} locale={{emptyText:'未配置豁免字段，全部按隐私规则检查'}}/>
  </section>;
}
export const validatePrivacyPolicy=(_,value=[])=>value.some(row=>!row.fieldId?.trim()||!row.region?.trim()||!row.privacyType)?Promise.reject(new Error('请选择合成字段、隐私类型并填写允许区域')):Promise.resolve();

export {privacyFieldOptions} from './privacyFields.js';
