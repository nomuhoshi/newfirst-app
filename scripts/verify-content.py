# 用真实 Python 验证所有题目（唯一入口：python3 scripts/verify-content.py [--verbose]，或 npm run verify:content）。
# 依次调用 scripts/verify/ 里的检查：选输出、填空（含原 verify-fill.py 的逻辑）、排序、代码题（pending）。
# 每段程序在全新变量空间运行，单次上限 2 秒，只用来防卡死。每个检查分别报告 检查/跳过/失败 项。有失败时退出码 1。
import json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from verify import common, output, fill, order, codetask, pick

ROOT = pathlib.Path(__file__).resolve().parent.parent
verbose = "--verbose" in sys.argv
course = json.loads((ROOT / "content/course.json").read_text())
items, lessons = [], []
for u in course["units"]:
    if not u.get("file"): continue
    data = json.loads((ROOT / "content" / u["file"]).read_text())
    for l in data["lessons"] + data.get("heldLessons", []):  # heldLessons：已写好、已验证，但还没开放给学生的关（app 只读 lessons）
        lessons.append(l)
        for qi, ex in enumerate(l["exercises"], 1): items.append((f"{l['id']}-Q{qi}({ex['type']})", l, ex))
# 草稿单元（还没挂进 course.json）：--extra content/unit7.json 把它的 lessons + heldLessons 也一起检查，可以重复写多个
for i, a in enumerate(sys.argv):
    if a == "--extra" and i + 1 < len(sys.argv):
        data = json.loads((ROOT / sys.argv[i + 1]).read_text())
        for l in data["lessons"] + data.get("heldLessons", []):
            lessons.append(l)
            for qi, ex in enumerate(l["exercises"], 1): items.append((f"{l['id']}-Q{qi}({ex['type']})", l, ex))
known_types = {"predict", "fill", "order", "pick"}
results = [output.check(items), fill.check(items), order.check(items), pick.check(items), codetask.check(lessons)]
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
