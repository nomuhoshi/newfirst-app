import json, pathlib, sys, itertools, io, contextlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from verify.common import real_error, run

def pred(prompt, code, opts, tip=None):
    d = {"type": "predict", "prompt": prompt, "code": code,
         "options": [{"text": t, "correct": c, "why": w} for t, c, w in opts]}
    if tip: d["tip"] = tip
    return d

def fill(prompt, code, tokens, answer, expected, why, hint):
    return {"type": "fill", "prompt": prompt, "code": code, "tokens": tokens, "answer": answer, "expected": expected, "why": why, "hint": hint}

def order(prompt, lines, shuffled, answers, expected, hint):
    return {"type": "order", "prompt": prompt, "lines": lines, "shuffled": shuffled, "answers": answers, "expected": expected, "hint": hint}

def chk(program):
    r = real_error(program); assert r, program
    return {"program": program, "type": r["type"], "line": r["line"], "msg": r["msg"]}

def pick(prompt, key, options, code=None, trace=None, checks=None, expected=None, tip=None):
    d = {"type": "pick", "prompt": prompt, "key": key}
    if code: d["code"] = code
    if trace: d["trace"] = trace
    d["checks"] = [chk(code)] if checks is None else checks
    if expected is not None: d["expected"] = expected
    d["options"] = options
    if tip: d["tip"] = tip
    return d

def opt(text, correct, why, **extra):
    return {"text": text, "correct": correct, "why": why, **extra}

def trace_of(program): return real_error(program)["trace"]

def _out(code):
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf): exec(code, {})
    except Exception as e: return "<" + type(e).__name__ + ">"
    return buf.getvalue().rstrip("\n")

def valid_orders(lines, expected):
    """所有能得到 expected 的排列（标准顺序在最前面）。"""
    canon = list(range(len(lines)))
    res = [list(p) for p in itertools.permutations(canon) if _out("\n".join(lines[k] for k in p)) == expected]
    res.sort(key=lambda a: a != canon); return res

def real_out(code):
    """程序必须正常结束，返回真实输出（题面里写出来的每一个“显示什么”都从这里取，不手写）。"""
    out, err = run(code); assert err is None, (code, err); return out

def err_type(code):
    """程序必须报错，返回真实错误类型（解释里写的错误类型都从这里取）。"""
    r = real_error(code); assert r, code; return r["type"]


SHOW = "点单屏运行这段程序，屏幕上会显示什么？"
T, F = True, False

def lines_of(code): return [s.strip() for s in code.split("\n")]

# ====================== U9 小项目：奶茶店点单小票 ======================
# 学习目标（docs/47）：把需求拆成数据和步骤；读懂字典 + 列表 + 循环 + 函数合在一起的程序；
# 一次加一条规则并用边界测试检查；读懂组合程序里的报错；检查 AI 写的完整程序（找能暴露错误的输入、选修复、修完再试）。
# 只用已学：print、变量、运算、字符串、if/elif/else、for、列表（append、len、sum、in）、+=、字典（查、in、KeyError）、
# int()/str()、读报错（NameError / TypeError / KeyError）、def / 参数 / 默认值 / return / None、作用域（函数里的名字外面用不了）。
# 不用：f-string、.items()、.get() 以外的新方法、global、异常处理（try）。

MENU = 'menu = {"奶茶": 15,\n        "果茶": 12}'
def order_of(*names):
    q = ", ".join(f'"{n}"' for n in names)
    if len(names) <= 2: return f"order = [{q}]"
    first = ", ".join(f'"{n}"' for n in names[:2]); rest = ", ".join(f'"{n}"' for n in names[2:])
    return f"order = [{first},\n         {rest}]"
BILL = 'def bill(order, menu):\n    total = 0\n    for name in order:\n        total += menu[name]\n    return total'
DISC = 'def discount(t):\n    if t >= 30:\n        return t - 5\n    return t'

