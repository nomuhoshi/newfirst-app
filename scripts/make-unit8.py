# 生成 content/unit8.json（第 8 单元「函数」草稿：U8L1 定义与调用、U8L2 一个参数、U8L3 返回结果、U8L4 组合调用、U8L5 两个参数和默认值、U8L6 作用域；U8L7 价格计算器项目是 held，等代码题运行器）。
# 草稿（产品官 2026-11-05 15:21 任务）：L1 分清“定义函数”和“执行函数”，L2 一个参数（传入不同的值，结果不同）。return 留到 L3。
# 只出现在 content/unit8.json，还没挂进 content/course.json（U8 仍是“即将推出”占位），app 读不到。
# 内容在这里改，再运行：python3 scripts/make-unit8.py && python3 scripts/verify-content.py --extra content/unit8.json
# 只用已学语法（U1–U7：print、变量、运算、字符串、比较、if、for/while、列表、字典、读报错，其中 U6 学过 NameError / TypeError / IndentationError），
# 加上本单元新教的：
#   U8L1 def 名字():、缩进的函数体、调用 名字()（括号不能省）、先定义后调用、调用几次就执行几次；
#   U8L2 一个参数：def 名字(参数):、调用时传入值、函数体里用参数、传入不同的值得到不同的结果、传入变量里的值、漏传值报 TypeError。
# 口径（产品官 15:39）：L2 只说“本关 pay(price) 定义了一个必填参数，调用时漏传会报 TypeError”，不概括成“函数的参数都必须传”（以后教默认参数时不用推翻）。
# 本部分（L1–L2）不用：return（L3 才教）、多个参数、默认参数、作用域（函数里外的同名变量）、函数里改列表 / 字典、递归、f-string、函数调用函数。
# 函数体里只用 print 显示；这样“定义不执行、调用才执行”能直接在屏幕上看出来。
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

# ---------------- U8L1：定义和调用 ----------------
D_WELCOME = 'def welcome():\n    print("欢迎光临")'
L1_INTRO = D_WELCOME + '\nwelcome()\nwelcome()'
Q1 = D_WELCOME + '\nprint("开店了")'
Q2 = D_WELCOME + '\nwelcome()\nprint("请点单")\nwelcome()'
Q3_CODE = D_WELCOME + '\n{0}'
def q3_prog(tok): return Q3_CODE.replace("{0}", tok)
Q1B = D_WELCOME + '\nwelcome\nwelcome()'        # 第 3 行只写名字（不调用），第 4 行才调用
Q4 = 'welcome()\ndef welcome():\n    print("欢迎光临")'

assert real_out(L1_INTRO) == "欢迎光临\n欢迎光临"
assert real_out(Q1B) == "欢迎光临"                                 # 只写名字：不运行、不报错；只有 welcome() 调用一次
assert run(Q1B)[1] is None
assert real_out(D_WELCOME + '\nwelcome()\nwelcome()') == "欢迎光临\n欢迎光临"
assert real_out(D_WELCOME + '\nwelcome()\nwelcome()\nwelcome()') == "欢迎光临\n欢迎光临\n欢迎光临"
assert Q1B.split("\n")[2] == "welcome" and Q1B.split("\n")[3] == "welcome()"   # 解释里的“第 3 行 / 第 4 行”
assert real_out(Q1) == "开店了"                                   # 只定义、没调用：函数体一次都没运行
assert real_out(Q2) == "欢迎光临\n请点单\n欢迎光临"
assert real_out(D_WELCOME) == ""                                  # 光是 def：什么都不显示
assert Q2.split("\n")[2] == "welcome()" and Q2.split("\n")[4] == "welcome()"   # 解释里的“第 3 行 / 第 5 行”
assert Q1.split("\n")[2] == 'print("开店了")'                     # 解释里的“第 3 行”
# 干扰项里的输出（解释里写到的）都是真实运行得到的
assert real_out(D_WELCOME + '\nwelcome()\nprint("请点单")') == "欢迎光临\n请点单"                    # 只调用一次
assert real_out(D_WELCOME + '\nwelcome()\nwelcome()\nprint("请点单")') == "欢迎光临\n欢迎光临\n请点单"      # 两次调用挨在一起
# 填空题的每个词块：真实结果
assert real_out(q3_prog("welcome()")) == "欢迎光临"
assert real_out(q3_prog("welcome")) == ""                         # 只写名字：不运行，也不报错
assert run(q3_prog("def welcome():"))[1] == "IndentationError"    # 又写了一个 def，后面没有函数体
assert run(q3_prog("Welcome()"))[1] == "NameError"                # 大小写不同 = 另一个名字
# 读报错：先调用、后定义 → 第 1 行就停了
r4 = real_error(Q4)
assert (r4["type"], r4["line"], r4["code_line"], r4["msg"]) == ("NameError", 1, "welcome()", "name 'welcome' is not defined")
assert r4["stdout"] == ""                                          # 报错之前什么都没显示
# 对照：先定义、后调用 就正常
assert real_out('def welcome():\n    print("欢迎光临")\nwelcome()') == "欢迎光临"

# ---------------- U8L2：一个参数 ----------------
D_SAY = 'def say(drink):\n    print("来一杯", drink)'
L2_INTRO = D_SAY + '\nsay("奶茶")\nsay("果茶")'
Q5 = D_SAY + '\nsay("咖啡")\nsay("果茶")'
D_PAY = 'def pay(price):\n    print("应付", price * 2)'
Q6 = D_PAY + '\ntea = 8\npay(tea)\ntea = 5\npay(tea)'
Q7_CODE = 'def pay({0}):\n    print("应付", price * 2)\npay(10)'
def q7_prog(tok): return Q7_CODE.replace("{0}", tok)
Q8 = D_PAY + '\npay()'
Q8X = D_PAY + '\npay(10, 2)'
Q8X_FIX_A = D_PAY + '\npay(10)'
Q8X_FIX_B = D_PAY + '\npay()'
Q8X_FIX_C = D_PAY + '\npay(2)'
Q8X_FIX_D = 'def pay():\n    print("应付", price * 2)\npay(10, 2)'      # 传多了：pay 只有 1 个参数，却给了 2 个值

r8x = real_error(Q8X)
assert (r8x["type"], r8x["line"], r8x["code_line"], r8x["msg"], r8x["stdout"]) == ("TypeError", 3, "pay(10, 2)", "pay() takes 1 positional argument but 2 were given", "")
assert real_error(Q8)["msg"] == "pay() missing 1 required positional argument: 'price'"     # 对照：传少了
assert real_out(D_PAY + "\npay(10)") == "应付 20"
assert run(Q8X_FIX_A) == ("应付 20", None) and run(Q8X_FIX_C) == ("应付 4", None)
assert real_error(Q8X_FIX_B)["msg"] == "pay() missing 1 required positional argument: 'price'"
assert real_error(Q8X_FIX_D)["msg"] == "pay() takes 0 positional arguments but 2 were given"
assert run(D_PAY + "\npay(10, 2")[1] == "SyntaxError"                                      # 括号没写完
assert real_error(D_PAY + "\npay(a, b)")["type"] == "NameError"                              # 传的是没定义的名字
assert real_out(L2_INTRO) == "来一杯 奶茶\n来一杯 果茶"
assert real_out(Q5) == "来一杯 咖啡\n来一杯 果茶"
assert real_out(D_SAY + '\nsay("咖啡")\nsay("咖啡")') == "来一杯 咖啡\n来一杯 咖啡"
assert real_out(D_SAY + '\nsay("果茶")\nsay("咖啡")') == "来一杯 果茶\n来一杯 咖啡"
assert real_out('def say(drink):\n    print("来一杯", "drink")\nsay("咖啡")\nsay("果茶")') == "来一杯 drink\n来一杯 drink"   # 加了引号才会显示单词 drink
assert real_out(Q6) == "应付 16\n应付 10"
assert real_out(D_PAY + '\ntea = 8\npay(tea)\ntea = 5\npay(tea)') == "应付 16\n应付 10"
assert real_out(D_PAY + '\npay(8)\npay(8)') == "应付 16\n应付 16"                                    # 把第二次也当成 8
assert real_out('def pay(price):\n    print("应付", price)\ntea = 8\npay(tea)\ntea = 5\npay(tea)') == "应付 8\n应付 5"   # 没乘 2
assert real_out(D_PAY + '\ntea = 5\npay(tea)\npay(tea)') == "应付 10\n应付 10"                       # 两次都用最后的 5
assert Q6.split("\n")[3] == "pay(tea)" and Q6.split("\n")[5] == "pay(tea)"
assert real_out(q7_prog("price")) == "应付 20"
assert run(q7_prog("cups")) == ("", "NameError")                  # 参数叫 cups，函数体里却用 price
assert run(q7_prog("10")) == ("", "SyntaxError")                  # 括号里只能写名字，不能写具体的值
assert run(q7_prog('"price"')) == ("", "SyntaxError")             # 名字不能带引号
r8 = real_error(Q8)
assert (r8["type"], r8["line"], r8["code_line"]) == ("TypeError", 3, "pay()") and r8["msg"] == "pay() missing 1 required positional argument: 'price'"
assert r8["stdout"] == ""
# 读报错题的干扰项里提到的另外三种错误也都是真的
assert real_error('pay(10)\ndef pay(price):\n    print("应付", price * 2)')["type"] == "NameError"
assert run('def pay(price)\n    print("应付", price * 2)\npay(10)')[1] == "SyntaxError"             # 少冒号
assert run('def pay(price):\nprint("应付", price * 2)\npay(10)')[1] == "IndentationError"         # 函数体没缩进
assert real_out(D_PAY + '\npay(10)') == "应付 20"                                                   # 对照：传了值就正常

