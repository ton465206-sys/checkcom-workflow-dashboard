// Offline CheckCom adapter. This is an executable rule engine, not an LLM call.
export const TRIAGE_VERSION = '1.0.0';
export const SKILL_REVISION = '2574e29377c7173d0cecffef29a6ecbd7f8ccb5d';
export const REVIEW_STATUS = 'รอตรวจสอบ';
const SERVICES = ['network', 'cctv', 'access-control', 'fire-alarm', 'workstation', 'email', 'application', 'unknown'];
const ENVIRONMENTS = ['production', 'test', 'unknown'];
const IMPACTS = ['single', 'team', 'site', 'multiple-sites', 'unknown'];
const FLAGS = ['business_blocked', 'workaround_available', 'service_unavailable', 'security_incident', 'data_loss'];
const CATEGORIES = [
  ['security', /unauthorized|breach|ransomware|phishing|มัลแวร์|ไม่ได้รับอนุญาต|ບໍ່ໄດ້ຮັບອະນຸຍາດ/i],
  ['data', /missing data|corrupt|data loss|ข้อมูลหาย|ข้อมูลเสีย|ຂໍ້ມູນຫາຍ/i],
  ['billing', /invoice|refund|payment|ใบแจ้งหนี้|ชำระเงิน|ໃບແຈ້ງໜີ້/i],
  ['integration', /\bapi\b|webhook|oauth|integration|sync|เชื่อมระบบ|ເຊື່ອມລະບົບ/i],
  ['bug', /crash|\berror\b|broken|not working|ใช้งานไม่ได้|ຜິດພາດ/i],
  ['account', /login|password|permission|locked out|เข้าสู่ระบบ|รหัสผ่าน|ລະຫັດຜ່ານ/i],
  ['performance', /slow|timeout|latency|unavailable|\bdown\b|ช้า|ล่ม|ຊ້າ|ລົ້ມ/i],
  ['feature-request', /feature request|wish|enhancement|เพิ่มฟีเจอร์|อยากให้เพิ่ม|ເພີ່ມຟັງຊັນ/i],
  ['how-to', /how (do|to|can)|configure|วิธี|ตั้งค่า|ວິທີ|ຕັ້ງຄ່າ/i]
];

function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function string(value, name, max, required = false) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' || value.length > max) throw Error(`Invalid ${name}: expected text up to ${max} characters`);
  const result = value.normalize('NFC').trim();
  if (required && !result) throw Error(`Missing ${name}: stable ticket identity is required`);
  return result;
}
function choice(value, choices, name) {
  if (value === undefined || value === null || value === '') return 'unknown';
  if (!choices.includes(value)) throw Error(`Invalid ${name}`);
  return value;
}

export function normalizeTicket(input) {
  if (!record(input)) throw Error('Ticket must be an object');
  const t = {
    source: string(input.source, 'source', 80, true),
    id: string(input.id, 'id', 120, true),
    title: string(input.title, 'title', 240),
    description: string(input.description, 'description', 4000),
    service: choice(input.service, SERVICES, 'service'),
    environment: choice(input.environment, ENVIRONMENTS, 'environment'),
    impact: choice(input.impact, IMPACTS, 'impact'),
    affected_users: input.affected_users ?? null,
    owner: string(input.owner, 'owner', 160)
  };
  if (t.affected_users !== null && (!Number.isSafeInteger(t.affected_users) || t.affected_users < 0)) throw Error('Invalid affected_users');
  for (const field of FLAGS) {
    const value = input[field] ?? null;
    if (value !== null && typeof value !== 'boolean') throw Error(`Invalid ${field}: expected boolean or null`);
    t[field] = value;
  }
  return t;
}

function classify(t) {
  if (t.security_incident === true) return {category: 'security', rule: 'CAT-SECURITY-REPORTED', evidence: {security_incident: true}};
  if (t.data_loss === true) return {category: 'data', rule: 'CAT-DATA-REPORTED', evidence: {data_loss: true}};
  const text = `${t.title}\n${t.description}`;
  for (const [category, pattern] of CATEGORIES) {
    const match = text.match(pattern);
    if (match) return {category, rule: `CAT-TEXT-${category.toUpperCase()}`, evidence: {matched_text: match[0]}};
  }
  return {category: 'unknown', rule: 'CAT-UNKNOWN', evidence: {}};
}

