import {metrics,editedTask} from './model.mjs';
let records=[],group='',connected=false,editing=null,saving=false;
const $=id=>document.getElementById(id);
const today=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
function render(){
  const counts=metrics(records,today());
  for(const name of ['total','checked','contacted','due','blocked'])$(name).textContent=connected?counts[name]:'—';
  const groups={};for(const t of records){const name=t.segment||'อื่น ๆ';(groups[name]??=[]).push(t);}
  $('groups').replaceChildren();
  for(const [name,items] of [['ทั้งหมด',records],...Object.entries(groups)]){
    const button=document.createElement('button');button.type='button';button.textContent=`${name} ${items.length}`;button.setAttribute('aria-pressed',String(group===(name==='ทั้งหมด'?'':name)));button.onclick=()=>{group=name==='ทั้งหมด'?'':name;render();};$('groups').append(button);
  }
  const query=$('search').value.toLocaleLowerCase().trim();
  const found=records.filter(t=>(!group||(t.segment||'อื่น ๆ')===group)&&(!$('pending-only').checked||!t.contacted)&&(!query||`${t.title} ${t.contact||''} ${t.segment||''}`.toLocaleLowerCase().includes(query)));
  $('count').textContent=connected?`พบ ${found.length} รายการ`:'เชื่อมต่อฐานกลางที่แถบด้านบนก่อน';
  $('rows').replaceChildren();$('empty').hidden=found.length>0;
  for(const item of found){
    const row=document.createElement('tr');
    const values=[`#${item.id}`,`${item.title}\n${item.segment||'อื่น ๆ'}`,item.follow_up_date||'ยังไม่กำหนด',item.stage||'ไม่ระบุ',item.status||'ไม่ระบุ',item.action_plan||'ยังไม่กำหนด',item.owner||'ยังไม่กำหนด',item.checked?'เช็คแล้ว':'ยังไม่เช็ค',item.contacted?'ติดต่อแล้ว':'ยังไม่ติดต่อ',item.blocker||'ไม่มี',item.follow_up_note||'ยังไม่มีบันทึก',item.contact||'—',item.contact_info||'—'];
    values.forEach((value,index)=>{const cell=document.createElement('td');cell.textContent=value;cell.style.whiteSpace=index===1?'pre-line':'normal';if(index===3)cell.className='stage';if(index===9&&item.blocker)cell.classList.add('blocked');if(index===12)cell.classList.add('contact');if(['—','ยังไม่กำหนด','ยังไม่มีบันทึก','ไม่มี','ไม่ระบุ'].includes(value))cell.classList.add('muted');row.append(cell);});
    const cell=document.createElement('td'),button=document.createElement('button');button.type='button';button.textContent='แก้ไข / Next Action';button.onclick=()=>openEdit(item);cell.append(button);row.append(cell);$('rows').append(row);
  }
}
function openEdit(item){
  editing=structuredClone(item);$('editTitle').textContent=`แก้ไข #${item.id} ${item.title}`;
  for(const name of ['stage','status','action_plan','follow_up_date','follow_up_note','owner','blocker']){
    const field=$('edit-'+name);if(name==='status'&&![...field.options].some(x=>x.value===item.status)&&item.status){const option=document.createElement('option');option.value=item.status;option.textContent=item.status;field.append(option);}field.value=item[name]||'';
  }
  $('edit-checked').checked=Boolean(item.checked);$('edit-contacted').checked=Boolean(item.contacted);
  $('editError').textContent='';$('saveEdit').disabled=false;$('editDialog').showModal();
}
async function saveEdit(){
  if(!editing||saving)return;
  const fields={};for(const name of ['stage','status','action_plan','follow_up_date','follow_up_note','owner','blocker'])fields[name]=$('edit-'+name).value.trim();
  fields.checked=$('edit-checked').checked;fields.contacted=$('edit-contacted').checked;
  let task;try{task=editedTask(editing,fields);}catch(e){$('editError').textContent=e.message;return;}
  saving=true;$('saveEdit').disabled=true;$('editError').textContent='กำลังบันทึก…';
  try{await window.CheckComData.write(task,editing.version);$('editDialog').close();editing=null;await refresh();$('updated').textContent='บันทึกในฐานกลางแล้ว Telegram จะอ่านข้อมูลเดียวกัน';}
  catch(error){$('editError').textContent=error.status===409?'ข้อมูลถูกแก้จากอีกช่องทางแล้ว ปิดหน้าต่างและเปิดรายการล่าสุดก่อนแก้ใหม่':error.message||'บันทึกไม่สำเร็จ';try{await refresh();}catch{}}
  finally{saving=false;$('saveEdit').disabled=false;}
}
function applyState(state){connected=Boolean(state.connected)&&!state.error;records=connected&&Array.isArray(state.tasks)?state.tasks:[];render();$('updated').textContent=state.error||(!connected?'รอเชื่อมต่อฐานกลาง':`ข้อมูลฐานกลาง ${new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}`);}
async function refresh(){try{const tasks=await window.CheckComData.read();applyState({tasks,connected:true});}catch(error){applyState({tasks:[],connected:false,error:error.message||'โหลดฐานกลางไม่สำเร็จ'});}}
$('search').addEventListener('input',render);$('pending-only').addEventListener('change',render);$('refresh').addEventListener('click',refresh);$('saveEdit').addEventListener('click',saveEdit);$('editDialog').addEventListener('close',()=>{editing=null;});
window.CheckComData.subscribe(applyState);refresh();
