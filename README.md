# 数据生成工具 V5.5

基于 V5 独立复制，版面分析法示例改为 V6 装箱单。
双击 start_user.cmd，访问 http://127.0.0.1:8775/ 。进入「模板中心 → 装箱单模板（草稿）→ 编辑」。

包含装箱单种子图、21 个单元格、28 个文字对象、14 个语义字段，以及件数/毛重/净重汇总、毛净重关系、发票号、签署主体和日期的 7 条业务规则。在线编辑、恢复初稿、试运行图片、标注、质检报告与发布快照使用装箱单数据。预置业务类型为运单、装箱单、提单、库存清单和质检单。

这是前端演示：OCR 和模型调用为 Mock；装箱单样例的件重关系、日期、编号及签署主体进行本地检查，其余通用检测保留 Mock 行为。试运行按当前画布和文字渲染，不调用后端服务。
端口 8775 和 data-factory-frontend-v5.5: 存储前缀隔离旧版草稿。

验证：npm run build；node tests/packingList.test.mjs；node tests/documentTemplateEvidence.test.mjs。
完整回归中 qualityClosedLoop、taskExecution、uedAudit20260918 三项在原 V5 同样失败，属于既有测试与当前实现不一致，本次未改动这些行为。
