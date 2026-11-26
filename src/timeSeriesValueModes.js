export const valueMode = field => field.value_mode || 'dynamic';
export function validateValueMode(field) {
  const mode=valueMode(field), numeric=['number','integer'].includes(field.type||field.data_type);
  if(!['dynamic','fixed','per_series'].includes(mode)) throw new Error('不支持的取值方式');
  if(mode==='dynamic') return;
  const check=value=>{if(value===undefined||value===null||value==='')throw new Error('请填写固定值或取值范围');if(numeric&&(!Number.isFinite(value)||((field.type||field.data_type)==='integer'&&!Number.isInteger(value))))throw new Error('请填写符合字段类型的数值');const schema=field.value_schema||{};if(schema.minimum!=null&&value<schema.minimum||schema.maximum!=null&&value>schema.maximum)throw new Error('取值超出全局值域');const choices=field.enum_values?.length?field.enum_values:schema.enum;if(choices?.length&&!choices.includes(value))throw new Error('取值不在枚举值中');};
  if(mode==='fixed'){check(field.fixed_value);return;}
  if(!numeric)throw new Error('每段随机取值仅支持数值字段');
  check(field.range_min);check(field.range_max);
  if(field.range_min>field.range_max)throw new Error('范围下限不能大于上限');
}
export function sampleConstantValues(fields,random=Math.random){return Object.fromEntries(fields.filter(f=>valueMode(f)!=='dynamic').map(f=>{validateValueMode(f);const value=valueMode(f)==='fixed'?f.fixed_value:(f.type||f.data_type)==='integer'?f.range_min+Math.floor(random()*(f.range_max-f.range_min+1)):Number((f.range_min+random()*(f.range_max-f.range_min)).toFixed(2));return [f.field_id||f.id,value];}));}
