export const CATEGORIES = ["Концерти", "Театр", "Виставки", "Лекції та зустрічі", "Майстер-класи", "Спорт", "Для дітей", "Фестивалі", "Інше"];
export const EVENT_FIELDS = ["title", "date", "time", "category", "venue", "address", "description", "sourceUrl", "posterUrl", "organizer", "verifiedAt"];
export const POINT_FIELDS = ["name", "address", "latitude", "longitude", "description", "sourceUrl", "verifiedAt"];
export const isSafetyKind = kind => kind === "shelters" || kind === "resilience";
export function validPointCoordinates(latitude, longitude) {
  return typeof latitude === "number" && Number.isFinite(latitude) && latitude >= 48.56 && latitude <= 48.70
    && typeof longitude === "number" && Number.isFinite(longitude) && longitude >= 22.16 && longitude <= 22.42;
}
export function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function safeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".")
      && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname);
  } catch { return false; }
}
export function validateDocument(doc, kind = "events") {
  const limit = isSafetyKind(kind) ? 5000 : 500;
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.items) || doc.items.length > limit) throw new Error(`Потрібен список items, не більше ${limit} записів.`);
  const ids = new Set();
  for (const e of doc.items) {
    if (!e || typeof e !== "object" || typeof e.id !== "string" || !e.id.trim() || e.id.length > 100 || ids.has(e.id.trim())) throw new Error("Кожен запис повинен мати унікальний id.");
    ids.add(e.id.trim());
    if (kind === "defender-funds") {
      for (const [field, limit] of [["title", 300], ["description", 2000], ["verificationSource", 2000]]) if (typeof e[field] !== "string" || !e[field].trim() || e[field].length > limit) throw new Error(`Перевірте поле ${field}.`);
      if (!safeUrl(e.donationUrl) || !validDate(e.verifiedAt)) throw new Error("Перевірте HTTPS-посилання збору та дату перевірки.");
      continue;
    }
    if (isSafetyKind(kind)) {
      for (const [field, limit] of [["name", 300], ["address", 500]]) if (typeof e[field] !== "string" || !e[field].trim() || e[field].length > limit) throw new Error(`Перевірте поле ${field}.`);
      if (!validPointCoordinates(e.latitude, e.longitude)) throw new Error("Координати мають бути в межах Ужгорода: широта 48.56–48.70, довгота 22.16–22.42. Не міняйте їх місцями.");
      if (e.description !== undefined && (typeof e.description !== "string" || !e.description.trim() || e.description.length > 2000)) throw new Error("Опис: не більше 2000 символів.");
      if (e.sourceUrl !== undefined && (typeof e.sourceUrl !== "string" || e.sourceUrl.length > 2000 || !safeUrl(e.sourceUrl))) throw new Error("Джерело має бути публічним HTTPS-посиланням.");
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      const today = ["year", "month", "day"].map(type => parts.find(p => p.type === type).value).join("-");
      if (e.verifiedAt !== undefined && (!validDate(e.verifiedAt) || e.verifiedAt > today)) throw new Error("Вкажіть справжню дату перевірки, не в майбутньому.");
      continue;
    }
    if (kind !== "events") continue;
    for (const [field, limit] of [["title", 300], ["venue", 300], ["description", 6000]]) if (typeof e[field] !== "string" || !e[field].trim() || e[field].length > limit) throw new Error(`Перевірте поле ${field}.`);
    if (!validDate(e.date) || !validDate(e.verifiedAt)) throw new Error("Перевірте дату події та дату перевірки (з роком).");
    if (!CATEGORIES.includes(e.category)) throw new Error("Оберіть відому категорію.");
    if (e.time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)) throw new Error("Час має бути у форматі HH:mm.");
    if (!safeUrl(e.sourceUrl) || (e.posterUrl !== undefined && !safeUrl(e.posterUrl))) throw new Error("Посилання мають бути публічними HTTPS-адресами.");
    for (const [field, limit] of [["address", 500], ["organizer", 300]]) if (e[field] !== undefined && (typeof e[field] !== "string" || !e[field].trim() || e[field].length > limit)) throw new Error(`Перевірте поле ${field}.`);
  }
  return doc;
}
export function pointFromFields(fields, previous, id, kind) {
  const point = { ...previous, id: previous?.id ?? id };
  for (const field of POINT_FIELDS) {
    const value = String(fields[field] ?? "").trim();
    if (value) point[field] = field === "latitude" || field === "longitude" ? Number(value.replace(",", ".")) : value;
    else delete point[field];
  }
  validateDocument({ items: [point] }, kind);
  return point;
}
export function eventFromFields(fields, previous, id) {
  const event = { ...previous, id: previous?.id ?? id };
  for (const field of EVENT_FIELDS) {
    const value = String(fields[field] ?? "").trim();
    if (value) event[field] = value; else delete event[field];
  }
  validateDocument({ items: [event] });
  return event;
}
