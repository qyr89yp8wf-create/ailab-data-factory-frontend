import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {templateRulesSnapshot} from '../src/templateQualitySnapshot.js';
import {validateQualityConfig} from '../src/qualityCatalog.js';
import {packingListChecks} from '../src/packingListTrial.js';
const draft=JSON.parse(readFileSync('public/mock-data/document-draft.json','utf8'));
const job=JSON.parse(readFileSync('public/mock-data/document-job.json','utf8'));
assert.equal(draft.fields.length,14);
assert.equal(job.result.cell_count,draft.cells.length);
assert.deepEqual(job.result.canvas,draft.canvas);
assert.ok(!JSON.stringify(draft).match(/报关|申报|海关|HS编码/));
for(const item of [...draft.cells,...draft.texts]){
 const [x,y,r,b]=item.bbox_px;assert.ok(x>=0&&y>=0&&r>x&&b>y&&r<=draft.canvas.width&&b<=draft.canvas.height,item.id);
 if(item.kind==='dynamic_field'){
  assert.ok(draft.fields.some(f=>f.id===item.field_id));
  assert.ok(draft.cells.some(c=>c.id===item.cell_id));
  assert.ok(draft.texts.some(t=>t.id===item.binding_object_id&&t.kind==='fixed_label'));
 }
}
validateQualityConfig(draft.quality_catalog);
const rules=templateRulesSnapshot('文档图像',draft);
for(const id of ['PL-SUM-QTY','PL-SUM-GW','PL-SUM-NW','PL-WEIGHT','PL-INVOICE','PL-SIGNATURE','PL-DATE'])assert.ok(rules.some(r=>r.id===id),id);
assert.equal(new Set(rules.map(r=>r.id)).size,rules.length);
assert.ok(Object.values(packingListChecks(draft)).every(Boolean));
const invalid=structuredClone(draft);invalid.texts.find(t=>t.field_id==='item_nw').sample_text='7,000.0';
assert.equal(packingListChecks(invalid)['PL-WEIGHT'],false);
assert.equal(packingListChecks(invalid)['PL-SUM-NW'],false);
invalid.texts.find(t=>t.field_id==='pl_date').sample_text='2026-02-30';
assert.equal(packingListChecks(invalid)['PL-DATE'],false);
console.log('PASS packing list coordinates, field bindings, metadata and frozen quality rules');
