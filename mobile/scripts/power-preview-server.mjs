// Loopback-only fixture preview. Does not touch the real DB or utility provider.
import { createServer } from "node:http";
const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%}#root{display:flex;flex-direction:column}</style></head><body><div id="root"></div><script src="http://localhost:8084/scripts/power-preview-entry.bundle?platform=web&dev=true&hot=false&lazy=false"></script></body></html>';
createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  if (request.method !== "GET") { response.writeHead(405); response.end(); return; }
  const url = new URL(request.url, "http://localhost:8092");
  if (url.pathname.startsWith("/api/city-services/power/")) {
    if (url.searchParams.get("mode") === "error") { response.writeHead(503); response.end(); return; }
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    const now = new Date().toISOString();
    const value = url.pathname.endsWith("cities") ? [{ id: 769, name: "Ужгород" }]
      : url.pathname.endsWith("streets") ? [{ id: 9479, name: "Оноківська" }, { id: 1, name: "Дуже довга українська назва вулиці для перевірки переносу" }]
      : { checkedAt: now, sourceUpdatedAt: now, stale: url.searchParams.get("mode") === "stale", addressKnown: true, uncertain: false, queues: ["4.1"], outages: [], sourceUrl: "ignored" };
    response.end(JSON.stringify(value));
  } else if (url.pathname.startsWith("/assets/")) {
    try { const asset = await fetch(`http://localhost:8084${request.url}`); response.writeHead(asset.status, { "Content-Type": asset.headers.get("content-type") || "application/octet-stream" }); response.end(Buffer.from(await asset.arrayBuffer())); }
    catch { response.writeHead(503); response.end(); }
  } else if (url.pathname === "/") { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html); }
  else { response.writeHead(404); response.end(); }
}).listen(8092, "127.0.0.1", () => console.log("Power screen fixture QA: http://localhost:8092"));
