# 生成 content/unit6.json（第 6 单元「类型与报错」：U6L1–U6L6，每关 4 题（U6L6-M1 代码题在 pending，待开放））。
# 内容在这里改，再运行：python3 scripts/make-unit6.py && python3 scripts/verify-content.py
# 只用已学语法（U1–U5：print、变量、运算、字符串、len、比较、if/else、and/or/not、for/while、列表），加上本关新教的内容：
#   U6L1 type() 和 int / float / str / bool 四种类型；U6L2 int() 和 str() 转换；U6L3 读 traceback；U6L4 按错误类型和题意修错（float() 在这一关第一次出现）。
# 本部分不用：input、f-string、字符串乘法（"ab" * 2）、float()、round()、列表推导式。predict 题的程序必须能正常运行（报错只出现在错误选项或填空的错误词块里）。
import json, pathlib, sys
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


# ---- 读报错选择题 pick（不运行程序，只展示程序和真实报错）。报错文字、行号、信息都由 real_error 真实运行得出 ----
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

# U6L2 排序题的标准顺序
O62 = ["text = \"12\"", "num = int(text)", "total = num + 8", "print(total)"]

# ---- U6L3 / U6L4 用到的程序（报错、输出都是真实运行出来的）----
P31 = 'cups = 3\nprint("杯数：" + cups)'
P32 = 'cups = 3\nlabel = "杯数："\nprint(label)\nprint(label + cups)\nprint(cups)'
P33 = 'n = 4\nprint("共" + n + "杯")'
P34 = 'text = "abc"\nprint("准备转换")\nnum = int(text)\nprint(num)'
P41A = 'cups = 3\nprint("杯数：" + cups)'
P41B = 'print(int("3.5"))'
def _last(p): r = real_error(p); return f"{r['type']}: {r['msg']}"
def _summary(tag, p): return f"{tag}  " + f"\n   ".join(l for l in p.split("\n")) + f"\n   {_last(p)}"
Q41_TRACE = _summary("A", P41A) + "\n" + _summary("B", P41B)
P42 = 'price = "3.5"\nnum = int(price)\nprint(num + 1)'
P43 = 'cups = "3杯"\nprint(int(cups) + 2)'
P44 = 'age = "12"\nprint(age + 1)'
def fixopt(text, old, new, program, expected, ok_why, bad_why):
    """改法：把 old 换成 new，真实运行，对错和解释里的数字都来自真实运行。"""
    fixed = program.replace(old, new); assert fixed != program
    out, err = run(fixed)
    good = err is None and out == expected
    why = ok_why if good else bad_why(out, err)
    return opt(text, good, why, fixed=fixed)
def _shows(out, err): return f"报错 {err}" if err else f"显示 {out}"
Q42_OPTS = [
    fixopt("把 int(price) 改成 float(price)", "int(price)", "float(price)", P42, "4.5", "float() 把 \"3.5\" 转成小数 3.5，加 1 得 4.5，和题目要的一样。", None),
    fixopt("把 price = \"3.5\" 改成 price = \"3\"", '"3.5"', '"3"', P42, "4.5", None, lambda o, e: f"不报错了，但{_shows(o, e)}，不是 4.5：价格 3.5 元被你改成了 3 元，数据变了。"),
    fixopt("把 int(price) 改成 str(price)", "int(price)", "str(price)", P42, "4.5", None, lambda o, e: f"str(price) 还是文字 \"3.5\"，文字加 1 又变成类型搭配不对，{_shows(o, e)}。"),
    fixopt("把 num + 1 改成 num + \"1\"", "num + 1", 'num + "1"', P42, "4.5", None, lambda o, e: f"第 2 行的 int(price) 还是转不了 \"3.5\"，{_shows(o, e)}，报错没有消失。"),
]
Q44_OPTS = [
    fixopt("把 age + 1 改成 int(age) + 1", "age + 1", "int(age) + 1", P44, "13", "int(age) 把 \"12\" 变成整数 12，加 1 得 13。", None),
    fixopt("把 age + 1 改成 age + \"1\"", "age + 1", 'age + "1"', P44, "13", None, lambda o, e: f"不报错了，但{_shows(o, e)}：文字加文字是拼接，不是加法，不是 13。"),
    fixopt("把 age + 1 改成 float(age) + 1", "age + 1", "float(age) + 1", P44, "13", None, lambda o, e: f"不报错了，但{_shows(o, e)}：数值和 13 相同，但 float() 得到的是小数，显示成 13.0，格式不符合题目要求的“恰好 13”。"),
    fixopt("把 age + 1 改成 str(age) + 1", "age + 1", "str(age) + 1", P44, "13", None, lambda o, e: f"str(age) 本来就是文字，文字加 1 还是类型搭配不对，{_shows(o, e)}。"),
]

