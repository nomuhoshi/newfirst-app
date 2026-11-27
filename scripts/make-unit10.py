# 生成 content/unit10.json（第 10 单元「字符串操作」，第二版课程结构阶段三“刷题工具箱”的第一个单元，docs/59 §8）。
# 题面用笔试风格（不再用奶茶店场景）；最后一关是笔试常见题（回文串）。每关 4 题，题型：选输出、填空、排序、读报错、选测试输入。
# 只用已学写法（U1–U9：print、变量、运算、if、for、列表与下标 / 切片、in、字典、函数 / return、读报错），加本单元新教的：
#   字符串下标、切片和步长 [::-1]、for ch in s、find / count / replace、split / join、upper / lower。不用 +=、f-string、while。
# 每道题的答案都由真实 Python 运行得出：选输出的正确选项必须等于真实输出、错误选项必须不等于；生成失败就是题目有错。
# 运行：python3 scripts/make-unit10.py && python3 scripts/verify-content.py
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from unitgen import ASK, pred, err, choose, fill, order, lesson as _lesson
lesson = lambda *a: _lesson("U10", *a)

L = []
# ---------- L1 字符串的下标 ----------
L.append(lesson(1, "字符串的下标", "s[0]、s[-1]、最后一个是 len(s) - 1",
  "字符串和列表一样，可以按位置取：s = \"python\"，s[0] 是第一个字符 \"p\"，s[-1] 是最后一个 \"n\"。下标从 0 开始，所以最后一个的下标是 len(s) - 1。下标超出范围会报 IndexError。",
  's = "python"\nprint(s[0])\nprint(s[-1])\nprint(len(s))', [
  pred(ASK, 's = "hello"\nprint(s[1])\nprint(s[-2])', [
    ("e\nl", "下标从 0 开始：s[0] 是 h，s[1] 是 e。负下标从末尾数：s[-1] 是 o，s[-2] 是 l。"),
    ("h\nl", "s[1] 不是第一个字符：下标从 0 开始，h 是 s[0]，s[1] 是 e。"),
    ("e\no", "s[-1] 才是最后一个 o；s[-2] 是倒数第二个 l。"),
    ("h\no", "两个都差了一位：s[1] 是 e，s[-2] 是 l。")],
    "正着数从 0 开始，倒着数从 -1 开始。"),
  pred(ASK, 's = "abc"\nprint(s[len(s) - 1])', [
    ("c", "len(s) 是 3，len(s) - 1 是 2，s[2] 是最后一个字符 c。"),
    ("b", "len(s) - 1 是 2，s[2] 是 c；b 是 s[1]。"),
    ("3", "3 是长度 len(s)；这里取的是下标 2 上的字符。"),
    ("报错", "s[3] 才会超出范围；这里减了 1，s[2] 正好是最后一个。")],
    "最后一个字符的下标 = 长度 - 1。"),
  fill("输出单词的最后一个字符：d", 's = "word"\nprint(s[{0}])', ["-1", "4", "len(s)", "0"], "-1", {
    "4": "word 有 4 个字符，下标是 0 到 3，s[4] 超出范围，报 IndexError。",
    "len(s)": "len(s) 是 4，s[4] 超出范围，报 IndexError。最后一个是 len(s) - 1 或 -1。",
    "0": "s[0] 是第一个字符 w。"},
    "倒着数，最后一个是 -1。"),
  err("这段程序报错了，最后一行是：\nIndexError: string index out of range\n是什么原因？", 's = "cat"\nprint(s[3])', [
    ("下标 3 超出范围：cat 的下标只有 0、1、2", "cat 有 3 个字符，下标从 0 开始，最大是 2。s[3] 取不到，报 IndexError。"),
    ("字符串不能用下标取字符", "字符串可以用下标：s[0] 是 c。问题是 3 超出了范围。"),
    ("3 要写成 \"3\"", "下标是整数；写成文字 \"3\" 会报 TypeError。这里错在 3 太大。"),
    ("print 里不能放 s[3]", "print 里可以放任何表达式；是 s[3] 本身取不到。")],
    "IndexError：下标超出范围。长度为 n 的字符串，下标是 0 到 n - 1。"),
]))
# ---------- L2 切片和反转 ----------
L.append(lesson(2, "切片和反转", "s[a:b]、s[:n]、s[n:]、s[::-1]",
  "切片和列表一样：s[a:b] 取下标 a 到 b - 1；s[:3] 取前 3 个，s[2:] 从下标 2 取到末尾。再加一个数是步长：s[::-1] 从后往前一个一个取，得到反过来的字符串。切片超出范围不报错。",
  's = "python"\nprint(s[:2])\nprint(s[2:])\nprint(s[::-1])', [
  pred(ASK, 's = "abcdef"\nprint(s[1:4])', [
    ("bcd", "从下标 1（b）开始，到下标 4 之前停：取下标 1、2、3，就是 bcd。"),
    ("bcde", "终点下标 4（e）不包含在内，只取到下标 3。"),
    ("abcd", "起点是下标 1，不是 0：a 是下标 0，不在里面。"),
    ("abc", "s[1:4] 从下标 1 开始；abc 是 s[:3]。")],
    "s[a:b]：包含 a，不包含 b。"),
  pred(ASK, 's = "hello"\nprint(s[::-1])', [
    ("olleh", "步长 -1：从最后一个字符开始，往前一个一个取，整串反过来。"),
    ("hello", "步长是 -1，不是 1：方向反了。"),
    ("o", "s[-1] 才只取最后一个；s[::-1] 取的是全部，只是倒着取。"),
    ("报错", "切片可以写步长，s[::-1] 是常用写法，不会报错。")],
    "s[::-1] 是反转字符串的常用写法。"),
  fill("输出前 3 个字符：pyt", 's = "python"\nprint(s[{0}])', [":3", "0:2", "3:", "1:3"], ":3", {
    "0:2": "s[0:2] 不包含下标 2，只有 py 两个。",
    "3:": "s[3:] 是从下标 3 到末尾：hon。",
    "1:3": "s[1:3] 从下标 1 开始：yt，少了 p。"},
    "前 n 个：s[:n]。"),
  pred(ASK, 's = "abc"\nprint(s[1:10])', [
    ("bc", "切片的终点超出范围不报错，取到末尾为止：从下标 1 取到最后，就是 bc。"),
    ("报错", "单个下标 s[10] 会报 IndexError；切片超出范围不会，取到末尾就停。"),
    ("b", "s[1:10] 不是只取下标 1；它取下标 1 到末尾。"),
    ("abc", "起点是下标 1，a 不在里面。")],
    "取单个字符会越界报错，切片不会。"),
]))
# ---------- L3 一个字符一个字符看 ----------
L.append(lesson(3, "一个字符一个字符看", "for ch in s、计数、倒着拼",
  "for ch in s 每一轮取出一个字符，从左到右。配合 if 和计数变量，就能数出某种字符有几个，比如元音：if ch in \"aeiou\"。每轮把 ch 放到前面拼，r = ch + r，拼出来就是反过来的字符串。",
  's = "hi"\nfor ch in s:\n    print(ch)', [
  pred(ASK, 's = "abc"\nfor ch in s:\n    print(ch * 2)', [
    ("aa\nbb\ncc", "每一轮 ch 是一个字符，ch * 2 把它重复两次；print 每轮一行。"),
    ("abcabc", "乘 2 的是每一轮的单个字符，不是整个 s。"),
    ("aabbcc", "print 每轮都会换行，所以是三行，不是一行。"),
    ("a\nb\nc", "每个字符都乘了 2，所以是 aa、bb、cc。")],
    "for ch in s：每一轮 ch 是一个字符。"),
  fill("输出单词里元音字母（a e i o u）的个数：2", 's = "apple"\nn = 0\nfor ch in s:\n    if ch {0} "aeiou":\n        n = n + 1\nprint(n)', ["in", "not in", "==", "!="], "in", {
    "not in": "数的是不在 aeiou 里的字符：p、p、l，得 3。",
    "==": "ch == \"aeiou\" 是拿一个字符和整串比，永远不相等，得 0。",
    "!=": "一个字符永远不等于整串 \"aeiou\"，每轮都成立，5 个字符全数上，得 5。"},
    "看 ch 是不是 \"aeiou\" 里的一个：用 in。"),
  order("排好顺序，数出字母 a 出现的次数。输出：3", ['s = "banana"', "n = 0", "for ch in s:", '    if ch == "a":', "        n = n + 1", "print(n)"], [5, 2, 4, 0, 3, 1],
    "s 和 n = 0 在循环前面；if 缩进在 for 里，计数再缩进在 if 里；最后在循环外输出一次。"),
  pred(ASK, 's = "abc"\nr = ""\nfor ch in s:\n    r = ch + r\nprint(r)', [
    ("cba", "每轮把 ch 放在 r 前面：a → ba → cba。拼出来是反过来的字符串。"),
    ("abc", "r = r + ch 才是按原顺序拼；这里 ch 在前面，新字符总排到最前。"),
    ("c", "r 每轮都留着之前的字符，再在前面加一个，最后有 3 个字符。"),
    ("a", "r 不是每轮重来：它从空串开始，一轮比一轮长。")],
    "一轮一轮追 r：每轮它变成什么？"),
]))
# ---------- L4 查找、替换、计数 ----------
L.append(lesson(4, "查找、替换、计数", "s.find()、s.count()、s.replace()",
  "s.find(\"lo\") 交回第一次出现的下标，找不到交回 -1；s.count(\"l\") 数出现几次；s.replace(\"a\", \"b\") 把所有 a 换成 b，交回一个新的字符串，原来的 s 不变。字符串本身不能改，只能做出新的。",
  's = "hello"\nprint(s.find("l"))\nprint(s.count("l"))', [
  pred(ASK, 's = "banana"\nprint(s.find("na"))\nprint(s.find("x"))', [
    ("2\n-1", "na 第一次出现在下标 2（b 0、a 1、n 2）；x 找不到，find 交回 -1。"),
    ("3\n-1", "下标从 0 开始数：n 在下标 2。3 是从 1 开始数的结果。"),
    ("2\n报错", "find 找不到不会报错，交回 -1。"),
    ("2\n0", "找不到交回的是 -1，不是 0：0 表示在开头找到了。")],
    "find：找到交回下标，找不到交回 -1。"),
  pred(ASK, 's = "cat"\nt = s.replace("c", "b")\nprint(s)\nprint(t)', [
    ("cat\nbat", "replace 交回新的字符串 bat 存进 t；原来的 s 没有变，还是 cat。"),
    ("bat\nbat", "字符串不能原地改：replace 不会改 s，只是交回一个新的。"),
    ("cat\ncat", "t 拿到的是替换后的新字符串 bat。"),
    ("bat\ncat", "s 和 t 反了：s 没变是 cat，t 是新的 bat。")],
    "replace 交回新字符串，原来的不变。"),
  fill("输出字母 s 出现的次数：4", 's = "mississippi"\nprint(s.count({0}))', ['"s"', '"p"', '"ss"', "s"], '"s"', {
    '"p"': "p 只出现 2 次。要数的是字母 s。",
    '"ss"': "数的是 \"ss\" 这两个字母连在一起出现几次：2 次。",
    "s": "没有引号，s 是变量，就是整个 \"mississippi\"，它在自己里面出现 1 次。"},
    "要数的字母写成文字，带引号。"),
  pred(ASK, 's = "a-b-c"\nprint(s.replace("-", ""))', [
    ("abc", "把每个 - 换成空字符串，等于删掉所有 -。"),
    ("a-b-c", "replace 交回新的字符串并被 print 出来了；新的里面没有 -。"),
    ("a b c", "换成的是空字符串 \"\"，不是空格。"),
    ("ab-c", "replace 会换掉所有出现的，不只第一个。")],
    "换成 \"\" 就是删掉。"),
]))
# ---------- L5 拆分、拼接、大小写 ----------
L.append(lesson(5, "拆分、拼接、大小写", "s.split()、\"-\".join()、upper / lower",
  "s.split() 按空格把字符串拆成列表；\"-\".join(列表) 用 - 把列表里的字符串接成一个。s.upper() 全变大写，s.lower() 全变小写。它们都交回新的值，不改原来的 s。",
  's = "I love py"\nw = s.split()\nprint(w)\nprint("-".join(w))', [
  pred(ASK, 's = "a b c"\nprint(s.split())', [
    ("['a', 'b', 'c']", "split() 按空格拆开，得到一个列表，里面是三个字符串。"),
    ("abc", "split 不是删空格；它交回列表。"),
    ("['a b c']", "按空格拆开了：三个字母各是一个元素。"),
    ("['a', ' ', 'b', ' ', 'c']", "空格是分隔的地方，不会留在列表里。")],
    "split() 交回列表。"),
  pred(ASK, 'w = ["x", "y", "z"]\nprint("+".join(w))', [
    ("x+y+z", "用 + 接起来：只放在元素之间，开头结尾都不加。"),
    ("+x+y+z", "join 只把分隔符放在元素之间，开头不加。"),
    ("x+y+z+", "结尾也不加分隔符。"),
    ("xyz", "分隔符是 \"+\"，每两个元素之间都放一个。")],
    "\"分隔符\".join(列表)：分隔符放在元素之间。"),
  fill("输出：HELLO", 's = "Hello"\nprint(s.{0}())', ["upper", "lower", "title", "split"], "upper", {
    "lower": "lower() 全变小写：hello。",
    "title": "title() 只让每个单词首字母大写：Hello。",
    "split": "split() 交回列表 ['Hello']。"},
    "全变大写：upper。"),
  pred("笔试常见题：把句子里的单词顺序反过来。" + ASK, 's = "I am Tom"\nw = s.split()\nprint(" ".join(w[::-1]))', [
    ("Tom am I", "先拆成 ['I', 'am', 'Tom']，列表反过来是 ['Tom', 'am', 'I']，再用空格接起来。"),
    ("moT ma I", "反过来的是列表（单词的顺序），每个单词里面的字母不动。"),
    ("I am Tom", "w[::-1] 把列表反过来了，顺序变了。"),
    ("moT ma I ", "join 不会在结尾加空格；而且单词里的字母不反。")],
    "先 split 成列表，反转列表，再 join。"),
]))
# ---------- L6 笔试题：回文串 ----------
BUG = 'def is_pal(s):\n    return s == s[::-1]'
RULE = 'def rule(s):\n    s = s.lower()\n    return s == s[::-1]'
def probe(x): return BUG + "\n" + RULE + f'\nx = "{x}"\nprint("不一致" if is_pal(x) != rule(x) else "一致")'
L.append(lesson(6, "笔试题：回文串", "回文判断：统一大小写，再和反转比较",
  "笔试常见题：判断字符串是不是回文——正着读和倒着读一样，比如 \"level\"。思路：先统一成小写，再和反过来的自己比：s == s[::-1]。写成函数，交回 True 或 False。",
  'def is_pal(s):\n    s = s.lower()\n    return s == s[::-1]\nprint(is_pal("Level"))', [
  pred(ASK, BUG + '\nprint(is_pal("abba"))\nprint(is_pal("abc"))', [
    ("True\nFalse", "abba 反过来还是 abba，相等，交回 True；abc 反过来是 cba，不相等，交回 False。"),
    ("False\nTrue", "两个反了：abba 是回文。"),
    ("True\nTrue", "abc 反过来是 cba，和 abc 不一样。"),
    ("abba\ncba", "is_pal 交回的是比较的结果 True / False，不是字符串。")],
    "== 比较交回 True 或 False。"),
  choose("题目要求不区分大小写（\"Aa\" 也算回文）。AI 写的 is_pal 没有统一大小写。用哪个输入测试，能看出它和题目要求不一致？", BUG, "不一致", [
    ('is_pal("Aa")', "题目要求：Aa 统一成小写 aa，是回文，应交回 True；AI 的程序直接比 Aa 和 aA，不相等，交回 False。不一致，测出来了。", probe("Aa")),
    ('is_pal("aa")', "全是小写：题目和程序都交回 True，一致，测不出来。", probe("aa")),
    ('is_pal("ab")', "不是回文：题目和程序都交回 False，一致。", probe("ab")),
    ('is_pal("ABA")', "全是大写，反过来还是 ABA：程序交回 True，题目也是 True，一致。", probe("ABA"))],
    "能测出错的输入，要用上“有大有小”这一点。"),
  fill("不区分大小写：输出 True", 'def is_pal(s):\n    s = s.{0}()\n    return s == s[::-1]\nprint(is_pal("Noon"))', ["lower", "count", "title", "strip"], "lower", {
    "count": "count 要给出数什么，s.count() 没有参数会报 TypeError。这里要的是统一大小写。",
    "title": "title() 让首字母大写：Noon，反过来 nooN，不相等，输出 False。",
    "strip": "strip() 只去掉两头的空格，大小写没变：Noon 和 nooN 不相等，输出 False。"},
    "先把大小写统一：全变小写。"),
  order("排好顺序：写出不区分大小写的回文判断，并测试 \"Level\"。输出：True", ["def is_pal(s):", "    s = s.lower()", "    return s == s[::-1]", 'print(is_pal("Level"))'], [3, 2, 0, 1],
    "先 def；函数里先统一小写，再 return 比较；最后在函数外调用。"),
]))

unit = {"id": "U10", "title": "字符串操作", "subtitle": "切片、查找、替换、拆分", "lessons": L}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit10.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(L), "题目", sum(len(l["exercises"]) for l in L))
for l in L:
    for e in l["exercises"]:
        if e["type"] == "order": print(l["id"], "排序可接受顺序", len(e["answers"]))
