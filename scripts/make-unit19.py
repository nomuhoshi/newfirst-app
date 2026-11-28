# 生成 content/unit19.json（第 19 单元「栈与队列」，第二版课程结构阶段四“算法题型”，docs/59 §8）。
# 笔试题面；最后一关是笔试常见题“有效的括号”（LeetCode 20）。每关 4 题；只有点选部分（代码题仍关闭）。
# 新教：栈（append / pop()，后进先出）、队列（append / pop(0)，先进先出）、用栈处理退格、队列模拟轮流、单调栈（下一个更大的数）。
# 不用 +=、%、lambda、global、deque、enumerate。每道题的答案都由真实 Python 运行得出（见 scripts/unitgen.py）。
# 运行：python3 scripts/make-unit19.py && python3 scripts/verify-content.py
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from unitgen import ASK, pred, err, choose, fill, order, lesson as _lesson
lesson = lambda *a: _lesson("U19", *a)

L = []
# ---------- L1 栈 ----------
L.append(lesson(1, "栈：后进先出", "append 压进去，pop() 从最后弹出来",
  "栈像一摞盘子：只能从最上面放、从最上面拿。用列表就行：st.append(x) 放到最后（栈顶），st.pop() 拿走并交回最后一个。最后放进去的最先出来，叫后进先出。st[-1] 只看栈顶，不拿走。",
  "st = []\nst.append(1)\nst.append(2)\nprint(st.pop())\nprint(st)", [
  pred(ASK, "st = []\nst.append(\"a\")\nst.append(\"b\")\nst.append(\"c\")\nprint(st.pop())\nprint(st.pop())", [
    ("c\nb", "后进先出：最后放进去的 c 最先出来，然后是 b。"),
    ("a\nb", "pop() 从最后拿，不是从最前面。"),
    ("c\nc", "pop 会把元素拿走，第二次拿到的是下一个 b。"),
    ("['a', 'b']\n['a']", "pop() 交回的是拿出来的那个元素。")],
    "pop()：拿走并交回最后一个。"),
  pred(ASK, "st = [3, 5]\nx = st[-1]\nprint(x)\nprint(len(st))", [
    ("5\n2", "st[-1] 只是看一眼栈顶，不拿走，长度还是 2。"),
    ("5\n1", "看栈顶用 st[-1]，不会改变栈；pop() 才会拿走。"),
    ("3\n2", "-1 是最后一个，也就是栈顶 5。"),
    ("报错", "栈里有元素，st[-1] 取得到。")],
    "st[-1] 看，st.pop() 拿。"),
  fill("依次弹出，输出：\n3\n2\n1", "st = [1, 2, 3]\nfor i in range(3):\n    print({0})", ["st.pop()", "st[-1]", "st.pop(0)", "st[i]"], "st.pop()", {
    "st[-1]": "只看栈顶不拿走，三次都是 3。",
    "st.pop(0)": "pop(0) 从最前面拿：1、2、3，顺序反了。",
    "st[i]": "按下标从前往后看：1、2、3，而且没有拿走。"},
    "拿走最后一个：pop()。"),
  err("这段程序报错了，最后一行是：\nIndexError: pop from empty list\n是什么原因？", "st = [7]\nst.pop()\nst.pop()", [
    ("栈里只有一个，第二次 pop 时已经空了", "第一次 pop 拿走了 7，栈空了；再 pop 就没有东西可拿，报 IndexError。弹出前先看 len(st) > 0。"),
    ("pop 只能用一次", "pop 可以用很多次，只要栈里还有东西。"),
    ("7 不能被 pop", "第一次就成功拿出了 7。"),
    ("列表不能当栈用", "列表的 append / pop 就是栈的用法。")],
    "pop 之前先确认不是空的。"),
]))

