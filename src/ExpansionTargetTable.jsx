import React from 'react';
import {Table,InputNumber,Typography,Button,Space,Tooltip,Empty} from 'antd';
import {expansionCount} from './expansionQuality.js';
const {Text}=Typography;
export default function ExpansionTargetTable({rows,selected,onSelect,config,onConfig,onEvidence,report}){
 const labels=rows[0]?.kind==='标签覆盖';
 const groups=labels?[...new Set(rows.map(r=>(r.source||'custom')+':'+(r.dimensionId||r.dimension)))].map(key=>({key,title:rows.find(r=>(r.source||'custom')+':'+(r.dimensionId||r.dimension)===key)?.dimension,rows:rows.filter(r=>(r.source||'custom')+':'+(r.dimensionId||r.dimension)===key)})):[{key:'rules',rows}];
 const columns=[
  {title:labels?'标签':'质检规则',width:180,render:(_,r)=><Space direction="vertical" size={2}>{labels?<Text strong>{r.label}</Text>:<Button type="link" style={{padding:0}} onClick={()=>onEvidence(r)}>{r.label}</Button>}{labels&&r.count===0&&<Text type="secondary">{report?.executionRange==='sample'?'抽检未覆盖':'未覆盖'}</Text>}</Space>},
  {title:labels?'已检样本':'有效判定',width:95,render:(_,r)=>labels?r.count:r.passed+r.failed},
  {title:'通过',dataIndex:'passed',width:80},
  {title:'不通过',dataIndex:'failed',width:80},
  {title:<Tooltip title="没有明确不通过，但检查未得出完整结论；不作为质量缺口自动推荐扩增。">无法判定 ⓘ</Tooltip>,dataIndex:'unknown',width:100},
  {title:<Tooltip title="不通过 ÷（通过 + 不通过）。标签内样本命中多项规则只计一次。">不通过率 ⓘ</Tooltip>,width:100,render:(_,r)=>r.failureRate==null?'—':(r.failureRate*100).toFixed(1)+'%'},
  {title:'推荐新增',width:110,render:(_,r)=><Tooltip title={labels?'数量缺口 '+r.quantityGap+' 条，质量缺口 '+r.failed+' 条；取较大值，不重复相加。':'按本规则已发现的不通过样本数推荐。'}>{r.recommended.toLocaleString()} 条</Tooltip>},
  {title:'计划扩增比例',width:180,render:(_,r)=>{const c=config[r.key]||{},n=expansionCount(r,c);return <Space direction="vertical" size={4}><InputNumber placeholder="请输入计划扩增比例（不小于 0）" style={{width:150}} aria-label={r.label+'计划扩增比例'} disabled={!selected.includes(r.key)} min={0} precision={r.baseCount?2:0} value={r.baseCount?(c.percent??Number((n/r.baseCount*100).toFixed(2))):n} addonAfter={r.baseCount?'%':'条'} onChange={v=>onConfig({...config,[r.key]:r.baseCount?{percent:v??0}:{count:v??0}})}/><Text type="secondary">{r.baseCount?'基数 '+r.baseCount.toLocaleString()+' 条':'零样本，直接填写条数'}</Text><Text>预计新增 {n.toLocaleString()} 条</Text></Space>;}}
 ];
 return <Space direction="vertical" size={16} style={{width:'100%',marginTop:16}}>
 <Text type="secondary">全部样本 {Number(report?.sampleCount||0).toLocaleString()} 条 · 本次已检 {Number(report?.checkedSampleCount||0).toLocaleString()} 条。按本次已检结果推荐，不推算全量缺口。比例以规则不通过样本数或标签已检样本数为基数，可超过 100%，新增条数向上取整。</Text>
 {!rows.length?<Empty description="暂无可选扩增目标"/>:groups.map(g=><div key={g.key}>{g.title&&<Typography.Title level={5}>{g.title}</Typography.Title>}<Table rowKey="key" size="small" scroll={{x:1100}} pagination={labels?false:{pageSize:10,showSizeChanger:false,hideOnSinglePage:true,showTotal:total=>`共 ${total} 项`}} columns={columns} dataSource={g.rows} rowSelection={{selectedRowKeys:selected,onChange:keys=>onSelect([...selected.filter(k=>!g.rows.some(r=>r.key===k)),...keys.filter(k=>g.rows.some(r=>r.key===k))])}}/></div>)}
 </Space>;
}
