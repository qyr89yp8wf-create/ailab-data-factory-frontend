import {samplingLabels} from './qualityCatalog.js';
import {distributionRows} from './coveragePlanning.js';
import {applyPrivacyPolicy} from './privacyPolicy.js';
// Shared product contract. Mock observations are explicitly separate from real evaluator results.
export const QUALITY_STATUS = {PASS:'通过',FAIL:'不通过',ERROR:'无法判定',NOT_APPLICABLE:'不适用',NOT_SELECTED:'未抽中',NOT_RUN:'未执行'};
export const QUALITY_COLORS = {PASS:'success',FAIL:'error',ERROR:'warning',NOT_APPLICABLE:'default',NOT_SELECTED:'default',NOT_RUN:'default'};
export const scoreFor = status => status==='PASS'?1:status==='FAIL'?0:null;
export const criteriaFor = rule => rule.passCriteria||rule.pass_criteria||rule.threshold||rule.criteria||'';
export const isDistribution = rule => rule.category==='标签分类'||rule.resultType==='statistics'||(rule.category==='基础统计'&&!criteriaFor(rule));
export const freezeRules = rules => JSON.parse(JSON.stringify((rules||[]).filter(r=>r.enabled!==false).map((r,i)=>({...r,id:r.id||r.rule_id||`CUSTOM-${i+1}`,category:r.category||'场景质检'}))));
export function reduceObjectResults(objects){
  const applicable=objects.filter(o=>o.status!=='NOT_APPLICABLE');
  const status=applicable.some(o=>o.status==='FAIL')?'FAIL':!applicable.length?'NOT_APPLICABLE':applicable.every(o=>o.status==='PASS')?'PASS':'ERROR';
  return {status,score:scoreFor(status),objects};
}
export function ruleSummary(rule,counts={}){
  const result={...rule,counts:Object.fromEntries(Object.keys(QUALITY_STATUS).map(s=>[s,Number(counts[s]||0)]))};
  result.evaluatedCount=result.counts.PASS+result.counts.FAIL;
  result.passRate=result.evaluatedCount?result.counts.PASS/result.evaluatedCount:null;
  return result;
}
export function summarizeRuleRows(rules,samples){
  return freezeRules(rules).filter(r=>!isDistribution(r)).map(rule=>{
    const counts={};let hitCount=0;
    for(const sample of samples){const result=sample.ruleResults?.find(r=>r.id===rule.id);const status=result?.status||'NOT_RUN';counts[status]=(counts[status]||0)+1;hitCount+=(result?.objects||[]).filter(object=>object.status==='FAIL').length;}
    return {...ruleSummary(rule,counts),hitCount};
  });
}
export const rateText = rate => rate==null?'—':`${(rate*100).toFixed(1)}%`;
export function templateLabelSnapshot(config={},modality='对话文本'){
 const automatic=samplingLabels(config,modality),custom=(config.quality_catalog?.labels||[]).filter(d=>config.quality_catalog.rules?.some(r=>r.id===d.id&&r.enabled!==false));
 return {dimensions:[...automatic,...custom.map(d=>({...d,source:'custom'}))]};
}
export const mockLabelDistributions=distributionRows;
// Missing historical atomic data cannot be reconstructed from an old overall score.
export function reportRuleRows(report){
  if(report?.protocolVersion===2)return report.ruleSummaries||[];
  return freezeRules(report?.ruleSnapshot).filter(r=>!isDistribution(r)).map(r=>({...ruleSummary(r),unavailable:true}));
}
export function overallReportMetrics(report){
  const rows=reportRuleRows(report);
  let valid=0,applicable=0,rateSum=0,unscoredRuleCount=0,privacyFailCount=0,privacyJudgmentCount=0;
  for(const row of rows){
    const counts=row.counts||{};
    const pass=Number(counts.PASS||0),fail=Number(counts.FAIL||0);
    const evaluated=pass+fail;
    valid+=evaluated;
    applicable+=evaluated+Number(counts.ERROR||0);
    if(evaluated)rateSum+=pass/evaluated;
    else if(!counts.NOT_APPLICABLE||counts.ERROR||counts.NOT_RUN)unscoredRuleCount++;
    if(row.category==='隐私质检'||row.privacy){privacyFailCount+=fail;privacyJudgmentCount+=evaluated;}
  }
  return {
    overallScore:rows.some(r=>r.evaluatedCount)&&!unscoredRuleCount?rateSum/rows.filter(r=>r.evaluatedCount).length:null,
    judgmentCoverage:applicable?valid/applicable:null,
    ruleCount:rows.length,scoredRuleCount:rows.filter(r=>r.evaluatedCount).length,unscoredRuleCount,privacyFailCount,privacyJudgmentCount,
  };
}
export function templatePrivacyCheck(report){
  const privacyRows=reportRuleRows(report).filter(row=>row.category==='隐私质检'||row.privacy);
  const failedRows=privacyRows.filter(row=>Number(row.counts?.FAIL||0)>0);
  const failedFields=[];
  for(const sample of report?.sampleResults||[]){
    for(const result of sample.ruleResults||[]){
      if(result.status!=='FAIL')continue;
      const definition=privacyRows.find(row=>row.id===result.id);
      if(!definition)continue;
      const locations=(result.objects||[]).filter(item=>item.status==='FAIL').map(item=>item.location).filter(Boolean);
      failedFields.push(...(locations.length?locations:[result.location||definition.target||definition.scope||definition.name]));
    }
  }
  if(!failedFields.length)failedFields.push(...failedRows.map(row=>row.target||row.scope||row.name).filter(Boolean));
  return {passed:failedRows.length===0,failedRuleCount:failedRows.length,failedFields:[...new Set(failedFields)],failedRows};
}
export function mockRuleResults(rules,index,{notChecked,failedRuleId,missingInput=false,modality='',privacyPolicy=[],enhanced=false}={}){
  return applyPrivacyPolicy(freezeRules(rules).filter(r=>!isDistribution(r)).map((r,i)=>{
    const privacyRule=Boolean(r.privacy||r.category==='隐私质检');
    let status=notChecked||(missingInput||r.id===failedRuleId?'ERROR':!privacyRule&&(index%60+i*7)%19===0?'FAIL':'PASS');
    // Only rules with a conditional input may be inapplicable; never hide a missing required input as N/A.
    if(!notChecked&&!missingInput&&r.id!==failedRuleId&&r.applicability==='conditional'&&(index%60+i)%13===0)status='NOT_APPLICABLE';
    if(!notChecked&&r.applicability==='enhanced'&&!enhanced)status='NOT_APPLICABLE';
    const location=r.target||r.scope||(modality==='文档图像'?'文档 / 模板适用字段':modality==='时序数据'?'序列 / 模板适用字段':'对话 / 模板适用消息');
    const reason=status==='FAIL'?'存在对象未满足模板判定条件':status==='ERROR'?(missingInput?'缺少必需输入，无法完成检测':'检测器调用失败；不计入通过率分母'):status==='NOT_SELECTED'?'未纳入本次抽检':status==='NOT_RUN'?'任务尚未执行此样本':status==='NOT_APPLICABLE'?'不满足本规则的适用条件':'全部适用对象满足模板判定条件';
    return {id:r.id,name:r.name,privacy:Boolean(r.privacy||r.category==='隐私质检'),status,score:scoreFor(status),reason,location,objects:[{location,status,reason}],evidence:r.privacy||r.category==='隐私质检'?'仅保留类型和位置，敏感原文不展示':''};
  }),privacyPolicy);
}
export function trialQualityReport(rules,{sampleCount=1,templateId='当前模板',templateVersion='未发布快照',samples,labels=[]}={}){
  const ruleSnapshot=freezeRules(rules),n=Math.max(0,Number(sampleCount)||0);
  const sampleResults=samples||Array.from({length:n},(_,i)=>({sampleId:`TRIAL-${String(i+1).padStart(4,'0')}`,ruleResults:mockRuleResults(ruleSnapshot,i)}));
  return {protocolVersion:2,mock:true,templateId,templateVersion,executionRange:'full',sampleCount:n,checkedSampleCount:n,ruleSnapshot,ruleSummaries:summarizeRuleRows(ruleSnapshot,sampleResults),sampleResults,labelSnapshot:labels,distributions:mockLabelDistributions(labels,n),distributionRules:ruleSnapshot.filter(isDistribution),executionStatus:'已完成'};
}
