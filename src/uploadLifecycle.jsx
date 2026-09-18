import React,{useState} from 'react';
import {Alert,Button,Card,Collapse,Descriptions,Flex,Modal,Progress,Select,Space,Steps,Table,Tag,Typography,message} from 'antd';
import {uploadStatus,published,resolveUpload,uploadFindingGroups} from './uploadCheckState.js';
export {uploadStatus,published,beginUploadCheck,stopUploadCheck,tickUploadCheck,replaceUploadVersion} from './uploadCheckState.js';
export function uploadEvidenceRows(logs,event){return (logs||[]).filter(row=>row.event===event).map((row,index)=>({key:index,sampleId:row.sample_id,fieldId:row.field_id||'未记录字段 ID',rule:row.rule_id||row.rule_name||'未记录'}));}
export function UploadTaskDetail({version,onChange,onEdit}){
 const [methods,setMethods]=useState({}),[showMask,setShowMask]=useState(false),[runId,setRunId]=useState('');
 const runs=version.uploadRuns||[],latest=runs.at(-1),run=runs.find(r=>r.id===runId)||latest,findings=run?.findings||[],ids=new Set(findings.map(f=>f.sampleId));
 const actionable=run===latest&&['待处理','校验失败'].includes(uploadStatus(version)),safety=findings.some(f=>['安全质检','数据基本结构'].includes(f.category)),blocked=findings.some(f=>f.category==='文件检查'||f.status==='ERROR');
 const deleteIds=new Set(findings.filter(f=>['安全质检','数据基本结构'].includes(f.category)).map(f=>f.sampleId));
 const privacyFindings=findings.filter(f=>f.category==='隐私质检'&&!deleteIds.has(f.sampleId));
 const act=action=>{try{const v=resolveUpload(version,action,methods);onChange?.(v);setShowMask(false);setRunId('');if(action==='edit')onEdit?.(v);message.success(action==='edit'?'已返回草稿，可编辑后重新发布':v.publicationStatus==='已发布'?'复检完成，版本已发布':'已删除安全命中样本，请继续处理隐私问题');}catch(e){message.error(e.message);}};
 const confirm=action=>Modal.confirm({title:action==='deleteSafety'?'删除安全命中样本？':'删除全部命中样本？',content:'原始上传记录保留；仅未命中的样本进入发布版本。',onOk:()=>act(action)});
 return <><Descriptions column={2} items={[{key:'status',label:'版本状态',children:uploadStatus(version)},{key:'count',label:'样本数',children:version.samples},{key:'issues',label:'问题样本数',children:ids.size},{key:'hits',label:'命中结果数',children:findings.length}]}/>
 {run&&<Progress percent={run.progress}/>}
 <Collapse style={{marginTop:12}} defaultActiveKey={uploadFindingGroups(version,findings).map(g=>g.key)} items={uploadFindingGroups(version,findings).map(group=>({key:group.key,label:<Space wrap><Typography.Text strong>{group.name}</Typography.Text><Typography.Text type="secondary">{new Set(group.findings.map(f=>f.sampleId)).size} 条问题样本 · {group.findings.length} 项命中</Typography.Text></Space>,children:<Table size="small" rowKey={(r,i)=>r.sampleId+r.ruleId+i} dataSource={group.findings} pagination={{pageSize:10,hideOnSinglePage:true}} columns={[{title:'样本ID',dataIndex:'sampleId'},{title:'字段',dataIndex:'fieldId'},{title:'类别',dataIndex:'category'},{title:'命中规则',render:(_,r)=>r.ruleId+' · '+r.name},{title:'原因',dataIndex:'reason'}]} locale={{emptyText:run?.progress===100?'此压缩包未发现问题':'等待检查结果'}}/>}))}/>
 {actionable&&onChange&&<Space wrap style={{marginTop:24}}><Button type="primary" disabled={blocked||Number(version.samples)<=ids.size} onClick={()=>confirm('delete')}>删除命中样本并发布</Button><Button disabled={blocked||!privacyFindings.length||Number(version.samples)<=deleteIds.size} onClick={()=>setShowMask(true)}>{safety?'配置脱敏并删除异常样本后发布':'配置脱敏并发布'}</Button><Button onClick={()=>act('edit')}>重新上传</Button></Space>}
 {blocked&&<Typography.Paragraph type="danger">文件问题或检查异常尚未解决，请重新上传后再次发布。</Typography.Paragraph>}
 <Modal title="隐私脱敏配置" open={showMask} onCancel={()=>setShowMask(false)} onOk={()=>act(safety?'maskDelete':'mask')} okText="确认处理并发布">{safety&&<Alert type="warning" showIcon style={{marginBottom:16}} title={`将删除 ${deleteIds.size} 条安全或结构异常样本，其余隐私命中样本按下方配置脱敏。`} description="同一样本命中多类问题时优先删除，不再脱敏；处理后复检通过才发布。"/>}<Table size="small" pagination={false} rowKey="ruleId" dataSource={[...new Map(privacyFindings.map(f=>[f.ruleId,f])).values()]} columns={[{title:'规则',dataIndex:'name'},{title:'处理方式',render:(_,r)=><Select aria-label={r.name+'脱敏方式'} style={{width:160}} placeholder="请选择" value={methods[r.ruleId]} onChange={v=>setMethods(m=>({...m,[r.ruleId]:v}))} options={['部分掩码','全掩码','泛化','虚构替换'].map(value=>({value,label:value}))}/>}]}/></Modal>
 <details style={{marginTop:24}}><summary>检查与处理记录</summary><pre>{JSON.stringify(runs,null,2)}</pre></details>
 </>;
}
export function UploadPublicationPanel({version,versions=[version],onVersionChange,onChange,onEdit,onDetail}){
 const state=uploadStatus(version),run=version.uploadRuns?.at(-1),busy=state==='校验中',done=state==='已发布',issues=['待处理','校验失败'].includes(state),progress=run?.progress||0;
 const current=done?3:issues?(run?.findings?.some(f=>f.category==='文件检查')?0:1):busy?(progress<40?0:1):0;
 return <Card style={{marginTop:24}} title={<Space><span>上传与发布检查</span><Tag color={busy?'processing':done?'success':issues?'warning':'default'}>{busy?'发布检查中':state}</Tag></Space>} extra={<Button type="link" onClick={onDetail}>查看任务详情</Button>}>
  <Flex justify="space-between" wrap gap={8} style={{marginBottom:20}}><Space><Typography.Text type="secondary">上传版本</Typography.Text><Select placeholder={"请选择切换上传版本"} aria-label="切换上传版本" value={version.version} onChange={onVersionChange} style={{minWidth:260}} options={versions.map((v,i)=>({value:v.version,label:v.version+(i===0?'（最新上传）':'')}))}/></Space><Typography.Text type="secondary">{Number(version.samples||0).toLocaleString()} 条样本</Typography.Text></Flex>
  <Steps size="small" current={current} status={issues?'error':'process'} items={[{title:'文件检查'},{title:'隐私与安全检查'},{title:'发布入库'}]}/>
  {busy&&<div role="status" aria-live="polite" style={{marginTop:20}}><Progress percent={progress} size="small"/><Typography.Text type="secondary">正在检查上传内容，通过后自动发布。你可以离开此页，检查将继续进行。</Typography.Text></div>}
  {done&&<Alert style={{marginTop:20}} type="success" showIcon title="检查通过，数据集版本已发布"/>}
  {issues&&<Alert style={{marginTop:20,marginBottom:16}} type="warning" showIcon title="发现待处理问题，暂未发布" description="请处理下方命中样本，或修改上传内容后重新提交。"/>}
  {issues?<UploadTaskDetail key={version.version} version={version} onChange={onChange} onEdit={onEdit}/>:!busy&&<Collapse ghost style={{marginTop:12}} items={[{key:'results',label:'查看检查记录',children:<UploadTaskDetail version={version} onChange={onChange} onEdit={onEdit}/>}]}/>}
 </Card>;
}
