import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {alignBuiltinTask,TASK_FAMILIES,BUILTIN_TASK_FAMILIES} from '../src/builtinTaskAlignment.js';
assert.equal(Object.keys(TASK_FAMILIES).length,4);
for(const [id,family] of Object.entries(BUILTIN_TASK_FAMILIES)){
 const task=alignBuiltinTask({id,taskType:'数据质检',input:'旧数据集'});
 assert.equal(task.templateId,TASK_FAMILIES[family].templateId);
 assert.deepEqual(alignBuiltinTask(task),task);
}
assert.equal(alignBuiltinTask({id:'TASK-20260811-0173',name:'检疫证书',input:'检疫证书'}).name,'报关单图像数据质检');
assert.equal(alignBuiltinTask({id:'TASK-20260811-0159',output:'车辆GPS轨迹集 / V3'}).output,'待生成');
const user={id:'USER-TASK',name:'自己的任务',configSnapshot:{templateId:'CUSTOM'}};
assert.equal(alignBuiltinTask(user),user);
const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const profiles=main.split('const PUBLISHED_TEMPLATE_PROFILES = [')[1].split('];')[0];
assert.equal((profiles.match(/id:'TEMPLATE-/g)||[]).length,4);
assert.match(main,/TASK-20260918-CONV-ENHANCE-001/);
assert.match(main,/conversationEnhancementDemoSeeded0918/);
assert.match(main,/autoQualityEnabled:true,enhancementModel:'Qwen3-14B',conversationSemanticMethods:\['表达同义改写'\]/);
assert.match(main,/items.some\(item=>item.id===task.id\)\?items:\[task,...items\]/);
console.log('PASS: four template families, built-in migration, user snapshot preservation, enhancement fixture and idempotent insertion');
