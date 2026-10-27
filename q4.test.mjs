import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const html = await readFile(new URL('./apps/q4/index.html', import.meta.url), 'utf8');
const source = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const fixture = {id:7,title:'Synthetic company',segment:'Example',version:3};
function setup({embedded=true, snapshot={tasks:[fixture],state:'ready'}}={}) {
  const nodes = new Map(), listeners = new Map(), requests = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {value:'',children:[],style:{},classList:{add(){}},
      append(child){this.children.push(child);},replaceChildren(){this.children=[];},
      addEventListener(){},setAttribute(){}});
    return nodes.get(id);
  };
  const parent = {location:{origin:'https://site.example'},CHECKCOM_SHARED_SNAPSHOT:snapshot,
    addEventListener(type,fn){listeners.set(type,fn);}};
  const window = {CHECKCOM_API_URL:'https://api.example.test'};
  window.parent = embedded ? parent : window;
  vm.runInNewContext(source, {window,location:{origin:'https://site.example',hostname:'site.example'},
    document:{getElementById:node,createElement:()=>node(Math.random())},Date,
    setInterval(){},fetch:async url=>{requests.push(url);return {ok:true,json:async()=>[fixture]};}});
  return {node,requests,update:detail=>listeners.get('checkcom-tasks')?.({detail})};
}
test('central API sales view uses parent snapshot and never fetches public task JSON',()=>{
  const app=setup();assert.equal(app.requests.length,0);assert.equal(app.node('total').textContent,1);
  app.update({tasks:[fixture,{...fixture,id:8}],state:'ready'});
  assert.equal(app.node('total').textContent,2);
});
test('sales view marks stale data and clears it when credentials are edited',()=>{
  const app=setup();app.update({tasks:[fixture],state:'error'});
  assert.match(app.node('updated').textContent,/อาจเก่า/);
  app.update({tasks:[],state:'waiting'});assert.equal(app.node('total').textContent,0);
  assert.match(app.node('updated').textContent,/รอเชื่อมต่อ/);
});
test('standalone sales view requires central login instead of falling back to JSON',()=>{
  const app=setup({embedded:false});assert.equal(app.requests.length,0);
  assert.match(app.node('updated').textContent,/ศูนย์งาน/);
});
