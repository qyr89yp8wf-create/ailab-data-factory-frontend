const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));

// The prototype has execution identities but no per-sample image artifacts.
// Render both the illustrative document and its annotations from one record.
export function documentSamplePreview(row, dataset) {
  const width = 1100;
  const fields = Object.entries(row.fields).map(([label, value], index) => ({
    id: `field-${index + 1}`, label, text: String(value),
    bbox: [320, 180 + index * 48, 1050, 220 + index * 48],
  }));
  const height = 250 + fields.length * 48;
  const title = `${dataset.businessType || '文档'} · 模拟预览`;
  const notice = '合成示例，仅用于原型演示，非实际任务成品';
  const objects = [
    {id:'title',type:'text',text:title,bbox:[40,30,1060,70]},
    {id:'sample-id',type:'text',text:row.id,bbox:[40,86,1060,120]},
    {id:'notice',type:'text',text:notice,bbox:[40,130,1060,160]},
    ...fields.flatMap(field => [
      {id:`${field.id}-label`,type:'text',text:field.label,bbox:[50,field.bbox[1],300,field.bbox[3]]},
      {id:field.id,type:'text',field_id:field.label,text:field.text,bbox:field.bbox},
    ]),
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="Microsoft YaHei, sans-serif" fill="#172b4d">${objects.map(object => `<text x="${object.bbox[0]}" y="${object.bbox[1] + 26}" font-size="${object.id==='title'?26:18}">${escapeXml(object.text)}</text>`).join('')}</g><g stroke="#d9e2ef" fill="none">${fields.map(field => `<rect x="40" y="${field.bbox[1]-3}" width="1020" height="48"/>`).join('')}</g></svg>`;
  return {
    imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    annotation: {
      sample_id: row.id, version_id: row.versionId,
      content_origin: 'prototype_simulation', content_notice: notice,
      generated_content: {fields: {...row.fields}},
      render_annotations: {image: `${row.id}.svg`, width, height, objects},
    },
  };
}
