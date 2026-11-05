# 生成 content/unit7.json（第 7 单元「字典」前两关草稿：U7L1 按名字查库存、U7L2 改库存）。
# 草稿（产品官 U7 按 6 关排：L1 查值、L2 更新、L3 in/.get() 安全查、L4 新增与删除、L5 遍历、L6 库存项目）。L1–L5 在 lessons，L6（代码题待运行器）在 heldLessons，和 U6 同一格式：还没挂进 content/course.json（U7 仍是“即将推出”占位），app 读不到。
# 内容在这里改，再运行：python3 scripts/make-unit7.py && python3 scripts/verify-content.py --extra content/unit7.json
# 只用已学语法（U1–U6：print、变量、运算、字符串、比较、if、for/while、列表、type、int()/str()、读报错），加上本单元新教的内容：
#   U7L1 字典 { }、键和值、stock[键]（查没有的键 → KeyError）；U7L2 给已有的键写新值：stock[键] = 新值，基于旧值：stock[键] = stock[键] - 1；
#   U7L3 "键" in 字典 / not in（只看键）、.get(键)、.get(键, 默认值)、None；U7L4 给没有的键写值 = 新增（拼错键名会悄悄新增）、del 字典[键]、print(字典) 的显示格式。
# 前两关不出现完整字典的显示格式（单引号）；L4 第一次需要读完整字典时才讲。
# 本部分不用：遍历字典、keys()/values()/items()、len(字典)、pop、+=、f-string、嵌套字典。
# L1–L3 的题只用“已经存在的键”（L3 的 in / .get 例外：专门拿不存在的键来查，但只读不写）；写不存在的键 = 新增，到 L4 才出现。
# 学生没见过 NameError / IndexError / None：用到它们的解释都自带一句话说明，不假设学过。
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
L1_INTRO = S1 + '\nprint(stock["奶茶"])\nprint(stock["果茶"])'
Q1 = S1 + '\nprint(stock["果茶"])'
Q2 = S1 + '\nname = "奶茶"\nprint(name, stock[name])'
Q3_CODE = 'stock = {"奶茶": 12, "果茶": 5, "咖啡": 8}\nprint(stock[{0}])'
def q3_prog(tok): return Q3_CODE.replace("{0}", tok)
Q4 = S1 + '\nprint(stock["咖啡"])'

# 题面里写出来的输出都用真实运行核对
assert real_out(Q1) == "5" and real_out(Q2) == "奶茶 12"
assert real_out(L1_INTRO) == "12\n5"
assert real_out(q3_prog('"咖啡"')) == "8" and real_out(q3_prog('"果茶"')) == "5"
assert err_type(q3_prog("2")) == "KeyError" and err_type(q3_prog("咖啡")) == "NameError"
assert err_type(Q4) == "KeyError"
# 干扰项里提到的“别的错误类型”也都是真的：列表下标越界 IndexError、变量没定义 NameError、文字 + 整数 TypeError
assert err_type('cups = [2, 5]\nprint(cups[2])') == "IndexError"
assert err_type('print(咖啡)') == "NameError"
assert err_type('print("咖啡" + 8)') == "TypeError"
assert real_error(Q4)["msg"] == "'咖啡'"

# ---------------- U7L2：改库存 ----------------
Q5 = S1 + '\nstock["果茶"] = 9\nprint(stock["奶茶"], stock["果茶"])'
Q6 = S1 + '\nstock["奶茶"] = stock["奶茶"] - 1\nprint(stock["奶茶"], stock["果茶"])'
O72 = ['stock = {"奶茶": 12}', 'print("卖前", stock["奶茶"])', 'stock["奶茶"] = stock["奶茶"] - 3', 'print("卖后", stock["奶茶"])']
Q8 = S1 + '\nstock["果茶"] - 1\nprint(stock["果茶"])'
assert real_out(Q5) == "12 9"
# 解释里写到的“第 N 行”都对得上程序（行号从 1 数）
assert Q5.split("\n")[1] == 'stock["果茶"] = 9'                       # L2-Q1 “第 2 行”
assert Q6.split("\n")[1] == 'stock["奶茶"] = stock["奶茶"] - 1'       # L2-Q2 “第 2 行”
assert Q8.split("\n")[1] == 'stock["果茶"] - 1'                       # L2-Q4 “第 2 行”
assert real_error(Q4)["line"] == 2                                    # L1-Q4 报错在第 2 行
assert real_out(Q6) == "11 5"
assert real_out("\n".join(O72)) == "卖前 12\n卖后 9"
assert real_out(Q8) == "5"
# 干扰项的输出（解释里写到的）：每一个都是真实运行得到的
assert real_out(S1 + '\nstock["果茶"] = stock["果茶"] + 9\nprint(stock["奶茶"], stock["果茶"])') == "12 14"   # 误以为“加上去”
assert real_out(S1 + '\nstock["奶茶"] = 9\nprint(stock["奶茶"], stock["果茶"])') == "9 5"                     # 改错了键
assert real_out(S1 + '\nstock["奶茶"] = 1\nprint(stock["奶茶"], stock["果茶"])') == "1 5"               # 把右边当成“只写 1”
assert real_out(S1 + '\nprint(stock["奶茶"], stock["果茶"])') == "12 5"                                   # 没存回去的样子
assert real_out(S1 + '\nprint(stock["果茶"] - 1)') == "4"                                                 # 算出来的是 4，但没存回

