import {alignBuiltinTask,BUILTIN_TASK_FAMILIES,TASK_FAMILIES} from './builtinTaskAlignment';
import {isRetiredGpsDataset,reconcileDemoTaskLinks,reconcileDemoDatasetLinks} from './demoDatasetAlignment';
import ExpansionEvidence from './ExpansionEvidence';
import {refreshBuiltinQuality} from './builtinQualityMigration';
import {expansionTargets,validateExpansionPlan} from './coveragePlanning';
import ExpansionTargetTable from './ExpansionTargetTable.jsx';
import {expansionCount} from './expansionQuality.js';
import {FormModelConfig,ModelConfigField,ModelConfigGroup} from './ModelConfigField';
import { autoQualityEnabled, qualityModelNeeds } from './taskPolicies';
import { expansionModels, defaultExpansionModel, normalizeAugmentationCount } from './taskFormConstraints';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {uploadStatus,published,beginUploadCheck,stopUploadCheck,tickUploadCheck,replaceUploadVersion,UploadTaskDetail,UploadPublicationPanel} from './uploadLifecycle';
import {detectUploadMetadata} from './uploadMetadata';
import DatasetPreview from './DatasetPreview';
import UnifiedQualityEditor from './UnifiedQualityEditor';
import AugmentationSelection from './AugmentationSelection.jsx';
import DocumentAugmentationScheme from './DocumentAugmentationScheme.jsx';
import TextAugmentationScheme from './TextAugmentationScheme.jsx';
import TaskBasisSummary from './TaskBasisSummary.jsx';
import {augmentationPool} from './augmentationSelection.js';
import {buildAugmentationSelection} from './augmentationSampling.js';
import {taskQualityRules,PRIVACY_SCOPE_NOTICE} from './qualityScope';
import { buildTaskDraft, upsertTaskDraft } from './taskDraft';
import { conversationCatalogRules, conversationRuleCategory, LEGACY_CONVERSATION_RULE_MAP } from './conversationQualityCatalog';
import { buildTaskDetailLog, downloadTaskLog } from './taskDetailLog';
import { resolveTaskConfiguration } from './taskConfiguration';
import { qualityReports, preferredQualityReport, versionWithReport, appendQualityReport } from './qualityHistory';
import { reportForQualityTask } from './taskQualityReport';
import { prototypeHistoricalQualityReport, prototypeQualityTaskReport, versionReportsForDisplay } from './prototypeHistoricalQuality';
import { downloadVersionWithReports } from './qualityResultDownload';
import { customsTemplateSnapshot, documentSnapshot, documentTemplateRules, DocumentTemplateFields } from './DocumentTemplateEvidence';
import { createRoot } from 'react-dom/client';
import {
  Alert, App as AntApp, Avatar, Badge, Breadcrumb, Button, Card, Checkbox, Col,
  ConfigProvider, Descriptions, Divider, Drawer, Dropdown, Empty, Flex, Form,
  Input, InputNumber, Layout, Menu, Modal, Progress, Radio, Row, Segmented,
  Select, Slider, Space, Statistic, Steps, Switch, Table, Tabs, Tag, Timeline,
  Tooltip, Typography, Upload, message
} from 'antd';
import {
  AppstoreOutlined, BellOutlined, CheckCircleOutlined, CloudUploadOutlined,
  DatabaseOutlined, DeleteOutlined, DownOutlined, ExclamationCircleOutlined,
  FileImageOutlined, FileTextOutlined, FilterOutlined, FundOutlined,
  HomeOutlined, LeftOutlined, MenuFoldOutlined, MenuUnfoldOutlined, PlayCircleOutlined,
  PlusOutlined, SearchOutlined, SettingOutlined, SafetyCertificateOutlined,
  RiseOutlined, ArrowRightOutlined, ApartmentOutlined, KeyOutlined
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import {
  CUSTOMS_INITIAL_VALUES, CustomsAugmentationFields, CustomsGenerationFields,
  CustomsQualityFields, CustomsTaskDetail, CustomsTemplateFields,
  createCustomsBackendJob, customsStages
} from './CustomsMvp';
import { CustomsQualityReportPage } from './CustomsQualityReport';
import { ColdChainQualityReportPage } from './ColdChainQualityReport';
import {
  COLD_CHAIN_INITIAL_VALUES, ColdChainAugmentationFields, ColdChainGenerationFields,
  ColdChainQualityFields, ColdChainSubmissionSummary, ColdChainTaskDetail,
  ColdChainTemplateSelectionFields, createColdChainBackendJob, coldchainStages,
} from './ColdChainMvp';
import {
  CONVERSATION_TASK_INITIAL_VALUES, ConversationAugmentationFields,
  ConversationGenerationFields, ConversationQualityExpansionFields,
  ConversationSubmissionSummary, ConversationTaskInformation, ConversationTaskLogs,
  ConversationTaskResults, ConversationTemplateSelectionFields,
  createConversationBackendJob, conversationStages,
} from './ConversationTaskFlow';
import { ConversationQualityReportPage } from './ConversationQualityReport';
import {
  SYNTHETIC_DOCUMENT_INITIAL_VALUES, SyntheticDocumentAugmentationFields,
  SyntheticDocumentGenerationFields, SyntheticDocumentQualityFields,
  SyntheticDocumentSubmissionSummary, SyntheticDocumentTaskDetail,
  SyntheticDocumentTemplateFields, createSyntheticDocumentBackendJob,
  syntheticDocumentStages,
} from './SyntheticDocumentTaskFlow';
import { customsApi } from './customsApi';
import { coldchainApi } from './coldchainApi';
import { conversationApi } from './conversationApi';
import { syntheticTemplateApi } from './syntheticTemplateApi';
import { localStoreApi } from './localStoreApi';
import { formatDateTime, nowDateTime } from './timeUtils';
import { TemplateCenter } from './TemplateCenter';
import { ApiKeysManager } from './ApiKeysManager';
import { defaultConversationSampler, buildQuotaPlan } from './conversationSampling';
import { readStore } from './mockStore';
import { downloadDatasetExample } from './datasetExampleDownloads';
import { RETRY_POLICY, newExecutionTask, advanceExecution, stopExecution, qualityExecutionMetadata } from './taskExecution';
import { BadcasePanel, ExecutionSummary, ExecutionLogs, VersionExecutionInfo, ExecutionQualityReport } from './TaskExecutionPanels';
import './styles.css';
import './ued.css';
import {uedTheme} from './uedTheme';
import DetailPage, {DetailWorkspace} from './DetailPage';

import {templateRulesSnapshot} from './templateQualitySnapshot';
import LegacyQualityReportPage from './LegacyQualityReportPage';
import RuleQualityReport from './RuleQualityReport';
import {reportRuleRows,isDistribution,rateText} from './qualityResults';
const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const CURRENT_USER = 'feidongni';
const TASK_TYPES = ['数据合成','数据质检','数据增强','定向扩增'];

const modalityColor = { 文档图像:'blue', 对话文本:'geekblue', 时序数据:'green' };
const stageColor = { 数据合成:'cyan', 数据质检:'purple', 数据增强:'orange', 生成:'cyan', 增强:'orange', 隐私处理:'red', 质量评估:'purple', 隐私评估:'volcano', 覆盖评估:'gold', 定向增强:'orange', 定向扩增:'lime', 问题处置:'magenta' };
const statusMap = { 运行中:'processing', 异常:'error', 已完成:'success', 失败:'error', 已终止:'default', 排队中:'warning', 草稿:'default', 可用:'success' };
const modalityLabelMap = { 文档图像:'文档类图像', 对话文本:'对话类数据', 时序数据:'时序类数据' };
const taskTypeColor=value=>({数据合成:'blue',数据质检:'purple',数据增强:'orange',定向扩增:'lime'}[value]||'default');
const taskPageConfig = {
  'tasks-document': { modality:'文档图像', label:'文档图像', icon:<FileImageOutlined/> },
  'tasks-conversation': { modality:'对话文本', label:'对话文本', icon:<FileTextOutlined/> },
  'tasks-timeseries': { modality:'时序数据', label:'时序数据', icon:<FundOutlined/> },
};

const initialTasks = [
  { key:'1', id:'TASK-20260812-0048', name:'物流运单批量合成', description:'合成训练所需运单图像', taskType:'数据合成', modality:'文档图像', businessType:'运单', stages:['数据合成'], input:'运单模板', output:'物流运单图像数据集 / V3', currentStage:'数据合成', status:'运行中', progress:68, created:'2026-08-12 09:42:00' },
  { key:'2', id:'TASK-20260812-0039', name:'报关单覆盖短板扩增', description:'根据已有覆盖检查结果补齐报关单短板', taskType:'定向扩增', modality:'文档图像', businessType:'报关单', stages:['定向扩增'], input:'报关单数据集 / V2', output:'报关单数据集 / V3', currentStage:'定向扩增', status:'已完成', progress:100, created:'2026-08-12 09:10:00' },
  { key:'3', id:'TASK-20260812-0027', name:'投诉对话数据质检', description:'检查敏感信息和对话质量', taskType:'数据质检', modality:'对话文本', businessType:'异常反馈', stages:['数据质检'], input:'物流客服多轮对话 / 524D25F69157', output:'物流客服多轮对话 / 8A67C201DF33', currentStage:'样本级质检标签写入', status:'运行中', progress:42, created:'2026-08-12 08:56:00' },
  { key:'4', id:'TASK-20260811-0186', name:'冷链温湿度异常序列合成', description:'合成超温和骤冷事件序列', taskType:'数据合成', modality:'时序数据', businessType:'传感器时序', stages:['数据合成'], input:'冷链时序模板', output:'冷链温湿度时序集 / V3', currentStage:'结果写入', status:'已完成', progress:100, created:'2026-08-11 17:32:00' },
  { key:'5', id:'TASK-20260811-0173', name:'报关单图像数据质检', description:'输出OCR可用性和字段一致性报告', taskType:'数据质检', modality:'文档图像', businessType:'报关单', stages:['数据质检'], input:'报关单数据集', output:'技术失败，未创建正式版本', currentStage:'OCR回检失败', status:'失败', progress:76, created:'2026-08-11 16:48:00' },
  { key:'6', id:'TASK-20260811-0159', name:'冷链异常事件定向扩增', description:'根据冷链事件标签分布补充时序样本', taskType:'定向扩增', modality:'时序数据', businessType:'传感器时序', stages:['定向扩增'], input:'冷链温湿度时序集', output:'待生成', currentStage:'等待资源', status:'排队中', progress:0, created:'2026-08-11 15:21:00' },
  { key:'7', id:'TASK-20260811-0141', name:'异常反馈多轮对话合成', description:'合成投诉、延误与破损场景对话', taskType:'数据合成', modality:'对话文本', businessType:'异常反馈', stages:['数据合成'], input:'智能客服对话模板', output:'物流客服多轮对话 / V3', currentStage:'结果写入', status:'已完成', progress:100, created:'2026-08-11 14:06:00' },
];

const backendStatusMap = {
  queued:'排队中', running:'运行中', completed:'已完成', failed:'失败', cancelled:'已终止',
  generating:'运行中', extracting_rules:'运行中', retrieving:'运行中', planning:'运行中',
  generating_dialogues:'运行中', augmenting:'运行中', quality_checking:'运行中',
  expanding:'运行中', rechecking:'运行中', writing_results:'运行中',
};

function validationMeta(job) {
  if(job.pipeline==='cold-chain') return {name:'冷链时序模板任务',modality:'时序数据',businessType:'传感器时序',stages:['生成',...(job.parameters?.augmentation?.enabled?['增强']:[]),...(job.parameters?.enable_quality?['质量评估']:[]),...(job.parameters?.enable_expansion?['定向扩增']:[])]};
  if(job.pipeline==='conversation') return {name:'智能客服对话运行验证',modality:'对话文本',businessType:'智能客服多轮对话',stages:['生成','质量评估',...(job.parameters?.expansion?.enabled?['定向扩增']:[])]};
  return {name:'进口报关单运行验证',modality:'文档图像',businessType:'报关单',stages:['生成',...(job.parameters?.run_qc?['质量评估']:[]),...(job.parameters?.enable_expansion?['定向扩增']:[])]};
}

function validationToTask(job) {
  const meta=validationMeta(job);
  const status=backendStatusMap[job.status]||'运行中';
  return {
    key:`validation-${job.id}`,id:job.id,name:`${meta.name} · ${job.id.slice(-4)}`,
    description:'由浏览器 Mock 自动恢复的验证记录，参数、阶段事件与生成结果均保存在本地状态中。',
    taskType:'数据合成',modality:meta.modality,businessType:meta.businessType,stages:['数据合成'],
    input:'本地验证参数',output:'本地文件系统',currentStage:job.message||job.stage,
    status,progress:Number(job.progress)||0,
    created:formatDateTime(job.created_at),
    backendJob:job,validationOnly:true,
  };
}

function mergeValidationTasks(tasks, validations) {
  const jobs=new Map(validations.map(job=>[job.id,job]));
  const merged=tasks.map(task=>{
    const job=jobs.get(task.id);
    if(!job)return task;
    jobs.delete(task.id);
    return {...task,backendJob:job,status:backendStatusMap[job.status]||task.status,progress:Number(job.progress)||0,currentStage:job.message||task.currentStage};
  });
  return [...validations.filter(job=>jobs.has(job.id)).map(validationToTask),...merged];
}

function normalizedTaskType(task) {
  if(TASK_TYPES.includes(task.taskType))return task.taskType;
  if(task.taskType==='数据生成')return '数据合成';
  if((task.stages||[]).includes('定向扩增'))return '定向扩增';
  if((task.stages||[]).some(stage=>['增强','定向增强'].includes(stage)))return '数据增强';
  return '数据质检';
}

function normalizeTaskTimes(items) {
  return (items || []).map(task=>{task=alignBuiltinTask(task);const taskType=normalizedTaskType(task);return {...task,taskType,status:task.status==='部分完成'?'已完成':task.status,stages:[taskType],created:formatDateTime(task.created || task.created_at),updated:task.updated||task.updated_at?formatDateTime(task.updated||task.updated_at):undefined};});
}

const initialDatasets = [
  { id:1, name:'物流运单图像数据集', modality:'文档图像', businessType:'运单', status:'可用', desc:'华东区域标准运单及多种扫描、拍摄场景。', defaultVersion:'V3', totalSamples:'520K', reference:true, versions:[
    { id:'D1V3', version:'V3', note:'补充夜间反光与折叠场景', source:'TASK-20260812-0048', sourceName:'物流运单批量生成', samples:'220K', quality:96.4, created:'2026-08-12 10:50:00', consumers:['TASK-20260812-0062'] },
    { id:'D1V2', version:'V2', note:'隐私处理后的运单数据', source:'TASK-20260810-0112', sourceName:'运单隐私优化', samples:'180K', quality:94.8, created:'2026-08-10 16:20:00', consumers:['TASK-20260812-0048'] },
    { id:'D1V1', version:'V1', note:'首批运单生成结果', source:'TASK-20260808-0016', sourceName:'华东区运单初始生成', samples:'120K', quality:91.2, created:'2026-08-08 09:30:00', consumers:['TASK-20260810-0112'] }
  ]},
  { id:2, name:'报关单数据集', modality:'文档图像', businessType:'报关单', status:'可用', desc:'报关字段、表格、金额及贸易术语样本。', defaultVersion:'V3', totalSamples:'286K', reference:true, versions:[
    { id:'D2V3', version:'V3', note:'覆盖短板定向扩增结果', source:'TASK-20260812-0039', sourceName:'报关单覆盖短板优化', samples:'126K', quality:93.8, created:'2026-08-12 12:10:00', consumers:[] },
    { id:'D2V2', version:'V2', note:'统一字段结构后的数据', source:'TASK-20260809-0088', sourceName:'报关单格式优化', samples:'90K', quality:92.8, created:'2026-08-09 14:40:00', consumers:['TASK-20260812-0039'] },
    { id:'D2V1', version:'V1', note:'首批报关单生成结果', source:'TASK-20260807-0012', sourceName:'报关单初始生成', samples:'70K', quality:88.6, created:'2026-08-07 11:05:00', consumers:['TASK-20260809-0088'] }
  ]},
  { id:3, name:'物流客服多轮对话', modality:'对话文本', businessType:'异常反馈', status:'可用', desc:'咨询、信息收集、异常反馈与投诉售后对话。', defaultVersion:'V4', totalSamples:'430K', reference:true, versions:[
    { id:'D3V4', version:'V4', note:'隐私风险自动处理结果', source:'TASK-20260812-0027', sourceName:'投诉对话隐私优化', samples:'130K', quality:95.1, created:'2026-08-12 11:20:00', consumers:[] },
    { id:'D3V3', version:'V3', note:'异常反馈生成结果', source:'TASK-20260811-0141', sourceName:'异常反馈多轮对话生成', samples:'120K', quality:94.1, created:'2026-08-11 15:40:00', consumers:['TASK-20260812-0027'] },
    { id:'D3V2', version:'V2', note:'客户服务参考场景生成结果', source:'TASK-20260806-0025', sourceName:'客服多轮对话生成', samples:'100K', quality:92.0, created:'2026-08-06 10:15:00', consumers:['TASK-20260811-0141'] }
  ]},
  { id:4, name:'冷链温湿度时序集', modality:'时序数据', businessType:'传感器时序', status:'可用', desc:'多路线冷链温湿度序列与超温、骤冷事件。', defaultVersion:'V3', totalSamples:'180K', reference:true, versions:[
    { id:'D4V3', version:'V3', note:'异常事件生成结果', source:'TASK-20260811-0186', sourceName:'冷链温湿度异常序列生成', samples:'80K', quality:95.7, created:'2026-08-11 18:10:00', consumers:[] },
    { id:'D4V2', version:'V2', note:'清洗后的真实设备数据', source:'TASK-20260808-0042', sourceName:'温湿度完整性优化', samples:'60K', quality:93.2, created:'2026-08-08 13:00:00', consumers:['TASK-20260811-0186'] },
    { id:'D4V1', version:'V1', note:'首批冷链传感器生成结果', source:'TASK-20260805-0018', sourceName:'冷链温湿度初始生成', samples:'40K', quality:89.5, created:'2026-08-05 09:20:00', consumers:['TASK-20260808-0042'] }
  ]},
  { id:5, name:'车辆GPS轨迹集', modality:'时序数据', businessType:'GPS轨迹', status:'可用', desc:'车辆路线、速度、停留、偏航和急停事件。', defaultVersion:'V3', totalSamples:'100K', reference:true, versions:[
    { id:'D5V3', version:'V3', note:'偏航场景扩增结果', source:'TASK-20260811-0159', sourceName:'GPS偏航场景优化', samples:'45K', quality:92.8, created:'2026-08-11 17:30:00', consumers:[] },
    { id:'D5V2', version:'V2', note:'轨迹纠偏后数据', source:'TASK-20260807-0031', sourceName:'GPS质量优化', samples:'35K', quality:91.9, created:'2026-08-07 16:00:00', consumers:['TASK-20260811-0159'] },
    { id:'D5V1', version:'V1', note:'首批车辆轨迹生成结果', source:'TASK-20260804-0009', sourceName:'车辆GPS轨迹初始生成', samples:'20K', quality:87.4, created:'2026-08-04 08:50:00', consumers:['TASK-20260807-0031'] }
  ]}
];

initialDatasets.push({ id:6, name:'用户上传文档样例数据集', modality:'文档类图像', businessType:'报关单', status:'可用', desc:'用户上传并完成隐私检查与自动脱敏的数据集。系统仅保存脱敏后的数据。', defaultVersion:'A7F3C91D2E44', totalSamples:1280, reference:false, sourceType:'用户上传', templateId:'TPL-DOC-CUSTOMS-V1', templateVersion:'V1', updatedAt:'2026-09-04 10:30:00', versions:[{ id:'A7F3C91D2E44', version:'A7F3C91D2E44', note:'用户上传数据集首个脱敏版本', source:'UPLOAD-20260904-103000', sourceName:'用户上传与隐私脱敏', samples:1280, created:'2026-09-04 10:30:00', updatedAt:'2026-09-04 10:30:00', consumers:[], sourceType:'用户上传', templateId:'TPL-DOC-CUSTOMS-V1', templateVersion:'V1', privacyCheck:{status:'通过', checked:1280, desensitized:37, rules:['身份证号','手机号','地址']}, qualityReport:{status:'待质检', checkedSampleCount:0} }]});

const VERSION_ID_PATTERN = /^[0-9A-F]{12}$/;
const DATASET_ID_PATTERN = /^DATASET-\d{8}-\d{4}$/;

function numericSampleCount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const matches = [...String(value ?? '').replaceAll(',', '').matchAll(/(\d+(?:\.\d+)?)\s*([KkMm]?)/g)];
  return Math.round(matches.reduce((total, match) => {
    const multiplier = match[2]?.toLowerCase() === 'm' ? 1000000 : match[2]?.toLowerCase() === 'k' ? 1000 : 1;
    return total + Number(match[1]) * multiplier;
  }, 0));
}

function fixedHashId(seed) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (const character of String(seed)) {
    const code = character.charCodeAt(0);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ (code + 97), 0x85ebca6b) >>> 0;
  }
  return `${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`.slice(0, 12).toUpperCase();
}

function createVersionId(seed = `${Date.now()}-${Math.random()}`) {
  return fixedHashId(seed);
}

