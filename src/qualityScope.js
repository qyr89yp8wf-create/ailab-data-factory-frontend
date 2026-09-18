export const PRIVACY_SCOPE_NOTICE='隐私质检仅在上传数据集和模板发布时执行，常规质检任务不重复检查。';
export const isPrivacyRule=rule=>Boolean(rule.privacy||rule.category==='隐私质检'||/^S\d+(?:$|-)|PRIVACY|PII/i.test(rule.id||rule.rule_id||'')||/隐私|敏感信息/.test(rule.name||''));
export const taskQualityRules=rules=>(rules||[]).filter(rule=>!isPrivacyRule(rule));
// Project historical reports without rewriting the saved source data.
export function regularQualityReport(report){
 if(!report)return report;
 const privacyIds=new Set([...(report.ruleSnapshot||[]),...(report.ruleSummaries||[])].filter(isPrivacyRule).map(r=>r.id||r.rule_id));
 const filter=rules=>taskQualityRules(rules).filter(r=>!privacyIds.has(r.id||r.rule_id));
 return {...report,ruleSnapshot:filter(report.ruleSnapshot),ruleSummaries:filter(report.ruleSummaries),
  ...(report.sampleResults?{sampleResults:report.sampleResults.map(sample=>({...sample,ruleResults:filter(sample.ruleResults)}))}:{})};
}
