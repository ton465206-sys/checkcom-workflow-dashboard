(() => {
  const gateway = () => {
    try { return window.parent !== window && window.parent.location.origin === location.origin ? window.parent.CheckComTaskGateway : null; }
    catch { return null; }
  };
  const waiting = [];
  let attached = false;
  function attach() {
    const api = gateway();
    if (!api || attached) return;
    attached = true;
    for (const entry of waiting) if (entry.active) entry.unsubscribe = api.subscribe(entry.listener);
  }
  window.CheckComData = {
    async read() {
      attach(); const api = gateway();
      if (!api) throw new Error('ເປີດໜ້ານີ້ຜ່ານສູນງານ CheckCom ແລ້ວເຊື່ອມຕໍ່ຖານກາງ');
      return api.read();
    },
    async write(task, version) {
      const api = gateway();
      if (!api) throw new Error('ເຊື່ອມຕໍ່ຖານກາງຢູ່ໜ້າຫຼັກກ່ອນ');
      return api.write(task, version);
    },
    subscribe(listener) {
      const entry = {listener, active: true}; waiting.push(entry);
      const api = gateway();
      if (api) { attached = true; entry.unsubscribe = api.subscribe(listener); }
      else listener({tasks: [], connected: false, error: 'ເຊື່ອມຕໍ່ຖານກາງຢູ່ດ້ານເທິງກ່ອນ'});
      return () => { entry.active = false; entry.unsubscribe?.(); };
    }
  };
  try { window.parent.addEventListener('checkcom-gateway-ready', attach); } catch {}
  attach();
})();
