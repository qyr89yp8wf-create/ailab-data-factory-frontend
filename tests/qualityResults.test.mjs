import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {freezeRules,overallReportMetrics,reduceObjectResults,ruleSummary,reportRuleRows,summarizeRuleRows,scoreFor,trialQualityReport} from '../src/qualityResults.js';
import {templateRulesSnapshot} from '../src/templateQualitySnapshot.js';
import {newExecutionTask,advanceExecution,qualityExecutionMetadata,versionSample} from '../src/taskExecution.js';
import {reportSamplePage} from '../src/qualityReportSamples.js';
assert.equal(scoreFor('ERROR'),null);
assert.equal(ruleSummary({id:'A'},{ERROR:4}).passRate,null);
assert.equal(ruleSummary({id:'A'},{PASS:8,FAIL:2,ERROR:100}).passRate,.8);
const overallFixture={protocolVersion:2,ruleSummaries:[ruleSummary({id:'A',category:'基础质检'},{PASS:8,FAIL:2,ERROR:2,NOT_SELECTED:20}),ruleSummary({id:'B',category:'隐私质检'},{PASS:4,FAIL:6,NOT_APPLICABLE:2})]};
assert.ok(Math.abs(overallReportMetrics(overallFixture).overallScore-.6)<1e-10);
assert.equal(overallReportMetrics(overallFixture).judgmentCoverage,20/22);
assert.equal(overallReportMetrics(overallFixture).privacyFailCount,6);
assert.equal(overallReportMetrics(overallFixture).privacyJudgmentCount,10);
assert.equal(overallReportMetrics({ruleSnapshot:[{id:'OLD'}]}).privacyJudgmentCount,0);
assert.equal(overallReportMetrics({protocolVersion:2,ruleSummaries:[ruleSummary({id:'A'},{PASS:1}),ruleSummary({id:'B'},{ERROR:1})]}).overallScore,null);
assert.equal(overallReportMetrics({ruleSnapshot:[{id:'OLD'}],averageScore:99}).overallScore,null);
assert.equal(reduceObjectResults([{status:'PASS'},{status:'ERROR'}]).status,'ERROR');
assert.equal(reduceObjectResults([{status:'FAIL'},{status:'ERROR'}]).score,0);
assert.equal(reduceObjectResults([{status:'PASS'},{status:'NOT_APPLICABLE'}]).score,1);
assert.equal(reduceObjectResults([]).status,'NOT_APPLICABLE');
const rules=[{id:'R1',name:'格式',category:'基础质检'},{id:'R2',name:'语义',category:'场景质检',method:'LLM',threshold:.8},{id:'R3',name:'条件',category:'场景质检',applicability:'conditional'},{id:'LABEL',name:'主题',category:'标签分类'}];
for(const modality of ['文档图像','对话文本','时序数据'])for(const taskType of ['数据质检','数据增强','定向扩增']){
 let task=newExecutionTask({taskType,modality,name:'测试',qualityRules:rules,qualityScope:'sample',qualityCheckedSampleCount:127,sourceVersion:{samples:151},effectiveTargetCount:127,selectableCount:127,templateProfile:{id:'TPL',version:'V3'},selectedRuleIds:['R1'],selectedFields:['a'],qualityThreshold:90},'TEST','V');
 for(let i=0;i<12;i++)task=advanceExecution(task);
 const meta=qualityExecutionMetadata(task),samples=Array.from({length:meta.sampleCount},(_,i)=>versionSample(task,i));
 assert.equal(meta.ruleSummaries.length,3);assert.equal(meta.ruleSnapshot.length,4);assert.equal(meta.templateVersion,'V3');
 assert.deepEqual(meta.ruleSummaries,summarizeRuleRows(meta.ruleSnapshot,samples));
 for(const rule of meta.ruleSummaries)for(const status of Object.keys(rule.counts)){
   const expected=samples.filter(s=>s.ruleResults.some(r=>r.id===rule.id&&r.status===status));
   for(let page=1;page<=Math.ceil(expected.length/10);page++)assert.deepEqual(reportSamplePage(meta,rule.id,status,page).map(s=>s.sampleId),expected.slice((page-1)*10,page*10).map(s=>s.sampleId));
 }
 assert.ok(!('averageScore'in meta));assert.ok(samples.every(s=>!('overallScore'in s)&&!('overallResult'in s)));
 assert.ok(samples.every(s=>s.ruleResults.length===3));
 for(const r of meta.ruleSummaries)assert.equal(Object.values(r.counts).reduce((a,b)=>a+b,0),meta.sampleCount);
 if(taskType==='数据质检'){assert.ok(!('selectedRuleIds'in task.configSnapshot));assert.ok(!('selectedFields'in task.configSnapshot));assert.ok(!('qualityThreshold'in task.configSnapshot));assert.equal(meta.notSelectedSampleCount,24);}
}
const snapshot=freezeRules(rules);rules[0].name='修改后';assert.equal(snapshot[0].name,'格式');
let task=newExecutionTask({taskType:'数据质检',qualityRules:rules,sourceVersion:{samples:10},qualityCheckedSampleCount:10,templateProfile:{id:'A',version:'1'}},'ERR','V','config-error');task=advanceExecution(task);const report=qualityExecutionMetadata(task);assert.equal(report.notRunSampleCount,9);assert.equal(report.ruleSummaries[1].counts.ERROR,1);assert.equal(report.ruleSummaries[0].evaluatedCount,1);
assert.ok(reportRuleRows({ruleSnapshot:rules,averageScore:99}).every(r=>r.unavailable&&r.passRate===null));
const convo=templateRulesSnapshot('对话文本',{quality:{selected_rule_ids:['L01','L03','S01'],scenario_rules:[]}});assert.ok(convo.some(r=>r.id==='L08'));assert.ok(convo.some(r=>r.id==='A01')); // 旧编号不直接映射新版含义，初始化新版目录。
const ts=templateRulesSnapshot('时序数据',{quality:{base_rules:[{rule_id:'ON',enabled:true},{rule_id:'OFF',enabled:false}],privacy:{rules:[{rule_id:'PII'}]},rules:[{rule_id:'SCENE'}]},fields:[{field_id:'temp',quality_rules:[{rule_id:'FIELD-T'}]}]});assert.ok(ts.some(r=>r.id==='FIELD-temp-1'));assert.ok(ts.some(r=>r.id==='T01'));assert.ok(!ts.some(r=>r.id==='OFF'));
assert.equal(trialQualityReport(snapshot,{sampleCount:3}).ruleSummaries[0].counts.FAIL,1);
let source=newExecutionTask({taskType:'数据质检',qualityRules:rules,sourceVersion:{samples:220000},qualityCheckedSampleCount:220000,inputVersionId:'SOURCE'},'LARGE','SOURCE');
for(let i=0;i<12;i++)source=advanceExecution(source);
const large=qualityExecutionMetadata(source);
assert.equal(reportSamplePage(large,'R1','PASS',10000).length,10);
const failed=reportSamplePage(large,'R1','FAIL',1);
let enhance=newExecutionTask({taskType:'数据增强',qualityRules:rules,sourceVersion:{samples:220000,version:'SOURCE'},inputVersionId:'SOURCE',qualityReportSnapshot:large,selectionRuleId:'R1',sampleSelection:'FAIL',effectiveTargetCount:3,selectableCount:large.ruleSummaries[0].counts.FAIL},'ENHANCE','NEXT','success');
for(let i=0;i<12;i++)enhance=advanceExecution(enhance);
assert.deepEqual(Array.from({length:3},(_,i)=>versionSample(enhance,i).sourceSampleId),failed.slice(0,3).map(s=>s.sampleId));
const pending=qualityExecutionMetadata(newExecutionTask({taskType:'数据质检',qualityRules:rules,sourceVersion:{samples:20},qualityCheckedSampleCount:10},'STOP','V'));
assert.equal(pending.ruleSummaries[0].counts.NOT_RUN,10);assert.equal(pending.ruleSummaries[0].counts.NOT_SELECTED,10);assert.equal(pending.ruleSummaries[0].passRate,null);
const ui=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
assert.ok(ui.includes("draft.modality==='文档图像'?documentAugmentationConfig:draft.modality==='对话文本'?conversationAugmentationConfig:timeseriesAugmentationConfig"),'增强配置必须实际挂载，不仅声明');
const waybill=readFileSync(new URL('../src/DocumentWaybillQualityPanels.jsx',import.meta.url),'utf8');
assert.match(waybill,/import \{[^}]*\bFlex\b[^}]*\} from 'antd'/,'运单试运行 Flex 必须导入');
console.log('PASS: binary scoring, denominator, multi-object reduction, exact rule snapshot, historical safety, sample/error/N/A, all modalities, aggregate/detail agreement');