function createDatasetId(seed = `${Date.now()}-${Math.random()}`, dateValue = nowDateTime(), sequenceHint) {
  const dateMatch = String(dateValue || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  const date = dateMatch ? `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}` : '20260902';
  const numericHint = Number(sequenceHint);
  const sequence = Number.isInteger(numericHint) && numericHint >= 0 && numericHint <= 9999
    ? numericHint
    : parseInt(fixedHashId(seed).slice(0, 8), 16) % 10000;
  return `DATASET-${date}-${String(sequence).padStart(4, '0')}`;
}

function qualityStatusCounts(total, score) {
  const count = Math.max(0, numericSampleCount(total));
  const pass = Math.min(count, Math.round(count * Math.max(0, Math.min(100, Number(score) || 92)) / 100));
  const remaining = count - pass;
  const review = Math.round(remaining * 0.72);
  return { PASS: pass, REVIEW: review, REJECT: remaining - review };
}

function buildVersionQualityReport(modality, version) {
  if (version.qualityReport) return version.qualityReport;
  if (version.qualityChecked === false) return null;
  const storedConversationReport = modality === '对话文本' ? (version.qualityReport || {}) : {};
  const dataCount = numericSampleCount(version.samples);
  const checkedSampleCount = Math.min(dataCount, Math.max(0, numericSampleCount(version.checkedSampleCount ?? dataCount)));
  const uncheckedSampleCount = Math.max(0, dataCount - checkedSampleCount);
  const executionRange = uncheckedSampleCount > 0 ? 'sample' : 'full';
  const score = Number(version.quality);
  const averageScore = Number.isFinite(score) ? score : 92;
  const statusCounts = {...qualityStatusCounts(checkedSampleCount, averageScore), UNCHECKED: uncheckedSampleCount};
  if (modality === '文档图像') return {
    reportId: version.qualityReportId || `QREPORT-${fixedHashId(`${version.version}-document`)}`, kind: 'document', sampleCount: dataCount, checkedSampleCount, uncheckedSampleCount, executionRange, statusCounts,
    lowQualityCount: statusCounts.REVIEW + statusCounts.REJECT,
    ocrAverages: {
      cer: Math.max(0.018, Number(((100 - averageScore) / 100).toFixed(4))),
      fieldExactRate: Number(Math.min(.99, averageScore / 100).toFixed(4)),
      numericCodeAccuracy: Number(Math.min(.995, (averageScore + 2.1) / 100).toFixed(4)),
      detectionCoverage: Number(Math.min(.995, (averageScore + 1.2) / 100).toFixed(4)),
      meanRecognitionConfidence: Number(Math.min(.995, (averageScore + .8) / 100).toFixed(4)),
      lowConfidenceRate: Number(Math.max(.01, (100 - averageScore) / 125).toFixed(4)),
    },
    imageQuality: { brightness: 224.36, contrast: 61.82, sharpness: 318.45 },
    geometry: { validPolygonRate: .9987, bboxPolygonErrorPx: .42, reprojectionRmsePx: .0061, outOfBoundsRate: .0012, fieldHeightP10Px: 17.8, fieldHeightMedianPx: 24.6 },
    privacy: { initialRiskCount: Math.max(1, Math.round(checkedSampleCount * .003)), maskedCount: Math.max(1, Math.round(checkedSampleCount * .003)), residualRiskCount: 0 },
    coverageGaps: executionRange==='full'?[{key:'doc-shadow',dimension:'拍摄场景',label:'强阴影',pass:86,target:180,gap:94},{key:'doc-fold',dimension:'文档退化',label:'折痕遮挡',pass:62,target:150,gap:88},{key:'doc-stamp',dimension:'印章类型',label:'骑缝章',pass:35,target:100,gap:65}]:[],
  };
  if (modality === '对话文本') return {
    reportId: version.qualityReportId || `QREPORT-${fixedHashId(`${version.version}-conversation`)}`, kind: 'conversation', sampleCount: dataCount, checkedSampleCount, uncheckedSampleCount, executionRange, statusCounts, averageScore,
    schemaValidRate: .996, stateLegalRate: .973, toolAccuracyRate: .961, evidenceResolvableRate: .982, roleStableRate:.987, nonDuplicateRate:.954,
    ...storedConversationReport,
    categorySummary: [
      {key:'base',label:'基础质检',ruleCount:9,pass:checkedSampleCount,review:0,reject:0},
      {key:'statistics',label:'基础统计',ruleCount:3,info:checkedSampleCount},
      {key:'privacy',label:'隐私质检',ruleCount:5,pass:checkedSampleCount,review:0,reject:0},
      {key:'business',label:'业务契约质检',ruleCount:7,pass:Math.max(0,checkedSampleCount-statusCounts.REVIEW),review:statusCounts.REVIEW,reject:0},
      {key:'custom',label:'自定义质检',ruleCount:8,pass:statusCounts.PASS,review:statusCounts.REVIEW,reject:statusCounts.REJECT},
    ],
    basicStatistics: [
      {key:'whole',scope:'整段对话',charsAvg:342,charsP95:618,wordsAvg:208,longSentenceRate:.023},
      {key:'user',scope:'User 消息',charsAvg:126,charsP95:248,wordsAvg:76,longSentenceRate:.011},
      {key:'assistant',scope:'Assistant 消息',charsAvg:216,charsP95:405,wordsAvg:132,longSentenceRate:.031},
    ],
    ragMetrics: {contextRelevancy:8.7,answerRelevancy:8.9,faithfulness:9.1,threshold:7},
    evaluatorErrors: [],
    privacy: { initialRiskCount: Math.max(1, Math.round(checkedSampleCount * .004)), maskedCount: Math.max(1, Math.round(checkedSampleCount * .004)), residualRiskCount: 0, typeCounts:{手机号:1,业务标识:1,凭据:0},rawValueExported:false, ...(storedConversationReport.privacy||{}) },
    coverageGaps: executionRange==='full'?[{key:'conv-angry',dimension:'用户情绪',label:'强烈不满',pass:120,target:260,gap:140},{key:'conv-evidence',dimension:'信息完整度',label:'缺少物流凭证',pass:75,target:160,gap:85},{key:'conv-path',dimension:'状态路径',label:'升级人工处理',pass:48,target:120,gap:72}]:[],
  };
  return {
    reportId: version.qualityReportId || `QREPORT-${fixedHashId(`${version.version}-timeseries`)}`, kind: 'timeseries', shipmentCount: dataCount, checkedSampleCount, uncheckedSampleCount, executionRange, statusCounts, averageScore,
    coverageScore: Number(Math.min(100, averageScore + .9).toFixed(1)), lowQualityCount: statusCounts.REVIEW + statusCounts.REJECT,
    dimensionScores: { contract: 99, temporal: 97, physical: 96, geospatial: 94, ground_truth: 95, privacy: 100, template_rules: 98, coverage_labels: 93 },
    units: { temperature: '摄氏度（°C）', sampleIntervalMinutes: 60, humidity: '%RH' },
    privacy: { checkedSampleCount, failedSampleCount: 0, statusCounts: { PASS: checkedSampleCount, UNCHECKED: uncheckedSampleCount } },
    coverageGaps: executionRange==='full'?[{key:'ts-overheat',dimension:'异常事件',label:'持续超温',pass:38,target:120,gap:82},{key:'ts-offline',dimension:'异常事件',label:'计划性断网',pass:26,target:90,gap:64},{key:'ts-route',dimension:'参数形态',label:'GPS 偏航后回归',pass:44,target:110,gap:66}]:[],
  };
}

function isQualityCheckedVersion(version) {
  if(!published(version))return false;
  return qualityReports(version).some(report=>Number(report.checkedSampleCount||report.statusCounts?.PASS||report.statusCounts?.FAIL||report.statusCounts?.REJECT||0)>0);

}

function isFullQualityVersion(version) {
  if(!published(version))return false;
  return Boolean(!version?.qualityReport?.statusCounts?.ERROR&&!version?.qualityReport?.statusCounts?.UNCHECKED&&version?.qualityReport&&version?.sampleQualityLabels&&(version.qualityReport.executionRange||'full')==='full'&&(version.sampleQualityLabels.coverage||'full')==='full');
}

function normalizeDownstreamTask(value, datasetName, updatedAt, index) {
  if (value && typeof value === 'object') return {
    id: value.id,
    name: value.name || `${datasetName}${value.taskType || '数据质检'}任务`,
    taskType: value.taskType || '数据质检',
    updatedAt: formatDateTime(value.updatedAt || value.created || updatedAt),
    status: value.status || '已完成',
  };
  const linkedTask = initialTasks.find(task => task.id === value);
  const inferredType = linkedTask?.taskType || (linkedTask?.stages?.includes('定向扩增') ? '定向扩增' : linkedTask?.stages?.includes('增强') ? '数据增强' : '数据质检');
  return { id: String(value), name: linkedTask?.name || `${datasetName}${inferredType}任务`, taskType: inferredType, updatedAt: formatDateTime(linkedTask?.updated || linkedTask?.created || updatedAt), status: linkedTask?.status || '已完成', key: `${value}-${index}` };
}

function normalizeDatasets(items) {
  return (Array.isArray(items) ? items : []).filter(dataset=>!isRetiredGpsDataset(dataset)).map((dataset, datasetIndex) => {
    if (dataset.businessType === '报关单' && dataset.name === '报关单与合同数据集') dataset = { ...dataset, name: '报关单数据集' };
    const rawVersions = Array.isArray(dataset.versions) ? dataset.versions : [];
    const rawDatasetId = String(dataset.id ?? '');
    const datasetDate = dataset.updatedAt || rawVersions[0]?.updatedAt || rawVersions[0]?.created || nowDateTime();
    const datasetId = DATASET_ID_PATTERN.test(rawDatasetId)
      ? rawDatasetId
      : createDatasetId(`${rawDatasetId}-${dataset.name}-${datasetIndex}`, datasetDate, /^\d+$/.test(rawDatasetId) ? Number(rawDatasetId) : undefined);
    const versionIds = rawVersions.map((version, versionIndex) => VERSION_ID_PATTERN.test(String(version.version || ''))
      ? String(version.version)
      : createVersionId(`${datasetId}-${version.id || version.version}-${version.source || versionIndex}`));
    const template = templateForDataset(dataset);
    const versions = rawVersions.map((version, versionIndex) => {
      const updatedAt = formatDateTime(version.updatedAt || version.created);
      const versionId = versionIds[versionIndex];
      const qualityChecked = version.qualityChecked === false ? false : Boolean(version.qualityReport || version.sampleQualityLabels || version.quality !== undefined);
      const normalized = {
        ...version,
        id: versionId,
        version: versionId,
        note: version.note || version.description || '-',
        samples: numericSampleCount(version.samples),
        updatedAt,
        created: formatDateTime(version.created || version.updatedAt),
        source: version.source || 'UPLOAD',
        sourceName: version.sourceName || '用户上传',
        versionKind: version.versionKind || (String(version.source||'').startsWith('UPLOAD-') ? '上传脱敏' : versionIndex===rawVersions.length-1 ? '合成' : '质检标注'),
        templateId: version.templateId || dataset.templateId || template?.id,
        templateVersion: version.templateVersion || dataset.templateVersion || template?.version,
        sourceDatasetId: version.sourceDatasetId || (versionIndex < versionIds.length-1 ? datasetId : null),
        sourceVersionId: version.sourceVersionId || (versionIndex < versionIds.length-1 ? versionIds[versionIndex+1] : null),
        qualityChecked,
        checkedSampleCount: version.checkedSampleCount,
      };
      normalized.consumers = (version.consumers || []).map((task, index) => normalizeDownstreamTask(task, dataset.name, updatedAt, index));
      normalized.qualityReport = qualityChecked ? buildVersionQualityReport(dataset.modality, normalized) : null;
      normalized.qualityReportId = normalized.qualityReport?.reportId || version.qualityReportId || null;
      normalized.sampleQualityLabels = qualityChecked ? (version.sampleQualityLabels || {schemaVersion:'sample-quality/v1',coverage:'full',fields:['rule_results','issue_labels']}) : null;
      normalized.fullQualityChecked = isFullQualityVersion(normalized);
      if(normalized.qualityReport)normalized.qualityReport={...normalized.qualityReport,inputVersionId:normalized.sourceVersionId||normalized.version,outputVersionId:normalized.version,templateId:normalized.templateId,templateVersion:normalized.templateVersion,ruleSnapshot:normalized.qualityReport.ruleSnapshot||TEMPLATE_QUALITY_RULES[dataset.modality]||[]};
      return normalized;
    });
    const defaultRaw = rawVersions.find(version => version.version === dataset.defaultVersion || version.id === dataset.defaultVersion);
    const defaultIndex = defaultRaw ? rawVersions.indexOf(defaultRaw) : 0;
    return {
      ...dataset,
      id: datasetId,
      sourceType: dataset.sourceType || '任务生成',
      templateId: dataset.templateId || template?.id,
      templateVersion: dataset.templateVersion || template?.version,
      totalSamples: versions.some(v=>v.publicationStatus)?versions.filter(published).reduce((sum,v)=>sum+numericSampleCount(v.samples),0):numericSampleCount(dataset.totalSamples) || versions.reduce((sum, version) => sum + numericSampleCount(version.samples), 0),
      defaultVersion: versions[defaultIndex]?.version || versions[0]?.version || '-',
      updatedAt: formatDateTime(dataset.updatedAt || versions[0]?.updatedAt),
      versions,
    };
  });
}

const businessTypeMap = {
  文档图像:['运单','报关单','合同'],
  对话文本:['智能客服多轮对话'],
  时序数据:['GPS轨迹','传感器时序']
};

function StatusTag({ value }) {
  if(value==='部分完成')value='已完成';
  return <Tag color={value==='可用'||value==='已完成'?'green':value==='失败'?'red':value==='运行中'?'blue':value==='排队中'?'gold':'default'}>{value}</Tag>;
}

function StageTags({ stages=[] }) {
  return <Space size={[0,4]} wrap>{stages.map(s=><Tag key={s} color={stageColor[s]}>{s}</Tag>)}</Space>;
}

const customsStageMeta = {
  queued: ['排队', 'gray'], generating: ['数据合成', 'blue'], quality_checking: ['质检', 'purple'],
  expanding: ['扩增', 'orange'], rechecking: ['复检', 'cyan'], completed: ['完成', 'green'], failed: ['失败', 'red'],
};
const customsStageOrder = ['queued', 'generating', 'quality_checking', 'expanding', 'rechecking', 'completed'];
const stampLabels = {customs_review:'海关审核合成章',broker_declaration:'报关公司报关合成章',broker_company:'报关公司企业合成公章'};

function CustomsSubmissionSummary({ form }) {
  const values=form.getFieldsValue(true);
  const resolution=values.enableBackgroundDiffusion?`${values.outputWidth||2480}×${values.outputHeight||1754}`:'未启用拍照背景';
  const stamps=values.enableStamps?(values.stampProfiles||[]).map(item=>stampLabels[item]||item).join('、'):'未启用';
  return <>
    <Alert type="info" showIcon message="点击“提交任务”后创建报关单 Mock 任务" description="提交成功后自动返回文档类图像任务列表，新任务显示在第一行，并提供生成、质检、扩增和复检的模拟日志。"/>
    <Descriptions bordered size="small" column={2} className="section-title" items={[
      {key:'template',label:'模板',children:values.customsTemplateId==='customs_import_standard_v1'?'进口报关单标准模板 V1':values.customsTemplateId||'-'},
      {key:'count',label:'生成图片数',children:`${values.count||0} 张`},
      {key:'seed',label:'随机种子',children:values.seed||'-'},
      {key:'stamp',label:'合成章',children:stamps||'未选择'},
      {key:'privacy',label:'隐私保护',children:values.enablePrivacy?`已启用 · ${(values.privacyFields||[]).length} 个字段`:'未启用'},
      {key:'text',label:'Qwen文本',children:values.enableQwenText?'已启用':'未启用'},
      {key:'augment',label:'本地增强',children:'Augraphy + Albumentations'},
      {key:'background',label:'拍照背景',children:values.enableBackgroundDiffusion?'已启用':'未启用'},
      {key:'resolution',label:'正式成品尺寸',children:resolution},
      {key:'scale',label:'原始内容占比',children:values.enableBackgroundDiffusion?`${values.documentContentPercent||94}%`:'-'},
      {key:'qc',label:'本地质检',children:values.runQc?'PP-OCRv5 已启用':'未启用'},
      {key:'expansion',label:'定向扩增',children:values.runQc&&values.enableExpansion?`最多新增 ${values.maxNewImages||0} 张`:'未启用'},
    ]}/>
  </>;
}

function CustomsTaskInformation({ task }) {
  const job=task.backendJob||{};
  const values=task.configSnapshot||{};
  const params=job.parameters||{};
  const stamps=values.enableStamps===false||params.enable_stamps===false?'未启用':((values.stampProfiles||params.stamp_profiles||[]).map(item=>stampLabels[item]||item).join('、')||'未记录');
  const privacyEnabled=values.enablePrivacy??params.enable_privacy;
  const backgroundEnabled=values.enableBackgroundDiffusion??params.enable_background_diffusion;
  const qcEnabled=values.runQc??params.run_qc;
  const expansionEnabled=values.enableExpansion??params.enable_expansion;
  return <>
    <Descriptions bordered size="small" column={2} className="detail-descriptions" items={[
      {key:'id',label:'任务ID',children:task.id},{key:'status',label:'状态',children:<StatusTag value={task.status}/>},
      {key:'stage',label:'当前节点',children:task.currentStage},{key:'created',label:'创建时间',children:task.created},
      {key:'input',label:'输入',children:task.input},{key:'output',label:'输出',children:task.output},
      {key:'path',label:'模拟产物目录',span:2,children:job.storage_path?<Text copyable>{job.storage_path}</Text>:'任务创建后由 Mock 分配'},
    ]}/>
    <Divider orientation="left">配置快照</Divider>
    <Descriptions bordered size="small" column={2} items={[
      {key:'template',label:'模板',children:values.customsTemplateId==='customs_import_standard_v1'?'进口报关单标准模板 V1':values.customsTemplateId||'历史默认模板'},
      {key:'count',label:'生成图片数',children:`${values.count??params.count??'-'} 张`},
      {key:'seed',label:'随机种子',children:values.seed??params.seed??'-'},
      {key:'stamps',label:'合成章',children:stamps},
      {key:'privacy',label:'隐私保护',children:privacyEnabled?`已启用 · ${(values.privacyFields||Object.keys(params.privacy_field_strategies||{})).length} 个字段`:'未启用'},
      {key:'text',label:'Qwen文本',children:(values.enableQwenText??params.enable_qwen_text)?'已启用':'未启用'},
      {key:'augment',label:'本地增强',children:'Augraphy + Albumentations'},
      {key:'background',label:'拍照背景',children:backgroundEnabled?'已启用':'未启用'},
      {key:'resolution',label:'正式成品尺寸',children:backgroundEnabled?`${values.outputWidth??params.output_width??2480}×${values.outputHeight??params.output_height??1754}`:'未启用拍照背景'},
      {key:'scale',label:'原始内容占比',children:backgroundEnabled?`${values.documentContentPercent??Math.round(Number(params.document_content_scale||0.94)*100)}%`:'-'},
      {key:'qc',label:'PP-OCRv5质检',children:qcEnabled?'已启用':'未启用'},
      {key:'vlm',label:'VLM复核',children:(values.enableVlmReview??params.enable_vlm_review)?'已启用':'未启用'},
      {key:'expansion',label:'定向扩增',children:expansionEnabled?`已启用 · 最多 ${values.maxNewImages??params.max_new_images??0} 张`:'未启用'},
      {key:'write',label:'结果写入',children:values.outputMode==='newVersion'?`${values.targetDataset||'-'} / 新版本`:`${values.outputDatasetName||task.output||'-'} / 新数据集`},
    ]}/>
  </>;
}

function CustomsTaskLogs({ task }) {
  const job=task.backendJob||{};
  const events=job.events||[];
  const currentStatus=job.status||job.stage||'queued';
  const currentIndex=currentStatus==='failed'?Math.max(0,customsStageOrder.indexOf(job.stage)):Math.max(0,customsStageOrder.indexOf(currentStatus));
  return <>
    <Alert type={job.status==='failed'?'error':job.status==='completed'?'success':'info'} showIcon message={`当前执行：${job.message||task.currentStage||'等待资源'}`} description={job.error||`进度 ${Number(job.progress)||0}% · 日志随任务状态自动更新`}/>
    <Progress className="section-title" percent={Number(job.progress)||0} status={job.status==='failed'?'exception':job.status==='completed'?'success':'active'}/>
    <Steps size="small" responsive={false} current={currentIndex} status={job.status==='failed'?'error':'process'} items={customsStageOrder.map(key=>({title:customsStageMeta[key][0]}))}/>
    <Divider orientation="left">运行日志明细</Divider>
    {events.length?<Timeline className="customs-log-timeline" items={[...events].reverse().map((event,index)=>({
      color:customsStageMeta[event.status]?.[1]||'gray',
      children:<div><Flex justify="space-between" gap={12}><Text strong>{customsStageMeta[event.status]?.[0]||event.status}</Text><Text type="secondary">{formatDateTime(event.time)}</Text></Flex><Paragraph type="secondary">{event.message}</Paragraph></div>,
      key:`${event.time||index}-${event.status}`,
    }))}/>:<Empty description="Mock 尚未写入阶段日志"/>}
  </>;
}

const coldChainStageMeta = {
  queued:['排队','gray'], generating:['数据生成与模块执行','blue'],
  quality_checking:['结果汇总','purple'], completed:['完成','green'], failed:['失败','red'],
};
const coldChainStageOrder = ['queued','generating','quality_checking','completed'];

function ColdChainTaskInformation({ task }) {
  const job=task.backendJob||{};
  const values=task.configSnapshot||{};
  const params=job.parameters||{};
  const augmentation=values.enableAugmentation??params.augmentation?.enabled;
  const privacy=values.enablePrivacy??params.privacy_policy?.enabled;
  const quality=values.enableQuality??params.enable_quality;
  const expansion=values.enableExpansion??params.enable_expansion;
  const selected=values.parameters||params.parameters||[];
  return <>
    <Descriptions bordered size="small" column={2} className="detail-descriptions" items={[
      {key:'id',label:'任务ID',children:<Text copyable>{task.id}</Text>},{key:'status',label:'状态',children:<StatusTag value={task.status}/>},
      {key:'stage',label:'当前节点',children:task.currentStage},{key:'created',label:'创建时间',children:task.created},
      {key:'input',label:'输入模板',children:task.input},{key:'output',label:'输出数据集',children:task.output},
      {key:'path',label:'模拟产物目录',span:2,children:job.storage_path?<Text copyable>{job.storage_path}</Text>:'任务创建后由 Mock 分配'},
    ]}/>
    <Divider orientation="left">配置快照</Divider>
    <Descriptions bordered size="small" column={2} items={[
      {key:'template',label:'关联模板',children:values.coldchainTemplateName||params.template_id||'-'},
      {key:'count',label:'生成票数',children:`${values.count??params.count??'-'} 票`},
      {key:'seed',label:'随机种子',children:values.seed??params.seed??'-'},
      {key:'interval',label:'采样间隔',children:`每 ${values.sampleIntervalMinutes??params.sample_interval_minutes??60} 分钟`},
      {key:'model',label:'生成模型',children:values.modelAlias||params.model_alias||'qwen3-14b'},
      {key:'fields',label:'输出参数',children:selected.length?`${selected.length} 项`:'未记录'},
      {key:'augmentation',label:'数据增强',children:augmentation?`已启用 · 最多新增 ${values.augmentationMaxNew??params.augmentation?.max_new??0} 票`:'未启用'},
      {key:'privacy',label:'隐私保护',children:privacy?'已启用':'未启用'},
      {key:'quality',label:'质检',children:quality===false?'未启用':'已启用'},
      {key:'privacyQc',label:'隐私质检',children:(values.privacyCheckEnabled??params.privacy_check_enabled)!==false?'已启用':'未启用'},
      {key:'expansion',label:'定向扩增',children:expansion?`已启用 · 最多新增 ${values.maxExpansionCount??params.max_expansion_count??0} 票`:'未启用'},
      {key:'write',label:'结果写入',children:values.outputMode==='newVersion'?`${values.targetDataset||'-'} / 新版本`:`${values.outputDatasetName||task.output||'-'} / 新数据集`},
    ]}/>
  </>;
}

function ColdChainTaskLogs({ task }) {
  const job=task.backendJob||{};
  const events=job.events||[];
  const currentStatus=job.status||job.stage||'queued';
  const currentIndex=currentStatus==='failed'?Math.max(0,coldChainStageOrder.indexOf(job.stage)):Math.max(0,coldChainStageOrder.indexOf(currentStatus));
  return <>
    <Alert type={job.status==='failed'?'error':job.status==='completed'?'success':'info'} showIcon message={`当前执行：${job.message||task.currentStage||'等待资源'}`} description={job.error||`进度 ${Number(job.progress)||0}% · 日志随任务状态自动更新`}/>
    <Progress className="section-title" percent={Number(job.progress)||0} status={job.status==='failed'?'exception':job.status==='completed'?'success':'active'}/>
    <Steps size="small" responsive={false} current={currentIndex} status={job.status==='failed'?'error':'process'} items={coldChainStageOrder.map(key=>({title:coldChainStageMeta[key][0]}))}/>
    <Divider orientation="left">运行日志明细</Divider>
    {events.length?<Timeline className="customs-log-timeline" items={[...events].reverse().map((event,index)=>({
      color:coldChainStageMeta[event.status]?.[1]||'gray',
      children:<div><Flex justify="space-between" gap={12}><Text strong>{coldChainStageMeta[event.status]?.[0]||event.status}</Text><Text type="secondary">{formatDateTime(event.time)}</Text></Flex><Paragraph type="secondary">{event.message}</Paragraph></div>,
      key:`${event.time||index}-${event.status}`,
    }))}/>:<Empty description="Mock 尚未写入阶段日志"/>}
  </>;
}

function PageHeader({ title, description, actions }) {
  return <Flex justify="space-between" align="flex-start" className="page-header"><div><Title level={3}>{title}</Title><Text type="secondary">{description}</Text></div><Space>{actions}</Space></Flex>;
}

function StatCards({ items }) {
  return null;
}

function ReferenceExampleForm({ modality, form, datasets }) {
  const enabled=Form.useWatch('useReference',form);
  const mode=Form.useWatch('referenceMode',form);
  const versionOptions=datasets.filter(d=>d.modality===modality).flatMap(d=>d.versions.map(v=>({label:`${d.name} / ${v.version}`,value:`${d.name} / ${v.version}`})));
  return <>
    <Form.Item name="useReference" label="使用参考样例" valuePropName="checked"><Switch checkedChildren="使用" unCheckedChildren="不使用"/></Form.Item>
    {!enabled?<Alert type="info" showIcon message="系统将仅根据业务规则和本次参数生成数据。"/>:<>
      <Form.Item name="referenceMode" label="参考样例来源"><Radio.Group optionType="button" buttonStyle="solid" options={[{label:'选择数据集版本',value:'dataset'},{label:'临时上传',value:'upload'}]}/></Form.Item>
      {mode==='upload'?<Form.Item name="referenceFiles" label="上传参考样例"><Upload beforeUpload={()=>false} maxCount={10}><Button icon={<CloudUploadOutlined/>}>选择文件</Button></Upload></Form.Item>:<Form.Item name="referenceVersion" label="选择数据集版本"><Select placeholder="请选择选择数据集版本" showSearch optionFilterProp="label" options={versionOptions}/></Form.Item>}
      <Divider orientation="left">参考约束</Divider>
      <Alert type="success" showIcon message="系统将自动执行格式预检、隐私扫描和参考约束提取。"/>
      <Row gutter={16}><Col span={12}><Form.Item label="内容参考强度"><Slider marks={{0:'不参考',50:'适度',100:'严格'}} defaultValue={60}/></Form.Item></Col><Col span={12}><Form.Item label="形式参考强度"><Slider marks={{0:'不参考',50:'适度',100:'严格'}} defaultValue={70}/></Form.Item></Col></Row>
    </>}
  </>;
}

function GenerationParameters({ modality, businessType }) {
  if(modality==='文档图像') return <Row gutter={16}>
    <Col span={12}><Form.Item label="文档类型"><Input value={businessType} disabled/></Form.Item></Col>
    <Col span={12}><Form.Item label="版式变体"><Select placeholder="请选择版式变体" defaultValue="标准版式" options={['标准版式','紧凑版式','多页版式'].map(v=>({label:v,value:v}))}/></Form.Item></Col>
    <Col span={12}><Form.Item label="字段完整度"><Slider defaultValue={95} marks={{80:'80%',100:'100%'}}/></Form.Item></Col>
    <Col span={12}><Form.Item label="业务异常比例"><InputNumber placeholder="请输入业务异常比例（0～100）" min={0} max={100} defaultValue={10} addonAfter="%"/></Form.Item></Col>
  </Row>;
  if(modality==='对话文本') return <Row gutter={16}>
    <Col span={12}><Form.Item label="对话场景"><Checkbox.Group defaultValue={['异常反馈']} options={['咨询问答','信息收集','异常反馈']}/></Form.Item></Col>
    <Col span={12}><Form.Item label="角色"><Checkbox.Group defaultValue={['客户','客服']} options={['客户','客服','调度员','司机']}/></Form.Item></Col>
    <Col span={12}><Form.Item label="轮次范围"><Select placeholder="请选择轮次范围" defaultValue="6-10轮" options={['3-5轮','6-10轮','11-15轮'].map(v=>({label:v,value:v}))}/></Form.Item></Col>
    <Col span={12}><Form.Item label="表达风格"><Select placeholder="请选择表达风格" defaultValue="自然口语" options={['正式规范','自然口语','简短直接'].map(v=>({label:v,value:v}))}/></Form.Item></Col>
  </Row>;
  if(businessType==='GPS轨迹') return <Row gutter={16}>
    <Col span={12}><Form.Item label="路线范围"><Select placeholder="请选择路线范围" defaultValue="城市配送" options={['城市配送','城际运输','长途干线'].map(v=>({label:v,value:v}))}/></Form.Item></Col>
    <Col span={12}><Form.Item label="采样频率"><Select placeholder="请选择采样频率" defaultValue="每30秒" options={['每10秒','每30秒','每1分钟'].map(v=>({label:v,value:v}))}/></Form.Item></Col>
    <Col span={12}><Form.Item label="偏航事件比例"><InputNumber placeholder="请输入偏航事件比例（0～100）" min={0} max={100} defaultValue={8} addonAfter="%"/></Form.Item></Col>
    <Col span={12}><Form.Item label="停留事件"><Switch defaultChecked/></Form.Item></Col>
  </Row>;
  return <Row gutter={16}>
    <Col span={12}><Form.Item label="传感器类型"><Checkbox.Group defaultValue={['温度','湿度']} options={['温度','湿度','振动']}/></Form.Item></Col>
    <Col span={12}><Form.Item label="生成方式"><Select placeholder="请选择生成方式" defaultValue="独立生成" options={['独立生成','关联已有GPS轨迹'].map(v=>({label:v,value:v}))}/></Form.Item></Col>
    <Col span={12}><Form.Item label="采样频率"><Select placeholder="请选择采样频率" defaultValue="每5分钟" options={['每1分钟','每5分钟','每10分钟'].map(v=>({label:v,value:v}))}/></Form.Item></Col>
    <Col span={12}><Form.Item label="异常事件"><Checkbox.Group defaultValue={['超温']} options={['超温','骤冷','冲击','设备离线']}/></Form.Item></Col>
  </Row>;
}

function OutputConfig({ form, datasets, modality }) {
  const mode=Form.useWatch('outputMode',form)||'newDataset';
  const options=datasets.filter(d=>d.modality===modality).map(d=>({label:`${d.name}（当前${d.defaultVersion}，共${d.versions.length}个版本）`,value:d.name}));
  return <>
    <Form.Item name="outputMode" label="结果写入方式"><Radio.Group optionType="button" buttonStyle="solid" options={[{label:'创建新数据集',value:'newDataset'},{label:'写入已有数据集的新版本',value:'newVersion'}]}/></Form.Item>
    {mode==='newDataset'?<Row gutter={16}><Col span={12}><Form.Item name="outputDatasetName" label="数据集名称" rules={[{required:true}]}><Input placeholder="请输入新数据集名称"/></Form.Item></Col><Col span={12}><Form.Item name="versionNote" label="版本描述" rules={[{required:true}]}><Input placeholder="说明本批数据的业务含义"/></Form.Item></Col></Row>:<Row gutter={16}><Col span={12}><Form.Item name="targetDataset" label="目标数据集" rules={[{required:true}]}><Select placeholder="请选择目标数据集" options={options}/></Form.Item></Col><Col span={12}><Form.Item name="versionNote" label="版本描述" rules={[{required:true}]}><Input placeholder="说明本次输出与业务用途"/></Form.Item></Col></Row>}
    <Alert type="info" showIcon message="结果会形成独立且不可编辑的数据快照，并记录来源任务、来源版本和模板快照。"/>
  </>;
}

const CUSTOMS_EVALUATION_FIELDS = {
  quality: ['CER（字符错误率）','字段完全一致率','数字代码准确率','bbox / polygon 重投影有效率','字段高度 P10 / 中位数','图片质量分档','PASS / REVIEW / REJECT'],
  privacy: ['境内收货人','境外发货人','消费使用单位','申报单位','报关人员姓名及证号','联系电话','货物存放地点','业务唯一编号','条形码 / 二维码','印章图案'],
  coverage: ['报关业务字段覆盖','国家/地区与币制代码覆盖','口岸/关区与监管方式覆盖','HS商品与计量单位覆盖','合成章类型覆盖','拍照/扫描场景覆盖','折痕/污渍/阴影覆盖','透视/压缩/低可读性覆盖'],
};

function CustomsEvaluationConfiguration({ form, scopes }) {
  const enableQualityVlm=Form.useWatch('evaluationQualityVlm',form);
  const enablePrivacyVlm=Form.useWatch('evaluationPrivacyVlm',form);
  const enableCoverageVlm=Form.useWatch('evaluationCoverageVlm',form);
  return <>
    {scopes.includes('质量评估')&&<Card size="small" title="质量评估字段" className="section-title" extra={<Tag color="green">PP-OCRv5 本地执行</Tag>}>
      <Checkbox.Group value={CUSTOMS_EVALUATION_FIELDS.quality} options={CUSTOMS_EVALUATION_FIELDS.quality} disabled/>
      <Row gutter={16} className="section-title">
        <Col span={8}><ModelConfigField><Form.Item name="evaluationOcrModel" label="OCR模型"><Select placeholder="请选择OCR模型" options={[{value:'pp-ocrv5-local',label:'PP-OCRv5（本地CPU）'}]}/></Form.Item></ModelConfigField></Col>
        <Col span={8}><Form.Item name="evaluationPassThreshold" label="质量通过门槛"><Select placeholder="请选择质量通过门槛" options={[{value:70,label:'宽松（70分）'},{value:80,label:'标准（80分）'},{value:90,label:'严格（90分）'}]}/></Form.Item></Col>
        <Col span={8}><Form.Item name="evaluationSampleRange" label="评估样本范围"><Select placeholder="请选择评估样本范围" options={['全部数据','随机抽样20%','分层抽样'].map(value=>({value,label:value}))}/></Form.Item></Col>
      </Row>
      <Descriptions bordered size="small" column={4} items={[{key:'cer',label:'CER上限',children:'≤ 0.05'},{key:'exact',label:'字段完全一致率',children:'≥ 90%'},{key:'code',label:'数字代码准确率',children:'≥ 95%'},{key:'polygon',label:'polygon有效率',children:'≥ 99.5%'},{key:'p10',label:'字段高度P10',children:'≥ 16px'},{key:'median',label:'字段高度中位数',children:'≥ 20px'},{key:'grade',label:'图片质量',children:'清晰/可用/低质'},{key:'decision',label:'最终判定',children:'PASS/REVIEW/REJECT'}]}/>
      <Flex justify="space-between" align="center" className="section-title"><div><Text strong>启用 Qwen-VL 第二路复核</Text><div><Text type="secondary">检查遮挡、版式异常和整体可读性，只允许降级本地结论。</Text></div></div><Form.Item name="evaluationQualityVlm" valuePropName="checked" noStyle><Switch/></Form.Item></Flex>
      {enableQualityVlm&&<ModelConfigField><Form.Item name="evaluationQualityVlmModel" label="VLM模型"><Select placeholder="请选择VLM模型" options={[{value:'qwen3-vl-8b-instruct',label:'Qwen3-VL-8B-Instruct'}]}/></Form.Item></ModelConfigField>}
    </Card>}
    {scopes.includes('隐私评估')&&<Card size="small" title="隐私评估字段" className="section-title">
      <Form.Item name="evaluationPrivacyFields" label="检查字段"><Checkbox.Group options={CUSTOMS_EVALUATION_FIELDS.privacy}/></Form.Item>
      <Alert type="info" showIcon message="隐私评估只标记低质样本" description="通过结构化字段契约、格式规则、机器码和图案检查判断是否仍含不安全内容；不在原样本上二次处理。"/>
      <Flex justify="space-between" align="center" className="section-title"><div><Text strong>启用 VLM 图像隐私复核</Text><div><Text type="secondary">用于检查印章、码区及文字图像中疑似未替换内容。</Text></div></div><Form.Item name="evaluationPrivacyVlm" valuePropName="checked" noStyle><Switch/></Form.Item></Flex>
      {enablePrivacyVlm&&<ModelConfigField><Form.Item name="evaluationPrivacyVlmModel" label="VLM模型"><Select placeholder="请选择VLM模型" options={[{value:'qwen3-vl-8b-instruct',label:'Qwen3-VL-8B-Instruct'}]}/></Form.Item></ModelConfigField>}
    </Card>}
    {scopes.includes('覆盖评估')&&<Card size="small" title="覆盖评估字段" className="section-title">
      <Form.Item name="evaluationCoverageFields" label="统计维度"><Checkbox.Group options={CUSTOMS_EVALUATION_FIELDS.coverage}/></Form.Item>
      <Alert type="info" showIcon message="优先统计合成时自带标签" description="业务字段、字典取值、增强算子和印章类型直接读取 manifest；无法从结构化标签获得的视觉场景，再由VLM按用户勾选标签补充打标。"/>
      <Flex justify="space-between" align="center" className="section-title"><div><Text strong>启用 VLM 视觉覆盖打标</Text><div><Text type="secondary">识别拍照、阴影、折痕、污渍、遮挡、透视和低可读性等视觉标签。</Text></div></div><Form.Item name="evaluationCoverageVlm" valuePropName="checked" noStyle><Switch/></Form.Item></Flex>
      {enableCoverageVlm&&<ModelConfigField><Form.Item name="evaluationCoverageVlmModel" label="VLM模型"><Select placeholder="请选择VLM模型" options={[{value:'qwen3-vl-8b-instruct',label:'Qwen3-VL-8B-Instruct'}]}/></Form.Item></ModelConfigField>}
    </Card>}
  </>;
}

function DocumentDirectionalExpansion({ form, standalone = false }) {
  const enabled=standalone||Boolean(Form.useWatch('enableAutoExpansion',form));
  return <>
    <Card size="small" title={standalone?'自动定向扩增':'自动定向扩增（可选）'} extra={standalone?<Tag color="green">已启用</Tag>:<Form.Item name="enableAutoExpansion" valuePropName="checked" noStyle><Switch/></Form.Item>}>
      <Paragraph type="secondary">根据质量、隐私和覆盖评估结果定位低质类型及覆盖短板，生成新的替代或补充样本；不修改输入版本中的原图片。</Paragraph>
      {!enabled?<Alert type="info" showIcon message="未启用：任务只输出评估报告，不生成新数据。"/>:<>
        <Alert type="success" showIcon message="已启用：仅针对命中的低质标签和覆盖不足标签补量，新增样本必须重新质检。"/>
        <Row gutter={16} className="section-title">
          <Col span={8}><Form.Item name="maxEvaluationExpansion" label="扩增上限" rules={[{required:true,message:'请配置扩增上限'}]}><InputNumber placeholder="请输入扩增上限（1～100000）" min={1} max={100000} addonAfter="张" style={{width:'100%'}}/></Form.Item></Col>
          <Col span={8}><ModelConfigField><Form.Item name="evaluationExpansionLlm" label="文字与字段生成模型"><Select placeholder="请选择文字与字段生成模型" options={[{value:'qwen3-14b-no-thinking',label:'Qwen3-14B（非思考模式）'}]}/></Form.Item></ModelConfigField></Col>
          <Col span={8}><ModelConfigField><Form.Item name="evaluationExpansionDiffusion" label="图像生成模型"><Select placeholder="请选择图像生成模型" options={[{value:'qwen-image-edit',label:'Qwen-Image-Edit'},{value:'none',label:'不调用图像生成模型，仅本地增强'}]}/></Form.Item></ModelConfigField></Col>
        </Row>
        <Form.Item name="evaluationExpansionTargets" label="允许扩增的目标类型"><Checkbox.Group options={['低质样本替代','业务字段覆盖补齐','代码表取值覆盖补齐','视觉场景覆盖补齐','隐私失败样本替代']}/></Form.Item>
      </>}
    </Card>
  </>;
}

function LegacyCreateTaskPage({ draft, datasets, onCancel, onSubmit }) {
  const [step,setStep]=useState(0); const [submitting,setSubmitting]=useState(false); const [form]=Form.useForm(); const [selectedBusinessType,setSelectedBusinessType]=useState(businessTypeMap[draft.modality][0]);
  const businessType=Form.useWatch('businessType',form)||selectedBusinessType;
  const evaluationScopes=Form.useWatch('evaluationScopes',form)||['质量评估'];
  const optimization=Form.useWatch('optimization',form)||[];
  const inputVersion=Form.useWatch('inputVersion',form);
  const enableAutoExpansion=Form.useWatch('enableAutoExpansion',form);
  const isGenerate=draft.taskType==='数据生成';
  const modalityLabel=modalityLabelMap[draft.modality]||draft.modality;
  const isSyntheticDocumentGenerate=isGenerate&&draft.modality==='文档图像';
  const isCustomsGenerate=isGenerate&&draft.modality==='文档图像'&&businessType==='报关单';
  const isColdChainGenerate=isGenerate&&draft.modality==='时序数据'&&businessType==='传感器时序';
  const isConversationGenerate=isGenerate&&draft.modality==='对话文本'&&businessType==='智能客服多轮对话';
  const isDocumentEvaluation=!isGenerate&&draft.modality==='文档图像';
  const selectedInputDataset=useMemo(()=>datasets.find(dataset=>dataset.versions.some(version=>`${dataset.name} / ${version.version}`===inputVersion)),[datasets,inputVersion]);
  useEffect(()=>{if(isDocumentEvaluation&&selectedInputDataset){setSelectedBusinessType(selectedInputDataset.businessType);form.setFieldsValue({businessType:selectedInputDataset.businessType,inputDatasetName:selectedInputDataset.name,targetDataset:selectedInputDataset.name,outputMode:'newVersion'});}},[form,isDocumentEvaluation,selectedInputDataset]);
  const stepTitles=isSyntheticDocumentGenerate?['模板选择','数据合成配置','数据增强配置','质检与扩增配置','结果写入']:isColdChainGenerate?['模板选择','数据生成配置','数据增强配置','质检与扩增','结果写入']:isConversationGenerate?['模板选择','数据生成配置','数据增强配置','质检与扩增','结果写入']:isGenerate?['业务与生成配置','参考样例','可选处理','小样预览','结果写入']:isDocumentEvaluation?['选择输入版本','评估配置','自动定向扩增','结果写入']:['选择输入版本','评估配置','自动优化','结果与提交'];
  const current=stepTitles[step];
  const versionOptions=datasets.filter(d=>d.modality===draft.modality).flatMap(d=>d.versions.map(v=>({label:`${d.name} / ${v.version} · ${v.samples}条`,value:`${d.name} / ${v.version}`,businessType:d.businessType,datasetName:d.name})));
  const next=async()=>{let fields=[];if(current==='业务与生成配置')fields=['businessType','count'];if(current==='模板选择')fields=isConversationGenerate?['conversationTemplateId','conversationTemplateVersion']:isColdChainGenerate?['businessType','coldchainTemplateId','coldchainTemplateVersion']:isSyntheticDocumentGenerate?['businessType','syntheticDocumentTemplateId','syntheticDocumentTemplateVersion']:['businessType','customsTemplateId'];if(current==='数据合成配置')fields=isSyntheticDocumentGenerate?['count','seed','outputResolutionMode']:['count','seed','stampProfiles'];if(current==='数据生成配置')fields=isColdChainGenerate?['count','seed','sampleIntervalMinutes','modelAlias','parameters']:['count','turnMin','turnMax','seed','provider','modelAlias'];if(current==='数据增强配置')fields=isColdChainGenerate?form.getFieldValue('enableAugmentation')?['augmentationMethods','augmentationRatio','augmentationIntensity','augmentationMaxNew']:[]:isConversationGenerate?(form.getFieldValue('enableAugmentation')?['augmentationMethods','augmentationRatio','augmentationMaxNew','augmentationModelAlias','augmentationTemperature']:[]):isSyntheticDocumentGenerate?[]:['outputWidth','outputHeight','documentContentPercent'];if(current==='质检与扩增配置'&&isCustomsGenerate&&!isSyntheticDocumentGenerate)fields=['maxNewImages'];if(current==='质检与扩增'&&isConversationGenerate)fields=['passThreshold','duplicateThreshold','qualityModelAlias','qualityTemperature','maxNew'];if(current==='质检与扩增'&&isColdChainGenerate&&form.getFieldValue('enableExpansion'))fields=['maxExpansionCount'];if(current==='选择输入版本')fields=['inputVersion'];if(current==='评估配置')fields=['evaluationScopes'];if(current==='自动定向扩增'&&form.getFieldValue('enableAutoExpansion'))fields=['maxEvaluationExpansion','evaluationExpansionTargets'];if(current==='结果写入'&&!isDocumentEvaluation)fields=form.getFieldValue('outputMode')==='newVersion'?['targetDataset','versionNote']:['outputDatasetName','versionNote'];if(current==='结果与提交'&&optimization.length)fields=form.getFieldValue('outputMode')==='newVersion'?['targetDataset','versionNote']:['outputDatasetName','versionNote'];try{if(fields.length)await form.validateFields(fields);setStep(s=>Math.min(s+1,stepTitles.length-1));}catch{message.warning('请完成当前步骤的必填项');}};
  const submit=async()=>{if(submitting)return;setSubmitting(true);try{const v=await form.validateFields();const stages=isSyntheticDocumentGenerate?syntheticDocumentStages(v):isCustomsGenerate?customsStages(v):isColdChainGenerate?coldchainStages(v):isConversationGenerate?conversationStages(v):isGenerate?['生成',...(v.enableAugment?['增强']:[]),...(v.enablePrivacy?['隐私处理']:[])]:isDocumentEvaluation?[...v.evaluationScopes,...(v.enableAutoExpansion?['定向扩增']:[])]:[...v.evaluationScopes,...(v.optimization||[])];const output=isDocumentEvaluation?(v.enableAutoExpansion?`${v.inputDatasetName} / 新版本`:'仅评估报告'):!isGenerate&&!optimization.length?'仅评估报告':v.outputMode==='newVersion'?`${v.targetDataset} / 新版本`:v.outputDatasetName;const backendJob=isSyntheticDocumentGenerate?await createSyntheticDocumentBackendJob(form):isCustomsGenerate?await createCustomsBackendJob(form):isColdChainGenerate?await createColdChainBackendJob(form):isConversationGenerate?await createConversationBackendJob(form):null;const input=isSyntheticDocumentGenerate?`${v.syntheticDocumentTemplateId} / ${v.syntheticDocumentTemplateVersion}`:isCustomsGenerate?'报关单模板与结构化配置':isColdChainGenerate?`${v.coldchainTemplateId} / ${v.coldchainTemplateVersion}`:isConversationGenerate?`${v.conversationTemplateId} / ${v.conversationTemplateVersion}`:isGenerate?(v.useReference?`参考：${v.referenceVersion||'临时上传'}`:'系统生成'):v.inputVersion;onSubmit({...draft,...v,businessType,stages,input,output,backendJob});}catch(error){if(!error?.errorFields)message.error(error.message||'任务提交失败');else message.warning('请完成必填配置');}finally{setSubmitting(false);}};
  const allowedOptimizations=[...(evaluationScopes.includes('质量评估')?['问题处置']:[]),...(evaluationScopes.includes('隐私评估')?['隐私处理']:[]),...(evaluationScopes.includes('覆盖评估')?['定向增强','定向扩增']:[])];
  return <div className="create-task-page">
    <Flex justify="space-between" align="center" className="create-page-heading"><Space><Button type="text" shape="circle" icon={<LeftOutlined/>} aria-label={`返回${modalityLabel}任务列表`} onClick={onCancel}/><Title level={3}>新建{modalityLabel}{draft.taskType}任务</Title></Space><Space><Button disabled={submitting} onClick={onCancel}>取消</Button><Button disabled={submitting} onClick={()=>message.success('草稿已保存')}>保存草稿</Button>{step>0&&<Button disabled={submitting} onClick={()=>setStep(s=>s-1)}>上一步</Button>}{step<stepTitles.length-1?<Button type="primary" onClick={next}>下一步</Button>:<Button type="primary" loading={submitting} onClick={submit}>提交任务</Button>}</Space></Flex>
    <Form form={form} layout="vertical" initialValues={{...(draft.modality==='文档图像'?SYNTHETIC_DOCUMENT_INITIAL_VALUES:draft.modality==='时序数据'?COLD_CHAIN_INITIAL_VALUES:draft.modality==='对话文本'?CONVERSATION_TASK_INITIAL_VALUES:{}),count:draft.modality==='对话文本'?20:draft.modality==='文档图像'?10:draft.modality==='时序数据'?10:10000,useReference:false,referenceMode:'dataset',outputMode:'newDataset',outputDatasetName:draft.modality==='对话文本'?'智能客服多轮对话':draft.modality==='时序数据'?'冷藏集装箱国际运输时序数据集':'',versionNote:draft.modality==='对话文本'?'模板驱动的合成、增强、质检与定向扩增结果':draft.modality==='时序数据'?'冷链时序模板驱动的生成、增强、质检与定向扩增结果':draft.modality==='文档图像'?'质检驱动的文档图像定向扩增结果':'',evaluationScopes:['质量评估'],optimization:[],sampleRange:'全部数据',inputVersionStrategy:'锁定所选版本',evaluationOcrModel:'pp-ocrv5-local',evaluationPassThreshold:80,evaluationSampleRange:'全部数据',evaluationQualityVlm:false,evaluationPrivacyVlm:false,evaluationCoverageVlm:true,evaluationQualityVlmModel:'qwen3-vl-8b-instruct',evaluationPrivacyVlmModel:'qwen3-vl-8b-instruct',evaluationCoverageVlmModel:'qwen3-vl-8b-instruct',evaluationPrivacyFields:CUSTOMS_EVALUATION_FIELDS.privacy,evaluationCoverageFields:CUSTOMS_EVALUATION_FIELDS.coverage,enableAutoExpansion:false,maxEvaluationExpansion:5000,evaluationExpansionLlm:'qwen3-14b-no-thinking',evaluationExpansionDiffusion:'qwen-image-edit',evaluationExpansionTargets:['低质样本替代','业务字段覆盖补齐','代码表取值覆盖补齐','视觉场景覆盖补齐','隐私失败样本替代'],...(draft.configSnapshot||{}),name:draft.name,description:draft.description,businessType:draft.businessType||draft.configSnapshot?.businessType||businessTypeMap[draft.modality][0]}}>
      <Card className="task-fixed-header"><Row gutter={20} align="bottom"><Col span={12}><Form.Item name="name" label="任务名称" rules={[{required:true}]}><Input placeholder="请输入任务名称" maxLength={50}/></Form.Item></Col><Col span={12}><Form.Item name="description" label="任务描述"><Input maxLength={200} placeholder="可随时修改"/></Form.Item></Col></Row></Card>
      <Card className="task-step-card"><Steps current={step} items={stepTitles.map(title=>({title}))}/><Divider/><div className="task-step-content">
        {current==='模板选择'&&(isConversationGenerate?<ConversationTemplateSelectionFields form={form}/>:isColdChainGenerate?<><Form.Item name="businessType" label="业务子类型" rules={[{required:true}]}><Segmented options={businessTypeMap[draft.modality]} onChange={value=>{setSelectedBusinessType(value);if(value==='传感器时序')form.setFieldsValue(COLD_CHAIN_INITIAL_VALUES);}}/></Form.Item><ColdChainTemplateSelectionFields form={form}/></>:isSyntheticDocumentGenerate?<><Form.Item name="businessType" label="业务子类型" rules={[{required:true}]}><Segmented options={businessTypeMap[draft.modality]} onChange={value=>{setSelectedBusinessType(value);form.setFieldsValue({...SYNTHETIC_DOCUMENT_INITIAL_VALUES,businessType:value});}}/></Form.Item><SyntheticDocumentTemplateFields form={form}/></>:<><Form.Item name="businessType" label="业务子类型" rules={[{required:true}]}><Segmented options={businessTypeMap[draft.modality]} onChange={value=>{setSelectedBusinessType(value);if(value==='报关单')form.setFieldsValue(CUSTOMS_INITIAL_VALUES);}}/></Form.Item><CustomsTemplateFields form={form}/></>)}
        {current==='数据合成配置'&&(isSyntheticDocumentGenerate?<SyntheticDocumentGenerationFields form={form}/>:<CustomsGenerationFields form={form}/>)}
        {current==='数据生成配置'&&(isColdChainGenerate?<ColdChainGenerationFields form={form}/>:<ConversationGenerationFields form={form}/>)}
        {current==='数据增强配置'&&(isColdChainGenerate?<ColdChainAugmentationFields form={form}/>:isConversationGenerate?<ConversationAugmentationFields form={form}/>:isSyntheticDocumentGenerate?<SyntheticDocumentAugmentationFields form={form}/>:<CustomsAugmentationFields form={form}/>)}
        {current==='质检与扩增配置'&&(isSyntheticDocumentGenerate?<SyntheticDocumentQualityFields form={form}/>:<CustomsQualityFields form={form}/>)}
        {current==='质检与扩增'&&(isConversationGenerate?<ConversationQualityExpansionFields form={form}/>:<ColdChainQualityFields form={form}/>)}
        {current==='业务与生成配置'&&<><Form.Item name="businessType" label="业务子类型" rules={[{required:true}]}><Segmented options={businessTypeMap[draft.modality]} onChange={value=>{setSelectedBusinessType(value);if(draft.modality==='文档图像'&&value==='报关单'){form.setFieldsValue(CUSTOMS_INITIAL_VALUES);setStep(0);}if(draft.modality==='时序数据'&&value==='传感器时序'){form.setFieldsValue(COLD_CHAIN_INITIAL_VALUES);setStep(0);}}}/></Form.Item>{draft.modality==='对话文本'&&<Alert type="info" showIcon message="咨询问答、信息收集和异常反馈在同一业务子类型下通过场景参数配置。"/>}<Divider orientation="left">生成参数</Divider><GenerationParameters modality={draft.modality} businessType={businessType}/><Form.Item name="count" label="目标样本数" rules={[{required:true}]}><InputNumber placeholder="请输入目标样本数（10～1000000）" min={10} max={1000000} style={{width:240}}/></Form.Item></>}
        {current==='参考样例'&&<ReferenceExampleForm modality={draft.modality} form={form} datasets={datasets}/>} 
        {current==='可选处理'&&<><Row gutter={20}><Col span={12}><Card size="small" title="数据增强" extra={<Form.Item name="enableAugment" valuePropName="checked" noStyle><Switch/></Form.Item>}><Paragraph type="secondary">为生成结果增加真实噪声、表达变化或设备异常。</Paragraph><Form.Item label="增强强度"><Select placeholder="请选择增强强度" defaultValue="中等" options={['轻度','中等','重度'].map(v=>({label:v,value:v}))}/></Form.Item></Card></Col><Col span={12}><Card size="small" title="隐私处理" extra={<Form.Item name="enablePrivacy" valuePropName="checked" noStyle><Switch/></Form.Item>}><Paragraph type="secondary">基础隐私检查默认执行；开启后自动处理命中内容。</Paragraph><Form.Item label="处理方式"><Select placeholder="请选择处理方式" defaultValue="虚构替换" options={['掩码','泛化','虚构替换'].map(v=>({label:v,value:v}))}/></Form.Item></Card></Col></Row><Alert className="section-title" type="info" showIcon message="格式校验、基础隐私检查和结果安全门槛是系统默认节点。"/></>}
        {current==='小样预览'&&<><Alert type="success" showIcon message="小样已完成：5条生成成功，基础安全检查通过。"/><Row gutter={12} className="preview-metrics">{[['小样数量','5'],['真实性','91.6'],['逻辑一致性','96.2'],['模型可用性','94.8']].map(([a,b])=><Col span={6} key={a}><Card size="small"><Statistic title={a} value={b}/></Card></Col>)}</Row><Divider orientation="left">本次执行流程</Divider><Steps direction="vertical" size="small" current={-1} items={['生成',...(form.getFieldValue('enableAugment')?['增强']:[]),...(form.getFieldValue('enablePrivacy')?['隐私处理']:[]),'基础安全检查'].map(title=>({title}))}/></>}
        {current==='结果写入'&&isGenerate&&(isSyntheticDocumentGenerate?<><SyntheticDocumentSubmissionSummary form={form}/><Divider orientation="left">写入数据中心</Divider><OutputConfig form={form} datasets={datasets} modality={draft.modality}/></>:isCustomsGenerate?<><CustomsSubmissionSummary form={form}/><Divider orientation="left">写入数据中心</Divider><OutputConfig form={form} datasets={datasets} modality={draft.modality}/></>:isColdChainGenerate?<><ColdChainSubmissionSummary form={form}/><Divider orientation="left">写入数据中心</Divider><OutputConfig form={form} datasets={datasets} modality={draft.modality}/></>:isConversationGenerate?<><ConversationSubmissionSummary form={form}/><Divider orientation="left">写入数据中心</Divider><OutputConfig form={form} datasets={datasets} modality={draft.modality}/></>:<OutputConfig form={form} datasets={datasets} modality={draft.modality}/>)} 
        {current==='选择输入版本'&&<><Alert type="info" showIcon message="评估与优化针对一个确定、不可编辑的数据集版本执行。"/><Form.Item name="inputVersion" label="输入数据集版本" rules={[{required:true}]}><Select placeholder="请选择输入数据集版本" showSearch optionFilterProp="label" options={versionOptions}/></Form.Item>{isDocumentEvaluation&&selectedInputDataset&&<Alert className="section-title" type="success" showIcon message={`系统识别业务类型：${selectedInputDataset.businessType}`} description={`${selectedInputDataset.name} · ${inputVersion}；后续评估字段将按${selectedInputDataset.businessType}模板和数据契约加载。`}/>}<Form.Item name="inputVersionStrategy" label="版本策略"><Radio.Group options={['锁定所选版本']}/></Form.Item></>}
        {current==='评估配置'&&<><Form.Item name="evaluationScopes" label="评估范围" rules={[{required:true,message:'至少选择一项'}]}><Checkbox.Group options={['质量评估','隐私评估','覆盖评估']}/></Form.Item>{isDocumentEvaluation?(businessType==='报关单'?<CustomsEvaluationConfiguration form={form} scopes={evaluationScopes}/>:<Alert className="section-title" type="info" showIcon message={`已识别为${businessType}`} description="本轮先实现报关单的详细评估字段；运单和合同将复用相同框架并加载各自模板字段。"/>):<><Alert type="info" showIcon message="覆盖评估同时分析业务场景覆盖和增强维度多样性。"/><Row gutter={16} className="section-title"><Col span={12}><Form.Item label="评估样本范围"><Select placeholder="请选择评估样本范围" defaultValue="全部数据" options={['全部数据','随机抽样20%','分层抽样'].map(v=>({label:v,value:v}))}/></Form.Item></Col><Col span={12}><Form.Item label="质量通过门槛"><Select placeholder="请选择质量通过门槛" defaultValue="标准（80分）" options={['宽松（70分）','标准（80分）','严格（90分）'].map(v=>({label:v,value:v}))}/></Form.Item></Col></Row></>}</>}
        {current==='自动定向扩增'&&<DocumentDirectionalExpansion form={form}/>} 
        {current==='结果写入'&&isDocumentEvaluation&&<>{enableAutoExpansion?<Alert type="success" showIcon message="自动扩增结果将写入输入数据集的新版本" description={`${selectedInputDataset?.name||'输入数据集'}将生成一个新的不可编辑版本；原版本保持不变，评估报告同时关联新旧版本。`}/>:<Alert type="info" showIcon message="本任务只生成评估报告" description="未启用自动定向扩增，不创建数据集新版本。"/>}<Divider orientation="left">执行摘要</Divider><Descriptions bordered size="small" column={2} items={[{key:'input',label:'输入版本',children:inputVersion||'-'},{key:'business',label:'业务类型',children:<Tag color="blue">{businessType}</Tag>},{key:'scope',label:'评估范围',children:<StageTags stages={evaluationScopes}/>},{key:'expansion',label:'自动定向扩增',children:enableAutoExpansion?`已启用 · 上限 ${form.getFieldValue('maxEvaluationExpansion')||0} 张`:'未启用'},{key:'models',label:'模型配置',children:enableAutoExpansion?`${form.getFieldValue('evaluationExpansionLlm')} / ${form.getFieldValue('evaluationExpansionDiffusion')}`:'按评估项配置'},{key:'output',label:'结果产物',children:enableAutoExpansion?`${selectedInputDataset?.name||'-'} / 新版本`:'评估报告'}]}/></>}
        {current==='自动优化'&&<><Form.Item name="optimization" label="基于评估结果自动优化（可不选）"><Checkbox.Group options={allowedOptimizations}/></Form.Item>{!allowedOptimizations.length?<Empty description="请先选择评估范围"/>:<Alert type="info" showIcon message="未选择自动优化时仅生成评估报告；选择后只处理命中问题或覆盖短板。"/>}{optimization.includes('隐私处理')&&<Form.Item label="隐私处理方式"><Select placeholder="请选择隐私处理方式" defaultValue="虚构替换" options={['掩码','泛化','虚构替换'].map(v=>({label:v,value:v}))}/></Form.Item>}{(optimization.includes('定向增强')||optimization.includes('定向扩增'))&&<Form.Item label="最大新增样本数"><InputNumber placeholder="请输入最大新增样本数（100～100000）" min={100} max={100000} defaultValue={5000}/></Form.Item>}</>}
        {current==='结果与提交'&&<>{optimization.length?<OutputConfig form={form} datasets={datasets} modality={draft.modality}/>:<Alert type="success" showIcon message="本任务仅生成评估报告，不创建新的数据集版本。报告将关联输入版本和本次任务。"/>}<Divider orientation="left">执行摘要</Divider><Descriptions bordered size="small" column={2} items={[{key:'1',label:'输入版本',children:form.getFieldValue('inputVersion')},{key:'2',label:'评估范围',children:<StageTags stages={evaluationScopes}/>},{key:'3',label:'自动优化',children:optimization.length?<StageTags stages={optimization}/>:<Tag>不执行</Tag>},{key:'4',label:'数据产物',children:optimization.length?'新数据集或新版本':'仅评估报告'}]}/></>}
      </div></Card>
    </Form>
  </div>;
}

function PreV3CreateTaskPage({ draft, datasets, onCancel, onSubmit }) {
  const [submitting,setSubmitting]=useState(false);
  const [form]=Form.useForm();
  const [selectedBusinessType,setSelectedBusinessType]=useState(draft.businessType||draft.configSnapshot?.businessType||businessTypeMap[draft.modality][0]);
  const businessType=Form.useWatch('businessType',form)||selectedBusinessType;
  const evaluationScopes=Form.useWatch('evaluationScopes',form)||['质量评估'];
  const inputVersion=Form.useWatch('inputVersion',form);
  const isSynthesis=draft.taskType==='数据合成';
  const automaticQuality=Form.useWatch('autoQualityEnabled',form);
  const isQuality=draft.taskType==='数据质检';
  const isAugmentation=draft.taskType==='数据增强';
  const isExpansion=draft.taskType==='定向扩增';
  const modalityLabel=modalityLabelMap[draft.modality]||draft.modality;
  const taskPageTitle=`新建${modalityLabel}${modalityLabel.endsWith('数据')&&draft.taskType.startsWith('数据')?draft.taskType.slice(2):draft.taskType}任务`;
  const selectedInputDataset=useMemo(()=>datasets.find(dataset=>dataset.versions.some(version=>`${dataset.name} / ${version.version}`===inputVersion)),[datasets,inputVersion]);
  const versionOptions=datasets.filter(dataset=>dataset.modality===draft.modality).flatMap(dataset=>dataset.versions.map(version=>({label:`${dataset.name} / ${version.version} · ${numericSampleCount(version.samples).toLocaleString()}条`,value:`${dataset.name} / ${version.version}`})));
  const modeValues=isSynthesis
    ? {enableAugmentation:false,enableAugment:false,runQc:false,enableQuality:false,enableExpansion:false,enableAutoExpansion:false}
    : isQuality
      ? {enableAugmentation:false,enableAugment:false,runQc:true,enableQuality:true,enableExpansion:false,enableAutoExpansion:false}
      : isAugmentation
        ? {enableAugmentation:true,enableAugment:true,runQc:false,enableQuality:false,enableExpansion:false,enableAutoExpansion:false}
        : {enableAugmentation:false,enableAugment:false,runQc:true,enableQuality:true,enableExpansion:true,enableAutoExpansion:true};

  useEffect(()=>{
    form.setFieldsValue(modeValues);
  },[businessType,draft.taskType,form]);

  useEffect(()=>{
    if(isSynthesis||!selectedInputDataset)return;
    setSelectedBusinessType(selectedInputDataset.businessType);
    form.setFieldsValue({businessType:selectedInputDataset.businessType,inputDatasetName:selectedInputDataset.name,targetDataset:selectedInputDataset.name,outputMode:'newVersion'});
  },[form,isSynthesis,selectedInputDataset]);

  const changeBusinessType=value=>{
    setSelectedBusinessType(value);
    if(draft.modality==='文档图像')form.setFieldsValue({...SYNTHETIC_DOCUMENT_INITIAL_VALUES,...modeValues,businessType:value});
    if(draft.modality==='时序数据')form.setFieldsValue({...COLD_CHAIN_INITIAL_VALUES,...modeValues,businessType:value});
    if(draft.modality==='对话文本')form.setFieldsValue({...CONVERSATION_TASK_INITIAL_VALUES,...modeValues,businessType:value});
  };

  const synthesisTemplateFields=draft.modality==='文档图像'
    ? <SyntheticDocumentTemplateFields form={form}/>
    : draft.modality==='对话文本'
      ? <ConversationTemplateSelectionFields form={form}/>
      : <ColdChainTemplateSelectionFields form={form}/>;
  const synthesisParameterFields=draft.modality==='文档图像'
    ? <SyntheticDocumentGenerationFields form={form}/>
    : draft.modality==='对话文本'
      ? <ConversationGenerationFields form={form}/>
      : <ColdChainGenerationFields form={form}/>;

  const inputVersionFields=<>
    <Alert type="info" showIcon message={`${draft.taskType}针对一个确定、不可编辑的数据集版本执行。`}/>
    <Form.Item name="inputVersion" label="输入数据集版本" rules={[{required:true,message:'请选择输入数据集版本'}]}><Select placeholder="请选择输入数据集版本" showSearch optionFilterProp="label" options={versionOptions}/></Form.Item>
    {selectedInputDataset&&<Alert className="section-title" type="success" showIcon message={`已识别业务类型：${selectedInputDataset.businessType}`} description={`${selectedInputDataset.name} · ${inputVersion}`}/>} 
    <Form.Item name="inputVersionStrategy" label="版本策略"><Radio.Group options={['锁定所选版本']}/></Form.Item>
  </>;

  const qualityFields=<>
    <Form.Item name="evaluationScopes" label="质检范围" rules={[{required:true,message:'至少选择一项'}]}><Checkbox.Group options={['质量评估','隐私评估','覆盖评估']}/></Form.Item>
    {draft.modality==='文档图像'&&(businessType==='报关单'
      ? <CustomsEvaluationConfiguration form={form} scopes={evaluationScopes}/>
      : <><Alert type="info" showIcon message="沿用现有文档质检配置" description="按所选版本执行质量、隐私与覆盖检查。"/><Row gutter={16} className="section-title"><Col span={12}><Form.Item name="evaluationSampleRange" label="评估样本范围"><Select placeholder="请选择评估样本范围" options={['全部数据','随机抽样20%','分层抽样'].map(value=>({value,label:value}))}/></Form.Item></Col><Col span={12}><Form.Item name="evaluationPassThreshold" label="质量通过门槛"><Select placeholder="请选择质量通过门槛" options={[{value:70,label:'宽松（70分）'},{value:80,label:'标准（80分）'},{value:90,label:'严格（90分）'}]}/></Form.Item></Col></Row></>)}
    {draft.modality==='对话文本'&&<ConversationQualityExpansionFields form={form} mode="quality" standalone/>}
    {draft.modality==='时序数据'&&<ColdChainQualityFields form={form} mode="quality" standalone/>}
  </>;

  const augmentationFields=draft.modality==='文档图像'
    ? (businessType==='报关单'?<CustomsAugmentationFields form={form}/>:<SyntheticDocumentAugmentationFields form={form}/>)
    : draft.modality==='对话文本'
      ? <ConversationAugmentationFields form={form} standalone/>
      : <ColdChainAugmentationFields form={form} standalone/>;

  const expansionFields=draft.modality==='文档图像'
    ? <DocumentDirectionalExpansion form={form} standalone/>
    : draft.modality==='对话文本'
      ? <ConversationQualityExpansionFields form={form} mode="expansion" standalone/>
      : <ColdChainQualityFields form={form} mode="expansion" standalone/>;

  const submit=async()=>{
    if(submitting)return;
    setSubmitting(true);
    try{
      form.setFieldsValue(modeValues);
      const values=await form.validateFields();
      let backendJob=null;
      if(isSynthesis){
        if(draft.modality==='文档图像')backendJob=await createSyntheticDocumentBackendJob(form);
        if(draft.modality==='对话文本')backendJob=await createConversationBackendJob(form);
        if(draft.modality==='时序数据')backendJob=await createColdChainBackendJob(form);
      }
      const output=isQuality?`${values.targetDataset||'输入数据集'} / 质检标注新版本`:values.outputMode==='newVersion'?`${values.targetDataset} / 新版本`:values.outputDatasetName;
      const input=isSynthesis
        ? draft.modality==='文档图像'?`${values.syntheticDocumentTemplateId} / ${values.syntheticDocumentTemplateVersion}`:draft.modality==='对话文本'?`${values.conversationTemplateId} / ${values.conversationTemplateVersion}`:`${values.coldchainTemplateId} / ${values.coldchainTemplateVersion}`
        : values.inputVersion;
      onSubmit({...draft,...values,...modeValues,businessType:values.businessType||businessType,stages:[draft.taskType],input,output,backendJob});
    }catch(error){
      if(!error?.errorFields)message.error(error.message||'任务提交失败');
      else message.warning('请完成必填配置');
    }finally{setSubmitting(false);}
  };

  const defaultOutputName=draft.modality==='文档图像'?'文档图像数据集':draft.modality==='对话文本'?'智能客服多轮对话':'冷藏集装箱国际运输时序数据集';
  const defaultVersionNote=isSynthesis?'数据合成结果':isAugmentation?'数据增强结果':isExpansion?'定向扩增结果':'数据质检结果';
  return <div className="create-task-page">
    <Flex justify="space-between" align="center" className="create-page-heading"><Space><Button type="text" shape="circle" icon={<LeftOutlined/>} aria-label={`返回${modalityLabel}任务列表`} onClick={onCancel}/><Title level={3}>{taskPageTitle}</Title></Space><Space><Button disabled={submitting} onClick={onCancel}>取消</Button><Button disabled={submitting} onClick={()=>message.success('草稿已保存')}>保存草稿</Button><Button type="primary" loading={submitting} onClick={submit}>提交任务</Button></Space></Flex>
    <Form form={form} layout="vertical" initialValues={{...(draft.modality==='文档图像'?SYNTHETIC_DOCUMENT_INITIAL_VALUES:draft.modality==='时序数据'?COLD_CHAIN_INITIAL_VALUES:CONVERSATION_TASK_INITIAL_VALUES),...modeValues,count:draft.modality==='对话文本'?20:10,outputMode:'newDataset',outputDatasetName:defaultOutputName,versionNote:defaultVersionNote,evaluationScopes:['质量评估'],inputVersionStrategy:'锁定所选版本',evaluationOcrModel:'pp-ocrv5-local',evaluationPassThreshold:80,evaluationSampleRange:'全部数据',evaluationQualityVlm:false,evaluationPrivacyVlm:false,evaluationCoverageVlm:true,evaluationQualityVlmModel:'qwen3-vl-8b-instruct',evaluationPrivacyVlmModel:'qwen3-vl-8b-instruct',evaluationCoverageVlmModel:'qwen3-vl-8b-instruct',evaluationPrivacyFields:CUSTOMS_EVALUATION_FIELDS.privacy,evaluationCoverageFields:CUSTOMS_EVALUATION_FIELDS.coverage,maxEvaluationExpansion:5000,evaluationExpansionLlm:'qwen3-14b-no-thinking',evaluationExpansionDiffusion:'qwen-image-edit',evaluationExpansionTargets:['低质样本替代','业务字段覆盖补齐','代码表取值覆盖补齐','视觉场景覆盖补齐','隐私失败样本替代'],...(draft.configSnapshot||{}),name:draft.name,description:draft.description,businessType:selectedBusinessType}}>
      <Card className="task-fixed-header"><Row gutter={20} align="bottom"><Col span={12}><Form.Item name="name" label="任务名称" rules={[{required:true,message:'请输入任务名称'}]}><Input placeholder="请输入任务名称" maxLength={50}/></Form.Item></Col><Col span={12}><Form.Item name="description" label="任务描述"><Input maxLength={200} placeholder="可随时修改"/></Form.Item></Col></Row></Card>
      {isSynthesis&&<>
        <Card className="task-step-card" title="模板与数据合成配置">
          <Form.Item name="businessType" label="业务子类型" rules={[{required:true}]}><Segmented options={businessTypeMap[draft.modality]} onChange={changeBusinessType}/></Form.Item>
          {synthesisTemplateFields}<Divider orientation="left">数据合成参数</Divider>{synthesisParameterFields}
        </Card>
        <Card className="task-step-card section-title" title="结果写入"><OutputConfig form={form} datasets={datasets} modality={draft.modality}/></Card>
      </>}
      {!isSynthesis&&<>
        <Card className="task-step-card" title="输入数据版本">{inputVersionFields}</Card>
        <Card className="task-step-card section-title" title={`${draft.taskType}配置`}>{isQuality?qualityFields:isAugmentation?augmentationFields:expansionFields}</Card>
        {!isQuality&&<Card className="task-step-card section-title" title="结果写入"><OutputConfig form={form} datasets={datasets} modality={draft.modality}/></Card>}
        {isQuality&&<Alert className="section-title" type="success" showIcon message="任务完成后创建质检标注版本" description="输入版本保持不变；样本级质检标签和质检报告写入同一条新版本。"/>}
      </>}
    </Form>
  </div>;
}

const PUBLISHED_TEMPLATE_PROFILES = [
  { id:'TEMPLATE-DOC-20260902-E3A971', name:'进口货物申报单模板', documentSnapshot:customsTemplateSnapshot, modality:'文档图像', businessType:'报关单', version:'1.0.0', trialStatus:'试运行通过', method:'版面分析法', outputFormat:'PNG + JSON', defaultModel:'Qwen3-VL-8B-Instruct' },
  { id:'TEMPLATE-DOC-20260902-WB0012', name:'橙途速运运单模板', modality:'文档图像', businessType:'运单', version:'1.0.0', trialStatus:'试运行通过', method:'底图生成法', outputFormat:'PNG + JSON', defaultModel:'Qwen3-VL-8B-Instruct', imageModel:'Doubao-Seedream-4.0', backgroundPrompt:'生成一张横版物流运单空白底图：保留规范表格、分区线、浅灰辅助线和右下角二维码占位，不生成任何真实姓名、地址、电话、单号或可识别文字。' },
  { id:'TEMPLATE-CONV-20260902-C01A7B', name:'物流智能客服对话模板', modality:'对话文本', businessType:'智能客服多轮对话', version:'1.0.0', trialStatus:'试运行通过', outputFormat:'messages JSONL', defaultModel:'Qwen3-14B', configuration:{sampler:defaultConversationSampler()} },
  { id:'TEMPLATE-TS-20260902-CC1024', name:'冷藏集装箱多变量时序模板', modality:'时序数据', businessType:'传感器时序', version:'1.0.0', trialStatus:'试运行通过', outputFormat:'逐样本 JSON', defaultModel:'Qwen3-14B', outputFields:'temperature、humidity、longitude、latitude、event_label' },
];

const TEMPLATE_QUALITY_RULES = {
  文档图像: [
    {id:'BASE-STRUCTURE',name:'输出内容结构检查',category:'基础规则',target:'图像、字段与标注',method:'规则判断',threshold:'结构完整且字段可解析',content:'检查图片、字段 JSON、bbox/polygon、字段 ID 和图层对象是否完整，坐标不得越界。'},
    {id:'BASE-PRIVACY',name:'隐私与敏感信息检查',category:'基础规则',target:'图像与字段',method:'规则判断',threshold:'残留风险数 = 0',privacy:true,content:'检查姓名、联系方式、地址、业务唯一编号、条形码、二维码、印章和其他敏感内容是否为安全虚构值。'},
    {id:'BASE-DUPLICATE',name:'重复样本检查',category:'基础规则',target:'图像与字段',method:'规则判断',threshold:'感知哈希及关键字段组合不重复',content:'同时计算图像感知哈希、字段组合哈希和标注结构哈希，判断样本是否重复。'},
    {id:'SCENE-OCR-EXACT',name:'字段 OCR 完全一致性',category:'场景规则',target:'图像与字段',method:'语义判断',threshold:'得分 ≥ 0.90',content:'逐字段对比 Ground Truth 与 OCR 结果，检查文字、日期、编号、金额和单位是否保持一致。',passExample:'申报日期与 Ground Truth 完全一致',failExample:'海关编号出现字符替换'},
    {id:'SCENE-NUMERIC-CODE',name:'数字与代码准确性',category:'场景规则',target:'字段',method:'规则判断',threshold:'准确率 ≥ 95%',content:'对日期、金额、税则号、国别代码和口岸代码等数字代码字段执行标准化后精确比较。'},
    {id:'SCENE-LAYOUT-FIELD',name:'版面与字段一致性',category:'场景规则',target:'图像与字段',method:'语义判断',threshold:'得分 ≥ 0.85',content:'判断字段位置、标签和值的绑定关系是否符合模板定义的版面语义。'},
    {id:'SCENE-IMAGE-GEOMETRY',name:'图片与几何质量',category:'场景规则',target:'图像与标注',method:'函数判断',threshold:'polygon 有效率 ≥ 99.5%',content:'计算亮度、对比度、清晰度、bbox/polygon 重投影误差、越界比例和字段像素高度。'},
    {id:'SCENE-LABEL-COVERAGE',name:'标签覆盖率',category:'场景规则',target:'样本标签',method:'规则判断',threshold:'输出各标签 PASS 数及缺口',content:'按业务字段、版式、印章类型及拍摄/扫描场景统计样本覆盖量，为定向扩增提供依据。'},
  ],
  对话文本: [
    {id:'DINGO-SFT-FORMAT',name:'SFT 字段格式',category:'基础质检',target:'整段对话',method:'Dingo 规则',engine:'RuleVerlSftDataFormat',severity:'BLOCK',threshold:'字段与类型合法',content:'检查 VERL SFT 必填字段、类型和可解析性。',passExample:'prompt 为消息数组且 response 为非空字符串',failExample:'response 字段缺失'},
    {id:'DINGO-CONVERSATION-STRUCTURE',name:'多轮对话结构',category:'基础质检',target:'整段对话',method:'Dingo 规则',engine:'RuleConversationStructure',severity:'BLOCK',threshold:'角色与轮次合法',content:'检查角色枚举、User/Assistant 顺序、轮次数及工具调用和返回配对。',passExample:'user→assistant→user→assistant',failExample:'连续两条 assistant 且没有工具调用'},
    {id:'DINGO-CONTENT-NULL',name:'空值 / 纯空白',category:'基础质检',target:'整段 + 每条消息',method:'Dingo 规则',engine:'RuleContentNull',severity:'BLOCK',threshold:'命中数 = 0',content:'同时检查整段文本以及每条 User/Assistant 消息的 null、空串和 trim 后空白。',passExample:'content="请查询运单"',failExample:'content="   "'},
    {id:'DINGO-CONTENT-SHORT',name:'短文本',category:'基础质检',target:'整段 + 每条消息',method:'Dingo 规则',engine:'RuleContentShort',severity:'BLOCK',threshold:'整段 ≥ 10；消息 ≥ 2 字符',content:'按整段、User 消息和 Assistant 消息分别计算有效字符长度并与阈值比较。',passExample:'assistant="暂未查到更新"',failExample:'assistant="嗯"'},
    {id:'DINGO-DOC-REPEAT',name:'文本重复',category:'基础质检',target:'单条对话内部',method:'Dingo 规则',engine:'RuleDocRepeat',severity:'REVIEW',threshold:'6-gram 重复度 < 0.80',content:'使用归一化 6-gram 重复度检测模板化复读和大段重复。',passExample:'各轮提供新的有效信息',failExample:'同一句结论连续重复多次'},
    {id:'SYSTEM-CROSS-DUPLICATE',name:'跨样本近重复',category:'基础质检',target:'数据集',method:'系统向量规则',engine:'文本指纹 + Embedding',severity:'REVIEW',threshold:'相似度 < 0.92',content:'保留系统原有跨样本指纹与向量相似度检测；Dingo 文内重复不替代该能力。'},
    {id:'DINGO-SECURITY',name:'LLM 内容安全',category:'基础质检',target:'整段 + Assistant 消息',method:'Dingo LLM',engine:'LLMSecurityProhibition',severity:'BLOCK',threshold:'安全判定 = 1',content:'检查违法、有害、歧视、色情、危险协助及企业策略配置的其他风险。'},
    {id:'DINGO-TEXT-QUALITY',name:'综合可读性 / 训练适用性',category:'基础质检',target:'整段对话',method:'Dingo LLM',engine:'LLMTextQualityV5',severity:'REVIEW',threshold:'得分 ≥ 0.80',content:'综合评估结构完整、语言自然、可读性、多样性和 SFT 训练适用性。'},
    {id:'DINGO-CONTEXT-RELEVANCY',name:'上下文相关性 Context Relevancy',category:'基础质检',target:'整段对话',method:'Dingo LLM',engine:'LLMRAGContextRelevancy',severity:'REVIEW',threshold:'得分 ≥ 7 / 10',content:'判断对话是否持续围绕用户问题、对话目标、冻结事件和召回知识展开。'},
    {id:'DINGO-CHAR-NUMBER',name:'有效字符长度',category:'基础统计',target:'整段 + User / Assistant',method:'Dingo 统计',engine:'RuleCharNumber',severity:'INFO',threshold:'统计，不改变状态',content:'输出整段、User 和 Assistant 的有效字符数分布。'},
    {id:'DINGO-WORD-NUMBER',name:'词数范围',category:'基础统计',target:'整段 + User / Assistant',method:'Dingo 统计',engine:'RuleWordNumber',severity:'INFO',threshold:'统计，不改变状态',content:'使用本地化分词分别统计整段与角色消息词数。'},
    {id:'DINGO-PUNCTUATION',name:'标点与超长句',category:'基础统计',target:'整段 + User / Assistant',method:'Dingo + 系统统计',engine:'RuleNoPunc + 句长统计',severity:'INFO',threshold:'统计，不改变状态',content:'统计无标点消息、最长无标点片段和超长句占比。'},
    {id:'DINGO-PII',name:'标准 PII',category:'隐私质检',target:'整段 + 每条消息',method:'Dingo 规则',engine:'RulePIIDetection',severity:'BLOCK',privacy:true,threshold:'残留命中数 = 0',content:'检测手机号、身份证、邮箱、信用卡、护照、SSN 和 IPv4；命中后进入系统脱敏流程。'},
    {id:'SYSTEM-PRIVACY-PERSON',name:'个人身份隐私扩展',category:'隐私质检',target:'整段 + 每条消息',method:'系统规则',engine:'NER + 正则',severity:'BLOCK',privacy:true,threshold:'残留命中数 = 0',content:'补充姓名及业务所需的本地个人身份类型。'},
    {id:'SYSTEM-PRIVACY-CONTACT',name:'联系与位置隐私',category:'隐私质检',target:'整段 + 每条消息',method:'系统规则',engine:'NER + 正则',severity:'BLOCK',privacy:true,threshold:'残留命中数 = 0',content:'检查详细地址、车牌号及 Dingo 标准 PII 未覆盖的联系方式。'},
    {id:'SYSTEM-PRIVACY-BUSINESS',name:'业务标识隐私',category:'隐私质检',target:'整段 + 每条消息',method:'系统规则',engine:'业务字典 + 正则',severity:'BLOCK',privacy:true,threshold:'真实业务标识 = 0',content:'检查真实运单号、客户编号和企业内部账号，并替换为安全合成标识。'},
    {id:'SYSTEM-PRIVACY-CREDENTIAL',name:'账号与密钥安全',category:'隐私质检',target:'整段 + 每条消息',method:'系统规则',engine:'凭据扫描',severity:'BLOCK',privacy:true,threshold:'密钥命中数 = 0',content:'检查 API Key、Token、Cookie 和密码；报告只保留类型与掩码预览。'},
    {id:'SYSTEM-UNIQUE-ID',name:'唯一标识',category:'业务契约质检',target:'合成指令',method:'系统规则',engine:'确定性校验',severity:'BLOCK',threshold:'instruction_id 非空且唯一',content:'检查每条合成指令拥有唯一可追踪 ID。'},
    {id:'SYSTEM-PLACEHOLDER',name:'占位符完整性',category:'业务契约质检',target:'合成指令',method:'系统规则',engine:'确定性校验',severity:'BLOCK',threshold:'未知 / 未解析占位符 = 0',content:'检查必需变量存在且没有遗留模板占位符。'},
    {id:'SYSTEM-RULE-TRACE',name:'知识卡 ID 可追溯',category:'业务契约质检',target:'对话与事件/证据',method:'系统规则',engine:'快照引用校验',severity:'BLOCK',threshold:'引用解析率 = 100%',content:'知识卡 ID 必须来自当前模板冻结快照。'},
    {id:'SYSTEM-STATE',name:'状态机合法性',category:'业务契约质检',target:'对话与事件',method:'系统规则',engine:'状态机校验',severity:'BLOCK',threshold:'终态及路径合法 = true',content:'检查状态 ID、允许转换和 expected_final_state 与 state_path 末项一致。'},
    {id:'SYSTEM-TOOL',name:'工具契约',category:'业务契约质检',target:'对话与工具调用',method:'系统规则',engine:'JSON Schema',severity:'BLOCK',threshold:'工具名及参数 Schema 合法',content:'检查工具选择、参数类型、返回值和对结果的引用符合模板契约。'},
    {id:'SYSTEM-EXACT-DUPLICATE',name:'完全重复检查',category:'业务契约质检',target:'数据集',method:'系统规则',engine:'内容哈希',severity:'REVIEW',threshold:'完全重复数 = 0',content:'保留系统原有完全重复检测并输出重复样本 ID。'},
    {id:'SYSTEM-LABEL-COVERAGE',name:'标签覆盖率',category:'业务契约质检',target:'样本标签',method:'系统统计',engine:'分组计数',severity:'INFO',threshold:'输出各标签 PASS 数及缺口',content:'统计意图、情绪、信息完整度及状态路径等标签分布。'},
    {id:'DINGO-SENSITIVE-WORDS',name:'自定义敏感词',category:'自定义质检',target:'整段 + 每条消息',method:'Dingo 规则',engine:'自定义词表',severity:'REVIEW',threshold:'命中数 = 0',content:'使用项目维护的敏感词词表逐消息扫描。'},
    {id:'DINGO-HONEST',name:'Honest',category:'自定义质检',target:'Assistant 输出',method:'Dingo LLM',engine:'LLM 3H',severity:'REVIEW',threshold:'判定 = 1',content:'检查 Assistant 是否诚实表达已知与未知，不捏造或欺骗。'},
    {id:'DINGO-HELPFUL',name:'Helpful',category:'自定义质检',target:'Assistant 输出',method:'Dingo LLM',engine:'LLM 3H',severity:'REVIEW',threshold:'判定 = 1',content:'检查 Assistant 是否直接回答并提供可执行的帮助。'},
    {id:'DINGO-HARMLESS',name:'Harmless',category:'自定义质检',target:'Assistant 输出',method:'Dingo LLM',engine:'LLM 3H',severity:'BLOCK',threshold:'判定 = 1',content:'检查 Assistant 是否避免伤害、歧视和危险协助。'},
    {id:'DINGO-TASK-DIFFICULTY',name:'任务难度',category:'自定义质检',target:'合成指令',method:'Dingo LLM',engine:'LLMTaskDiff',severity:'INFO',threshold:'0–10 分层统计',content:'对任务复杂度分层，用于分析训练集难度分布。'},
    {id:'DINGO-ANSWER-RELEVANCY',name:'答案相关性 Answer Relevancy',category:'自定义质检',target:'对话与事件',method:'Dingo Embedding',engine:'Embedding 相似度',severity:'REVIEW',threshold:'得分 ≥ 7 / 10',content:'检查 User→Assistant 回答是否相关，并结合冻结事件判断对话是否围绕目标展开。',passExample:'围绕事件中的延误事实解释原因',failExample:'用户问物流状态却回答账户充值'},
    {id:'DINGO-FAITHFULNESS',name:'答案忠实度 Faithfulness',category:'自定义质检',target:'对话与事件/证据',method:'Dingo LLM',engine:'LLMFactualConsistency',severity:'BLOCK',threshold:'得分 ≥ 7 / 10',content:'Assistant 的事实、时间、状态和结论必须由冻结事件、知识卡或工具结果支持。',passExample:'按事件说明最后更新时间',failExample:'编造事件中不存在的预计送达时间'},
    {id:'SYSTEM-ROLE-STABILITY',name:'角色稳定性',category:'自定义质检',target:'整段对话',method:'系统语义 Judge',engine:'Qwen Judge',severity:'REVIEW',threshold:'得分 ≥ 0.80',content:'保留系统已有角色、语气、权限和能力边界一致性检查。'},
  ],
  时序数据: [
    {id:'BASE-STRUCTURE',name:'输出内容结构检查',category:'基础规则',target:'时序参数',method:'规则判断',threshold:'字段契约合法 = true',content:'检查字段名称、数据类型、必填参数、单位和输出结构是否符合模板契约。'},
    {id:'BASE-PRIVACY',name:'隐私与敏感信息检查',category:'基础规则',target:'两者',method:'规则判断',threshold:'残留风险数 = 0',privacy:true,content:'检查设备标识、车辆标识、人员信息、路线业务编号和文本事件中的敏感信息。'},
    {id:'BASE-DUPLICATE',name:'重复序列检查',category:'基础规则',target:'时序参数',method:'规则判断',threshold:'序列哈希不重复',content:'检查完全重复或高度相似的参数序列及事件序列。'},
    {id:'BASE-LABEL-COVERAGE',name:'标签覆盖率',category:'基础规则',target:'两者',method:'规则判断',threshold:'输出各标签 PASS 数及缺口',content:'统计异常事件、运输阶段、参数形态和标签组合的 PASS 数量。'},
    {id:'SCENE-EVENT-SEMANTIC',name:'语义事件有效性',category:'场景规则',target:'语义事件',method:'语义判断',threshold:'得分 ≥ 0.85',content:'判断异常事件名称、描述和上下文是否符合模板定义的业务语义。'},
    {id:'SCENE-TEMPORAL',name:'时间连续性',category:'场景规则',target:'时序参数',method:'函数判断',threshold:'时间戳单调且间隔误差 ≤ 1%',content:'检查时间戳顺序、步数、采样间隔、缺失点和重复时间戳。'},
    {id:'SCENE-RELATION',name:'参数关系合理性',category:'场景规则',target:'时序参数',method:'函数判断',threshold:'关系函数返回 true',content:'检查温湿度、速度、位置、阶段等参数之间的约束关系和物理边界。'},
    {id:'SCENE-FLUCTUATION',name:'整体波动合理性',category:'场景规则',target:'时序参数',method:'语义判断',threshold:'得分 ≥ 0.82',content:'判断整段序列趋势、突变、周期和噪声是否符合真实设备及运输过程。'},
    {id:'SCENE-EVENT-CONSISTENCY',name:'参数与事件一致性',category:'场景规则',target:'两者',method:'语义判断',threshold:'得分 ≥ 0.88',content:'判断事件发生时间与对应参数变化是否一致，事件前后状态是否合理。'},
  ],
};

const templatesForModality = modality => PUBLISHED_TEMPLATE_PROFILES.filter(item=>item.modality===modality&&!['TEMPLATE-CONV-20260902-AF2210','TEMPLATE-TS-20260902-GPS072'].includes(item.id));
const templateForDataset = dataset => PUBLISHED_TEMPLATE_PROFILES.find(item=>item.id===dataset?.templateId)
  || PUBLISHED_TEMPLATE_PROFILES.find(item=>item.modality===dataset?.modality&&item.businessType===dataset?.businessType)
  || templatesForModality(dataset?.modality)[0];

function TemplateSnapshot({ template }) {
  if(!template)return <Alert type="warning" showIcon message="未找到可用的已发布模板" description="请先在模板中心完成模板试运行并发布。"/>;
  return <Descriptions bordered size="small" column={3} items={[
    {key:'name',label:'适用模板',children:<div><Text strong>{template.name}</Text><div className="muted-id">{template.id}</div></div>},
    
    {key:'business',label:'业务类型',children:template.businessType},{key:'method',label:'模板制作方式',children:template.method||'-'},{key:'trial',label:'试运行状态',children:<Tag color="green">{template.trialStatus}</Tag>},{key:'format',label:'输出格式',children:template.outputFormat},
  ]}/>;
}

function templateConfiguration(template){return template?.configuration||template?.selected_version?.configuration_v2||template?.selected_version?.configuration||{};}
function templateQualityRules(modality,template){return templateRulesSnapshot(modality,template);}

function TemplateRulesTable({ modality, template, title='质检规则', rules:providedRules }) {
  const rules=taskQualityRules(providedRules||templateQualityRules(modality,template));
  return <Card className="task-step-card section-title" title={title}>
    <Text type="secondary" style={{display:'block',marginBottom:12}}>{PRIVACY_SCOPE_NOTICE}</Text>
    <UnifiedQualityEditor modality={modality} rules={rules} readOnly/>
  </Card>;
}

function TaskEvidencePanel({ title, identity, children, onOpenDetail, showReadOnly = true }) {
  return <Card className="task-evidence-card" title={<Space><span>{title}</span>{showReadOnly&&<Tag>只读</Tag>}</Space>} extra={onOpenDetail?<Button type="link" size="small" onClick={onOpenDetail}>查看完整详情</Button>:null}>
    {identity&&<div className="task-evidence-identity"><Text strong>{identity.name||'-'}</Text><Text type="secondary" copyable={Boolean(identity.id)}>{identity.id||'-'}</Text>{identity.updatedAt&&<Text type="secondary">更新时间：{formatDateTime(identity.updatedAt)}</Text>}</div>}
    {children}
  </Card>;
}

function TemplateEvidence({ template, modality }) {
  if(!template)return <TaskEvidencePanel title="模板" showReadOnly={false}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先选择模板"/></TaskEvidencePanel>;
  const rules=templateQualityRules(modality,template);
  const config=templateConfiguration(template);
  const conversationSampler=modality==='对话文本'?(config.sampler||defaultConversationSampler()):null;
  const samplingScenarios=conversationSampler?.scenarios||[];
  const samplingDimensions=conversationSampler?.dimensions||[];
  const document=documentSnapshot(template);
  const outputSize=document.render_profile?.output_size||document.canvas;
  return <TaskEvidencePanel title={template.name} showReadOnly={false}>
    <Descriptions size="small" column={1} bordered items={[
      {key:'id',label:'模板 ID',children:<Text copyable>{template.id}</Text>},
      {key:'business',label:'业务类型',children:template.businessType},
      {key:'method',label:'生成方式',children:modality==='时序数据'?(config.generation?.method==='engine'?'引擎生成':'模型生成'):(template.method||'-')},
      ...(modality==='文档图像'?[
        {key:'fieldCount',label:'字段数量',children:(document.texts||[]).filter(item=>item.kind==='fixed_label').length+(document.fields||[]).length},
        {key:'resolution',label:'默认输出精度',children:outputSize?`${outputSize.width} × ${outputSize.height} px`:template.resolution||'-'},
      ]:[]),
      {key:'rules',label:'质检规则',children:`${rules.length} 条`},
    ]}/>
    {modality==='文档图像'?<DocumentTemplateFields key={template.id} snapshot={document}/>:<Divider orientation="left">模板具体内容</Divider>}
    {modality==='对话文本'&&<><Descriptions size="small" column={1} bordered items={[
      {key:'scenario',label:'场景与角色',children:config.scenario?.scene_markdown||template.businessType},{key:'roles',label:'角色与权限',children:'服务角色身份、服务角色权限和用户角色身份均由模板锁定'},{key:'knowledge',label:'知识卡',children:config.knowledge?.enabled?`${(String(config.knowledge.text||'').match(/\[知识卡 /g)||[]).length} 张 · ${config.knowledge.usage_instructions||'按场景选用'}`:'未启用'},{key:'tools',label:'工具调用',children:config.tools?.enabled?`${config.tools.catalog?.length||0} 个工具 · 保留模拟调用轨迹`:'未启用'},{key:'fewshot',label:'参考对话',children:config.few_shot?.enabled?'已启用，按普通/知识卡/工具轨迹分类':'未启用'},{key:'completion',label:'完成要求',children:config.scenario?.completion_requirements_markdown||'-'},
    ]}/><Divider orientation="left">{samplingDimensions.length?'事件采样维度':'可采样场景'}</Divider>{samplingDimensions.length?<Table rowKey="name" size="small" pagination={false} dataSource={samplingDimensions} columns={[{title:'维度名称',dataIndex:'name'},{title:'维度说明',dataIndex:'description',render:value=>value||'-'},{title:'维度可选值',dataIndex:'values',render:values=><Space wrap>{(values||[]).map(value=><Tag key={value}>{value}</Tag>)}</Space>}]}/>:<Table rowKey="id" size="small" pagination={false} dataSource={samplingScenarios} columns={[{title:'子场景',render:(_,row)=><div><Text strong>{row.name}</Text><div className="muted-id">{row.id}</div></div>},{title:'场景目标',dataIndex:'goal'},{title:'合法案例',width:85,render:(_,row)=>row.cases?.length||0},{title:'交互分支',width:85,render:(_,row)=>row.profiles?.length||0}]}/>}</>}
    {modality==='时序数据'&&<Descriptions size="small" column={1} bordered items={[
      {key:'scene',label:'时序场景',children:config.event_generation?.scene_config?.business_scene_description||template.description||'-'},{key:'events',label:'事件定义',children:(config.event_generation?.event_definitions||[]).map(item=>item.name).join('、')||'-'},{key:'fields',label:'输出字段',children:(config.fields||[]).filter(item=>item.enabled!==false).map(item=>`${item.label||item.field_id}${item.unit?`（${item.unit}）`:''}`).join('、')||template.outputFields||'-'},{key:'generation',label:'生成方式',children:config.generation?.method==='engine'?`引擎生成 · ${config.generation?.engine_id||config.rule_engine?.engine_id||'-'}`:'模型生成 · 两阶段联合生成'},{key:'dimensions',label:'事件采样维度',children:(config.event_generation?.sampling_dimensions||[]).map(item=>item.name).join('、')||'-'},{key:'relation',label:'规则范围',children:'逐字段变化规则、事件定义、字段关联、时间连续性与事件一致性'},
    ]}/>} 
    <TemplateRulesTable modality={modality} template={template} rules={rules} title="质检规则"/>
  </TaskEvidencePanel>;
}

function QualityRulesEvidence({ template, modality, version }) {
  if(!version||!template)return null;
  const rules=taskQualityRules(templateQualityRules(modality,template));
  return <TaskEvidencePanel title={template.name} showReadOnly={false}>
    <Descriptions bordered size="small" column={1} items={[
      {key:'id',label:'模板 ID',children:<Text copyable>{template.id}</Text>},
      {key:'business',label:'业务类型',children:template.businessType||'-'},
      ...(template.method?[{key:'method',label:'模板制作方式',children:template.method}]:[]),
      {key:'count',label:'质检规则数量',children:`${rules.length} 条`},
    ]}/>
    <TemplateRulesTable key={`${template.id}-${version.version}`} modality={modality} template={template} rules={rules} title="质检规则"/>
  </TaskEvidencePanel>;
}

function QualityReportEvidence({dataset,version}){
  return <TaskEvidencePanel title={dataset?.name||'数据集'} showReadOnly={false}>{version?.qualityReport?<RuleQualityReport key={version.qualityReport.reportId} report={version.qualityReport} compact/>:<Empty description="请选择数据集版本和质检报告"/>}</TaskEvidencePanel>;
}

function ModelWithParameters({ form, modelName='generationModel', parameterSwitchName='generationParametersEnabled', parameterName='generationParameters', label='生成模型', models=['Qwen3-14B','Qwen3-VL-8B-Instruct','Doubao-Seedream-4.0','DeepSeek-V3.1'], initialModel }) {
  return <FormModelConfig form={form} modelName={modelName} parameterSwitchName={parameterSwitchName} parameterName={parameterName} label={label} options={models.map(value=>({value,label:value}))} initialModel={initialModel} allowEmpty help="关闭后沿用模板试运行参数；开启后用此处 JSON 覆盖。"/>;
}

function ApiEstimate({ items }) {
  const total=items.reduce((sum,item)=>sum+Number(item.value||0),0);
  return <Descriptions bordered size="small" column={Math.min(4,items.length+1)} items={[...items.map((item,index)=>({key:index,label:item.label,children:Number(item.value||0).toLocaleString()})),{key:'total',label:'调用预估（不含重试）',children:<Text strong>{total.toLocaleString()}</Text>}]}/>;
}

function ApiUsageSummary({ usage={} }) {
  return <Descriptions bordered size="small" column={3} items={[
    {key:'model',label:'模型调用次数',children:Number(usage.model||0).toLocaleString()},
    {key:'image',label:'图像模型调用次数',children:Number(usage.image||0).toLocaleString()},
    {key:'tokens',label:'调用 Tokens 数',children:usage.tokens===null?'未返回':Number(usage.tokens||0).toLocaleString()},
  ]}/>;
}

function evenDistribution(total, count) {
  if (!count) return [];
  const base = Math.floor(Number(total || 0) / count);
  const remainder = Number(total || 0) - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function defaultTaskSamplingAllocations(sampler, sampleCount) {
  const scenarios = sampler?.scenarios || [];
  const counts = evenDistribution(sampleCount, scenarios.length);
  const ratios = evenDistribution(100, scenarios.length);
  return scenarios.map((scenario, index) => ({ scenarioId: scenario.id, selected: true, targetCount: counts[index] || 0, targetRatio: ratios[index] || 0 }));
}

function defaultBranchAllocations(sampler) {
  return (sampler?.scenarios || []).flatMap(scenario => {
    const ratios = evenDistribution(100, (scenario.profiles || []).length);
    return (scenario.profiles || []).map((profile, index) => ({ scenarioId: scenario.id, profileId: profile.id, targetRatio: ratios[index] || 0 }));
  });
}

function defaultDimensionRatios(dimensions=[]){
  return dimensions.flatMap(dimension=>{
    const ratios=evenDistribution(100,(dimension.values||[]).length);
    return (dimension.values||[]).map((optionName,index)=>({dimensionId:dimension.dimension_id,optionId:dimension.option_ids?.[optionName]||optionName,optionName,targetRatio:ratios[index]||0}));
  });
}

function DimensionRatioSamplingCard({form,dimensions=[],sampleCount,title='按采样比例混合配置',conditionColumnWidth}){
  const values=Form.useWatch('dimensionSamplingRatios',form)||[];
  const map=new Map(values.map(item=>[`${item.dimensionId}:${item.optionId}`,item]));
  const update=(dimension,optionName,ratio)=>{
    const optionId=dimension.option_ids?.[optionName]||optionName;
    const key=`${dimension.dimension_id}:${optionId}`;
    const next=new Map(map);next.set(key,{dimensionId:dimension.dimension_id,optionId,optionName,targetRatio:Number(ratio||0)});
    form.setFieldValue('dimensionSamplingRatios',[...next.values()]);
  };
  const rows=dimensions.flatMap(dimension=>(dimension.values||[]).map(optionName=>{const optionId=dimension.option_ids?.[optionName]||optionName;const row=map.get(`${dimension.dimension_id}:${optionId}`)||{};return {key:`${dimension.dimension_id}:${optionId}`,dimension,optionId,optionName,targetRatio:Number(row.targetRatio||0)};}));
  const invalid=dimensions.filter(dimension=>(dimension.values||[]).reduce((sum,optionName)=>sum+Number(map.get(`${dimension.dimension_id}:${dimension.option_ids?.[optionName]||optionName}`)?.targetRatio||0),0)!==100);
  return <Card className="section-title" size="small" title={title}>
    <Alert type="info" showIcon message="每个维度分别配置条件占比" description="系统按占比分配并组合样本；适用条件和禁止条件仍由模板约束。条件维度只在适用样本内按比例分配，占比不代表全量数据占比。"/>
    <Form.Item name="dimensionSamplingRatios" hidden><Input/></Form.Item>
    <Table className="section-title" size="small" pagination={false} rowKey="key" dataSource={rows} scroll={conditionColumnWidth?{x:1000}:undefined} columns={[
      {title:'采样维度',width:180,render:(_,row)=><div><Text strong>{row.dimension.name}</Text><div className="muted-id">{row.dimension.dimension_id}</div></div>},
      {title:'枚举值',dataIndex:'optionName',width:180},
      {title:'目标占比',width:180,render:(_,row)=><InputNumber placeholder="请输入目标占比（0～100）" min={0} max={100} precision={0} addonAfter="%" value={row.targetRatio} onChange={value=>update(row.dimension,row.optionName,value)}/>},
      {title:'预计样本数',width:140,render:(_,row)=>`约 ${Math.round(Number(sampleCount||0)*row.targetRatio/100)} 条`},
      {title:'适用条件 / 禁止条件',width:conditionColumnWidth,render:(_,row)=><><div>{row.dimension.applicability_conditions||'所有样本'}</div>{row.dimension.prohibited_conditions&&<Text type="secondary">禁止：{row.dimension.prohibited_conditions}</Text>}</>},
    ]}/>
    {invalid.length?<Alert type="error" showIcon message={`以下维度占比合计必须为 100%：${invalid.map(item=>item.name).join('、')}`}/>:<Alert type="success" showIcon message="各维度比例配置完整"/>}
  </Card>;
}

function taskSamplingPlan(sampler, sampleCount, mode, allocations, advancedEnabled, branchAllocations) {
  const scenarios = sampler?.scenarios || [];
  const allocationMap = new Map((allocations || []).map(item => [item.scenarioId, item]));
  const branchMap = new Map((branchAllocations || []).map(item => [`${item.scenarioId}:${item.profileId}`, item]));
  const active = scenarios.filter(scenario => allocationMap.get(scenario.id)?.selected !== false);
  if (!active.length) return { rows: scenarios.map(item => ({ ...item, selected: false, ratio: 0, quota: 0, profiles: (item.profiles || []).map(profile => ({ ...profile, ratio: 0, quota: 0 })) })), error: '请至少选择一个子场景' };
  try {
    let activePlan;
    if (mode === 'count') {
      activePlan = active.map(scenario => {
        const allocation = allocationMap.get(scenario.id) || {};
        const quota = Math.max(0, Number(allocation.targetCount || 0));
        const profiles = (scenario.profiles || []).map(profile => ({ ...profile, weight: advancedEnabled ? Number(branchMap.get(`${scenario.id}:${profile.id}`)?.targetRatio || 0) : 1 }));
        const calculated = buildQuotaPlan({ scenarios: [{ ...scenario, weight: 1, profiles }] }, quota)[0];
        return { ...calculated, ratio: Number(sampleCount) > 0 ? quota / Number(sampleCount) : 0, quota };
      });
    } else {
      const weightedScenarios = active.map(scenario => {
        const allocation = allocationMap.get(scenario.id) || {};
        return {
          ...scenario,
          weight: mode === 'ratio' ? Number(allocation.targetRatio || 0) : 1,
          profiles: (scenario.profiles || []).map(profile => ({ ...profile, weight: advancedEnabled ? Number(branchMap.get(`${scenario.id}:${profile.id}`)?.targetRatio || 0) : 1 })),
        };
      });
      activePlan = buildQuotaPlan({ scenarios: weightedScenarios }, Number(sampleCount || 0));
    }
    const planMap = new Map(activePlan.map(item => [item.id, item]));
    return { rows: scenarios.map(scenario => {
      const allocation = allocationMap.get(scenario.id) || {};
      return planMap.get(scenario.id) || { ...scenario, selected: allocation.selected !== false, ratio: 0, quota: 0, profiles: (scenario.profiles || []).map(profile => ({ ...profile, ratio: 0, quota: 0 })) };
    }), error: '' };
  } catch (error) {
    return { rows: scenarios.map(scenario => ({ ...scenario, selected: allocationMap.get(scenario.id)?.selected !== false, ratio: 0, quota: 0, profiles: (scenario.profiles || []).map(profile => ({ ...profile, ratio: 0, quota: 0 })) })), error: error.message };
  }
}

function ConversationTaskSamplingCard({ form, sampler, sampleCount }) {
  const mode = Form.useWatch('samplingMode', form) || 'count';
  const allocations = Form.useWatch('samplingAllocations', form) || [];
  const advancedEnabled = Form.useWatch('samplingAdvancedEnabled', form);
  const branchAllocations = Form.useWatch('samplingBranchAllocations', form) || [];
  const { rows, error } = useMemo(() => taskSamplingPlan(sampler, sampleCount, mode, allocations, advancedEnabled, branchAllocations), [sampler, sampleCount, mode, allocations, advancedEnabled, branchAllocations]);
  if (sampler?.dimensions?.length) return <DimensionRatioSamplingCard form={form} dimensions={sampler.dimensions} sampleCount={sampleCount} title="事件采样比例"/>;
  const allocationMap = new Map(allocations.map(item => [item.scenarioId, item]));
  const branchMap = new Map(branchAllocations.map(item => [`${item.scenarioId}:${item.profileId}`, item]));
  const updateAllocation = (scenarioId, patch) => form.setFieldValue('samplingAllocations', (sampler.scenarios || []).map(scenario => ({ scenarioId: scenario.id, selected: true, targetCount: 0, targetRatio: 0, ...(allocationMap.get(scenario.id) || {}), ...(scenario.id === scenarioId ? patch : {}) })));
  const updateBranch = (scenarioId, profileId, patch) => {
    const key = `${scenarioId}:${profileId}`;
    const nextMap = new Map(branchAllocations.map(item => [`${item.scenarioId}:${item.profileId}`, item]));
    nextMap.set(key, { scenarioId, profileId, targetRatio: 0, ...(nextMap.get(key) || {}), ...patch });
    form.setFieldValue('samplingBranchAllocations', [...nextMap.values()]);
  };
  const rebalance = nextMode => {
    const activeScenarios = (sampler.scenarios || []).filter(scenario => allocationMap.get(scenario.id)?.selected !== false);
    const counts = evenDistribution(sampleCount, activeScenarios.length);
    const ratios = evenDistribution(100, activeScenarios.length);
    let activeIndex = 0;
    form.setFieldValue('samplingAllocations', (sampler.scenarios || []).map(scenario => {
      const current = allocationMap.get(scenario.id) || { scenarioId: scenario.id, selected: true };
      if (current.selected === false) return { ...current, targetCount: 0, targetRatio: 0 };
      const result = { ...current, targetCount: counts[activeIndex] || 0, targetRatio: ratios[activeIndex] || 0 };
      activeIndex += 1;
      return result;
    }));
    if (nextMode) form.setFieldValue('samplingMode', nextMode);
  };
  const selectedRows = rows.filter(row => allocationMap.get(row.id)?.selected !== false);
  const configuredTotal = mode === 'ratio' ? selectedRows.reduce((sum, row) => sum + Number(allocationMap.get(row.id)?.targetRatio || 0), 0) : mode === 'count' ? selectedRows.reduce((sum, row) => sum + Number(allocationMap.get(row.id)?.targetCount || 0), 0) : sampleCount;
  const distributionValid = mode === 'equal' || configuredTotal === (mode === 'ratio' ? 100 : Number(sampleCount));
  const columns = [
    { title: '选择', width: 58, render: (_, row) => <Checkbox checked={allocationMap.get(row.id)?.selected !== false} onChange={event => updateAllocation(row.id, { selected: event.target.checked })}/> },
    { title: '子场景', width: 190, render: (_, row) => <div><Text strong>{row.name}</Text><div className="muted-id">{row.id}</div></div> },
    { title: '场景目标', dataIndex: 'goal' },
    { title: '合法案例', width: 90, render: (_, row) => row.cases?.length || 0 },
    { title: '交互分支', width: 90, render: (_, row) => row.profiles?.length || 0 },
    ...(mode === 'ratio' ? [{ title: '目标占比', width: 135, render: (_, row) => <InputNumber placeholder="请输入目标占比（0～100）" min={0} max={100} precision={0} addonAfter="%" disabled={allocationMap.get(row.id)?.selected === false} value={allocationMap.get(row.id)?.targetRatio || 0} onChange={value => updateAllocation(row.id, { targetRatio: Number(value || 0) })}/> }] : []),
    ...(mode === 'count' ? [{ title: '目标数量', width: 135, render: (_, row) => <InputNumber placeholder="请输入目标数量（0～100000）" min={0} max={100000} precision={0} addonAfter="条" disabled={allocationMap.get(row.id)?.selected === false} value={allocationMap.get(row.id)?.targetCount || 0} onChange={value => updateAllocation(row.id, { targetCount: Number(value || 0) })}/> }] : []),
    { title: '折算占比', width: 105, render: (_, row) => `${((row.ratio || 0) * 100).toFixed(1)}%` },
    { title: '计划生成数', width: 110, render: (_, row) => `${row.quota || 0} 条` },
  ];
  const branchRows = selectedRows.flatMap(scenario => (scenario.profiles || []).map(profile => ({ ...profile, scenarioId: scenario.id, scenarioName: scenario.name })));
  return <Card size="small" title="采样分布配置" className="section-title">
    <Alert type="info" showIcon message="场景、合法案例和交互分支来自已发布模板" description="本任务只决定各子场景生成多少数据，不会修改模板定义的业务事实和合法组合。"/>
    <Form.Item name="samplingMode" label="分配方式" className="section-title" rules={[{ required: true }]}><Radio.Group optionType="button" buttonStyle="solid" onChange={event => rebalance(event.target.value)} options={[{value:'equal',label:'均匀分配'},{value:'ratio',label:'按比例分配'},{value:'count',label:'按数量分配'}]}/></Form.Item>
    <Flex justify="space-between" align="center"><Text type="secondary">按数量分配最直观；调整样本总数或勾选场景后，可以重新均匀填充。</Text><Button onClick={() => rebalance()}>均匀填充分配</Button></Flex>
    <Form.Item name="samplingAllocations" hidden><Input/></Form.Item><Form.Item name="samplingBranchAllocations" hidden><Input/></Form.Item>
    <Table className="section-title" rowKey="id" size="small" pagination={false} scroll={{ x: 1050 }} dataSource={rows} columns={columns}/>
    {error && (
      <Alert type="error" showIcon message={error}/>
    )}
    {!error && !distributionValid && (
      <Alert type="error" showIcon message={mode === 'ratio' ? `当前目标占比合计 ${configuredTotal}%，必须等于 100%` : `当前目标数量合计 ${configuredTotal} 条，必须等于样本总数 ${Number(sampleCount || 0)} 条`}/>
    )}
    <Flex justify="space-between" align="center" className="form-switch-line"><div><Text strong>自定义交互分支分布（高级配置）</Text><div><Text type="secondary">默认在每个子场景的合法交互分支中均匀分配</Text></div></div><Form.Item name="samplingAdvancedEnabled" valuePropName="checked" noStyle><Switch/></Form.Item></Flex>
    {advancedEnabled && <Table rowKey={row => `${row.scenarioId}:${row.id}`} size="small" pagination={false} dataSource={branchRows} columns={[{title:'子场景',dataIndex:'scenarioName'},{title:'交互分支',render:(_,row)=><div><Text>{row.name}</Text><div className="muted-id">{row.id}</div></div>},{title:'目标占比',width:180,render:(_,row)=><InputNumber placeholder="请输入目标占比（0～100）" min={0} max={100} addonAfter="%" value={branchMap.get(`${row.scenarioId}:${row.id}`)?.targetRatio || 0} onChange={value=>updateBranch(row.scenarioId,row.id,{targetRatio:Number(value||0)})}/>}]} />}
    <Descriptions className="section-title" bordered size="small" column={3} items={[{key:'stage1',label:'阶段一事件生成',children:`${sampleCount} 次`},{key:'stage2',label:'阶段二完整对话',children:`${sampleCount} 次`},{key:'mock',label:'Mock 实际调用',children:'0 次'}]}/>
  </Card>;
}

function normalizePublishedTemplate(item,modality){
  const config=item.configuration||item.selected_version?.configuration_v2||item.selected_version?.configuration||{};
  const identity=config.identity||{};
  return {...item,id:item.id||item.template_id,name:item.name||identity.name||config.name,businessType:item.businessType||item.business_type||identity.business_type||config.business_type,version:item.version||item.selected_version?.version||'V1',description:item.description||identity.description||config.description||'',configuration:config,outputFormat:modality==='对话文本'?'Messages 对话格式 · JSONL':item.outputFormat||'JSONL',defaultModel:item.defaultModel||config.trial_config?.model?.alias||config.trial_config?.model_alias||'Qwen3-14B'};
}

function SemanticCustomRules({form,name,legacyPrefix}){
  const legacy=form.getFieldValue(legacyPrefix+'Enabled')?[{name:form.getFieldValue(legacyPrefix+'Name')||'',prompt:form.getFieldValue(legacyPrefix+'Prompt')||''}]:[];
  return <Form.List name={name} initialValue={legacy}>{(fields,{add,remove})=><div className="section-title">
    <Flex justify="space-between" align="center" style={{marginBottom:12}}><Text strong>自定义语义增强规则</Text><Button onClick={()=>add({name:'',prompt:''})}>添加规则</Button></Flex>
    {fields.map((field,index)=><Card key={field.key} size="small" title={`规则 ${index+1}`} style={{marginBottom:12}} extra={<Button type="link" danger onClick={()=>remove(field.name)}>删除</Button>}>
      <Form.Item name={[field.name,'name']} label="规则名称" rules={[{required:true,whitespace:true,message:'请输入规则名称'}]}><Input maxLength={80} placeholder="填写规则名称"/></Form.Item>
      <Form.Item name={[field.name,'prompt']} label="增强 Prompt" rules={[{required:true,whitespace:true,message:'请输入增强 Prompt'}]}><Input.TextArea rows={3} placeholder="描述需要如何增强内容"/></Form.Item>
    </Card>)}
  </div>}</Form.List>;
}
function MandatoryPrivacyOption() {
  return <Tooltip title="系统固定执行隐私检查，并按各检测规则的处理方式处理命中内容，不可取消。"><span><Checkbox className="mandatory-privacy-checkbox" checked disabled>隐私增强</Checkbox></span></Tooltip>;
}
function EnhancementTypes({value=[],onChange}) {
  return <Space wrap><Checkbox.Group value={value} onChange={onChange} options={['图像增强','语义增强','背景增强']}/></Space>;
}
function PrivacyHandlingRules({form,rows=[],sampleCount=1000}) {
  const rules=conversationCatalogRules().filter(r=>r.category==='隐私质检'&&!r.example);
  const legacy=form.getFieldValue('privacyMethods')||{};
  const fallback=form.getFieldValue('conversationPrivacyMethod')||form.getFieldValue('timeseriesPrivacyMethod');
  return <Table rowKey="id" size="small" pagination={false} dataSource={rules} columns={[
    {title:'检测规则',render:(_,r)=><span>{r.name}<span className="muted-id"> · {r.id}</span></span>},
    {title:'命中次数',width:110,render:(_,r)=>{const match=rows.find(x=>x.id===r.id||x.name===r.name);return match?.hitCount??match?.occurrenceCount??(Math.ceil(Math.min(sampleCount,Number(r.id.slice(1))*83%900+64)*1.4));}},
    {title:'涉及样本数',width:120,render:(_,r)=>{const match=rows.find(x=>x.id===r.id||x.name===r.name);return match&&!match.unavailable?(match.counts?.FAIL??(Math.min(sampleCount,Number(r.id.slice(1))*83%900+64))):(Math.min(sampleCount,Number(r.id.slice(1))*83%900+64));}},
    {title:'处理方式',width:220,render:(_,r)=>{
      const old=Object.entries(legacy).find(([name])=>r.name.includes(name))?.[1];
      return <Form.Item name={['privacyMethods',r.name]} initialValue={old||fallback||'部分掩码'} noStyle><Select placeholder="请选择处理方式" aria-label={`${r.name}处理方式`} style={{width:'100%'}} options={['部分掩码','全掩码','删除','泛化','随机替换','虚构替换'].map(value=>({value,label:value}))}/></Form.Item>;
    }}
  ]}/>;
}
function PrivacyRuleSummary({rows=[],methods=false}) {
  const data=rows.filter(r=>r.privacy||r.category==='隐私质检');
  return <div className="privacy-summary"><Table rowKey="id" size="small" pagination={false} dataSource={data} columns={[
    {title:'隐私规则',render:(_,r)=><>{r.name}<div className="muted-id">{r.id}</div></>},
    {title:'命中次数',render:(_,r)=>r.hitCount??r.occurrenceCount??'未记录'},
    {title:'涉及样本数',render:(_,r)=>r.unavailable?'未记录':r.counts?.FAIL??0},
    ...(methods?[{title:'处理方式',render:(_,r)=><Form.Item name={['privacyMethods',r.name]} initialValue="部分掩码" noStyle><Select placeholder="请选择处理方式" style={{width:150}} options={['部分掩码','全掩码','删除','泛化','随机替换','虚构替换'].map(value=>({value,label:value}))}/></Form.Item>}]:[])
  ]}/><Text type="secondary" className="form-help">次数统计检测对象，样本数按单条规则去重；历史报告未记录次数时不作推算。不同规则的样本数不可直接相加。</Text></div>;
}

function CreateTaskPage({ draft, datasets, onCancel, onSubmit, onSaveDraft }) {
  const [workspaceTab,setWorkspaceTab]=useState("configure");
  const [basisOpen,setBasisOpen]=useState(false),[basisTab,setBasisTab]=useState('report');
  const openBasis=tab=>{setBasisTab(tab);setBasisOpen(true);};
  const [submitting,setSubmitting]=useState(false);
  const [publishedTemplates,setPublishedTemplates]=useState(()=>templatesForModality(draft.modality));
  const [form]=Form.useForm();
  const isSynthesis=draft.taskType==='数据合成';
  const automaticQuality=Form.useWatch('autoQualityEnabled',form);
  const isQuality=draft.taskType==='数据质检';
  const isAugmentation=draft.taskType==='数据增强';
  const isExpansion=draft.taskType==='定向扩增';
  const modalityLabel=modalityLabelMap[draft.modality]||draft.modality;
  const taskPageTitle=`新建${modalityLabel}${modalityLabel.endsWith('数据')&&draft.taskType.startsWith('数据')?draft.taskType.slice(2):draft.taskType}任务`;
  const templateId=Form.useWatch('templateId',form);
  const inputDatasetId=Form.useWatch('inputDatasetId',form);
  const inputVersionId=Form.useWatch('inputVersionId',form);
  const customEnhancementEnabled=Form.useWatch('customEnhancementEnabled',form);
  const documentEnhancementTypes=Form.useWatch('documentEnhancementTypes',form)||[];
  // Subscribe on every render; toggling the panel must not change Hook order.
  const documentSemanticRules=Form.useWatch('documentSemanticRules',form)||[];
  const documentSemanticCustomEnabled=Form.useWatch('documentSemanticCustomEnabled',form);
  const documentBackgroundCustomEnabled=Form.useWatch('documentBackgroundCustomEnabled',form);
  const timeseriesEventCustomEnabled=Form.useWatch('timeseriesEventCustomEnabled',form);
  const timeseriesParameterCustomEnabled=Form.useWatch('timeseriesParameterCustomEnabled',form);
  const customExpansionEnabled=Form.useWatch('customExpansionEnabled',form);
  const overrideBackgroundGeneration=Form.useWatch('overrideBackgroundGeneration',form);
  const customExpansionSettings=Form.useWatch('customExpansionSettings',form)||[];
  const sampleCount=Number(Form.useWatch('sampleCount',form)||0);
  const samplingMode=Form.useWatch('samplingMode',form)||'count';
  const samplingAllocations=Form.useWatch('samplingAllocations',form)||[];
  const samplingAdvancedEnabled=Form.useWatch('samplingAdvancedEnabled',form);
  const samplingBranchAllocations=Form.useWatch('samplingBranchAllocations',form)||[];
  const targetCount=Number(Form.useWatch('targetCount',form)||0);
  const qualityScope=Form.useWatch('qualityScope',form)||'full';
  const samplingRatio=Number(Form.useWatch('samplingRatio',form)||10);
  const eligibleDatasets=useMemo(()=>datasets.filter(dataset=>dataset.modality===draft.modality&&dataset.templateId),[datasets,draft.modality]);
  const selectedDataset=eligibleDatasets.find(dataset=>dataset.id===inputDatasetId);
  const sourceTemplateVersion=selectedDataset?.versions.find(item=>item.version===inputVersionId);
  const selectedTemplate=isSynthesis?publishedTemplates.find(item=>item.id===templateId):(sourceTemplateVersion?.taskConfigSnapshot?.templateProfile||sourceTemplateVersion?.sampleExecution?.configSnapshot?.templateProfile||publishedTemplates.find(item=>item.id===(sourceTemplateVersion?.templateId||selectedDataset?.templateId)&&(!sourceTemplateVersion?.templateVersion||item.version===sourceTemplateVersion.templateVersion))||templateForDataset(selectedDataset));
  const rawSelectedVersion=sourceTemplateVersion;
  const availableReports=useMemo(()=>versionReportsForDisplay(selectedDataset||{},rawSelectedVersion),[selectedDataset,rawSelectedVersion]);
  const reportSelectionId=Form.useWatch('qualityReportId',form);
  const lockedReport=availableReports.find(report=>report.reportId===reportSelectionId)||preferredQualityReport(availableReports);
  const effectiveQualityRules=taskQualityRules((isAugmentation||isExpansion)&&lockedReport?.ruleSnapshot?.length?lockedReport.ruleSnapshot:templateQualityRules(draft.modality,selectedTemplate));
  const semanticRuleCount=effectiveQualityRules.filter(rule=>/LLM|VLM|Embedding|语义|模型|semantic|vlm/i.test(`${rule.method||''}${rule.engine||''}${rule.mode||''}`)).length;
  const qualityReportId=reportSelectionId;
  const selectedReport=availableReports.find(report=>report.reportId===qualityReportId)||preferredQualityReport(availableReports);
  const selectedVersion=(isAugmentation||isExpansion)?versionWithReport(rawSelectedVersion,selectedReport):rawSelectedVersion;
  useEffect(()=>{
    if(!isAugmentation&&!isExpansion)return;
    const existing=form.getFieldValue('qualityReportId');
    if(!availableReports.some(report=>report.reportId===existing)||availableReports.some(report=>report.protocolVersion===2)&&availableReports.find(report=>report.reportId===existing)?.protocolVersion!==2)
      form.setFieldValue('qualityReportId',preferredQualityReport(availableReports)?.reportId);
  },[inputDatasetId,inputVersionId,availableReports,form,isAugmentation,isExpansion]);
  const selectedVersionSampleCount=numericSampleCount(selectedVersion?.samples);
  const qualityCheckedSampleCount=qualityScope==='full'?selectedVersionSampleCount:Math.min(selectedVersionSampleCount,Math.max(1,Math.ceil(selectedVersionSampleCount*samplingRatio/100)));
  const qualityUncheckedSampleCount=Math.max(0,selectedVersionSampleCount-qualityCheckedSampleCount);
  const conversationSampler=selectedTemplate?.configuration?.sampler||defaultConversationSampler();
  const timeseriesDimensions=selectedTemplate?.configuration?.event_generation?.sampling_dimensions||[];
  const generationMethod=selectedTemplate?.configuration?.generation?.method||'model';
  const conversationSamplingState=useMemo(()=>draft.modality==='对话文本'?taskSamplingPlan(conversationSampler,sampleCount,samplingMode,samplingAllocations,samplingAdvancedEnabled,samplingBranchAllocations):{rows:[],error:''},[conversationSampler,draft.modality,sampleCount,samplingMode,samplingAllocations,samplingAdvancedEnabled,samplingBranchAllocations]);
  const datasetOptions=eligibleDatasets.filter(dataset=>{
    if(isQuality)return dataset.versions.some(published);
    if(isAugmentation)return dataset.versions.some(isQualityCheckedVersion);
    if(isExpansion)return dataset.versions.some(isQualityCheckedVersion);
    return true;
  }).map(dataset=>({value:dataset.id,label:`${dataset.name} / ${dataset.id}`}));
  const versionOptions=(selectedDataset?.versions||[]).filter(version=>{
    if(!published(version))return false;
    if(isQuality)return Boolean(selectedDataset.templateId);
    if(isAugmentation)return isQualityCheckedVersion(version);
    if(isExpansion)return isQualityCheckedVersion(version);
    return true;
  }).map(version=>({value:version.version,label:`${version.version} · ${numericSampleCount(version.samples).toLocaleString()} 条 · ${version.versionKind||'数据版本'}`}));
  const selectionRules=reportRuleRows(selectedReport).filter(r=>!r.unavailable);
  const [augmentationMode,setAugmentationMode]=useState('pass'),[augmentationThreshold,setAugmentationThreshold]=useState(100);
  const [includeUnchecked,setIncludeUnchecked]=useState(false);
  useEffect(()=>setIncludeUnchecked(false),[inputDatasetId,inputVersionId,selectedReport?.reportId]);
  useEffect(()=>{setAugmentationMode('pass');setAugmentationThreshold(100);},[inputDatasetId,inputVersionId,selectedReport?.reportId]);
  const augmentationCandidates=useMemo(()=>augmentationPool(selectedReport,augmentationMode,augmentationThreshold),[selectedReport,augmentationMode,augmentationThreshold]);
  const selectableCount=isAugmentation?augmentationCandidates.count+(includeUnchecked?augmentationCandidates.uncheckedCount:0):0;
  useEffect(()=>{
    if(!isAugmentation||!inputVersionId||!selectedVersion)return;
    const current=form.getFieldValue('targetCount');
    const next=selectableCount;
    if(current!==next)form.setFieldValue('targetCount',next);
  },[form,isAugmentation,inputDatasetId,inputVersionId,selectableCount]);
  const privacyHits=selectionRules.filter(r=>r.privacy||r.category==='隐私质检').reduce((n,r)=>n+r.counts.FAIL,0);
  const coverageGaps=selectedVersion?.qualityReport?.coverageGaps||[];
  const selectedGapKeys=Form.useWatch('coverageGapKeys',form)||[];
  const [expansionTargetConfig,setExpansionTargetConfig]=useState(()=>draft.configSnapshot?.expansionTargetConfig||{});
  const expansionSource=String(inputDatasetId)+'/'+inputVersionId+'/'+reportSelectionId;
  const previousExpansionSource=useRef(expansionSource);
  useEffect(()=>{if(previousExpansionSource.current!==expansionSource){form.setFieldValue('coverageGapKeys',[]);form.setFieldValue('labelTargetCount',null);setExpansionTargetConfig({});previousExpansionSource.current=expansionSource;}},[expansionSource,form]);
  const qualityExpansionTargets=expansionTargets(selectedReport).filter(r=>r.kind==='规则不通过');
  const expansionTargetRows=useMemo(()=>expansionTargets(selectedReport),[selectedReport]);
  const [expansionTargetKind,setExpansionTargetKind]=useState('规则不通过'),[expansionEvidence,setExpansionEvidence]=useState(null);
  const actualTargetKind=expansionTargetKind;
  const visibleExpansionTargets=expansionTargetRows.filter(r=>r.kind===actualTargetKind);
  const targetConfigFor=row=>expansionTargetConfig[row.key]||{};
  const suggestedGapFor=row=>expansionCount(row,targetConfigFor(row));
  const selectedGapTotal=expansionTargetRows.filter(item=>selectedGapKeys.includes(item.key)).reduce((sum,item)=>sum+suggestedGapFor(item),0);
  const customExpansionTotal=customExpansionEnabled?customExpansionSettings.reduce((sum,item)=>sum+Number(item?.count||0),0):0;
  const expansionEstimate=selectedGapTotal+customExpansionTotal;

  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try{
        const result=draft.modality==='对话文本'?await conversationApi.listTemplates():draft.modality==='时序数据'?await coldchainApi.listTemplates():null;
        if(!active||!result)return;
        const preferred=draft.modality==='对话文本'?'CONVTPL-LOGISTICS-DEMO-V2':'COLDTPL-REEFER-MODEL-DEMO-V2';
        const seed=(result.items||[]).find(item=>item.template_id===preferred);
        const profile=templatesForModality(draft.modality)[0];
        const items=seed?[{...normalizePublishedTemplate(seed,draft.modality),id:profile.id,name:profile.name}]:[];
        if(items.length)setPublishedTemplates(items);
      }catch(error){message.error(`已发布模板读取失败：${error.message}`);}
    };
    load();return()=>{active=false;};
  },[draft.modality]);

  useEffect(()=>{
    if(!isSynthesis)return;
    const template=publishedTemplates.find(item=>item.id===templateId)||publishedTemplates[0];
    if(!template)return;
    if(draft.configSnapshot&&templateId===draft.configSnapshot.templateId){form.setFieldsValue({businessType:template.businessType});return;}
    const sampler=template.configuration?.sampler||defaultConversationSampler();
    const dimensions=draft.modality==='时序数据'?template.configuration?.event_generation?.sampling_dimensions||[]:sampler.dimensions||[];
    form.setFieldsValue({templateId:template.id,businessType:template.businessType,generationModel:template.defaultModel,imageGenerationModel:template.imageModel,backgroundPrompt:template.backgroundPrompt,overrideBackgroundGeneration:false,dimensionSamplingRatios:defaultDimensionRatios(dimensions),...(draft.modality==='对话文本'?{samplingMode:'ratio',samplingAllocations:defaultTaskSamplingAllocations(sampler,Number(form.getFieldValue('sampleCount')||20)),samplingAdvancedEnabled:false,samplingBranchAllocations:defaultBranchAllocations(sampler)}:{})});
  },[draft.configSnapshot,draft.modality,form,isSynthesis,templateId,publishedTemplates]);
  useEffect(()=>{
    if(!selectedDataset)return;
    const template=templateForDataset(selectedDataset);
    form.setFieldsValue({businessType:selectedDataset.businessType,templateId:template?.id,targetDataset:selectedDataset.name,...(isQuality&&inputVersionId?{versionNote:`基于 ${inputVersionId} 的质检标注版本`}:{})});
    if(inputVersionId&&!selectedDataset.versions.some(version=>version.version===inputVersionId))form.setFieldValue('inputVersionId',undefined);
  },[form,inputDatasetId,selectedDataset,inputVersionId,isQuality]);
  useEffect(()=>{
    if(!draft.inputDatasetId)return;
    form.setFieldsValue({inputDatasetId:draft.inputDatasetId,inputVersionId:draft.inputVersionId});
  },[draft.inputDatasetId,draft.inputVersionId,form]);
  useEffect(()=>{
    if(!isAugmentation||draft.modality!=='文档图像')return;
    const current=form.getFieldsValue(['documentSemanticRules','semanticEnhancementModel','semanticEnhancementParametersEnabled','semanticEnhancementParameters','backgroundEnhancementModel']);
    form.setFieldsValue({
      documentSemanticRules:current.documentSemanticRules||['SEM-FIELD-COMBINATION'],
      semanticEnhancementModel:current.semanticEnhancementModel||'Qwen3-VL-8B-Instruct',
      semanticEnhancementParametersEnabled:current.semanticEnhancementParametersEnabled??false,
      semanticEnhancementParameters:current.semanticEnhancementParameters||'{\n  "temperature": 0.4,\n  "top_p": 0.9\n}',
      backgroundEnhancementModel:current.backgroundEnhancementModel||'Doubao-Seedream-4.0',
    });
  },[draft.modality,form,isAugmentation]);
  useEffect(()=>{
    if(isExpansion&&draft.modality==='文档图像'&&!draft.configSnapshot)form.setFieldValue('expansionModel','Doubao-Seedream-4.0');
  },[draft.configSnapshot,draft.modality,form,isExpansion]);

  const qualityNeeds=qualityModelNeeds(effectiveQualityRules);
  const automaticQualityCard=!isQuality&&<Card className="task-step-card section-title" title={isSynthesis?'自动质检':'自动复检'} extra={<Form.Item name="autoQualityEnabled" valuePropName="checked" noStyle><Switch aria-label={isSynthesis?'开启自动质检':'开启自动复检'}/></Form.Item>}>
    <Text type="secondary" className="form-help">开启后按模板规则检查本次输出，结果与报告保存在同一版本。</Text>
    {automaticQuality&&<div className="quality-model-fields">
      {qualityNeeds.semantic&&<ModelWithParameters form={form} modelName="qualityModel" models={['Qwen3-14B','DeepSeek-V3.1']} initialModel="Qwen3-14B" parameterSwitchName="qualityParametersEnabled" parameterName="qualityParameters" label="语义质检模型"/>}
      {qualityNeeds.vlm&&<ModelWithParameters form={form} modelName="qualityVlmModel" models={['Qwen3-VL-8B-Instruct']} initialModel="Qwen3-VL-8B-Instruct" parameterSwitchName="qualityVlmParametersEnabled" parameterName="qualityVlmParameters" label="图像理解模型（VLM）"/>}
      {qualityNeeds.embedding&&<ModelConfigField><Form.Item name="qualityEmbeddingModel" label="Embedding 模型" initialValue="bge-m3" rules={[{required:true}]}><Select placeholder="请选择Embedding 模型" options={[{value:'bge-m3',label:'bge-m3'}]}/></Form.Item></ModelConfigField>}
      {!qualityNeeds.semantic&&!qualityNeeds.vlm&&!qualityNeeds.embedding&&<Text type="secondary">当前规则为函数检查，无需模型。</Text>}
    </div>}
  </Card>;
  const inputCard=!isSynthesis&&<Card className="task-step-card" title="选择输入数据版本">
    <Alert type="info" showIcon message="请选择本次任务的输入数据集和确定版本" description={isQuality?'可选择已绑定模板的数据版本。':'可选择已完成质检并具备样本级质检标签的版本，支持全量质检和部分抽检。'}/>
    <Row gutter={16} className="section-title"><Col span={12}><Form.Item name="inputDatasetId" label="输入数据集" rules={[{required:true,message:'请选择输入数据集'}]}><Select placeholder="请选择输入数据集" showSearch optionFilterProp="label" options={datasetOptions}/></Form.Item></Col><Col span={12}><Form.Item name="inputVersionId" label="版本 ID" rules={[{required:true,message:'请选择版本 ID'}]}><Select placeholder="请选择版本 ID" showSearch optionFilterProp="label" options={versionOptions} disabled={!selectedDataset}/></Form.Item></Col></Row>
    {(isAugmentation||isExpansion)&&<Form.Item name="qualityReportId" label="质检报告" rules={[{required:true,message:'请选择质检报告'}]}><Select placeholder="请选择质检报告" disabled={!rawSelectedVersion} options={availableReports.map((report,index)=>({value:report.reportId,label:`${report.reportId} · ${report.createdAt||'-'}${index===0?'（最新）':''}`}))} onChange={()=>form.setFieldsValue({coverageGapKeys:[]})}/></Form.Item>}
    {selectedVersion&&(isQuality||selectedReport)&&<TaskBasisSummary quality={isQuality} report={selectedReport} template={selectedTemplate} rules={effectiveQualityRules} onOpen={openBasis}/>}
  </Card>;

  const synthesisFields=<>
    <Card className="task-step-card" title="已发布模板与生成设置">
      <Form.Item name="templateId" label="已发布模板" rules={[{required:true,message:'请选择已发布模板'}]}><Select placeholder="请选择已发布模板" showSearch optionFilterProp="label" options={publishedTemplates.map(template=>({value:template.id,label:`${template.name} · ${template.businessType}`}))}/></Form.Item>
      <Divider orientation="left">本次批量生成设置</Divider>
      <Row gutter={16}><Col span={8}><Form.Item name="sampleCount" label={`样本数量（${draft.modality==='文档图像'?'张':draft.modality==='时序数据'?'条':'条'}）`} rules={[{required:true}]}><InputNumber placeholder="请输入数值（1～100000）" min={1} max={100000} style={{width:'100%'}}/></Form.Item></Col>{draft.modality==='文档图像'&&<><Col span={8}><Form.Item name="resolution" label="成品分辨率"><Select placeholder="请选择成品分辨率" options={['2480 × 1754','3508 × 2480','自定义'].map(value=>({value,label:value}))}/></Form.Item></Col><Col span={8}><Form.Item name="patternRatio" label="图案 / 印章出现比例"><InputNumber placeholder="请输入图案 / 印章出现比例（0～100）" min={0} max={100} addonAfter="%" style={{width:'100%'}}/></Form.Item></Col></>}{draft.modality==='对话文本'&&<><Col span={8}><Form.Item name="minTurns" label="最少对话轮数" rules={[{required:true}]}><InputNumber placeholder="请输入最少对话轮数（不小于 1）" min={1} style={{width:'100%'}}/></Form.Item></Col><Col span={8}><Form.Item name="maxTurns" dependencies={['minTurns']} label="最多对话轮数" rules={[{required:true},{validator:(_,value)=>Number(value)>=Number(form.getFieldValue('minTurns'))?Promise.resolve():Promise.reject(new Error('不能小于最少对话轮数'))}]}><InputNumber placeholder="请输入最多对话轮数（不小于 1）" min={1} style={{width:'100%'}}/></Form.Item></Col></>}{draft.modality==='时序数据'&&<><Col span={8}><Form.Item name="minTimeSteps" label="最少时序步数" rules={[{required:true}]}><InputNumber placeholder="请输入最少时序步数（不小于 2）" min={2} precision={0} style={{width:'100%'}}/></Form.Item></Col><Col span={8}><Form.Item name="maxTimeSteps" dependencies={['minTimeSteps']} label="最多时序步数" rules={[{required:true},{validator:(_,value)=>Number(value)>=Number(form.getFieldValue('minTimeSteps'))?Promise.resolve():Promise.reject(new Error('不能小于最少时序步数'))}]}><InputNumber placeholder="请输入最多时序步数（不小于 2）" min={2} precision={0} style={{width:'100%'}}/></Form.Item></Col><Col span={8}><Form.Item name="stepMinutes" label="采样间隔" rules={[{required:true}]}><Select placeholder="请选择采样间隔" options={[10,15,30,60].map(value=>({value,label:`每 ${value} 分钟`}))}/></Form.Item></Col></>}</Row>
      {draft.modality==='时序数据'&&<><Descriptions bordered size="small" column={1} items={[{key:'method',label:'模板生成方式',children:<Tag color={generationMethod==='engine'?'cyan':'blue'}>{generationMethod==='engine'?'引擎生成':'模型生成'}</Tag>}]}/><Form.Item className="section-title" label="模板输出字段"><Input.TextArea autoSize={{minRows:2,maxRows:5}} value={(selectedTemplate?.configuration?.fields||[]).filter(item=>item.enabled!==false).map(item=>`${item.label||item.field_id}${item.unit?`（${item.unit}）`:''}`).join('、')||'-'} disabled/></Form.Item><DimensionRatioSamplingCard form={form} dimensions={timeseriesDimensions} sampleCount={sampleCount} title="事件采样比例" conditionColumnWidth={320}/></>}
      {draft.modality==='对话文本'&&<><Form.Item label="输出数据格式"><Input value={selectedTemplate?.outputFormat||'-'} disabled/></Form.Item><ConversationTaskSamplingCard form={form} sampler={conversationSampler} sampleCount={sampleCount}/></>}
      <ModelWithParameters form={form} label={draft.modality==='时序数据'?(generationMethod==='engine'?'阶段一事件生成模型':'两阶段生成模型'):'生成模型'}/>
      {draft.modality==='文档图像'&&selectedTemplate?.method==='底图生成法'&&<><Divider orientation="left">底图生成配置</Divider><Flex justify="space-between" align="center" className="form-switch-line"><div><Text strong>任务级覆盖</Text><div><Text type="secondary">默认锁定模板中的图像模型和底图 Prompt；开启后仅覆盖本次任务。</Text></div></div><Form.Item name="overrideBackgroundGeneration" valuePropName="checked" noStyle><Switch/></Form.Item></Flex><Row gutter={16}><Col span={8}><ModelConfigField><Form.Item name="imageGenerationModel" label="图像生成模型"><Select placeholder="请选择图像生成模型" disabled={!overrideBackgroundGeneration} options={['Doubao-Seedream-4.0','Qwen-Image'].map(value=>({value,label:value}))}/></Form.Item></ModelConfigField></Col><Col span={16}><Form.Item name="backgroundPrompt" label="底图生成 Prompt"><Input.TextArea placeholder="描述底图生成 Prompt，说明目标、约束和输出要求" rows={4} disabled={!overrideBackgroundGeneration}/></Form.Item></Col></Row></>}
      <Divider orientation="left">配置来源</Divider><Alert type="info" showIcon message="业务类型、结构、字段和规则来自模板" description="本页只覆盖样本规模和运行参数；增强、质检与定向扩增已拆分为独立任务。"/>
      <Divider orientation="left">API 调用次数预估</Divider><ApiEstimate items={[{label:draft.modality==='时序数据'&&generationMethod==='engine'?'阶段一事件生成模型':'生成模型',value:draft.modality==='对话文本'||(draft.modality==='时序数据'&&generationMethod==='model')?sampleCount*2:sampleCount},{label:'图像模型',value:draft.modality==='文档图像'&&selectedTemplate?.method==='底图生成法'?sampleCount:0},...(automaticQuality?[{label:'质检模型',value:sampleCount*semanticRuleCount}]:[])]}/>
    </Card>
    <Card className="task-step-card section-title" title="结果写入"><OutputConfig form={form} datasets={datasets.filter(dataset=>dataset.templateId===selectedTemplate?.id)} modality={draft.modality}/></Card>
  </>;

  const qualityFields=<><Card className="task-step-card section-title" title="质检运行设置">
    <Form.Item name="qualityScope" label="质检范围" rules={[{required:true}]}><Radio.Group optionType="button" buttonStyle="solid" options={[{value:'full',label:'全量质检'},{value:'sample',label:'部分抽检'}]}/></Form.Item>
    {qualityScope==='sample'&&<Row gutter={16}><Col span={8}><Form.Item name="samplingRatio" label="抽检比例" rules={[{required:true,message:'请输入抽检比例'}]}><InputNumber placeholder="请输入抽检比例（1～100）" min={1} max={100} precision={0} addonAfter="%" style={{width:'100%'}}/></Form.Item></Col></Row>}
    <Descriptions bordered size="small" column={3} items={[{key:'range',label:'质检执行范围',children:<Tag color={qualityScope==='full'?'blue':'orange'}>{qualityScope==='full'?'全部数据':`部分抽检 ${samplingRatio}%`}</Tag>},{key:'total',label:'全部样本',children:selectedVersionSampleCount.toLocaleString()},{key:'sample',label:'预计检查样本',children:qualityCheckedSampleCount.toLocaleString()}]}/>

    {semanticRuleCount>0?<><Divider orientation="left">质检执行模型</Divider><ModelWithParameters form={form} modelName="qualityModel" parameterSwitchName="qualityParametersEnabled" parameterName="qualityParameters" label={draft.modality==='文档图像'?'语义质检模型':'质检模型'}/>{draft.modality==='文档图像'&&<div className="section-title"><ModelWithParameters form={form} modelName="qualityVlmModel" initialModel="Qwen3-VL-8B-Instruct" models={['Qwen3-VL-8B-Instruct']} parameterSwitchName="qualityVlmParametersEnabled" parameterName="qualityVlmParameters" label="VLM 图像质检模型"/></div>}</>:<Alert className="section-title" type="info" showIcon message="当前模板仅包含本地确定性规则，无需配置质检模型"/>}
    {draft.modality==='对话文本'&&effectiveQualityRules.some(rule=>/Embedding/.test(`${rule.method||''}${rule.engine||''}${rule.mode||''}`))&&<ModelConfigField><Form.Item name="qualityEmbeddingModel" initialValue="text-embedding-v3" label="Embedding 检测模型" rules={[{required:true,message:'请选择 Embedding 检测模型'}]}><Select placeholder="请选择Embedding 检测模型" options={[{value:'text-embedding-v3',label:'text-embedding-v3'}]}/></Form.Item></ModelConfigField>}
  </Card><Card className="task-step-card section-title" title="报告保存位置"><Descriptions bordered size="small" column={1} items={[
      {key:'dataset',label:'数据集名称',children:selectedDataset?.name||'-'},
      {key:'id',label:'数据集 ID',children:selectedDataset?.id||'-'},
      {key:'version',label:'版本 ID',children:selectedVersion?.version||'-'},
    ]}/><Text type="secondary">质检结果新增为独立文件，原始文件保持不变。</Text>
  </Card></>;

  const conversationSemanticMethods=['表达同义改写','无关上下文注入','规则绕过对抗样本'];
  const timeseriesEventSemanticMethods=['计划性断网上报'];
  const timeseriesParameterMethods=['传感器轻微抖动','时间平移','GPS 微扰'];
  const documentSemanticPresetRules=[
    {id:'SEM-FIELD-COMBINATION',name:'业务字段组合变体',prompt:'在不改变模板字段契约和业务逻辑的前提下，生成新的合理业务字段组合，并同步更新图像文字与 Ground Truth。'},
    {id:'SEM-LONG-TEXT',name:'长文本字段语义改写',prompt:'对备注、商品描述等长文本字段进行语义等价改写，保持事实、数字、代码和字段含义一致。'},
    {id:'SEM-RARE-VALUE',name:'稀缺字段取值补充',prompt:'根据模板允许的枚举和字段依赖关系，生成低覆盖但合法的字段取值组合。'},
  ];
  const documentImageMethods=['文档退化','旋转 / 透视 / 亮度变化','折痕','扫描 / 复印','污渍'];
  const documentAugmentationConfig=<DocumentAugmentationScheme form={form} presets={documentSemanticPresetRules}/>;
  const conversationAugmentationConfig=<TextAugmentationScheme form={form} groups={[{title:'语义增强',field:'conversationSemanticMethods',custom:'conversationSemanticCustomRules',legacy:'customEnhancement',options:conversationSemanticMethods,defaults:['表达同义改写']}]}/>;
  const timeseriesAugmentationConfig=<TextAugmentationScheme form={form} groups={[{title:'事件语义增强',field:'timeseriesEventMethods',custom:'timeseriesEventCustomRules',legacy:'timeseriesEventCustom',options:timeseriesEventSemanticMethods,defaults:['计划性断网上报']},{title:'输出参数增强',field:'timeseriesParameterMethods',custom:'timeseriesParameterCustomRules',legacy:'timeseriesParameterCustom',options:timeseriesParameterMethods,defaults:['传感器轻微抖动','时间平移']}]}/>;
  const augmentationFields=<>
    <AugmentationSelection includeUnchecked={includeUnchecked} onIncludeUnchecked={setIncludeUnchecked} form={isAugmentation?form:undefined} limit={targetCount} report={selectedReport} total={selectedVersionSampleCount} pool={augmentationCandidates} mode={augmentationMode} threshold={augmentationThreshold} onChange={(mode,value)=>{setAugmentationMode(mode);setAugmentationThreshold(value);}}/>
    <Card className="task-step-card section-title" title="配置增强方案">
    {draft.modality==='文档图像'?documentAugmentationConfig:draft.modality==='对话文本'?conversationAugmentationConfig:timeseriesAugmentationConfig}
  </Card><Card className="task-step-card section-title" title="结果写入"><Form.Item name="targetDataset" label="目标数据集"><Input disabled/></Form.Item><Form.Item name="versionNote" label="增强版本描述" rules={[{required:true}]}><Input placeholder="请输入增强版本描述"/></Form.Item><Alert type="success" showIcon message="任务完成后创建 1 个增强版本"/>
  </Card></>;

  const expansionFields=<Card className="task-step-card section-title" title="定向扩增设置">
    <Alert type="info" showIcon message="扩增目标来自输入版本的正式质检报告" description="可针对某条规则不通过的样本生成补充数据，或按标签分布补齐数量。无法判定不是低质量，不作为自动扩增依据。"/>
    <Form.Item name="coverageGapKeys" hidden><Input/></Form.Item>
    <Radio.Group aria-label="扩增目标来源" value={actualTargetKind} onChange={e=>setExpansionTargetKind(e.target.value)} options={[{value:"规则不通过",label:"规则不通过"},{value:"标签覆盖",label:"标签分布不足"}]} optionType="button"/>
    <ExpansionEvidence report={selectedReport} target={expansionEvidence} onClose={()=>setExpansionEvidence(null)}/>
    <ExpansionTargetTable rows={visibleExpansionTargets} selected={selectedGapKeys} onSelect={keys=>form.setFieldValue("coverageGapKeys",keys)} config={expansionTargetConfig} onConfig={setExpansionTargetConfig} onEvidence={setExpansionEvidence} report={selectedReport}/>
    <div className="expansion-total"><Text type="secondary">计划新增合计</Text><Text strong>{expansionEstimate.toLocaleString()} 条</Text><Text type="secondary">按已选目标与自定义配置数量相加，各目标分别生成。</Text></div>
    <Flex justify="space-between" align="center" className="form-switch-line"><div><Text strong>自定义扩增设置</Text><div><Text type="secondary">可添加多组目标标签或低质项、数量、指令和独立模型配置</Text></div></div><Form.Item name="customExpansionEnabled" valuePropName="checked" noStyle><Switch/></Form.Item></Flex>{customExpansionEnabled&&<Form.List name="customExpansionSettings">{(fields,{add,remove})=><Space direction="vertical" size={12} style={{width:'100%'}}>{fields.map((field,index)=><Card key={field.key} size="small" title={`自定义设置 ${index+1}`} extra={<Button type="text" danger icon={<DeleteOutlined/>} onClick={()=>remove(field.name)}>删除</Button>}><Row gutter={16}><Col span={6}><Form.Item name={[field.name,'name']} label="设置名称" rules={[{required:true}]}><Input placeholder="请输入设置名称"/></Form.Item></Col><Col span={8}><Form.Item name={[field.name,'labels']} label="扩增目标组合" rules={[{required:true}]}><Select placeholder="请选择扩增目标组合" mode="multiple" options={expansionTargetRows.map(item=>({value:item.key,label:`${item.kind} · ${item.dimension} · ${item.label}`}))}/></Form.Item></Col><Col span={4}><Form.Item name={[field.name,'count']} label="目标数量" rules={[{required:true}]}><InputNumber placeholder="请输入目标数量（不小于 1）" min={1} style={{width:'100%'}}/></Form.Item></Col></Row><Form.Item name={[field.name,'prompt']} label="扩增指令" rules={[{required:true}]}><Input.TextArea placeholder="描述扩增指令，说明目标、约束和输出要求" rows={3}/></Form.Item><ModelConfigField model={<Form.Item name={[field.name,'model']} label={draft.modality==='文档图像'?'图像生成模型':'生成模型'} rules={[{required:true},{validator:(_,value)=>expansionModels(draft.modality).includes(value)?Promise.resolve():Promise.reject(new Error('请选择适用于当前数据类型的生成模型'))}]}><Select placeholder="请选择选项" options={expansionModels(draft.modality).map(value=>({value,label:value}))}/></Form.Item>} parameters={<Form.Item name={[field.name,'parameters']}  rules={[{validator:(_,value)=>{if(!value)return Promise.resolve();try{JSON.parse(value);return Promise.resolve();}catch{return Promise.reject(new Error('请输入合法 JSON'));}}}]}><Input.TextArea rows={3} className="json-textarea" placeholder={'{\n  "temperature": 0.8\n}'}/></Form.Item>}/></Card>)}<Button type="dashed" block icon={<PlusOutlined/>} onClick={()=>add({model:defaultExpansionModel(draft.modality),parameters:'{\n  "temperature": 0.8\n}'})}>新增自定义扩增设置</Button></Space>}</Form.List>}
    <ModelWithParameters form={form} modelName="expansionModel" parameterSwitchName="expansionParametersEnabled" parameterName="expansionParameters" models={expansionModels(draft.modality)} label={draft.modality==='文档图像'?'图像生成模型':'生成模型'}/>
    <Divider orientation="left">结果写入</Divider><Form.Item name="targetDataset" label="目标数据集"><Input disabled/></Form.Item><Form.Item name="versionNote" label="扩增版本描述" rules={[{required:true}]}><Input placeholder="请输入扩增版本描述"/></Form.Item><Alert type="success" showIcon message="任务完成后创建 1 个扩增版本" description="开启自动复检时，标签与报告写入同一版本。"/>
  </Card>;

  const submit=async()=>{
    if(submitting)return;setSubmitting(true);
    try{
      const values=await form.validateFields();
      if(!isSynthesis&&!selectedVersion)throw new Error('请选择有效的输入数据集版本');
      if(isQuality&&!effectiveQualityRules.length)throw new Error('模板尚未配置质检规则，请先完善模板');
      if(isAugmentation&&!selectableCount)throw new Error('没有符合条件的基础样本，请调整分数阈值或重新质检');
      if(isAugmentation&&(!Number.isInteger(values.targetCount)||values.targetCount<1))throw new Error('目标增强样本数必须为正整数');
      if(isExpansion&&(!expansionModels(draft.modality).includes(values.expansionModel)||(values.customExpansionEnabled&&(values.customExpansionSettings||[]).some(item=>!expansionModels(draft.modality).includes(item.model)))))throw new Error('请选择适用于当前数据类型的生成模型');
      if(isExpansion&&!selectedGapKeys.length&&!customExpansionTotal)throw new Error('请选择至少一项扩增目标或填写自定义目标');
      if(isExpansion){validateExpansionPlan(expansionTargetRows,selectedGapKeys,expansionTargetConfig,customExpansionEnabled?customExpansionSettings:[]);values.expansionTargets=expansionTargetRows.filter(r=>selectedGapKeys.includes(r.key)).map(r=>({...r,plannedCount:suggestedGapFor(r),plannedPercent:r.baseCount?(targetConfigFor(r).percent??suggestedGapFor(r)/r.baseCount*100):null,percentageBase:r.baseCount,quantityScope:'checked'}));}
      if(isSynthesis&&draft.modality==='对话文本'){
        if(conversationSampler.dimensions?.length){
          if(conversationSampler.dimensions.some(item=>!item?.name?.trim()||!(item.values||[]).length))throw new Error('模板中的事件采样维度配置不完整');
        }else{
        const scenarioAllocations=values.samplingAllocations||[];
        const selectedAllocations=scenarioAllocations.filter(item=>item.selected!==false);
        if(!conversationSampler.scenarios?.length)throw new Error('所选模板没有配置可采样子场景，请先完善并发布模板');
        if(!selectedAllocations.length)throw new Error('请至少选择一个子场景');
        if(values.samplingMode==='ratio'&&selectedAllocations.reduce((sum,item)=>sum+Number(item.targetRatio||0),0)!==100)throw new Error('所选子场景的目标占比合计必须等于 100%');
        if(values.samplingMode==='count'&&selectedAllocations.reduce((sum,item)=>sum+Number(item.targetCount||0),0)!==Number(values.sampleCount||0))throw new Error('所选子场景的目标数量合计必须等于样本总数');
        if(conversationSamplingState.error)throw new Error(conversationSamplingState.error);
        if(values.samplingAdvancedEnabled){
          const branchAllocations=values.samplingBranchAllocations||[];
          for(const scenario of conversationSampler.scenarios.filter(item=>selectedAllocations.some(allocation=>allocation.scenarioId===item.id))){
            const total=(scenario.profiles||[]).reduce((sum,profile)=>sum+Number(branchAllocations.find(item=>item.scenarioId===scenario.id&&item.profileId===profile.id)?.targetRatio||0),0);
            if(total!==100)throw new Error(`子场景“${scenario.name}”的交互分支占比合计必须等于 100%`);
          }
        }
        }
      }
      if(isSynthesis&&['对话文本','时序数据'].includes(draft.modality)){
        const dimensions=draft.modality==='对话文本'?(conversationSampler.dimensions||[]):timeseriesDimensions;
        const ratioMap=new Map((values.dimensionSamplingRatios||[]).map(item=>[`${item.dimensionId}:${item.optionId}`,Number(item.targetRatio||0)]));
        for(const dimension of dimensions){
          const total=(dimension.values||[]).reduce((sum,optionName)=>sum+(ratioMap.get(`${dimension.dimension_id}:${dimension.option_ids?.[optionName]||optionName}`)||0),0);
          if(total!==100)throw new Error(`采样维度“${dimension.name}”的枚举值占比合计必须等于 100%`);
        }
      }
      if(isAugmentation&&draft.modality==='文档图像'&&values.documentEnhancementTypes?.includes('语义增强')&&!values.documentSemanticRules?.length&&!values.documentSemanticCustomRules?.length)throw new Error('语义增强至少选择一条预置规则或配置一条自定义规则');
      if(isAugmentation&&draft.modality==='文档图像'&&!values.documentEnhancementTypes?.length)throw new Error('请至少选择一种增强方式或添加自定义规则');
      if(isAugmentation&&draft.modality==='对话文本'&&!values.conversationSemanticMethods?.length&&!values.conversationSemanticCustomRules?.length)throw new Error('请选择至少一条预置语义增强规则，或添加一条自定义语义增强规则');
      if(isAugmentation&&draft.modality==='时序数据'&&!values.timeseriesEventMethods?.length&&!values.timeseriesParameterMethods?.length&&!values.timeseriesEventCustomRules?.length&&!values.timeseriesParameterCustomRules?.length)throw new Error('请至少选择或添加一条事件语义增强或输出参数增强规则');
      if(isExpansion&&!selectedGapKeys.length&&!values.customExpansionEnabled)throw new Error('请选择至少一个系统建议项，或开启自定义扩增设置');
      if(isExpansion&&(!Number.isInteger(expansionEstimate)||expansionEstimate<1))throw new Error('请为扩增目标配置正整数数量');
      const template=isSynthesis?publishedTemplates.find(item=>item.id===values.templateId):selectedTemplate;
      const output=isSynthesis?values.outputMode==='newVersion'?`${values.targetDataset} / 新版本`:values.outputDatasetName:`${selectedDataset.name} / ${isQuality?selectedVersion.version:'新版本'}`;
      const input=isSynthesis?template.name:`${selectedDataset.name} / ${selectedVersion.version}`;
      const dimensionSamplingSnapshot=isSynthesis&&['对话文本','时序数据'].includes(draft.modality)?{mode:'ratio_mix',sampleCount:Number(values.sampleCount||0),dimensions:(draft.modality==='对话文本'?(conversationSampler.dimensions||[]):timeseriesDimensions).map(dimension=>({dimension_id:dimension.dimension_id,dimension_name:dimension.name,applicability_conditions:dimension.applicability_conditions||'',prohibited_conditions:dimension.prohibited_conditions||'',options:(dimension.values||[]).map(optionName=>({option_id:dimension.option_ids?.[optionName]||optionName,option_name:optionName,target_ratio:Number((values.dimensionSamplingRatios||[]).find(item=>item.dimensionId===dimension.dimension_id&&item.optionId===(dimension.option_ids?.[optionName]||optionName))?.targetRatio||0)}))}))}:null;
      onSubmit({...draft,...values,...(isExpansion?{targetCount:expansionEstimate}:{}),...(isSynthesis&&draft.modality==='对话文本'?{samplingPlanSnapshot:conversationSampler.dimensions?.length?dimensionSamplingSnapshot:conversationSamplingState.rows.filter(row=>(values.samplingAllocations||[]).find(item=>item.scenarioId===row.id)?.selected!==false).map(row=>({scenarioId:row.id,scenarioName:row.name,plannedCount:row.quota,ratio:row.ratio,branchPlan:(row.profiles||[]).map(profile=>({profileId:profile.id,profileName:profile.name,plannedCount:profile.quota,ratio:profile.ratio}))}))}:{}),...(isSynthesis&&draft.modality==='时序数据'?{samplingPlanSnapshot:dimensionSamplingSnapshot,runtimeSnapshot:{point_count_range:[Number(values.minTimeSteps),Number(values.maxTimeSteps)],step_minutes:Number(values.stepMinutes),timezone:'Asia/Shanghai',start_time_policy:'per_sample_generated',seed_policy:'system_generated'}}:{}),expansionTargetConfig,selectableCount,effectiveTargetCount:isExpansion?expansionEstimate:targetCount,qualityCheckedSampleCount:isQuality?qualityCheckedSampleCount:undefined,qualityUncheckedSampleCount:isQuality?qualityUncheckedSampleCount:undefined,businessType:template.businessType,stages:[draft.taskType],input,output,templateProfile:template,sourceEnhanced:selectedVersion?.versionKind==='增强'||selectedVersion?.taskConfigSnapshot?.taskType==='数据增强',privacyPolicy:template.configuration?.privacy_policy||template.documentSnapshot?.privacy_policy||[],qualityRules:effectiveQualityRules,inputDatasetId:selectedDataset?.id,inputVersionId:selectedVersion?.version,sourceVersion:selectedVersion,...((isAugmentation||isExpansion)?{qualityReportId:selectedReport?.reportId,qualityReportSnapshot:selectedReport}:{} ),...(isAugmentation?{selectionRuleId:undefined,sampleSelection:undefined,augmentationSelection:{mode:augmentationMode,threshold:augmentationThreshold,reportId:selectedReport?.reportId,median:augmentationCandidates.median,includeUnchecked},sourceSelection:buildAugmentationSelection(augmentationCandidates,includeUnchecked)}:{} )});
    }catch(error){if(!error?.errorFields)message.error(error.message||'任务提交失败');else {message.warning('请完成必填配置');form.scrollToField(error.errorFields[0]?.name,{behavior:'smooth',block:'center',focus:true});}}finally{setSubmitting(false);}
  };
  const saveDraft=async()=>{
    if(submitting)return;
    setSubmitting(true);
    try{
      await onSaveDraft({...form.getFieldsValue(true),modality:draft.modality,taskType:draft.taskType,expansionTargetConfig});
      message.success('草稿已保存，可在任务列表继续编辑');
    }catch(error){message.error(`草稿保存失败：${error.message||'请重试'}`);}
    finally{setSubmitting(false);}
  };
  const initialTemplate=publishedTemplates[0];
  const evidenceContent=isSynthesis?<TemplateEvidence template={selectedTemplate} modality={draft.modality}/>:isQuality?<QualityRulesEvidence template={selectedTemplate} modality={draft.modality} version={selectedVersion}/>:<QualityReportEvidence dataset={selectedDataset} version={selectedVersion}/>;
  const configurationContent=isSynthesis?synthesisFields:<>{inputCard}{selectedVersion?(isQuality?qualityFields:isAugmentation?augmentationFields:expansionFields):<Card className="task-step-card section-title"><Empty description="选择输入数据集和版本后显示本次任务配置"/></Card>}</>;
  return <div className="create-task-page">
    <Flex justify="space-between" align="center" className="create-page-heading"><Space><Button type="text" shape="circle" icon={<LeftOutlined/>} aria-label={`返回${modalityLabel}任务列表`} onClick={onCancel}/><Title level={3}>{taskPageTitle}</Title></Space><Space><Button disabled={submitting} onClick={onCancel}>取消</Button><Button disabled={submitting} onClick={saveDraft}>保存草稿</Button><Button type="primary" loading={submitting} onClick={()=>{setWorkspaceTab("configure");submit();}}>提交任务</Button></Space></Flex>
