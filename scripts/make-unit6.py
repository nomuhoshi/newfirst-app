# 生成 content/unit6.json（第 6 单元「类型与报错」：9 关，每关 5 题）。候选内容：还没有接进 course.json，没有上线。
# 内容在这里改，再运行：python3 scripts/make-unit6.py && python3 scripts/verify-content.py
# 规格（docs/59-course-design-plan.md §2）：一关只教一个新东西；5 题；开场说明不超过 90 字；每关至少 1 道填空、1 道排序；
# 代码每行显示宽度不超过 34（汉字算 2）；只用 U1–U5 学过的写法加本关新教的内容；不用 +=。
# 报错题：选输出题带 expectError（scripts/verify/output.py），选项是文字或改法，由校验脚本核对真实错误类型、行号和报错前的输出。
import json, pathlib, itertools, io, contextlib, unicodedata

P = "点单屏运行这段程序，屏幕上会显示什么？"
def pred(code, opts, tip, prompt=P):
    return {"type": "predict", "prompt": prompt, "code": code, "options": [{"text": t, "correct": c, "why": w} for t, c, w in opts], "tip": tip}
def perr(prompt, code, etype, line, opts, tip, stdout="", msg=None, fixed=None):
    """报错题。opts 里每项是 (文字, 是否正确, 解释) 或 (文字, 是否正确, 解释, 改好后的完整程序)。"""
    ee = {"type": etype, "line": line, "stdout": stdout}
    if msg is not None: ee["msg"] = msg
    d = {"type": "predict", "prompt": prompt, "code": code, "expectError": ee, "options": [], "tip": tip}
    for o in opts:
        x = {"text": o[0], "correct": o[1], "why": o[2]}
        if len(o) > 3: x["program"] = o[3]
        d["options"].append(x)
    if fixed is not None: d["fixed"] = fixed
    return d
def fill(prompt, code, tokens, answer, expected, why, hint):
    return {"type": "fill", "prompt": prompt, "code": code, "tokens": tokens, "answer": [answer], "expected": expected, "why": why, "hint": hint}
def _out(code):
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf): exec(code, {})
    except Exception as e: return "<" + type(e).__name__ + ">"
    return buf.getvalue().rstrip("\n")
def order(prompt, lines, shuffled, expected, hint):
    canon = list(range(len(lines)))
    ans = [list(p) for p in itertools.permutations(canon) if _out("\n".join(lines[k] for k in p)) == expected]
    ans.sort(key=lambda a: a != canon)
    assert ans and ans[0] == canon, ("排序题的标准顺序得不到期望输出", lines)
    assert shuffled not in ans, ("排序题的初始顺序已经是答案", lines)
    return {"type": "order", "prompt": prompt, "lines": lines, "shuffled": shuffled, "answers": ans, "expected": expected, "hint": hint}
def lesson(id, title, concept, story, intro, exercises, **extra):
    return {"id": id, "title": title, "concept": concept, "story": story, "introCode": intro, "exercises": exercises, **extra}

INT, FLOAT, STR, BOOL = "<class 'int'>", "<class 'float'>", "<class 'str'>", "<class 'bool'>"
CASH0 = 'price = "10"\ncups = "5"\ntotal = price * cups\nif cups > 5:\n    total = total - 5\nprint("应付：" + total)'
CASH1 = CASH0.replace("total = price * cups", "total = int(price) * int(cups)")
CASH2 = CASH1.replace("if cups > 5:", "if int(cups) > 5:")
CASH3 = CASH2.replace('print("应付：" + total)', 'print("应付：" + str(total))')
def swap(code, old, new):
    assert old in code; return code.replace(old, new)

