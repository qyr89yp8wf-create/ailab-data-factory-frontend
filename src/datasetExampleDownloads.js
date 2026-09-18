// Upload templates contain only data; version downloads retain management files.
const packages = {
  document: { filename: 'document-example-v02.zip', label: '文档图像' },
  conversation: { filename: 'conversation-example-v02.zip', label: '对话文本' },
  timeseries: { filename: 'timeseries-example-v02.zip', label: '时序数据' },
};
const aliases = { 文档图像: 'document', 文档类图像: 'document', 对话文本: 'conversation', 对话: 'conversation', 时序数据: 'timeseries', 时序: 'timeseries' };
export function getDatasetExample(type, base = import.meta.env?.BASE_URL || '/', purpose = 'version') {
  const entry = packages[aliases[type] || type];
  if (!entry) throw new Error(`不支持的示例数据类型：${type}`);
  if (!['version', 'upload'].includes(purpose)) throw new Error('不支持的下载用途');
  const filename = purpose === 'upload' ? entry.filename.replace('-example-', '-upload-template-') : entry.filename;
  return { ...entry, filename, url: `${base.replace(/\/?$/, '/')}dataset-examples/${filename}` };
}
export async function downloadDatasetExample(type, purpose = 'version') {
  const example = getDatasetExample(type, undefined, purpose);
  const response = await fetch(example.url);
  if (!response.ok) throw new Error(`示例包读取失败（${response.status}）`);
  const blob = await response.blob();
  const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 3 || signature[3] !== 4) {
    throw new Error('示例包不可用：返回内容不是 ZIP 文件');
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = example.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return example;
}