lessons = [
 {"id": "U7L1", "title": "按名字查库存", "concept": "字典、键和值、stock[键]",
  "story": "库存按名字记：奶茶 12 杯、果茶 5 杯。列表靠位置找（cups[0]），字典（英文叫 dict）靠名字找：stock = {\"奶茶\": 12, \"果茶\": 5}。花括号里是一对一对的“键: 值”：键是名字（\"奶茶\"），值是对应的数量（12），冒号连着，逗号隔开。取值时在方括号里写键：stock[\"果茶\"] 得到 5，写的是名字，不是第几个。键要和字典里写的一模一样；查一个字典里没有的键，会报 KeyError。",
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
        {"咖啡": "咖啡没有引号，Python 会把它当成变量名去找，找不到，会报 NameError（用到了没有定义的变量名）。键是文字，要写成 \"咖啡\"。",
         "2": "字典不按位置找：stock[2] 是在找一个叫 2 的键，字典里没有，会报 KeyError。咖啡虽然写在第 3 个，也不能用 2 去取。",
         "\"果茶\"": "stock[\"果茶\"] 是 5，不是 8。8 是咖啡的数量。"},
        "要的是咖啡的数量：方括号里写键 \"咖啡\"，注意带引号。")},
    pick("查库存时出了报错。最后一行 KeyError: '咖啡' 合起来是在说什么？", "type", [
        opt("字典里没有叫 '咖啡' 的键", T, "KeyError 就是“键错误”：用来查的键，字典里没有。这个字典只有 \"奶茶\" 和 \"果茶\"，没有 \"咖啡\"，所以查不到。冒号后面的 '咖啡' 就是那个找不到的键。", value="KeyError"),
        opt("用到了一个还没有定义的变量名", F, "那是 NameError：程序里用到了一个从没给过值的变量名。这里的 \"咖啡\" 带着引号，是文字，不是变量名；最后一行写的是 KeyError。", value="NameError"),
        opt("列表的下标超出了范围", F, "那是 IndexError：列表只有 2 个元素，却去取第 3 个（位置超出了范围）。这里是字典，查的是键，不是位置；最后一行写的是 KeyError。", value="IndexError"),
        opt("文字和整数放在一起用 + 接了", F, "那是 TypeError：类型搭配不对，比如文字和整数用 + 接在一起。这行代码里没有 +；最后一行写的是 KeyError。", value="TypeError"),
    ], code=Q4, trace=trace_of(Q4), tip="最后一行：冒号前面是错误类型，冒号后面是具体信息——这里就是找不到的那个键。"),
  ]},
 {"id": "U7L2", "title": "改库存", "concept": "给已有的键写新值",
  "story": "卖掉了东西，库存要改。给已经有的键写新值：stock[\"果茶\"] = 9，字典里果茶的数量就换成 9——是替换旧值，不是加上去。想在旧数量的基础上改，右边先查出旧值再算：stock[\"奶茶\"] = stock[\"奶茶\"] - 1，Python 先算右边（12 - 1 得 11），再把 11 存回奶茶。只写 stock[\"奶茶\"] - 1 不行：这只是算了一下，没有存回去，库存没变。改的是字典本身，改完之后再去查，查到的就是新值。这一关只改字典里已经有的键。",
  "introCode": S1 + '\nstock["果茶"] = 9\nstock["奶茶"] = stock["奶茶"] - 1\nprint(stock["奶茶"], stock["果茶"])',
  "exercises": [
    pred(SHOW, Q5, [
        ("12 9", T, "第 2 行 stock[\"果茶\"] = 9 把果茶的值换成 9，奶茶没动，还是 12。"),
        ("12 14", F, "= 是“换成”，不是“加上”：5 被换成了 9，不是 5 + 9。"),
        ("12 5", F, "第 2 行已经运行过了：果茶的值被换成了 9，print 查到的是改完之后的值。"),
        ("9 5", F, "改错了名字：第 2 行方括号里写的是 \"果茶\"，被换成 9 的是果茶；奶茶没动，还是 12。")],
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
        ("5", T, "第 2 行 stock[\"果茶\"] - 1 只算出了 4，没有存回字典，随后就丢掉了，不会报错，字典没变。"),
        ("4", F, "算出了 4，但没有写 stock[\"果茶\"] = …，没有存回去，字典里还是 5。"),
        ("报错", F, "stock[\"果茶\"] - 1 单独写一行不会报错：Python 算完就丢掉结果，库存不变。")],
        tip="想改库存，要写成 stock[键] = 新值；只做计算，字典不会变。"),
  ]},
]


# ---------------- U7L3：先问再取（in、.get、None、默认值）----------------
P_IN = S1 + '\nprint("奶茶" in stock)\nprint("咖啡" in stock)\nprint(12 in stock)'
P_GET = S1 + '\nprint(stock.get("果茶"))\nprint(stock.get("咖啡"))\nprint(stock.get("咖啡", 0))'
Q11_CODE = S1 + '\nname = "咖啡"\nif {0}:\n    print(stock[name])\nelse:\n    print("没有这个饮品")'
def q11_prog(tok): return Q11_CODE.replace("{0}", tok)
P_FIX = S1 + '\nprint(stock["咖啡"])'
L3_INTRO = S1 + '\nprint("咖啡" in stock)\nprint(stock.get("咖啡"))\nprint(stock.get("咖啡", 0))'
assert real_out(P_IN) == "True\nFalse\nFalse"
assert real_out(P_GET) == "5\nNone\n0"
assert real_out(L3_INTRO) == "False\nNone\n0"
assert real_out(q11_prog("name in stock")) == "没有这个饮品"
assert err_type(q11_prog("name not in stock")) == "KeyError" and err_type(q11_prog("stock[name]")) == "KeyError"
assert real_error(P_FIX)["line"] == 2 and P_FIX.split("\n")[1] == 'print(stock["咖啡"])'
# 干扰项（解释里写到的输出）都是真实运行得到的
assert real_out(S1 + '\nprint("奶茶" in stock)') == "True"                                          # 奶茶是键
assert real_out(S1 + '\nprint(stock.get("咖啡"))') == "None"
assert real_out(S1 + '\nprint(stock.get("果茶", 0))') == "5"                                        # 键存在时，默认值不起作用
assert real_out(S1 + '\nprint(stock.get("咖啡", 0))') == "0"
assert real_out(S1 + '\nprint("咖啡" in stock)') == "False"
assert real_out(S1 + '\nstock.get("咖啡", 0)\nprint("咖啡" in stock)') == "False"   # 讲解：.get(键, 0) 只返回默认值，不会把咖啡加进字典
assert real_out(S1 + '\nstock.get("咖啡", 0)\nprint(stock.get("咖啡"))') == "None"

