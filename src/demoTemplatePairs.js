import {readStore,updateStore} from './mockStore';
import {CONVERSATION_DEMO_CONFIGURATION} from './conversationDemoTemplate';
import {COLDCHAIN_MODEL_CONFIGURATION} from './timeSeriesModelSeed';

// Stable starter drafts; existing work is retained and never regenerated on refresh.
export function ensureDemoDrafts(){
 const stored=readStore('coldchain-drafts',[]);
 if(stored.some(d=>d.draft_id==='COLDDRAFT-REEFER-DEMO'&&d.status!=='published'&&!d.configuration?.value_modes_v1)){
  updateStore('coldchain-drafts',[],items=>items.map(d=>{
   if(d.draft_id!=='COLDDRAFT-REEFER-DEMO'||d.status==='published'||d.configuration?.value_modes_v1)return d;
   const removed=new Set(['latitude','longitude','network_status','power_status','transport_stage','active_event_type']);
   const fields=(d.configuration.fields||[]).filter(f=>!removed.has(f.field_id)).map(f=>f.value_mode?f:{...f,value_mode:f.field_id==='temperature_setpoint'?'fixed':f.field_id==='ambient_temperature'?'per_series':'dynamic',...(f.field_id==='temperature_setpoint'?{fixed_value:4}:f.field_id==='ambient_temperature'?{range_min:24,range_max:26}:{})});
   return {...d,configuration:{...d.configuration,fields,value_modes_v1:true},field_count:fields.length,revision:(d.revision||0)+1,validation:null,trial_run:null,trial_status:null};
  }));
 }

 for(const [store,id,configuration,name] of [
  ['conversation-drafts','CONVDRAFT-LOGISTICS-DEMO',CONVERSATION_DEMO_CONFIGURATION,'物流智能客服对话模板'],
  ['coldchain-drafts','COLDDRAFT-REEFER-DEMO',COLDCHAIN_MODEL_CONFIGURATION,'冷藏集装箱多变量时序模板'],
 ]){
  if(readStore(store,[]).some(d=>d.status!=='published'))continue;
  updateStore(store,[],items=>[...items,{draft_id:id,status:'draft',revision:1,name,configuration:structuredClone(configuration),created_at:'2026-09-17 09:00:00',updated_at:'2026-09-17 09:00:00',validation:null,trial_run:null}]);
 }
}

export function demoTemplatePairs(rows){
 const latest=items=>items.slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
 const definitions=[
  {id:'TEMPLATE-DOC-20260902-E3A971',name:'装箱单模板',type:'文档类图像',business:'装箱单',draft:'document-draft',published:'document-published',match:r=>!r.raw?._synthetic,preferred:'DOC-TPL-SYS-PACKING-MOCK'},
  {id:'TEMPLATE-DOC-20260902-WB0012',name:'橙途速运运单模板',type:'文档类图像',business:'国内运单',draft:'document-mock-draft',published:'document-mock-published',match:r=>r.raw?.source_type==='waybill_mock'},
  {id:'TEMPLATE-CONV-20260902-C01A7B',name:'物流智能客服对话模板',type:'对话',business:'智能客服多轮对话',draft:'conversation-draft',published:'conversation-published',preferred:'CONVTPL-LOGISTICS-DEMO-V2'},
  {id:'TEMPLATE-TS-20260902-CC1024',name:'冷藏集装箱多变量时序模板',type:'时序',business:'温湿度时序数据',draft:'time-draft',published:'time-published',preferred:'COLDTPL-REEFER-MODEL-DEMO-V2'},
 ];
 return definitions.flatMap(group=>{
  const draft=latest(rows.filter(r=>r.kind===group.draft&&(!group.match||group.match(r))));
  const published=rows.find(r=>r.kind===group.published&&r.id===group.preferred)||latest(rows.filter(r=>r.kind===group.published));
  if(!draft&&!published)return [];
  const pair=[draft,published||{...draft,kind:group.published,raw:{...draft.raw},status:'已发布'}];
  const references=[...new Set(rows.filter(r=>r.kind===group.published).flatMap(r=>r.taskReferences||[]))];
  return pair.filter(Boolean).map((row,i)=>({...row,key:group.id+'/'+(i?'published':'draft'),id:group.id,name:group.name,dataType:group.type,businessType:group.business,status:i?'已发布':'草稿',demoFamily:group.id,taskReferences:i?references:[],publishable:i?false:row.publishable}));
 });
}
