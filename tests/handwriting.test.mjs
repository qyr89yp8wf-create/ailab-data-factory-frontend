import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultHandwritingGenerator,handwritingPreview,validateHandwriting,upgradeHandwritingDraft} from '../src/handwriting.js';
const asset={id:'signature-a',asset_type:'handwriting',generator:defaultHandwritingGenerator()};
const draft={fields:[{id:'signer',name:'签署人',sample_text:'王岚'}],texts:[{field_id:'signer',sample_text:'李明哲'}],assets:[asset]};
assert.throws(()=>validateHandwriting(draft),/动态字段/);
asset.generator.handwriting.field_id='signer';
validateHandwriting(draft);
const preview=handwritingPreview(asset,draft);
assert.equal(preview.name,'李明哲');
assert.equal(preview.svg,handwritingPreview({...asset,id:'another-object'},draft).svg);
assert.ok(preview.svg.includes('#1f3a8a'));
const fixed={...asset,generator:{handwriting:{...asset.generator.handwriting,name_mode:'fixed',fixed_name:'李明哲'}}};
assert.equal(handwritingPreview(fixed,draft).svg,preview.svg);
for(const [key,value] of [['style','casual'],['stroke','bold'],['color','black'],['fixed_name','王岚']]){
 const modified=structuredClone(fixed);modified.generator.handwriting[key]=value;
 assert.notEqual(handwritingPreview(modified,draft).svg,preview.svg,key);
}
const waybill={id:'pattern-a',assetType:'handwriting',hw:{name_mode:'bind_field',field_id:'signer'}};
assert.equal(handwritingPreview(waybill,{fields:[{key:'signer',sample:'李明哲'}]}).svg,preview.svg);
const restored=JSON.parse(JSON.stringify(draft));assert.equal(handwritingPreview(restored.assets[0],restored).svg,preview.svg);
restored.fields=[];assert.throws(()=>validateHandwriting(restored),/动态字段/);
const legacy={revision:4,trial_run:{revision:4},assets:[{id:'asset_signature',asset_type:'fixed_image',source:{kind:'automatic'},generator:{asset_source:'synthetic_signature'}}]};
const migrated=upgradeHandwritingDraft(legacy);assert.equal(migrated.assets[0].asset_type,'handwriting');assert.equal(migrated.trial_run,null);assert.equal(migrated.revision,5);assert.equal(legacy.assets[0].asset_type,'fixed_image');
legacy.assets[0].source.kind='manual';assert.equal(upgradeHandwritingDraft(legacy),legacy);
const seed=JSON.parse(readFileSync('public/mock-data/document-draft.json','utf8'));validateHandwriting(seed);assert.equal(seed.assets[0].asset_type,'handwriting');
console.log('PASS handwriting binding, identity, style, persistence, missing fields and legacy migration');
