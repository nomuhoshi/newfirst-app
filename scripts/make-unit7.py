# 生成 content/unit7.json（第 7 单元「字典」：U7L1–U7L6，每关 4 题）。
# 内容在这里改，再运行：python3 scripts/make-unit7.py && node tests/step8-u7.test.mjs
# 题型只用现有的 predict / fill / order；predict 的程序必须能正常运行（报错只出现在错误选项或填空的错误词块里）。
# 前置：U1–U5（print、变量、运算、字符串、比较、if/elif/else、not、for、累加、列表、列表的 in）；
#       U6（类型 int/str、读报错的最后一行、NameError、TypeError）——U7 不重讲这些，只在错因里点名。
# 本单元新教：字典 { }、键和值、stock[键]、KeyError；改值；in / .get() / None / 默认值；新增、del、print(字典)；for 遍历字典。
# 本单元不用：+=、f-string、keys()/values()/items()、len(字典)、pop、嵌套字典、集合、元组、input。
# 行宽：题目里显示的每一行代码（讲解示例、题面、填空、排序行、代码题起始/答案/示范）和选项的每一行，按半角算不超过 28 格（中文等全角算 2 格，设计规则，见 PR #47）。
#   字典两对以上时，在逗号后换行，每行一对。
# 每关 4 题各练一个不同的点，不出同义重复题。题面和解释里写出的每个输出、行号、错误类型都在下面用真实运行断言。
import json, pathlib, itertools, io, contextlib

def pred(prompt, code, opts, tip=None):
    d = {"type": "predict", "prompt": prompt, "code": code,
         "options": [{"text": t, "correct": c, "why": w} for t, c, w in opts]}
    if tip: d["tip"] = tip
    return d

def fill(prompt, code, tokens, answer, expected, why, hint):
    return {"type": "fill", "prompt": prompt, "code": code, "tokens": tokens, "answer": answer, "expected": expected, "why": why, "hint": hint}

def order(prompt, lines, shuffled, answers, expected, hint):
    return {"type": "order", "prompt": prompt, "lines": lines, "shuffled": shuffled, "answers": answers, "expected": expected, "hint": hint}

def run(code):
    """返回 (输出, 错误类型或 None)，输出去掉末尾一个换行。"""
    buf = io.StringIO(); err = None
    try:
        with contextlib.redirect_stdout(buf): exec(code, {})
    except Exception as e: err = type(e).__name__
    out = buf.getvalue()
    return (out[:-1] if out.endswith("\n") else out), err
def out_of(code):
    out, err = run(code); assert err is None, (code, err); return out
def err_of(code):
    out, err = run(code); assert err, code; return err

def valid_orders(lines, expected):
    """所有能得到 expected 的排列（标准顺序在最前面）。"""
    canon = list(range(len(lines)))
    res = [list(p) for p in itertools.permutations(canon) if run("\n".join(lines[k] for k in p)) == (expected, None)]
    res.sort(key=lambda a: a != canon); return res

def TST(name, data, expected, hidden=False):
    d = {"name": name, "data": data, "expected": expected}
    if hidden: d["hidden"] = True
    return d

SHOW = "点单屏运行这段程序，屏幕上会显示什么？"
T, F = True, False
import unicodedata
MAXW = 28
def width(line):
    return sum(2 if unicodedata.east_asian_width(ch) in "WF" else 1 for ch in line)
def ln(code, text):
    """text 在 code 里是第几行（从 1 数）；解释里写到的行号都从这里取。"""
    rows = code.split("\n"); assert rows.count(text) == 1, (text, code); return rows.index(text) + 1
def D(*pairs):
    """字典字面量：一对一行，逗号后换行，续行和第一对对齐。"""
    body = [f'"{k}": {v}' for k, v in pairs]
    lines = ["stock = {" + body[0] + ("," if len(body) > 1 else "}")]
    for i, b in enumerate(body[1:], 1): lines.append(" " * 9 + b + ("," if i < len(body) - 1 else "}"))
    return "\n".join(lines)
S1 = D(("奶茶", 12), ("果茶", 5))
assert S1 == 'stock = {"奶茶": 12,\n         "果茶": 5}'

