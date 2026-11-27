# 生成 content/unit16.json（第 16 单元「数组与哈希」，第二版课程结构阶段四“算法题型”第一个单元，docs/59 §8）。
# 笔试题面；每关一个常见题型，最后一关是笔试常见题“多数元素”（LeetCode 169）。每关 4 题。
# 阶段四要求“先点选走思路，再手写”；正式站代码题仍关闭（codeTasksEnabled=[]），本单元只有点选部分。
# 新教：字典计数 cnt.get(x, 0) + 1、max(cnt, key=cnt.get)、两遍扫描、前缀和、按排序后的字母分组。
# 不用 +=、%、lambda、global、Counter、defaultdict、enumerate、列表推导式。每道题的答案都由真实 Python 运行得出（见 scripts/unitgen.py）。
# 运行：python3 scripts/make-unit16.py && python3 scripts/verify-content.py
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from unitgen import ASK, pred, err, choose, fill, order, lesson as _lesson
lesson = lambda *a: _lesson("U16", *a)

CNT = "c = {}\nfor x in a:\n    c[x] = c.get(x, 0) + 1"
L = []
# ---------- L1 用字典计数 ----------
L.append(lesson(1, "用字典计数", "c[x] = c.get(x, 0) + 1",
  "数每个值出现几次，用字典：键是值，值是次数。c.get(x, 0) 取出 x 现在的次数（没出现过就是 0），加 1 再存回去。走一遍就数完，O(n)。这是哈希类题目最常用的一招。",
  'a = ["x", "y", "x"]\nc = {}\nfor x in a:\n    c[x] = c.get(x, 0) + 1\nprint(c["x"])', [
  pred(ASK, "a = [3, 1, 3, 3, 2]\n" + CNT + "\nprint(c[3])\nprint(c[2])", [
    ("3\n1", "3 出现了 3 次，2 出现了 1 次。"),
    ("1\n1", "每遇到一次 3 都加 1，不是只记一次。"),
    ("3\n2", "c[2] 是值 2 出现的次数：1 次，不是下标。"),
    ("报错", "每个出现过的值都在字典里；c[2] 查得到。")],
    "c[值] 是这个值出现的次数。"),
  pred(ASK, 'a = ["a", "b"]\n' + CNT + '\nprint(c.get("z", 0))', [
    ("0", "\"z\" 没出现过，get 交回给定的默认值 0，不报错。"),
    ("报错", "c[\"z\"] 才会报 KeyError；get 找不到就交回默认值。"),
    ("None", "给了默认值 0，就交回 0；不给默认值才是 None。"),
    ("1", "\"z\" 一次都没出现。")],
    "get(键, 默认值)：没有就用默认值。"),
  fill("数一数每个字母出现几次，输出 l 的次数：2", 's = "hello"\nc = {}\nfor x in s:\n    c[x] = {0}\nprint(c["l"])', ["c.get(x, 0) + 1", "c[x] + 1", "1", "c.get(x, 0)"], "c.get(x, 0) + 1", {
    "c[x] + 1": "第一次遇到 h 时字典里还没有 h，c[\"h\"] 报 KeyError。",
    "1": "每次都写成 1，没有累加：l 只显示 1。",
    "c.get(x, 0)": "只取出原来的次数，没有加 1，永远是 0。"},
    "原来的次数（没有就是 0）+ 1。"),
  pred(ASK, 'a = ["b", "a", "b"]\n' + CNT + "\nprint(len(c))", [
    ("2", "字典的键是不同的值：\"b\" 和 \"a\" 两个。len(c) 就是有几种不同的值。"),
    ("3", "3 是列表长度；字典里每种值只有一个键。"),
    ("1", "\"a\" 也是一个键。"),
    ("4", "len 数的是键的个数。")],
    "len(c)：有几种不同的值。"),
]))
# ---------- L2 出现最多的 ----------
L.append(lesson(2, "出现最多的那个", "max(c, key=c.get)",
  "数完以后，要找出现次数最多的那个值：max(c, key=c.get)。max 走的是字典的键，key=c.get 表示按每个键的次数比较。次数一样时，交回先放进字典的那个。",
  'a = ["x", "y", "y"]\nc = {}\nfor x in a:\n    c[x] = c.get(x, 0) + 1\nprint(max(c, key=c.get))', [
  pred(ASK, "a = [4, 2, 4, 7, 2, 4]\n" + CNT + "\nprint(max(c, key=c.get))", [
    ("4", "4 出现 3 次，2 出现 2 次，7 出现 1 次：按次数比，4 最多。"),
    ("7", "不写 key 时才按值本身比大小；这里按次数。"),
    ("3", "max 交回的是那个值，不是它的次数。"),
    ("2", "2 只出现了 2 次，比 4 少。")],
    "key=c.get：按次数比。"),
  pred(ASK, "a = [5, 9, 9]\n" + CNT + "\nprint(max(c))", [
    ("9", "没有写 key：max 直接比较键本身，5 和 9 里 9 大。"),
    ("2", "max(c) 比的是键，不是次数，也不会交回次数。"),
    ("5", "5 比 9 小。"),
    ("报错", "max 可以作用在字典上，比的是键。")],
    "不写 key：比的是键本身。"),
  fill("输出出现次数最多的字母：a", 's = "banana"\nc = {}\nfor x in s:\n    c[x] = c.get(x, 0) + 1\nprint(max(c, key={0}))', ["c.get", "c", "len", "max"], "c.get", {
    "c": "key 要的是一个函数；字典本身不能这样调用，报 TypeError。",
    "len": "每个键都是一个字母，长度都是 1，并列，交回第一个放进去的 b。",
    "max": "max(\"b\") 还是字母本身，等于按字母比：最大的是 n。"},
    "按次数比：c.get。"),
  pred("次数一样多。" + ASK, 'a = ["q", "p", "p", "q"]\n' + CNT + "\nprint(max(c, key=c.get))", [
    ("q", "q 和 p 都是 2 次，并列时交回先放进字典的那个：q 先出现。"),
    ("p", "并列时不按字母比，看谁先放进字典：q 在前。"),
    ("2", "交回的是值，不是次数。"),
    ("报错", "并列不会报错。")],
    "并列：交回先出现的。"),
]))
# ---------- L3 第一个只出现一次的字符 ----------
L.append(lesson(3, "第一个只出现一次的", "两遍：第一遍计数，第二遍按原顺序找次数为 1 的",
  "笔试常见题（LeetCode 387）：找字符串里第一个只出现一次的字符。走一遍不够：还不知道后面会不会再出现。所以走两遍：第一遍用字典数完次数，第二遍按原来的顺序，找第一个次数是 1 的。O(n)。",
  's = "aab"\nc = {}\nfor x in s:\n    c[x] = c.get(x, 0) + 1\nfor x in s:\n    if c[x] == 1:\n        print(x)\n        break', [
  pred(ASK, 's = "swiss"\nc = {}\nfor x in s:\n    c[x] = c.get(x, 0) + 1\nfor x in s:\n    if c[x] == 1:\n        print(x)\n        break', [
    ("w", "s 出现 3 次；按原顺序看，第一个次数是 1 的是 w（i 也是 1 次，但在 w 后面）。"),
    ("i", "i 也只出现一次，但 w 在它前面。"),
    ("s", "s 出现了 3 次。"),
    ("w\ni", "找到第一个就 break 了。")],
    "第二遍按原顺序找。"),
  pred("每个字符都重复了。" + ASK, 's = "aabb"\nc = {}\nfor x in s:\n    c[x] = c.get(x, 0) + 1\nans = "无"\nfor x in s:\n    if c[x] == 1:\n        ans = x\n        break\nprint(ans)', [
    ("无", "a、b 都出现 2 次，第二遍一个都没找到，ans 保持“无”。"),
    ("a", "a 出现了 2 次，不是只出现一次。"),
    ("报错", "找不到时 ans 有默认值，不会报错。"),
    ("什么都不显示", "最后一定会显示 ans。")],
    "找不到时要有一个默认答案。"),
  fill("找第一个只出现一次的字符，输出：v", 's = "level"\nc = {}\nfor x in s:\n    c[x] = c.get(x, 0) + 1\nfor x in s:\n    if c[x] {0} 1:\n        print(x)\n        break', ["==", ">", "!=", "<"], "==", {
    ">": "> 1 找到的是第一个出现不止一次的：l。",
    "!=": "!= 1 也是找出现不止一次的：l。",
    "<": "没有次数小于 1 的字符，什么都不显示。"},
    "只出现一次：次数 == 1。"),
  choose("AI 只走了一遍：遇到一个字符就看“前面出现过没有”，没出现过就当它是答案。用哪个字符串测试，能看出它错了？", 'def first(s):\n    seen = set()\n    for x in s:\n        if x not in seen:\n            return x\n        seen.add(x)', "不一致", [
    ('first("aab")', "正确答案是 b（a 出现两次）；AI 一看到第一个 a 前面没出现过，就交回 a。不一致。", 'def first(s):\n    seen = set()\n    for x in s:\n        if x not in seen:\n            return x\n        seen.add(x)\ndef rule(s):\n    c = {}\n    for x in s:\n        c[x] = c.get(x, 0) + 1\n    for x in s:\n        if c[x] == 1:\n            return x\nprint("不一致" if first("aab") != rule("aab") else "一致")'),
    ('first("abc")', "每个都只出现一次：正确答案和 AI 都是 a，一致。", 'def first(s):\n    seen = set()\n    for x in s:\n        if x not in seen:\n            return x\n        seen.add(x)\ndef rule(s):\n    c = {}\n    for x in s:\n        c[x] = c.get(x, 0) + 1\n    for x in s:\n        if c[x] == 1:\n            return x\nprint("不一致" if first("abc") != rule("abc") else "一致")'),
    ('first("x")', "只有一个字符：两边都是 x，一致。", 'def first(s):\n    seen = set()\n    for x in s:\n        if x not in seen:\n            return x\n        seen.add(x)\ndef rule(s):\n    c = {}\n    for x in s:\n        c[x] = c.get(x, 0) + 1\n    for x in s:\n        if c[x] == 1:\n            return x\nprint("不一致" if first("x") != rule("x") else "一致")')],
    "测试要让“第一个字符后面又出现了”。"),
]))