<Form form={form} layout="vertical" initialValues={{name:draft.name,description:draft.description,templateId:draft.templateId||initialTemplate?.id,businessType:initialTemplate?.businessType,sampleCount:20,resolution:'2480 × 1754',patternRatio:60,minTurns:3,maxTurns:8,minTimeSteps:48,maxTimeSteps:48,stepMinutes:15,generationModel:initialTemplate?.defaultModel||'Qwen3-14B',generationParametersEnabled:false,generationParameters:'{\n  "temperature": 0.7,\n  "top_p": 0.9\n}',samplingMode:'ratio',samplingAllocations:defaultTaskSamplingAllocations(initialTemplate?.configuration?.sampler||defaultConversationSampler(),20),samplingAdvancedEnabled:false,samplingBranchAllocations:defaultBranchAllocations(initialTemplate?.configuration?.sampler||defaultConversationSampler()),dimensionSamplingRatios:defaultDimensionRatios(initialTemplate?.configuration?.sampler?.dimensions||initialTemplate?.configuration?.event_generation?.sampling_dimensions||[]),overrideBackgroundGeneration:false,imageGenerationModel:initialTemplate?.imageModel,backgroundPrompt:initialTemplate?.backgroundPrompt,qualityScope:'full',samplingRatio:10,qualityModel:'Qwen3-14B',qualityVlmModel:'Qwen3-VL-8B-Instruct',qualityParametersEnabled:false,qualityParameters:'{\n  "temperature": 0.1\n}',enhancementModel:'Qwen3-14B',enhancementParametersEnabled:false,enhancementParameters:'{\n  "temperature": 0.7\n}',expansionModel:defaultExpansionModel(draft.modality),expansionParametersEnabled:false,expansionParameters:'{\n  "temperature": 0.8\n}',outputMode:'newDataset',outputDatasetName:`${initialTemplate?.businessType||''}数据集`,versionNote:isQuality?'质检标注版本':isAugmentation?'数据增强版本':isExpansion?'定向扩增版本':'数据合成结果',autoQualityEnabled:draft.configSnapshot?autoQualityEnabled({...draft,...draft.configSnapshot}):false,targetCount:100,enhancementIntensity:'中等',customEnhancementEnabled:false,customExpansionEnabled:false,customExpansionSettings:[{name:'',labels:[],count:20,prompt:'',model:defaultExpansionModel(draft.modality),parameters:'{\n  "temperature": 0.8\n}'}],...(draft.configSnapshot||{}),inputDatasetId:draft.inputDatasetId,inputVersionId:draft.inputVersionId}}>
      <Card className="task-fixed-header"><Row gutter={20} align="bottom"><Col span={12}><Form.Item name="name" label="任务名称" rules={[{required:true,message:'请输入任务名称'}]}><Input placeholder="请输入任务名称" maxLength={50}/></Form.Item></Col><Col span={12}><Form.Item name="description" label="任务描述"><Input maxLength={200} placeholder="可选，最多 200 字"/></Form.Item></Col></Row></Card>
      <section className="task-configuration-column">{isSynthesis&&<Button style={{marginBottom:12}} onClick={()=>openBasis('rules')}>查看模板规则 →</Button>}{configurationContent}{automaticQualityCard}</section>
      <Drawer title="任务依据" width="min(1100px, 94vw)" open={basisOpen} onClose={()=>setBasisOpen(false)}>{isQuality?<QualityRulesEvidence template={selectedTemplate} modality={draft.modality} version={selectedVersion}/>:isSynthesis?evidenceContent:<Tabs activeKey={basisTab} onChange={setBasisTab} items={[{key:'report',label:'质检报告',children:<QualityReportEvidence dataset={selectedDataset} version={selectedVersion}/>},{key:'rules',label:'模板规则',children:<TemplateRulesTable modality={draft.modality} template={selectedTemplate} rules={effectiveQualityRules}/>} ]}/>}</Drawer>

    </Form>
  </div>;
}

