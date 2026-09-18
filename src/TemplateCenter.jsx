import {FormModelConfig,ModelConfigField} from './ModelConfigField';
import React, { useEffect, useMemo, useState } from 'react';
import {demoTemplatePairs,ensureDemoDrafts} from './demoTemplatePairs';
import {
  Alert, Badge, Button, Card, Checkbox, Col, Descriptions, Drawer, Empty, Flex, Form, Input, Modal,
  Dropdown, InputNumber, Progress, Row, Segmented, Select, Space, Statistic, Steps, Switch, Table, Tabs, Tag, Tooltip,
  Typography, Upload, message,
} from 'antd';
import {
  ApartmentOutlined, ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined,
  CloudUploadOutlined, DownOutlined, FileImageOutlined, FileTextOutlined,
  FundOutlined, LeftOutlined, PlusOutlined, SaveOutlined, SearchOutlined,
} from '@ant-design/icons';
import { templateApi } from './templateApi';
import TemplateEditor from './template-editor/TemplateEditor';
import { ConversationTemplateCreatePage, ConversationTemplateEditor } from './ConversationTemplateCenter';
import { ColdChainTemplateCreatePage, ColdChainTemplateEditor } from './ColdChainTemplateCenter';
import { SyntheticDocumentTemplateCreatePage } from './synthetic-template/SyntheticDocumentTemplateCreatePage';
import { syntheticTemplateApi } from './syntheticTemplateApi';
import { TemplateActionButtons } from './TemplateActionButtons';
import { conversationApi } from './conversationApi';
import { coldchainApi } from './coldchainApi';
import WaybillSeedMockEditor from './WaybillSeedMockEditor';
import ContractSeedMockEditor from './ContractSeedMockEditor';
import { formatDateTime, nowDateTime } from './timeUtils';
import { BusinessTypeSelect } from './BusinessTypeSelect';
import {templatePrivacyCheck} from './qualityResults';

const { Title, Text, Paragraph } = Typography;

const taskTypes = [
  { value: 'document_image', label: '文档类图像', icon: <FileImageOutlined/>, description: '种子表单 → 结构校准 → 语义与字段规则 → 发布', enabled: true },
  { value: 'conversation', label: '对话类数据', icon: <FileTextOutlined/>, description: '场景目标 → 知识规则 → 状态机 → Prompt 预览', enabled: true },
  { value: 'time_series', label: '时序类数据', icon: <FundOutlined/>, description: '事件 Prompt → 输出参数 → 白名单规则引擎 → 发布', enabled: true },
];

const LAYOUT_ANALYSIS_SEMANTIC_PROMPT = `你是“文档图像模板语义建模器”，不是通用 OCR 纠错器或简单文本分类器。输入包括：业务类型、整张种子文档图像、按阅读顺序排列的 OCR 文字对象，以及每个对象的 text_id、原始识别文本、bbox/polygon、所在表格单元格或版面区域、OCR 置信度和相邻对象。请先理解整张单据的版面结构与业务语义，再完成字段级建模。

【必须完成的任务】
1. 逐一处理所有 OCR 文字对象；每个 text_id 必须且只能输出一次，不得遗漏、合并、删除或虚构对象。
2. 将文字判断为 fixed_label 或 dynamic_field：fixed_label 是跨样本保持不变的标题、栏位标签、表头、说明和声明；dynamic_field 是每次合成时需要替换的编号、日期、主体、地址、代码、名称、数值、金额、备注或人员信息。
3. 必须结合整单标题、阅读顺序、空间位置、同一单元格、同行/上下邻近关系判断“固定标签—动态值”关系，不能只根据字符串外观分类。
4. 为每个 dynamic_field 绑定最匹配的 fixed_label，输出 binding_object_id；若一个标签对应多个值或表格列，请明确一对多关系、所属区域和重复行规则。无法可靠绑定时标记 review_required，不得强行猜测。
5. 为每个动态字段生成稳定的 field_id、规范中文字段名、业务区域、数据类型、是否必填、示例值和置信度。字段名必须来自邻近标签或规范业务术语，禁止使用当前字段值、text_id、“字段1”等作为字段名。
6. 设置生成规则：只能在 dictionary_rule、computed、llm_prompt 中选择。代码表/枚举优先字典；序号、业务编号、日期、整数、小数、金额和可计算值优先 computed；企业、地址、商品描述和备注等开放语义文本使用 llm_prompt。规则必须说明格式、位数、候选范围、隐私约束及与其他字段的依赖。
7. 设置字段质检规则：为每个动态字段输出 required、regex、numeric、integer、date_format、dictionary_membership 等可执行检查；同时识别代码—名称、数量—单位、金额—币制、单价×数量≈总价、毛重≥净重、日期先后、主体与地址等跨字段约束。
8. 识别印章、条形码、二维码和固定图案与字段的关系；机器码应绑定对应业务编号，并声明可解码性、内容一致性和安全前缀检查。
9. 所有人名、企业、地址、电话、证件、账号和可追踪业务编号均按合成数据处理，不得建议复用真实值；识别可能含隐私的字段并输出 privacy_category 和安全生成要求。

【判断原则】
- 单据标题、栏目名、表头、单位提示、声明文字通常是 fixed_label；标签旁或标签下方的实际填写值通常是 dynamic_field。
- OCR 可能存在错字，可规范字段名称和业务类型，但必须保留原始 sample_text，不得静默改写 OCR 结果。
- 只有标签和值关系清楚、字段类型、绑定对象、生成方式及质检规则均有依据时才给高置信度；不确定时 confidence≤0.69 且 review_required=true，并写明原因。
- fixed_label 不得携带动态生成器；dynamic_field 必须包含绑定关系、生成规则、字段质检规则和必要的跨字段关系。

【输出要求】
仅输出符合系统 schema 的 JSON，不输出 Markdown、解释正文或思维过程。输出至少包含 document_summary、regions、items、fields、bindings、cross_field_relations、privacy_fields、review_items。输出前自检：对象数量与输入一致；没有标题/表头误判为动态字段；没有字段值被当成字段名；没有字典跨类型误配；所有动态字段均可生成、可校验、可追溯到固定标签和原始 OCR 对象。

【建议执行阶段】
本提示词描述完整目标。正式实现可拆分为：①整单结构与固定/动态分类；②标签—值绑定及字段定义；③生成规则与字典解析；④字段质检及跨字段关系审校；⑤低置信对象复核与 JSON 契约校验。`;

