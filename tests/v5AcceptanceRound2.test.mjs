import assert from 'node:assert/strict';
import {autoQualityEnabled,qualityModelNeeds} from '../src/taskPolicies.js';
import {executionSteps,newExecutionTask,advanceExecution,versionSample,qualityExecutionMetadata} from '../src/taskExecution.js';
import {isExpectedSyntheticObject,applyPrivacyPolicy} from '../src/privacyPolicy.js';
const rules=[{id:'semantic',name:'语义',mode:'semantic',category:'场景质检'},{id:'visual',name:'图像',mode:'vlm',category:'场景质检'},{id:'local',mode:'function',category:'基础质检'}];
assert.deepEqual(qualityModelNeeds(rules),{semantic:true,vlm:true,embedding:false});
assert.deepEqual(qualityModelNeeds([rules[2]]),{semantic:false,vlm:false,embedding:false});
for(const taskType of ['数据合成','数据增强','定向扩增']) {
 const cfg={taskType,modality:'文档图像',sampleCount:2,targetCount:2,selectableCount:2,qualityRules:rules,qualityModel:'semantic-selected',qualityVlmModel:'vlm-selected'};
 assert.equal(executionSteps({...cfg,autoQualityEnabled:false}).filter(s=>s.quality).length,0);
 const steps=executionSteps({...cfg,autoQualityEnabled:true}).filter(s=>s.quality);
 assert.deepEqual(steps.map(s=>s.model),['semantic-selected','vlm-selected']);
 let task=newExecutionTask({...cfg,autoQualityEnabled:true},'ROUND2','V2','success');for(let i=0;i<12;i++)task=advanceExecution(task);
 assert.equal(versionSample(task,0).ruleResults.length,3);
 assert.equal(qualityExecutionMetadata(task).ruleSummaries.length,3);
}
assert.equal(autoQualityEnabled({taskType:'数据增强'}),true); // historical compatibility
assert.equal(autoQualityEnabled({taskType:'数据合成'}),false);
const policy=[{fieldId:'name',region:'fields.name',privacyType:'姓名'}];
const object={fieldId:'name',region:'fields.name',privacyType:'姓名',status:'FAIL',provenance:{kind:'generated',verified:true,taskId:'T1'}};
assert.equal(isExpectedSyntheticObject(object,policy),true);
for(const changed of [{...object,region:'notes'},{...object,fieldId:'other'},{...object,provenance:{kind:'uploaded',verified:true,taskId:'T1'}},{...object,provenance:undefined}])assert.equal(isExpectedSyntheticObject(changed,policy),false);
assert.equal(applyPrivacyPolicy([{privacy:true,objects:[object]}],policy)[0].status,'NOT_APPLICABLE');
assert.equal(applyPrivacyPolicy([{privacy:true,objects:[object,{...object,region:'notes'}]}],policy)[0].status,'FAIL');
assert.equal(applyPrivacyPolicy([{privacy:true,objects:[{...object,provenance:undefined}]}],policy)[0].status,'FAIL');
console.log('PASS round2 automatic quality execution/model routing and privacy field-region-provenance boundaries');
