# 代码题 variation 草稿：字段按群里提议（id、prompt、starter、tests、hints、solution；父题 requiresVariationAfterSolution）。
# 还在等 Claude 确认，所以单独放这个文件：确认后只改这里。
# 规则：数据和一个要求都和父题不同，父题的 reference 必须过不了 variation 的隐藏测试（verify 检查）。
def T(name, data, expected, hidden=False):
    d = {"name": name, "data": data, "expected": expected}
    if hidden: d["hidden"] = True
    return d
V = {
 "U3L5-M1": {"prompt": "满 50 元显示“送小料”，不满就显示还差多少。", "starter": "# total 已经准备好\n",
   "tests": [T("60 元", {"total": 60}, "送小料"), T("30 元", {"total": 30}, "还差 20 元"), T("80 元", {"total": 80}, "送小料", True), T("49 元", {"total": 49}, "还差 1 元", True)],
   "hints": ["if total >= 50: 下面显示送小料；其余交给 else。", "else: 下面 print(\"还差\", 50 - total, \"元\")。"],
   "solution": "if total >= 50:\n    print(\"送小料\")\nelse:\n    print(\"还差\", 50 - total, \"元\")\n"},
 "U3L6-M1": {"prompt": "规则：满 200 减 50，满 100 减 15，其余不减。", "starter": "# total 已经准备好\n",
   "tests": [T("250 元", {"total": 250}, "减 50"), T("120 元", {"total": 120}, "减 15"), T("80 元", {"total": 80}, "不减", True), T("正好 200", {"total": 200}, "减 50", True)],
   "hints": ["门槛高的放前面。", "if total >= 200 / elif total >= 100 / else。"],
   "solution": "if total >= 200:\n    print(\"减 50\")\nelif total >= 100:\n    print(\"减 15\")\nelse:\n    print(\"不减\")\n"},
 "U3L7-M1": {"prompt": "杯数大于等于 5 且小于等于 20 时显示“团购价”，否则显示“原价”。", "starter": "# cups 已经准备好\n",
   "tests": [T("10 杯", {"cups": 10}, "团购价"), T("3 杯", {"cups": 3}, "原价"), T("5 杯", {"cups": 5}, "团购价", True), T("20 杯", {"cups": 20}, "团购价", True), T("21 杯", {"cups": 21}, "原价", True)],
   "hints": ["“大于等于”和“小于等于”都包含边界。", "if cups >= 5 and cups <= 20:"],
   "solution": "if cups >= 5 and cups <= 20:\n    print(\"团购价\")\nelse:\n    print(\"原价\")\n"},
 "U3L8-W1": {"prompt": "满 150 元减 30；会员再减 10（会员优惠不受满 150 元限制，不满 150 元的会员也减 10）。输出“应付 金额”。", "starter": "# total、is_vip 已经准备好\n",
   "tests": [T("160 元，非会员", {"total": 160, "is_vip": False}, "应付 130"), T("90 元，会员", {"total": 90, "is_vip": True}, "应付 80"), T("正好 150，会员", {"total": 150, "is_vip": True}, "应付 110", True), T("120 元，非会员", {"total": 120, "is_vip": False}, "应付 120", True)],
   "hints": ["和父题一样两个独立的 if，只是门槛和金额变了。", "pay = total / if total >= 150: pay = pay - 30 / if is_vip: pay = pay - 10。"],
   "solution": "pay = total\nif total >= 150:\n    pay = pay - 30\nif is_vip:\n    pay = pay - 10\nprint(\"应付\", pay)\n"},
 "U4L3-M1": {"prompt": "显示“号码 1”到“号码 n”，每个号码隔 2（1、3、5…，共 n 个）。", "starter": "# n 已经准备好\n",
   "tests": [T("3 个", {"n": 3}, "号码 1\n号码 3\n号码 5"), T("1 个", {"n": 1}, "号码 1"), T("4 个", {"n": 4}, "号码 1\n号码 3\n号码 5\n号码 7", True)],
   "hints": ["第 i 个（i 从 0 开始）的号码是 i * 2 + 1。", "for i in range(n): print(\"号码\", i * 2 + 1)。"],
   "solution": "for i in range(n):\n    print(\"号码\", i * 2 + 1)\n"},
 "U4L4-M1": {"prompt": "每单 3 元，算 n 单一共多少元：每轮加 3。", "starter": "# n 已经准备好\n",
   "tests": [T("n = 2", {"n": 2}, "6"), T("n = 4", {"n": 4}, "12"), T("n = 3", {"n": 3}, "9", True), T("n = 0", {"n": 0}, "0", True)],
   "hints": ["累加器放循环外，每轮加 3。", "total = 0 / for i in range(n): total = total + 3 / print(total)。"],
   "solution": "total = 0\nfor i in range(n):\n    total = total + 3\nprint(total)\n"},
 "U4L5-M1": {"prompt": "数一数 1 到 n 号订单里编号小于 3 的有几单，输出“小单数 数量”。", "starter": "# n 已经准备好\n",
   "tests": [T("5 单", {"n": 5}, "小单数 2"), T("1 单", {"n": 1}, "小单数 1"), T("6 单", {"n": 6}, "小单数 2", True), T("2 单", {"n": 2}, "小单数 2", True)],
   "hints": ["计数器放循环外，if i < 3 才加 1。", "count = 0 / for i in range(1, n + 1): if i < 3: count = count + 1 / print(\"小单数\", count)。"],
   "solution": "count = 0\nfor i in range(1, n + 1):\n    if i < 3:\n        count = count + 1\nprint(\"小单数\", count)\n"},
 "U4L6-M1": {"prompt": "从 n 倒数到 1（每次减 1）。", "starter": "# n 已经准备好\n",
   "tests": [T("n = 3", {"n": 3}, "3\n2\n1"), T("n = 1", {"n": 1}, "1"), T("n = 4", {"n": 4}, "4\n3\n2\n1", True)],
   "hints": ["while 的条件写 x >= 1，循环里要让 x 变小。", "x = n / while x >= 1: print(x) / x = x - 1。"],
   "solution": "x = n\nwhile x >= 1:\n    print(x)\n    x = x - 1\n"},
 "U4L7-M1": {"prompt": "第 skip 杯做坏了要跳过，其余照卖（共 5 杯）。", "starter": "# skip 已经准备好\n",
   "tests": [T("第 3 杯坏", {"skip": 3}, "卖出第 1 杯\n卖出第 2 杯\n卖出第 4 杯\n卖出第 5 杯"), T("第 5 杯坏", {"skip": 5}, "卖出第 1 杯\n卖出第 2 杯\n卖出第 3 杯\n卖出第 4 杯"),
             T("第 1 杯坏", {"skip": 1}, "卖出第 2 杯\n卖出第 3 杯\n卖出第 4 杯\n卖出第 5 杯", True)],
   "hints": ["只跳过这一轮，后面继续：用哪个？", "if i == skip: continue，然后 print。"],
   "solution": "for i in range(1, 6):\n    if i == skip:\n        continue\n    print(\"卖出第\", i, \"杯\")\n"},
 "U4L8-W1": {"prompt": "一共 n 单，每单 3 杯；第 2 号订单多要 2 杯。输出“总杯数 数量”。", "starter": "# n 已经准备好\n",
   "tests": [T("4 单", {"n": 4}, "总杯数 14"), T("1 单", {"n": 1}, "总杯数 3"), T("2 单", {"n": 2}, "总杯数 8", True), T("0 单", {"n": 0}, "总杯数 0", True)],
   "hints": ["和父题一样的结构，换成每单 3 杯、第 2 单多 2 杯。", "total = 0 / for i in range(1, n + 1): total = total + 3 / if i == 2: total = total + 2。"],
   "solution": "total = 0\nfor i in range(1, n + 1):\n    total = total + 3\n    if i == 2:\n        total = total + 2\nprint(\"总杯数\", total)\n"},
 "U5L2-M1": {"prompt": "显示第二单和倒数第二单的杯数。", "starter": "# cups 已经准备好（至少 2 单）\n",
   "tests": [T("3 单", {"cups": [2, 5, 1]}, "第二单 5\n倒数第二单 5"), T("4 单", {"cups": [4, 9, 6, 3]}, "第二单 9\n倒数第二单 6"), T("2 单", {"cups": [1, 8]}, "第二单 8\n倒数第二单 1", True), T("5 单", {"cups": [5, 4, 3, 2, 1]}, "第二单 4\n倒数第二单 2", True)],
   "hints": ["第二个的下标是 1；倒数第二个用负下标。", "print(\"第二单\", cups[1]) / print(\"倒数第二单\", cups[-2])。"],
   "solution": "print(\"第二单\", cups[1])\nprint(\"倒数第二单\", cups[-2])\n"},
 "U5L3-M1": {"prompt": "退掉 drop 杯那单，再把（现在的）第一单改成 first 杯，显示清单。", "starter": "# cups、drop、first 已经准备好\n",
   "tests": [T("退 2 杯", {"cups": [2, 5, 1], "drop": 2, "first": 8}, "[8, 1]"), T("有重复", {"cups": [3, 3, 6], "drop": 3, "first": 4}, "[4, 6]"), T("退最后一单", {"cups": [5, 7], "drop": 7, "first": 1}, "[1]", True), T("退中间", {"cups": [1, 2, 3], "drop": 2, "first": 9}, "[9, 3]", True)],
   "hints": ["remove 按值删（只删第一个）；删完再按下标改。", "cups.remove(drop) / cups[0] = first / print(cups)。"],
   "solution": "cups.remove(drop)\ncups[0] = first\nprint(cups)\n"},
}
def attach(tasks):
    for t in tasks.values():
        v = V.get(t["id"])
        if v:
            t["requiresVariationAfterSolution"] = True
            t["variation"] = {"id": t["id"] + "-V1", **v}
