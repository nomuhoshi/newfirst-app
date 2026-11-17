# 生成 content/unit7.json（第 7 单元「字典」：8 关，每关 5 题）。候选内容：还没有接进 course.json，没有上线。
# 内容在这里改，再运行：python3 scripts/make-unit7.py && python3 scripts/verify-content.py
# 规格同 make-unit6.py（docs/59-course-design-plan.md §2）：一关只教一个新东西；5 题；开场说明不超过 90 字；至少 1 道填空、1 道排序（项目关除外）；每行显示宽度不超过 34；不用 +=。
# 代码每行显示宽度不超过 34（汉字算 2）；只用 U1–U5 学过的写法加本关新教的内容；不用 +=。
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


S2 = 'stock = {"奶茶": 12,\n         "果茶": 5}'
S3 = 'stock = {"奶茶": 12,\n         "果茶": 5,\n         "咖啡": 8}'
def with_(code, *lines): return code + "\n" + "\n".join(lines)

L = []
L.append(lesson("U7L1", "按名字查库存", "字典、键和值、stock[键]",
  "列表按位置找，字典按名字找。stock = {\"奶茶\": 12, \"果茶\": 5} 里，每一对是“名字: 数量”。stock[\"果茶\"] 查出果茶的数量 5。",
  with_(S2, 'print(stock["奶茶"])', 'print(stock["果茶"])'), [
  pred(with_(S2, 'print(stock["果茶"])'), [
    ("5", True, "按键“果茶”查，得到它的值 5。"),
    ("12", False, "12 是奶茶的值；方括号里写的是“果茶”。"),
    ("果茶", False, "查出来的是值，不是键本身。"),
    ("1", False, "字典不按位置找，方括号里写的是键。")], "stock[键] 查出这个键对应的值。"),
  pred(with_(S2, 'name = "奶茶"', 'print(name, stock[name])'), [
    ("奶茶 12", True, "name 里是 \"奶茶\"，stock[name] 就是 stock[\"奶茶\"]，得 12。"),
    ("name 12", False, "name 是变量，显示的是它里面的文字：奶茶。"),
    ("奶茶 5", False, "5 是果茶的值，奶茶的值是 12。")], "方括号里可以放变量，用的是变量里的文字。"),
  fill("屏幕要显示咖啡的库存：8", with_(S3, "print(stock[{0}])"), ['"咖啡"', "咖啡", "2", '"果茶"'], '"咖啡"', "8",
    {"咖啡": "没有引号，Python 把咖啡当变量名，会报 NameError。键是文字，要带引号。", "2": "字典不按位置找：stock[2] 找的是叫 2 的键，没有，会报 KeyError。", '"果茶"': "果茶的值是 5，不是 8。"}, "键是文字，要带引号。"),
  pred(with_(S2, 'a = stock["奶茶"]', 'b = stock["果茶"]', "print(a + b)"), [
    ("17", True, "a 是 12，b 是 5，都是整数：12 + 5 = 17。"),
    ("奶茶果茶", False, "a、b 里放的是查出来的值，不是键。"),
    ("125", False, "值是整数 12 和 5，不是文字，+ 是做加法。")], "查出来的值是整数，可以直接计算。"),
  order("排好顺序：查出奶茶的库存，再进货 1 杯后显示。屏幕显示：13", ['stock = {"奶茶": 12}', 'n = stock["奶茶"]', "print(n + 1)"], [1, 2, 0], "13", "先建字典，再查，最后计算并显示。")]))

