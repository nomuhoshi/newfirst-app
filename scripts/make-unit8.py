# 生成 content/unit8.json（第 8 单元「函数」前两关草稿：U8L1 定义与调用、U8L2 一个参数）。
# 草稿（产品官 2026-11-05 15:21 任务）：L1 分清“定义函数”和“执行函数”，L2 一个参数（传入不同的值，结果不同）。return 留到 L3。
# 只出现在 content/unit8.json，还没挂进 content/course.json（U8 仍是“即将推出”占位），app 读不到。
# 内容在这里改，再运行：python3 scripts/make-unit8.py && python3 scripts/verify-content.py --extra content/unit8.json
# 只用已学语法（U1–U7：print、变量、运算、字符串、比较、if、for/while、列表、字典、读报错，其中 U6 学过 NameError / TypeError / IndentationError），
# 加上本单元新教的：
#   U8L1 def 名字():、缩进的函数体、调用 名字()（括号不能省）、先定义后调用、调用几次就执行几次；
#   U8L2 一个参数：def 名字(参数):、调用时传入值、函数体里用参数、传入不同的值得到不同的结果、传入变量里的值、漏传值报 TypeError。
# 口径（产品官 15:39）：L2 只说“本关 pay(price) 定义了一个必填参数，调用时漏传会报 TypeError”，不概括成“函数的参数都必须传”（以后教默认参数时不用推翻）。
# 本部分不用：return（下一关）、多个参数、默认参数、作用域（函数里外的同名变量）、函数里改列表 / 字典、递归、f-string、函数调用函数。
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
Q4 = 'welcome()\ndef welcome():\n    print("欢迎光临")'

assert real_out(L1_INTRO) == "欢迎光临\n欢迎光临"
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
  "story": "奶茶店每次开门都要说“欢迎光临”。同一句话写很多遍太麻烦：用 def 给这段程序起个名字，以后喊一下名字就行。（你一直在用的 print(…) 就是别人写好的函数，写 print(…) 就是在调用它。）写法：def welcome(): 这一行是“起名字”，下面缩进的几行是函数体，也就是要做的事。注意：def 只是把做法记下来，这时函数体一行都不会运行，屏幕上什么都不会显示。要让它真正做事，要写 welcome()，名字后面带括号，这叫调用：调用一次，函数体就运行一次；调用两次，就运行两次。名字要先定义、后调用。",
  "introCode": L1_INTRO,
  "exercises": [
    pred(SHOW, Q1, [
        ("开店了", T, "def 只是把做法记下来，函数体要等到调用才运行；这段程序里没有调用 welcome()。屏幕上只有第 3 行的 print 显示的“开店了”（它没有缩进，不在函数里）。"),
        ("欢迎光临\n开店了", F, "def 那两行不会自己运行。函数体里的 print 要等到调用 welcome() 才会运行，这段程序从头到尾没有调用。"),
        ("欢迎光临", F, "显示的是第 3 行普通的 print：“开店了”。函数体里的 print 没有运行，因为没有调用 welcome()。"),
        ("什么都不显示", F, "第 3 行的 print 没有缩进，不在函数里，是一行普通的程序，会照常运行，显示“开店了”。")],
        tip="def 只是起名字、记做法；看有没有 名字() 这样带括号的调用。"),
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
  "story": "欢迎光临永远是同一句话。想让同一个函数按不同的饮品工作，就给它留一个空位：def say(drink): 括号里的 drink 叫参数，在函数体里它就像一个变量。调用时，括号里写的值会传进这个空位：say(\"奶茶\") 把 \"奶茶\" 传给 drink，函数体里用到 drink 的地方就是“奶茶”；say(\"果茶\") 再传一个，同一个函数就得到不一样的结果。每次调用都会重新传值。后面的 pay(price) 定义了一个必填参数 price：调用时漏传值，Python 会报 TypeError（类型错误）。",
  "introCode": L2_INTRO,
  "exercises": [
    pred(SHOW, Q5, [
        ("来一杯 咖啡\n来一杯 果茶", T, "第 3 行调用 say(\"咖啡\")，咖啡传给 drink，显示“来一杯 咖啡”；第 4 行再调用 say(\"果茶\")，这次 drink 是果茶，显示“来一杯 果茶”。"),
        ("来一杯 drink\n来一杯 drink", F, "print 里的 drink 没有引号，是参数这个变量，显示的是传进来的值（咖啡、果茶），不是单词 drink。"),
        ("来一杯 咖啡\n来一杯 咖啡", F, "每次调用都会重新传值。第 4 行传的是果茶，drink 这次就是果茶。"),
        ("来一杯 果茶\n来一杯 咖啡", F, "程序按顺序运行：先第 3 行传咖啡，再第 4 行传果茶，所以先显示咖啡。")],
        tip="每次调用，括号里的值传给参数；函数体里的 drink 就是这一次传进来的值。"),
    pred(SHOW, Q6, [
        ("应付 16\n应付 10", T, "第 4 行调用 pay(tea)，这时 tea 是 8，传给 price，8 × 2 = 16。第 5 行把 tea 改成 5，第 6 行再调用，传进去的是 5，5 × 2 = 10。"),
        ("应付 16\n应付 16", F, "每次调用，传进去的是调用那一刻 tea 里的值。第 5 行已经把 tea 改成 5，第 6 行传的是 5，所以是 10。"),
        ("应付 8\n应付 5", F, "函数体里写的是 price * 2，要乘 2：8 × 2 = 16，5 × 2 = 10。"),
        ("应付 10\n应付 10", F, "函数是在调用的那一行运行的，不是等到最后。第一次调用时 tea 还是 8，得 16，之后 tea 才改成 5。")],
        tip="看调用的那一刻变量里是多少：传进去的是值，不是变量名。"),
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
  ]},
]

unit = {"id": "U8", "title": "函数", "subtitle": "def、参数、return", "lessons": lessons, "heldLessons": []}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit8.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons))
