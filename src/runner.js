// 主线程这边的“运行管理员”：负责启动工作线程、超时、Stop、输出上限（第二层保护）、防止重复运行。
import { LIMITS as WORKER_LIMITS } from "./py-worker-limits.js";

export const LIMITS = {
  runMs: 5000,   // 单次执行最多 5 秒（不含首次加载）
  loadMs: 30000, // 加载超过 30 秒就提示重试
  ...WORKER_LIMITS,
};

const utf8 = new TextEncoder();

export class Runner {
  constructor({ onStatus, onOutput }) {
    this.onStatus = onStatus; // (status, info) => void
    this.onOutput = onOutput; // (text) => void
    this.worker = null;
    this.state = "idle";      // idle | loading | ready | running | loadError
    this.runId = 0;
    this.current = null;      // 当前这次运行：{ id, worker, timer, bytes, lines }
    this.loadTimer = null;
  }

  get indexURL() {
    return new URL("pyodide/", document.baseURI).href;
  }

  // 统一清理“当前运行”，任何结束路径都走这里，避免旧计时器误杀新线程
  _clearRun() {
    if (this.current) clearTimeout(this.current.timer);
    this.current = null;
  }

  boot() {
    this._clearRun();
    clearTimeout(this.loadTimer);
    if (this.worker) this.worker.terminate();
    this.state = "loading";
    this.onStatus("loading");
    let w;
    try {
      w = new Worker(new URL("./py-worker.js", import.meta.url), { type: "module" });
    } catch (e) {
      // 有些环境（例如部分内置浏览器）不允许创建模块工作线程：不能让整个页面因此白屏，只让“运行结果”提示失败
      this.worker = null;
      this.state = "loadError";
      this.onStatus("loadError", { msg: (e && e.message) || "无法创建 Python 工作线程", kind: "noWorker" });
      return;
    }
    this.worker = w;
    this.loadTimer = setTimeout(() => {
      if (this.worker === w && this.state === "loading") this.onStatus("slowLoad");
    }, LIMITS.loadMs);
    w.onmessage = (e) => this._onMessage(w, e.data);
    w.onerror = (e) => {
      if (this.worker !== w) return;
      e.preventDefault?.();
      clearTimeout(this.loadTimer);
      this._clearRun();
      this.state = "loadError";
      this.onStatus("loadError", { msg: (e && e.message) || "工作线程出错" });
    };
    w.postMessage({ type: "init", indexURL: this.indexURL });
  }

  _onMessage(w, m) {
    if (w !== this.worker) return; // 已被终止的旧线程，忽略
    if (m.type === "ready") {
      clearTimeout(this.loadTimer);
      this.state = "ready";
      this.onStatus("ready", { ms: m.ms });
    } else if (m.type === "loadError") {
      clearTimeout(this.loadTimer);
      this.state = "loadError";
      this.onStatus("loadError", { msg: m.msg });
    } else if (m.type === "out") {
      const c = this.current;
      if (!c || m.id !== c.id) return; // 迟到的旧输出，忽略
      // 第二层保护：按 UTF-8 字节和行数再检查一次
      c.bytes += utf8.encode(m.text).length;
      c.lines += (m.text.match(/\n/g) || []).length;
      if (c.bytes > LIMITS.maxBytes + 4 || c.lines > LIMITS.maxLines) { this._abort("outputLimit"); return; }
      this.onOutput(m.text);
    } else if (m.type === "done") {
      const c = this.current;
      if (!c || m.id !== c.id) return;
      this._clearRun();
      this.state = "ready";
      if (m.limitHit) this.onStatus("outputLimitStopped");
      else this.onStatus("done", { error: m.error, hadOutput: c.bytes > 0 });
    }
  }

  // 返回 false 表示现在不能运行（还在加载或已经在运行）
  run(code, data = null) {
    if (this.state !== "ready") return false;
    const id = ++this.runId;
    const w = this.worker;
    this.state = "running";
    this.current = {
      id, worker: w, bytes: 0, lines: 0,
      timer: setTimeout(() => {
        // 只在“还是同一次运行、同一个线程”时才超时终止
        if (this.current && this.current.id === id && this.worker === w) this._abort("timeout");
      }, LIMITS.runMs),
    };
    this.onStatus("running");
    w.postMessage({ type: "run", id, code, data });
    return true;
  }

  stop() {
    if (this.state === "running") this._abort("stopped");
  }

  // 终止线程是唯一能可靠停住 Python 死循环的方法；之后重新加载
  _abort(reason) {
    this._clearRun();
    this.onStatus(reason);
    this.boot();
  }
}
