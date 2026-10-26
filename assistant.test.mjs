import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';

const source=await readFile(new URL('./assistant.js',import.meta.url),'utf8');
const fixture={id:7,title:'Example company',status:'รอดำเนินการ',stage:'1. Lead',version:3,contact_info:'private contact',quotation_id:'QT-7',follow_up_note:'Keep me',custom_field:{preserved:true}};
const tick=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};
function setup({failRead=false,conflict=false}={}){
 const nodes=new Map(); const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',hidden:false,children:[],addEventListener(event,fn){this[event]=fn;},replaceChildren(){this.children=[];},append(...items){this.children.push(...items);},style:{}});return nodes.get(id);};
 node('access-code').value='';
 const requests=[];let current=structuredClone(fixture);let reads=0;let localReads=0;
 const context={window:{CHECKCOM_API_URL:'https://api.example.test'},location:{hostname:'site.github.io',port:''},document:{getElementById:node,createElement:()=>node('new-'+Math.random()),querySelector:()=>({click(){}})},localStorage:{getItem(){localReads++;return JSON.stringify([{id:999,title:'stale'}]);},setItem(){throw Error('Must not write local storage');}},sessionStorage:{getItem:()=>null,setItem(){}},crypto:webcrypto,Date,console,setInterval(){},navigator:{},fetch:async(url,options={})=>{
  requests.push({url,options});
  if(url.endsWith('/tasks')){reads++;return{ok:!failRead,status:failRead?401:200,json:async()=>failRead?{error:'Unauthorized'}:{tasks:[structuredClone(current)]}};}
  if(url.endsWith('/tasks/write')){const body=JSON.parse(options.body);if(conflict)return{ok:false,status:409,json:async()=>({error:'Version conflict'})};current={...body.task,id:body.task.id||8,version:4};return{ok:true,status:200,json:async()=>({task:current,tasks:[current]})};}
  throw Error('Unexpected endpoint '+url);
 }};
 vm.runInNewContext(source,context); node('access-code').value='secret';
 return {node,requests,get current(){return current;},get reads(){return reads;},get localReads(){return localReads;},async command(text){node('command').value=text;node('command-form').onsubmit({preventDefault(){}});await tick();},async yes(){await node('confirm-yes').onclick();await tick();},cancel(){node('confirm-no').onclick();}};
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