# ---------------- U7L1 按名字查库存 ----------------
L1_INTRO = S1 + '\nprint(stock["奶茶"])\nprint(stock["果茶"])'
Q1_1 = S1 + '\nprint(stock["果茶"])'
Q1_2 = S1 + '\nname = "奶茶"\nprint(name, stock[name])'
Q1_3 = D(("奶茶", 12), ("果茶", 5), ("咖啡", 8)) + '\nprint(stock[{0}])'
Q1_4 = S1 + '\na = stock["奶茶"]\nb = stock["果茶"]\nprint(a + b)'
assert out_of(L1_INTRO) == "12\n5" and out_of(Q1_1) == "5" and out_of(Q1_2) == "奶茶 12" and out_of(Q1_4) == "17"
assert out_of(Q1_3.replace("{0}", '"咖啡"')) == "8" and out_of(Q1_3.replace("{0}", '"果茶"')) == "5"
assert err_of(Q1_3.replace("{0}", "咖啡")) == "NameError" and err_of(Q1_3.replace("{0}", "2")) == "KeyError"
assert err_of(S1 + '\nprint(stock["咖啡"])') == "KeyError"
assert out_of('print("奶茶" + "果茶")') == "奶茶果茶" and out_of('print("12" + "5")') == "125"

# ---------------- U7L2 改库存 ----------------
L2_INTRO = S1 + '\nstock["果茶"] = 9\nn = stock["奶茶"] - 3\nstock["奶茶"] = n\nprint(stock["奶茶"])\nprint(stock["果茶"])'
Q2_1 = S1 + '\nstock["果茶"] = 9\nprint(stock["奶茶"])\nprint(stock["果茶"])'
Q2_2 = S1 + '\nn = stock["奶茶"] - 3\nstock["奶茶"] = n\nprint(stock["奶茶"])\nprint(stock["果茶"])'
Q2_3 = S1 + '\nstock["果茶"] - 1\nprint(stock["果茶"])'
Q2_4 = S1 + '\nname = "果茶"\ncups = 3\nn = {0} - cups\nstock[name] = n\nprint(stock[name])'
assert out_of(L2_INTRO) == "9\n9" and out_of(Q2_1) == "12\n9" and out_of(Q2_2) == "9\n5" and out_of(Q2_3) == "5"
assert out_of(S1 + '\nstock["果茶"] = stock["果茶"] + 9\nprint(stock["奶茶"])\nprint(stock["果茶"])') == "12\n14"
assert out_of(S1 + '\nn = stock["奶茶"] - 3\nprint(stock["奶茶"])\nprint(stock["果茶"])') == "12\n5"   # 只算出 n、没存回去的样子
assert out_of(Q2_4.replace("{0}", "stock[name]")) == "2" and out_of(Q2_4.replace("{0}", "cups")) == "0"
assert err_of(Q2_4.replace("{0}", "name")) == "TypeError"
L2_1, L2_2S = ln(Q2_1, 'stock["果茶"] = 9'), ln(Q2_2, 'stock["奶茶"] = n')
L2_3 = ln(Q2_3, 'stock["果茶"] - 1')

# ---------------- U7L3 先问再取 ----------------
L3_INTRO = S1 + '\nk = "咖啡"\nprint(k in stock)\nprint(stock.get(k))\nprint(stock.get(k, 0))'
Q3_1 = S1 + '\nprint("奶茶" in stock)\nprint(12 in stock)'
Q3_2 = S1 + '\nprint(stock.get("果茶", 0))\nprint(stock.get("咖啡"))\nprint(stock.get("咖啡", 0))'
Q3_3 = S1 + '\nname = "咖啡"\nif {0}:\n    print(stock[name])\nelse:\n    print("没有这个饮品")'
Q3_4 = S1 + '\nprint(stock.get("咖啡", 0))\nprint("咖啡" in stock)'
assert out_of(L3_INTRO) == "False\nNone\n0" and out_of(Q3_1) == "True\nFalse" and out_of(Q3_2) == "5\nNone\n0" and out_of(Q3_4) == "0\nFalse"
assert out_of(Q3_3.replace("{0}", "name in stock")) == "没有这个饮品"
assert err_of(Q3_3.replace("{0}", "name not in stock")) == "KeyError" and err_of(Q3_3.replace("{0}", "stock[name]")) == "KeyError"
L3_2a, L3_2b = ln(Q3_2, 'print(stock.get("咖啡"))'), ln(Q3_2, 'print(stock.get("咖啡", 0))')