L.append(lesson("U7L2", "改库存", "stock[键] = 新值",
  "卖出一杯，库存就变了。stock[\"果茶\"] = 9 把果茶的值换成 9。要在旧值上改：先算出新值，再存回去。",
  with_(S2, 'stock["果茶"] = 9', 'print(stock["果茶"])'), [
  pred(with_(S2, 'stock["果茶"] = 9', 'print(stock["奶茶"])', 'print(stock["果茶"])'), [
    ("12\n9", True, "只有果茶被换成 9，奶茶没动，还是 12。"),
    ("9\n9", False, "赋值只改了果茶这一项，奶茶还是 12。"),
    ("12\n5", False, "stock[\"果茶\"] = 9 已经把 5 换成了 9。")], "赋值只改括号里的那一项。"),
  pred(with_(S2, 'n = stock["奶茶"] - 3', 'stock["奶茶"] = n', 'print(stock["奶茶"])', 'print(stock["果茶"])'), [
    ("9\n5", True, "n 是 12 - 3 = 9，存回奶茶；果茶没动，还是 5。"),
    ("12\n5", False, "n 算出来以后，stock[\"奶茶\"] = n 把它存回去了，奶茶变成 9。"),
    ("9\n2", False, "果茶没有被改，还是 5。")], "先算出新值，再用赋值存回去。"),
  pred(with_(S2, 'stock["果茶"] - 1', 'print(stock["果茶"])'), [
    ("5", True, "第 3 行只算了 5 - 1，没有存回去，字典没变。"),
    ("4", False, "只算不存，字典里的值不会变。要写 stock[\"果茶\"] = 4。"),
    ("报错", False, "这样写不报错，只是算了没有用。")], "只算不存，字典不变。"),
  fill("卖出 3 杯果茶，屏幕显示剩下的：2", with_(S2, 'name = "果茶"', "cups = 3", "n = {0} - cups", "stock[name] = n", "print(stock[name])"), ["stock[name]", "name", "cups"], "stock[name]", "2",
    {"name": "name 是文字 \"果茶\"，文字不能减 3，会报 TypeError。", "cups": "cups 减 cups 是 0，不是剩下的库存。"}, "旧库存是 stock[name]。"),
  order("排好顺序：进货 4 杯奶茶后显示库存。屏幕显示：16", ['stock = {"奶茶": 12}', 'n = stock["奶茶"] + 4', 'stock["奶茶"] = n', 'print(stock["奶茶"])'], [3, 1, 0, 2], "16", "先建字典，算出新值，存回去，最后显示。")]))

L.append(lesson("U7L3", "先问有没有", "in：键在不在字典里",
  "查没有的键会报错。取之前先问：\"咖啡\" in stock 看咖啡是不是字典里的一个键，答案是 True 或 False。",
  with_(S2, 'print("奶茶" in stock)', 'print("咖啡" in stock)'), [
  pred(with_(S2, 'print("奶茶" in stock)', 'print("咖啡" in stock)'), [
    ("True\nFalse", True, "奶茶是键，所以 True；咖啡不是，所以 False。"),
    ("True\nTrue", False, "字典里没有咖啡这个键。"),
    ("12\nNone", False, "in 只回答在不在，得到 True 或 False，不是值。")], "in 的答案是 True 或 False。"),
  pred(with_(S2, "print(12 in stock)", 'print("果茶" in stock)'), [
    ("False\nTrue", True, "in 只看键，不看值。12 是值，不是键，所以 False。"),
    ("True\nTrue", False, "in 只看键，12 是奶茶的值，不是键。"),
    ("False\nFalse", False, "果茶是键，所以第二行是 True。")], "in 只看键，不看值。"),
  fill("咖啡没有。先问再取，屏幕显示：没有这个饮品", with_(S2, 'name = "咖啡"', "if {0}:", "    print(stock[name])", "else:", '    print("没有这个饮品")'), ["name in stock", "name not in stock", "stock[name]"], "name in stock", "没有这个饮品",
    {"name not in stock": "咖啡不在字典里，这样条件成立，会去查 stock[name]，报 KeyError。", "stock[name]": "咖啡不在字典里，直接查 stock[name] 会报 KeyError。要先问有没有。"}, "if name in stock 为真才去取值。"),
  pred(with_(S2, 'name = "果茶"', "if name in stock:", "    print(stock[name])", "else:", '    print("没有这个饮品")'), [
    ("5", True, "果茶在字典里，条件成立，显示它的值 5。"),
    ("没有这个饮品", False, "果茶是字典里的键，条件成立，不会走 else。"),
    ("果茶", False, "print 的是 stock[name]，是值 5。")], "先问，再取。"),
  order("排好顺序：先问有没有，没有就提示。屏幕显示：没有这个饮品", ['stock = {"奶茶": 12}', 'name = "咖啡"', 'if name not in stock:', '    print("没有这个饮品")'], [2, 0, 3, 1], "没有这个饮品", "先建字典、再取名字，最后检查。")]))

