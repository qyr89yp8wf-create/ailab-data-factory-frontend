import React,{useState} from 'react';
import {Card,Space,Table,Progress,Typography,Tooltip,Button,Modal,Empty,Row,Col} from 'antd';
import {InfoCircleOutlined} from '@ant-design/icons';
import {versionSample} from './taskExecution.js';
import {coverageSummary} from './coveragePlanning';
export default function CoveragePanel({report}){
 const rows=report.distributions||[],[selected,setSelected]=useState(null),[page,setPage]=useState(1);
 const sources=[...new Set(rows.map(r=>r.source||'custom'))].sort((a,b)=>a===b?0:a==='system'?-1:b==='system'?1:0);
 return <Card title="标签覆盖与分布" style={{marginTop:24}} extra={<Tooltip title="标签覆盖率＝有样本的标签数÷枚举标签总数；占比按当前维度已分类样本计算，分类结果不计质量分。"><InfoCircleOutlined tabIndex={0}/></Tooltip>}>
 {!rows.length?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本报告未记录标签分布"/>:<>
 <Typography.Paragraph type="secondary" className="form-help">{report.executionRange==='sample'?'仅代表本次抽检范围；不外推全量。':'统计本次已检查样本。'} 未抽中：{report.notSelectedSampleCount||0} 条</Typography.Paragraph>
 {sources.map(source=>{
   const sourceRows=rows.filter(r=>(r.source||'custom')===source);
   const dimensions=[...new Map(sourceRows.map(r=>[r.dimensionId||r.dimension,r.dimension])).entries()];
   return <section key={source} style={{marginBottom:16}}>
     <Typography.Title level={5} style={{margin:'0 0 12px'}}>{source==='system'?'系统自动打标':'用户自定义标签'}</Typography.Title>
     <Row gutter={[16,16]}>{dimensions.map(([id,name])=>{
       const filtered=sourceRows.filter(r=>(r.dimensionId||r.dimension)===id),summary=coverageSummary(filtered);
       return <Col key={id} xs={24} xl={12} style={{minWidth:0}}>
         <Card size="small" title={name} extra={<Typography.Text>覆盖率 <Typography.Text strong>{summary.coverage===null?'—':(summary.coverage*100).toFixed(1)+'%'}</Typography.Text></Typography.Text>}>
           <Space wrap size={16} style={{marginBottom:8}}><Typography.Text type="secondary">已覆盖 / 全部标签：{summary.covered} / {summary.total}</Typography.Text><Typography.Text type="secondary">已分类 / 无法分类：{summary.classified} / {summary.unknown}</Typography.Text></Space>
           <Table rowKey={r=>r.key||r.dimension+r.label} size="small" pagination={false} dataSource={filtered} columns={[{title:'标签',dataIndex:'label'},{title:'数量',width:64,render:(_,r)=>r.count?<Button type="link" size="small" onClick={()=>{setSelected(r);setPage(1);}}>{r.count}</Button>:0},{title:'占已分类样本',width:'45%',render:(_,r)=><Progress percent={r.ratio==null?0:Math.round(r.ratio*1000)/10} format={()=>r.ratio==null?'—':(r.ratio*100).toFixed(1)+'%'} strokeColor="var(--color-primary)"/>}]}/>
         </Card>
       </Col>;
     })}</Row>
   </section>;
 })}
 </>}
 <Modal open={!!selected} title={selected?.label+' · 样本'} onCancel={()=>setSelected(null)} footer={null}><Table size="small" rowKey="sampleId" columns={[{title:'样本ID',dataIndex:'sampleId'},{title:'分类标签',dataIndex:'label'}]} dataSource={Array.from({length:Math.min(10,Math.max(0,(selected?.count||0)-(page-1)*10))},(_,i)=>{const index=(selected?.sampleOffset||0)+(page-1)*10+i;return {sampleId:report.sampleExecution?versionSample(report.sampleExecution,index)?.sampleId:report.sampleResults?.[index]?.sampleId||'未记录样本ID',label:selected?.label};})} pagination={{pageSize:10,current:page,total:selected?.count||0,onChange:setPage,showSizeChanger:false}}/></Modal>
 </Card>;
}
