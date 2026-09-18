export function buildTaskDraft(values, id, timestamp, previous) {
  const configSnapshot = structuredClone(values);
  return {
    id, key: id, name: values.name?.trim() || '未命名任务',
    description: values.description, modality: values.modality,
    taskType: values.taskType, businessType: values.businessType,
    status: '草稿', progress: 0, currentStage: '尚未发布',
    created: previous?.created || timestamp, updated: timestamp,
    stages: [values.taskType], input: values.inputVersionId || values.templateId || '-',
    output: '-', configSnapshot,
  };
}

export function upsertTaskDraft(tasks, draft) {
  return [draft, ...tasks.filter(task => task.id !== draft.id)];
}
