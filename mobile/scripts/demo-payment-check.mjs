import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/payments/demoTransport.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { DEMO_FARE_KOPIYKAS, normalizeVehiclePlate, vehicleFromDemoQr, createDemoTicket, formatDemoMoney } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

for (const input of ["АО 1234 АА", "ao1234aa", "AO 1234 АA", "АО-1234-АА"]) {
  assert.equal(normalizeVehiclePlate(input), "AO 1234 AA", input);
}
for (const input of ["КО1234ВЕ", "MT1234AA", "MO1234AA", "AA1234AA"]) assert.ok(normalizeVehiclePlate(input), input);
for (const input of ["AO1234ZA", "КО 1234 ZB", "AO1234ZD", "AO1234YF"]) {
  const normalized = normalizeVehiclePlate(input);
  assert.ok(normalized, input);
  assert.match(normalized, /^[A-Z]{2} \d{4} [A-Z]{2}$/);
}
for (const input of ["ZA1234AA", "AO1234AZ", "AO1234FA"]) assert.equal(normalizeVehiclePlate(input), null, input);
for (const input of ["7", "АО123", "АО 12345 АА", "АО 1234 ББ", "", "https://example.com"]) assert.equal(normalizeVehiclePlate(input), null, input);
assert.deepEqual(vehicleFromDemoQr("https://example.com/anything"), { plate: "AO 1234 AA", usedExample: true });
assert.deepEqual(vehicleFromDemoQr("uzh://bus?plate=KO1234AB"), { plate: "KO 1234 AB", usedExample: false });
assert.deepEqual(vehicleFromDemoQr('{"plate":"АО 9876 АА"}'), { plate: "AO 9876 AA", usedExample: false });
assert.deepEqual(vehicleFromDemoQr("uzh://bus?plate=AO1234ZA"), { plate: "AO 1234 ZA", usedExample: false });
assert.equal(formatDemoMoney(4500), "45,00 ₴");
const ticket = createDemoTicket("AO1234AA", 3, "4242", "qr");
assert.equal(ticket.amountKopiykas, DEMO_FARE_KOPIYKAS * 3);
assert.equal(ticket.plate, "AO 1234 AA");
assert.equal(ticket.quantity, 3);
assert.match(ticket.id, /^DEMO-/);
assert.ok(Number.isFinite(Date.parse(ticket.paidAt)));
assert.notEqual(createDemoTicket("AO1234AA", 1, "4242", "number").id, ticket.id);
for (const quantity of [0, 6, -1, 1.5]) assert.throws(() => createDemoTicket("AO1234AA", quantity, "4242", "number"));
assert.throws(() => createDemoTicket("7", 1, "4242", "number"));
assert.throws(() => createDemoTicket("AO1234AA", 1, "42", "number"));
console.log("PASS: державні номери, латиниця/кирилиця, довільні QR, сума в копійках, квитки й невалідні дані.");
await import("./payment-return-check.mjs");
