const populated=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length>0;

// Preserve submitted snapshots verbatim. Older records may store parameters elsewhere.
export function resolveTaskConfiguration(task, datasets=[]) {
  if(populated(task.configSnapshot))return task.configSnapshot;
  if(populated(task.historicalConfigSnapshot))return task.historicalConfigSnapshot;
  const job=task.backendJob||{};
  const parameters={
    ...(populated(task.parameters)?task.parameters:{}),
    ...(populated(task.config)?task.config:{}),
    ...(populated(job.parameters)?job.parameters:{}),
    ...(populated(job.config)?job.config:{}),
  };
  const inputVersionId=parameters.inputVersionId||task.sourceVersionId||null;
  const inputDataset=task.taskType==='数据合成'?null:datasets.find(item=>item.id===(parameters.inputDatasetId||task.sourceDatasetId)
    || (inputVersionId&&item.versions?.some(version=>version.version===inputVersionId))
    || (task.input&&task.input.split(' / ')[0]===item.name));
  const outputDataset=datasets.find(item=>task.outputVersionId&&item.versions?.some(version=>version.version===task.outputVersionId));
  return {
    name:task.name,description:task.description||'',taskType:task.taskType,modality:task.modality,businessType:task.businessType,
    input:task.input||null,output:task.output||null,
    inputDatasetId:task.taskType==='数据合成'?null:inputDataset?.id||task.sourceDatasetId||null,
    inputVersionId:task.taskType==='数据合成'?null:inputVersionId,
    ...(outputDataset?{outputDatasetId:outputDataset.id,outputDatasetName:outputDataset.name}:{}),
    ...(task.templateId?{templateId:task.templateId}:{}),
    ...(task.retryPolicy?{retryPolicy:task.retryPolicy}:{}),
    ...(task.stages?{stages:task.stages}:{}),
    ...parameters,
    snapshotOrigin:populated(parameters)?'legacy_parameters':'legacy_task_record',
  };
}