function prototypeTaskId(seed=Date.now()) {
  const stamp=nowDateTime().slice(0,10).replaceAll('-','');
  return `TASK-${stamp}-${String(parseInt(fixedHashId(seed).slice(0,6),16)%10000).padStart(4,'0')}`;
}

function commitPrototypeTaskOutput(values, taskId, versionId, setDatasets, executedTask) {
  if(executedTask&&values.taskType!=='数据质检'&&!executedTask.executionSummary.outputSampleCount)return;
  const now=nowDateTime();
  const template=values.templateProfile;
  setDatasets(items=>{
    if(values.taskType!=='数据质检'&&items.some(dataset=>dataset.versions.some(version=>version.version===versionId)))return items;
    const selectedDataset=items.find(dataset=>dataset.id===values.inputDatasetId);
    const selectedVersion=selectedDataset?.versions.find(version=>version.version===values.inputVersionId);
    if(values.taskType==='数据质检'){
      if(!selectedVersion||!executedTask||executedTask.status==='运行中')return items;
      const meta=qualityExecutionMetadata(executedTask);
      const reportId=`QREPORT-${fixedHashId(executedTask?.runNumber>1?`${taskId}-run-${executedTask.runNumber}`:taskId)}`;

      const report={...meta,reportId,taskId,taskName:values.name,createdAt:now,outputVersionId:selectedVersion.version,inputVersionId:selectedVersion.version,
        resultFile:`quality/${taskId}.jsonl`,sampleExecution:executedTask};
      return items.map(dataset=>dataset.id!==selectedDataset.id?dataset:{...dataset,updatedAt:now,versions:dataset.versions.map(version=>version.version===selectedVersion.version?appendQualityReport(version,report,executedTask,now):version)});
    }
    const sourceForSynthesis=values.outputMode==='newVersion'?items.find(dataset=>dataset.name===values.targetDataset):null;
    const sourceDataset=values.taskType==='数据合成'?sourceForSynthesis:selectedDataset;
    const sourceVersion=values.taskType==='数据合成'?sourceForSynthesis?.versions.find(version=>version.version===sourceForSynthesis.defaultVersion):selectedVersion;
    const sampleCount=executedTask?executedTask.executionSummary.outputSampleCount:values.taskType==='数据质检'?numericSampleCount(sourceVersion?.samples):values.taskType==='数据合成'?Number(values.sampleCount||0):Number(values.effectiveTargetCount||values.targetCount||0);
    const partialQuality=values.taskType==='数据质检'&&values.qualityScope==='sample';
    const versionKind=values.taskType==='数据质检'?(partialQuality?'抽检标注':'质检标注'):{数据合成:'合成',数据增强:'增强',定向扩增:'定向扩增'}[values.taskType];
    const qualityChecked=autoQualityEnabled(values);
    const checkedSampleCount=partialQuality?Math.min(sampleCount,Number(values.qualityCheckedSampleCount||0)):qualityChecked?sampleCount:0;
    const nextVersion={
      id:versionId,version:versionId,note:values.versionNote,versionKind,source:taskId,sourceName:values.name,
      samples:sampleCount,created:now,updatedAt:now,consumers:[],qualityChecked,fullQualityChecked:qualityChecked&&!partialQuality,checkedSampleCount,
      templateId:template?.id,templateVersion:template?.version,
      sourceDatasetId:sourceDataset?.id||null,sourceVersionId:sourceVersion?.version||null,
      taskConfigSnapshot:values,
    };
    if(qualityChecked){

      nextVersion.qualityReportId=`QREPORT-${fixedHashId(`${taskId}-${versionId}`)}`;
      nextVersion.qualityReport={};
      nextVersion.qualityReport={...nextVersion.qualityReport,reportId:nextVersion.qualityReportId,inputVersionId:sourceVersion?.version,outputVersionId:versionId,templateId:template?.id,templateVersion:template?.version,executionRange:partialQuality?'sample':'full',samplingRatio:partialQuality?Number(values.samplingRatio):100,checkedSampleCount,uncheckedSampleCount:Math.max(0,sampleCount-checkedSampleCount),ruleSnapshot:values.qualityRules||[]};
      nextVersion.sampleQualityLabels={schemaVersion:'sample-quality/v1',coverage:partialQuality?'partial':'full',checkedSampleCount,uncheckedSampleCount:Math.max(0,sampleCount-checkedSampleCount),uncheckedLabel:'未质检',fields:['overall_score','overall_result','rule_results','issue_labels']};
      if(values.taskType==='数据增强')nextVersion.enhancementSettings={directions:null,methods:values.modality==='文档图像'?[...(values.documentEnhancementTypes||[])]:values.modality==='对话文本'?[...(values.conversationSemanticMethods||[])]:[...(values.timeseriesEventMethods||[]),...(values.timeseriesParameterMethods||[])],documentConfig:values.modality==='文档图像'?{semanticRuleIds:values.documentSemanticRules||[],imageMethods:values.documentImageMethods||[],imageIntensities:Object.fromEntries((values.documentImageMethods||[]).map(name=>[name,values.documentImageIntensities?.[name]||'轻度'])),backgroundMethods:values.documentBackgroundMethods||[],semanticCustom:values.documentSemanticCustomRules||[],backgroundCustom:values.documentBackgroundCustomRules||[],semanticModel:values.documentEnhancementTypes?.includes('语义增强')?{model:values.semanticEnhancementModel,parametersEnabled:values.semanticEnhancementParametersEnabled,parameters:values.semanticEnhancementParameters}:null,backgroundModel:values.documentEnhancementTypes?.includes('背景增强')?values.backgroundEnhancementModel:null}:null,timeseriesConfig:values.modality==='时序数据'?{eventMethods:values.timeseriesEventMethods||[],parameterMethods:values.timeseriesParameterMethods||[],eventCustom:values.timeseriesEventCustomRules||[],parameterCustom:values.timeseriesParameterCustomRules||[]}:null,custom:values.modality==='对话文本'?(values.conversationSemanticCustomRules||[]):[]};
      if(values.taskType==='定向扩增')nextVersion.expansionSettings={targetKeys:values.coverageGapKeys,targetConfig:values.expansionTargetConfig||{},coverageGapKeys:(values.coverageGapKeys||[]).filter(key=>!String(key).startsWith('quality-')),qualityRuleKeys:(values.coverageGapKeys||[]).filter(key=>String(key).startsWith('quality-')),customSettings:values.customExpansionEnabled?values.customExpansionSettings||[]:[]};
    }
    if(values.taskType==='定向扩增')nextVersion.expansionSettings={targets:values.expansionTargets||[],sourceReportId:values.qualityReportId,targetKeys:values.coverageGapKeys,targetConfig:values.expansionTargetConfig||{},coverageGapKeys:(values.coverageGapKeys||[]).filter(key=>!String(key).startsWith('quality-')),customSettings:values.customExpansionEnabled?values.customExpansionSettings||[]:[]};
    if(executedTask){
      nextVersion.executionSummary=executedTask.executionSummary;
      nextVersion.sampleExecution=executedTask;
      nextVersion.fullQualityChecked=false;
      if(qualityChecked){
        const meta=qualityExecutionMetadata(executedTask);

        nextVersion.qualityReport={...nextVersion.qualityReport,...meta,reportId:nextVersion.qualityReportId,taskId,createdAt:now};
        nextVersion.checkedSampleCount=meta.checkedSampleCount;

        nextVersion.sampleQualityLabels={...nextVersion.sampleQualityLabels,coverage:meta.errorSampleCount||meta.uncheckedSampleCount?'partial':'full',checkedSampleCount:meta.checkedSampleCount,uncheckedSampleCount:meta.uncheckedSampleCount,errorSampleCount:meta.errorSampleCount,fields:['rule_results','issue_labels','executionStatus','badcaseId']};
        nextVersion.fullQualityChecked=isFullQualityVersion(nextVersion);
      }
    }
    const linkConsumer=dataset=>({...dataset,versions:dataset.versions.map(version=>version.version===sourceVersion?.version?{...version,consumers:[{id:taskId,name:values.name,taskType:values.taskType,updatedAt:now,status:executedTask?.status||'已完成'},...(version.consumers||[])]}:version)});
    if(values.taskType==='数据合成'&&values.outputMode==='newDataset'){
      const datasetId=createDatasetId(`${taskId}-${values.outputDatasetName}`,now);
      return [{id:datasetId,name:values.outputDatasetName,modality:values.modality,businessType:template?.businessType,status:'可用',desc:values.description||`由${template?.name||'已发布模板'}批量合成。`,defaultVersion:versionId,totalSamples:sampleCount,reference:true,sourceType:'任务生成',updatedAt:now,templateId:template?.id,templateVersion:template?.version,versions:[nextVersion]},...items];
    }
    return items.map(dataset=>{
      if(dataset.id!==sourceDataset?.id)return dataset;
      const linked=linkConsumer(dataset);
      return {...linked,defaultVersion:versionId,totalSamples:values.taskType==='数据质检'?numericSampleCount(dataset.totalSamples):numericSampleCount(dataset.totalSamples)+sampleCount,updatedAt:now,templateId:template?.id||dataset.templateId,templateVersion:template?.version||dataset.templateVersion,versions:[nextVersion,...linked.versions]};
    });
  });
}