def fixopt(text, new, good_why, bad_why, program=P_FIX, old='print(stock["咖啡"])', expected="0"):
    """把第 2 行换成 new，真实运行：不报错且输出 == expected 才算对；解释里的输出来自真实运行。"""
    fixed = program.replace(old, new); assert fixed != program
    out, err = run(fixed); good = err is None and out == expected
    return opt(text, good, good_why if good else bad_why(out, err), fixed=fixed)
def _shows(out, err): return f"报错 {err}" if err else f"显示 {out}"

# ---------------- U7L4：新增与删除 ----------------
P_ADD = S1 + '\nstock["咖啡"] = 8\nprint(stock)'
P_TYPO = S1 + '\nstock["果查"] = 4\nprint(stock["果茶"])\nprint(stock["果查"])'
P_DEL = S1 + '\ndel stock["果茶"]\nprint("果茶" in stock)\nprint(stock.get("果茶", 0))'
O74 = ['stock = {"奶茶": 12}', 'if "果茶" not in stock:', '    stock["果茶"] = 0', 'stock["果茶"] = stock["果茶"] + 5', 'print(stock["果茶"])']
L4_INTRO = S1 + '\nstock["咖啡"] = 8\ndel stock["果茶"]\nprint(stock)'
assert real_out(P_ADD) == "{'奶茶': 12, '果茶': 5, '咖啡': 8}"
assert real_out(P_TYPO) == "5\n4"
assert real_out(P_DEL) == "False\n0"
assert real_out("\n".join(O74)) == "5"
assert real_out(L4_INTRO) == "{'奶茶': 12, '咖啡': 8}"
assert P_TYPO.split("\n")[1] == 'stock["果查"] = 4'
assert P_TYPO.split("\n")[3] == 'print(stock["果查"])'                # L4-Q2 “第 4 行”
assert P_ADD.split("\n")[1] == 'stock["咖啡"] = 8' and P_DEL.split("\n")[1] == 'del stock["果茶"]'   # L4-Q1/Q3 “第 2 行”
assert err_type(S1 + '\ndel stock["咖啡"]') == "KeyError"
assert err_type(S1 + '\nprint(stock["果查"])') == "KeyError"      # 讲解：直接读取不存在的键仍然 KeyError                                            # 讲解：删不存在的键会 KeyError
# 干扰项
assert real_out(S1 + '\nprint(stock)') == "{'奶茶': 12, '果茶': 5}"                                  # “没加进去”的样子
assert real_out(S1 + '\nstock["果茶"] = 4\nprint(stock["果茶"])\nprint(stock["果茶"])') == "4\n4"       # 真改对了果茶才会 4/4
assert real_out(S1 + '\nprint(stock["果茶"])\nprint(stock.get("果查", 0))') == "5\n0"
assert real_out(S1 + '\nprint("果茶" in stock)\nprint(stock["果茶"])') == "True\n5"                  # 没删的样子
assert real_out(S1 + '\ndel stock["果茶"]\nprint("果茶" in stock)\nprint(stock.get("果茶"))') == "False\nNone"  # 没写默认值的样子

