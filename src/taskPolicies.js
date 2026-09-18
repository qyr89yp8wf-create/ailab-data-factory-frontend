export const autoQualityEnabled = v => v.taskType === '数据质检' || (v.autoQualityEnabled ?? v.taskType !== '数据合成');
export function qualityModelNeeds(rules=[]) {
  const active=rules.filter(r=>r.enabled!==false);
  const method=r=>`${r.method||''} ${r.engine||''} ${r.mode||''}`;
  return {semantic:active.some(r=>/LLM|semantic|语义|模型/i.test(method(r))&&!/VLM/i.test(method(r))),vlm:active.some(r=>/VLM/i.test(method(r))),embedding:active.some(r=>/Embedding/i.test(method(r)))};
}
