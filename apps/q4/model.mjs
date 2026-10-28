export function closed(task) {
  return ['เสร็จแล้ว', 'ปิดการขาย', 'ไม่สนใจ / ปิดติดตาม'].includes(task.status);
}
export function metrics(records, today) {
  return {total:records.length,checked:records.filter(t=>t.checked).length,contacted:records.filter(t=>t.contacted).length,due:records.filter(t=>t.follow_up_date&&t.follow_up_date<=today&&!closed(t)).length,blocked:records.filter(t=>t.blocker).length};
}
export function validDate(value) {
  if(!value)return true;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00Z');
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function editedTask(original, fields) {
  if(!validDate(fields.follow_up_date))throw new Error('วันติดตามไม่ถูกต้อง');
  const result={...original,...fields};
  if(result.contacted)result.checked=true;
  return result;
}