# ---------------- U9L1 菜单、订单、合计 ----------------
L1_INTRO = 'menu = {"奶茶": 15}\norder = ["奶茶", "奶茶"]\ntotal = 0\nfor name in order:\n    total += menu[name]\nprint(total)'
assert real_out(L1_INTRO) == "30"
Q1_CODE = 'menu = ……\nprint(menu["奶茶"])'
def q1(first): return first + '\nprint(menu["奶茶"])'
Q1A, Q1B, Q1C, Q1D = q1('menu = {"奶茶": 15}'), q1('menu = ["奶茶", 15]'), q1('menu = {15: "奶茶"}'), q1('menu = {"奶茶" = 15}')
assert run(Q1A) == ("15", None) and run(Q1B)[1] == "TypeError" and run(Q1C)[1] == "KeyError" and run(Q1D)[1] == "SyntaxError"
Q2 = MENU + '\n' + order_of("奶茶", "果茶", "奶茶") + '\nfor name in order:\n    print(name, menu[name])'
Q2_OUT = real_out(Q2); assert Q2_OUT == "奶茶 15\n果茶 12\n奶茶 15"
assert real_out(MENU + '\nfor name in menu:\n    print(name, menu[name])') == "奶茶 15\n果茶 12"      # 以为循环走的是菜单
Q3_CODE = MENU + '\n' + order_of("奶茶", "果茶", "奶茶") + '\ntotal = 0\nfor name in order:\n    total += {0}\nprint(total)'
def q3(t): return Q3_CODE.replace("{0}", t)
assert real_out(q3("menu[name]")) == "42" and real_out(q3('menu["奶茶"]')) == "45"
assert run(q3("name"))[1] == "TypeError" and run(q3("order[name]"))[1] == "TypeError"
Q4_LINES = ['menu = {"奶茶": 15}', 'order = ["奶茶", "奶茶"]', 'total = 0', 'for name in order:', '    total += menu[name]', 'print(total)']
Q4_ANS = valid_orders(Q4_LINES, "30")

# ---------------- U9L2 把合计写成函数 ----------------
L2_INTRO = BILL + '\n' + MENU + '\n' + order_of("奶茶", "果茶") + '\nprint(bill(order, menu))'
assert real_out(L2_INTRO) == "27"
Q5 = BILL + '\n' + MENU + '\n' + order_of("奶茶", "果茶", "奶茶") + '\nprint(bill(order, menu))'
assert real_out(Q5) == "42"
BILL_EARLY = 'def bill(order, menu):\n    total = 0\n    for name in order:\n        total += menu[name]\n        return total'
Q6 = BILL_EARLY + '\n' + MENU + '\n' + order_of("奶茶", "果茶", "奶茶") + '\nprint(bill(order, menu))'
assert real_out(Q6) == "15"
Q7_CODE = 'def bill(order, menu):\n    total = 0\n    for name in order:\n        total += menu[name]\n    {0}\n' + MENU + '\n' + order_of("奶茶", "果茶", "奶茶") + '\nprint(bill(order, menu))'
def q7(t): return Q7_CODE.replace("{0}", t)
assert real_out(q7("return total")) == "42" and real_out(q7("print(total)")) == "42\nNone" and real_out(q7("return name")) == "奶茶" and real_out(q7("total")) == "None"
Q8 = BILL + '\n' + MENU + '\n' + order_of("奶茶", "果茶", "奶茶") + '\nbill(order, menu)\nprint(total)'
r8 = real_error(Q8); assert (r8["type"], r8["msg"], r8["code_line"]) == ("NameError", "name 'total' is not defined", "print(total)")
Q8_FIX_A = Q8.replace("bill(order, menu)\nprint(total)", "print(bill(order, menu))")
Q8_FIX_B = Q8.replace("bill(order, menu)\nprint(total)", "bill(order, menu)\ntotal = 0\nprint(total)")
Q8_FIX_C = Q8.replace("    return total", "    print(total)")
Q8_FIX_D = Q8.replace("bill(order, menu)\nprint(total)", "print(bill)")
assert run(Q8_FIX_A) == ("42", None) and run(Q8_FIX_B) == ("0", None)
assert run(Q8_FIX_C)[1] == "NameError" and real_error(Q8_FIX_C)["stdout"] == "42"
assert run(Q8_FIX_D)[0].startswith("<function bill at")

# ---------------- U9L3 加一条规则：满 30 减 5 ----------------
L3_INTRO = DISC + '\nprint(discount(30))\nprint(discount(24))'
assert real_out(L3_INTRO) == "25\n24"
Q9 = DISC + '\nprint(discount(27))\nprint(discount(30))\nprint(discount(42))'
assert real_out(Q9) == "27\n25\n37"
assert real_out(Q9.replace(">= 30", "> 30")) == "27\n30\n37"
DISC_GT = DISC.replace(">= 30", "> 30")
def rule(t): return t - 5 if t >= 30 else t
def q10_harness(x): return DISC_GT + f'\ngot = discount({x})\nwant = {rule(x)}\nprint("不一致" if got != want else "一致")'
for x, w in ((30, "不一致"), (29, "一致"), (42, "一致"), (15, "一致")): assert real_out(q10_harness(x)) == w
Q11_CODE = 'def discount(t):\n    if t {0} 30:\n        return t - 5\n    return t\nprint(discount(30))\nprint(discount(29))\nprint(discount(42))'
def q11(t): return Q11_CODE.replace("{0}", t)
assert real_out(q11(">=")) == "25\n29\n37" and real_out(q11(">")) == "30\n29\n37" and real_out(q11("==")) == "25\n29\n42" and real_out(q11("<=")) == "25\n24\n42"
DISC_NOELSE = 'def discount(t):\n    if t >= 30:\n        return t - 5'
Q12 = DISC_NOELSE + '\nprint(discount(42))\nprint(discount(24))'
assert real_out(Q12) == "37\nNone"

