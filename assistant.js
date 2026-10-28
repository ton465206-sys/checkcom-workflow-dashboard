(() => {
  const $ = id => document.getElementById(id);
  const key = 'checkcom-assistant-tasks-v1';
  let tasks = [];
  let pending = null;
  let voiceReply = false;
  const history = [];
  const apiUrl = (window.CHECKCOM_API_URL || '').replace(/\/$/, '');
  const dashboardListeners = new Set();
  let dashboardState = {tasks: [], connected: false, error: 'ໃສ່ລະຫັດ ແລະເຊື່ອມຕໍ່ຖານກາງຢູ່ດ້ານເທິງ'};
  function broadcastDashboard(state) {
    dashboardState = state;
    for (const listener of dashboardListeners) { try { listener(structuredClone(state)); } catch {} }
  }
  if (!apiUrl) { try { tasks = JSON.parse(localStorage.getItem(key) || '[]'); } catch { tasks = []; } }
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
  async function callApi(path, payload, method = 'POST') {
    const response = await fetch(apiUrl + path, { method, headers: { 'content-type': 'application/json', 'x-access-code': $('access-code').value }, ...(method === 'GET' ? {} : { body: JSON.stringify(payload) }), cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) { const error = new Error(response.status === 409 ? 'ข้อมูลถูกแก้จากอีกช่องทางแล้ว โหลดข้อมูลล่าสุดและเลือกคำสั่งใหม่อีกครั้ง' : data.error || 'บริการขัดข้อง'); error.status = response.status; throw error; }
    return data;
  }
  async function refreshShared() {
    try {
      if (!apiUrl || !$('access-code').value.trim()) throw new Error('ໃສ່ລະຫັດເຂົ້າໃຊ້ຖານກາງຢູ່ໜ້າຫຼັກ');
      const data = await callApi('/tasks', undefined, 'GET');
      if (!Array.isArray(data.tasks)) throw new Error('ข้อมูลรายการงานจาก API ไม่ถูกต้อง');
      tasks = data.tasks;
      broadcastDashboard({tasks, connected: true, error: ''});
      return tasks;
    } catch (error) {
      tasks = [];
      broadcastDashboard({tasks: [], connected: false, error: error.message});
      throw error;
    }
  }
  function confirmShared(message, task, expectedVersion) {
    // Capture the approved version and preserve every existing task field.
    const payload = { request_id: crypto.randomUUID(), task: { ...task }, ...(expectedVersion === undefined ? {} : { expected_version: expectedVersion }) };
    confirm(message, async () => {
      try {
        await callApi('/tasks/write', payload);
        try { await refreshShared(); render(); say('บันทึกในฐานข้อมูลกลางแล้ว'); }
        catch { say('บันทึกในฐานข้อมูลกลางแล้ว แต่โหลดรายการล่าสุดไม่สำเร็จ กรุณารีเฟรช'); }
      } catch (error) {
        if (error.status === 409) { try { await refreshShared(); render(); } catch {} }
        say(error.message);
      }
    });
  }
  async function runShared(raw) {
    // A new command invalidates an older unconfirmed operation.
    pending = null; $('confirm').hidden = true;
    if (!$('access-code').value.trim()) return say('กรุณาใส่รหัสเข้าใช้งาน');
    const command = raw.trim();
    if (!command) return say('กรุณาพูดหรือพิมพ์คำสั่ง');
    try { await refreshShared(); } catch (error) { return say(error.message); }
    const add = command.match(/^(?:เพิ่มงาน|สร้างงาน|จดงาน|ເພີ່ມວຽກ)\s+(.+)$/i);
    if (add) return confirmShared(`เพิ่มงาน “${add[1]}” ใช่ไหม`, { title: add[1], status: 'รอดำเนินการ' });
    const search = command.match(/^(?:ค้นงาน|หางาน|ค้นหา|ຄົ້ນຫາ)\s+(.+)$/i);
    if (search) { const found = tasks.filter(task => `${task.title} ${task.segment || ''}`.toLocaleLowerCase().includes(search[1].toLocaleLowerCase())); render(found); return say(`พบ ${found.length} งาน`); }
    const update = command.match(/^(?:เปลี่ยนสถานะงาน|อัปเดตงาน|ปิดงาน)\s*(\d+)(?:\s*(?:เป็น|ให้เป็น)\s*(เสร็จแล้ว|กำลังทำ|รอดำเนินการ))?$/i);
    const stage = command.match(/^\/(?:stage)\s+#?(\d+)\s+(.+)$/i);
    const followup = command.match(/^\/followup\s+#?(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(.+)$/i);
    const progress = command.match(/^\/(check|uncheck|contact|uncontact|clearblocker)\s+#?(\d+)$/i);
    const blocker = command.match(/^\/blocker\s+#?(\d+)\s+(.+)$/i);
    if (update || stage || followup || progress || blocker) {
      const id = Number(progress ? progress[2] : (update || stage || followup || blocker)[1]);
      const current = tasks.find(task => task.id === id);
      if (!current) return say('ไม่พบเลขงานนี้');
      if (!Number.isInteger(current.version)) return say('งานนี้ไม่มีเวอร์ชันจากฐานกลาง กรุณาตรวจ API ก่อนแก้ไข');
      const next = { ...current };
      let label;
      if (update) { next.status = update[2] || 'เสร็จแล้ว'; label = `เปลี่ยนงาน ${id} เป็น “${next.status}” ใช่ไหม`; }
      if (stage) { next.stage = stage[2].trim(); label = `เปลี่ยนขั้นตอนงาน ${id} เป็น “${next.stage}” ใช่ไหม`; }
      if (followup) {
        const date = new Date(`${followup[2]}T00:00:00Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== followup[2]) return say('วันที่ติดตามไม่ถูกต้อง');
        next.follow_up_date = followup[2]; next.follow_up_note = followup[3].trim(); label = `นัดติดตามงาน ${id} วันที่ ${next.follow_up_date}: ${next.follow_up_note} ใช่ไหม`;
      }
      if (progress) {
        const action = progress[1].toLowerCase(); const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
        if (action === 'clearblocker') next.blocker = '';
        else if (action.includes('contact')) { next.contacted = action === 'contact'; next.contacted_at = next.contacted ? today : ''; if (next.contacted) { next.checked = true; next.checked_at ||= today; } }
        else { next.checked = action === 'check'; next.checked_at = next.checked ? today : ''; }
        label = `บันทึกผลที่คุณแจ้งสำหรับงาน ${id} ใช่ไหม (ไม่ได้ติดต่อหรือโทรแทนคุณ)`;
      }
      if (blocker) { next.blocker = blocker[2].trim(); label = `บันทึกจุดติดขัดงาน ${id}: ${next.blocker} ใช่ไหม`; }
      return confirmShared(label, next, current.version);
    }
    if (/^(?:สรุปงาน|ดูงาน|รายการงาน|ສະຫຼຸບວຽກ)$/i.test(command)) { render(); return say(`มี ${tasks.length} งาน เสร็จแล้ว ${tasks.filter(task => task.status === 'เสร็จแล้ว').length} งาน`); }
    return runAi(command);
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
        try { const result = await callApi('/confirm', { token: data.confirmation_token }); await refreshShared(); render(); say(result.reply); }
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
  const dispatch = command => apiUrl ? runShared(command) : run(command);
  window.CheckComTaskGateway = {
    async readPerformance(period){if(!apiUrl||!$('access-code').value.trim())throw new Error('ເຊື່ອມຕໍ່ຖານກາງຢູ່ດ້ານເທິງກ່ອນ');return structuredClone(await callApi('/performance?period='+encodeURIComponent(period),undefined,'GET'));},
    async performanceHistory(period){if(!apiUrl||!$('access-code').value.trim())throw new Error('ເຊື່ອມຕໍ່ຖານກາງກ່ອນ');return structuredClone(await callApi('/performance/history?period='+encodeURIComponent(period),undefined,'GET'));},
    async writePerformance(payload){if(!apiUrl||!$('access-code').value.trim())throw new Error('ເຊື່ອມຕໍ່ຖານກາງກ່ອນ');return structuredClone(await callApi('/performance/write',payload));},
    read: async () => structuredClone(await refreshShared()),
    subscribe(listener) {
      dashboardListeners.add(listener);
      listener(structuredClone(dashboardState));
      return () => dashboardListeners.delete(listener);
    },
    async write(task, expectedVersion) {
      if (!apiUrl || !$('access-code').value.trim()) throw new Error('ເຊື່ອມຕໍ່ຖານກາງກ່ອນບັນທຶກ');
      try {
        const result = await callApi('/tasks/write', {request_id: crypto.randomUUID(), task, ...(task.id ? {expected_version: expectedVersion} : {})});
        tasks = result.tasks;
        broadcastDashboard({tasks, connected: true, error: ''});
        render();
        return structuredClone(result);
      } catch (error) {
        if (error.status === 409) { try { await refreshShared(); } catch {} }
        else if (error.status === 401 || error.status === 403) { tasks = []; broadcastDashboard({tasks: [], connected: false, error: error.message}); }
        throw error;
      }
    }
  };
  window.dispatchEvent?.(new Event('checkcom-gateway-ready'));
  const connectButton = $('connect-api');
  if (connectButton) {
    connectButton.hidden = !apiUrl;
    connectButton.onclick = async () => {
      if (!$('access-code').value.trim()) return say('ใส่รหัสเข้าใช้งานฐานกลางก่อน');
      sessionStorage.setItem('checkcom-access-code', $('access-code').value);
      try { await refreshShared(); render(); say('เชื่อมต่อฐานกลางแล้ว เลือกค้นงานหรือพิมพ์คำสั่งได้เลย'); }
      catch (error) { say(error.message); }
    };
  }
  if (!apiUrl) $('access-code').hidden = true;
  $('command-form').onsubmit = event => { event.preventDefault(); dispatch($('command').value); };
  if (!apiUrl) say(publicSync ? 'ค้นชื่อองค์กรและดูขั้นตอนได้ที่นี่ อัปเดตขั้นตอนด้วยบอต Telegram' : localSync ? 'ใช้คำสั่งพื้นฐาน ข้อมูลงานซิงก์กับบอต Telegram บนเครื่องนี้' : 'AI สนทนายังไม่เชื่อมต่อ ตอนนี้ใช้คำสั่งพื้นฐาน ข้อมูลงานเก็บเฉพาะเบราว์เซอร์นี้');
  if (apiUrl) {
    $('access-code').value = sessionStorage.getItem('checkcom-access-code') || '';
    $('access-code').addEventListener('change', () => { pending = null; $('confirm').hidden = true; tasks = []; broadcastDashboard({tasks: [], connected: false, error: 'ກຳລັງເຊື່ອມຕໍ່'}); render(); sessionStorage.setItem('checkcom-access-code', $('access-code').value); if ($('access-code').value.trim()) refreshShared().then(() => { render(); say('เชื่อมต่อฐานข้อมูลกลางแล้ว'); }).catch(error => say(error.message)); });
    if ($('access-code').value.trim()) refreshShared().then(() => { render(); say('เชื่อมต่อฐานข้อมูลกลางแล้ว'); }).catch(error => say(error.message));
    else say('ใส่รหัสเข้าใช้งานเพื่ออ่านและแก้งานร่วมกับ Telegram');
    setInterval(() => { if ($('access-code').value.trim()) refreshShared().then(() => render()).catch(error => say(error.message)); }, 30000);
  } else {
    if (localSync || publicSync) refreshLocal().then(() => render()).catch(() => {});
    if (publicSync) setInterval(() => refreshLocal().then(() => render()).catch(() => {}), 30000);
  }
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