L = []
L.append(lesson("U6L1", "它是什么类型", "type()",
  "点单屏里的值有不同的种类：3 是整数（int），15.5 是小数（float），\"奶茶\" 是文字（str），True 是布尔（bool）。type() 能问出一个值的种类。",
  "cups = 3\nprint(type(cups))", [
  pred("price = 15.5\nprint(type(price))", [
    (FLOAT, True, "15.5 带小数点，是小数，种类名是 float。"),
    (INT, False, "int 是整数。15.5 带小数点，不是整数。"),
    ("15.5", False, "type() 问的是种类，显示的是种类名，不是值本身。")], "type(值) 显示 <class '种类名'>，引号里的就是种类。"),
  pred("a = 15\nb = \"15\"\nprint(type(a))\nprint(type(b))", [
    (INT + "\n" + STR, True, "a 没有引号，是整数；b 加了引号，是文字。"),
    (INT + "\n" + INT, False, "b 加了引号。加了引号的 \"15\" 是文字，不是整数。"),
    (STR + "\n" + INT, False, "顺序反了：先显示 a 的种类，a 是没有引号的 15。")], "长得一样的 15，加了引号就是文字。"),
  fill("屏幕要显示：<class 'float'>", "print(type({0}))", ["3.5", "3", "\"3.5\""], "3.5", FLOAT,
    {"3": "3 没有小数点，是整数，会显示 <class 'int'>。", "\"3.5\"": "加了引号就是文字，会显示 <class 'str'>。"}, "float 是小数：有小数点，没有引号。"),
  order("排好顺序。屏幕显示：\n奶茶\n<class 'str'>", ["name = \"奶茶\"", "print(name)", "print(type(name))"], [2, 0, 1], "奶茶\n" + STR, "先把名字存好；先显示名字，再显示它的种类。"),
  pred("ok = 5 > 3\nprint(ok)\nprint(type(ok))", [
    ("True\n" + BOOL, True, "5 > 3 成立，ok 是 True；True 和 False 的种类是 bool。"),
    ("True\n" + STR, False, "True 没有引号，不是文字，它的种类是 bool。"),
    ("5 > 3\n" + BOOL, False, "ok 里存的是比较的结果 True，不是 5 > 3 这几个字。")], "比较的结果 True / False 是第四种：布尔（bool）。")]))

L.append(lesson("U6L2", "文字变数字", "int()",
  "点单屏读进来的“15”其实是文字 \"15\"，不能直接拿来算。int(\"15\") 把它变成整数 15，就能算了。",
  "price = \"15\"\nprint(int(price) + 5)", [
  pred("cups = \"3\"\nprint(int(cups) + 1)", [
    ("4", True, "int(cups) 把文字 \"3\" 变成整数 3，3 + 1 得 4。"),
    ("31", False, "int() 已经把 \"3\" 变成整数，这里做的是加法，不是把文字接在一起。"),
    ("3", False, "变成整数 3 之后还要加 1。")], "int(文字) 得到整数，之后就能做加减乘除。"),
  pred("a = \"12\"\nb = \"8\"\nprint(a + b)\nprint(int(a) + int(b))", [
    ("128\n20", True, "第一行是两段文字相接，得 128；第二行先都变成整数再相加，得 20。"),
    ("20\n20", False, "a 和 b 带引号，是文字。文字用 + 是接在一起，不是加法。"),
    ("128\n128", False, "第二行用了 int()，12 和 8 已经是整数，+ 是加法。")], "同样是 +：两边是文字就相接，两边是整数才相加。"),
  fill("price 是文字 \"12\"。要算两杯的钱，屏幕显示：24", "price = \"12\"\ntotal = {0} * 2\nprint(total)", ["int(price)", "price", "\"price\""], "int(price)", "24",
    {"price": "price 还是文字，文字 * 2 是把它重复两遍，会显示 1212。", "\"price\"": "加了引号就不是变量了，是 price 这五个字母，重复两遍显示 priceprice。"}, "先把文字变成整数，再乘。"),
  order("排好顺序。屏幕显示：20", ["text = \"12\"", "num = int(text)", "total = num + 8", "print(total)"], [2, 0, 3, 1], "20", "先有文字，再变成整数，再计算，最后显示。"),
  pred("n = int(\"7\")\nprint(n * 2)\nprint(\"7\" * 2)", [
    ("14\n77", True, "n 是整数 7，乘 2 得 14；\"7\" 是文字，乘 2 是重复两遍，得 77。"),
    ("14\n14", False, "第二个 print 里的 \"7\" 带引号，是文字，没有经过 int()。"),
    ("77\n77", False, "n 是 int(\"7\") 的结果，已经是整数，7 * 2 得 14。")], "看有没有引号、有没有 int()，就知道它是文字还是整数。")]))

