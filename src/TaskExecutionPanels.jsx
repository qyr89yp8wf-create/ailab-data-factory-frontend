
import RuleQualityReport from './RuleQualityReport';
import React,{useMemo,useState} from 'react';
import {Button,Descriptions,Drawer,Empty,Flex,Input,Select,Space,Table,Tag,Timeline,Typography} from 'antd';
import {SearchOutlined} from '@ant-design/icons';
import {ERROR_LABELS,queryBadcases,versionSample} from './taskExecution';
const {Text,Title}=Typography;
export function ExecutionSummary({task}){
  const s=task.executionSummary;
  if(!s)return <Empty description="该历史任务未记录样本级执行数据"/>;
  return <Descriptions bordered size="small" column={2} items={[
    ['计划处理',s.plannedSampleCount],['已处理（含执行异常）',s.processedSampleCount],['成功完成',s.succeededSampleCount],['执行异常（Badcase）',s.badcaseSampleCount],['输出样本',task.outputVersionId?s.outputSampleCount:'待提交'],['发生重试的样本',s.retriedSampleCount],['API 实际调用',s.apiAttemptCount],['自动重试次数',s.retryAttemptCount||0],
    ...(task.taskType==='数据质检'?[['未抽中样本',Math.max(0,Number(task.configSnapshot.sourceVersion?.samples||0)-s.plannedSampleCount)]]:[]),
  ].map(([label,value])=>({key:label,label,children:typeof value==='number'?value.toLocaleString():value}))}/>;
}
export function ExecutionLogs({task}){
  return <Timeline items={[
    {color:'blue',children:`${task.created} · 任务已提交`},
    ...(task.executionSummary?.retriedSampleCount?[{color:'orange',children:`${task.executionSummary.retriedSampleCount} 条样本触发重试，累计重试 ${task.executionSummary.retryAttemptCount} 次`}]:[]),
    ...(task.executionSummary?.badcaseSampleCount?[{color:'red',children:`${task.executionSummary.badcaseSampleCount} 条样本执行异常，已记录 Badcase`}]:[]),
    {color:task.status==='运行中'?'blue':task.status==='已完成'?'green':'orange',children:`${task.updated||task.created} · ${task.currentStage||task.status}`},
    ...(task.outputVersionId?[{color:'green',children:`已提交版本 ${task.outputVersionId}`}]:[])
  ]}/>;
}
export {BadcasePanel} from './BadcasePanel';
export function VersionExecutionInfo({version,onOpen}){
  if(!version.executionSummary)return null;
  return <Descriptions bordered size="small" column={3} style={{marginTop:16,marginBottom:16}} items={[
    {key:'output',label:'实际输出',children:Number(version.samples).toLocaleString()},
    {key:'errors',label:'执行异常',children:version.executionSummary.badcaseSampleCount},
    {key:'link',label:'异常记录',children:<Button type="link" size="small" onClick={onOpen}>查看 Badcase</Button>}
  ]}/>;
}
export function ExecutionQualityReport({version}){
  return <RuleQualityReport report={version.qualityReport}/>;
}
