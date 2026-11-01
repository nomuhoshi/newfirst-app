// 主线程这边的“运行管理员”：负责启动工作线程、超时、Stop、输出上限、防止重复运行。

export const LIMITS = {
  runMs: 5000,        // 单次执行最多 5 秒（不含首次加载）
  loadMs: 30000,      // 加载超过 30 秒就提示重试
  maxLines: 100,      // 输出最多 100 行
  maxBytes: 8 * 1024, // 或 8 KiB
};

export class Runner {
  constructor({ onStatus, onOutput }) {
    this.onStatus = onStatus;   // (status, info) => void
    this.onOutput = onOutput;   // (text) => void
    this.worker = null;
    this.state = "idle";        // idle | loading | ready | running | loadError
    this.runId = 0;
    this.current = null;        // 当前这次运行的信息
  }

  get indexURL() {
    return new URL("pyodide/", document.baseURI).href;
  }

  boot() {
    if (this.worker) this.worker.terminate();
    this.state = "loading";
    this.onStatus("loading");
    const w = new Worker(new URL("./py-worker.js", import.meta.url), { type: "module" });
    this.worker = w;
    const loadTimer = setTimeout(() => {
      if (this.worker === w && this.state === "loading") this.onStatus("slowLoad");
    }, LIMITS.loadMs);
    w.onmessage = (e) => this.#onMessage(w, e.data, loadTimer);
    w.onerror = (e) => {
      if (this.worker !== w) return;
      clearTimeout(loadTimer);
      this.state = "loadError";
      this.onStatus("loadError", { msg: e.message || "工作线程启动失败" });
    };
    w.postMessage({ type: "init", indexURL: this.indexURL });
  }

  #onMessage(w, m, loadTimer) {
    if (w !== this.worker) return; // 已被终止的旧线程，忽略
    if (m.type === "ready") {
      clearTimeout(loadTimer);
      this.state = "ready";
      this.onStatus("ready", { ms: m.ms });
    } else if (m.type === "loadError") {
      clearTimeout(loadTimer);
      this.state = "loadError";
      this.onStatus("loadError", { msg: m.msg });
    } else if (m.type === "out") {
      const c = this.current;
      if (!c || m.id !== c.id) return; // 迟到的旧输出，忽略
      // 只显示到上限为止，超出的部分丢掉，然后停止运行
      let text = m.text;
      let over = false;
      if (c.bytes + text.length > LIMITS.maxBytes) {
        text = text.slice(0, LIMITS.maxBytes - c.bytes);
        over = true;
      }
      let idx = -1;
      for (let n = c.lines; n < LIMITS.maxLines; n++) {
        idx = text.indexOf("\n", idx + 1);
        if (idx === -1) break;
      }
      if (idx !== -1 && c.lines + (text.match(/\n/g) || []).length > LIMITS.maxLines) {
        text = text.slice(0, idx + 1);
        over = true;
      }
      c.bytes += text.length;
      c.lines += (text.match(/\n/g) || []).length;
      this.onOutput(text);
      if (over || c.lines >= LIMITS.maxLines || c.bytes >= LIMITS.maxBytes) this.#abort("outputLimit");
    } else if (m.type === "done") {
      const c = this.current;
      if (!c || m.id !== c.id) return;
      clearTimeout(c.timer);
      this.current = null;
      this.state = "ready";
      this.onStatus("done", { error: m.error, hadOutput: c.bytes > 0 });
    }
  }

  // 返回 false 表示现在不能运行（还在加载或已经在运行）
  run(code, data = null) {
    if (this.state !== "ready") return false;
    const id = ++this.runId;
    this.state = "running";
    this.current = {
      id, lines: 0, bytes: 0,
      timer: setTimeout(() => this.#abort("timeout"), LIMITS.runMs),
    };
    this.onStatus("running");
    this.worker.postMessage({ type: "run", id, code, data });
    return true;
  }

  stop() {
    if (this.state === "running") this.#abort("stopped");
  }

  // 终止线程是唯一能可靠停住 Python 死循环的方法；之后重新加载
  #abort(reason) {
    const c = this.current;
    if (c) clearTimeout(c.timer);
    this.current = null;
    this.onStatus(reason);
    this.boot();
  }
}
