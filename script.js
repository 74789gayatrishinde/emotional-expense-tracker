// ======= Storage Helpers =======
const STORAGE_KEY = "emotional_expenses_v1";

function getData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}
function setData(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// ======= DOM =======
const form = document.getElementById("expense-form");
const amount = document.getElementById("amount");
const dateEl = document.getElementById("date");
const category = document.getElementById("category");
const description = document.getElementById("description");
const payment = document.getElementById("payment");
const mood = document.getElementById("mood");
const tableBody = document.querySelector("#expense-table tbody");

const statTotal = document.getElementById("stat-total");
const statCount = document.getElementById("stat-count");
const statTopMood = document.getElementById("stat-top-mood");
const insightBox = document.getElementById("insight-box");

const search = document.getElementById("search");
const filterMood = document.getElementById("filter-mood");
const filterMonth = document.getElementById("filter-month");
const clearFilters = document.getElementById("clear-filters");

const resetStorageBtn = document.getElementById("reset-storage");
const exportCsvBtn = document.getElementById("export-csv");
const importJsonBtn = document.getElementById("import-json");
const importFile = document.getElementById("import-file");

let moodChart, timeChart, categoryChart;

// Default date = today
dateEl.valueAsDate = new Date();

// ======= Render =======
function render() {
  const items = applyFilters(getData());
  renderTable(items);
  renderStats(items);
  renderInsights(items);
  renderCharts(items);
}

function applyFilters(data) {
  return data.filter((x) => {
    const q = (search.value || "").toLowerCase();
    const matchesText =
      !q ||
      (x.description || "").toLowerCase().includes(q) ||
      (x.category || "").toLowerCase().includes(q);

    const matchesMood = !filterMood.value || x.mood === filterMood.value;

    const matchesMonth =
      !filterMonth.value ||
      (new Date(x.date)).toISOString().slice(0, 7) === filterMonth.value;

    return matchesText && matchesMood && matchesMonth;
  });
}

function renderTable(items) {
  tableBody.innerHTML = "";
  items
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((x, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatDate(x.date)}</td>
        <td>₹${(+x.amount).toFixed(2)}</td>
        <td>${x.category || "-"}</td>
        <td>${x.description || "-"}</td>
        <td>${x.payment || "-"}</td>
        <td><span class="badge mood-${x.mood}">${x.mood}</span></td>
        <td><button class="delete-btn" data-id="${x.id}">Delete</button></td>
      `;
      tableBody.appendChild(tr);
    });

  // delete handlers
  tableBody.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const arr = getData().filter((x) => x.id !== id);
      setData(arr);
      render();
    });
  });
}

function renderStats(items) {
  const total = items.reduce((s, x) => s + +x.amount, 0);
  statTotal.textContent = "₹" + total.toFixed(2);
  statCount.textContent = items.length;

  const byMood = groupSum(items, "mood");
  const top = Object.entries(byMood).sort((a, b) => b[1] - a[1])[0];
  statTopMood.textContent = top ? `${top[0]} · ₹${top[1].toFixed(0)}` : "–";
}

function renderInsights(items) {
  if (items.length < 3) {
    insightBox.textContent = "Add a few expenses to unlock insights.";
    return;
  }
  // Spend by mood
  const byMood = groupSum(items, "mood");
  const sorted = Object.entries(byMood).sort((a, b) => b[1] - a[1]);
  const topMood = sorted[0]?.[0];

  // Average ticket size when Stressed vs Calm/Happy
  const avg = (arr) => (arr.reduce((s, x) => s + +x.amount, 0) / (arr.length || 1));
  const stressedAvg = avg(items.filter((x) => x.mood === "Stressed"));
  const calmAvg = avg(items.filter((x) => x.mood === "Calm"));
  const happyAvg = avg(items.filter((x) => x.mood === "Happy"));

  // Day-of-week pattern
  const byDow = {};
  items.forEach((x) => {
    const d = new Date(x.date).getDay(); // 0=Sun
    byDow[d] = (byDow[d] || 0) + +x.amount;
  });
  const maxDow = Object.entries(byDow).sort((a, b) => b[1] - a[1])[0]?.[0];
  const dowName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][+maxDow || 0];

  // Compose message
  const parts = [];
  if (topMood) parts.push(`You spend the most when you feel **${topMood}**.`);
  if (stressedAvg > (calmAvg || 0) && stressedAvg > (happyAvg || 0)) {
    parts.push(`Average purchase size is higher when **Stressed** (₹${stressedAvg.toFixed(0)}).`);
  }
  parts.push(`Peak spend day: **${dowName}**.`);
  insightBox.innerHTML = parts.join(" ");
}

function renderCharts(items) {
  // Cleanup existing charts
  [moodChart, timeChart, categoryChart].forEach((c) => c && c.destroy());

  // Spend by Mood
  const byMood = groupSum(items, "mood");
  const moodLabels = Object.keys(byMood);
  const moodValues = Object.values(byMood);
  const moodCtx = document.getElementById("moodChart");
  moodChart = new Chart(moodCtx, {
    type: "bar",
    data: { labels: moodLabels, datasets: [{ label: "₹ Spend", data: moodValues }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales:{ y:{ beginAtZero:true } } }
  });

  // Spend over Time (by date)
  const byDate = {};
  items.forEach((x) => {
    const d = new Date(x.date).toISOString().slice(0, 10);
    byDate[d] = (byDate[d] || 0) + +x.amount;
  });
  const datesSorted = Object.keys(byDate).sort();
  const timeValues = datesSorted.map((d) => byDate[d]);
  const timeCtx = document.getElementById("timeChart");
  timeChart = new Chart(timeCtx, {
    type: "line",
    data: { labels: datesSorted, datasets: [{ label: "₹ per day", data: timeValues, tension: 0.25 }] },
    options: { responsive: true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
  });

  // Category breakdown
  const byCat = groupSum(items, "category");
  const catLabels = Object.keys(byCat);
  const catValues = Object.values(byCat);
  const catCtx = document.getElementById("categoryChart");
  categoryChart = new Chart(catCtx, {
    type: "doughnut",
    data: { labels: catLabels, datasets: [{ data: catValues }] },
    options: { responsive: true }
  });
}

// ======= Utils =======
function formatDate(d) {
  const x = new Date(d);
  return x.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function groupSum(items, key) {
  return items.reduce((acc, x) => {
    const k = (x[key] || "Uncategorized");
    acc[k] = (acc[k] || 0) + +x.amount;
    return acc;
  }, {});
}

// ======= Handlers =======
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!amount.value || !mood.value || !dateEl.value) return;

  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    amount: +amount.value,
    date: dateEl.value,
    category: category.value.trim(),
    description: description.value.trim(),
    payment: payment.value,
    mood: mood.value
  };
  const arr = getData();
  arr.push(item);
  setData(arr);

  form.reset();
  dateEl.valueAsDate = new Date();
  render();
});

resetStorageBtn.addEventListener("click", () => {
  if (confirm("Clear all saved expenses?")) {
    localStorage.removeItem(STORAGE_KEY);
    render();
  }
});

[search, filterMood, filterMonth].forEach((el) => el.addEventListener("input", render));
clearFilters.addEventListener("click", () => {
  search.value = "";
  filterMood.value = "";
  filterMonth.value = "";
  render();
});

exportCsvBtn.addEventListener("click", () => {
  const rows = getData();
  const header = ["id","date","amount","category","description","payment","mood"];
  const csv = [
    header.join(","),
    ...rows.map(r => header.map(h => JSON.stringify(String(r[h] ?? ""))).join(","))
  ].join("\n");
  downloadFile("emotional-expenses.csv", "text/csv", csv);
});

importJsonBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
  const file = importFile.files[0];
  if (!file) return;
  const text = await file.text();
  try{
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("Invalid JSON format");
    setData(parsed);
    render();
    alert("Import successful!");
  } catch(err){
    alert("Import failed: " + err.message);
  } finally{
    importFile.value = "";
  }
});

function downloadFile(name, type, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ======= Init =======
render();