lessons = [
 {"id": "U8L1", "title": "定义和调用", "concept": "def、函数体、调用 welcome()",
  "story": "奶茶店每次开门都要说“欢迎光临”。用 def 给这段程序起个名字：def welcome(): 下面缩进的几行是函数体。def 只是记下做法，这时函数体不会运行。名字后面带括号 welcome() 才是调用：调用一次，函数体运行一次。要先定义，后调用。",
  "introCode": L1_INTRO,
  "exercises": [
    pred(SHOW, Q1B, [
        ("欢迎光临", T, "第 3 行只写了 welcome，没有括号，只是提到这个名字，没有调用，函数体不会运行（也不会报错）。第 4 行 welcome() 带括号才是调用，函数体运行一次，所以只显示一次“欢迎光临”。"),
        ("欢迎光临\n欢迎光临", F, "只写名字 welcome 不算调用。调用要带括号：这段程序只有第 4 行 welcome() 一次调用，欢迎光临只显示一次。"),
        ("报错", F, "只写名字不会报错：welcome 在第 1 行已经定义过，提到它没有问题，只是不会运行函数体。用到没有定义的名字才会报 NameError。"),
        ("什么都不显示", F, "第 4 行 welcome() 带着括号，是调用，函数体会运行，显示“欢迎光临”。只写名字的是第 3 行，那一行什么都不做。")],
        tip="名字后面带括号才是调用：welcome 只是提到名字，welcome() 才让它运行。"),
    pred(SHOW, Q2, [
        ("欢迎光临\n请点单\n欢迎光临", T, "函数在被调用的那一行运行：第 3 行调用 → 欢迎光临；第 4 行 → 请点单；第 5 行再调用一次 → 再显示一次欢迎光临。调用几次，函数体就运行几次。"),
        ("欢迎光临\n请点单", F, "第 5 行又调用了一次 welcome()，函数体会再运行一遍，所以欢迎光临显示两次。"),
        ("欢迎光临\n欢迎光临\n请点单", F, "程序按顺序一行一行运行：第 3 行调用（欢迎光临），第 4 行 print（请点单），第 5 行再调用（欢迎光临）。两次调用之间夹着“请点单”。"),
        ("欢迎光临\n欢迎光临\n欢迎光临\n请点单", F, "def 那一行不会运行函数体，不算调用。这段程序只有第 3、5 行两次调用，欢迎光临只显示两次。")],
        tip="一行一行往下走：碰到 welcome() 就把函数体运行一遍。"),
    {**fill("屏幕要显示：欢迎光临", Q3_CODE,
        ["welcome()", "welcome", "def welcome():", "Welcome()"], ["welcome()"], "欢迎光临",
        {"welcome": "只写名字、不带括号，只是提到了这个函数，没有调用它，函数体不会运行，屏幕上什么都不显示（也不会报错）。调用要带括号。",
         "def welcome():": "def 是“定义”，不是“调用”。而且 def 后面必须有缩进的函数体，这里没有，会报 IndentationError（缩进错误：def 后面缺少缩进的内容）。",
         "Welcome()": "大小写不同，Python 当成另一个名字。Welcome 没有定义过，会报 NameError（用到了没有定义的名字）。"},
        "函数已经定义好了，现在要让它运行：名字加括号。")},
    pick("调用写在了定义的前面，运行报了错。最后一行说 NameError: name 'welcome' is not defined（welcome 这个名字还没有定义）。出错的是哪一行？", "line", [
        opt("welcome()", T, "程序从上往下运行。到第 1 行调用 welcome() 时，下面的 def 还没有运行过，Python 还不知道 welcome 是什么，就在这一行报错了。先定义，后调用。"),
        opt("def welcome():", F, "def 这一行本身没有问题。它只是在调用的后面，程序还没有走到那里，就已经在第 1 行出错停下来了。"),
        opt("print(\"欢迎光临\")", F, "函数体一次都没有运行。程序在第 1 行就停了，根本没有走到这一行。"),
    ], code=Q4, trace=trace_of(Q4), tip="报错时程序就停在出错的那一行；看看那一行用到的名字，之前有没有被定义过。"),
  ]},
 {"id": "U8L2", "title": "给函数一个参数", "concept": "参数、传入值",
  "story": "想让同一个函数按不同的饮品工作，就给它留一个空位：def say(drink): 括号里的 drink 叫参数，在函数体里像变量一样用。调用 say(\"奶茶\") 时，括号里的值传进空位，drink 就是 \"奶茶\"；每次调用都重新传值。本关的函数都只有一个参数，调用时就传一个值。",
  "introCode": L2_INTRO,
  "exercises": [
    pred(SHOW, Q5, [
        ("来一杯 咖啡\n来一杯 果茶", T, "调用时，Python 先算出括号里的值，再把这个值传给参数。第 3 行调用 say(\"咖啡\")，咖啡传给 drink，显示“来一杯 咖啡”；第 4 行再调用 say(\"果茶\")，这次 drink 是果茶，显示“来一杯 果茶”。"),
        ("来一杯 drink\n来一杯 drink", F, "print 里的 drink 没有引号，是参数这个变量，显示的是传进来的值（咖啡、果茶），不是单词 drink。"),
        ("来一杯 咖啡\n来一杯 咖啡", F, "每次调用都会重新传值。第 4 行传的是果茶，drink 这次就是果茶。"),
        ("来一杯 果茶\n来一杯 咖啡", F, "程序按顺序运行：先第 3 行传咖啡，再第 4 行传果茶，所以先显示咖啡。")],
        tip="每次调用，括号里的值传给参数；函数体里的 drink 就是这一次传进来的值。"),
    {**fill("屏幕要显示：应付 20", Q7_CODE,
        ["price", "cups", "10", "\"price\""], ["price"], "应付 20",
        {"cups": "参数起名叫 cups，但函数体里用的是 price。price 没有定义过，调用时会报 NameError（用到了没有定义的名字）。参数的名字要和函数体里用的一致。",
         "10": "def 的括号里要写一个名字（空位的名字），不能直接写具体的值 10，会报 SyntaxError（写法不符合语法）。值要在调用的时候传，pay(10)。",
         "\"price\"": "括号里写的是名字，不是文字，不能加引号，会报 SyntaxError（写法不符合语法）。"},
        "def 括号里要写一个名字，函数体里用到的就是这个名字。")},
    pick("忘了给 pay 传值，运行报了错。最后一行 TypeError: pay() missing 1 required positional argument: 'price' 是在说什么？", "type", [
        opt("调用 pay() 时括号里没给值，必填参数 price 没有收到", T, "本关的 pay(price) 定义了一个必填参数 price，调用时必须传一个值进去。第 3 行 pay() 括号里是空的，漏传了，所以 Python 说“少了 1 个必须给的参数 'price'”。", value="TypeError"),
        opt("pay 这个名字还没有定义", F, "那是 NameError。pay 在第 1 行已经 def 过了；这里报的是 TypeError，说的是调用时少了一个值。", value="NameError"),
        opt("def 那一行少了冒号", F, "少冒号是 SyntaxError，程序一行都不会运行。这里 def 写得没问题，函数体都定义好了，是第 3 行调用时才出的错。", value="SyntaxError"),
        opt("函数体没有缩进", F, "那是 IndentationError。这里函数体的缩进是对的；最后一行写的是 TypeError，说的是调用时少了一个值。", value="IndentationError"),
    ], code=Q8, trace=trace_of(Q8), tip="missing 1 required argument：少了 1 个必须给的值（必填参数）。看看调用那一行括号里有没有东西。"),
    pick("单价 10 元，屏幕要显示 应付 20。现在运行报了错，最后一行是 TypeError: pay() takes 1 positional argument but 2 were given。怎么改，屏幕才会显示 应付 20？", "fix", [
        opt("把第 3 行改成 pay(10)", T, "报错说 pay 只收 1 个值，却给了 2 个：值传多了。pay(price) 只有一个参数，传单价 10 就够了，10 × 2 = 20。", fixed=Q8X_FIX_A),
        opt("把第 3 行改成 pay()", F, "方向反了：报错说的是给多了，这样改成了一个都不给，会报另一种 TypeError：missing 1 required positional argument（少了 1 个必须给的值）。", fixed=Q8X_FIX_B),
        opt("把第 3 行改成 pay(2)", F, "不报错了，但传进去的单价是 2，2 × 2 = 4，显示 应付 4。要留下的是单价 10。", fixed=Q8X_FIX_C),
        opt("把第 1 行改成 def pay():", F, "参数一个都没有了，调用时却还给了 2 个值，仍然是 TypeError（takes 0 positional arguments but 2 were given）；而且函数体还在用 price。", fixed=Q8X_FIX_D),
    ], code=Q8X, trace=trace_of(Q8X), expected="应付 20", tip="takes 1 … but 2 were given：只收 1 个，却给了 2 个。数一数括号里的值和 def 里的参数。"),
  ]},
]