L.append(lesson("U7L4", "没有就给默认值", ".get(键, 默认值)",
  "stock.get(\"咖啡\", 0)：有这个键就给它的值，没有就给后面的默认值 0，不报错。只写 stock.get(\"咖啡\") 没有时给 None（表示“没有”）。",
  with_(S2, 'print(stock.get("果茶", 0))', 'print(stock.get("咖啡", 0))'), [
  pred(with_(S2, 'print(stock.get("果茶", 0))', 'print(stock.get("咖啡", 0))'), [
    ("5\n0", True, "果茶有，给它的值 5；咖啡没有，给默认值 0。"),
    ("0\n0", False, "果茶在字典里，给的是它的值 5，不是默认值。"),
    ("5\n报错", False, ".get 找不到键不会报错，会给默认值。")], ".get 找到就给值，找不到就给默认值。"),
  pred(with_(S2, 'print(stock.get("咖啡"))'), [
    ("None", True, "不写默认值，找不到就给 None，表示“没有”。"),
    ("0", False, "没写默认值，不会自动给 0。"),
    ("报错", False, ".get 找不到键不会报错。")], "没写默认值，找不到给 None。"),
  fill("咖啡没进货。用 .get 取，屏幕显示：0", with_(S2, 'n = stock.get("咖啡", {0})', "print(n)"), ["0", "1", "None"], "0", "0",
    {"1": "默认值写 1，咖啡没有时会显示 1。", "None": "None 表示“没有”，会显示 None，不是 0。"}, "没有时想得到 0，默认值就写 0。"),
  order("排好顺序：咖啡没有，当 0 杯，进货 5 杯后显示。屏幕显示：5", ['stock = {"奶茶": 12}', 'n = stock.get("咖啡", 0)', "n = n + 5", "print(n)"], [2, 0, 3, 1], "5", "先建字典，用 .get 取，再加，最后显示。"),
  pred(with_(S2, 'a = stock.get("奶茶", 0)', 'b = stock.get("咖啡", 0)', "print(a + b)"), [
    ("12", True, "a 是 12，咖啡没有，b 是默认值 0：12 + 0 = 12。"),
    ("17", False, "17 是 12 + 5。这里取的是咖啡，不是果茶。"),
    ("报错", False, ".get 找不到键不报错，b 是 0。")], "有默认值，加起来就不会报错。")]))