# ---------------- U7L4 进货与下架 ----------------
L4_INTRO = S1 + '\nstock["咖啡"] = 8\ndel stock["果茶"]\nprint(stock)'
Q4_1 = 'stock = {"奶茶": 12}\nstock["咖啡"] = 8\nprint(stock)'
Q4_2 = S1 + '\nstock["果查"] = 4\nprint(stock["果茶"])\nprint(stock["果查"])'
Q4_3 = S1 + '\ndel stock["果茶"]\nprint(stock)'
O4 = ['stock = {"奶茶": 12}', 'if "果茶" not in stock:', '    stock["果茶"] = 0', 'new = stock["果茶"] + 5', 'stock["果茶"] = new', 'print(stock)']
assert out_of(L4_INTRO) == "{'奶茶': 12, '咖啡': 8}" and out_of(Q4_1) == "{'奶茶': 12, '咖啡': 8}"
assert out_of(Q4_2) == "5\n4" and out_of(Q4_3) == "{'奶茶': 12}" and err_of(S1 + '\ndel stock["咖啡"]') == "KeyError"
assert out_of("\n".join(O4)) == "{'奶茶': 12, '果茶': 5}"
assert err_of('stock = {"奶茶": 12}\nnew = stock["果茶"] + 5') == "KeyError"
L4_1, L4_2, L4_3 = ln(Q4_1, 'stock["咖啡"] = 8'), ln(Q4_2, 'stock["果查"] = 4'), ln(Q4_3, 'del stock["果茶"]')

# ---------------- U7L5 一个一个看 ----------------
L5_INTRO = S1 + '\nfor name in stock:\n    n = stock[name]\n    print(name, n)'
Q5_1 = S1 + '\nfor name in stock:\n    print(name)'
Q5_2 = S1 + '\ntotal = 0\nfor name in stock:\n    n = stock[name]\n    total = total + n\nprint(total)'
Q5_3 = D(("奶茶", 12), ("果茶", 5), ("咖啡", 3)) + '\nlow = 0\nfor name in stock:\n    if stock[name] {0} 5:\n        low = low + 1\nprint(low)'
Q5_4 = D(("奶茶", 12), ("果茶", 0), ("咖啡", 0)) + '\nfor name in stock:\n    if stock[name] == 0:\n        print(name, "卖完")'
assert out_of(L5_INTRO) == "奶茶 12\n果茶 5" and out_of(Q5_1) == "奶茶\n果茶" and out_of(Q5_2) == "17"
assert out_of(Q5_3.replace("{0}", "<")) == "1" and out_of(Q5_3.replace("{0}", "<=")) == "2" and out_of(Q5_3.replace("{0}", ">=")) == "2"
assert out_of(Q5_4) == "果茶 卖完\n咖啡 卖完"
assert out_of(S1 + '\ntotal = 0\nfor name in stock:\n    n = stock[name]\n    total = n\nprint(total)') == "5"

# ---------------- U7L6 项目：库存小程序 ----------------
# 成交时分两行显示：“成交”、“剩 N 杯”（一行写不下 28 格）；n 是卖完后剩下的杯数
SELL = '    n = stock[name] - cups\n    stock[name] = n\n    print("成交")\n    print("剩", n, "杯")\n'
REF6 = 'if name not in stock:\n    print("没有这个饮品")\nelif cups > stock[name]:\n    print("库存不足")\nelse:\n' + SELL + 'print(stock)\n'
START6 = 'n = stock[name] - cups\nstock[name] = n\nprint("成交")\nprint("剩", n, "杯")\nprint(stock)\n'
def head(name, cups): return S1 + f'\nname = "{name}"\ncups = {cups}\n'
Q6_1 = head("果茶", 8) + START6.rstrip("\n")
Q6_2 = head("咖啡", 2) + 'if name {0} stock:\n    print("没有这个饮品")\nelse:\n' + SELL + 'print(stock)'
Q6_3 = head("果茶", 5) + 'if name not in stock:\n    print("没有这个饮品")\nelif cups {0} stock[name]:\n    print("库存不足")\nelse:\n' + SELL + 'print(stock)'
Q6_4 = head("果茶", 8) + REF6.rstrip("\n")
assert out_of(Q6_1) == "成交\n剩 -3 杯\n{'奶茶': 12, '果茶': -3}"
assert out_of(Q6_2.replace("{0}", "not in")) == "没有这个饮品\n{'奶茶': 12, '果茶': 5}" and err_of(Q6_2.replace("{0}", "in")) == "KeyError"
assert out_of(Q6_3.replace("{0}", ">")) == "成交\n剩 0 杯\n{'奶茶': 12, '果茶': 0}"
assert out_of(Q6_3.replace("{0}", ">=")) == "库存不足\n{'奶茶': 12, '果茶': 5}" and out_of(Q6_3.replace("{0}", "==")) == "库存不足\n{'奶茶': 12, '果茶': 5}"
Q6_4_OUT = "库存不足\n{'奶茶': 12, '果茶': 5}"
assert out_of(Q6_4) == Q6_4_OUT
# 干扰项：都和真实输出不同；第一个是没有检查时（Q1 的起始程序）真会得到的输出
Q6_4_BAD = ["成交\n剩 -3 杯\n{'奶茶': 12, '果茶': -3}", "库存不足\n{'奶茶': 12, '果茶': -3}", "库存不足"]
assert out_of(head("果茶", 8) + START6) == Q6_4_BAD[0] and all(b != Q6_4_OUT for b in Q6_4_BAD)

