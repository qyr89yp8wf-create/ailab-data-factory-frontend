import {RULE_CATALOG,CATALOG_VERSION} from './qualityCatalog.js';
export const uploadStatus=v=>v.publicationStatus||'已发布';
export const published=v=>uploadStatus(v)==='已发布';
export function replaceUploadVersion(dataset,next){const versions=dataset.versions.map(v=>v.version===next.version?next:v),ready=versions.filter(published);return {...dataset,versions,totalSamples:ready.reduce((n,v)=>n+Number(v.samples||0),0),defaultVersion:ready[0]?.version||dataset.defaultVersion,updatedAt:next.updatedAt||dataset.updatedAt};}
const now=()=>new Date().toLocaleString('sv-SE');
// Older demo findings have no archive reference; use a stable per-sample allocation.
export function uploadFindingGroups(version,findings=[]){
 const files=version.uploadFiles||[];
 const groups=files.map((file,i)=>({key:String(file.uid??i),name:file.name,findings:[]}));
 const unknown={key:'unassigned',name:'未记录来源压缩包',findings:[]};
 const sampleGroups=new Map();
 for(const finding of findings){
  let group=groups.find(g=>finding.archiveId!=null&&g.key===String(finding.archiveId))||groups.find(g=>finding.archiveName&&g.name===finding.archiveName);
  if(!group&&!finding.archiveId&&!finding.archiveName&&groups.length){
   if(!sampleGroups.has(finding.sampleId))sampleGroups.set(finding.sampleId,sampleGroups.size%groups.length);
   group=groups[sampleGroups.get(finding.sampleId)];
  }
  (group||unknown).findings.push(finding);
 }
 return [...groups,...(unknown.findings.length?[unknown]:[])];
}
export function beginUploadCheck(v){if(!['草稿','校验失败'].includes(uploadStatus(v)))return v;return {...v,publicationStatus:'校验中',uploadRuns:[...(v.uploadRuns||[]),{id:'CHECK-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),catalogVersion:CATALOG_VERSION,ruleSnapshot:JSON.parse(JSON.stringify([...RULE_CATALOG.filter(r=>'SA'.includes(r.id[0])&&!r.example),...(v.uploadConfigSnapshot?.qualityRules||[]).filter(r=>r.configType==='用户自定义规则'&&'SA'.includes((r.originRuleId||r.id)[0])&&r.enabled!==false)])),status:'校验中',progress:0,startedAt:now(),logs:[],findings:[]}]};}
export function stopUploadCheck(v){if(uploadStatus(v)!=='校验中')return v;const runs=[...v.uploadRuns];runs[runs.length-1]={...runs.at(-1),status:'已终止',finishedAt:now()};return {...v,publicationStatus:'草稿',uploadRuns:runs};}
export function uploadFindings(v){
 if(Array.isArray(v.uploadFixtureFindings))return v.uploadFixtureFindings;
 const names=(v.uploadFiles||[]).map(f=>f.name).join(' '),id=n=>'SAMPLE-'+v.version+'-'+n;
 if(Number(v.samples)<1)return [{sampleId:'—',ruleId:'FILE-EMPTY',name:'数据集非空',category:'文件检查',status:'FAIL',reason:'数据集没有样本'}];
 if(/clean|无问题/i.test(names))return [];
 const result=[];
 if(/fail|失败/i.test(names))result.push({sampleId:id(1),ruleId:'FILE-READ',name:'文件可读取性',category:'文件检查',status:'FAIL',reason:'文件结构无法完整解析'});
 if(/error|异常/i.test(names))result.push({sampleId:id(1),ruleId:'A02',name:'违禁内容',category:'安全质检',status:'ERROR',reason:'检测未完成，请重新检查'});
 if(Number(v.samples)>0)result.push({sampleId:id(1),fieldId:'contact',ruleId:'S02',name:'中国手机号检测',category:'隐私质检',status:'FAIL',reason:'联系方式字段命中'});
 if(Number(v.samples)>1)result.push({sampleId:id(2),fieldId:'company',ruleId:'S11',name:'企业名称检测',category:'隐私质检',status:'FAIL',reason:'企业名称字段命中'});
 if(Number(v.samples)>2)result.push({sampleId:id(3),fieldId:'content',ruleId:'A02',name:'违禁内容',category:'安全质检',status:'FAIL',reason:'样本内容命中禁止内容类别，需删除该样本'});
 if(Number(v.samples)>3)result.push({sampleId:id(4),fieldId:'sample_id',ruleId:'FILE-SAMPLE-STRUCTURE',name:'样本基本结构完整性',category:'数据基本结构',status:'FAIL',reason:'样本缺少必需字段，无法按模板解析；可删除该样本后发布其余数据'});
 return uploadFindingGroups(v,result).flatMap(group=>group.findings.map(f=>({...f,archiveId:group.key,archiveName:group.name})));
}
export function tickUploadCheck(v){if(uploadStatus(v)!=='校验中')return v;const runs=[...v.uploadRuns],last=runs.at(-1),progress=Math.min(100,last.progress+20),findings=progress===100?uploadFindings(v):[];
 const status=progress<100?'校验中':findings.some(f=>f.category==='文件检查'||f.status==='ERROR')?'校验失败':findings.length?'待处理':'已发布';
 const logs=[...last.logs,{time:now(),event:progress<40?'文件检查':progress<70?'隐私检测':progress<100?'安全检测':'检查完成'}];
 runs[runs.length-1]={...last,progress,status,findings,checked:Math.floor(Number(v.samples||0)*progress/100),privacy:findings.filter(f=>f.category==='隐私质检').length,failed:findings.length,logs,...(progress===100?{finishedAt:now()}: {})};
 return {...v,publicationStatus:status,uploadRuns:runs,updatedAt:now()};
}
export function resolveUpload(v,action,methods={}){
 if(!['待处理','校验失败'].includes(uploadStatus(v)))throw Error('当前版本不可重复处置');
 const run=v.uploadRuns.at(-1),findings=run.findings||[];
 if(action==='edit')return {...v,publicationStatus:'草稿',updatedAt:now()};
 if(findings.some(f=>f.category==='文件检查'||f.status==='ERROR'))throw Error('请先修复文件问题或重新完成检查');
 const safetyIds=new Set(findings.filter(f=>f.category==='安全质检').map(f=>f.sampleId));
 const mandatoryDeleteIds=new Set(findings.filter(f=>['安全质检','数据基本结构'].includes(f.category)).map(f=>f.sampleId));
 const deleteIds=new Set(findings.filter(f=>action==='delete'||action==='deleteSafety'&&safetyIds.has(f.sampleId)||action==='maskDelete'&&mandatoryDeleteIds.has(f.sampleId)).map(f=>f.sampleId));
 if(!['delete','mask','maskDelete','deleteSafety'].includes(action))throw Error('未知操作');
 if(action==='mask'&&mandatoryDeleteIds.size)throw Error('安全或结构问题不能通过脱敏放行');
 if(['mask','maskDelete'].includes(action)&&findings.filter(f=>f.category==='隐私质检'&&!deleteIds.has(f.sampleId)).some(f=>!['部分掩码','全掩码','泛化','虚构替换'].includes(methods[f.ruleId])))throw Error('请为每条命中隐私规则选择脱敏方式');
 const remaining=Number(v.samples)-deleteIds.size;if(remaining<1)throw Error('处理后没有可发布样本');
 const residual=action==='deleteSafety'?findings.filter(f=>!deleteIds.has(f.sampleId)):[];
 const status=residual.length?'待处理':'已发布';
 const processing={id:'RESOLVE-'+Date.now(),status,progress:100,startedAt:now(),finishedAt:now(),findings:residual,checked:remaining,failed:residual.length,privacy:residual.length,logs:[{time:now(),event:['mask','maskDelete'].includes(action)?'按配置脱敏、删除安全及结构异常样本并复检':'删除命中样本并复检'}],action,methods,deletedSampleIds:[...deleteIds],sourceRunId:run.id};
 return {...v,samples:remaining,publicationStatus:status,updatedAt:now(),excludedSampleIds:[...(v.excludedSampleIds||[]),...deleteIds],privacyProcessing:['mask','maskDelete'].includes(action)?methods:v.privacyProcessing,uploadRuns:[...v.uploadRuns,processing]};
}
