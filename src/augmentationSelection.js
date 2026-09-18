import {versionSample,sampleOutcome} from './taskExecution.js';
import {isDistribution} from './qualityResults.js';
import {taskQualityRules} from './qualityScope.js';
export function augmentationPool(report,mode='pass',threshold=100){
 const rules=taskQualityRules(report?.ruleSnapshot).filter(r=>!isDistribution(r));
 const task=report?.sampleExecution,n=Number(report?.checkedSampleCount||0);
 const period=task?(task.taskType==='数据质检'?60:Array.from({length:60},(_,i)=>i).filter(i=>sampleOutcome(task,i).included).length):0;
 const samples=report?.sampleResults|| (period?Array.from({length:Math.min(n,period)},(_,i)=>versionSample(task,i)):[]);
 const rows=samples.map((sample,index)=>{const results=rules.map(rule=>sample.ruleResults?.find(r=>r.id===rule.id));const applicable=results.filter(r=>r?.status!=='NOT_APPLICABLE');const valid=applicable.length>0&&applicable.every(r=>r&&['PASS','FAIL'].includes(r.status));const failed=applicable.filter(r=>r?.status==='FAIL');return {sampleId:sample.sampleId,index,valid,score:valid?(applicable.length-failed.length)/applicable.length*100:null,failed:failed.map(r=>r.name||r.id),weight:report.sampleResults?1:Math.floor((n-1-index)/period)+1};});
 const valid=rows.filter(r=>r.valid),count=valid.reduce((n,r)=>n+r.weight,0),sorted=valid.slice().sort((a,b)=>a.score-b.score);
 const at=rank=>{let total=0;for(const row of sorted){total+=row.weight;if(total>rank)return row.score;}return null;};
 const median=count?(at(Math.floor((count-1)/2))+at(Math.floor(count/2)))/2:null;
 const minScore=sorted[0]?.score??null,maxScore=sorted.at(-1)?.score??null;
 const effectiveThreshold=count?Math.min(maxScore,Math.max(minScore,Number.isFinite(threshold)?threshold:maxScore)):null;
 const selected=valid.filter(r=>mode==='pass'?r.failed.length===0:r.score>=effectiveThreshold);
 const uncheckedIds=report?.sampleResults?.filter(s=>{const results=rules.map(r=>s.ruleResults?.find(x=>x.id===r.id));return results.length>0&&results.every(r=>r&&['NOT_SELECTED','NOT_RUN'].includes(r.status));}).map(s=>s.sampleId);
 const uncheckedCount=uncheckedIds?uncheckedIds.length:Math.max(0,Number(report?.notSelectedSampleCount||0)+Number(report?.notRunSampleCount||0));
 return {rows,selected,minScore,maxScore,effectiveThreshold,uncheckedCount,uncheckedStart:n,uncheckedIds,validCount:count,passCount:valid.filter(r=>!r.failed.length).reduce((n,r)=>n+r.weight,0),count:selected.reduce((n,r)=>n+r.weight,0),median,period,slots:selected.map(r=>r.index),sampleIds:report?.sampleResults?selected.map(r=>r.sampleId):undefined};
}