# ---------------- U8L3：返回结果（print 和 return 的区别）----------------
# 产品官 15:39：L3「返回结果」、L4「组合调用」。重点分清函数里的 print 与 return，再练把返回结果存进变量、参与计算。
# 两关的函数都只有一个参数（价格），函数体一行；L3 的 two = “买两杯的价钱”，L4 加 coupon = “减 5 元的优惠券”。
D_SHOW2 = 'def show_two(price):\n    print(price * 2)'
D_TWO = 'def two(price):\n    return price * 2'
D_COUPON = 'def coupon(price):\n    return price - 5'
L3_INTRO = D_TWO + '\ntotal = two(8)\nprint(total)'
Q9 = D_SHOW2 + '\n' + D_TWO + '\nshow_two(8)\ntwo(8)'
Q10 = 'def two(price):\n    return price * 2\n    print("算完了")\ntotal = two(8)\nprint(total)\nprint(total + 1)'
Q11 = 'def say(drink):\n    print("来一杯", drink)\nx = say("奶茶")\nprint(x)'
Q12_CODE = 'def two(price):\n    {0}\nprint(two(10))'
def q12_prog(tok): return Q12_CODE.replace("{0}", tok)

assert real_out(L3_INTRO) == "16"
assert real_out(Q9) == "16"                        # show_two 里的 print 显示了 16；two(8) 交回的 16 没人接，丢掉了，不报错
assert real_out(D_TWO + '\ntwo(8)') == ""          # 单独调用 return 的函数：什么都不显示
assert real_out(Q10) == "16\n17"                                            # return 之后的 print("算完了") 永远不会运行
assert real_out(Q10.replace('    return price * 2\n    print("算完了")', '    print("算完了")\n    return price * 2')) == "算完了\n16\n17"   # 对照：print 在 return 前面才会运行
assert real_out(D_TWO + '\ntotal = two(8)\nprint(total)\nprint(total)') == "16\n16"
assert real_out(D_TWO + '\ntotal = 8\nprint(total)\nprint(total + 1)') == "8\n9"            # 把 8（传进去的值）当成结果
assert Q10.split("\n")[4] == "print(total)" and Q10.split("\n")[5] == "print(total + 1)"
assert Q11.split("\n")[2] == 'x = say("奶茶")' and Q11.split("\n")[3] == "print(x)"   # 解释里的“第 3 行 / 第 4 行”
assert Q10.split("\n")[3] == "total = two(8)" and Q10.split("\n")[2] == '    print("算完了")'   # 解释里的“第 3 行 / 第 4 行”
assert real_out(Q11) == "来一杯 奶茶\nNone"
assert real_out('def say(drink):\n    print("来一杯", drink)\nsay("奶茶")') == "来一杯 奶茶"   # 对照：不接结果、不再 print，只显示一行
assert real_out('def say(drink):\n    return drink\nx = say("奶茶")\nprint(x)') == "奶茶"       # 对照：交回的是 drink，才会是“奶茶”
assert real_out(q12_prog("return price * 2")) == "20"
assert real_out(q12_prog("print(price * 2)")) == "20\nNone"                             # 函数里 print 显示 20，函数执行结束时没有遇到 return，自动返回 None，外面的 print 再显示 None
assert real_out(q12_prog("price * 2")) == "None"                                        # 只算了一下，没有遇到 return：自动返回 None
assert run(q12_prog("show(price * 2)")) == ("", "NameError")                            # show 没有定义过

# ---------------- U8L4：组合调用 ----------------
L4_INTRO = D_TWO + '\n' + D_COUPON + '\ntotal = coupon(two(10))\nprint(total)'
Q13 = D_TWO + '\nprint(two(8) + 3)\nprint(two(8) + two(5))'
Q14 = D_TWO + '\n' + D_COUPON + '\nprint(coupon(two(10)))'
Q15_CODE = D_TWO + '\na = two(8)\nb = two({0})\nprint(a + b)'
def q15_prog(tok): return Q15_CODE.replace("{0}", tok)
Q16 = 'def two(price):\n    print(price * 2)\ntotal = two(8) + 3\nprint(total)'
Q16_FIX_A = 'def two(price):\n    return price * 2\ntotal = two(8) + 3\nprint(total)'
Q16_FIX_B = 'def two(price):\n    print(price * 2)\ntotal = two(8)\nprint(total)'
Q16_FIX_C = 'def two(price):\n    print(price * 2)\ntotal = two(8) + 3'
Q16_FIX_D = 'def two(price):\n    print(price * 2)\ntotal = two(8) + "3"\nprint(total)'

assert real_out(L4_INTRO) == "15"
assert real_out(Q13) == "19\n26"
assert real_out(D_TWO + '\nprint(two(8))\nprint(two(8) + 3)') == "16\n19"
assert real_out(D_TWO + '\nprint(8 + 3)\nprint(8 + 5)') == "11\n13"                      # 没经过函数
assert real_out(D_TWO + '\nprint(two(8) + two(5))') == "26"
assert real_out(Q14) == "15"                                                             # 先 two(10)=20，再 coupon(20)=15
assert real_out(D_TWO + '\n' + D_COUPON + '\nprint(two(coupon(10)))') == "10"            # 顺序反了：先 coupon(10)=5，再 two(5)=10
assert real_out(D_TWO + '\n' + D_COUPON + '\nprint(coupon(10))') == "5"
assert real_out(D_TWO + '\n' + D_COUPON + '\nprint(two(10))') == "20"
assert Q13.split("\n")[2] == "print(two(8) + 3)"                                        # 解释里的“第 3 行”
assert Q15_CODE.split("\n")[3] == "b = two({0})"                                         # 解释里的“第 4 行”
assert real_out(q15_prog("4")) == "24"
assert real_out(q15_prog("8")) == "32" and real_out(q15_prog("a")) == "48"               # a 是 16，two(16) = 32，16 + 32
assert run(q15_prog("b")) == ("", "NameError")                                           # 第 4 行 b 还没有值
r16 = real_error(Q16)
assert (r16["type"], r16["line"], r16["code_line"], r16["msg"], r16["stdout"]) == ("TypeError", 3, "total = two(8) + 3", "unsupported operand type(s) for +: 'NoneType' and 'int'", "16")
assert real_out(Q16_FIX_A) == "19" and real_out(Q16_FIX_B) == "16\nNone"
assert run(Q16_FIX_C) == ("16", "TypeError") and run(Q16_FIX_D) == ("16", "TypeError")
assert real_error(Q16_FIX_C)["msg"] == real_error(Q16)["msg"]                            # 删掉最后一行：还是同一个报错
assert Q16.split("\n")[2] == "total = two(8) + 3"                                        # 解释里的“第 3 行”

