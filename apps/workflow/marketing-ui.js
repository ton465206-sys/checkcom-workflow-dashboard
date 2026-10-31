import {marketingTools,marketingBrief} from './marketing.mjs';
const $=id=>document.getElementById(id);let connected=false,saving=false,uncertain=false,saved=false;
$('marketingTool').replaceChildren(...marketingTools.map(([id,name,description])=>{const o=document.createElement('option');o.value=id;o.textContent=name+' · '+description;return o;}));
function values(){return{command:$('marketingTool').value,goal:$('marketingGoal').value,audience:$('marketingAudience').value,product:$('marketingProduct').value,owner:$('marketingOwner').value,due:$('marketingDue').value};}
function draft(){const text=marketingBrief(values());$('marketingBrief').value=text;return text;}
$('marketingPrepare').onclick=()=>{try{draft();$('marketingMessage').textContent='ກຽມ Brief ແລ້ວ — ບັນທຶກເປັນວຽກ ຫຼືຄັດລອກໄປສັ່ງບອສ';}catch(e){$('marketingMessage').textContent=e.message;}};
$('marketingCopy').onclick=async()=>{try{await navigator.clipboard.writeText(draft());$('marketingMessage').textContent='ຄັດລອກ Brief ແລ້ວ ນຳໄປວາງໃນແຊັດບອສ ຫຼື Telegram';}catch(e){$('marketingMessage').textContent='ຄັດລອກບໍ່ສຳເລັດ; ເລືອກຂໍ້ຄວາມໃນຊ່ອງ Brief ແລ້ວຄັດລອກເອງ';}};
function controls(){$('marketingSave').disabled=!connected||saving||uncertain||saved;}
$('marketingSave').onclick=async()=>{if(!connected||saving||uncertain||saved)return;let text;try{text=draft();}catch(e){$('marketingMessage').textContent=e.message;return;}saving=true;controls();try{const v=values();const r=await window.parent.CheckComTaskGateway.write({title:'Marketing · '+v.command+' · '+v.goal.trim().slice(0,120),department:'Marketing',owner:v.owner.trim(),status:'รอดำเนินการ',stage:'Marketing brief',action_plan:text,follow_up_date:v.due,marketing_plugin:{name:'marketing',version:'1.2.0',command:v.command,approval:'draft',source:'anthropics/knowledge-work-plugins'}});saved=true;$('marketingMessage').textContent='ບັນທຶກວຽກໃນຖານກາງແລ້ວ · #'+r.task.id+' · ຮ່າງລໍຖ້າກວດ';}catch(e){uncertain=true;$('marketingMessage').textContent='ຍັງຢືນຢັນການບັນທຶກບໍ່ໄດ້: '+e.message+' ກວດລາຍການວຽກກ່ອນລອງໃໝ່';}finally{saving=false;controls();}};
function attach(){const g=window.parent.CheckComTaskGateway;if(!g||attach.done)return;attach.done=true;g.subscribe(s=>{connected=s.connected;controls();if(!connected)$('marketingMessage').textContent='ໃສ່ລະຫັດຖານກາງຢູ່ໜ້າຫຼັກກ່ອນບັນທຶກວຽກ';});}
window.parent.addEventListener('checkcom-gateway-ready',attach);attach();controls();

$('marketing').addEventListener('input',()=>{saved=false;controls();});
