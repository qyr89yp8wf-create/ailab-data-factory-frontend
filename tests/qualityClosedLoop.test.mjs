import assert from 'node:assert/strict';
import {taskQualityRules} from '../src/qualityScope.js';
import {readFileSync} from 'node:fs';
import {refreshBuiltinQuality} from '../src/builtinQualityMigration.js';
import {RULE_CATALOG,qualityConfig,activeRules,validateQualityConfig,samplingLabels,PARAMETER,parameterFields} from '../src/qualityCatalog.js';
import {templateRulesSnapshot} from '../src/templateQualitySnapshot.js';
import {templateLabelSnapshot,overallReportMetrics,ruleSummary,mockRuleResults} from '../src/qualityResults.js';
import {distributionRows,coverageSummary,expansionTargets,validateExpansionPlan} from '../src/coveragePlanning.js';
import {beginUploadCheck,tickUploadCheck,resolveUpload,stopUploadCheck,replaceUploadVersion} from '../src/uploadCheckState.js';
import {newExecutionTask,advanceExecution,qualityExecutionMetadata,versionSample} from '../src/taskExecution.js';
let cases=0;const test=(name,fn)=>{fn();cases++;console.log('PASS '+name)};
test('CAT01 唯一目录95项及三种配置类型',()=>{assert.equal(RULE_CATALOG.length,95);assert.equal(new Set(RULE_CATALOG.map(r=>r.id)).size,95);assert.equal(RULE_CATALOG.filter(r=>r.configType===PARAMETER).length,33);assert.ok(RULE_CATALOG.filter(r=>r.configType===PARAMETER).every(r=>parameterFields[r.id]));});
for(const modality of ['文档图像','对话文本','时序数据']){
 test(modality+' 公共目录、关闭规则、深拷贝快照',()=>{const q=qualityConfig(modality);assert.equal(q.rules.filter(r=>r.id[0]==='S').length,18);q.rules[0].enabled=false;const frozen=templateRulesSnapshot(modality,{quality_catalog:q});assert.ok(!frozen.some(r=>r.id==='S01'));q.rules[1].name='后来修改';assert.notEqual(frozen.find(r=>r.id==='S02').name,'后来修改');assert.ok(!frozen.some(r=>r.example));});
 test(modality+' 执行报告与快照一对一',()=>{const q=qualityConfig(modality),rules=taskQualityRules(activeRules(modality,q));let t=newExecutionTask({taskType:'数据质检',modality,sourceVersion:{samples:20},qualityCheckedSampleCount:20,qualityRules:rules,templateProfile:{configuration:{quality_catalog:q}}},'QA-'+modality,'V','success');for(let i=0;i<12;i++)t=advanceExecution(t);const r=qualityExecutionMetadata(t);assert.equal(r.ruleSummaries.length,rules.filter(x=>x.resultType!=='statistics').length);assert.deepEqual(r.ruleSnapshot.map(x=>x.id),rules.map(x=>x.id));});
}
test('CAT05 自定义实例ID与禁用标签',()=>{const q=qualityConfig('文档图像'),r={...q.rules.find(r=>r.id==='D16'),id:'CUSTOM-1',enabled:true,example:false,name:'版式',target:'整图',prompt:'分类'};q.rules.push(r);q.labels=[{id:r.id,name:r.name,values:['A','B'],prompt:r.prompt}];validateQualityConfig(q);assert.equal(templateLabelSnapshot({quality_catalog:q},'文档图像').dimensions.length,1);r.enabled=false;assert.equal(templateLabelSnapshot({quality_catalog:q},'文档图像').dimensions.length,0);});
test('CAT06 空Prompt、重复枚举拦截',()=>{const q=qualityConfig('文档图像');q.labels=[{id:'D16-1',name:'版式',values:['A','A'],prompt:'分类'}];assert.throws(()=>validateQualityConfig(q));q.labels[0].values=['A'];q.labels[0].prompt='';assert.throws(()=>validateQualityConfig(q));});
test('系统自动维度从两种现有配置读取',()=>{assert.equal(samplingLabels({sampler:{dimensions:[]},event_generation:{sampling_dimensions:[{name:'事件',values:['正常']}]}},'时序数据').length,1);assert.equal(samplingLabels({sampler:{dimensions:[{name:'意图',values:['询价']}] }},'对话文本').length,1);});
test('REP01 无有效判定及NOT_RUN不进入覆盖分母',()=>{assert.equal(overallReportMetrics({protocolVersion:2,ruleSummaries:[ruleSummary({id:'R'},{ERROR:1})]}).overallScore,null);assert.equal(overallReportMetrics({protocolVersion:2,ruleSummaries:[ruleSummary({id:'R'},{PASS:8,FAIL:2,ERROR:2,NOT_RUN:10})]}).judgmentCoverage,10/12);});
test('REP03 分布总数、零标签、互斥样本区间',()=>{const rows=distributionRows({dimensions:[{id:'x',name:'x',source:'system',values:['A','B','C']}]},100);assert.equal(rows.reduce((n,r)=>n+r.count,0)+rows[0].unknown,100);assert.equal(rows[1].count,0);assert.equal(coverageSummary(rows).coverage,2/3);assert.equal(rows[2].sampleOffset,rows[0].count);});
const fixture=(findings,samples=5)=>({version:'V',publicationStatus:'草稿',samples,uploadFixtureFindings:findings});
const check=v=>{let x=beginUploadCheck(v);for(let i=0;i<5;i++)x=tickUploadCheck(x);return x;};
const privacy={sampleId:'a',ruleId:'S02',category:'隐私质检',status:'FAIL'};
const safety={sampleId:'a',ruleId:'A02',category:'安全质检',status:'FAIL'};
test('UP01 无命中发布',()=>assert.equal(check(fixture([])).publicationStatus,'已发布'));
test('UP02 命中不改数据并等待用户选择',()=>{const v=check(fixture([privacy]));assert.equal(v.publicationStatus,'待处理');assert.equal(v.samples,5);assert.equal(v.privacyProcessing,undefined);});
test('UP03 安全不得脱敏放行',()=>assert.throws(()=>resolveUpload(check(fixture([privacy,safety])),'mask',{S02:'全掩码'})));
test('UP04 同样本双规则删除去重',()=>{const v=resolveUpload(check(fixture([privacy,safety])),'delete');assert.equal(v.samples,4);assert.equal(v.excludedSampleIds.length,1);});
test('UP05 空集、文件失败、检测异常拦截',()=>{assert.throws(()=>resolveUpload(check(fixture([privacy],1)),'delete'));for(const f of [{...privacy,category:'文件检查'},{...privacy,status:'ERROR'}]){const v=check(fixture([f]));assert.equal(v.publicationStatus,'校验失败');assert.throws(()=>resolveUpload(v,'delete'));}});
test('UP06 停止、重复提交、返回编辑保留历史',()=>{let v=beginUploadCheck(fixture([privacy]));assert.equal(beginUploadCheck(v).uploadRuns.length,1);assert.equal(stopUploadCheck(v).publicationStatus,'草稿');v=resolveUpload(check(fixture([privacy])),'edit');assert.equal(v.publicationStatus,'草稿');assert.equal(check(v).uploadRuns.length,2);});
test('UP07 脱敏配置必填、处理后防重复操作',()=>{const v=check(fixture([privacy]));assert.throws(()=>resolveUpload(v,'mask'));const done=resolveUpload(v,'mask',{S02:'全掩码'});assert.equal(done.publicationStatus,'已发布');assert.equal(done.uploadRuns.length,2);assert.throws(()=>resolveUpload(done,'mask',{S02:'全掩码'}));});
test('混合安全先删除，余下隐私单独处理',()=>{const v=resolveUpload(check(fixture([privacy,safety,{...privacy,sampleId:'b'}])),'deleteSafety');assert.equal(v.samples,4);assert.equal(v.publicationStatus,'待处理');assert.equal(v.uploadRuns.at(-1).findings[0].sampleId,'b');});
const report={distributions:[80,20,0].map((count,i)=>({source:'system',dimensionId:'intent',dimension:'意图',label:String(i),count})),ruleSummaries:[{id:'L01',name:'重复',category:'正文',counts:{FAIL:7,ERROR:3}},{id:'S01',category:'隐私质检',counts:{FAIL:9}}]};
test('EXP01 均衡推荐0/60/80',()=>assert.deepEqual(expansionTargets(report).slice(0,3).map(x=>x.recommended),[0,60,80]));
test('EXP02 推荐由同维度数量差决定，不再使用全局目标值',()=>assert.deepEqual(expansionTargets(report).slice(0,3).map(x=>x.quantityGap),[0,60,80]));
test('EXP03 仅FAIL计数且排除隐私安全',()=>{const rules=expansionTargets(report).filter(r=>r.kind==='规则不通过');assert.equal(rules.length,1);assert.equal(rules[0].recommended,7);});
test('EXP04 数量覆盖及取消不计数',()=>{const rows=expansionTargets(report);assert.equal(validateExpansionPlan(rows,[rows[1].key],{[rows[1].key]:{count:3}}),3);});
test('EXP06 0、小数、NaN、空选择和过期目标拦截',()=>{const rows=expansionTargets(report),key=rows[1].key;for(const count of [0,-1,1.2,NaN])assert.throws(()=>validateExpansionPlan(rows,[key],{[key]:{count}}));assert.throws(()=>validateExpansionPlan(rows,[]));assert.throws(()=>validateExpansionPlan(rows,['obsolete']));});
test('八枚举及小样本分布非负且守恒',()=>{for(const n of [0,1,3,100])for(const size of [1,2,3,8,20]){const rows=distributionRows({dimensions:[{id:'x',values:Array.from({length:size},(_,i)=>String(i))}]},n);assert.ok(rows.every(r=>r.count>=0));assert.equal(rows.reduce((s,r)=>s+r.count,0)+rows[0].unknown,n);}});
test('手动处置发布后总数同步',()=>{const v=check(fixture([privacy])),published=resolveUpload(v,'delete'),d=replaceUploadVersion({versions:[v],totalSamples:0},published);assert.equal(d.totalSamples,4);assert.equal(d.defaultVersion,'V');});
test('02正文95项ID名称配置类型与目录一致，附录不纳入',()=>{
 const document=readFileSync(new URL('../../../资料/数据集示例及质检规则调研/数据生成工具-数据质检规则v3.md',import.meta.url),'utf8').split('## 附录')[0];
 const rows=document.split('\n').filter(l=>/^\|\s*P[01]\s*\|\s*[SABDLT]\d{2}\s*\|/.test(l)).map(l=>l.split('|').map(x=>x.trim()));
 assert.equal(rows.length,95);
 for(const cells of rows){const rule=RULE_CATALOG.find(r=>r.id===cells[2]);assert.ok(rule,cells[2]);assert.equal(rule.name,cells[3]);assert.equal(rule.configType,cells[4]);}
});
test('增强视觉规则的适用性与评分分母',()=>{
 const rule=RULE_CATALOG.find(r=>r.id==='D13');
 assert.equal(mockRuleResults([rule],1)[0].status,'NOT_APPLICABLE');
 assert.notEqual(mockRuleResults([rule],1,{enhanced:true})[0].status,'NOT_APPLICABLE');
 const metrics=overallReportMetrics({protocolVersion:2,ruleSummaries:[ruleSummary(rule,{NOT_APPLICABLE:10}),ruleSummary({id:'R'},{PASS:8,FAIL:2})]});
 assert.equal(metrics.overallScore,0.8);assert.equal(metrics.scoredRuleCount,1);
});
test('规则快照保留完整失败含义及参数默认值',()=>{
 const rules=activeRules('对话文本');
 assert.ok(rules.find(r=>r.id==='B01').passCriteria.includes('不通过'));
 assert.equal(rules.find(r=>r.id==='B02').params.min,1);
});
test('失败规则扩增：新ID、仅失败父样本、配置快照保存',()=>{
 const rules=activeRules('对话文本');let source=newExecutionTask({taskType:'数据质检',modality:'对话文本',inputVersionId:'SOURCE-V',sourceVersion:{samples:100},qualityCheckedSampleCount:100,qualityRules:rules},'SOURCE-QC','SOURCE-V','success');
 for(let i=0;i<12;i++)source=advanceExecution(source);
 const report=qualityExecutionMetadata(source),target=expansionTargets(report).find(t=>t.ruleId==='B01');assert.ok(target);
 let task=newExecutionTask({taskType:'定向扩增',modality:'对话文本',inputVersionId:'SOURCE-V',sourceVersion:{version:'SOURCE-V',samples:100},qualityRules:rules,qualityReportSnapshot:report,expansionTargets:[{...target,plannedCount:2}],targetCount:2,autoQualityEnabled:false},'EXPAND','OUTPUT-V','success');
 for(let i=0;i<12;i++)task=advanceExecution(task);
 assert.equal(task.executionSummary.outputSampleCount,2);assert.equal(task.configSnapshot.expansionTargets[0].plannedCount,2);
 for(let i=0;i<2;i++){const row=versionSample(task,i);assert.ok(row.sampleId.startsWith('SAMPLE-EXPAND-'));const sourceIndex=Number(row.sourceSampleId.split('-').at(-1))-1;assert.equal(versionSample(source,sourceIndex).ruleResults.find(r=>r.id==='B01').status,'FAIL');}
});
test('内置演示迁移：任务与版本报告同源、幂等、不改用户快照',()=>{
 let task=newExecutionTask({taskType:'数据质检',modality:'对话文本',sourceVersion:{version:'V',samples:10},qualityCheckedSampleCount:10,qualityRules:[{id:'OLD',name:'旧规则'}]},'TASK-20260916-CONV-QUALITY-001','V','success');for(let i=0;i<12;i++)task=advanceExecution(task);
 const user={...task,id:'USER-TASK'},report={...qualityExecutionMetadata(task),taskId:task.id,reportId:'REPORT'};
 const result=refreshBuiltinQuality([task,user],[{id:'D',versions:[{version:'V',qualityReports:[report]}]}]);
 assert.equal(result.tasks[1],user);assert.ok(result.tasks[0].configSnapshot.qualityRules.every(r=>r.category!=='隐私质检'));
 const migrated=result.datasets[0].versions[0].qualityReports[0];assert.equal(migrated.reportId,'REPORT');assert.ok(migrated.distributions.some(d=>d.source==='system'));assert.deepEqual(migrated.ruleSnapshot,result.tasks[0].configSnapshot.qualityRules);assert.ok(migrated.labelSnapshot.dimensions.every(d=>d.id&&d.values.length>0));assert.equal(refreshBuiltinQuality(result.tasks,result.datasets).changed,false);
});
console.log('Final: '+cases+' closed-loop cases passed');
