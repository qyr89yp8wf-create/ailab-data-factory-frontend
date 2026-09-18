import data from './qualityCatalogData.json' with {type:'json'};
export const CATALOG_VERSION='quality-2026-09-17';
export const FIXED='系统固定规则',PARAMETER='系统参数化规则',CUSTOM='用户自定义规则';
const clone=x=>JSON.parse(JSON.stringify(x));
const groups={S:'隐私质检',A:'安全质检',B:'文本基础质量',D:'文档基础质检',T:'时序结构与数值',L:'正文与回答质量'};
const CONVERSATION_CLASSIFICATION='conversation-v3';
const conversationIds={L21:'L01',L01:'L02',L02:'L03',L03:'L04',L04:'L05',L05:'L06',L06:'L07',L07:'L08',L22:'L09',L13:'L10',L14:'L11',L15:'L12',L23:'L13',L08:'L14',L09:'L15',L10:'L16',L11:'L17',L12:'L18',L16:'L19',L17:'L20',L18:'L21',L19:'L22',L20:'L23',L24:'L24',L25:'L25',L26:'L26'};
const conversationCategory=id=>{const n=Number(id.slice(1));return n<=9?'正文与回答质量':n<=13?'指令匹配度与事件一致性':n<=18?'事件与工具对话一致性检查':n<=23?'特定内容与字典比对（按模板启用）':n===25?'标签分类':'用户自定义规则';};
export const RULE_CATALOG=data.map(source=>{
 const r=source.id[0]==='L'?{...source,id:conversationIds[source.id],rule_id:conversationIds[source.id]}:source;
 const n=Number(r.id.slice(1)),p=r.id[0];let category=groups[p];
 if(p==='L')category=conversationCategory(r.id);
 if(p==='T')category=n<=7?'时序结构与数值':n===10?'标签分类':n<=11?'指令匹配度与事件一致性':'用户自定义规则';
 if(p==='D'&&n>=14)category=n===16?'标签分类':'用户自定义规则';
 return {...r,key:CATALOG_VERSION+':'+r.id,category,scope:r.target,engine:r.method,description:r.logic.split('；')[0]+'。',content:r.logic,passCriteria:'按模板冻结条件判定',privacy:p==='S',resultType:(category==='标签分类'||r.id==='L13'||r.id==='L25')?'statistics':'binary',example:r.configType===CUSTOM,enabled:r.configType!==CUSTOM,applicability:r.id==='D13'?'enhanced':'all'};
}).sort((a,b)=>a.id[0]==='L'&&b.id[0]==='L'?Number(a.id.slice(1))-Number(b.id.slice(1)):0);
export function modalityRules(modality){const prefix=modality==='文档图像'?'D':modality==='对话文本'?'L':'T';return clone(RULE_CATALOG.filter(r=>'SAB'.includes(r.id[0])||r.id[0]===prefix));}
export function fieldRuleInstances(modality,context={}){
 return (context.fields||[]).filter(f=>f.enabled!==false).flatMap((f,i)=>(f.quality_rules||(f.quality_rule?[f.quality_rule]:f.quality_python||f.quality_prompt?[{prompt:f.quality_prompt,python_code:f.quality_python}]:[])).filter(r=>r.enabled!==false).map((r,j)=>({
 ...r,id:`FIELD-${f.field_id||f.id||i}-${j+1}`,originRuleId:modality==='文档图像'?'D14':'T12',fieldLinked:true,
 name:r.name||`${f.label||f.name||f.field_id||f.id}字段质检`,category:'用户自定义规则',configType:CUSTOM,
 target:f.label||f.name||f.field_id||f.id,method:r.method||r.mode||'规则引擎',enabled:true,
 prompt:r.prompt||r.python_code||r.content||JSON.stringify(r),failCriteria:r.failCriteria||'不满足字段定义的检查条件',
 description:'检查本字段配置的格式、范围或业务约束。',logic:r.prompt||r.python_code||r.content||JSON.stringify(r)
 })));
}
export function qualityConfig(modality,value){
 const config=value?.catalogVersion===CATALOG_VERSION?clone(value):{catalogVersion:CATALOG_VERSION,rules:modalityRules(modality),labels:[],conversationClassification:CONVERSATION_CLASSIFICATION};
 if(modality==='时序数据')config.rules=config.rules.map(rule=>rule.category==='指令匹配度'?{...rule,category:'指令匹配度与事件一致性'}:rule);
 if(modality==='对话文本')config.rules=config.rules.map(rule=>rule.configType===CUSTOM&&rule.resultType==='statistics'?{...rule,category:'标签分类'}:rule);
 if(modality!=='对话文本'||config.conversationClassification===CONVERSATION_CLASSIFICATION)return config;
 config.rules=config.rules.map(rule=>{
   if(!/^L[0-9]{2}$/.test(rule.id))return rule;
   const id=conversationIds[rule.id]||rule.id,definition=RULE_CATALOG.find(r=>r.id===id);
   return {...rule,id,rule_id:id,key:definition.key,category:definition.category,resultType:definition.resultType};
 }).sort((a,b)=>a.id[0]==='L'&&b.id[0]==='L'?Number(a.id.slice(1,3))-Number(b.id.slice(1,3)):0);
 config.rules=config.rules.map(rule=>rule.id.startsWith('L25-')?{...rule,category:'标签分类'}:rule);
 config.conversationClassification=CONVERSATION_CLASSIFICATION;
 return config;
}
export function activeRules(modality,value){return qualityConfig(modality,value).rules.filter(r=>r.enabled!==false&&!r.example).map(r=>{
 const params=r.configType===PARAMETER?{...Object.fromEntries(paramsFor(r).map(([key,,,initial])=>[key,initial])),...r.params}:r.params;
 const parameters=params?Object.entries(params).map(([k,v])=>(paramsFor(r).find(f=>f[0]===k)?.[1]||k)+'：'+v).join('；'):'';
 return {...r,params,rule_id:r.id,passCriteria:[r.failCriteria||r.logic||r.description,parameters].filter(Boolean).join('\n')};
});}
export function validateQualityConfig(value){const ids=new Set();for(const r of value.rules.filter(r=>r.enabled&&!r.example)){if(ids.has(r.id))throw Error('规则ID重复');ids.add(r.id);if(r.configType===CUSTOM&&(!r.name?.trim()||!r.target?.trim()||!r.prompt?.trim()||(!r.resultType?.includes('statistics')&&!r.failCriteria?.trim())))throw Error('请完善自定义规则');}const names=new Set();for(const d of value.labels||[]){if(!d.name?.trim()||names.has(d.name.trim()))throw Error('标签维度名称为空或重复');names.add(d.name.trim());if(!d.values?.length||new Set(d.values).size!==d.values.length||d.values.some(v=>!v.trim())||!d.prompt?.trim())throw Error('请完善标签枚举值和打标Prompt');}return true;}
export const parameterFields={
 D09:[['currency','币种','text','CNY'],['decimals','小数位','integer',2],['grouping','千分位分隔符','text',',']],
 B02:[['min','最少字符数','integer',1]],
 D08:[['tolerance','坐标容差（像素）','number',0]],
 D12:[['minIoU','最小区域重叠率','ratio',0.8]],
 T04:[['timeTolerance','起止时间容差（秒）','number',0],['pointTolerance','允许点数偏差','integer',0]],
 T05:[['jitter','采样间隔容差（秒）','number',0]],
 T11:[['minChange','最小变化幅度','signed',0],['maxChange','最大变化幅度','signed',10],['duration','最少持续时间（秒）','number',0]],
 L11:[['difficulty','目标难度','text','中等']],L12:[['topics','允许主题','text','模板主题']],
 S07:[['ranges','禁止地址范围','text','公网地址']],S08:[['granularity','保护粒度','text','街道及门牌']],
 S10:[['plateType','车牌类型','text','普通车牌、新能源车牌']],S12:[['pattern','编号模式','text','模板字段定义']],S15:[['keys','敏感键名','text','session,token']],
 B04:[['ratio','不可见字符占比上限','ratio',0.01]],B05:[['ratio','特殊模式匹配占比上限','ratio',0.01]],
 B06:[['length','连续空格数量','integer',500]],B07:[['length','连续换行数量','integer',8]],B08:[['ratio','换行占比上限','ratio',0.25]],
 B09:[['entities','禁止的实体模式','text','&nbsp;、&amp;']],B10:[['excludedFields','排除的代码或HTML字段','text','继承模板字段类型']],
 B11:[['letters','拆分字母数','integer',6],['matches','命中次数','integer',3]],B12:[['pattern','断词模式','text','正文末尾字母串＋连字符＋可选空白']],
 B14:[['words','占位词表','text','Lorem Ipsum']],B15:[['allow','允许纯链接的字段','text','无']],B16:[['words','禁止来源词表','text','继承系统来源词表']],
 D10:[['notation','允许的科学计数法形式','text','E/e、尾数×10整数次幂']],
 L02:[['implementation','检测实现','text','6-gram规则版'],['threshold','重复占比上限','ratio',0.5]],
 L04:[['model','语言模型与分词器','text','继承模板模型'],['limit','场景校准上限','text','继承场景校准配置']],
 L21:[['language','目标语言','text','中文'],['rubric','质量量表','text','语法、拼写、语义完整性']],
 L22:[['window','末尾扫描字符数','integer',100],['sources','禁止来源词表','text','继承目标语言词表']],
 L23:[['mapping','字典字段映射','text','继承事件计划字段映射']],T07:[['units','允许单位和坐标系','text','继承时序字段定义']],
};
export function paramsFor(rule){return parameterFields[rule.id]||[['constraint','业务参数','text','沿用模板字段配置']];}
export function samplingLabels(config={},modality){
 const source=config.sampler?.dimensions?.length?config.sampler.dimensions:config.event_generation?.sampling_dimensions||[];
 return modality==='文档图像'?[]:source.filter(d=>d.enabled!==false).map((d,i)=>({id:d.dimension_id||d.id||'dim-'+i,name:d.name||d.label||d.dimension_id||'采样维度',source:'system',values:(d.values||d.options||d.labels||[]).map(v=>typeof v==='string'?v:v.name||v.label||v.value),prompt:'按实际生成内容识别事件采样维度'}));
}
