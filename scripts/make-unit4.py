# 生成 content/unit4.json（第 4 单元「重复」第一部分 U4L1–U4L4，每关 4 题）。
# 内容在这里改，再运行：python3 scripts/make-unit4.py && python3 scripts/verify-content.py
# 只用已学语法：print（含逗号）、变量、+ - * /、字符串、len、比较、if/elif/else、and/or/not，加上本关新教的内容。
import json, pathlib

def pred(prompt, code, opts, tip=None):
    d = {"type": "predict", "prompt": prompt, "code": code,
         "options": [{"text": t, "correct": c, "why": w} for t, c, w in opts]}
    if tip: d["tip"] = tip
    return d

def fill(prompt, code, tokens, answer, expected, why, hint):
    return {"type": "fill", "prompt": prompt, "code": code, "tokens": tokens, "answer": answer, "expected": expected, "why": why, "hint": hint}

def order(prompt, lines, shuffled, answers, expected, hint):
    return {"type": "order", "prompt": prompt, "lines": lines, "shuffled": shuffled, "answers": answers, "expected": expected, "hint": hint}


import itertools, io, contextlib
def valid_orders(lines, expected):
    """所有能得到 expected 的排列都算对（规范答案在最前面）。"""
    res = []
    for p in itertools.permutations(range(len(lines))):
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf): exec("\n".join(lines[k] for k in p), {})
        except Exception: continue
        if buf.getvalue().rstrip("\n") == expected: res.append(list(p))
    canon = list(range(len(lines))); res.sort(key=lambda a: a != canon); return res

SHOW = "点单屏运行这段程序，屏幕上会显示什么？"
T, F = True, False

