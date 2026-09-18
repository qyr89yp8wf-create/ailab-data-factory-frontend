import assert from 'node:assert/strict';
import {prototypeHistoricalQualityReport,prototypeQualityTaskReport,versionReportsForDisplay} from '../src/prototypeHistoricalQuality.js';
import {reportSamplePage} from '../src/qualityReportSamples.js';

const version={version:'F3454CDA3969',samples:100,created:'2026-09-01 09:00:00',qualityChecked:true,
  templateId:'TPL-DOC',templateVersion:'1.0.0',qualityReport:{reportId:'OLD',checkedSampleCount:95,
    ruleSnapshot:[{id:'BASE-STRUCTURE',name:'输出内容结构检查',category:'基础质检'}]}};
const report=prototypeHistoricalQualityReport({id:'DOC',modality:'文档图像',reference:true},version);
assert.equal(versionReportsForDisplay({id:'DOC',modality:'文档图像',reference:true},version)[0].protocolVersion,2);
assert.deepEqual(versionReportsForDisplay({reference:true},undefined),[]);
assert.equal(report.protocolVersion,2);
assert.equal(report.prototypeBackfill,true);
assert.equal(report.checkedSampleCount,95);
assert.ok(report.ruleSummaries.length>1);
assert.equal(report.ruleSummaries[0].counts.PASS+report.ruleSummaries[0].counts.FAIL,95);
assert.equal(reportSamplePage(report,report.ruleSummaries[0].id,'FAIL',1,10).length,Math.min(10,report.ruleSummaries[0].counts.FAIL));
assert.equal(prototypeHistoricalQualityReport({id:'UPLOADED',modality:'文档图像',reference:false},version),null);
assert.equal(prototypeHistoricalQualityReport({id:'DOC',modality:'文档图像',reference:true},{...version,qualityReports:[report]}),null);
for(const modality of ['文档图像','对话文本','时序数据']){
  const task={id:`QC-${modality}`,taskType:'数据质检',modality,status:'已完成'};
  const legacy=prototypeQualityTaskReport(task,{dataset:{id:'DATA'},version,
    matchingReport:version.qualityReport,template:{id:'TPL',version:'1.0.0'}});
  assert.equal(legacy.ruleSummaries.length,1);
  assert.equal(legacy.ruleSummaries[0].counts.PASS+legacy.ruleSummaries[0].counts.FAIL,95);
  assert.equal(legacy.taskId,task.id);
  assert.equal(prototypeQualityTaskReport({...task,status:'失败'},{version,matchingReport:version.qualityReport}),null);
  assert.equal(prototypeQualityTaskReport(task,{version,matchingReport:report}),null);
}
console.log('PASS: historical built-in demo has labelled mock rule outcomes; user datasets and newer reports untouched');
