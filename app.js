"use strict";
// State / storage — a single versioned document.
const STORAGE_KEY = "family-travel-planner.v1";
const TYPES = ["景點", "餐廳", "交通", "住宿", "購物", "其他"];
const STATUSES = ["預計", "已預約", "已完成", "備案"];
const TRANSPORT_TYPES = ["飛機", "租車", "火車", "巴士", "船", "其他"];
const CATEGORIES = ["機票", "住宿", "交通", "門票", "餐飲", "購物", "其他"];
const $ = (id) => document.getElementById(id);
const uid = () => crypto.randomUUID();
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const dateValid = (s) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number(s.slice(0, 4)) >= 1900 &&
  Number(s.slice(0, 4)) <= 2100 &&
  !isNaN(Date.parse(s)) &&
  new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
function dateRange(start, end) {
  if (!dateValid(start) || !dateValid(end) || end < start)
    throw Error("請輸入有效日期，結束日期不可早於開始日期。");
  const count =
    Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (count > 366) throw Error("每趟旅程最多支援 366 天。");
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10),
  );
}
function createDefaultData() {
  const dates = dateRange("2026-10-20", "2026-10-25");
  const samples = [
    [
      ["14:00", "抵達神戶", "交通"],
      ["15:00", "Toyota Rent a Car 取車", "交通"],
      ["17:00", "飯店入住", "住宿"],
    ],
    [
      ["10:30", "姬路城", "景點", "預計停留 2 小時"],
      ["13:00", "魚之棚", "餐廳", "午餐"],
      ["15:30", "舞子海上散步", "景點"],
    ],
    [
      ["10:00", "海遊館", "景點"],
      ["15:00", "大阪市區", "購物"],
    ],
  ];
  return {
    version: 1,
    trip: {
      name: "神戶大阪家庭旅行",
      destination: "日本・神戶 / 大阪",
      startDate: dates[0],
      endDate: dates.at(-1),
      adults: 4,
      children: 2,
      notes: "這是示範資料，可直接修改。",
    },
    days: dates.map((date, i) => ({
      date,
      items: (samples[i] || []).map(([time, name, type, notes = ""]) => ({
        id: uid(),
        time,
        name,
        type,
        location: "",
        notes,
        status: "預計",
      })),
    })),
    lodging: [],
    transport: [],
    expenses: [],
    todos: ["買旅平險", "確認租車", "預約海遊館", "線上報到"].map((name) => ({
      id: uid(),
      name,
      done: false,
    })),
  };
}
// Validate AND normalize imported data. Unknown properties are never merged into state.
function validateData(raw) {
  const fail = () => {
    throw Error("JSON 結構不正確或欄位內容無效，資料未匯入。");
  };
  const obj = (o) => o && typeof o === "object" && !Array.isArray(o);
  const str = (o, k, max = 10000) => {
    if (typeof o[k] !== "string" || o[k].length > max) fail();
    return o[k];
  };
  const required = (o, k, max = 200) => {
    const s = str(o, k, max);
    if (!s.trim()) fail();
    return s;
  };
  const num = (o, k) => {
    if (!Number.isSafeInteger(o[k]) || o[k] < 0 || o[k] > 999) fail();
    return o[k];
  };
  const bool = (o, k) => {
    if (typeof o[k] !== "boolean") fail();
    return o[k];
  };
  const one = (o, k, options) => {
    if (!options.includes(o[k])) fail();
    return o[k];
  };
  const date = (o, k, optional = false) => {
    const s = str(o, k);
    if (!(optional && s === "") && !dateValid(s)) fail();
    return s;
  };
  const seen = new Set();
  const id = (o) => {
    const s = required(o, "id", 100);
    if (seen.has(s)) fail();
    seen.add(s);
    return s;
  };
  const rows = (list, fn) => {
    if (!Array.isArray(list) || list.length > 10000) fail();
    return list.map((o) => {
      if (!obj(o)) fail();
      return fn(o);
    });
  };
  if (!obj(raw) || raw.version !== 1 || !obj(raw.trip)) fail();
  const t = raw.trip;
  const trip = {
    name: required(t, "name"),
    destination: str(t, "destination", 200),
    startDate: date(t, "startDate"),
    endDate: date(t, "endDate"),
    adults: num(t, "adults"),
    children: num(t, "children"),
    notes: str(t, "notes"),
  };
  const dates = dateRange(trip.startDate, trip.endDate);
  const days = rows(raw.days, (d) => ({
    date: date(d, "date"),
    items: rows(d.items, (i) => {
      const time = str(i, "time");
      if (time !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail();
      return {
        id: id(i),
        time,
        name: required(i, "name"),
        type: one(i, "type", TYPES),
        location: str(i, "location", 500),
        notes: str(i, "notes"),
        status: one(i, "status", STATUSES),
      };
    }),
  }));
  if (days.length !== dates.length || days.some((d, i) => d.date !== dates[i]))
    fail();
  const lodging = rows(raw.lodging, (o) => {
    const r = {
      id: id(o),
      name: required(o, "name"),
      checkIn: date(o, "checkIn", true),
      checkOut: date(o, "checkOut", true),
      address: str(o, "address", 500),
      booking: str(o, "booking", 200),
      notes: str(o, "notes"),
    };
    if (r.checkIn && r.checkOut && r.checkOut < r.checkIn) fail();
    return r;
  });
  const transport = rows(raw.transport, (o) => {
    const datetime = str(o, "datetime");
    if (
      datetime &&
      (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(datetime) ||
        !dateValid(datetime.slice(0, 10)))
    )
      fail();
    return {
      id: id(o),
      type: one(o, "type", TRANSPORT_TYPES),
      name: required(o, "name"),
      datetime,
      from: str(o, "from", 500),
      to: str(o, "to", 500),
      booking: str(o, "booking", 200),
      notes: str(o, "notes"),
    };
  });
  const expenses = rows(raw.expenses, (o) => {
    if (
      typeof o.amount !== "number" ||
      !Number.isFinite(o.amount) ||
      o.amount < 0 ||
      o.amount > 1e12 ||
      Math.abs(o.amount * 100 - Math.round(o.amount * 100)) > 0.01
    )
      fail();
    const currency = str(o, "currency");
    if (!/^[A-Z]{3}$/.test(currency)) fail();
    return {
      id: id(o),
      category: one(o, "category", CATEGORIES),
      name: required(o, "name"),
      amount: o.amount,
      currency,
      paid: bool(o, "paid"),
    };
  });
  const todos = rows(raw.todos, (o) => ({
    id: id(o),
    name: required(o, "name"),
    done: bool(o, "done"),
  }));
  return { version: 1, trip, days, lodging, transport, expenses, todos };
}
let storageBlocked = false;
function notify(message) {
  $("notice").textContent = message;
}
function loadData() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text === null ? createDefaultData() : validateData(JSON.parse(text));
  } catch {
    storageBlocked = true;
    notify(
      "無法讀取已儲存資料，暫時顯示示範旅行且不覆寫原始資料。請先匯出目前資料；可用有效備份還原或清除資料解除保護。",
    );
    return createDefaultData();
  }
}
function saveData(next) {
  if (storageBlocked) {
    notify("儲存保護中：請先匯入有效備份或清除資料。目前變更未儲存。");
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    notify("無法儲存：瀏覽器儲存空間不足或已停用。請匯出備份後再試。");
    return false;
  }
}
let state = loadData();
function commit(next) {
  if (!saveData(next)) return false;
  state = next;
  render();
  notify("已儲存至此瀏覽器。");
  return true;
}
// Rendering — imported and user text is always escaped.
const fmtDate = (s) => s.replaceAll("-", "/");
const money = (n) =>
  new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(n);
