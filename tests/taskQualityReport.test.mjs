import assert from 'node:assert/strict';
import {reportForQualityTask} from '../src/taskQualityReport.js';

for(const modality of ['文档图像','对话文本','时序数据']){
  const task={id:`QC-${modality}`,taskType:'数据质检',sourceDatasetId:42,sourceVersionId:'V1',outputVersionId:'V2'};
  const report={reportId:`R-${modality}`,taskId:task.id,protocolVersion:2};
  const datasets=[{id:42,modality,versions:[{version:'V1',qualityReports:[{reportId:'LEGACY',taskId:task.id,createdAt:'2026-09-16'},report]},{version:'V2',qualityReports:[{reportId:'OTHER',taskId:'QC-OTHER'}]}]}];
  const result=reportForQualityTask(task,datasets);
  assert.equal(result.report,report,`${modality}: task report must resolve by task ID, not output version`);
  assert.equal(result.version.version,'V1',`${modality}: quality result stays on source version`);
  assert.equal(reportForQualityTask({...task,id:'QC-MISSING'},datasets).report,null);
}
console.log('PASS: three modality task reports resolved by task ID and original dataset version');
