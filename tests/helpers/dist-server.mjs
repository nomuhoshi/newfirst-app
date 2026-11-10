// 测试用的静态服务器：在测试进程内托管构建产物（dist/），随机空闲端口，用完 close()。
// 用来取代 `spawn("npx", ["vite","preview",…])`：
//   · npx 只是外壳，`server.kill()` 杀不掉里面真正的 vite 进程，会一直占着 4318/4319 等固定端口；
//     下一次运行（或别的工作区的运行）撞上这个旧进程，就会读到别人的、旧的 dist，表现成无缘无故的失败或等待超时；
//   · 固定等 2.5 秒也不保证服务器已就绪，端口被占时 --strictPort 的失败又被 stdio:"ignore" 吞掉。
// 在进程内起服务器：端口随机、就绪即返回（listen 回调）、close() 一定释放；两个测试同时跑也不会互相串。
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".zip": "application/zip", ".txt": "text/plain; charset=utf-8" };

export async function startDistServer({ dist = fileURLToPath(new URL("../../dist", import.meta.url)), port = 0 } = {}) {
  const DIST = resolve(dist);
  const srv = createServer((req, resp) => {
    const url = new URL(req.url, "http://localhost");
    let p = join(DIST, decodeURIComponent(url.pathname));
    if (url.pathname.endsWith("/")) p = join(p, "index.html");
    if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { resp.writeHead(404); resp.end("not found"); return; }
    resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" });
    resp.end(readFileSync(p));
  });
  await new Promise((ok, bad) => { srv.once("error", bad); srv.listen(port, ok); });
  const p = srv.address().port;
  return {
    port: p, base: `http://localhost:${p}/`,
    close: () => new Promise((ok) => { srv.closeAllConnections(); srv.close(() => ok()); }),
  };
}
