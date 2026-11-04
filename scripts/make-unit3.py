# 生成 content/unit3.json（第 3 单元「比较与判断」，目前先做前 2 关 × 4 题；规格见 spec/SPEC.md §0.5）。
# 内容在这里改，再运行：python3 scripts/make-unit3.py
# 生成时就用真实 python3 逐题核对：选输出题的正确项 = 真实输出；填空题的正确词块 = 期望输出、错误词块 ≠ 期望输出；排序题的正确排列 = 全部排列里输出一致的那些。核对不通过就不写文件。
import json, pathlib, subprocess, sys, itertools

def run(code):
    r = subprocess.run([sys.executable, "-I", "-c", code], capture_output=True, text=True, timeout=10)
    return r.stdout.rstrip("\n") if r.returncode == 0 else None  # 出错 → None

def pred(prompt, code, opts, tip=None):
    real = run(code)
    good = [t for t, c, w in opts if c]
    assert len(good) == 1, f"选输出题必须恰有 1 个正确项：{code!r}"
    assert good[0] == real, f"选输出题与真实运行不一致：{code!r} 真实={real!r} 题目={good[0]!r}"
    for t, c, w in opts:
        assert w, f"每个选项都要有解释：{t!r}"
        if not c: assert t != real, f"错误选项等于真实输出：{t!r}"
    d = {"type": "predict", "prompt": prompt, "code": code, "options": [{"text": t, "correct": c, "why": w} for t, c, w in opts]}
    if tip: d["tip"] = tip
    return d

def fill(prompt, code, tokens, answer, expected, why, hint):
    assert len(answer) == 1
    got = run(code.replace("{0}", answer[0]))
    assert got == expected, f"填空题正确词块的真实输出不是期望：{code!r} 真实={got!r} 期望={expected!r}"
    for t in tokens:
        if t in answer: continue
        assert t in why, f"每个错误词块都要有解释：{t!r}"
        assert run(code.replace("{0}", t)) != expected, f"错误词块也得到了期望输出：{t!r}"
    return {"type": "fill", "prompt": prompt, "code": code, "tokens": tokens, "answer": answer, "expected": expected, "why": why, "hint": hint}

def order(prompt, lines, shuffled, answers, expected, hint):
    valid = [list(p) for p in itertools.permutations(range(len(lines))) if run("\n".join(lines[i] for i in p)) == expected]
    assert sorted(valid) == sorted(answers), f"排序题的正确排列与真实运行不一致：真实={valid} 题目={answers}"
    assert shuffled != answers[0] and sorted(shuffled) == list(range(len(lines)))
    return {"type": "order", "prompt": prompt, "lines": lines, "shuffled": shuffled, "answers": answers, "expected": expected, "hint": hint}

SHOW = "点单屏运行这段程序，屏幕上会显示什么？"
T, F = True, False

