# 生成 content/unit17.json（第 17 单元「排序与二分」，第二版课程结构阶段四“算法题型”，docs/59 §8）。
# 笔试题面；最后一关是笔试常见题“二分查找”（LeetCode 704）。每关 4 题；只有点选部分（代码题仍关闭）。
# 新教：二分查找（lo / hi / mid、while lo <= hi、mid ± 1）、二分的步数、排序后看相邻、找插入位置（LeetCode 35）。
# 不用 +=、%、lambda、global、bisect。每道题的答案都由真实 Python 运行得出（见 scripts/unitgen.py）。
# 运行：python3 scripts/make-unit17.py && python3 scripts/verify-content.py
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from unitgen import ASK, pred, err, choose, fill, order, lesson as _lesson
lesson = lambda *a: _lesson("U17", *a)

def bs(a, t, extra=""):
    return f"a = {a}\nt = {t}\nlo = 0\nhi = len(a) - 1\nans = -1\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n{extra}    if a[mid] == t:\n        ans = mid\n        break\n    if a[mid] < t:\n        lo = mid + 1\n    else:\n        hi = mid - 1\nprint(ans)"

L = []
# ---------- L1 二分查找 ----------
L.append(lesson(1, "二分查找", "排好序的列表：看中间，扔掉一半",
  "在排好序的列表里找 t：先看正中间 a[mid]。等于 t 就找到了；比 t 小，答案只可能在右半边，lo = mid + 1；比 t 大，在左半边，hi = mid - 1。每次扔掉一半，O(log n)。前提：列表已经排好序。",
  "a = [1, 3, 5, 7, 9]\nlo = 0\nhi = 4\nmid = (lo + hi) // 2\nprint(a[mid])", [
  pred(ASK, bs("[1, 3, 5, 7, 9]", 7), [
    ("3", "第 1 次 mid = 2，a[2] 是 5，比 7 小，lo = 3；第 2 次 mid = 3，a[3] 是 7，找到，下标 3。"),
    ("7", "输出的是下标 ans，不是值。"),
    ("4", "下标从 0 开始：7 是第 4 个数，下标 3。"),
    ("-1", "7 在列表里，找得到。")],
    "一步一步记下 lo、hi、mid。"),
  pred(ASK, bs("[2, 4, 6, 8]", 5), [
    ("-1", "mid = 1（4 < 5）→ lo = 2；mid = 2（6 > 5）→ hi = 1；lo > hi，循环结束，没找到，ans 保持 -1。"),
    ("2", "a[2] 是 6，不是 5。"),
    ("1", "a[1] 是 4，不是 5。"),
    ("报错", "找不到时 while 条件不成立就结束了，不会越界。")],
    "lo 跑到 hi 右边：没找到。"),
  fill("找到 9 的下标：4", bs("[1, 3, 5, 7, 9]", 9).replace("    mid = (lo + hi) // 2", "    mid = {0}"), ["(lo + hi) // 2", "(lo + hi) // 2 + 1", "(lo + hi) / 2", "lo + 2"], "(lo + hi) // 2", {
    "(lo + hi) // 2 + 1": "偏到了中间的右边一格：第 2 步 lo = hi = 4 时，mid 变成 5，超出范围，报 IndexError。",
    "(lo + hi) / 2": "/ 得到的是小数 2.0，列表下标不能是小数，报 TypeError。要用整除 //。",
    "lo + 2": "不是取中间：第 1 步看下标 2（5 < 9，lo = 3），第 2 步 mid = 5，超出范围，报 IndexError。"},
    "中间：(lo + hi) // 2，用整除。"),
  pred("没有排好序。" + ASK, bs("[9, 1, 5, 3, 7]", 9), [
    ("-1", "mid = 2，a[2] 是 5 < 9，lo = 3，把 9 所在的左半边扔掉了；之后再也找不到 9。二分要求列表排好序。"),
    ("0", "9 确实在下标 0，但二分在第一步就把左边扔了。"),
    ("4", "a[4] 是 7。"),
    ("报错", "不会报错，只是悄悄找错了，所以更危险。")],
    "二分的前提：已经排好序。"),
]))