lessons += [
 {"id": "U8L3", "title": "返回结果", "concept": "return、print 和 return 的区别、None",
  "story": "函数里的 print 只显示，显示完就没了。想把结果交回给调用的地方，用 return：two(8) 就变成交回的 16，可以存进变量、拿去计算。return 自己不显示；它一执行，这次调用就结束。没遇到 return，交回 None。",
  "introCode": L3_INTRO,
  "exercises": [
    pred(SHOW, Q9, [
        ("16", T, "show_two(8) 里的 print 把 16 显示在屏幕上；two(8) 用的是 return，只是把 16 交回来，这里没有变量接它，也没有 print，16 就丢掉了，不会显示，也不会报错。"),
        ("16\n16", F, "return 不会显示。two(8) 交回的 16 没有被存起来，也没有被 print，屏幕上不会出现。"),
        ("什么都不显示", F, "show_two(8) 里的 print 会运行，在屏幕上显示 16。"),
        ("报错", F, "单独写一行 two(8) 不会报错：它交回 16，没人接，就丢掉了。")],
        tip="print 把东西显示出来；return 把值交回给调用的地方，不显示。"),
    pred(SHOW, Q10, [
        ("16\n17", T, "第 4 行 total = two(8)：函数执行到第 2 行的 return 就结束了，第 3 行 print(\"算完了\") 不会运行；two(8) 交回 16，存进 total。第 5 行显示 16，第 6 行 total + 1 是 17。"),
        ("算完了\n16\n17", F, "第 3 行在 return 后面：函数执行到 return 这次调用就结束了，后面的 print(\"算完了\") 不会运行，不会显示“算完了”。"),
        ("16\n16", F, "第 6 行是 print(total + 1)，要把 1 加上：16 + 1 = 17。"),
        ("8\n9", F, "total 里存的是 two(8) 交回来的结果 16，不是传进去的 8。")],
        tip="return 一执行，这次函数调用就结束，后面的语句不再运行。"),
    pred(SHOW, Q11, [
        ("来一杯 奶茶\nNone", T, "第 3 行调用 say(\"奶茶\")：函数里的 print 显示“来一杯 奶茶”。say 执行结束时没有遇到 return，会自动返回 None，x 得到的就是 None，第 4 行 print(x) 就显示 None。"),
        ("来一杯 奶茶\n来一杯 奶茶", F, "函数里 print 显示出来的文字不会被交回来存进 x。x 得到的是 None（什么都没有），不是那句话。"),
        ("来一杯 奶茶", F, "第 4 行 print(x) 也会运行，会再显示一行：x 里是 None。"),
        ("来一杯 奶茶\n奶茶", F, "say 执行结束时没有遇到 return，自动返回 None，不会把 drink 交回来。x 得到的是 None，不是奶茶。")],
        tip="函数执行结束时没有遇到 return，会自动返回 None。"),
    {**fill("屏幕要显示：20（函数 two 的第二行该怎么写）", Q12_CODE,
        ["return price * 2", "print(price * 2)", "price * 2", "show(price * 2)"], ["return price * 2"], "20",
        {"print(price * 2)": "函数里的 print 先把 20 显示出来，但函数执行结束时没有遇到 return，自动返回 None，外面的 print(two(10)) 就把 None 又显示了一遍：先 20，再 None，不是只显示 20。",
         "price * 2": "只算了一下就丢掉了，函数执行结束时没有遇到 return，自动返回 None，外面的 print(two(10)) 显示的是 None。",
         "show(price * 2)": "show 这个名字没有定义过，Python 找不到它，会报 NameError（用到了没有定义的名字）。要把结果交回去，用 return。"},
        "要把 price * 2 交回给调用它的 print(two(10))：用 return。")},
  ]},
 {"id": "U8L4", "title": "组合调用", "concept": "返回结果参与计算、嵌套调用",
  "story": "return 交回的值和平常的数一样用：存进变量 total = two(8)，参与计算 two(8) + 3，传给另一个函数 coupon(two(10))。套着写先算里面的：two(10) 得 20，再传给 coupon。要继续算的数，用 return。",
  "introCode": L4_INTRO,
  "exercises": [
    pred(SHOW, Q13, [
        ("19\n26", T, "two(8) 交回 16，两个 print 里的 two(…) 都换成它交回来的值：16 + 3 = 19；two(8) 是 16，two(5) 是 10，16 + 10 = 26。"),
        ("11\n13", F, "two(8) 不是 8：函数交回的是 8 × 2 = 16。11、13 是没有经过函数、直接用 8 算出来的。"),
        ("16\n26", F, "第 3 行是 print(two(8) + 3)，要把 3 也加上：16 + 3 = 19。"),
        ("19\n13", F, "two(5) 也要经过函数：5 × 2 = 10，所以是 16 + 10 = 26，不是 8 + 5。")],
        tip="先把每个 two(…) 换成它交回的值，再算加法。"),
    pred(SHOW, Q14, [
        ("15", T, "套着的调用先算里面：two(10) 交回 20，20 再传给 coupon，20 - 5 = 15。"),
        ("10", F, "顺序反了：这是先 coupon(10)（得 5）再 two(5)（得 10）的结果。题里是 coupon(two(10))，括号里面的 two(10) 先算，得 20，再减 5。"),
        ("5", F, "5 是 coupon(10) 的结果。题里传给 coupon 的是 two(10) 交回的 20，不是 10。"),
        ("20", F, "20 是 two(10) 的结果，还要把它传给 coupon，再减 5。")],
        tip="f(g(x))：先算里面的 g(x)，再把结果交给 f。"),
    {**fill("屏幕要显示：24", Q15_CODE,
        ["4", "8", "a", "b"], ["4"], "24",
        {"8": "b = two(8) 是 16，a 也是 16，a + b 是 32，不是 24。",
         "a": "a 里是 16，two(a) 是 two(16) = 32，a + b 是 16 + 32 = 48，不是 24。",
         "b": "第 4 行等号右边先算，这时 b 还没有值，用到 b 会报 NameError（用到了没有定义的名字）。"},
        "a 已经是 16，要让 a + b = 24，b 就得是 8，也就是 two(?) 要交回 8。")},
    pick("想算“两杯的价钱再加 3 元”，屏幕要显示 19。运行后先显示了 16，又报了 TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'（None 和整数不能用 + 相加；None 就是“什么都没有”）。怎么改，屏幕才会显示 19？", "fix", [
        opt("把 two 里的 print(price * 2) 改成 return price * 2", T, "two 执行结束时没有遇到 return，自动返回 None，None + 3 报错。改成 return 后，two(8) 交回 16，16 + 3 = 19，最后 print(total) 显示 19。", fixed=Q16_FIX_A),
        opt("把第 3 行的 + 3 去掉", F, "两杯的价钱要再加 3，不能去掉。去掉后不报错了，但 two 里的 print 先显示 16，total 得到的还是 None，最后显示 16 和 None，不是 19。", fixed=Q16_FIX_B),
        opt("删掉最后一行 print(total)", F, "报错发生在第 3 行 total = two(8) + 3，和最后一行无关，删掉它还是同样的 TypeError。", fixed=Q16_FIX_C),
        opt("把 3 改成文字 \"3\"", F, "two(8) 得到的还是 None，None 和文字 \"3\" 也不能用 + 相加，仍然是 TypeError。", fixed=Q16_FIX_D),
    ], code=Q16, trace=trace_of(Q16), expected="19", tip="本关要把算出的数字交给后续计算，所以用 return 返回数字；函数里的 print 只是显示。"),
  ]},
]


# ---------------- U8L5：两个参数、默认值 ----------------
# 产品官 15:59：L5 先教两个参数，再教默认值，暂不拆关；默认参数单个也有意义，按计算器项目（价格 × 杯数）的需求安排顺序。
# 本关不教：关键字传参 total(8, cups=3)、默认值写成可变对象、*args。
L5_INTRO = 'def total(price, cups=1):\n    return price * cups\nprint(total(8, 3))\nprint(total(8))'
Q17 = 'def order(drink, cups):\n    print(cups, "杯", drink)\norder("奶茶", 2)\norder("果茶", 1)'
Q18_CODE = 'def total({0}):\n    return price * cups\nprint(total(8, 3))'
def q18_prog(tok): return Q18_CODE.replace("{0}", tok)
Q19 = 'def total(price, cups=1):\n    return price * cups\nprint(total(8))\nprint(total(8, 3))\nprint(total(5))'
Q20 = 'def total(price, cups):\n    return price * cups\nprint(total(8))'
Q20_FIX_A = 'def total(price, cups=1):\n    return price * cups\nprint(total(8))'
Q20_FIX_B = 'def total(price, cups=0):\n    return price * cups\nprint(total(8))'
Q20_FIX_C = 'def total(price=1, cups):\n    return price * cups\nprint(total(8))'
Q20_FIX_D = 'def total(price):\n    return price * cups\nprint(total(8))'

assert real_out(L5_INTRO) == "24\n8"
assert real_out(Q17) == "2 杯 奶茶\n1 杯 果茶"
assert real_out('def order(drink, cups):\n    print(cups, "杯", drink)\norder(2, "奶茶")') == "奶茶 杯 2"       # 两个值的顺序反了：drink 得到 2、cups 得到“奶茶”
assert real_out('def order(drink, cups):\n    print(cups, "杯", drink)\norder("奶茶", 2)\norder("奶茶", 2)') == "2 杯 奶茶\n2 杯 奶茶"
assert real_out('def order(drink, cups):\n    print(drink, "杯", cups)\norder("奶茶", 2)\norder("果茶", 1)') == "奶茶 杯 2\n果茶 杯 1"   # print 里先写 drink 才会这样显示
assert Q17.split("\n")[1] == '    print(cups, "杯", drink)'
assert real_out(q18_prog("price, cups")) == "24"
assert run(q18_prog("price cups")) == ("", "SyntaxError")          # 两个参数之间漏了逗号
assert run(q18_prog("price + cups")) == ("", "SyntaxError")        # 括号里写的是名字，不能做运算
r18 = real_error(q18_prog("price"))                                 # 只有一个参数，却传了两个值
assert (r18["type"], r18["msg"]) == ("TypeError", "total() takes 1 positional argument but 2 were given")
assert real_out(Q19) == "8\n24\n5"
assert real_out(Q19.replace("cups=1", "cups=0")) == "0\n24\n0"                                               # 以为不传就是 0
assert real_out(Q19.replace("print(total(8, 3))", "print(total(8, 1))")) == "8\n8\n5"                        # 传了 3 却被默认值盖掉
assert run(Q20_FIX_A) == ("8", None) and run(Q20_FIX_B) == ("0", None)
r20 = real_error(Q20)
assert (r20["type"], r20["line"], r20["code_line"], r20["msg"], r20["stdout"]) == ("TypeError", 3, "print(total(8))", "total() missing 1 required positional argument: 'cups'", "")
assert run(Q20_FIX_C)[1] == "SyntaxError"                           # 有默认值的参数写在没有默认值的前面
assert run(Q20_FIX_D) == ("", "NameError")                          # cups 没有了，函数体里还在用

