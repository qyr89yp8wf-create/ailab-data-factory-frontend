export function buildTaskDetailLog(task, outputDataset, qualityReportId) {
  const job=task.backendJob||{};
  const summary=task.executionSummary||null;
  const events=[
    {time:task.created,event:'submitted',message:'任务已提交'},
    ...(job.events||task.events||[]),
    ...(summary?.retriedSampleCount?[{event:'retry_summary',sample_count:summary.retriedSampleCount,retry_count:summary.retryAttemptCount||0}]:[]),
    ...(summary?.badcaseSampleCount?[{event:'badcase_summary',sample_count:summary.badcaseSampleCount}]:[]),
    {time:task.updated||task.created,event:'current_status',status:task.status,stage:task.currentStage||task.status},
    ...(task.outputVersionId?[{event:task.taskType==='数据质检'?'quality_result_file_written':'version_committed',version_id:task.outputVersionId,...(task.taskType==='数据质检'?{file:`quality/results/${task.id}.json`,report_id:qualityReportId,original_files_changed:false}:{})}]:[]),
  ];
  return {
    task_id:task.id,task_name:task.name,task_type:task.taskType,status:task.status,
    updated_at:task.updated||task.created,
    events,
    previous_runs:(task.runHistory||[]).map(run=>({run_number:run.runNumber||1,status:run.status,updated_at:run.updated,execution_summary:run.executionSummary,execution:run.execution})),
    api_usage:task.apiUsage||job.api_usage||job.usage||null,
    execution_summary:summary,
    result:{
      output:task.output||null,
      dataset_name:outputDataset?.name||null,dataset_id:outputDataset?.id||null,
      output_version_id:task.outputVersionId||null,
      source_version_id:task.taskType==='数据合成'?null:task.sourceVersionId||task.configSnapshot?.inputVersionId||null,
      quality_report_id:qualityReportId||null,
      ...(task.outputVersionId?{result_url:`?taskResult=${encodeURIComponent(task.id)}`}:{}),
      ...(Object.keys(job).length?{backend_result:job.result||null,metrics:job.metrics||null,artifacts:job.artifacts||job.artifact_urls||job.urls||null,error:job.error||null}:{}),
    },
  };
}

export function downloadTaskLog(taskId,json) {
  const url=URL.createObjectURL(new Blob([json],{type:'application/json;charset=utf-8'}));
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=`${taskId}-运行日志.json`;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