# ---------- L2 二分有多快 ----------
def steps_prog(n, t):
    return f"t = {t}\nlo = 0\nhi = {n} - 1\nc = 0\nwhile lo <= hi:\n    c = c + 1\n    mid = (lo + hi) // 2\n    if mid == t:\n        break\n    if mid < t:\n        lo = mid + 1\n    else:\n        hi = mid - 1\nprint(c)"
L.append(lesson(2, "二分有多快", "每步扔掉一半：n 个数最多看大约 log₂n 次",
  "二分每看一次就扔掉一半：16 个数最多看 5 次，1000 个数最多 10 次，100 万个数最多 20 次。一个个找要看 n 次。所以排好序的数据里反复查找，用二分。下面几题的数就是 0、1、2……，第 mid 个数正好是 mid，所以直接比 mid。",
  "n = 16\nc = 0\nwhile n > 0:\n    n = n // 2\n    c = c + 1\nprint(c)", [
  pred("在 0 到 15 这 16 个数里找 15，数一数看了几次。" + ASK, steps_prog(16, 15), [
    ("5", "mid 依次是 7、11、13、14、15：看了 5 次。一个个找要看 16 次。"),
    ("16", "16 是一个个找的次数；二分每次扔掉一半。"),
    ("4", "16 → 8 → 4 → 2 → 1，最后剩一个时还要再看一次：5 次。"),
    ("1", "第一次看的是中间的 7，不是 15。")],
    "每次剩下的范围减半。"),
  pred("在 0 到 999 这 1000 个数里找 0。" + ASK, steps_prog(1000, 0), [
    ("9", "每次往左边减半：mid 依次是 499、249、124、61、30、14、6、2、0，第 9 次找到。"),
    ("1000", "一个个找才是 1000 次。"),
    ("1", "第一次看的是中间的 499。"),
    ("500", "每次扔掉一半，不是只扔一次。")],
    "1000 个数：十次左右。"),
  fill("在 0 到 7 这 8 个数里找 3，看了几次：1", steps_prog(8, "{0}"), ["3", "0", "7", "5"], "3", {
    "0": "找 0：mid 依次是 3、1、0，看了 3 次。",
    "7": "找 7：mid 依次是 3、5、6、7，看了 4 次。",
    "5": "找 5：mid 依次是 3、5，看了 2 次。"},
    "第一次就看到的，是正中间那个数：(0 + 7) // 2。"),
  pred("一个个找，数一数比较了几次（找 999）。" + ASK, "a = []\nfor i in range(1000):\n    a.append(i)\nc = 0\nfor x in a:\n    c = c + 1\n    if x == 999:\n        break\nprint(c)", [
    ("1000", "从头一个个比，999 是最后一个，比了 1000 次。二分只要 10 次左右。"),
    ("10", "这是二分的次数；这里是一个个比。"),
    ("999", "下标 0 到 999 一共 1000 个，999 是第 1000 个。"),
    ("1", "要从第一个开始比。")],
    "一个个找：O(n)；二分：O(log n)。"),
]))
# ---------- L3 边界 ----------
def bs_lt(a, t):
    return f"a = {a}\nt = {t}\nlo = 0\nhi = len(a) - 1\nans = -1\nwhile lo < hi:\n    mid = (lo + hi) // 2\n    if a[mid] == t:\n        ans = mid\n        break\n    if a[mid] < t:\n        lo = mid + 1\n    else:\n        hi = mid - 1\nprint(ans)"
def probe_lt(a, t):
    return "def f(a, t):\n    lo = 0\n    hi = len(a) - 1\n    while lo < hi:\n        mid = (lo + hi) // 2\n        if a[mid] == t:\n            return mid\n        if a[mid] < t:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\ndef g(a, t):\n    if t in a:\n        return a.index(t)\n    return -1\n" + f"print(\"不一致\" if f({a}, {t}) != g({a}, {t}) else \"一致\")"
