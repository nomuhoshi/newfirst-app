# 用真实 Python 验证所有题目（唯一入口：python3 scripts/verify-content.py [--verbose]，或 npm run verify:content）。
# 依次调用 scripts/verify/ 里的检查：选输出、填空（含原 verify-fill.py 的逻辑）、排序、代码题（pending）。
# 每段程序在全新变量空间运行，单次上限 2 秒，只用来防卡死。每个检查分别报告 检查/跳过/失败 项。有失败时退出码 1。
import json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from verify import common, output, fill, order, codetask

ROOT = pathlib.Path(__file__).resolve().parent.parent
verbose = "--verbose" in sys.argv
course = json.loads((ROOT / "content/course.json").read_text())
items, lessons = [], []
for u in course["units"]:
    if not u.get("file"): continue
    for l in json.loads((ROOT / "content" / u["file"]).read_text())["lessons"]:
        lessons.append(l)
        for qi, ex in enumerate(l["exercises"], 1): items.append((f"{l['id']}-Q{qi}({ex['type']})", l, ex))
# 候选单元：content/ 里已经写好、但还没接进 course.json 的 unitN.json（没有上线）。同样用真实 Python 验证，免得接入时才发现问题。
listed = {u.get("file") for u in course["units"]}
candidates = sorted(p.name for p in (ROOT / "content").glob("unit*.json") if p.name not in listed)
for name in candidates:
    for l in json.loads((ROOT / "content" / name).read_text())["lessons"]:
        lessons.append(l)
        for qi, ex in enumerate(l["exercises"], 1): items.append((f"{l['id']}-Q{qi}({ex['type']})", l, ex))
if candidates: print("候选单元（未接入课程）：", "、".join(candidates))
# 自检：报错题的检查必须能分出对错（期望类型 / 行号 / 报错前输出 / 改法 任何一项写错都要判失败）
def _selftest():
    base = {"type": "predict", "prompt": "x", "code": 'print("开始")\nprint("共" + 4)', "fixed": "开始\n共4",
            "expectError": {"type": "TypeError", "line": 2, "stdout": "开始"},
            "options": [{"text": "a", "correct": True, "why": "w", "program": 'print("开始")\nprint("共" + str(4))'},
                        {"text": "b", "correct": False, "why": "w", "program": 'print("开始")\nprint("共" + int(4))'}]}
    import copy
    def fails(mut):
        ex = copy.deepcopy(base); mut(ex); return len(output.check([("自检", {}, ex)]).fails)
    assert fails(lambda e: None) == 0, "自检：正确的报错题被判失败"
    for name, mut in [("类型", lambda e: e["expectError"].update(type="NameError")), ("行号", lambda e: e["expectError"].update(line=1)),
                      ("报错前输出", lambda e: e["expectError"].update(stdout="")), ("不报错的程序", lambda e: e.update(code='print("开始")')),
                      ("错误改法其实可行", lambda e: e["options"][1].update(program=e["options"][0]["program"])),
                      ("正确改法不可行", lambda e: e["options"][0].update(program=e["options"][1]["program"])),
                      ("两个正确选项", lambda e: e["options"][1].update(correct=True)), ("缺解释", lambda e: e["options"][1].update(why=""))]:
        assert fails(mut) > 0, "自检：写错的报错题没有被判失败：" + name
_selftest()
known_types = {"predict", "fill", "order"}
results = [output.check(items), fill.check(items), order.check(items), codetask.check(lessons)]
other = common.Check("其他题型")
for w, l, ex in items:
    if ex["type"] not in known_types: other.skip(w, f"题型 {ex['type']} 没有检查")
results.append(other)
total_fail = 0
for c in results:
    for s in c.skipped: print("⏭️ ", c.name, s)
    for s in c.known: print("⚠️ ", c.name, s)
    for s in c.fails: print("❌", c.name, s)
    if verbose or c.name.startswith("代码题"):
        for s in c.notes: print("   ", c.name, s)
print()
for c in results:
    print(f"{c.name}：检查 {c.checked} 项，跳过 {len(c.skipped)} 项，已知问题 {len(c.known)} 项，失败 {len(c.fails)} 项")
    total_fail += len(c.fails)
print(f"合计真实运行 {common.stats['runs']} 次（单次上限 {common.RUN_S} 秒，只防卡死）；失败 {total_fail} 项")
sys.exit(1 if total_fail else 0)
