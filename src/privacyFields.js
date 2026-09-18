// Parse output definitions and JSON/JSONL examples; never collect configuration keys as sample fields.
export function privacyFieldOptions(definitions=[], jsonSources=[]) {
  const result=new Map();
  const add=(id,label)=>{if(typeof id==='string'&&id.trim())result.set(id,{value:id,label:label&&label!==id?`${label}（${id}）`:id});};
  definitions.filter(Boolean).forEach(field=>add(field.field_id||field.id||field.name||field.key||field.value,field.label||field.name));
  const walk=(value,path='')=>{
    if(Array.isArray(value)){value.forEach(item=>walk(item,path?`${path}[]`:''));return;}
    if(value&&typeof value==='object')Object.entries(value).forEach(([key,item])=>{const next=path?`${path}.${key}`:key;if(item&&typeof item==='object')walk(item,next);else {add(next);if(typeof item==='string'&&/^[{[]/.test(item.trim())){try{walk(JSON.parse(item),next);}catch{}}}});
  };
  jsonSources.filter(Boolean).forEach(source=>{if(typeof source!=='string'){walk(source);return;}try{walk(JSON.parse(source));}catch{source.split(/\r?\n/).filter(Boolean).forEach(line=>{try{walk(JSON.parse(line));}catch{}});}});
  return [...result.values()];
}
