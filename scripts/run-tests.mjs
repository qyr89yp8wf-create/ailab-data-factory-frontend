import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=readdirSync('tests').filter(file=>file.endsWith('.test.mjs')).sort();
const failed=[];
for(const file of files){
 const result=spawnSync(process.execPath,['tests/'+file],{encoding:'utf8'});
 if(result.status!==0){failed.push(file);console.error('FAIL '+file+'\n'+result.stdout+result.stderr);}
 else console.log('PASS '+file);
}
console.log(`\n${files.length-failed.length}/${files.length} test files passed`);
process.exitCode=failed.length?1:0;