lessons = [
 {"id": "U3L1", "title": "够不够送小料", "concept": "比较与 True/False",
  "story": "点单屏要判断：杯数够不够送小料？两个值比一比，结果只有两种：对（True）或不对（False）。",
  "introCode": "cups = 3\nprint(cups > 2)",
  "exercises": [
    # 看懂
    pred(SHOW, "cups = 3\nprint(cups > 2)", [
        ("True", T, "3 > 2 成立，比较的结果是 True（对）。"),
        ("False", F, "3 比 2 大，所以 3 > 2 是成立的，结果是 True，不是 False。"),
        ("3", F, "比较显示的是“成立 / 不成立”，不是变量里的值。")],
        "> 是“大于”，< 是“小于”。比较的结果只有 True 和 False 两种。"),
    # 动手
    fill("价格 18 元，没超过 20。屏幕要显示 True，补全比较符号。", "price = 18\nprint(price {0} 20)",
         ["<", ">", "+"], ["<"], "True",
         {">": "18 > 20 不成立，会显示 False。要表示“小于 20”，开口朝向小的那一边：<。",
          "+": "+ 是加法，会显示 38，不是 True 或 False。"},
         "18 比 20 小，用“小于”。"),
    order("排好顺序，让屏幕先显示 True，再显示 False（先 3 杯，后 1 杯）",
          ["cups = 3", "print(cups > 2)", "cups = 1", "print(cups > 2)"],
          [2, 3, 0, 1], [[0, 1, 2, 3], [0, 3, 2, 1]], "True\nFalse",
          "print 显示的是那一刻 cups 的比较结果：先放 3 杯的，再换成 1 杯的。"),
    # 换个例子再做
    pred(SHOW, "price = 15\nprint(price < 10)", [
        ("False", T, "15 不小于 10，比较不成立，结果是 False。"),
        ("True", F, "15 比 10 大，15 < 10 不成立，结果是 False。"),
        ("15", F, "比较显示的是 True 或 False，不是变量里的值。")],
        "每次比较，先把变量换成它里面的值，再看大小。"),
  ]},
 {"id": "U3L2", "title": "是不是大杯", "concept": "== 与 !=",
  "story": "顾客点了「大杯」，屏幕要判断：他点的是不是大杯？判断“相等”用 ==，判断“不相等”用 !=。",
  "introCode": 'size = "大杯"\nprint(size == "大杯")',
  "exercises": [
    # 看懂
    pred(SHOW, 'size = "大杯"\nprint(size == "大杯")', [
        ("True", T, "size 里存着「大杯」，和「大杯」相等，结果是 True。"),
        ("False", F, "两边都是「大杯」，相等，所以 == 的结果是 True。"),
        ("大杯", F, "比较显示的是 True 或 False，不是变量里的文字。")],
        "== 读作“等于”：两边一样是 True，不一样是 False。一个 = 是存值，两个 == 才是比较。"),
    pred(SHOW, "cups = 2\nprint(cups != 3)", [
        ("True", T, "!= 是“不等于”。2 和 3 不一样，所以“不等于”成立，结果是 True。"),
        ("False", F, "!= 问的是“不一样吗？”。2 和 3 确实不一样，所以是 True。"),
        ("2", F, "比较显示的是 True 或 False，不是变量里的值。")],
        "!= 读作“不等于”：两边不一样是 True，一样是 False。"),
    # 动手
    fill("顾客点的是中杯，不是大杯。屏幕要显示 False，补全比较符号。", 'size = "中杯"\nprint(size {0} "大杯")',
         ["==", "=", "!="], ["=="], "False",
         {"=": "一个 = 是“存值”，不是比较，写在这里程序会出错。比较要用两个 ==。",
          "!=": "!= 是“不等于”。中杯和大杯不一样，所以会显示 True，不是 False。"},
         "问“是不是大杯”，用 ==；不是，所以结果是 False。"),
    # 换个例子再做（常见错因：比较不会改变变量，也不会自己显示）
    pred(SHOW, "cups = 2\ncups == 3\nprint(cups)", [
        ("2", T, "cups == 3 只是比较，不会把 cups 改成 3；它的结果也没有被 print，所以不会显示。屏幕只显示 print(cups)：2。"),
        ("3", F, "== 是比较，不是存值。想把 cups 改成 3，要写一个 =：cups = 3。"),
        ("False", F, "比较的结果不会自己显示，要放进 print(...) 里才会显示。")],
        "== 只比较，不改变变量，也不会自己显示；改值用 =，显示用 print。"),
  ]},
]

unit = {"id": "U3", "title": "比较与判断", "subtitle": "True/False、if/else", "lessons": lessons}
for l in lessons:
    assert len(l["exercises"]) == 4, l["id"]
out = pathlib.Path(__file__).resolve().parent.parent / "content" / "unit3.json"
out.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"ok：{len(lessons)} 关 × 4 题，已用真实 python3 核对，写入 {out}")
