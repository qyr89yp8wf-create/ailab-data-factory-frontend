import assert from 'node:assert/strict';
import {detectUploadMetadata} from '../src/uploadMetadata.js';
function zip(name,data){
 const fn=Buffer.from(name),body=Buffer.from(JSON.stringify(data)),h=Buffer.alloc(30),c=Buffer.alloc(46),e=Buffer.alloc(22);
 h.writeUInt32LE(0x04034b50);h.writeUInt32LE(body.length,18);h.writeUInt32LE(body.length,22);h.writeUInt16LE(fn.length,26);
 c.writeUInt32LE(0x02014b50);c.writeUInt32LE(body.length,20);c.writeUInt32LE(body.length,24);c.writeUInt16LE(fn.length,28);
 const start=h.length+fn.length+body.length;
 e.writeUInt32LE(0x06054b50);e.writeUInt16LE(1,8);e.writeUInt16LE(1,10);e.writeUInt32LE(c.length+fn.length,12);e.writeUInt32LE(start,16);
 return new Blob([h,fn,body,c,fn,e]);
}
const templates=[{id:'T1',version:'1'},{id:'T2',version:'2'}];
const a=zip('manifest.json',{template:{id:'T1',version:'1'},quality:{PASS:999}});
assert.equal((await detectUploadMetadata([a],templates)).templateId,'T1');
assert.equal((await detectUploadMetadata([a,zip('lineage.json',{template_id:'T2',template_version:'2'})],templates)).status,'conflict');
assert.equal((await detectUploadMetadata([zip('quality.json',{template:{id:'T1',version:'9'}})],templates)).status,'unmatched');
assert.equal((await detectUploadMetadata([zip('data/sample.json',{template:{id:'T1',version:'1'}})],templates)).status,'absent');
assert.equal((await detectUploadMetadata([new Blob(['bad zip'])],templates)).status,'warning');
assert.equal((await detectUploadMetadata([zip('manifest.json',{template_id:'T1'})],templates)).templateId,null);
const result=await detectUploadMetadata([a],templates);
assert.equal(JSON.stringify(result).includes('999'),false);
assert.deepEqual(Object.keys(result).sort(),['detected','status','templateId']);
console.log('PASS: upload metadata matching, conflict, version mismatch, malformed ZIP, no untrusted payload retention');
