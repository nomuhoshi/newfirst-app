# 生成 content/unit7.json（第 7 单元「字典」前两关草稿：U7L1 按名字查库存、U7L2 改库存）。
# 草稿（产品官 U7 按 6 关排：L1 查值、L2 更新、L3 in/.get() 安全查、L4 新增与删除、L5 遍历、L6 库存项目；本文件写 L1–L4）：还没挂进 content/course.json（U7 仍是“即将推出”占位），app 读不到。
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
assert err_type(S1 + '\ndel stock["咖啡"]') == "KeyError"                                            # 讲解：删不存在的键会 KeyError
# 干扰项
assert real_out(S1 + '\nprint(stock)') == "{'奶茶': 12, '果茶': 5}"                                  # “没加进去”的样子
assert real_out(S1 + '\nstock["果茶"] = 4\nprint(stock["果茶"])\nprint(stock["果茶"])') == "4\n4"       # 真改对了果茶才会 4/4
assert real_out(S1 + '\nprint(stock["果茶"])\nprint(stock.get("果查", 0))') == "5\n0"
assert real_out(S1 + '\nprint("果茶" in stock)\nprint(stock["果茶"])') == "True\n5"                  # 没删的样子
assert real_out(S1 + '\ndel stock["果茶"]\nprint("果茶" in stock)\nprint(stock.get("果茶"))') == "False\nNone"  # 没写默认值的样子