lessons = [
 {"id": "U7L1", "title": "按名字查库存", "concept": "字典、键和值、stock[键]",
  "story": "列表按位置找，字典（dict）按名字找：stock = {\"奶茶\": 12, \"果茶\": 5}。每一对写成“键: 值”，这里键是饮品名，值是杯数；一行写不下时，可以在逗号后换行。stock[\"果茶\"] 查出果茶的值 5。查没有的键，会报 KeyError。",
  "introCode": L1_INTRO,
  "exercises": [
    pred(SHOW, Q1_1, [
        ("5", T, "按键“果茶”查，得到它的值 5。"),
        ("12", F, "12 是奶茶的值；方括号里写的是“果茶”。"),
        ("果茶", F, "查出来的是值，不是键本身。"),
        ("1", F, "字典不按位置找，方括号里写的是键。")],
        tip="stock[键] 得到这个键的值。"),
    pred(SHOW, Q1_2, [
        ("奶茶 12", T, "name 里是 \"奶茶\"，stock[name] 就是 stock[\"奶茶\"]，得 12。"),
        ("name 12", F, "name 是变量，显示的是它里面的文字：奶茶。"),
        ("奶茶 5", F, "5 是果茶的值，奶茶的值是 12。")],
        tip="方括号里可以放变量：变量里是哪个键，就查哪个键。"),
    fill("屏幕要显示咖啡的库存：8", Q1_3,
        ["\"咖啡\"", "咖啡", "2", "\"果茶\""], ["\"咖啡\""], "8",
        {"咖啡": "没有引号，Python 把咖啡当变量名，报 NameError。键是文字，要带引号。",
         "2": "字典不按位置找：stock[2] 找的是叫 2 的键，没有，报 KeyError。",
         "\"果茶\"": "果茶的值是 5，不是 8。"},
        "方括号里写键 \"咖啡\"，带引号。"),
    pred(SHOW, Q1_4, [
        ("17", T, "a 是 12，b 是 5，都是整数：12 + 5 = 17。"),
        ("奶茶果茶", F, "a、b 里放的是查出来的值，不是键。"),
        ("125", F, "值是整数 12 和 5，不是文字，+ 是做加法。")],
        tip="查出来的值可以直接拿去计算。"),
  ]},
 {"id": "U7L2", "title": "改库存", "concept": "stock[键] = 新值",
  "story": "stock[\"果茶\"] = 9 把果茶的值换成 9。在旧值上改：先算 n = stock[\"奶茶\"] - 3，再用 stock[\"奶茶\"] = n 存回去。只算不存，字典不变。这一关只改已经有的键。",
  "introCode": L2_INTRO,
  "exercises": [
    pred(SHOW, Q2_1, [
        ("12\n9", T, f"第 {L2_1} 行把果茶换成 9；奶茶没动，还是 12。"),
        ("12\n14", F, "= 是换成，不是加上。"),
        ("12\n5", F, f"第 {L2_1} 行已经改了果茶，后面查到的是新值 9。"),
        ("9\n5", F, "被改的是方括号里写的果茶，不是奶茶。")],
        tip="stock[键] = 新值：替换这个键的旧值。"),
    pred(SHOW, Q2_2, [
        ("9\n5", T, f"n 是 12 - 3 = 9；第 {L2_2S} 行把 9 存回奶茶。"),
        ("12\n5", F, f"第 {L2_2S} 行已经把 n 存回奶茶了。"),
        ("-3\n5", F, "stock[\"奶茶\"] - 3 先查出旧值 12，再减 3。")],
        tip="先算出新值，再存回这个键。"),
    pred(SHOW, Q2_3, [
        ("5", T, f"第 {L2_3} 行只算出 4，没有用 = 存回去，库存不变。"),
        ("4", F, "算出了 4，但没存回字典。"),
        ("报错 KeyError", F, "果茶这个键存在，不会报错；只是结果没存。")],
        tip="不写 stock[键] = …，字典就不会变。"),
    fill("顾客买了 cups 杯 name。补全，让库存减掉卖出的杯数，屏幕显示：2", Q2_4,
        ["stock[name]", "name", "cups"], ["stock[name]"], "2",
        {"name": "name 是文字 \"果茶\"，文字减整数报 TypeError。要减的是库存 stock[name]。",
         "cups": "cups - cups 得 0，库存被清空了。"},
        "剩下的 = 原来的库存 - 卖出的杯数。"),
  ]},
 {"id": "U7L3", "title": "先问再取", "concept": "in、.get()、None",
  "story": "取之前先问：\"咖啡\" in stock 看咖啡是不是一个键，得 True 或 False，只看键不看值。或者用 stock.get(\"咖啡\")：有就给值，没有就给 None（表示“没有”），不报错。写成 stock.get(\"咖啡\", 0)，没有时给 0。",
  "introCode": L3_INTRO,
  "exercises": [
    pred(SHOW, Q3_1, [
        ("True\nFalse", T, "奶茶是键；12 是值不是键，in 只看键。"),
        ("True\nTrue", F, "12 是奶茶的值，in 只看键。"),
        ("False\nFalse", F, "奶茶是字典里的键，是 True。")],
        tip="字典的 in 只看键。"),
    pred(SHOW, Q3_2, [
        ("5\nNone\n0", T, "果茶有，给真实的值 5；咖啡没有：不写默认值给 None，写了给 0。"),
        ("0\nNone\n0", F, "果茶存在时，默认值不起作用，给真实的值 5。"),
        ("5\n0\n0", F, f"第 {L3_2a} 行没写默认值，没有时给 None。"),
        ("5\nNone\nNone", F, f"第 {L3_2b} 行写了默认值 0，没有时给 0。")],
        tip="有：给真实的值；没有：给默认值，没写默认值就是 None。"),
    fill("咖啡还没进货。屏幕要显示：没有这个饮品", Q3_3,
        ["name in stock", "name not in stock", "stock[name]"], ["name in stock"], "没有这个饮品",
        {"name not in stock": "条件反了：咖啡不在，条件成立，去取 stock[name]，报 KeyError。",
         "stock[name]": "算条件时就在查咖啡，没有这个键，报 KeyError。"},
        "有才取：先问 name 在不在 stock 里。"),
    pred(SHOW, Q3_4, [
        ("0\nFalse", T, ".get() 只是查，没有时给 0；不会把咖啡加进字典。"),
        ("0\nTrue", F, ".get(\"咖啡\", 0) 不会新增键，咖啡还是不在。"),
        ("None\nFalse", F, "写了默认值 0，没有时给 0。")],
        tip=".get() 只查不改。"),
  ]},
 {"id": "U7L4", "title": "进货与下架", "concept": "新增、del、print(字典)",
  "story": "给没有的键赋值就是新增：stock[\"咖啡\"] = 8。键名打错也会悄悄新增，不报错。del stock[\"果茶\"] 删掉这一对；删没有的键报 KeyError。print(stock) 显示 {'奶茶': 12, '咖啡': 8}，新增的排在最后。",
  "introCode": L4_INTRO,
  "exercises": [
    pred(SHOW, Q4_1, [
        ("{'奶茶': 12, '咖啡': 8}", T, "咖啡原来没有，赋值就新增一对，排在最后。"),
        ("{'奶茶': 12}", F, f"第 {L4_1} 行已经把咖啡加进去了。"),
        ("{'咖啡': 8, '奶茶': 12}", F, "新增的排在最后，不是最前。"),
        ("报错 KeyError", F, "给没有的键赋值是新增，不报错；读取没有的键才报错。")],
        tip="键已有：替换；键没有：新增。"),
    pred("小码想把果茶改成 4，却把“茶”打成了“查”。点单屏运行这段程序，屏幕上会显示什么？", Q4_2, [
        ("5\n4", T, f"第 {L4_2} 行新增了一个叫“果查”的键；果茶没被改，还是 5。"),
        ("4\n4", F, "“果查”和“果茶”是两个不同的键，果茶没变。"),
        ("5\n报错 KeyError", F, f"第 {L4_2} 行已经新增了“果查”，再读它不会报错。")],
        tip="键名打错不会报错，会多出一个新键。"),
    pred(SHOW, Q4_3, [
        ("{'奶茶': 12}", T, "del 把果茶的键和值一起删掉。"),
        ("{'奶茶': 12, '果茶': 0}", F, "del 是整对删掉，不是把值改成 0。"),
        ("{'奶茶': 12, '果茶': 5}", F, f"第 {L4_3} 行已经删掉了果茶。")],
        tip="del 字典[键]：键和值一起删。"),
    order("排好顺序：进货 5 杯果茶，字典里没有果茶就先记成 0。屏幕显示：{'奶茶': 12, '果茶': 5}", O4, [4, 1, 5, 3, 0, 2], valid_orders(O4, "{'奶茶': 12, '果茶': 5}"),
        "{'奶茶': 12, '果茶': 5}", "先有字典；没有果茶先记 0；算出加 5 后的数，存回去；最后显示。"),
  ]},
 {"id": "U7L5", "title": "一个一个看", "concept": "for name in stock",
  "story": "for name in stock: 每一轮 name 是一个键（饮品名），按字典里的顺序。要这个键的值，写 stock[name]。",
  "introCode": L5_INTRO,
  "exercises": [
    pred(SHOW, Q5_1, [
        ("奶茶\n果茶", T, "遍历字典，name 依次是每个键。"),
        ("12\n5", F, "name 是键，不是值；值要写 stock[name]。"),
        ("奶茶 12\n果茶 5", F, "循环里只 print(name)，只有键。")],
        tip="for 遍历字典，拿到的是键。"),
    pred(SHOW, Q5_2, [
        ("17", T, "每轮 n 是这个键的值，加到 total 上：12 + 5 = 17。"),
        ("2", F, "2 是键的个数；这里加的是值 n。"),
        ("5", F, "total = total + n，每轮累加，不是只留最后一个。")],
        tip="累加值：n = stock[name]，total = total + n。"),
    fill("库存少于 5 杯算低库存（正好 5 杯不算）。屏幕要显示低库存有几种：1", Q5_3,
        ["<", "<=", ">="], ["<"], "1",
        {"<=": "果茶正好 5 杯也被数进去，得 2。",
         ">=": "数的是不少于 5 杯的，得 2。"},
        "少于 5：只有咖啡 3 杯。"),
    pred(SHOW, Q5_4, [
        ("果茶 卖完\n咖啡 卖完", T, "值等于 0 的键有果茶和咖啡，按字典顺序显示。"),
        ("果茶 卖完", F, "for 会看完每一个键，咖啡也是 0。"),
        ("0 卖完\n0 卖完", F, "name 是键（饮品名），不是值。")],
        tip="遍历时用 stock[name] 判断，用 name 显示名字。"),
  ]},
 {"id": "U7L6", "title": "项目：库存小程序", "concept": "先问有没有，再问够不够，最后才改",
  "story": "顾客点了 name 饮品 cups 杯。没有这个饮品：显示“没有这个饮品”；杯数比库存多：显示“库存不足”；否则减库存，显示“成交”和“剩 N 杯”（正好卖完也算成交）。最后都 print(stock)。",
  "introCode": Q6_1,
  "exercises": [
    pred("起始程序没有检查库存是否足够，直接扣减库存。点 8 杯果茶（只有 5 杯），屏幕上会显示什么？", Q6_1, [
        ("成交\n剩 -3 杯\n{'奶茶': 12, '果茶': -3}", T, "程序没检查够不够，直接减成了 -3。不报错，但结果是错的。"),
        ("库存不足\n{'奶茶': 12, '果茶': 5}", F, "程序里还没有检查库存的 if。"),
        ("报错", F, "果茶存在，5 - 8 能算，不会报错。")],
        tip="没报错不等于对：要对一对输出。"),
    fill("先处理“没有这个饮品”。点 2 杯咖啡，屏幕要显示：没有这个饮品，再显示原来的库存表", Q6_2,
        ["not in", "in"], ["not in"], "没有这个饮品\n{'奶茶': 12, '果茶': 5}",
        {"in": "条件反了：咖啡不在，走 else 去取 stock[name]，报 KeyError。"},
        "先问：name 不在 stock 里吗？"),
    fill("再处理“库存不足”。果茶正好 5 杯，点 5 杯算成交。屏幕要显示：成交、剩 0 杯，再显示库存表", Q6_3,
        [">", ">=", "=="], [">"], "成交\n剩 0 杯\n{'奶茶': 12, '果茶': 0}",
        {">=": "5 >= 5 成立，正好卖完被当成库存不足。",
         "==": "5 == 5 成立，正好卖完被当成库存不足。"},
        "只有杯数比库存多才算不足。"),
    pred("三种情况都写好了。点 8 杯果茶（只有 5 杯），屏幕上会显示什么？", Q6_4, [
        (Q6_4_OUT, T, "果茶存在；8 > 5，走“库存不足”分支。这个分支只显示提示，不改 stock，最后显示的表里果茶还是 5。"),
        (Q6_4_BAD[0], F, "elif cups > stock[name] 是 8 > 5，成立，走的是“库存不足”，不会进 else 去扣库存。"),
        (Q6_4_BAD[1], F, "“库存不足”分支里只有 print，没有给 stock 写值，果茶不会变成 -3。"),
        (Q6_4_BAD[2], F, "最后一行 print(stock) 不在 if 里，每种情况都会运行，还会显示库存表。")],
        tip="库存不足时只显示提示，库存不变。"),
  ]},
]

