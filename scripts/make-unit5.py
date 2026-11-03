# 生成 content/unit5.json（第 5 单元「列表与序列」第 1 部分 U5L1–U5L4，每关 4 题）。
# 内容在这里改，再运行：python3 scripts/make-unit5.py && python3 scripts/verify-content.py
# 只用已学语法（U1–U4：print、变量、运算、字符串、len、if/elif/else、and/or/not、for/range/while/break/continue），加上本关新教的内容。
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

SHOW = "点单屏运行这段程序，屏幕上会显示什么？"
T, F = True, False
O13 = ["cups = [2, 5, 1]", "cups.remove(2)", "cups[0] = 8", "print(cups)"]
O11 = ["cups = [2, 5, 1]", "n = len(cups)", "print(\"共\", n, \"单\")"]

lessons = [
 {"id": "U5L1", "title": "一张点单表", "concept": "列表 [ ] 和 len",
  "story": "好几单的杯数，不用一单一个变量：用方括号把它们放在一起，逗号隔开，就是一个列表，比如 cups = [2, 5, 1]。len(cups) 数的是列表里有几个元素（几单），不是数字符。同一个列表里可以放不同类型的值，比如 [\"奶茶\", 2, True]。",
  "introCode": "cups = [2, 5, 1]\nprint(cups)\nprint(len(cups))",
  "exercises": [
    pred(SHOW, "cups = [3, 1, 4]\nprint(cups)", [
        ("[3, 1, 4]", T, "print 一个列表，会连方括号和逗号一起显示。"),
        ("3 1 4", F, "这是 print(3, 1, 4) 的样子；print 列表会带方括号和逗号。"),
        ("[3 1 4]", F, "列表显示时元素之间有逗号。")],
        tip="print 列表：方括号、逗号都会显示。"),
    pred(SHOW, "names = [\"奶茶\", \"果茶\"]\nprint(len(names))", [
        ("2", T, "列表里有 2 个元素，len 数的是元素个数。"),
        ("4", F, "4 是 4 个汉字；len 用在列表上数的是元素，不是字符。"),
        ("[2]", F, "len 得到一个数字，不是列表。")],
        tip="len(列表) = 有几个元素。"),
    fill("一单里有：奶茶、2 杯、要冰。列表里可以放不同类型的值。补全，屏幕显示：3", "order = [\"奶茶\", 2, True]\nprint({0}(order))",
        ["len", "print", "order"], ["len"], "3",
        {"print": "print(order) 显示的是列表本身，外面再 print 一次不会得到个数。", "order": "order 是列表，不能像函数那样加括号使用。"},
        "数元素个数用 len。"),
    order("排好顺序。屏幕显示：共 3 单", O11, [2, 0, 1], valid_orders(O11, "共 3 单"), "共 3 单",
        "先有列表，再算个数，最后显示。"),
  ]},
 {"id": "U5L2", "title": "第几单", "concept": "下标（从 0 开始、负下标）",
  "story": "要取列表里的某一个，用方括号写它的位置，叫下标：cups[0] 是第一个，cups[1] 是第二个——下标从 0 开始。最后一个是 cups[-1]，也可以写 cups[len(cups) - 1]。cups[len(cups)] 已经超出范围，会报错 IndexError。",
  "introCode": "cups = [2, 5, 1]\nprint(cups[0])\nprint(cups[-1])",
  "exercises": [
    pred(SHOW, "cups = [2, 5, 1]\nprint(cups[0])", [
        ("2", T, "下标从 0 开始：cups[0] 是第一个。"),
        ("5", F, "5 是第二个，下标是 1。第一个的下标是 0。"),
        ("[2]", F, "cups[0] 取出的是元素本身，不是列表。")],
        tip="第一个的下标是 0。"),
    pred(SHOW, "cups = [2, 5, 1]\nprint(cups[-1])", [
        ("1", T, "-1 表示倒数第一个，也就是最后一个。"),
        ("2", F, "2 是第一个（cups[0]）。-1 从末尾数。"),
        ("5", F, "5 是倒数第二个（cups[-2]）。")],
        tip="负下标从末尾数：-1 是最后一个。注意 cups[3] 会报错 IndexError：3 个元素的下标只有 0、1、2。"),
    fill("取最后一单的杯数。屏幕显示：7", "cups = [4, 9, 7]\nprint(cups[len(cups) {0} 1])",
        ["-", "+", "*"], ["-"], "7",
        {"+": "len(cups) + 1 是 4，超出范围，报错 IndexError。", "*": "len(cups) * 1 还是 3，下标 3 超出范围（只有 0、1、2），报错 IndexError。"},
        "3 个元素的下标是 0、1、2：最后一个是长度减 1。"),
    pred(SHOW, "names = [\"奶茶\", \"果茶\", \"咖啡\"]\nprint(names[1])", [
        ("果茶", T, "下标 1 是第二个。"),
        ("奶茶", F, "奶茶是 names[0]。"),
        ("咖啡", F, "咖啡是 names[2]，也是 names[-1]。")],
        tip="下标 = 第几个 - 1。"),
  ],
  "pending": [{"type": "modify", "replaces": 4, "status": "待 Claude 的代码题运行器，暂不开放", "plan": "改一改：把取第一单的 cups[1] 改成 cups[0]，把取最后一单的 cups[len(cups)]（IndexError）改成 cups[-1]"}]},
 {"id": "U5L3", "title": "改单、加单、退单", "concept": "改元素、append、remove",
  "story": "改某一单：cups[1] = 6。加一单到末尾：cups.append(3)。退掉一单：cups.remove(5) 删掉第一个等于 5 的元素——按值删，不是按下标。append 和 remove 直接改原来的列表，不会得到新列表，所以不要写 cups = cups.append(3)。",
  "introCode": "cups = [2, 5, 1]\ncups[1] = 6\ncups.append(3)\ncups.remove(2)\nprint(cups)",
  "exercises": [
    pred(SHOW, "cups = [2, 5, 1]\ncups[1] = 6\nprint(cups)", [
        ("[2, 6, 1]", T, "cups[1] 是第二个，改成 6。"),
        ("[6, 5, 1]", F, "下标从 0 开始：改的是第二个，不是第一个。"),
        ("[2, 5, 1, 6]", F, "给下标赋值是替换，不是加到末尾（那是 append）。")],
        tip="列表名[下标] = 新值：替换那一个。"),
    fill("加一单 3 杯到末尾。屏幕显示：[2, 5, 3]", "cups = [2, 5]\ncups.{0}(3)\nprint(cups)",
        ["append", "remove"], ["append"], "[2, 5, 3]",
        {"remove": "remove 是删掉等于 3 的元素；列表里没有 3，会报错 ValueError。"},
        "加到末尾用 append。"),
    order("排好顺序：先退掉 2 杯那单，再把（现在的）第一单改成 8 杯。屏幕显示：[8, 1]", O13, [3, 2, 0, 1], valid_orders(O13, "[8, 1]"), "[8, 1]",
        "先建列表；remove(2) 按值删；删完后第一个是 5，再改成 8；最后显示。"),
    pred(SHOW, "cups = [2, 5]\ncups.append(1)\ncups.remove(5)\nprint(cups)", [
        ("[2, 1]", T, "append 后是 [2, 5, 1]，再按值删掉 5。"),
        ("[2, 5]", F, "remove(5) 删的是等于 5 的元素，不是下标 5。"),
        ("[2, 5, 1]", F, "remove(5) 把 5 删掉了。")],
        tip="remove 按值删，append 加到末尾，都直接改原列表。"),
  ],
  "pending": [{"type": "modify", "replaces": 4, "status": "待 Claude 的代码题运行器，暂不开放", "plan": "改一改：把 cups = cups.append(3)（cups 变成 None）改成 cups.append(3)"}]},
 {"id": "U5L4", "title": "取一段", "concept": "切片 [a:b]、[:n]",
  "story": "cups[1:3] 取下标 1 到 2 的元素——包含开头 1，不包含结尾 3，和 range 一样。cups[:2] 是前 2 个。切片得到一个新列表，原来的列表不变。",
  "introCode": "cups = [2, 5, 1, 7]\nprint(cups[1:3])\nprint(cups[:2])\nprint(cups)",
  "exercises": [
    pred(SHOW, "cups = [2, 5, 1, 7]\nprint(cups[1:3])", [
        ("[5, 1]", T, "下标 1、2；不包含结尾 3。"),
        ("[5, 1, 7]", F, "切片不包含结尾：下标 3 的 7 不在里面。"),
        ("[2, 5, 1]", F, "从下标 1 开始，第一个 2 的下标是 0。")],
        tip="[a:b] 包含 a，不包含 b。"),
    pred(SHOW, "cups = [2, 5, 1, 7]\nfirst = cups[:2]\nprint(cups)", [
        ("[2, 5, 1, 7]", T, "切片得到新列表存进 first；cups 本身不变。"),
        ("[2, 5]", F, "[2, 5] 是 first；切片不会改原列表。"),
        ("[1, 7]", F, "切片不会从原列表里删东西。")],
        tip="切片 = 复制一段出来，原列表不变。"),
    fill("取前 3 单。屏幕显示：[4, 8, 6]", "cups = [4, 8, 6, 3]\nprint(cups[:{0}])",
        ["3", "2", "4"], ["3"], "[4, 8, 6]",
        {"2": "[:2] 只有前 2 个。", "4": "[:4] 是全部 4 个。"},
        "[:n] 就是前 n 个。"),
    fill("取中间两单。屏幕显示：[8, 6]", "cups = [4, 8, 6, 3]\nprint(cups[{0}:{1}])",
        ["1", "3", "2", "0"], ["1", "3"], "[8, 6]",
        {"2": "看下标：8 是 1，6 是 2；结尾要写 6 的下一个。", "0": "下标 0 是 4，不在中间。"},
        "开头写 8 的下标；结尾写 6 的下标再加 1。"),
  ]},
]

unit = {"id": "U5", "title": "列表与序列", "subtitle": "列表、下标、append、切片", "lessons": lessons}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit5.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons))