# ---------- L2 退格 ----------
BS = "st = []\nfor x in s:\n    if x == \"#\":\n        if len(st) > 0:\n            st.pop()\n    else:\n        st.append(x)\nprint(\"\".join(st))"
L.append(lesson(2, "用栈处理退格", "遇到 # 就弹出最后一个字符",
  "笔试常见题（LeetCode 844）：打字时 # 表示退格，删掉前一个字符。用栈：普通字符压进去，遇到 # 就弹出一个（栈空时什么都不做）。最后栈里剩下的就是打出来的结果。",
  's = "ab#c"\nst = []\nfor x in s:\n    if x == "#":\n        st.pop()\n    else:\n        st.append(x)\nprint(st)', [
  pred(ASK, 's = "ab#c"\n' + BS, [
    ("ac", "a、b 压进去；# 弹出 b；c 压进去：剩 a、c。"),
    ("abc", "# 删掉了它前面的 b。"),
    ("ab#c", "# 不会留在结果里，它是退格。"),
    ("a", "# 只删一个字符，后面的 c 还会加进来。")],
    "遇到 # 弹出一个。"),
  pred(ASK, 's = "a##b"\n' + BS, [
    ("b", "a 压进去；第一个 # 弹出 a；第二个 # 时栈空，什么都不做；最后压入 b。"),
    ("ab", "a 被第一个 # 删掉了。"),
    ("报错", "栈空时先判断了 len(st) > 0，不会 pop 空栈。"),
    ("", "最后还压入了 b。")],
    "栈空时退格：什么都不做。"),
  fill("打字结果，输出：ac", 'def typed(s):\n    st = []\n    for x in s:\n        if x == "#":\n            if len(st) > 0:\n                st.pop()\n        else:\n            {0}\n    return "".join(st)\nprint(typed("ab#c"))', ["st.append(x)", "st.pop()", "st = [x]", "st.append(\"#\")"], "st.append(x)", {
    "st.pop()": "普通字符也去弹：第一个 a 来时栈是空的，pop 空栈报错。",
    "st = [x]": "每次都换成只装一个字符的新列表，前面的都丢了，只剩 c。",
    "st.append(\"#\")": "压进去的都是 #，字母全丢了，输出 ##。"},
    "普通字符：压进栈。"),
  pred("一共 push 和 pop 了几次？" + ASK, 's = "abc##"\nc = 0\nst = []\nfor x in s:\n    if x == "#":\n        st.pop()\n    else:\n        st.append(x)\n    c = c + 1\nprint(c)', [
    ("5", "每个字符做一次：压或弹。5 个字符 5 次，O(n)。"),
    ("3", "# 也各做了一次 pop。"),
    ("2", "a、b、c 各压了一次。"),
    ("1", "每个字符都在循环里处理了一次。")],
    "每个字符只处理一次：O(n)。"),
]))
# ---------- L3 队列 ----------
L.append(lesson(3, "队列：先进先出", "append 排到队尾，pop(0) 从队头出",
  "队列像排队：从队尾进，从队头出，先来的先走，叫先进先出。用列表：q.append(x) 排到队尾，q.pop(0) 从队头拿走。注意 pop(0) 后面的元素都要往前挪，数据很多时慢；以后会学更快的写法。",
  "q = []\nq.append(1)\nq.append(2)\nprint(q.pop(0))", [
  pred(ASK, 'q = ["甲", "乙"]\nq.append("丙")\nprint(q.pop(0))\nprint(q)', [
    ("甲\n['乙', '丙']", "丙排到队尾；pop(0) 让队头的甲出队，剩乙、丙。"),
    ("丙\n['甲', '乙']", "pop(0) 从队头拿，不是队尾。"),
    ("甲\n['甲', '乙', '丙']", "pop(0) 会把甲拿走。"),
    ("乙\n['甲', '丙']", "下标 0 是队头的甲。")],
    "先进先出：pop(0)。"),
  pred(ASK, "q = [1, 2, 3]\nst = [1, 2, 3]\nprint(q.pop(0))\nprint(st.pop())", [
    ("1\n3", "队列从前面出：1；栈从后面出：3。"),
    ("3\n1", "两个反了：pop(0) 是最前面，pop() 是最后面。"),
    ("1\n1", "pop() 不写参数时拿最后一个。"),
    ("3\n3", "pop(0) 拿的是下标 0。")],
    "队列 pop(0)，栈 pop()。"),
  fill("按到达顺序处理，输出：\nA\nB\nC", 'q = ["A", "B", "C"]\nwhile len(q) > 0:\n    print({0})', ["q.pop(0)", "q.pop()", "q.pop(1)", "q.pop(2)"], "q.pop(0)", {
    "q.pop()": "从队尾拿：C、B、A，顺序反了。",
    "q.pop(1)": "先拿下标 1 的 B，再拿 C；只剩 A 时下标 1 不存在，报错。",
    "q.pop(2)": "先拿 C；剩两个时下标 2 不存在，报错。"},
    "从队头拿：pop(0)。"),
  pred(ASK, "q = [5]\nq.append(6)\nq.pop(0)\nq.append(7)\nprint(q)", [
    ("[6, 7]", "5 出队，7 排到队尾：剩 6、7。"),
    ("[5, 6, 7]", "pop(0) 拿走了 5。"),
    ("[7, 6]", "新来的排在队尾。"),
    ("[5, 7]", "出队的是最先来的 5。")],
    "一行行追：谁进、谁出。"),
]))
# ---------- L4 队列模拟 ----------
RR = "q = [[\"A\", 2], [\"B\", 1],\n     [\"C\", 2]]\nwhile len(q) > 0:\n    job = q.pop(0)\n    print(job[0])\n    job[1] = job[1] - 1\n    if job[1] > 0:\n        q.append(job)"
L.append(lesson(4, "轮流做", "做一点就排回队尾：队列模拟",
  "很多题是“轮流”：每个任务做一次就排回队尾，直到做完。用队列：从队头拿出一个，做一次；还没做完就 append 回队尾。打印机、排队、轮流发言都是这样。",
  "q = [\"A\", \"B\"]\nx = q.pop(0)\nq.append(x)\nprint(q)", [
  pred("每个任务要做的次数写在后面。" + ASK, RR, [
    ("A\nB\nC\nA\nC", "第一轮 A、B、C 各做一次；B 做完了，A、C 还剩 1 次，排回队尾，再做一轮。"),
    ("A\nA\nB\nC\nC", "做一次就排回队尾，不是一个做完再做下一个。"),
    ("A\nB\nC", "A 和 C 要做 2 次，会再轮一遍。"),
    ("A\nB\nC\nA\nB\nC", "B 只要做 1 次，第一轮就做完了，不再排队。")],
    "做一次，没做完就排回去。"),
  pred("报数游戏：每次把队头的人移到队尾，第 3 个报数的人出局。" + ASK, 'q = ["甲", "乙", "丙", "丁"]\nfor i in range(2):\n    q.append(q.pop(0))\nprint(q.pop(0))', [
    ("丙", "移了两次：甲、乙排到后面，队头变成丙，丙出局。"),
    ("甲", "先移了两个人到队尾。"),
    ("丁", "只移了 2 次，队头是丙。"),
    ("乙", "甲、乙都被移到了队尾。")],
    "q.append(q.pop(0))：队头排到队尾。"),
  fill("轮流：没做完就排回队尾。输出：\nA\nB\nA", 'q = [["A", 2], ["B", 1]]\nwhile len(q) > 0:\n    job = q.pop(0)\n    print(job[0])\n    job[1] = job[1] - 1\n    if job[1] > 0:\n        {0}', ["q.append(job)", "q = [job]", "print(job)", "q.pop()"], "q.append(job)", {
    "q = [job]": "整个队列换成只剩 job：B 被丢掉，A 连着做了两次。",
    "print(job)": "没有排回去，A 只做了一次，还多显示了一行列表。",
    "q.pop()": "把别的任务拿掉了：B 根本没机会做。"},
    "排回队尾：append。"),
  pred(ASK, "q = [1, 2, 3]\nc = 0\nwhile len(q) > 0:\n    x = q.pop(0)\n    c = c + 1\n    if x == 2:\n        q.append(9)\nprint(c)", [
    ("4", "1、2、3 各出队一次；处理 2 时又排进来一个 9，9 也要出队一次：共 4 次。"),
    ("3", "处理 2 的时候新加了一个 9，也要处理。"),
    ("5", "只加了一个 9。"),
    ("报错", "队列最后会变空，while 停下。")],
    "新排进来的也要处理。"),
]))
# ---------- L5 单调栈 ----------
NG = "res = []\nfor i in range(len(a)):\n    res.append(-1)\nst = []\nfor i in range(len(a)):\n    while len(st) > 0:\n        j = st[-1]\n        if a[j] >= a[i]:\n            break\n        res[j] = a[i]\n        st.pop()\n    st.append(i)\nprint(res)"
L.append(lesson(5, "下一个更大的数", "单调栈：栈里放还没找到答案的下标",
  "笔试常见题：对每个数，找它右边第一个比它大的数，没有就是 -1。两层循环是 O(n²)。单调栈：从左往右走，栈里放“还在等答案”的下标；新来的数比栈顶大，栈顶就找到答案了，弹出来。每个下标进出栈一次，O(n)。",
  "a = [2, 1, 3]\nst = [0, 1]\ni = 2\nwhile len(st) > 0:\n    j = st[-1]\n    if a[j] >= a[i]:\n        break\n    print(st.pop())", [
  pred(ASK, "a = [2, 1, 3]\n" + NG, [
    ("[3, 3, -1]", "2 右边第一个更大的是 3；1 右边是 3；3 右边没有，-1。"),
    ("[1, 3, -1]", "1 比 2 小，不是“更大的”。"),
    ("[3, 3, 3]", "3 右边没有数了，是 -1。"),
    ("[-1, -1, -1]", "走到 3 时，栈里的 2 和 1 都找到了答案。")],
    "右边第一个比它大的。"),
  pred(ASK, "a = [5, 4, 3]\n" + NG, [
    ("[-1, -1, -1]", "一直在变小，每个数右边都没有更大的。栈里的下标一直等到最后，都是 -1。"),
    ("[4, 3, -1]", "4 比 5 小，不是“更大的”。"),
    ("[5, 4, 3]", "这是原列表；答案列表一开始全是 -1。"),
    ("[3, 3, -1]", "3 比 5、4 都小。")],
    "一直变小：都找不到。"),
  fill("栈顶的数不比新来的小，就停下。输出：[3, 4, -1, -1]", "a = [1, 3, 4, 2]\n" + NG.replace("a[j] >= a[i]", "a[j] {0} a[i]"), [">=", "<", "==", "!="], ">=", {
    "<": "反了：栈顶更大时反而弹出，找到的是右边第一个更小的数：[-1, 2, 2, -1]。",
    "==": "只有相等才停下，其余都弹出：每个数的答案变成它右边紧挨的那个，[3, 4, 2, -1]。",
    "!=": "只有相等才弹出，这组数里没有相等的，全是 -1。"},
    "新来的更大才弹出；否则（栈顶 >= 新来的）停下。"),
  pred("数一数一共弹出了几次。" + ASK, "a = [3, 1, 2, 5]\nst = []\nc = 0\nfor i in range(len(a)):\n    while len(st) > 0:\n        j = st[-1]\n        if a[j] >= a[i]:\n            break\n        st.pop()\n        c = c + 1\n    st.append(i)\nprint(c)", [
    ("3", "走到 2 时弹出 1；走到 5 时弹出 2、3：一共 3 次。每个下标最多进出一次，所以是 O(n)。"),
    ("4", "5 是最后一个，还在栈里，没被弹出。"),
    ("6", "单调栈不是两两比较，每个下标只弹一次。"),
    ("1", "走到 5 时，栈里的 2 和 3 都被弹出来了。")],
    "每个下标最多弹一次：O(n)。"),
]))
# ---------- L6 笔试题：有效的括号 ----------
VP = "def ok(s):\n    p = {\")\": \"(\", \"]\": \"[\"}\n    st = []\n    for x in s:\n        if x in p:\n            if len(st) == 0:\n                return False\n            t = st.pop()\n            if t != p[x]:\n                return False\n        else:\n            st.append(x)\n    return len(st) == 0"
L.append(lesson(6, "笔试题：有效的括号", "左括号压栈；右括号弹出看是否配对",
  "笔试常见题（LeetCode 20）：判断括号字符串是否有效。左括号压进栈；遇到右括号，栈顶必须是和它配对的左括号，弹出来；对不上就无效。最后栈要空，否则有左括号没配上。",
  "st = []\nfor x in \"(())\":\n    if x == \"(\":\n        st.append(x)\n    else:\n        st.pop()\nprint(len(st) == 0)", [
  pred(ASK, VP + '\nprint(ok("([])"))\nprint(ok("([)]"))', [
    ("True\nFalse", "([]) 一层套一层，每个右括号都和栈顶配上；([)] 里 ) 遇到的栈顶是 [，对不上。"),
    ("True\nTrue", "([)] 括号个数虽然对，但交叉了：) 来的时候栈顶是 [。"),
    ("False\nTrue", "第一个是完全正确的嵌套。"),
    ("False\nFalse", "([]) 是有效的。")],
    "右括号必须和栈顶配对。"),
  pred(ASK, VP + '\nprint(ok("(("))\nprint(ok("))"))', [
    ("False\nFalse", "(( 走完栈里还剩两个，没配上；)) 一开始栈就空了，直接 False。"),
    ("True\nFalse", "(( 走完栈不空，有左括号没配对。"),
    ("False\n报错", "栈空时先判断 len(st) == 0，直接 False，不会 pop 空栈。"),
    ("True\nTrue", "两个都不是有效的括号。")],
    "最后栈要空；中途栈空又来右括号也不行。"),
  fill("最后栈里不能剩左括号。输出：False", VP.replace("    return len(st) == 0", "    return {0}") + '\nprint(ok("(()"))', ["len(st) == 0", "True", "len(st) > 0", "len(st) == 1"], "len(st) == 0", {
    "True": "不看栈里还剩没剩：(() 剩一个 ( 没配上，却交回了 True。",
    "len(st) > 0": "反了：剩下了左括号才是无效的，这里交回 True。",
    "len(st) == 1": "剩一个才算有效？(() 正好剩一个 (，交回 True。"},
    "全部配完：栈是空的。"),
  choose("AI 只数了左右括号的个数是否相等。用哪个输入测试，能看出它错了？", 'def ok(s):\n    a = s.count("(")\n    b = s.count(")")\n    return a == b', "不一致", [
    ('ok(")(")', "个数相等，AI 交回 True；可是 ) 先来的时候前面没有 ( 配对，其实无效。不一致。", 'def ok(s):\n    a = s.count("(")\n    b = s.count(")")\n    return a == b\ndef rule(s):\n    st = []\n    for x in s:\n        if x == ")":\n            if len(st) == 0:\n                return False\n            st.pop()\n        else:\n            st.append(x)\n    return len(st) == 0\nprint("不一致" if ok(")(") != rule(")(") else "一致")'),
    ('ok("()")', "有效，AI 也交回 True，一致。", 'def ok(s):\n    a = s.count("(")\n    b = s.count(")")\n    return a == b\ndef rule(s):\n    st = []\n    for x in s:\n        if x == ")":\n            if len(st) == 0:\n                return False\n            st.pop()\n        else:\n            st.append(x)\n    return len(st) == 0\nprint("不一致" if ok("()") != rule("()") else "一致")'),
    ('ok("(()")', "个数不等，AI 交回 False；也确实无效，一致。", 'def ok(s):\n    a = s.count("(")\n    b = s.count(")")\n    return a == b\ndef rule(s):\n    st = []\n    for x in s:\n        if x == ")":\n            if len(st) == 0:\n                return False\n            st.pop()\n        else:\n            st.append(x)\n    return len(st) == 0\nprint("不一致" if ok("(()") != rule("(()") else "一致")')],
    "个数对不等于顺序对：试试右括号先出现。"),
]))

unit = {"id": "U19", "title": "栈与队列", "subtitle": "后进先出、先进先出、括号匹配", "lessons": L}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit19.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(L), "题目", sum(len(l["exercises"]) for l in L))
