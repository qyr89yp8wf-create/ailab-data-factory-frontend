import React,{useMemo,useState} from 'react';
import {Button,Descriptions,Drawer,Empty,Flex,Input,Select,Space,Table,Tag,Timeline,Typography} from 'antd';
import {SearchOutlined} from '@ant-design/icons';
import {ERROR_LABELS,queryBadcases} from './taskExecution';
const {Text,Title}=Typography;
export function BadcasePanel({task}){
  const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(10),[stage,setStage]=useState(''),[errorType,setErrorType]=useState(''),[query,setQuery]=useState(''),[selected,setSelected]=useState(null);
  const result=useMemo(()=>queryBadcases(task,{page,pageSize,stage,errorType,query}),[task,page,pageSize,stage,errorType,query]);
  const columns=[
    {title:'Badcase ID',dataIndex:'id',width:270,render:value=><Text copyable>{value}</Text>},
    {title:'样本 ID',dataIndex:'sampleId',width:280,render:(value,r)=><><Text>{value}</Text>{r.sourceSampleId&&<div className="muted-id">来源：{r.sourceSampleId}</div>}</>},
    {title:'失败阶段',dataIndex:'stage',width:130},
    {title:'模型 / API 配置',dataIndex:'model',width:190,render:(value,r)=><>{value}<div className="muted-id">{r.apiConfigName}</div></>},
    {title:'关联规则',dataIndex:'ruleName',width:200,render:(value,r)=><>{value||'-'}<div className="muted-id">{r.ruleId}</div></>},
    {title:'异常类型',dataIndex:'errorType',width:140,render:value=><Tag color="error">{ERROR_LABELS[value]}</Tag>},
    {title:'调用次数',dataIndex:'attemptCount',width:105,render:(v,r)=>`${v} / ${r.maxAttempts}`},
    {title:'异常摘要',dataIndex:'errorMessage',width:150,ellipsis:true},
    {title:'更新时间',dataIndex:'updatedAt',width:180},
  ];
  const change=(setter,value)=>{setter(value);setPage(1);};
  return <div className="task-badcase-panel">
    {task.badcaseTrackingVersion?<><Flex wrap gap={12} justify="space-between" align="center" style={{marginBottom:16}}><Space wrap><Select placeholder="请选择失败阶段" aria-label="失败阶段" value={stage} style={{width:155}} onChange={value=>change(setStage,value)} options={[{value:'',label:'全部失败阶段'},...[...new Set((task.execution?.steps||[]).map(s=>s.name))].map(value=>({value,label:value}))]}/><Select placeholder="请选择异常类型" aria-label="异常类型" value={errorType} style={{width:155}} onChange={value=>change(setErrorType,value)} options={[{value:'',label:'全部异常类型'},...Object.entries(ERROR_LABELS).map(([value,label])=>({value,label}))]}/></Space><Input aria-label="搜索 Badcase" allowClear prefix={<SearchOutlined/>} placeholder="搜索样本 ID / Badcase ID" value={query} onChange={event=>change(setQuery,event.target.value)} style={{width:280,maxWidth:'100%'}}/></Flex><Table rowKey="id" size="small" dataSource={result.rows} columns={columns} scroll={{x:1815}} locale={{emptyText:query||stage||errorType?'没有符合筛选条件的 Badcase':'暂无 Badcase'}} pagination={{current:page,pageSize,total:result.total,showSizeChanger:true,pageSizeOptions:[10,20,50],showTotal:total=>`共 ${total} 条`,onChange:(p,s)=>{setPage(s!==pageSize?1:p);setPageSize(s);}}}/></>:<Empty description="该历史任务未记录样本级异常数据"/>}
    <Drawer title="Badcase 详情" className="badcase-detail-drawer" width="min(840px, 95vw)" open={!!selected} onClose={()=>setSelected(null)} destroyOnHidden>
      {selected&&<><Descriptions bordered size="small" column={2} items={[
        ['Badcase ID',selected.id],['所属任务',selected.taskName],['任务 ID',selected.taskId],['样本 ID',selected.sampleId],['来源版本',selected.sourceVersionId||'-'],['输出版本',selected.outputVersionId||'-'],['失败阶段',selected.stage],['规则',selected.ruleName||'-'],['模型',selected.model],['业务场景',selected.samplingTarget],['处置结果',selected.disposition],['更新时间',selected.updatedAt]
      ].map(([label,children])=>({key:label,label,children}))}/><Title level={5} style={{marginTop:24}}>调用记录</Title><Table size="small" rowKey="attemptNo" pagination={false} scroll={{x:710}} dataSource={selected.attempts} columns={[{title:'调用',dataIndex:'attemptNo',width:60},{title:'时间',dataIndex:'startedAt',width:175},{title:'结果',dataIndex:'sanitizedMessage',width:130},{title:'错误码',dataIndex:'errorCode',width:110},{title:'请求 ID',dataIndex:'providerRequestId',ellipsis:true}]}/><Flex justify="space-between" align="center" style={{marginTop:24,marginBottom:8}}><Text strong>记录 JSON</Text><Text copyable={{text:JSON.stringify(selected,null,2)}}>复制 JSON</Text></Flex><pre className="badcase-json">{JSON.stringify(selected,null,2)}</pre></>}
    </Drawer>
  </div>;
}
