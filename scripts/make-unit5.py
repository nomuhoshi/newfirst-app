# 生成 content/unit5.json（第 5 单元「列表与序列」：第 1 部分 U5L1–U5L4、第 2 部分 U5L5–U5L7，每关 4 题）。
# 内容在这里改，再运行：python3 scripts/make-unit5.py && python3 scripts/verify-content.py
# 只用已学语法（U1–U4：print、变量、运算、字符串、len、if/elif/else、and/or/not、for/range/while/break/continue，+= 可用），加上本关新教的内容。
# 第 2 部分不用：集合、列表推导式、f-string、sorted()。
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

def TST(name, data, expected, hidden=False):
    d = {"name": name, "data": data, "expected": expected}
    if hidden: d["hidden"] = True
    return d

SHOW = "点单屏运行这段程序，屏幕上会显示什么？"
T, F = True, False
O13 = ["cups = [2, 5, 1]", "cups.remove(2)", "cups[0] = 8", "print(cups)"]
O11 = ["cups = [2, 5, 1]", "n = len(cups)", "print(\"共\", n, \"单\")"]
O15 = ["cups = [2, 5, 1]", "total = 0", "for c in cups:", "    total = total + c", "print(total)"]
O16 = ["menu = [\"奶茶\", \"果茶\"]", "drink = \"果茶\"", "if drink in menu:", "    print(\"有\")", "else:", "    print(\"没有\")"]
O17 = ["items = [\"奶茶\", \"果茶\"]", "x = \"咖啡\"", "if x not in items:", "    items.append(x)", "print(\"共\", len(items), \"项\")"]

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

 {"id": "U5L5", "title": "一单一单看", "concept": "遍历列表、sum、max",
  "story": "店长想知道今天一共卖了多少杯。for c in cups: 会让 c 依次等于列表里的每一个元素，不用写下标。要把杯数加起来，可以像 U4 那样先放一个 total = 0 再一个个加；列表全是数字时，sum(cups) 直接把它们加起来，max(cups) 找出最大的那一个。",
  "introCode": "cups = [2, 5, 1]\ntotal = 0\nfor c in cups:\n    total = total + c\nprint(total)",
  "exercises": [
    pred(SHOW, "cups = [2, 5, 1]\nprint(sum(cups))\nprint(max(cups))", [
        ("8\n5", T, "sum 把所有元素加起来：2 + 5 + 1 = 8；max 是最大的元素：5。"),
        ("3\n5", F, "3 是元素个数，那是 len(cups)；sum 是把元素加起来。"),
        ("8\n1", F, "max 找的是最大的元素，不是最后一个：最大的是 5。")],
        tip="sum(列表) 是全部相加，max(列表) 是最大的那个，len(列表) 才是个数。"),
    order("排好顺序，把三单的杯数加起来。屏幕显示：8", O15, [4, 2, 0, 3, 1], valid_orders(O15, "8"), "8",
        "先有列表，再放累加器 total = 0，然后 for 逐个加，最后在循环外显示。"),
    fill("5 杯及以上算大单。数一数有几个大单，屏幕显示：3（正好 5 杯也算）", "cups = [2, 5, 1, 7, 6]\nbig = 0\nfor c in cups:\n    if c {0} 5:\n        big = big + 1\nprint(big)",
        [">=", ">", "<"], [">="], "3",
        {">": "这样正好 5 杯的不算，只数到 7 和 6，显示 2。“及以上”要包含 5：用 >=。",
         "<": "这样数的是不到 5 杯的：2 和 1，显示 2。"},
        "“5 杯及以上”包含 5，要用 >=。"),
    pred(SHOW, "cups = [2, 5, 1]\nfor c in cups:\n    total = 0\n    total = total + c\nprint(total)", [
        ("1", T, "total = 0 在循环里面：每一轮都被清零，最后一轮是 0 + 1，所以显示 1。"),
        ("8", F, "想得到 8，total = 0 要放在 for 的上面，只清零一次。"),
        ("0", F, "最后一轮 total 先清零再加上 1，结果是 1，不是 0。")],
        tip="累加器的初值放在循环外面，只设一次。"),
  ],
  "pending": [{"type": "write", "replaces": 4, "status": "待 Claude 的代码题运行器，暂不开放", "plan": "写一写：已给 cups，输出 总杯数 N 和 大单 K（≥5 杯算大单）",
    "task": {"id": "U5L5-W1", "version": 1, "type": "write",
      "prompt": "已经准备好 cups（每一单的杯数）。请输出两行：第一行“总杯数”和总杯数，第二行“大单”和大单的数量（一单 5 杯及以上算大单）。例：cups 是 [2, 5, 1, 7] 时，输出\n总杯数 15\n大单 2",
      "given": ["cups"], "checkMode": "output",
      "starter": "# cups（每一单的杯数，是一个列表）已经准备好\n",
      "tests": [TST("四单", {"cups": [2, 5, 1, 7]}, "总杯数 15\n大单 2"), TST("两单都小", {"cups": [1, 1]}, "总杯数 2\n大单 0"),
                TST("没有单", {"cups": []}, "总杯数 0\n大单 0", True), TST("正好 5 杯", {"cups": [5]}, "总杯数 5\n大单 1", True),
                TST("多单混合", {"cups": [4, 5, 6, 3, 9]}, "总杯数 27\n大单 3", True)],
      "hints": ["要同时算两个数：总杯数和大单数。各用一个变量，都放在循环外面先设为 0。", "for c in cups: 里面先把 c 加到总数上，再用 if c >= 5: 数大单；最后在循环外面 print 两行。"],
      "reference": "total = 0\nbig = 0\nfor c in cups:\n    total = total + c\n    if c >= 5:\n        big = big + 1\nprint(\"总杯数\", total)\nprint(\"大单\", big)\n",
      "worked": {"code": "cups = [4, 1]\nn = 0\nfor c in cups:\n    if c >= 3:\n        n = n + 1\nprint(\"够 3 杯的单数\", n)", "output": "够 3 杯的单数 1", "explain": "计数器放在循环外；if 成立才加 1。本题要同时数两样东西。"},
      "alternatives": [
        "total = 0\nbig = 0\nfor c in cups:\n    total += c\n    if c > 4:\n        big += 1\nprint('总杯数', total)\nprint('大单', big)",
        "big = 0\nfor c in cups:\n    if c >= 5:\n        big = big + 1\nprint('总杯数', sum(cups))\nprint('大单', big)",
        "total = 0\nbig = 0\ni = 0\nwhile i < len(cups):\n    total = total + cups[i]\n    if cups[i] >= 5:\n        big = big + 1\n    i = i + 1\nprint('总杯数', total)\nprint('大单', big)",
        "total = 0\nbig = 0\nfor i in range(len(cups)):\n    total = total + cups[i]\n    if cups[i] >= 5:\n        big = big + 1\nprint('总杯数', total)\nprint('大单', big)"],
      "wrongAnswers": [
        {"code": "total = 0\nbig = 0\nfor c in cups:\n    total = total + c\n    if c > 5:\n        big = big + 1\nprint('总杯数', total)\nprint('大单', big)", "why": "边界：正好 5 杯也算大单，要用 >= 5（或 > 4）"},
        {"code": "big = 0\nfor c in cups:\n    total = 0\n    total = total + c\n    if c >= 5:\n        big = big + 1\nprint('总杯数', total)\nprint('大单', big)", "why": "total = 0 放在循环里，每一轮都被清零；空列表还会报 NameError"}]}}]},
 {"id": "U5L6", "title": "菜单里有吗", "concept": "in、not in",
  "story": "顾客点了一杯，要先查菜单里有没有。\"果茶\" in menu 问的是：果茶是不是 menu 里的一个元素，答案是 True 或 False。反过来问“不在”，写 not in（不是 in not）。注意：列表的 in 要整个元素一模一样才算在，\"奶茶\" 不等于列表里的 \"珍珠奶茶\"。",
  "introCode": "menu = [\"奶茶\", \"果茶\"]\nprint(\"果茶\" in menu)\nprint(\"咖啡\" not in menu)",
  "exercises": [
    pred(SHOW, "menu = [\"奶茶\", \"果茶\", \"咖啡\"]\nprint(\"果茶\" in menu)", [
        ("True", T, "果茶是 menu 里的一个元素，所以 in 的结果是 True。"),
        ("False", F, "果茶就在 menu 里，in 的结果是 True。"),
        ("果茶", F, "in 问的是“在不在”，结果是 True 或 False，不是元素本身。")],
        tip="x in 列表 → True / False：看 x 是不是列表里的一个元素。"),
    fill("顾客点了柠檬茶，菜单里没有。屏幕显示：没有这款", "menu = [\"奶茶\", \"果茶\", \"咖啡\"]\norder = \"柠檬茶\"\nif order {0} menu:\n    print(\"没有这款\")\nelse:\n    print(\"可以点\")",
        ["not in", "in", "in not"], ["not in"], "没有这款",
        {"in": "柠檬茶不在菜单里，order in menu 是 False，会走 else，显示“可以点”。",
         "in not": "Python 里没有 in not 这种写法，会报语法错误。“不在”要写成 not in。"},
        "“不在列表里”写成 not in。"),
    pred(SHOW, "menu = [\"珍珠奶茶\", \"果茶\"]\nprint(\"奶茶\" in menu)", [
        ("False", T, "列表的 in 要整个元素一模一样：menu 里的元素是“珍珠奶茶”，不是“奶茶”。"),
        ("True", F, "“奶茶”只是“珍珠奶茶”的一部分。字符串之间的 in 看是否包含，但列表的 in 要整个元素都相等。")],
        tip="列表的 in：整个元素一模一样才算在。"),
    order("排好顺序，查一查果茶在不在菜单里。屏幕显示：有", O16, [3, 2, 5, 0, 4, 1], valid_orders(O16, "有"), "有",
        "先有菜单和点的饮品，再 if 判断；else 要在 if 的内容之后。"),
  ],
  "pending": [{"type": "modify", "replaces": 4, "status": "待 Claude 的代码题运行器，暂不开放", "plan": "改一改：把条件写反的 if menu in item 改成 if item in menu",
    "task": {"id": "U5L6-M1", "version": 1, "type": "modify",
      "prompt": "已经准备好 menu（菜单，一个列表）和 item（顾客点的饮品）。有就显示“有这款”，没有就显示“没有这款”。这段程序运行会报错，请改正。",
      "given": ["menu", "item"], "checkMode": "output",
      "code": "if menu in item:\n    print(\"有这款\")\nelse:\n    print(\"没有这款\")\n",
      "tests": [TST("菜单里有", {"menu": ["奶茶", "果茶"], "item": "果茶"}, "有这款"), TST("菜单里没有", {"menu": ["奶茶", "果茶"], "item": "咖啡"}, "没有这款"),
                TST("空菜单", {"menu": [], "item": "奶茶"}, "没有这款", True), TST("只是一部分", {"menu": ["珍珠奶茶"], "item": "奶茶"}, "没有这款", True),
                TST("正好一款", {"menu": ["奶茶"], "item": "奶茶"}, "有这款", True)],
      "hints": ["in 前面放“要找的东西”，后面放“在哪里找”。现在谁在前面？", "把 menu in item 改成 item in menu。"],
      "reference": "if item in menu:\n    print(\"有这款\")\nelse:\n    print(\"没有这款\")\n",
      "worked": {"code": "sizes = [\"中杯\", \"大杯\"]\nprint(\"超大杯\" in sizes)", "output": "False", "explain": "in 的写法是：要找的东西 in 列表。结果是 True 或 False。"},
      "alternatives": [
        "if item not in menu:\n    print('没有这款')\nelse:\n    print('有这款')",
        "found = False\nfor m in menu:\n    if m == item:\n        found = True\nif found:\n    print('有这款')\nelse:\n    print('没有这款')",
        "if not item in menu:\n    print('没有这款')\nelse:\n    print('有这款')"],
      "wrongAnswers": [
        {"code": "if item not in menu:\n    print('有这款')\nelse:\n    print('没有这款')", "why": "not in 和 in 的意思相反，结果整个反了"},
        {"code": "found = False\nfor m in menu:\n    if item in m:\n        found = True\nif found:\n    print('有这款')\nelse:\n    print('没有这款')", "why": "item in m 是在字符串里找“包含”，“奶茶”会被当成“珍珠奶茶”里有；列表要整个元素相等"}]}}]},
 {"id": "U5L7", "title": "项目：购物清单", "concept": "综合：列表 + 遍历 + in",
  "story": "最后一关：用学过的列表、for、in、append、remove 管理一张购物清单。有两条规矩：已经有的不重复加；不在清单里的不能删（不然 remove 会报错 ValueError）。",
  "introCode": "items = [\"奶茶\"]\nx = \"果茶\"\nif x not in items:\n    items.append(x)\nprint(items)",
  "exercises": [
    pred(SHOW, "items = [\"奶茶\", \"果茶\"]\nif \"咖啡\" in items:\n    items.remove(\"咖啡\")\nprint(items)", [
        ("['奶茶', '果茶']", T, "咖啡不在清单里，if 不成立，remove 根本没执行，所以清单不变。"),
        ("报错 ValueError", F, "正因为先用 in 判断过，remove 才不会执行；直接 remove 一个不存在的元素才会报 ValueError。"),
        ("[]", F, "没有东西被删：if 不成立，remove 没有执行。")],
        tip="先用 in 判断存在，再 remove，就不会报错。"),
    pred(SHOW, "items = [\"奶茶\"]\nfor x in [\"果茶\", \"奶茶\"]:\n    if x not in items:\n        items.append(x)\nprint(items)", [
        ("['奶茶', '果茶']", T, "果茶不在清单里，加上；奶茶已经在了，跳过，不重复加。"),
        ("['奶茶', '果茶', '奶茶']", F, "if x not in items 把已经有的挡住了，奶茶不会被再加一次。"),
        ("['果茶']", F, "append 是往末尾加，不会清空原来的内容。")],
        tip="加之前先 not in 检查，就不会重复。"),
    fill("清单是奶茶、果茶，要删的是果茶和咖啡。只删清单里有的，屏幕显示：['奶茶']", "items = [\"奶茶\", \"果茶\"]\nto_remove = [\"果茶\", \"咖啡\"]\nfor x in to_remove:\n    if x {0} items:\n        items.remove(x)\nprint(items)",
        ["in", "not in", "=="], ["in"], "['奶茶']",
        {"not in": "这样会去删不在清单里的东西，咖啡不在，remove(\"咖啡\") 报错 ValueError。",
         "==": "x 是文字，items 是列表，它们永远不相等，什么都不会删。"},
        "只删“在清单里”的：用 in。"),
    order("排好顺序，没有咖啡就加上，再显示一共几项。屏幕显示：共 3 项", O17, [4, 2, 0, 3, 1], valid_orders(O17, "共 3 项"), "共 3 项",
        "先有清单和要加的，if not in 判断，再 append，最后显示个数。"),
  ],
  "pending": [{"type": "write", "replaces": 3, "status": "待 Claude 的代码题运行器，暂不开放", "plan": "项目写一写：已给 items、to_add、to_remove；先加后删，已有的不重复加，不存在的不删；每行输出一项，再输出 共 N 项",
    "task": {"id": "U5L7-W1", "version": 1, "type": "write",
      "prompt": "已经准备好三个列表：items（购物清单）、to_add（要加的）、to_remove（要删的）。规矩：先加后删；已经有的不重复加，不在清单里的不删。最后每行输出一项，再输出“共 N 项”（直接 print 清单不行，要每行一项）。例：items 是 [\"奶茶\", \"果茶\"]，to_add 是 [\"咖啡\"]，to_remove 是 [\"果茶\"] 时，输出\n奶茶\n咖啡\n共 2 项",
      "given": ["items", "to_add", "to_remove"], "checkMode": "output",
      "starter": "# items（购物清单）、to_add（要加的）、to_remove（要删的）都是列表，已经准备好\n",
      "tests": [TST("加一个删一个", {"items": ["奶茶", "果茶"], "to_add": ["咖啡"], "to_remove": ["果茶"]}, "奶茶\n咖啡\n共 2 项"),
                TST("什么都不变", {"items": ["奶茶"], "to_add": [], "to_remove": []}, "奶茶\n共 1 项"),
                TST("空清单", {"items": [], "to_add": [], "to_remove": []}, "共 0 项", True),
                TST("要加的里有重复", {"items": [], "to_add": ["果茶", "果茶", "奶茶"], "to_remove": []}, "果茶\n奶茶\n共 2 项", True),
                TST("刚加进去又删掉", {"items": ["奶茶"], "to_add": ["咖啡"], "to_remove": ["咖啡"]}, "奶茶\n共 1 项", True),
                TST("全部删光", {"items": ["奶茶"], "to_add": [], "to_remove": ["奶茶"]}, "共 0 项", True),
                TST("删不存在的", {"items": ["奶茶"], "to_add": [], "to_remove": ["火锅"]}, "奶茶\n共 1 项", True)],
      "hints": ["分三步：先加（加之前检查有没有），再删（删之前检查在不在），最后输出。", "第一个 for 遍历 to_add：if x not in items: items.append(x)；第二个 for 遍历 to_remove：if x in items: items.remove(x)；再 for 逐个 print，最后 print(\"共\", len(items), \"项\")。"],
      "reference": "for x in to_add:\n    if x not in items:\n        items.append(x)\nfor x in to_remove:\n    if x in items:\n        items.remove(x)\nfor x in items:\n    print(x)\nprint(\"共\", len(items), \"项\")\n",
      "worked": {"code": "cart = [\"笔\"]\nnew = \"尺\"\nif new not in cart:\n    cart.append(new)\nprint(cart)", "output": "['笔', '尺']", "explain": "加之前先用 not in 检查；本题要对一整个列表这样做，再删，再逐行输出。"},
      "alternatives": [
        "for x in to_add:\n    if x not in items:\n        items.append(x)\nfor x in to_remove:\n    if x in items:\n        items.remove(x)\nn = 0\nfor x in items:\n    print(x)\n    n += 1\nprint('共', n, '项')",
        "i = 0\nwhile i < len(to_add):\n    if to_add[i] not in items:\n        items.append(to_add[i])\n    i = i + 1\ni = 0\nwhile i < len(to_remove):\n    if to_remove[i] in items:\n        items.remove(to_remove[i])\n    i = i + 1\nfor x in items:\n    print(x)\nprint('共', len(items), '项')",
        "for x in to_add:\n    if not (x in items):\n        items.append(x)\nfor x in to_remove:\n    if x in items:\n        items.remove(x)\nfor i in range(len(items)):\n    print(items[i])\nprint('共', len(items), '项')"],
      "wrongAnswers": [
        {"code": "for x in to_remove:\n    if x in items:\n        items.remove(x)\nfor x in to_add:\n    if x not in items:\n        items.append(x)\nfor x in items:\n    print(x)\nprint('共', len(items), '项')", "why": "顺序反了：规矩是先加后删，先删会让“刚加进去又删掉”的项留在清单里"},
        {"code": "for x in to_add:\n    items.append(x)\nfor x in to_remove:\n    if x in items:\n        items.remove(x)\nfor x in items:\n    print(x)\nprint('共', len(items), '项')", "why": "没有检查就 append，已有的和重复的项会被加进去"},
        {"code": "for x in to_add:\n    if x not in items:\n        items.append(x)\nfor x in to_remove:\n    items.remove(x)\nfor x in items:\n    print(x)\nprint('共', len(items), '项')", "why": "没检查就 remove，删不存在的项会报 ValueError"}]}}]},
]

import sys as _s; _s.path.insert(0, str(pathlib.Path(__file__).parent)); from codetasks import TASKS
for _l in lessons:  # 有内容的代码题挂到 pending[0].task；题目页（#19）接上前仍不开放
    if _l["id"] in TASKS: _l["pending"][0]["task"] = TASKS[_l["id"]]
unit = {"id": "U5", "title": "列表与序列", "subtitle": "列表、下标、遍历、in", "lessons": lessons}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit5.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons))
