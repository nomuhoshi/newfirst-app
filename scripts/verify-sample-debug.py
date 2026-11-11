# 用和 verify-content.py 相同的检查器（真实 Python）核对 content/sample-debug.json。
# 本分支的 verify-content.py 还没有 --extra，样板关又不进 course.json，所以单独跑。
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from verify import output, fill, order, pick, common
data = json.loads((pathlib.Path(__file__).resolve().parent.parent / "content" / "sample-debug.json").read_text())
items = [(f"{l['id']}-Q{i}({ex['type']})", l, ex) for l in data["lessons"] for i, ex in enumerate(l["exercises"], 1)]
fail = 0
for c in (output.check(items), fill.check(items), order.check(items), pick.check(items)):
    for s in c.fails: print("❌", c.name, s)
    print(f"{c.name}：检查 {c.checked} 项，失败 {len(c.fails)} 项"); fail += len(c.fails)
print(f"合计真实运行 {common.stats['runs']} 次；失败 {fail} 项"); sys.exit(1 if fail else 0)
