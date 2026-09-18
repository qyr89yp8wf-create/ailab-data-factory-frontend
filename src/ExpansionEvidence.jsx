import React,{useState,useEffect} from 'react';
import {Drawer,Table,Typography} from 'antd';
import {reportSamplePage} from './qualityReportSamples.js';
export default function ExpansionEvidence({report,target,onClose}){
 const [page,setPage]=useState(1);useEffect(()=>setPage(1),[target?.key,report?.reportId]);
 const rows=target?reportSamplePage(report,target.ruleId,'FAIL',page,10):[];
 return <Drawer title={target?.label+' · 扩增依据'} open={!!target} onClose={onClose} width={880}>
 <Typography.Paragraph type="secondary">仅展示本报告不通过的样本。扩增生成新样本，不覆盖原样本。</Typography.Paragraph>
 <Table rowKey="sampleId" size="small" dataSource={rows} pagination={{current:page,pageSize:10,total:target?.failedCount||0,onChange:setPage,showSizeChanger:false}} columns={[{title:'样本ID',dataIndex:'sampleId'},{title:'问题位置',render:(_,r)=>r.rule?.location||'—'},{title:'不通过原因',render:(_,r)=>r.rule?.reason||'—'}]}/>
 </Drawer>;
}
