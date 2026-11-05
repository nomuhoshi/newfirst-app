# 生成 content/unit6.json（第 6 单元「类型与报错」：U6L1–U6L4，每关 4 题）。
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
    d["checks"] = checks or [chk(code)]
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
]

unit = {"id": "U6", "title": "类型与报错", "subtitle": "type、int()/str()、读报错", "lessons": lessons}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit6.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons))