# ---------------- U8L6：作用域 ----------------
# 产品官 15:59：L6 处理作用域；16:14 收窄说法：只说“这些例子中，函数里定义的名字（含参数）不能在函数外直接使用”和“本题给参数 price 重新赋值，不会改变外面的 price”，不概括成通用规则（列表、字典的内容在函数里被修改，可能影响外面）。
# 不教：global 关键字、在函数里读外面的变量（UnboundLocalError 之类的坑）、嵌套函数。
L6_INTRO = 'price = 8\ndef double(price):\n    price = price * 2\n    return price\nprint(double(price))\nprint(price)'
Q21 = 'def make_order():\n    drink = "奶茶"\n    print("做好了", drink)\nmake_order()\nprint(drink)'
Q22 = 'price = 8\ndef change():\n    price = 100\n    print(price)\nchange()\nprint(price)'
Q23 = 'def double(price):\n    price = price * 2\n    return price\nprice = 8\nprint(double(price))\nprint(price)'
Q24 = 'def calc(price):\n    result = price * 2\ncalc(8)\nprint(result)'
Q24_FIX_A = 'def calc(price):\n    result = price * 2\n    return result\ncalc(8)\nprint(calc(8))'
Q24_FIX_B = 'def calc(price):\n    result = price * 2\ncalc(8)\nprint(price)'
Q24_FIX_C = 'def calc(price):\n    result = price * 2\ncalc(8)\nresult = 0\nprint(result)'
Q24_FIX_D = 'def calc(price):\n    result = price * 2\ncalc(8)\ncalc(8)\nprint(result)'

assert real_out(L6_INTRO) == "16\n8"
r21 = real_error(Q21)
assert (r21["type"], r21["line"], r21["code_line"], r21["msg"], r21["stdout"]) == ("NameError", 5, "print(drink)", "name 'drink' is not defined", "做好了 奶茶")
assert Q21.split("\n")[4] == "print(drink)" and Q21.split("\n")[3] == "make_order()"
assert real_out(Q22) == "100\n8"
assert real_out(Q22.replace("    price = 100\n", "")) == "8\n8"                  # 对照：函数里没有赋值，用的就是外面的 8
assert real_out(Q23) == "16\n8"
assert real_out(Q23.replace("print(price)", "print(double(price))")) == "16\n16"
r24 = real_error(Q24)
assert (r24["type"], r24["line"], r24["code_line"], r24["msg"], r24["stdout"]) == ("NameError", 4, "print(result)", "name 'result' is not defined", "")
assert real_out(Q24_FIX_A) == "16" and real_out(Q24_FIX_C) == "0"
assert run(Q24_FIX_B) == ("", "NameError") and run(Q24_FIX_D) == ("", "NameError")
assert real_error(Q24_FIX_B)["msg"] == "name 'price' is not defined"

# ---- L5 新题：短 if + 两个 return，判断本次调用在哪一行返回 ----
QIF = 'def pay(price, cups=1):\n    total = price * cups\n    if total >= 30:\n        return total - 5\n    return total\nprint(pay(8, 3))\nprint(pay(8, 4))\nprint(pay(8))'
assert real_out(QIF) == "24\n27\n8"
assert QIF.split("\n")[3] == "        return total - 5" and QIF.split("\n")[4] == "    return total"          # 解释里的“第 4 行 / 第 5 行”
assert real_out(QIF.replace("if total >= 30:", "if False:")) == "24\n32\n8"                                  # 以为 if 里的 return 不会运行
assert real_out(QIF.replace("    return total\n", "    return total - 5\n")) == "19\n27\n3"                    # 以为到处都减 5
assert run(QIF)[1] is None                                                                                  # pay(8) 不报错（默认 cups=1）
assert real_out('def pay(price, cups=1):\n    total = price * cups\n    if total >= 30:\n        return total - 5\n    return total\nprint(pay(8, 4))') == "27"   # pay(8, 4)：总价 32 满 30
assert real_out('def pay(price, cups=1):\n    total = price * cups\n    if total >= 30:\n        return total - 5\n    return total\nprint(pay(8, 3))') == "24"   # 总价 24 不满 30，走到第 5 行
assert real_out('def pay(price, cups=1):\n    total = price * cups\n    if total >= 30:\n        return total - 5\n    return total\nprint(pay(8))') == "8"        # 默认 cups=1，总价 8
QIF_SHOW = "点单屏运行这段程序，屏幕上会显示什么？（想一想：每次调用在哪一行交回结果）"

