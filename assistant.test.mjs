import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';

const source=await readFile(new URL('./assistant.js',import.meta.url),'utf8');
const fixture={id:7,title:'Example company',status:'รอดำเนินการ',stage:'1. Lead',version:3,contact_info:'private contact',quotation_id:'QT-7',follow_up_note:'Keep me',custom_field:{preserved:true}};
const tick=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};
function setup({failRead=false,conflict=false,fetchHook}={}){
 const nodes=new Map(); const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',hidden:false,children:[],addEventListener(event,fn){this[event]=fn;},replaceChildren(){this.children=[];},append(...items){this.children.push(...items);},style:{}});return nodes.get(id);};
 node('access-code').value='';
 const intervals=[];const timers=new Map();let timerId=0;
 const requests=[];let current=structuredClone(fixture);let reads=0;let localReads=0;
 const context={AbortController,setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},structuredClone,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},window:{dispatchEvent(){},CHECKCOM_API_URL:'https://api.example.test'},location:{hostname:'site.github.io',port:''},document:{getElementById:node,createElement:()=>node('new-'+Math.random()),querySelector:()=>({click(){}})},localStorage:{getItem(){localReads++;return JSON.stringify([{id:999,title:'stale'}]);},setItem(){throw Error('Must not write local storage');}},sessionStorage:{getItem:()=>null,setItem(){}},crypto:webcrypto,Date,console,setInterval(fn){intervals.push(fn);},navigator:{},fetch:async(url,options={})=>{
  requests.push({url,options});
  if(fetchHook){const result=await fetchHook(url,options,requests.length);if(result)return result;}
  if(url.endsWith('/tasks')){reads++;return{ok:!failRead,status:failRead?401:200,json:async()=>failRead?{error:'Unauthorized'}:{tasks:[structuredClone(current)]}};}
  if(url.endsWith('/tasks/write')){const body=JSON.parse(options.body);if(conflict)return{ok:false,status:409,json:async()=>({error:'Version conflict'})};current={...body.task,id:body.task.id||8,version:4};return{ok:true,status:200,json:async()=>({task:current,tasks:[current]})};}
  throw Error('Unexpected endpoint '+url);
 }};
 vm.runInNewContext(source,context); node('access-code').value='secret';
 return {node,requests,window:context.window,poll:()=>intervals[0](),expire:()=>{for(const fn of timers.values())fn();},get current(){return current;},get reads(){return reads;},get localReads(){return localReads;},async command(text){node('command').value=text;node('command-form').onsubmit({preventDefault(){}});await tick();},async yes(){await node('confirm-yes').onclick();await tick();},cancel(){node('confirm-no').onclick();}};
}
test('configured API never reads browser snapshot; confirmed update preserves all fields and refreshes',async()=>{
 const app=setup();await app.command('ปิดงาน 7');assert.equal(app.localReads,0);assert.equal(app.requests.length,1);assert.equal(app.node('confirm').hidden,false);await app.yes();
 const req=app.requests.find(x=>x.url.endsWith('/tasks/write'));const body=JSON.parse(req.options.body);assert.equal(body.expected_version,3);assert.ok(body.request_id);assert.equal(body.task.contact_info,fixture.contact_info);assert.deepEqual(body.task.custom_field,fixture.custom_field);assert.equal(body.task.status,'เสร็จแล้ว');assert.equal(app.reads,2);assert.match(app.node('voice-result').textContent,/บันทึกในฐานข้อมูลกลางแล้ว/);
});
test('cancel does not write or claim persistence',async()=>{const app=setup();await app.command('เพิ่มงาน New example');app.cancel();assert.equal(app.requests.filter(x=>x.url.endsWith('/tasks/write')).length,0);assert.equal(app.node('voice-result').textContent,'ยกเลิกแล้ว');});
test('API read error stops write and does not fetch public JSON or AI',async()=>{const app=setup({failRead:true});await app.command('ปิดงาน 7');assert.equal(app.requests.length,1);assert.equal(app.localReads,0);assert.equal(app.node('voice-result').textContent,'Unauthorized');});
test('conflict reloads latest data and never claims success',async()=>{const app=setup({conflict:true});await app.command('ปิดงาน 7');await app.yes();assert.equal(app.reads,2);assert.match(app.node('voice-result').textContent,/ข้อมูลถูกแก้จากอีกช่องทาง/);assert.equal(app.current.status,fixture.status);});
test('new command invalidates older pending confirmation',async()=>{const app=setup();await app.command('ปิดงาน 7');await app.command('สรุปงาน');await app.yes();assert.equal(app.requests.filter(x=>x.url.endsWith('/tasks/write')).length,0);});
test('followup rejects invalid calendar dates and supports valid confirmed date',async()=>{const app=setup();await app.command('/followup 7 2026-02-30 Call');assert.equal(app.node('voice-result').textContent,'วันที่ติดตามไม่ถูกต้อง');await app.command('/followup 7 2026-11-01 Call');await app.yes();assert.equal(app.current.follow_up_date,'2026-11-01');assert.equal(app.current.follow_up_note,'Call');assert.equal(app.current.quotation_id,'QT-7');});


