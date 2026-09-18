import assert from 'node:assert/strict';
import {expansionTargets,validateExpansionPlan} from '../src/coveragePlanning.js';
import {expansionCount} from '../src/expansionQuality.js';
const report={mock:true,checkedSampleCount:4,ruleSnapshot:[{id:'a'},{id:'b'}],sampleResults:[
 {sampleId:'1',ruleResults:[{id:'a',status:'FAIL'},{id:'b',status:'FAIL'}]},
 {sampleId:'2',ruleResults:[{id:'a',status:'PASS'},{id:'b',status:'PASS'}]},
 {sampleId:'3',ruleResults:[{id:'a',status:'ERROR'},{id:'b',status:'PASS'}]},
 {sampleId:'4',ruleResults:[{id:'a',status:'FAIL'},{id:'b',status:'ERROR'}]},
],distributions:[{dimensionId:'event',dimension:'事件',label:'开门',count:4,sampleOffset:0},{dimensionId:'event',dimension:'事件',label:'断电',count:0,sampleOffset:4}],
ruleSummaries:[{id:'a',name:'质量',counts:{PASS:1,FAIL:2,ERROR:1}},{id:'label',name:'事件',category:'标签分类',counts:{FAIL:1}}]};
const rows=expansionTargets(report),label=rows[0],empty=rows[1],rule=rows[2];
assert.equal(rows.length,3);
assert.equal(label.failed,2);assert.equal(label.passed,1);assert.equal(label.unknown,1);
assert.equal(label.failureRate,2/3);assert.equal(label.recommended,2);
assert.equal(empty.recommended,4);assert.equal(empty.failureRate,null);
assert.equal(rule.failureRate,2/3);
assert.equal(expansionCount(label,{percent:12.5}),1);
assert.equal(expansionCount(label,{percent:200}),8);
assert.equal(expansionCount(empty,{count:12}),12);
assert.equal(validateExpansionPlan(rows,[label.key],{[label.key]:{percent:200}}),8);
assert.throws(()=>validateExpansionPlan(rows,[label.key],{[label.key]:{percent:0}}));
console.log('expansion ratios and label quality passed');