L.append(lesson("U6L3", "数字变文字", "str()",
  "想显示“杯数：3”。\"杯数：\" 是文字，3 是整数，不能直接用 + 接在一起。str(3) 把整数变成文字 \"3\"，就能接了。",
  "cups = 3\nprint(\"杯数：\" + str(cups))", [
  pred("n = 4\nprint(\"共\" + str(n) + \"杯\")", [
    ("共4杯", True, "str(n) 把 4 变成文字 \"4\"，三段文字接在一起。"),
    ("共n杯", False, "n 没有引号，是变量，str(n) 用的是它的值 4。"),
    ("共 4 杯", False, "用 + 接文字不会自动加空格。")], "str(整数) 得到文字，之后就能用 + 接进一句话里。"),
  fill("屏幕要显示：杯数：3", "cups = 3\nprint(\"杯数：\" + {0})", ["str(cups)", "cups", "\"cups\""], "str(cups)", "杯数：3",
    {"cups": "cups 是整数，文字和整数不能直接用 + 接，会报错。", "\"cups\"": "加了引号就是 cups 这四个字母，会显示 杯数：cups。"}, "先把整数变成文字，再接。"),
  pred("a = 1\nb = 2\nprint(str(a) + str(b))\nprint(a + b)", [
    ("12\n3", True, "第一行两边都变成了文字，相接得 12；第二行两边是整数，相加得 3。"),
    ("3\n3", False, "str(a) 和 str(b) 是文字 \"1\" 和 \"2\"，文字用 + 是相接。"),
    ("12\n12", False, "第二行没有 str()，a 和 b 还是整数，+ 是加法。")], "str() 之后 + 是相接；整数之间 + 是相加。"),
  order("排好顺序。屏幕显示：15元", ["price = 15", "text = str(price)", "print(text + \"元\")"], [1, 2, 0], "15元", "先有数字，再变成文字，最后接上“元”显示。"),
  fill("屏幕要显示：应付20元", "n = 20\nprint(\"应付\" + str({0}) + \"元\")", ["n", "\"n\"", "20元"], "n", "应付20元",
    {"\"n\"": "加了引号就是 n 这个字母，会显示 应付n元。", "20元": "20元 不是数字也不是带引号的文字，Python 看不懂，会报错。"}, "str() 的括号里放要变成文字的那个变量。")]))

TE = "can only concatenate str (not \"int\") to str"
L.append(lesson("U6L4", "读报错：看最后一行", "报错的最后一行 = 错误类型: 说明",
  "程序出错时会停下来，显示一段报错。先看最后一行：冒号前面是错误类型，后面是具体说明。TypeError 是类型搭配不对，NameError 是这个名字没有定义过。",
  "cups = 3\nprint(\"杯数：\" + cups)", [
  perr("这段程序报错了，最后一行是：\nTypeError: " + TE + "\n错误类型是哪一个？", "cups = 3\nprint(\"杯数：\" + cups)", "TypeError", 2, [
    ("TypeError", True, "冒号前面的就是错误类型。TypeError 表示类型搭配不对：文字和整数不能直接用 + 接。"),
    ("can only concatenate", False, "这是冒号后面的具体说明，不是类型。"),
    ("str", False, "str 是说明里提到的种类名。错误类型要看冒号前面。")], "报错最后一行：冒号前是错误类型，冒号后是说明。", msg=TE),
  perr("这段程序报错了，最后一行是：\nNameError: name 'drink' is not defined\n它在说什么？", "print(drink)", "NameError", 1, [
    ("drink 这个名字没有定义过", True, "NameError 是名字的问题：程序里从来没有给 drink 存过值。"),
    ("drink 的类型不对", False, "类型不对是 TypeError。这里冒号前面写的是 NameError。"),
    ("少写了一个括号", False, "括号是成对的。最后一行说的是 name 'drink' is not defined：名字没定义。")], "NameError：用了一个还没有存过值的名字。", msg="name 'drink' is not defined"),
  fill("小码写的是 print(\"共\" + n + \"杯\")，报了 TypeError。改好它，屏幕显示：共4杯", "n = 4\nprint(\"共\" + {0} + \"杯\")", ["str(n)", "n", "\"n\""], "str(n)", "共4杯",
    {"n": "这就是原来的写法：n 是整数，不能和文字直接用 + 接，还是 TypeError。", "\"n\"": "不报错了，但显示的是 共n杯，不是 4。"}, "TypeError 说类型搭配不对：把整数变成文字再接。"),
  perr("这段程序报错了，最后一行是：\nNameError: name 'prise' is not defined\n是怎么回事？", "price = 15\nprint(prise)", "NameError", 2, [
    ("名字打错了：prise 应该是 price", True, "存的时候叫 price，用的时候写成了 prise。Python 认为这是另一个没定义的名字。"),
    ("15 不能显示", False, "整数可以直接 print。问题出在名字上。"),
    ("print 写错了", False, "print 没有写错。最后一行指出的是 prise 这个名字没有定义。")], "NameError 常常是名字打错了一个字母。", msg="name 'prise' is not defined"),
  order("排好顺序，让程序不报 NameError。屏幕显示：来一杯奶茶", ["drink = \"奶茶\"", "text = \"来一杯\" + drink", "print(text)"], [2, 1, 0], "来一杯奶茶", "名字要先存好，后面才能用。")]))

