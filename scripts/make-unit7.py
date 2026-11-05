# 生成 content/unit7.json（第 7 单元「字典」前两关草稿：U7L1 按名字查库存、U7L2 改库存）。
# 草稿：还没挂进 content/course.json（U7 仍是“即将推出”占位），app 读不到。
# 内容在这里改，再运行：python3 scripts/make-unit7.py && python3 scripts/verify-content.py --extra content/unit7.json
# 只用已学语法（U1–U6：print、变量、运算、字符串、比较、if、for/while、列表、type、int()/str()、读报错），加上本单元新教的内容：
#   U7L1 字典 { }、键和值、stock[键]（查没有的键 → KeyError）；U7L2 给已有的键写新值：stock[键] = 新值，基于旧值：stock[键] = stock[键] - 1。
# 本部分不用：in / not in 查键、.get()、新增键、删除、遍历字典、keys()/values()/items()、len(字典)、+=、f-string、嵌套字典。
# 所有题只改“已经存在的键”：写一个原来没有的键会新增，那是下一关的内容，这里的题不出现。
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

# ---------------- U7L1：按名字查库存 ----------------
S1 = 'stock = {"奶茶": 12, "果茶": 5}'
L1_INTRO = S1 + '\nprint(stock)\nprint(stock["果茶"])'
Q1 = S1 + '\nprint(stock["果茶"])'
Q2 = S1 + '\nname = "奶茶"\nprint(name, stock[name])'
Q3_CODE = 'stock = {"奶茶": 12, "果茶": 5, "咖啡": 8}\nprint(stock[{0}])'
def q3_prog(tok): return Q3_CODE.replace("{0}", tok)
Q4 = S1 + '\nprint(stock["咖啡"])'

# 题面里写出来的输出都用真实运行核对
assert real_out(Q1) == "5" and real_out(Q2) == "奶茶 12"
assert real_out(L1_INTRO) == "{'奶茶': 12, '果茶': 5}\n5"
assert real_out(q3_prog('"咖啡"')) == "8" and real_out(q3_prog('"果茶"')) == "5"
assert err_type(q3_prog("2")) == "KeyError" and err_type(q3_prog("咖啡")) == "NameError"
assert err_type(Q4) == "KeyError"
# 干扰项里提到的“别的错误类型”也都是真的：列表下标越界 IndexError、变量没定义 NameError、文字 + 整数 TypeError
assert err_type('cups = [2, 5]\nprint(cups[2])') == "IndexError"
assert err_type('print(咖啡)') == "NameError"
assert err_type('print("咖啡" + 8)') == "TypeError"
assert real_error(Q4)["msg"] == "'咖啡'"

# ---------------- U7L2：改库存 ----------------
Q5 = S1 + '\nstock["果茶"] = 9\nprint(stock)'
Q6 = S1 + '\nstock["奶茶"] = stock["奶茶"] - 1\nprint(stock["奶茶"], stock["果茶"])'
O72 = ['stock = {"奶茶": 12}', 'print("卖前", stock["奶茶"])', 'stock["奶茶"] = stock["奶茶"] - 3', 'print("卖后", stock["奶茶"])']
Q8 = S1 + '\nstock["果茶"] - 1\nprint(stock["果茶"])'
assert real_out(Q5) == "{'奶茶': 12, '果茶': 9}"
assert real_out(Q6) == "11 5"
assert real_out("\n".join(O72)) == "卖前 12\n卖后 9"
assert real_out(Q8) == "5"
# 干扰项的输出（解释里写到的）：每一个都是真实运行得到的
assert real_out(S1 + '\nstock["果茶"] = stock["果茶"] + 9\nprint(stock)') == "{'奶茶': 12, '果茶': 14}"   # 误以为“加上去”
assert real_out(S1 + '\nstock["奶茶"] = 9\nprint(stock)') == "{'奶茶': 9, '果茶': 5}"                     # 改错了键
assert real_out(S1 + '\nstock["奶茶"] = 1\nprint(stock["奶茶"], stock["果茶"])') == "1 5"               # 把右边当成“只写 1”
assert real_out(S1 + '\nprint(stock["奶茶"], stock["果茶"])') == "12 5"                                   # 没存回去的样子
assert real_out(S1 + '\nprint(stock["果茶"] - 1)') == "4"                                                 # 算出来的是 4，但没存回