# ---------------- U7L6 代码题（pending：待代码题运行器，暂不开放）----------------
def T6(tname, stock, name, cups, hidden=False, src=REF6):
    pre = f"stock = {stock!r}\nname = {name!r}\ncups = {cups!r}\n"
    out, err = run(pre + src); assert err is None, (tname, err)
    return TST(tname, {"stock": stock, "name": name, "cups": cups}, out, hidden)
D0 = {"奶茶": 12, "果茶": 5}
TESTS6 = [T6("3 杯奶茶，够", D0, "奶茶", 3), T6("8 杯果茶，库存不足", D0, "果茶", 8), T6("咖啡，不存在", D0, "咖啡", 2),
          T6("正好卖完", D0, "果茶", 5, True), T6("库存已经是 0", {"奶茶": 12, "果茶": 0}, "果茶", 1, True),
          T6("换一张库存表：不存在", {"咖啡": 4, "奶茶": 1}, "果茶", 1, True), T6("换一张库存表：成交", {"咖啡": 4, "奶茶": 1}, "咖啡", 3, True)]
assert TESTS6[0]["expected"] == "成交\n剩 9 杯\n{'奶茶': 9, '果茶': 5}" and TESTS6[3]["expected"] == "成交\n剩 0 杯\n{'奶茶': 12, '果茶': 0}"
def fails(src, tests=TESTS6):
    res = []
    for t in tests:
        d = t["data"]; out, err = run(f"stock = {d['stock']!r}\nname = {d['name']!r}\ncups = {d['cups']!r}\n" + src)
        if err or out != t["expected"]: res.append(t["name"])
    return res
