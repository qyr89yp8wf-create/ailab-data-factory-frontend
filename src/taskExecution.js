import {taskQualityRules} from './qualityScope.js';
import {sampledRank,selectionIndex} from './augmentationSampling.js';
import {autoQualityEnabled} from './taskPolicies.js';
// Deterministic, compact browser simulation. Never calls an external provider.
import {freezeRules,isDistribution,mockRuleResults,ruleSummary,templateLabelSnapshot,mockLabelDistributions} from './qualityResults.js';
export const RETRY_POLICY = { maxAttemptsPerStep: 3, retryDelaysMs: [1000, 3000] };
export const ERROR_LABELS = { TIMEOUT:'请求超时', RATE_LIMIT:'限流', SERVICE_ERROR:'服务异常', INVALID_RESPONSE:'返回格式异常', CONFIG_ERROR:'配置异常' };
const count = value => Math.max(0, Math.floor(Number(value)||0));
const stamp = value => new Date(value).toLocaleString('sv-SE').replace('T',' ');
export function executionSteps(v) {
  const steps=[];
  const add=(id,name,model,extra={})=>steps.push({id,name,model:model||v.templateProfile?.defaultModel||'Qwen3-14B',apiConfigName:'任务模型配置',...extra});
  const doc=v.modality==='文档图像';
  if(v.taskType==='数据合成'){
    if(!doc)add('plan','内容规划',v.generationModel);
    add('generate','内容生成',v.generationModel);
    if(doc&&v.templateProfile?.method==='底图生成法')add('image','图像生成',v.imageGenerationModel||v.templateProfile?.imageModel,{image:true});
  }
  if(v.taskType==='定向扩增'){
    add('expand','定向扩增',v.expansionModel);
    if(doc)add('image','图像生成',v.imageGenerationModel||v.templateProfile?.imageModel,{image:true});
  }
  if(v.taskType==='数据增强'){
    if(!doc||v.documentEnhancementTypes?.includes('语义增强'))add('enhance',doc?'语义增强':v.modality==='时序数据'?'事件与参数增强':'语义增强',v.semanticEnhancementModel||v.enhancementModel);
    if(doc&&v.documentEnhancementTypes?.includes('背景增强'))add('background','背景增强',v.backgroundEnhancementModel,{image:true});
  }
  if(autoQualityEnabled(v)||v.taskType==='数据增强'){
    const rules=(v.qualityRules||[]).filter(r=>r.enabled!==false&&!isDistribution(r)).map(r=>({...r,privacy:r.privacy||r.category==='隐私质检'||/PRIVACY|PII|隐私|敏感/i.test(`${r.id||r.rule_id||''} ${r.name||''}`)}));
    // Privacy checks run first, before an output can pass its privacy gate.
    const sorted=[...rules.filter(r=>r.privacy),...rules.filter(r=>!r.privacy)];
    for(const r of sorted){
      if(!autoQualityEnabled(v)&&!r.privacy)continue;
      const method=`${r.method||''} ${r.engine||''} ${r.mode||''}`;
      if(!/LLM|VLM|Embedding|语义|semantic|vlm|模型/i.test(method))continue;
      const vlm=/VLM|vlm/.test(method);
      add(`qc-${r.id||r.rule_id}`,r.privacy?(autoQualityEnabled(v)?'隐私复检':'隐私处理检查'):v.taskType==='数据质检'?(vlm?'VLM 质检':'语义质检'):'自动复检',/Embedding/i.test(method)?v.qualityEmbeddingModel:vlm?(v.qualityVlmModel||v.qualityModel):v.qualityModel,{quality:autoQualityEnabled(v),privacy:!!r.privacy,ruleId:r.id||r.rule_id,ruleName:r.name});
    }
  }
  return steps;
}
export function plannedCount(v){
  if(v.taskType==='数据质检')return count(v.qualityCheckedSampleCount??v.sourceVersion?.samples);
  if(v.taskType==='数据合成')return count(v.sampleCount);
  if(v.taskType==='数据增强')return v.sourceSelection?count(v.effectiveTargetCount??v.targetCount):Math.min(count(v.effectiveTargetCount??v.targetCount),count(v.selectableCount??v.sourceVersion?.samples));
  return count(v.effectiveTargetCount??v.targetCount);
}
export function newExecutionTask(v,id,versionId,fixture='mixed'){
  if(v.taskType==='定向扩增'){const {sourceSelection,augmentationSelection,selectionRuleId,sampleSelection,...rest}=v;v=rest;}
  if(v.sourceSelection)v={...v,sourceSelection:{...v.sourceSelection,seed:v.sourceSelection.seed??Math.floor(Math.random()*2147483647)}};
  if(v.taskType==='数据增强'){
    const {mandatoryPrivacy,privacyMethod,privacyMethods,conversationPrivacyMethod,timeseriesPrivacyMethod,privacyPolicy,...rest}=v;
    v={...rest,documentImageMethods:rest.documentImageMethods?.filter(method=>method!=='标注同步')};
  }
  v=JSON.parse(JSON.stringify({...v,qualityProtocolVersion:2,qualityRules:freezeRules(taskQualityRules(v.qualityRules))}));
  if(v.taskType==='数据质检'){
    versionId=v.inputVersionId||v.sourceVersion?.version;
    const {versionNote,selectedRuleIds,selectedFields,qualityThreshold,passThreshold,reviewThreshold,selectionThreshold,...configuration}=v;
    v={...configuration,outputMode:'sameVersion'};
  }
  // Keep upstream references, not recursive copies of previous execution histories.
  if(v.taskType==='定向扩增'&&v.expansionTargets?.length){
    const source=v.qualityReportSnapshot?.sampleExecution;
    v.expansionTargets=v.expansionTargets.map(target=>{
      if(target.kind!=='规则不通过'||!source)return target;
      const period=source.taskType==='数据质检'?60:Array.from({length:60},(_,i)=>i).filter(i=>sampleOutcome(source,i).included).length;
      const slots=Array.from({length:Math.min(period,v.qualityReportSnapshot.checkedSampleCount)},(_,i)=>i).filter(i=>versionSample(source,i)?.ruleResults.some(r=>r.id===target.ruleId&&r.status==='FAIL'));
      return {...target,parentSelection:{period,slots}};
    });
  }
  if(v.taskType==='数据增强'&&v.selectionRuleId&&v.qualityReportSnapshot?.sampleExecution){
    const report=v.qualityReportSnapshot,source=report.sampleExecution;
    const period=source.taskType==='数据质检'?60:Array.from({length:60},(_,i)=>i).filter(i=>sampleOutcome(source,i).included).length;
    const slots=Array.from({length:Math.min(period,report.checkedSampleCount)},(_,i)=>i).filter(i=>versionSample(source,i)?.ruleResults.some(r=>r.id===v.selectionRuleId&&r.status===v.sampleSelection));
    v.sourceSelection={period,slots};
  }
  if(v.qualityReportSnapshot){const {sampleExecution,...report}=v.qualityReportSnapshot;v={...v,qualityReportSnapshot:report};}
  if(v.sourceVersion){
    const source=v.sourceVersion.sampleExecution;
    const identity=source?(source.taskType==='数据质检'?source.configSnapshot?.sourceSampleIdentity:{taskId:source.id,slots:Array.from({length:60},(_,i)=>i).filter(i=>sampleOutcome(source,i).included)}):null;
    v={...v,sourceSampleIdentity:v.sourceSampleIdentity||identity,sourceVersion:{version:v.sourceVersion.version,samples:v.sourceVersion.samples,templateId:v.sourceVersion.templateId}};
  }
  const createdAt=Date.now();
  return {id,key:id,name:v.name,description:v.description,taskType:v.taskType,modality:v.modality,businessType:v.businessType,stages:[v.taskType],input:v.input,output:'待生成',status:'运行中',progress:0,currentStage:'准备样本',created:stamp(createdAt),updated:stamp(createdAt),configSnapshot:{...v,retryPolicy:RETRY_POLICY},sourceDatasetId:v.inputDatasetId||null,sourceVersionId:v.inputVersionId||null,plannedOutputVersionId:versionId,badcaseTrackingVersion:1,retryPolicy:RETRY_POLICY,execution:{fixture,startedAt:createdAt,tick:0,processed:0,steps:executionSteps(v)},executionSummary:{plannedSampleCount:plannedCount(v),processedSampleCount:0,succeededSampleCount:0,badcaseSampleCount:0,outputSampleCount:0,retriedSampleCount:0,apiAttemptCount:0}};
}
// Outcomes repeat every 60 samples. Persist this recipe, not millions of records.
export function sampleOutcome(task,index){
  const steps=task.execution.steps, fixture=task.execution.fixture, slot=index%60;
  const forced=fixture==='all-error'||fixture==='config-error'||fixture==='privacy-error';
  const fail=steps.length>0&&(forced||(fixture==='mixed'&&slot%20===4));
  const choices=steps.map((s,i)=>i).filter(i=>fixture!=='privacy-error'||steps[i].privacy);
  const qualityIndex=steps.findIndex(s=>s.quality&&!s.privacy);
  let failedStep=fail?(choices[Math.floor(slot/20)%choices.length]??0):-1;
  if(fail&&slot===4&&qualityIndex>=0&&task.taskType!=='数据质检')failedStep=qualityIndex;
  const trace=[];
  let retried=false;
  for(let i=0;i<steps.length;i++){
    const failed=i===failedStep;
    const attempts=failed?(fixture==='config-error'?1:3):i===0&&fixture==='mixed'&&(slot%20===1||slot%20===2)?(slot%20===1?2:3):1;
    if(attempts>1)retried=true;
    trace.push({stepIndex:i,attempts,status:failed?'ERROR':'SUCCESS'});
    if(failed&&task.taskType!=='数据质检')break;
  }
  const step=steps[failedStep];
  const isQuality=task.taskType==='数据质检';
  const included=!fail||isQuality||(step?.quality&&!step.privacy);
  const result=fail?'ERROR':slot%17===0?'FAIL':slot%11===0?'REVIEW':'PASS';
  return {failed:fail,failedStep,retried,trace,included,result,retainedError:fail&&included,errorType:fixture==='config-error'?'CONFIG_ERROR':['TIMEOUT','RATE_LIMIT','INVALID_RESPONSE'][Math.floor(slot/20)%3]};
}
function population(total,slot){return total>slot?Math.floor((total-1-slot)/60)+1:0;}
export function summarizeExecution(task,processed=task.execution.processed){
  const planned=plannedCount(task.configSnapshot), n=Math.min(planned,count(processed));
  const summary={plannedSampleCount:planned,processedSampleCount:n,succeededSampleCount:0,badcaseSampleCount:0,outputSampleCount:0,retriedSampleCount:0,apiAttemptCount:0,retryAttemptCount:0,logicalStepCount:0,modelAttemptCount:0,imageAttemptCount:0,retainedErrorCount:0,passCount:0,failCount:0,reviewCount:0};
  for(let slot=0;slot<60;slot++){
    const weight=population(n,slot);if(!weight)continue;
    const row=sampleOutcome(task,slot);
    summary[row.failed?'badcaseSampleCount':'succeededSampleCount']+=weight;
    if(row.included)summary.outputSampleCount+=weight;
    if(row.retainedError)summary.retainedErrorCount+=weight;
    if(row.retried)summary.retriedSampleCount+=weight;
    if(!row.failed)summary[{PASS:'passCount',FAIL:'failCount',REVIEW:'reviewCount'}[row.result]]+=weight;
    for(const t of row.trace){summary.apiAttemptCount+=t.attempts*weight;summary.retryAttemptCount+=(t.attempts-1)*weight;summary.logicalStepCount+=weight;summary[task.execution.steps[t.stepIndex].image?'imageAttemptCount':'modelAttemptCount']+=t.attempts*weight;}
  }
  if(task.taskType==='数据质检')summary.outputSampleCount=count(task.configSnapshot.sourceVersion?.samples);
  return summary;
}
export function advanceExecution(task){
  if(!task.execution||task.status!=='运行中')return task;
  const tick=task.execution.tick+1;
  const planned=plannedCount(task.configSnapshot);
  const processed=task.execution.fixture==='config-error'?Math.min(1,planned):Math.floor(planned*Math.min(12,tick)/12);
  const execution={...task.execution,tick,processed};
  const executionSummary=summarizeExecution({...task,execution},processed);
  const finished=tick>=12||task.execution.fixture==='config-error';
  const status=finished?(executionSummary.succeededSampleCount===0||task.execution.fixture==='config-error'?'异常':'已完成'):'运行中';
  return {...task,execution,executionSummary,status,updated:stamp(Date.now()),progress:planned?Math.round(processed/planned*100):0,currentStage:finished?'执行结束':tick%3===1?'样本处理中':tick%3===2?'异常请求重试中':'样本结果写入中',apiUsage:{model:executionSummary.modelAttemptCount,image:executionSummary.imageAttemptCount,tokens:null}};
}
export function stopExecution(task){return {...task,status:'已终止',currentStage:'用户终止',updated:stamp(Date.now()),output:'未提交正式版本'};}
export function qualityExecutionMetadata(task){
  const s=summarizeExecution(task),v=task.configSnapshot,ruleSnapshot=freezeRules(v.qualityRules);
  const checked=task.taskType==='数据质检'?s.processedSampleCount:s.outputSampleCount;
  const hits=new Map();
  const counts=new Map(ruleSnapshot.filter(r=>!isDistribution(r)).map(r=>[r.id,{}]));
  const period=task.taskType==='数据质检'?60:Array.from({length:60},(_,i)=>i).filter(i=>sampleOutcome(task,i).included).length;
  for(let slot=0;slot<Math.min(checked,period);slot++){
    const weight=Math.floor((checked-1-slot)/period)+1;
    for(const r of versionSample(task,slot).ruleResults){const c=counts.get(r.id);if(c)c[r.status]=(c[r.status]||0)+weight;hits.set(r.id,(hits.get(r.id)||0)+(r.objects||[]).filter(o=>o.status==='FAIL').length*weight);}
  }
  const notSelected=task.taskType==='数据质检'?Math.max(0,count(v.sourceVersion?.samples)-plannedCount(v)):0;
  const notRun=task.taskType==='数据质检'?Math.max(0,plannedCount(v)-checked):0;
  const ruleSummaries=ruleSnapshot.filter(r=>!isDistribution(r)).map(r=>({...ruleSummary(r,{...counts.get(r.id),NOT_SELECTED:notSelected,NOT_RUN:notRun}),hitCount:hits.get(r.id)||0}));
  const labelSnapshot=v.labelSnapshot||templateLabelSnapshot(v.templateProfile?.configuration||v.templateProfile?.documentSnapshot||{},v.modality);
  return {protocolVersion:2,mock:true,executionTrackingVersion:2,executionStatus:task.status,executionRange:v.qualityScope==='sample'?'sample':'full',sampleCount:s.outputSampleCount,checkedSampleCount:checked,errorSampleCount:s.retainedErrorCount,uncheckedSampleCount:notSelected+notRun,notSelectedSampleCount:notSelected,notRunSampleCount:notRun,coverageGaps:[],ruleSnapshot,ruleSummaries,distributionRules:ruleSnapshot.filter(isDistribution),labelSnapshot,distributions:mockLabelDistributions(labelSnapshot,checked),templateId:v.templateProfile?.id||v.templateId,templateVersion:v.templateProfile?.version||'未记录',sampleExecution:task};
}
function qualitySourceSampleId(task,index){
  const identity=task.configSnapshot?.sourceSampleIdentity;
  const slots=identity?.slots;
  const sourceIndex=slots?.length?Math.floor(index/slots.length)*60+slots[index%slots.length]:index;
  return `SAMPLE-${identity?.taskId||task.sourceVersionId}-${String(sourceIndex+1).padStart(7,'0')}`;
}
function upstreamSampleId(task,index){
  if(!task.sourceVersionId)return null;
  if(task.taskType==='定向扩增'){
    let offset=index;
    for(const target of task.configSnapshot.expansionTargets||[]){
      if(offset<target.plannedCount){const selection=task.configSnapshot.sourceSelection||target.parentSelection;if(selection?.count&&selection.checkedCount!=null){const selected=selectionIndex(selection,sampledRank(offset,selection.count,selection.seed));return selected.sampleId||qualitySourceSampleId(task,selected.index);}if(selection?.sampleIds?.length)return selection.sampleIds[offset%selection.sampleIds.length];if(!selection?.slots?.length)return null;const rank=selection.count?offset%selection.count:offset;return qualitySourceSampleId(task,Math.floor(rank/selection.slots.length)*(selection.period||60)+selection.slots[rank%selection.slots.length]);}
      offset-=target.plannedCount;
    }
    return null;
  }
  const selection=task.configSnapshot.sourceSelection;
  if(selection?.count&&selection.checkedCount!=null){const selected=selectionIndex(selection,sampledRank(index,selection.count,selection.seed));return selected.sampleId||qualitySourceSampleId(task,selected.index);}
  if(selection?.sampleIds?.length)return selection.sampleIds[index%selection.sampleIds.length];
  const selectedIndex=selection?.count?index%selection.count:index;
  const sourceIndex=selection?.slots?.length?Math.floor(selectedIndex/selection.slots.length)*selection.period+selection.slots[selectedIndex%selection.slots.length]:selectedIndex;
  return qualitySourceSampleId(task,sourceIndex);
}
export function versionSample(task,outputIndex){
  let index=outputIndex;
  if(task.taskType!=='数据质检'){
    const slots=Array.from({length:60},(_,i)=>i).filter(i=>sampleOutcome(task,i).included);
    if(!slots.length)return null;
    index=Math.floor(outputIndex/slots.length)*60+slots[outputIndex%slots.length];
  }
  const id=task.taskType==='数据质检'?qualitySourceSampleId(task,index):`SAMPLE-${task.id}-${String(index+1).padStart(7,'0')}`;
  if(task.taskType==='数据质检'&&index>=task.execution.processed)return {sampleId:id,executionStatus:index>=plannedCount(task.configSnapshot)?'NOT_SELECTED':'NOT_RUN',ruleResults:mockRuleResults(task.configSnapshot.qualityRules,index,{notChecked:index>=plannedCount(task.configSnapshot)?'NOT_SELECTED':'NOT_RUN'})};
  const out=sampleOutcome(task,index);
  const bc=out.failed?badcaseAt(task,index):null;
  return {sampleId:id,sourceSampleId:upstreamSampleId(task,index),badcaseId:bc?.id||null,executionStatus:out.failed?'ERROR':'SUCCESS',ruleResults:!autoQualityEnabled(task.configSnapshot)?[]:mockRuleResults(task.configSnapshot.qualityRules,index,{failedRuleId:out.failed?task.execution.steps[out.failedStep]?.ruleId:null,missingInput:out.failed&&!task.execution.steps[out.failedStep]?.quality,modality:task.modality,enhanced:task.taskType==='数据增强'||task.configSnapshot.sourceEnhanced===true,privacyPolicy:task.configSnapshot.privacyPolicy||[]})};
}
export function badcaseAt(task,index){
  const row=sampleOutcome(task,index);if(!row.failed)return null;
  const step=task.execution.steps[row.failedStep],seq=String(index+1).padStart(7,'0');
  const sampleId=task.taskType==='数据质检'?qualitySourceSampleId(task,index):`SAMPLE-${task.id}-${seq}`;
  const sourceSampleId=upstreamSampleId(task,index);
  const last=row.trace.find(t=>t.stepIndex===row.failedStep), end=Math.max(task.execution.startedAt,new Date((task.updated||task.created).replace(' ','T')).getTime());
  const duration=Math.max(0,end-task.execution.startedAt);
  const time=task.execution.startedAt+Math.max(0,duration-300)*(index/Math.max(1,task.execution.processed));
  return {id:`BADCASE-${task.id}-${seq}`,sampleId,sourceSampleId,taskId:task.id,taskName:task.name,sourceDatasetId:task.sourceDatasetId,sourceVersionId:task.sourceVersionId,outputVersionId:task.outputVersionId||null,stage:step.name,stepId:step.id,ruleId:step.ruleId||null,ruleName:step.ruleName||null,model:step.model,apiConfigName:step.apiConfigName,errorType:row.errorType,errorMessage:ERROR_LABELS[row.errorType],attemptCount:last.attempts,maxAttempts:3,disposition:row.included?'保留样本，标记质检异常':'跳过，不写入输出版本',updatedAt:stamp(time+last.attempts*100),samplingTarget:task.businessType||'-',attempts:Array.from({length:last.attempts},(_,i)=>({attemptNo:i+1,startedAt:stamp(time+i*100),finishedAt:stamp(time+(i+1)*100),status:'ERROR',errorType:row.errorType,errorCode:row.errorType==='RATE_LIMIT'?'429':row.errorType==='CONFIG_ERROR'?'401':'API_ERROR',sanitizedMessage:ERROR_LABELS[row.errorType],providerRequestId:`MOCK-${task.id}-${seq}-${i+1}`})),ruleResults:task.configSnapshot.qualityProtocolVersion===2?mockRuleResults(task.configSnapshot.qualityRules,index,{failedRuleId:step.ruleId,missingInput:!step.quality,modality:task.modality,enhanced:task.taskType==='数据增强'||task.configSnapshot.sourceEnhanced===true,privacyPolicy:task.configSnapshot.privacyPolicy||[]}):(task.configSnapshot.qualityRules||[]).map(r=>{const pos=task.execution.steps.findIndex(s=>s.ruleId===(r.id||r.rule_id));return {id:r.id||r.rule_id,name:r.name,status:pos===row.failedStep?'ERROR':pos>row.failedStep||!step.quality?'NOT_RUN':'PASS'};})};
}
export function queryBadcases(task,{page=1,pageSize=10,stage='',errorType='',query=''}={}){
  if(!task?.execution)return {total:0,rows:[]};
  const n=task.execution.processed;
  const slots=Array.from({length:Math.min(n,60)},(_,i)=>i).filter(i=>sampleOutcome(task,i).failed).filter(i=>{const row=badcaseAt(task,i);return (!stage||row.stage===stage)&&(!errorType||row.errorType===errorType);});
  const rows=[];let total=0;const needle=query.trim().toLowerCase();
  // No query: arithmetic population and direct rank selection for large batches.
  if(!needle){
    total=slots.reduce((sum,slot)=>sum+population(n,slot),0);
    const start=(page-1)*pageSize;
    for(let rank=start;rank<Math.min(total,start+pageSize);rank++){
      const index=Math.floor(rank/slots.length)*60+slots[rank%slots.length];
      if(index<n)rows.push(badcaseAt(task,index));
    }
  }else{
    for(let block=0;block<n;block+=60)for(const slot of slots){const index=block+slot;if(index>=n)continue;const row=badcaseAt(task,index);if(`${row.id} ${row.sampleId} ${row.sourceSampleId||''}`.toLowerCase().includes(needle)){if(total>=(page-1)*pageSize&&rows.length<pageSize)rows.push(row);total++;}}
  }
  return {total,rows};
}
