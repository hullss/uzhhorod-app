// Loopback-only QA fixture server. No production API, data writes or bank calls.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const article = readFileSync(new URL("../../output/news-reader-qa/article.json", import.meta.url));
const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#root{margin:0;width:100%;height:100%}#root{display:flex;flex-direction:column}</style></head><body><div id="root"></div><script src="http://localhost:8083/scripts/news-preview-entry.bundle?platform=web&dev=true&hot=false&lazy=false"></script></body></html>';
createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  if (request.method !== "GET") { response.writeHead(405); response.end(); return; }
  if (request.url.startsWith("/api/city-services/news/article?")) { response.setHeader("Content-Type", "application/json; charset=utf-8"); response.end(article); }
  else if (request.url.startsWith("/assets/")) {
    try {
      const asset = await fetch(`http://127.0.0.1:8083${request.url}`);
      response.writeHead(asset.status, { "Content-Type": asset.headers.get("content-type") || "application/octet-stream" });
      response.end(Buffer.from(await asset.arrayBuffer()));
    } catch { response.writeHead(503); response.end(); }
  }
  else if (request.url === "/") { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html); }
  else { response.writeHead(404); response.end(); }
}).listen(8090, "127.0.0.1", () => console.log("Isolated news reader QA: http://localhost:8090"));