lessons += [
 {"id": "U8L5", "title": "两个参数和默认值", "concept": "多个参数、按顺序传值、默认值、if 里的 return",
  "story": "价格计算器要两个数：def total(price, cups): 逗号隔开，total(8, 3) 按顺序传值。写默认值 cups=1，不传就用 1；有默认值的参数放后面。函数里的 if：成立就在 if 里 return，否则往下走到后面的 return。",
  "introCode": L5_INTRO,
  "exercises": [
    pred(SHOW, Q17, [
        ("2 杯 奶茶\n1 杯 果茶", T, "两个值按顺序传：第 3 行 order(\"奶茶\", 2)，奶茶传给第一个参数 drink，2 传给第二个参数 cups。函数里 print(cups, \"杯\", drink) 先写 cups，所以先显示 2，再是“杯”，最后是奶茶。第 4 行同理。"),
        ("奶茶 杯 2\n果茶 杯 1", F, "显示的顺序由函数里 print 的写法决定：print(cups, \"杯\", drink) 先显示 cups。传值的顺序和显示的顺序不一定一样。"),
        ("2 杯 奶茶\n2 杯 奶茶", F, "每次调用都会重新传值。第 4 行传的是 \"果茶\" 和 1，drink、cups 这次就是果茶和 1。"),
        ("报错", F, "不会报错：调用时传了 2 个值，def 里正好有 2 个参数，个数是对得上的。")],
        tip="按顺序对应：第一个值给第一个参数，第二个值给第二个参数。"),
    pred(QIF_SHOW, QIF, [
        ("24\n27\n8", T, "每次调用先算 total，再看满不满 30。pay(8, 3)：total 是 24，不满 30，if 不成立，走到第 5 行 return total，交回 24。pay(8, 4)：total 是 32，满 30，在第 4 行 return total - 5 交回 27，这次调用到此结束，第 5 行不会运行。pay(8)：用默认 cups=1，total 是 8，走到第 5 行，交回 8。"),
        ("24\n32\n8", F, "pay(8, 4) 的 total 是 32，满 30，if 成立，会在第 4 行 return total - 5，交回 27；return 一执行，这次调用就结束，轮不到第 5 行的 return total。"),
        ("19\n27\n3", F, "减 5 只写在 if 里面的第 4 行。total 不满 30（24 和 8）时，if 不成立，走到第 5 行 return total，不减 5：24 和 8。"),
        ("24\n27\n报错", F, "pay(8) 没传 cups 不会报错：cups 有默认值 1，total 是 8，不满 30，走到第 5 行，交回 8。")],
        tip="每次调用重新算 total：满 30 在第 4 行 return，不满就走到第 5 行 return。"),
    pred(SHOW, Q19, [
        ("8\n24\n5", T, "cups=1 是默认值。第 3 行 total(8) 没传 cups，用默认的 1：8 × 1 = 8；第 4 行 total(8, 3) 传了 3，就用 3：8 × 3 = 24；第 5 行 total(5) 又没传，5 × 1 = 5。"),
        ("8\n8\n5", F, "默认值只在没有传值时才用。第 4 行传了 3，cups 就是 3，不是默认的 1。"),
        ("0\n24\n0", F, "没传 cups 时用的是它的默认值 1，不是 0，所以 8 × 1 = 8，5 × 1 = 5。"),
        ("报错", F, "cups 有默认值，调用时可以不传，不会报错。只有没有默认值的参数，漏传才会报 TypeError。")],
        tip="传了值就用传的值；没传，才用默认值。"),
    pick("想让 total(8) 也能用（只买 1 杯，不用写杯数），屏幕要显示 8。现在运行报了错：TypeError: total() missing 1 required positional argument: 'cups'（调用时少了 1 个必须给的参数 cups）。怎么改，屏幕才会显示 8？", "fix", [
        opt("把第 1 行改成 def total(price, cups=1):", T, "给 cups 一个默认值 1：total(8) 没传 cups，就用 1，8 × 1 = 8。", fixed=Q20_FIX_A),
        opt("把第 1 行改成 def total(price, cups=0):", F, "不报错了，但没传 cups 时它是 0，8 × 0 = 0，显示的是 0，不是 8。", fixed=Q20_FIX_B),
        opt("把第 1 行改成 def total(price=1, cups):", F, "有默认值的参数要写在没有默认值的参数后面。这样写，Python 一行都不会运行，直接报 SyntaxError（写法不符合语法）。", fixed=Q20_FIX_C),
        opt("把第 1 行改成 def total(price):", F, "cups 不再是参数了，但函数体里还在用它，调用时会报 NameError（用到了没有定义的名字）。", fixed=Q20_FIX_D),
    ], code=Q20, trace=trace_of(Q20), expected="8", tip="不想每次都传的值，给它一个默认值；有默认值的参数写在后面。"),
  ]},
 {"id": "U8L6", "title": "函数里的变量", "concept": "作用域：这些例子中，函数里定义的名字不能在函数外直接使用",
  "story": "这一关的例子里：函数里定义的名字（包括参数），不能在函数外面直接使用，外面用会报 NameError。函数里给同名的 price 重新赋值，不会改变函数外面的 price。想把函数里算出的结果拿到外面，用 return 交回来，再接住它。",
  "introCode": L6_INTRO,
  "exercises": [
    pick("程序报了 NameError: name 'drink' is not defined（drink 这个名字没有定义）。drink 明明在函数里赋过值，出错的是哪一行？", "line", [
        opt("print(drink)", T, "最后一行报错。drink 是在 make_order() 里面定义的名字，这个例子里它不能在函数外面直接使用，外面的 print(drink) 就找不到它。"),
        opt("drink = \"奶茶\"", F, "给变量赋值没有问题，函数里的这一行正常运行了。"),
        opt("make_order()", F, "调用没有问题：函数体运行了，屏幕上已经显示了“做好了 奶茶”。"),
        opt("print(\"做好了\", drink)", F, "这一行在函数里面，drink 在函数里有值，它正常运行了，已经显示了“做好了 奶茶”。"),
    ], code=Q21, trace=trace_of(Q21), tip="这些例子中，函数里定义的名字不能在函数外直接使用。"),
    pred(SHOW, Q22, [
        ("100\n8", T, "本题在函数里给 price 重新赋值（price = 100），函数里的 print 显示 100；这不会改变函数外面的 price，最后一行显示 8。"),
        ("100\n100", F, "本题函数里的 price = 100 不会改变函数外面的 price，最后一行还是 8。"),
        ("8\n8", F, "函数里有自己的 price = 100，函数里的 print 显示的是 100。"),
        ("8\n100", F, "顺序反了：先调用 change()，函数里的 print 先显示 100；最后一行是函数外面的 price，还是 8。")],
        tip="本题在函数里给 price 重新赋值，不会改变函数外面的 price。"),
    pred(SHOW, Q23, [
        ("16\n8", T, "8 传给参数 price；本题在函数里给参数 price 重新赋值（price = price * 2），交回 16，但不会改变函数外面的 price，最后一行显示 8。"),
        ("16\n16", F, "本题给参数 price 重新赋值，不会改变函数外面的 price，最后一行还是 8。想让外面的 price 变，要自己把交回的结果存回去，比如 price = double(price)。"),
        ("8\n8", F, "第 5 行 print(double(price)) 显示的是函数交回的结果，函数里的 price 已经乘了 2，是 16。"),
        ("8\n16", F, "顺序反了：第 5 行先显示函数交回的 16，最后一行才是函数外面没变的 price，也就是 8。")],
        tip="本题给参数 price 重新赋值，不会改变外面的 price。"),
    pick("想让屏幕显示 16。现在最后一行报了 NameError: name 'result' is not defined（result 这个名字没有定义）。怎么改，屏幕才会显示 16？", "fix", [
        opt("在函数里加一行 return result，最后一行改成 print(calc(8))", T, "result 是在 calc 里定义的名字，不能在函数外直接使用。用 return 把它交回来，外面用 print(calc(8)) 接住，就显示 16 了。", fixed=Q24_FIX_A),
        opt("把最后一行改成 print(price)", F, "price 是 calc 的参数，这个例子里它也不能在函数外直接使用，外面用它还是 NameError。", fixed=Q24_FIX_B),
        opt("在最后一行前面加 result = 0", F, "不报错了，但这是函数外面新建的另一个 result，里面是 0，显示的是 0，不是 16。", fixed=Q24_FIX_C),
        opt("把 calc(8) 多调用一次", F, "不管调用几次，result 都是在 calc 里定义的名字，函数外面不能直接使用，仍然是 NameError。", fixed=Q24_FIX_D),
    ], code=Q24, trace=trace_of(Q24), expected="16", tip="想把函数里算出的结果拿到外面，用 return 交回来。"),
  ]},
]


# ---------------- U8L7：价格计算器（项目，call 模式，held：待代码题运行器开放）----------------
# 产品官 16:14：L7 价格计算器项目，先交题面、输入范围、测试用例。判分按返回值（checkMode "call"），不比较 print 的输出。
# 用到的只有 L1–L6 学过的：def、两个参数、默认值、return、if / else、调用另一个函数、函数里的局部名字。
TOTAL_DEF = 'def total(price, cups):\n    return price * cups\n'
REF7 = TOTAL_DEF + '''
def bill(price, cups=1):
    amount = total(price, cups)
    if amount >= 30:
        return amount - 5
    return amount
'''
START7 = TOTAL_DEF + '''
def bill(price, cups):
    amount = total(price, cups)
    if amount >= 30:
        print(amount - 5)
    else:
        print(amount)
'''
def callv(src, fn, *args):
    """真实运行：先运行学生代码（顶层 print 不计），再调用函数，返回返回值；出错返回 ('报错', 类型)。"""
    g = {}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            exec(src, g)
            return g[fn](*args)
    except BaseException as e:
        return ("报错", type(e).__name__)
def T7(name, args, hidden=False, ref=None, fn="bill"):
    d = {"name": name}
    if hidden: d["hidden"] = True
    d["call"] = {"fn": fn, "args": list(args)}
    d["expectedReturn"] = callv(ref or REF7, fn, *args)
    return d
def fails7(src, tests):
    return [t["name"] for t in tests if not (lambda a, e: type(a) is type(e) and a == e)(callv(src, t["call"]["fn"], *t["call"]["args"]), t["expectedReturn"])]

TP7 = [T7("3 杯 8 元，不满 30", (8, 3)), T7("3 杯 12 元，总价满 30", (12, 3)), T7("只写单价，默认 1 杯", (8,))]
TH7 = [T7("总价正好 30 元也减", (10, 3), True), T7("默认 1 杯，29 元不减", (29,), True), T7("默认 1 杯，30 元要减", (30,), True),
       T7("杯数多", (6, 10), True), T7("1 杯 40 元", (40, 1), True)]
ALL7 = TP7 + TH7
assert [t["expectedReturn"] for t in ALL7] == [24, 31, 8, 25, 29, 25, 55, 35]
assert fails7(REF7, ALL7) == []
assert fails7(START7, ALL7) == [t["name"] for t in ALL7]                         # 起始代码：打印了、没有 return，返回 None；bill(8) 少传 cups 还会报错

ALT7 = [
 (TOTAL_DEF + '''
def bill(price, cups=1):
    amount = total(price, cups)
    if amount >= 30:
        return amount - 5
    else:
        return amount
''', "if / else 两边各 return 一次"),
 ('''def bill(price, cups=1):
    amount = price * cups
    if amount >= 30:
        amount = amount - 5
    return amount
''', "不用 total，自己算；先改 amount，最后统一 return"),
 (TOTAL_DEF + '''
def bill(price, cups=1):
    if total(price, cups) >= 30:
        return total(price, cups) - 5
    return total(price, cups)
''', "每次直接调用 total(…)"),
 ('''def bill(price, cups=1):
    amount = price * cups
    if amount < 30:
        return amount
    return amount - 5
''', "反过来写条件：不满 30 直接交回"),
]
ALLNAMES7 = [t["name"] for t in ALL7]
WRONG7 = [
 (START7.replace("def bill(price, cups):", "def bill(price, cups=1):"), "只补了默认值，函数里还是 print，没有 return：调用得到 None", ALLNAMES7),
 (REF7.replace("cups=1", "cups"), "忘了默认值：bill(8) 只传了一个值，会报 TypeError", ["只写单价，默认 1 杯", "默认 1 杯，29 元不减", "默认 1 杯，30 元要减"]),
 (REF7.replace(">= 30", "> 30"), "边界：总价正好 30 元也要减，用 >= 不用 >", ["总价正好 30 元也减", "默认 1 杯，30 元要减"]),
 (REF7.replace("amount >= 30", "price >= 30"), "拿单价去比，不是总价：12 元 × 3 杯 = 36 元，也要减", ["3 杯 12 元，总价满 30", "总价正好 30 元也减", "杯数多"]),
 (REF7.replace("return amount - 5", "return cups * (price - 5)"), "每杯减 5 元，不是总价减 5 元", ["3 杯 12 元，总价满 30", "总价正好 30 元也减", "杯数多"]),
 (REF7.replace("        return amount - 5\n", "        amount - 5\n"), "只算了 amount - 5，没有 return，也没有存回去，还是交回原来的总价", ["3 杯 12 元，总价满 30", "总价正好 30 元也减", "默认 1 杯，30 元要减", "杯数多", "1 杯 40 元"]),
 (REF7.replace("    return amount\n", ""), "不满 30 的情况没有 return：函数执行结束时没有遇到 return，自动返回 None", ["3 杯 8 元，不满 30", "只写单价，默认 1 杯", "默认 1 杯，29 元不减"]),
]
for i, a in enumerate(ALT7, 1): assert fails7(a[0], ALL7) == [], (i, fails7(a[0], ALL7))
for i, (w, why, want) in enumerate(WRONG7, 1): assert fails7(w, ALL7) == want, (i, fails7(w, ALL7), want)

