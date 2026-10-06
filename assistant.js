(() => {
  const $ = id => document.getElementById(id);
  const key = 'checkcom-assistant-tasks-v1';
  let tasks = JSON.parse(localStorage.getItem(key) || '[]');
  let pending = null;
  const say = message => { $('voice-result').textContent = message; };
  const save = () => localStorage.setItem(key, JSON.stringify(tasks));
  function render(items = tasks) {
    $('tasks').hidden = false;
    $('task-list').replaceChildren();
    if (!items.length) { const li = document.createElement('li'); li.textContent = 'ยังไม่มีงาน'; $('task-list').append(li); return; }
    items.forEach(task => { const li = document.createElement('li'); li.textContent = `${task.id}. ${task.title} — ${task.status}`; $('task-list').append(li); });
  }
  function confirm(message, action) { pending = action; $('confirm-text').textContent = message; $('confirm').hidden = false; }
  $('confirm-yes').onclick = () => { if (pending) pending(); pending = null; $('confirm').hidden = true; };
  $('confirm-no').onclick = () => { pending = null; $('confirm').hidden = true; say('ยกเลิกแล้ว'); };
  function run(raw) {
    const command = raw.trim();
    if (!command) return say('กรุณาพูดหรือพิมพ์คำสั่ง');
    say(`ได้ยิน: ${command}`);
    const add = command.match(/^(?:เพิ่มงาน|สร้างงาน|จดงาน|ເພີ່ມວຽກ)\s+(.+)$/i);
    if (add) return confirm(`เพิ่มงาน “${add[1]}” ใช่ไหม`, () => { const id = Math.max(0, ...tasks.map(t => t.id)) + 1; tasks.push({ id, title: add[1], status: 'รอดำเนินการ' }); save(); render(); say(`เพิ่มงานเลข ${id} แล้ว`); });
    const search = command.match(/^(?:ค้นงาน|หางาน|ค้นหา|ຄົ້ນຫາ)\s+(.+)$/i);
    if (search) { const found = tasks.filter(t => t.title.toLowerCase().includes(search[1].toLowerCase())); render(found); return say(`พบ ${found.length} งาน`); }
    const update = command.match(/^(?:เปลี่ยนสถานะงาน|อัปเดตงาน|ปิดงาน)\s*(\d+)(?:\s*(?:เป็น|ให้เป็น)\s*(เสร็จแล้ว|กำลังทำ|รอดำเนินการ))?$/i);
    if (update) { const task = tasks.find(t => t.id === Number(update[1])); if (!task) return say('ไม่พบเลขงานนี้'); const status = update[2] || 'เสร็จแล้ว'; return confirm(`เปลี่ยนงาน ${task.id} เป็น “${status}” ใช่ไหม`, () => { task.status = status; save(); render(); say('เปลี่ยนสถานะแล้ว'); }); }
    if (/^(?:สรุปงาน|ดูงาน|รายการงาน|ສະຫຼຸບວຽກ)$/i.test(command)) { render(); return say(`มี ${tasks.length} งาน เสร็จแล้ว ${tasks.filter(t => t.status === 'เสร็จแล้ว').length} งาน`); }
    if (/(?:เวิร์กโฟลว์|workflow|ວຽກ)/i.test(command)) { document.querySelector('[data-page="workflow"]').click(); return say('เปิด Workflow แล้ว'); }
    if (/(?:แดชบอร์ด|dashboard|ยอดขาย|ทีมขาย)/i.test(command)) { document.querySelector('[data-page="sales"]').click(); return say('เปิด Dashboard ทีมขายแล้ว'); }
    say('ยังไม่เข้าใจคำสั่ง ลอง “เพิ่มงาน …”, “ค้นงาน …”, “ปิดงาน 1”, “สรุปงาน” หรือ “เปิดแดชบอร์ด”');
  }
  $('command-form').onsubmit = event => { event.preventDefault(); run($('command').value); };
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) { $('mic').disabled = true; say('เบราว์เซอร์นี้ไม่รองรับการรู้จำเสียง ใช้ช่องพิมพ์คำสั่งแทนได้'); return; }
  $('mic').onclick = () => {
    const recognition = new Recognition(); recognition.lang = $('speech-language').value; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onresult = event => { const transcript = event.results[0][0].transcript; $('command').value = transcript; run(transcript); };
    recognition.onerror = event => say(`ไมโครโฟน: ${event.error} กรุณาตรวจสิทธิ์และลองใหม่`);
    recognition.onstart = () => say('กำลังฟัง...');
    recognition.start();
  };
})();
