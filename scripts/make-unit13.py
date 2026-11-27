# 生成 content/unit13.json（第 13 单元「递归」，第二版课程结构阶段三“刷题工具箱”，docs/59 §8）。
# 笔试题面风格；最后一关是笔试常见题（爬楼梯，LeetCode 70）。每关 4 题。
# 新教：函数调用自己、终止条件（base case）、没有终止条件会 RecursionError、递归交回值、递归处理列表 a[0] + f(a[1:])、
#   递归前后输出的顺序。不用 +=、%、lambda、记忆化。每道题的答案都由真实 Python 运行得出（见 scripts/unitgen.py）。
# 运行：python3 scripts/make-unit13.py && python3 scripts/verify-content.py
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from unitgen import ASK, pred, err, choose, fill, order, lesson as _lesson
lesson = lambda *a: _lesson("U13", *a)

DOWN = 'def down(n):\n    if n == 0:\n        print("go")\n        return\n    print(n)\n    down(n - 1)'
FACT = "def fact(n):\n    if n == 1:\n        return 1\n    return n * fact(n - 1)"
L = []
# ---------- L1 函数调用自己 ----------
L.append(lesson(1, "函数调用自己", "递归：函数里调用自己，问题一步步变小",
  "函数可以调用自己，这叫递归。down(3) 显示 3，再去做 down(2)，一直到 n 是 0：这时显示 go 并 return，不再往下调用。每次调用 n 都小 1，问题越来越小，最后停下。",
  'def down(n):\n    if n == 0:\n        return\n    print(n)\n    down(n - 1)\ndown(2)', [
  pred(ASK, DOWN + "\ndown(3)", [
    ("3\n2\n1\ngo", "down(3) 显示 3 后调用 down(2)，再 down(1)，再 down(0)：n 是 0，显示 go 并结束。"),
    ("3\ngo", "显示 3 之后还会调用 down(2)、down(1)，每次都显示一个数。"),
    ("3\n2\n1\n0\ngo", "n 是 0 时走进 if：只显示 go 就 return，不会显示 0。"),
    ("go\n1\n2\n3", "每次都是先显示 n、再调用下一层，所以从 3 往下数。")],
    "一层一层追：每次调用 n 变成多少？什么时候停？"),
  pred(ASK, DOWN + "\ndown(0)", [
    ("go", "一开始 n 就是 0，直接走进 if，显示 go 并 return，一次都不往下调用。"),
    ("0\ngo", "n 是 0 时走的是 if 里面，print(n) 那一行没有执行。"),
    ("什么都不显示", "if 里会先 print(\"go\") 再 return。"),
    ("报错", "n == 0 时就停了，不会一直调用下去。")],
    "先看终止条件：一开始就满足，就直接停。"),
  fill("从 4 倒数到 1，最后显示 go", DOWN + "\ndown({0})", ["4", "3", "5", "0"], "4", {
    "3": "从 3 开始数：少了 4。",
    "5": "从 5 开始数：多了 5。",
    "0": "down(0) 直接显示 go，一个数都没有。"},
    "从几开始数，就传几。"),
  pred(ASK, 'def up(n):\n    if n == 0:\n        return\n    up(n - 1)\n    print(n)\nup(3)', [
    ("1\n2\n3", "这次是先调用 up(n - 1)、回来以后才显示 n：最里层 up(1) 先显示 1，然后 up(2) 显示 2，最后 up(3) 显示 3。"),
    ("3\n2\n1", "print 在递归调用的后面：要等里面的层都做完回来才显示，所以从小到大。"),
    ("0\n1\n2\n3", "n 是 0 时直接 return，不显示。"),
    ("3", "每一层回来时都会显示自己的 n，一共 3 行。")],
    "print 在递归调用之后：先一路走到底，回来的路上才显示。"),
]))
# ---------- L2 终止条件 ----------
L.append(lesson(2, "一定要有终止条件", "base case；没有它会 RecursionError",
  "递归必须有一个不再调用自己的情况，叫终止条件。没有它，函数会一直调用下去，Python 到了上限（大约 1000 层）就报 RecursionError。还要保证每次调用都更接近终止条件，比如 n - 1。",
  "def f(n):\n    if n == 0:\n        return 0\n    return f(n - 1)\nprint(f(3))", [
  err("这段程序报错了，最后一行是：\nRecursionError: maximum recursion depth exceeded\n是什么原因？", "def f(n):\n    return f(n - 1)\nf(3)", [
    ("没有终止条件，f 一直调用自己，超过了上限", "f 里没有任何情况会停下：f(3) 调用 f(2)，再 f(1)、f(0)、f(-1)……一直调用，到上限就报 RecursionError。"),
    ("n - 1 写错了，应该写 n + 1", "改成 n + 1 也没有终止条件，照样停不下来。"),
    ("函数不能调用自己", "函数可以调用自己；问题是没有停下来的条件。"),
    ("return 不能写在函数的第一行", "return 写在哪一行都可以；问题是它每次都去调用自己，没有停下来的情况。")],
    "RecursionError：递归太深，多半是忘了终止条件。"),
  err("这段程序也报 RecursionError。它有终止条件，为什么还是停不下来？", "def f(n):\n    if n == 0:\n        return\n    f(n - 2)\nf(3)", [
    ("n 每次减 2：3、1、-1……跳过了 0，永远碰不到 n == 0", "从 3 开始减 2 只会得到奇数，终止条件 n == 0 永远不成立。"),
    ("终止条件要写成 n == 1", "写成 n == 1 对 f(3) 可以，但 f(4) 又会跳过 1。更稳的是 n <= 0。"),
    ("return 后面要写一个值", "return 不写值也能结束这次调用；问题是根本走不到它。"),
    ("f(3) 的参数太大了", "3 很小；问题是减 2 跳过了 0。")],
    "每次调用都要真的越来越接近终止条件。"),
  fill("n 每次减 2，也要能停下。输出：3", "def f(n):\n    if n {0} 0:\n        return 0\n    return 1 + f(n - 2)\nprint(f(5))", ["<=", "==", ">", "!="], "<=", {
    "==": "5、3、1、-1……减 2 跳过了 0，n == 0 永远不成立，报 RecursionError。",
    ">": "5 > 0 一开始就成立，直接交回 0，根本没有递归。",
    "!=": "5 != 0 一开始就成立，直接交回 0。"},
    "跳过 0 时也要能停：n <= 0。"),
  pred(ASK, "def f(n):\n    if n <= 0:\n        return 0\n    return 1 + f(n - 2)\nprint(f(4))", [
    ("2", "f(4) = 1 + f(2) = 1 + 1 + f(0)，f(0) 交回 0，一共 2。"),
    ("4", "每次减 2，不是减 1：只加了 2 次 1。"),
    ("3", "f(0) 满足 n <= 0，交回 0，不再加 1。"),
    ("报错", "n 是 0 时就停了。")],
    "把每一层写出来：f(4)、f(2)、f(0)。"),
]))
# ---------- L3 递归交回值 ----------
L.append(lesson(3, "递归交回结果", "return n * fact(n - 1)：先算下一层，再用它的结果",
  "递归也能交回值。阶乘 fact(n) = n × fact(n - 1)，终止条件是 fact(1) 交回 1。算 fact(3) 要先算 fact(2)，fact(2) 要先算 fact(1)；最里层交回后，再一层层乘回来：1、2、6。",
  FACT + "\nprint(fact(3))", [
  pred(ASK, FACT + "\nprint(fact(4))", [
    ("24", "fact(4) = 4 × fact(3) = 4 × 3 × fact(2) = 4 × 3 × 2 × 1 = 24。"),
    ("10", "这是 4 + 3 + 2 + 1；这里是乘。"),
    ("4", "fact(4) 还要乘上 fact(3) 的结果。"),
    ("12", "别漏了最后乘的 2 和 1：4 × 3 × 2 × 1 = 24。")],
    "从最里层往外乘回来。"),
  pred(ASK, "def f(n):\n    if n == 1:\n        return 1\n    return n + f(n - 1)\nprint(f(4))", [
    ("10", "f(4) = 4 + f(3) = 4 + 3 + 2 + 1 = 10。"),
    ("24", "这里是加，不是乘。"),
    ("4", "f(4) 还要加上 f(3) 的结果。"),
    ("9", "f(1) 交回 1，也要加上：4 + 3 + 2 + 1。")],
    "一层层展开：4 + f(3)，f(3) 又是 3 + f(2)……"),
  fill("输出 5 的阶乘：120", "def fact(n):\n    if n == 1:\n        return 1\n    return n * {0}\nprint(fact(5))", ["fact(n - 1)", "fact(n)", "n - 1", "fact(n + 1)"], "fact(n - 1)", {
    "fact(n)": "fact(n) 又调用同样的 n，永远到不了 1，报 RecursionError。",
    "n - 1": "这样没有递归：fact(5) 只算 5 × 4 = 20。",
    "fact(n + 1)": "n 越来越大，离 1 越来越远，报 RecursionError。"},
    "下一层要更接近终止条件：n - 1。"),
  err("AI 写的阶乘少了 return，运行报错，最后一行是：\nTypeError: unsupported operand type(s) for *: 'int' and 'NoneType'\n是什么原因？", "def fact(n):\n    if n == 1:\n        return 1\n    n * fact(n - 1)\nprint(fact(3))", [
    ("fact(2) 算完没有 return，交回 None；fact(3) 里 3 * None 算不了", "fact(2) 里的 2 * fact(1) 算出了 2，但没有交回，fact(2) 得到 None；回到 fact(3)，3 * None 就报 TypeError。"),
    ("fact(1) 交回的 1 不能参与乘法", "fact(1) 有 return 1，没有问题；出问题的是没有 return 的那一行。"),
    ("递归函数不能做乘法", "可以做乘法；只是每一层都要把结果 return 出去。"),
    ("print 里不能调用函数", "print(fact(3)) 没问题；错误发生在 fact 里面。")],
    "每一层都要 return 结果，上一层才拿得到；拿不到就是 None。"),
]))

