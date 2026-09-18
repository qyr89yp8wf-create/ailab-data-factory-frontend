import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const baseline=JSON.parse(readFileSync(resolve(root,'docs/v4-source-baseline.json'),'utf8'));
const changedPresentation=new Set(['src/main.jsx','src/RuleQualityReport.jsx','src/ConversationTemplateCenter.jsx',
  'src/ColdChainTemplateCenter.jsx','src/WaybillSeedMockEditor.jsx','src/ContractSeedMockEditor.jsx']);
// Round 2 user-authorized behavior changes; retain all original files and V4 hashes.
const round2Changed=new Set(['src/ContractSeedMockEditor.jsx','src/synthetic-template/SyntheticDocumentTemplateCreatePage.jsx','src/templateApi.js','src/template-editor/TemplateCanvas.jsx','src/DocumentWaybillQualityPanels.jsx','src/WaybillSeedMockEditor.jsx','src/ConversationTaskFlow.jsx','src/ConversationMvp.jsx','src/ColdChainMvp.jsx','src/main.jsx','src/RuleQualityReport.jsx','src/ColdChainTemplateCenter.jsx','src/ConversationTemplateCenter.jsx','src/TemplateCenter.jsx','src/template-editor/TemplateEditor.jsx','src/DatasetPreview.jsx','src/uploadLifecycle.jsx','src/taskExecution.js','src/taskDetailLog.js','src/qualityResults.js','src/localStoreApi.js']);
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
let preserved=0;
for(const [name,digest] of Object.entries(baseline)) {
  assert.ok(existsSync(resolve(root,name)),`Original file missing: ${name}`);
  if(name.startsWith('src\\')||name.startsWith('src/')) {
    const normalized=name.replaceAll('\\','/');
    if(!changedPresentation.has(normalized)&&!round2Changed.has(normalized)&&normalized!=='src/qualityResultDownload.js') { // B01: attach download anchor
      assert.equal(hash(resolve(root,name)),digest,`Business/source module changed: ${name}`);
      preserved++;
    }
  }
}
const v4=resolve(root,'../Data_Factory_User_Frontend_v4');
for(const name of changedPresentation) {
  const before=readFileSync(resolve(v4,name),'utf8');
  const after=readFileSync(resolve(root,name),'utf8');
  if(round2Changed.has(name))continue;
  const fields=text=>[...text.matchAll(/<Form\.Item\b[^>]*\bname=("[^"]+"|'[^']+'|\{[^}]+\})/g)].map(m=>m[1]).sort();
  assert.deepEqual(fields(after),fields(before),`Form field inventory changed: ${name}`);
  if(name!=='src/main.jsx'&&name!=='src/RuleQualityReport.jsx') {
    const normalize=text=>text.replace(/\r\n/g,'\n').replaceAll(' data-ued-readonly={readOnly || undefined}','')
       .replace("<Tag color=\"blue\">{template&&!template.draft_id?'已发布':dirty?'草稿未保存':'草稿已保存'}</Tag>",'<Tag color="blue">草稿已保存</Tag>')
      .replace("{template&&!template.draft_id?'模板 ID：':'草稿 ID：'}{draft.draft_id||template?.template_id}{template&&!template.draft_id&&template.version?` · 版本 ${template.version}`:''}",'草稿 ID：{draft.draft_id}')
      .replace('rules.filter(rule=>rule && LEGACY_CONVERSATION_RULE_MAP[rule.rule_id]===row.id)',
        'rules.filter(rule=>LEGACY_CONVERSATION_RULE_MAP[rule.rule_id]===row.id)');
    assert.equal(normalize(after),normalize(before),`Unexpected template behavior change: ${name}`);
  }
}
for(const [name,digest] of Object.entries(baseline))assert.equal(hash(resolve(v4,name)),digest,`V4 changed: ${name}`);
console.log(`PASS: all ${Object.keys(baseline).length} original files retained; ${preserved} source modules byte-identical; V4 baseline unchanged; untouched-page field inventory unchanged. Round 2 user-authorized changes explicitly listed.`);
console.log('PASS: modules outside the explicit V5/round2 change list match V4; this check does not replace behavioral regression.');