# 示范（换一个场景：咖啡店满 20 减 3），三步：先算总价、再判断满减、最后 return
WORKED7 = {"code": 'def pay(price, cups=1):\n    amount = price * cups\n    if amount >= 20:\n        amount = amount - 3\n    return amount\nprint(pay(9, 3))',
           "output": "24",
           "explain": "三步：先算总价 amount；再判断：满 20 才减 3；最后把 amount return 交回去。函数里只算不 return，调用得到的就是 None。"}
assert real_out(WORKED7["code"]) == WORKED7["output"]

# 变化题：满 60 元减 12 元（不再同时减 5 元）；满 30 不满 60 仍减 5 元
REF7V = TOTAL_DEF + '''
def bill(price, cups=1):
    amount = total(price, cups)
    if amount >= 60:
        return amount - 12
    elif amount >= 30:
        return amount - 5
    return amount
'''
V7_TESTS = [T7("3 杯 8 元", (8, 3), False, REF7V), T7("满 30 不满 60", (9, 6), False, REF7V), T7("总价正好 60", (10, 6), True, REF7V),
            T7("总价 59", (59,), True, REF7V), T7("杯数多", (5, 20), True, REF7V)]
assert [t["expectedReturn"] for t in V7_TESTS] == [24, 49, 48, 54, 88]
assert fails7(REF7V, V7_TESTS) == []
assert fails7(REF7, V7_TESTS) != []                                   # 父题答案不能直接过变化题
V7_START = TOTAL_DEF + '\ndef bill(price, cups=1):\n    amount = total(price, cups)\n    # 在这里写：满 60 减 12；满 30 不满 60 减 5\n    return amount\n'
assert fails7(V7_START, V7_TESTS) != []

# 题面写明的输入范围：所有测试数据（含变化题）都必须在范围内
for _t in ALL7 + V7_TESTS:
    assert all(isinstance(_a, int) and not isinstance(_a, bool) and _a >= 1 for _a in _t["call"]["args"]) and 1 <= len(_t["call"]["args"]) <= 2, _t["name"]

# 课内 4 题（运行器开放前显示；第 4 题将被代码题替换）。16:35 审稿意见：讲解和前置题不能出现与参考答案相同的完整 bill；
# 讲解用“逾期费封顶”的场景，Q1/Q3/Q4 用“停车费”fee，Q2 只给“满减判断”的片段，学生要自己完成的 bill 一行都不出现。
L7_INTRO = 'def late_fee(days, rate=2):\n    amount = days * rate\n    if amount > 10:\n        amount = 10\n    return amount\nprint(late_fee(3))\nprint(late_fee(8))\nprint(late_fee(8, 1))'
P7_A = 'def fee(hours, rate=3):\n    amount = hours * rate\n    if amount > 12:\n        return 12\n    return amount\nprint(fee(2))\nprint(fee(5))\nprint(fee(5, 2))'
P7_B = 'amount = 10 * 3\nif amount >= 30:\n    amount = amount - 5\nprint(amount)\namount = 29\nif amount >= 30:\n    amount = amount - 5\nprint(amount)'
FEE_PRINT = 'def fee(hours, rate=3):\n    amount = hours * rate\n    print(amount)\n'
P7_C = FEE_PRINT + 'result = fee(2) + 1\nprint(result)'
P7_C_A = 'def fee(hours, rate=3):\n    amount = hours * rate\n    return amount\nresult = fee(2) + 1\nprint(result)'
P7_C_B = FEE_PRINT + 'result = fee(2)\nprint(result)'
P7_C_C = FEE_PRINT + 'result = fee(2, 1) + 1\nprint(result)'
P7_C_D = FEE_PRINT + 'print(fee(2) + 1)'
P7_D = 'def fee(hours, rate=3):\n    amount = hours * rate\n    if amount > 12:\n        return 12\nprint(fee(2))\nprint(fee(5))'
assert real_out(L7_INTRO) == "6\n10\n8"
assert real_out(P7_A) == "6\n12\n10"
assert real_out(P7_A.replace("print(fee(5, 2))", "print(fee(5, 3))")) == "6\n12\n12"
assert real_out(P7_A.replace("print(fee(5))", "print(fee(5) + 1)")) == "6\n13\n10"
assert real_out(P7_A.replace("return 12", "return amount")) == "6\n15\n10"                           # 以为没有封顶
assert real_out(P7_A.replace("print(fee(5, 2))", "print(fee(5, 2) * 2)")) == "6\n12\n20"
assert real_out(P7_B) == "25\n29"
assert real_out(P7_B.replace(">= 30", "> 30")) == "30\n29"
assert real_out(P7_B.replace("amount = amount - 5", "amount = 5")) == "5\n29"
r7c = real_error(P7_C)
assert (r7c["type"], r7c["line"], r7c["code_line"], r7c["msg"], r7c["stdout"]) == ("TypeError", 4, "result = fee(2) + 1", "unsupported operand type(s) for +: 'NoneType' and 'int'", "6")
assert real_out(P7_C_A) == "7" and real_out(P7_C_B) == "6\nNone"
assert run(P7_C_C)[1] == "TypeError" and run(P7_C_D)[1] == "TypeError"
assert P7_C.split("\n")[3] == "result = fee(2) + 1"                                                   # 解释里的“第 4 行”
assert real_out(P7_D) == "None\n12"
assert real_out(P7_D.replace("print(fee(2))", "print(6)")) == "6\n12"
# 这些前置内容里不能出现项目的参考答案：不含 bill，也不含 total(price, cups) 的调用
for _src in (L7_INTRO, P7_A, P7_B, P7_C, P7_D, P7_C_A):
    assert "bill" not in _src and "total(" not in _src and "price" not in _src, _src

L7_TASK = {"id": "U8L7-M1", "version": 1, "type": "modify",
 "prompt": "价格计算器：函数 bill(price, cups) 要算出顾客应付的钱，用 return 交回（不是 print）。输入范围：price、cups 都是正整数（至少为 1）。规则：① 总价 = price × cups；② 总价满 30 元（正好 30 元也算）减 5 元，不满不减；③ 只写单价、不写杯数时，按 1 杯算。已经写好的 total(price, cups) 可以直接用。",
 "given": [], "checkMode": "call",
 "code": START7, "tests": ALL7,
 "hints": ["先运行：起始代码的 bill 里是 print，调用 bill(…) 得到的是 None；再看规则 ③：只写单价时 cups 要有默认值。", "bill 里先算总价 amount = total(price, cups)；总价满 30 才减 5；每种情况都要把结果 return 交回，不是 print。"],
 "reference": REF7, "worked": WORKED7, "alternatives": [a for a, _ in ALT7],
 "wrongAnswers": [{"code": w, "why": why} for w, why, _ in WRONG7],
 "requiresVariationAfterSolution": True,
 "variation": {"id": "U8L7-M1-V1", "prompt": "满 60 元减 12 元（满 60 时只减 12 元，不再减 5 元）；满 30 元但不满 60 元，仍减 5 元；不满 30 元不减。只写单价时按 1 杯算，其他不变。输入范围同上。",
   "starter": V7_START,
   "tests": V7_TESTS,
   "hints": ["三档要从大到小判断：先问是不是满 60，再问是不是满 30，都不满才原价。", "if amount >= 60: return amount - 12；elif amount >= 30: return amount - 5；最后 return amount。"],
   "solution": REF7V}}

