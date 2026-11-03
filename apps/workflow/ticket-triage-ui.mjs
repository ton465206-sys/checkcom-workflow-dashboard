import {triageTickets} from './ticket-triage.mjs';
const $ = id => document.getElementById(id);
let result;
const element = (tag, text, className) => {
  const node = document.createElement(tag); node.textContent = text;
  if (className) node.className = className;
  return node;
};
function clear() { result = undefined; $('results').replaceChildren(); $('download').disabled = true; }
function analyze() {
  clear();
  try {
    if ($('tickets').value.length > 3_000_000) throw Error('Ticket input is too large');
    result = triageTickets(JSON.parse($('tickets').value));
    $('message').textContent = `${result.tasks.length} งานรอตรวจสอบ · ${result.errors.length} ข้อมูลไม่ถูกต้อง · ${result.duplicates.length} รายการซ้ำ · ${result.conflicts.length} ข้อมูลขัดแย้ง`;
    for (const task of result.tasks) {
      const card = element('article', '');
      card.append(element('span', `${task.priority} · ${task.category} · ${task.status}`, 'priority'), element('h2', task.title));
      card.append(element('p', `Next Action: ${task.next_action}`), element('p', `เหตุผล: ${task.ticket_triage.priority_reason}`), element('p', `ทีมที่เสนอ: ${task.ticket_triage.route}`));
      if (task.ticket_triage.missing_fields.length) card.append(element('p', `ข้อมูลที่ขาด: ${task.ticket_triage.missing_fields.join(', ')}`));
      const list = element('ol', '');
      for (const step of task.ticket_triage.steps) {
        const item = element('li', step.action);
        item.append(element('p', `วิธีตรวจสอบ: ${step.verify}${step.requires_approval ? ' · ต้องอนุมัติก่อนดำเนินการ' : ''}`)); list.append(item);
      }
      const details = element('details', '');
      details.append(element('summary', 'ดูหลักฐานและกฎที่ใช้'), element('pre', JSON.stringify(task.ticket_triage, null, 2)));
      card.append(list, details); $('results').append(card);
    }
    if (result.errors.length || result.conflicts.length) $('results').append(element('pre', JSON.stringify({errors: result.errors, conflicts: result.conflicts}, null, 2)));
    $('download').disabled = false;
  } catch (error) { result = undefined; $('message').textContent = `ประมวลผลไม่ได้: ${error.message}`; }
}
async function sample() {
  clear(); $('message').textContent = 'กำลังโหลดตัวอย่าง…';
  try {
    const response = await fetch(new URL('./ticket-triage-samples.json', import.meta.url));
    if (!response.ok) throw Error('Sample unavailable');
    $('tickets').value = JSON.stringify(await response.json(), null, 2); analyze();
  } catch (error) { $('message').textContent = error.message; }
}
$('sample').onclick = sample; $('analyze').onclick = analyze;
$('tickets').addEventListener('input', () => { clear(); $('message').textContent = 'ข้อมูลเปลี่ยนแล้ว กดวิเคราะห์ใหม่'; });
$('download').onclick = () => {
  if (!result) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'checkcom-ticket-triage-review.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
await sample();