function ProductTaskDetail({ task, initialTab='info', datasets:providedDatasets }) {
  const datasets=providedDatasets||readStore('application-state',{}).datasets||[];
  const [activeTab,setActiveTab]=useState(initialTab==='config'?'info':['usage','result'].includes(initialTab)?'logs':initialTab);
  const config=resolveTaskConfiguration(task,datasets);
  const configJson=JSON.stringify(config,null,2);
  const template=config.templateProfile||templateForDataset({modality:task.modality,businessType:task.businessType,templateId:config.templateId});
  const sourceVersionId=task.sourceVersionId||config.inputVersionId;
  const sourceDataset=task.taskType==='数据合成'?null:datasets.find(item=>item.id===(task.sourceDatasetId||config.inputDatasetId))
    || (task.taskType==='数据合成'?null:datasets.find(item=>item.versions?.some(version=>version.version===sourceVersionId)));
  const taskQuality=reportForQualityTask(task,datasets);
  const outputDataset=taskQuality?.dataset||datasets.find(item=>item.versions?.some(version=>version.version===task.outputVersionId));
  const datasetInfo=(dataset,versionId)=>dataset||versionId?<Space direction="vertical" size={2}>
    {dataset?<Typography.Link href={`?datasetDetail=${encodeURIComponent(dataset.id)}`} target="_blank" rel="noopener noreferrer">{dataset.name}</Typography.Link>:<Text>-</Text>}
    <Text type="secondary">数据集 ID：{dataset?.id||'-'}</Text>
    <Text type="secondary">版本 ID：{versionId||'-'}</Text>
  </Space>:'-';
  const outputVersion=taskQuality?.version||outputDataset?.versions?.find(version=>version.version===task.outputVersionId);
  const matchingReport=taskQuality?.report||qualityReports(outputVersion).find(report=>report.taskId===task.id);
  const executionReport=task.taskType==='数据质检'&&task.configSnapshot?.qualityProtocolVersion===2&&task.execution
    ?{...qualityExecutionMetadata(task),taskId:task.id,reportId:`QREPORT-${fixedHashId(task.id)}`,inputVersionId:sourceVersionId,outputVersionId:sourceVersionId}
    :null;
  const prototypeTaskReport=prototypeQualityTaskReport(task,{dataset:outputDataset||sourceDataset,
    version:outputVersion||sourceDataset?.versions?.find(version=>version.version===sourceVersionId),
    template,matchingReport,rules:templateQualityRules(task.modality,template)});
  const prototypeOutputReport=['数据增强','定向扩增'].includes(task.taskType)&&['已完成','部分完成'].includes(task.status)&&outputDataset&&outputVersion&&matchingReport?.protocolVersion!==2
    ?prototypeHistoricalQualityReport(outputDataset,outputVersion):null;
  const detailReport=matchingReport?.protocolVersion===2?matchingReport:executionReport||prototypeTaskReport||(prototypeOutputReport?{...prototypeOutputReport,reportId:`QREPORT-MOCK-${task.id}`,taskId:task.id,inputVersionId:sourceVersionId,outputVersionId:outputVersion.version}:null)||matchingReport;
  const qualityReportId=detailReport?.reportId||(task.outputVersionId&&task.taskType!=='数据合成'?`QREPORT-${fixedHashId(`${task.id}-${task.outputVersionId}`)}`:null);
  const logJson=JSON.stringify(buildTaskDetailLog(task,outputDataset,qualityReportId),null,2);
  return <Tabs className="task-detail-tabs" activeKey={activeTab} onChange={setActiveTab} items={[
    {key:'info',label:'基础信息',children:<><Descriptions bordered size="small" column={2} className="detail-descriptions" items={[
      {key:'id',label:'任务 ID',children:<Text copyable>{task.id}</Text>},
      {key:'type',label:'任务类型',children:task.taskType},
      {key:'status',label:'状态',children:<StatusTag value={task.status}/>},
      {key:'business',label:'业务类型',children:task.businessType||template?.businessType||'-'},
      {key:'updated',label:'更新时间',span:2,children:formatDateTime(task.updated||task.created)},
      {key:'description',label:'任务描述',span:2,children:task.description||'-'},
      {key:'template',label:'关联模板',span:2,children:template?<Space direction="vertical" size={2}><Typography.Link href={`?templateReference=${encodeURIComponent(template.id)}&referenceTask=${encodeURIComponent(task.id)}`} target="_blank" rel="noopener noreferrer">{template.name||template.id}</Typography.Link><Text type="secondary" copyable={Boolean(template.id)}>{template.id||'-'}</Text></Space>:'-'},
      {key:'sourceDataset',label:'来源数据集',span:2,children:task.taskType==='数据合成'?'-':datasetInfo(sourceDataset,sourceVersionId)},
      {key:'outputDataset',label:task.taskType==='数据质检'?'报告所属数据集':'生成数据集',span:2,children:datasetInfo(outputDataset,task.taskType==='数据质检'?outputVersion?.version:task.outputVersionId)},
    ]}/><details open className="config-snapshot"><summary>配置快照</summary>{!Object.keys(config).length?<Empty description="暂无记录"/>:<div className="task-rule-expanded"><Flex justify="flex-end" style={{marginBottom:12}}><Text copyable={{text:configJson}}>复制配置快照</Text></Flex><pre>{configJson}</pre></div>}</details></>},
    ...(autoQualityEnabled({...task,...task.configSnapshot})?[{key:'quality-report',label:'质检报告',children:detailReport?<RuleQualityReport report={detailReport}/>:<Empty description={task.taskType==='数据质检'?(task.status==='运行中'||task.status==='排队中'?'任务尚未生成质检结果':'该历史任务未保存逐规则质检结果'):'该任务未保存质检结果'}/>}]:[]),
    {key:'logs',label:'运行日志',children:<div className="task-rule-expanded"><Flex justify="flex-end" style={{marginBottom:12}}><Button onClick={()=>{try{downloadTaskLog(task.id,logJson);message.success('已开始下载日志');}catch(error){message.error('日志下载失败，请重试');}}}>下载日志</Button></Flex><pre>{logJson}</pre></div>},
    ...(task.taskType==='数据质检'?[]:[{key:'badcases',label:`Badcase${task.badcaseTrackingVersion?`（${task.executionSummary?.badcaseSampleCount||0}）`:''}`,children:<BadcasePanel key={task.id} task={task}/>}]),
  ]}/>;
}

