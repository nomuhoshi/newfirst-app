# 生成 content/unit3.json（第 3 单元「比较与判断」U3L1–U3L8，每关 4 题）。
# 内容在这里改，再运行：python3 scripts/make-unit3.py && python3 scripts/verify-content.py
# 只用已学语法：print（含逗号）、变量、+ - * /、字符串、len，加上本关新教的内容。
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
O8 = ["total = 100", "is_vip = True", "pay = total", "if total >= 100:", "    pay = pay - 20", "if is_vip:", "    pay = pay - 5", "print(\"应付\", pay)"]
C8 = [{"total": t, "is_vip": v} for t in (80, 99, 100, 104, 120, 150) for v in (True, False)]

SHOW = "点单屏运行这段程序，屏幕上会显示什么？"
T, F = True, False

lessons = [
 {"id": "U3L1", "title": "满不满 100 元", "concept": "比较大小",
  "story": "店里搞活动：满 100 元有优惠。程序要先判断“够不够”。比较两个数，结果只有两种：True（成立）或 False（不成立）。> 读作“大于”，< 读作“小于”。",
  "introCode": "total = 120\nprint(total > 100)",
  "exercises": [
    pred(SHOW, "total = 80\nprint(total < 100)", [
        ("True", T, "80 小于 100，比较成立，结果是 True。"),
        ("80", F, "比较的结果不是数字，而是 True 或 False。"),
        ("False", F, "< 是“小于”：80 < 100 成立，所以是 True。")],
        tip="比较的结果只有 True 或 False，首字母大写，不加引号。< 读作“小于”。"),
    pred(SHOW, "print(100 >= 100)\nprint(100 > 100)", [
        ("True\nFalse", T, ">= 是“大于或等于”，100 等于 100，成立；> 只算“大于”，100 不大于自己。"),
        ("True\nTrue", F, "> 不包含相等：100 > 100 是 False。"),
        ("False\nFalse", F, ">= 包含相等，100 >= 100 是 True。")],
        tip=">= 读作“大于或等于”，<= 读作“小于或等于”。"),
    fill("买满 3 杯（正好 3 杯也算）就显示 True，补全比较符号。", "cups = 3\nprint(cups {0} 3)",
        [">=", "=>", ">"], [">="], "True",
        {"=>": "Python 里没有 =>，要写成 >=：大于号在前，等号在后。", ">": "3 > 3 不成立，> 不包含正好相等的情况。"},
        "“正好 3 杯也算”要用包含相等的比较符号，大于号写在前面。"),
    order("排好顺序，让屏幕先显示总价，再显示是否满 100 元：\n120\nTrue",
        ["total = 120", "print(total)", "print(total >= 100)"], [2, 0, 1], [[0, 1, 2]], "120\nTrue",
        "变量要先存好值；先显示总价，再显示比较结果。"),
  ]},
 {"id": "U3L2", "title": "是不是大杯", "concept": "等于和不等于",
  "story": "要判断顾客点的是不是大杯。比较“是否相等”用两个等号 ==；“不相等”用 !=。一个等号 = 是把值存进变量，不是比较。文字要一模一样才相等，连大小写也要一样：\"vip\" 和 \"VIP\" 不相等。",
  "introCode": "size = \"大杯\"\nprint(size == \"大杯\")",
  "exercises": [
    pred(SHOW, "cups = 2\nprint(cups == 2)\nprint(cups != 2)", [
        ("True\nFalse", T, "cups 是 2：== 2 成立；!= 2（不等于 2）不成立。"),
        ("2\nFalse", F, "== 是比较，不是存值，结果是 True 或 False，不会显示 2。"),
        ("True\nTrue", F, "!= 的意思是“不等于”，cups 正好等于 2，所以是 False。")],
        tip="== 比较是否相等；!= 比较是否不相等。"),
    fill("判断顾客点的是不是大杯，屏幕要显示 True。", "size = \"大杯\"\nprint(size {0} \"大杯\")",
        ["==", "=", "!="], ["=="], "True",
        {"=": "一个等号是存值，不能用来比较，这里会报错。比较相等要用两个等号 ==。", "!=": "!= 是“不等于”，大杯等于大杯，结果是 False。"},
        "比较“是否相等”要用两个等号。"),
    pred(SHOW, "print(\"15\" == 15)", [
        ("False", T, "加了引号的 \"15\" 是文字，15 是数字，类型不同，不相等。"),
        ("True", F, "看起来一样，但文字 \"15\" 和数字 15 是不同的东西，所以不相等。"),
        ("15", F, "== 的结果是 True 或 False，不会显示 15。")],
        tip="回想第 2 单元：加引号的是文字（字符串），不加引号的是数字。"),
    pred(SHOW, "cups = 2\ncups == 3\nprint(cups)", [
        ("2", T, "cups == 3 只是做了一次比较，结果不会改掉 cups，也不会自己显示出来；cups 还是 2，print(cups) 显示 2。"),
        ("3", F, "== 是比较，不是存值：cups 里存的还是 2。要存值才用一个等号 =。"),
        ("False", F, "单独写一行 cups == 3 并不会自动显示结果；只有 print(...) 才会显示，这里 print 的是 cups。")],
        tip="比较不会改掉变量，单独写一行比较也不会显示结果。"),
  ]},
 {"id": "U3L3", "title": "记住是不是会员", "concept": "布尔值存进变量",
  "story": "True 和 False 叫“布尔值”。比较的结果可以存进变量，以后直接用。注意：True 不加引号，加了引号就变成文字了。",
  "introCode": "total = 150\nbig = total >= 100\nprint(big)",
  "exercises": [
    pred(SHOW, "total = 150\nbig = total >= 100\nprint(big)", [
        ("True", T, "big 里存的是比较的结果：150 >= 100 成立，所以是 True。"),
        ("total >= 100", F, "变量存的是比较算出来的结果，不是这段文字。"),
        ("150", F, "big 存的是比较结果，不是 total 的值。")],
        tip="先算等号右边的比较，再把结果（True/False）存进左边的变量。"),
    fill("顾客是会员。把真正的布尔值存进 is_vip，屏幕要显示 True。", "is_vip = {0}\nprint(is_vip == True)",
        ["True", "\"True\"", "true"], ["True"], "True",
        {"\"True\"": "加了引号是文字 \"True\"，和布尔值 True 不相等，结果是 False。", "true": "Python 区分大小写，布尔值要写成首字母大写的 True；小写的 true 会报错。"},
        "布尔值首字母大写，不加引号。"),
    order("排好顺序：先存杯数，再把“是否买了 3 杯以上”存进 many，最后显示它。屏幕显示：True",
        ["cups = 4", "many = cups >= 3", "print(many)"], [1, 2, 0], [[0, 1, 2]], "True",
        "用到的变量必须先存好：先有 cups，才能算 many；先有 many，才能显示。"),
    pred(SHOW, "is_vip = \"True\"\nprint(is_vip == True)", [
        ("False", T, "is_vip 存的是文字 \"True\"（有引号），不是布尔值 True，两者不相等。"),
        ("True", F, "看起来一样，但加了引号就是文字，和布尔值 True 不是同一个东西。")],
        tip="\"True\" 是文字，True 是布尔值。"),
  ]},
 {"id": "U3L4", "title": "满 100 才减", "concept": "if 和缩进",
  "story": "if 让程序“条件成立才做”。if 后面写条件，行末要有英文冒号 :，下面要做的事往里缩进 4 个空格。没有缩进的行不属于 if，无论条件如何都会执行。",
  "introCode": "total = 120\nif total >= 100:\n    print(\"满减 20 元\")\nprint(\"谢谢光临\")",
  "exercises": [
    pred(SHOW, "total = 80\nif total >= 100:\n    print(\"满减 20 元\")\nprint(\"谢谢光临\")", [
        ("谢谢光临", T, "80 >= 100 不成立，缩进的那行被跳过；最后一行没有缩进，不属于 if，照常执行。"),
        ("满减 20 元\n谢谢光临", F, "条件不成立时，if 里缩进的行不会执行。"),
        ("（什么也不显示）", F, "print(\"谢谢光临\") 没有缩进，不属于 if，一定会执行。")],
        tip="缩进的行属于 if；没缩进的行和 if 无关。"),
    order("排好顺序：满 100 元时显示满减，最后一定显示谢谢光临。屏幕显示：\n满减 20 元\n谢谢光临",
        ["total = 150", "if total >= 100:", "    print(\"满减 20 元\")", "print(\"谢谢光临\")"], [3, 2, 0, 1], [[0, 1, 2, 3]], "满减 20 元\n谢谢光临",
        "先存总价；缩进的那行要紧跟在 if 下面；不缩进的谢谢光临放最后。"),
    fill("买满 3 杯送一张优惠券，补全 if 这一行。屏幕要显示：送一张优惠券", "cups = 3\nif cups >= 3{0}\n    print(\"送一张优惠券\")",
        [":", "：", ";"], [":"], "送一张优惠券",
        {"：": "这是中文冒号。Python 只认英文冒号 :，会报语法错误。", ";": "if 行的末尾要写冒号 :，不是分号。"},
        "if 这一行最后要写英文冒号。"),
    pred(SHOW, "cups = 1\nif cups >= 3:\n    print(\"送一张优惠券\")\n    print(\"优惠券已发放\")\nprint(\"下单完成\")", [
        ("下单完成", T, "1 >= 3 不成立，缩进的两行都属于 if，都被跳过；只有没缩进的最后一行执行。"),
        ("优惠券已发放\n下单完成", F, "第二个 print 也缩进了，同样属于 if，条件不成立就不执行。"),
        ("送一张优惠券\n优惠券已发放\n下单完成", F, "cups 是 1，不满 3 杯，if 里的内容不执行。")],
        tip="if 下面所有缩进相同的行，都属于这个 if。"),
  ]},
 {"id": "U3L5", "title": "不满就提示差多少", "concept": "else 二选一",
  "story": "if 条件不成立时，可以用 else 做另一件事：两条路只走一条。else 后面不写条件，直接写英文冒号；else 下面要做的事同样缩进 4 格。",
  "introCode": "total = 80\nif total >= 100:\n    print(\"满减 20 元\")\nelse:\n    print(\"还差\", 100 - total, \"元\")",
  "exercises": [
    pred(SHOW, "total = 80\nif total >= 100:\n    print(\"满减 20 元\")\nelse:\n    print(\"还差\", 100 - total, \"元\")", [
        ("还差 20 元", T, "80 >= 100 不成立，跳过 if 里的行，走 else 那条路。"),
        ("满减 20 元\n还差 20 元", F, "if 和 else 只会走一条，不会两边都执行。"),
        ("满减 20 元", F, "条件不成立，if 里的行不执行。")],
        tip="if 成立走 if，不成立走 else，只走一条。"),
    fill("补全 else 这一行。顾客只买了 1 杯，屏幕要显示：不送券", "cups = 1\nif cups >= 3:\n    print(\"送券\")\nelse{0}\n    print(\"不送券\")",
        [":", " cups < 3:", "："], [":"], "不送券",
        {" cups < 3:": "else 后面不写条件：if 不成立的情况全都归 else。写了条件会报语法错误。", "：": "这是中文冒号，Python 只认英文冒号 :。"},
        "else 后面直接写英文冒号，不写条件。"),
    order("排好顺序：会员显示会员价，不是会员显示原价。屏幕显示：会员价",
        ["is_vip = True", "if is_vip:", "    print(\"会员价\")", "else:", "    print(\"原价\")"], [3, 4, 1, 0, 2], [[0, 1, 2, 3, 4]], "会员价",
        "先存好 is_vip；if 下面紧跟它缩进的行，再写 else 和它缩进的行。"),
    pred(SHOW, "total = 150\nif total >= 100:\n    print(\"满减 20 元\")\nelse:\n    print(\"不满减\")\nprint(\"谢谢光临\")", [
        ("满减 20 元\n谢谢光临", T, "走 if 这条路；最后一行没有缩进，不属于 else，一定执行。"),
        ("满减 20 元", F, "print(\"谢谢光临\") 没缩进，不属于 else，照常执行。"),
        ("满减 20 元\n不满减\n谢谢光临", F, "else 里缩进的行只有条件不成立时才执行。")],
        tip="看缩进：缩进的行属于上面的 if 或 else，没缩进的行谁都不属于。"),
  ],
  "pending": [{"type": "modify", "replaces": 4, "status": "待 Claude 的代码题运行器，暂不开放", "plan": "改一改：把 else 写成 else total < 100: 的程序改正确"}]},
 {"id": "U3L6", "title": "满多少减多少", "concept": "elif 多分支",
  "story": "有好几档优惠时，用 elif（意思是“否则如果”）。Python 从上往下检查，遇到第一个成立的条件就执行它，后面的都跳过。所以要把更严格的条件（比如 >= 100）放在前面。",
  "introCode": "total = 120\nif total >= 100:\n    print(\"减 20\")\nelif total >= 50:\n    print(\"减 5\")\nelse:\n    print(\"不减\")",
  "exercises": [
    pred(SHOW, "total = 120\nif total >= 100:\n    print(\"减 20\")\nelif total >= 50:\n    print(\"减 5\")\nelse:\n    print(\"不减\")", [
        ("减 20", T, "120 >= 100 成立，执行第一档；后面的 elif 和 else 都跳过。"),
        ("减 20\n减 5", F, "120 也 >= 50，但前面已经有成立的条件，elif 不再检查。只走一条。"),
        ("减 5", F, "从上往下检查，第一个条件已经成立。")],
        tip="if / elif / else 从上往下，只执行第一个成立的。"),
    order("排好顺序：60 元满 50，屏幕显示：减 5",
        ["total = 60", "if total >= 100:", "    print(\"减 20\")", "elif total >= 50:", "    print(\"减 5\")"], [4, 3, 0, 2, 1], [[0, 1, 2, 3, 4]], "减 5",
        "先存总价；if 在前，elif 在后，每个条件下面紧跟缩进的那行。"),
    fill("规则：满 100 减 20，满 50 减 5。顾客买了 60 元，补全两个数字，让屏幕显示：减 5", "total = 60\nif total >= {0}:\n    print(\"减 20\")\nelif total >= {1}:\n    print(\"减 5\")",
        ["100", "50"], ["100", "50"], "减 5",
        {"50": "如果先检查 >= 50，60 元会先命中“减 20”那一档。严格的条件要放前面。"},
        "从上往下只走第一个成立的：门槛高的放前面。"),
    fill("满 200 减 50，满 100 减 20（只减一档）。顾客买了 150 元，补全两个数字，屏幕要显示：应付 130", "total = 150\npay = total\nif total >= {0}:\n    pay = pay - 50\nelif total >= {1}:\n    pay = pay - 20\nprint(\"应付\", pay)",
        ["200", "100"], ["200", "100"], "应付 130",
        {"100": "门槛顺序反了：150 元会先命中“减 50”那一档（150 >= 100），多减了钱。门槛高的要放前面。"},
        "elif 从上往下只走一个：门槛高的放前面。"),
  ],
  "pending": [{"type": "modify", "replaces": 3, "status": "待 Claude 的代码题运行器，暂不开放", "plan": "改一改：把 >=50 写在 >=100 前面的程序改对"}]},
 {"id": "U3L7", "title": "会员或满额送赠品", "concept": "and / or / not",
  "story": "把几个条件组合起来：and 是“两个都成立才成立”；or 是“有一个成立就成立”；not 把 True 变 False、False 变 True。每个比较都要写完整：cups > 3 and cups < 10，不能写成 cups > 3 and < 10。",
  "introCode": "total = 120\nis_vip = False\nprint(total >= 100 and is_vip)\nprint(total >= 100 or is_vip)",
  "exercises": [
    pred(SHOW, "total = 120\nis_vip = False\nprint(total >= 100 and is_vip)\nprint(total >= 100 or is_vip)", [
        ("False\nTrue", T, "and 要两个都成立，is_vip 是 False，所以 False；or 有一个成立就行，所以 True。"),
        ("True\nTrue", F, "and 要求两个条件都成立，is_vip 是 False。"),
        ("False\nFalse", F, "or 只要一个成立：120 >= 100 成立。")],
        tip="and：都要；or：有一个就行。"),
    pred(SHOW, "is_vip = True\nprint(not is_vip)", [
        ("False", T, "not 把 True 变成 False。"),
        ("True", F, "not 会反过来：True 变 False。"),
        ("not True", F, "not 会被计算，显示的是结果，不是这段文字。")],
        tip="not 读作“不是”。"),
    fill("杯数在 3 到 10 之间（不含两端）才显示 True。补全条件。", "cups = 5\nprint(cups > 3 and {0} 10)",
        ["cups <", "<", "cups >"], ["cups <"], "True",
        {"<": "and 两边要各是完整的比较，不能省掉 cups。会报语法错误。", "cups >": "5 > 10 不成立，结果是 False。"},
        "and 后面也要写完整：变量、符号、数字。"),
    fill("会员或者满 100 元，都能拿赠品。顾客不是会员但买了 120 元，屏幕要显示：有赠品", "is_vip = False\ntotal = 120\nif is_vip {0} total >= 100:\n    print(\"有赠品\")\nelse:\n    print(\"没有赠品\")",
        ["or", "and"], ["or"], "有赠品",
        {"and": "and 要两个都成立；这位顾客不是会员，结果是没有赠品。“或者”要用 or。"},
        "“有一个成立就行”用哪个词？"),
  ],
  "pending": [{"type": "modify", "replaces": 4, "status": "待 Claude 的代码题运行器，暂不开放", "plan": "改一改：把 cups > 3 and < 10 改成完整条件"}]},
 {"id": "U3L8", "title": "项目：折扣检查", "concept": "if 套 if + 单元项目",
  "story": "先看一个新写法：if 里面还可以再写 if（if 套 if），先判断外层，成立了再判断里层，里层要再缩进 4 格。然后做单元项目：折扣检查器。规则：满 100 元（正好 100 也算）减 20；会员再减 5。程序用 pay 记住应付金额，一步步减。",
  "introCode": "total = 120\nis_vip = True\npay = total\nif total >= 100:\n    pay = pay - 20\nif is_vip:\n    pay = pay - 5\nprint(\"应付\", pay)",
  "exercises": [
    pred(SHOW, "total = 120\nis_vip = False\nif total >= 100:\n    if is_vip:\n        print(\"减 25\")\n    else:\n        print(\"减 20\")\nelse:\n    print(\"不减\")", [
        ("减 20", T, "外层：120 >= 100 成立，进入里面；里层：不是会员，走里面的 else。"),
        ("减 25", F, "is_vip 是 False，里层的 if 不成立。"),
        ("不减", F, "外层条件成立，最外面的 else 不执行。")],
        tip="if 套 if：先看外层，成立了再看里层。缩进越深，层越里面。"),
    pred(SHOW, "total = 100\nis_vip = False\npay = total\nif total >= 100:\n    pay = pay - 20\nif is_vip:\n    pay = pay - 5\nprint(\"应付\", pay)", [
        ("应付 80", T, "正好 100：>= 包含相等，减 20；不是会员，不再减。"),
        ("应付 100", F, ">= 100 包含正好 100，所以要减。"),
        ("应付 75", F, "is_vip 是 False，会员那一步不执行。")],
        tip="边界值：正好 100 算不算，看用的是 > 还是 >=。"),
    order("排好顺序：会员正好买 100 元，算出要付多少。屏幕显示：应付 75",
        O8, [7, 4, 5, 2, 6, 3, 1, 0], valid_orders(O8, "应付 75", C8), "应付 75",
        "先有 total 才能算 pay；满减看的是原价 total；每个 if 下面紧跟它该做的那一行（满减减 20，会员减 5）。"),
    pred(SHOW, "total = 80\nis_vip = True\npay = total\nif total >= 100:\n    pay = pay - 20\nif is_vip:\n    pay = pay - 5\nprint(\"应付\", pay)", [
        ("应付 75", T, "80 不满 100，不减 20；是会员，减 5。两个 if 是分开的，各自判断。"),
        ("应付 55", F, "80 < 100，满减那步不执行。"),
        ("应付 80", F, "两个 if 各自独立：第一个不成立，第二个仍会检查。")],
        tip="两个分开的 if 都会检查；if/elif 才是只走一个。"),
  ],
  "pending": [{"type": "write", "replaces": 4, "keep": "第 2 题（边界值 100）保留", "status": "待 Claude 的代码题运行器，暂不开放", "plan": "写一写：已给 total、is_vip，输出 应付 <金额>。测试：(120, False)→应付 100；(120, True)→应付 95；(80, True)→应付 75；(100, False)→应付 80",
    "reference": "pay = total\nif total >= 100:\n    pay = pay - 20\nif is_vip:\n    pay = pay - 5\nprint(\"应付\", pay)",
    "tests": [{"data": {"total": 120, "is_vip": False}, "stdout": "应付 100"}, {"data": {"total": 120, "is_vip": True}, "stdout": "应付 95"}, {"data": {"total": 80, "is_vip": True}, "stdout": "应付 75"}, {"data": {"total": 100, "is_vip": False}, "stdout": "应付 80"}]}]},
]

for l in lessons:
    for e in l["exercises"]:
        if e["type"] == "order" and e["lines"] == O8: e["equivCases"] = C8

unit = {"id": "U3", "title": "比较与判断", "subtitle": "比较、if/else/elif、and/or/not", "lessons": lessons}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit3.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons))
