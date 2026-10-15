import { getLocale } from "../i18n/locale";
import { CITY_TIME_ZONE, cityClock, cityDate } from "../utils/cityTime";

// Presentation fixtures, not an official catalogue or actual appointment availability.
export const CNAP_SERVICES = [
  { id: "residence", title: "Реєстрація місця проживання" },
  { id: "extract", title: "Витяг з реєстру територіальної громади" },
  { id: "social", title: "Соціальні послуги" },
  { id: "consultation", title: "Консультація щодо документів" },
] as const;
export const CNAP_CENTER = { id: "uzhhorod-example", title: "ЦНАП Ужгорода" } as const;
export const TEST_TIMES = ["09:00", "10:30", "11:00", "14:00", "15:30"] as const;
export const MAX_APPOINTMENTS = 6;
export type Appointment = {
  id: string; serviceId: string; centerId: string; date: string; time: string;
  createdAt: string; cancelledAt?: string;
};

export function appointmentDates(now = new Date()): string[] {
  const day = new Date(`${cityDate(now)}T12:00:00Z`);
  const dates: string[] = [];
  while (dates.length < 5) {
    day.setUTCDate(day.getUTCDate() + 1);
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) dates.push(day.toISOString().slice(0, 10));
  }
  return dates;
}

export function dateLabel(date: string): string {
  return new Intl.DateTimeFormat(getLocale(), { timeZone: CITY_TIME_ZONE, day: "numeric", month: "long", weekday: "short" }).format(new Date(`${date}T12:00:00Z`));
}

export function isUpcoming(item: Appointment, now = new Date()): boolean {
  const clock = cityClock(now);
  const time = `${String(clock.hours).padStart(2, "0")}:${String(clock.minutes).padStart(2, "0")}`;
  return !item.cancelledAt && `${item.date} ${item.time}` > `${cityDate(now)} ${time}`;
}

export function isAppointment(value: unknown): value is Appointment {
  if (!value || typeof value !== "object") return false;
  const item = value as Appointment;
  const validDate = typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    && Number.isFinite(Date.parse(`${item.date}T12:00:00Z`))
    && new Date(`${item.date}T12:00:00Z`).toISOString().slice(0, 10) === item.date;
  return typeof item.id === "string" && /^CNAP-TEST-[A-Z0-9-]{1,50}$/.test(item.id)
    && CNAP_SERVICES.some((service) => service.id === item.serviceId) && item.centerId === CNAP_CENTER.id
    && validDate && TEST_TIMES.some((time) => time === item.time)
    && typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt))
    && (item.cancelledAt === undefined || (typeof item.cancelledAt === "string" && Number.isFinite(Date.parse(item.cancelledAt))));
}

export function createAppointment(serviceId: string, date: string, time: string, now = new Date()): Appointment {
  if (!CNAP_SERVICES.some((service) => service.id === serviceId) || !appointmentDates(now).includes(date)
      || !TEST_TIMES.some((slot) => slot === time)) throw new Error("Перевірте послугу, дату й час.");
  return { id: `CNAP-TEST-${now.getTime().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    serviceId, centerId: CNAP_CENTER.id, date, time, createdAt: now.toISOString() };
}

export const CITY_POLL = {
  id: "city-priorities-v1", title: "Що покращити в місті наступним?",
  description: "Який напрям ви вважаєте найважливішим для Ужгорода? Оберіть один варіант і підтвердьте свій вибір. Це приклад майбутнього міського опитування, а не офіційне голосування.",
  options: [
    { id: "transport", title: "Транспорт і зупинки" },
    { id: "parks", title: "Парки та прогулянки" },
    { id: "recycling", title: "Сортування відходів" },
    { id: "accessibility", title: "Безбар’єрність міста" },
  ],
} as const;
export type PollVote = { pollId: string; optionId: string; votedAt: string };
export function isPollVote(value: unknown): value is PollVote {
  if (!value || typeof value !== "object") return false;
  const item = value as PollVote;
  return item.pollId === CITY_POLL.id && CITY_POLL.options.some((option) => option.id === item.optionId)
    && typeof item.votedAt === "string" && Number.isFinite(Date.parse(item.votedAt));
}
export function createVote(optionId: string, existing: PollVote | null, now = new Date()): PollVote {
  if (existing) throw new Error("Ви вже проголосували в цьому опитуванні.");
  if (!CITY_POLL.options.some((option) => option.id === optionId)) throw new Error("Оберіть варіант відповіді.");
  return { pollId: CITY_POLL.id, optionId, votedAt: now.toISOString() };
}
