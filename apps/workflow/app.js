const departments = [
  {
    name: "Marketing",
    short: "MKT",
    score: 82,
    weight: 20,
    trend: "+12.5%",
    status: "On Track",
    goal: "ສ້າງ Brand Awareness, ດຶງດູດລູກຄ້າໃໝ່, ແລະສົ່ງ Qualified Leads ໃຫ້ Sale/Sale Support.",
    kpis: [
      ["Qualified Leads", 86],
      ["CPL / CAC", 74],
      ["Engagement & Reach", 88],
      ["ROAS", 80],
    ],
    workflow: "Input ຫາລູກຄ້າ",
  },
  {
    name: "Sale Support & PO",
    short: "SS/PO",
    score: 76,
    weight: 20,
    trend: "+8.8%",
    status: "Watch",
    goal: "ອອກ Quotation ໄວ, ຈັດຊື້ຖືກຕ້ອງ, ແລະປິດ PO ທັນເວລາ.",
    kpis: [
      ["Quotation Turnaround", 72],
      ["Document Accuracy", 84],
      ["Procurement Lead Time", 68],
      ["Cost Savings", 80],
    ],
    workflow: "Quotation → PO",
  },
  {
    name: "HR & Admin",
    short: "HR",
    score: 79,
    weight: 15,
    trend: "+6.2%",
    status: "On Track",
    goal: "ສັນຫາ/ພັດທະນາຄົນ, ດູແລສະພາບແວດລ້ອມ, ແລະສະໜັບສະໜູນຊັບພະຍາກອນ.",
    kpis: [
      ["Turnover Rate", 78],
      ["Time to Hire", 74],
      ["Training Success", 82],
      ["Employee Satisfaction", 83],
    ],
    workflow: "Support ທຸກພະແນກ",
  },
  {
    name: "Finance & Accounting",
    short: "FIN",
    score: 71,
    weight: 20,
    trend: "-2.8%",
    status: "Risk",
    goal: "ບໍລິຫານ Cash Flow, ຕິດຕາມເກັບເງິນ, ຈ່າຍ Supplier, ແລະປິດລາຍງານ.",
    kpis: [
      ["DSO", 66],
      ["Compliance Accuracy", 86],
      ["Cash Flow Balance", 70],
      ["Month-End Closing", 62],
    ],
    workflow: "Invoice → Collection",
  },
  {
    name: "Technical & Service",
    short: "TECH",
    score: 84,
    weight: 25,
    trend: "+15.2%",
    status: "Strong",
    goal: "ຕິດຕັ້ງ, ຊ່ອມບຳລຸງ, ແລະບໍລິການຫຼັງການຂາຍໃຫ້ລູກຄ້າພໍໃຈ.",
    kpis: [
      ["CSAT", 88],
      ["First-Time Fix", 80],
      ["Resolution Time", 78],
      ["Renewal Rate", 90],
    ],
    workflow: "Install → Handover",
  },
];

const weightedScore = Math.round(
  departments.reduce((sum, item) => sum + item.score * item.weight, 0) /
    departments.reduce((sum, item) => sum + item.weight, 0),
);

function riskClass(score) {
  if (score < 73) return "danger";
  if (score < 78) return "warning";
  return "";
}

function statusClass(status) {
  if (status === "Risk") return "danger";
  if (status === "Watch") return "warn";
  return "";
}

document.querySelector("#overview").innerHTML = departments
  .map(
    (department, index) => `
      <article class="metric-card ${riskClass(department.score)}">
        <div>
          <small>${index + 1}. ${department.name}</small>
          <strong>${department.score}%</strong>
          <div class="delta">${department.trend} performance</div>
        </div>
        <span class="spark"></span>
      </article>
    `,
  )
  .join("");

document.querySelector("#riskList").innerHTML = [...departments]
  .sort((a, b) => a.score - b.score)
  .slice(0, 3)
  .map(
    (department) => `
      <div class="risk-item">
        <strong>${department.name}</strong>
        <small>${department.workflow} • ${department.score}%</small>
        <div class="bar"><span style="width:${department.score}%"></span></div>
      </div>
    `,
  )
  .join("");

document.querySelector("#workflowRow").innerHTML = departments
  .map(
    (department) => `
      <div class="flow-card">
        <div>
          <strong>${department.short}</strong>
          <p>${department.workflow}</p>
        </div>
        <span class="pill">${department.weight}%</span>
      </div>
    `,
  )
  .join("");

document.querySelector("#legend").innerHTML = departments
  .map(
    (department) => `
      <li>
        <span>${department.name}</span>
        <strong>${department.weight}% weight</strong>
      </li>
    `,
  )
  .join("");

document.querySelector("#overallDonut span").textContent = `${weightedScore}%`;

document.querySelector("#departments").innerHTML = departments
  .map(
    (department) => `
      <article class="department-card">
        <header>
          <h3>${department.name}</h3>
          <span class="pill">${department.score}%</span>
        </header>
        <p>${department.goal}</p>
        <div class="kpi-list">
          ${department.kpis
            .map(
              ([label, value]) => `
                <div class="kpi-row">
                  <header><span>${label}</span><strong>${value}%</strong></header>
                  <div class="bar"><span style="width:${value}%"></span></div>
                </div>
              `,
            )
            .join("")}
        </div>
      </article>
    `,
  )
  .join("");

document.querySelector("#analysisTable").innerHTML = `
  <div class="table-row header">
    <span>ພະແນກ</span>
    <span>ບົດບາດໃນ Workflow</span>
    <span>Score</span>
    <span>Status</span>
  </div>
  ${departments
    .map(
      (department) => `
      <div class="table-row">
        <span>${department.name}</span>
        <span>${department.workflow}</span>
        <strong>${department.score}%</strong>
        <span class="status ${statusClass(department.status)}">${department.status}</span>
      </div>
    `,
    )
    .join("")}
`;

const primaryValues = [52, 61, 67, 64, 72, 78, 74, 83, 76, 88, 82, 92, 79, 86, 84, 94, 82, 77, 90, 96];
const targetValues = [48, 58, 63, 70, 68, 75, 80, 78, 84, 86, 90, 88, 92, 84, 88, 90, 91, 88, 92, 95];

function buildPath(values) {
  const width = 720;
  const height = 220;
  const left = 20;
  const top = 20;
  const max = 100;
  const min = 40;
  return values
    .map((value, index) => {
      const x = left + (index / (values.length - 1)) * width;
      const y = top + height - ((value - min) / (max - min)) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildArea(values) {
  const line = buildPath(values);
  return `${line} L 740 250 L 20 250 Z`;
}

document.querySelector(".line-path.primary").setAttribute("d", buildPath(primaryValues));
document.querySelector(".line-path.target").setAttribute("d", buildPath(targetValues));
document.querySelector(".area-path").setAttribute("d", buildArea(primaryValues));

document.querySelector(".grid-lines").innerHTML = Array.from({ length: 6 })
  .map((_, index) => {
    const y = 25 + index * 40;
    return `<line x1="20" x2="740" y1="${y}" y2="${y}"></line>`;
  })
  .join("");

document.querySelector(".plot-points").innerHTML = primaryValues
  .map((value, index) => {
    const x = 20 + (index / (primaryValues.length - 1)) * 720;
    const y = 20 + 220 - ((value - 40) / 60) * 220;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#ff8a2a" stroke="#111820" stroke-width="2"></circle>`;
  })
  .join("");