L.append(lesson("U6L5", "读报错：找第几行", "报错里的 line 几",
  "报错里还有 line 几，指出是第几行出的错。程序从上到下一行一行运行：出错那行之前的已经运行过，之后的不会再运行。",
  "print(\"开始\")\nprint(\"共\" + 4)\nprint(\"结束\")", [
  perr("这段程序报错了，报错里写着 line 4。出错的是哪一行？", "cups = 3\nlabel = \"杯数：\"\nprint(label)\nprint(label + cups)\nprint(cups)", "TypeError", 4, [
    ("print(label + cups)", True, "从上往下数，第 4 行是它：文字 label 和整数 cups 不能直接用 + 接。"),
    ("print(label)", False, "这是第 3 行，它正常运行了，屏幕上已经显示了 杯数：。"),
    ("cups = 3", False, "这是第 1 行，存一个整数没有问题。")], "line 几就是从上往下数的第几行。", stdout="杯数："),
  perr("这段程序在第 2 行报错。报错之前，屏幕上已经显示了什么？", "print(\"开始\")\nprint(\"共\" + 4)\nprint(\"结束\")", "TypeError", 2, [
    ("开始", True, "第 1 行在出错之前已经运行过。第 2 行出错，程序停下，第 3 行不再运行。"),
    ("开始\n结束", False, "第 2 行出错后程序就停了，第 3 行不会运行。"),
    ("什么都没有", False, "第 1 行排在出错行的前面，已经运行过了。")], "出错行之前的照常运行，之后的不运行。", stdout="开始"),
  perr("这段程序报了 TypeError。报错里的 line 会是几？", "a = 5\nb = \"2\"\nprint(a)\nprint(a + b)", "TypeError", 4, [
    ("line 4", True, "第 4 行把整数 a 和文字 b 相加，类型搭配不对，在这一行出错。"),
    ("line 2", False, "第 2 行只是把文字 \"2\" 存进 b，这样写是允许的。出错的是用到它的那一行。"),
    ("line 3", False, "第 3 行只显示 a，正常运行，屏幕上已经显示了 5。")], "报错指的是真正出错的那一行，不一定是你写错想法的那一行。", stdout="5"),
  fill("把第 3 行改好。屏幕显示：7", "a = 5\nb = \"2\"\nprint(a + {0})", ["int(b)", "b", "str(b)"], "int(b)", "7",
    {"b": "b 是文字，整数和文字不能相加，还是 TypeError。", "str(b)": "str(b) 还是文字，还是 TypeError。要的是整数。"}, "要做加法，两边都得是整数。"),
  order("排好顺序。屏幕显示：\n开始\n共4杯\n结束", ["print(\"开始\")", "n = 4", "print(\"共\" + str(n) + \"杯\")", "print(\"结束\")"], [3, 2, 0, 1], "开始\n共4杯\n结束", "n 要在用到它的那一行之前存好。")]))