function TaskCenter({ datasets, setDatasets, tasks, setTasks, storeReady, modality, pageTitle, startCreate, onStartConsumed, onNavigate }) {
  const [tab,setTab]=useState('all'); const [taskType,setTaskType]=useState('all'); const [businessTypeFilter,setBusinessTypeFilter]=useState('all'); const [query,setQuery]=useState(''); const [draft,setDraft]=useState(null); const [detail,setDetail]=useState(null); const [detailTab,setDetailTab]=useState('info');
  const modalityTasks=useMemo(()=>tasks.filter(t=>t.modality===modality),[tasks,modality]);
  const businessTypeOptions=useMemo(()=>[...new Set(modalityTasks.map(task=>task.businessType).filter(Boolean))].sort(),[modalityTasks]);
  const filtered=useMemo(()=>modalityTasks.filter(t=>(tab==='all'||t.status===tab||(tab==='异常'&&t.status==='失败'))&&(taskType==='all'||t.taskType===taskType)&&(businessTypeFilter==='all'||t.businessType===businessTypeFilter)&&(!query||t.name.includes(query)||t.id.includes(query))),[modalityTasks,tab,taskType,businessTypeFilter,query]);
  const activeCustomsIds=useMemo(()=>tasks.filter(item=>item.modality===modality&&item.backendJob?.id?.startsWith('CUSTOMS-')&&!['completed','failed','cancelled'].includes(item.backendJob.status)).map(item=>item.backendJob.id).sort().join('|'),[tasks,modality]);
  const activeSyntheticDocumentIds=useMemo(()=>tasks.filter(item=>item.modality===modality&&item.backendJob?.id?.startsWith('FICTIONAL-DOC-')&&!['completed','failed','cancelled'].includes(item.backendJob.status)).map(item=>item.backendJob.id).sort().join('|'),[tasks,modality]);
  const activeConversationIds=useMemo(()=>tasks.filter(item=>item.modality===modality&&item.backendJob?.id?.startsWith('CONV-')&&!['completed','failed','cancelled'].includes(item.backendJob.status)).map(item=>item.backendJob.id).sort().join('|'),[tasks,modality]);
  const activeColdChainIds=useMemo(()=>tasks.filter(item=>item.modality===modality&&item.backendJob?.id?.startsWith('COLDCHAIN-')&&!['completed','failed','cancelled'].includes(item.backendJob.status)).map(item=>item.backendJob.id).sort().join('|'),[tasks,modality]);
  const activeDetail=detail?tasks.find(item=>item.id===detail.id)||detail:null;
  const openDetail=task=>{setDetail(task);setDetailTab('info');};
  useEffect(()=>{setTab('all');setTaskType('all');setBusinessTypeFilter('all');setQuery('');setDetail(null);setDraft(null);},[modality]);
  useEffect(()=>{if(!startCreate)return;setDraft(typeof startCreate==='object'?{...startCreate,modality,taskType:startCreate.taskType}:{modality,taskType:startCreate});onStartConsumed?.();},[startCreate,modality]);
  useEffect(()=>{
    if(!activeCustomsIds)return undefined;
    let cancelled=false;let timer;
    const ids=activeCustomsIds.split('|');
    const poll=async()=>{
      try{
        const jobs=await Promise.all(ids.map(id=>customsApi.getJob(id)));
        if(cancelled)return;
        const byId=new Map(jobs.map(job=>[job.id,job]));
        setTasks(items=>items.map(task=>{
          const job=byId.get(task.id);if(!job)return task;
          return {...task,backendJob:job,status:backendStatusMap[job.status]||task.status,progress:Number(job.progress)||0,currentStage:job.message||job.stage||task.currentStage};
        }));
        if(jobs.some(job=>!['completed','failed','cancelled'].includes(job.status)))timer=window.setTimeout(poll,1000);
      }catch(error){if(!cancelled){console.warn('报关单任务轮询失败',error);timer=window.setTimeout(poll,1800);}}
    };
    poll();
    return()=>{cancelled=true;if(timer)window.clearTimeout(timer);};
  },[activeCustomsIds]);
  useEffect(()=>{
    if(!activeSyntheticDocumentIds)return undefined;
    let cancelled=false;let timer;
    const ids=activeSyntheticDocumentIds.split('|');
    const poll=async()=>{
      try{
        const jobs=await Promise.all(ids.map(id=>syntheticTemplateApi.getGenerationJob(id)));
        if(cancelled)return;
        const byId=new Map(jobs.map(job=>[job.id,job]));
        setTasks(items=>items.map(task=>{
          const job=byId.get(task.id);if(!job)return task;
          const latestEvent=Array.isArray(job.events)&&job.events.length?job.events[job.events.length-1]:null;
          return {...task,backendJob:job,status:backendStatusMap[job.status]||task.status,progress:Number(job.progress)||0,currentStage:latestEvent?.message||job.stage||task.currentStage};
        }));
        if(jobs.some(job=>!['completed','failed','cancelled'].includes(job.status)))timer=window.setTimeout(poll,700);
      }catch(error){if(!cancelled){console.warn('虚构文档任务轮询失败',error);timer=window.setTimeout(poll,1600);}}
    };
    poll();
    return()=>{cancelled=true;if(timer)window.clearTimeout(timer);};
  },[activeSyntheticDocumentIds]);
  useEffect(()=>{
    if(!activeConversationIds)return undefined;
    let cancelled=false;let timer;
    const ids=activeConversationIds.split('|');
    const poll=async()=>{
      try{
        const jobs=await Promise.all(ids.map(id=>conversationApi.getJob(id)));
        if(cancelled)return;
        const byId=new Map(jobs.map(job=>[job.id,job]));
        setTasks(items=>items.map(task=>{
          const job=byId.get(task.id);if(!job)return task;
          return {...task,backendJob:job,status:backendStatusMap[job.status]||task.status,progress:Number(job.progress)||0,currentStage:job.message||job.stage||task.currentStage};
        }));
        if(jobs.some(job=>!['completed','failed','cancelled'].includes(job.status)))timer=window.setTimeout(poll,800);
      }catch(error){if(!cancelled){console.warn('对话任务轮询失败',error);timer=window.setTimeout(poll,1600);}}
    };
    poll();
    return()=>{cancelled=true;if(timer)window.clearTimeout(timer);};
  },[activeConversationIds]);
  useEffect(()=>{
    if(!activeColdChainIds)return undefined;
    let cancelled=false;let timer;
    const ids=activeColdChainIds.split('|');
    const poll=async()=>{
      try{
        const jobs=await Promise.all(ids.map(id=>coldchainApi.getJob(id)));
        if(cancelled)return;
        const byId=new Map(jobs.map(job=>[job.id,job]));
        setTasks(items=>items.map(task=>{
          const job=byId.get(task.id);if(!job)return task;
          return {...task,backendJob:job,status:backendStatusMap[job.status]||task.status,progress:Number(job.progress)||0,currentStage:job.message||job.stage||task.currentStage};
        }));
        if(jobs.some(job=>!['completed','failed','cancelled'].includes(job.status)))timer=window.setTimeout(poll,1000);
      }catch(error){if(!cancelled){console.warn('冷链时序任务轮询失败',error);timer=window.setTimeout(poll,1800);}}
    };
    poll();
    return()=>{cancelled=true;if(timer)window.clearTimeout(timer);};
  },[activeColdChainIds]);
  const createMenuItems=[
    {key:'数据合成',label:<div className="create-menu-item"><Text strong>数据合成</Text><Text type="secondary">选择模板并配置现有合成参数</Text></div>},
    {key:'数据质检',label:<div className="create-menu-item"><Text strong>数据质检</Text><Text type="secondary">对已有版本执行质量检查与标签统计</Text></div>},
    {key:'数据增强',label:<div className="create-menu-item"><Text strong>数据增强</Text><Text type="secondary">使用现有增强方式增加数据多样性</Text></div>},
    {key:'定向扩增',label:<div className="create-menu-item"><Text strong>定向扩增</Text><Text type="secondary">根据规则问题和标签分布不足补充样本</Text></div>},
  ];
  const editTask=task=>setDraft({
    ...(task.configSnapshot||{}),
    modality:task.modality,
    taskType:task.taskType,
    businessType:task.businessType,
    name:task.name,
    description:task.description,
    configSnapshot:task.configSnapshot,
    editingTaskId:task.id,
  });
  const makeRun=task=>{
    const id=prototypeTaskId(`${Date.now()}-${Math.random()}`);
    return newExecutionTask({...config,name:task.name,description:task.description,taskType:task.taskType,modality:task.modality,businessType:task.businessType},id,createVersionId(id));
  };
  const publishTask=task=>{
    editTask(task);
    message.info('请确认配置后提交任务');
  };
  const rerunTask=task=>{
    const config=resolveTaskConfiguration(task,datasets);
    if(!config.templateProfile&&!config.templateId){message.error('历史任务缺少可重跑的模板配置，请复制为草稿补充后提交');return;}
    const {runHistory=[],...previous}=task;
    const run={...newExecutionTask({...config,name:task.name,description:task.description,taskType:task.taskType,modality:task.modality,businessType:task.businessType},task.id,createVersionId(`${task.id}-${Date.now()}`)),created:task.created,runNumber:(task.runNumber||1)+1,runHistory:[...runHistory,previous]};
    setTasks(items=>items.map(item=>item.id===task.id?run:item));message.success('任务已重新开始运行');
  };
  const terminateTask=task=>Modal.confirm({
    title:`终止任务“${task.name}”？`,
    content:'终止后将停止处理与重试，保留已记录的执行结果。',
    okText:'确认终止',okType:'danger',cancelText:'取消',
    onOk:()=>{
      const current=tasks.find(item=>item.id===task.id)||task;
      let stopped={...stopExecution(current),backendJob:current.backendJob?{...current.backendJob,status:'cancelled',message:'用户手动终止'}:current.backendJob};
      if(stopped.execution&&stopped.taskType==='数据质检'){
        stopped={...stopped,datasetWritten:true,outputVersionId:stopped.sourceVersionId,output:'已保存部分质检报告'};
        commitPrototypeTaskOutput(stopped.configSnapshot,stopped.id,stopped.sourceVersionId,setDatasets,stopped);
      }
      setTasks(items=>items.map(item=>item.id===task.id?stopped:item));
      message.success('任务已终止');
    },
  });
  const copyTask=task=>{
    const now=Date.now();
    const copied={...task,execution:undefined,executionSummary:undefined,badcaseTrackingVersion:undefined,outputVersionId:undefined,output:'-',apiUsage:undefined,key:`copy-${now}`,id:`DRAFT-${now}`,name:`${task.name}（副本）`,status:'草稿',progress:0,currentStage:'尚未发布',created:nowDateTime(),backendJob:undefined,pendingDatasetWrite:false,datasetWritten:false};
    setTasks(items=>[copied,...items]);
    message.success('任务已复制为草稿');
  };
  const deleteTask=task=>Modal.confirm({
    title:`删除任务“${task.name}”？`,
    content:'删除后该任务将从任务中心移除；已经写入数据中心的数据集不受影响。',
    okText:'确认删除',okType:'danger',cancelText:'取消',
    onOk:()=>{setTasks(items=>items.filter(item=>item.id!==task.id));if(detail?.id===task.id)setDetail(null);message.success('任务已删除');},
  });
  const renderTaskActions=task=>{
    const canEdit=task.status==='草稿';
    const canPublish=task.status==='草稿';
    const canRerun=['已完成','异常','失败','已终止'].includes(task.status);
    const canTerminate=task.status==='运行中';
    const canDelete=['草稿','已完成','异常','失败','已终止'].includes(task.status);
    return <Space size={0} className="task-row-actions">
      <Button type="link" size="small" onClick={()=>openDetail(task)}>详情</Button>
      <Button type="link" size="small" disabled={!canEdit} title={canEdit?'编辑任务配置':'仅草稿任务可编辑'} onClick={()=>editTask(task)}>编辑</Button>
      <Button type="link" size="small" disabled={!canPublish} title={canPublish?'发布任务':'仅草稿任务可发布'} onClick={()=>publishTask(task)}>发布</Button>
      <Dropdown trigger={['click']} placement="bottomRight" menu={{items:[
        {key:'rerun',label:'重跑',disabled:!canRerun,onClick:()=>rerunTask(task)},
        {key:'terminate',label:'终止',danger:true,disabled:!canTerminate,onClick:()=>terminateTask(task)},
        {key:'delete',label:'删除',danger:true,disabled:!canDelete,onClick:()=>deleteTask(task)},
        {key:'copy',label:'复制',onClick:()=>copyTask(task)}
      ]}}><Button type="link" size="small">更多 <DownOutlined/></Button></Dropdown>
    </Space>;
  };
  const columns=[
    {title:'任务名称 / ID',dataIndex:'name',width:250,render:(v,r)=><div><Button type="link" className="name-link" onClick={()=>openDetail(r)}>{v}</Button><div className="muted-id">{r.id}</div></div>},
    {title:'任务类型',dataIndex:'taskType',width:145},
    {title:'业务类型',dataIndex:'businessType',width:110},
    {title:'状态',dataIndex:'status',width:95,render:v=><Badge status={statusMap[v]} text={v}/>},
    {title:'进度',dataIndex:'progress',width:145,render:(v,r)=><Tooltip title={`当前执行：${r.currentStage||'等待资源'}`}><div className="task-progress-cell"><Progress percent={v} size="small" status={r.status==='失败'?'exception':r.status==='已完成'?'success':'active'}/></div></Tooltip>},
    {title:'更新时间',width:185,render:(_,r)=>formatDateTime(r.updated||r.backendJob?.updated_at||r.created)},
    {title:'操作',fixed:'right',width:240,render:(_,r)=>renderTaskActions(r)}
  ];
  const writeDataset = v => {
    if(!v.backendJob || !v.outputMode) return;
    const result=v.backendJob.result||{};
    if(v.backendJob.id?.startsWith('FICTIONAL-DOC-')){
      const samples=result.sample_count??v.count??0;
      const quality=result.quality_status||'未质检';
      const urls=v.backendJob.artifact_urls||{};
      const firstImage=Array.isArray(urls.images)?urls.images[0]:null;
      const artifactUrl=urls.manifest||firstImage||null;
      const qualityReportUrl=urls.quality_report||null;
      const created=nowDateTime();
      setDatasets(items=>{
        if(v.outputMode==='newVersion'){
          return items.map(dataset=>{
            if(dataset.name!==v.targetDataset)return dataset;
            const version=createVersionId(`${dataset.id}-${v.backendJob.id}-${Date.now()}`);
            const newVersion={id:version,version,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),quality,created,updatedAt:created,consumers:[],artifactUrl,qualityReportUrl,previewUrl:firstImage};
            newVersion.qualityReport=buildVersionQualityReport(v.modality,newVersion);
            return {...dataset,defaultVersion:version,totalSamples:numericSampleCount(dataset.totalSamples)+numericSampleCount(samples),updatedAt:created,versions:[newVersion,...dataset.versions]};
          });
        }
        const id=createDatasetId(`${v.backendJob.id}-${Date.now()}`,created);
        const versionId=createVersionId(`${id}-${v.backendJob.id}-${Date.now()}`);
        const version={id:versionId,version:versionId,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),quality,created,updatedAt:created,consumers:[],artifactUrl,qualityReportUrl,previewUrl:firstImage};
        version.qualityReport=buildVersionQualityReport(v.modality,version);
        return [{id,name:v.outputDatasetName,modality:v.modality,businessType:v.businessType,status:'可用',desc:v.description||'由虚构文档模板生成服务写入，包含图片、标注、manifest 与质检报告。',defaultVersion:versionId,totalSamples:numericSampleCount(samples),sourceType:'任务生成',updatedAt:created,reference:true,versions:[version]},...items];
      });
      return;
    }
    if(v.backendJob.id?.startsWith('CUSTOMS-')){
      const finalQc=result.expanded_qc_summary||result.qc_summary||{};
      const statusCounts=finalQc.status_counts||{};
      const checked=Object.values(statusCounts).reduce((sum,value)=>sum+Number(value||0),0);
      const quality=checked?Number((Number(statusCounts.PASS||0)*100/checked).toFixed(1)):'未质检';
      const samples=result.generation_summary?.sample_count??v.count??0;
      const artifactUrl=result.preview_url||null;
      const qualityReportUrl=result.quality_report_url?`/reports/customs/${encodeURIComponent(v.backendJob.id)}/quality`:null;
      const created=nowDateTime();
      setDatasets(items=>{
        if(v.outputMode==='newVersion'){
          return items.map(dataset=>{
            if(dataset.name!==v.targetDataset)return dataset;
            const version=createVersionId(`${dataset.id}-${v.backendJob.id}-${Date.now()}`);
            const newVersion={id:version,version,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),quality,created,updatedAt:created,consumers:[],artifactUrl,qualityReportUrl};
            newVersion.qualityReport=buildVersionQualityReport(v.modality,newVersion);
            return {...dataset,defaultVersion:version,totalSamples:numericSampleCount(dataset.totalSamples)+numericSampleCount(samples),updatedAt:created,versions:[newVersion,...dataset.versions]};
          });
        }
        const id=createDatasetId(`${v.backendJob.id}-${Date.now()}`,created);
        const versionId=createVersionId(`${id}-${v.backendJob.id}-${Date.now()}`);
        const version={id:versionId,version:versionId,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),quality,created,updatedAt:created,consumers:[],artifactUrl,qualityReportUrl};
        version.qualityReport=buildVersionQualityReport(v.modality,version);
        return [{id,name:v.outputDatasetName,modality:v.modality,businessType:v.businessType,status:'可用',desc:v.description||'由进口报关单合成、质检与扩增管线写入。',defaultVersion:versionId,totalSamples:numericSampleCount(samples),sourceType:'任务生成',updatedAt:created,reference:true,versions:[version]},...items];
      });
      return;
    }
    if(v.backendJob.id?.startsWith('CONV-')){
      const finalQuality=result.final_quality||{};
      const samples=finalQuality.sample_count??result.generation?.final_count??v.count??0;
      const quality=finalQuality.average_score??'未质检';
      const artifactUrl=result.artifact_urls?.train_pass||null;
      const qualityReportUrl=`/reports/conversations/${encodeURIComponent(v.backendJob.id)}/quality`;
      const created=nowDateTime();
      setDatasets(items=>{
        if(v.outputMode==='newVersion'){
          return items.map(dataset=>{
            if(dataset.name!==v.targetDataset)return dataset;
            const version=createVersionId(`${dataset.id}-${v.backendJob.id}-${Date.now()}`);
            const newVersion={id:version,version,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),quality,created,updatedAt:created,consumers:[],artifactUrl,qualityReportUrl};
            newVersion.qualityReport=buildVersionQualityReport(v.modality,newVersion);
            return {...dataset,defaultVersion:version,totalSamples:numericSampleCount(dataset.totalSamples)+numericSampleCount(samples),updatedAt:created,versions:[newVersion,...dataset.versions]};
          });
        }
        const id=createDatasetId(`${v.backendJob.id}-${Date.now()}`,created);
        const versionId=createVersionId(`${id}-${v.backendJob.id}-${Date.now()}`);
        const version={id:versionId,version:versionId,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),quality,created,updatedAt:created,consumers:[],artifactUrl,qualityReportUrl};
        version.qualityReport=buildVersionQualityReport(v.modality,version);
        return [{id,name:v.outputDatasetName,modality:v.modality,businessType:v.businessType,status:'可用',desc:v.description||'由智能客服对话合成、质检与扩增管线写入。',defaultVersion:versionId,totalSamples:numericSampleCount(samples),sourceType:'任务生成',updatedAt:created,reference:true,versions:[version]},...items];
      });
      return;
    }
    const summary=result.final_qc||result.generation_summary||{};
    const samples=summary.shipment_count??v.count??0;
    const rows=summary.row_count??result.generation_summary?.row_count??0;
    const quality=summary.average_score??'未质检';
    const created=nowDateTime();
    setDatasets(items=>{
      if(v.outputMode==='newVersion'){
        return items.map(dataset=>{
          if(dataset.name!==v.targetDataset)return dataset;
          const version=createVersionId(`${dataset.id}-${v.backendJob.id}-${Date.now()}`);
          const newVersion={id:version,version,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),rowCount:numericSampleCount(rows),quality,created,updatedAt:created,consumers:[],artifactUrl:result.final_delivery_url,qualityReportUrl:result.quality_enabled?`/reports/cold-chain/${encodeURIComponent(v.backendJob.id)}/quality`:null};
          newVersion.qualityReport=buildVersionQualityReport(v.modality,newVersion);
          return {...dataset,defaultVersion:version,totalSamples:numericSampleCount(dataset.totalSamples)+numericSampleCount(samples),updatedAt:created,versions:[newVersion,...dataset.versions]};
        });
      }
      const id=createDatasetId(`${v.backendJob.id}-${Date.now()}`,created);
      const versionId=createVersionId(`${id}-${v.backendJob.id}-${Date.now()}`);
      const version={id:versionId,version:versionId,note:v.versionNote,source:v.backendJob.id,sourceName:v.name,samples:numericSampleCount(samples),rowCount:numericSampleCount(rows),quality,created,updatedAt:created,consumers:[],artifactUrl:result.final_delivery_url,qualityReportUrl:result.quality_enabled?`/reports/cold-chain/${encodeURIComponent(v.backendJob.id)}/quality`:null};
      version.qualityReport=buildVersionQualityReport(v.modality,version);
      return [{id,name:v.outputDatasetName,modality:v.modality,businessType:v.businessType,status:'可用',desc:v.description||'由冷藏集装箱国际运输生成管线写入。',defaultVersion:versionId,totalSamples:numericSampleCount(samples),sourceType:'任务生成',updatedAt:created,reference:true,versions:[version]},...items];
    });
  };
  useEffect(()=>{
    const ready=tasks.filter(task=>task.pendingDatasetWrite&&!task.datasetWritten&&task.backendJob?.status==='completed');
    if(!ready.length)return;
    ready.forEach(task=>writeDataset({...task.configSnapshot,name:task.name,description:task.description,taskType:task.taskType,modality:task.modality,businessType:task.businessType,backendJob:task.backendJob}));
    const ids=new Set(ready.map(task=>task.id));
    setTasks(items=>items.map(task=>ids.has(task.id)?{...task,pendingDatasetWrite:false,datasetWritten:true}:task));
  },[tasks]);
  if(draft) return <CreateTaskPage draft={draft} datasets={datasets} onCancel={()=>setDraft(null)} onSaveDraft={async values=>{
    const id=draft.editingTaskId||`DRAFT-${crypto.randomUUID()}`;
    const saved=buildTaskDraft(values,id,nowDateTime(),tasks.find(task=>task.id===id));
    const next=upsertTaskDraft(tasks,saved);
    await localStoreApi.saveTasks(next);
    setTasks(next);
    setDraft({...values,name:saved.name,editingTaskId:id,configSnapshot:saved.configSnapshot});
  }} onSubmit={v=>{
    const taskId=prototypeTaskId(`${Date.now()}-${v.name}-${Math.random()}`);
    const nextTask=newExecutionTask(v,taskId,createVersionId(taskId));
    setTasks(items=>[nextTask,...items.filter(item=>item.id!==draft.editingTaskId)]);
    message.success('任务已提交');
    setDraft(null);
  }}/>;
  const isSyntheticDocumentDetail=Boolean(activeDetail?.backendJob?.id?.startsWith('FICTIONAL-DOC-'));
  const isCustomsDetail=Boolean(activeDetail&&(activeDetail.backendJob?.id?.startsWith('CUSTOMS-')||!isSyntheticDocumentDetail&&activeDetail.businessType==='报关单'&&activeDetail.taskType==='数据合成'));
  const isConversationDetail=Boolean(activeDetail&&(activeDetail.backendJob?.id?.startsWith('CONV-')||activeDetail.modality==='对话文本'&&activeDetail.taskType==='数据合成'));
  const isColdChainDetail=Boolean(activeDetail&&(activeDetail.backendJob?.id?.startsWith('COLDCHAIN-')||activeDetail.modality==='时序数据'&&activeDetail.businessType==='冷链冷藏集装箱国际运输'));
  return <>
    <PageHeader title={`${pageTitle}任务`} description={`独立管理${pageTitle}的数据合成、质检、增强和定向扩增任务`} actions={<Dropdown trigger={['click']} placement="bottomRight" menu={{items:createMenuItems,onClick:({key})=>setDraft({modality,taskType:key})}}><Button type="primary" icon={<PlusOutlined/>}>新建任务 <DownOutlined/></Button></Dropdown>}/>
    <StatCards items={[{title:'任务总数',value:modalityTasks.length,icon:<AppstoreOutlined/>,foot:`仅统计${pageTitle}任务`},{title:'运行中',value:modalityTasks.filter(item=>item.status==='运行中').length,icon:<PlayCircleOutlined/>,foot:'状态来自本地任务日志'},{title:'已完成',value:modalityTasks.filter(item=>item.status==='已完成').length,icon:<CheckCircleOutlined/>,foot:'刷新页面后仍会保留'},{title:'待处理异常',value:modalityTasks.filter(item=>item.status==='失败').length,icon:<ExclamationCircleOutlined/>,foot:'可在详情中查看失败阶段'}]}/>
    <Card className="main-card" styles={{body:{padding:0}}}><div>
      <Flex justify="space-between" align="center" className="toolbar task-list-toolbar"><Space><Segmented value={taskType} onChange={setTaskType} options={[{label:'全部',value:'all'},{label:'合成',value:'数据合成'},{label:'质检',value:'数据质检'},{label:'增强',value:'数据增强'},{label:'定向扩增',value:'定向扩增'}]}/><Select placeholder="请选择选项" value={tab} onChange={setTab} style={{width:150}} options={[{label:'全部任务状态',value:'all'},...['草稿','排队中','运行中','已完成','异常','已终止'].map(v=>({label:v==='失败'?'异常':v,value:v}))]}/><Select placeholder="请选择选项" value={businessTypeFilter} onChange={setBusinessTypeFilter} style={{width:170}} options={[{label:'全部业务类型',value:'all'},...businessTypeOptions.map(value=>({label:value,value}))]}/></Space><Input allowClear prefix={<SearchOutlined/>} placeholder="搜索任务名称或ID" value={query} onChange={e=>setQuery(e.target.value)} style={{width:250}}/></Flex>
      <Table columns={columns} dataSource={filtered} scroll={{x:1490}} pagination={{pageSize:8,showTotal:t=>`共 ${t} 条`}}/>
    </div></Card>
    <DetailPage title="任务详情" size={1100} open={!!activeDetail} onClose={()=>{setDetail(null);setDetailTab('info');}}>{activeDetail&&<><Title level={4}>{activeDetail.name}</Title><Paragraph type="secondary">{activeDetail.description}</Paragraph><ProductTaskDetail key={activeDetail.id} task={activeDetail} datasets={datasets}/></>}</DetailPage>
  </>;
}

