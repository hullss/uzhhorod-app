import { createServer } from "node:http";
const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Audit follow-up UI QA</title><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{display:flex;flex-direction:column}</style></head><body><div id="root"></div><script src="http://localhost:8084/scripts/audit-followup-preview-entry.bundle?platform=web&dev=true&hot=false&lazy=false"></script></body></html>';
createServer(async (request, response) => {
  if (request.method !== "GET") { response.writeHead(405); response.end(); return; }
  if (request.url === "/") { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html); }
  else if (request.url.startsWith("/assets/")) {
    try { const res = await fetch(`http://localhost:8084${request.url}`); response.writeHead(res.status, { "Content-Type": res.headers.get("content-type") || "application/octet-stream" }); response.end(Buffer.from(await res.arrayBuffer())); }
    catch { response.writeHead(503); response.end(); }
  } else { response.writeHead(404); response.end(); }
}).listen(18195, "127.0.0.1", () => console.log("Audit follow-up QA: http://127.0.0.1:18195"));