VE = "invalid literal for int() with base 10: '3.5'"
L.append(lesson("U6L6", "转不了的文字", "ValueError 和 float()",
  "int() 只认整数写法的文字。int(\"3.5\")、int(\"3杯\") 会报 ValueError：内容转不了。带小数点的文字用 float(\"3.5\")，得到小数 3.5。",
  "price = \"3.5\"\nprint(float(price) + 1)", [
  pred("print(float(\"3.5\") + 1)", [
    ("4.5", True, "float(\"3.5\") 得到小数 3.5，加 1 得 4.5。"),
    ("3.51", False, "float() 已经把文字变成小数，这里是加法，不是把文字接起来。"),
    ("4", False, "float 保留小数：3.5 + 1 是 4.5。")], "带小数点的文字用 float() 变成小数。"),
  perr("这段程序报错了，最后一行是：\nValueError: " + VE + "\n它在说什么？", "num = int(\"3.5\")\nprint(num)", "ValueError", 1, [
    ("文字 \"3.5\" 不是整数的写法，int() 转不了", True, "ValueError：种类对（是文字），但内容不合适。\"3.5\" 带小数点，不是整数的写法。"),
    ("3.5 没有加引号", False, "这里 \"3.5\" 是加了引号的。问题是 int() 转不了带小数点的内容。"),
    ("num 这个名字没有定义", False, "名字没定义是 NameError。这里冒号前面是 ValueError。")], "ValueError：内容转不了。看清是整数还是小数，选 int() 或 float()。", msg=VE),
  fill("杯数必须是整数。cups 里写什么，屏幕才会显示：5", "cups = {0}\nprint(int(cups) + 2)", ["\"3\"", "\"3杯\"", "\"3.0\""], "\"3\"", "5",
    {"\"3杯\"": "带了“杯”字，int() 转不了，会报 ValueError。数据里只写数字。", "\"3.0\"": "带小数点的文字 int() 转不了，会报 ValueError。"}, "int() 只认纯整数写法的文字。"),
  order("排好顺序。屏幕显示：7.0", ["price = \"3.5\"", "num = float(price)", "print(num * 2)"], [1, 2, 0], "7.0", "先有文字，再变成小数，最后计算并显示。"),
  pred("print(int(\"12\") + 1)\nprint(float(\"12\") + 1)", [
    ("13\n13.0", True, "int 得到整数，结果是 13；float 得到小数，结果带 .0，是 13.0。"),
    ("13\n13", False, "float() 得到的是小数，算出来的结果会带小数点：13.0。"),
    ("13.0\n13.0", False, "第一行用的是 int()，结果是整数 13，不带小数点。")], "float 算出来的结果总带小数点。")]))

L.append(lesson("U6L7", "用 print 找 bug", "在中间加 print 看变量的值",
  "有时程序不报错，结果却不对。在中间加一行 print，把变量当时的值显示出来，从上往下看，找到第一处和你想的不一样的地方，错就在它附近。",
  "price = 12\ncups = 3\ntotal = price + cups\nprint(\"total:\", total)", [
  pred("price = 12\ncups = 3\ntotal = price + cups\nprint(\"total:\", total)", [
    ("total: 15", True, "程序写的是 price + cups，12 + 3 得 15。print 把这个不对的值照实显示出来了。"),
    ("total: 36", False, "36 是小码想要的结果。但程序写的是 +，不是 *。"),
    ("total: 123", False, "price 和 cups 是整数，+ 是加法，不是把数字接在一起。")], "加的 print 显示的是程序真正算出的值，不是你希望的值。", prompt="小码想算 3 杯 12 元一共 36 元，加了一行 print 看 total。屏幕上会显示什么？"),
  pred("total = 0\nfor i in range(1, 4):\n    total = 0\n    total = total + i\n    print(i, total)\nprint(total)", [
    ("1 1\n2 2\n3 3\n3", True, "每一轮都先把 total 改回 0 再加 i，所以每轮的 total 就等于 i，最后是 3。"),
    ("1 1\n2 3\n3 6\n6", False, "这是想要的结果。但循环里多了一行 total = 0，每一轮都从头开始。"),
    ("3", False, "循环里的 print 每一轮都会显示一行。")], "看每一轮的值：哪一轮开始和预想不一样，就看那附近的代码。", prompt="想算 1 + 2 + 3 = 6，小码加了 print 看每一轮。屏幕上会显示什么？"),
  fill("想看每一轮累加后的 total。屏幕显示：\n1 1\n2 3\n3 6", "total = 0\nfor i in range(1, 4):\n    total = total + i\n    print(i, {0})", ["total", "i", "\"total\""], "total", "1 1\n2 3\n3 6",
    {"i": "这样显示的是两遍 i，看不到 total 的值。", "\"total\"": "加了引号显示的是 total 这几个字母，不是它的值。"}, "想看哪个变量，就把它的名字（不加引号）放进 print。"),
  order("排好顺序：每一轮显示累加后的 total，最后显示合计。屏幕显示：\n1\n3\n合计 3", ["total = 0", "for i in range(1, 3):", "    total = total + i", "    print(total)", "print(\"合计\", total)"], [4, 2, 0, 3, 1], "1\n3\n合计 3", "想看更新后的值，print 要放在更新那一行的下面。"),
  fill("找到了：算总价应该用乘。改好它，屏幕显示：36", "price = 12\ncups = 3\ntotal = price {0} cups\nprint(total)", ["*", "+", "-"], "*", "36",
    {"+": "这就是原来的错：12 + 3 得 15。", "-": "12 - 3 得 9。总价是单价乘杯数。"}, "总价 = 单价 × 杯数。")]))

