import {activeRules,fieldRuleInstances} from './qualityCatalog.js';
import {freezeRules} from './qualityResults.js';
export function templateRulesSnapshot(modality,template={}){
  const c=template.documentSnapshot||template.configuration||template.selected_version?.configuration_v2||template.selected_version?.configuration||template;
  const rules=activeRules(modality,c.quality_catalog);
  const fields=fieldRuleInstances(modality,c);
  const configuredIds=new Set(c.quality_catalog?.rules?.map(r=>r.id)||[]);
  return freezeRules([...rules,...fields.filter(r=>!configuredIds.has(r.id))]);
}
