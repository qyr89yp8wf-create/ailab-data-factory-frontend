import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {parseSync} from 'rolldown/utils';
const name=n=>n?.type==='JSXMemberExpression'?name(n.object)+'.'+name(n.property):n?.name;
const attr=(n,k)=>n?.attributes?.find(a=>a.type==='JSXAttribute'&&name(a.name)===k);
const literal=a=>a?.value?.value??(a?.value?.expression?.type==='Literal'?a.value.expression.value:undefined);
const fields={name:'名称',description:'描述',prompt:'Prompt',count:'样本数量',targetCount:'增强数量上限',versionNote:'版本描述',outputDatasetName:'数据集名称',seed:'随机种子',field_id:'字段 ID',label:'字段名称',content:'内容',min:'最小值',max:'最大值'};
const all=[];
function scan(dir){for(const d of readdirSync(dir,{withFileTypes:true})){const path=join(dir,d.name);if(d.isDirectory())scan(path);else if(/\.jsx$/.test(path)){const source=readFileSync(path,'utf8'),ast=parseSync(path,source);if(ast.errors.length)throw Error(path);const edits=[];
 function walk(node,parents=[]){if(!node||typeof node!=='object')return;
 if(node.type==='JSXOpeningElement'&&['Input','Input.TextArea','Input.Password','Input.Search','InputNumber','Select','input','textarea'].includes(name(node.name))){
  const tag=name(node.name),form=[...parents].reverse().find(p=>p.type==='JSXElement'&&name(p.openingElement.name)==='Form.Item')?.openingElement;
  const hidden=attr(form,'hidden')||literal(attr(node,'type'))==='hidden'||literal(attr(node,'type'))==='file';
  const disabled=attr(node,'disabled'),readonly=attr(node,'readOnly');
  if(!attr(node,'placeholder')&&!hidden&&!(disabled&&!disabled.value)&&!readonly){
   const title=[...parents].reverse().find(p=>p.type==='ObjectExpression'&&p.properties.some(a=>a.key?.name==='title'))?.properties.find(a=>a.key?.name==='title')?.value?.value;
   const label=literal(attr(form,'label'))||literal(attr(node,'aria-label'))||fields[literal(attr(form,'name'))]||title;
   let text=tag==='Select'?'请选择'+(label||'选项'):tag==='InputNumber'?'请输入'+(label||'数值'):'请输入'+(label||'内容');
   if(/Prompt|提示词|指令|规则条件/.test(label||''))text='描述'+label+'，说明目标、约束和输出要求';
   if(/Python/.test(label||''))text='填写判断函数，返回 true 或 false';
   if(/枚举/.test(label||''))text='填写允许的取值，每行一个';
   if(/JSON|参数/.test(label||'')&&tag==='Input.TextArea')text='请输入合法 JSON，如 {"temperature":0.7}';
   const min=literal(attr(node,'min')),max=literal(attr(node,'max'));
   if(tag==='InputNumber'&&(min!==undefined||max!==undefined))text+=(min!==undefined&&max!==undefined?'（'+min+'～'+max+'）':min!==undefined?'（不小于 '+min+'）':'（不大于 '+max+'）');
   edits.push({at:node.name.end,text:' placeholder={'+JSON.stringify(text)+'}',line:source.slice(0,node.start).split('\n').length,hint:text});
  }
 }
 for(const [key,value] of Object.entries(node)){if(key==='parent')continue;if(Array.isArray(value))value.forEach(v=>walk(v,[...parents,node]));else if(value&&typeof value==='object')walk(value,[...parents,node]);}
 }walk(ast.program);
 if(edits.length){let updated=source;for(const e of edits.slice().reverse())updated=updated.slice(0,e.at)+e.text+updated.slice(e.at);
 const before=source.split(/\r?\n/),after=updated.split(/\r?\n/);all.push({path:relative(process.cwd(),path).replaceAll('\\','/'),edits,changes:before.flatMap((l,i)=>l!==after[i]?[{old:l,next:after[i]}]:[])});}
 }}}
scan('src');console.log(JSON.stringify(process.argv[2]?all.filter(f=>f.path===process.argv[2]):all.map(f=>({path:f.path,count:f.edits.length,generic:f.edits.filter(e=>/请输入内容|请选择选项|请输入数值/.test(e.hint)).length}))));