# ---------- L4 前缀和 ----------
PRE = "a = [3, 1, 4, 1, 5]\npre = [0]\nfor x in a:\n    pre.append(pre[-1] + x)"
L.append(lesson(4, "前缀和", "pre[i] 是前 i 个数的和；区间和 = pre[j] - pre[i]",
  "要反复问“第 i 到第 j - 1 个数加起来是多少”，每次都循环加是 O(n)。先算前缀和：pre[k] 是前 k 个数的和，pre[0] 是 0。之后任何区间的和都是 pre[j] - pre[i]，一步算出，O(1)。",
  "a = [2, 5, 1]\npre = [0]\nfor x in a:\n    pre.append(pre[-1] + x)\nprint(pre)", [
  pred(ASK, PRE + "\nprint(pre)", [
    ("[0, 3, 4, 8, 9, 14]", "从 0 开始，每次加上下一个数：0、3、3+1=4、4+4=8、8+1=9、9+5=14。"),
    ("[3, 4, 8, 9, 14]", "pre 一开始就放了一个 0，所以比 a 多一个。"),
    ("[0, 3, 1, 4, 1, 5]", "每次加的是上一个前缀和 pre[-1] 加上 x，不是只放 x。"),
    ("14", "pre 是整个列表；14 只是最后一个。")],
    "pre[-1] 是到目前为止的和。"),
  pred("下标 1 到 3 的三个数（1、4、1）的和。" + ASK, PRE + "\nprint(pre[4] - pre[1])", [
    ("6", "pre[4] 是前 4 个数的和 9，pre[1] 是前 1 个数的和 3，相减得 1 + 4 + 1 = 6。"),
    ("9", "9 是 pre[4]，还要减去前面不要的 pre[1]。"),
    ("5", "pre[4] - pre[1] = 9 - 3 = 6。"),
    ("4", "这是 a[2]；区间里有 3 个数。")],
    "区间和 = 右边的前缀和 - 左边的前缀和。"),
  fill("求最后两个数（1、5）的和：6", PRE + "\nprint(pre[5] - {0})", ["pre[3]", "pre[4]", "pre[2]", "a[3]"], "pre[3]", {
    "pre[4]": "pre[5] - pre[4] 只剩最后一个数 5。",
    "pre[2]": "pre[5] - pre[2] 是最后三个数：4 + 1 + 5 = 10。",
    "a[3]": "a[3] 是一个数 1，14 - 1 = 13，不是区间和。"},
    "最后两个数是下标 3、4：减去前 3 个的和。"),
  pred("问了 3 次区间和，数一数一共加了几次。" + ASK, PRE + "\nn = len(a)\nq = [[0, 5], [1, 4], [2, 3]]\nfor r in q:\n    j = r[1]\n    s = pre[j] - pre[r[0]]\n    n = n + 1\nprint(n)", [
    ("8", "算前缀和走了 5 步，之后每次问只要 1 步：5 + 3 = 8。不用前缀和，每次都要把区间里的数加一遍。"),
    ("3", "前面算前缀和的 5 步也要算上。"),
    ("15", "每次问只做一次减法，不是把区间重新加一遍。"),
    ("5", "三次询问各算 1 步。")],
    "先花 O(n) 准备，之后每次 O(1)。"),
]))
# ---------- L5 分组 ----------
L.append(lesson(5, "按特征分组", "字典的值是列表：g[特征].append(w)",
  "笔试常见题（LeetCode 49）：把字母异位词分到一组。每个单词排好序后的字母当“特征”：eat、tea 排好都是 aet。用字典，键是特征，值是一个列表；第一次见到这个特征先放一个空列表。",
  'g = {}\nfor w in ["ab", "ba"]:\n    k = "".join(sorted(w))\n    if k not in g:\n        g[k] = []\n    g[k].append(w)\nprint(g)', [
  pred(ASK, 'k = sorted("tea")\nprint("".join(k))', [
    ("aet", "sorted 把字母排成 ['a', 'e', 't']，再用 \"\" 接起来：aet。"),
    ("['a', 'e', 't']", "后面用 \"\".join 把列表接成了字符串。"),
    ("tea", "排过序了：a、e、t。"),
    ("a e t", "join 前面的分隔符是空字符串，字母之间不加东西。")],
    "排好序的字母，接成一个字符串当“特征”。"),
  pred(ASK, 'ws = ["eat", "tea", "tan"]\ng = {}\nfor w in ws:\n    k = "".join(sorted(w))\n    if k not in g:\n        g[k] = []\n    g[k].append(w)\nprint(g["aet"])\nprint(len(g))', [
    ("['eat', 'tea']\n2", "eat、tea 的特征都是 aet，放进同一个列表；tan 的特征是 ant，另一组。一共 2 组。"),
    ("['eat']\n3", "tea 排好序也是 aet，和 eat 放进同一组。"),
    ("['eat', 'tea', 'tan']\n1", "tan 排好是 ant，不是 aet。"),
    ("['aet']\n2", "列表里放的是原来的单词，不是特征。")],
    "特征一样就放进同一个列表。"),
  fill("第一次见到这个特征时，先放一个空列表。输出：{'ab': ['ab', 'ba'], 'c': ['c']}", 'g = {}\nfor w in ["ab", "ba", "c"]:\n    k = "".join(sorted(w))\n    if k not in g:\n        g[k] = {0}\n    g[k].append(w)\nprint(g)', ["[]", "w", "[w]", "0"], "[]", {
    "w": "放进去的是字符串，字符串没有 append，报 AttributeError。",
    "[w]": "先放了 [w]，下一句又 append 一次，每个单词都出现两遍。",
    "0": "放进去的是数字 0，数字没有 append，报 AttributeError。"},
    "先放一个空列表，下一句再加进去。"),
  pred(ASK, 'g = {}\nfor w in ["no", "on", "xy"]:\n    k = "".join(sorted(w))\n    g[k] = []\n    g[k].append(w)\nprint(g["no"])', [
    ("['on']", "没有判断 k not in g：每次都把这一组重新清成空列表，no 被 on 那一次清掉了，只剩 on。"),
    ("['no', 'on']", "每一轮都执行 g[k] = []，前面放进去的被清掉了。"),
    ("['no']", "on 排好序也是 no，后放进去，同时清掉了前面的。"),
    ("报错", "不会报错，只是悄悄丢了数据。")],
    "只有第一次见到才放空列表。"),
]))
# ---------- L6 笔试题：多数元素 ----------
L.append(lesson(6, "笔试题：多数元素", "出现次数超过一半的那个：计数后找次数 > n // 2 的",
  "笔试常见题（LeetCode 169）：列表里有一个数出现了超过一半次，找出它。用字典计数，再找次数大于 len(a) // 2 的那个。走一遍计数 O(n)，再看一遍字典。",
  "a = [2, 2, 1]\nc = {}\nfor x in a:\n    c[x] = c.get(x, 0) + 1\nfor x in c:\n    if c[x] > len(a) // 2:\n        print(x)", [
  pred(ASK, "a = [3, 2, 3]\n" + CNT + "\nfor x in c:\n    if c[x] > len(a) // 2:\n        print(x)", [
    ("3", "3 出现 2 次，len(a) // 2 是 1，2 > 1，所以是 3。"),
    ("2", "2 只出现 1 次，不超过一半。"),
    ("3\n2", "2 的次数 1 不大于 1。"),
    ("什么都不显示", "3 的次数 2 大于 1。")],
    "超过一半：次数 > len(a) // 2。"),
  pred(ASK, "print(7 // 2)\nprint(6 // 2)", [
    ("3\n3", "整除去掉小数：3.5 留 3，3 本来就是 3。7 个数里要超过 3 次，6 个数里也要超过 3 次。"),
    ("3.5\n3", "// 是整除，没有小数。"),
    ("4\n3", "整除不是四舍五入。"),
    ("3\n2", "6 // 2 是 3。")],
    "// 整除：只留整数部分。"),
  fill("找多数元素，输出：1", "a = [1, 1, 2, 2, 1]\n" + CNT + "\nfor x in c:\n    if c[x] {0} len(a) // 2:\n        print(x)", [">", "<", "==", ">="], ">", {
    "<": "len(a) // 2 是 2，没有次数小于 2 的，什么都不显示。",
    "==": "2 恰好出现 2 次，显示的是 2。",
    ">=": "1（3 次）和 2（2 次）都满足 >= 2，两个都显示；可 2 只占 5 个里的 2 个，没超过一半。"},
    "超过一半：严格大于。"),
  order("排好顺序：计数并找出多数元素。输出：5", ["a = [5, 4, 5]", "c = {}", "for x in a:", "    c[x] = c.get(x, 0) + 1", "for x in c:", "    if c[x] > len(a) // 2:", "        print(x)"], [6, 4, 1, 5, 0, 3, 2],
    "先计数（a、c 在前，计数循环），再找（第二个循环）。"),
]))

unit = {"id": "U16", "title": "数组与哈希", "subtitle": "字典计数、前缀和、分组", "lessons": L}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit16.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(L), "题目", sum(len(l["exercises"]) for l in L))