ALT6 = [  # 判对的其他写法（学生答案，不在题面显示）
 'if name in stock:\n    if cups <= stock[name]:\n        n = stock[name] - cups\n        stock[name] = n\n        print("成交")\n        print("剩", n, "杯")\n    else:\n        print("库存不足")\nelse:\n    print("没有这个饮品")\nprint(stock)\n',
 'if name not in stock:\n    print("没有这个饮品")\nelif stock[name] < cups:\n    print("库存不足")\nelse:\n    stock[name] = stock[name] - cups\n    print("成交")\n    print("剩", stock[name], "杯")\nprint(stock)\n']
WRONG6 = [
 (REF6.replace("elif cups > stock[name]:", "elif cups >= stock[name]:"), "边界：正好卖完也算成交，用 > 不用 >=", ["正好卖完"]),
 ('if cups > stock[name]:\n    print("库存不足")\nelif name not in stock:\n    print("没有这个饮品")\nelse:\n' + SELL + 'print(stock)\n', "顺序反了：先取 stock[name]，不存在的饮品直接 KeyError", ["咖啡，不存在", "换一张库存表：不存在"]),
 ('if cups > stock.get(name, 0):\n    print("库存不足")\nelse:\n' + SELL + 'print(stock)\n', "把不存在当成库存 0，输出了“库存不足”；两种情况要分开", ["咖啡，不存在", "换一张库存表：不存在"])]
