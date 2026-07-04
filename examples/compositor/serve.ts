// Minimal static file server for the Compositor app -- unlike Studio's dev
// server, this isn't previewing a scripted Scene (no harness/SSE/hot-reload
// needed), it's a real standalone page that imports ecmanim/browser +
// ecmanim/studio directly by path. Serves the whole repo root so those
// absolute imports ("/dist/browser.js", "/dist/studio.js") resolve.

const http = await import("node:http");
const fs = await import("node:fs");
const path = await import("node:path");
const os = await import("node:os");

const root = path.resolve(process.cwd());
const PORT = Number(process.env.PORT ?? 5960);
const MIME: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".map": "application/json", ".json": "application/json", ".wasm": "application/wasm", ".css": "text/css",
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (url === "/") url = "/examples/compositor/index.html";
  const p = path.normalize(path.join(root, url));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404);
    res.end("not found: " + url);
    return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] ?? "application/octet-stream" });
  res.end(fs.readFileSync(p));
});

server.listen(PORT, "0.0.0.0", () => {
  const lan: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) lan.push(addr.address);
    }
  }
  console.log("ecmanim Compositor reachable at:");
  console.log(" -", `http://127.0.0.1:${PORT}/`);
  for (const ip of lan) console.log(" -", `http://${ip}:${PORT}/`);
});
