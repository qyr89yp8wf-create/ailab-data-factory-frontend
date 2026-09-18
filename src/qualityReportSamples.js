import {plannedCount,sampleOutcome,versionSample} from './taskExecution.js';
export function reportSamplePage(report,ruleId,status,page=1,pageSize=10){
  const wrap=sample=>({...sample,rule:sample.ruleResults.find(r=>r.id===ruleId)});
  if(report.sampleResults)return report.sampleResults.filter(s=>s.ruleResults.some(r=>r.id===ruleId&&r.status===status)).slice((page-1)*pageSize,page*pageSize).map(wrap);
  const task=report.sampleExecution;if(!task)return [];
  const n=Number(report.sampleCount||0),processed=Number(report.checkedSampleCount||0);
  if(status==='NOT_SELECTED'||status==='NOT_RUN'){
    const start=status==='NOT_SELECTED'?plannedCount(task.configSnapshot):processed;
    const end=status==='NOT_SELECTED'?n:plannedCount(task.configSnapshot);
    return Array.from({length:Math.max(0,Math.min(pageSize,end-start-(page-1)*pageSize))},(_,i)=>wrap(versionSample(task,start+(page-1)*pageSize+i)));
  }
  const period=task.taskType==='数据质检'?60:Array.from({length:60},(_,i)=>i).filter(i=>sampleOutcome(task,i).included).length;
  const slots=Array.from({length:Math.min(period,processed)},(_,i)=>i).filter(i=>versionSample(task,i).ruleResults.some(r=>r.id===ruleId&&r.status===status));
  if(!slots.length)return [];
  const total=slots.reduce((n,i)=>n+Math.floor((processed-1-i)/period)+1,0),rows=[];
  for(let rank=(page-1)*pageSize;rank<Math.min(page*pageSize,total);rank++)rows.push(wrap(versionSample(task,Math.floor(rank/slots.length)*period+slots[rank%slots.length])));
  return rows;
}
