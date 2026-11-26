import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  const module=await server.ssrLoadModule('/src/DocumentTemplateEvidence.jsx');
  const catalog=await server.ssrLoadModule('/src/documentQualityCatalog.js');
  const snapshot=module.packingListTemplateSnapshot;
  const template={documentSnapshot:snapshot};
  const rules=module.documentTemplateRules(template);
  assert.equal(rules.length,catalog.DOCUMENT_BASE_QUALITY_RULES.length+catalog.DOCUMENT_PRIVACY_QUALITY_RULES.length+catalog.DOCUMENT_SCENE_QUALITY_RULES.length+7);
  assert.deepEqual([...new Set(rules.map(rule=>rule.category))],['基础质检','隐私质检','场景质检']);
  assert.ok(rules.every(rule=>rule.content));
  assert.equal(new Set(rules.map(rule=>rule.id)).size,rules.length);
  const html=renderToStaticMarkup(React.createElement(module.DocumentTemplateFields,{snapshot}));
  assert.ok(html.includes('搜索字段名称或 ID'));
  assert.ok(html.includes('固定字段'));
  assert.ok(html.includes('动态字段'));
  assert.equal(snapshot.business_type,'装箱单');
  assert.equal(snapshot.fields.length,14);
  assert.ok(snapshot.fields.some(field=>field.id==='signature'));
  assert.ok(rules.some(rule=>rule.name==='毛净重关系'));
  assert.ok(snapshot.fields.every(field=>field.generator));
  const waybill=module.documentSnapshot({method:'底图生成法'});
  assert.ok(waybill.fields.length>0&&waybill.texts.length>0);
  console.log('PASS: document fields, source generators, graphics, quality catalog and waybill fallback');
} finally { await server.close(); }