# ---------- L4 递归处理列表 ----------
ADDF = "def add(a):\n    if len(a) == 0:\n        return 0\n    return a[0] + add(a[1:])"
L.append(lesson(4, "递归处理列表", "第一个 + 剩下的：a[0] + f(a[1:])",
  "列表也能递归：列表的和 = 第一个数 + 剩下那部分的和。a[1:] 是去掉第一个以后的列表，每次都短一个，最后变成空列表 []，这就是终止条件：空列表的和是 0。",
  "def add(a):\n    if len(a) == 0:\n        return 0\n    return a[0] + add(a[1:])\nprint(add([1, 2, 3]))", [
  pred(ASK, ADDF + "\nprint(add([4, 5, 6]))", [
    ("15", "4 + add([5, 6]) = 4 + 5 + add([6]) = 4 + 5 + 6 + add([]) = 15 + 0。"),
    ("4", "4 后面还要加上 add([5, 6]) 的结果。"),
    ("0", "0 只是最里层空列表的结果，要一层层加回来。"),
    ("报错", "每次 a[1:] 都短一个，最后是 []，满足终止条件，不会越界。")],
    "第一个 + 剩下的和。"),
  pred(ASK, "a = [7, 8, 9]\nprint(a[1:])\nprint(a[1:][1:])", [
    ("[8, 9]\n[9]", "a[1:] 去掉第一个：[8, 9]；再 [1:] 又去掉一个：[9]。"),
    ("[7, 8]\n[7]", "a[1:] 是从下标 1 到末尾，去掉的是第一个，不是最后一个。"),
    ("8\n9", "切片交回的是列表，带方括号。"),
    ("[8, 9]\n[8]", "第二次是对 [8, 9] 再去掉第一个，剩 [9]。")],
    "a[1:]：去掉第一个，剩下的还是列表。"),
  fill("递归求列表里最大的数，输出：9", "def big(a):\n    if len(a) == 1:\n        return a[0]\n    rest = big({0})\n    if a[0] > rest:\n        return a[0]\n    return rest\nprint(big([3, 9, 4]))", ["a[1:]", "a", "a[0]", "a[:1]"], "a[1:]", {
    "a": "big(a) 又处理同一个列表，永远不会变短，报 RecursionError。",
    "a[0]": "a[0] 是一个数，不是列表，len(数) 会报 TypeError。",
    "a[:1]": "a[:1] 是只有第一个数的列表 [3]，后面的 9 和 4 都没看，结果是 3。"},
    "剩下的部分：去掉第一个，a[1:]。"),
  pred("每一层调用时显示传进来的列表。" + ASK, "def show(a):\n    print(a)\n    if len(a) == 0:\n        return\n    show(a[1:])\nshow([1, 2])", [
    ("[1, 2]\n[2]\n[]", "show([1, 2]) 显示 [1, 2]，然后 show([2]) 显示 [2]，再 show([]) 显示 []，这时长度是 0，停下。"),
    ("[1, 2]\n[2]", "空列表那一层也会先显示 [] 再停。"),
    ("[1, 2]\n[1]\n[]", "a[1:] 去掉的是第一个，[1, 2] 变成 [2]。"),
    ("1\n2", "print(a) 显示的是整个列表。")],
    "终止的那一层也会先执行它前面的代码。"),
]))
# ---------- L5 递归的调用顺序 ----------
L.append(lesson(5, "一层层进去，一层层回来", "递归调用前后的代码，执行顺序不同",
  "递归像下楼再上楼：调用自己之前的代码，在“下去”时按顺序执行；调用之后的代码，要等更里面的层都结束，在“回来”时才执行，顺序正好反过来。用这一点可以把字符串倒过来。",
  'def rev(s):\n    if s == "":\n        return ""\n    return rev(s[1:]) + s[0]\nprint(rev("abc"))', [
  pred(ASK, 'def go(n):\n    if n == 0:\n        return\n    print("in", n)\n    go(n - 1)\n    print("out", n)\ngo(2)', [
    ("in 2\nin 1\nout 1\nout 2", "下去时先显示 in 2、in 1；到 0 停下；回来时先结束里层，显示 out 1，再 out 2。"),
    ("in 2\nout 2\nin 1\nout 1", "go(2) 要等 go(1) 完全结束才执行 out 2，所以 out 2 在最后。"),
    ("in 2\nin 1\nout 2\nout 1", "回来的顺序是反的：最里面的 go(1) 先结束。"),
    ("in 1\nin 2\nout 1\nout 2", "下去时从 2 开始：先 in 2。")],
    "调用前：去程顺序；调用后：回程，顺序相反。"),
  pred(ASK, 'def rev(s):\n    if s == "":\n        return ""\n    return rev(s[1:]) + s[0]\nprint(rev("dog"))', [
    ("god", "rev(\"dog\") = rev(\"og\") + \"d\" = rev(\"g\") + \"o\" + \"d\" = \"g\" + \"o\" + \"d\"。第一个字母被放到了最后。"),
    ("dog", "每层都把 s[0] 接在后面，第一个字母最后才接上。"),
    ("d", "rev 一路递归到空串，再一层层接回来，一共 3 个字母。"),
    ("报错", "空串时 s == \"\" 成立，交回 \"\"，不会越界。")],
    "把第一个字符放到“剩下的倒过来”的后面。"),
  fill("把字符串倒过来，输出：cba", 'def rev(s):\n    if s == "":\n        return ""\n    return {0}\nprint(rev("abc"))', ["rev(s[1:]) + s[0]", "s[0] + rev(s[1:])", "rev(s) + s[0]", "rev(s[1:])"], "rev(s[1:]) + s[0]", {
    "s[0] + rev(s[1:])": "第一个字母放在了前面，拼出来还是原来的顺序：abc。",
    "rev(s) + s[0]": "rev(s) 处理的还是同一个字符串，永远到不了空串，报 RecursionError。",
    "rev(s[1:])": "每层都丢掉了 s[0]，最后什么都没接上，输出空串。"},
    "剩下的倒过来，再把第一个接在最后。"),
  order("排好顺序：用递归从 1 数到 3（先下去、回来时显示）。输出：\n1\n2\n3", ["def up(n):", "    if n == 0:", "        return", "    up(n - 1)", "    print(n)", "up(3)"], [5, 4, 3, 2, 1, 0],
    "先写终止条件；回来时才显示，所以 print 在递归调用后面；最后在函数外调用。"),
]))
# ---------- L6 笔试题：爬楼梯 ----------
BUG = "def ways(n):\n    if n <= 2:\n        return 1\n    a = ways(n - 1)\n    b = ways(n - 2)\n    return a + b"
def fixprog(base): return "def ways(n):\n" + base + "\n    a = ways(n - 1)\n    b = ways(n - 2)\n    return a + b\nfor k in [1, 2, 3, 4, 5]:\n    print(ways(k))"
WAYS = "def ways(n):\n    if n == 1:\n        return 1\n    if n == 2:\n        return 2\n    a = ways(n - 1)\n    b = ways(n - 2)\n    return a + b"
L.append(lesson(6, "笔试题：爬楼梯", "最后一步走 1 级或 2 级：ways(n) = ways(n - 1) + ways(n - 2)",
  "笔试常见题：楼梯有 n 级，每次走 1 级或 2 级，一共有几种走法？看最后一步：走 1 级前在 n - 1 级，走 2 级前在 n - 2 级。所以 ways(n) = ways(n - 1) + ways(n - 2)，终止条件是 1 级 1 种、2 级 2 种。",
  WAYS + "\nprint(ways(3))", [
  pred(ASK, WAYS + "\nprint(ways(4))", [
    ("5", "ways(3) = ways(2) + ways(1) = 2 + 1 = 3；ways(4) = ways(3) + ways(2) = 3 + 2 = 5。"),
    ("4", "不是每级一种：ways(4) = ways(3) + ways(2) = 3 + 2。"),
    ("3", "3 是 ways(3)。"),
    ("8", "ways(4) = 3 + 2 = 5；8 是 ways(5)。")],
    "从小往大算：1、2、3、5……"),
  choose("AI 把终止条件写成了“n <= 2 时交回 1”。第 2、3 行怎么改，ways(1) 到 ways(5) 才是 1、2、3、5、8？", BUG, "1\n2\n3\n5\n8", [
    ("改成 if n <= 2: return n", "1 级交回 1、2 级交回 2，正好是这两级的走法数；后面按公式加，得 3、5、8。", fixprog("    if n <= 2:\n        return n")),
    ("改成 if n <= 2: return 2", "1 级只有 1 种走法，这样 ways(1) 就错成 2 了。", fixprog("    if n <= 2:\n        return 2")),
    ("改成 if n == 2: return 2", "少了 1 级的终止条件：ways(1) 会去算 ways(0)、ways(-1)……停不下来，报 RecursionError。", fixprog("    if n == 2:\n        return 2")),
    ("不改终止条件，把最后两行改成 return a * 2", "终止条件还是错的，而且翻倍不是走法数的规律：1、1、2、4、8。", BUG.replace("    b = ways(n - 2)\n    return a + b", "    return a * 2") + "\nfor k in [1, 2, 3, 4, 5]:\n    print(ways(k))")],
    "终止条件要对每个“最小的情况”都给出正确答案。"),
  fill("输出 5 级楼梯的走法数：8", "def ways(n):\n    if n <= 2:\n        return n\n    a = ways(n - 1)\n    b = ways(n - 2)\n    return {0}\nprint(ways(5))", ["a + b", "a * 2", "a + 1", "ways(n) + b"], "a + b", {
    "a * 2": "每级翻倍：3 级得 4，5 级得 16。",
    "a + 1": "每级只多一种：3 级得 3，5 级得 5。",
    "ways(n) + b": "ways(n) 又调用自己同样的 n，停不下来，报 RecursionError。"},
    "最后一步走 1 级（a 种）或 2 级（b 种）：两种情况加起来。"),
  order("排好顺序：写出爬楼梯的递归函数并算 4 级。输出：5", ["def ways(n):", "    if n <= 2:", "        return n", "    a = ways(n - 1)", "    b = ways(n - 2)", "    return a + b", "print(ways(4))"], [6, 5, 3, 0, 4, 2, 1],
    "先 def；终止条件写在最前面；a、b 都算出来再 return；最后在函数外调用。"),
]))

unit = {"id": "U13", "title": "递归", "subtitle": "函数调用自己、终止条件", "lessons": L}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit13.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(L), "题目", sum(len(l["exercises"]) for l in L))
