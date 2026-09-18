import assert from 'node:assert/strict';
import {buildTaskDraft, upsertTaskDraft} from '../src/taskDraft.js';
import {documentSamplePreview} from '../src/documentSamplePreview.js';

const values={name:'草稿验证',modality:'文档图像',taskType:'数据合成',sampleCount:7,generationParameters:'{"temperature":0.4}',expansionTargetConfig:{rule:{target:25}}};
const first=buildTaskDraft(values,'DRAFT-test','2026-09-15 18:00:00');
values.expansionTargetConfig.rule.target=99;
assert.equal(first.configSnapshot.expansionTargetConfig.rule.target,25);
assert.equal(first.status,'草稿');
assert.equal(first.execution,undefined);
const restored=JSON.parse(JSON.stringify(first));
assert.equal(restored.configSnapshot.sampleCount,7);
const second=buildTaskDraft({...restored.configSnapshot,sampleCount:11},first.id,'2026-09-15 18:01:00',restored);
const tasks=upsertTaskDraft([restored,{id:'other'}],second);
assert.equal(tasks.length,2);
assert.equal(tasks[0].created,first.created);
assert.equal(tasks[0].configSnapshot.sampleCount,11);
assert.equal(buildTaskDraft({taskType:'数据质检'},'empty','now').name,'未命名任务');

const dataset={businessType:'报关单'};
const row={id:'SAMPLE-002',versionId:'V1',fields:{报关单号:'SYN-002',企业:'合成 <贸易> & 公司'}};
const preview=documentSamplePreview(row,dataset);
const svg=decodeURIComponent(preview.imageUrl.split(',')[1]);
assert.equal(preview.annotation.sample_id,row.id);
assert.equal(preview.annotation.render_annotations.image,`${row.id}.svg`);
assert.match(svg,/SAMPLE-002/);
assert.match(svg,/SYN-002/);
assert.match(svg,/合成 &lt;贸易&gt; &amp; 公司/);
assert.match(svg,/报关单 · 模拟预览/);
for(const object of preview.annotation.render_annotations.objects){
  assert.ok(object.bbox[0]>=0 && object.bbox[2]<=preview.annotation.render_annotations.width);
  assert.ok(object.bbox[1]>=0 && object.bbox[3]<=preview.annotation.render_annotations.height);
}
const other=documentSamplePreview({...row,id:'SAMPLE-003',fields:{报关单号:'SYN-003'}},dataset);
assert.notEqual(preview.imageUrl,other.imageUrl);
assert.equal(other.annotation.generated_content.fields.报关单号,'SYN-003');
assert.equal(preview.annotation.generated_content.fields.报关单号,'SYN-002');
console.log('PASS: draft persistence round-trip, updates without duplicates, incomplete drafts, and paired sample images/annotations.');
