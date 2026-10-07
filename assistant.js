(() => {
  const $ = id => document.getElementById(id);
  const key = 'checkcom-assistant-tasks-v1';
  let tasks = JSON.parse(localStorage.getItem(key) || '[]');
  let pending = null;
  let voiceReply = false;
  const history = [];
  const apiUrl = (window.CHECKCOM_API_URL || '').replace(/\/$/, '');
  const localSync = location.hostname === '127.0.0.1' && location.port === '8765';
  const publicSync = location.hostname.endsWith('.github.io');
  const botUrl = 'https://t.me/CheckcomMoneyBot';
  const say = message => { $('voice-result').textContent = message; if (voiceReply && 'speechSynthesis' in window) { speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(message); utterance.lang = $('speech-language').value; speechSynthesis.speak(utterance); voiceReply = false; } };
  function sendToBot(command) {
    say('คำสั่งนี้ต้องยืนยันกับบอต Telegram เพื่อบันทึกขึ้นเว็บ');
    const copy = document.createElement('button');
    copy.type = 'button'; copy.textContent = 'คัดลอกคำสั่ง';
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(command); copy.textContent = 'คัดลอกแล้ว'; }
      catch { $('command').focus(); $('command').select(); copy.textContent = 'เลือกข้อความแล้ว กดคัดลอก'; }
    };
    const link = document.createElement('a');
    link.href = botUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = 'เปิดบอต Telegram';
    link.style.marginLeft = '10px';
    $('voice-result').append(' ', copy, ' ', link);
  }
  const save = () => localStorage.setItem(key, JSON.stringify(tasks));
  async function refreshLocal() { if (localSync) { const response = await fetch('/api/tasks'); tasks = (await response.json()).tasks; } else if (publicSync) { const response = await fetch('data/tasks.json?now=' + Date.now(), { cache: 'no-store' }); if (response.ok) tasks = await response.json(); } }
  async function changeLocal(payload) { if (localSync) { const response = await fetch('/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }); if (!response.ok) throw new Error('บันทึกงานไม่สำเร็จ'); tasks = (await response.json()).tasks; } else save(); }
  async function callApi(path, payload) {
    const response = await fetch(apiUrl + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-access-code': $('access-code').value }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'บริการขัดข้อง');
    return data;
  }
  async function runAi(command) {
    if (!$('access-code').value) return say('กรุณาใส่รหัสเข้าใช้งาน AI');
    $('voice-result').textContent = 'กำลังประมวลผลคำสั่ง...';
    try {
      const data = await callApi('/chat', { message: command, history: history.slice(-6) });
      history.push({ user: command, assistant: data.reply });
      if (data.page) document.querySelector(`[data-page="${data.page}"]`)?.click();
      if (data.tasks) render(data.tasks);
      say(data.reply);
      if (data.confirmation_token) confirm(data.reply, async () => {
        try { const result = await callApi('/confirm', { token: data.confirmation_token }); render(result.tasks); say(result.reply); }
        catch (error) { say(error.message); }
      });
    } catch (error) { say(error.message); }
  }
  function render(items = tasks) {
    $('tasks').hidden = false;
    $('task-list').replaceChildren();
    const query = ($('task-filter')?.value || '').toLocaleLowerCase().trim();
    const found = query ? items.filter(task => `${task.title} ${task.segment || ''}`.toLocaleLowerCase().includes(query)) : items;
    $('task-count').textContent = `พบ ${found.length} จาก ${tasks.length} รายการ${found.length > 30 ? ' (แสดง 30 รายการแรก)' : ''}`;
    if (!found.length) { const li = document.createElement('li'); li.textContent = 'ไม่พบรายการ'; $('task-list').append(li); return; }
    found.slice(0, 30).forEach(task => { const li = document.createElement('li'); li.textContent = `#${task.id} ${task.title} (${task.segment || 'อื่น ๆ'}) — ${task.stage || task.status}`; $('task-list').append(li); });
  }
  $('task-filter')?.addEventListener('input', () => render());
  function confirm(message, action) { pending = action; $('confirm-text').textContent = message; $('confirm').hidden = false; }
  $('confirm-yes').onclick = async () => { const action = pending; pending = null; $('confirm').hidden = true; try { if (action) await action(); } catch (error) { say(error.message); } };
  $('confirm-no').onclick = () => { pending = null; $('confirm').hidden = true; say('ยกเลิกแล้ว'); };
  async function run(raw) {
    try { await refreshLocal(); } catch { return say('โหลดงานในเครื่องไม่สำเร็จ'); }
    const command = raw.trim();
    if (!command) return say('กรุณาพูดหรือพิมพ์คำสั่ง');
    if (publicSync && /(?:เพิ่มงาน|สร้างงาน|จดงาน|ปิดงาน|เปลี่ยนสถานะ|อัปเดตงาน|ช่วยจด|ເພີ່ມວຽກ)/i.test(command)) return sendToBot(command);
    say(`ได้ยิน: ${command}`);
    const add = command.match(/^(?:เพิ่มงาน|สร้างงาน|จดงาน|ເພີ່ມວຽກ)\s+(.+)$/i);
    if (add) return confirm(`เพิ่มงาน “${add[1]}” ใช่ไหม`, async () => { const id = Math.max(0, ...tasks.map(t => t.id)) + 1; if (!localSync) tasks.push({ id, title: add[1], status: 'รอดำเนินการ' }); await changeLocal({ action: 'add', title: add[1] }); render(); say(`เพิ่มงานเลข ${id} แล้ว`); });
    const search = command.match(/^(?:ค้นงาน|หางาน|ค้นหา|ຄົ້ນຫາ)\s+(.+)$/i);
    if (search) { const found = tasks.filter(t => t.title.toLowerCase().includes(search[1].toLowerCase())); render(found); return say(`พบ ${found.length} งาน`); }
    const update = command.match(/^(?:เปลี่ยนสถานะงาน|อัปเดตงาน|ปิดงาน)\s*(\d+)(?:\s*(?:เป็น|ให้เป็น)\s*(เสร็จแล้ว|กำลังทำ|รอดำเนินการ))?$/i);
    if (update) { const task = tasks.find(t => t.id === Number(update[1])); if (!task) return say('ไม่พบเลขงานนี้'); const status = update[2] || 'เสร็จแล้ว'; return confirm(`เปลี่ยนงาน ${task.id} เป็น “${status}” ใช่ไหม`, async () => { if (!localSync) task.status = status; await changeLocal({ action: 'update', id: task.id, status }); render(); say('เปลี่ยนสถานะแล้ว'); }); }
    if (/^(?:สรุปงาน|ดูงาน|รายการงาน|ສະຫຼຸບວຽກ)$/i.test(command)) { render(); return say(`มี ${tasks.length} งาน เสร็จแล้ว ${tasks.filter(t => t.status === 'เสร็จแล้ว').length} งาน`); }
    if (/(?:เวิร์กโฟลว์|workflow|ວຽກ)/i.test(command)) { document.querySelector('[data-page="workflow"]').click(); return say('เปิด Workflow แล้ว'); }
    if (/(?:แดชบอร์ด|dashboard|ยอดขาย|ทีมขาย)/i.test(command)) { document.querySelector('[data-page="sales"]').click(); return say('เปิด Dashboard ทีมขายแล้ว'); }
    if (/(?:เอกสาร|document)/i.test(command)) { document.querySelector('[data-page="documents"]').click(); return say('เปิดส่วนเอกสารแล้ว'); }
    if (publicSync) return sendToBot(command);
    say('ยังไม่เข้าใจคำสั่ง ลอง “เพิ่มงาน …”, “ค้นงาน …”, “ปิดงาน 1”, “สรุปงาน” หรือ “เปิดแดชบอร์ด”');
  }
  const dispatch = command => apiUrl ? runAi(command) : run(command);
  if (!apiUrl) $('access-code').hidden = true;
  $('command-form').onsubmit = event => { event.preventDefault(); dispatch($('command').value); };
  if (!apiUrl) say(publicSync ? 'ค้นชื่อองค์กรและดูขั้นตอนได้ที่นี่ อัปเดตขั้นตอนด้วยบอต Telegram' : localSync ? 'ใช้คำสั่งพื้นฐาน ข้อมูลงานซิงก์กับบอต Telegram บนเครื่องนี้' : 'AI สนทนายังไม่เชื่อมต่อ ตอนนี้ใช้คำสั่งพื้นฐาน ข้อมูลงานเก็บเฉพาะเบราว์เซอร์นี้');
  if (localSync || publicSync) refreshLocal().then(() => render()).catch(() => {});
  if (publicSync) setInterval(() => refreshLocal().then(() => render()).catch(() => {}), 30000);
  else { $('access-code').value = sessionStorage.getItem('checkcom-access-code') || ''; $('access-code').addEventListener('change', () => sessionStorage.setItem('checkcom-access-code', $('access-code').value)); }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) { $('mic').disabled = true; say('เบราว์เซอร์นี้ไม่รองรับการรู้จำเสียง ใช้ช่องพิมพ์คำสั่งแทนได้'); return; }
  $('mic').onclick = () => {
    const recognition = new Recognition(); recognition.lang = $('speech-language').value; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onresult = event => { const transcript = event.results[0][0].transcript; $('command').value = transcript; voiceReply = true; dispatch(transcript); };
    recognition.onerror = event => say(`ไมโครโฟน: ${event.error} กรุณาตรวจสิทธิ์และลองใหม่`);
    recognition.onstart = () => say('กำลังฟัง...');
    recognition.start();
  };
})();
