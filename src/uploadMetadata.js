// Inspect bounded metadata only; uploaded manifests/reports never enter application storage.
const LIMIT=1024*1024;
async function metadataEntries(file){
  const tail=new Uint8Array(await file.slice(Math.max(0,file.size-65557)).arrayBuffer());
  const t=new DataView(tail.buffer);let end=-1;
  for(let i=tail.length-22;i>=0;i--)if(t.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw Error('无法读取 ZIP 目录');
  const size=t.getUint32(end+12,true),offset=t.getUint32(end+16,true);
  if(size>8*LIMIT||offset+size>file.size)throw Error('ZIP 目录超出检测限制');
  const bytes=new Uint8Array(await file.slice(offset,offset+size).arrayBuffer()),v=new DataView(bytes.buffer),out=[];
  for(let p=0;p+46<=bytes.length;){
    if(v.getUint32(p,true)!==0x02014b50)break;
    const nl=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true);
    const name=new TextDecoder().decode(bytes.slice(p+46,p+46+nl));
    if(/(^|\/)(manifest|lineage|quality)(\/|\.|$)/i.test(name)&&/\.json$/i.test(name))out.push({name,method:v.getUint16(p+10,true),flags:v.getUint16(p+8,true),compressed:v.getUint32(p+20,true),size:v.getUint32(p+24,true),offset:v.getUint32(p+42,true)});
    p+=46+nl+extra+comment;
  }
  if(out.length>30)throw Error('元数据文件过多');
  return out;
}
async function readJson(file,e){
  if(e.size>LIMIT||e.compressed>LIMIT||e.flags&1)throw Error('元数据过大或已加密');
  const h=new DataView(await file.slice(e.offset,e.offset+30).arrayBuffer());
  if(h.getUint32(0,true)!==0x04034b50)throw Error('无效 ZIP 文件头');
  const start=e.offset+30+h.getUint16(26,true)+h.getUint16(28,true);
  const blob=file.slice(start,start+e.compressed);let bytes;
  if(e.method===0)bytes=new Uint8Array(await blob.arrayBuffer());
  else if(e.method===8){
    const reader=blob.stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();const chunks=[];let length=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>LIMIT)throw Error('元数据解压超限');chunks.push(value);}}finally{await reader.cancel();}
    bytes=new Uint8Array(length);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}
  }else throw Error('不支持的 ZIP 压缩方式');
  return JSON.parse(new TextDecoder().decode(bytes));
}
function references(data){
  const out=[];let visited=0;
  function walk(x,depth=0){if(!x||typeof x!=='object'||depth>12||++visited>10000)return;
    if(typeof x.template_id==='string'||typeof x.templateId==='string')out.push({id:x.template_id||x.templateId,version:x.template_version||x.templateVersion});
    if(x.template&&typeof x.template.id==='string')out.push({id:x.template.id,version:x.template.version});
    for(const value of Object.values(x))walk(value,depth+1);
  }walk(data);return out;
}
export async function detectUploadMetadata(files,templates){
  const refs=[],detected=[],warnings=[];
  for(const item of files){const file=item.originFileObj||item;
    try{for(const e of await metadataEntries(file)){detected.push(e.name);try{refs.push(...references(await readJson(file,e)));}catch{warnings.push('部分元数据无法解析');}}}catch{warnings.push('部分压缩包无法检测元数据');}
  }
  const unique=[...new Map(refs.map(r=>[`${r.id}@${r.version||''}`,r])).values()];
  const matched=unique.length===1?templates.filter(t=>t.id===unique[0].id&&unique[0].version&&String(t.version)===String(unique[0].version)):[];
  return {detected:[...new Set(detected)],status:unique.length>1?'conflict':warnings.length?'warning':matched.length===1?'matched':detected.length?'unmatched':'absent',templateId:!warnings.length&&matched.length===1?matched[0].id:null};
}
