import {ControlledModelConfig,ModelConfigField} from './ModelConfigField';
import RuleQualityReport from './RuleQualityReport';
import {trialQualityReport} from './qualityResults';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Collapse, Descriptions, Divider, Flex, Form, Input, InputNumber, Row, Select, Space, Steps, Switch, Table, Tabs, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, DeleteOutlined, EyeInvisibleOutlined, EyeOutlined, LeftOutlined, PlusOutlined, PlayCircleOutlined, RedoOutlined, ReloadOutlined, UndoOutlined } from '@ant-design/icons';
import UnifiedQualityEditor from './UnifiedQualityEditor';
import {qualityConfig,activeRules} from './qualityCatalog.js';
import {templateLabelSnapshot} from './qualityResults.js';
import { DocumentQualityModelSettings, UnifiedWaybillQualityPanel } from './DocumentWaybillQualityPanels';

const { Title, Text, Paragraph } = Typography;
const BASE_IMAGE = '/assets/template-mock/orange-waybill-base.png?v=20260913';

const RAW_FIELDS = [
  ['waybill_no','运单标识','运单号码','Barcode No.'],
  ['sender_name','寄件信息','寄件人姓名','FROM'], ['departure','寄件信息','始发地','DEPARTURE'],
  ['sender_company','寄件信息','单位名称','COMPANY NAME'], ['sender_address','寄件信息','寄件地址','ADDRESS'],
  ['sender_province','寄件信息','省','Province'], ['sender_city','寄件信息','市（县）','City'], ['sender_town','寄件信息','区（镇）','Town'],
  ['sender_mobile','寄件信息','联系手机（非常重要）','MOBILE PHONE (VERY IMPORTANT)'], ['sender_phone','寄件信息','固定电话','PHONE'],
  ['receiver_name','收件信息','收件人姓名','TO'], ['receiver_city_name','收件信息','城市','CITY'],
  ['receiver_company','收件信息','单位名称','COMPANY NAME'], ['receiver_address','收件信息','收件地址','ADDRESS'],
  ['receiver_province','收件信息','省','Province'], ['receiver_city','收件信息','市（县）','City'], ['receiver_town','收件信息','区（镇）','Town'],
  ['receiver_mobile','收件信息','联系手机（非常重要）','MOBILE PHONE (VERY IMPORTANT)'], ['receiver_phone','收件信息','固定电话','PHONE'],
  ['content_document','物品类型','文件','DOCUMENT'], ['content_parcel','物品类型','物品','PARCEL'],
  ['contents_name','内件信息','内件品名','NAME OF CONTENTS'], ['contents_amount','内件信息','数量','AMOUNT'],
  ['weight','重量体积','重量','WEIGHT'], ['weight_unit','重量体积','千克','KG'], ['volume','重量体积','体积','VOLUME'],
  ['dimensions','重量体积','长×宽×高','L×W×H'], ['volume_unit','重量体积','立方厘米','CM³'],
  ['payment_method','结算信息','付款方式','MEANS OF PAYMENT'], ['payment_cash','结算信息','现金','CASH'], ['payment_agreement','结算信息','协议结算','AGREEMENT'],
  ['insurance_amount','费用信息','保价金额','INSURANCE AMOUNT'], ['charge','费用信息','资费','CHARGE'],
  ['insurance_fee','费用信息','保价费','INSURANCE FEE'], ['total_amount','费用信息','费用总计','TOTAL AMOUNT'],
  ['receiver_signature','签收信息','收件人签名',"RECEIVER'S SIGNATURE"], ['receiver_id_no','签收信息','证件号','ID NO.'],
  ['authorized_signature','签收信息','代收人签名','AUTHORIZED SIGNATURE'], ['received_date','签收信息','签收日期','年/月/日，Y/M/D'],
  ['remark','备注','备注','REMARK'], ['sender_signature','揽收信息','寄件人签名',"SENDER'S SIGNATURE"],
  ['pickup_signature','揽收信息','揽件人签名','PICKED UP BY (SIGNATURE)'], ['sent_datetime','揽收信息','寄件日期时间','年/月/日/时'],
  ['track_qr','查询信息','扫码查询','TRACK'], ['address_copy','联次标识','名址联','Address copy'],
];

const SAMPLES = {
  waybill_no:'OT20260901001', sender_name:'林川', departure:'广州', sender_company:'星河合成贸易有限公司', sender_address:'广东省广州市训练路88号',
  sender_province:'广东省', sender_city:'广州市', sender_town:'天河区', sender_mobile:'13800001234', sender_phone:'020-80001234',
  receiver_name:'周宁', receiver_city_name:'上海', receiver_company:'云帆合成供应链有限公司', receiver_address:'上海市浦东新区样本路66号',
  receiver_province:'上海市', receiver_city:'上海市', receiver_town:'浦东新区', receiver_mobile:'13900005678', receiver_phone:'021-80005678',
  content_document:'否', content_parcel:'是', contents_name:'训练用包装材料', contents_amount:'2件', weight:'3.50', weight_unit:'KG', volume:'24000', dimensions:'40×30×20', volume_unit:'CM³',
  payment_method:'协议结算', payment_cash:'否', payment_agreement:'是', insurance_amount:'1000.00', charge:'36.00', insurance_fee:'5.00', total_amount:'41.00',
  receiver_signature:'合成收件人', receiver_id_no:'SYN-ID-260901-01', authorized_signature:'—', received_date:'2026/09/01', remark:'请轻放',
  sender_signature:'合成寄件人', pickup_signature:'合成揽件员', sent_datetime:'2026-09-01 10:00:00', track_qr:'SYNTHETIC:OT20260901001', address_copy:'名址联',
};

const FIELD_LAYOUT = {
  waybill_no:[51.5,16.2,20,3],
  sender_name:[17,21.5,10,2.7], departure:[35.8,21.5,9,2.7], sender_company:[19,25.7,24,2.7], sender_address:[16.5,30.1,27,2.7],
  sender_province:[20.8,36.1,8,2.7], sender_city:[31.1,36.1,8,2.7], sender_town:[41.1,36.1,4.5,2.7], sender_mobile:[20.3,42.8,8.5,2.7], sender_phone:[36.6,42.8,8.5,2.7],
  receiver_name:[56.3,21.5,10,2.7], receiver_city_name:[75.8,21.5,10,2.7], receiver_company:[58.6,25.7,25,2.7], receiver_address:[55.8,30.1,29,2.7],
  receiver_province:[62.8,36.1,8,2.7], receiver_city:[75.5,36.1,8,2.7], receiver_town:[86.3,36.1,7,2.7], receiver_mobile:[59.7,42.8,10,2.7], receiver_phone:[83.4,42.8,9,2.7],
  content_document:[15.2,49.8,3,2.7], content_parcel:[23.1,49.8,3,2.7], contents_name:[9,58.1,22,3], contents_amount:[35,58.1,10,3],
  weight:[50.5,51.7,5.5,2.5], weight_unit:[57.3,51.7,3.5,2.5], volume:[63.5,51.7,5.5,2.5], dimensions:[73.5,51.7,9,2.5], volume_unit:[88.7,51.7,4.5,2.5],
  payment_method:[55.5,56.3,6.5,2.5], payment_cash:[66,56.3,4.5,2.5], payment_agreement:[79,56.3,7,2.5], insurance_amount:[57.5,60.9,10,2.5],
  charge:[53,65.4,7,2.5], insurance_fee:[68,65.4,7,2.5], total_amount:[83,65.4,8,2.5],
  sender_signature:[9,73.2,14,3], pickup_signature:[26,73.2,13,3], sent_datetime:[11,81.2,18,3],
  receiver_signature:[49,72.2,16,3], receiver_id_no:[78,72.2,14,3], authorized_signature:[49,77.7,16,3], received_date:[82,79.5,10,3], remark:[53,82.5,37,3],
  track_qr:[84.2,4.2,7.8,11], address_copy:[95.2,26,2.5,12],
};

