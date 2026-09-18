import React,{useEffect,useState} from 'react';
import {Alert,Button,Card,Spin,Typography} from 'antd';
import {customsApi} from './customsApi';
import {coldchainApi} from './coldchainApi';
import {conversationApi} from './conversationApi';
import RuleQualityReport from './RuleQualityReport';
export default function LegacyQualityReportPage({modality,jobId}){
 const [job,setJob]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;const api=modality==='对话文本'?conversationApi:modality==='时序数据'?coldchainApi:customsApi;api.getJob(jobId).then(j=>{if(active)setJob(j);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[modality,jobId]);
 return <main className="quality-report-page"><Typography.Title level={3}>{modality}质检报告</Typography.Title><Button href="/">返回产品</Button>{error?<Alert type="error" message={error}/>:!job?<Spin/>:<Card style={{marginTop:16}}><RuleQualityReport report={job.result?.rule_report||{taskId:jobId,templateId:job.config?.template_id,executionStatus:job.status}}/></Card>}</main>;
}
