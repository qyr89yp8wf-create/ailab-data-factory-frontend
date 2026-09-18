import {versionSample} from './taskExecution';

export async function downloadExecutionVersion(dataset,version){
  const metadata={datasetId:dataset.id,datasetName:dataset.name,versionId:version.version,sampleCount:version.samples,sourceTaskId:version.source,sourceVersionId:version.sourceVersionId,templateId:version.templateId,executionSummary:version.executionSummary};
  const chunks=[JSON.stringify(metadata).slice(0,-1)+',"samples":['];
  // Chunk materialization keeps the UI responsive and avoids a giant data URL.
  for(let start=0;start<version.samples;start+=1000){
    const records=[];
    for(let i=start;i<Math.min(start+1000,version.samples);i++){
      const {ruleResults,...sample}=versionSample(version.sampleExecution,i);
      records.push(JSON.stringify(sample));
    }
    chunks.push((start?',':'')+records.join(','));
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  chunks.push(']}');
  const url=URL.createObjectURL(new Blob(chunks,{type:'application/json;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`${dataset.name}-${version.version}.json`;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