L.append(lesson("U7L5", "进货与下架", "新增一项、del 删一项",
  "给没有的键赋值就是新增：stock[\"咖啡\"] = 8。del stock[\"果茶\"] 删掉这一对。print(stock) 会显示整张表。",
  with_('stock = {"奶茶": 12}', 'stock["咖啡"] = 8', "print(stock)"), [
  pred(with_('stock = {"奶茶": 12}', 'stock["咖啡"] = 8', "print(stock)"), [
    ("{'奶茶': 12, '咖啡': 8}", True, "咖啡是新键，被加在最后。print 显示整张字典。"),
    ("{'咖啡': 8}", False, "赋值是新增，原来的奶茶还在。"),
    ("8", False, "print(stock) 显示的是整张字典。")], "给新键赋值 = 新增。"),
  pred(with_(S2, 'stock["果查"] = 4', 'print(stock["果茶"])', 'print(stock["果查"])'), [
    ("5\n4", True, "“果查”和“果茶”是两个不同的键（打错了一个字）。果茶没变，新增了一个果查。"),
    ("4\n4", False, "果茶没有被改：写的是“果查”，是另一个新键。"),
    ("报错", False, "给不存在的键赋值不报错，是悄悄新增。")], "键打错了不会报错，会悄悄新增。"),
  fill("果茶卖完了，下架它。屏幕显示：{'奶茶': 12}", with_(S2, "{0}", "print(stock)"), ['del stock["果茶"]', 'del stock["咖啡"]', 'stock["果茶"] = 0'], 'del stock["果茶"]', "{'奶茶': 12}",
    {'del stock["咖啡"]': "咖啡不在字典里，删它会报 KeyError。", 'stock["果茶"] = 0': "这是把果茶的库存改成 0，果茶这一项还在，不是删除。"}, "del 字典[键] 删掉这一对。"),
  order("排好顺序：果茶不在就先新增为 0，再进货 5 杯。屏幕显示：{'奶茶': 12, '果茶': 5}", ['stock = {"奶茶": 12}', 'if "果茶" not in stock:', '    stock["果茶"] = 0', 'new = stock["果茶"] + 5', 'stock["果茶"] = new', "print(stock)"], [3, 0, 5, 1, 4, 2], "{'奶茶': 12, '果茶': 5}", "先建字典；没有就新增为 0；然后加 5 并存回；最后显示。"),
  pred(with_('stock = {"奶茶": 12,\n         "果茶": 5}', 'del stock["果茶"]', 'print("果茶" in stock)', "print(len(stock))"), [
    ("False\n1", True, "删掉以后，果茶不在字典里；字典剩 1 项，len 是 1。"),
    ("True\n2", False, "del 已经把果茶删掉了。"),
    ("False\n2", False, "删掉一项以后只剩奶茶，长度是 1。")], "len(字典) 是一共有几项。")]))

L.append(lesson("U7L6", "一个一个看", "for name in stock",
  "for name in stock: 每一轮，name 是一个键（饮品名）。要这个键的值，写 stock[name]。",
  with_(S2, "for name in stock:", "    n = stock[name]", "    print(name, n)"), [
  pred(with_(S2, "for name in stock:", "    print(name)"), [
    ("奶茶\n果茶", True, "每一轮 name 是一个键，按字典里的顺序。"),
    ("12\n5", False, "for 取出来的是键，不是值。要值得写 stock[name]。"),
    ("奶茶 12\n果茶 5", False, "只 print(name)，只显示键。")], "for name in 字典：name 是键。"),
  pred(with_(S2, "total = 0", "for name in stock:", "    n = stock[name]", "    total = total + n", "print(total)"), [
    ("17", True, "先加 12，再加 5，得 17。"),
    ("0", False, "循环每一轮都在 total 上加值，不会是 0。"),
    ("奶茶果茶", False, "加的是查出来的值（整数），不是键。")], "for 里用 stock[name] 取值，累加。"),
  fill("统计库存不到 5 杯的饮品有几种。屏幕显示：1", with_('stock = {"奶茶": 12,\n         "果茶": 5,\n         "咖啡": 3}', "low = 0", "for name in stock:", "    if stock[name] {0} 5:", "        low = low + 1", "print(low)"), ["<", "<=", ">="], "<", "1",
    {"<=": "<= 5 把正好 5 杯的果茶也算上，会得到 2。", ">=": ">= 5 是库存足够的，奶茶和果茶，会得到 2。"}, "“不到 5 杯”不含 5，用 <。"),
  order("排好顺序：统计一共有几种饮品。屏幕显示：2", ['stock = {"奶茶": 12, "果茶": 5}', "count = 0", "for name in stock:", "    count = count + 1", "print(count)"], [4, 2, 0, 3, 1], "2", "先建字典、计数器归零；再循环里加 1；循环结束再显示。"),
  pred(with_('stock = {"奶茶": 12,\n         "果茶": 0,\n         "咖啡": 0}', "for name in stock:", "    if stock[name] == 0:", '        print(name, "卖完")'), [
    ("果茶 卖完\n咖啡 卖完", True, "奶茶不是 0，不显示；果茶和咖啡的值是 0，各显示一行。"),
    ("奶茶 卖完", False, "奶茶是 12，不等于 0。"),
    ("卖完\n卖完", False, "print(name, \"卖完\") 会先显示名字。")], "循环里加 if，只处理满足条件的项。")]))

