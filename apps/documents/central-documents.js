(() => {
  const $ = id => document.getElementById(id);
  let tasks = [], busy = false;
  function render(state) {
    tasks = state.connected ? state.tasks : [];
    const selected = $('centralDocTask').value;
    $('centralDocTask').replaceChildren(); $('centralDocList').replaceChildren();
    for (const task of tasks) {
      const option = document.createElement('option'); option.value = String(task.id); option.textContent = `#${task.id} ${task.title}`; $('centralDocTask').append(option);
    }
    if (tasks.some(t => String(t.id) === selected)) $('centralDocTask').value = selected;
    let count = 0;
    for (const task of tasks) {
      for (const doc of Array.isArray(task.documents) ? task.documents : []) {
        const row = document.createElement('p'); const link = document.createElement('a');
        try { const url = new URL(doc.url); if (!['https:', 'http:'].includes(url.protocol)) continue; link.href = url.href; } catch { continue; }
        link.textContent = doc.title || doc.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        row.textContent = `#${task.id} ${task.title} — `; row.append(link); $('centralDocList').append(row); count++;
      }
    }
    $('centralDocAdd').disabled = !state.connected || busy || !tasks.length;
    $('centralDocStatus').textContent = state.connected ? `${tasks.length} ວຽກ · ${count} ລິ້ງເອກະສານໃນຖານກາງ` : state.error || 'ຍັງບໍ່ເຊື່ອມຕໍ່';
    if (state.connected && !count) $('centralDocList').textContent = 'ຍັງບໍ່ມີລິ້ງເອກະສານທີ່ບັນທຶກໄວ້';
  }
  window.CheckComData.subscribe(render);
  $('centralDocForm').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const task = tasks.find(t => String(t.id) === $('centralDocTask').value);
    if (!task) return;
    const title = $('centralDocTitle').value.trim(); let url;
    try { url = new URL($('centralDocUrl').value); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw Error(); }
    catch { $('centralDocStatus').textContent = 'ໃຊ້ລິ້ງ http ຫຼື https ທີ່ບໍ່ມີລະຫັດຜ່ານ'; return; }
    if (!title || title.length > 200) return;
    busy = true; $('centralDocAdd').disabled = true;
    try {
      await window.CheckComData.write({...task, documents: [...(Array.isArray(task.documents) ? task.documents : []), {id: crypto.randomUUID(), title, url: url.href, added_at: new Date().toISOString()}]}, task.version);
      $('centralDocTitle').value = ''; $('centralDocUrl').value = '';
      $('centralDocStatus').textContent = 'ບັນທຶກລິ້ງໃນຖານກາງແລ້ວ';
    } catch (error) { $('centralDocStatus').textContent = error.message; }
    finally { busy = false; $('centralDocAdd').disabled = !tasks.length; }
  });
})();
