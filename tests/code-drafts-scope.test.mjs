// 写代码题草稿按 Supabase 项目分开：两个项目里用户编号和题目都相同时，草稿不能串。纯 Node。
import { ownerId, draftKey, saveDraft, loadDraft, clearDraft } from "../src/code-drafts.js";
import { projectNamespace } from "../src/sync.js";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };
const mk = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const PROD = "aqlcunkmggzzvyavlkjg.supabase.co", TEST = "abcdefgh.supabase.co", TEST2 = "zyxwvuts.supabase.co";
const nsProd = projectNamespace(PROD, PROD), nsTest = projectNamespace(TEST, PROD), nsTest2 = projectNamespace(TEST2, PROD), nsOff = projectNamespace("cloud-off", PROD);
const UID = "u-same-1";
const ex = { id: "T-W1", version: 1 };

{ // 主人编号：各项目各用各的当前账号
  const st = mk(); st.setItem("suipian.session", UID); st.setItem("suipian.guestId", "g-guest");
  check("正式项目：用原来的键（suipian.session），草稿键和旧版完全一样", nsProd === "" && ownerId(st, nsProd) === UID && draftKey(ownerId(st, nsProd), ex) === `suipian.draft.${UID}.T-W1.v1`);
  check("测试库：没登录时不会借用正式项目的账号编号，草稿主人 = 游客编号", ownerId(st, nsTest) === "g-guest");
  st.setItem(nsTest + "suipian.session", UID);
  check("测试库登录后：草稿主人带项目前缀（用户编号和正式项目相同也不同）", ownerId(st, nsTest) === nsTest + UID && ownerId(st, nsTest) !== ownerId(st, nsProd));
  check("云端关闭：沿用原键，不带 proj: 前缀", ownerId(st, nsOff) === UID && nsOff === "");
}
{ // 核心：同一浏览器、同一预览、两个项目、相同用户编号、同一道题，都登录着
  const st = mk(); st.setItem("suipian.session", UID); st.setItem(nsTest + "suipian.session", UID); st.setItem(nsTest2 + "suipian.session", UID);
  const oP = ownerId(st, nsProd), oT = ownerId(st, nsTest), oT2 = ownerId(st, nsTest2);
  check("三个项目、同一用户编号、同一道题：草稿键两两不同", new Set([draftKey(oP, ex), draftKey(oT, ex), draftKey(oT2, ex)]).size === 3);
  saveDraft(st, oP, ex, { code: "PROD_CODE", viewed: true, phase: "original" });
  check("只存了正式项目的草稿：测试库读不到", loadDraft(st, oT, ex) === null && loadDraft(st, oT2, ex) === null);
  saveDraft(st, oT, ex, { code: "TEST_CODE", viewed: false, phase: "variation" });
  saveDraft(st, oT2, ex, { code: "TEST2_CODE", viewed: false, phase: "original" });
  check("三个项目的草稿各读各的，内容互不覆盖", loadDraft(st, oP, ex).code === "PROD_CODE" && loadDraft(st, oT, ex).code === "TEST_CODE" && loadDraft(st, oT2, ex).code === "TEST2_CODE");
  check("“看过参考解法 / 阶段”也不串", loadDraft(st, oP, ex).viewed === true && loadDraft(st, oT, ex).viewed === false && loadDraft(st, oT, ex).phase === "variation" && loadDraft(st, oP, ex).phase === "original");
  clearDraft(st, oT, ex);
  check("清掉测试库草稿，正式项目和另一个测试库的草稿还在", loadDraft(st, oT, ex) === null && loadDraft(st, oP, ex).code === "PROD_CODE" && loadDraft(st, oT2, ex).code === "TEST2_CODE");
  saveDraft(st, oT, ex, { code: "TEST_CODE_2" });
  check("正式项目草稿原样没变（逐字节）", st.getItem(`suipian.draft.${UID}.T-W1.v1`).includes("PROD_CODE") && !st.getItem(`suipian.draft.${UID}.T-W1.v1`).includes("TEST"));
}
{ // 旧草稿兼容：升级前存的草稿（键 suipian.draft.<uid>.…）在正式项目 / 云端关闭下仍能读到
  const st = mk(); st.setItem("suipian.session", UID);
  st.setItem(`suipian.draft.${UID}.T-W1.v1`, JSON.stringify({ v: 1, code: "OLD", viewed: true, phase: "original", at: 1 }));
  check("旧版本存的草稿：正式项目仍读得到", loadDraft(st, ownerId(st, nsProd), ex)?.code === "OLD");
  check("旧版本存的草稿：云端关闭（预览）仍读得到", loadDraft(st, ownerId(st, nsOff), ex)?.code === "OLD");
  check("旧草稿不会被测试库读到（测试库里是游客主人）", loadDraft(st, ownerId(st, nsTest), ex) === null);
}
{ // 游客：不分项目（游客编号本来就不分项目），登录后换主人，不读游客草稿（沿用原有行为）
  const st = mk(); st.setItem("suipian.guestId", "g-guest");
  const og = ownerId(st, nsTest);
  saveDraft(st, og, ex, { code: "GUEST" });
  check("游客草稿在各项目下是同一份（游客不属于任何项目）", ownerId(st, nsProd) === "g-guest" && loadDraft(st, ownerId(st, nsProd), ex).code === "GUEST");
}
{ // 存储坏了：不抛错
  const bad = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
  check("存储被禁用：主人编号退回 guest，读写不抛错", ownerId(bad, nsTest) === "guest" && loadDraft(bad, "guest", ex) === null && saveDraft(bad, "guest", ex, { code: "x" }) === false);
}
const pass = results.filter(Boolean).length;
console.log(`\n草稿按项目分开：${pass}/${results.length} 通过`); process.exit(pass === results.length ? 0 : 1);