assert fails(REF6) == [] and all(fails(a) == [] for a in ALT6)
for w, why, want in WRONG6: assert fails(w) == want, (why, fails(w))
assert fails(START6) != []
REF6V = REF6.replace('    print("库存不足")\n', '    print("库存不足")\n    d = cups - stock[name]\n    print("还差", d, "杯")\n')
V6 = [T6("8 杯果茶", D0, "果茶", 8, src=REF6V), T6("3 杯奶茶", D0, "奶茶", 3, src=REF6V),
      T6("正好卖完", D0, "果茶", 5, True, REF6V), T6("咖啡，不存在", D0, "咖啡", 2, True, REF6V), T6("差 8 杯", {"奶茶": 2}, "奶茶", 10, True, REF6V)]
assert V6[0]["expected"] == "库存不足\n还差 3 杯\n{'奶茶': 12, '果茶': 5}" and fails(REF6, V6) != []
for t in TESTS6 + V6:  # 题面写明的输入范围
    assert t["data"]["cups"] >= 1 and all(v >= 0 for v in t["data"]["stock"].values())
WORKED6 = {"code": 'books = {"童话": 3,\n         "科幻": 0}\ntitle = "科幻"\nif title not in books:\n    print("没有这本书")\nelif books[title] == 0:\n    print("已借完")\nelse:\n    n = books[title] - 1\n    books[title] = n\n    print("借走一本")',
           "output": "已借完", "explain": "先问在不在，再问还有没有，两个检查都过了才改数量。"}
