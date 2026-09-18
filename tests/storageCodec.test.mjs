import assert from 'node:assert/strict';
import {encodeStore,decodeStore} from '../src/storageCodec.js';
for(const text of ['',JSON.stringify({name:'中文😀'}),JSON.stringify(Array.from({length:5000},(_,i)=>({id:i,name:'中文模板试运行😀',fields:[1,2,3],value:i*17})))])assert.equal(decodeStore(encodeStore(text)),text);
const large=JSON.stringify(Array.from({length:10000},(_,i)=>({id:i,text:'模板数据'.repeat(30)})));
assert.ok(encodeStore(large).length<large.length/2);
assert.equal(decodeStore(encodeStore(large)),large);
console.log('PASS lossless large, Unicode, legacy and empty storage round trips');
