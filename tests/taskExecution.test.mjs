import assert from 'node:assert/strict';
import {newExecutionTask,advanceExecution,summarizeExecution,sampleOutcome,queryBadcases,qualityExecutionMetadata,versionSample,stopExecution} from '../src/taskExecution.js';
const rule={id:'CHECK-1',name:'语义检查',method:'LLM'};
function run(type,fixture='mixed',n=100,extra={}){
  let t=newExecutionTask({taskType:type,modality:'对话文本',name:'测试',sampleCount:n,effectiveTargetCount:n,selectableCount:n,sourceVersion:{samples:1000},qualityCheckedSampleCount:n,qualityRules:[rule],inputVersionId:'SOURCE',...extra},'TASK-TEST','VERSION',fixture);
  for(let i=0;i<12;i++)t=advanceExecution(t);
  return t;
}
for(const modality of ['文档图像','对话文本','时序数据'])for(const type of ['数据合成','数据质检','数据增强','定向扩增']){
  const t=run(type,'mixed',121,{modality});const s=t.executionSummary;
  assert.equal(t.status,'已完成',`${modality} ${type}: retained Badcases must not create an ambiguous task state`);
  assert.equal(s.processedSampleCount,s.succeededSampleCount+s.badcaseSampleCount);
  const outcomes=Array.from({length:121},(_,i)=>sampleOutcome(t,i));
  assert.equal(s.apiAttemptCount,outcomes.reduce((sum,o)=>sum+o.trace.reduce((n,a)=>n+a.attempts,0),0));
  assert.equal(s.badcaseSampleCount,outcomes.filter(o=>o.failed).length);
  assert.equal(queryBadcases(t,{pageSize:50}).total,s.badcaseSampleCount);
  const expected=outcomes.map((o,i)=>o.failed?i:null).filter(i=>i!==null);
  assert.deepEqual(queryBadcases(t,{pageSize:50}).rows.map(r=>Number(r.sampleId.split('-').at(-1))-1),expected);
}
const qc=run('数据质检');const meta=qualityExecutionMetadata(qc);
assert.equal(qc.executionSummary.outputSampleCount,1000);
assert.equal(meta.uncheckedSampleCount,900);
assert.equal(meta.errorSampleCount,5);
assert.equal(versionSample(qc,4).executionStatus,'ERROR');
assert.equal(versionSample(qc,100).executionStatus,'NOT_SELECTED');
assert.equal(versionSample(qc,4).ruleResults[0].status,'ERROR');
const recheck=run('数据增强');
assert.equal(recheck.configSnapshot.sourceSelection,undefined,'普通增强不能按某条质检规则筛样');
assert.ok(versionSample(recheck,0).sourceSampleId,'普通增强仍应关联输入样本');
assert.equal(sampleOutcome(recheck,4).trace[0].attempts,1);
assert.equal(sampleOutcome(recheck,4).trace.at(-1).attempts,3);
assert.equal(sampleOutcome(recheck,4).retainedError,true);
const all=run('数据合成','all-error');assert.equal(all.status,'异常');assert.equal(all.executionSummary.outputSampleCount,0);
const allQc=run('数据质检','all-error');assert.equal(allQc.executionSummary.outputSampleCount,1000);assert.equal(qualityExecutionMetadata(allQc).ruleSummaries[0].passRate,null);
const config=run('数据合成','config-error');assert.equal(config.executionSummary.processedSampleCount,1);assert.equal(config.executionSummary.apiAttemptCount,1);
const success=run('数据质检','success');assert.equal(success.status,'已完成');assert.ok(success.executionSummary.failCount>0);assert.equal(success.executionSummary.badcaseSampleCount,0);
const local=run('数据质检','mixed',100,{qualityRules:[{id:'LOCAL',method:'规则判断'}]});assert.equal(local.executionSummary.apiAttemptCount,0);assert.equal(local.executionSummary.badcaseSampleCount,0);
const privacy=run('数据增强','privacy-error',100,{qualityRules:[{...rule,privacy:true}]});assert.equal(privacy.executionSummary.outputSampleCount,0);
const stopped=stopExecution(newExecutionTask({taskType:'数据合成',sampleCount:20},'STOP','V'));assert.deepEqual(advanceExecution(stopped),stopped);
const big=run('数据合成','mixed',220000);assert.ok(JSON.stringify(big).length<12000);assert.equal(queryBadcases(big,{page:200,pageSize:50}).rows.length,50);
assert.equal(queryBadcases(big,{query:'0000005'}).total,1);
const snapshot=JSON.parse(JSON.stringify(big));assert.deepEqual(summarizeExecution(snapshot),big.executionSummary);
console.log('taskExecution: retry, skip, privacy, sampling, paging, stop and persistence tests passed');