const BACKGROUND_GENERATION_SEMANTIC_PROMPT = `你是“底图生成法文档模板语义建模器”。输入包括：业务类型、参考底图或系统生成的安全空白底图、OCR/版面解析对象、底图中的固定标签候选、图案与机器码区域，以及在线编辑器可用的字段目录。你的目标不是复刻参考图中的真实数据，而是把底图解析为可批量合成的“固定文字层 + 动态文字层 + 图案层 + 隐私保护层”模板。

【必须完成的任务】
1. 先识别文档业务分区、阅读顺序、表格/线框、固定说明、标签、填写槽位、条形码、二维码、签名和图案区域；所有输入对象必须保留来源 ID 与坐标。
2. 将文字对象严格判断为 fixed_label 或 dynamic_field。固定文字包括标题、栏目标签、中英文提示、单位、声明和服务说明；动态字段包括单号、寄收件主体、电话、地址、内件、数量、重量、体积、费用、日期、签名、证件号、备注及机器码载荷。
3. 建立固定标签与动态字段的绑定关系。每个动态文字框必须选择一个 fixed_label 或明确的业务区域作为 binding_object_id；识别一对一、一对多、复合字段和重复字段。不得把动态字段绑定到另一个不相关动态值。
4. 为每个动态字段输出 field_id、中文名称、业务区域、数据类型、必填性、示例值、bbox、字号建议、长度上限和置信度。固定文字与动态字段要作为独立图层对象输出，位置关系必须适合在线编辑。
5. 为每个动态字段设置生成规则：枚举/代码表使用 dictionary_rule；运单号、日期、数量、重量、体积、金额及可推导字段使用 computed；姓名、单位、地址、内件品名、备注等开放语义内容使用 llm_prompt。规则必须生成虚构、安全且同一张单据内语义一致的值。
6. 为每个字段设置可执行质检规则，包括必填、格式、数值范围、日期格式、枚举归属、文本长度和机器码可解码性；同时建立业务跨字段规则，例如省市区与详细地址一致、寄件时间≤签收时间、文件/物品选择与内件内容一致、长×宽×高与体积一致、付款方式与勾选项一致、资费+保价费≈费用总计、条形码/二维码内容与运单号一致。
7. 识别姓名、电话、详细地址、单位、证件、签名、单号和机器码等隐私或可追踪字段，声明 privacy_category、默认安全生成策略和最终成品隐私残留检查；不得复制参考图片中的真实信息。
8. 对无法确定的文字类型、绑定关系、字段类型或生成方式输出 review_required=true，并说明需要人工确认的对象、候选关系和原因。

【底图生成法约束】
- 参考图只用于理解结构和样式，不得把真实品牌、企业、个人、地址、号码、印章或有效机器码复制到模板。
- 底图中可变值不得烘焙进固定图案层；固定标签与动态值必须拆层，动态值必须可独立移动、改色、改字号和替换。
- 条形码和二维码既是图案对象，也必须关联安全的动态载荷字段；显示文本、码内容与业务编号应保持一致。
- 不能仅凭 OCR 文本分类，必须结合位置、分区、标签和值的视觉关系判断。

【输出要求】
仅输出符合系统 schema 的 JSON，不输出 Markdown 或解释。输出至少包含 document_summary、regions、fixed_texts、dynamic_fields、bindings、assets、generation_rules、field_quality_rules、cross_field_relations、privacy_fields、review_items。输出前检查：所有动态字段均绑定到固定标签或业务区；所有动态字段均有生成规则和质检规则；跨字段关系引用有效 field_id；没有真实信息进入固定底图。

【建议执行阶段】
本提示词用于完整表达产品目标。正式实现可拆分为：①底图分区与图层解析；②固定/动态文字分类及绑定；③字段生成规则编排；④字段质检、跨字段关系与隐私策略生成；⑤视觉位置和 JSON 契约复核。`;

const TEMPLATE_TASK_REFERENCES = {
  'DOC-TPL-FICT-CUSTOMS-MOCK': ['进口报关单批量合成任务', '报关单覆盖短板扩增任务'],
  'CONVTPL-LOGISTICS-DEMO-V2': ['物流客服多轮对话合成任务'],
  'COLDTPL-REEFER-MODEL-DEMO-V2': ['冷链温湿度异常序列合成任务'],
};

function taskReferences(templateId) {
  return TEMPLATE_TASK_REFERENCES[templateId] || [];
}

function PageHeader({ actions }) {
  return <Flex justify="space-between" align="flex-start" className="page-header"><div><Title level={3}>模板中心</Title><Text type="secondary">把种子数据处理成可编辑、可试运行、可发布的生成模板</Text></div><Space>{actions}</Space></Flex>;
}

function statusTag(job) {
  if (job?.result?.published_template) return <Tag color="green">已发布</Tag>;
  if (job?.status === 'failed') return <Tag color="red">失败</Tag>;
  const status = job?.result?.draft_status;
  if (status === 'validation_failed') return <Tag color="red">校验失败</Tag>;
  if (status === 'trial_rejected') return <Tag color="red">试运行质检未通过</Tag>;
  if (status === 'ready_for_trial') return <Tag color="cyan">可试运行</Tag>;
  if (status === 'trial_completed') return <Tag color={job?.result?.trial_quality_status === 'REVIEW' ? 'orange' : 'green'}>{job?.result?.trial_quality_status === 'REVIEW' ? '质检待复核' : '可发布'}</Tag>;
  if (job?.status === 'completed') return <Tag color="blue">待编辑</Tag>;
  return <Tag color="processing">分析中</Tag>;
}

const documentBusinessOptions = [
  { label: '版面分析法', value: '报关单' },
  { label: '底图生成法', value: '运单' },
];

const waybillMockRows = [
  { key:'sender', area:'寄件信息区', objects:'寄件人、电话、地址', method:'PP-OCRv5 + 空间聚类', action:'保留为动态字段组' },
  { key:'receiver', area:'收件信息区', objects:'收件人、电话、地址', method:'PP-OCRv5 + 标签值配对', action:'保留为动态字段组' },
  { key:'route', area:'路由与服务区', objects:'始发地、目的地、服务产品', method:'区块检测 + Qwen 语义', action:'保留区块关系' },
  { key:'code', area:'机器码区', objects:'条形码、二维码、运单号', method:'OpenCV 码区检测', action:'替换为安全程序码' },
  { key:'fee', area:'货物与费用区', objects:'件数、重量、费用', method:'OCR + 数值字段识别', action:'保留并配置关联规则' },
];

const contractMockRows = [
  { key:'title', level:'文档标题', sample:'物流服务合同', kind:'固定文本', action:'保留样式与层级' },
  { key:'parties', level:'合同主体', sample:'甲方 / 乙方名称与地址', kind:'动态字段组', action:'虚构替换并保持全文一致' },
  { key:'clause', level:'编号条款', sample:'第一条 服务内容……', kind:'条款插槽', action:'保留编号与段落样式' },
  { key:'amount', level:'金额与期限', sample:'合同金额、起止日期', kind:'动态字段', action:'生成规则 + 跨字段质检' },
  { key:'sign', level:'签署区', sample:'签署方、日期、固定图案位', kind:'签署结构', action:'仅生成安全合成内容' },
];