lessons = [
 {"id": "U7L1", "title": "按名字查库存", "concept": "字典、键和值、stock[键]",
  "story": "库存按名字记：奶茶 12 杯、果茶 5 杯。列表靠位置找（cups[0]），字典（英文叫 dict）靠名字找：stock = {\"奶茶\": 12, \"果茶\": 5}。花括号里是一对一对的“键: 值”：键是名字（\"奶茶\"），值是对应的数量（12），冒号连着，逗号隔开。取值时在方括号里写键：stock[\"果茶\"] 得到 5，写的是名字，不是第几个。键要和字典里写的一模一样；查一个字典里没有的键，会报 KeyError。注意 print(stock) 显示的字典，文字外面是单引号：{'奶茶': 12, '果茶': 5}，Python 习惯这样显示。",
  "introCode": L1_INTRO,
  "exercises": [
    pred(SHOW, Q1, [
        ("5", T, "stock[\"果茶\"] 按键“果茶”查，对应的值是 5。"),
        ("12", F, "12 是奶茶的数量。方括号里写的是“果茶”，查到的是果茶的值 5。"),
        ("果茶", F, "方括号里写的是键，查出来的是这个键对应的值（5），不是键本身。"),
        ("1", F, "字典不按位置找。cups[1] 是列表的写法；字典方括号里写的是键，这里是 \"果茶\"。")],
        tip="stock[键] 查出这个键对应的值。"),
    pred(SHOW, Q2, [
        ("奶茶 12", T, "name 里放着文字 \"奶茶\"，stock[name] 就是 stock[\"奶茶\"]，值是 12；print 用逗号隔开，中间补一个空格。"),
        ("name 12", F, "name 没有引号，是变量，print 显示的是它里面的文字：奶茶。"),
        ("奶茶 5", F, "5 是果茶的数量；name 里是“奶茶”，奶茶对应的是 12。"),
        ("奶茶 stock[name]", F, "stock[name] 没有引号，不是文字，是要 Python 去查的：查出来是 12。")],
        tip="方括号里可以放变量：变量里是什么键，就查什么键。"),
    {**fill("屏幕要显示：8", Q3_CODE,
        ["\"咖啡\"", "咖啡", "2", "\"果茶\""], ["\"咖啡\""], "8",
        {"咖啡": "咖啡没有引号，Python 会把它当成变量名去找，找不到，会报 NameError。键是文字，要写成 \"咖啡\"。",
         "2": "字典不按位置找：stock[2] 是在找一个叫 2 的键，字典里没有，会报 KeyError。咖啡虽然写在第 3 个，也不能用 2 去取。",
         "\"果茶\"": "stock[\"果茶\"] 是 5，不是 8。8 是咖啡的数量。"},
        "要的是咖啡的数量：方括号里写键 \"咖啡\"，注意带引号。")},
    pick("查库存时出了报错。最后一行 KeyError: '咖啡' 合起来是在说什么？", "type", [
        opt("字典里没有叫 '咖啡' 的键", T, "KeyError 就是“键错误”：用来查的键，字典里没有。这个字典只有 \"奶茶\" 和 \"果茶\"，没有 \"咖啡\"，所以查不到。冒号后面的 '咖啡' 就是那个找不到的键。", value="KeyError"),
        opt("用到了一个还没有定义的变量名", F, "那种错误叫 NameError，信息里写 name '…' is not defined。这里的 \"咖啡\" 带着引号，是文字，不是变量名，最后一行写的是 KeyError。", value="NameError"),
        opt("列表的下标超出了范围", F, "那种错误叫 IndexError，是列表（比如 cups[2]）位置越界。这里是字典，没有“第几个”，最后一行写的是 KeyError。", value="IndexError"),
        opt("文字和整数放在一起用 + 接了", F, "那种错误叫 TypeError。这行代码里没有 +，最后一行写的是 KeyError。", value="TypeError"),
    ], code=Q4, trace=trace_of(Q4), tip="最后一行：冒号前面是错误类型，冒号后面是具体信息——这里就是找不到的那个键。"),
  ]},
 {"id": "U7L2", "title": "改库存", "concept": "给已有的键写新值",
  "story": "卖掉了东西，库存要改。给已经有的键写新值：stock[\"果茶\"] = 9，字典里果茶的数量就换成 9——是替换旧值，不是加上去。想在旧数量的基础上改，右边先查出旧值再算：stock[\"奶茶\"] = stock[\"奶茶\"] - 1，Python 先算右边（12 - 1 得 11），再把 11 存回奶茶。只写 stock[\"奶茶\"] - 1 不行：这只是算了一下，没有存回去，库存没变。改的是字典本身，改完之后再去查，查到的就是新值。这一关只改字典里已经有的键。",
  "introCode": S1 + '\nstock["果茶"] = 9\nstock["奶茶"] = stock["奶茶"] - 1\nprint(stock)',
  "exercises": [
    pred(SHOW, Q5, [
        ("{'奶茶': 12, '果茶': 9}", T, "stock[\"果茶\"] = 9 把果茶的值换成 9，奶茶没动。"),
        ("{'奶茶': 12, '果茶': 14}", F, "= 是“换成”，不是“加上”：5 被换成了 9，不是 5 + 9。"),
        ("{'奶茶': 12, '果茶': 5}", F, "第 2 行已经运行过了：果茶的值被换成了 9，print 显示的是改完之后的字典。"),
        ("{'奶茶': 9, '果茶': 5}", F, "改错了名字：第 2 行方括号里写的是 \"果茶\"，被换成 9 的是果茶，奶茶没动。")],
        tip="stock[键] = 新值：把这个键原来的值换成新值。"),
    pred(SHOW, Q6, [
        ("11 5", T, "第 2 行先算右边：stock[\"奶茶\"] 是 12，12 - 1 得 11，存回奶茶；果茶没动，还是 5。"),
        ("12 5", F, "第 2 行把算出来的 11 存回了奶茶，所以后面查到的是 11，不是原来的 12。"),
        ("1 5", F, "右边是 stock[\"奶茶\"] - 1，用的是奶茶原来的数量 12 减 1，得 11，不是 1。"),
        ("11 4", F, "第 2 行只改了奶茶。果茶这个键没有动，还是 5。")],
        tip="等号右边先算，再把结果存回左边的键。"),
    order("排好顺序。屏幕先显示“卖前 12”，再显示卖掉 3 杯之后的“卖后 9”", O72, [2, 3, 0, 1], valid_orders(O72, "卖前 12\n卖后 9"),
        "卖前 12\n卖后 9", "先有字典；改之前先看一次；再改；改完再看一次。"),
    pred(SHOW, Q8, [
        ("5", T, "第 3 行 stock[\"果茶\"] - 1 只算出了 4，没有存回字典，随后就丢掉了，不会报错，字典没变。"),
        ("4", F, "算出了 4，但没有写 stock[\"果茶\"] = …，没有存回去，字典里还是 5。"),
        ("报错", F, "stock[\"果茶\"] - 1 单独写一行不会报错：Python 算完就丢掉结果，库存不变。")],
        tip="想改库存，要写成 stock[键] = 新值；只做计算，字典不会变。"),
  ]},
]

unit = {"id": "U7", "title": "字典", "subtitle": "dict：按名字存取", "lessons": lessons}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit7.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons))
