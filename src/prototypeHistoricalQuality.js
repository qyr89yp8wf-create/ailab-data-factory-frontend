import {qualityReports} from './qualityHistory.js';
import {freezeRules} from './qualityResults.js';
import {advanceExecution,newExecutionTask,qualityExecutionMetadata} from './taskExecution.js';
import {demoQualityDefinition} from './qualityDemoFixtures.js';

// Only legacy built-in demo fixtures receive a labelled, simulated report.
// Historical evaluator outcomes are never inferred from an overall score.
export function prototypeHistoricalQualityReport(dataset,version) {
  if(!dataset?.reference||!version||version.qualityChecked===false)return null;
  const reports=qualityReports(version);
  if(reports.some(report=>report.protocolVersion===2))return null;
  const historical=reports[0];
  const definition=demoQualityDefinition(dataset.modality,version.taskConfigSnapshot?.templateProfile||{}),rules=definition.rules;
  if(!historical||!rules.length)return null;
  const sampleCount=Math.max(0,Number(version.samples)||0);
  const checkedSampleCount=Math.min(sampleCount,Math.max(0,Number(historical.checkedSampleCount??sampleCount)||0));
  if(!checkedSampleCount)return null;
  const taskId=`MOCK-HISTORICAL-${version.version}`;
  const values={taskType:'数据质检',modality:dataset.modality,name:'历史版本报告原型模拟',
    inputDatasetId:dataset.id,inputVersionId:version.version,sourceVersion:{version:version.version,samples:sampleCount},
    qualityCheckedSampleCount:checkedSampleCount,qualityScope:checkedSampleCount<sampleCount?'sample':'full',
    labelSnapshot:definition.labelSnapshot,qualityRules:rules,templateProfile:{id:historical.templateId||version.templateId,version:historical.templateVersion||version.templateVersion}};
  let task=newExecutionTask(values,taskId,version.version,'success');
  for(let tick=0;tick<12;tick++)task=advanceExecution(task);
  return {...qualityExecutionMetadata(task),reportId:`QREPORT-MOCK-${version.version}`,taskId,
    createdAt:version.created||version.updatedAt,prototypeBackfill:true,
    sampleExecution:task,inputVersionId:version.version,outputVersionId:version.version};
}
export function versionReportsForDisplay(dataset,version) {
  const reports=qualityReports(version);
  const prototype=prototypeHistoricalQualityReport(dataset,version);
  return prototype?[prototype,...reports]:reports;
}

export function prototypeQualityTaskReport(task,{dataset,version,template,matchingReport,rules=[]}={}) {
  if(task?.taskType!=='数据质检'||matchingReport?.protocolVersion===2||
    !['已完成','部分完成'].includes(task.status))return null;
  const definition=dataset?.reference?demoQualityDefinition(task.modality,task.configSnapshot?.templateProfile||template||{}):null;
  const ruleSnapshot=definition?definition.rules:freezeRules(matchingReport?.ruleSnapshot?.length?matchingReport.ruleSnapshot:
    task.configSnapshot?.qualityRules?.length?task.configSnapshot.qualityRules:rules);
  const sampleCount=Math.max(0,Number(version?.samples||matchingReport?.sampleCount)||0);
  const checkedSampleCount=Math.min(sampleCount,Math.max(0,Number(
    matchingReport?.checkedSampleCount??task.executionSummary?.processedSampleCount??sampleCount)||0));
  if(!ruleSnapshot.length||!checkedSampleCount)return null;
  const versionId=version?.version||task.sourceVersionId||task.outputVersionId;
  const values={taskType:'数据质检',modality:task.modality,name:task.name,
    ...(definition?{labelSnapshot:definition.labelSnapshot}:{}),
    inputDatasetId:dataset?.id,inputVersionId:versionId,sourceVersion:{version:versionId,samples:sampleCount},
    qualityCheckedSampleCount:checkedSampleCount,qualityScope:checkedSampleCount<sampleCount?'sample':'full',
    qualityRules:ruleSnapshot,templateProfile:{id:matchingReport?.templateId||template?.id||version?.templateId,
      version:matchingReport?.templateVersion||template?.version||version?.templateVersion}};
  let simulated=newExecutionTask(values,`MOCK-${task.id}`,versionId,'success');
  for(let tick=0;tick<12;tick++)simulated=advanceExecution(simulated);
  return {...qualityExecutionMetadata(simulated),reportId:`QREPORT-MOCK-${task.id}`,taskId:task.id,
    createdAt:task.updated||task.created,prototypeBackfill:true,sampleExecution:simulated,
    inputVersionId:versionId,outputVersionId:versionId};
}