function SeedMockWorkspace({ type, fileName, name, businessType, description, onBack, onCancel }) {
  if (type === '运单') return <WaybillSeedMockEditor fileName={fileName} templateName={name} businessType={businessType} description={description} onBack={onBack} onCancel={onCancel}/>;
  if (type === '合同') return <ContractSeedMockEditor fileName={fileName} onBack={onBack} onCancel={onCancel}/>;
  const [phase, setPhase] = useState(1);
  const [selected, setSelected] = useState(type === '运单' ? waybillMockRows.map(item => item.key) : contractMockRows.map(item => item.key));
  const rows = type === '运单' ? waybillMockRows : contractMockRows;
  const columns = type === '运单' ? [
    { title:'使用', width:70, render:(_, row)=><Checkbox checked={selected.includes(row.key)} onChange={event=>setSelected(current=>event.target.checked?[...current,row.key]:current.filter(key=>key!==row.key))}/> },
    { title:'识别区块', dataIndex:'area', width:150 }, { title:'候选对象', dataIndex:'objects' },
    { title:'解析方式', dataIndex:'method', width:190 }, { title:'模板调整', dataIndex:'action', width:210 },
  ] : [
    { title:'使用', width:70, render:(_, row)=><Checkbox checked={selected.includes(row.key)} onChange={event=>setSelected(current=>event.target.checked?[...current,row.key]:current.filter(key=>key!==row.key))}/> },
    { title:'结构层级', dataIndex:'level', width:150 }, { title:'解析示例', dataIndex:'sample' },
    { title:'对象类型', dataIndex:'kind', width:150 }, { title:'模板调整', dataIndex:'action', width:220 },
  ];
  return <div className="template-create-page document-template-create-page">
    <Flex className="page-header" justify="space-between" align="flex-start">
      <Space align="start"><Button type="text" icon={<ArrowLeftOutlined/>} onClick={onBack}>返回上一步</Button><div><Title level={2}>{type}种子解析与调整</Title><Paragraph type="secondary">{fileName} · 纯前端 Mock，不会发送网络请求或产生模型费用</Paragraph></div></Space>
      <Space><Button onClick={()=>setPhase(1)}>重置调整</Button><Button type="primary" onClick={()=>setPhase(phase === 1 ? 2 : 3)}>{phase === 1 ? '应用调整并生成预览' : phase === 2 ? '确认并保存草稿' : '已保存 Mock 草稿'}</Button></Space>
    </Flex>
    <Card className="main-card">
      <Steps current={phase} items={type === '运单' ? [
        {title:'上传种子'}, {title:'区块与码区解析'}, {title:'调整与安全重建'}, {title:'保存草稿'},
      ] : [{title:'上传种子'}, {title:'文档结构解析'}, {title:'字段与条款调整'}, {title:'保存草稿'}]}/>
      <Alert className="section-title" type="info" showIcon message={type === '运单' ? '按业务区块解析，不要求逐格复刻运单' : '按文档结构解析，不进入表格单元格编辑器'} description={type === '运单' ? '重点确认寄收件、路由、货物费用及条码/二维码区域；真实品牌、Logo和码值不会进入模板。' : '优先读取 Word 的段落、表格和样式；PDF作为固定版面参考。用户确认可替换字段、条款插槽和全文一致性。'}/>
      <Row gutter={[16,16]} className="section-title">
        <Col span={16}><Card size="small" title={type === '运单' ? '解析结果与调整' : '结构与字段候选'}><Table pagination={false} size="small" columns={columns} dataSource={rows}/></Card></Col>
        <Col span={8}><Card size="small" title="模板安全重建配置">
          {type === '运单' ? <Space direction="vertical" style={{width:'100%'}}>
            <Flex justify="space-between"><Text>过滤真实品牌与Logo</Text><Switch defaultChecked/></Flex>
            <Flex justify="space-between"><Text>条码/二维码安全重生成</Text><Switch defaultChecked/></Flex>
            <Form.Item label="区块布局"><Select placeholder="请选择区块布局" defaultValue="two-column" options={[{value:'two-column',label:'寄收件双栏'},{value:'stacked',label:'上下分区'}]}/></Form.Item>
            <Form.Item label="虚构视觉主题"><Select placeholder="请选择虚构视觉主题" defaultValue="neutral-blue" options={[{value:'neutral-blue',label:'中性蓝灰'},{value:'warm-orange',label:'暖橙物流'}]}/></Form.Item>
          </Space> : <Space direction="vertical" style={{width:'100%'}}>
            <Flex justify="space-between"><Text>保留标题与编号层级</Text><Switch defaultChecked/></Flex>
            <Flex justify="space-between"><Text>动态字段全文一致</Text><Switch defaultChecked/></Flex>
            <Form.Item label="正文排版"><Select placeholder="请选择正文排版" defaultValue="a4-standard" options={[{value:'a4-standard',label:'A4标准条款版'},{value:'a4-compact',label:'A4紧凑版'}]}/></Form.Item>
            <Form.Item label="条款处理"><Select placeholder="请选择条款处理" defaultValue="slot" options={[{value:'slot',label:'转为可生成条款插槽'},{value:'fixed',label:'仅保留结构示例'}]}/></Form.Item>
          </Space>}
        </Card></Col>
      </Row>
      {phase >= 2 && <Card size="small" title="安全重建预览" className="section-title"><Progress percent={phase === 2 ? 80 : 100} status={phase === 3 ? 'success' : 'active'}/><Descriptions bordered size="small" column={3} items={[
        {key:'source',label:'种子用途',children:'仅提取结构与语义参考'},
        {key:'selected',label:'已采用对象',children:`${selected.length} / ${rows.length}`},
        {key:'output',label:'模板产物',children:type === '运单' ? '区块+字段+安全码图规则' : '段落样式+字段+条款插槽'},
      ]}/></Card>}
    </Card>
  </div>;
}

