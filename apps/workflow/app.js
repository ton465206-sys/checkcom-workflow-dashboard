import {metrics,departmentRoles} from './metrics.mjs';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
function empty(message){
 $('connectionStatus').textContent=message;$('updatedAt').textContent='—';
 $('overview').innerHTML=['ວຽກທັງໝົດ','ສຳເລັດແລ້ວ','ຍັງຄ້າງ','ເຖິງກຳນົດ / ເກີນກຳນົດ','ມີຈຸດຕິດຂັດ'].map(label=>`<article class="metric-card"><div><small>${label}</small><strong>—</strong></div></article>`).join('');
 for(const id of ['stageList','riskList','departmentSummary','analysisTable'])$(id).textContent=message;
}
function draw(tasks){
 const m=metrics(tasks,today());$('connectionStatus').textContent='ຖານຂໍ້ມູນກາງ · ເຊື່ອມແລ້ວ';$('updatedAt').textContent=new Intl.DateTimeFormat('lo-LA',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'}).format(new Date());
 $('overview').innerHTML=[['ວຽກທັງໝົດ',m.total],['ສຳເລັດແລ້ວ',m.completed],['ຍັງຄ້າງ',m.open],['ເຖິງກຳນົດ / ເກີນກຳນົດ',m.due],['ມີຈຸດຕິດຂັດ',m.blocked]].map(([label,n])=>`<article class="metric-card"><div><small>${label}</small><strong>${n}</strong></div></article>`).join('');
 $('stageList').innerHTML=m.stages.length?m.stages.map(([label,n])=>`<div class="risk-item"><strong>${esc(label)}</strong><span>${n} ວຽກ</span><div class="bar"><span style="width:${Math.round(n/m.total*100)}%"></span></div></div>`).join(''):'ຍັງບໍ່ມີວຽກ';
 const needs=tasks.filter(t=>String(t.blocker||'').trim()).slice(0,8);$('riskList').innerHTML=needs.length?needs.map(t=>`<div class="risk-item"><strong>#${t.id} ${esc(t.title)}</strong><small>${esc(t.blocker)}</small></div>`).join(''):'ບໍ່ມີຈຸດຕິດຂັດທີ່ບັນທຶກ';
 $('departmentSummary').textContent=`${m.unassigned} ວຽກຍັງບໍ່ລະບຸພະແນກ. ບໍ່ຄາດເດົາພະແນກຈາກຊື່ວຽກຫຼືຕຳແໜ່ງ.${m.invalidDates?' ພົບວັນຕິດຕາມບໍ່ຖືກຕ້ອງ '+m.invalidDates+' ລາຍການ.':''}`;
 $('analysisTable').innerHTML='<div class="table-row header"><span>ພະແນກທີ່ລະບຸໃນວຽກ</span><span>ວຽກທັງໝົດ</span><span>ສຳເລັດ</span><span>ຕິດຂັດ</span></div>'+m.departments.map(d=>`<div class="table-row"><span>${esc(d.name)}</span><span>${d.total}</span><strong>${d.completed}</strong><span>${d.blocked}</span></div>`).join('');
}
$('workflowRow').innerHTML=departmentRoles.map(([name,role])=>`<div class="flow-card"><div><strong>${esc(name)}</strong><p>${esc(role)}</p></div></div>`).join('');
$('departments').innerHTML=departmentRoles.map(([name,role])=>`<article class="department-card"><header><h3>${esc(name)}</h3></header><p>${esc(role)}</p><p class="delta">KPI ສະເພາະພະແນກ: ຍັງບໍ່ມີຂໍ້ມູນທີ່ບັນທຶກ</p></article>`).join('');
empty('ກະລຸນາເຊື່ອມຕໍ່ຖານກາງຢູ່ໜ້າຫຼັກ');
if(window.CheckComData){window.CheckComData.subscribe(state=>{if(state.error||!state.connected)empty(state.error||'ຍັງບໍ່ເຊື່ອມຕໍ່');else if(Array.isArray(state.tasks))draw(state.tasks);});window.CheckComData.read().then(draw).catch(error=>empty(error.message));}
