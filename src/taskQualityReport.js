import {qualityReports} from './qualityHistory.js';

export function reportForQualityTask(task,datasets) {
  if(!task||task.taskType!=='数据质检')return null;
  let historical=null;
  for(const dataset of datasets||[])for(const version of dataset.versions||[]){
    const candidates=qualityReports(version).filter(item=>item.taskId===task.id);
    const report=candidates.find(item=>item.protocolVersion===2)||candidates[0];
    if(report?.protocolVersion===2)return {dataset,version,report};
    if(report&&!historical)historical={dataset,version,report};
  }
  if(historical)return historical;
  const dataset=(datasets||[]).find(item=>item.id===(task.sourceDatasetId||task.configSnapshot?.inputDatasetId));
  const version=dataset?.versions?.find(item=>item.version===(task.sourceVersionId||task.configSnapshot?.inputVersionId));
  return version?{dataset,version,report:null}:null;
}