function prioritize(t, category, missing) {
  if (t.security_incident === true || t.data_loss === true) return {
    priority: 'P1', rule: 'PRI-CRITICAL-REPORT', reason: 'Reported active security incident or data loss; escalate for immediate verification.',
    evidence: {security_incident: t.security_incident, data_loss: t.data_loss}
  };
  if (t.environment === 'production' && t.service_unavailable === true && ['site', 'multiple-sites'].includes(t.impact)) return {
    priority: 'P1', rule: 'PRI-PRODUCTION-OUTAGE', reason: 'Reported production outage affects a whole site or multiple sites.',
    evidence: {environment: t.environment, service_unavailable: t.service_unavailable, impact: t.impact}
  };
  if (t.service === 'fire-alarm') return {
    priority: 'P2', rule: 'PRI-LIFE-SAFETY-REVIEW', reason: 'Fire alarm report needs prompt review by an authorized specialist.', evidence: {service: t.service}
  };
  if (t.business_blocked === true && (t.workaround_available !== true || ['site', 'multiple-sites'].includes(t.impact) || t.affected_users >= 10)) return {
    priority: 'P2', rule: 'PRI-BLOCKED', reason: 'Reported blocked work has no confirmed workaround or broad impact.',
    evidence: {business_blocked: t.business_blocked, workaround_available: t.workaround_available, impact: t.impact, affected_users: t.affected_users}
  };
  if (missing.length || category === 'unknown' || category === 'security') return {
    priority: 'P2', rule: 'PRI-PROVISIONAL', reason: 'Impact or classification needs verification; do not silently assign low priority.', evidence: {missing_fields: missing, category}
  };
  if (['how-to', 'feature-request'].includes(category) && t.business_blocked === false && t.service_unavailable === false) return {
    priority: 'P4', rule: 'PRI-QUESTION', reason: 'Non-blocking guidance or enhancement request.', evidence: {category, business_blocked: false, service_unavailable: false}
  };
  return {priority: 'P3', rule: 'PRI-LIMITED', reason: 'No reported critical trigger; limited impact or available workaround.', evidence: {impact: t.impact, workaround_available: t.workaround_available}};
}

function steps(t, category, missing, priority) {
  const out = [];
  const add = (action, verify, approval = false) => out.push({action, verify, requires_approval: approval});
  if (category === 'security' || t.data_loss === true) {
    add('Escalate the reported incident to the IT Support lead/security contact; preserve existing logs. Do not reset or delete evidence.', 'Reviewer records incident reference, affected assets, timestamps and the assigned incident owner.');
  } else if (priority === 'P1') {
    add('Escalate the reported production outage to the IT Support lead before investigating; confirm the affected site and available continuity procedure.', 'Record lead acknowledgement, affected service and incident reference; priority remains a proposal until reviewed.');
  }
  if (missing.length) add(`Request missing fields: ${missing.join(', ')}. Do not request passwords or access tokens.`, 'Support reviewer records the missing facts and reruns triage.');
  if (t.service === 'network') {
    add('Inspect authorized switch/AP link, PoE and port status; compare affected and working devices.', 'Record port/link indicators and whether the failure follows one device, AP, VLAN or whole site.');
    add('Inspect assigned IP, DHCP lease, gateway and DNS settings; compare with the approved network design.', 'Record which layer differs from a working device; redact addresses or logs before sharing outside the team.');
  } else if (t.service === 'cctv') {
    add('Inspect authorized camera/NVR online state, PoE/link status, recorder clock and storage health without changing configuration.', 'Record affected camera labels, timestamps and live-view versus recording results; do not export identifiable footage.');
  } else if (t.service === 'access-control') {
    add('Ask the authorized access-control technician to inspect controller power, door state and existing event logs. Do not unlock doors or bypass controls.', 'Record controller/door labels and the last successful event; verify safe egress through the responsible site team.');
  } else if (t.service === 'fire-alarm') {
    add('Notify the site responsible person and authorized fire-alarm specialist; follow the site emergency procedure if danger is reported. Do not silence, disable or reset from this prototype.', 'Record panel indication, zone and specialist acknowledgement; any functional test follows the approved site procedure.');
  } else {
    add('Inspect existing error messages, timestamps and authorized application/device status; compare with a working session.', 'Record reproducible symptoms and expected versus observed behavior without collecting credentials.');
  }
  add('Propose a reversible fix only after the failing component is verified; obtain reviewer approval before configuration changes, restart, reset or remote execution.', 'Record approved change, rollback plan and a before/after functional check.', true);
  return out;
}

export function ticketKey(t) {
  return `ticket-triage:${encodeURIComponent(t.source)}:${encodeURIComponent(t.id)}`;
}