def shop(name, cups, op="{0}", cmp="{1}"):
    return (S2 + '\nname = "%s"\ncups = %d\nif name %s stock:\n    print("没有这个饮品")\nelif cups %s stock[name]:\n    print("库存不足")\nelse:\n    n = stock[name] - cups\n    stock[name] = n\n    print("成交")\n    print("剩", n, "杯")\nprint(stock)') % (name, cups, op, cmp)
pending = json.loads((pathlib.Path(__file__).resolve().parent / "unit7-pending.json").read_text())
L.append(lesson("U7L7", "项目：库存小程序", "先问有没有，再问够不够，最后才改",
  "顾客点了 name 饮品 cups 杯。先问有没有，再问够不够，两关都过了才改库存。正好卖完也算成交。",
  shop("果茶", 3, "not in", ">"), [
  pred(shop("果茶", 3, "not in", ">"), [
    ("成交\n剩 2 杯\n{'奶茶': 12, '果茶': 2}", True, "果茶有，3 不大于 5，所以成交；库存 5 - 3 = 2，最后显示整张表。"),
    ("库存不足\n{'奶茶': 12, '果茶': 5}", False, "3 杯没有比 5 杯多，库存够。"),
    ("成交\n剩 2 杯\n{'奶茶': 12, '果茶': 5}", False, "n 存回去了：stock[name] = n，字典里果茶变成 2。")], "三种情况只会走一种。"),
  fill("咖啡不在字典里。补全，屏幕显示：\n没有这个饮品\n{'奶茶': 12, '果茶': 5}", shop("咖啡", 2, "{0}", ">"), ["not in", "in", "=="], "not in", "没有这个饮品\n{'奶茶': 12, '果茶': 5}",
    {"in": "咖啡在字典里时才说没有，反了；咖啡不在，条件不成立，会去查 stock[name] 报 KeyError。", "==": "name == stock 是拿文字和整张字典比，是 False，也会去查 KeyError。"}, "“没有”要问 not in。"),
  fill("正好 5 杯果茶，也要成交。补全，屏幕显示：\n成交\n剩 0 杯\n{'奶茶': 12, '果茶': 0}", shop("果茶", 5, "not in", "{0}"), [">", ">=", "=="], ">", "成交\n剩 0 杯\n{'奶茶': 12, '果茶': 0}",
    {">=": ">= 会把“正好卖完”算成库存不足，显示库存不足。", "==": "== 只有刚好相等才库存不足，5 等于 5 就变成库存不足，不对。"}, "库存不足 = 比库存多，用 >。"),
  pred(shop("果茶", 8, "not in", ">"), [
    ("库存不足\n{'奶茶': 12, '果茶': 5}", True, "8 比 5 多，库存不足；不改库存，字典不变。"),
    ("成交\n剩 -3 杯\n{'奶茶': 12, '果茶': -3}", False, "8 > 5 成立，先判断到库存不足，不会走到成交。"),
    ("没有这个饮品\n{'奶茶': 12, '果茶': 5}", False, "果茶在字典里，第一个条件不成立。")], "判断的顺序：先不存在，再不足，最后成交。"),
  pred(shop("奶茶", 12, "not in", ">"), [
    ("成交\n剩 0 杯\n{'奶茶': 0, '果茶': 5}", True, "12 不大于 12，成交；库存变成 0，奶茶这一项还在表里。"),
    ("库存不足\n{'奶茶': 12, '果茶': 5}", False, "12 不大于 12，没有比库存多。"),
    ("成交\n剩 0 杯\n{'果茶': 5}", False, "库存变成 0 不会删掉这一项。")], "库存 0 的饮品还在表里。")],
  pending=pending))

