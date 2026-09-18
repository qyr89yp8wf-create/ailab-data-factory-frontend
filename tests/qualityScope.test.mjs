import assert from 'node:assert/strict';
import {isPrivacyRule,regularQualityReport} from '../src/qualityScope.js';
import {templateRulesSnapshot} from '../src/templateQualitySnapshot.js';
import {newExecutionTask,advanceExecution,qualityExecutionMetadata} from '../src/taskExecution.js';
import {overallReportMetrics} from '../src/qualityResults.js';

for(const modality of ['文档图像','对话文本','时序数据']){
 const rules=templateRulesSnapshot(modality,{});
 assert.ok(rules.some(isPrivacyRule),'Template retains privacy rules');
 let task=newExecutionTask({taskType:'数据质检',modality,qualityRules:rules,sourceVersion:{samples:3,version:'V1'},inputVersionId:'V1',qualityCheckedSampleCount:3},'QC','V1','success');
 assert.ok(!task.configSnapshot.qualityRules.some(isPrivacyRule));
 for(let i=0;i<12;i++)task=advanceExecution(task);
 const report=qualityExecutionMetadata(task);
 assert.ok(report.ruleSummaries.length>0);
 assert.ok(!report.ruleSummaries.some(isPrivacyRule));
}
const source={protocolVersion:2,ruleSnapshot:[{id:'S01',category:'隐私质检'},{id:'D01'}],ruleSummaries:[{id:'S01',category:'隐私质检',counts:{PASS:0,FAIL:1},evaluatedCount:1,passRate:0},{id:'D01',counts:{PASS:1,FAIL:0},evaluatedCount:1,passRate:1}],sampleResults:[{sampleId:'1',ruleResults:[{id:'S01'},{id:'D01'}]}]};
const result=regularQualityReport(source);
assert.deepEqual(result.ruleSnapshot.map(r=>r.id),['D01']);
assert.deepEqual(result.sampleResults[0].ruleResults.map(r=>r.id),['D01']);
assert.equal(overallReportMetrics(result).overallScore,1);
assert.equal(source.ruleSnapshot.length,2,'Do not mutate stored reports');
console.log('PASS: three modality task execution, report privacy exclusion, scoring and immutable history');
