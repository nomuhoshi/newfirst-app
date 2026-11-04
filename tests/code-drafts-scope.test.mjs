// 写代码题草稿的“主人编号”按 Supabase 项目分开：两个项目里用户编号相同时，测试库的草稿不能挂到正式项目的账号下。纯 Node。
import { ownerId, draftKey } from "../src/code-drafts.js";
import { projectNamespace } from "../src/sync.js";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };
const mk = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const PROD = "aqlcunkmggzzvyavlkjg.supabase.co", TEST = "abcdefgh.supabase.co";
const nsProd = projectNamespace(PROD, PROD), nsTest = projectNamespace(TEST, PROD), nsOff = projectNamespace("cloud-off", PROD);
const UID = "u-same-1";

{ // 浏览器里同时有正式项目的当前账号，和测试库的当前账号（相同用户编号）
  const st = mk(); st.setItem("suipian.session", UID); st.setItem("suipian.guestId", "g-guest");
  check("正式项目：用原来的键（suipian.session），草稿主人 = 账号编号", nsProd === "" && ownerId(st, nsProd) === UID);
  check("测试库：没登录时不会借用正式项目的账号编号，草稿主人 = 游客编号", ownerId(st, nsTest) === "g-guest");
  st.setItem(nsTest + "suipian.session", UID);
  check("测试库登录后：草稿主人 = 测试库自己的账号编号（键带 proj: 前缀）", ownerId(st, nsTest) === UID && nsTest.startsWith("proj:"));
  check("云端关闭：沿用原键（和正式项目同一套），不带 proj: 前缀", ownerId(st, nsOff) === UID && nsOff === "");
}
{ // 相同账号编号、不同项目 → 草稿键不同的主人，才不会串：测试库未登录时主人是游客编号，草稿键和正式账号的不同
  const st = mk(); st.setItem("suipian.session", UID); st.setItem("suipian.guestId", "g-guest");
  const ex = { id: "T-W1", version: 1 };
  check("同一道题：正式账号和测试库（未登录）的草稿键不同", draftKey(ownerId(st, nsProd), ex) !== draftKey(ownerId(st, nsTest), ex));
}
const pass = results.filter(Boolean).length;
console.log(`\n草稿主人按项目分开：${pass}/${results.length} 通过`); process.exit(pass === results.length ? 0 : 1);
