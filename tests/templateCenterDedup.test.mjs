import assert from 'node:assert/strict';
import {deduplicateTemplateCenterRows} from '../src/templateCenterDedup.js';

const rows=[
  {key:'doc-old',kind:'document-draft',id:'DOC-1',name:'进口货物申报单图像模板',dataType:'文档类图像',businessType:'贸易申报单',updatedAt:'2026-09-09'},
  {key:'doc-new',kind:'document-draft',id:'DOC-2',name:'进口货物申报单图像模板',dataType:'文档类图像',businessType:'报关单',updatedAt:'2026-09-14'},
  {key:'conversation-old',kind:'conversation-published',id:'CONV-1',name:'物流对话模板',dataType:'对话',businessType:'客服',updatedAt:'2026-09-09',taskReferences:['任务 A']},
  {key:'conversation-new',kind:'conversation-published',id:'CONV-2',name:'物流对话模板',dataType:'对话',businessType:'售后',updatedAt:'2026-09-14'},
  {key:'time-old',kind:'time-draft',id:'TS-1',name:'冷链时序模板',dataType:'时序',businessType:'传感器',updatedAt:'2026-09-09'},
  {key:'time-new',kind:'time-published',id:'TS-2',name:'冷链时序模板',dataType:'时序',businessType:'冷链',updatedAt:'2026-09-14'},
];
assert.deepEqual(deduplicateTemplateCenterRows(rows).map(row=>row.id),['DOC-2','CONV-2','TS-2']);
assert.equal(rows.length,6,'原模板与任务引用不应被删除');
console.log('PASS: same-name templates across IDs, business types and statuses show only the latest in all three modalities');
