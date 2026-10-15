export const CITY_TIME_ZONE = "Europe/Kyiv";

export function cityDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: CITY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function cityClock(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: CITY_TIME_ZONE, hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)!.value);
  return { hours: value("hour"), minutes: value("minute"), seconds: value("second") };
}

export function citySeconds(date: Date): number {
  const { hours, minutes, seconds } = cityClock(date);
  return hours * 3600 + minutes * 60 + seconds;
}