# ---- U6L5 / U6L6 用到的程序 ----
C51 = 'price = 12\ncups = 3\ntotal = price + cups\nprint("total:", total)\nprint("应付", total)'
C52 = 'total = 0\nfor i in range(1, 4):\n    total = 0\n    total = total + i\n    print("第", i, "轮", total)\nprint(total)'
C53 = 'total = 0\nfor i in range(1, 4):\n    total = total + i\n    print("第", i, "轮", {0})\nprint(total)'
P54 = 'total = 0\nfor i in range(1, 4):\n    total = total + i\nprint(total)'
_p = P54.split("\n"); _pr = '    print("total:", total)'
INS_A = "\n".join([_p[0], 'print("total:", total)'] + _p[1:])
INS_B = "\n".join(_p[:3] + [_pr] + _p[3:])
INS_C = "\n".join(_p[:2] + [_pr] + _p[2:])
INS_D = P54 + '\nprint("total:", total)'
# 项目：按示例的修法逐处出现的三个报错；所有改法选项 = 参考答案里只换一行，真实运行
REF6 = ['price = "10"', 'cups = "5"', 'total = int(price) * int(cups)', 'if int(cups) >= 5:', '    total = total - 5', 'print("应付：" + str(total))']
P6 = "\n".join(REF6[:2] + ['total = price * cups', 'if cups > 5:', '    total = total - 5', 'print("应付：" + total)'])
P6B = "\n".join(REF6[:3] + ['if cups > 5:', '    total = total - 5', 'print("应付：" + total)'])
P6C = "\n".join(REF6[:5] + ['print("应付：" + total)'])
P6FIN = 'price = "8"\ncups = "6"\ntotal = int(price) * int(cups)\nif int(cups) >= 5:\n    total = total - 5\nprint("应付：" + str(total))'
def lineopt(idx, line, ok_why, bad_why):
    prog = "\n".join(REF6[:idx] + [line] + REF6[idx + 1:])
    out, err = run(prog); good = err is None and out == "应付：45"
    return opt(f"第 {idx + 1} 行改成：{line.strip()}", good, ok_why if good else bad_why(out, err), fixed=prog)