# ---------------- U9L4 菜单里没有的饮品 ----------------
Q13 = BILL + '\n' + MENU + '\n' + order_of("奶茶", "咖啡") + '\nprint(bill(order, menu))'
r13 = real_error(Q13); assert (r13["type"], r13["code_line"], r13["msg"]) == ("KeyError", "total += menu[name]", "'咖啡'")
LOOP_IN = 'total = 0\nfor name in order:\n    if name {0} menu:\n        total += menu[name]\n    else:\n        print("没有", name)\nprint(total)'
Q14_CODE = MENU + '\n' + order_of("奶茶", "咖啡", "果茶") + '\n' + LOOP_IN
def q14(t): return Q14_CODE.replace("{0}", t)
assert real_out(q14("in")) == "没有 咖啡\n27" and run(q14("not in"))[1] == "KeyError" and real_out(q14("==")) == "没有 奶茶\n没有 咖啡\n没有 果茶\n0"
assert real_error(q14("not in"))["stdout"] == "没有 奶茶" and run(q14("!="))[1] == "KeyError"
L4_INTRO = MENU + '\n' + order_of("咖啡", "奶茶") + '\n' + LOOP_IN.replace("{0}", "in")
Q15 = MENU + '\n' + order_of("奶茶", "咖啡") + '\n' + LOOP_IN.replace("{0}", "in").replace("print(total)", 'print("合计", total)')
assert real_out(Q15) == "没有 咖啡\n合计 15"
LOOP_BRK = LOOP_IN.replace("{0}", "in").replace('        print("没有", name)', '        print("没有", name)\n        break')
Q16 = MENU + '\n' + order_of("奶茶", "咖啡", "果茶") + '\n' + LOOP_BRK
assert real_out(Q16) == "没有 咖啡\n15"
Q16_FIX_A = Q16.replace('        print("没有", name)\n        break', '        print("没有", name)')
Q16_FIX_B = Q16.replace('        print("没有", name)\n        break', '        print("没有", name)\n        total = 0\n        break')
Q16_FIX_C = Q16.replace('        print("没有", name)\n        break', '        break')
Q16_FIX_D = Q16.replace('\nprint(total)', '\n    print(total)')
assert run(Q16_FIX_A) == ("没有 咖啡\n27", None) and run(Q16_FIX_B) == ("没有 咖啡\n0", None) and run(Q16_FIX_C) == ("15", None) and run(Q16_FIX_D) == ("15\n没有 咖啡", None)

# ---------------- U9L5 拼成一张小票 ----------------
L5_INTRO = DISC + '\nprices = [15, 12, 15]\nt = sum(prices)\nprint("合计", t)\nprint("应付", discount(t))'
Q17_LINES = ['menu = {"奶茶": 15}', 'order = ["奶茶", "奶茶"]', 't = 0', 'for name in order:', '    print(name, menu[name])', '    t += menu[name]', 'print("合计", t)']
Q17_EXP = "奶茶 15\n奶茶 15\n合计 30"
Q17_ANS = valid_orders(Q17_LINES, Q17_EXP)
Q18 = L5_INTRO
assert real_out(Q18) == "合计 42\n应付 37"
Q19 = DISC + '\nprices = [15, 12, 15]\nprint("应付", discount(t))\nt = sum(prices)\nprint("合计", t)'
r19 = real_error(Q19); assert (r19["type"], r19["code_line"], r19["msg"]) == ("NameError", 'print("应付", discount(t))', "name 't' is not defined")
Q20_CODE = DISC + '\nprices = [15, 12]\nt = sum(prices)\nprint("应付", {0})'
def q20(t): return Q20_CODE.replace("{0}", t)
assert real_out(q20("discount(t)")) == "应付 27" and real_out(q20("t - 5")) == "应付 22" and real_out(q20("discount(30)")) == "应付 25"
assert real_out(q20("discount")).startswith("应付 <function discount at")

# ---------------- U9L6 项目：检查 AI 写的小票程序 ----------------
BILL_RESET = 'def bill(order, menu):\n    for name in order:\n        total = 0\n        total += menu[name]\n    return total'
Q21 = BILL_RESET + '\n' + MENU + '\n' + order_of("奶茶", "果茶") + '\nprint(bill(order, menu))'
assert real_out(Q21) == "12"
def q22_harness(names):
    o = "[" + ", ".join(f'"{n}"' for n in names) + "]"
    return BILL_RESET + '\n' + MENU + f'\norder = {o}\ngot = bill(order, menu)\nwant = 0\nfor name in order:\n    want += menu[name]\nprint("不一致" if got != want else "一致")'
