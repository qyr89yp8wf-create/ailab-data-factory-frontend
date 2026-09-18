import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDatasetExample, downloadDatasetExample } from '../src/datasetExampleDownloads.js';

const original = {fetch:globalThis.fetch,document:globalThis.document,setTimeout:globalThis.setTimeout};
const clicks=[];
globalThis.document={body:{appendChild(){}},createElement(){return {click(){clicks.push(this.download);},remove(){}};}};
globalThis.setTimeout=callback=>{callback();return 0;};
try {
  for(const [modality,key] of [['文档图像','document'],['对话文本','conversation'],['时序数据','timeseries']]){
    assert.deepEqual(getDatasetExample(modality),getDatasetExample(key));
    assert.equal(getDatasetExample(key,'/demo/').url,`/demo/dataset-examples/${key}-example-v02.zip`);
    const bytes=await readFile(new URL(`../public/dataset-examples/${key}-example-v02.zip`,import.meta.url));
    globalThis.fetch=async url=>{assert.equal(url,getDatasetExample(key).url);return new Response(bytes);};
    await downloadDatasetExample(modality); // dataset version route
    const uploadBytes=await readFile(new URL(`../public/dataset-examples/${key}-upload-template-v02.zip`,import.meta.url));
    globalThis.fetch=async url=>{assert.equal(url,getDatasetExample(key,undefined,'upload').url);return new Response(uploadBytes);};
    assert.equal(getDatasetExample(key,'/demo/','upload').url,`/demo/dataset-examples/${key}-upload-template-v02.zip`);
    await downloadDatasetExample(key,'upload');
    assert.deepEqual(clicks.slice(-2),[`${key}-example-v02.zip`,`${key}-upload-template-v02.zip`]);
  }
  globalThis.fetch=async()=>new Response('missing',{status:404});
  await assert.rejects(downloadDatasetExample('document'),/404/);
  globalThis.fetch=async()=>new Response('<html>SPA fallback</html>');
  await assert.rejects(downloadDatasetExample('document'),/ZIP/);
  await assert.rejects(downloadDatasetExample('unknown'),/不支持/);
  assert.equal(clicks.length,6);
  const main=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
  assert.match(main,/downloadDatasetExample\(templateInfo\.key,\s*'upload'\)/);
  assert.match(main,/downloadVersionWithReports\(dataset,version\)/);
  assert.doesNotMatch(main,/version.sampleExecution\?undefined:downloadUrl/);
  console.log('PASS: six download routes, separate upload/version packages, base path, 404/HTML/unknown type handling.');
} finally {Object.assign(globalThis,original);}