lessons += [
 {"id": "U7L3", "title": "先问再取", "concept": "in、.get()、None 和默认值",
  "story": "查一个字典里没有的键，会报 KeyError，程序就停了。想不让它停，有两个办法。第一个：先问一问。\"咖啡\" in stock 问的是：咖啡是不是字典里的一个键，答案是 True 或 False（not in 是反过来问）。注意字典的 in 只看键，不看值：12 是奶茶的数量（值），所以 12 in stock 是 False。配合 if：先问有没有，有才取。第二个：stock.get(\"咖啡\")，找到这个键，就和 stock[\"咖啡\"] 一样给出值；没有找到这个键，并且没给默认值时，.get() 返回 None（意思是“没有”），不会报错。还可以在逗号后面写一个默认值：stock.get(\"咖啡\", 0)，没找到就返回 0；找到了，返回的仍然是真实的值，默认值不起作用。注意：.get(\"咖啡\", 0) 只是返回默认值，不会把咖啡加进字典。",
  "introCode": L3_INTRO,
  "exercises": [
    pred(SHOW, P_IN, [
        ("True\nFalse\nFalse", T, "奶茶是字典的键，True；咖啡不是键，False；12 是奶茶的数量（值），不是键，in 只看键，False。"),
        ("True\nFalse\nTrue", F, "最后一行 12 in stock：in 只看键，不看值。12 是值，不是键，是 False。"),
        ("False\nFalse\nFalse", F, "第一行 \"奶茶\" in stock：奶茶是字典里的键，是 True。")],
        tip="字典的 in 问的是：这个名字是不是字典里的键。"),
    pred(SHOW, P_GET, [
        ("5\nNone\n0", T, "果茶有，给出 5；咖啡没有找到，也没给默认值，.get() 返回 None；咖啡没有找到，但写了默认值 0，就返回 0。"),
        ("5\n0\n0", F, "第二行没给默认值：没有找到这个键，并且没给默认值时，.get() 返回 None（意思是“没有”），不是 0。"),
        ("5\nNone\nNone", F, "第三行逗号后面的 0 是默认值：查不到咖啡，就用它，显示 0。"),
        ("报错", F, ".get() 查不到时不报错：没有默认值给 None，有默认值给默认值。只有 stock[\"咖啡\"] 这种写法才会报 KeyError。")],
        tip="没找到这个键、又没给默认值：.get() 返回 None；给了默认值：返回默认值。"),
    fill("咖啡还没进货。屏幕要显示：没有这个饮品", Q11_CODE,
        ["name in stock", "name not in stock", "stock[name]"], ["name in stock"], "没有这个饮品",
        {"name not in stock": "咖啡不在字典里，所以 name not in stock 是 True，程序会去取 stock[name]，结果报 KeyError。要的是“有才取”：用 name in stock，咖啡没有就走 else。",
         "stock[name]": "计算条件时，stock[name] 已经在查咖啡：键不存在就报 KeyError，if 和 else 两个分支都还没执行。"},
        "先问“name 在不在 stock 里”：在才取，不在就走 else。"),
    pick("咖啡还没进货，字典里没有这个键，下面的程序报了 KeyError。要让屏幕显示 0（而不是报错），第 2 行怎么改？", "fix", [
        fixopt("改成：print(stock.get(\"咖啡\", 0))", 'print(stock.get("咖啡", 0))', ".get() 查不到咖啡不报错，用默认值 0，屏幕显示 0。", None),
        fixopt("改成：print(stock.get(\"咖啡\"))", 'print(stock.get("咖啡"))', None, lambda o, e: f"不报错了，但{_shows(o, e)}：没有找到这个键，并且没给默认值，.get() 返回 None，不是 0。"),
        fixopt("改成：print(\"咖啡\" in stock)", 'print("咖啡" in stock)', None, lambda o, e: f"不报错了，但{_shows(o, e)}：in 问的是“在不在”，答案是 True / False，不是数量。"),
        fixopt("改成：print(stock.get(\"果茶\", 0))", 'print(stock.get("果茶", 0))', None, lambda o, e: f"{_shows(o, e)}：查的是果茶，果茶有，用的是真实的值；要查的是咖啡。"),
    ], code=P_FIX, trace=trace_of(P_FIX), expected="0", tip="没有这个键时想要一个默认值：.get(键, 默认值)。"),
  ]},
 {"id": "U7L4", "title": "进货与下架", "concept": "新增、拼错键名、del",
  "story": "给字典里没有的键写值，就是新增一对：stock[\"咖啡\"] = 8，字典里多了咖啡。写法和上一关的“替换”一样：键已经有，就是替换；键没有，就是新增，Python 不会报错提醒你。所以给拼错的键名赋值时，也不会报错，而是新增这个拼错的键，原来的键没动。（只是读取一个不存在的键，比如 stock[\"果查\"]，仍然会报 KeyError。）删掉一对：del stock[\"果茶\"]，键和值一起删掉；要删的键必须存在，否则也会报 KeyError。现在可以直接看整个字典了：print(stock) 显示 {'奶茶': 12, '果茶': 5}，每一对是 '键': 值，文字外面是单引号（Python 习惯这样显示，你写的双引号也可以）。新增的键排在最后面。",
  "introCode": L4_INTRO,
  "exercises": [
    pred(SHOW, P_ADD, [
        ("{'奶茶': 12, '果茶': 5, '咖啡': 8}", T, "咖啡原来没有，给它写值就是新增一对，排在最后面。"),
        ("{'奶茶': 12, '果茶': 5}", F, "第 2 行已经运行了：给没有的键写值，会把这一对加进去。"),
        ("{'咖啡': 8, '奶茶': 12, '果茶': 5}", F, "新增的键排在最后面，不是最前面。"),
        ("报错", F, "给没有的键写值不会报错，是新增。只有“取”一个没有的键，才会报 KeyError。")],
        tip="键没有，写值就是新增；键已经有，写值就是替换。"),
    pred("小码想把果茶的库存改成 4，却把“茶”打成了“查”。点单屏运行这段程序，屏幕上会显示什么？", P_TYPO, [
        ("5\n4", T, "第 2 行是给 \"果查\" 赋值，它原来没有，写值就是新增一对，不会报错；果茶根本没被改，还是 5。第 4 行读的是刚新增的 \"果查\"，是 4。"),
        ("4\n4", F, "果茶没有被改：第 2 行写的是 \"果查\"，是另一个键。"),
        ("5\n报错", F, "第 2 行是赋值，不是读取：给没有的键写值会新增这一对，所以第 4 行读 stock[\"果查\"] 时它已经存在，是 4。")],
        tip="给拼错的新键赋值时，会新增这个键；直接读取不存在的键，仍会报 KeyError。"),
    pred(SHOW, P_DEL, [
        ("False\n0", T, "del 把果茶这一对（键和值）一起删了，所以果茶不在字典里（False）；用 .get(\"果茶\", 0) 查，查不到，用默认值 0。"),
        ("True\n5", F, "第 2 行 del stock[\"果茶\"] 已经运行：键和值都被删掉了，不是只删值。"),
        ("False\nNone", F, "第二个 print 写了默认值 0：查不到果茶，就用 0，不是 None。"),
        ("报错", F, "果茶在字典里，del 可以删，不会报错。要删的键不存在才会报 KeyError。")],
        tip="del 字典[键]：键和值一起删掉。"),
    order("排好顺序。进货 5 杯果茶：字典里没有果茶时，先记成 0，再加上 5，最后显示：5", O74, [3, 1, 4, 0, 2], valid_orders(O74, "5"),
        "5", "先有字典；再检查有没有果茶，没有就记成 0；然后加 5；最后显示。"),
  ]},
]


# ---------------- U7L5：一个一个看（遍历字典）----------------
P5_NAMES = S1 + '\nfor name in stock:\n    print(name)'
P5_SUM = S1 + '\ntotal = 0\nfor name in stock:\n    total = total + stock[name]\nprint(total)'
Q5C_CODE = 'stock = {"奶茶": 12, "果茶": 5, "咖啡": 3}\nlow = 0\nfor name in stock:\n    if stock[name] {0} 5:\n        low = low + 1\nprint(low)'
def q5c_prog(tok): return Q5C_CODE.replace("{0}", tok)
P5_BUG = S1 + '\ntotal = 0\nfor name in stock:\n    total = total + name\nprint(total)'
L5_INTRO = S1 + '\nfor name in stock:\n    print(name, stock[name])'
assert real_out(L5_INTRO) == "奶茶 12\n果茶 5"
assert real_out(P5_NAMES) == "奶茶\n果茶"
assert real_out(P5_SUM) == "17"
assert real_out(q5c_prog("<")) == "1" and real_out(q5c_prog("<=")) == "2" and real_out(q5c_prog(">=")) == "2"
assert real_out(S1 + '\nfor name in stock:\n    print(stock[name])') == "12\n5"                          # “name 是值”的误解会得到的样子
assert real_out(S1 + '\nfor name in stock:\n    print(name, stock[name])') == "奶茶 12\n果茶 5"
assert real_out(S1 + '\ntotal = 0\nfor name in stock:\n    total = total + 1\nprint(total)') == "2"        # 数了键的个数
assert real_out(S1 + '\ntotal = 0\nfor name in stock:\n    total = stock[name]\nprint(total)') == "5"       # 每轮覆盖，只剩最后一个
assert err_type(P5_BUG) == "TypeError" and real_error(P5_BUG)["line"] == 4 and P5_BUG.split("\n")[3] == "    total = total + name"
assert real_error(P5_BUG)["msg"] == "unsupported operand type(s) for +: 'int' and 'str'"
assert P5_SUM.split("\n")[3] == "    total = total + stock[name]"