for names, w in ((["奶茶"], "一致"), (["果茶"], "一致"), (["奶茶", "奶茶"], "不一致")): assert real_out(q22_harness(names)) == w
def q23_harness(bill_src):
    return bill_src + '\n' + MENU + '\nok = True\nfor order in [["奶茶"], ["奶茶", "果茶"],\n              ["果茶", "奶茶", "奶茶"]]:\n    want = 0\n    for name in order:\n        want += menu[name]\n    if bill(order, menu) != want:\n        ok = False\nprint("全部一致" if ok else "有不一致")'
FIX_MOVE = 'def bill(order, menu):\n    total = 0\n    for name in order:\n        total += menu[name]\n    return total'
FIX_PLUS = 'def bill(order, menu):\n    for name in order:\n        total = 0\n        total = total + menu[name]\n    return total'
FIX_DEL = 'def bill(order, menu):\n    for name in order:\n        total += menu[name]\n    return total'
FIX_RET = 'def bill(order, menu):\n    for name in order:\n        total = 0\n        total += menu[name]\n        return total'
assert real_out(q23_harness(FIX_MOVE)) == "全部一致" and real_out(q23_harness(FIX_PLUS)) == "有不一致" and real_out(q23_harness(FIX_RET)) == "有不一致"
assert run(q23_harness(FIX_DEL))[1] == "UnboundLocalError"
assert real_error(MENU.replace('\n', '\n') + '\n' + FIX_DEL + '\nprint(bill(["奶茶"], menu))')["type"] == "UnboundLocalError"
Q24 = FIX_MOVE + '\n' + DISC + '\n' + MENU + '\n' + order_of("奶茶", "奶茶") + '\nt = bill(order, menu)\nprint(discount(t))'
assert real_out(Q24) == "25"
assert real_out(BILL_RESET + '\n' + DISC + '\n' + MENU + '\n' + order_of("奶茶", "奶茶") + '\nt = bill(order, menu)\nprint(discount(t))') == "15"   # 修之前