function buttons(kind, id) {
  return `<div class="small-actions"><button data-action="edit" data-kind="${kind}" data-id="${esc(id)}">編輯</button><button class="danger" data-action="delete" data-kind="${kind}" data-id="${esc(id)}">刪除</button></div>`;
}
function empty(text) {
  return `<p class="empty">${text}</p>`;
}
function render() {
  const expanded = new Set(
    [...document.querySelectorAll("details.day[open]")].map(
      (x) => x.dataset.date,
    ),
  );
  const firstRender = !$("days").children.length;
  const t = state.trip;
  $("hero").innerHTML =
    `<p class="eyebrow">FAMILY TRAVEL JOURNAL</p><div class="hero-top"><h1>${esc(t.name)}</h1><button data-action="trip">編輯旅程</button></div><div class="meta"><span class="pill">${fmtDate(t.startDate)} — ${fmtDate(t.endDate)}</span><span class="pill">${state.days.length}天${state.days.length - 1}夜</span><span class="pill">${esc(t.destination || "尚未設定目的地")}</span><span class="pill">${t.adults}大${t.children}小</span></div>${t.notes ? `<p class="notes">${esc(t.notes)}</p>` : ""}`;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const next = state.days.find((d) => d.date >= today);
  $("upcoming").innerHTML = next
    ? `<p class="eyebrow">${next.date === today ? "TODAY · 今天" : "UP NEXT · 下一個旅程日"} · ${fmtDate(next.date)}</p><p>${
        next.items.length
          ? next.items
              .slice(0, 3)
              .map((i) => esc([i.time, i.name].filter(Boolean).join(" ")))
              .join(" → ")
          : "今天還有留白，安排一點喜歡的事吧。"
      }</p>`
    : "<p>這趟旅程已結束，回憶都留在這裡。也可以編輯日期，規劃下一次出發。</p>";
  $("days").innerHTML = state.days
    .map(
      (d, i) =>
        `<details class="day" data-date="${d.date}" ${firstRender ? (i < 3 ? "open" : "") : expanded.has(d.date) ? "open" : ""}><summary>Day ${i + 1} · ${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8))}（${"日一二三四五六"[new Date(d.date + "T00:00:00Z").getUTCDay()]}）<span class="muted">${d.items.length} 個行程</span></summary><div class="day-body"><ol class="timeline">${d.items.map((item, j) => `<li class="event"><time>${esc(item.time || "未定")}</time><article class="event-card"><h3>${esc(item.name)}</h3><span class="tag">${esc(item.type)}</span><span class="tag status">${esc(item.status)}</span>${item.location ? `<p class="notes muted">${esc(item.location)}</p>` : ""}${item.notes ? `<p class="notes">${esc(item.notes)}</p>` : ""}${buttons("itinerary", item.id)}<div class="small-actions"><button data-action="up" data-id="${esc(item.id)}" aria-label="上移 ${esc(item.name)}" ${j === 0 ? "disabled" : ""}>↑ 上移</button><button data-action="down" data-id="${esc(item.id)}" aria-label="下移 ${esc(item.name)}" ${j === d.items.length - 1 ? "disabled" : ""}>↓ 下移</button><button data-action="move" data-id="${esc(item.id)}">移到其他日期</button></div></article></li>`).join("")}</ol>${d.items.length ? "" : empty("空白的一天，也是一種期待。")}<button data-action="add" data-kind="itinerary" data-date="${d.date}">＋ 新增行程</button></div></details>`,
    )
    .join("");
  renderLodging();
  renderTransport();
  renderExpenses();
  renderTodos();
}
function renderLodging() {
  $("lodging").innerHTML =
    state.lodging
      .map(
        (o) =>
          `<article class="record"><h3>${esc(o.name)}</h3><p class="muted">入住 ${esc(o.checkIn || "未定")} → 退房 ${esc(o.checkOut || "未定")}</p><p>${esc(o.address)}</p>${o.booking ? `<p>訂房編號：${esc(o.booking)}</p>` : ""}<p class="notes">${esc(o.notes)}</p>${buttons("lodging", o.id)}</article>`,
      )
      .join("") || empty("把每晚安心休息的地方記在這裡。");
}
function renderTransport() {
  $("transport").innerHTML =
    state.transport
      .map(
        (o) =>
          `<article class="record"><span class="tag">${esc(o.type)}</span><h3>${esc(o.name)}</h3><p class="muted">${esc(o.datetime.replace("T", " ") || "時間未定")}</p><p>${esc(o.from || "出發地未定")} → ${esc(o.to || "目的地未定")}</p>${o.booking ? `<p>訂位編號：${esc(o.booking)}</p>` : ""}<p class="notes">${esc(o.notes)}</p>${buttons("transport", o.id)}</article>`,
      )
      .join("") || empty("記下航班、車次或租車資訊。");
}
function renderExpenses() {
  const totals = {};
  state.expenses.forEach((o) => {
    totals[o.currency] ??= { total: 0, paid: 0 };
    totals[o.currency].total += Math.round(o.amount * 100);
    if (o.paid) totals[o.currency].paid += Math.round(o.amount * 100);
  });
  $("budget").innerHTML =
    Object.entries(totals)
      .map(
        ([currency, v]) =>
          `<div class="budget-group"><h3>${currency}</h3><div class="budget-values"><div><span>已知總支出</span><strong>${money(v.total / 100)}</strong></div><div><span>已付款</span><strong>${money(v.paid / 100)}</strong></div><div><span>未付款</span><strong>${money((v.total - v.paid) / 100)}</strong></div></div></div>`,
      )
      .join("") || empty("尚未新增支出。");
  $("expenses").innerHTML = state.expenses
    .map(
      (o) =>
        `<article class="record"><span class="tag">${esc(o.category)}</span><span class="tag status">${o.paid ? "已付款" : "未付款"}</span><h3>${esc(o.name)} · ${esc(o.currency)} ${money(o.amount)}</h3>${buttons("expenses", o.id)}</article>`,
    )
    .join("");
}
function renderTodos() {
  $("todos").innerHTML =
    state.todos
      .map(
        (o) =>
          `<div class="todo"><label class="${o.done ? "done" : ""}"><input type="checkbox" data-todo="${esc(o.id)}" ${o.done ? "checked" : ""}>${esc(o.name)}</label>${buttons("todos", o.id)}</div>`,
      )
      .join("") || empty("新增一件待辦，讓出發更從容。");
}
// Shared accessible form editor.
const field = (
  key,
  label,
  type = "text",
  options = null,
  required = false,
) => ({ key, label, type, options, required });
const schemas = {
  trip: [
    field("name", "旅程名稱", "text", null, true),
    field("destination", "目的地"),
    field("startDate", "開始日期", "date", null, true),
    field("endDate", "結束日期", "date", null, true),
    field("adults", "大人人數", "number", null, true),
    field("children", "小孩人數", "number", null, true),
    field("notes", "備註", "textarea"),
  ],
  itinerary: [
    field("time", "時間", "time"),
    field("name", "名稱", "text", null, true),
    field("type", "類型", "select", TYPES),
    field("status", "狀態", "select", STATUSES),
    field("location", "地點 / 地址"),
    field("notes", "備註", "textarea"),
  ],
  lodging: [
    field("name", "名稱", "text", null, true),
    field("checkIn", "入住日期", "date"),
    field("checkOut", "退房日期", "date"),
    field("address", "地址"),
    field("booking", "訂房編號"),
    field("notes", "備註", "textarea"),
  ],
  transport: [
    field("type", "類型", "select", TRANSPORT_TYPES),
    field("name", "公司 / 名稱", "text", null, true),
    field("datetime", "日期時間", "datetime-local"),
    field("from", "取車 / 搭乘地點"),
    field("to", "還車 / 抵達地點"),
    field("booking", "訂位編號"),
    field("notes", "備註", "textarea"),
  ],
  expenses: [
    field("category", "分類", "select", CATEGORIES),
    field("name", "名稱", "text", null, true),
    field("amount", "金額", "number", null, true),
    field("currency", "幣別（3 碼，例如 TWD / JPY / USD）", "text", null, true),
    field("paid", "付款狀態", "select", ["未付款", "已付款"]),
  ],
  todos: [field("name", "待辦事項", "text", null, true)],
  move: [field("date", "移到日期", "select")],
};
const labels = {
  trip: "旅程",
  itinerary: "行程",
  lodging: "住宿",
  transport: "交通",
  expenses: "支出",
  todos: "待辦",
};
let editing = null;
function findItem(data, id) {
  for (const day of data.days) {
    const index = day.items.findIndex((i) => i.id === id);
    if (index >= 0) return { day, index, item: day.items[index] };
  }
  return null;
}
function openEditor(kind, id = null, date = null) {
  let value = {};
  if (kind === "trip") value = state.trip;
  else if (kind === "itinerary" || kind === "move")
    value = findItem(state, id)?.item || {};
  else value = state[kind]?.find((o) => o.id === id) || {};
  editing = { kind, id, date };
  $("form-error").textContent = "";
  $("editor-title").textContent =
    kind === "move"
      ? "移到其他日期"
      : `${kind === "trip" ? "編輯" : id ? "編輯" : "新增"}${labels[kind]}`;
  $("fields").innerHTML = schemas[kind]
    .map((f) => {
      const v =
        f.key === "paid"
          ? value.paid
            ? "已付款"
            : "未付款"
          : (value[f.key] ??
            (f.key === "currency"
              ? "TWD"
              : f.type === "number"
                ? kind === "trip"
                  ? 0
                  : ""
                : ""));
      let control;
      if (f.type === "select") {
        const opts =
          kind === "move"
            ? state.days.map((d, i) => ({
                value: d.date,
                label: `Day ${i + 1} · ${d.date}`,
              }))
            : f.options.map((s) => ({ value: s, label: s }));
        control = `<select id="f-${f.key}" name="${f.key}">${opts.map((o) => `<option value="${esc(o.value)}" ${o.value === (kind === "move" ? findItem(state, id).day.date : v) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
      } else if (f.type === "textarea")
        control = `<textarea id="f-${f.key}" name="${f.key}" maxlength="10000">${esc(v)}</textarea>`;
      else
        control = `<input id="f-${f.key}" name="${f.key}" type="${f.type}" value="${esc(v)}" ${f.required ? "required" : ""} ${f.type === "number" ? `min="0" max="${kind === "expenses" ? "1000000000000" : "999"}" step="${kind === "expenses" ? "0.01" : "1"}"` : ""} ${f.type.includes("date") ? 'min="1900-01-01" max="2100-12-31"' : ""} ${f.type === "text" ? `maxlength="${f.key === "location" || f.key === "address" || f.key === "from" || f.key === "to" ? 500 : 200}"` : ""} ${f.key === "currency" ? 'pattern="[A-Za-z]{3}" minlength="3" maxlength="3"' : ""}>`;
      return `<label class="field ${f.type === "textarea" || f.key === "name" || f.key === "currency" ? "wide" : ""}" for="f-${f.key}">${f.label}${f.required ? " *" : ""}${control}</label>`;
    })
    .join("");
  $("editor").showModal();
}
// Trip editing / itinerary / lodging / transport / expenses / todos.
$("editor-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const { kind, id, date } = editing;
  const values = Object.fromEntries(new FormData(event.target));
  for (const k in values) values[k] = values[k].trim();
  const next = structuredClone(state);
  try {
    if (kind === "trip") {
      values.adults = Number(values.adults);
      values.children = Number(values.children);
      const dates = dateRange(values.startDate, values.endDate);
      if (next.days.some((d) => !dates.includes(d.date) && d.items.length))
        throw Error(
          "日期範圍外仍有行程，請先移動或刪除這些行程，再修改旅程日期。",
        );
      next.trip = values;
      next.days = dates.map(
        (date) => next.days.find((d) => d.date === date) || { date, items: [] },
      );
    } else if (kind === "move") {
      const source = findItem(next, id);
      const target = next.days.find((d) => d.date === values.date);
      if (source.day !== target)
        target.items.push(source.day.items.splice(source.index, 1)[0]);
    } else {
      if (kind === "expenses") {
        values.amount = Number(values.amount);
        values.currency = values.currency.toUpperCase();
        values.paid = values.paid === "已付款";
      }
      if (kind === "todos")
        values.done = id ? next.todos.find((o) => o.id === id).done : false;
      values.id = id || uid();
      if (kind === "itinerary") {
        if (id) {
          const found = findItem(next, id);
          found.day.items[found.index] = values;
        } else next.days.find((d) => d.date === date).items.push(values);
      } else {
        const index = next[kind].findIndex((o) => o.id === id);
        if (index >= 0) next[kind][index] = values;
        else next[kind].push(values);
      }
    }
    const valid = validateData(next);
    if (commit(valid)) $("editor").close();
  } catch (error) {
    $("form-error").textContent = error.message;
  }
});
$("todos").addEventListener("change", (event) => {
  if (!event.target.dataset.todo) return;
  const next = structuredClone(state);
  next.todos.find((o) => o.id === event.target.dataset.todo).done =
    event.target.checked;
  if (!commit(next)) renderTodos();
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, kind, id, date } = button.dataset;
  if (action === "close") {
    $("editor").close();
    return;
  }
  if (action === "trip") {
    openEditor("trip");
    return;
  }
  if (action === "add" || action === "edit") {
    openEditor(kind, id, date);
    return;
  }
  if (action === "move") {
    openEditor("move", id);
    return;
  }
  if (action === "delete") {
    if (!confirm("確定刪除這筆資料？")) return;
    const next = structuredClone(state);
    if (kind === "itinerary") {
      const found = findItem(next, id);
      found.day.items.splice(found.index, 1);
    } else next[kind] = next[kind].filter((o) => o.id !== id);
    commit(next);
    return;
  }
  if (action === "up" || action === "down") {
    const next = structuredClone(state);
    const { day, index } = findItem(next, id);
    const other = index + (action === "up" ? -1 : 1);
    if (other >= 0 && other < day.items.length) {
      [day.items[index], day.items[other]] = [
        day.items[other],
        day.items[index],
      ];
      commit(next);
      const moved = [
        ...document.querySelectorAll(`button[data-action="${action}"]`),
      ].find((b) => b.dataset.id === id);
      if (moved && !moved.disabled) moved.focus();
    }
    return;
  }
  if (action === "export") exportData();
  if (action === "import") $("import-file").click();
  if (action === "clear") clearData();
});
// JSON import / export. Clear creates a genuinely empty trip, not another demo.
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `family-travel-planner-${state.trip.startDate}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("JSON 備份已匯出，請妥善保存。");
}
$("import-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw Error("備份檔案不可超過 5 MB。");
    const next = validateData(JSON.parse(await file.text()));
    if (!confirm("匯入將取代目前的所有旅程資料。建議先匯出備份，確定繼續？"))
      return;
    const blocked = storageBlocked;
    storageBlocked = false;
    if (!commit(next)) storageBlocked = blocked;
  } catch (error) {
    notify(
      `匯入失敗：${error instanceof SyntaxError ? "不是有效的 JSON 檔案。" : error.message}`,
    );
  }
});
function clearData() {
  if (!confirm("確定要清除所有旅程資料？建議先匯出 JSON 備份。")) return;
  if (!confirm("再次確認：此操作無法復原。要清除並建立空白旅程嗎？")) return;
  const next = {
    version: 1,
    trip: {
      name: "我的家庭旅行",
      destination: "",
      startDate: "2026-10-20",
      endDate: "2026-10-20",
      adults: 0,
      children: 0,
      notes: "",
    },
    days: [{ date: "2026-10-20", items: [] }],
    lodging: [],
    transport: [],
    expenses: [],
    todos: [],
  };
  const blocked = storageBlocked;
  storageBlocked = false;
  if (!commit(next)) storageBlocked = blocked;
}
render();
if (!storageBlocked) {
  try {
    if (localStorage.getItem(STORAGE_KEY) === null) saveData(state);
  } catch {
    notify("此瀏覽器無法儲存資料。");
  }
}
