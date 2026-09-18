import {getDatasetExample} from './datasetExampleDownloads.js';
import {qualityReports} from './qualityHistory.js';
import {versionSample} from './taskExecution.js';
const encoder=new TextEncoder();
const crc32=bytes=>{
  let crc=0xffffffff;
  for(const byte of bytes){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
};
// Keep every original local entry and central-directory record byte-for-byte.
export function appendZipFiles(original,files){
  const view=new DataView(original.buffer,original.byteOffset,original.byteLength);
  let end=-1;
  for(let i=original.length-22;i>=Math.max(0,original.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw new Error('ZIP 目录无效');
  const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true),offset=view.getUint32(end+16,true);
  const local=[original.slice(0,offset)],central=[original.slice(offset,offset+size)];
  let cursor=offset,centralSize=size;
  for(const file of files){
    const name=encoder.encode(file.name),data=encoder.encode(file.content),crc=crc32(data);
    const h=new Uint8Array(30+name.length),d=new DataView(h.buffer);
    d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint16(6,0x800,true);
    d.setUint32(14,crc,true);d.setUint32(18,data.length,true);d.setUint32(22,data.length,true);d.setUint16(26,name.length,true);h.set(name,30);
    const c=new Uint8Array(46+name.length),v=new DataView(c.buffer);
    v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);
    v.setUint32(16,crc,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,name.length,true);v.setUint32(42,cursor,true);c.set(name,46);
    local.push(h,data);central.push(c);cursor+=h.length+data.length;centralSize+=c.length;
  }
  const tail=new Uint8Array(22),t=new DataView(tail.buffer);
  t.setUint32(0,0x06054b50,true);t.setUint16(8,count+files.length,true);t.setUint16(10,count+files.length,true);t.setUint32(12,centralSize,true);t.setUint32(16,cursor,true);
  return new Blob([...local,...central,tail],{type:'application/zip'});
}
export async function downloadVersionWithReports(dataset,version){
  const example=getDatasetExample(dataset.modality);
  const response=await fetch(example.url);
  if(!response.ok)throw new Error('示例压缩包读取失败');
  const bytes=new Uint8Array(await response.arrayBuffer());
  const files=[];
  for(const report of qualityReports(version)){
    const {sampleExecution,...metadata}=report;
    const rows=[];
    if(sampleExecution&&report.protocolVersion===2){
      for(let index=0;index<Number(version.samples);index++){
        const row=versionSample(sampleExecution,index);
        rows.push({sample_id:row.sampleId,execution_status:row.executionStatus,rule_results:row.ruleResults});
        if(index%1000===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    const taskId=report.taskId||report.reportId;
    files.push({name:`quality/${taskId}.report.json`,content:JSON.stringify(metadata,null,2)});
    if(rows.length)files.push({name:`quality/${taskId}.jsonl`,content:rows.map(row=>JSON.stringify(row)).join('\n')+'\n'});
  }
  const blob=appendZipFiles(bytes,files);
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`${dataset.name}-${version.version}.zip`;document.body.appendChild(a);try{a.click();}finally{a.remove();}
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