function DocumentTemplateCreatePage({ onBack, onCreated, onUpdated, existingJob = null }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [backgroundDraft, setBackgroundDraft] = useState(null);
  const fileList = Form.useWatch('seedFile', {form,preserve:true}) || [];
  const semanticParamsEnabled = Form.useWatch('semanticParamsEnabled', form);
  const businessType = Form.useWatch('businessType', form) || '报关单';
  const [privacyProgress,setPrivacyProgress]=useState(0);
  const [imageDimensions,setImageDimensions]=useState('等待上传');
  const [mockWorkspace, setMockWorkspace] = useState(null);
  const [job, setJob] = useState(existingJob);
  const [uploadEditing, setUploadEditing] = useState(Boolean(existingJob));
  const [uploadDirty, setUploadDirty] = useState(false);
  const [analyzedInput, setAnalyzedInput] = useState(null);
  const [analysisInfo, setAnalysisInfo] = useState(existingJob ? {name:existingJob.name, businessType:existingJob.business_type, fileName:existingJob.input?.original_filename, ...existingJob.parameters} : null);
  const [semanticConfig, setSemanticConfig] = useState(null);
  useEffect(() => {
    let active = true;
    templateApi.semanticConfig().then(value => { if (active) setSemanticConfig(value); }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(()=>{
    const file=fileList?.[0]?.originFileObj||fileList?.[0];
    if(!file){setPrivacyProgress(0);setImageDimensions('等待上传');return;}
    setPrivacyProgress(8);let value=8;const timer=setInterval(()=>{value=Math.min(100,value+13);setPrivacyProgress(value);if(value>=100)clearInterval(timer);},120);
    if(file instanceof Blob){const url=URL.createObjectURL(file);const image=new window.Image();image.onload=()=>{setImageDimensions(`${image.naturalWidth} × ${image.naturalHeight}`);form.setFieldValue('imgsz',Math.max(image.naturalWidth,image.naturalHeight));URL.revokeObjectURL(url);};image.src=url;}
    return()=>clearInterval(timer);
  },[fileList,form]);
  const saveBackgroundDraft = async () => {
    const values = form.getFieldsValue(true);
    if (values.businessType !== '运单') return;
    setSavingDraft(true);
    try {
      const referenceFile = values.backgroundSeedFile?.[0]?.originFileObj || values.backgroundSeedFile?.[0];
      const payload = {
        name: values.name?.trim() || '未命名物流运单底图模板',
        business_type: values.documentBusinessType?.trim() || '运单',
        description: values.description || '',
        document_type: 'domestic_waybill',
        content_subtype: 'logistics_waybill',
        creation_method: 'background_generation',
        background_generation: {
          reference_file_name: referenceFile?.name || '',
          image_model: values.imageGenerationModel || '',
          prompt: values.baseImagePrompt || '',
        },
        semantic_extraction: {
          model: values.semanticModel || 'qwen3-vl-8b-instruct',
          prompt: values.semanticPrompt || BACKGROUND_GENERATION_SEMANTIC_PROMPT,
          ...(values.semanticParamsEnabled ? { parameters: JSON.parse(values.semanticParamsJson || '{}') } : {}),
        },
      };
      const saved = backgroundDraft
        ? await syntheticTemplateApi.saveDraft(backgroundDraft.id, { ...payload, expected_revision: backgroundDraft.revision })
        : await syntheticTemplateApi.createDraft(payload);
      setBackgroundDraft(saved);
      if (backgroundDraft) onUpdated(saved); else onCreated(saved);
      message.success(backgroundDraft ? '草稿已更新' : '草稿已保存');
    } catch (error) {
      message.error(error.message || '草稿保存失败');
    } finally {
      setSavingDraft(false);
    }
  };
  const submit = async () => {
    const values = await form.validateFields();
    if (job && (!uploadDirty || analyzedInput === JSON.stringify(values))) { setUploadEditing(false); return; }
    const file = values.seedFile?.[0]?.originFileObj || values.seedFile?.[0];
    if (values.businessType !== '报关单') {
      setMockWorkspace({ type: values.businessType, fileName:'系统生成安全底图.png', name:values.name, businessType:values.documentBusinessType, description:values.description, imageModel:values.imageGenerationModel, imagePrompt:values.baseImagePrompt });
      message.success('底图生成法字段解析完成');
      return;
    }
    if (!file) return;
    setSubmitting(true);
    try {
      const created = await templateApi.createJob({ existingJobId: job?.id, file, name: values.name, taskType: 'document_image', businessType: values.documentBusinessType, imgsz: values.imgsz, conf: values.conf, semanticModel: values.semanticModel, semanticPrompt:values.semanticPrompt, ...(values.semanticParamsEnabled?{semanticParameters:JSON.parse(values.semanticParamsJson)}:{}) });
      const info = { name: values.name, businessType: values.documentBusinessType, description:values.description, fileName: file.name, imgsz: values.imgsz, conf: values.conf, semanticModel: values.semanticModel, promptVersion: semanticConfig?.prompt_version };
      setUploadDirty(false); setAnalyzedInput(JSON.stringify(values)); setAnalysisInfo(info); setUploadEditing(false); setJob(created); onCreated(created);
      const completedByModel = created.result?.semantic_status === 'completed';
      message[completedByModel ? 'success' : 'warning'](completedByModel
        ? `版面与语义提取完成：${created.result?.cell_count || 0} 个单元格，${created.result?.field_count || 0} 个动态字段`
        : '版面与 OCR 已完成，但 Qwen 调用未全部成功；系统已生成带“待复核”标记的本地兜底草稿');
    } catch (error) { message.error(error.message); }
    finally { setSubmitting(false); }
  };
  if (mockWorkspace) return <SeedMockWorkspace {...mockWorkspace} onBack={()=>setMockWorkspace(null)} onCancel={onBack}/>;
  if (job && !uploadEditing) return <TemplateEditor presentation="page" job={job} open analysisInfo={analysisInfo} onBackToUpload={()=>setUploadEditing(true)} onClose={onBack} onUpdated={updated => { setJob(updated); onUpdated(updated); }}/>;
  const analysisSteps = businessType === '运单' ? [
    { title:'基础信息与种子图片', description:'选择底图生成法' },
    { title:'字段解析与在线编辑', description:'字段、位置与生成规则' },
    { title:'质检规则配置', description:'基础规则与场景规则' },
    { title:'试运行与发布', description:'预览并确认模板' },
  ] : [
    { title:'版面分析与语义提取', description:'OCR + Qwen 整单推理' },
    { title:'结构校准', description:'单元格与边框' },
    { title:'语义与字段规则', description:'文字、字段与图案' },
    { title:'质检规则配置', description:'基础规则与场景规则' },
    { title:'校验试运行', description:'确认后发布' },
  ];
  return <div className="template-create-page document-template-create-page">
    <Flex className="page-header" justify="space-between" align="flex-start"><Space align="start"><Button type="text" icon={<LeftOutlined/>} aria-label="返回模板中心" onClick={onBack}/><div><Title level={2}>{existingJob?'编辑文档类图像模板':'新建文档类图像模板'}</Title><Paragraph type="secondary">配置模板基础信息并选择版式制作方式</Paragraph></div></Space></Flex>
    <Flex justify="space-between" align="center" className="conversation-template-statusbar template-editor-step-actions-top"><span/><Space><Button onClick={onBack} disabled={submitting||savingDraft}>取消</Button>{businessType==='运单'&&<Button icon={<SaveOutlined/>} loading={savingDraft} onClick={saveBackgroundDraft}>{backgroundDraft?'更新草稿':'保存草稿'}</Button>}<Button type="primary" disabled={businessType==='报关单'&&(!fileList.length||privacyProgress<100)} loading={submitting} onClick={submit}>{submitting ? '正在处理' : '下一步'}</Button></Space></Flex>
    <Form form={form} onValuesChange={()=>setUploadDirty(true)} layout="vertical" initialValues={{ businessType: '报关单', name:'进口货物申报单图像模板', documentBusinessType:'报关单', description:'用于制作贸易申报单类文档图像模板，覆盖版面结构识别、业务字段提取、动态内容替换与合成数据生成。', imgsz: 1024, conf: 0.2, semanticModel: 'qwen3-vl-8b-instruct', semanticPrompt:LAYOUT_ANALYSIS_SEMANTIC_PROMPT, semanticParamsEnabled:false, semanticParamsJson:'{\n  "temperature": 0.2\n}', imageGenerationModel:'doubao-seedream-5-0-260128', baseImagePrompt:'生成一张横向橙色系国内快递运单空白底图，画布比例约为 1.84:1。左侧保留装订孔和虚线撕口；顶部放置安全虚构的“橙途速运 / ORANGEWAY EXPRESS”标识、不可追踪的合成条形码和二维码；主体使用橙色细线划分左右寄收件区、物品与重量体积区、付款费用区、签收与备注区；底部保留橙色服务条和“演示样张 / DEMO”标识。表格内部不得生成字段标签或字段值，所有固定文字和动态内容由后续文字层叠加；不得出现真实企业、真实个人信息或有效物流编码。', ...(existingJob?{name:existingJob.name,documentBusinessType:existingJob.business_type,seedFile:[{uid:existingJob.id,name:existingJob.input?.original_filename||'已上传种子图片',status:'done'}],imgsz:existingJob.parameters?.imgsz||1024,conf:existingJob.parameters?.conf??0.2,semanticModel:existingJob.parameters?.semantic_model||'qwen3-vl-8b-instruct'}:{}) }} className="template-analysis-form">
      <Steps current={0} items={analysisSteps} className="template-editor-steps main-card"/>
      <Card className="main-card" title="模板基础信息">
        <Row gutter={16}><Col span={12}><Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }, { max: 80 }]}><Input placeholder="例如：进口货物申报单模板"/></Form.Item></Col><Col span={12}><Form.Item name="documentBusinessType" label="业务类型" rules={[{required:true,message:'请选择业务类型'}]}><BusinessTypeSelect modality="document_image"/></Form.Item></Col></Row>
        <Form.Item name="description" label="模板描述" rules={[{max:500}]}><Input.TextArea rows={3} maxLength={500} showCount placeholder="例如：用于制作贸易申报单类文档图像模板，覆盖版面分析、字段提取和合成数据生成。"/></Form.Item>
      </Card>
      <Card className="main-card" title="版面分析与语义提取">
        <Form.Item name="businessType" label="模板制作方式" rules={[{ required: true, message:'请选择模板制作方式' }]}>
          <Segmented block options={documentBusinessOptions} onChange={value=>form.setFieldsValue(value==='运单'?{businessType:value,seedFile:[],name:'物流运单底图生成模板',documentBusinessType:'运单',description:'用于生成虚构物流运单文档图像，覆盖寄件、收件、货物、费用、签收和条码等版面区域。',semanticPrompt:BACKGROUND_GENERATION_SEMANTIC_PROMPT}:{businessType:value,seedFile:[],name:'进口货物申报单图像模板',documentBusinessType:'报关单',description:'用于制作贸易申报单类文档图像模板，覆盖版面结构识别、业务字段提取、动态内容替换与合成数据生成。',semanticPrompt:LAYOUT_ANALYSIS_SEMANTIC_PROMPT})}/>
        </Form.Item>
        <Alert className="template-modal-note" type="info" showIcon message={businessType === '报关单' ? '版面分析法' : '底图生成法'} description={businessType === '报关单' ? '上传种子图片，通过版面检测、OCR、结构校准和字段配置制作模板。' : '解析业务字段并基于平台生成的安全底图进行在线编辑，不复制真实品牌或版面。'}/>
      {businessType === '运单' && <Form.Item name="backgroundSeedFile" label="上传参考底图" valuePropName="fileList" getValueFromEvent={event => Array.isArray(event) ? event : event?.fileList} rules={[{ required: true, message: '请上传参考底图' }]}><Upload.Dragger accept=".png,.jpg,.jpeg,.webp,.bmp" maxCount={1} beforeUpload={() => false}><p className="ant-upload-drag-icon"><CloudUploadOutlined /></p><p>拖拽或点击选择底图</p><p className="ant-upload-hint">底图生成法将使用该图片作为参考</p></Upload.Dragger></Form.Item>}
      {businessType==='运单'&&<Card size="small" title="底图生成配置" className="template-editor-card"><ModelConfigField><Form.Item name="imageGenerationModel" label="图像生成模型" rules={[{required:true}]}><Select placeholder="请选择图像生成模型" options={[{value:'doubao-seedream-5-0-260128',label:'豆包 Seedream 5.0（doubao-seedream-5-0-260128）'}]}/></Form.Item></ModelConfigField><Form.Item name="baseImagePrompt" label="底图生成提示词" rules={[{required:true,whitespace:true,message:'请输入底图生成提示词'}]}><Input.TextArea placeholder="描述底图生成提示词，说明目标、约束和输出要求" rows={7}/></Form.Item></Card>}
      {businessType==='报关单'&&<Form.Item name="seedFile" label="上传种子图片" valuePropName="fileList" getValueFromEvent={event => Array.isArray(event) ? event : event?.fileList} rules={[{ required: true, message: '请上传种子图片' }]}>
        <Upload.Dragger accept=".png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff" maxCount={1} beforeUpload={() => false}>
          <p className="ant-upload-drag-icon"><CloudUploadOutlined/></p><p>拖入或点击选择一张文档图片</p><p className="ant-upload-hint">支持 PNG/JPEG/WebP/BMP/TIFF，最大 25MB</p>
        </Upload.Dragger>
      </Form.Item>}
      {businessType==='报关单'&&!!fileList.length&&<Card size="small" className="section-title" title="种子数据隐私检查与脱敏保护"><Progress percent={privacyProgress} status={privacyProgress<100?'active':'success'}/><Text type="secondary">{privacyProgress<100?'正在检测隐私字段并生成脱敏保护副本，完成前不能进入下一步。':'隐私检查与脱敏保护完成，后续流程使用受保护副本。'}</Text></Card>}
      <Row gutter={16}>
        <Col span={12}><Form.Item name="imgsz" label="版面推理尺寸" tooltip={`种子图片尺寸：${imageDimensions||'待读取'}`} rules={[{required:true}]}><InputNumber placeholder="请输入版面推理尺寸（320～4096）" min={320} max={4096} step={64} addonAfter="px" style={{width:'100%'}}/></Form.Item></Col>
        <Col span={12}><Form.Item name="conf" label={businessType === '运单' ? '区块置信度阈值' : '置信度阈值'} tooltip="不是准确率；越高返回框越少" rules={[{ required: true }]}><InputNumber placeholder="请输入数值（0.01～1）" min={0.01} max={1} step={0.05} precision={2} style={{ width: '100%' }}/></Form.Item></Col>
      </Row>
      <FormModelConfig form={form} modelName="semanticModel" parameterSwitchName="semanticParamsEnabled" parameterName="semanticParamsJson" label="语义提取模型" options={[{value:'qwen3-vl-8b-instruct',label:'Qwen3-VL-8B-Instruct'}]} help="当前仅开放 Qwen3-VL-8B-Instruct，结合整单字段关系提取语义；关闭自定义参数后不传递模型生成参数。"/>
      <Card size="small" title="语义提取提示词" className="template-editor-card">
        <Form.Item name="semanticPrompt"><Input.TextArea placeholder="请输入内容" autoSize={{ minRows: 18, maxRows: 30 }}/></Form.Item>
        <Text type="secondary">当前原型用一段完整 Prompt 表达最终语义建模目标；正式实现可按结构分类、字段绑定、生成规则、质检规则和审校复核拆成多阶段调用。</Text>
      </Card>
      </Card>
    </Form>
  </div>;
}

