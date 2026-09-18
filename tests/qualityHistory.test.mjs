import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {qualityReports,preferredQualityReport,appendQualityReport,versionWithReport} from '../src/qualityHistory.js';
import {newExecutionTask,advanceExecution,qualityExecutionMetadata,versionSample} from '../src/taskExecution.js';
import {appendZipFiles,downloadVersionWithReports} from '../src/qualityResultDownload.js';
const version={version:'ORIGINAL',source:'GENERATE-1',samples:10,updatedAt:'2026-09-01 10:00:00',previewUrl:'unchanged.png',qualityReport:{reportId:'OLD',checkedSampleCount:10,statusCounts:{PASS:10}}};
const before=JSON.stringify(version);
const values={taskType:'数据质检',name:'抽检',modality:'对话文本',inputVersionId:'ORIGINAL',inputDatasetId:'DATASET',sourceVersion:version,qualityScope:'sample',qualityCheckedSampleCount:2,qualityRules:[]};
let task=newExecutionTask(values,'QC-2','NEW');
assert.equal(task.plannedOutputVersionId,'ORIGINAL');
assert.equal(task.configSnapshot.outputMode,'sameVersion');
for(let i=0;i<12;i++)task=advanceExecution(task);
const report={...qualityExecutionMetadata(task),reportId:'SECOND',createdAt:'2026-09-15 10:00:00',sampleExecution:task};
const updated=appendQualityReport(version,report,task,report.createdAt);
assert.equal(JSON.stringify(version),before);
assert.equal(updated.version,version.version);
assert.equal(updated.source,version.source);
assert.equal(updated.samples,version.samples);
assert.equal(updated.previewUrl,version.previewUrl);
assert.equal(updated.updatedAt,report.createdAt);
assert.equal(qualityReports(updated).length,2);
assert.equal(qualityReports(updated)[0].reportId,'SECOND');
assert.equal(preferredQualityReport(qualityReports(updated)).reportId,'SECOND');
const historicalOnUpdatedVersion={...updated,qualityReports:[{reportId:'FULL',protocolVersion:2,createdAt:'2026-09-15 10:00:00'}],qualityReport:{reportId:'OLD',createdAt:'2026-09-16 10:00:00'}};
assert.equal(preferredQualityReport(qualityReports(historicalOnUpdatedVersion)).reportId,'FULL');
assert.equal(preferredQualityReport(qualityReports({version:'UNTESTED'})),null);
assert.equal(appendQualityReport(updated,report,task,report.createdAt),updated);
assert.equal(versionWithReport(updated,qualityReports(updated)[1]).qualityReport.reportId,'OLD');
assert.equal(versionSample(task,9).executionStatus,'NOT_SELECTED');
assert.equal(versionSample(task,0).sampleId,'SAMPLE-ORIGINAL-0000001');
const sourceTask=newExecutionTask({taskType:'数据合成',targetCount:10,qualityRules:[]},'GEN','SOURCE');
const linked=newExecutionTask({...values,sourceVersion:{...version,sampleExecution:sourceTask}},'QC-LINK','IGNORED');
assert.equal(versionSample(linked,0).sampleId,versionSample(sourceTask,0).sampleId);
const zip=new Uint8Array(await readFile(new URL('../public/dataset-examples/conversation-example-v02.zip',import.meta.url)));
const result=new Uint8Array(await appendZipFiles(zip,[{name:'quality/results/QC-2.json',content:'{"result":"PASS"}'}]).arrayBuffer());
const eocd=bytes=>{const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(let i=bytes.length-22;i>=0;i--)if(d.getUint32(i,true)===0x06054b50)return {offset:d.getUint32(i+16,true),size:d.getUint32(i+12,true),count:d.getUint16(i+10,true)};};
const a=eocd(zip),b=eocd(result);
assert.deepEqual(result.slice(0,a.offset),zip.slice(0,a.offset));
assert.deepEqual(result.slice(b.offset,b.offset+a.size),zip.slice(a.offset,a.offset+a.size));
assert.equal(b.count,a.count+1);
const originalFetch=globalThis.fetch,originalDocument=globalThis.document,originalCreate=URL.createObjectURL;
let downloaded;
try{
  globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>zip.buffer.slice(zip.byteOffset,zip.byteOffset+zip.byteLength)});
  let attached=false;
  globalThis.document={body:{appendChild(){attached=true;}},createElement:()=>({click(){assert.equal(attached,true);},remove(){attached=false;}})};
  URL.createObjectURL=blob=>{downloaded=blob;return 'blob:test';};
  const exportTask=newExecutionTask({...values,qualityRules:[{id:'FORMAT',name:'格式',category:'基础质检'}]},'QC-EXPORT','ORIGINAL');
  let finished=exportTask;for(let i=0;i<12;i++)finished=advanceExecution(finished);
  const meta={...qualityExecutionMetadata(finished),taskId:'QC-EXPORT',reportId:'EXPORT'};
  await downloadVersionWithReports({modality:'对话文本',name:'验收'}, {version:'ORIGINAL',samples:10,qualityReports:[meta]});
  const bytes=new Uint8Array(await downloaded.arrayBuffer()),view=new DataView(bytes.buffer),end=eocd(bytes);
  let pos=end.offset,records;
  for(let i=0;i<end.count;i++){
    const length=view.getUint16(pos+28,true),name=new TextDecoder().decode(bytes.slice(pos+46,pos+46+length));
    if(name==='quality/QC-EXPORT.jsonl'){
      const local=view.getUint32(pos+42,true),start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
      records=new TextDecoder().decode(bytes.slice(start,start+view.getUint32(pos+24,true))).trim().split('\n').map(JSON.parse);
    }
    pos+=46+length+view.getUint16(pos+30,true)+view.getUint16(pos+32,true);
  }
  assert.equal(records.length,10);
  assert.equal(records.filter(r=>r.execution_status==='NOT_SELECTED').length,8);
  assert.ok(records.every(r=>r.rule_results.length===1&&!('overall_score'in r)&&!('quality_status'in r)));
  assert.ok(records.slice(2).every(r=>r.rule_results[0].score===null));
}finally{globalThis.fetch=originalFetch;globalThis.document=originalDocument;URL.createObjectURL=originalCreate;}
console.log('PASS: same version, report history, original preservation, idempotency, report switching, sampling and additive ZIP');