function HomePage({ onNavigate, onCreate }) {
  const journey=[
    {step:'Step 1',icon:<ApartmentOutlined/>,title:'制作数据模板',desc:'上传种子数据并配置版式、字段和生成规则，沉淀可复用的数据模板。',tags:['模板制作','版式分析','字段规则'],action:'进入模板中心',onClick:()=>onNavigate('templates')},
    {step:'Step 2',icon:<PlayCircleOutlined/>,title:'生成业务数据',desc:'选择文档图像、对话文本或时序数据模板，通过单页表单配置合成规则并生成新数据。',tags:['文档图像','对话文本','时序数据'],action:'创建合成任务',onClick:()=>onCreate('数据合成')},
    {step:'Step 3',icon:<SafetyCertificateOutlined/>,title:'评估并持续优化',desc:'对已有版本分别发起数据质检、数据增强或定向扩增任务。',tags:['数据质检','数据增强','定向扩增'],action:'创建质检任务',onClick:()=>onCreate('数据质检')},
    {step:'Step 4',icon:<DatabaseOutlined/>,title:'复用数据资产',desc:'在数据中心查看、预览和下载不可变版本，也可以将已有版本作为参考样例或继续发起评估任务。',tags:['版本管理','数据血缘','预览下载'],action:'查看数据',onClick:()=>onNavigate('data')}
  ];
  return <div className="home-page">
    <section className="home-intro"><Title>你好，{CURRENT_USER}</Title><Paragraph>数据生成工具平台是一个提供生成、评估并持续优化文档图像、对话文本和时序数据的平台</Paragraph></section>
    <section className="journey-section"><div className="journey-heading"><Title level={4}>四步完成数据生产与优化</Title><Text type="secondary">从制作模板到复用数据资产，每一步都可以直接开始</Text></div><div className="journey-grid">{journey.map((item,index)=><Card key={item.step} className="journey-card" hoverable onClick={item.onClick}><div className={`journey-icon journey-icon-${index+1}`}>{item.icon}</div><Text className="journey-step">Step {index+1}</Text><Title level={4}>{item.title}</Title><Paragraph type="secondary">{item.desc}</Paragraph><Space wrap className="journey-tags">{item.tags.map(tag=><Tag key={tag}>{tag}</Tag>)}</Space><Button type="primary" onClick={e=>{e.stopPropagation();item.onClick();}}>{item.action}</Button></Card>)}</div></section>
  </div>;
}

const UPLOAD_TEMPLATE_BY_MODALITY = {
  文档图像: { key: 'document', label: '文档类图像', hint: '直接上传 ZIP，无需解压；包内 images 与 annotations 同名对应。' },
  对话文本: { key: 'conversation', label: '对话', hint: '直接上传 ZIP，无需解压；包内 data/conversations.jsonl 每行包含事件计划及完整会话。' },
  时序数据: { key: 'timeseries', label: '时序', hint: '直接上传 ZIP，无需解压；包内 data 一条样本一个 JSON，包含事件和各字段时间—值序列。' },
};

const uploadEntryPath = entry => String(entry?.originFileObj?.webkitRelativePath || entry?.webkitRelativePath || entry?.name || '').replaceAll('\\', '/');
const uploadEntryText = async entry => entry?.originFileObj?.text ? entry.originFileObj.text() : entry?.text ? entry.text() : '';