const FIXED_TEXT_LAYOUT = [
  ['sender_name','寄件人姓名 / FROM',8.2,21.3,10], ['departure','始发地 / DEPARTURE',27.7,21.3,11],
  ['sender_company','单位名称 / COMPANY NAME',8.2,25.6,14], ['sender_address','寄件地址 / ADDRESS',8.2,30.1,12],
  ['sender_province','省 / Province',22.2,33.9,6], ['sender_city','市（县）/ City',31.1,33.9,7], ['sender_town','区（镇）/ Town',41,33.9,7],
  ['sender_mobile','联系手机（非常重要）/ MOBILE PHONE',8.2,42.1,13], ['sender_phone','固定电话 / PHONE',30.5,42.1,9],
  ['receiver_name','收件人姓名 / TO',47.7,21.3,10], ['receiver_city_name','城市 / CITY',69.7,21.3,8],
  ['receiver_company','单位名称 / COMPANY NAME',47.7,25.6,14], ['receiver_address','收件地址 / ADDRESS',47.7,30.1,12],
  ['receiver_province','省 / Province',63.4,33.9,6], ['receiver_city','市（县）/ City',75.8,33.9,7], ['receiver_town','区（镇）/ Town',86.6,33.9,7],
  ['receiver_mobile','联系手机（非常重要）/ MOBILE PHONE',47.7,42.1,13], ['receiver_phone','固定电话 / PHONE',75.4,42.1,9],
  ['document','文件 / DOCUMENT',8.9,49.6,7], ['parcel','物品 / PARCEL',19,49.6,7],
  ['contents_notice','如系物品，请据实填写内件名称及数量，并确认价值不超过人民币壹万元。',26.5,49.1,18],
  ['contents_name','内件品名 / NAME OF CONTENTS',10,55.9,17], ['contents_amount','数量 / AMOUNT',34.8,55.9,10],
  ['weight','重量 / WEIGHT',47.7,49.3,7], ['weight_unit','千克 / KG',57.2,49.3,5], ['volume','体积 / VOLUME',61.1,49.3,7],
  ['dimensions','长 × 宽 × 高 / L × W × H',69.5,49.3,12], ['equals','=',83.5,49.3,2], ['volume_unit','厘米³ / CM³',89,49.3,5],
  ['payment','付款方式 / MEANS OF PAYMENT',47.7,55.9,14], ['cash','现金 / CASH',62.8,55.9,7], ['agreement','协议结算 / AGREEMENT',71.2,55.9,13],
  ['insurance_amount','保价金额 / INSURANCE AMOUNT',47.7,60.6,16], ['uppercase','万　仟　佰　拾　元（大写）',67.1,60.6,20],
  ['charge','资费 / CHARGE',47.7,65.1,8], ['insurance_fee','保价费 / INSURANCE FEE',61.3,65.1,11], ['total_amount','费用总计 / TOTAL AMOUNT',77.1,65.1,12],
  ['sender_signature',"寄件人签名 / SENDER'S SIGNATURE",8.2,69.4,16], ['pickup_signature','揽件人签名 / PICKED UP BY',25.7,69.4,14],
  ['pickup_notice','收寄物品超出快递服务业务经营许可范围的服务提供者不承揽责任。',39.4,72.2,6], ['sent_date','年 Y　　月 M　　日 D　　时 H',10.2,81.3,15],
  ['receiver_signature',"收件人签名 / RECEIVER'S SIGNATURE",47.7,69.4,17], ['receiver_id','证件号 / ID NO.',69.6,69.4,10],
  ['authorized_signature','代收人签名 / AUTHORIZED SIGNATURE',47.7,75,17], ['authorized_id','证件号 / ID NO.',69.6,75,10], ['received_date','年 Y　　月 M　　日 D',81.5,78.6,12],
  ['remark','备注 / REMARK',47.7,81.8,9], ['safe','安全送达',8.8,93.6,7], ['fast','准时高效',15.1,93.6,7], ['service','用心服务',21.3,93.6,7],
];

export function initialFields() {
  return RAW_FIELDS.map(([key, region, zh, en]) => {
    const [x,y,w,h] = FIELD_LAYOUT[key];
    return {
      key, boundKey:key, region, zh, en, sample:SAMPLES[key] || `合成${zh}`,
      x, y, w, h, dataType:/日期|时间/.test(zh)?'date':/金额|资费|费|重量|体积|数量/.test(zh)?'number':/电话|手机/.test(zh)?'phone':/号码|证件/.test(zh)?'code':'text',
      fontSize:10, generation:'dictionary_rule', rule:`生成虚构${zh}；保持同一张运单内语义一致`, quality:`必填；格式符合${en}；不得包含真实可追踪信息`,
    };
  });
}

export function initialFixedTexts() {
  return FIXED_TEXT_LAYOUT.map(([id,text,x,y,w],index)=>({id:`fixed_${id}`,text,x,y,w,h:2.4,fontSize:8,color:'#262626',index}));
}