L6_O1 = [
    lineopt(2, 'total = int(price) * int(cups)', "price 和 cups 都是表示整数的文字，先分别用 int() 转成整数再乘：10 × 5 = 50。", None),
    lineopt(2, 'total = int(price) * cups', None, lambda o, e: f"cups 还是文字：整数 × 文字不是乘法，是把文字重复 10 遍，得到 \"5555555555\"，后面减 5 又会出错，{_shows(o, e)}。"),
    lineopt(2, 'total = price * int(cups)', None, lambda o, e: f"price 还是文字：文字 × 整数不是乘法，是把文字重复 5 遍，后面减 5 又会出错，{_shows(o, e)}。"),
    lineopt(2, 'total = str(price) * str(cups)', None, lambda o, e: f"两个都变成文字，文字 × 文字没有意思，{_shows(o, e)}。"),
]
L6_O2 = [
    lineopt(3, 'if int(cups) >= 5:', "cups 先转成整数再比较；正好 5 杯也要减 5 元，所以用 >=。", None),
    lineopt(3, 'if int(cups) > 5:', None, lambda o, e: f"不报错了，但{_shows(o, e)}，应该是应付：45：正好 5 杯没有减 5 元，边界要用 >=。"),
    lineopt(3, 'if cups >= 5:', None, lambda o, e: f"cups 还是文字，文字和整数不能比较大小，{_shows(o, e)}。"),
    lineopt(3, 'if int(cups) >= "5":', None, lambda o, e: f"整数和文字不能比较大小，{_shows(o, e)}。"),
]
L6_O3 = [
    lineopt(5, 'print("应付：" + str(total))', "total 是整数，拼进文字之前先用 str() 变成文字。", None),
    lineopt(5, 'print("应付：" + int(total))', None, lambda o, e: f"int(total) 还是整数，整数和文字还是不能用 + 接，{_shows(o, e)}。"),
    lineopt(5, 'print("应付：", total)', None, lambda o, e: f"不报错了，但{_shows(o, e)}：逗号会在中间加一个空格，和要求的“应付：45”不一样。"),
    lineopt(5, 'print("应付：" + total)', None, lambda o, e: f"没有改：整数 total 不能直接和文字用 + 接，{_shows(o, e)}。"),
]
def _T(name, data, expected, hidden=False):
    d = {"name": name, "data": data, "expected": expected}
    if hidden: d["hidden"] = True
    return d
L6_TASK = {"id": "U6L6-M1", "version": 1, "type": "modify",
 "prompt": "收银程序有好几处错。price 和 cups 是表示整数的文字（比如 \"12\" 和 \"3\"）。要求：算出总价（单价 × 杯数），满 5 杯（正好 5 杯也算）减 5 元，输出“应付：金额”。请一处一处改好，每改一处就重新运行。",
 "given": ["price", "cups"], "checkMode": "output",
 "code": "total = price * cups\nif cups > 5:\n    total = total - 5\nprint(\"应付：\" + total)\n",
 "tests": [_T("3 杯", {"price": "12", "cups": "3"}, "应付：36"), _T("正好 5 杯", {"price": "10", "cups": "5"}, "应付：45"),
          _T("6 杯", {"price": "8", "cups": "6"}, "应付：43", True), _T("1 杯", {"price": "15", "cups": "1"}, "应付：15", True), _T("4 杯", {"price": "9", "cups": "4"}, "应付：36", True)],
 "hints": ["先运行，读最后一行的错误类型和 line 几；修好一处再运行，看有没有新的报错。", "price、cups 是文字：乘法和比较之前先用 int() 转成整数；拼进“应付：”之前用 str() 把整数变成文字。边界“满 5 杯”要用 >=。"],
 "reference": "total = int(price) * int(cups)\nif int(cups) >= 5:\n    total = total - 5\nprint(\"应付：\" + str(total))\n",
 "worked": {"code": "width = \"20\"\nheight = \"3\"\nw = int(width)\nh = int(height)\narea = w * h\nprint(\"面积：\" + str(area))", "output": "面积：60", "explain": "三步：先把表示整数的文字用 int() 转成整数，再计算，最后输出时用 str() 把整数变回文字拼进句子。"},
 "alternatives": ["cups = int(cups)\nprice = int(price)\ntotal = price * cups\nif cups >= 5:\n    total = total - 5\nprint(\"应付：\" + str(total))",
                  "total = int(price) * int(cups)\nif int(cups) > 4:\n    total = total - 5\nprint(\"应付：\" + str(total))",
                  "total = int(price) * int(cups)\nif int(cups) >= 5:\n    total = total - 5\nprint(\"应付：\", total, sep=\"\")"],
 "wrongAnswers": [{"code": "total = int(price) * int(cups)\nif int(cups) > 5:\n    total = total - 5\nprint(\"应付：\" + str(total))", "why": "正好 5 杯没有减 5 元（边界）"},
                  {"code": "total = price * int(cups)\nif int(cups) >= 5:\n    total = total - 5\nprint(\"应付：\" + str(total))", "why": "price 还是文字，文字 × 整数是重复，不是乘法"}],
 "requiresVariationAfterSolution": True,
 "variation": {"id": "U6L6-M1-V1", "prompt": "满 4 杯（正好 4 杯也算）减 3 元，其他不变，输出“应付：金额”。", "starter": "# price、cups 是表示整数的文字，已经准备好\n",
   "tests": [_T("4 杯", {"price": "6", "cups": "4"}, "应付：21"), _T("3 杯", {"price": "7", "cups": "3"}, "应付：21"),
             _T("8 杯", {"price": "5", "cups": "8"}, "应付：37", True), _T("1 杯", {"price": "9", "cups": "1"}, "应付：9", True), _T("正好 4 杯", {"price": "10", "cups": "4"}, "应付：37", True)],
   "hints": ["先转成整数再算；满额的界线这次是 4 杯。", "total = int(price) * int(cups) / if int(cups) >= 4: total = total - 3 / print(\"应付：\" + str(total))。"],
   "solution": "total = int(price) * int(cups)\nif int(cups) >= 4:\n    total = total - 3\nprint(\"应付：\" + str(total))\n"}}

