// Capability constraints for the existing expansion model catalog.
export const expansionModels = modality => modality === '文档图像'
  ? ['Doubao-Seedream-4.0']
  : ['Qwen3-14B','Qwen3-VL-8B-Instruct','Doubao-Seedream-4.0','DeepSeek-V3.1'];
export const defaultExpansionModel = modality => expansionModels(modality)[0];
export function normalizeAugmentationCount(value, available) {
  const max = Math.max(0, Math.floor(Number(available) || 0));
  if (!max) return 0;
  const count = Number(value);
  return Math.min(max, Math.max(1, Number.isFinite(count) ? Math.floor(count) : 100));
}