const WORKFLOW_STEPS=[
  {title:'基础信息与种子图片',description:'选择底图生成法'},
  {title:'字段解析与在线编辑',description:'字段、位置与生成规则'},
  {title:'质检规则配置',description:'基础规则与场景规则'},
  {title:'试运行与发布',description:'预览并确认模板'},
];
const BASE_QUALITY_RULES=[
  ['DINGO-IMAGE-DATA-FORMAT','文件格式合法性','样本','Dingo · RuleImageDataFormat','BLOCK','检查文件扩展名、实际编码与允许格式是否一致。'],
  ['DINGO-IMAGE-VALID','文件/记录可读取性','样本','Dingo · RuleImageValid','BLOCK','检查图像是否损坏、空文件或无法解码。'],
  ['DINGO-IMAGE-WHITE-BLACK','纯白/纯黑图检测','样本','Dingo · RuleImageValid','BLOCK','识别无有效运单内容的纯白图、纯黑图。'],
  ['DINGO-IMAGE-SIZE','图像尺寸合法性','样本','Dingo · RuleImageSizeValid','BLOCK','检查运单宽高、长宽比及最小分辨率。'],
  ['BASE-FILE-SIZE','文件大小合法性','样本','系统规则','BLOCK','检查文件体积是否位于模板允许范围。'],
  ['BASE-COLOR-MODE','颜色模式合法性','样本','系统规则','REVIEW','检查灰度、RGB、RGBA 等颜色模式是否符合配置。'],
  ['DINGO-IMAGE-REPEAT','重复图像检测','数据集','Dingo · RuleImageRepeat','BLOCK','检测完全重复或近似重复的运单样本。'],
  ['BASE-UNIQUE-ID','样本 ID 唯一性','数据集','系统规则','BLOCK','检查样本 ID 非空、格式合法且全局唯一。'],
  ['DINGO-IMAGE-QUALITY','清晰度/模糊度','样本 + 区域','Dingo · RuleImageQuality','BLOCK','识别失焦、抖动和文字边缘模糊。'],
  ['BASE-BRIGHTNESS','亮度合法性','样本 + 区域','系统视觉算法','REVIEW','检查整图及寄收件、费用、签收等关键区域亮度。'],
  ['BASE-CONTRAST','对比度合法性','样本 + 区域','系统视觉算法','REVIEW','检查文字、橙色表格线与底图的对比度。'],
  ['BASE-SHADOW','阴影遮盖率','区域','系统视觉算法','REVIEW','检查阴影是否遮挡运单号、联系方式、费用和签收信息。'],
  ['BASE-NOISE','图像噪声强度','样本','系统视觉算法','REVIEW','检查噪声是否破坏小字号文字和码区结构。'],
  ['BASE-DOCUMENT-EDGE','运单边缘完整性','样本','系统视觉算法','BLOCK','检查运单四边及装订、撕口区域是否完整可见。'],
  ['BASE-KEY-CROP','关键内容裁切检测','区域','系统视觉算法','BLOCK','检查条形码、二维码、寄收件、费用和签收区是否被裁断。'],
  ['BASE-ROTATION','旋转角度合法性','样本','系统视觉算法','REVIEW','检查页面旋转角度是否在模板允许范围。'],
  ['BASE-PERSPECTIVE','透视形变合法性','样本','系统视觉算法','REVIEW','检查透视扰动是否破坏字段与固定标签的绑定。'],
  ['BASE-LABEL-BOUNDS','标注坐标越界','标注','系统规则','BLOCK','检查固定文字及动态字段 bbox 坐标位于画布内。'],
  ['BASE-LABEL-ID','标注 ID 唯一性','标注','系统规则','BLOCK','检查固定文字和动态字段对象 ID 非空且唯一。'],
  ['BASE-LABEL-COVERAGE','运单字段标注覆盖率','样本 + 标注','系统规则','BLOCK','检查模板定义的运单字段均存在对应文字框。'],
  ['BASE-FIELD-BINDING','字段与固定标签绑定','字段 + 图层','系统规则','BLOCK','检查动态字段与运单固定标签的绑定关系完整且唯一。'],
  ['BASE-FIELD-REQUIRED','必填字段值完整性','字段','系统规则','BLOCK','检查运单号、寄收件信息、内件、重量、费用等必填值。'],
  ['BASE-FIELD-TYPE','字段数据类型合法性','字段','系统规则','BLOCK','检查电话、地址、日期、数字、金额和代码类型。'],
  ['BASE-WAYBILL-NO','运单号格式与唯一性','waybill_no','系统规则','BLOCK','检查运单号格式、安全前缀及数据集内唯一性。'],
  ['BASE-CONTACT-FORMAT','联系电话格式','sender_mobile / sender_phone / receiver_mobile / receiver_phone','系统规则','BLOCK','检查手机和固定电话格式，并确保均为虚构安全号码。'],
  ['BASE-ADDRESS-HIERARCHY','地址层级完整性','寄件地址 + 收件地址','系统规则','BLOCK','检查省、市、区县与详细地址字段完整且层级一致。'],
  ['BASE-CONTENT-AMOUNT','内件名称与数量完整性','contents_name / contents_amount','系统规则','BLOCK','检查内件品名与数量同时存在且格式有效。'],
  ['BASE-WEIGHT-VOLUME','重量体积字段格式','weight / volume / dimensions','系统规则','BLOCK','检查重量、体积、长宽高及单位的数值格式。'],
  ['BASE-PAYMENT-ENUM','付款方式枚举合法性','payment_method','系统规则','BLOCK','检查付款方式属于现金或协议结算等模板候选值。'],
  ['BASE-AMOUNT-FORMAT','费用字段格式','insurance_amount / charge / insurance_fee / total_amount','系统规则','BLOCK','检查保价金额、资费、保价费和总费用为合法金额。'],
  ['BASE-DATE-FORMAT','日期时间格式','sent_datetime / received_date','系统规则','BLOCK','检查寄件时间和签收日期符合模板格式。'],
  ['BASE-SIGNATURE-FIELDS','签名与证件字段完整性','签收信息 + 揽收信息','系统规则','REVIEW','检查寄件、揽件、收件及代收签名字段组合完整。'],
  ['BASE-TEXT-OVERFLOW','文字溢出检测','字段 + 区域','系统渲染检测','BLOCK','检查生成文字是否超出运单字段框或发生裁切。'],
  ['BASE-MIN-FONT-SIZE','最小字号合法性','字段 + 区域','系统渲染检测','REVIEW','检查缩放或自适应后的实际字号。'],
  ['BASE-GLYPH-MISSING','缺字/乱码检测','字段 + 区域','系统渲染检测','BLOCK','检查中英文标签及字段值是否出现缺字和乱码。'],
  ['BASE-CODE-DECODABLE','条码/二维码可解码性','waybill_no / track_qr','系统解码器','BLOCK','检查条形码和查询二维码可解码且与运单号绑定一致。'],
  ['BASE-GROUND-TRUTH','成品与字段真值一致性','字段 + 区域','系统规则 + OCR','BLOCK','检查成品运单中的字段内容与结构化真值一致。'],
  ['BASE-OCR-COVERAGE','OCR 文本覆盖率','样本 + 字段','系统 OCR','BLOCK','检查运单固定标签和动态字段被 OCR 结果覆盖的比例。'],
  ['BASE-OCR-CER','OCR 字符错误率','样本 + 字段','系统 OCR','BLOCK','以各运单字段真值计算 OCR 字符错误率。'],
  ['VLM-WAYBILL-LAYOUT','运单整体版面视觉自然度','最终成品图','VLM · 图像语义判断','REVIEW','判断橙色表格线、固定标签、动态字段、码区和签收区的层级、留白及对齐是否自然。'],
  ['VLM-IMAGE-FIELD','图像与字段语义一致性','成品图 + 字段真值','VLM · 图文联合判断','BLOCK','判断字段值是否出现在正确标签和业务分区，并与结构化真值一致。'],
  ['VLM-OCCLUSION-CROP','关键区域遮挡与裁切复核','最终成品图','VLM · 图像语义判断','BLOCK','检查水印、背景、图案、边缘裁切是否遮挡寄收件、费用、签收及机器码区域。'],
  ['VLM-DOCUMENT-RELEVANCE','运单图像业务相关性','最终成品图 + 模板描述','VLM · 图文相关性判断','REVIEW','判断生成图像是否仍是国内物流运单，而非其他表单或无关图片。'],
];

const PRIVACY_QUALITY_RULES=[
  ['DINGO-PII','标准 PII','整图 OCR + 每个字段','Dingo · RulePIIDetection','BLOCK','检测手机号、身份证、邮箱、银行卡等标准隐私信息。'],
  ['FIXED-PRIVACY-PERSON','姓名与证件隐私','sender_name / receiver_name / receiver_id_no / 签名字段','系统规则 / NER','BLOCK','检查寄件人、收件人、代收人姓名、签名和证件号是否为安全虚构值。'],
  ['FIXED-PRIVACY-CONTACT','联系方式隐私','寄件电话 + 收件电话','系统规则 / 正则','BLOCK','检查手机和固定电话是否残留真实可联系号码。'],
  ['FIXED-PRIVACY-ADDRESS','地址与单位隐私','寄收件地址 + 单位名称','系统规则 / NER','BLOCK','检查详细地址和单位名称是否包含真实主体或可定位信息。'],
  ['FIXED-PRIVACY-BUSINESS','业务标识隐私','waybill_no / track_qr / 条形码','业务字典 + 解码器','BLOCK','检查运单号、条形码和二维码不包含真实可追踪载荷。'],
  ['FIXED-PRIVACY-RESIDUAL','成品隐私残留复检','最终成品图','OCR + Dingo + 系统规则','BLOCK','对最终运单重新 OCR，确认敏感信息残留数为 0。'],
];