L.append(lesson(3, "二分的边界", "while lo <= hi：只剩一个数时也要看",
  "二分最容易错在边界。while lo <= hi 的意思是：只剩一个数（lo == hi）时也要看一眼。写成 lo < hi，只剩一个数时循环就停了，正好是答案的话会漏掉。笔试时用只有一个数的列表试一试。",
  "a = [4]\nlo = 0\nhi = 0\nprint(lo <= hi)\nprint(lo < hi)", [
  pred("AI 把条件写成了 while lo < hi。" + ASK, bs_lt("[4]", 4), [
    ("-1", "只有一个数时 lo = hi = 0，lo < hi 不成立，循环一次都没进，ans 还是 -1：漏掉了。"),
    ("0", "要进循环才会找到；lo < hi 一开始就不成立。"),
    ("4", "输出的是下标，而且根本没找到。"),
    ("报错", "不会报错，只是悄悄漏掉了。")],
    "只剩一个数时也要看：lo <= hi。"),
  pred(ASK, bs("[4]", 4), [
    ("0", "lo = hi = 0，lo <= hi 成立，看 a[0] 正是 4，下标 0。"),
    ("-1", "条件是 <=，只剩一个数时也会看。"),
    ("4", "输出的是下标。"),
    ("1", "只有一个数，下标是 0。")],
    "lo <= hi：包括只剩一个数的情况。"),
  choose("AI 写的是 while lo < hi。用哪组测试，能看出它和“正确的二分查找”不一致？", "# AI 的版本：while lo < hi\n# 其余和正确版本一样", "不一致", [
    ("a = [5]，找 5", "只有一个数：正确版本找到下标 0，AI 一次都不进循环，交回 -1。不一致。", probe_lt("[5]", 5)),
    ("a = [5]，找 3", "3 本来就不在：两边都交回 -1，一致。", probe_lt("[5]", 3)),
    ("a = [1, 3, 5]，找 3", "第一次 mid 就是 3：两边都找到下标 1，一致。", probe_lt("[1, 3, 5]", 3)),
    ("a = [2, 4]，找 9", "9 不在：两边都交回 -1，一致。", probe_lt("[2, 4]", 9))],
    "边界错误：用最小的情况测。"),
  fill("只剩一个数时也要看，输出：2", bs("[1, 3, 5]", 5).replace("while lo <= hi:", "while lo {0} hi:"), ["<=", "<", "==", ">"], "<=", {
    "<": "lo = hi = 2 时循环停了，没看到 5，输出 -1。",
    "==": "一开始 lo = 0、hi = 2，不相等，一次都不进循环，输出 -1。",
    ">": "lo > hi 一开始就不成立，输出 -1。"},
    "包括相等：<=。"),
]))
# ---------- L4 排序后看相邻 ----------
L.append(lesson(4, "排序后看相邻", "先排序：相同的、最接近的都挨在一起",
  "很多题先排序就简单了：排好序以后，相同的数挨在一起，最接近的两个数也一定相邻。只要看 a[i] 和 a[i - 1] 这一对对相邻的。排序 O(n log n)，再走一遍 O(n)，比两两比较的 O(n²) 快。",
  "a = sorted([5, 1, 4])\nfor i in range(1, 3):\n    print(a[i] - a[i - 1])", [
  pred("找最接近的两个数的差。" + ASK, "a = sorted([9, 2, 6, 4])\nbest = a[1] - a[0]\nfor i in range(1, len(a)):\n    d = a[i] - a[i - 1]\n    if d < best:\n        best = d\nprint(best)", [
    ("2", "排好是 [2, 4, 6, 9]，相邻的差是 2、2、3，最小是 2。"),
    ("3", "3 是 6 和 9 的差；2 和 4 更近。"),
    ("7", "这是没排序时相邻的差 9 - 2；要先排序。"),
    ("1", "没有差为 1 的两个数。")],
    "最接近的两个数，排序后一定挨着。"),
  pred("有没有重复。" + ASK, 'a = sorted([7, 3, 9, 3])\nans = "无"\nfor i in range(1, len(a)):\n    if a[i] == a[i - 1]:\n        ans = a[i]\nprint(ans)', [
    ("3", "排好是 [3, 3, 7, 9]，两个 3 挨在一起，被发现。"),
    ("无", "排序后重复的数一定相邻。"),
    ("7", "7 只有一个。"),
    ("3\n3", "ans 只在最后显示一次。")],
    "排序后，相同的挨在一起。"),
  fill("排好序后，比较相邻的一对，输出相邻差：\n3\n1", "a = sorted([5, 1, 4])\nfor i in range(1, len(a)):\n    print(a[i] - {0})", ["a[i - 1]", "a[i + 1]", "a[0]", "i"], "a[i - 1]", {
    "a[i + 1]": "i = 2 时 a[3] 超出范围，报 IndexError；而且方向反了。",
    "a[0]": "每次都减第一个：3、4，不是相邻的差。",
    "i": "减的是下标，不是前一个数：0、2。"},
    "相邻：前一个是 a[i - 1]。"),
  pred("range 从 1 开始，不从 0 开始。" + ASK, "a = [2, 5]\nfor i in range(0, len(a)):\n    print(a[i] - a[i - 1])", [
    ("-3\n3", "i = 0 时 a[-1] 是最后一个 5：2 - 5 = -3。这一对不是相邻的，所以 range 要从 1 开始。"),
    ("3", "range 从 0 开始，i = 0 时也算了一次。"),
    ("报错", "a[-1] 不会报错：负下标从末尾数。正因为不报错，这种错不容易发现。"),
    ("0\n3", "i = 0 时 a[0] - a[-1] 是 2 - 5。")],
    "看相邻的一对时，从 i = 1 开始。"),
]))
# ---------- L5 找插入位置 ----------
def ins(a, t, tok="lo"):
    return f"a = {a}\nt = {t}\nlo = 0\nhi = len(a) - 1\nwhile lo <= hi:\n    mid = (lo + hi) // 2\n    if a[mid] < t:\n        lo = mid + 1\n    else:\n        hi = mid - 1\nprint({tok})"