async function validateUploadFolder(modality, fileList) {
  // 纯前端演示：不读取或解析用户文件，选择任意文件夹即视为通过。
  return { status: 'passed', message: 'Mock 格式校验通过（演示模式）' };
  const files = (fileList || []).filter(item => item?.name && !item.name.startsWith('.'));
  if (!modality) return { status: 'idle', message: '请先选择数据类型' };
  if (!files.length) return { status: 'idle', message: '选择文件夹后将自动校验格式' };
  const errors = [];
  if (modality === '文档图像') {
    const images = files.filter(item => /\.(png|jpe?g|webp|tiff?)$/i.test(item.name) && /(^|\/)images\//i.test(uploadEntryPath(item)));
    const annotations = files.filter(item => /\.json$/i.test(item.name) && /(^|\/)annotations\//i.test(uploadEntryPath(item)));
    if (!images.length) errors.push('images 目录中未找到 PNG、JPG、WEBP 或 TIFF 图片');
    if (!annotations.length) errors.push('annotations 目录中未找到 JSON 标注文件');
    const imageNames = new Set(images.map(item => item.name.replace(/\.[^.]+$/, '').toLowerCase()));
    const annotationNames = new Set(annotations.map(item => item.name.replace(/\.json$/i, '').toLowerCase()));
    if (images.length && annotations.length && ![...imageNames].some(name => annotationNames.has(name))) errors.push('图片与标注 JSON 的文件名无法对应');
    for (const item of annotations.slice(0, 20)) {
      try { JSON.parse(await uploadEntryText(item)); }
      catch { errors.push(`标注文件 ${item.name} 不是合法 JSON`); break; }
    }
    return errors.length ? { status: 'failed', errors } : { status: 'passed', message: `格式校验通过：${images.length} 张图片，${annotations.length} 个标注文件` };
  }
  if (modality === '对话文本') {
    const dataFiles = files.filter(item => /\.(jsonl|json)$/i.test(item.name));
    if (!dataFiles.length) errors.push('未找到 JSONL 或 JSON 对话数据文件');
    let sampleCount = 0;
    for (const item of dataFiles.slice(0, 20)) {
      try {
        const text = await uploadEntryText(item);
        const samples = item.name.toLowerCase().endsWith('.jsonl')
          ? text.split(/\r?\n/).filter(Boolean).slice(0, 50).map(line => JSON.parse(line))
          : (() => { const parsed = JSON.parse(text); return Array.isArray(parsed) ? parsed : parsed.items || [parsed]; })();
        if (!samples.length || samples.some(sample => !Array.isArray(sample?.messages) || sample.messages.length < 2 || sample.messages.some(messageItem => !messageItem?.role || typeof messageItem?.content !== 'string'))) {
          errors.push(`${item.name} 中存在缺少 messages、role 或 content 的数据`); break;
        }
        sampleCount += samples.length;
      } catch { errors.push(`${item.name} 不是合法的 JSONL / JSON 文件`); break; }
    }
    return errors.length ? { status: 'failed', errors } : { status: 'passed', message: `格式校验通过：${dataFiles.length} 个文件，已抽检 ${sampleCount} 条对话` };
  }
  const csvFiles = files.filter(item => /\.csv$/i.test(item.name));
  if (!csvFiles.length) errors.push('未找到 CSV 时序数据文件');
  let rowCount = 0;
  for (const item of csvFiles.slice(0, 20)) {
    try {
      const lines = (await uploadEntryText(item)).split(/\r?\n/).filter(Boolean);
      const headers = (lines[0] || '').split(',').map(value => value.trim().toLowerCase());
      const missing = ['series_id', 'timestamp', 'value'].filter(field => !headers.includes(field));
      if (missing.length) { errors.push(`${item.name} 缺少表头：${missing.join('、')}`); break; }
      if (lines.length < 2) { errors.push(`${item.name} 没有数据行`); break; }
      rowCount += lines.length - 1;
    } catch { errors.push(`${item.name} 无法读取`); break; }
  }
  return errors.length ? { status: 'failed', errors } : { status: 'passed', message: `格式校验通过：${csvFiles.length} 个 CSV 文件，共 ${rowCount} 行数据` };
}

function UploadDatasetPage({ onCancel, onSubmit, datasets, editing }) {
  const [form]=Form.useForm();
  const [fileList,setFileList]=useState(()=>editing?.version.uploadFiles||[]);
  const [metadata,setMetadata]=useState({status:'idle',detected:[]});
  const [pendingUpload,setPendingUpload]=useState(null),[uploadProgress,setUploadProgress]=useState(0);
  const modality=Form.useWatch('modality',form)||'文档图像';
  const uploadMode=Form.useWatch('uploadMode',form)||'newDataset';
  const templateId=Form.useWatch('templateId',form);
  const targetName=Form.useWatch('targetDataset',form);
  const name=Form.useWatch('name',form);
  const target=(datasets||[]).find(d=>d.name===targetName);
  const options=templatesForModality(modality);
  const selectedTemplate=options.find(t=>t.id===templateId);
  const maxBytes=modality==='文档图像'?2*1024**3:500*1024**2;
  const limitLabel=modality==='文档图像'?'2 GB':'500 MB';
  const totalBytes=fileList.reduce((sum,f)=>sum+Number(f.size||0),0);
  const overLimit=totalBytes>maxBytes;
  const templateInfo=UPLOAD_TEMPLATE_BY_MODALITY[modality];
  useEffect(()=>{
    let active=true;
    if(!fileList.length||overLimit){setMetadata({status:'idle',detected:[]});return;}
    if(editing&&!fileList.some(f=>f.originFileObj)){setMetadata({status:'idle',detected:[]});return;}
    setMetadata({status:'checking',detected:[]});
    detectUploadMetadata(fileList,templatesForModality(modality)).then(result=>{
      if(!active)return;setMetadata(result);
      if(form.getFieldValue('uploadMode')!=='newVersion')form.setFieldValue('templateId',result.templateId||undefined);
    });
    return ()=>{active=false;};
  },[fileList,modality,overLimit,form]);
  useEffect(()=>{
    if(uploadMode==='newVersion')form.setFieldsValue({templateId:target?.templateId,name:target?.name});
  },[uploadMode,targetName,target?.templateId,form]);
  useEffect(()=>{
    if(!pendingUpload)return;
    const timer=setInterval(()=>setUploadProgress(v=>Math.min(100,v+10)),250);
    return ()=>clearInterval(timer);
  },[pendingUpload]);
  useEffect(()=>{
    if(!pendingUpload||uploadProgress<100)return;
    setPendingUpload(null);onSubmit(pendingUpload);
  },[pendingUpload,uploadProgress,onSubmit]);
  const reason=!fileList.length?'请选择压缩包':overLimit?'压缩包总大小超过上限':metadata.status==='checking'?'正在检测上传元数据':uploadMode==='newVersion'&&!target?'请选择目标数据集':!String(name||'').trim()?'请填写数据集名称':!selectedTemplate?'请选择已发布模板':'';
  const submit=async(publishAfterSave=false)=>{
    if(reason||pendingUpload)return;
    try{const values=await form.validateFields();setUploadProgress(0);
      // Only trusted form references and package descriptors cross the submission boundary.
      setPendingUpload({...values,publishAfterSave,name:uploadMode==='newVersion'?target.name:values.name,fileList:fileList.map(f=>({name:f.name,size:f.size})),discardedMetadata:true});
    }catch{}
  };
  const matchText={checking:'正在检测 manifest、lineage、quality…',matched:'已匹配系统中的已发布模板',absent:'未检测到模板元数据，请手动关联',unmatched:'未匹配到相同 ID 的模板，请手动关联',warning:'部分元数据无法解析，请手动关联'};
  return <div className="create-task-page dataset-upload-page">
    <Flex justify="space-between" align="center" className="create-page-heading"><Space><Button type="text" shape="circle" icon={<LeftOutlined/>} aria-label="返回数据中心" onClick={onCancel}/><Title level={3}>上传数据集</Title></Space><Space><Button disabled={!!pendingUpload} onClick={onCancel}>取消</Button><Button loading={!!pendingUpload&&!pendingUpload.publishAfterSave} disabled={!!reason||!!pendingUpload} onClick={()=>submit(false)}>保存草稿</Button><Button type="primary" loading={!!pendingUpload&&pendingUpload.publishAfterSave} disabled={!!reason||!!pendingUpload} onClick={()=>submit(true)}>保存并发布</Button></Space></Flex>
    <Card><Form form={form} layout="vertical" disabled={!!pendingUpload} initialValues={editing?{modality:editing.dataset.modality,uploadMode:'newDataset',name:editing.dataset.name,description:editing.version.note,templateId:editing.version.templateId}:{modality:'文档图像',uploadMode:'newDataset'}}>
      <Title level={5}>上传数据</Title>
      <Form.Item name="modality" label="数据类型" rules={[{required:true}]}><Radio.Group disabled={!!editing||!!pendingUpload} optionType="button" buttonStyle="solid" onChange={()=>{form.setFieldsValue({templateId:undefined,targetDataset:undefined});setFileList([]);}} options={[{label:'文档类图像',value:'文档图像'},{label:'对话',value:'对话文本'},{label:'时序',value:'时序数据'}]}/></Form.Item>
      <Form.Item label="数据压缩包" required><Space align="start" wrap><Upload accept=".zip" multiple beforeUpload={file=>{if(!/\.zip$/i.test(file.name)||!file.size){message.error('请选择非空 ZIP 压缩包');return Upload.LIST_IGNORE;}return false;}} fileList={fileList} onChange={({fileList:next})=>setFileList(next)} showUploadList={{showRemoveIcon:!pendingUpload}}><Button icon={<CloudUploadOutlined/>}>选择压缩包</Button></Upload><Button type="link" onClick={async()=>{try{await downloadDatasetExample(templateInfo.key,'upload');message.success('上传模板已开始下载');}catch(e){message.error(e.message);}}}>下载示例 ZIP</Button></Space><div><Text type="secondary">支持多个 ZIP，合计不超过 {limitLabel}。发布前检查文件、隐私及安全；发现问题后由你选择删除、重新上传或配置脱敏。</Text></div><div><Text type="secondary">如果上传的压缩包中包含本平台下载数据集时的manifest、lineage、quality文件，上传时仅用于检测模板线索，不保存，也不沿用其中的血缘或质检结果。</Text></div></Form.Item>
      {!!fileList.length&&<div style={{marginBottom:16}}><Text type={overLimit?'danger':'secondary'}>已选择 {fileList.length} 个压缩包，共 {(totalBytes/1024**2).toFixed(2)} MB / {limitLabel}{overLimit?'，请移除部分文件':''}</Text>{pendingUpload&&<Progress percent={uploadProgress}/>}</div>}
      <Divider/><Title level={5}>保存设置</Title>
      <Form.Item name="uploadMode" label="保存方式" hidden={!!editing}><Radio.Group optionType="button" buttonStyle="solid" onChange={()=>{form.setFieldsValue({targetDataset:undefined,name:undefined,templateId:metadata.templateId||undefined});}} options={[{label:'创建新数据集',value:'newDataset'},{label:'已有数据集新版本',value:'newVersion'}]}/></Form.Item>
      {uploadMode==='newVersion'&&<Form.Item name="targetDataset" label="目标数据集" rules={[{required:true,message:'请选择目标数据集'}]}><Select showSearch optionFilterProp="label" placeholder="选择目标数据集" options={(datasets||[]).filter(d=>d.modality===modality||modality==='文档图像'&&d.modality==='文档类图像').map(d=>({value:d.name,label:d.name}))}/></Form.Item>}
      <Form.Item name="name" label="数据集名称" rules={[{required:true,whitespace:true,message:'请填写数据集名称'}]}><Input disabled={uploadMode==='newVersion'||!!pendingUpload} placeholder="请输入数据集名称"/></Form.Item>
      <Form.Item name="description" label={uploadMode==='newVersion'?'版本描述':'数据集描述'}><Input.TextArea placeholder="请输入描述" rows={2}/></Form.Item>
      <Divider/><Title level={5}>关联模板</Title>
      {metadata.status!=='idle'&&metadata.status!=='conflict'&&<div style={{marginBottom:12}}><Text type="secondary">{matchText[metadata.status]}{metadata.templateId&&uploadMode==='newVersion'?'；使用目标数据集的模板':''}</Text></div>}
      <Form.Item name="templateId" label="绑定已发布模板" rules={[{required:true,message:'请选择已发布模板'}]}><Select showSearch optionFilterProp="label" disabled={uploadMode==='newVersion'||!!editing?.version.sourceVersionId||!!pendingUpload||metadata.status==='checking'} placeholder="请选择已发布模板" options={options.map(t=>({value:t.id,label:t.name}))}/></Form.Item>
      {selectedTemplate&&<Descriptions bordered size="small" column={2} items={[
        {key:'name',label:'模板名称',children:selectedTemplate.name},
        {key:'id',label:'模板 ID',children:<Text copyable>{selectedTemplate.id}</Text>},
        {key:'business',label:'业务类型',children:selectedTemplate.businessType||'-'},
        {key:'method',label:'模板制作方式',children:selectedTemplate.method||'-'},
        {key:'description',label:'描述',span:2,children:selectedTemplate.description||selectedTemplate.desc||'暂无描述'},
      ]}/>}
    </Form></Card>
  </div>;
}

const percentText = value => Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(2)}%` : '-';

function QualityStatusSummary({ counts = {}, total = 0 }) {
  const colors = { ERROR:'#cf1322', PASS: '#52c41a', REVIEW: '#faad14', REJECT: '#ff4d4f', UNCHECKED:'#8c8c8c' };
  const labels = { ERROR:'质检异常', PASS:'PASS', REVIEW:'REVIEW', REJECT:'REJECT', UNCHECKED:'未质检' };
  const statuses=['PASS','REVIEW','REJECT',...(counts.ERROR?['ERROR']:[]),...(counts.UNCHECKED?['UNCHECKED']:[])];
  return <Row gutter={[12,12]}>{statuses.map(status=><Col flex={`${100/statuses.length}%`} key={status}><Card size="small"><Flex justify="space-between" align="center"><div><Text type="secondary">{labels[status]}</Text><Title level={4} style={{margin:'4px 0 0',color:colors[status]}}>{Number(counts[status] || 0).toLocaleString()}</Title></div><Progress type="circle" size={54} percent={total?Math.round(Number(counts[status]||0)/total*100):0} strokeColor={colors[status]}/></Flex></Card></Col>)}</Row>;
}

function VersionQualityReport({ dataset, version, fixedReport=false }) {
  const reports=useMemo(()=>fixedReport?qualityReports(version):versionReportsForDisplay(dataset,version),[dataset,version,fixedReport]);
  const [reportId,setReportId]=useState(null);
  useEffect(()=>setReportId(null),[version.version,reports[0]?.reportId]);
  const preferred=preferredQualityReport(reports);
  const report=reports.find(item=>item.reportId===reportId)||preferred;
  return <>{!fixedReport&&reports.length>0&&<Select placeholder="请选择选择质检报告" aria-label="选择质检报告" style={{width:'100%',marginBottom:16}} value={report?.reportId} onChange={setReportId} options={reports.map(item=>({value:item.reportId,label:`${item.reportId} · ${item.createdAt||'-'}${item.reportId===preferred?.reportId?'（默认）':''}`}))}/>}<VersionQualityReportContent dataset={dataset} version={versionWithReport(version,fixedReport?version.qualityReport:report)}/></>;
}

function VersionQualityReportContent({dataset,version}){
  return <RuleQualityReport key={version.qualityReport?.reportId||version.version} report={version.qualityReport}/>;
}

function DownstreamTaskDetailPage({ task, dataset, version }) {
  const actual=readStore('application-state',{}).tasks?.find(item=>item.id===task?.id);
  if(actual?.configSnapshot)return <main className="standalone-task-detail"><Title level={3}>{actual.name}</Title><Card><ProductTaskDetail task={actual}/></Card></main>;
  if (!task) return <main className="standalone-task-detail"><Empty description="未找到下游任务记录"/><Button onClick={()=>window.close()}>关闭页面</Button></main>;
  return <main className="standalone-task-detail"><Flex justify="space-between" align="center"><div><Text type="secondary">下游任务详情</Text><Title level={2}>{task.name}</Title></div><Button onClick={()=>window.close()}>关闭页面</Button></Flex><Card><Descriptions bordered column={2} items={[
    {key:'name',label:'任务名称',children:task.name},{key:'id',label:'任务 ID',children:<Text copyable>{task.id}</Text>},
    {key:'type',label:'任务类型',children:<Tag color={taskTypeColor(task.taskType)}>{task.taskType}</Tag>},{key:'status',label:'任务状态',children:<StatusTag value={task.status||'已完成'}/>},
    {key:'dataset',label:'输入数据集',children:`${dataset?.name || '-'} / ${dataset?.id || '-'}`},{key:'version',label:'输入版本 ID',children:<Text copyable>{version?.version || '-'}</Text>},
    {key:'updated',label:'更新时间',children:formatDateTime(task.updatedAt)},{key:'description',label:'任务说明',children:`基于指定数据集版本执行${task.taskType}处理。`},
  ]}/></Card></main>;
}

function DataCenter({ tasks, datasets, setDatasets, uploading, onUploadingChange, onStartTask }) {
  const [downloading,setDownloading]=useState(null);
  const [editingUpload,setEditingUpload]=useState(null);
  const [modality,setModality]=useState('全部');
  const [sourceFilter,setSourceFilter]=useState('全部');
  const [businessTypeFilter,setBusinessTypeFilter]=useState('全部');
  const [query,setQuery]=useState('');
  const [detail,setDetail]=useState(null);
  const [uploadPanelVersion,setUploadPanelVersion]=useState(null);
  const uploadPanelVersions=(detail?.versions||[]).filter(v=>v.sourceType==='用户上传').slice().sort((a,b)=>String(b.created||'').localeCompare(String(a.created||'')));
  const displayedUploadVersion=uploadPanelVersions.find(v=>v.version===uploadPanelVersion)||uploadPanelVersions[0];
  const [versionDetail,setVersionDetail]=useState(null);
  const [sourceTaskDetail,setSourceTaskDetail]=useState(null);
  const [linkedDatasetOpened,setLinkedDatasetOpened]=useState(false);
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get('datasetDetail');
    if(!id||linkedDatasetOpened)return;
    const dataset=datasets.find(item=>String(item.id)===id);
    if(dataset){setDetail(dataset);setLinkedDatasetOpened(true);}
  },[datasets,linkedDatasetOpened]);
  const uploadTaskVersion=datasets.flatMap(d=>d.versions).find(v=>v.source===sourceTaskDetail?.id&&v.sourceType==='用户上传');
  useEffect(()=>{setDetail(c=>c?datasets.find(d=>d.id===c.id)||null:null);setVersionDetail(c=>{if(!c)return null;const dataset=datasets.find(d=>d.id===c.dataset.id),version=dataset?.versions.find(v=>v.version===c.version.version);return version?{...c,dataset,version}:null;});},[datasets]);
  const resolveTask=value=>tasks?.find(task=>task.id===value?.id);
  const [descriptionEditing,setDescriptionEditing]=useState(false);
  const [descriptionDraft,setDescriptionDraft]=useState('');

  const updateDataset = (datasetId, updater) => {
    setDatasets(items=>items.map(dataset=>dataset.id===datasetId?updater(dataset):dataset));
    setDetail(current=>current?.id===datasetId?updater(current):current);
    setVersionDetail(current=>current?.dataset.id===datasetId?{...current,dataset:updater(current.dataset),version:updater(current.dataset).versions.find(item=>item.id===current.version.id)||current.version}:current);
  };
  const createUploadedDataset = values => {
    const now=nowDateTime(),template=PUBLISHED_TEMPLATE_PROFILES.find(t=>t.id===values.templateId);
    if(!template)return;
    const fields=template.documentSnapshot?.fields||template.configuration?.fields||[];
    const uploadFieldIds=fields.map(field=>field.field_id||field.id).filter(Boolean);
    const finishSave=v=>values.publishAfterSave?beginUploadCheck(v):v;
    const files=values.fileList.map((f,i)=>({...f,uid:String(i)}));
    const uploadConfigSnapshot={qualityRules:templateQualityRules(values.modality,template),name:values.name,description:values.description,modality:values.modality,uploadMode:values.uploadMode,targetDataset:values.targetDataset,templateId:template.id,templateVersion:template.version,files:files.map(({name,size,type})=>({name,size,type}))};
    if(editingUpload){
      updateDataset(editingUpload.dataset.id,d=>({...d,versions:d.versions.map(v=>v.version!==editingUpload.version.version?v:finishSave({...v,note:values.description||'',templateId:template.id,templateVersion:template.version,uploadConfigSnapshot,uploadFieldIds,uploadFiles:files,publicationStatus:'草稿',updatedAt:now,draftSourceRetained:true}))}));
      if(values.publishAfterSave){setDetail(editingUpload.dataset);setUploadPanelVersion(editingUpload.version.version);}
      setEditingUpload(null);onUploadingChange(false);message.success(values.publishAfterSave?'已保存，正在进行发布检查':'草稿已保存');return;
    }
    const uploadId='UPLOAD-'+Date.now(),versionId=createVersionId(uploadId),id=createDatasetId(uploadId,now);
    const v=finishSave({id:versionId,version:versionId,note:values.description||'上传草稿',versionKind:'用户上传',sourceType:'用户上传',source:uploadId,sourceName:'上传任务 · '+values.name,publicationStatus:'草稿',samples:files.length*100,created:now,updatedAt:now,consumers:[],templateId:template.id,templateVersion:template.version,uploadConfigSnapshot,uploadFieldIds,uploadFiles:files,draftSourceRetained:true,uploadRuns:[],qualityChecked:false,qualityReport:null});
    if(values.uploadMode==='newVersion')setDatasets(items=>items.map(d=>d.name!==values.targetDataset?d:{...d,versions:[{...v,sourceDatasetId:d.id,sourceVersionId:d.defaultVersion},...d.versions],updatedAt:now}));
    else setDatasets(items=>[{id,name:values.name,modality:values.modality,businessType:template.businessType,desc:values.description||'',sourceType:'用户上传',templateId:template.id,templateVersion:template.version,defaultVersion:versionId,totalSamples:0,updatedAt:now,versions:[v]},...items]);
    if(values.publishAfterSave){const owner=values.uploadMode==='newVersion'?datasets.find(d=>d.name===values.targetDataset):{id,name:values.name,modality:values.modality,businessType:template.businessType,desc:values.description||'',sourceType:'用户上传',updatedAt:now,versions:[v]};setDetail(owner);setUploadPanelVersion(versionId);}
    onUploadingChange(false);message.success(values.publishAfterSave?'已保存，正在进行发布检查':'已保存为草稿，可在版本列表发布');
  };
  const publishUpload=version=>{setUploadPanelVersion(version.version);if(uploadStatus(version)==='待处理')return;Modal.confirm({title:'发布此版本？',content:'将检查文件、隐私和安全，通过后自动发布。',onOk:()=>updateDataset(detail.id,d=>({...d,versions:d.versions.map(v=>v.version===version.version?beginUploadCheck(v):v)}))});};
  const terminateUpload=version=>Modal.confirm({title:'终止校验？',content:'终止后回到草稿，可编辑后重新发布。',onOk:()=>updateDataset(detail.id,d=>({...d,versions:d.versions.map(v=>v.version===version.version?stopUploadCheck(v):v)}))});
  const datasetBusinessTypeOptions=useMemo(()=>[...new Set(datasets.map(dataset=>dataset.businessType).filter(Boolean))].sort(),[datasets]);
  const list=datasets.filter(dataset=>(modality==='全部'||(dataset.modality==='文档类图像'?'文档图像':dataset.modality)===modality)&&(sourceFilter==='全部'||(dataset.sourceType||'任务生成')===sourceFilter)&&(businessTypeFilter==='全部'||dataset.businessType===businessTypeFilter)&&(!query||String(dataset.name||'').includes(query)||String(dataset.id||'').includes(query)||String(dataset.businessType||'').includes(query)));
  const downloadVersionExample=async(dataset,version)=>{setDownloading(version.version);try{await downloadVersionWithReports(dataset,version);message.success('已开始下载示例 ZIP，包含该版本全部质检报告；样本仍为演示数据');}catch(error){message.error(error.message||'下载失败，请重试');}finally{setDownloading(null);}};
  const startVersionTask=(dataset,version,taskType)=>Modal.confirm({title:`创建${taskType}任务？`,content:taskType==='数据质检'?`将对“${dataset.name} / ${version.version}”执行质检，结果保存在该版本中。`:`将使用“${dataset.name} / ${version.version}”，可在配置页选择质检报告。`,okText:'进入配置',cancelText:'取消',onOk:()=>{setVersionDetail(null);setDetail(null);onStartTask?.(dataset,version,taskType);}});
  const taskDetailUrl=(dataset,version,task)=>{const params=new URLSearchParams({downstreamTask:task.id,datasetId:String(dataset.id),versionId:version.version});return `${window.location.pathname}?${params.toString()}`;};
  const deleteVersion=(dataset,version)=>uploadStatus(version)==='校验中'?message.warning('请先终止校验'):Modal.confirm({title:`删除 ${dataset.name} / ${version.version}？`,icon:<ExclamationCircleOutlined/>,width:580,content:<Alert type="error" showIcon message="删除后将永久移除该版本的数据、预览、报告和下游任务关联。历史任务仍保留，但对应版本将显示为“已删除”。此操作不可恢复。"/>,okText:'确认删除版本',okType:'danger',cancelText:'取消',onOk:()=>{updateDataset(dataset.id,current=>{const versions=current.versions.filter(item=>item.id!==version.id);return {...current,versions,defaultVersion:current.defaultVersion===version.version?(versions[0]?.version||'-'):current.defaultVersion,updatedAt:versions[0]?.updatedAt||current.updatedAt};});setVersionDetail(null);message.success('数据集版本已删除');}});
  const deleteDataset=dataset=>Modal.confirm({title:'是否删除该数据集及所有版本？',icon:<ExclamationCircleOutlined/>,width:600,content:<><Paragraph>数据集“<Text strong>{dataset.name}</Text>”包含 <Text strong>{dataset.versions.length}</Text> 个不可变版本。</Paragraph><Alert type="error" showIcon message="确认后将删除数据集及其全部版本，此操作不可恢复。"/></>,okText:'删除全部版本',okType:'danger',cancelText:'取消',onOk:()=>{setDatasets(items=>items.filter(item=>item.id!==dataset.id));setDetail(null);message.success('数据集及其全部版本已删除');}});
  const saveDescription=()=>{const next=descriptionDraft.trim();if(!next){message.warning('数据集描述不能为空');return;}updateDataset(detail.id,dataset=>({...dataset,desc:next,updatedAt:nowDateTime()}));setDescriptionEditing(false);message.success('数据集描述已更新');};
  const datasetColumns=[
    {title:'数据集名称 / ID',dataIndex:'name',width:260,render:(value,row)=><div><Button type="link" className="name-link" onClick={()=>setDetail(row)}>{value}</Button><div className="muted-id">{row.id}</div></div>},
    {title:'数据类型',dataIndex:'modality',width:120,render:value=>value==='文档类图像'?'文档图像':value},
    {title:'业务类型',dataIndex:'businessType',width:130},{title:'来源',dataIndex:'sourceType',width:120},{title:'版本数',width:110,render:(_,row)=>row.versions?.length??0},
    {title:'总样本数',dataIndex:'totalSamples',width:130,render:value=>numericSampleCount(value).toLocaleString()},{title:'更新时间',width:185,render:(_,row)=>formatDateTime(row.updatedAt||row.versions?.[0]?.updatedAt)},
    {title:'操作',fixed:'right',width:130,render:(_,row)=><Space size={0}><Button type="link" size="small" onClick={()=>setDetail(row)}>详情</Button><Button type="link" size="small" danger onClick={()=>deleteDataset(row)}>删除</Button></Space>},
  ];
  const versionColumns=detail?[
    {title:'版本 ID',dataIndex:'version',width:180,render:value=><Text code copyable>{value}</Text>},
    {title:'状态',width:110,render:(_,v)=><Tag color={{'校验中':'processing','校验失败':'error','已发布':'success'}[uploadStatus(v)]}>{uploadStatus(v)}</Tag>},
    {title:'版本描述',dataIndex:'note',width:230},{title:'数据量',dataIndex:'samples',width:120,render:value=>numericSampleCount(value).toLocaleString()},
    {title:'来源任务',width:230,render:(_,version)=><Button type="link" className="trace-link" onClick={()=>setSourceTaskDetail({id:version.source,name:version.sourceName,taskType:version.versionKind,updatedAt:version.updatedAt,inputVersionId:version.sourceVersionId,outputVersionId:version.version})}><div><span>{version.sourceName||'-'}</span><div className="muted-id">{version.source||'-'}</div></div></Button>},
    {title:'来源数据集版本',width:250,render:(_,version)=>version.sourceVersionId?<Button type="link" className="trace-link" onClick={()=>{const sourceDataset=datasets.find(item=>item.id===version.sourceDatasetId)||detail;const sourceVersion=sourceDataset?.versions.find(item=>item.version===version.sourceVersionId);if(sourceVersion)setVersionDetail({dataset:sourceDataset,version:sourceVersion});}}><div><span>{(datasets.find(item=>item.id===version.sourceDatasetId)||detail)?.name}</span><div className="muted-id">{version.sourceVersionId}</div></div></Button>:'-'},
    {title:'更新时间',dataIndex:'updatedAt',width:185,render:formatDateTime},
    {title:'操作',fixed:'right',width:240,render:(_,version)=>{
      const state=uploadStatus(version),editable=version.sourceType==='用户上传'&&['草稿','校验失败','待处理'].includes(state);
      const items=[
        {key:'stop',label:'终止校验',disabled:state!=='校验中',onClick:()=>terminateUpload(version)},
        {key:'download',label:'下载',disabled:!published(version)||downloading===version.version,onClick:()=>downloadVersionExample(detail,version)},
        {key:'quality',label:'质检',disabled:!published(version)||!version.templateId,onClick:()=>startVersionTask(detail,version,'数据质检')},
        {key:'enhance',label:'增强',disabled:!published(version)||!isQualityCheckedVersion(version),onClick:()=>startVersionTask(detail,version,'数据增强')},
        {key:'expand',label:'定向扩增',disabled:!published(version)||!isQualityCheckedVersion(version),onClick:()=>startVersionTask(detail,version,'定向扩增')},
        {type:'divider'},
        {key:'delete',label:'删除',danger:true,disabled:state==='校验中',onClick:()=>deleteVersion(detail,version)}
      ];
      return <Space size={0} wrap={false}><Button type="link" size="small" onClick={()=>setVersionDetail({dataset:detail,version})}>详情</Button><Button type="link" size="small" disabled={!editable} onClick={()=>{setEditingUpload({dataset:detail,version});onUploadingChange(true);}}>编辑</Button><Button type="link" size="small" disabled={!editable} onClick={()=>publishUpload(version)}>{uploadStatus(version)==='待处理'?'处理':'发布'}</Button><Dropdown trigger={['click']} menu={{items}} placement="bottomRight"><Button type="link" size="small">更多 <DownOutlined/></Button></Dropdown></Space>;
    }},


  ]:[];
  const downstreamColumns=versionDetail?[
    {title:'任务名称 / ID',width:280,render:(_,task)=><div><Text>{task.name}</Text><div className="muted-id">{task.id}</div></div>},{title:'任务类型',dataIndex:'taskType',width:110,render:value=><Tag color={taskTypeColor(value)}>{value}</Tag>},{title:'更新时间',dataIndex:'updatedAt',width:185,render:formatDateTime},{title:'操作',fixed:'right',width:90,render:(_,task)=><Button type="link" size="small" href={taskDetailUrl(versionDetail.dataset,versionDetail.version,task)} target="_blank" rel="noreferrer">详情</Button>},
  ]:[];
  if(uploading)return <UploadDatasetPage editing={editingUpload} onCancel={()=>{setEditingUpload(null);onUploadingChange(false);}} onSubmit={createUploadedDataset} datasets={datasets}/>;
  return <>
    <PageHeader title="数据中心" description="集中查看、预览和下载任务产生的数据集及不可变版本" actions={<Button type="primary" icon={<CloudUploadOutlined/>} onClick={()=>onUploadingChange(true)}>上传数据</Button>}/>
    <Card className="main-card" styles={{body:{padding:0}}}><Flex justify="space-between" align="center" className="toolbar"><Space><Segmented value={modality} onChange={value=>{setModality(value);setBusinessTypeFilter('全部');}} options={[{label:'全部',value:'全部'},{label:'文档图像',value:'文档图像'},{label:'对话文本',value:'对话文本'},{label:'时序数据',value:'时序数据'}]}/><Select placeholder="请选择选项" value={sourceFilter} onChange={setSourceFilter} style={{width:140}} options={[{label:'全部来源',value:'全部'},{label:'任务生成',value:'任务生成'},{label:'用户上传',value:'用户上传'}]}/><Select placeholder="请选择选项" value={businessTypeFilter} onChange={setBusinessTypeFilter} style={{width:170}} options={[{label:'全部业务类型',value:'全部'},...datasetBusinessTypeOptions.map(value=>({label:value,value}))]}/></Space><Input allowClear prefix={<SearchOutlined/>} placeholder="搜索名称、ID或业务类型" value={query} onChange={event=>setQuery(event.target.value)} style={{width:250}}/></Flex><Table rowKey="id" columns={datasetColumns} dataSource={list} scroll={{x:1180}} pagination={{pageSize:8,showTotal:total=>`共 ${total} 条`}}/></Card>
    <DetailPage title="数据集详情" size={1240} open={!!detail} onClose={()=>{setDetail(null);setUploadPanelVersion(null);}}>{detail&&<><Title level={4}>{detail.name}</Title><Descriptions bordered size="small" column={2} className="dataset-kv-details" items={[
      {key:'modality',label:'数据类型',children:detail.modality},{key:'business',label:'业务类型',children:detail.businessType},{key:'source',label:'来源',children:detail.sourceType||'任务生成'},{key:'samples',label:'总样本数',children:numericSampleCount(detail.totalSamples).toLocaleString()},{key:'updated',label:'更新时间',children:formatDateTime(detail.updatedAt||detail.versions?.[0]?.updatedAt)},{key:'description',label:'数据集描述',span:2,children:<Flex justify="space-between" align="center" gap={16}><Text>{detail.desc}</Text><Button type="link" size="small" onClick={()=>{setDescriptionDraft(detail.desc||'');setDescriptionEditing(true);}}>编辑</Button></Flex>},
    ]}/><Title level={5} className="section-title">数据集版本</Title><Table rowKey="id" scroll={{x:1620}} dataSource={detail.versions} columns={versionColumns} pagination={{pageSize:5,showSizeChanger:false,hideOnSinglePage:true,showTotal:total=>`共 ${total} 个版本`}}/>{(displayedUploadVersion?[displayedUploadVersion]:[]).map(version=><UploadPublicationPanel key={version.version} version={version} versions={uploadPanelVersions} onVersionChange={setUploadPanelVersion} onChange={next=>updateDataset(detail.id,d=>replaceUploadVersion(d,next))} onEdit={next=>{setEditingUpload({dataset:detail,version:next});onUploadingChange(true);}} onDetail={()=>setSourceTaskDetail({id:version.source,name:version.sourceName})}/>)}</>}</DetailPage>
    <Modal title="编辑数据集描述" open={descriptionEditing} onCancel={()=>setDescriptionEditing(false)} onOk={saveDescription} okText="保存" cancelText="取消"><Input.TextArea placeholder="请输入内容" rows={5} value={descriptionDraft} maxLength={300} showCount onChange={event=>setDescriptionDraft(event.target.value)}/></Modal>
    <DetailPage title="数据集版本详情" size={900} open={!!versionDetail} onClose={()=>setVersionDetail(null)}>{versionDetail&&<><Title level={4}>{versionDetail.dataset.name} / {versionDetail.version.version}</Title><Tabs key={versionDetail.version.version} defaultActiveKey={versionDetail.activeTab||'base'} items={[
      {key:'base',label:'基础信息',children:<><Descriptions bordered column={2} className="detail-descriptions" items={[
        {key:'publication',label:'状态',children:uploadStatus(versionDetail.version)},{key:'description',label:'版本描述',children:versionDetail.version.note},{key:'count',label:'数据量',children:numericSampleCount(versionDetail.version.samples).toLocaleString()},{key:'kind',label:'版本类型',children:<Tag>{versionDetail.version.versionKind||'-'}</Tag>},{key:'updated',label:'更新时间',children:formatDateTime(versionDetail.version.updatedAt||versionDetail.version.created)},
      ]}/><Title level={5} style={{marginTop:24}}>数据来源</Title><Descriptions bordered column={2} className="detail-descriptions" items={[
        {key:'source',label:'来源任务',children:<Button type="link" className="trace-link" onClick={()=>setSourceTaskDetail({id:versionDetail.version.source,name:versionDetail.version.sourceName,taskType:versionDetail.version.versionKind,updatedAt:versionDetail.version.updatedAt,inputVersionId:versionDetail.version.sourceVersionId,outputVersionId:versionDetail.version.version})}><div><span>{versionDetail.version.sourceName||'-'}</span><div className="muted-id">{versionDetail.version.source||'-'}</div></div></Button>},
        {key:'source-version',label:'来源数据集版本',children:versionDetail.version.sourceVersionId?<Button type="link" className="trace-link" onClick={()=>{const sourceDataset=datasets.find(item=>item.id===versionDetail.version.sourceDatasetId)||versionDetail.dataset;const sourceVersion=sourceDataset?.versions.find(item=>item.version===versionDetail.version.sourceVersionId);if(sourceVersion)setVersionDetail({dataset:sourceDataset,version:sourceVersion});}}><div><span>{(datasets.find(item=>item.id===versionDetail.version.sourceDatasetId)||versionDetail.dataset)?.name}</span><div className="muted-id">{versionDetail.version.sourceVersionId}</div></div></Button>:'-'},
        {key:'template',label:'关联模板',span:2,children:<Text>{PUBLISHED_TEMPLATE_PROFILES.find(item=>item.id===versionDetail.version.templateId)?.name||versionDetail.version.templateId||'-'}</Text>},
      ]}/><VersionExecutionInfo version={versionDetail.version} onOpen={()=>setSourceTaskDetail({id:versionDetail.version.source,initialTab:'badcases'})}/>{versionDetail.version.privacyCheck&&<><Title level={5}>上传隐私检查与脱敏结果</Title><Alert type="success" showIcon message={`隐私复检${versionDetail.version.privacyCheck.recheckStatus}，已脱敏 ${versionDetail.version.privacyCheck.desensitizedCount} 条数据`} description="这是上传入库安全门禁，不等同于模板正式质检；当前版本只包含脱敏后的数据，原始数据未被保留。"/><Descriptions bordered column={2} className="detail-descriptions" items={[
        {key:'privacy-id',label:'上传隐私报告 ID',children:<Text copyable>{versionDetail.version.uploadPrivacyReportId||versionDetail.version.privacyCheck.reportId}</Text>},{key:'privacy-status',label:'检查结果',children:<Tag color="green">{versionDetail.version.privacyCheck.status}</Tag>},{key:'privacy-inspected',label:'检查数据数',children:versionDetail.version.privacyCheck.inspectedCount},{key:'privacy-sensitive',label:'发现敏感数据',children:versionDetail.version.privacyCheck.sensitiveCount},{key:'privacy-masked',label:'完成脱敏数据',children:versionDetail.version.privacyCheck.desensitizedCount},{key:'privacy-types',label:'敏感信息类型',children:versionDetail.version.privacyCheck.findings.join('、')},{key:'privacy-storage',label:'数据保存策略',children:versionDetail.version.privacyCheck.storagePolicy},
      ]}/></>}<Title level={5}>下游任务</Title><Table rowKey="id" size="small" scroll={{x:720}} dataSource={versionDetail.version.consumers||[]} columns={downstreamColumns} pagination={{pageSize:5,showSizeChanger:false}} locale={{emptyText:'暂无下游任务'}}/></>},
      {key:'preview',label:'数据预览',children:!published(versionDetail.version)?<Empty description="发布后可预览数据"/>:<DatasetPreview key={versionDetail.version.version} dataset={versionDetail.dataset} version={versionDetail.version}/>},
      {key:'quality',label:'质检报告',children:<>{versionDetail.version.sourceType==='用户上传'&&<UploadTaskDetail version={versionDetail.version} onChange={next=>updateDataset(versionDetail.dataset.id,d=>replaceUploadVersion(d,next))}/>}<VersionQualityReport dataset={versionDetail.dataset} version={versionDetail.version}/>{versionDetail.version.enhancementSettings&&<><Title level={5} className="section-title">本版本增强设置</Title><Descriptions bordered size="small" column={2} items={[{key:'methods',label:'增强方法',children:(versionDetail.version.enhancementSettings.methods||[]).filter(method=>method!=='隐私增强').join('、')||'-'},{key:'custom',label:'自定义方案',children:versionDetail.version.enhancementSettings.custom?.name||'-'}]}/></>}{versionDetail.version.expansionSettings&&<><Title level={5} className="section-title">本版本定向扩增设置</Title><Descriptions bordered size="small" column={2} items={[{key:'gaps',label:'系统建议项',children:(versionDetail.version.expansionSettings.coverageGapKeys||[]).join('、')||'-'},{key:'custom',label:'自定义设置',children:(versionDetail.version.expansionSettings.customSettings||[]).map(item=>`${item.name}（${item.count}）`).join('；')||'-'}]}/></>}</>},
    ]}/></>}</DetailPage>
    <DetailPage title={<Space direction="vertical" size={2}><span>来源任务详情</span><Text strong>{sourceTaskDetail?(uploadTaskVersion?.sourceName||resolveTask(sourceTaskDetail)?.name||sourceTaskDetail.name||sourceTaskDetail.id):''}</Text></Space>} size={1100} open={!!sourceTaskDetail} onClose={()=>setSourceTaskDetail(null)}>{sourceTaskDetail&&(uploadTaskVersion?<UploadTaskDetail version={uploadTaskVersion} onChange={next=>{const owner=datasets.find(d=>d.versions.some(v=>v.version===next.version));if(owner)updateDataset(owner.id,d=>replaceUploadVersion(d,next));}}/>:resolveTask(sourceTaskDetail)?<ProductTaskDetail key={`${sourceTaskDetail.id}-${sourceTaskDetail.initialTab||'info'}`} task={resolveTask(sourceTaskDetail)} datasets={datasets} initialTab={sourceTaskDetail.initialTab||'info'}/>:<Descriptions bordered column={1} items={[{key:'name',label:'任务名称',children:sourceTaskDetail.name||'-'},{key:'id',label:'任务 ID',children:<Text copyable>{sourceTaskDetail.id||'-'}</Text>},{key:'type',label:'任务类型',children:<Tag>{sourceTaskDetail.taskType||'-'}</Tag>},{key:'input',label:'输入版本 ID',children:sourceTaskDetail.inputVersionId||'-'},{key:'output',label:'输出版本 ID',children:sourceTaskDetail.outputVersionId||'-'},{key:'updated',label:'更新时间',children:formatDateTime(sourceTaskDetail.updatedAt)}]}/>)}</DetailPage>
  </>;
}

const DATASET_STORAGE_KEY='data-factory-datasets-v3';
function loadDatasets(){try{const value=window.localStorage.getItem(DATASET_STORAGE_KEY);return normalizeDatasets(value?JSON.parse(value):initialDatasets);}catch{return normalizeDatasets(initialDatasets);}}

function PrototypeApp(){
  const readOnlyTaskRoute=new URLSearchParams(window.location.search).has('taskResult')||new URLSearchParams(window.location.search).has('downstreamTask');
  const [tasks,setTasks]=useState(()=>normalizeTaskTimes(readStore('application-state',{}).tasks||initialTasks));
  useEffect(()=>{const query=new URLSearchParams(window.location.search);if(query.has('taskResult')||query.has('downstreamTask'))return;const timer=setInterval(()=>setDatasets(items=>{let changed=false;const next=items.map(d=>{if(!d.versions.some(v=>uploadStatus(v)==='校验中'))return d;changed=true;const versions=d.versions.map(tickUploadCheck),latest=versions.find(published);return {...d,versions,totalSamples:versions.filter(published).reduce((s,v)=>s+Number(v.samples||0),0),defaultVersion:latest?.version||d.defaultVersion};});return changed?next:items;}),700);return ()=>clearInterval(timer);},[]);
  const [view,setView]=useState(()=>new URLSearchParams(window.location.search).has('datasetDetail')?'data':'home'); const [datasets,setDatasets]=useState(loadDatasets); const [quickCreate,setQuickCreate]=useState(null); const [datasetStoreReady,setDatasetStoreReady]=useState(false); const [templateCreating,setTemplateCreating]=useState(false); const [datasetUploading,setDatasetUploading]=useState(false); const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  useEffect(()=>{let active=true;localStoreApi.getState().then(state=>{if(active&&state.exists){if(Array.isArray(state.datasets))setDatasets(normalizeDatasets(state.datasets));if(Array.isArray(state.tasks))setTasks(normalizeTaskTimes(state.tasks));}}).catch(error=>console.warn('数据集状态恢复失败',error)).finally(()=>{if(active)setDatasetStoreReady(true);});return()=>{active=false;};},[]);
  useEffect(()=>{if(!datasetStoreReady||readOnlyTaskRoute)return;localStoreApi.saveState({datasets}).catch(error=>console.warn('数据集状态保存失败',error));},[datasets,datasetStoreReady]);
  useEffect(()=>{if(!datasetStoreReady||readOnlyTaskRoute)return;localStoreApi.saveState({tasks}).catch(error=>message.error(`任务保存失败：${error.message}`));},[tasks,datasetStoreReady]);
  useEffect(()=>{
    if(!readOnlyTaskRoute)return;
    const sync=()=>{localStoreApi.getState().then(saved=>{if(saved.tasks)setTasks(normalizeTaskTimes(saved.tasks));if(saved.datasets)setDatasets(normalizeDatasets(saved.datasets));});};
    window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
  },[]);
  useEffect(()=>{
    if(!datasetStoreReady||readOnlyTaskRoute||readStore('application-state',{}).retryDemoSeeded)return;
    localStoreApi.saveState({retryDemoSeeded:true});
    const examples=[
      ['文档图像','数据合成','运单图像合成·异常记录示例'],
      ['对话文本','数据质检','客服对话抽检·异常记录示例'],
      ['时序数据','数据增强','冷链事件增强·异常记录示例'],
      ['文档图像','定向扩增','运单定向扩增·异常记录示例'],
    ].map(([modality,taskType,name],index)=>{
      const dataset=datasets.find(d=>d.modality===modality);
      const sourceVersion=dataset?.versions[0];
      const template=templateForDataset(dataset);
      const id=`TASK-20260914-RETRY-${index+1}`;
      const v={name,description:'',modality,taskType,businessType:template?.businessType||dataset?.businessType,templateProfile:template,templateId:template?.id,qualityRules:templateQualityRules(modality,template),generationModel:template?.defaultModel,qualityModel:'Qwen3-VL-8B-Instruct',enhancementModel:'Qwen3-14B',expansionModel:defaultExpansionModel(modality),sampleCount:360,effectiveTargetCount:360,selectableCount:360,qualityScope:'sample',qualityCheckedSampleCount:360,sourceVersion,inputDatasetId:dataset?.id,inputVersionId:sourceVersion?.version,outputMode:'newVersion',targetDataset:dataset?.name,versionNote:'任务执行结果',input:taskType==='数据合成'?template?.name:`${dataset?.name} / ${sourceVersion?.version}`,documentEnhancementTypes:['语义增强']};
      let task=newExecutionTask(v,id,createVersionId(id));
      for(let tick=0;tick<12;tick++)task=advanceExecution(task);
      task={...task,datasetWritten:true,outputVersionId:task.plannedOutputVersionId,output:task.plannedOutputVersionId};
      commitPrototypeTaskOutput(task.configSnapshot,task.id,task.outputVersionId,setDatasets,task);
      return task;
    });
    setTasks(items=>[...examples,...items]);
  },[datasetStoreReady]);
  useEffect(()=>{
    const id='TASK-20260915-DOC-ENHANCE-001';
    if(!datasetStoreReady||readOnlyTaskRoute||readStore('application-state',{}).documentEnhancementDemoSeeded)return;
    if(tasks.some(task=>task.id===id)){localStoreApi.saveState({documentEnhancementDemoSeeded:true});return;}
    const dataset=datasets.find(item=>item.modality==='文档图像'&&item.versions.some(isFullQualityVersion));
    if(!dataset)return;
    const sourceVersion=dataset.versions.find(isFullQualityVersion);
    const template=templateForDataset(dataset);
    const count=Math.min(100,Number(sourceVersion.samples||0));
    if(!count)return;
    const values={
      name:'文档图像语义与图像增强示例',description:'对已质检样本进行字段语义改写和图像增强，增强后自动复检。',
      modality:'文档图像',taskType:'数据增强',businessType:template.businessType,
      templateProfile:template,templateId:template.id,qualityRules:templateQualityRules('文档图像',template),
      inputDatasetId:dataset.id,inputVersionId:sourceVersion.version,sourceVersion,
      selectableCount:count,targetCount:count,effectiveTargetCount:count,sampleCount:count,
      documentEnhancementTypes:['语义增强','图像增强'],documentSemanticRules:['SEM-LONG-TEXT'],
      documentImageMethods:['旋转 / 透视 / 亮度变化'],
      semanticEnhancementModel:'Qwen3-VL-8B-Instruct',semanticEnhancementParametersEnabled:false,
      enhancementModel:'Qwen3-VL-8B-Instruct',qualityModel:'Qwen3-VL-8B-Instruct',
      privacyMethods:{姓名:'虚构替换',手机号:'部分掩码',地址:'泛化'},
      qualityScope:'full',outputMode:'newVersion',targetDataset:dataset.name,versionNote:'文档图像增强及复检结果',
      input:`${dataset.name} / ${sourceVersion.version}`,
    };
    let task=newExecutionTask(values,id,createVersionId(id));
    for(let tick=0;tick<12;tick++)task=advanceExecution(task);
    task={...task,datasetWritten:true,outputVersionId:task.plannedOutputVersionId,output:`${dataset.name} / ${task.plannedOutputVersionId}`};
    localStoreApi.saveState({documentEnhancementDemoSeeded:true});
    commitPrototypeTaskOutput(values,id,task.outputVersionId,setDatasets,task);
    setTasks(items=>items.some(item=>item.id===id)?items:[task,...items]);
  },[datasetStoreReady,datasets,tasks]);
  useEffect(()=>{
    if(!datasetStoreReady||readOnlyTaskRoute)return;
    const definitions=[
      {id:'TASK-20260918-CONV-ENHANCE-001',flag:'conversationEnhancementDemoSeeded0918',modality:'对话文本',taskType:'数据增强',name:'物流客服对话语义增强示例'},
      {id:'TASK-20260915-CONV-EXPAND-001',flag:'conversationExpansionDemoSeeded',modality:'对话文本',taskType:'定向扩增',name:'对话文本定向扩增示例'},
      {id:'TASK-20260916-DOC-QUALITY-001',flag:'documentQualityReportDemoSeeded',modality:'文档图像',taskType:'数据质检',name:'文档图像完整质检报告示例'},
      {id:'TASK-20260916-CONV-QUALITY-001',flag:'conversationQualityReportDemoSeeded',modality:'对话文本',taskType:'数据质检',name:'对话文本完整质检报告示例'},
      {id:'TASK-20260916-TS-QUALITY-001',flag:'timeseriesQualityReportDemoSeeded',modality:'时序数据',taskType:'数据质检',name:'时序数据完整质检报告示例'},
      {id:'TASK-20260915-TS-QUALITY-001',flag:'timeseriesQualityDemoSeeded',modality:'时序数据',taskType:'数据质检',name:'时序数据质检示例'},
    ];
    const state=readStore('application-state',{});
    for(const definition of definitions){
      if(state[definition.flag])continue;
      if(tasks.some(task=>task.id===definition.id)){localStoreApi.saveState({[definition.flag]:true});continue;}
      const expansion=definition.taskType==='定向扩增',enhancement=definition.taskType==='数据增强';
      const eligible=expansion||enhancement?isFullQualityVersion:published;
      const family=TASK_FAMILIES[definition.modality==='文档图像'?'waybill':definition.modality==='对话文本'?'conversation':'timeseries'];
      const dataset=datasets.find(item=>item.name===family.datasetName&&item.versions.some(eligible));
      if(!dataset)continue;
      const sourceVersion=dataset.versions.find(eligible);
      const template=templateForDataset(dataset);
      if(!template)continue;
      const values={
        name:definition.name,description:enhancement?'基于物流智能客服对话模板生成100条语义增强样本，并执行自动复检。':expansion?'根据质检覆盖缺口定向扩增对话样本，并自动复检。':'对关联数据集版本执行模板的全部质检规则，形成逐规则报告。',
        modality:definition.modality,taskType:definition.taskType,businessType:template.businessType,
        templateProfile:template,templateId:template.id,qualityRules:templateQualityRules(definition.modality,template),
        inputDatasetId:dataset.id,inputVersionId:sourceVersion.version,sourceVersion,
        sampleCount:100,targetCount:100,effectiveTargetCount:100,selectableCount:100,
        ...(!expansion&&!enhancement?{qualityCheckedSampleCount:numericSampleCount(sourceVersion.samples)}:{}),
        qualityScope:'full',qualityModel:'Qwen3-14B',qualityParametersEnabled:false,
        outputMode:'newVersion',targetDataset:dataset.name,
        versionNote:enhancement?'对话语义增强及复检结果':expansion?'对话定向扩增及复检结果':'全量质检报告',
        ...(enhancement?{autoQualityEnabled:true,enhancementModel:'Qwen3-14B',conversationSemanticMethods:['表达同义改写'],conversationSemanticCustomRules:[{name:'物流咨询表达改写',prompt:'保留事件计划、工具返回和业务事实，改写用户问法与客服表达，不增加未经证实的承诺。'}]}:{}),
        input:`${dataset.name} / ${sourceVersion.version}`,
        ...(expansion?{
          expansionModel:defaultExpansionModel(definition.modality),expansionParametersEnabled:false,
          coverageGapKeys:[],customExpansionEnabled:true,
          customExpansionSettings:[{name:'异常反馈对话补充',labels:[],count:100,prompt:'遵循关联模板的业务场景、角色和质检规则，补充异常反馈场景的对话样本。',model:'Qwen3-14B',parametersEnabled:false}],
        }:{}),
      };
      let task=newExecutionTask(values,definition.id,createVersionId(definition.id),enhancement?'success':'mixed');
      for(let tick=0;tick<12;tick++)task=advanceExecution(task);
      const hasOutput=task.executionSummary.outputSampleCount>0&&(task.taskType!=='数据质检'||!['异常','失败','已终止'].includes(task.status));
      task={...task,datasetWritten:true,outputVersionId:hasOutput?task.plannedOutputVersionId:null,output:hasOutput?`${dataset.name} / ${task.plannedOutputVersionId}`:'未生成数据集版本'};
      localStoreApi.saveState({[definition.flag]:true});
      if(hasOutput)commitPrototypeTaskOutput(values,task.id,task.outputVersionId,setDatasets,task);
      setTasks(items=>items.some(item=>item.id===task.id)?items:[task,...items]);
    }
  },[datasetStoreReady,datasets,tasks]);
  useEffect(()=>{
    if(!datasetStoreReady||readOnlyTaskRoute)return;
    setTasks(items=>{let changed=false;const aligned=items.map(task=>{
      if(!BUILTIN_TASK_FAMILIES[task.id]||task.builtinFamilyAligned0918)return task;
      const family=TASK_FAMILIES[BUILTIN_TASK_FAMILIES[task.id]],dataset=datasets.find(d=>d.name===family.datasetName),template=PUBLISHED_TEMPLATE_PROFILES.find(t=>t.id===family.templateId);
      if(!dataset||!template)return task;
      const synthesis=task.taskType==='数据合成',produced=dataset.versions.find(v=>v.source===task.id),version=dataset.versions.find(v=>v.version===(task.sourceVersionId||task.configSnapshot?.inputVersionId))||dataset.versions.find(v=>v.version===produced?.sourceVersionId)||dataset.versions.find(published);
      if(!synthesis&&!version)return task;
      changed=true;
      const previous=task.configSnapshot||task.historicalConfigSnapshot||{};
      const snapshot={...previous,templateId:template.id,templateProfile:{...previous.templateProfile,...template},businessType:template.businessType,...(!synthesis?{inputDatasetId:dataset.id,inputVersionId:version.version,sourceVersion:{version:version.version,samples:version.samples,templateId:template.id}}:{})};
      return {...alignBuiltinTask(task),builtinFamilyAligned0918:true,...(!synthesis?{sourceDatasetId:dataset.id,sourceVersionId:version.version,input:dataset.name+' / '+version.version}:{}),...(task.configSnapshot?{configSnapshot:snapshot}:{historicalConfigSnapshot:snapshot})};
    });return changed?aligned:items;});
  },[datasetStoreReady,readOnlyTaskRoute,datasets]);
  useEffect(()=>{
    if(!datasetStoreReady||readOnlyTaskRoute)return;
    setTasks(items=>reconcileDemoTaskLinks(items,datasets,PUBLISHED_TEMPLATE_PROFILES));
  },[datasetStoreReady,readOnlyTaskRoute,datasets]);
  useEffect(()=>{
    if(!datasetStoreReady||readOnlyTaskRoute)return;
    setDatasets(items=>reconcileDemoDatasetLinks(items,tasks));
  },[datasetStoreReady,readOnlyTaskRoute,tasks]);
  useEffect(()=>{
    if(!datasetStoreReady||readOnlyTaskRoute)return;
    const refreshed=refreshBuiltinQuality(tasks,datasets);
    if(refreshed.changed){setTasks(refreshed.tasks);setDatasets(refreshed.datasets);}
  },[datasetStoreReady,tasks,datasets]);
  useEffect(()=>{
    if(!datasetStoreReady||readOnlyTaskRoute||!tasks.some(task=>task.execution&&task.status==='运行中'))return;
    const timer=window.setTimeout(()=>{
      const next=tasks.map(task=>{
        let updated=advanceExecution(task);
        if(updated!==task&&updated.status!=='运行中'){
          const canWrite=updated.taskType==='数据质检'||updated.executionSummary.outputSampleCount>0;
          const config=updated.configSnapshot;
          const outputName=config.taskType==='数据合成'?(config.outputMode==='newVersion'?config.targetDataset:config.outputDatasetName):datasets.find(d=>d.id===config.inputDatasetId)?.name;
          updated={...updated,datasetWritten:true,outputVersionId:canWrite?updated.plannedOutputVersionId:null,output:canWrite?`${outputName||'数据集'} / ${updated.plannedOutputVersionId}`:'无正式输出'};
          if(canWrite)commitPrototypeTaskOutput(updated.configSnapshot,updated.id,updated.outputVersionId,setDatasets,updated);
        }
        return updated;
      });
      setTasks(next);
    },700);
    return()=>window.clearTimeout(timer);
  },[tasks,datasetStoreReady]);
  useEffect(()=>{if(view!=='data')setDatasetUploading(false);},[view]);
  const menuItems=[{key:'home',icon:<HomeOutlined/>,label:'首页'},{key:'data',icon:<DatabaseOutlined/>,label:'数据中心'},{key:'tasks',icon:<AppstoreOutlined/>,label:'任务中心',children:Object.entries(taskPageConfig).map(([key,item])=>({key,icon:item.icon,label:item.label}))},{key:'templates',icon:<ApartmentOutlined/>,label:'模板中心'}];
  const bottomMenuItems=[{key:'apiKeys',icon:<KeyOutlined/>,label:'API Keys'}];
  const nameMap={home:'首页',data:'数据中心',templates:'模板中心',apiKeys:'API Keys'};
  const activeTaskPage=taskPageConfig[view];
  const createTask=type=>{setQuickCreate(type);setView('tasks-document');};
  const breadcrumbItems=view==='home'?[{title:'首页'}]:activeTaskPage?[{title:'首页',onClick:()=>setView('home')},{title:'任务中心'},{title:activeTaskPage.label}]:[{title:'首页',onClick:()=>setView('home')},{title:nameMap[view],onClick:view==='templates'?()=>{setTemplateCreating(false);setView('templates');}:view==='data'?()=>{setDatasetUploading(false);setView('data');}:undefined},...(view==='templates'&&templateCreating?[{title:typeof templateCreating==='string'?templateCreating:'新建模板'}]:[]),...(view==='data'&&datasetUploading?[{title:'上传数据集'}]:[])];
  const handleUserMenuClick=({key})=>{
    if(key==='profile')Modal.info({
      title:'个人信息',width:520,okText:'关闭',
      content:<Flex vertical align="center" gap={18} className="profile-modal-content"><Avatar size={72}>FD</Avatar><Descriptions bordered size="small" column={1} style={{width:'100%'}} items={[{key:'username',label:'用户名',children:CURRENT_USER},{key:'account',label:'账号',children:'feidongni'}]}/></Flex>,
    });
    if(key==='logout')Modal.confirm({
      title:'确认退出登录？',content:'退出后需要重新登录才能继续使用数据生成工具。',okText:'确认退出',okType:'danger',cancelText:'取消',onOk:()=>{},
    });
  };
  const routeParams=new URLSearchParams(window.location.search);
  const templateReference=routeParams.get('templateReference');
  if(templateReference){
    const task=tasks.find(item=>item.id===routeParams.get('referenceTask'));
    const snapshot=task?resolveTaskConfiguration(task,datasets).templateProfile:null;
    const template=snapshot?.id===templateReference?snapshot:PUBLISHED_TEMPLATE_PROFILES.find(item=>item.id===templateReference);
    return <ConfigProvider locale={zhCN} theme={uedTheme}><AntApp><main className="standalone-task-detail"><Flex justify="space-between" align="center"><Title level={3}>关联模板详情</Title><Button onClick={()=>window.close()}>关闭页面</Button></Flex>{template?<TemplateEvidence template={template} modality={template.modality||task?.modality}/>:<Empty description="未找到关联模板"/>}</main></AntApp></ConfigProvider>;
  }
  const resultTaskId=routeParams.get('taskResult');
  if(resultTaskId){
    const resultDataset=datasets.find(d=>d.versions.some(v=>v.source===resultTaskId||qualityReports(v).some(r=>r.taskId===resultTaskId)));
    const resultVersion=resultDataset?.versions.find(v=>v.source===resultTaskId||qualityReports(v).some(r=>r.taskId===resultTaskId));
    return <ConfigProvider locale={zhCN} theme={uedTheme}><AntApp><main className="standalone-task-detail"><Title level={3}>{resultDataset?.name||'运行结果'}</Title>{resultVersion?<Card><Descriptions bordered items={[{key:'id',label:'版本 ID',children:resultVersion.version},{key:'n',label:'样本数',children:resultVersion.samples},{key:'task',label:'来源任务',children:resultTaskId}]}/><Divider/><Tabs items={[{key:'quality',label:'质检报告',children:<VersionQualityReport dataset={resultDataset} version={versionWithReport(resultVersion,qualityReports(resultVersion).find(r=>r.taskId===resultTaskId))} fixedReport/>},{key:'badcases',label:'Badcase',children:<BadcasePanel task={tasks.find(t=>t.id===resultTaskId)||resultVersion.sampleExecution}/>}]} /></Card>:<Empty description="未找到输出版本"/>}</main></AntApp></ConfigProvider>;
  }
  const downstreamTaskId=routeParams.get('downstreamTask');
  if(downstreamTaskId){
    const dataset=datasets.find(item=>String(item.id)===routeParams.get('datasetId'))||datasets.find(item=>item.versions.some(version=>version.consumers?.some(task=>task.id===downstreamTaskId)));
    const version=dataset?.versions.find(item=>item.version===routeParams.get('versionId'))||dataset?.versions.find(item=>item.consumers?.some(task=>task.id===downstreamTaskId));
    const task=tasks.find(item=>item.id===downstreamTaskId)||version?.consumers?.find(item=>item.id===downstreamTaskId);
    return <ConfigProvider locale={zhCN} theme={uedTheme}><AntApp><DownstreamTaskDetailPage task={task} dataset={dataset} version={version}/></AntApp></ConfigProvider>;
  }
  return <ConfigProvider locale={zhCN} theme={uedTheme}><AntApp><Layout className={`app-layout${sidebarCollapsed?' app-layout-collapsed':''}`}><Sider width={216} collapsedWidth={64} collapsed={sidebarCollapsed} trigger={null} theme="light" className="app-sider"><div className="brand"><Avatar shape="square" size={36} className="brand-logo">数</Avatar>{!sidebarCollapsed&&<div className="brand-name">数据生成工具</div>}<Button type="text" className="brand-collapse-button" icon={sidebarCollapsed?<MenuUnfoldOutlined/>:<MenuFoldOutlined/>} aria-label={sidebarCollapsed?'展开左侧菜单':'收起左侧菜单'} onClick={()=>setSidebarCollapsed(value=>!value)}/></div><Menu className="app-main-menu" theme="light" mode="inline" defaultOpenKeys={['tasks']} selectedKeys={[view]} items={menuItems} onClick={({key})=>{setQuickCreate(null);setView(key);}}/><Menu className="app-bottom-menu" theme="light" mode="inline" selectedKeys={[view]} items={bottomMenuItems} onClick={({key})=>{setQuickCreate(null);setView(key);}}/><Dropdown trigger={['click']} placement={sidebarCollapsed?'topRight':'topLeft'} menu={{items:[{key:'profile',label:'个人信息'},{key:'logout',label:'退出登录'}],onClick:handleUserMenuClick}}><div className={`sidebar-user${sidebarCollapsed?' collapsed':''}`}><Avatar size={32}>FD</Avatar>{!sidebarCollapsed&&<><div className="sidebar-user-text"><Text>{CURRENT_USER}</Text><span>当前用户</span></div><DownOutlined/></>}</div></Dropdown></Sider><Layout><Header className="app-header"><Flex align="center"><Breadcrumb items={breadcrumbItems}/></Flex></Header><Content className="app-content">{view==='home'?<HomePage onNavigate={setView} onCreate={createTask}/>:activeTaskPage?<TaskCenter tasks={tasks} setTasks={setTasks} storeReady={datasetStoreReady} datasets={datasets} setDatasets={setDatasets} modality={activeTaskPage.modality} pageTitle={activeTaskPage.label} startCreate={quickCreate} onStartConsumed={()=>setQuickCreate(null)} onNavigate={setView}/>:view==='templates'?<TemplateCenter creating={templateCreating} onCreatingChange={setTemplateCreating}/>:view==='apiKeys'?<ApiKeysManager/>:<DataCenter tasks={tasks} datasets={datasets} setDatasets={setDatasets} uploading={datasetUploading} onUploadingChange={setDatasetUploading} onStartTask={(dataset,version,taskType)=>{const target=Object.entries(taskPageConfig).find(([,item])=>item.modality===dataset.modality)?.[0]||'tasks-document';setQuickCreate({taskType,inputDatasetId:dataset.id,inputVersionId:version.version});setView(target);}}/>}</Content></Layout></Layout></AntApp></ConfigProvider>;
}

const qualityReportMatch = window.location.pathname.match(/^\/reports\/customs\/([^/]+)\/quality\/?$/);
const coldChainQualityReportMatch = window.location.pathname.match(/^\/reports\/cold-chain\/([^/]+)\/quality\/?$/);
const conversationQualityReportMatch = window.location.pathname.match(/^\/reports\/conversations\/([^/]+)\/quality\/?$/);
const appRoot=import.meta.hot?.data.root||createRoot(document.getElementById('root'));
if(import.meta.hot)import.meta.hot.data.root=appRoot;
appRoot.render(
  qualityReportMatch
    ? <ConfigProvider locale={zhCN} theme={uedTheme}><AntApp><LegacyQualityReportPage modality="文档图像" jobId={decodeURIComponent(qualityReportMatch[1])}/></AntApp></ConfigProvider>
    : coldChainQualityReportMatch
      ? <ConfigProvider locale={zhCN} theme={uedTheme}><AntApp><LegacyQualityReportPage modality="时序数据" jobId={decodeURIComponent(coldChainQualityReportMatch[1])}/></AntApp></ConfigProvider>
      : conversationQualityReportMatch
        ? <ConfigProvider locale={zhCN} theme={uedTheme}><AntApp><LegacyQualityReportPage modality="对话文本" jobId={decodeURIComponent(conversationQualityReportMatch[1])}/></AntApp></ConfigProvider>
        : <DetailWorkspace><PrototypeApp/></DetailWorkspace>
);
