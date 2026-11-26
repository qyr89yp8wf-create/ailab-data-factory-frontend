import {handwritingPreview,validateHandwriting} from './handwriting.js';
// Local prototype rendering: reuse the editable layout and values, never an old customs image.
export function packingListChecks(draft) {
  const value=id=>String(draft.texts?.find(t=>t.field_id===id)?.sample_text??draft.fields?.find(f=>f.id===id)?.sample_text??'');
  const number=id=>Number(value(id).replaceAll(',','').match(/[-+]?\d+(?:\.\d+)?/)?.[0]??NaN);
  const near=(a,b)=>Number.isFinite(number(a))&&Math.abs(number(a)-number(b))<=0.1;
  const company=id=>value(id).replace(/\s/g,'').split('LTD.')[0];
  return {
    'PL-SUM-QTY':near('total_qty','item_quantity')&&/CTNS/.test(value('total_qty'))&&/CTNS/.test(value('item_quantity')),
    'PL-SUM-GW':near('total_gw','item_gw'), 'PL-SUM-NW':near('total_nw','item_nw'),
    'PL-WEIGHT':number('item_nw')>0&&number('item_nw')<=number('item_gw')&&number('total_nw')>0&&number('total_nw')<=number('total_gw'),
    'PL-INVOICE':/^[A-Z0-9]+-[0-9]+$/.test(value('invoice_no')),
    'PL-SIGNATURE':Boolean(value('signature').trim())&&company('signature')===company('issuer'),
    'PL-DATE':/^\d{4}-\d{2}-\d{2}$/.test(value('pl_date'))&&Number.isFinite(Date.parse(value('pl_date')))&&new Date(value('pl_date')).toISOString().slice(0,10)===value('pl_date'),
  };
}
export async function renderPackingList(draft) {
  validateHandwriting(draft);
  const size=draft.render_profile?.output_size||draft.canvas;
  const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.scale(size.width/draft.canvas.width,size.height/draft.canvas.height);
  ctx.strokeStyle='#111';ctx.lineWidth=1;
  for(const cell of draft.cells||[]){
    const [x,y,r,b]=cell.bbox_px;
    for(const [edge,coords] of Object.entries({top:[x,y,r,y],right:[r,y,r,b],bottom:[r,b,x,b],left:[x,b,x,y]})){
      if(cell.borders?.[edge]===false)continue;
      ctx.beginPath();ctx.moveTo(coords[0],coords[1]);ctx.lineTo(coords[2],coords[3]);ctx.stroke();
    }
  }
  for(const item of draft.texts||[]){
    const [x,y,r,b]=item.bbox_px;const field=draft.fields?.find(f=>f.id===item.field_id);
    const value=String(item.sample_text??field?.sample_text??'');
    let font=item.id==='label_title'?32:item.style?.font_size||18;
    const lines=value.split('\n');
    ctx.font=`${font}px Arial`;
    font=Math.min(font,...lines.filter(Boolean).map(line=>font*(r-x)/Math.max(1,ctx.measureText(line).width)),(b-y)/Math.max(1,lines.length)/1.15);
    ctx.font=`${item.id==='label_title'?'bold ':''}${font}px Arial`;ctx.textBaseline='top';ctx.fillStyle=item.style?.color||'#111';
    lines.forEach((line,i)=>ctx.fillText(line,x,y+i*font*1.15));
  }
  for(const asset of draft.assets||[]){
    const url=asset.asset_type==='handwriting'?handwritingPreview(asset,draft).url:asset.generator?.asset_path;
    if(!url?.startsWith('data:image/'))continue;
    const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('签署图案加载失败'));img.src=url;});
    const [x,y,r,b]=asset.bbox_px;ctx.drawImage(image,x,y,r-x,b-y);
  }
  return canvas.toDataURL('image/png');
}
