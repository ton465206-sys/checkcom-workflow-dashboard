export const departmentRoles=[['ຂາຍ ແລະ ການຕະຫຼາດ','ຫາລູກຄ້າ ແລະ ຕິດຕາມຂໍ້ສະເໜີ'],['ຜະລິດ ແລະ ຈັດຊື້','ຈັດຫາອຸປະກອນ ແລະ ວາງແຜນສົ່ງມອບ'],['ບັນຊີ','ຕົ້ນທຶນ ໃບແຈ້ງໜີ້ ແລະ ຕິດຕາມຮັບເງິນ'],['HR','ກຳລັງຄົນ ອົບຮົມ ແລະ ພາລະວຽກ'],['ເຕັກນິກ','ສຳຫຼວດລະບົບ Demo/PoC ແລະ ແກ້ບັນຫາ']];
export function dateKey(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?value:null;}
export function isComplete(task){return ['เสร็จแล้ว','completed','done','ສຳເລັດ','ສຳເລັດແລ້ວ'].includes(String(task.status||'').trim().toLowerCase());}
export function metrics(tasks,today){
 const stages=new Map(),departments=new Map();let completed=0,due=0,invalidDates=0,blocked=0,unassigned=0;
 for(const t of tasks){if(isComplete(t))completed++;const d=dateKey(t.follow_up_date);if(t.follow_up_date&&!d)invalidDates++;if(d&&d<=today&&!isComplete(t))due++;if(String(t.blocker||'').trim())blocked++;
 const stage=String(t.stage||t.status||'ຍັງບໍ່ລະບຸ').trim();stages.set(stage,(stages.get(stage)||0)+1);
 const department=String(t.department||t.owner_department||'').trim();if(!department)unassigned++;const key=department||'ຍັງບໍ່ມອບພະແນກ';const row=departments.get(key)||{name:key,total:0,completed:0,blocked:0};row.total++;if(isComplete(t))row.completed++;if(String(t.blocker||'').trim())row.blocked++;departments.set(key,row);}
 return {total:tasks.length,completed,open:tasks.length-completed,due,blocked,unassigned,invalidDates,stages:[...stages],departments:[...departments.values()]};
}
