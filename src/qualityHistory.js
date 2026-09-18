export function qualityReports(version) {
  if(!version)return [];
  const reports=[...(version.qualityReports||[])];
  const legacy=version.qualityReport;
  if(legacy&&!['待质检','未质检'].includes(legacy.status)){
    const reportId=legacy.reportId||version.qualityReportId||`QREPORT-${version.version}`;
    if(!reports.some(report=>report.reportId===reportId))reports.push({...legacy,reportId,createdAt:legacy.createdAt||version.created||version.updatedAt,taskId:legacy.taskId||version.source,sampleExecution:legacy.sampleExecution||version.sampleExecution});
  }
  return reports.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}
export function preferredQualityReport(reports) {
  return reports.find(report=>report.protocolVersion===2)||reports[0]||null;
}
export function versionWithReport(version,report) {
  if(!version||!report)return version;
  return {...version,qualityReport:report,qualityReportId:report.reportId,
    sampleExecution:report.sampleExecution,checkedSampleCount:report.checkedSampleCount,
    sampleQualityLabels:{...(version.sampleQualityLabels||{}),coverage:report.executionRange==='sample'?'partial':'full',checkedSampleCount:report.checkedSampleCount}};
}
export function appendQualityReport(version,report,task,now) {
  const previous=qualityReports(version);
  if(previous.some(item=>item.reportId===report.reportId))return version;
  return {...version,updatedAt:now,qualityReports:[report,...previous],
    consumers:[{id:task.id,name:task.name,taskType:'数据质检',status:task.status,updatedAt:now},...(version.consumers||[]).filter(item=>item.id!==task.id)]};
}