assert out_of(WORKED6["code"]) == WORKED6["output"]
VSTART = "# stock、name、cups 已备好\n"
lessons[5]["pending"] = [{"type": "modify", "replaces": 4, "status": "待 Claude 的代码题运行器，暂不开放",
  "plan": "改一改（项目）：库存小程序；不存在、库存不足、成交三种情况，最后 print(stock)。替换第 4 题：M1 的公开测试“8 杯果茶，库存不足”要求库存表不变，覆盖第 4 题的考点",
  "task": {"id": "U7L6-M1", "version": 1, "type": "modify",
    "prompt": "已经准备好 stock（库存表）、name（饮品）、cups（杯数，正整数）。规则：① name 不在 stock 里：输出“没有这个饮品”。② cups 比库存多：输出“库存不足”。③ 其余：库存减去 cups，输出“成交”，再输出“剩 N 杯”（正好卖完也算成交）。①② 库存不变。最后都 print(stock)。起始程序只写了“成交”，请改好。",
    "given": ["stock", "name", "cups"], "checkMode": "output",
    "code": START6, "tests": TESTS6,
    "hints": ["先运行，读最后一行的错误类型；不报错也要对一对三种情况的输出。", "用 if / elif / else：先问 name not in stock，再问 cups > stock[name]，最后才改库存；print(stock) 写在 if 外面。"],
    "reference": REF6, "worked": WORKED6, "alternatives": ALT6,
    "wrongAnswers": [{"code": w, "why": why} for w, why, _ in WRONG6],
    "requiresVariationAfterSolution": True,
    "variation": {"id": "U7L6-M1-V1", "prompt": "库存不足时，在“库存不足”下面再输出一行“还差 N 杯”（N = cups 减库存），其他不变，最后仍 print(stock)。",
      "starter": VSTART, "tests": V6,
      "hints": ["顺序不变：先判断不存在，再判断不足，最后才改库存。", "不足时：先 d = cups - stock[name]，再 print(\"还差\", d, \"杯\")。"],
      "solution": REF6V}}}]

# ---------------- 行宽：题目里显示的每行代码和选项都不超过 28 格 ----------------
def shown_lines():
    for l in lessons:
        yield f"{l['id']}-讲解示例", l["introCode"]
        for i, e in enumerate(l["exercises"], 1):
            w = f"{l['id']}-Q{i}"
            if e["type"] == "order": yield w + "-排序行", "\n".join(e["lines"])
            elif e["type"] == "fill":
                for t in e["tokens"]: yield w + f"-填[{t}]", e["code"].replace("{0}", t)
            else: yield w, e["code"]
            for o in e.get("options", []): yield w + "-选项", o["text"]
        for pt in l.get("pending", []):
            k = pt["task"]
            for name, code in [("起始", k["code"]), ("答案", k["reference"]), ("示范", k["worked"]["code"]), ("变化题答案", k["variation"]["solution"]), ("变化题起始", k["variation"]["starter"])]:
                yield f"{k['id']}-{name}", code
INTRO_MAXW = 22  # 开场讲解示例在“手机”样式代码块里（max-width 280、旋转），390 宽下实测约 22 格
assert all(width(x) <= INTRO_MAXW for l in lessons for x in l["introCode"].split("\n")), [(l['id'], x) for l in lessons for x in l['introCode'].split('\n') if width(x) > INTRO_MAXW]
too_wide = [(w, line, width(line)) for w, code in shown_lines() for line in code.split("\n") if width(line) > MAXW]
assert not too_wide, too_wide

unit = {"id": "U7", "title": "字典", "subtitle": "dict：按名字存取", "lessons": lessons}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit7.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons))
