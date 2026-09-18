import assert from 'node:assert/strict';
import {isRetiredGpsDataset,reconcileDemoTaskLinks} from '../src/demoDatasetAlignment.js';
import {TASK_FAMILIES} from '../src/builtinTaskAlignment.js';
assert.equal(isRetiredGpsDataset({id:5,name:'车辆GPS轨迹集'}),true);
assert.equal(isRetiredGpsDataset({id:'DATASET-20260811-0005',name:'车辆GPS轨迹集'}),true);
assert.equal(isRetiredGpsDataset({id:'USER',name:'车辆GPS轨迹集'}),false);
const family=TASK_FAMILIES.customs,profile={id:family.templateId,name:family.templateName,businessType:'报关单'};
const datasets=[{id:'D',name:family.datasetName,modality:'文档图像',versions:[
 {version:'V2',source:'TASK-20260812-0039',sourceVersionId:'V1',created:'now'},
 {version:'V1',source:'TASK-20260807-0012',created:'before'},
]}];
const user={id:'USER',configSnapshot:{unchanged:true}};
const old={id:'TASK-20260812-0039',name:'报关单扩增',taskType:'定向扩增',status:'运行中'};
const result=reconcileDemoTaskLinks([old,user],datasets,[profile]);
assert.equal(result.length,3);
assert.equal(result[0].sourceVersionId,'V1');
assert.equal(result[0].outputVersionId,'V2');
assert.equal(result[0].status,'已完成');
assert.equal(result[1],user);
assert.equal(result[2].outputVersionId,'V1');
assert.equal(result[2].historicalConfigSnapshot.templateId,profile.id);
assert.equal(reconcileDemoTaskLinks(result,datasets,[profile]),result);
console.log('PASS: retired GPS fixture filtering, producer task completion, source/output link consistency, user preservation and idempotency');
