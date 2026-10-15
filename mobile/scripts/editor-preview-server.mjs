// Isolated browser QA: real editor files + an in-memory fixture API. Never writes the database.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
let events = JSON.parse(readFileSync(new URL("../../backend/src/main/resources/editorial/events.json", import.meta.url), "utf8"));
const documents = { events, shelters: { items: [{ id: "qa-shelter", name: "QA укриття — не реальний об’єкт", address: "Тестова адреса, не використовувати", latitude: 48.62, longitude: 22.28 }] }, resilience: { items: [] } };
createServer(async (req, res) => {
  const path = new URL(req.url, "http://127.0.0.1").pathname;
  const kind = path.match(/^\/api\/admin\/editorial\/(events|shelters|resilience)$/)?.[1];
  if (kind) {
    if (req.headers["x-admin-key"] !== "qa-only-not-a-real-key") { res.writeHead(401); res.end(); return; }
    if (req.method === "PUT") {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      documents[kind] = JSON.parse(Buffer.concat(chunks).toString());
    } else if (req.method !== "GET") { res.writeHead(405); res.end(); return; }
    res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(documents[kind])); return;
  }
  const name = ({ "/admin/": "index.html", "/admin/editor.js": "editor.js", "/admin/model.js": "model.js" })[path];
  if (!name || req.method !== "GET") { res.writeHead(404); res.end(); return; }
  let body = readFileSync(new URL(`../../backend/src/main/resources/static/admin/${name}`, import.meta.url), "utf8");
  if (name === "index.html") body = body.replace("<h1>Редактор контенту</h1>", "<h1>Редактор контенту · ізольована QA-перевірка</h1><p>Тестові дані лише в пам’яті, не публікуються в робочий застосунок.</p>");
  res.setHeader("Content-Type", name.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8"); res.end(body);
}).listen(8091, "127.0.0.1", () => console.log("Isolated editorial QA: http://127.0.0.1:8091/admin/"));
