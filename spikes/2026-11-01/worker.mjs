import { loadPyodide } from "./pyodide/pyodide.mjs";
const t0 = performance.now();
const py = await loadPyodide({ indexURL: "./pyodide/" });
let out = [];
py.setStdout({ batched: s => out.push(s) });
py.setStderr({ batched: s => out.push("ERR:" + s) });
postMessage({ type: "ready", ms: Math.round(performance.now() - t0) });
onmessage = async (e) => {
  out = [];
  const ns = py.globals.get("dict")();
  for (const [k, v] of Object.entries(e.data.vars || {})) ns.set(k, py.toPy(v));
  try { await py.runPythonAsync(e.data.code, { globals: ns }); postMessage({ type: "done", id: e.data.id, out }); }
  catch (err) { postMessage({ type: "error", id: e.data.id, out, err: String(err.message).split("\n").slice(-4).join("\n") }); }
  ns.destroy();
};
