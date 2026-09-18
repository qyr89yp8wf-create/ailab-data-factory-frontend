
import {SampleRuleResults} from './RuleQualityReport';
import React,{useMemo,useState} from 'react';
import {Button,Empty,Image,Select,Space,Table,Tabs,Tag,Typography} from 'antd';
import {preferredQualityReport,versionWithReport} from './qualityHistory';
import {versionReportsForDisplay} from './prototypeHistoricalQuality';
import {documentSamplePreview} from './documentSamplePreview';
import {versionSample} from './taskExecution';
const {Text}=Typography;
const hash=s=>[...String(s)].reduce((a,c)=>(Math.imul(a,31)+c.charCodeAt(0))>>>0,7);
export function fixedIndices(total){
  return Array.from({length:Math.min(10,Math.max(0,Math.floor(total)))},(_,i)=>i);
}
function sample(dataset,version,index){
  const seed=hash(`${version.version}-${index}`), type=/对话/.test(dataset.modality)?'conversation':/时序/.test(dataset.modality)?'timeseries':'document';
  const status=version.sampleExecution?versionSample(version.sampleExecution,index):null;
  const id=status?.sampleId||`SAMPLE-${version.version}-${String(index+1).padStart(7,'0')}`;
  const fields={'运单号':`CT${String(seed).padStart(10,'0')}`,'寄件人':'合成寄件人','收件人':'合成收件人','联系电话':'138****0000','始发地':'上海','目的地':['杭州','南京','合肥'][seed%3],'货物名称':'训练用包装材料','件数':seed%8+1,'重量(kg)':(seed%900/100+1).toFixed(2)};
  const messages=[{role:'user',content:`请帮我查询发往${fields.目的地}的包裹。`},{role:'assistant',content:'可以，请提供运单号。'},{role:'user',content:`运单号是${fields.运单号}。`},{role:'assistant',content:`包裹正在发往${fields.目的地}的途中，预计明日送达。`},{role:'user',content:'好的，谢谢。'},{role:'assistant',content:'不客气，如有异常可以继续联系。'}];
  if(/报关/.test(dataset.businessType)){Object.assign(fields,{'报关单号':fields.运单号,'境内收发货人':'合成贸易公司','申报口岸':'上海海关','贸易方式':'一般贸易'});delete fields.运单号;delete fields.寄件人;delete fields.收件人;}
  const points=Array.from({length:100},(_,i)=>({timestamp:new Date(Date.UTC(2026,8,1,8,i)).toISOString().replace('T',' ').slice(0,19),temperature:+(4+Math.sin(i/8+seed%10)*1.4).toFixed(2),humidity:+(65+Math.sin(i/11+seed%7)*9).toFixed(2),longitude:+(121.3+i*.001).toFixed(5),latitude:+(31.1+i*.0006+Math.sin(i/10)*.003).toFixed(5)}));
  const result=status?.overallResult||(!version.qualityReport?'UNCHECKED':null);
  return {id,type,fields,messages,points,result,ruleResults:version.qualityReport?.protocolVersion===2?status?.ruleResults:[],events:[{timestamp:points[20].timestamp,event:'开门装卸'},{timestamp:points[70].timestamp,event:'恢复稳定运输'}],versionId:version.version,sampleIndex:index+1};
}
const labels={PASS:'PASS',FAIL:'FAIL',REVIEW:'REVIEW',ERROR:'质检异常',UNCHECKED:'未质检'};
function conversationPreview(row){
  const instructionId=`TRIAL-${String(row.sampleIndex).padStart(4,'0')}`;
  const reference=`SYN202609${String(row.sampleIndex).padStart(2,'0')}`;
  const coverage={business_intent:'物流状态查询',customer_emotion:'焦虑',information_completeness:'信息完整',tool_path:'查询成功'};
  const statePath=['collect_information','resolved'];
  const instruction={instruction_id:instructionId,data_format:'messages_jsonl',assignment_id:`ASSIGN-${row.versionId}-${String(row.sampleIndex).padStart(6,'0')}`,scenario:'模板配置的对话场景',intent:'业务咨询',coverage_labels:coverage,business_facts:{synthetic_reference:reference},applied_knowledge_card_ids:[],state_path:statePath,expected_final_state:'resolved',information_disclosure:{initial_fields:[],withheld_fields:[],disclosure_condition:''},tool_context:{tool_name:null,arguments:{},result:{}},synthesis_instruction:'依据“模板场景 / 合法案例 / 交互分支”及冻结业务事实生成自然、准确的中文多轮对话；不得修改事实或披露顺序。'};
  const conversation={data_source:'conversation_synthesis',prompt:[{role:'system',content:'你是物流智能客服。只依据给定的虚构业务事实、知识卡和工具结果回答，不得编造信息。'},{role:'user',content:`我的虚构运单 ${reference} 已经两天没有更新了，请帮我查一下是什么情况。`}],response:'我已根据虚构运单号查询到：当前状态为运输延误，最后更新时间是 2026-09-01 16:00:00，已知原因为强降雨影响转运处理。暂时没有新的送达时间，我可以为你说明后续查询方式。',ability:'customer_service',extra_info:{instruction_id:instructionId,coverage_labels:coverage,state_path:statePath,expected_final_state:'resolved',applied_knowledge_card_ids:[]}};
  return {instruction,conversation};
}
function Json({value}){const text=JSON.stringify(value,(key,item)=>key==='template'&&item?Object.fromEntries(Object.entries(item).filter(([k])=>k!=='version')):item,2);return <><div style={{textAlign:'right'}}><Text copyable={{text}}>复制 JSON</Text></div><pre className="badcase-json">{text}</pre></>;}
function DocumentImage({row,preview}){
  return <Image alt={`文档模拟预览 ${row.id}`} src={preview.imageUrl} style={{width:'100%',objectFit:'contain'}}/>;
}
function timeseriesPreview(row){
  const time=minute=>`2026-09-01T08:${String(minute).padStart(2,'0')}:00+08:00`;
  return {
    sample_id:row.id,
    template:{id:'SYN-TPL-TS',version:'0.2'},
    entity_id:`SYN-BOX-${String(row.sampleIndex).padStart(3,'0')}`,
    scenario:'稳定冷藏运输',
    start:time(0),end:time(20),
    content_origin:'controlled_synthetic',
    content_notice:'合成示例，仅供训练，不具业务效力',
    event_plan:[{event_id:'E-001',type:'normal_transport',start:time(0),end:time(20),parameters:{target_temperature_c:4},constraints:['温度保持稳定']}],
    series:{
      temperature:{unit:'degC',sampling_interval_seconds:300,points:[4,4.2,4.4,4.1,4].map((value,i)=>({time:time(i*5),value}))},
      humidity:{unit:'percent',sampling_interval_seconds:300,points:[60,61,62,63,64].map((value,i)=>({time:time(i*5),value}))},
      gps:{coordinate_system:'WGS84',sampling_interval_seconds:600,points:[0,1,2].map(i=>({time:time(i*10),value:{longitude:Number((118.1+i*.01).toFixed(2)),latitude:Number((24.5+i*.01).toFixed(2))}}))}
    }
  };
}
export default function DatasetPreview({dataset,version}){
  const reports=useMemo(()=>versionReportsForDisplay(dataset,version),[dataset,version]),[reportId,setReportId]=useState(null);
  const report=reports.find(r=>r.reportId===reportId)||preferredQualityReport(reports);
  version=versionWithReport(version,report);
  const total=Math.max(0,Math.floor(Number(version.samples)||0));
  const indices=fixedIndices(total),[selected,setSelected]=useState(0);
  const rows=indices.map(i=>sample(dataset,version,i)),row=rows[selected];
  const documentPreview=row?.type==='document'?documentSamplePreview(row,dataset):null;
  return <><Space style={{display:'flex',justifyContent:'space-between',marginBottom:16}}><Text>固定预览前 10 条（原型示例）</Text>{reports.length>0&&<Select placeholder="请选择预览关联的质检报告" aria-label="预览关联的质检报告" value={report?.reportId} onChange={setReportId} style={{width:260}} options={reports.map(r=>({value:r.reportId,label:r.reportId}))}/>}</Space>{!row?<Empty description="暂无数据"/>:<><div className="dataset-preview-layout"><aside className="dataset-preview-list">{rows.map((r,i)=><button key={r.id} className={`dataset-preview-item ${selected===i?'selected':''}`} onClick={()=>setSelected(i)}><div className="dataset-preview-id">{r.id}</div></button>)}</aside><section style={{minWidth:0}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:16}}><Text copyable style={{minWidth:0,overflowWrap:'anywhere'}}>{row.id}</Text><Space style={{flexShrink:0}}><Button disabled={selected===0} onClick={()=>setSelected(selected-1)}>上一条</Button><Button disabled={selected===rows.length-1} onClick={()=>setSelected(selected+1)}>下一条</Button></Space></div>{row.type==='conversation'?<Json value={conversationPreview(row)}/>:row.type==='timeseries'?<Json value={timeseriesPreview(row)}/>:<Tabs items={[
    {key:'view',label:'图像',children:<DocumentImage row={row} preview={documentPreview}/>},
    {key:'json',label:'标注',children:<Json value={documentPreview.annotation}/>}
  ]}/>}</section></div></>}</>;
}