L.append(lesson("U7L8", "单元复习：库存小结", "字典：查、改、问有没有、.get、新增删除、遍历",
  "这一关不教新东西，把本单元的几样一起用一遍：按名字查、改值、问有没有、用 .get 取、新增和删除、一个一个看。",
  with_(S2, 'stock["果茶"] = 8', 'print(stock.get("咖啡", 0))', "print(stock)"), [
  pred(with_(S2, 'stock["果茶"] = stock["果茶"] - 2', 'print(stock["果茶"])', 'print("咖啡" in stock)'), [
    ("3\nFalse", True, "果茶变成 5 - 2 = 3；咖啡不是键，所以 False。"),
    ("5\nFalse", False, "赋值已经把果茶改成 3。"),
    ("3\nTrue", False, "字典里没有咖啡这个键。")], "查、改、问有没有，组合起来看。"),
  fill("咖啡没有，给 0。屏幕显示：12", with_(S2, 'a = stock["奶茶"]', 'b = stock.{0}("咖啡", 0)', "print(a + b)"), ["get", "in", "del"], "get", "12",
    {"in": "in 不是这样写的，stock.in 会报 AttributeError。", "del": "del 是删除，不是这样用，会报 SyntaxError。"}, "没有就给默认值：.get(键, 默认值)。"),
  pred(with_(S2, 'stock["咖啡"] = 8', "del stock[\"奶茶\"]", "for name in stock:", "    print(name)"), [
    ("果茶\n咖啡", True, "新增了咖啡、删掉了奶茶；剩下果茶和咖啡，咖啡是后加的，排在最后。"),
    ("奶茶\n果茶\n咖啡", False, "奶茶已经被 del 删掉了。"),
    ("果茶", False, "咖啡是新增的，还在表里。")], "新增排在最后，del 删掉就没有了。"),
  order("排好顺序：算出所有库存加起来的杯数。屏幕显示：17", ['stock = {"奶茶": 12, "果茶": 5}', "total = 0", "for name in stock:", "    total = total + stock[name]", "print(total)"], [4, 3, 0, 2, 1], "17", "先建字典、总数归零；循环累加；循环结束显示。"),
  pred(with_(S2, 'name = "咖啡"', "if name in stock:", "    print(stock[name])", "else:", '    print("没有这个饮品")', 'print(stock.get(name, 0))'), [
    ("没有这个饮品\n0", True, "咖啡不在字典里，走 else；.get 给默认值 0。"),
    ("0\n0", False, "if 条件不成立，走 else，显示“没有这个饮品”。"),
    ("没有这个饮品\n报错", False, ".get 找不到键不会报错。")], "先问再取和 .get 都不会报错。")],
  review=True))

def width(s): return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)
for l in L:
    assert len(l["exercises"]) == 5, l["id"]
    assert len(l["story"]) <= 90, (l["id"], len(l["story"]))
    ty = [e["type"] for e in l["exercises"]]
    assert "fill" in ty and ("order" in ty or l["title"].startswith("项目")), (l["id"], ty)
    assert ty.count("predict") <= 3 or l["title"].startswith("项目") or l.get("review"), (l["id"], ty)
    for e in l["exercises"]:
        code = e.get("code") or "\n".join(e["lines"])
        longest = max(e.get("tokens", [""]), key=width)
        for ln in code.replace("{0}", longest).split("\n"): assert width(ln) <= 34, (l["id"], ln, width(ln))
        assert "+=" not in code
out = pathlib.Path(__file__).resolve().parent.parent / "content/unit7.json"
out.write_text(json.dumps({"id": "U7", "title": "字典", "subtitle": "键和值、查改、in/.get、遍历", "lessons": L}, ensure_ascii=False, indent=1) + "\n")
print("写出", out.name, len(L), "关", sum(len(l["exercises"]) for l in L), "题")