lessons = [
 {"id": "U6L1", "title": "它是什么类型", "concept": "type() 和四种类型",
  "story": "点单屏里的值有不同的“种类”：15 是整数（int），15.5 是小数（float），\"15\" 是文字（str），True 是布尔（bool）。同样长得像 15，加了引号就是文字。type() 能让 Python 说出一个值的种类，结果长这样：<class 'int'>，引号里的 int 就是种类名。",
  "introCode": "print(type(15))\nprint(type(\"15\"))",
  "exercises": [
    pred(SHOW, "cups = 3\nprint(type(cups))", [
        ("<class 'int'>", T, "3 没有引号，是整数，种类名是 int。"),
        ("<class 'str'>", F, "cups 里是数字 3，没有引号，不是文字。"),
        ("3", F, "type() 说的是值的种类，不是值本身。")],
        tip="type(值) 显示这个值的种类：<class '种类名'>。"),
    pred(SHOW, "a = 15\nb = \"15\"\nprint(type(a))\nprint(type(b))", [
        ("<class 'int'>\n<class 'str'>", T, "a 是数字 15（int）；b 加了引号，是文字（str）。"),
        ("<class 'int'>\n<class 'int'>", F, "b 的 15 带着引号，是文字，不是整数。"),
        ("<class 'str'>\n<class 'int'>", F, "顺序反了：a 没有引号，是整数；b 才有引号。")],
        tip="15 和 \"15\" 看着一样，种类不一样：有引号的是文字。"),
    fill("屏幕要显示：<class 'float'>。哪一个能做到？", "print(type({0}))",
        ["30 / 2", "30 - 2", "\"30\""], ["30 / 2"], "<class 'float'>",
        {"30 - 2": "30 - 2 是 28，整数，显示 <class 'int'>。", "\"30\"": "加了引号的 30 是文字，显示 <class 'str'>。"},
        "还记得 30 / 2 得到 15.0 吗？除法的结果是小数（float）。"),
    pred(SHOW, "ok = 5 > 3\nprint(type(ok))", [
        ("<class 'bool'>", T, "比较的结果是 True 或 False，种类是布尔 bool。"),
        ("True", F, "type() 说的是种类，不是比较的结果。"),
        ("<class 'int'>", F, "True / False 不是整数，是布尔 bool。")],
        tip="比较的结果（True / False）种类是 bool。"),
  ]},
 {"id": "U6L2", "title": "文字和数字互换", "concept": "int() 和 str()",
  "story": "文字 \"15\" 和数字 15 不一样。\"杯数：\" + 3 会报错 TypeError：\"杯数：\" 是文字，3 是整数，Python 不能直接用 + 把它们接起来。解决办法是先统一种类：int() 可以把 \"15\" 这类表示整数的文字转成整数，str(3) 把整数转成文字。转好之后，才能用 + 做加法，或者拼进文字里。",
  "introCode": "price = \"15\"\nprint(int(price) + 5)\nprint(\"杯数：\" + str(3))",
  "exercises": [
    pred(SHOW, "price = \"15\"\nprint(int(price) + 5)", [
        ("20", T, "int(price) 先把文字 \"15\" 变成数字 15，再加 5 得 20。"),
        ("155", F, "155 是把 \"15\" 和 \"5\" 拼在一起的结果；这里 int() 已经把它变成数字，是做加法。"),
        ("15 + 5", F, "print 显示的是计算结果，不是算式。")],
        tip="int() 可以把 \"15\" 这类表示整数的文字转成整数，之后就能做加法。"),
    fill("屏幕要显示：杯数：3", "cups = 3\nprint(\"杯数：\" + {0})",
        ["str(cups)", "cups", "int(cups)"], ["str(cups)"], "杯数：3",
        {"cups": "\"杯数：\" 是文字，cups 是整数 3，Python 不能直接用 + 把它们接起来，所以会报 TypeError。用 str(cups) 转成文字后就能拼接。", "int(cups)": "int(cups) 还是整数 3，\"杯数：\" 是文字，文字加整数照样会报 TypeError。要用 str(cups) 转成文字才能拼接。"},
        "拼进文字里的必须是文字：用 str() 把数字变成文字。"),
    order("排好顺序。屏幕显示：20", O62, [3, 1, 0, 2], valid_orders(O62, "20"),
        "20", "先有文字，再变成整数，再相加，最后显示。"),
    pred(SHOW, "a = \"12\"\nb = \"8\"\nprint(a + b)\nprint(int(a) + int(b))", [
        ("128\n20", T, "第一行：两段文字拼在一起是 128；第二行：先都变成数字，再相加得 20。"),
        ("20\n20", F, "第一行 a + b 是两段文字，会拼在一起得 128，不会相加。"),
        ("128\n128", F, "第二行先用 int() 把两个都变成数字，再相加得 20。")],
        tip="文字 + 文字 = 拼接；整数 + 整数 = 相加。想相加，先 int()。"),
  ]},
 {"id": "U6L3", "title": "读懂报错", "concept": "先看最后一行，再找行号",
  "story": "程序出错时，Python 会停下来，给出一段报错。读它分两步：第一步看最后一行，冒号前面是错误类型（比如 TypeError），冒号后面是具体信息；第二步看上面的 line 几，到自己的代码里找那一行。在本关这些从上到下一行一行执行、运行到某一行才出错的例子里，出错行之前的代码已经运行过，之后的代码不会再运行。真实的报错里有时还有用 ^ 和 ~ 画的小箭头，先不用管。以后你自己写的程序出错时，也会看到这三样：错误类型、第几行、具体信息。",
  "introCode": P31,
  "exercises": [
    pick("程序出错了。先看报错的最后一行：冒号前面的 TypeError 是错误类型，后面是具体信息。合起来是在说什么？", "type", [
        opt("文字和整数放在一起用 + 接了，类型搭配不对", T, "最后一行写着 TypeError：can only concatenate str (not \"int\") to str，意思是 str（文字）不能和 int（整数）直接用 + 接起来。", value="TypeError"),
        opt("用到了一个还没有定义的变量名", F, "那种错误叫 NameError，信息里会写 name '…' is not defined。这里最后一行写的是 TypeError。", value="NameError"),
        opt("int() 转换的文字内容不对", F, "那种错误叫 ValueError。这里最后一行写的是 TypeError，说的是类型搭配。", value="ValueError"),
        opt("代码写法不对，比如少了冒号", F, "那种错误叫 SyntaxError。这里最后一行写的是 TypeError，程序的写法没问题，是运行到这一行才出错。", value="SyntaxError"),
    ], code=P31, trace=trace_of(P31), tip="最后一行：冒号前面是错误类型，冒号后面是具体信息。"),
    pick("报错里的 line 数字，指向程序里出错的那一行。是下面哪一行代码出错了？", "line", [
        opt("print(label)", F, "这一行是第 3 行，它正常运行了，屏幕上已经显示了“杯数：”。出错的是后面那一行。"),
        opt("print(label + cups)", T, "报错写着 line 4，第 4 行就是 print(label + cups)：label 是文字，cups 是整数，不能直接用 + 接。"),
        opt("print(cups)", F, "这一行是第 5 行，出错后 Python 就停了，它根本没有运行。"),
        opt("cups = 3", F, "给变量赋值没有问题，这一行是第 1 行，正常运行了。"),
    ], code=P32, trace=trace_of(P32), tip="用 line 几去数程序的行号，第一行是 line 1。"),
    {**fill("小码写的 print(\"共\" + n + \"杯\") 出了下面的报错。把它改好，屏幕要显示：共4杯", "n = 4\nprint(\"共\" + {0} + \"杯\")",
        ["str(n)", "n", "int(n)"], ["str(n)"], "共4杯",
        {"n": "\"共\" 是文字，n 是整数 4，不能直接用 + 接，还是 TypeError。", "int(n)": "int(n) 还是整数 4，整数和文字照样不能用 + 接，TypeError。"},
        "报错说文字和整数搭配不对：把整数 n 变成文字就行，用 str()。"), "trace": trace_of(P33), "traceProgram": P33},
    pick("运行这段程序，屏幕上会先显示什么，然后出现报错？", "stdout", [
        opt("准备转换", T, "报错在第 3 行，第 2 行的 print(\"准备转换\") 已经运行过，所以先显示“准备转换”；第 4 行没有机会运行。", value="准备转换"),
        opt("什么都不显示，只有报错", F, "出错之前的代码已经运行过：第 2 行的 print 已经把“准备转换”显示出来了。", value=""),
        opt("准备转换\nabc", F, "第 4 行 print(num) 在出错的第 3 行之后，不会运行；而且 num 也根本没有生成。", value="准备转换\nabc"),
        opt("准备转换\n0", F, "报错之后程序就停了，第 4 行不会运行，不会显示任何数字。", value="准备转换\n0"),
    ], code=P34, trace=trace_of(P34), tip="出错的行之前运行过，之后不会运行。"),
  ]},
 {"id": "U6L4", "title": "修正常见错误", "concept": "按错误类型和题意选修法",
  "story": "两种报错，修法不一样。TypeError 是类型搭配不对，比如 \"杯数：\" + 3：拼接时，用 str() 把整数变成文字；做整数加法时，用 int() 把 \"12\" 这类表示整数的文字转成整数。ValueError 是类型对了，但文字的内容转不了，比如 int(\"3.5\")：\"3.5\" 不是整数的写法。这时先看题目要什么：要保留小数，就用 float()，float(\"3.5\") 得到小数 3.5；只能是整数（比如杯数），就把数据改成只写杯数的 \"3\"，去掉单位“杯”。不能为了不报错就随便改数据，改完显示的结果要和题目要的一样。",
  "introCode": "price = \"3.5\"\nprint(float(price) + 1)",
  "exercises": [
    pick("下面两个报错的最后一行，分别是哪一种问题？", "type", [
        opt("A 是类型搭配不对，B 是文字的内容转不了整数", T, "A 是 TypeError：文字和整数不能直接用 + 接。B 是 ValueError：int() 要的是整数写法的文字，\"3.5\" 带小数点，转不了。", value="TypeError,ValueError"),
        opt("A 是文字的内容转不了整数，B 是类型搭配不对", F, "反了。A 的最后一行是 TypeError（类型搭配），B 的最后一行是 ValueError（内容转不了）。", value="ValueError,TypeError"),
        opt("两个都是类型搭配不对", F, "只有 A 是 TypeError。B 里 \"3.5\" 本来就是文字，int() 要转的类型没错，错在内容，所以是 ValueError。", value="TypeError,TypeError"),
        opt("两个都是文字内容转不了", F, "只有 B 是 ValueError。A 里没有转换，是文字和整数直接用 + 接，是 TypeError。", value="ValueError,ValueError"),
    ], trace=Q41_TRACE, checks=[chk(P41A), chk(P41B)], tip="看最后一行冒号前面：TypeError 是类型搭配，ValueError 是内容转不了。"),
    pick("price 是 3.5 元的奶茶价格，要显示加 1 元后的价格：4.5。怎么改才对？", "fix", [
        Q42_OPTS[0], Q42_OPTS[1], Q42_OPTS[2], Q42_OPTS[3],
    ], code=P42, trace=trace_of(P42), expected="4.5", tip="题目要保留小数，就不能把 \"3.5\" 改成 \"3\"。"),
    {**fill("杯数必须是整数。cups 写成 \"3杯\" 时出了下面的报错；cups 里写什么，程序才能显示 5？", "cups = {0}\nprint(int(cups) + 2)",
        ["\"3\"", "\"3杯\"", "\"三\""], ["\"3\""], "5",
        {"\"3杯\"": "\"3杯\" 里带着单位“杯”，int() 转不了，还是 ValueError。", "\"三\"": "汉字“三”不是 int() 认识的整数写法，转不了，ValueError。"},
        "只填写杯数，例如 \"3\"，去掉单位“杯”，int() 才能转成整数。"), "trace": trace_of(P43), "traceProgram": P43},
    pick("age 是 \"12\"，要显示明年的年龄。输出必须恰好是 13。怎么改才对？", "fix", [
        Q44_OPTS[0], Q44_OPTS[1], Q44_OPTS[2], Q44_OPTS[3],
    ], code=P44, trace=trace_of(P44), expected="13", tip="输出必须恰好是 13：不是 13.0，也不是 121。"),
  ]},
 {"id": "U6L5", "title": "用 print 找 bug", "concept": "在中间加 print，看变量的值",
  "story": "有时程序不报错，结果却不对。这时在中间加几行 print，把变量当时的值显示出来，从上往下看，找到第一处和你预想不一样的地方，错就在它附近。加在哪里很重要：想看每一轮更新后的值，print 就要放在更新那一行的下面。",
  "introCode": "total = 0\nfor i in range(1, 4):\n    total = total + i\n    print(\"第\", i, \"轮\", total)\nprint(total)",
  "exercises": [
    pred("小码想算 3 杯 12 元的总价 36，在中间加了一行 print 看看。屏幕上会显示什么？", C51, [
        ("total: 15\n应付 15", T, "中间的 total 显示 15，不是想要的 36：第 3 行写成了 +，应该是 *。找 bug 就是找第一处和预想不一样的值。"),
        ("total: 36\n应付 36", F, "第 3 行是 price + cups，12 + 3 得 15，不是 36。"),
        ("total: 15\n应付 36", F, "两行显示的是同一个变量 total，值一样，都是 15。")],
        tip="先预想每个变量应该是多少，再对照 print 显示的值。"),
    pred("想算 1 + 2 + 3 = 6，小码加了 print 看每一轮。屏幕上会显示什么？", C52, [
        ("第 1 轮 1\n第 2 轮 2\n第 3 轮 3\n3", T, "每一轮 total 都先被 total = 0 清零，再加 i，所以显示的是 i 本身，最后是 3。bug 在循环里的 total = 0。"),
        ("第 1 轮 1\n第 2 轮 3\n第 3 轮 6\n6", F, "这是把 total = 0 放在循环外面时才有的结果；这里每一轮都会被清零。"),
        ("第 1 轮 1\n第 2 轮 2\n第 3 轮 3\n6", F, "最后的 print(total) 显示的也是被清零后加上 3 的结果：3，不是 6。")],
        tip="每一轮开头 total 是多少？"),
    fill("想看每一轮累加后的 total，print 里填什么？", C53, ["total", "i", "\"total\""], ["total"],
        "第 1 轮 1\n第 2 轮 3\n第 3 轮 6\n6",
        {"i": "i 是第几轮的数，显示出来是 1、2、3，看不到累加的值。", "\"total\"": "加了引号就是文字 total，显示的是单词，不是变量的值。"},
        "要看变量的值，print 里写变量名，不加引号。"),
    pick("想在循环里加一行 print(\"total:\", total)，看每一轮更新后的值。放在哪一行才对？", "fix", [
        opt("放在 total = 0 的下面，循环外面", F, "不在循环里，只会显示一次更新之前的值。", fixed=INS_A),
        opt("放在 total = total + i 的下面，缩进和它一样", T, "在更新之后、同一个循环里，每一轮都会显示更新后的值。", fixed=INS_B),
        opt("放在 total = total + i 的上面，缩进和它一样", F, "在循环里，但在更新之前，显示的是上一轮的值，第一轮还是 0。", fixed=INS_C),
        opt("放在最后一行 print(total) 的下面", F, "在循环外面，只显示最后一次。", fixed=INS_D),
    ], code=P54, checks=[], expected="total: 1\ntotal: 3\ntotal: 6\n6", tip="更新之后，在同一个循环里。"),
  ]},

 {"id": "U6L6", "title": "修好收银程序", "concept": "一处一处修，每次重新读报错",
  "story": "项目：收银程序有好几处错。price 和 cups 是从点单屏读来的、表示整数的文字，比如 \"10\" 和 \"5\"。修的办法：先运行，读最后一行和 line 几；修好一处，再运行，看有没有新的报错；全部不报错了，也要拿几组数据对一对结果，因为有的错不会报错，只会算错。下面三个报错，是按示例的修法逐处修改时可能看到的顺序，你的写法不同，看到的顺序也可能不同。",
  "introCode": P6,
  "exercises": [
    pick("price 是 \"10\"、cups 是 \"5\"，要先算总价 total = 单价 × 杯数。程序先出了下面这个报错，第 3 行怎么改？", "fix", [
        L6_O1[0], L6_O1[1], L6_O1[2], L6_O1[3],
    ], code=P6, trace=trace_of(P6), expected="应付：45", tip="两个都是表示整数的文字，乘之前都要转成整数。"),
    pick("第 3 行修好之后，按示例的修法，下一步会看到下面这个报错。第 4 行怎么改？", "fix", [
        L6_O2[0], L6_O2[1], L6_O2[2], L6_O2[3],
    ], code=P6B, trace=trace_of(P6B), expected="应付：45", tip="正好 5 杯也要减 5 元；cups 还是文字。"),
    pick("前面两处修好之后，按示例的修法，最后一行会看到下面这个报错。第 6 行怎么改？", "fix", [
        L6_O3[0], L6_O3[1], L6_O3[2], L6_O3[3],
    ], code=P6C, trace=trace_of(P6C), expected="应付：45", tip="拼进文字之前，整数要先变成文字；输出要和题目的写法一模一样。"),
    pred("三处都改好了。price 是 \"8\"、cups 是 \"6\"，屏幕上会显示什么？", P6FIN, [
        ("应付：43", T, "8 × 6 = 48，满 5 杯减 5 元，得 43。"),
        ("应付：48", F, "忘了减 5 元：6 杯已经满 5 杯。"),
        ("应付：53", F, "满 5 杯是减 5 元，不是加 5 元。")],
        tip="先算总价，再看有没有满 5 杯。"),
  ],
  "pending": [{"type": "modify", "replaces": 4, "status": "待 Claude 的代码题运行器，暂不开放",
    "plan": "改一改（项目）：price、cups 是表示整数的文字；一处一处修好，满 5 杯减 5 元，输出“应付：金额”",
    "task": L6_TASK}]}
]

unit = {"id": "U6", "title": "类型与报错", "subtitle": "type、int()/str()、读报错", "lessons": lessons}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit6.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons))
