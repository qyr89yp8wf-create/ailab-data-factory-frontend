// An allowlist is never proof of origin. Evidence must come from the generator.
export function isExpectedSyntheticObject(object, policy=[]) {
  return Boolean(object?.provenance?.kind==='generated' && object.provenance.verified===true && object.provenance.taskId &&
    policy.some(entry=>entry.fieldId && entry.region && entry.privacyType && entry.fieldId===object.fieldId && entry.region===object.region && entry.privacyType===object.privacyType));
}
export function applyPrivacyPolicy(results,policy=[]) {
  return results.map(rule=>{
    if(!rule.privacy||!rule.objects?.length||!policy.length)return rule;
    const objects=rule.objects.map(object=>isExpectedSyntheticObject(object,policy)?{...object,status:'NOT_APPLICABLE',reason:'预期合成字段：字段、区域及可信生成来源均匹配',exempted:true}:object);
    const applicable=objects.filter(object=>object.status!=='NOT_APPLICABLE');
    const status=applicable.some(object=>object.status==='FAIL')?'FAIL':!applicable.length?'NOT_APPLICABLE':applicable.every(object=>object.status==='PASS')?'PASS':'ERROR';
    return {...rule,objects,status,score:status==='PASS'?1:status==='FAIL'?0:null,exemptedObjectCount:objects.filter(object=>object.exempted).length};
  });
}
