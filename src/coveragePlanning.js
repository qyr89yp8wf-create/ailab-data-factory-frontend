export function normalizeDimensions(dimensions=[]){return dimensions.filter(d=>d.enabled!==false).map((d,i)=>({...d,id:d.id||d.dimension_id||'dim-'+i,name:d.name||d.dimension_id||'维度',source:d.source||'custom',values:(d.values||d.labels||[]).map(v=>typeof v==='string'?v:v.name||v.label||v.value).filter(Boolean)})).filter(d=>d.values.length);}
export function exampleDimensions(modality){return {dimensions:[...(modality==='文档图像'?[]:[{id:'event',name:modality==='时序数据'?'事件类型':'业务意图',source:'system',values:modality==='时序数据'?['正常运输','短时断电','开门']:['物流查询','售后申请','投诉处理']}]),{id:'custom-style',name:modality==='文档图像'?'版面类型':modality==='时序数据'?'变化形态':'表达风格',source:'custom',values:modality==='文档图像'?['标准表格','多栏布局','紧凑布局']:modality==='时序数据'?['平稳','渐变','突变']:['简洁','详细','口语化']}]};}
export function distributionRows(snapshot={},count=0){const n=Math.max(0,Math.floor(count));return normalizeDimensions(snapshot.dimensions).flatMap(d=>{const unknown=n?Math.floor(n*.04):0,classified=n-unknown;let left=classified,offset=0;
 return d.values.map((label,i)=>{const value=d.values.length===1?classified:i===d.values.length-1?left:i===d.values.length-2&&d.values.length>2?0:i===0?Math.floor(classified*.7):Math.floor((classified-Math.floor(classified*.7))/Math.max(1,d.values.length-2));const sampleOffset=offset;offset+=value;left-=value;return {sampleOffset,key:d.source+':'+d.id+':'+label,source:d.source,dimensionId:d.id,dimension:d.name,label,count:value,classified,unknown,ratio:classified?value/classified:null};});});}
export function coverageSummary(rows){const total=rows.length,covered=rows.filter(r=>r.count>0).length;return {total,covered,coverage:total?covered/total:null,classified:rows[0]?.classified??rows.reduce((n,r)=>n+r.count,0),unknown:rows[0]?.unknown??0};}
import {augmentationPool} from './augmentationSelection.js';
import {labelQuality,expansionCount} from './expansionQuality.js';
import {isDistribution} from './qualityResults.js';
export function expansionTargets(report){
 const dist=report?.distributions||[],pool=augmentationPool(report),maximum=new Map();
 for(const r of dist){const k=(r.source||'custom')+':'+(r.dimensionId||r.dimension);maximum.set(k,Math.max(maximum.get(k)||0,r.count||0));}
 return [...dist.map(r=>{
   const key=(r.source||'custom')+':'+(r.dimensionId||r.dimension),stats=labelQuality(report,r,pool);
   const quantityGap=Math.max(0,(maximum.get(key)||0)-r.count),recommended=Math.max(quantityGap,stats.failed);
   return {...r,...stats,key:'label-'+key+':'+r.label,kind:'标签覆盖',baseCount:r.count,quantityGap,recommended};
 }),...(report?.ruleSummaries||[]).filter(r=>!isDistribution(r)&&!r.privacy&&r.category!=='隐私质检'&&r.counts?.FAIL>0).map(r=>{
   const failed=Number(r.counts.FAIL||0),passed=Number(r.counts.PASS||0);
   return {key:'quality-'+r.id,kind:'规则不通过',ruleId:r.id,target:r.target,condition:r.passCriteria||r.content||r.logic,label:r.name,dimension:r.category,failedCount:failed,baseCount:failed,passed,failed,unknown:Number(r.counts.ERROR||0),failureRate:passed+failed?failed/(passed+failed):null,recommended:failed};
 })];
}
export function validateExpansionPlan(rows,selected,config={},custom=[]){if(new Set(selected).size!==selected.length)throw Error('扩增目标重复');let total=0;
 for(const key of selected){const row=rows.find(r=>r.key===key);if(!row)throw Error('报告已变化，请重新选择目标');const n=expansionCount(row,config[key]);if(!Number.isSafeInteger(n)||n<1)throw Error('所选目标的新增数量须为正整数');total+=n;}
 for(const c of custom){if(!Number.isInteger(c.count)||c.count<1||!c.name?.trim()||!c.prompt?.trim()||!c.labels?.length)throw Error('请完善自定义目标和正整数数量');total+=c.count;}
 if(!Number.isSafeInteger(total)||total<1)throw Error('请选择扩增目标并填写数量');return total;}
