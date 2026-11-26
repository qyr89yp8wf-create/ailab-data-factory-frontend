import {mockSignatureSVG, SIGNATURE_COLORS} from './mockSignature.js';

export const defaultHandwriting = () => ({name_mode:'bind_field',field_id:'',fixed_name:'王岚',style:'natural',stroke:'medium',color:'navy'});
export const defaultHandwritingGenerator = () => ({type:'procedural',handwriting:defaultHandwriting()});

// Both editors, the preview and the trial renderer resolve the same field value.
export function handwritingPreview(asset, draft={}) {
  const hw={...defaultHandwriting(),...(asset.generator?.handwriting||asset.hw)};
  const field=(draft.fields||[]).find(f=>(f.id||f.key)===hw.field_id);
  const text=(draft.texts||[]).find(t=>t.field_id===hw.field_id);
  const name=String(hw.name_mode==='fixed'?hw.fixed_name:(text?.sample_text??field?.sample_text??field?.sample??'')).trim();
  const error=hw.name_mode==='bind_field'&&!field?'请选择有效的动态字段':!name?'请填写虚构人名或绑定字段的示例值':'';
  const svg=error?'':mockSignatureSVG(name,name,{style:hw.style,stroke:hw.stroke,color:SIGNATURE_COLORS[hw.color]||SIGNATURE_COLORS.navy});
  return {name,error,svg,url:svg?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`:''};
}

export function validateHandwriting(draft) {
  for(const asset of [...(draft.assets||[]),...(draft.patterns||[])]) {
    if((asset.asset_type||asset.assetType)!=='handwriting')continue;
    const {error}=handwritingPreview(asset,draft);
    if(error)throw new Error(`${asset.id}：${error}`);
  }
}

// Upgrade only the original V5.5 signature sample, preserving user-authored assets.
export function upgradeHandwritingDraft(draft) {
  let changed=false;
  const assets=(draft.assets||[]).map(asset=>{
    if(asset.id!=='asset_signature'||asset.asset_type!=='fixed_image'||asset.source?.kind==='manual'||asset.generator?.asset_source!=='synthetic_signature')return asset;
    changed=true;
    return {...asset,asset_type:'handwriting',generator:{...defaultHandwritingGenerator(),handwriting:{...defaultHandwriting(),name_mode:'fixed',fixed_name:'王岚'}}};
  });
  return changed?{...draft,assets,revision:Number(draft.revision||0)+1,validation:null,trial_run:null}:draft;
}