_HEAD5 = "\n".join(P5_BUG.split("\n")[:3])
def lineopt5(line, ok_why, bad_why):
    """选项文字就是“第 4 行改成：…”（一行）；整段程序 = 前 3 行 + 这一行（循环里缩进）+ 最后的 print(total)，真实运行核对。"""
    fixed = _HEAD5 + "\n    " + line + "\nprint(total)"
    out, err = run(fixed); good = err is None and out == "17"
    return opt("第 4 行改成：" + line, good, ok_why if good else bad_why(out, err), fixed=fixed)
Q5D_OPTS = [
    lineopt5("total = total + stock[name]", "name 是键（文字），不能和整数相加；要加的是这个键对应的值，stock[name]：12 + 5 得 17。", None),
    lineopt5("total = total + int(name)", None, lambda o, e: f"int(\"奶茶\") 转不了：文字的内容不是整数写法，{_shows(o, e)}。要加的是键对应的值，不是把键转成整数。"),
    lineopt5("total = total + str(name)", None, lambda o, e: f"name 本来就是文字，str(name) 还是文字；整数加文字还是类型搭配不对，{_shows(o, e)}。"),
    lineopt5("total = total + len(name)", None, lambda o, e: f"不报错了，但{_shows(o, e)}：len(name) 数的是名字有几个字，不是库存数量。"),
]

# ---------------- U7L6：库存小项目（held：代码题待运行器）----------------
REF6 = '''if name not in stock:
    print("没有这个饮品")
elif cups > stock[name]:
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)
'''
START6 = 'stock[name] = stock[name] - cups\nprint("成交，剩", stock[name], "杯")\nprint(stock)\n'
def run_case(src, stock, name, cups):
    return run(f"stock = {stock!r}\nname = {name!r}\ncups = {cups!r}\n" + src)
def T6(tname, stock, name, cups, hidden=False, src=REF6):
    out, err = run_case(src, stock, name, cups); assert err is None, (tname, err)
    d = {"name": tname, "data": {"stock": stock, "name": name, "cups": cups}, "expected": out}
    if hidden: d["hidden"] = True
    return d
D0 = {"奶茶": 12, "果茶": 5}
T_PUB = [T6("3 杯奶茶，够", D0, "奶茶", 3), T6("8 杯果茶，库存不足", D0, "果茶", 8), T6("咖啡，不存在", D0, "咖啡", 2)]
T_HID = [T6("正好卖完", D0, "果茶", 5, True), T6("库存已经是 0", {"奶茶": 12, "果茶": 0}, "果茶", 1, True),
         T6("换一张库存表：不存在", {"咖啡": 4, "奶茶": 1}, "果茶", 1, True), T6("换一张库存表：成交", {"咖啡": 4, "奶茶": 1}, "咖啡", 3, True)]
# 手写核对公开例子（不是从脚本里抄的）：题面里写的规则 → 输出
assert T_PUB[0]["expected"] == "成交，剩 9 杯\n{'奶茶': 9, '果茶': 5}"
assert T_PUB[1]["expected"] == "库存不足\n{'奶茶': 12, '果茶': 5}"
assert T_PUB[2]["expected"] == "没有这个饮品\n{'奶茶': 12, '果茶': 5}"
assert T_HID[0]["expected"] == "成交，剩 0 杯\n{'奶茶': 12, '果茶': 0}"
assert T_HID[1]["expected"] == "库存不足\n{'奶茶': 12, '果茶': 0}"
assert T_HID[2]["expected"] == "没有这个饮品\n{'咖啡': 4, '奶茶': 1}"
assert T_HID[3]["expected"] == "成交，剩 1 杯\n{'咖啡': 1, '奶茶': 1}"
ALL6 = T_PUB + T_HID
def passes(src, tests=ALL6):
    return [(t["name"], run_case(src, t["data"]["stock"], t["data"]["name"], t["data"]["cups"])) for t in tests]
def fails(src, tests=ALL6):
    return [n for (n, (o, e)), t in zip(passes(src, tests), tests) if e is not None or o != t["expected"]]

# 起始代码：只有“成交”那条路（没有任何检查）。三个公开例子里只有第一个能过
assert fails(START6, T_PUB) == ["8 杯果茶，库存不足", "咖啡，不存在"]
# 按“可能看到的顺序”：咖啡先报 KeyError；加上“存在”判断后，库存不足不报错但算成了负数
assert run_case(START6, D0, "咖啡", 2)[1] == "KeyError"
Q61_HEAD = 'stock = {"奶茶": 12, "果茶": 5}\nname = "咖啡"\ncups = 2'
P_Q61 = Q61_HEAD + "\n" + START6.rstrip("\n")
Q62_HEAD = 'stock = {"奶茶": 12, "果茶": 5}\nname = "果茶"\ncups = 8'
Q62_BASE = '''if name in stock:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
else:
    print("没有这个饮品")
print(stock)'''
P_Q62 = Q62_HEAD + "\n" + Q62_BASE
assert real_error(P_Q61)["type"] == "KeyError" and real_error(P_Q61)["line"] == 4 and P_Q61.split("\n")[3] == 'stock[name] = stock[name] - cups'
assert real_out(P_Q62) == "成交，剩 -3 杯\n{'奶茶': 12, '果茶': -3}"
EXP_NOT_EXIST = "没有这个饮品\n{'奶茶': 12, '果茶': 5}"
EXP_SHORT = "库存不足\n{'奶茶': 12, '果茶': 5}"
def fullopt(head, text, code, expected, ok_why, bad_why):
    """选项文字是一句话；code 是照这句话改完后的代码（接在 head 后面），整段真实运行：不报错且输出 == expected 才算对。"""
    fixed = head + "\n" + code
    out, err = run(fixed); good = err is None and out == expected
    return opt(text, good, ok_why if good else bad_why(out, err), fixed=fixed)