L.append(lesson(5, "找插入位置", "循环结束时，lo 就是第一个 >= t 的位置",
  "笔试常见题（LeetCode 35）：在排好序的列表里，找 t 应该插在哪个下标。还是二分，但找不到时不要返回 -1：循环结束时 lo 正好停在第一个大于或等于 t 的位置，就是答案。",
  ins("[1, 3, 5]", 4), [
  pred(ASK, ins("[1, 3, 5, 7]", 6), [
    ("3", "6 应该插在 5 和 7 之间：下标 3。循环结束时 lo 停在第一个 >= 6 的数 7 的位置。"),
    ("2", "下标 2 是 5，比 6 小，要插在它后面。"),
    ("4", "4 是末尾；6 比 7 小，插在 7 前面。"),
    ("-1", "这个写法找不到时不返回 -1，返回 lo。")],
    "循环结束时看 lo。"),
  pred("t 比所有数都大。" + ASK, ins("[2, 4]", 9), [
    ("2", "9 比 2、4 都大，插在末尾：下标 2（等于列表长度）。"),
    ("1", "下标 1 是 4，9 比它大，要插在后面。"),
    ("报错", "lo 可以等于列表长度，只是没有去取 a[lo]，不会越界。"),
    ("-1", "这个写法不返回 -1。")],
    "比所有数都大：插在末尾，位置 = 长度。"),
  fill("t = 3 已经在列表里，输出它的下标：1", ins("[1, 3, 5]", 3, "{0}"), ["lo", "hi", "mid", "lo - 1"], "lo", {
    "hi": "循环结束时 hi 停在 lo 的左边一格：0。",
    "mid": "mid 是最后一次看的位置：0，不一定是答案。",
    "lo - 1": "lo - 1 就是 hi：0。"},
    "答案看 lo。"),
  pred("t 比所有数都小。" + ASK, ins("[5, 8]", 1), [
    ("0", "1 比所有数都小，插在最前面：下标 0。"),
    ("-1", "这个写法找不到时也不返回 -1：lo 一直没动，是 0。"),
    ("1", "下标 1 是 8；1 要插在 5 前面。"),
    ("报错", "hi 会变成 -1，但我们只输出 lo，不会越界。")],
    "比所有数都小：插在下标 0。"),
]))
# ---------- L6 笔试题：二分查找 ----------
FN = "def search(a, t):\n    lo = 0\n    hi = len(a) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if a[mid] == t:\n            return mid\n        if a[mid] < t:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1"
L.append(lesson(6, "笔试题：二分查找", "写成函数：找到交回下标，找不到交回 -1",
  "笔试常见题（LeetCode 704）：在排好序的列表里找 t，找到交回下标，找不到交回 -1，要 O(log n)。写成函数时，找到就 return mid，循环结束还没找到就 return -1。记住三点：lo <= hi、lo = mid + 1、hi = mid - 1。",
  "def search(a, t):\n    lo = 0\n    hi = len(a) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if a[mid] == t:\n            return mid\n        if a[mid] < t:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\nprint(search([2, 4, 6], 6))", [
  pred(ASK, FN + "\na = [-1, 0, 3, 5, 9]\nprint(search(a, 9))\nprint(search(a, 2))", [
    ("4\n-1", "9 在下标 4；2 不在列表里，交回 -1。"),
    ("9\n-1", "交回的是下标，不是值。"),
    ("4\n2", "2 不在列表里，找不到交回 -1。"),
    ("4\n1", "2 不在列表里；插入位置是另一道题。")],
    "找到交回下标，找不到 -1。"),
  fill("找不到时交回 -1，输出：-1", FN.replace("    return -1", "    return {0}") + "\nprint(search([1, 2], 7))", ["-1", "mid", "lo", "None"], "-1", {
    "mid": "交回最后看过的位置 1，看起来像找到了。",
    "lo": "交回插入位置 2，不是“找不到”。",
    "None": "题目要求找不到交回 -1，交回 None 会输出 None。"},
    "题目规定：找不到交回 -1。"),
  choose("AI 把 hi = mid - 1 写成了 hi = mid。用哪组测试，能看出它出问题？（每组最多让它跑 50 步，跑不完算“出问题”）", "# AI 的版本：hi = mid\n# 其余和正确版本一样", "出问题", [
    ("a = [1, 3]，找 0", "第一次 mid = 0，a[0] = 1 比 0 大，hi = mid = 0；lo = hi = 0，mid 又是 0……lo、hi 再也不变，停不下来。", "def f(a, t):\n    lo = 0\n    hi = len(a) - 1\n    k = 0\n    while lo <= hi and k < 50:\n        k = k + 1\n        mid = (lo + hi) // 2\n        if a[mid] == t:\n            return mid\n        if a[mid] < t:\n            lo = mid + 1\n        else:\n            hi = mid\n    return -1 if k < 50 else \"卡住\"\nr = f([1, 3], 0)\nprint(\"出问题\" if r == \"卡住\" or r != -1 else \"正常\")"),
    ("a = [1, 3]，找 3", "a[0] = 1 比 3 小，lo = 1，再看 a[1] 找到：这组测不出来。", "def f(a, t):\n    lo = 0\n    hi = len(a) - 1\n    k = 0\n    while lo <= hi and k < 50:\n        k = k + 1\n        mid = (lo + hi) // 2\n        if a[mid] == t:\n            return mid\n        if a[mid] < t:\n            lo = mid + 1\n        else:\n            hi = mid\n    return -1 if k < 50 else \"卡住\"\nr = f([1, 3], 3)\nprint(\"出问题\" if r == \"卡住\" or r != 1 else \"正常\")"),
    ("a = [1, 3]，找 1", "第一次 mid = 0 就找到了：测不出来。", "def f(a, t):\n    lo = 0\n    hi = len(a) - 1\n    k = 0\n    while lo <= hi and k < 50:\n        k = k + 1\n        mid = (lo + hi) // 2\n        if a[mid] == t:\n            return mid\n        if a[mid] < t:\n            lo = mid + 1\n        else:\n            hi = mid\n    return -1 if k < 50 else \"卡住\"\nr = f([1, 3], 1)\nprint(\"出问题\" if r == \"卡住\" or r != 0 else \"正常\")")],
    "hi = mid 时，要找的数比左边的都小，就会卡住。"),
  pred("在循环里把每次看的数显示出来。" + ASK, FN.replace("        mid = (lo + hi) // 2\n", "        mid = (lo + hi) // 2\n        print(a[mid])\n") + "\na = [1, 2, 3, 4, 5, 6, 7]\nr = search(a, 1)", [
    ("4\n2\n1", "先看正中间 4，比 1 大，往左；再看 [1, 2, 3] 的中间 2，还大；最后看 1，找到。7 个数只看了 3 次。"),
    ("1", "二分从中间开始看，不是从头。"),
    ("4\n3\n2\n1", "每次扔掉一半，不是一个一个往左挪。"),
    ("4\n1", "看完 4 以后，剩下 [1, 2, 3]，中间是 2，还要再看一次。")],
    "每次都看剩下范围的正中间。"),
]))

unit = {"id": "U17", "title": "排序与二分", "subtitle": "排序后的规律、二分查找", "lessons": L}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit17.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(L), "题目", sum(len(l["exercises"]) for l in L))
