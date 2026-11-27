# V5.51 前端原型更新

- 所有任务列表将“重跑”调整为“续跑”；失败、已终止任务可点击，已完成任务置灰。
- 任务详情增加执行数据量（成功数/总数），完善失败与未执行样本的 Badcase 展示。
- 基础信息增加分阶段调用模型及 API 名称，支持多模型多行展示。
- 运行日志增加 API 调用量、输入/输出/总 Token 消耗及样本执行明细；移除页面上的“统计说明”行。

## 下载与启动

- `ailab-data-factory-frontend-v5.51-source.zip`：源码包；安装 Node.js 后解压，双击 start_user.cmd 启动。
- `ailab-data-factory-frontend-v5.51-web.zip`：网页构建产物，可部署到静态网站服务器。
- 在线演示：https://qyr89yp8wf-create.github.io/ailab-data-factory-frontend/

## 验证与已知限制

- npm run build：通过。
- npm test：26/30 个测试文件通过，与 V5.5.0 已记录的失败项相同。
- 未通过：qualityClosedLoop（96 与预期 95）、taskCenterRefactor（7 字段与旧预期 13）、taskExecution（失败与预期异常）、uedAudit20260918（输入提示审查）。
- 本版本为前端演示，模型、生成引擎、部分质检与续跑仍为模拟逻辑，不代表生产后端服务已实现。
- Release 标签为 v5.51；npm 元数据使用三段版本号 5.51.0。