export function TemplateCenter({ onCreatingChange, creating = false }) {
  const [jobs, setJobs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [conversationTemplates, setConversationTemplates] = useState([]);
  const [conversationDrafts, setConversationDrafts] = useState([]);
  const [coldChainTemplates, setColdChainTemplates] = useState([]);
  const [coldChainDrafts, setColdChainDrafts] = useState([]);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [createType, setCreateType] = useState(null);
  const [detail, setDetail] = useState(null);
  const [mockDetail, setMockDetail] = useState(null);
  const [filter, setFilter] = useState('全部');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [businessTypeFilter, setBusinessTypeFilter] = useState('全部');
  const [query, setQuery] = useState('');
  const [conversationEditor, setConversationEditor] = useState(null);
  const [coldChainEditor, setColdChainEditor] = useState(null);
  useEffect(() => {
    const subpage = createType ? '新建模板' : conversationEditor ? (conversationEditor.readOnly ? '模板详情' : '编辑模板') : coldChainEditor ? (coldChainEditor.readOnly ? '模板详情' : '编辑模板') : false;
    onCreatingChange?.(subpage);
  }, [createType, conversationEditor, coldChainEditor, onCreatingChange]);
  useEffect(() => { if (!creating) { setCreateType(null); setConversationEditor(null); setColdChainEditor(null); } }, [creating]);
  const refresh = async () => {
    setError('');
    setLoading(true);
    try {
      ensureDemoDrafts();
      const [healthValue, jobsValue, templatesValue, syntheticJobsValue, syntheticCatalogValue, conversationTemplateValue, conversationDraftValue, coldChainTemplateValue, coldChainDraftValue] = await Promise.all([
        templateApi.health(), templateApi.listJobs(), templateApi.listTemplates(),
        syntheticTemplateApi.listJobs(), syntheticTemplateApi.catalog(),
        conversationApi.listTemplates(), conversationApi.listTemplateDrafts(),
        coldchainApi.listTemplates(), coldchainApi.listTemplateDrafts(),
      ]);
      const syntheticJobs = (syntheticJobsValue.items || []).map(item => {
        const template = item.template || {};
        return {
          ...item,
          _synthetic: true,
          name: template.name || item.id,
          business_type: template.business_type || template.document_type || '文档类图像',
          result: {
            cell_count: (template.cells || []).length,
            text_count: (template.texts || []).length,
            field_count: (template.fields || []).length,
            draft_revision: item.revision,
            published_template: item.published_template_id ? { template_id: item.published_template_id, version: item.published_version || 'V1' } : null,
          },
        };
      });
      const templateMap = new Map();
      [...(templatesValue.items || []), ...(syntheticCatalogValue.templates || [])].forEach(item => templateMap.set(`${item.template_id}/${item.version}`, item));
      setHealth(healthValue);
      setJobs([...(jobsValue.items || []), ...syntheticJobs].sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))));
      setTemplates([...templateMap.values()]);
      setConversationTemplates(conversationTemplateValue.items || []);
      setConversationDrafts((conversationDraftValue.items || []).filter(item=>item.status!=='published'));
      setColdChainTemplates(coldChainTemplateValue.items || []);
      setColdChainDrafts((coldChainDraftValue.items || []).filter(item=>item.status!=='published'));
    } catch (fetchError) { setError(fetchError.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);
  const unifiedRows = useMemo(() => {
    const documentMockDraftRows = [
      {
        key: 'document-mock-draft/WAYBILL-DRAFT-20260901',
        id: 'WAYBILL-DRAFT-20260901',
        name: '橙途速运运单模板',
        dataType: '文档类图像',
        businessType: '国内运单',
        status: '草稿',
        publishable: false,
        processing: false,
        summary: '固定底图 · 45 个字段',
        updatedAt: '2026-09-01 10:00:00',
        kind: 'document-mock-draft',
        raw: { _mockCatalog: true, field_count: 45, source_type: 'waybill_mock' },
      },
    ];
    const documentDraftRows=jobs.filter(job=>!job.result?.published_template).map(job=>{
      const trialStatus=job.last_trial?.status||job.result?.trial_quality_status;
      const processing=!['completed','failed'].includes(job.status);
      const trialReport=job.result?.draft?.trial_run?.rule_report||job.result?.trial_run?.rule_report||job.last_trial?.rule_report;
      const publishable=!processing&&job.status!=='failed'&&(job.result?.draft_status==='trial_completed'||['PASS','REVIEW'].includes(trialStatus))&&templatePrivacyCheck(trialReport).passed;
      return {key:`document-draft/${job.id}`,id:job.id,name:job.name,dataType:'文档类图像',businessType:job.business_type||'-',status:'草稿',publishable,processing,summary:`${job.result?.cell_count||0} 格 · ${job.result?.field_count||0} 字段`,updatedAt:formatDateTime(job.updated_at||job.created_at),kind:'document-draft',raw:job};
    });
    const documentPublishedRows=templates.map(item=>({key:`document-published/${item.template_id}/${item.version}`,id:item.template_id,name:item.name,dataType:'文档类图像',businessType:item.business_type||'-',status:'已发布',taskReferences:taskReferences(item.template_id),summary:item.execution_engine==='customs_modular_monolith/v1'?`${item.capability_summary?.content_fields||'50+'} 字段 · 专用适配器`:`${item.cell_count||0} 格 · ${item.field_count||0} 字段`,updatedAt:formatDateTime(item.updated_at||item.created_at),kind:'document-published',raw:item}));
    const conversationDraftRows=conversationDrafts.map(item=>({key:`conversation-draft/${item.draft_id}`,id:item.draft_id,name:item.name||item.configuration?.identity?.name||'未命名对话模板',dataType:'对话',businessType:item.business_type||item.configuration?.identity?.business_type||item.scenario_type||'智能客服',status:'草稿',publishable:['PASS','REVIEW'].includes(item.trial_status)&&templatePrivacyCheck(item.trial_run?.rule_report).passed,processing:false,summary:`${item.rule_card_count||0} 规则卡 · ${item.tool_count||0} 工具`,updatedAt:formatDateTime(item.updated_at),kind:'conversation-draft',raw:item}));
    const conversationPublishedRows=conversationTemplates.map(item=>({key:`conversation-published/${item.template_id}/${item.version}`,id:item.template_id,name:item.name,dataType:'对话',businessType:item.business_type||item.scenario_type||'智能客服',status:'已发布',taskReferences:taskReferences(item.template_id),summary:`${item.rule_card_count||0} 规则卡 · ${item.tool_count||0} 工具`,updatedAt:formatDateTime(item.updated_at),kind:'conversation-published',raw:item}));
    const coldDraftRows=coldChainDrafts.map(item=>({key:`time-draft/${item.draft_id}`,id:item.draft_id,name:item.name,dataType:'时序',businessType:item.business_type||'传感器时序',status:'草稿',publishable:item.trial_status==='PASS'&&templatePrivacyCheck(item.trial_run?.rule_report).passed,processing:false,summary:`${item.field_count||0} 字段 · ${item.coverage_profile_count||0} 标签组合`,updatedAt:formatDateTime(item.updated_at),kind:'time-draft',raw:item}));
    const coldPublishedRows=coldChainTemplates.map(item=>({key:`time-published/${item.template_id}/${item.version}`,id:item.template_id,name:item.name,dataType:'时序',businessType:item.business_type||'冷藏集装箱物流',status:'已发布',taskReferences:taskReferences(item.template_id),summary:`${item.parameter_count||0} 字段 · ${(item.generation_rule_count||0)+(item.quality_rule_count||0)} 规则`,updatedAt:formatDateTime(item.updated_at),kind:'time-published',raw:item}));
    return demoTemplatePairs([...documentMockDraftRows,...documentDraftRows,...documentPublishedRows,...conversationDraftRows,...conversationPublishedRows,...coldDraftRows,...coldPublishedRows]);
  },[jobs,templates,conversationDrafts,conversationTemplates,coldChainDrafts,coldChainTemplates]);
  const businessTypeOptions=useMemo(()=>[...new Set(unifiedRows.map(row=>row.businessType).filter(Boolean))].sort(),[unifiedRows]);
  const filteredRows=useMemo(()=>unifiedRows.filter(row=>(filter==='全部'||row.dataType===filter)&&(statusFilter==='全部'||row.status===statusFilter)&&(businessTypeFilter==='全部'||row.businessType===businessTypeFilter)&&(!query||row.name.includes(query)||row.id.includes(query)||row.businessType.includes(query))),[unifiedRows,filter,statusFilter,businessTypeFilter,query]);
  const updateJob = updated => {
    setJobs(current => current.map(item => item.id === updated.id ? updated : item));
    setDetail(current=>({...updated,_editing:current?._editing}));
    if (updated.result?.published_template) refresh();
  };
  const showTemplateDetail = row => {
    if(row.kind.startsWith('document-mock-')) { setMockDetail(row); return; }
    if(row.kind==='conversation-draft') { setConversationEditor({draftId:row.raw.draft_id, readOnly:true}); return; }
    if(row.kind==='conversation-published') { setConversationEditor({template:row.raw, readOnly:true}); return; }
    if(row.kind.startsWith('time-')) { setColdChainEditor({template:row.raw, readOnly:true}); return; }
    if(row.kind==='document-draft') { setDetail(row.raw); return; }
    if(row.kind==='document-published' && row.raw.source_job_id) { templateApi.getJob(row.raw.source_job_id).then(setDetail).catch(error=>message.error(error.message)); return; }
    Modal.info({
    title: row.name || '模板详情',width:680,okText:'关闭',
    content:<Descriptions bordered size="small" column={2} className="section-title" items={[
      {key:'id',label:'模板 ID',span:2,children:<Text copyable>{row.id}</Text>},
      {key:'type',label:'数据类型',children:row.dataType},
      {key:'business',label:'业务类型',children:row.businessType},
      {key:'status',label:'状态',children:<Tag color={row.status==='已发布'?'green':'blue'}>{row.status}</Tag>},
      
      {key:'updated',label:'更新时间',span:2,children:row.updatedAt},
    ]}/>,
    });
  };
  const copyTemplate = row => {
    const now = Date.now();
    const copied = {...row,id:`DRAFT-COPY-${now}`,name:`${row.name || '模板'}（副本）`,status:'completed',created_at:nowDateTime(),updated_at:nowDateTime(),result:{...(row.result||{}),published_template:null,draft_revision:1,draft_status:'ready_for_trial'},_prototypeCopy:true};
    setJobs(current=>[copied,...current]);
    message.success('模板已复制为草稿');
  };
  const publishTemplate = async row => {
    try {
      const updated = row._synthetic ? await syntheticTemplateApi.publish(row.id) : await templateApi.publish(row.id);
      message.success(`模板“${row.name}”已发布`);
      if (updated?.id) setJobs(current=>current.map(item=>item.id===row.id?updated:item));
      refresh();
    } catch (publishError) { message.error(publishError.message); }
  };
  const deleteJob = row => Modal.confirm({
    title:`删除模板“${row.name}”？`,content:'删除后不可恢复，请确认是否删除该模板。',okText:'确认删除',okType:'danger',cancelText:'取消',
    onOk:()=>{setJobs(current=>current.filter(item=>item.id!==row.id));message.success('模板制作记录已删除');},
  });
  const editUnified=row=>{
    if(row.kind==='document-mock-draft')setMockDetail({...row,editing:true});
    if(row.kind==='document-draft')setDetail({...row.raw,_editing:true});
    if(row.kind==='conversation-draft')setConversationEditor({draftId:row.raw.draft_id});
    if(row.kind==='conversation-published')setConversationEditor({template:row.raw});
    if(row.kind==='time-draft')setColdChainEditor(row.raw.draft_id);
  };
  const publishUnified=row=>Modal.confirm({
    title:`发布模板“${row.name}”？`,
    content:'模板发布后不可再编辑，请确认配置内容已经完成。',
    okText:'确认发布',
    cancelText:'取消',
    onOk:async()=>{
      try{
        if(row.kind==='document-draft')await publishTemplate(row.raw);
        if(row.kind==='conversation-draft')await conversationApi.publishTemplateDraft(row.raw.draft_id,{expected_revision:row.raw.revision});
        if(row.kind==='time-draft')await coldchainApi.publishTemplateDraft(row.raw.draft_id,row.raw.revision);
        message.success(`模板“${row.name}”已发布`);refresh();
      }catch(publishError){message.error(publishError.message);throw publishError;}
    },
  });
  const copyUnified=async row=>{
    if(row.kind.startsWith('document-')){copyTemplate(row.raw);return;}
    if(row.kind==='conversation-published'){try{await conversationApi.cloneTemplate(row.raw.template_id,`${row.name}（副本）`);message.success('模板已复制为草稿');refresh();}catch(error){message.error(error.message);}return;}
    try{
      const api=row.kind.startsWith('time-')?coldchainApi:conversationApi;
      const source=row.kind.endsWith('published')?await api.getTemplate(row.raw.template_id):await api.getTemplateDraft(row.raw.draft_id);
      if(!source?.configuration)throw new Error('模板配置不存在，无法复制');
      const configuration=structuredClone(source.configuration);
      if(row.kind.startsWith('time-'))configuration.name=`${row.name}（副本）`;
      else configuration.identity={...configuration.identity,name:`${row.name}（副本）`};
      await api.createTemplateDraft({configuration});
      message.success('模板已复制为草稿');refresh();
    }catch(error){message.error(error.message);}
  };
  const deleteUnified=row=>Modal.confirm({title:`删除模板“${row.name}”？`,content:'删除后不可恢复，请确认是否删除该模板。',okText:'确认删除',okType:'danger',cancelText:'取消',onOk:()=>{
    if(row.kind==='document-draft')setJobs(current=>current.filter(item=>item.id!==row.raw.id));
    if(row.kind==='document-published')setTemplates(current=>current.filter(item=>!(item.template_id===row.raw.template_id&&item.version===row.raw.version)));
    if(row.kind==='conversation-draft')setConversationDrafts(current=>current.filter(item=>item.draft_id!==row.raw.draft_id));
    if(row.kind==='conversation-published')setConversationTemplates(current=>current.filter(item=>item.template_id!==row.raw.template_id));
    if(row.kind==='time-draft')setColdChainDrafts(current=>current.filter(item=>item.draft_id!==row.raw.draft_id));
    if(row.kind==='time-published')setColdChainTemplates(current=>current.filter(item=>item.template_id!==row.raw.template_id));
    message.success('模板已删除');
  }});
  const columns = [
    {title:'模板名称 / ID',dataIndex:'name',width:270,render:(value,row)=><div><Text strong>{value}{row.status==='草稿'&&!String(value).endsWith('（草稿）')?'（草稿）':''}</Text><div><Text type="secondary">{row.id}</Text></div></div>},
    {title:'数据类型',dataIndex:'dataType',width:120},
    {title:'业务类型',dataIndex:'businessType',width:150},
    {title:'状态',dataIndex:'status',width:110,render:value=><Tag color={value==='已发布'?'green':'blue'}>{value}</Tag>},
    {title:'任务引用',width:110,render:(_,row)=>{const references=row.taskReferences||[];const count=references.length;return count?<Tooltip title={<div>{references.map(name=><div key={name}>{name}</div>)}</div>}><Text className="template-reference-count">{count}</Text></Tooltip>:<Text>0</Text>;}},
    {title:'更新时间',dataIndex:'updatedAt',width:185},
    {title:'操作',fixed:'right',width:240,render:(_,row)=>{const isDraft=row.status==='草稿';const references=row.taskReferences||[];return <TemplateActionButtons compact onDetail={()=>showTemplateDetail(row)} onEdit={()=>editUnified(row)} onPublish={()=>publishUnified(row)} onCopy={()=>copyUnified(row)} onDelete={()=>deleteUnified(row)} canEdit={isDraft} canPublish={isDraft&&row.publishable} canCopy canDelete={!references.length} editReason="已发布模板不可编辑，请复制为草稿后修改" publishReason={isDraft?'请先完成试运行并通过模板隐私检查':'该模板已经发布'} deleteReason={references.length?`已有 ${references.length} 个任务引用，不能删除`:'当前模板不可删除'}/>;}},
  ];
  const createMenuItems = taskTypes.map(item => ({
    key: item.value,
    icon: item.icon,
    disabled: !item.enabled,
    label: <Space direction="vertical" size={0}><Text>{item.label}</Text><Text type="secondary" style={{ fontSize: 12 }}>{item.enabled ? item.description : '后续开放'}</Text></Space>,
  }));
  if(detail&&!detail._synthetic&&detail._editing)return <DocumentTemplateCreatePage existingJob={detail} onBack={()=>setDetail(null)} onCreated={updateJob} onUpdated={updateJob}/>;
  if(detail&&!detail._synthetic)return <TemplateEditor presentation="page" job={detail} open readOnly={!detail._editing} onClose={()=>setDetail(null)} onUpdated={updateJob}/>;
  if(mockDetail?.raw?.source_type==='waybill_mock')return <WaybillSeedMockEditor fileName="橙途速运固定安全底图" templateName={mockDetail.name} onBack={()=>setMockDetail(null)} readOnly={!mockDetail.editing}/>;
  if(mockDetail?.raw?.source_type==='contract_mock')return <ContractSeedMockEditor fileName="01_采购协议模板.docx" onBack={()=>setMockDetail(null)} readOnly={!mockDetail.editing}/>;
  if(coldChainEditor)return <ColdChainTemplateEditor draftId={typeof coldChainEditor==='string'?coldChainEditor:undefined} template={coldChainEditor?.template} readOnly={Boolean(coldChainEditor?.readOnly)} onClose={()=>{setColdChainEditor(null);refresh();}} onPublished={()=>{setColdChainEditor(null);refresh();}}/>;
  if(conversationEditor)return <ConversationTemplateEditor open presentation="page" template={conversationEditor.template} draftId={conversationEditor.draftId} readOnly={Boolean(conversationEditor.readOnly)} onClose={()=>{setConversationEditor(null);refresh();}} onSaved={()=>{setConversationEditor(null);refresh();}}/>;
  if (createType === 'document_image') return <DocumentTemplateCreatePage
    onBack={() => setCreateType(null)}
    onCreated={created => setJobs(current => [created, ...current.filter(item => item.id !== created.id)])}
    onUpdated={updated => { setJobs(current => current.map(item => item.id === updated.id ? updated : item)); if (updated.result?.published_template) refresh(); }}
  />;
  if (createType === 'document_image_synthetic') return <SyntheticDocumentTemplateCreatePage
    onBack={() => setCreateType(null)}
    onPublished={() => { setCreateType(null); setFilter('文档类图像'); refresh(); }}
  />;
  if (createType === 'conversation') return <ConversationTemplateCreatePage
    onBack={() => setCreateType(null)}
    onCreated={() => { setCreateType(null); setFilter('对话'); refresh(); }}
  />;
  if (createType === 'time_series') return <ColdChainTemplateCreatePage
    onBack={() => setCreateType(null)}
    onCreated={() => { setCreateType(null); setFilter('时序'); refresh(); }}
  />;
  return <>
    <PageHeader actions={<Dropdown trigger={['click']} placement="bottomRight" menu={{ items:createMenuItems, onClick:({ key }) => setCreateType(key) }}><Button type="primary" icon={<PlusOutlined/>}>新建模板 <DownOutlined/></Button></Dropdown>}/>
    {error && <Alert className="section-title" type="error" showIcon message="模板 Mock 数据读取失败" description={`${error}。请刷新页面以重新加载内置示例。`}/>} 
    <Card className="main-card" styles={{body:{padding:0}}}>
      <Flex justify="space-between" align="center" className="toolbar"><Space><Segmented value={filter} onChange={value=>{setFilter(value);setBusinessTypeFilter('全部');}} options={[{label:'全部',value:'全部'},{label:'文档图像',value:'文档类图像'},{label:'对话文本',value:'对话'},{label:'时序数据',value:'时序'}]}/><Select placeholder="请选择选项" value={statusFilter} onChange={setStatusFilter} style={{width:150}} options={['全部','草稿','已发布'].map(value=>({label:value==='全部'?'全部状态':value,value}))}/><Select placeholder="请选择选项" value={businessTypeFilter} onChange={setBusinessTypeFilter} style={{width:170}} options={[{label:'全部业务类型',value:'全部'},...businessTypeOptions.map(value=>({label:value,value}))]}/></Space><Input allowClear prefix={<SearchOutlined/>} placeholder="搜索模板名称、ID或业务类型" value={query} onChange={event=>setQuery(event.target.value)} style={{width:280}}/></Flex>
      <Table loading={loading} rowKey="key" dataSource={loading?[]:filteredRows} columns={columns} scroll={{x:1360}} pagination={loading?false:{pageSize:8,showTotal:total=>`共 ${total} 条`}}/>
    </Card>
    {detail?._synthetic ? <Drawer title="虚构文档模板草稿" size={760} open onClose={() => setDetail(null)}>
      <Alert type="info" showIcon message="这是独立的虚构合成模板制作记录" description="该流程不上传或复刻种子图片；模板只保存程序化版式、字段规则与安全图案。"/>
      <Descriptions bordered size="small" column={2} className="section-title" items={[
        {key:'id',label:'任务 ID',children:<Text copyable>{detail.id}</Text>},
        {key:'status',label:'状态',children:statusTag(detail)},
        {key:'name',label:'模板名称',children:detail.name},
        {key:'type',label:'业务类型',children:detail.business_type},
        {key:'updated',label:'更新时间',children:formatDateTime(detail.updated_at)},
        {key:'objects',label:'模板对象',span:2,children:`${detail.result?.cell_count || 0} 个单元格 / ${detail.result?.text_count || 0} 个文字对象 / ${detail.result?.field_count || 0} 个动态字段`},
      ]}/>
      {detail.last_trial && <><Title level={5}>最近一次试运行</Title><Space wrap><Tag color={detail.last_trial.status==='PASS'?'green':detail.last_trial.status==='REJECT'?'red':'gold'}>{detail.last_trial.status}</Tag>{Object.entries(detail.artifact_urls||{}).map(([key,url])=><Button key={key} href={syntheticTemplateApi.artifactUrl(url)} target="_blank">{key}</Button>)}</Space></>}
    </Drawer> : detail && <TemplateEditor presentation="page" job={detail} open readOnly onClose={() => setDetail(null)} onUpdated={updateJob}/>} 
  </>;
}
