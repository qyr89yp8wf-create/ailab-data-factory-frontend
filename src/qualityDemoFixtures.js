import {templateRulesSnapshot} from './templateQualitySnapshot.js';
import {templateLabelSnapshot} from './qualityResults.js';
import {COLDCHAIN_MODEL_CONFIGURATION} from './timeSeriesModelSeed.js';
import {CONVERSATION_DEMO_CONFIGURATION} from './conversationDemoTemplate.js';

// Built-in fallback only; explicit empty dimensions and user labels remain unchanged.
export function demoQualityDefinition(modality,config={}){
 const saved=config.configuration||config.documentSnapshot||config;
 const seed=modality==='时序数据'?COLDCHAIN_MODEL_CONFIGURATION:modality==='对话文本'?CONVERSATION_DEMO_CONFIGURATION:{};
 const resolved={...seed,...saved,
  ...(seed.sampler?{sampler:{...seed.sampler,...saved.sampler}}:{}),
  ...(seed.event_generation?{event_generation:{...seed.event_generation,...saved.event_generation}}:{})};
 return {rules:templateRulesSnapshot(modality,resolved),labelSnapshot:templateLabelSnapshot(resolved,modality)};
}