pending = json.loads((pathlib.Path(__file__).resolve().parent / "unit6-pending.json").read_text())
pending[0]["replaces"] = 5; pending[0]["task"]["id"] = "U6L8-M1"
L.append(lesson("U6L8", "项目：修好收银程序", "一处一处修，每次重新读报错",
  "收银程序有好几处错。price 和 cups 是从点单屏读来的文字。办法：运行，读报错，修一处；再运行，再修。不报错了，也要拿数据对一对结果。",
  CASH0, [
  perr("第一次运行，报错说 line 3、TypeError。第 3 行怎么改？", CASH0, "TypeError", 3, [
    ("total = int(price) * int(cups)", True, "price 和 cups 是文字，先都变成整数才能相乘。", CASH1),
    ("total = str(price) * str(cups)", False, "它们本来就是文字，再 str() 还是文字，文字不能和文字相乘。", swap(CASH0, "total = price * cups", "total = str(price) * str(cups)")),
    ("total = price + cups", False, "不报错了，但这是把两段文字接成 \"105\"，不是总价；后面还会接着出错。", swap(CASH0, "total = price * cups", "total = price + cups"))],
    "修一处，就重新运行一次。", fixed=None),
  perr("第 3 行修好了。再运行，报错说 line 4、TypeError。第 4 行怎么改？", CASH1, "TypeError", 4, [
    ("if int(cups) > 5:", True, "cups 是文字，和整数 5 比较之前先变成整数。", CASH2),
    ("if str(cups) > 5:", False, "str(cups) 还是文字，文字不能和整数比大小。", swap(CASH1, "if cups > 5:", "if str(cups) > 5:")),
    ("if int(cups) > \"5\":", False, "int(cups) 是整数，\"5\" 是文字，整数和文字还是不能比大小，第 4 行照样报同样的错。", swap(CASH1, "if cups > 5:", "if int(cups) > \"5\":"))],
    "修好一处又出现新的报错是正常的：程序往下多走了一步。", fixed=None),
  perr("前两处修好了。再运行，报错说 line 6、TypeError。第 6 行怎么改？", CASH2, "TypeError", 6, [
    ("print(\"应付：\" + str(total))", True, "total 是整数，先变成文字才能接在 \"应付：\" 后面。", CASH3),
    ("print(\"应付：\" + int(total))", False, "total 本来就是整数，int() 之后还是整数，还是不能和文字接。", swap(CASH2, "print(\"应付：\" + total)", "print(\"应付：\" + int(total))")),
    ("print(\"应付：\" + \"total\")", False, "不报错了，但显示的是 应付：total，不是金额。", swap(CASH2, "print(\"应付：\" + total)", "print(\"应付：\" + \"total\")"))],
    "拼进一句话之前，把整数变成文字。", fixed="应付：50"),
  pred(CASH3, [
    ("应付：50", True, "程序写的是 > 5，5 > 5 不成立，没有减。10 × 5 = 50。"),
    ("应付：45", False, "这是规则想要的结果。但条件写的是 > 5，正好 5 杯不算。"),
    ("应付：105", False, "price 和 cups 已经用 int() 变成整数，是相乘，不是把文字接起来。")],
    "不报错不等于算对：拿一组数据对一对结果。", prompt="不报错了。规则是满 5 杯减 5 元，正好 5 杯也减。屏幕上会显示什么？"),
  fill("改好条件。屏幕显示：应付：45", CASH3.replace("if int(cups) > 5:", "if int(cups) {0} 5:"), [">=", ">", "<"], ">=", "应付：45",
    {">": "这就是原来的错：正好 5 杯时 5 > 5 不成立，不会减。", "<": "这样变成不满 5 杯才减，和规则相反。"}, "“正好 5 杯也减”要用包含相等的比较。")],
  pending=pending))
