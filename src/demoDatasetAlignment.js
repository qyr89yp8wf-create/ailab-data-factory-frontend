import {TASK_FAMILIES,BUILTIN_TASK_FAMILIES} from './builtinTaskAlignment.js';
export const isRetiredGpsDataset=d=>d.name==='车辆GPS轨迹集'&&['5','DATASET-20260811-0005'].includes(String(d.id));
// Historical version producers that were absent from the task-center seed.
const producers={
 'TASK-20260810-0112':['运单图像增强','数据增强'],
 'TASK-20260808-0016':['运单初始合成','数据合成'],
 'TASK-20260809-0088':['报关单字段增强','数据增强'],
 'TASK-20260807-0012':['报关单初始合成','数据合成'],
 'TASK-20260806-0025':['物流客服对话合成','数据合成'],
 'TASK-20260808-0042':['冷链时序参数增强','数据增强'],
 'TASK-20260805-0018':['冷链时序初始合成','数据合成'],
};
export function reconcileDemoTaskLinks(tasks,datasets,profiles){
 let changed=false;
 const byId=new Map(tasks.map(t=>[t.id,t]));
 for(const family of Object.values(TASK_FAMILIES)){
  const dataset=datasets.find(d=>d.name===family.datasetName),template=profiles.find(p=>p.id===family.templateId);
  if(!dataset||!template)continue;
  for(const version of dataset.versions||[]){
   const id=version.source,definition=producers[id];
   if(!definition&&!BUILTIN_TASK_FAMILIES[id])continue;
   const old=byId.get(id);
   // Execution-backed tasks already commit their own output links.
   if(old?.execution)continue;
   const name=old?.name||definition?.[0],taskType=old?.taskType||definition?.[1];
   if(!name||!taskType)continue;
   const source=dataset.versions.find(v=>v.version===version.sourceVersionId);
   const quality=taskType==='数据质检',synthesis=taskType==='数据合成';
   const inputVersion=quality?version:source;
   const previous=old?.configSnapshot||old?.historicalConfigSnapshot||{};
   const config={...previous,name,taskType,modality:dataset.modality,businessType:template.businessType,templateId:template.id,templateProfile:template,
    ...(!synthesis?{inputDatasetId:dataset.id,inputVersionId:inputVersion?.version||null}:{}),
    outputDatasetId:dataset.id,outputDatasetName:dataset.name};
   const next={...old,id,key:old?.key||id,name,taskType,modality:dataset.modality,businessType:template.businessType,templateId:template.id,
    status:'已完成',progress:100,currentStage:'已完成',stages:[taskType],created:old?.created||version.created,updated:old?.updated||version.updatedAt,
    input:synthesis?template.name:dataset.name+(inputVersion?' / '+inputVersion.version:''),
    output:dataset.name+' / '+version.version,outputVersionId:version.version,
    sourceDatasetId:synthesis?null:dataset.id,sourceVersionId:synthesis?null:inputVersion?.version||null,
    ...(old?.configSnapshot?{configSnapshot:config}:{historicalConfigSnapshot:config})};
   if(JSON.stringify(old)!==JSON.stringify(next)){byId.set(id,next);changed=true;}
  }
 }
 return changed?[...byId.values()]:tasks;
}
export function reconcileDemoDatasetLinks(datasets,tasks){
 const byId=new Map(tasks.map(t=>[t.id,t]));
 let changed=false;
 const result=datasets.map(dataset=>{
  if(!Object.values(TASK_FAMILIES).some(f=>f.datasetName===dataset.name))return dataset;
  let updated=false;
  const versions=(dataset.versions||[]).map(version=>{
   if(!producers[version.source]&&!BUILTIN_TASK_FAMILIES[version.source])return version;
   const task=byId.get(version.source);
   if(!task)return version;
   const consumers=(version.consumers||[]).filter(id=>id!=='TASK-20260812-0062'||byId.has(id));
   if(version.sourceName===task.name&&JSON.stringify(consumers)===JSON.stringify(version.consumers||[]))return version;
   updated=true;
   return {...version,sourceName:task.name,consumers};
  });
  if(!updated)return dataset;
  changed=true;return {...dataset,versions};
 });
 return changed?result:datasets;
}
