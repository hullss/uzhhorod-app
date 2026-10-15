/** Local presentation data. This module never calls a bank or creates a valid travel ticket. */
export const DEMO_FARE_KOPIYKAS = 2300;
export const DEMO_VEHICLE_PLATE = "AO 1234 AA";

export type DemoTicket = {
  id: string;
  plate: string;
  quantity: number;
  amountKopiykas: number;
  paidAt: string;
  cardLast4: string;
  source: "qr" | "number";
};

const CYRILLIC_TO_LATIN: Record<string, string> = {
  А: "A", В: "B", Е: "E", І: "I", К: "K", М: "M",
  Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X", У: "Y",
};

export function normalizeVehiclePlate(input: string): string | null {
  const latin = input.toUpperCase().replace(/[\s-]/g, "").replace(/[АВЕІКМНОРСТХУ]/g, (letter) => CYRILLIC_TO_LATIN[letter]);
  // The region code uses the ordinary alphabet; electric vehicle series may use Y/Z + Latin letter.
  if (!/^[ABCEHIKMOPTX]{2}\d{4}(?:[ABCEHIKMOPTX]{2}|[YZ][A-Z])$/.test(latin)) return null;
  return `${latin.slice(0, 2)} ${latin.slice(2, 6)} ${latin.slice(6)}`;
}

export function vehicleFromDemoQr(payload: string): { plate: string; usedExample: boolean } {
  // Never open a URL or trust a QR as an instruction/payment confirmation.
  const match = payload.toUpperCase().match(/[ABCEHIKMOPTXАВЕІКМНОРСТХ]{2}[\s-]*\d{4}[\s-]*[A-ZАВЕІКМНОРСТХУ]{2}/);
  const plate = match ? normalizeVehiclePlate(match[0]) : null;
  return { plate: plate ?? DEMO_VEHICLE_PLATE, usedExample: !plate };
}

export function formatDemoMoney(kopiykas: number): string {
  return `${(kopiykas / 100).toFixed(2).replace(".", ",")} ₴`;
}

export function createDemoTicket(plate: string, quantity: number, cardLast4: string, source: DemoTicket["source"]): DemoTicket {
  const normalized = normalizeVehiclePlate(plate);
  if (!normalized || !Number.isInteger(quantity) || quantity < 1 || quantity > 5 || !/^\d{4}$/.test(cardLast4)) {
    throw new Error("Перевірте номер автобуса, кількість поїздок і тестову картку.");
  }
  return {
    id: `DEMO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    plate: normalized,
    quantity,
    amountKopiykas: DEMO_FARE_KOPIYKAS * quantity,
    paidAt: new Date().toISOString(),
    cardLast4,
    source,
  };
}