def _one(o, e): return _shows(o, e).replace(chr(10), " / ")
Q61_OPTS = [
    fullopt(Q61_HEAD, "先问 name 在不在 stock 里：在才取、才改；不在就输出“没有这个饮品”", '''if name in stock:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
else:
    print("没有这个饮品")
print(stock)''', EXP_NOT_EXIST, "先问 name 在不在 stock 里：在才取、才改；不在就输出“没有这个饮品”。最后一行 print(stock) 在 if 外面，每种情况都显示库存表，库存没变。", None),
    fullopt(Q61_HEAD, "把 stock[name] 换成 stock.get(name, 0)，不存在就当库存是 0", '''stock[name] = stock.get(name, 0) - cups
print("成交，剩", stock[name], "杯")
print(stock)''', EXP_NOT_EXIST, None, lambda o, e: f"不报错了，但{_one(o, e)}：不存在的咖啡被当成库存 0，减完成了负数，赋值还把咖啡新增进了库存表。"),
    fullopt(Q61_HEAD, "先问 name not in stock：不在才去取、去卖；在的话输出“没有这个饮品”", '''if name not in stock:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
else:
    print("没有这个饮品")
print(stock)''', EXP_NOT_EXIST, None, lambda o, e: f"条件写反了：咖啡不在 stock 里，name not in stock 为 True，反而去取 stock[name]，{_one(o, e)}。"),
    fullopt(Q61_HEAD, "不存在时，先给它新增一项 0，再照常卖", '''if name not in stock:
    stock[name] = 0
stock[name] = stock[name] - cups
print("成交，剩", stock[name], "杯")
print(stock)''', EXP_NOT_EXIST, None, lambda o, e: f"不报错了，但{_one(o, e)}：先给不存在的咖啡新增了一项再卖，库存表里多了负数的咖啡；要求是不存在就输出“没有这个饮品”，库存不变。"),
]
Q62_OPTS = [
    fullopt(Q62_HEAD, "先问存在，再问杯数是不是比库存多（cups > stock[name]）：多就输出“库存不足”，否则才卖", '''if name not in stock:
    print("没有这个饮品")
elif cups > stock[name]:
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)''', EXP_SHORT, "杯数比库存多（8 > 5）时输出“库存不足”，什么都不改，库存仍是 5。顺序也对：先看存在不存在，再看够不够，最后才改库存。", None),
    fullopt(Q62_HEAD, "把比较写成 cups < stock[name]：杯数比库存少就输出“库存不足”", '''if name not in stock:
    print("没有这个饮品")
elif cups < stock[name]:
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)''', EXP_SHORT, None, lambda o, e: f"条件写反了：8 < 5 不成立，走到了 else，{_one(o, e)}。库存不足应该是杯数比库存多：cups > stock[name]。"),
    fullopt(Q62_HEAD, "先把库存减掉；减完发现小于 0，再输出“库存不足”", '''if name in stock:
    stock[name] = stock[name] - cups
    if stock[name] < 0:
        print("库存不足")
    else:
        print("成交，剩", stock[name], "杯")
else:
    print("没有这个饮品")
print(stock)''', EXP_SHORT, None, lambda o, e: f"检查得太晚：先减了库存才发现不够，{_one(o, e)}。库存不足时，库存应该保持不变：要先比较、再决定改不改。"),
    fullopt(Q62_HEAD, "只有杯数正好等于库存（cups == stock[name]）时，才输出“库存不足”", '''if name not in stock:
    print("没有这个饮品")
elif cups == stock[name]:
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)''', EXP_SHORT, None, lambda o, e: f"只有杯数正好等于库存才进“库存不足”：8 不等于 5，走到了 else，{_one(o, e)}。"),
]
P_Q63 = 'stock = {"奶茶": 12, "果茶": 5}\nname = "果茶"\ncups = 5\n' + REF6.rstrip("\n")
P_Q64 = 'stock = {"奶茶": 12, "果茶": 5}\nname = "咖啡"\ncups = 2\n' + REF6.rstrip("\n")
assert real_out(P_Q63) == "成交，剩 0 杯\n{'奶茶': 12, '果茶': 0}"
assert real_out(P_Q64) == "没有这个饮品\n{'奶茶': 12, '果茶': 5}"
assert real_out('stock = {"奶茶": 12, "果茶": 5}\nprint("库存不足")\nprint(stock)') == "库存不足\n{'奶茶': 12, '果茶': 5}"          # 把 5 杯当“不足”的样子
assert real_out('stock = {"奶茶": 12, "果茶": 0}\nprint("成交，剩", 0, "杯")\nprint(stock)') == "成交，剩 0 杯\n{'奶茶': 12, '果茶': 0}"