# 改法题：前两题修好一处后仍会在后面出错，所以“期望输出”只对第三题有意义；前两题核对的是“正确改法让程序走到下一处报错”
for q, nxt in ((0, 4), (1, 6)):
    ex = L[-1]["exercises"][q]
    for o in ex["options"]: o.pop("program")
    ex.pop("fixed", None)

L.append(lesson("U6L9", "单元复习：收银台小结", "类型、int()、str()、float()、读报错",
  "这一关不教新东西，把本单元的几样一起用一遍：看种类、文字和数字互相转换、读报错的最后一行和行号。",
  "text = \"8\"\nn = int(text)\nprint(\"共\" + str(n + 2) + \"杯\")", [
  pred("a = \"5\"\nb = 5\nprint(type(a))\nprint(type(b))", [
    (STR + "\n" + INT, True, "a 加了引号，是文字；b 没有引号，是整数。"),
    (INT + "\n" + INT, False, "a 加了引号，是文字 \"5\"，不是整数。"),
    (INT + "\n" + STR, False, "顺序反了：先显示的是 a，a 加了引号。")], "有没有引号，决定它是文字还是数字。"),
  fill("屏幕要显示：10", "text = \"8\"\nprint({0} + 2)", ["int(text)", "text", "str(text)"], "int(text)", "10",
    {"text": "text 是文字，文字和整数不能相加，会报 TypeError。", "str(text)": "str(text) 还是文字，还是 TypeError。"}, "要做加法，先把文字变成整数。"),
  perr("这段程序报了 TypeError。怎么改，屏幕才会显示：共6杯", "n = 6\nprint(\"共\" + n + \"杯\")", "TypeError", 2, [
    ("print(\"共\" + str(n) + \"杯\")", True, "n 是整数，用 str() 变成文字再接。", "n = 6\nprint(\"共\" + str(n) + \"杯\")"),
    ("print(\"共\" + int(n) + \"杯\")", False, "n 本来就是整数，int() 之后还是整数，还是 TypeError。", "n = 6\nprint(\"共\" + int(n) + \"杯\")"),
    ("print(\"共\" + \"n\" + \"杯\")", False, "不报错了，但显示的是 共n杯，不是 6。", "n = 6\nprint(\"共\" + \"n\" + \"杯\")")],
    "TypeError：把类型统一了再接。", fixed="共6杯"),
  order("排好顺序。屏幕显示：25.0", ["price = \"12.5\"", "num = float(price)", "total = num * 2", "print(total)"], [3, 1, 0, 2], "25.0", "先有文字，再变成小数，再计算，最后显示。"),
  pred("print(\"3\" + \"4\")\nprint(int(\"3\") + int(\"4\"))\nprint(str(3) + str(4))", [
    ("34\n7\n34", True, "第一行文字相接；第二行变成整数后相加；第三行整数变成文字后又是相接。"),
    ("7\n7\n7", False, "只有第二行两边是整数。第一、三行两边是文字，+ 是相接。"),
    ("34\n7\n7", False, "第三行用了 str()，3 和 4 变成了文字，+ 是相接，得 34。")], "+ 做什么，取决于两边是文字还是数字。")],
  review=True))

# ---- 规格自查
def width(s): return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)
for l in L:
    assert len(l["exercises"]) == 5, l["id"]
    assert len(l["story"]) <= 90, (l["id"], len(l["story"]))
    ty = [e["type"] for e in l["exercises"]]
    assert "fill" in ty and ("order" in ty or l["title"].startswith("项目")), (l["id"], ty)  # 项目关按“一处一处修”的步骤出题，可以没有排序题
    for e in l["exercises"]:
        code = e.get("code") or "\n".join(e["lines"])
        longest = max(e.get("tokens", [""]), key=width)  # 填空题按最宽的词块算
        for ln in code.replace("{0}", longest).split("\n"): assert width(ln) <= 34, (l["id"], ln, width(ln))
        assert "+=" not in code
out = pathlib.Path(__file__).resolve().parent.parent / "content/unit6.json"
out.write_text(json.dumps({"id": "U6", "title": "类型与报错", "subtitle": "type、int()/str()/float()、读报错", "lessons": L}, ensure_ascii=False, indent=1) + "\n")
print("写出", out.name, len(L), "关", sum(len(l["exercises"]) for l in L), "题")