lessons += [
 {"id": "U7L3", "title": "先问再取", "concept": "in、.get()、None 和默认值",
  "story": "查一个字典里没有的键，会报 KeyError，程序就停了。想不让它停，有两个办法。第一个：先问一问。\"咖啡\" in stock 问的是：咖啡是不是字典里的一个键，答案是 True 或 False（not in 是反过来问）。注意字典的 in 只看键，不看值：12 是奶茶的数量（值），所以 12 in stock 是 False。配合 if：先问有没有，有才取。第二个：stock.get(\"咖啡\")，查得到时和 stock[\"咖啡\"] 一样给出值，查不到时不报错，给出 None（意思是“没有”）。还可以在逗号后面写一个默认值：stock.get(\"咖啡\", 0)，查不到就用 0；查得到时用的仍然是真实的值，默认值不起作用。",
  "introCode": L3_INTRO,
  "exercises": [
    pred(SHOW, P_IN, [
        ("True\nFalse\nFalse", T, "奶茶是字典的键，True；咖啡不是键，False；12 是奶茶的数量（值），不是键，in 只看键，False。"),
        ("True\nFalse\nTrue", F, "最后一行 12 in stock：in 只看键，不看值。12 是值，不是键，是 False。"),
        ("False\nFalse\nFalse", F, "第一行 \"奶茶\" in stock：奶茶是字典里的键，是 True。")],
        tip="字典的 in 问的是：这个名字是不是字典里的键。"),
    pred(SHOW, P_GET, [
        ("5\nNone\n0", T, "果茶有，给出 5；咖啡没有，没写默认值，给出 None；咖啡没有，写了默认值 0，给出 0。"),
        ("5\n0\n0", F, "第二行没写默认值：查不到时给出的是 None（意思是“没有”），不是 0。"),
        ("5\nNone\nNone", F, "第三行逗号后面的 0 是默认值：查不到咖啡，就用它，显示 0。"),
        ("报错", F, ".get() 查不到时不报错：没有默认值给 None，有默认值给默认值。只有 stock[\"咖啡\"] 这种写法才会报 KeyError。")],
        tip=".get(键) 查不到给 None；.get(键, 默认值) 查不到给默认值。"),
    fill("咖啡还没进货。屏幕要显示：没有这个饮品", Q11_CODE,
        ["name in stock", "name not in stock", "stock[name]"], ["name in stock"], "没有这个饮品",
        {"name not in stock": "咖啡不在字典里，所以 name not in stock 是 True，程序会去取 stock[name]，结果报 KeyError。要的是“有才取”：用 name in stock，咖啡没有就走 else。",
         "stock[name]": "if 后面要先得出 True 或 False，可是 stock[name] 自己就要先去查咖啡，查不到当场报 KeyError，根本到不了 if。"},
        "先问“name 在不在 stock 里”：在才取，不在就走 else。"),
    pick("咖啡还没进货，字典里没有这个键，下面的程序报了 KeyError。要让屏幕显示 0（而不是报错），第 2 行怎么改？", "fix", [
        fixopt("改成：print(stock.get(\"咖啡\", 0))", 'print(stock.get("咖啡", 0))', ".get() 查不到咖啡不报错，用默认值 0，屏幕显示 0。", None),
        fixopt("改成：print(stock.get(\"咖啡\"))", 'print(stock.get("咖啡"))', None, lambda o, e: f"不报错了，但{_shows(o, e)}：没写默认值，查不到给 None，不是 0。"),
        fixopt("改成：print(\"咖啡\" in stock)", 'print("咖啡" in stock)', None, lambda o, e: f"不报错了，但{_shows(o, e)}：in 问的是“在不在”，答案是 True / False，不是数量。"),
        fixopt("改成：print(stock.get(\"果茶\", 0))", 'print(stock.get("果茶", 0))', None, lambda o, e: f"{_shows(o, e)}：查的是果茶，果茶有，用的是真实的值；要查的是咖啡。"),
    ], code=P_FIX, trace=trace_of(P_FIX), expected="0", tip="没有这个键时想要一个默认值：.get(键, 默认值)。"),
  ]},
 {"id": "U7L4", "title": "进货与下架", "concept": "新增、拼错键名、del",
  "story": "给字典里没有的键写值，就是新增一对：stock[\"咖啡\"] = 8，字典里多了咖啡。写法和上一关的“替换”一样：键已经有，就是替换；键没有，就是新增，Python 不会报错提醒你。所以键名拼错了，也不会报错，而是悄悄多出一个拼错的键，原来的键没动。删掉一对：del stock[\"果茶\"]，键和值一起删掉；要删的键必须存在，否则也会报 KeyError。现在可以直接看整个字典了：print(stock) 显示 {'奶茶': 12, '果茶': 5}，每一对是 '键': 值，文字外面是单引号（Python 习惯这样显示，你写的双引号也可以）。新增的键排在最后面。",
  "introCode": L4_INTRO,
  "exercises": [
    pred(SHOW, P_ADD, [
        ("{'奶茶': 12, '果茶': 5, '咖啡': 8}", T, "咖啡原来没有，给它写值就是新增一对，排在最后面。"),
        ("{'奶茶': 12, '果茶': 5}", F, "第 2 行已经运行了：给没有的键写值，会把这一对加进去。"),
        ("{'咖啡': 8, '奶茶': 12, '果茶': 5}", F, "新增的键排在最后面，不是最前面。"),
        ("报错", F, "给没有的键写值不会报错，是新增。只有“取”一个没有的键，才会报 KeyError。")],
        tip="键没有，写值就是新增；键已经有，写值就是替换。"),
    pred("小码想把果茶的库存改成 4，却把“茶”打成了“查”。点单屏运行这段程序，屏幕上会显示什么？", P_TYPO, [
        ("5\n4", T, "\"果查\" 原来没有，写值就是新增一对，不会报错；果茶根本没被改，还是 5。第 4 行查的是新增的 \"果查\"，是 4。"),
        ("4\n4", F, "果茶没有被改：第 2 行写的是 \"果查\"，是另一个键。"),
        ("5\n报错", F, "给没有的键写值不会报错，而是新增了 \"果查\"，所以第 4 行查得到，是 4。")],
        tip="键名拼错了，Python 不会报错：它会新增一个拼错的键。"),
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

unit = {"id": "U7", "title": "字典", "subtitle": "dict：按名字存取", "lessons": lessons}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit7.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons))
