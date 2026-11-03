# 生成 content/unit4.json（第 4 单元「重复」U4L1–U4L8，每关 4 题）。
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
def _out(code):
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf): exec(code, {})
    except Exception as e: return "<" + type(e).__name__ + ">"
    return buf.getvalue().rstrip("\n")
def _case(lines, case):
    return [f"{l.split(' = ')[0]} = {case[l.split(' = ')[0]]!r}" if " = " in l and not l.startswith(" ") and l.split(" = ")[0] in case else l for l in lines]
def valid_orders(lines, expected, cases=()):
    """能得到 expected、并且在 cases 的每组数据下都和标准顺序输出相同的排列才算对（规范答案在最前面）。"""
    canon = list(range(len(lines))); res = []
    for p in itertools.permutations(canon):
        if _out("\n".join(lines[k] for k in p)) != expected: continue
        if all(_out("\n".join(_case(lines, c)[k] for k in p)) == _out("\n".join(_case(lines, c)[k] for k in canon)) for c in cases): res.append(list(p))
    res.sort(key=lambda a: a != canon); return res
O48 = ["n = 4", "total = 0", "for i in range(1, n + 1):", "    total = total + 2", "    if i == 3:", "        total = total + 1", "print(\"总杯数\", total)"]
C48 = [{"n": k} for k in range(0, 7)]

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
 {"id": "U4L5", "title": "只数大单", "concept": "for 里放 if",
  "story": "循环里可以放 if：每一轮都检查一次，条件成立才做。if 在 for 里面，所以 if 要缩进 4 格，if 要做的事再缩进 4 格（共 8 格）。计数器 count = 0 放在循环外，循环结束后再显示。",
  "introCode": "count = 0\nfor i in range(1, 6):\n    if i >= 4:\n        count = count + 1\nprint(\"大单数\", count)",
  "exercises": [
    pred(SHOW, "for i in range(1, 6):\n    if i >= 4:\n        print(\"大单\", i)", [
        ("大单 4\n大单 5", T, "每一轮都检查：只有 i 是 4 和 5 时条件成立。"),
        ("大单 3\n大单 4\n大单 5", F, "3 >= 4 不成立。"),
        ("大单 1\n大单 2\n大单 3\n大单 4\n大单 5", F, "print 在 if 里（缩进 8 格），条件不成立的轮次不显示。")],
        tip="for 里的 if 每一轮都会检查一次。"),
    fill("数一数 1 到 5 号订单里，编号 3 以上（含 3）的有几单。屏幕显示：3", "count = 0\nfor i in range(1, 6):\n    if i {0} 3:\n        count = count + 1\nprint(count)",
        [">=", ">", "=="], [">="], "3",
        {">": "> 不含 3，只数到 4、5 两单。", "==": "== 只数正好是 3 的那一单。"},
        "“3 以上（含 3）”用包含相等的符号。"),
    order("排好顺序：数 1 到 4 号里编号大于 2 的订单。屏幕显示：大单数 2",
        ["count = 0", "for i in range(1, 5):", "    if i > 2:", "        count = count + 1", "print(\"大单数\", count)"], [4, 3, 2, 1, 0], [[0, 1, 2, 3, 4]], "大单数 2",
        "计数器放循环前；if 在 for 里；加 1 在 if 里；最后显示一次。"),
    pred(SHOW, "count = 0\nfor i in range(1, 5):\n    if i > 2:\n        count = count + 1\n    print(count)", [
        ("0\n0\n1\n2", T, "print 缩进 4 格，在 for 里、if 外：每一轮都显示一次当前的 count。"),
        ("2", F, "print 缩进了，在循环里，每轮都会显示。"),
        ("1\n2", F, "print 不在 if 里，条件不成立的轮次也会显示。")],
        tip="看缩进判断一行属于谁：0 格在循环外，4 格在 for 里，8 格在 if 里。"),
  ],
  "pending": [{"type": "modify", "replaces": 2, "status": "待 Claude 的代码题运行器，暂不开放", "plan": "改一改：把放错位置的 count = 0（在循环里）移到循环外"}]},
 {"id": "U4L6", "title": "做到够为止", "concept": "while",
  "story": "while 和 if 很像，但不只执行一次：只要条件成立，就一遍遍执行下面缩进的行，每遍做完再回来检查。循环里一定要改变条件里的变量（比如 n = n + 1），否则条件永远成立，程序停不下来——点单屏会提示运行超时，这不算答错、不扣红心，改好再试。",
  "introCode": "n = 1\nwhile n <= 3:\n    print(\"第\", n, \"杯\")\n    n = n + 1",
  "exercises": [
    pred(SHOW, "n = 1\nwhile n <= 3:\n    print(n)\n    n = n + 1", [
        ("1\n2\n3", T, "n 是 1、2、3 时条件成立；n 变成 4 时不成立，循环结束。"),
        ("1", F, "while 不是只执行一次：每遍做完会回来再检查条件。"),
        ("1\n2\n3\n4", F, "n 是 4 时 4 <= 3 不成立，不会再显示。")],
        tip="while：条件成立就再来一遍。"),
    order("排好顺序。屏幕显示：\n做好第 1 杯\n做好第 2 杯\n做好第 3 杯",
        ["cups = 0", "while cups < 3:", "    cups = cups + 1", "    print(\"做好第\", cups, \"杯\")"], [3, 1, 2, 0], [[0, 1, 2, 3]], "做好第 1 杯\n做好第 2 杯\n做好第 3 杯",
        "先存 cups；while 下面先加 1 再显示，第一杯才是 1。"),
    fill("从 1 数到 3。补全条件，屏幕显示：\n1\n2\n3", "n = 1\nwhile n {0} 3:\n    print(n)\n    n = n + 1",
        ["<=", "<", "=="], ["<="], "1\n2\n3",
        {"<": "n < 3 在 n 是 3 时不成立，只显示 1、2。", "==": "n 一开始是 1，1 == 3 不成立，循环一遍也不执行。"},
        "要包含 3，用包含相等的符号。"),
    pred(SHOW, "money = 10\nwhile money >= 4:\n    money = money - 4\nprint(money)", [
        ("2", T, "10 → 6 → 2；2 >= 4 不成立，停下，显示 2。"),
        ("6", F, "while 会一遍遍执行，不是只减一次。"),
        ("-2", F, "每遍开始前都检查：money 是 2 时不再减。")],
        tip="每一遍开始前都检查条件。"),
  ],
  "pending": [{"type": "modify", "replaces": 3, "status": "待 Claude 的代码题运行器，暂不开放", "plan": "改一改：给忘记更新变量的 while 加上 n = n + 1（运行会超时：不算作答、不扣红心）"}]},
 {"id": "U4L7", "title": "售罄就停", "concept": "break 和 continue",
  "story": "break：立刻结束整个循环，后面的轮次都不做了。continue：只跳过这一轮剩下的部分，直接进入下一轮。它们都写在循环里的 if 下面。",
  "introCode": "for i in range(1, 6):\n    if i == 3:\n        break\n    print(i)",
  "exercises": [
    pred(SHOW, "for i in range(1, 6):\n    if i == 3:\n        break\n    print(i)", [
        ("1\n2", T, "i 是 3 时 break，整个循环结束，4、5 都不做了。"),
        ("1\n2\n4\n5", F, "break 不是只跳过一轮，而是结束整个循环。"),
        ("1\n2\n3", F, "break 在 print 前面，3 来不及显示。")],
        tip="break = 整个循环到此为止。"),
    pred(SHOW, "for i in range(1, 6):\n    if i == 3:\n        continue\n    print(i)", [
        ("1\n2\n4\n5", T, "i 是 3 时 continue，跳过这一轮的 print，接着做 4、5。"),
        ("1\n2", F, "continue 不结束循环，只跳过这一轮。"),
        ("1\n2\n3\n4\n5", F, "i 是 3 那一轮的 print 被跳过了。")],
        tip="continue = 这一轮不做了，下一轮继续。"),
    fill("第 4 杯时原料卖完了，之后都不能再卖。补全，屏幕显示：\n卖出第 1 杯\n卖出第 2 杯\n卖出第 3 杯", "for i in range(1, 6):\n    if i == 4:\n        {0}\n    print(\"卖出第\", i, \"杯\")",
        ["break", "continue"], ["break"], "卖出第 1 杯\n卖出第 2 杯\n卖出第 3 杯",
        {"continue": "continue 只跳过第 4 杯，第 5 杯还会卖出。“之后都不能再卖”要结束整个循环。"},
        "要结束整个循环。"),
    pred(SHOW, "n = 0\nwhile n < 10:\n    n = n + 1\n    if n == 3:\n        break\nprint(n)", [
        ("3", T, "n 加到 3 时 break，循环提前结束，显示 3。"),
        ("10", F, "break 让循环在 n 是 3 时就结束了。"),
        ("2", F, "n 先加 1 变成 3，然后才 break。")],
        tip="while 里也能用 break。"),
  ],
  "pending": [{"type": "modify", "replaces": 4, "status": "待 Claude 的代码题运行器，暂不开放", "plan": "改一改：把误用的 continue 改成 break（或反过来）"}]},
 {"id": "U4L8", "title": "项目：批量订单统计", "concept": "单元项目：循环 + 累加 + 判断",
  "story": "单元项目：一共有 n 单，编号 1 到 n，每单 2 杯；第 3 号订单多要 1 杯。用循环算出总杯数。注意：累加器从 0 开始，range 要正好覆盖 1 到 n，特殊订单只加一次。",
  "introCode": "n = 5\ntotal = 0\nfor i in range(1, n + 1):\n    total = total + 2\n    if i == 3:\n        total = total + 1\nprint(\"总杯数\", total)",
  "exercises": [
    pred(SHOW, "n = 5\ntotal = 0\nfor i in range(1, n + 1):\n    total = total + 2\n    if i == 3:\n        total = total + 1\nprint(\"总杯数\", total)", [
        ("总杯数 11", T, "5 单 × 2 杯 = 10，第 3 单多 1 杯，共 11。"),
        ("总杯数 10", F, "i 是 3 那一轮会多加 1。"),
        ("总杯数 15", F, "多加的 1 只在 i == 3 那一轮，不是每轮。")],
        tip="特殊订单只在那一轮多加。"),
    pred(SHOW, "n = 2\ntotal = 0\nfor i in range(1, n + 1):\n    total = total + 2\n    if i == 3:\n        total = total + 1\nprint(\"总杯数\", total)", [
        ("总杯数 4", T, "只有 1、2 号订单，没有第 3 单，不多加。"),
        ("总杯数 5", F, "n 是 2 时根本没有第 3 号订单。"),
        ("总杯数 6", F, "range(1, 3) 只有 1、2 两轮。")],
        tip="边界：没有第 3 单时不多加。"),
    fill("补全 range，让编号正好是 1 到 n。n 是 3，屏幕显示：总杯数 7", "n = 3\ntotal = 0\nfor i in range({0}, {1}):\n    total = total + 2\n    if i == 3:\n        total = total + 1\nprint(\"总杯数\", total)",
        ["1", "0", "n", "n + 1"], ["1", "n + 1"], "总杯数 7",
        {"0": "从 0 开始会多出一个 0 号订单。", "n": "range 不含结尾，写 n 会少掉第 n 号订单。"},
        "从 1 开始；结尾要比 n 多 1。"),
    order("排好顺序：4 单，算总杯数。屏幕显示：总杯数 9",
        O48, [6, 3, 5, 0, 4, 2, 1], valid_orders(O48, "总杯数 9", C48), "总杯数 9",
        "先有 n 和 total = 0；循环里每单加 2；if 在循环里，多加的 1 在 if 里；最后显示一次。"),
  ],
  "pending": [{"type": "write", "replaces": 4, "keep": "第 2 题（n=2 没有第 3 单的边界）保留", "status": "待 Claude 的代码题运行器，暂不开放",
    "plan": "写一写：已给 n（订单数），编号 1…n，每单 2 杯，第 3 号订单多 1 杯，输出 总杯数 <数>。测试：n=5→总杯数 11；n=2→总杯数 4；n=3→总杯数 7",
    "reference": "total = 0\nfor i in range(1, n + 1):\n    total = total + 2\n    if i == 3:\n        total = total + 1\nprint(\"总杯数\", total)",
    "tests": [{"data": {"n": 5}, "stdout": "总杯数 11"}, {"data": {"n": 2}, "stdout": "总杯数 4"}, {"data": {"n": 3}, "stdout": "总杯数 7"}]}]},
]

for l in lessons:
    for e in l["exercises"]:
        if e["type"] == "order" and e["lines"] == O48: e["equivCases"] = C48

unit = {"id": "U4", "title": "重复", "subtitle": "for、range、while、break", "lessons": lessons}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit4.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons))
