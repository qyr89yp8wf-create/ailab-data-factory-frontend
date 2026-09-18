export function deduplicateTemplateCenterRows(items){
  const rows=[...(items||[])].sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  const seenIds=new Set(),seenNames=new Set(),seenConfigurations=new Set();
  return rows.filter(row=>{
    const identity=row.kind?.endsWith('published')?`${row.kind}/${row.id}`:row.key;
    if(seenIds.has(identity))return false;
    seenIds.add(identity);
    const nameKey=`${row.dataType}/${String(row.name||'').trim().replace(/\s+/g,'').toLowerCase()}`;
    if(seenNames.has(nameKey))return false;
    seenNames.add(nameKey);
    const configuration=row.raw?.configuration||row.raw?.selected_version?.configuration_v2||row.raw?.selected_version?.configuration;
    if(configuration&&Object.keys(configuration).length&&!row.taskReferences?.length){
      const fingerprint=`${row.dataType}/${row.status}/${JSON.stringify(configuration)}`;
      if(seenConfigurations.has(fingerprint))return false;
      seenConfigurations.add(fingerprint);
    }
    return true;
  });
}