# ====================== 关卡内容 ======================
def harness_opts(items): return items
lessons = [
 {"id": "U9L1", "title": "菜单、订单、合计", "concept": "需求拆成数据：菜单用字典、订单用列表、合计用循环累加",
  "story": "要做一张奶茶店小票。先把需求拆开：菜单是“名字 → 单价”，用字典；订单是点了哪几杯，用列表，同一种可以点好几杯；合计就是把订单里每一杯的单价，到菜单里查出来再加起来。",
  "introCode": L1_INTRO,
  "exercises": [
    pick("要能写 menu[\"奶茶\"] 查到奶茶的单价 15，第 1 行该怎么写？", "fix", [
        opt('menu = {"奶茶": 15}', T, "字典“名字: 单价”，用名字当键，menu[\"奶茶\"] 就查到 15。", fixed=Q1A),
        opt('menu = ["奶茶", 15]', F, "这是列表，只能用位置号查（menu[0]、menu[1]），用名字查会报 TypeError。", fixed=Q1B),
        opt('menu = {15: "奶茶"}', F, "键和值写反了：键是 15，值才是“奶茶”。用“奶茶”去查，字典里没有这个键，报 KeyError。", fixed=Q1C),
        opt('menu = {"奶茶" = 15}', F, "字典里键和值之间用冒号，不用等号，这样写会报 SyntaxError（写法不符合语法）。", fixed=Q1D),
    ], code=Q1_CODE, checks=[], expected="15", tip="按名字查东西，用字典：{键: 值}。"),
    pred(SHOW, Q2, [
        (Q2_OUT, T, "for name in order 走的是订单：奶茶、果茶、奶茶，一杯一轮，每轮到菜单里查这一杯的单价。奶茶点了两杯，就显示两次。"),
        ("奶茶 15\n果茶 12", F, "这是循环走菜单的结果。这里循环的是 order（订单），订单里有 3 杯，奶茶出现两次，就显示两次。"),
        ("奶茶\n果茶\n奶茶", F, "print(name, menu[name]) 显示两样：名字和查到的单价，每行都有价格。"),
        ("报错", F, "不会报错：name 每轮是订单里的一个饮品名，用变量当键查字典是可以的；三杯都在菜单里。")],
        tip="循环走的是谁，就一个一个看谁：这里是订单，每杯一轮。"),
    {**fill("屏幕要显示合计：42", Q3_CODE,
        ["menu[name]", 'menu["奶茶"]', "name", "order[name]"], ["menu[name]"], "42",
        {'menu["奶茶"]': "每轮都查奶茶，3 杯都按 15 算，得 45。要查的是这一轮的饮品 name。",
         "name": "name 是饮品名（文字），total 是整数，整数加文字会报 TypeError。要加的是查出来的单价。",
         "order[name]": "order 是列表，要用位置号查，不能用名字，会报 TypeError。单价在菜单字典里：menu[name]。"},
        "每一轮，把这一杯的单价加进 total：单价要到菜单里查。")},
    order("排好顺序，算两杯奶茶的合计。屏幕显示：30", Q4_LINES, [5, 3, 1, 4, 0, 2], Q4_ANS, "30",
          "菜单、订单、total = 0 都要在循环前面；累加缩进在 for 里；合计在循环外显示一次。"),
  ]},
 {"id": "U9L2", "title": "把合计写成函数", "concept": "def bill(order, menu)：函数里循环累加，return 放在循环外",
  "story": "算合计这段以后到处要用，写成函数 bill(order, menu)：把订单和菜单传进去，函数里循环累加，算完用 return 交回合计。return 要等每一杯都加完才执行，所以它和 for 对齐，不缩进在循环里。",
  "introCode": L2_INTRO,
  "exercises": [
    pred(SHOW, Q5, [
        ("42", T, "订单 3 杯：15 + 12 + 15 = 42。循环全部走完，才到和 for 对齐的 return total，交回 42。"),
        ("15", F, "15 只是第一杯。return total 和 for 对齐，不在循环里，要等 3 杯都加完才执行。"),
        ("0", F, "total 从 0 开始，循环里每杯都加上单价，最后交回的是加完的 42。"),
        ("None", F, "函数最后有 return total，会交回合计；没有 return 才是 None。")],
        tip="看 return 的缩进：和 for 对齐，就是循环走完以后才交回。"),
    pred("这是 AI 写的 bill，和上一题只差一处：return total 多缩进了一层，进了循环。屏幕上会显示什么？", Q6, [
        ("15", T, "return total 缩进在 for 里面：第一轮加上奶茶 15，马上执行 return，这次调用就结束了，后面两杯没算。"),
        ("42", F, "缩进决定了 return 在循环里：第一轮就 return，交回 15，后面两杯根本没走到。"),
        ("0", F, "第一轮先加上 15，然后才 return，交回的是 15。"),
        ("None", F, "第一轮就遇到了 return total，交回 15；没有遇到 return 才是 None。")],
        tip="return 一执行，这次调用就结束。看它在不在循环里。"),
    {**fill("屏幕要显示：42（bill 的最后一行该怎么写）", Q7_CODE,
        ["return total", "print(total)", "return name", "total"], ["return total"], "42",
        {"print(total)": "函数里先显示了 42，但没有交回，bill(...) 得到 None，外面的 print 又显示 None：屏幕是 42 和 None 两行。",
         "return name": "交回的是最后一杯的名字“奶茶”，不是合计。",
         "total": "只写 total 什么也不做，函数走完没遇到 return，交回 None，屏幕显示 None。"},
        "要把合计交回给调用的地方：用 return。")},
    pick("屏幕要显示 42，现在最后一行报了 NameError: name 'total' is not defined。怎么改，屏幕才会显示 42？", "fix", [
        opt("把最后两行改成 print(bill(order, menu))", T, "total 是 bill 里面的名字，函数外面用不了。bill 已经把合计 return 回来了，直接 print 它交回的值就是 42。", fixed=Q8_FIX_A),
        opt("在最后一行前加 total = 0", F, "不报错了，但这是函数外面新建的另一个 total，是 0，显示 0。bill 交回的 42 没人接，丢掉了。", fixed=Q8_FIX_B),
        opt("把 bill 里的 return total 改成 print(total)", F, "函数里会先显示 42，可是最后一行的 print(total) 还在函数外面用 total，仍然报 NameError。", fixed=Q8_FIX_C),
        opt("把最后两行改成 print(bill)", F, "bill 不带括号只是提到函数名，没有调用，显示的是 <function bill at …> 这样的一串，不是合计。", fixed=Q8_FIX_D),
    ], code=Q8, trace=trace_of(Q8), expected="42", tip="函数里的名字，外面用不了；要用函数交回的值，就接住它。"),
  ]},
 {"id": "U9L3", "title": "加一条规则：满 30 减 5", "concept": "再写一个小函数 discount(t)，组合调用；边界 >=",
  "story": "店里加了优惠：满 30 元减 5 元，正好 30 也减。不去改 bill，再写一个小函数 discount(t)，只管优惠：满了在 if 里交回减后的钱，不满就交回原价。一个函数只做一件事，出错时好找。",
  "introCode": L3_INTRO,
  "exercises": [
    pred(SHOW, Q9, [
        ("27\n25\n37", T, "27 不满 30，走到最后的 return t，交回 27；30 正好满 30，t >= 30 成立，交回 25；42 满 30，交回 37。"),
        ("27\n30\n37", F, ">= 是“大于或等于”，30 等于 30，条件成立，要减 5，交回 25。显示 30 是写成 > 的结果。"),
        ("22\n25\n37", F, "27 不满 30，if 不成立，不减，走到最后的 return t，交回 27。"),
        ("27\n25\n42", F, "42 满 30，在 if 里 return t - 5，交回 37。")],
        tip="每次调用看 t 满不满 30：满了在 if 里交回，不满走到最后的 return。"),
    pick("AI 把条件写成了 if t > 30:。规则是满 30 减 5，正好 30 也减。用哪个合计调用 discount，能看出它和规则不一致？", "fix", [
        opt("discount(30)", T, "规则：30 要减成 25；AI 写的 > 30 不认 30，交回 30。正好卡在分界线上的这一个，才测得出来。", fixed=q10_harness(30)),
        opt("discount(29)", F, "29 不满 30：规则不减，AI 的程序也不减，都是 29，一致。", fixed=q10_harness(29)),
        opt("discount(42)", F, "42 超过 30：规则和程序都减 5，都是 37，一致。比 30 大的数，> 和 >= 结果一样。", fixed=q10_harness(42)),
        opt("discount(15)", F, "15 不满 30：都不减，都是 15，一致。", fixed=q10_harness(15)),
    ], code=DISC_GT, checks=[], expected="不一致", tip="好的测试，是让程序给的和规则要的不一样的那个。试试正好在分界线上的数。"),
    {**fill("屏幕要依次显示 25、29、37（满 30 减 5，正好 30 也减）", Q11_CODE,
        [">=", ">", "==", "<="], [">="], "25\n29\n37",
        {">": "30 > 30 不成立，30 不减，第一行显示 30。正好 30 也要减，要用 >=。",
         "==": "只有正好 30 才减，42 也满 30 却不减，第三行显示 42。",
         "<=": "方向反了：不到 30 的反而减了（29 变 24），42 不减。"},
        "满 30 = 大于或等于 30。")},
    pred("AI 写的 discount 少了一行。屏幕上会显示什么？", Q12, [
        ("37\nNone", T, "42 满 30，在 if 里交回 37。24 不满 30，if 不成立，函数就走完了，没有遇到 return，交回 None（什么都没有）。少的是最后那行 return t。"),
        ("37\n24", F, "24 不满 30 时没有任何 return 会执行：函数里只有 if 里那一个 return，交回的是 None，不是 24。"),
        ("37\n19", F, "24 不满 30，if 里的 t - 5 不会执行。"),
        ("37\n报错", F, "没有 return 不会报错，只是交回 None；print(None) 显示 None。")],
        tip="每种情况都要有 return：不满 30 时，函数从哪一行交回？"),
  ]},
 {"id": "U9L4", "title": "菜单里没有的饮品", "concept": "先用 in 检查；没有就提示并跳过，继续算后面的",
  "story": "顾客点了菜单上没有的咖啡，menu[\"咖啡\"] 会报 KeyError，整张小票都算不出来。在循环里先问一句 if name in menu：有就加上单价，没有就显示“没有 咖啡”，然后接着算下一杯。",
  "introCode": L4_INTRO,
  "exercises": [
    pick("订单里有一杯咖啡，运行报了 KeyError: '咖啡'。出错的是哪一行？", "line", [
        opt("total += menu[name]", T, "报错最后一处指向第 4 行，在 bill 里面：这一轮 name 是咖啡，菜单字典里没有这个键，查不到就报 KeyError。", ),
        opt("print(bill(order, menu))", F, "这一行是调用 bill 的地方，报错从这里进了函数；真正出错的是函数里查菜单的第 4 行。报错信息里最下面那一处，才是出错的那一行。"),
        opt("for name in order:", F, "循环本身没问题，第一轮奶茶已经加上了；第二轮查咖啡时才出错。"),
        opt('order = ["奶茶", "咖啡"]', F, "订单里写什么都可以，列表本身不会报错；是拿“咖啡”去查菜单时才出错。"),
    ], code=Q13, trace=trace_of(Q13), tip="报错里有好几处位置时，最下面那一处才是真正出错的行。"),
    {**fill("屏幕要显示两行：没有 咖啡、27", Q14_CODE,
        ["in", "not in", "==", "!="], ["in"], "没有 咖啡\n27",
        {"not in": "条件反了：奶茶在菜单里却走了 else，显示“没有 奶茶”；咖啡不在菜单里却去查 menu[\"咖啡\"]，报 KeyError。",
         "==": "name == menu 是拿饮品名和整个字典比，永远不相等，三杯都显示“没有”，合计是 0。",
         "!=": "饮品名和整个字典永远不相等，条件总成立，查到咖啡时报 KeyError。"},
        "有，才去菜单里查单价：name 在不在 menu 里。")},
    pred(SHOW, Q15, [
        ("没有 咖啡\n合计 15", T, "第一轮奶茶在菜单里，加上 15；第二轮咖啡不在菜单里，走 else，显示“没有 咖啡”；循环走完，最后显示合计 15。"),
        ("合计 15\n没有 咖啡", F, "程序从上往下运行：“没有 咖啡”是在循环里显示的，合计在循环结束后才显示。"),
        ("没有 咖啡\n合计 0", F, "没有的只是咖啡；奶茶在菜单里，照常加上了 15。"),
        ("报错", F, "咖啡在 if name in menu 这里就被拦下了，走 else，不会去查 menu[\"咖啡\"]，不会报错。")],
        tip="一轮一轮看：这一杯在不在菜单里？在就加，不在就提示。"),
    pick("规则：没有的饮品跳过，后面的照常算，屏幕要显示“没有 咖啡”和 27。AI 写的程序却显示“没有 咖啡”和 15。怎么改？", "fix", [
        opt("删掉 else 里的 break", T, "break 让整个循环在遇到咖啡时就停了，后面的果茶没算。“跳过”只是这一杯不加，下一轮照常走。删掉 break，合计 27。", fixed=Q16_FIX_A),
        opt("在 break 前面加一行 total = 0", F, "还是在咖啡这里停下循环，而且把合计清零，显示“没有 咖啡”和 0。", fixed=Q16_FIX_B),
        opt('删掉 else 里的 print("没有", name)', F, "提示没了，break 还在：遇到咖啡就停，显示 15。", fixed=Q16_FIX_C),
        opt("把最后的 print(total) 缩进到循环里", F, "合计变成每轮都显示，而且 break 还在：先显示 15，再显示“没有 咖啡”，循环就停了。", fixed=Q16_FIX_D),
    ], code=Q16, checks=[], expected="没有 咖啡\n27", tip="“跳过这一杯”不是“停下整个循环”。看看是哪一行让循环提前停了。"),
  ]},
 {"id": "U9L5", "title": "拼成一张小票", "concept": "主程序按顺序调用：先算，再显示；函数不会改外面的变量",
  "story": "小票要显示合计和应付。函数都先定义好，下面的主程序按顺序做：先算出合计 t，再显示合计，最后显示 discount(t) 交回的应付金额。顺序很重要：用到 t 之前，t 要先有值。",
  "introCode": L5_INTRO,
  "exercises": [
    order("排好顺序：每杯显示名字和单价，最后显示合计。屏幕显示：\n奶茶 15\n奶茶 15\n合计 30", Q17_LINES, [6, 4, 2, 0, 5, 1, 3], Q17_ANS, Q17_EXP,
          "菜单、订单、t = 0 在循环前；循环里两行都缩进（显示这一杯、加进合计）；合计在循环外显示一次。"),
    pred(SHOW, Q18, [
        ("合计 42\n应付 37", T, "t = sum(prices) 得 42，先显示合计 42；discount(t) 交回 37，再显示应付 37。discount 里算出的 37 是交回来的值，t 本身还是 42。"),
        ("合计 37\n应付 37", F, "合计在调用 discount 之前就显示了，而且函数不会改外面的 t：t 一直是 42。"),
        ("合计 42\n应付 42", F, "42 满 30，discount 在 if 里交回 42 - 5 = 37。"),
        ("应付 37\n合计 42", F, "程序从上往下一行一行运行：先显示合计，再显示应付。")],
        tip="函数交回一个新值，不会改掉你传进去的那个变量。"),
    pick("把小票的两行顺序弄乱了，运行报了 NameError: name 't' is not defined。出错的是哪一行？", "line", [
        opt('print("应付", discount(t))', T, "这一行用到了 t，可是 t = sum(prices) 写在它下面，还没运行，t 还没有值。先算 t，再用 t。"),
        opt("t = sum(prices)", F, "这一行没有问题，只是放晚了：程序在上一行用 t 时就停下了，还没走到这里。"),
        opt('print("合计", t)', F, "程序在前面就报错停下了，这一行没有运行到。"),
        opt("prices = [15, 12, 15]", F, "列表本身没问题，第 5 行正常运行了。"),
    ], code=Q19, trace=trace_of(Q19), tip="报错的那一行用到了谁？它在那之前有没有值？"),
    {**fill("屏幕要显示：应付 27（合计 27，不满 30 不减）", Q20_CODE,
        ["discount(t)", "t - 5", "discount", "discount(30)"], ["discount(t)"], "应付 27",
        {"t - 5": "不管满不满都减 5，显示应付 22；27 不满 30 不该减。规则已经写在 discount 里，调用它就行。",
         "discount": "只写函数名不带括号，没有调用，显示的是 <function discount at …> 这样的一串。",
         "discount(30)": "传进去的是规则里的 30，不是这张小票的合计，显示应付 25。要传合计 t。"},
        "要用优惠规则算应付：调用 discount，把合计 t 传进去。")},
  ]},
 {"id": "U9L6", "title": "项目：检查 AI 写的小票", "concept": "先读懂、再找能暴露错误的订单、选修复、修完再试",
  "story": "AI 交来一版 bill，看着挺像样，也没有报错。别急着用：先读懂它算出什么，再找一张能让它露馅的订单，然后判断怎么改，最后用那张订单再试一次。没报错不等于算对了。",
  "introCode": Q21,
  "exercises": [
    pred("AI 写的 bill，订单是奶茶和果茶。屏幕上会显示什么？", Q21, [
        ("12", T, "total = 0 写在循环里面：每一轮都先清零再加。第一轮 0 + 15，第二轮又清零，0 + 12，最后交回 12，只剩最后一杯。"),
        ("27", F, "每一轮开头都执行 total = 0，前面加的被清掉了。正确的合计应该是 27，这正是它的问题。"),
        ("15", F, "15 是第一杯；第二轮先把 total 清零，再加上果茶 12。"),
        ("0", F, "清零之后紧接着加上了这一杯的单价，最后一轮剩下 12。")],
        tip="一行一行追 total：每一轮开头它会变成多少？"),
    pick("规则：合计是订单里每一杯单价相加。用哪张订单测试，能看出 AI 的 bill 和规则不一致？", "fix", [
        opt('["奶茶", "奶茶"]', T, "规则要 30；AI 的 bill 每轮清零，只剩最后一杯，交回 15。至少两杯，前面的被清掉才看得出来。", fixed=q22_harness(["奶茶", "奶茶"])),
        opt('["奶茶"]', F, "只有一杯时，清零再加正好就是这一杯：规则 15，程序也 15，一致，测不出来。", fixed=q22_harness(["奶茶"])),
        opt('["果茶"]', F, "也只有一杯：规则 12，程序也 12，一致。", fixed=q22_harness(["果茶"])),
    ], code=BILL_RESET, checks=[], expected="不一致", tip="只点一杯的订单，看不出“前面加的被清掉”。"),
    pick("怎么改，bill 对各种订单都算对？（拿一杯、两杯、三杯的订单都核对过）", "fix", [
        opt("把 total = 0 挪到 for 上面", T, "清零只在开始时做一次：先 total = 0，再循环把每一杯加进去，最后交回。一杯、两杯、三杯都对。", fixed=q23_harness(FIX_MOVE)),
        opt("把 total += menu[name] 改成 total = total + menu[name]", F, "两种写法意思一样，total = 0 还在循环里，每轮照样清零，两杯以上还是错。", fixed=q23_harness(FIX_PLUS)),
        opt("删掉 total = 0", F, "函数里的 total 还没有初始值就被拿来计算，因此报 UnboundLocalError。", fixed=q23_harness(FIX_DEL)),
        opt("把 return total 也缩进到循环里", F, "第一轮就交回了，只算第一杯；两杯以上还是错。", fixed=q23_harness(FIX_RET)),
    ], code=BILL_RESET, checks=[], expected="全部一致", tip="清零应该做几次？放在循环里面，就是每杯一次。"),
    pred("修好之后，再用刚才露馅的订单（两杯奶茶）跑一遍，并算上优惠。屏幕上会显示什么？", Q24, [
        ("25", T, "bill 现在把两杯都加上：15 + 15 = 30；30 满 30，discount 交回 25。修完用露馅的那张订单再试一次，确认真的修好了。"),
        ("30", F, "t 是 30，还要过 discount：30 正好满 30，减 5，是 25。"),
        ("15", F, "15 是修之前的结果（每轮清零，只剩一杯）。total = 0 已经挪到循环外面，两杯都算上了。"),
        ("10", F, "discount 只在满 30 时减 5，不会把两杯各减 5。")],
        tip="先算 t = bill(...)，再把 t 传给 discount。"),
  ]},
]

for l in lessons:
    assert len(l["story"]) <= 140, (l["id"], len(l["story"]))
    assert len(l["exercises"]) == 4, l["id"]
unit = {"id": "U9", "title": "小项目：点单小票", "subtitle": "字典、列表、循环、函数合起来用", "lessons": lessons}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit9.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons), "讲解字数", [len(l["story"]) for l in lessons])