export function triageTicket(input) {
  const t = normalizeTicket(input);
  const missing = ['title', 'description'].filter(k => !t[k]);
  for (const field of ['service', 'environment', 'impact']) if (t[field] === 'unknown') missing.push(field);
  for (const field of FLAGS) if (t[field] === null) missing.push(field);
  if (t.affected_users === null) missing.push('affected_users');
  const classification = classify(t);
  const decision = prioritize(t, classification.category, missing);
  const actions = steps(t, classification.category, missing, decision.priority);
  const route = classification.category === 'security' ? 'IT Support / Security lead' : t.service === 'fire-alarm' ? 'IT Support / Authorized fire-alarm specialist' : classification.category === 'billing' ? 'IT Support / Finance review' : classification.category === 'feature-request' ? 'IT Support / Product review' : 'IT Support';
  return {
    title: `IT Support · ${t.id} · ${t.title || 'Ticket details required'}`,
    department: 'Technical', owner: t.owner, status: REVIEW_STATUS, stage: 'Ticket triage review',
    priority: decision.priority, category: classification.category, service: t.service,
    next_action: actions[0].action, follow_up_date: '',
    action_plan: actions.map((s, i) => `${i + 1}. ${s.action}\nVerify: ${s.verify}`).join('\n'),
    department_plugin: {plugin: 'customer-support', skill: 'ticket-triage', module: 'technical', source_revision: SKILL_REVISION, approval: 'pending_review'},
    ticket_triage: {
      version: TRIAGE_VERSION, mode: 'offline-rules', key: ticketKey(t), source: t.source, ticket_id: t.id,
      input_signature: JSON.stringify(t), category_rule: classification.rule, category_evidence: classification.evidence,
      priority_rule: decision.rule, priority_reason: decision.reason, priority_evidence: decision.evidence,
      priority_provisional: missing.length > 0, missing_fields: missing, route, steps: actions,
      evidence_status: 'reported_not_verified', diagnosis: 'unconfirmed', known_issue_check: 'not_connected',
      resolution_status: 'not_executed', external_connectors_enabled: false
    }
  };
}

export function triageTickets(tickets) {
  if (!Array.isArray(tickets) || tickets.length > 500) throw Error('Expected an array of at most 500 tickets');
  const tasks = [], errors = [], duplicates = [], conflicts = [], seen = new Map(), conflicted = new Set();
  tickets.forEach((ticket, index) => {
    try {
      const task = triageTicket(ticket), meta = task.ticket_triage;
      if (seen.has(meta.key)) {
        if (seen.get(meta.key).ticket_triage.input_signature === meta.input_signature) duplicates.push({index, key: meta.key});
        else { conflicted.add(meta.key); conflicts.push({index, key: meta.key, reason: 'Same identity has changed input; review before saving.'}); }
      } else { seen.set(meta.key, task); tasks.push(task); }
    } catch (error) { errors.push({index, error: error.message}); }
  });
  return {tasks: tasks.filter(t => !conflicted.has(t.ticket_triage.key)).sort((a, b) => a.priority.localeCompare(b.priority) || a.ticket_triage.key.localeCompare(b.ticket_triage.key)), errors, duplicates, conflicts};
}

// Only exact source+ID repeats are suppressed. Similar symptoms are not proof of duplication.
export function mergeTriageTasks(existing, incoming) {
  if (!Array.isArray(existing) || !Array.isArray(incoming)) throw Error('Expected task arrays');
  const tasks = structuredClone(existing), added = [], duplicates = [], conflicts = [];
  const seen = new Map();
  const validate = task => {
    const m = task?.ticket_triage;
    if (!m || typeof m.input_signature !== 'string') throw Error('Invalid triage record');
    const normalized = normalizeTicket(JSON.parse(m.input_signature));
    if (m.key !== ticketKey(normalized) || m.input_signature !== JSON.stringify(normalized)) throw Error('Invalid triage identity');
    return m;
  };
  for (const task of tasks) {
    const m = validate(task);
    if (seen.has(m.key)) throw Error('Store already contains duplicate ticket identities');
    seen.set(m.key, task);
  }
  const candidates = new Map(), ambiguous = new Set();
  for (const task of incoming) {
    const m = validate(task), prior = candidates.get(m.key);
    if (prior && (prior.input_signature !== m.input_signature || prior.version !== m.version)) ambiguous.add(m.key);
    candidates.set(m.key, m);
  }
  const reported = new Set();
  for (const task of incoming) {
    const m = validate(task), prior = seen.get(m.key);
    if (ambiguous.has(m.key)) {
      if (!reported.has(m.key)) conflicts.push({key: m.key, reason: 'Conflicting inputs in the same save batch; no version selected.'});
      reported.add(m.key); continue;
    }
    if (prior) {
      if (prior.ticket_triage.input_signature === m.input_signature && prior.ticket_triage.version === m.version) duplicates.push(m.key);
      else conflicts.push({key: m.key, reason: 'Input or rule version changed; existing review is preserved.'});
    } else {
      // Never persist an executable/completed task through the prototype store.
      if (task.status !== REVIEW_STATUS || task.department_plugin?.approval !== 'pending_review') throw Error('Only pending-review drafts may be added');
      const copy = structuredClone(task); tasks.push(copy); added.push(m.key); seen.set(m.key, copy);
    }
  }
  return {tasks, added, duplicates, conflicts};
}
