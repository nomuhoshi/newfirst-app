# 生成 content/unit12.json（第 12 单元「集合与排序」，第二版课程结构阶段三“刷题工具箱”，docs/59 §8）。
# 笔试题面风格；最后一关是笔试常见题（有效的字母异位词）。每关 4 题。
# 新教：set()、去重、in、add、& | -、sorted()、reverse=True、list.sort() 返回 None、key=len / key=自己写的函数、max / min 带 key。
# 注意：字符串集合直接 print 时顺序每次运行可能不同（哈希随机化），所以题目只输出 len、in、sorted(...) 这类结果确定的东西。
# 不用 +=、%、f-string、lambda、元组。每道题的答案都由真实 Python 运行得出（见 scripts/unitgen.py）。
# 运行：python3 scripts/make-unit12.py && python3 scripts/verify-content.py
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from unitgen import ASK, pred, err, choose, fill, order, lesson as _lesson
lesson = lambda *a: _lesson("U12", *a)

L = []
# ---------- L1 集合：自动去重 ----------
L.append(lesson(1, "集合：自动去重", "set()、重复只留一个、len、in",
  "集合（set）里每个值只留一个：set([3, 1, 3]) 只剩 1 和 3。所以 len(set(列表)) 就是“有几种不同的值”。查某个值在不在集合里，用 in，很快。集合没有顺序，不能用下标。",
  "a = [3, 1, 3, 2, 1]\ns = set(a)\nprint(len(a))\nprint(len(s))", [
  pred(ASK, 'a = ["x", "y", "x", "x"]\nprint(len(set(a)))', [
    ("2", "集合里重复的只留一个：只剩 \"x\" 和 \"y\" 两种。"),
    ("4", "4 是列表的长度；变成集合后重复的被去掉了。"),
    ("3", "\"x\" 出现了 3 次，但在集合里只算一个。"),
    ("1", "\"y\" 也在里面，一共两种。")],
    "len(set(列表))：有几种不同的值。"),
  pred(ASK, "s = set([1, 2, 3])\nprint(2 in s)\nprint(5 in s)", [
    ("True\nFalse", "2 在集合里，5 不在。in 交回 True 或 False。"),
    ("False\nTrue", "两个反了：集合里有 1、2、3。"),
    ("True\nTrue", "5 不在集合里。"),
    ("1\n报错", "in 交回的是 True / False；查不到也不会报错。")],
    "值 in 集合：在就是 True。"),
  fill("输出这个单词里有几种不同的字母：4", 's = "letter"\nprint(len({0}))', ["set(s)", "s", "set(s[0])", '"set"'], "set(s)", {
    "s": "len(s) 是字母总数 6，重复的 e、t 也各算两次。",
    "set(s[0])": "s[0] 只是第一个字母 l，集合里只有 1 个。",
    '"set"': "这是文字 \"set\"，长度是 3，和 s 没有关系。"},
    "先变成集合去重，再数。"),
  err("这段程序报错了，最后一行是：\nTypeError: 'set' object is not subscriptable\n是什么原因？", "s = set([5, 6])\nprint(s[0])", [
    ("集合没有顺序，不能用下标取第几个", "集合只管“在不在”，没有第几个的说法，所以不能写 s[0]。要按顺序取，先 sorted(s) 变成列表。"),
    ("集合里没有 0 这个值", "s[0] 不是查值 0，是取第 0 个；集合不支持这种写法。查值要用 0 in s。"),
    ("set 要写成 Set", "名字没写错：set 就是小写。问题在 s[0]。"),
    ("集合里只能放文字", "集合里可以放数字。问题是不能用下标。")],
    "not subscriptable：这种值不能用方括号下标。"),
]))
# ---------- L2 加元素、交集、并集、差集 ----------
L.append(lesson(2, "共同的、全部的、多出来的", "add、&、|、-",
  "s.add(x) 往集合里加一个值，已经有了就不变。两个集合：a & b 是两边都有的（交集），a | b 是合在一起（并集），a - b 是 a 有而 b 没有的（差集）。要按顺序看结果，用 sorted() 排成列表。",
  "a = set([1, 2, 3])\nb = set([2, 3, 4])\nprint(sorted(a & b))", [
  pred(ASK, "s = set([1, 2])\ns.add(2)\ns.add(5)\nprint(len(s))", [
    ("3", "加 2 时已经有了，集合不变；加 5 是新值。最后是 1、2、5 三个。"),
    ("4", "2 已经在集合里，再 add 一次不会多一个。"),
    ("2", "5 是新值，加进去了。"),
    ("5", "len 数的是有几个值，不是最大的值。")],
    "add 一个已经有的值，集合不变。"),
  pred(ASK, "a = set([1, 2, 3])\nb = set([2, 3, 4])\nprint(sorted(a | b))\nprint(sorted(a - b))", [
    ("[1, 2, 3, 4]\n[1]", "a | b 是合在一起，重复的只留一个；a - b 是 a 有、b 没有的：只有 1。"),
    ("[2, 3]\n[1]", "[2, 3] 是交集 a & b；| 是并集。"),
    ("[1, 2, 3, 4]\n[4]", "a - b 是 a 里去掉 b 有的：剩 1。4 是 b - a。"),
    ("[1, 2, 2, 3, 3, 4]\n[1]", "集合里每个值只留一个，并集不会有重复。")],
    "&：都有；|：全部；-：我有你没有。"),
  fill("输出两个人都会的语言：['go', 'py']", 'a = set(["py", "go", "js"])\nb = set(["go", "py", "c"])\nprint(sorted(a {0} b))', ["&", "|", "-", "+"], "&", {
    "|": "| 是并集：两人会的全部合在一起，有 4 种。",
    "-": "a - b 是只有 a 会的：['js']。",
    "+": "集合不能用 + 相加，会报 TypeError。合在一起用 |。"},
    "两边都有：交集 &。"),
  choose("想找出“在 a 里出现、但不在 b 里出现”的数，屏幕要显示 [1, 5]。第 3 行该怎么写？", "a = [1, 2, 5, 2]\nb = [2, 3]\n……\nprint(sorted(d))", "[1, 5]", [
    ("d = set(a) - set(b)", "先把两边都变成集合，再用差集：a 里去掉 b 有的，剩 1 和 5。", "a = [1, 2, 5, 2]\nb = [2, 3]\nd = set(a) - set(b)\nprint(sorted(d))"),
    ("d = set(b) - set(a)", "方向反了：这是 b 有、a 没有的，得 [3]。", "a = [1, 2, 5, 2]\nb = [2, 3]\nd = set(b) - set(a)\nprint(sorted(d))"),
    ("d = set(a) & set(b)", "这是两边都有的，得 [2]。", "a = [1, 2, 5, 2]\nb = [2, 3]\nd = set(a) & set(b)\nprint(sorted(d))"),
    ("d = a - b", "列表不能用 - 相减，会报 TypeError。要先变成集合。", "a = [1, 2, 5, 2]\nb = [2, 3]\nd = a - b\nprint(sorted(d))")],
    "差集有方向：a - b 是 a 有、b 没有。"),
]))
# ---------- L3 排序 ----------
L.append(lesson(3, "排序", "sorted()、reverse=True、list.sort() 交回 None",
  "sorted(a) 交回一个排好序的新列表，a 本身不变；sorted(a, reverse=True) 从大到小。a.sort() 是直接把 a 排好，它自己交回 None，所以不要写 a = a.sort()。字符串按字母顺序排。",
  "a = [3, 1, 2]\nb = sorted(a)\nprint(b)\nprint(a)", [
  pred(ASK, "a = [5, 2, 9]\nb = sorted(a, reverse=True)\nprint(b)", [
    ("[9, 5, 2]", "reverse=True 是从大到小排。"),
    ("[2, 5, 9]", "不写 reverse 才是从小到大。"),
    ("[9, 2, 5]", "这只是把原列表倒过来，不是排序。"),
    ("9", "sorted 交回整个列表，不是最大值。")],
    "reverse=True：从大到小。"),
  pred(ASK, "a = [3, 1, 2]\na = a.sort()\nprint(a)", [
    ("None", "a.sort() 把列表排好，但它自己交回 None；再赋给 a，a 就变成了 None。"),
    ("[1, 2, 3]", "排序确实发生了，可 a = a.sort() 把 a 换成了 sort() 交回的 None。"),
    ("[3, 1, 2]", "sort() 会改原列表；只是最后 a 被赋成了 None。"),
    ("报错", "不会报错，只是得到 None。这是很常见的坑。")],
    "a.sort() 直接排好 a，交回 None；要新列表用 sorted(a)。"),
  fill("从小到大输出，并且原来的 a 不变：\n[1, 2, 3]\n[3, 1, 2]", "a = [3, 1, 2]\nb = {0}\nprint(b)\nprint(a)", ["sorted(a)", "a.sort()", "a", "sorted(a, reverse=True)"], "sorted(a)", {
    "a.sort()": "a.sort() 把 a 本身排了，还交回 None：b 是 None，a 也变了。",
    "a": "b 和 a 是同一个列表，没有排序。",
    "sorted(a, reverse=True)": "这是从大到小：[3, 2, 1]。"},
    "要新列表、原来不变：sorted(a)。"),
  pred(ASK, 'w = ["pear", "apple", "fig"]\nprint(sorted(w))', [
    ("['apple', 'fig', 'pear']", "字符串按字母顺序排：a 开头最前，然后 f，然后 p。"),
    ("['fig', 'pear', 'apple']", "这是按长度排的结果；不写 key 时按字母顺序。"),
    ("['pear', 'apple', 'fig']", "这是原来的顺序，没有排。"),
    ("['pear', 'fig', 'apple']", "这是倒着的字母顺序；要倒序得写 reverse=True。")],
    "字符串默认按字母顺序排。"),
]))
# ---------- L4 按规则排序：key ----------
L.append(lesson(4, "按规则排序", "sorted(a, key=函数)",
  "想按别的规则排，给 sorted 一个 key：sorted(w, key=len) 按长度排。key 也可以是自己写的函数：def price(x): return x[1]，就按每个元素的第 2 项排。规则一样的元素，保持原来的先后顺序。",
  'w = ["pear", "fig", "apple"]\nprint(sorted(w, key=len))', [
  pred(ASK, 'w = ["ccc", "a", "bb"]\nprint(sorted(w, key=len))', [
    ("['a', 'bb', 'ccc']", "key=len：按每个字符串的长度排，1、2、3。"),
    ("['ccc', 'bb', 'a']", "这是从长到短；从长到短还要加 reverse=True。"),
    ("[1, 2, 3]", "key 只决定按什么比，交回的还是原来的字符串。"),
    ("['ccc', 'a', 'bb']", "这是原来的顺序，没有排。")],
    "key 决定按什么比，排的还是原来的元素。"),
  pred(ASK, 'def p(x):\n    return x[1]\nm = [["tea", 9], ["pie", 5]]\nr = sorted(m, key=p)\nprint(r[0][0])', [
    ("pie", "按每项的第 2 个（价格）排：5 在 9 前面，r 里排第一的是 [\"pie\", 5]，再取它的第 1 个：pie。"),
    ("tea", "按价格排，便宜的 pie 在前面。"),
    ("5", "最后取的是 [0][0]：第一项的名字，不是价格。"),
    ("['pie', 5]", "后面又取了一次 [0]，拿到的是名字。")],
    "key=p：用 p 交回的值来比。"),
  fill("按长度从短到长：['fig', 'pear', 'apple']", 'w = ["pear", "fig", "apple"]\nprint(sorted(w, key={0}))', ["len", "max", "sorted", "str"], "len", {
    "max": "key=max 按每个单词里“最大的字母”比：fig 的是 i，apple 的是 p，pear 的是 r，排成 fig、apple、pear。",
    "sorted": "key=sorted 按每个单词排好后的字母列表比，结果是 apple、pear、fig，不是按长度。",
    "str": "key=str 就是按文字本身比，等于按字母顺序：apple、fig、pear。"},
    "按长度：key=len。"),
  pred(ASK, 'w = ["bb", "a", "cc", "d"]\nprint(sorted(w, key=len))', [
    ("['a', 'd', 'bb', 'cc']", "长度为 1 的 a、d 在前，长度为 2 的 bb、cc 在后；长度一样的保持原来的先后：a 在 d 前，bb 在 cc 前。"),
    ("['a', 'd', 'cc', 'bb']", "长度一样的不会再按字母倒过来，保持原来的先后：bb 原来在 cc 前面。"),
    ("['d', 'a', 'bb', 'cc']", "a 在原列表里排在 d 前面，长度一样时保持这个先后。"),
    ("['a', 'bb', 'cc', 'd']", "这是按字母排；key=len 按长度，d 的长度是 1，要排在前面。")],
    "规则一样的元素，保持原来的先后。"),
]))
# ---------- L5 最大最小、前几名 ----------
L.append(lesson(5, "最大、最小和前几名", "max / min 带 key、sorted(...)[:k]",
  "max 和 min 也能带 key：max(w, key=len) 找最长的那个。要前几名，先排序再切片：sorted(a, reverse=True)[:3] 是最大的 3 个。一样长时，max 交回最先出现的那个。",
  'w = ["fig", "apple", "kiwi"]\nprint(max(w, key=len))', [
  pred(ASK, 'w = ["hi", "hello", "hey"]\nprint(max(w, key=len))\nprint(min(w, key=len))', [
    ("hello\nhi", "按长度比：hello 最长（5），hi 最短（2）。"),
    ("hey\nhello", "不写 key 时才按字母比；这里按长度。"),
    ("5\n2", "max 带 key 交回的是那个字符串，不是它的长度。"),
    ("hello\nhey", "hey 长度 3，比 hi 的 2 长；最短的是 hi。")],
    "max / min 带 key：交回的是元素本身。"),
  pred(ASK, "a = [4, 9, 1, 7, 3]\nb = sorted(a, reverse=True)\nprint(b[:2])", [
    ("[9, 7]", "先从大到小排成 [9, 7, 4, 3, 1]，再取前 2 个。"),
    ("[4, 9]", "这是原列表的前 2 个，没有先排序。"),
    ("[1, 3]", "这是最小的 2 个；reverse=True 让大的在前。"),
    ("[9, 7, 4]", "[:2] 只取 2 个。")],
    "前 k 大：先从大到小排，再 [:k]。"),
  fill("输出最便宜的商品名：pie", 'def p(x):\n    return x[1]\nm = [["tea", 9], ["pie", 5],\n     ["cake", 7]]\nprint({0}(m, key=p)[0])', ["min", "max", "sorted", "len"], "min", {
    "max": "max 找的是最贵的：tea。",
    "sorted": "sorted(...) 交回排好的整个列表，[0] 取到的是 [\"pie\", 5]，不是名字。",
    "len": "len 不接受 key，会报 TypeError。"},
    "最便宜：按价格找最小的。"),
  pred(ASK, 'w = ["ab", "cd", "e"]\nprint(max(w, key=len))', [
    ("ab", "ab 和 cd 一样长（都是 2），max 交回最先出现的那个：ab。"),
    ("cd", "一样长时不会按字母比，交回先出现的 ab。"),
    ("e", "e 最短，不是最长。"),
    ("2", "max 带 key 交回的是元素本身，不是长度。")],
    "并列时，交回最先出现的那个。"),
]))
# ---------- L6 笔试题：有效的字母异位词 ----------
BUG = "def ana(a, b):\n    return set(a) == set(b)"
RULE = "def rule(a, b):\n    return sorted(a) == sorted(b)"
def probe(a, b): return BUG + "\n" + RULE + f'\nx = "{a}"\ny = "{b}"\nprint("不一致" if ana(x, y) != rule(x, y) else "一致")'
L.append(lesson(6, "笔试题：字母异位词", "两个字符串排序后相同 = 字母和次数都一样",
  "笔试常见题：判断两个单词是不是字母异位词——用的字母和每个字母的次数都一样，只是顺序不同，比如 listen 和 silent。思路：把两个字符串都排序再比，sorted(a) == sorted(b) 为 True 就是。",
  'a = "listen"\nb = "silent"\nok = sorted(a) == sorted(b)\nprint(ok)', [
  pred(ASK, 'print(sorted("cab"))', [
    ("['a', 'b', 'c']", "sorted 一个字符串，会把每个字母拆开排好，交回列表。"),
    ("abc", "sorted 交回的是列表，不是字符串。"),
    ("['cab']", "字符串会被拆成一个个字母再排。"),
    ("['c', 'a', 'b']", "这是拆开后没排序的样子；sorted 会排好。")],
    "sorted(字符串) 交回排好的字母列表。"),
  choose("AI 用集合判断：set(a) == set(b)。用哪组单词测试，能看出它和“字母异位词”的定义不一致？", BUG, "不一致", [
    ('ana("aab", "abb")', "字母种类一样（a、b），集合相等，AI 交回 True；但 a 和 b 的次数不同，不是异位词。不一致，测出来了。", probe("aab", "abb")),
    ('ana("abc", "cba")', "确实是异位词：两边都 True，一致。", probe("abc", "cba")),
    ('ana("ab", "cd")', "字母都不一样：两边都 False，一致。", probe("ab", "cd")),
    ('ana("aa", "aa")', "完全一样：两边都 True，一致。", probe("aa", "aa"))],
    "集合会丢掉“次数”：找字母一样、次数不一样的例子。"),
  fill("判断两个单词是不是字母异位词，输出：True", 'a = "listen"\nb = "silent"\nok = {0} == sorted(b)\nprint(ok)', ["sorted(a)", "set(a)", "a", "len(a)"], "sorted(a)", {
    "set(a)": "集合和列表比较，永远不相等，输出 False。两边都要用 sorted。",
    "a": "字符串 \"listen\" 和列表比较，永远不相等，输出 False。",
    "len(a)": "数字和列表比较，永远不相等，输出 False。"},
    "两边都要排序后再比。"),
  order("排好顺序：写一个判断字母异位词的函数并测试。输出：True", ["def ana(a, b):", "    x = sorted(a)", "    y = sorted(b)", "    return x == y", 'print(ana("abc", "cab"))'], [4, 3, 1, 0, 2],
    "先 def；两个排好的列表先算出来再 return 比较；调用写在函数外面、定义之后。"),
]))

unit = {"id": "U12", "title": "集合与排序", "subtitle": "set、去重、sorted 和排序键", "lessons": L}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit12.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(L), "题目", sum(len(l["exercises"]) for l in L))
for l in L:
    for e in l["exercises"]:
        if e["type"] == "order": print(l["id"], "排序可接受顺序", len(e["answers"]))