# 三种改法（答案以外的合理写法）和三种错误写法：都用真实运行核对
ALT6 = [
'''if name in stock:
    if cups <= stock[name]:
        stock[name] = stock[name] - cups
        print("成交，剩", stock[name], "杯")
    else:
        print("库存不足")
else:
    print("没有这个饮品")
print(stock)
''',
'''if name not in stock:
    print("没有这个饮品")
elif stock[name] < cups:
    print("库存不足")
else:
    left = stock[name] - cups
    stock[name] = left
    print("成交，剩", left, "杯")
print(stock)
''',
'''if name not in stock:
    print("没有这个饮品")
elif stock[name] - cups < 0:
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)
''']
WRONG6 = [
 ('''if name not in stock:
    print("没有这个饮品")
elif cups >= stock[name]:
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)
''', "边界：正好卖完（杯数等于库存）也算成交，用 > 不用 >=", ["正好卖完"]),
 ('''if cups > stock[name]:
    print("库存不足")
elif name not in stock:
    print("没有这个饮品")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)
''', "顺序反了：先比较 stock[name]，不存在的饮品直接 KeyError；要先问“有没有”再问“够不够”", ["咖啡，不存在", "换一张库存表：不存在"]),
 ('''if cups > stock.get(name, 0):
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)
''', "用 .get(name, 0) 把不存在的饮品当成库存 0，会输出“库存不足”，要求是“没有这个饮品”（两种情况要分开）", ["咖啡，不存在", "换一张库存表：不存在"]),
]
assert fails(REF6) == []
for i, a in enumerate(ALT6, 1): assert fails(a) == [], (i, fails(a))
for i, (w, why, want) in enumerate(WRONG6, 1): assert fails(w) == want, (i, fails(w), want)

# 示范（换一个场景：图书借阅），拆成三步：先问有没有、再问够不够、最后才改
WORKED6 = {"code": 'books = {"童话": 3, "科幻": 0}\ntitle = "科幻"\nif title not in books:\n    print("没有这本书")\nelif books[title] == 0:\n    print("已借完")\nelse:\n    books[title] = books[title] - 1\n    print("借走一本")',
           "output": "已借完",
           "explain": "三步：先问书在不在（not in）；再问还有没有（等于 0 就是借完了）；两个检查都过了，才改数量并输出结果。检查放在改数量之前。"}
assert real_out(WORKED6["code"]) == WORKED6["output"]

# 变化题：库存不足时多说一句“还差几杯”
REF6V = '''if name not in stock:
    print("没有这个饮品")
elif cups > stock[name]:
    print("库存不足，还差", cups - stock[name], "杯")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)
'''
def T6V(tname, stock, name, cups, hidden=False): return T6(tname, stock, name, cups, hidden, REF6V)
V6_TESTS = [T6V("8 杯果茶", D0, "果茶", 8), T6V("3 杯奶茶", D0, "奶茶", 3),
            T6V("正好卖完", D0, "果茶", 5, True), T6V("咖啡，不存在", D0, "咖啡", 2, True), T6V("差 8 杯", {"奶茶": 2}, "奶茶", 10, True)]
assert V6_TESTS[0]["expected"] == "库存不足，还差 3 杯\n{'奶茶': 12, '果茶': 5}"
assert V6_TESTS[4]["expected"] == "库存不足，还差 8 杯\n{'奶茶': 2}"
assert fails(REF6, V6_TESTS) != []                    # 父题答案不能直接过变化题

# 题面写明的输入范围：所有测试数据（含变化题）都必须在范围内
for _t in T_PUB + T_HID + V6_TESTS:
    _d = _t["data"]
    assert isinstance(_d["cups"], int) and not isinstance(_d["cups"], bool) and _d["cups"] >= 1, _t["name"]
    assert all(isinstance(_v, int) and not isinstance(_v, bool) and _v >= 0 for _v in _d["stock"].values()), _t["name"]

L6_TASK = {"id": "U7L6-M1", "version": 1, "type": "modify",
 "prompt": "库存小程序：顾客点了 name（饮品）cups 杯，stock 是库存表。输入范围：cups 是正整数（至少 1 杯），stock 里每个库存都是非负整数（可以是 0）。规则：① 饮品不存在（不在 stock 里）：输出“没有这个饮品”，库存不变。② 库存不足（点的杯数比库存多）：输出“库存不足”，库存不变。③ 其余情况：库存减去杯数，输出“成交，剩 N 杯”（N 是卖完后的库存；正好卖完，剩 0 杯，也算成交）。不管是哪种情况，最后都再用 print(stock) 显示一次库存表。起始程序只写了“成交”这一种，请一处一处改好，每改一处就重新运行。",
 "given": ["stock", "name", "cups"], "checkMode": "output",
 "code": START6, "tests": T_PUB + T_HID,
 "hints": ["先运行，读最后一行的错误类型和 line 几；再对照三种情况：不存在、库存不足、成交。不报错也要对一对输出，有的错不会报错，只会算错。", "三种情况用 if / elif / else：先问 name not in stock，再问 cups > stock[name]，最后才改库存。最后一行 print(stock) 写在 if 外面，每种情况都要显示。"],
 "reference": REF6, "worked": WORKED6, "alternatives": ALT6,
 "wrongAnswers": [{"code": w, "why": why} for w, why, _ in WRONG6],
 "requiresVariationAfterSolution": True,
 "variation": {"id": "U7L6-M1-V1", "prompt": "库存不足时，输出“库存不足，还差 N 杯”（N 是点的杯数减去库存），其他情况不变，最后仍用 print(stock) 显示库存表。", "starter": "# stock、name、cups 已经准备好\n",
   "tests": V6_TESTS,
   "hints": ["三种情况的顺序不变：先判断不存在，再判断库存不足，最后才改库存。", "库存不足时：print(\"库存不足，还差\", cups - stock[name], \"杯\")；逗号会在中间补空格。"],
   "solution": REF6V}}

