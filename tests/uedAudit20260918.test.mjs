import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const source=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
assert.deepEqual(JSON.parse(execFileSync(process.execPath,['scripts/audit-input-hints.mjs'],{encoding:'utf8'})),[]);
assert.match(source('ApiKeysManager.jsx'),/crypto\.randomUUID\(\)/);
assert.doesNotMatch(source('ApiKeysManager.jsx'),/String\(items\.length \+ 1\)/);
for(const name of ['DocumentAugmentationScheme.jsx','TextAugmentationScheme.jsx']){
 assert.match(source(name),/modelParametersError\(value,true\)/);
 assert.match(source(name),/Promise\.reject\(new Error\(error\)\)/);
}
assert.match(source('main.jsx'),/const rules=taskQualityRules\(templateQualityRules\(modality,template\)\)/);
assert.match(source('UnifiedQualityEditor.jsx'),/像素\|全白\|全黑\|画布尺寸/);
assert.match(source('TemplateCenter.jsx'),/loading=\{loading\} rowKey="key" dataSource=\{loading\?\[\]:filteredRows\}/);
assert.match(source('AugmentationSelection.jsx'),/未形成完整质量分/);
assert.match(source('AugmentationSelection.jsx'),/setPage\(1\);onIncludeUnchecked/);
const report=source('RuleQualityReport.jsx');
assert.ok(report.indexOf('<CoveragePanel')<report.lastIndexOf('<BadcasePanel'));
console.log('PASS: input hints, unique key IDs, JSON validation, rule scope, image targets, loading state, selection reset and report order');
