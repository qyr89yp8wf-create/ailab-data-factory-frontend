// Only named built-in fixtures are updated. User-created task snapshots are immutable.
export const BUILTIN_TASK_FAMILIES = {
 'TASK-20260812-0048':'waybill',
 'TASK-20260812-0039':'customs',
 'TASK-20260812-0027':'conversation',
 'TASK-20260811-0186':'timeseries',
 'TASK-20260811-0173':'customs',
 'TASK-20260811-0159':'timeseries',
 'TASK-20260811-0141':'conversation',
 'TASK-20260914-RETRY-1':'waybill',
 'TASK-20260914-RETRY-2':'conversation',
 'TASK-20260914-RETRY-3':'timeseries',
 'TASK-20260914-RETRY-4':'waybill',
 'TASK-20260915-DOC-ENHANCE-001':'waybill',
 'TASK-20260915-CONV-EXPAND-001':'conversation',
 'TASK-20260916-DOC-QUALITY-001':'waybill',
 'TASK-20260916-CONV-QUALITY-001':'conversation',
 'TASK-20260916-TS-QUALITY-001':'timeseries',
 'TASK-20260915-TS-QUALITY-001':'timeseries',
};
export const TASK_FAMILIES={
 waybill:{templateId:'TEMPLATE-DOC-20260902-WB0012',templateName:'橙途速运运单模板',businessType:'运单',datasetName:'物流运单图像数据集'},
 customs:{templateId:'TEMPLATE-DOC-20260902-E3A971',templateName:'进口货物申报单模板',businessType:'报关单',datasetName:'报关单数据集'},
 conversation:{templateId:'TEMPLATE-CONV-20260902-C01A7B',templateName:'物流智能客服对话模板',businessType:'智能客服多轮对话',datasetName:'物流客服多轮对话'},
 timeseries:{templateId:'TEMPLATE-TS-20260902-CC1024',templateName:'冷藏集装箱多变量时序模板',businessType:'传感器时序',datasetName:'冷链温湿度时序集'},
};
export function alignBuiltinTask(task){
 const family=TASK_FAMILIES[BUILTIN_TASK_FAMILIES[task.id]];
 if(!family)return task;
 const updates={templateId:family.templateId,businessType:family.businessType};
 if(task.taskType==='数据合成')updates.input=family.templateName;
 if(task.id==='TASK-20260811-0173')Object.assign(updates,{name:'报关单图像数据质检',input:task.input?.startsWith('报关单数据集 / ')?task.input:'报关单数据集',description:'检查报关单图像可读性与字段一致性，展示检测执行异常。'});
 if(task.id==='TASK-20260811-0159')Object.assign(updates,{name:'冷链异常事件定向扩增',input:task.input?.startsWith('冷链温湿度时序集 / ')?task.input:'冷链温湿度时序集',output:task.output?.includes('车辆GPS')?'待生成':task.output,description:'根据冷链事件标签分布与规则问题补充时序样本。'});
 if(task.id==='TASK-20260915-DOC-ENHANCE-001')updates.description='对已质检样本进行字段语义改写和图像增强，增强后自动复检。';
 if(task.id==='TASK-20260812-0027')updates.description='检查物流客服对话质量与标签覆盖分布';
 if(task.id==='TASK-20260812-0039')Object.assign(updates,{input:task.input?.replace('报关单与合同数据集','报关单数据集'),output:task.output?.replace('报关单与合同数据集','报关单数据集')});
 return {...task,...updates};
}