lessons += [
 {"id": "U7L5", "title": "一个一个看", "concept": "for name in stock、stock[name]",
  "story": "要把库存表里每一种饮品都看一遍，用 for 遍历字典：for name in stock: 每一轮，name 依次是字典里的一个键（不是值），按字典里的顺序，新增的排在最后。想要这个键对应的值，再写 stock[name]。所以 name 是文字（饮品名），要加起来的数量是 stock[name]。",
  "introCode": L5_INTRO,
  "exercises": [
    pred(SHOW, P5_NAMES, [
        ("奶茶\n果茶", T, "for name in stock：每一轮 name 是一个键，依次是 \"奶茶\"、\"果茶\"，print(name) 把它们显示出来。"),
        ("12\n5", F, "name 是键，不是值。要显示值，要写 print(stock[name])。"),
        ("奶茶 12\n果茶 5", F, "循环里只有 print(name)，只显示键；要连值一起显示，要写 print(name, stock[name])。")],
        tip="for name in 字典：name 依次是每一个键。"),
    pred(SHOW, P5_SUM, [
        ("17", T, "第一轮 name 是 \"奶茶\"，stock[name] 是 12，total 变成 12；第二轮 name 是 \"果茶\"，stock[name] 是 5，total 变成 17。"),
        ("2", F, "total = total + 1 才是数键的个数；这里每轮加的是 stock[name]，这个键对应的值。"),
        ("5", F, "total = stock[name] 才会每轮覆盖、只剩最后一个；这里是 total = total + stock[name]，每轮累加。")],
        tip="先 total = 0，每一轮加上这一轮的 stock[name]。"),
    fill("库存少于 5 杯算“低库存”（正好 5 杯不算）。屏幕要显示低库存有几种：1", Q5C_CODE,
        ["<", "<=", ">="], ["<"], "1",
        {"<=": "果茶正好 5 杯，5 <= 5 成立，也被数进去了，得 2。正好 5 杯不算低库存，要用 <。", ">=": "数的是库存不少于 5 杯的：奶茶 12 和果茶 5，得 2，不是低库存。"},
        "低库存是“少于 5 杯”：只有咖啡（3 杯）。边界：正好 5 杯不算。"),
    pick("下面的程序想把所有饮品的库存加起来，报了 TypeError。第 4 行怎么改，屏幕才会显示 17？", "fix", Q5D_OPTS,
         code=P5_BUG, trace=trace_of(P5_BUG), expected="17", tip="name 是键（文字）；要加的是这个键对应的值。"),
  ]},
]
held = [
 {"id": "U7L6", "title": "库存小程序", "concept": "先问有没有，再问够不够，最后才改",
  "story": "项目：库存小程序。顾客点了 name（饮品）cups 杯，stock 是库存表。先把规则读清楚：饮品不存在（不在 stock 里），输出“没有这个饮品”，库存不变；库存不足（点的杯数比库存多），输出“库存不足”，库存不变；其余情况，库存减去杯数，输出“成交，剩 N 杯”，正好卖完也算成交；不管哪种情况，最后都用 print(stock) 显示库存表。修的办法：先运行，读报错；改好一处，再运行；全部不报错了，也要对一对每种情况的输出，因为有的错不会报错，只会算错。下面的几处，是按示例的修法逐处修改时可能看到的顺序，你的写法不同，看到的顺序也可能不同。",
  "introCode": P_Q61,
  "exercises": [
    pick("起始程序点了咖啡，库存表里没有咖啡，运行报了 KeyError。规则：饮品不存在时，输出“没有这个饮品”，库存不变；最后都显示库存表。第 4 行起改成哪一种，屏幕才会显示：没有这个饮品，再显示 {'奶茶': 12, '果茶': 5}？", "fix", Q61_OPTS,
         code=P_Q61, trace=trace_of(P_Q61), expected=EXP_NOT_EXIST, tip="先问“在不在”：在才取、才改。"),
    pick("上面改好之后，换成点 8 杯果茶（只有 5 杯）。程序不报错，却让果茶剩了 -3 杯。规则：库存不足时，输出“库存不足”，库存不变。第 4 行起改成哪一种？", "fix", Q62_OPTS,
         code=P_Q62, checks=[], expected=EXP_SHORT, tip="先比较，再决定改不改；库存不足时什么都不改。"),
    pred("三种情况都处理好了。点 5 杯果茶，库存表里果茶正好 5 杯，屏幕上会显示什么？", P_Q63, [
        ("成交，剩 0 杯\n{'奶茶': 12, '果茶': 0}", T, "5 不比库存 5 多，不算库存不足；正好卖完也算成交：库存减成 0，输出“成交，剩 0 杯”。最后 print(stock) 显示的是改完之后的库存表。"),
        ("库存不足\n{'奶茶': 12, '果茶': 5}", F, "cups > stock[name] 是 5 > 5，不成立。正好卖完不算库存不足。"),
        ("成交，剩 0 杯\n{'奶茶': 12, '果茶': 5}", F, "print(stock) 在库存减完之后才运行，显示的是改完的库存表，果茶是 0。"),
        ("成交，剩 0 杯", F, "最后一行 print(stock) 没有缩进，不在 else 里，每种情况都会运行，所以还会再显示库存表。")],
        tip="先看杯数是不是比库存多：5 不比 5 多。"),
    pred("再点一次：点 2 杯咖啡，库存表里没有咖啡，屏幕上会显示什么？", P_Q64, [
        ("没有这个饮品\n{'奶茶': 12, '果茶': 5}", T, "咖啡不在 stock 里，进第一个分支：输出“没有这个饮品”；库存没动，最后 print(stock) 显示原来的库存表。"),
        ("没有这个饮品", F, "最后一行 print(stock) 没有缩进，每种情况都会运行，所以还会再显示库存表。"),
        ("没有这个饮品\n{'奶茶': 12, '果茶': 5, '咖啡': 2}", F, "这个分支只输出文字，没有给 stock 写任何值，库存表里不会多出咖啡。"),
        ("报错", F, "先判断 name not in stock，咖啡不在，直接输出文字，没有去取 stock[name]，不会报 KeyError。")],
        tip="先问不存在：不存在就输出文字，其他分支都不会运行。"),
  ],
  "pending": [{"type": "modify", "replaces": 4, "status": "待 Claude 的代码题运行器，暂不开放",
    "plan": "改一改（项目）：库存小程序；不存在、库存不足、成交三种情况，最后 print(stock)",
    "task": L6_TASK}]},
]

unit = {"id": "U7", "title": "字典", "subtitle": "dict：按名字存取", "lessons": lessons, "heldLessons": held}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit7.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons))
