# 生成 content/sample-debug.json：“读代码与调试”线的手机端样板关（docs/41 §3B、docs/46）。
# 一段 AI 写的满减程序，四个动作：Q1 追踪变量 → Q2 找能让它露馅的输入 → Q3 判断哪种修复对 → Q4 修完用那个输入再跑一次。
# 只用已学：变量、if、>、>=、==、-、print（U1–U4）。不接入应用（course.json / UNITS 不动），等 U6 的 pick 真机验收后再接。
# 生成：python3 scripts/make-sample-debug.py；校验：python3 scripts/verify-content.py --extra content/sample-debug.json
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from verify.common import run

def real_out(code):
    out, err = run(code); assert err is None, (code, err); return out

T, F = True, False
RULE = "满 100 元减 20 元，正好 100 元也享受优惠。"
AI = "total = {x}\nif total > 100:\n    total = total - 20\nprint(total)"
def ai(x, cond="total > 100"): return AI.format(x=x).replace("total > 100", cond)
def rule(x): return x - 20 if x >= 100 else x            # 规则本身，独立于 AI 的代码写出来
CODE = ai(120)

# ---------- 核对：AI 的程序在哪些金额上和规则不一致 ----------
TRY = [80, 90, 99, 100, 101, 120]
bad = [x for x in TRY if int(real_out(ai(x))) != rule(x)]
assert bad == [100], bad                                   # 只有正好 100 露馅

# Q2 每个选项：把第 1 行换成这个金额再运行，程序的结果和规则比一比
def q2_harness(x):
    return ai(x).replace("print(total)", f"want = {rule(x)}\nprint(\"不一致\" if total != want else \"一致\")")
# Q3 每个改法：对一组金额都和规则比一比
def q3_harness(cond):
    return ("ok = True\nfor start in [" + ", ".join(map(str, TRY)) + "]:\n    total = start\n    if " + cond + ":\n        total = total - 20\n"
            "    want = start - 20 if start >= 100 else start\n    if total != want:\n        ok = False\nprint(\"全部一致\" if ok else \"有不一致\")")
for x in (100,): assert real_out(q2_harness(x)) == "不一致"
for x in (80, 99, 120): assert real_out(q2_harness(x)) == "一致"
assert real_out(q3_harness("total >= 100")) == "全部一致"
for c in ("total == 100", "total > 80", "total >= 101"): assert real_out(q3_harness(c)) == "有不一致"
# 解析里写到的具体结果
assert real_out(ai(120)) == "100" and real_out(ai(100)) == "100" and real_out(ai(99)) == "99" and real_out(ai(80)) == "80"
assert real_out(ai(120, "total == 100")) == "120"
assert real_out(ai(90, "total > 80")) == "70" and real_out(ai(99, "total > 80")) == "79"
assert real_out(ai(100, "total >= 101")) == "100"
Q4 = ai(100, "total >= 100")
assert real_out(Q4) == "80"
assert real_out("total = 100\ntotal = total - 20\ntotal = total - 20\nprint(total)") == "60"   # 以为减了两次

def opt(text, correct, why, **extra): return {"text": text, "correct": correct, "why": why, **extra}