function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
test('late older command cannot restore a cancelled confirmation',async()=>{
 const gate=deferred();const app=setup({fetchHook:(url,options,n)=>n===1?gate.promise:undefined});
 app.node('command').value='ปิดงาน 7';app.node('command-form').onsubmit({preventDefault(){}});
 await app.command('สรุปงาน');gate.resolve(response({tasks:[fixture]}));await tick();
 assert.equal(app.node('confirm').hidden,true);await app.yes();assert.equal(app.requests.filter(r=>r.url.endsWith('/tasks/write')).length,0);
});
test('credentials edited while read is pending cannot authorize a write',async()=>{
 const gate=deferred();const app=setup({fetchHook:()=>gate.promise});
 app.node('command').value='ปิดงาน 7';app.node('command-form').onsubmit({preventDefault(){}});
 app.node('access-code').value='different-test-code';gate.resolve(response({tasks:[fixture]}));await tick();
 assert.equal(app.node('confirm').hidden,true);
});
test('non-JSON conflict keeps conflict status and reloads latest data',async()=>{
 const app=setup({fetchHook:url=>url.endsWith('/tasks/write')?{ok:false,status:409,json:async()=>{throw new SyntaxError('HTML response');}}:undefined});
 await app.command('ปิดงาน 7');await app.yes();assert.equal(app.reads,2);assert.match(app.node('voice-result').textContent,/ข้อมูลถูกแก้จากอีกช่องทาง/);
});
test('null task record fails safely without enabling writes',async()=>{
 const app=setup({fetchHook:()=>response({tasks:[null]})});await app.command('ปิดงาน 7');
 assert.match(app.node('voice-result').textContent,/ข้อมูลรายการงานจาก API ไม่ถูกต้อง/);assert.equal(app.node('confirm').hidden,true);
});

test('slow poll cannot replace a newer command snapshot',async()=>{
 const gate=deferred();let hold=false;
 const app=setup({fetchHook:()=>hold?gate.promise:undefined});await app.command('สรุปงาน');
 hold=true;app.poll();hold=false;await app.command('สรุปงาน');
 gate.resolve(response({tasks:[{...fixture,title:'stale snapshot'}]}));await tick();
 assert.equal(app.window.CHECKCOM_SHARED_SNAPSHOT.tasks[0].title,fixture.title);
});
test('editing credentials clears shared data and pending approval immediately',async()=>{
 const app=setup();await app.command('ปิดงาน 7');app.node('access-code').value='';app.node('access-code').input();
 assert.equal(app.window.CHECKCOM_SHARED_SNAPSHOT.tasks.length,0);await app.yes();assert.equal(app.requests.filter(r=>r.url.endsWith('/tasks/write')).length,0);
});
test('write connection loss is uncertain and never retried automatically',async()=>{
 const app=setup({fetchHook:url=>{if(url.endsWith('/tasks/write'))throw new TypeError('network unavailable');}});
 await app.command('เพิ่มงาน Synthetic');await app.yes();assert.match(app.node('voice-result').textContent,/ยังยืนยันผลการบันทึกไม่ได้/);
 assert.equal(app.requests.filter(r=>r.url.endsWith('/tasks/write')).length,1);
});
test('request timeout releases the command without a write',async()=>{
 const app=setup({fetchHook:(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))))});
 app.node('command').value='ปิดงาน 7';app.node('command-form').onsubmit({preventDefault(){}});app.expire();await tick();
 assert.match(app.node('voice-result').textContent,/หมดเวลา/);assert.equal(app.requests.length,1);
});
test('two clients preserve the winning edit when a simulated server atomically checks versions',async()=>{
 let task=structuredClone(fixture);
 const fetchHook=async(url,options)=>{
  if(url.endsWith('/tasks'))return response({tasks:[structuredClone(task)]});
  if(url.endsWith('/tasks/write')){
   const body=JSON.parse(options.body);
   if(body.expected_version!==task.version)return response({error:'Version conflict'},409);
   task={...body.task,version:task.version+1};return response({task});
  }
 };
 const first=setup({fetchHook}),second=setup({fetchHook});
 await Promise.all([first.command('/blocker 7 Synthetic blocker'),second.command('ปิดงาน 7')]);
 await Promise.all([first.yes(),second.yes()]);
 assert.equal(task.blocker,'Synthetic blocker');assert.equal(task.status,fixture.status);assert.equal(task.version,4);
 assert.match(second.node('voice-result').textContent,/ข้อมูลถูกแก้จากอีกช่องทาง/);
});
test('successful write followed by read failure is reported as saved but stale',async()=>{
 let written=false;
 const app=setup({fetchHook:url=>{
  if(url.endsWith('/tasks/write')){written=true;return response({task:{...fixture,version:4}});}
  if(written)return response({error:'Temporarily unavailable'},503);
 }});
 await app.command('ปิดงาน 7');await app.yes();
 assert.match(app.node('voice-result').textContent,/บันทึกในฐานข้อมูลกลางแล้ว แต่โหลดรายการล่าสุดไม่สำเร็จ/);
 assert.equal(app.window.CHECKCOM_SHARED_SNAPSHOT.state,'error');
});
test('new command invalidates a delayed AI confirmation',async()=>{
 const gate=deferred();const app=setup({fetchHook:url=>url.endsWith('/chat')?gate.promise:undefined});
 await app.command('ช่วยวางแผนงาน');await app.command('สรุปงาน');
 gate.resolve(response({reply:'Synthetic confirmation',confirmation_token:'synthetic-token'}));await tick();
 assert.equal(app.node('confirm').hidden,true);await app.yes();assert.equal(app.requests.filter(r=>r.url.endsWith('/confirm')).length,0);
});
test('confirmed AI write refreshes central data without calling task write',async()=>{
 const app=setup({fetchHook:url=>url.endsWith('/chat')?response({reply:'Confirm synthetic update',confirmation_token:'synthetic-token'}):url.endsWith('/confirm')?response({reply:'Saved synthetic update'}):undefined});
 await app.command('ช่วยวางแผนงาน');assert.equal(app.requests.filter(r=>r.url.endsWith('/confirm')).length,0);
 await app.yes();assert.equal(app.reads,2);assert.equal(app.requests.filter(r=>r.url.endsWith('/confirm')).length,1);assert.equal(app.requests.filter(r=>r.url.endsWith('/tasks/write')).length,0);
});