lessons = [
 {"id": "U4L1", "title": "一次做好几杯", "concept": "for 重复同一件事",
  "story": "要重复做同一件事，不用把 print 抄好几遍。for i in range(3): 表示“重复 3 次”，下面缩进 4 格的行就是每次都做的事（叫循环体）。没缩进的行不重复，循环做完后才执行一次。",
  "introCode": "for i in range(3):\n    print(\"做一杯奶茶\")\nprint(\"全部做好\")",
  "exercises": [
    pred(SHOW, "for i in range(3):\n    print(\"做一杯\")", [
        ("做一杯\n做一杯\n做一杯", T, "range(3) 让循环体执行 3 次。"),
        ("做一杯\n做一杯\n做一杯\n做一杯", F, "range(3) 是 3 次，不是 4 次：数到 3 之前就停。"),
        ("做一杯", F, "for 会重复循环体，不只执行一次。")],
        tip="range(n) 重复 n 次。"),
    pred(SHOW, "for i in range(2):\n    print(\"摇匀\")\nprint(\"出杯\")", [
        ("摇匀\n摇匀\n出杯", T, "只有缩进的 摇匀 重复 2 次；出杯 没缩进，循环结束后执行一次。"),
        ("摇匀\n出杯\n摇匀\n出杯", F, "没缩进的行不属于循环，不会每次都执行。"),
        ("摇匀\n出杯", F, "range(2) 让缩进的行执行 2 次。")],
        tip="缩进的行重复；没缩进的行只执行一次。"),
    order("排好顺序。屏幕显示：\n开始做\n加冰\n加冰\n做好了",
        ["print(\"开始做\")", "for i in range(2):", "    print(\"加冰\")", "print(\"做好了\")"], [3, 2, 1, 0], [[0, 1, 2, 3]], "开始做\n加冰\n加冰\n做好了",
        "开始做 只出现一次，放最前；缩进的 加冰 紧跟 for；做好了 放最后。"),
    fill("出餐铃要响 4 声，补全数字。屏幕显示 4 行：叮", "for i in range({0}):\n    print(\"叮\")",
        ["4", "3", "5"], ["4"], "叮\n叮\n叮\n叮",
        {"3": "range(3) 只重复 3 次。", "5": "range(5) 会重复 5 次，多了一声。"},
        "range(n) 正好重复 n 次。"),
  ]},
 {"id": "U4L2", "title": "从几数到几", "concept": "range 的起点和步长",
  "story": "循环变量 i 每次会换成 range 里的下一个数。range(3) 是 0、1、2；range(1, 4) 从 1 开始，到 4 之前停：1、2、3（不含 4）。range(0, 10, 3) 每次加 3；步长也可以是负数，用来倒数。",
  "introCode": "for i in range(1, 4):\n    print(i)",
  "exercises": [
    pred(SHOW, "for i in range(1, 4):\n    print(i)", [
        ("1\n2\n3", T, "从 1 开始，到 4 之前停，不含 4。"),
        ("1\n2\n3\n4", F, "range(1, 4) 不包含结尾的 4。"),
        ("0\n1\n2\n3", F, "写了起点 1，就从 1 开始。")],
        tip="range(a, b)：包含 a，不包含 b。"),
    pred(SHOW, "for i in range(0, 10, 3):\n    print(i)", [
        ("0\n3\n6\n9", T, "从 0 开始每次加 3：0、3、6、9；下一个 12 超过了 10 之前的范围。"),
        ("0\n3\n6", F, "9 还小于 10，也算在里面。"),
        ("3\n6\n9", F, "起点是 0，第一个数就是 0。")],
        tip="第三个数是步长：每次加多少。"),
    fill("要显示 1 到 5 这五个数，补全结尾的数字。", "for i in range(1, {0}):\n    print(i)",
        ["6", "5", "4"], ["6"], "1\n2\n3\n4\n5",
        {"5": "range(1, 5) 到 5 之前就停，只有 1 到 4。", "4": "range(1, 4) 只有 1、2、3。"},
        "结尾的数字本身不包含在内，要比 5 多 1。"),
    fill("倒数开门：屏幕依次显示 3、2、1。补全步长。", "for i in range(3, 0, {0}):\n    print(i)",
        ["-1", "1", "0"], ["-1"], "3\n2\n1",
        {"1": "步长 1 是往上数，从 3 往上永远到不了 0，一个数也不显示。", "0": "步长不能是 0，会报错。"},
        "倒着数，每次要减 1。"),
  ]},
 {"id": "U4L3", "title": "第几号订单", "concept": "使用循环变量",
  "story": "每一轮，循环变量 i 都是不同的数，可以拿来显示或计算。range(3) 里 i 从 0 开始；想从 1 开始显示，可以写 i + 1，或者用 range(1, 4)。循环结束后，i 还在，保留最后一轮的值。",
  "introCode": "for i in range(1, 4):\n    print(\"订单\", i)",
  "exercises": [
    pred(SHOW, "for i in range(3):\n    print(\"第\", i + 1, \"单\")", [
        ("第 1 单\n第 2 单\n第 3 单", T, "i 依次是 0、1、2，加 1 后是 1、2、3。"),
        ("第 0 单\n第 1 单\n第 2 单", F, "显示的是 i + 1，不是 i。"),
        ("第 i + 1 单\n第 i + 1 单\n第 i + 1 单", F, "i + 1 没加引号，会算出数字。")],
        tip="range(3) 的 i 从 0 开始。"),
    fill("显示每一杯的编号。屏幕显示：\n杯 1\n杯 2\n杯 3", "for i in range(1, 4):\n    print(\"杯\", {0})",
        ["i", "\"i\"", "3"], ["i"], "杯 1\n杯 2\n杯 3",
        {"\"i\"": "加了引号就是文字 i，每行都会显示“杯 i”。", "3": "写死 3，每行都是杯 3。要用每轮会变的 i。"},
        "每一轮会变的是循环变量。"),
    order("排好顺序。屏幕显示：\n订单 1\n完成\n订单 2\n完成",
        ["for i in range(1, 3):", "    print(\"订单\", i)", "    print(\"完成\")"], [2, 0, 1], [[0, 1, 2]], "订单 1\n完成\n订单 2\n完成",
        "两行都缩进、都在循环里，每轮先显示订单号再显示完成。"),
    pred(SHOW, "for i in range(3):\n    print(\"做\")\nprint(i)", [
        ("做\n做\n做\n2", T, "循环结束后 i 还在，是最后一轮的值 2。"),
        ("做\n做\n做\n3", F, "range(3) 最后一轮的 i 是 2，没有 3。"),
        ("做\n做\n做", F, "最后一行没缩进，循环后会执行一次，i 仍然存在。")],
        tip="循环做完，i 保留最后一轮的值。"),
  ],
  "pending": [{"type": "modify", "status": "待 Claude 的代码题运行器，暂不开放", "replaces": 2, "plan": "改一改：把从 0 开始的编号改成从 1 开始"}]},
 {"id": "U4L4", "title": "一共几杯", "concept": "累加：total = 0",
  "story": "要求和或计数，先在循环外准备一个变量 total = 0，每一轮用 total = total + … 往上加，循环结束后再显示。total = 0 要放在循环外面，否则每轮都会被清零。",
  "introCode": "total = 0\nfor i in range(1, 4):\n    total = total + i\nprint(total)",
  "exercises": [
    pred(SHOW, "total = 0\nfor i in range(1, 4):\n    total = total + i\nprint(total)", [
        ("6", T, "0 + 1 + 2 + 3 = 6；print 在循环外，只显示一次最后结果。"),
        ("1\n3\n6", F, "print 没缩进，不在循环里，只在最后显示一次。"),
        ("3", F, "total 是一轮轮加起来的，不是最后的 i。")],
        tip="累加：每轮在原来的基础上加。"),
    order("每单 2 杯，共 3 单。排好顺序。屏幕显示：总杯数 6",
        ["cups = 0", "for i in range(3):", "    cups = cups + 2", "print(\"总杯数\", cups)"], [3, 2, 1, 0], [[0, 1, 2, 3]], "总杯数 6",
        "cups = 0 放循环前面；缩进的累加紧跟 for；显示放最后。"),
    fill("算 1 + 2 + 3 + 4。补全两处，屏幕显示：10", "total = {0}\nfor i in range(1, 5):\n    total = total {1} i\nprint(total)",
        ["0", "1", "+", "*"], ["0", "+"], "10",
        {"1": "从 1 开始加会多出 1。求和要从 0 开始。", "*": "* 是乘，这里要加起来。"},
        "求和：从 0 开始，每轮加上 i。"),
    pred(SHOW, "total = 0\nfor i in range(1, 4):\n    total = i\nprint(total)", [
        ("3", T, "total = i 每轮都把 total 换成 i，没有加起来，最后是 3。"),
        ("6", F, "要写 total = total + i 才是加起来；这里只是覆盖。"),
        ("0", F, "循环里给 total 重新存了值，最后是 3。")],
        tip="累加要写 total = total + i。"),
  ],
  "pending": [{"type": "modify", "status": "待 Claude 的代码题运行器，暂不开放", "replaces": 3, "plan": "改一改：把 total = 0 从循环里移到循环外"}]},
]

unit = {"id": "U4", "title": "重复", "subtitle": "for、range、累加", "lessons": lessons}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit4.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons))
