import React from 'react';
import {Alert,Button,Card,Col,Flex,Form,Input,InputNumber,Progress,Row,Select,Typography,Upload} from 'antd';
import {CloudUploadOutlined,ReloadOutlined} from '@ant-design/icons';
import {BusinessTypeSelect,DEFAULT_BUSINESS_TYPES} from './BusinessTypeSelect';
import {FormModelConfig,ModelConfigField} from './ModelConfigField';
const {Text}=Typography;
const documentBusinessOptions=[{label:'版面分析法',value:'装箱单'},{label:'底图生成法',value:'运单'}];
function documentMethodLock(value){return DEFAULT_BUSINESS_TYPES.document_image.includes(value)?value==='运单'?'运单':'装箱单':null;}
const LAYOUT_ANALYSIS_SEMANTIC_PROMPT = `当前演示为装箱单（PACKING LIST）。识别装箱方 issuer、关联发票号 invoice_no、合同号 contract_no、装箱日期 pl_date、收货方 to、唛头 item_marks、货名 item_description、件数 item_quantity、毛重 item_gw、净重 item_nw、总件数 total_qty、总毛重 total_gw、总净重 total_nw、签署栏 signature 共 14 个字段。明细与汇总分别核对，净重不得超过毛重，CTNS 与 TINS 不混加，重量统一为 kg；签署主体与装箱方一致。标题、表头、TOTAL 和声明为固定文字。

你是“文档图像模板语义建模器”，不是通用 OCR 纠错器或简单文本分类器。输入包括：业务类型、整张种子文档图像、按阅读顺序排列的 OCR 文字对象，以及每个对象的 text_id、原始识别文本、bbox/polygon、所在表格单元格或版面区域、OCR 置信度和相邻对象。请先理解整张单据的版面结构与业务语义，再完成字段级建模。

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
export {BACKGROUND_GENERATION_SEMANTIC_PROMPT};
export default function DocumentFirstStep({form,businessType="运单",methodLock="运单",generatingBase=false,generateBaseImage,baseImageProgress=0,baseImagePreview="",fileList=[],privacyProgress=100,imageDimensions=""}){return <>
      <Card className="main-card" title="模板基础信息">
        <Row gutter={16}><Col span={12}><Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }, { max: 80 }]}><Input autoFocus placeholder="例如：装箱单模板"/></Form.Item></Col><Col span={12}><Form.Item name="documentBusinessType" label="业务类型" rules={[{required:true,message:'请选择业务类型'}]}><BusinessTypeSelect modality="document_image" onChange={value => { const locked = documentMethodLock(value); if (locked) form.setFieldsValue({ businessType: locked, seedFile: [] }); }}/></Form.Item></Col></Row>
        <Form.Item name="description" label="模板描述" rules={[{max:500}]}><Input.TextArea rows={3} maxLength={500} showCount placeholder="例如：用于制作装箱单类文档图像模板，覆盖版面分析、字段提取和合成数据生成。" allowClear/></Form.Item>
      </Card>
      <Card className="main-card" title="版面分析与语义提取">
        <Form.Item name="businessType" label="模板制作方式" rules={[{ required: true, message:'请选择模板制作方式' }]}>
          <Select options={documentBusinessOptions.map(item => ({ ...item, disabled: methodLock && item.value !== methodLock }))} onChange={value=>form.setFieldsValue(value==='运单'?{businessType:value,seedFile:[],semanticPrompt:BACKGROUND_GENERATION_SEMANTIC_PROMPT}:{businessType:value,seedFile:[],semanticPrompt:LAYOUT_ANALYSIS_SEMANTIC_PROMPT})}/>
        </Form.Item>
        <Alert className="template-modal-note" type="info" showIcon message={businessType === '装箱单' ? '版面分析法' : '底图生成法'} description={businessType === '装箱单' ? '上传种子图片，通过版面检测、OCR、结构校准和字段配置制作模板。' : '解析业务字段并基于平台生成的安全底图进行在线编辑，不复制真实品牌或版面。'}/>
      {businessType === '运单' && <Form.Item name="backgroundSeedFile" label="上传参考底图" valuePropName="fileList" getValueFromEvent={event => Array.isArray(event) ? event : event?.fileList} rules={[{ required: true, message: '请上传参考底图' }]}><Upload.Dragger accept=".png,.jpg,.jpeg,.webp,.bmp" maxCount={1} beforeUpload={() => false}><p className="ant-upload-drag-icon"><CloudUploadOutlined /></p><p>拖拽或点击选择底图</p><p className="ant-upload-hint">底图生成法将使用该图片作为参考</p></Upload.Dragger></Form.Item>}
      {businessType==='运单'&&<Card size="small" title="底图生成配置" className="template-editor-card" extra={<Button type="primary" size="small" loading={generatingBase} onClick={generateBaseImage}>{generatingBase ? '生成中' : '生成底图'}</Button>}><ModelConfigField><Form.Item name="imageGenerationModel" label="图像生成模型" rules={[{required:true}]}><Select placeholder="请选择图像生成模型" options={[{value:'doubao-seedream-5-0-260128',label:'豆包 Seedream 5.0（doubao-seedream-5-0-260128）'}]}/></Form.Item></ModelConfigField><Form.Item name="baseImagePrompt" label="底图生成提示词" rules={[{required:true,whitespace:true,message:'请输入底图生成提示词'}]}><Input.TextArea placeholder="描述底图生成提示词，说明目标、约束和输出要求" rows={7} allowClear/></Form.Item>{generatingBase && <Progress percent={baseImageProgress} status={baseImageProgress < 100 ? 'active' : 'success'}/>}</Card>}
      {businessType==='运单'&&baseImagePreview&&<Card size="small" className="section-title" title="底图预览" extra={<Button icon={<ReloadOutlined/>} loading={generatingBase} onClick={generateBaseImage}>重新生成</Button>}><Flex vertical align="center" gap={12}><img src={baseImagePreview} alt="底图预览" style={{maxWidth:'100%',maxHeight:420,border:'1px solid #eee',borderRadius:8}}/><Text type="secondary">确认底图满意后，点击「下一步」进入在线编辑。</Text></Flex></Card>}
      {businessType==='装箱单'&&<Form.Item name="seedFile" label="上传种子图片" valuePropName="fileList" getValueFromEvent={event => Array.isArray(event) ? event : event?.fileList} rules={[{ required: true, message: '请上传种子图片' }]}>
        <Upload.Dragger accept=".png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff" maxCount={1} beforeUpload={() => false}>
          <p className="ant-upload-drag-icon"><CloudUploadOutlined/></p><p>拖入或点击选择一张文档图片</p><p className="ant-upload-hint">支持 PNG/JPEG/WebP/BMP/TIFF，最大 25MB</p>
        </Upload.Dragger>
      </Form.Item>}
      {businessType==='装箱单'&&!!fileList.length&&<Card size="small" className="section-title" title="种子数据隐私检查与脱敏保护"><Progress percent={privacyProgress} status={privacyProgress<100?'active':'success'}/><Text type="secondary">{privacyProgress<100?'正在检测隐私字段并生成脱敏保护副本，完成前不能进入下一步。':'隐私检查与脱敏保护完成，后续流程使用受保护副本。'}</Text></Card>}
      <Row gutter={16}>
        <Col span={12}><Form.Item name="imgsz" label="版面推理尺寸" tooltip={`设置版面检测模型预处理时的目标尺寸，单位为像素，不是原图宽度，也不改变最终生成图片的尺寸。只填写一个数值，是因为模型会按预处理规则计算宽高，通常等比例缩放并按需补边，避免拉伸图片。调大可能更有利于检测细小区域，但速度更慢、显存占用更高；调小速度更快，但可能漏检细节。建议先使用默认值1024；放大低清图片不能补回缺失细节。种子图片尺寸：${imageDimensions||'待读取'}。`} rules={[{required:true}]}><InputNumber placeholder="请输入版面推理尺寸（320～4096）" min={320} max={4096} step={64} addonAfter="px" style={{width:'100%'}}/></Form.Item></Col>
        <Col span={12}><Form.Item name="conf" label={businessType === '运单' ? '区块置信度阈值' : '置信度阈值'} tooltip="用于筛选版面检测框，取值为0.01～1。例如设为0.2时，仅保留模型置信度达到0.2的区域。调高阈值通常会减少检测框和误检，但可能漏掉文字、表格等区域；调低阈值通常会保留更多区域，但可能增加误检。置信度是模型对检测结果的评分，不代表识别准确率，也不是OCR文字识别的准确率。建议先使用默认值0.2：漏检较多时适当调低，误检较多时适当调高。" rules={[{ required: true }]}><InputNumber placeholder="请输入数值（0.01～1）" min={0.01} max={1} step={0.05} precision={2} style={{ width: '100%' }}/></Form.Item></Col>
      </Row>
      <FormModelConfig form={form} modelName="semanticModel" parameterSwitchName="semanticParamsEnabled" parameterName="semanticParamsJson" label="语义提取模型" options={[{value:'qwen3-vl-8b-instruct',label:'Qwen3-VL-8B-Instruct'}]} help="结合整单字段关系提取语义；关闭自定义参数后不传递模型生成参数。"/>
      <Card size="small" title="语义提取提示词" className="template-editor-card">
        <Form.Item name="semanticPrompt"><Input.TextArea placeholder="请输入内容" autoSize={{ minRows: 18, maxRows: 30 }} allowClear/></Form.Item>
        <Text type="secondary">当前原型用一段完整 Prompt 表达最终语义建模目标；正式实现可按结构分类、字段绑定、生成规则、质检规则和审校复核拆成多阶段调用。</Text>
      </Card>
      </Card>

</>;}
