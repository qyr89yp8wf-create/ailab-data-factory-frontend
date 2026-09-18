import {CATALOG_VERSION} from './qualityCatalog.js';
import {demoQualityDefinition} from './qualityDemoFixtures.js';
import {newExecutionTask,advanceExecution,qualityExecutionMetadata} from './taskExecution.js';

// Explicit allowlist: never upgrade a user-created frozen task by guessing its name.
const BUILTIN_IDS=new Set([
 'TASK-20260915-DOC-ENHANCE-001','TASK-20260915-CONV-EXPAND-001',
 'TASK-20260916-DOC-QUALITY-001','TASK-20260916-CONV-QUALITY-001',
 'TASK-20260916-TS-QUALITY-001','TASK-20260915-TS-QUALITY-001',
 'TASK-20260914-RETRY-1','TASK-20260914-RETRY-2','TASK-20260914-RETRY-3',
]);
const MIGRATION_VERSION=CATALOG_VERSION+':5-execution-errors';
export function refreshBuiltinQuality(tasks,datasets){
 const changed=new Map();
 const nextTasks=tasks.map(task=>{
  if(!BUILTIN_IDS.has(task.id)||!task.execution||task.configSnapshot?.builtinCatalogVersion===MIGRATION_VERSION)return task;
  const previous=task.configSnapshot||{},config=previous.templateProfile?.configuration||previous.templateProfile?.documentSnapshot||{};
  const definition=demoQualityDefinition(task.modality,config);
  const values={...previous,qualityRules:definition.rules,labelSnapshot:definition.labelSnapshot,builtinCatalogVersion:MIGRATION_VERSION};
  let rebuilt=newExecutionTask(values,task.id,task.plannedOutputVersionId||task.outputVersionId,task.execution.fixture);
  for(let i=0;i<12;i++)rebuilt=advanceExecution(rebuilt);
  const next={...task,configSnapshot:rebuilt.configSnapshot,execution:{...rebuilt.execution,startedAt:task.execution.startedAt},executionSummary:rebuilt.executionSummary};
  changed.set(task.id,next);return next;
 });
 if(!changed.size)return {changed:false,tasks,datasets};
 const updateReport=report=>{
  const task=changed.get(report?.taskId||report?.sampleExecution?.id);
  return task?{...report,...qualityExecutionMetadata(task)}:report;
 };
 const nextDatasets=datasets.map(dataset=>{let sampleDelta=0;const versions=(dataset.versions||[]).map(version=>{
  const producer=changed.get(version.source),samples=producer&&producer.taskType!=='数据质检'?producer.executionSummary.outputSampleCount:version.samples;
  sampleDelta+=Number(samples||0)-Number(version.samples||0);
  return {
  ...version,samples,qualityReport:updateReport(version.qualityReport),
  ...(version.qualityReports?{qualityReports:version.qualityReports.map(updateReport)}:{}),
  ...(changed.has(version.sampleExecution?.id)?{sampleExecution:changed.get(version.sampleExecution.id)}:{}),
  ...(changed.has(version.source)?{taskConfigSnapshot:changed.get(version.source).configSnapshot}:{}),
 };});return {...dataset,totalSamples:Number(dataset.totalSamples||0)+sampleDelta,versions};});
 return {changed:true,tasks:nextTasks,datasets:nextDatasets};
}