function OverlayCanvas({ fields, fixedTexts=[], visibility={}, selectedKey, selectedFixedId, onSelect, onSelectFixed, onMove, trial=false, readOnly=false }) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const pointerDown = (event, item, kind='dynamic') => {
    if (trial || readOnly) return;
    event.preventDefault(); event.stopPropagation();
    if(kind==='fixed') onSelectFixed?.(item.id); else onSelect?.(item.key);
    dragRef.current = { key:kind==='fixed'?item.id:item.key, kind, startX:event.clientX, startY:event.clientY, x:item.x, y:item.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = event => {
    if (!dragRef.current || trial || readOnly) return;
    const rect = canvasRef.current.getBoundingClientRect();
    onMove(dragRef.current.key, Math.max(0, Math.min(96, dragRef.current.x + (event.clientX-dragRef.current.startX)/rect.width*100)), Math.max(0, Math.min(95, dragRef.current.y + (event.clientY-dragRef.current.startY)/rect.height*100)), dragRef.current.kind);
  };
  return <div className="waybill-layer-canvas" ref={canvasRef} onPointerMove={pointerMove} onPointerUp={()=>{dragRef.current=null}}>
    {visibility.pattern!==false&&<img src={BASE_IMAGE} alt="虚拟运单原始底图"/>}
    {visibility.pattern===false&&<div style={{aspectRatio:'1.77',background:'#fff'}}/>}
    {visibility.fixed!==false&&fixedTexts.map(item=><div key={item.id} onPointerDown={event=>pointerDown(event,item,'fixed')} onClick={()=>onSelectFixed?.(item.id)} className={`waybill-fixed-text ${selectedFixedId===item.id?'selected':''}`} style={{left:`${item.x}%`,top:`${item.y}%`,width:`${item.w}%`,minHeight:`${item.h}%`,fontSize:item.fontSize,color:item.color}}>{item.text}</div>)}
    {visibility.dynamic!==false&&fields.map(field=>{const bound=fields.find(item=>item.key===(field.boundKey||field.key))||field;return <div key={field.key} title={`${field.zh} / 绑定 ${bound.key}`} onPointerDown={event=>pointerDown(event,field)} onClick={()=>onSelect?.(field.key)} className={`waybill-field-box ${selectedKey===field.key?'selected':''} ${trial?'trial':''}`} style={{left:`${field.x}%`,top:`${field.y}%`,width:`${field.w}%`,minHeight:`${field.h}%`,fontSize:`${field.fontSize || 12}px`,color:field.color||'#0958d9'}}>{bound.sample}</div>;})}
    {visibility.privacy!==false&&<div className="waybill-privacy-watermark">仅供合成训练数据使用　仅供合成训练数据使用　仅供合成训练数据使用</div>}
    {visibility.privacy!==false&&fields.filter(field=>['phone','address','code'].includes(field.dataType)).slice(0,10).map(field=><div key={`privacy-${field.key}`} className="waybill-privacy-mask" style={{left:`${field.x}%`,top:`${field.y}%`,width:`${field.w}%`,minHeight:`${field.h}%`}}>模糊处理</div>)}
  </div>;
}

function WaybillEditorWorkspace({ fields, fixedTexts, visibility, setVisibility, fieldTypeFilter, setFieldTypeFilter, selected, selectedFixed, selectedKey, selectedFixedId, selectDynamic, selectFixed, update, updateFixed, move, undo, redo, canUndo, canRedo, restore, readOnly }) {
  const layerItems=[['pattern','图案层'],['fixed','固定文字层'],['dynamic','动态文字层'],['privacy','隐私保护层']];
  const listItems=fieldTypeFilter==='fixed'?fixedTexts:fields;
  const isFixed=Boolean(selectedFixedId);
  return <Row gutter={16} className="section-title waybill-editor-workspace">
    <Col span={5}>
      <Card size="small" title="图层"><Space direction="vertical" style={{width:'100%'}}>{layerItems.map(([key,label])=><Flex key={key} justify="space-between" align="center"><Text>{label}</Text><Button className={`waybill-layer-toggle ${visibility[key]?'active':''}`} type={visibility[key]?'primary':'default'} ghost={visibility[key]} icon={visibility[key]?<EyeOutlined/>:<EyeInvisibleOutlined/>} onClick={()=>setVisibility(current=>({...current,[key]:!current[key]}))}>{visibility[key]?'显示':'隐藏'}</Button></Flex>)}</Space></Card>
      <Card size="small" className="section-title" title="字段列表">
        <Tabs size="small" activeKey={fieldTypeFilter} onChange={setFieldTypeFilter} items={[{key:'fixed',label:`固定文字（${fixedTexts.length}）`},{key:'dynamic',label:`动态文字（${fields.length}）`}]}/>
        <div className="waybill-field-list">{listItems.map(item=>{const key=fieldTypeFilter==='fixed'?item.id:item.key;const active=fieldTypeFilter==='fixed'?selectedFixedId===key:selectedKey===key;return <button type="button" className={active?'active':''} key={key} onClick={()=>fieldTypeFilter==='fixed'?selectFixed(key):selectDynamic(key)}><Text code>{key}</Text><span>{fieldTypeFilter==='fixed'?item.text:item.zh}</span></button>;})}</div>
      </Card>
    </Col>
    <Col span={13}><Card size="small" title="四图层在线编辑器" extra={!readOnly&&<Space><Button size="small" icon={<UndoOutlined/>} disabled={!canUndo} onClick={undo}>撤销</Button><Button size="small" icon={<RedoOutlined/>} disabled={!canRedo} onClick={redo}>重做</Button><Button size="small" icon={<ReloadOutlined/>} onClick={restore}>恢复系统初稿</Button></Space>}><OverlayCanvas fields={fields} fixedTexts={fixedTexts} visibility={visibility} selectedKey={selectedKey} selectedFixedId={selectedFixedId} onSelect={selectDynamic} onSelectFixed={selectFixed} onMove={move} readOnly={readOnly}/></Card></Col>
    <Col span={6}><Card size="small" title={isFixed?'固定文字属性':'动态字段属性'}>{isFixed?<Form layout="vertical"><Form.Item label="固定文字 ID"><Input value={selectedFixed.id} disabled/></Form.Item><Form.Item label="固定文字"><Input placeholder={"请输入固定文字"} value={selectedFixed.text} disabled={readOnly} onChange={e=>updateFixed('text',e.target.value)}/></Form.Item><Row gutter={8}><Col span={12}><Form.Item label="X 位置"><InputNumber value={selectedFixed.x} disabled style={{width:'100%'}}/></Form.Item></Col><Col span={12}><Form.Item label="Y 位置"><InputNumber value={selectedFixed.y} disabled style={{width:'100%'}}/></Form.Item></Col></Row><Text type="secondary">坐标只能在画布中拖拽文字框调整。</Text><Form.Item className="section-title" label="字号"><InputNumber placeholder={"请输入字号（6～48）"} min={6} max={48} value={selectedFixed.fontSize} disabled={readOnly} onChange={v=>updateFixed('fontSize',v)} style={{width:'100%'}}/></Form.Item><Form.Item label="文字颜色"><Input placeholder={"请输入文字颜色"} type="color" value={selectedFixed.color} disabled={readOnly} onChange={e=>updateFixed('color',e.target.value)}/></Form.Item></Form>:<Form layout="vertical"><Form.Item label="绑定字段 Key"><Select placeholder={"请选择绑定字段 Key"} showSearch optionFilterProp="label" value={selected.boundKey||selected.key} disabled={readOnly} options={fields.map(item=>({value:item.key,label:`${item.key} · ${item.zh}`}))} onChange={value=>update('boundKey',value)}/></Form.Item><Descriptions size="small" column={1} items={[{key:'box',label:'文字框 Key',children:<Text code>{selected.key}</Text>},{key:'region',label:'区域',children:selected.region}]}/><Divider/><Form.Item label="示例 Value"><Input placeholder={"请输入示例 Value"} value={selected.sample} disabled={readOnly} onChange={e=>update('sample',e.target.value)}/></Form.Item><Form.Item label="字符大小"><InputNumber placeholder={"请输入字符大小（8～36）"} min={8} max={36} value={selected.fontSize||12} disabled={readOnly} onChange={v=>update('fontSize',v)} style={{width:'100%'}}/></Form.Item><Form.Item label="文字颜色"><Input placeholder={"请输入文字颜色"} type="color" value={selected.color||'#0958d9'} disabled={readOnly} onChange={e=>update('color',e.target.value)}/></Form.Item><Form.Item label="数据类型"><Select placeholder={"请选择数据类型"} value={selected.dataType} disabled={readOnly} onChange={v=>update('dataType',v)} options={['text','code','phone','date','number','address','company_name'].map(value=>({value,label:value}))}/></Form.Item><Form.Item label="生成方式"><Select placeholder={"请选择生成方式"} value={selected.generation} disabled={readOnly} onChange={v=>update('generation',v)} options={[{value:'dictionary_rule',label:'字典+规则'},{value:'computed',label:'计算值'},{value:'llm_prompt',label:'模型+Prompt'}]}/></Form.Item><Form.Item label="语义与生成约束"><Input.TextArea placeholder={"请输入语义与生成约束"} rows={3} value={selected.rule} disabled={readOnly} onChange={e=>update('rule',e.target.value)}/></Form.Item></Form>}</Card></Col>
  </Row>;
}

function WaybillTrialPanel({ trialConfig, setTrialConfig, runTrial, trialRunning, trialRan, trialReport, fields, fixedTexts, qualityRules }) {
  const reportRows=[...BASE_QUALITY_RULES.map(([id,name])=>({id,name,type:id.startsWith('VLM-')?'VLM 质检':'基础规则',result:id.startsWith('VLM-')?'0.89':'通过'})),...qualityRules.filter(item=>item.enabled!==false).map(item=>({id:item.ruleId,name:item.name,type:item.mode==='vlm'?'VLM 质检':item.mode==='semantic'?'语义质检':'规则质检',result:['semantic','vlm'].includes(item.mode)?'0.91':'通过'}))];
  const semanticRuleCount=qualityRules.filter(item=>item.enabled!==false&&item.mode==='semantic').length;
  const vlmRuleCount=BASE_QUALITY_RULES.filter(row=>String(row[3]).includes('VLM')).length+qualityRules.filter(item=>item.enabled!==false&&item.mode==='vlm').length;
  const estimatedCalls=trialConfig.sampleCount*(1+semanticRuleCount+vlmRuleCount);
  return <div className="waybill-trial-panel section-title">
    <DocumentQualityModelSettings config={trialConfig} setConfig={setTrialConfig} semanticCount={semanticRuleCount} vlmCount={vlmRuleCount}/>
    <Card size="small" title="试运行配置" extra={<Button type="primary" icon={<PlayCircleOutlined/>} loading={trialRunning} onClick={runTrial}>开始试运行</Button>}><Row gutter={12}><Col span={12}><Form.Item label="试运行样本数量"><InputNumber placeholder={"请输入试运行样本数量（1～10）"} min={1} max={10} value={trialConfig.sampleCount} onChange={sampleCount=>setTrialConfig(current=>({...current,sampleCount}))} style={{width:'100%'}}/></Form.Item></Col></Row><ControlledModelConfig label="生成模型" options={[{value:'qwen3-vl-8b-instruct',label:'Qwen3-VL-8B-Instruct'}]} value={trialConfig.model} onChange={model=>setTrialConfig(current=>({...current,model}))} enabled={trialConfig.paramsEnabled} onEnabledChange={paramsEnabled=>setTrialConfig(current=>({...current,paramsEnabled}))} parameters={trialConfig.paramsJson} onParametersChange={paramsJson=>setTrialConfig(current=>({...current,paramsJson}))}/><Descriptions className="section-title" bordered size="small" column={3} items={[{key:'generation',label:'样例生成调用',children:`${trialConfig.sampleCount} 次`},{key:'quality',label:'语义质检调用',children:`${trialConfig.sampleCount*semanticRuleCount} 次`},{key:'calls',label:'API 调用次数预估',children:`${estimatedCalls} 次`} ]}/></Card>
    {!trialRan?<Alert type="info" showIcon message="尚未执行试运行" description="模板修改后请重新试运行。"/>:<><Card className="section-title" size="small" title="试运行样例"><Tabs items={[{key:"image",label:"样例图",children:<OverlayCanvas fields={fields} fixedTexts={fixedTexts} visibility={{pattern:true,fixed:true,dynamic:true,privacy:true}} trial/>},{key:"annotation",label:"标注 JSON",children:<Input.TextArea aria-label="运单标注 JSON" readOnly autoSize={{minRows:16,maxRows:28}} value={JSON.stringify({mock:true,fields,fixedTexts},null,2)}/>}]} /></Card><Card className="section-title" size="small" title="逐规则报告"><RuleQualityReport templateTrial report={trialReport}/></Card></>}
  </div>;
}

function WaybillQualityPanel({ qualityRules, patchQuality, setQualityRules }) {
  const toRule=([id,name,target,method,severity,description])=>({id,name,target,method,severity,description,enabled:true});
  const [baseEnabled,setBaseEnabled]=useState(()=>Object.fromEntries(BASE_QUALITY_RULES.map(([id])=>[id,true])));
  const baseRules=BASE_QUALITY_RULES.map(row=>({...toRule(row),enabled:baseEnabled[row[0]]!==false}));
  const privacyRules=PRIVACY_QUALITY_RULES.map(toRule);
  const allBaseChecked=baseRules.every(rule=>rule.enabled);
  const someBaseChecked=baseRules.some(rule=>rule.enabled);
  const setAllBase=enabled=>setBaseEnabled(Object.fromEntries(BASE_QUALITY_RULES.map(([id])=>[id,enabled])));
  const baseColumns=[
    {title:<Checkbox checked={allBaseChecked} indeterminate={someBaseChecked&&!allBaseChecked} onChange={event=>setAllBase(event.target.checked)}/>,width:48,render:(_,rule)=><Checkbox checked={rule.enabled} onChange={event=>setBaseEnabled(current=>({...current,[rule.id]:event.target.checked}))}/>},
    {title:'规则包 / 检测项',dataIndex:'name',width:260,render:(value,rule)=><><Text strong>{value}</Text><br/><Text type="secondary" style={{fontSize:12}}>{rule.id}</Text></>},
    {title:'检查范围',dataIndex:'target',width:260,render:value=><Tag color="blue">{value}</Tag>},
    {title:'检测方法',dataIndex:'method',width:220},
    {title:'处理级别',dataIndex:'severity',width:110,render:value=><Tag color={value==='BLOCK'?'red':'orange'}>{value}</Tag>},
    {title:'说明',dataIndex:'description'},
  ];
  const privacyColumns=baseColumns.map((column,index)=>index===0?{title:<Checkbox checked disabled/>,width:48,render:()=><Checkbox checked disabled/>}:column);
  return <div className="waybill-quality-panel section-title">
    <Collapse defaultActiveKey={['base','privacy','scene']} items={[
      {key:'base',label:<Space><Text strong>基础质检</Text><Text type="secondary">（{baseRules.filter(rule=>rule.enabled).length}/{baseRules.length}）</Text></Space>,children:<Table rowKey="id" size="small" pagination={false} dataSource={baseRules} columns={baseColumns} scroll={{x:1250,y:520}}/>},
      {key:'privacy',label:<Space><Text strong>隐私质检</Text><Text type="secondary">（{privacyRules.length}/{privacyRules.length}）</Text></Space>,children:<><Alert type="warning" showIcon message="运单隐私规则固定启用" description="覆盖寄收件人姓名、电话、详细地址、单位、证件号、签名、运单号及机器码；最终样张会执行隐私残留复检。"/><Table className="section-title" rowKey="id" size="small" pagination={false} dataSource={privacyRules} columns={privacyColumns} scroll={{x:1250}}/></>},
      {key:'scene',label:<Space><Text strong>场景质检</Text><Text type="secondary">（{qualityRules.filter(r=>r.enabled!==false).length}/{qualityRules.length}）</Text></Space>,children:<><div className="template-section-heading"><strong>场景规则</strong><Button type="primary" icon={<PlusOutlined/>} onClick={()=>setQualityRules(current=>[...current,{ruleId:`SCENE-${Date.now().toString(36).toUpperCase()}`,name:'自定义场景规则',target:'两者',mode:'semantic',threshold:0.8,prompt:'',positiveExample:'',negativeExample:'',handling:'REVIEW',enabled:true}])}>添加自定义质检规则</Button></div><Alert type="info" showIcon message="按国内运单业务场景配置判断规则" description="场景规则覆盖寄收件关系、内件与重量体积、付款费用、寄件与签收时间、机器码与运单号等跨字段关系。"/>{qualityRules.map((rule,index)=><Card key={rule.ruleId} size="small" className="section-title conversation-quality-rule" title={<Space><Checkbox checked={rule.enabled!==false} onChange={event=>patchQuality(index,{enabled:event.target.checked})}/><Text strong>{rule.name||'新质检规则'}</Text></Space>} extra={<Button type="text" danger icon={<DeleteOutlined/>} onClick={()=>setQualityRules(current=>current.filter((_,i)=>i!==index))}>删除</Button>}><Row gutter={12}><Col span={8}><Text type="secondary">规则名称</Text><Input placeholder={"请输入规则名称"} value={rule.name} onChange={e=>patchQuality(index,{name:e.target.value})}/></Col><Col span={6}><Text type="secondary">检查对象</Text><Select placeholder={"请选择检查对象"} value={rule.target} onChange={target=>patchQuality(index,{target})} style={{width:'100%'}} options={['版面结构','字段内容','两者'].map(value=>({value,label:value}))}/></Col><Col span={5}><Text type="secondary">检测方法</Text><Select placeholder={"请选择检测方法"} value={rule.mode} onChange={mode=>patchQuality(index,{mode})} style={{width:'100%'}} options={[{value:'semantic',label:'语义模型 / Prompt'},{value:'vlm',label:'VLM / 图像 Prompt'}]}/></Col><Col span={5}><Text type="secondary">处理级别</Text><Select placeholder={"请选择处理级别"} value={rule.handling||'REVIEW'} onChange={handling=>patchQuality(index,{handling})} style={{width:'100%'}} options={['BLOCK','REVIEW'].map(value=>({value,label:value}))}/></Col></Row>{rule.mode==='function'?<><Text type="secondary">Python 判断函数</Text><Input.TextArea placeholder={"请输入Python 判断函数"} className="coldchain-code-textarea" rows={6} value={rule.pythonCode||'def validate(waybill, context):\n    return True'} onChange={e=>patchQuality(index,{pythonCode:e.target.value})}/></>:<><Text type="secondary">判断 Prompt</Text><Input.TextArea placeholder={"请输入判断 Prompt"} rows={4} value={rule.prompt} onChange={e=>patchQuality(index,{prompt:e.target.value})}/><Row gutter={12}><Col span={12}><Text type="secondary">通过示例</Text><Input.TextArea placeholder={"请输入通过示例"} rows={3} value={rule.positiveExample} onChange={e=>patchQuality(index,{positiveExample:e.target.value})}/></Col><Col span={12}><Text type="secondary">不通过示例</Text><Input.TextArea placeholder={"请输入不通过示例"} rows={3} value={rule.negativeExample} onChange={e=>patchQuality(index,{negativeExample:e.target.value})}/></Col></Row></>}</Card>)}</>},
    ]}/>
  </div>;
}

export default function WaybillSeedMockEditor({ fileName, templateName, businessType, description, onBack, onCancel=onBack, readOnly=false }) {
  const [qualityCatalog,setQualityCatalog]=useState(()=>qualityConfig('文档图像'));
  const [step,setStep]=useState(readOnly?1:1); const [fields,setFields]=useState(initialFields); const [selectedKey,setSelectedKey]=useState('waybill_no'); const [saved,setSaved]=useState(false);
  const [fieldTypeFilter,setFieldTypeFilter]=useState('dynamic');const [visibility,setVisibility]=useState({pattern:true,fixed:true,dynamic:true,privacy:true});
  const [fixedTexts,setFixedTexts]=useState(()=>initialFixedTexts(initialFields()));const [selectedFixedId,setSelectedFixedId]=useState(null);
  const [history,setHistory]=useState([]);const [future,setFuture]=useState([]);const [trialRan,setTrialRan]=useState(false);const [trialRunning,setTrialRunning]=useState(false);
  const [qualityRules,setQualityRules]=useState([
    {ruleId:'SCENE-LAYOUT-FIELD',name:'运单版面与字段绑定一致性',target:'两者',mode:'semantic',threshold:0.85,prompt:'判断动态字段是否位于对应固定标签和业务分区内，寄件、收件、内件、费用、签收等区域的阅读顺序是否正确。',positiveExample:'寄件人姓名位于寄件区 FROM 标签后，收件信息位于 TO 区域。',negativeExample:'收件电话错放到寄件区，或字段值覆盖固定标签。',handling:'REVIEW',enabled:true},
    {ruleId:'SCENE-SENDER-RECEIVER',name:'寄收件信息语义一致性',target:'字段内容',mode:'semantic',threshold:0.85,prompt:'判断寄件人与收件人的姓名、单位、省市区、详细地址和联系方式是否分别构成完整且互不冲突的两组信息。',positiveExample:'寄件地址的省市区与始发地一致，收件地址与目的城市一致。',negativeExample:'收件地址属于上海但城市字段填写广州。',handling:'BLOCK',enabled:true},
    {ruleId:'SCENE-CONTENT-WEIGHT',name:'内件与重量体积合理性',target:'字段内容',mode:'semantic',threshold:0.82,prompt:'判断文件/物品类型、内件品名、数量、重量、体积和长宽高之间是否符合国内运单业务常识。',positiveExample:'包装材料 2 件，重量 3.5kg，体积和长宽高计算接近。',negativeExample:'勾选文件但填写大型设备，或体积与长宽高明显矛盾。',handling:'REVIEW',enabled:true},
    {ruleId:'SCENE-PAYMENT-AMOUNT',name:'付款方式与费用关系',target:'字段内容',mode:'semantic',prompt:'判断付款方式、运费及总费用之间是否符合国内运单业务语义与金额关系。',handling:'BLOCK',enabled:true},
    {ruleId:'SCENE-DATETIME',name:'寄件与签收时间顺序',target:'字段内容',mode:'semantic',prompt:'判断寄件时间、运输时间与签收时间的先后关系是否合理。',handling:'BLOCK',enabled:true},
    {ruleId:'SCENE-CODE-BINDING',name:'机器码与运单号一致性',target:'两者',mode:'vlm',prompt:'检查条形码、二维码下方文字与运单号字段是否对应一致。',handling:'BLOCK',enabled:true},
    {ruleId:'SCENE-SIGNATURE',name:'签收与代收信息合理性',target:'字段内容',mode:'semantic',threshold:0.82,prompt:'判断收件人签名、代收人签名、证件号及签收日期的组合是否完整、自然且符合签收场景。',positiveExample:'本人签收时有收件人签名和日期，代收字段为空。',negativeExample:'填写代收人签名但缺少必要身份信息和签收日期。',handling:'REVIEW',enabled:true},
    {ruleId:'SCENE-OCR-RECOVERABILITY',name:'运单关键字段 OCR 可识别性',target:'两者',mode:'vlm',prompt:'检查寄件人、收件人、运单号、货物及费用等关键字段是否清晰完整、具备可识别性。',handling:'BLOCK',enabled:true},
    {ruleId:'SCENE-OVERALL-VISUAL',name:'国内运单整体版式自然度',target:'两者',mode:'semantic',threshold:0.82,prompt:'综合判断橙色表格线、固定中英文标签、动态字段、码区、签收区的留白、对齐、层级和组合是否符合国内运单视觉习惯。',positiveExample:'各字段位于对应框内，层级清楚，码区和正文互不遮挡。',negativeExample:'文字重叠、码区遮挡联系方式或费用字段、区域留白异常。',handling:'REVIEW',enabled:true},
  ]);
  const [trialConfig,setTrialConfig]=useState({model:'qwen3-vl-8b-instruct',paramsEnabled:false,paramsJson:'{\n  "temperature": 0.2\n}',sampleCount:1});
  const selected=useMemo(()=>fields.find(item=>item.key===selectedKey)||fields[0],[fields,selectedKey]);
  const selectedFixed=useMemo(()=>fixedTexts.find(item=>item.id===selectedFixedId)||fixedTexts[0],[fixedTexts,selectedFixedId]);
  const snapshot=()=>({fields,fixedTexts,visibility});
  const commit=change=>{setHistory(current=>[...current,snapshot()]);setFuture([]);change();};
  const update=(key,value)=>commit(()=>setFields(current=>current.map(item=>item.key===selectedKey?{...item,[key]:value}:item)));
  const updateFixed=(key,value)=>commit(()=>setFixedTexts(current=>current.map(item=>item.id===selectedFixed.id?{...item,[key]:value}:item)));
  const move=(key,x,y,kind='dynamic')=>commit(()=>kind==='fixed'?setFixedTexts(current=>current.map(item=>item.id===key?{...item,x,y}:item)):setFields(current=>current.map(item=>item.key===key?{...item,x,y}:item)));
  const changeVisibility=updater=>commit(()=>setVisibility(updater));
  const applySnapshot=value=>{setFields(value.fields);setFixedTexts(value.fixedTexts);setVisibility(value.visibility);};
  const undo=()=>setHistory(current=>{if(!current.length)return current;const previous=current[current.length-1];setFuture(items=>[snapshot(),...items]);applySnapshot(previous);return current.slice(0,-1);});
  const redo=()=>setFuture(current=>{if(!current.length)return current;const nextState=current[0];setHistory(items=>[...items,snapshot()]);applySnapshot(nextState);return current.slice(1);});
  const restore=()=>{commit(()=>{const nextFields=initialFields();setFields(nextFields);setFixedTexts(initialFixedTexts(nextFields));setVisibility({pattern:true,fixed:true,dynamic:true,privacy:true});setSelectedKey('waybill_no');setSelectedFixedId(null);});message.success('已恢复系统初稿');};
  const [baseEnabled,setBaseEnabled]=useState(()=>Object.fromEntries(BASE_QUALITY_RULES.map(([id])=>[id,true])));
  const [trialReport,setTrialReport]=useState(null);
  useEffect(()=>{setTrialRan(false);setTrialReport(null);},[qualityCatalog,baseEnabled,qualityRules,fields,fixedTexts,trialConfig]);
  const runTrial=()=>{const normalize=(rows,category)=>rows.map(([id,name,target,method,severity,description])=>({id,name,target,method,severity,description,category,enabled:category==='基础质检'?baseEnabled[id]!==false:true}));const report=trialQualityReport(activeRules('文档图像',qualityCatalog),{labels:templateLabelSnapshot({quality_catalog:qualityCatalog},'文档图像'),sampleCount:trialConfig.sampleCount,templateId:templateName||'当前运单模板'});setTrialRunning(true);setTrialRan(false);window.setTimeout(()=>{setTrialRunning(false);setTrialRan(true);setTrialReport(report);message.success('试运行执行结束，请查看逐规则报告');},500);};
  const save=()=>{setSaved(true);message.success('运单模板 Mock 已发布');};
  const goBack=()=>step===1?onBack():setStep(value=>Math.max(1,value-1));
  const next=()=>setStep(value=>Math.min(3,value+1));
  const layerItems=[['pattern','图案层'],['fixed','固定文字层'],['dynamic','动态文字层'],['privacy','隐私保护层']];
  const patchQuality=(index,patch)=>setQualityRules(current=>current.map((item,i)=>i===index?{...item,...patch}:item));
  return <div className="template-create-page document-template-create-page" data-ued-readonly={readOnly || undefined}>
    <Flex className="page-header" justify="space-between" align="flex-start"><Space align="start"><Button type="text" icon={<LeftOutlined/>} aria-label="返回模板中心" onClick={onBack}/><div><Title level={2}>{readOnly?'文档类图像模板详情':templateName||'新建文档类图像模板'}</Title><Paragraph type="secondary">{businessType||'底图生成法'} · {description||'字段解析与在线编辑'} · {fileName}</Paragraph></div></Space></Flex>
    <Flex justify="space-between" align="center" className="conversation-template-statusbar template-editor-step-actions-top">{!readOnly&&<Button onClick={onCancel}>取消</Button>}<Button icon={<ArrowLeftOutlined/>} disabled={readOnly&&step===1} onClick={goBack}>上一步</Button>{step<3?<Button type="primary" icon={<ArrowRightOutlined/>} onClick={next}>下一步</Button>:readOnly?<Button disabled>已到最后一步</Button>:<Button type="primary" icon={<CheckCircleOutlined/>} disabled={saved} onClick={save}>{saved?'已发布':'发布模板'}</Button>}</Flex>
    <Card className="main-card"><Steps current={step} items={WORKFLOW_STEPS} onChange={value=>(readOnly||value<=step)&&setStep(Math.max(1,value))}/>
      {step===2&&<UnifiedQualityEditor modality="文档图像" value={qualityCatalog} readOnly={readOnly} onChange={setQualityCatalog}/>} 
      {step===3&&<WaybillTrialPanel trialConfig={trialConfig} setTrialConfig={setTrialConfig} runTrial={runTrial} trialRunning={trialRunning} trialRan={trialRan} trialReport={trialReport} fields={fields} fixedTexts={fixedTexts} qualityRules={qualityRules}/>} 
      {step===1&&<WaybillEditorWorkspace fields={fields} fixedTexts={fixedTexts} visibility={visibility} setVisibility={changeVisibility} fieldTypeFilter={fieldTypeFilter} setFieldTypeFilter={setFieldTypeFilter} selected={selected} selectedFixed={selectedFixed} selectedKey={selectedKey} selectedFixedId={selectedFixedId} selectDynamic={key=>{setSelectedKey(key);setSelectedFixedId(null);setFieldTypeFilter('dynamic')}} selectFixed={id=>{setSelectedFixedId(id);setFieldTypeFilter('fixed')}} update={update} updateFixed={updateFixed} move={move} undo={undo} redo={redo} canUndo={history.length>0} canRedo={future.length>0} restore={restore} readOnly={readOnly}/>} 
      {false&&<>
      {step===1&&<Row gutter={16} className="section-title"><Col span={5}><Card size="small" title="图层"><Space direction="vertical" style={{width:'100%'}}>{layerItems.map(([key,label])=><Flex key={key} justify="space-between" align="center"><Text>{label}</Text><Button type="text" icon={visibility[key]?<EyeOutlined/>:<EyeInvisibleOutlined/>} onClick={()=>setVisibility(current=>({...current,[key]:!current[key]}))}>{visibility[key]?'显示':'隐藏'}</Button></Flex>)}</Space><Button className="section-title" block onClick={()=>setFieldDrawer(true)}>查看解析字段 Key（{fields.length}）</Button></Card><Card size="small" className="section-title" title="固定文字属性"><Form layout="vertical"><Form.Item label="固定文字"><Input placeholder={"请输入固定文字"} value={selectedFixed.text} onChange={e=>updateFixed('text',e.target.value)}/></Form.Item><Row gutter={8}><Col span={12}><Form.Item label="X 位置"><InputNumber placeholder={"请输入X 位置（0～100）"} min={0} max={100} value={selectedFixed.x} onChange={v=>updateFixed('x',v)} style={{width:'100%'}}/></Form.Item></Col><Col span={12}><Form.Item label="Y 位置"><InputNumber placeholder={"请输入Y 位置（0～100）"} min={0} max={100} value={selectedFixed.y} onChange={v=>updateFixed('y',v)} style={{width:'100%'}}/></Form.Item></Col></Row><Form.Item label="字号"><InputNumber placeholder={"请输入字号（6～48）"} min={6} max={48} value={selectedFixed.fontSize} onChange={v=>updateFixed('fontSize',v)} style={{width:'100%'}}/></Form.Item><Form.Item label="文字颜色"><Input placeholder={"请输入文字颜色"} type="color" value={selectedFixed.color} onChange={e=>updateFixed('color',e.target.value)}/></Form.Item></Form></Card></Col><Col span={13}><Card size="small" title="四图层在线编辑器"><OverlayCanvas fields={fields} fixedTexts={fixedTexts} visibility={visibility} selectedKey={selectedKey} selectedFixedId={selectedFixedId} onSelect={key=>{setSelectedKey(key);setSelectedFixedId(null)}} onSelectFixed={id=>setSelectedFixedId(id)} onMove={move} readOnly={readOnly}/></Card></Col><Col span={6}><Card size="small" title="动态字段属性"><Form layout="vertical"><Form.Item label="绑定字段 Key"><Select placeholder={"请选择绑定字段 Key"} showSearch optionFilterProp="label" value={selected.boundKey||selected.key} options={fields.map(item=>({value:item.key,label:`${item.key} · ${item.zh}`}))} onChange={value=>update('boundKey',value)}/></Form.Item><Descriptions size="small" column={1} items={[{key:'box',label:'文字框 Key',children:<Text code>{selected.key}</Text>},{key:'region',label:'区域',children:selected.region}]}/><Divider/><Form.Item label="示例 Value"><Input placeholder={"请输入示例 Value"} value={selected.sample} onChange={e=>update('sample',e.target.value)}/></Form.Item><Form.Item label="字符大小"><InputNumber placeholder={"请输入字符大小（8～36）"} min={8} max={36} value={selected.fontSize||12} onChange={v=>update('fontSize',v)} style={{width:'100%'}}/></Form.Item><Form.Item label="文字颜色"><Input placeholder={"请输入文字颜色"} type="color" value={selected.color||'#0958d9'} onChange={e=>update('color',e.target.value)}/></Form.Item><Form.Item label="数据类型"><Select placeholder={"请选择数据类型"} value={selected.dataType} onChange={v=>update('dataType',v)} options={['text','code','phone','date','number','address','company_name'].map(value=>({value,label:value}))}/></Form.Item><Form.Item label="生成方式"><Select placeholder={"请选择生成方式"} value={selected.generation} onChange={v=>update('generation',v)} options={[{value:'dictionary_rule',label:'字典+规则'},{value:'computed',label:'计算值'},{value:'llm_prompt',label:'模型+Prompt'}]}/></Form.Item><Form.Item label="语义与生成约束"><Input.TextArea placeholder={"请输入语义与生成约束"} rows={3} value={selected.rule} onChange={e=>update('rule',e.target.value)}/></Form.Item></Form></Card></Col></Row>}
      {step===2&&<><Divider orientation="left">基础规则</Divider><Row gutter={[12,12]}>{BASE_QUALITY_RULES.map(([id,name,desc])=><Col span={8} key={id}><Card size="small" className={`conversation-fixed-rule ${id==='BASE-PRIVACY'?'conversation-fixed-rule-privacy':'conversation-fixed-rule-other'}`}><Text strong>{name}</Text><Paragraph type="secondary">{desc}</Paragraph><Tag>{id}</Tag></Card></Col>)}</Row><Divider orientation="left">场景规则</Divider><div className="template-section-heading"><strong>场景规则</strong><Button type="primary" icon={<PlusOutlined/>} onClick={()=>setQualityRules(current=>[...current,{ruleId:`SCENE-${Date.now().toString(36).toUpperCase()}`,name:'自定义场景规则',target:'两者',mode:'semantic',threshold:0.8,prompt:'',positiveExample:'',negativeExample:'',enabled:true}])}>添加自定义质检规则</Button></div>{qualityRules.map((rule,index)=><Card key={rule.ruleId} className="section-title conversation-quality-rule" size="small" extra={<Switch checked={rule.enabled} onChange={enabled=>patchQuality(index,{enabled})}/>}><Row gutter={12}><Col span={7}><Form.Item label="规则名称"><Input placeholder={"请输入规则名称"} value={rule.name} onChange={e=>patchQuality(index,{name:e.target.value})}/></Form.Item></Col><Col span={6}><Form.Item label="规则 ID"><Input value={rule.ruleId} disabled/></Form.Item></Col><Col span={5}><Form.Item label="检查对象"><Select placeholder={"请选择检查对象"} value={rule.target} onChange={target=>patchQuality(index,{target})} options={['版面结构','字段内容','两者'].map(value=>({value,label:value}))}/></Form.Item></Col><Col span={6}><Form.Item label="检查方式"><Select placeholder={"请选择检查方式"} value={rule.mode} onChange={mode=>patchQuality(index,{mode})} options={[{value:'function',label:'函数判断'},{value:'semantic',label:'语义判断'}]}/></Form.Item></Col></Row>{rule.mode==='semantic'?<><Form.Item label="语义阈值"><InputNumber placeholder={"请输入语义阈值（0～1）"} min={0} max={1} step={0.01} value={rule.threshold} onChange={threshold=>patchQuality(index,{threshold})}/></Form.Item><Form.Item label="语义判断 Prompt"><Input.TextArea placeholder={"描述语义判断 Prompt，说明目标、约束和输出要求"} rows={4} value={rule.prompt} onChange={e=>patchQuality(index,{prompt:e.target.value})}/></Form.Item><Row gutter={12}><Col span={12}><Form.Item label="通过示例（可选）"><Input.TextArea placeholder={"请输入通过示例（可选）"} rows={2} value={rule.positiveExample} onChange={e=>patchQuality(index,{positiveExample:e.target.value})}/></Form.Item></Col><Col span={12}><Form.Item label="不通过示例（可选）"><Input.TextArea placeholder={"请输入不通过示例（可选）"} rows={2} value={rule.negativeExample} onChange={e=>patchQuality(index,{negativeExample:e.target.value})}/></Form.Item></Col></Row></>:<Form.Item label="Python 判断函数"><Input.TextArea placeholder={"填写判断函数，返回 true 或 false"} className="coldchain-code-textarea" rows={6} value={rule.pythonCode||'def validate(data, context):\n    return True'} onChange={e=>patchQuality(index,{pythonCode:e.target.value})}/></Form.Item>}</Card>)}</>}
      {step===3&&<><Card size="small" title="试运行配置"><Row gutter={12}><Col span={12}><Form.Item label="试运行样本数量"><InputNumber placeholder={"请输入试运行样本数量（1～10）"} min={1} max={10} value={trialConfig.sampleCount} onChange={sampleCount=>setTrialConfig(current=>({...current,sampleCount}))} style={{width:'100%'}}/></Form.Item></Col></Row><ControlledModelConfig label="生成模型" options={[{value:'qwen3-vl-8b-instruct',label:'Qwen3-VL-8B-Instruct'}]} value={trialConfig.model} onChange={model=>setTrialConfig(current=>({...current,model}))} enabled={trialConfig.paramsEnabled} onEnabledChange={paramsEnabled=>setTrialConfig(current=>({...current,paramsEnabled}))} parameters={trialConfig.paramsJson} onParametersChange={paramsJson=>setTrialConfig(current=>({...current,paramsJson}))}/><Descriptions className="section-title" bordered size="small" items={[{key:'calls',label:'API 调用次数预估',children:`${trialConfig.sampleCount} 次`}]}/></Card><Row gutter={16} className="section-title"><Col span={18}><Card size="small" title="Mock试运行成品"><OverlayCanvas fields={fields} fixedTexts={fixedTexts} visibility={{pattern:true,fixed:true,dynamic:true,privacy:false}} trial/></Card></Col><Col span={6}><Card size="small" title="Mock质检结果"><Space direction="vertical"><Tag color="green">PASS</Tag><Text>字段覆盖：45 / 45</Text><Text>字段Key唯一：通过</Text><Text>文本框越界：0</Text><Text>隐私检查：通过</Text></Space></Card></Col>{saved&&<Col span={24}><Alert type="success" showIcon message="运单模板已发布" description="版式、四类图层、字段绑定和质检规则已纳入模板定义。"/></Col>}</Row></>}
      </>}
    </Card>
  </div>;
}
