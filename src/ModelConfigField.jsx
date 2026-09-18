import React from 'react';
import {Form,Input,Select,Switch,Tooltip} from 'antd';
import {InfoCircleOutlined} from '@ant-design/icons';

export function modelParametersError(value,allowEmpty=false){
  if(allowEmpty&&!String(value||'').trim())return null;
  try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?null:'请输入 JSON 对象';}catch{return 'JSON 格式不正确';}
}
const Help=({label,children})=><Tooltip title={children}><button type="button" className="model-config-help" aria-label={label}><InfoCircleOutlined/></button></Tooltip>;
export function ModelConfigGroup({children}){return <div className="model-config-group">{children}</div>;}
// Slots keep existing Form bindings and controlled-state callbacks intact.
export function ModelConfigField({label,help,model,parameters,toggle,children,required=false}){
  return <div className="model-config-field" data-model-config="true">
    {label&&<div className="model-config-label">{required&&<span className="model-config-required" aria-hidden="true">*</span>}{label}{help&&<Help label={`${label}说明`}>{help}</Help>}</div>}
    <div className="model-config-selection">{model||children}</div>
    {(toggle||parameters)&&<><div className="model-config-parameter-line"><span>自定义参数 <Help label={`${typeof label==='string'?label:'模型'}参数说明`}>{help||'关闭后使用此处原有的默认参数策略；已输入的自定义参数会保留。'}</Help></span>{toggle}</div><div className="model-config-parameters">{parameters}</div></>}
  </div>;
}
export function FormModelConfig({form,modelName,parameterSwitchName,parameterName,label,options,initialModel,help='关闭后不传递自定义参数，使用模型默认参数。',allowEmpty=false,required=true,disabled}){
  const enabled=Form.useWatch(parameterSwitchName,form);
  return <ModelConfigField label={label} help={help} required={required}
    model={<Form.Item name={modelName} initialValue={initialModel} rules={required?[{required:true,message:`请选择${label}`}]:[]}><Select placeholder={`请选择${label}`} aria-label={label} disabled={disabled} options={options}/></Form.Item>}
    toggle={<Form.Item name={parameterSwitchName} valuePropName="checked" noStyle><Switch aria-label={`${label}自定义参数`} disabled={disabled}/></Form.Item>}
    parameters={enabled&&<Form.Item name={parameterName} preserve rules={[{validator:(_,value)=>{const error=modelParametersError(value,allowEmpty);return error?Promise.reject(new Error(error)):Promise.resolve();}}]}><Input.TextArea placeholder={'请输入 JSON 对象，如 {"temperature":0.7}'} aria-label={`${label}参数 JSON`} rows={5} spellCheck={false} disabled={disabled}/></Form.Item>}/>
}
export function ControlledModelConfig({label,options,value,onChange,enabled,onEnabledChange,parameters,onParametersChange,help='关闭后不传递自定义参数，使用模型默认参数。',disabled}){
  const error=enabled?modelParametersError(parameters):null;
  return <ModelConfigField label={label} help={help}
    model={<Select placeholder={`请选择${label}`} aria-label={label} style={{width:'100%'}} value={value} onChange={onChange} options={options} disabled={disabled}/>}
    toggle={<Switch aria-label={`${label}自定义参数`} checked={enabled} onChange={onEnabledChange} disabled={disabled}/>}
    parameters={enabled&&<><Input.TextArea placeholder={'请输入 JSON 对象，如 {"temperature":0.7}'} aria-label={`${label}参数 JSON`} aria-invalid={!!error} status={error?'error':undefined} rows={5} spellCheck={false} value={parameters} onChange={e=>onParametersChange(e.target.value)} disabled={disabled}/>{error&&<div className="model-config-error" role="alert">{error}</div>}</>}/>
}