lesson = {
 "id": "D1L1", "title": "读代码：满 100 减 20", "concept": "追踪变量、找能暴露错误的输入、判断修复、修完再试",
 "story": "奶茶店的帮手 AI 写了一段满减程序。规则是：" + RULE + "程序没有报错，可没报错不等于算对。这一关你来检查它：先看懂它算出什么，再找一个能让它露馅的金额，然后判断怎么改，最后用那个金额再试一次。",
 "introCode": CODE,
 "exercises": [
  {"type": "predict", "prompt": "AI 写的程序，total 是 120。屏幕上会显示什么？", "code": CODE,
   "options": [
     {"text": "100", "correct": T, "why": "120 > 100 成立，进入 if，total 变成 120 - 20 = 100，最后显示 100。对 120 来说，结果和规则一样——只试一个金额，看不出它有没有问题。"},
     {"text": "120", "correct": F, "why": "120 > 100 成立，缩进的那一行会运行，total 已经被改成 100，print 显示的是改过之后的值。"},
     {"text": "20", "correct": F, "why": "20 是减掉的数，没有单独显示；print(total) 显示的是变量 total 现在的值，100。"}],
   "tip": "一行一行追：每一行运行完，total 现在是多少？"},
  {"type": "pick", "key": "fix", "checks": [], "expected": "不一致",
   "prompt": "规则：" + RULE + "把第 1 行的 120 换成下面哪个金额再运行，能看出程序和规则不一致？", "code": CODE,
   "options": [
     opt("total = 100", T, "规则说正好 100 元也减，应该显示 80；程序的条件是 total > 100，100 > 100 不成立，不减，显示 100。“正好等于 100”这一种被 > 漏掉了。", fixed=q2_harness(100)),
     opt("total = 99", F, "99 不到 100：规则不减，程序也不减，都显示 99，一致。它离 100 很近，但还在不减的那一边。", fixed=q2_harness(99)),
     opt("total = 120", F, "120 超过 100：规则减 20，程序也减 20，都显示 100，一致。比 100 大的金额，> 和 >= 结果一样，测不出问题。", fixed=q2_harness(120)),
     opt("total = 80", F, "80 不到 100：规则不减，程序也不减，都显示 80，一致。", fixed=q2_harness(80))],
   "tip": "好的测试金额，是让“程序显示的”和“规则要的”不一样的那个。试试正好卡在规则分界线上的金额。"},
  {"type": "pick", "key": "fix", "checks": [], "expected": "全部一致",
   "prompt": "要让程序和规则一致，第 2 行 if total > 100: 应该怎么改？（规则：" + RULE + "）", "code": CODE,
   "options": [
     opt("改成 if total >= 100:", T, "> 只认“大于 100”，漏掉了正好 100；>= 是“大于或等于”，把 100 补上了。100、101、120 都减 20，80、90、99 都不减，和规则全部一致。", fixed=q3_harness("total >= 100")),
     opt("改成 if total == 100:", F, "正好 100 修好了，可是 120 也该减 20，现在 120 不减，显示 120。只修了露馅的那一个金额，别的又错了。", fixed=q3_harness("total == 100")),
     opt("改成 if total > 80:", F, "100 修好了，但 90、99 也被减了 20（显示 70、79）。不到 100 不该减，这是改过头了。", fixed=q3_harness("total > 80")),
     opt("改成 if total >= 101:", F, "金额是整数时，>= 101 和 > 100 是一回事：100 还是不减，显示 100。看起来改了，其实没修。", fixed=q3_harness("total >= 101"))],
   "tip": "改完要对各种金额都对：不到 100、正好 100、超过 100 都想一遍，不是只对一个。"},
  {"type": "predict", "prompt": "改成 if total >= 100: 之后，用刚才露馅的金额 100 再运行一次。屏幕上会显示什么？", "code": Q4,
   "options": [
     {"text": "80", "correct": T, "why": "100 >= 100 成立，进入 if，100 - 20 = 80，和规则一致。修完要用刚才露馅的那个金额再试一次，确认真的修好了。"},
     {"text": "100", "correct": F, "why": ">= 是“大于或等于”，100 等于 100，条件成立，会减 20。显示 100 是修之前 > 100 的结果。"},
     {"text": "60", "correct": F, "why": "if 里只有一行 total = total - 20，只减一次：100 - 20 = 80。"},
     {"text": "120", "correct": F, "why": "第 1 行现在是 total = 100，不是 120；满 100 是减 20，不是加 20。"}],
   "tip": "修完别急着走：拿刚才露馅的金额再跑一遍。"},
 ]}

for e in lesson["exercises"]:
    if e["type"] == "predict":
        out = real_out(e["code"]); cor = [o for o in e["options"] if o["correct"]]
        assert len(cor) == 1 and cor[0]["text"] == out and all(o["text"] != out for o in e["options"] if not o["correct"]), e["prompt"]
assert len(lesson["story"]) <= 140, len(lesson["story"])

unit = {"id": "D1", "title": "读代码与调试（样板）", "subtitle": "追踪、测边界、选修复、再试一次", "lessons": [lesson]}
p = pathlib.Path(__file__).resolve().parent.parent / "content" / "sample-debug.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(unit["lessons"]), "题目", sum(len(l["exercises"]) for l in unit["lessons"]), "讲解字数", len(lesson["story"]))
