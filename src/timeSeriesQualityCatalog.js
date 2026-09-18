export const BASE_TIME_SERIES_RULES=[
  ['BASE-READABLE','文件与记录可读取','确认文件可打开、样本记录可解析，损坏或截断数据不会进入后续检查。'],
  ['BASE-STRUCTURE','数据结构完整','检查样本及嵌套对象是否符合模板约定的结构。'],
  ['BASE-FIELD-TYPE','字段类型合法','检查字段定义与各时间点的实际值类型是否一致。'],
  ['BASE-NUMERIC-VALID','数值有效','检查数值字段中是否存在 NaN、Inf 等非法数值。'],
  ['BASE-ENUM','枚举值合法','检查状态、阶段和事件类型是否位于已配置枚举中。'],
  ['BASE-MISSING','缺失策略符合配置','检查字段缺失及其表示方式是否符合模板配置。'],
  ['BASE-HARD-RANGE','字段硬范围合法','仅按已明确配置的硬范围检查各时间点数值，不把正常范围当作硬范围。'],
  ['BASE-UNIT-PRECISION','单位与精度符合配置','检查字段单位、数值精度与模板配置是否一致。'],
  ['BASE-TIMESTAMP','时间戳合法','检查时间戳格式、时区与可解析性。'],
  ['BASE-TIMELINE','时间轴与点数一致','检查索引顺序、重复时间、采样间隔、点数和观测窗口。'],
  ['BASE-SAMPLE-ID','样本标识合法','检查样本 ID 格式及数据集内唯一性。'],
  ['BASE-REFERENCE','引用有效','检查字段、事件、模板及配置引用是否存在且可用。'],
  ['BASE-EVENT-PLAN','事件计划结构合法','检查阶段、事件区间、响应索引和已结构化适用约束。'],
  ['BASE-FROZEN-PLAN','序列与冻结计划一致','检查初始值及已明确映射的阶段、活动事件标记。'],
  ['BASE-LINEAGE','生成与处理血缘完整','检查当前生成方式要求的输入、配置、处理记录及引用。'],
  ['BASE-EXACT-DUPLICATE','完全重复','在批次内按规范化样本内容检查完全重复，排除 ID 与血缘字段。'],
  ['BASE-NEAR-DUPLICATE','近重复','在批次内形成高度相似序列的待复核候选，不自动删除。'],
].map(([rule_id,name,description])=>({rule_id,name,description,target:'both',system:true}));
export const DEFAULT_BASE_RULE_IDS=BASE_TIME_SERIES_RULES.map(rule=>rule.rule_id);
export const PRIVACY_QUALITY_RULES=[
  {rule_id:'DINGO-PII',name:'标准 PII',scope:'整条序列 + 每条记录',engine:'Dingo Rule',severity:'BLOCK',description:'检测手机号、身份证、邮箱、信用卡、护照、SSN 和 IPv4。'},
  {rule_id:'FIXED-PRIVACY-PERSON',name:'个人身份隐私',scope:'整条序列 + 每条记录',engine:'系统规则 / 正则',severity:'BLOCK',description:'检查姓名、手机号和身份证号等个人身份信息。'},
  {rule_id:'FIXED-PRIVACY-CONTACT',name:'联系与位置隐私',scope:'整条序列 + 每条记录',engine:'系统规则 / 正则',severity:'BLOCK',description:'检查详细地址、邮箱、车牌号及精确位置等信息。'},
  {rule_id:'FIXED-PRIVACY-BUSINESS',name:'业务标识隐私',scope:'整条序列 + 每条记录',engine:'系统规则 / 正则',severity:'BLOCK',description:'检查真实运单号、客户编号和企业内部账号。'},
  {rule_id:'FIXED-PRIVACY-CREDENTIAL',name:'账号与密钥安全',scope:'整条序列 + 每条记录',engine:'凭据扫描',severity:'BLOCK',description:'检查 API Key、Token、Cookie 和密码；报告只保留类型与掩码预览。'},
].map(rule=>({...rule,target:'both',system:true,enabled:true,required:true}));
export const ENGINE_QUALITY_RULES={
  coldchain_physics_v1:[
    {rule_id:'CC-QC-POWER-CONSISTENCY',name:'断电状态一致性',description:'核对供电状态、断电事件区间及恢复时点是否一致。',required:true,fields:['power_status','transport_event']},
    {rule_id:'CC-QC-TEMP-RESPONSE',name:'温度响应与恢复',description:'检查断电或开门后的温度响应、滞后及恢复过程是否符合冻结计划。',recommended:true,fields:['return_air_temperature','cargo_temperature']},
    {rule_id:'CC-QC-SENSOR-BIAS',name:'传感器偏移一致性',description:'检查传感器偏移是否只作用于读数，并与真实温度变化区分。',recommended:true,fields:['return_air_temperature','cargo_temperature']},
    {rule_id:'CC-QC-STAGE-GPS',name:'运输阶段与定位一致性',description:'检查运输阶段、时间轴和定位轨迹之间的对应关系。',recommended:true,fields:['gps','transport_event']},
  ],
  generic_timeseries_engine_v1:[],
};
export const DEFAULT_MODEL_QUALITY_RULES=[{
  rule_id:'QC-SCENE-POWER-RESPONSE',name:'断电后的温度响应',enabled:true,mode:'semantic',target_fields:['power_status','return_air_temperature','cargo_temperature'],
  condition_scope:'本条存在短时断电时，检查断电期间及各字段对应的恢复窗口。',
  acceptance_requirement:'供电状态与断电区间一致；箱温和货物温度的响应幅度、延迟及恢复符合本条冻结计划，不出现无依据的瞬间恢复。',
  exceptions_tolerance:'不要求货物一定超温；允许货物恢复跨阶段，但须符合本条恢复窗口。',on_failure:'review',python_code:'def validate(series, context):\n    return validate_power_response(series, context)',
}];
