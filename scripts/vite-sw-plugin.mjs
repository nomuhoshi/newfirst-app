// 构建时生成 dist/sw.js：填入版本号，并列出需要预缓存的文件（从主入口出发能到达的 JS / CSS / 工作线程 / HTML / 图标）。
// 不包含：Pyodide（public/pyodide）、测试音频（public/sfx）、技术验证页 lab.html 独有的文件。
import { readFileSync } from "node:fs";

const PUBLIC_SHELL = ["manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

export default function swPlugin({ version }) {
  return {
    name: "suipian-sw",
    apply: "build",
    generateBundle: { order: "post", handler(_opts, bundle) {
      const chunks = Object.values(bundle).filter((f) => f.type === "chunk");
      const byName = new Map(chunks.map((c) => [c.fileName, c]));
      const reach = (entry) => {
        const seen = new Set();
        const walk = (name) => {
          if (seen.has(name)) return;
          seen.add(name);
          const c = byName.get(name);
          if (!c) return;
          [...c.imports, ...c.dynamicImports].forEach(walk);
          for (const css of c.viteMetadata?.importedCss ?? []) seen.add(css);
          for (const a of c.viteMetadata?.importedAssets ?? []) seen.add(a);
        };
        walk(entry.fileName);
        return seen;
      };
      const main = chunks.find((c) => c.isEntry && c.name === "main");
      const lab = chunks.find((c) => c.isEntry && c.name === "lab");
      if (!main) throw new Error("找不到主入口，无法生成 sw.js");
      const mainSet = reach(main);
      const labOnly = new Set(lab ? [...reach(lab)].filter((n) => !mainSet.has(n)) : []);
      const files = Object.keys(bundle).filter((n) => n !== "sw.js" && n !== "lab.html" && !labOnly.has(n));
      // 工作线程文件（py-worker）由 Vite 单独打包，作为资源进入 bundle，包含在 files 里
      const list = ["./", "./index.html", ...files.map((n) => "./" + n), ...PUBLIC_SHELL.map((n) => "./" + n)];
      const src = readFileSync(new URL("./sw-template.js", import.meta.url), "utf8")
        .replace("__VERSION__", version)
        .replace("__PRECACHE__", JSON.stringify([...new Set(list)], null, 2));
      this.emitFile({ type: "asset", fileName: "sw.js", source: src });
    } },
  };
}