held = [
 {"id": "U8L7", "title": "价格计算器", "concept": "项目：算总价、满减、默认杯数，用 return 交回",
  "story": "项目：奶茶店的价格计算器。函数 bill(price, cups) 算顾客应付的钱：总价 = 单价 × 杯数；总价满 30 元（正好 30 元也算）减 5 元；只写单价时按 1 杯算。结果要用 return 交回，让别的地方可以接住它、继续算。已经写好的 total(price, cups) 可以直接调用。",
  "introCode": L7_INTRO,
  "exercises": [
    pred(SHOW, P7_A, [
        ("6\n12\n10", T, "fee(2)：2 × 3 = 6，不超过 12，交回 6。fee(5)：5 × 3 = 15，超过 12，return 12。fee(5, 2)：传了 rate 是 2，5 × 2 = 10，不超过 12，交回 10。"),
        ("6\n15\n10", F, "15 超过 12，会执行 return 12，封顶交回 12，不是 15。"),
        ("6\n12\n12", F, "fee(5, 2) 传了 rate = 2，不是默认的 3：5 × 2 = 10，没超过 12。"),
        ("6\n12\n20", F, "fee(5, 2) 的第二个值传给 rate，不是乘 2 的倍数：5 × 2 = 10。")],
        tip="先算 amount，再看是不是超过 12；传了第二个值就用它，没传才用默认值 3。"),
    pred("下面是“总价满 30 元减 5 元”的判断（总价正好 30 元也算）。屏幕上会显示什么？", P7_B, [
        ("25\n29", T, "第一段：amount 是 30，amount >= 30 成立（正好 30 也成立），减 5 得 25。第二段：amount 是 29，不满 30，不减，显示 29。"),
        ("30\n29", F, "条件是 amount >= 30，30 也成立，要减 5。"),
        ("25\n24", F, "第二段 amount 是 29，不满 30，不减，仍是 29。"),
        ("5\n29", F, "amount = amount - 5 是在原来的数上减 5：30 - 5 = 25，不是直接变成 5。")],
        tip="边界：>= 30 包含 30。"),
    pick("想显示 7（6 再加 1）。现在运行先显示了 6，又报了 TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'（None 和整数不能用 + 相加）。怎么改，屏幕才会显示 7？", "fix", [
        opt("把 fee 里的 print(amount) 改成 return amount", T, "fee 里是 print：显示了 6，函数却没遇到 return，自动返回 None，None + 1 报错。改成 return amount，fee(2) 交回 6，6 + 1 = 7。", fixed=P7_C_A),
        opt("把第 4 行的 + 1 去掉", F, "不报错了，但 fee 里的 print 先显示 6，result 得到的是 None，最后显示 6 和 None，不是 7。", fixed=P7_C_B),
        opt("把第 4 行改成 result = fee(2, 1) + 1", F, "多传一个值给 rate，fee 还是只 print、不 return，得到的仍是 None，None + 1 仍然是 TypeError。", fixed=P7_C_C),
        opt("把第 4 行改成 print(fee(2) + 1)", F, "fee(2) 得到的还是 None，None + 1 仍然是 TypeError。", fixed=P7_C_D),
    ], code=P7_C, trace=trace_of(P7_C), expected="7", tip="想把结果拿去继续算，函数里要用 return 交回。"),
    pred(SHOW, P7_D, [
        ("None\n12", T, "fee(2)：amount 是 6，不超过 12，if 里的 return 没有执行，函数执行结束时没有遇到 return，自动返回 None。fee(5)：15 超过 12，return 12。"),
        ("6\n12", F, "不超过 12 的情况没有 return amount，函数不会自己把 amount 交回来，得到的是 None。"),
        ("6\n15", F, "fee(5) 超过 12，会执行 return 12，交回 12，不是 15。"),
        ("报错", F, "没有 return 的调用不会报错，只是得到 None；print(None) 显示 None。")],
        tip="每一种情况都要有 return；没遇到 return，就是 None。"),
  ],
  "pending": [{"type": "modify", "replaces": 4, "status": "待 Claude 的代码题运行器，暂不开放",
    "plan": "改一改（项目）：价格计算器 bill(price, cups=1)；总价、满 30 减 5、默认 1 杯，用 return 交回（call 模式）",
    "task": L7_TASK}]},
]

# ---------------- U8L8 按名字传值（草稿，暂缓：放在 heldLessons，app 不显示；等产品官决定放进哪一关）----------------
D_ORDER = 'def order(drink, cups=1):\n    print(cups, "杯", drink)'
K1 = D_ORDER + '\norder(cups=2, drink="奶茶")'
assert real_out(K1) == "2 杯 奶茶"
assert real_out(D_ORDER + '\norder("奶茶")') == "1 杯 奶茶"
D_TOTAL = 'def total(price, cups=1):\n    return price * cups'
K2 = D_TOTAL + '\nprint(total(8, cups=3))\nt = total(cups=3, price=8)\nprint(t)'
assert real_out(K2) == "24\n24"
assert real_out(D_TOTAL + '\nprint(total(8, cups=3))\nprint(total(3, 8))') == "24\n24"     # 按位置时数字顺序反了，乘法碰巧一样（解析里不用它）
K3 = D_TOTAL + '\nprint(total(8, price=3))'
r_k3 = real_error(K3)
assert (r_k3["type"], r_k3["msg"], r_k3["code_line"]) == ("TypeError", "total() got multiple values for argument 'price'", "print(total(8, price=3))")
K4_CODE = D_ORDER + '\norder(cups=2, {0}="果茶")'
def k4(t): return K4_CODE.replace("{0}", t)
assert real_out(k4("drink")) == "2 杯 果茶"
assert run(k4("cups"))[1] == "SyntaxError"            # 同一个名字写两次：语法上就不允许
assert run(k4("name"))[1] == "TypeError" and real_error(k4("name"))["msg"].startswith("order() got an unexpected keyword argument 'name'")
assert real_error(k4("Drink"))["msg"].startswith("order() got an unexpected keyword argument 'Drink'")
held.append(
 {"id": "U8L8", "title": "按名字传值", "concept": "关键字参数：名字=值，和顺序无关；按位置的写在前面，同一个参数只给一次",
  "story": "参数一多，按位置传容易记错顺序。也可以按名字传：order(cups=2, drink=\"奶茶\")，名字对上就行，和先后顺序无关。按位置和按名字可以一起用，但按位置的要写在前面；同一个参数只能给一次。",
  "introCode": D_ORDER + '\norder("奶茶")\norder(cups=2, drink="果茶")',
  "exercises": [
    pred(SHOW, K1, [
        ("2 杯 奶茶", T, "按名字传：cups=2 给了 cups，drink=\"奶茶\" 给了 drink，和写的先后无关。函数里 print(cups, \"杯\", drink)，显示 2 杯 奶茶。"),
        ("奶茶 杯 2", F, "显示的顺序由函数里的 print 决定：先 cups，再“杯”，再 drink。调用时按名字写的先后不影响。"),
        ("1 杯 奶茶", F, "cups 的默认值 1 只在没有传 cups 时才用；这里按名字传了 cups=2。"),
        ("报错", F, "按名字传的时候，顺序可以和 def 里不一样，不会报错。")],
        tip="按名字传：看等号左边的名字，值就给那个参数。"),
    pred(SHOW, K2, [
        ("24\n24", T, "第一次 8 按位置给 price，cups=3 按名字给 cups：8 × 3 = 24。第二次 t = total(cups=3, price=8) 两个都按名字给，顺序无关，还是 price 8、cups 3，t 是 24。"),
        ("24\n报错", F, "全部按名字传时，先写 cups 后写 price 也可以，不会报错。"),
        ("8\n24", F, "第一次传了 cups=3，不会用默认的 1：8 × 3 = 24。"),
        ("24\n8", F, "第二次也传了 cups=3：8 × 3 = 24。")],
        tip="按位置的先对上，按名字的再各找各的参数。"),
    pick("运行报了 TypeError: total() got multiple values for argument 'price'。这句报错在说什么？", "type", [
        opt("price 收到了两次值：8 按位置给了 price，price=3 又按名字给了一次", T, "第一个位置就是 price，8 已经给了它；后面 price=3 又给了一次，同一个参数给了两次。想给 cups，要写 cups=3。", value="TypeError"),
        opt("price 这个名字还没有定义", F, "那是 NameError。price 是 total 的参数，定义过了；这里报的是 TypeError，说的是同一个参数收到了两个值。", value="NameError"),
        opt("按名字传值时等号写错了", F, "写法不对是 SyntaxError，程序一行都不会运行；这里前面的 def 正常运行了，是调用时才报错。", value="SyntaxError"),
        opt("字典里没有 price 这个键", F, "那是 KeyError，查字典时才会有；这里没有字典，是调用函数时同一个参数给了两次。", value="KeyError"),
    ], code=K3, trace=trace_of(K3), tip="multiple values：同一个参数收到了不止一个值。数一数位置和名字各给了谁。"),
    {**fill("屏幕要显示：2 杯 果茶", K4_CODE,
        ["drink", "cups", "name", "Drink"], ["drink"], "2 杯 果茶",
        {"cups": "cups 已经按名字给过 2 了，同一个名字写两次，写法本身就不允许，报 SyntaxError。",
         "name": "order 里没有叫 name 的参数，报 TypeError：got an unexpected keyword argument 'name'。名字要和 def 里的参数一致。",
         "Drink": "大小写不同就是另一个名字：order 里没有 Drink 这个参数，报 TypeError：got an unexpected keyword argument 'Drink'。"},
        "等号左边写 def 里参数的名字：要把果茶给哪个参数？")},
  ]})

unit = {"id": "U8", "title": "函数", "subtitle": "def、参数、return", "lessons": lessons, "heldLessons": held}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit8.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons))
