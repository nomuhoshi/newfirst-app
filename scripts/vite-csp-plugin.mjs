// 构建时给 index.html 加内容安全策略（CSP，<meta http-equiv="Content-Security-Policy">）。
// GitHub Pages 不能设置响应头，所以只能用 meta；meta 里 frame-ancestors / report-uri / sandbox 无效，这里不写。
//
// 为什么是这几条（每条都对应应用真实需要的东西，多一条都不给）：
//   default-src 'self'                 兜底：没单独列出的资源只能来自本站
//   script-src 'self' 'sha256-…' 'wasm-unsafe-eval'
//       · 'self'：应用自己的模块（构建产物都在本站）
//       · 'sha256-…'：index.html 里那段“页面没加载出来”的兜底提示脚本（内联）。构建时按最终 HTML 现算哈希，脚本改了哈希跟着变
//       · 'wasm-unsafe-eval'：Pyodide 要编译 WebAssembly。只放行 WebAssembly 编译，不放行 eval / new Function。
//         Pyodide 跑在模块 Worker 里；Chromium 不把页面的 meta CSP 套到用网址创建的 Worker 上，
//         但旧版 Safari 会继承页面 CSP，所以这里也要放行，否则 iPhone 上 Python 可能跑不起来。
//       · 没有 'unsafe-inline'、没有 'unsafe-eval'：被注入的内联脚本和字符串当代码执行都会被拦下。
//   style-src 'self' 'unsafe-inline'   应用用 style 属性传动画时长、偏移量、进度条宽度；CodeMirror 在旧版 Safari 会插 <style>。
//                                      样式注入的危害远小于脚本注入，这里有意放宽，脚本仍然严格。
//   img-src 'self' data: blob:         图标、内联 SVG 生成的 data 图片
//   media-src 'self' data: blob:       音效
//   font-src 'self' data:              没有外部字体
//   connect-src 'self' https://*.supabase.co   本站资源（Pyodide 包、课程）+ Supabase（登录 / 云端进度）。
//                                      正式和测试项目都是 *.supabase.co；本机自动测试用的假服务器也是这个域名（被测试拦截）。
//   worker-src 'self'                  Python 工作线程、Service Worker 都在本站
//   manifest-src 'self'
//   object-src 'none'; base-uri 'self'; form-action 'self'   关掉插件、防 <base> 劫持相对路径、表单只能提交回本站
import { createHash } from "node:crypto";

export const CSP_DIRECTIVES = (scriptHashes) => [
  "default-src 'self'",
  `script-src 'self' ${scriptHashes.map((h) => `'${h}'`).join(" ")} 'wasm-unsafe-eval'`.replace(/\s+/g, " "),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

// 找出 HTML 里所有“没有 src 的 <script>”的内容，算 sha256（CSP 要求的格式：sha256-<base64>）
export function inlineScriptHashes(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    out.push("sha256-" + createHash("sha256").update(m[2], "utf8").digest("base64"));
  }
  return out;
}

export function buildCsp(html) {
  return CSP_DIRECTIVES(inlineScriptHashes(html)).join("; ");
}

// 把 meta 放在 <meta charset> 之后（必须在任何脚本之前，否则前面的脚本不受约束）
export function injectCsp(html) {
  if (/http-equiv=["']Content-Security-Policy["']/i.test(html)) throw new Error("index.html 里已经有 CSP meta，不能重复加");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${buildCsp(html)}" />`;
  const at = html.search(/<meta\s+charset[^>]*>/i);
  if (at < 0) throw new Error("index.html 没有 <meta charset>，不知道把 CSP 放在哪");
  const end = html.indexOf(">", at) + 1;
  return html.slice(0, end) + "\n  " + meta + html.slice(end);
}

// 只在构建时、只对 index.html 生效（开发服务器有热更新内联脚本和 websocket，不加 CSP；lab.html 是技术验证页）。
export default function cspPlugin() {
  return {
    name: "suipian-csp",
    apply: "build",
    transformIndexHtml: {
      order: "post", // 在 Vite 改完 HTML（插入打包后的脚本标签）之后再算哈希
      handler(html, ctx) {
        if (!/(^|[\\/])index\.html$/.test(ctx.filename || ctx.path || "")) return html;
        return injectCsp(html);
      },
    },
  };
}
