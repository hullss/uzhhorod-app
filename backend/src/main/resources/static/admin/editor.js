import { EVENT_FIELDS, POINT_FIELDS, eventFromFields, pointFromFields, isSafetyKind, validPointCoordinates, validateDocument } from "./model.js";
const el = id => document.getElementById(id);
let draft = null, loadedKind = null, loadedKey = null, dirty = false, rawDirty = false, busy = false, editingId = null;
const today = () => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map(type => parts.find(p => p.type === type).value).join("-");
};
const message = value => { el("status").textContent = value; };
let form = el("event-form");
const fields = () => isSafetyKind(loadedKind) ? POINT_FIELDS : EVENT_FIELDS;
const fieldEl = field => el(isSafetyKind(loadedKind) ? `point-${field}` : field);
const closeForms = () => { el("event-form").hidden = true; el("point-form").hidden = true; };
function confirmChange(text) {
  const dialog = el("confirm-dialog");
  el("confirm-message").textContent = text; dialog.returnValue = "cancel";
  return new Promise(resolve => { dialog.addEventListener("close", () => resolve(dialog.returnValue === "accept"), { once: true }); dialog.showModal(); });
}
function render() {
  el("workspace").hidden = !draft;
  el("load").disabled = busy;
  el("save").disabled = busy || !draft || !dirty || rawDirty || !form.hidden;
  el("add").disabled = busy || rawDirty || !form.hidden;
  el("apply-json").disabled = busy || !rawDirty || !form.hidden;
  el("content").disabled = busy || !form.hidden;
  el("document").disabled = busy; el("key").disabled = busy;
  if (!draft) return;
  const events = loadedKind === "events";
  const safety = isSafetyKind(loadedKind);
  el("search-label").hidden = !events && !safety;
  el("map-notice").hidden = !safety;
  el("add").hidden = !events && !safety;
  el("add").textContent = safety ? (loadedKind === "shelters" ? "Додати укриття" : "Додати пункт незламності") : "Додати подію";
  if (!events && !safety) el("advanced").open = true;
  if (!rawDirty) el("content").value = JSON.stringify(draft, null, 2);
  el("draft-state").textContent = rawDirty ? "Спочатку застосуйте зміни з редактора JSON до списку." : dirty ? "Є неопубліковані зміни. Натисніть «Опублікувати зміни», коли все перевірите." : `Опубліковано записів: ${draft.items.length}.`;
  el("draft-state").className = dirty || rawDirty ? "unsaved" : "";
  const list = el("events-list"); list.replaceChildren();
  if (!events && !safety) return;
  for (const item of [...draft.items].sort((a, b) => (events ? a.date.localeCompare(b.date) : a.name.localeCompare(b.name, "uk")))) {
    const query = el("search").value.trim().toLocaleLowerCase("uk");
    if (query && ![item.title, item.name, item.address, item.venue].filter(Boolean).join(" ").toLocaleLowerCase("uk").includes(query)) continue;
    const card = document.createElement("section"); card.className = "event";
    const title = document.createElement("h3"); title.textContent = events ? item.title : item.name;
    const meta = document.createElement("p"); meta.textContent = events ? `${item.date} ${item.time ?? ""} · ${item.category} · ${item.venue}` : `${item.address} · ${item.latitude}, ${item.longitude}`;
    const edit = document.createElement("button"); edit.textContent = "Редагувати"; edit.className = "secondary"; edit.disabled = busy || rawDirty || !form.hidden; edit.onclick = () => start(item);
    const remove = document.createElement("button"); remove.textContent = "Видалити зі списку"; remove.className = "danger"; remove.disabled = busy || rawDirty || !form.hidden;
    remove.onclick = async () => {
      if (!await confirmChange(`Прибрати «${item.title ?? item.name}» зі списку змін? Опублікований список зміниться лише після публікації.`)) return;
      draft.items = draft.items.filter(e => e.id !== item.id); dirty = true; render();
    };
    card.append(title, meta, edit, remove); list.append(card);
  }
}
function start(item) {
  editingId = item?.id ?? null;
  for (const field of fields()) fieldEl(field).value = item?.[field] ?? (field === "verifiedAt" && !isSafetyKind(loadedKind) ? today() : field === "category" ? "Інше" : "");
  if (isSafetyKind(loadedKind)) { el("point-legend").textContent = loadedKind === "shelters" ? "Укриття" : "Пункт незламності"; updateMapLink(); }
  form.hidden = false; render(); fieldEl(isSafetyKind(loadedKind) ? "name" : "title").focus();
}
function updateMapLink() {
  const lat = Number(el("point-latitude").value.replace(",", ".")), lon = Number(el("point-longitude").value.replace(",", "."));
  el("point-map").href = validPointCoordinates(lat, lon) ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}` : "https://www.openstreetmap.org/#map=15/48.6208/22.2879";
}
el("point-latitude").oninput = updateMapLink; el("point-longitude").oninput = updateMapLink;
el("search").oninput = render;
async function discardChanges() { return !(dirty || rawDirty || !form.hidden) || await confirmChange("Відкинути неопубліковані зміни? Опубліковані дані залишаться без змін."); }
async function request(method, kind, body) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`/api/admin/editorial/${kind}`, { method, signal: controller.signal,
      headers: { "X-Admin-Key": el("key").value, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error(({ 401: "Неправильний ключ редактора.", 404: "Ця версія сервера ще не підтримує редактор. Оновіть і перезапустіть бекенд.", 502: "Джерело карти тимчасово недоступне. Не створюємо порожній список замість наявних точок. Спробуйте завантажити пізніше.", 503: "Редактор не налаштований: додайте EDITORIAL_ADMIN_KEY на сервері й перезапустіть його.", 400: "Сервер відхилив дані. Перевірте поля, категорії, дати, координати та посилання; переконайтеся, що бекенд оновлено." })[response.status] ?? `Помилка сервера (${response.status}). Список змін не втрачено.`);
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Сервер не відповів вчасно. Список змін збережено на екрані; спробуйте ще раз.");
    if (error instanceof TypeError) throw new Error("Немає з’єднання з сервером. Спробуйте ще раз.");
    throw error;
  } finally { clearTimeout(timer); }
}
el("load").onclick = async () => {
  if (busy || !await discardChanges()) return;
  if (!el("key").value.trim()) { message("Введіть ключ редактора."); return; }
  const kind = el("document").value; busy = true; render(); message("Завантажуємо…");
  try {
    const result = validateDocument(await request("GET", kind), kind);
    draft = structuredClone(result); loadedKind = kind; loadedKey = el("key").value; dirty = false; rawDirty = false; closeForms(); form = el(isSafetyKind(kind) ? "point-form" : "event-form"); el("advanced").open = kind === "defender-funds"; el("search").value = "";
    message("Дані завантажено. Зміни не публікуються автоматично.");
  } catch (e) { message(e.message); } finally { busy = false; render(); }
};
el("document").onchange = async () => {
  if (!await discardChanges()) { el("document").value = loadedKind; return; }
  draft = null; dirty = false; rawDirty = false; closeForms(); message("Завантажте дані вибраного розділу."); render();
};
el("key").oninput = () => {
  // Changing a credential must not publish an old document to another editor's session.
  if (loadedKey !== el("key").value) { draft = null; dirty = false; rawDirty = false; form.hidden = true; message("Ключ змінено. Завантажте список знову."); render(); }
};
el("add").onclick = () => { if (draft && !busy) start(null); };
el("cancel-edit").onclick = el("cancel-point").onclick = () => { closeForms(); editingId = null; render(); };
el("event-form").onsubmit = el("point-form").onsubmit = e => {
  e.preventDefault(); if (!draft || busy) return;
  try {
    const previous = draft.items.find(item => item.id === editingId);
    const values = Object.fromEntries(fields().map(field => [field, fieldEl(field).value]));
    const id = `${loadedKind}-${crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
    const event = isSafetyKind(loadedKind) ? pointFromFields(values, previous, id, loadedKind) : eventFromFields(values, previous, id);
    const next = { ...draft, items: previous ? draft.items.map(item => item.id === previous.id ? event : item) : [...draft.items, event] };
    validateDocument(next, loadedKind); draft = next; dirty = true; closeForms(); editingId = null; render(); message("Додано до списку змін. Ще не опубліковано.");
  } catch (e) { message(e.message); }
};
el("apply-json").onclick = () => {
  try { const next = validateDocument(JSON.parse(el("content").value), loadedKind); draft = structuredClone(next); dirty = true; rawDirty = false; render(); message("JSON застосовано до списку змін. Ще не опубліковано."); }
  catch (e) { message(e instanceof SyntaxError ? "Помилка JSON: перевірте коми й лапки." : e.message); }
};
el("content").oninput = () => { rawDirty = true; render(); };
el("save").onclick = async () => {
  if (busy || !draft || !dirty || rawDirty || !form.hidden) return;
  if (!await confirmChange(`Опублікувати список (${draft.items.length} записів)? Це замінить опубліковані дані цього розділу.`)) return;
  busy = true; render(); message("Публікуємо…");
  try {
    validateDocument(draft, loadedKind);
    draft = structuredClone(validateDocument(await request("PUT", loadedKind, draft), loadedKind)); dirty = false;
    message("Опубліковано. Оновіть розділ у застосунку, щоб побачити зміни.");
  } catch (e) { message(e.message); } finally { busy = false; render(); }
};
window.addEventListener("beforeunload", e => { if (dirty || rawDirty || !form.hidden) { e.preventDefault(); e.returnValue = ""; } });
render();
