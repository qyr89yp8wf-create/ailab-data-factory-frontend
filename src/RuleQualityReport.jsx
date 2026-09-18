import {regularQualityReport,PRIVACY_SCOPE_NOTICE} from './qualityScope';
import CoveragePanel from './CoveragePanel';
import React,{useMemo,useState} from 'react';
import {InfoCircleOutlined} from '@ant-design/icons';
import {message,Collapse,Checkbox,Alert,Button,Card,Col,Descriptions,Drawer,Empty,Flex,Input,Row,Select,Space,Statistic,Table,Tag,Tooltip,Typography} from 'antd';
import {versionSample,qualityExecutionMetadata} from './taskExecution';
import {BadcasePanel} from './BadcasePanel';
import {reportSamplePage} from './qualityReportSamples';
import {QUALITY_STATUS,QUALITY_COLORS,criteriaFor,overallReportMetrics,rateText,reportRuleRows,templatePrivacyCheck} from './qualityResults';
const {Text,Title}=Typography;
const UNDETERMINED_TIP='该规则已尝试检查，但因必要输入缺失、执行异常或证据不足，无法可靠判断通过或不通过。此类样本单独统计，不计入规则通过率；它不同于不适用、未抽中或未执行。';
const COVERAGE_TIP='有效判定覆盖率＝所有规则的“通过＋不通过”结果数 ÷ 所有规则的“通过＋不通过＋无法判定”结果数。未执行、未抽中和不适用不进入分母；没有适用的检查对象时显示“—”。';
export function saveQualityJson(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);try{a.click();message.success('已开始下载质检报告');}catch(error){message.error('报告下载失败，请重试');throw error;}finally{a.remove();}setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function SampleRuleResults({results=[]}){
  return <Table rowKey="id" size="small" pagination={{pageSize:10,showSizeChanger:false,hideOnSinglePage:true}} scroll={{x:650}} dataSource={results} columns={[
    {title:'规则',render:(_,r)=><>{r.name}<div className="muted-id">{r.id}</div></>},
    {title:'结果',dataIndex:'status',width:110,render:s=><Tag color={QUALITY_COLORS[s]}>{QUALITY_STATUS[s]||s}</Tag>},
    {title:'计分',dataIndex:'score',width:60,render:s=>s??'—'},
    {title:'定位与原因',render:(_,r)=><>{r.location||'—'}<div><Text type="secondary">{r.reason||'未记录原因'}</Text></div></>},
  ]}/>;
}
export function QualityReportDownloadButton({report}){
  const overall=overallReportMetrics(report);
  return <Button onClick={()=>{const {sampleExecution,...data}=report||{};saveQualityJson({...data,overallMetrics:overall},`${report?.reportId||'trial'}-report.json`);}}>下载报告 JSON</Button>;
}
export default function RuleQualityReport({report:sourceReport,compact=false,showClassification,showDownload=true,templateTrial=false}){
  const report=useMemo(()=>{if(templateTrial)return sourceReport;const updated=sourceReport?.mock&&sourceReport?.sampleExecution?.execution?{...sourceReport,...qualityExecutionMetadata(sourceReport.sampleExecution)}:sourceReport;return regularQualityReport(updated);},[sourceReport,templateTrial]);
  const [sortOrder,setSortOrder]=useState('default'),[onlyIssues,setOnlyIssues]=useState(false);
  const [category,setCategory]=useState('全部'),[query,setQuery]=useState(''),[selected,setSelected]=useState(null),[status,setStatus]=useState('FAIL'),[page,setPage]=useState(1);
  const rows=useMemo(()=>reportRuleRows(report).slice().sort((a,b)=>{const rank={'基础质检':0,'隐私质检':1,'场景质检':2};return (rank[a.category]??3)-(rank[b.category]??3);}),[report]);
  const overall=useMemo(()=>overallReportMetrics(report),[report]);
  const privacyCheck=useMemo(()=>templatePrivacyCheck(report),[report]);
  const legacy=report?.protocolVersion!==2;
  const mainRows=templateTrial?rows.filter(r=>r.category!=='隐私质检'):rows;
  const privacyRows=rows.filter(r=>r.category==='隐私质检');
  const filtered=mainRows.filter(r=>(category==='全部'||r.category===category)&&(!onlyIssues||r.counts.FAIL>0||r.counts.ERROR>0||r.counts.NOT_RUN>0)&&`${r.id} ${r.name}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>sortOrder==='default'?0:a.passRate==null?(b.passRate==null?0:1):b.passRate==null?-1:sortOrder==='asc'?a.passRate-b.passRate:b.passRate-a.passRate);
  const groups=[...new Set(filtered.map(r=>r.category))];
  const detail=rows.find(r=>r.id===selected);
  const detailRows=useMemo(()=>{
    if(!detail||legacy||!detail.counts[status])return [];
    return reportSamplePage(report,selected,status,page,10);
  },[report,selected,status,page,legacy]);
  if(!report)return <Empty description="尚未发起质量评估任务"/>;
  const open=(r,s)=>{setSelected(r.id);setStatus(s||(r.counts.FAIL?'FAIL':r.counts.ERROR?'ERROR':r.counts.PASS?'PASS':'NOT_RUN'));setPage(1);};
  const countColumn=(s,width=s==='ERROR'?100:72)=>({title:s==='ERROR'?<Space size={4}>{QUALITY_STATUS[s]}<Tooltip title={UNDETERMINED_TIP}><InfoCircleOutlined aria-label="什么是无法判定" tabIndex={0} style={{color:'#8c8c8c',cursor:'help'}}/></Tooltip></Space>:QUALITY_STATUS[s],key:s,width,render:(_,r)=>r.unavailable?'—':!r.counts[s]?<Text type="secondary">0</Text>:<Button type="link" size="small" disabled={!r.counts[s]} onClick={()=>open(r,s)} aria-label={`${r.name} ${QUALITY_STATUS[s]} ${r.counts[s]} 条`}>{r.counts[s].toLocaleString()}</Button>});
  const renderRuleTable=(groupRows,group)=><Table rowKey="id" size="small" dataSource={groupRows} scroll={{x:900}} pagination={{pageSize:10,showSizeChanger:false,hideOnSinglePage:true,showTotal:n=>`共 ${n} 项`}} columns={[
      {title:'规则 / 模板条件',width:240,render:(_,r)=><><Button type="link" style={{padding:0,height:'auto',whiteSpace:'normal',textAlign:'left'}} disabled={legacy} onClick={()=>open(r)}>{r.name}</Button><div className="muted-id">{r.id} · {r.category}</div><Tooltip title={criteriaFor(r)||r.content}><Text type="secondary" style={{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{String(r.description||criteriaFor(r)||r.content||'按模板规则定义判定')}</Text></Tooltip></>},
      {title:'规则通过率',width:90,render:(_,r)=><Text strong>{rateText(r.passRate)}</Text>},
      ...(group==='隐私质检'?[{title:'命中次数',width:90,render:(_,r)=>r.hitCount??'未记录'}]:[]),
      ...Object.keys(QUALITY_STATUS).map(s=>group==='隐私质检'&&s==='FAIL'?{...countColumn(s),title:'涉及样本数'}:countColumn(s)),
    ]} locale={{emptyText:legacy?'未保存规则快照，请重新发起质检':'没有符合条件的规则'}}/>;
  return <div className="rule-quality-report">
    {!templateTrial&&<Text type="secondary" style={{display:'block',marginBottom:12}}>{PRIVACY_SCOPE_NOTICE}</Text>}
    {showDownload&&<Flex justify="space-between" align="center" style={{marginBottom:16}}><Title level={5} style={{margin:0}}>逐规则质检报告</Title><QualityReportDownloadButton report={report}/></Flex>}

    {templateTrial&&<>
      <Card size="small" styles={{body:{padding:'12px 16px'}}}>
        <Flex align="center" wrap gap={12}>
          <Text strong>模板隐私检查</Text>
          <Tag color={privacyCheck.passed?'success':'error'} style={{margin:0}}>{privacyCheck.passed?'通过':'不通过'}</Tag>
          <Text type="secondary">{privacyCheck.passed?'未发现隐私规则命中，可继续发布模板。':'请修改命中字段后重新试运行。'}</Text>
        </Flex>
        {!privacyCheck.passed&&<Flex wrap gap={8} align="baseline" style={{marginTop:8}}>
          <Text type="secondary">命中字段：</Text>
          {privacyCheck.failedFields.map(field=><Tag key={field} style={{whiteSpace:'normal',overflowWrap:'anywhere',margin:0}}>{field}</Tag>)}
        </Flex>}
      </Card>
      <Collapse size="small" style={{marginTop:8}} defaultActiveKey={[]} items={[{
        key:'template-privacy',label:`隐私质检 · ${privacyRows.length} 条规则`,
        children:renderRuleTable(privacyRows,'隐私质检'),
      }]}/>
    </>}

    <Card size="small" title="整体质检结果" style={{marginTop:16}}>
      <Row gutter={[16,12]}>
        <Col xs={24} sm={12}><Statistic title="整体分数" value={overall.overallScore==null?'—':(overall.overallScore*100).toFixed(1)} suffix={overall.overallScore==null?null:'分'}/></Col>
        <Col xs={24} sm={12}><Statistic title={<Space size={4}>有效判定覆盖率<Tooltip title={COVERAGE_TIP}><InfoCircleOutlined aria-label="有效判定覆盖率计算口径" tabIndex={0} style={{color:'#8c8c8c',cursor:'help'}}/></Tooltip></Space>} value={rateText(overall.judgmentCoverage)}/></Col>

      </Row>
      <Tooltip title={<span>整体分数为有有效判定的 {overall.scoredRuleCount} 条规则通过率的等权平均；整条规则均不适用时不计分，其余规则缺少有效判定时暂不计算整体分数。有效判定覆盖率＝（通过＋不通过）÷（通过＋不通过＋无法判定）。仅同一模板与规则版本的分数适合直接比较。</span>}><Button type="text" size="small" className="metric-help" icon={<InfoCircleOutlined/>}>计算口径与使用范围</Button></Tooltip>
      {overall.unscoredRuleCount>0&&<Alert type="warning" showIcon style={{marginTop:12}} message={`${overall.unscoredRuleCount} 条规则没有有效判定，整体分数暂不可计算`} description="请查看无法判定或未执行明细；不能把缺少结果的规则从平均分中悄悄排除。"/>}
    </Card>
    <Descriptions bordered size="small" column={compact?1:3} style={{marginTop:16,marginBottom:16}} items={[
      {key:'report',label:'报告 / 任务',children:report.reportId||report.taskId||'模板试运行'},
      {key:'template',label:'冻结模板',children:`${report.templateId||'未记录'} / ${report.templateVersion||'未记录'}`},
      {key:'execution',label:'执行状态',children:report.executionStatus==='部分完成'?'已完成':report.executionStatus||'历史记录'},
      {key:'scope',label:'检查范围',children:report.executionRange==='sample'?'抽样结果（不代表全量）':'全量'},
      {key:'samples',label:'样本数 / 已处理（含异常）',children:`${report.sampleCount??'—'} / ${report.checkedSampleCount??'—'}`},
      ...(report.sampleExecution?.executionSummary?[{key:'completed',label:'成功完成',children:report.sampleExecution.executionSummary.succeededSampleCount},{key:'execution-errors',label:'执行异常（Badcase）',children:report.sampleExecution.executionSummary.badcaseSampleCount}]:[]),
      {key:'rules',label:'质检规则数',children:rows.length},
    ]}/>
    <Space wrap style={{marginBottom:12}}><Select placeholder="请选择报告规则分类" aria-label="报告规则分类" value={category} onChange={setCategory} style={{width:140}} options={['全部',...new Set(mainRows.map(r=>r.category))].map(value=>({value,label:value}))}/><Input aria-label="搜索报告规则" placeholder="搜索规则名称 / ID" allowClear value={query} onChange={e=>setQuery(e.target.value)} style={{width:240}}/><Select placeholder="请选择通过率排序" aria-label="通过率排序" value={sortOrder} onChange={setSortOrder} style={{width:160}} options={[{value:'default',label:'默认排序'},{value:'asc',label:'通过率从低到高'},{value:'desc',label:'通过率从高到低'}]}/><Checkbox checked={onlyIssues} onChange={e=>setOnlyIssues(e.target.checked)}>仅看异常规则</Checkbox></Space>
    {groups.length?<Collapse className="quality-type-sections" defaultActiveKey={[...new Set(rows.map(r=>r.category))]} items={groups.map(group=>({key:group,label:`${group} · ${filtered.filter(r=>r.category===group).length} 条规则`,children:renderRuleTable(filtered.filter(r=>r.category===group),group)}))}/>:<Empty description="没有符合条件的规则"/>}
    {showClassification!==false&&<CoveragePanel report={report}/>}
    {!templateTrial&&<Card title="执行异常（Badcase）" style={{marginTop:24}}>{report.sampleExecution?.execution?<BadcasePanel key={report.reportId||report.taskId} task={report.sampleExecution}/>:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本报告未保存执行异常明细"/>}</Card>}
    <Drawer title={`${detail?.name||''} · 样本明细`} size="min(960px, 96vw)" open={!!detail} onClose={()=>setSelected(null)} destroyOnHidden>
      {detail&&<><Alert type="info" showIcon message="多对象判定：任一对象不通过则记 0；全部适用对象通过才记 1" description="没有明确失败但存在无法判定的对象，不记分。隐私证据只展示类型与位置，不输出敏感原文。"/><Space style={{margin:'16px 0'}}><Select placeholder="请选择筛选规则结果" aria-label="筛选规则结果" style={{width:190}} value={status} onChange={s=>{setStatus(s);setPage(1);}} options={Object.entries(QUALITY_STATUS).map(([value,label])=>({value,label:`${label}（${detail.counts[value]}）`}))}/><Text type="secondary">{criteriaFor(detail)||detail.content||detail.description}</Text></Space>
      <Table rowKey="sampleId" size="small" scroll={{x:640}} dataSource={detailRows} pagination={{current:page,pageSize:10,total:detail.counts[status],showSizeChanger:false,hideOnSinglePage:true,onChange:setPage}} expandable={{expandedRowRender:r=><>{r.rule.evidence&&!r.rule.evidence.includes('原型模拟结果，非真实检测证据')&&<Text type="secondary">{r.rule.evidence}</Text>}<SampleRuleResults results={(r.rule.objects||[]).map((o,i)=>({...o,id:`${r.rule.id}-${i}`,name:r.rule.name,score:o.status==='PASS'?1:o.status==='FAIL'?0:null}))}/></>}} columns={[{title:'样本 ID',dataIndex:'sampleId',width:300},{title:'检查位置',render:(_,r)=>r.rule.location||'—'},{title:'原因',render:(_,r)=>r.rule.reason||'未记录'},{title:'计分',width:60,render:(_,r)=>r.rule.score??'—'}]}/></>}
    </Drawer>
  </div>;
}
