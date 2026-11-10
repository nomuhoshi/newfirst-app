# U6 第 5、6 关（调试练习与小项目）：题目、答案、错因与验证

分支 `content/u6-part3`（基于 `content/u6-part2`）。按产品官对草稿 `docs/26` 的审稿决定实现；`docs/26` 是草稿，以本文为准。只动课程分支；`rc1/`、#42、正式站、Supabase 不动。

## 0. 实现时的几个口径（请确认）

| # | 口径 | 说明 |
|---|---|---|
| 1 | **“5 关可玩、1 个待开放项目”** | U6 的 `lessons` 里是 L1–L5（地图上 5 关可玩）。L6 项目写在 `content/unit6.json` 的 `heldLessons` 里：题目和代码题都已写好、已用真实 Python 验证，但 app 只读 `lessons`，所以地图上看不到它，学生碰不到。以后开放：把它从 `heldLessons` 挪到 `lessons`，并把 `course.json` 的关数和测试同步。这是我对“项目继续标记待开放”的理解；如果你们想让 L6 作为一个锁住的节点显示在地图上，需要 app 支持“单关待开放”，请定。 |
| 2 | L5 Q4 | 按决定改成 `pick`（现有选择题交互）：“把调试 print 放在哪一行，才能看到每轮更新后的值？”每个选项把 print 真的插进程序运行，只有“每轮更新后显示”的位置输出等于要求。 |
| 3 | L6 示范 | 换成不同场景（面积），并把嵌套表达式拆成三步：先转换、再计算、最后输出。 |
| 4 | L6 三次报错 | 题面和讲解写成“按示例的修法逐处修改时可能看到的顺序”，并说明写法不同顺序也可能不同。 |
| 5 | 正好 5 杯公开用例 | 保留（单价 10 → `应付：45`）。起始代码修好所有报错后仍用 `> 5`，这一组会失败，让学生看到“能运行，边界仍可能算错”。 |

## U6L5 用 print 找 bug（在中间加 print，看变量的值）

**讲解**：有时程序不报错，结果却不对。这时在中间加几行 print，把变量当时的值显示出来，从上往下看，找到第一处和你预想不一样的地方，错就在它附近。加在哪里很重要：想看每一轮更新后的值，print 就要放在更新那一行的下面。

### U6L5-Q1（选输出）小码想算 3 杯 12 元的总价 36，在中间加了一行 print 看看。屏幕上会显示什么？

题面展示的程序：
```python
price = 12
cups = 3
total = price + cups
print("total:", total)
print("应付", total)
```

真实输出：`'total: 15\n应付 15'`

| 选项 | 对错 | 为什么 |
|---|---|---|
| `'total: 15\n应付 15'` | ✅ 对 | 中间的 total 显示 15，不是想要的 36：第 3 行写成了 +，应该是 *。找 bug 就是找第一处和预想不一样的值。 |
| `'total: 36\n应付 36'` | ❌ 错 | 第 3 行是 price + cups，12 + 3 得 15，不是 36。 |
| `'total: 15\n应付 36'` | ❌ 错 | 两行显示的是同一个变量 total，值一样，都是 15。 |

提示：先预想每个变量应该是多少，再对照 print 显示的值。

### U6L5-Q2（选输出）想算 1 + 2 + 3 = 6，小码加了 print 看每一轮。屏幕上会显示什么？

题面展示的程序：
```python
total = 0
for i in range(1, 4):
    total = 0
    total = total + i
    print("第", i, "轮", total)
print(total)
```

真实输出：`'第 1 轮 1\n第 2 轮 2\n第 3 轮 3\n3'`

| 选项 | 对错 | 为什么 |
|---|---|---|
| `'第 1 轮 1\n第 2 轮 2\n第 3 轮 3\n3'` | ✅ 对 | 每一轮 total 都先被 total = 0 清零，再加 i，所以显示的是 i 本身，最后是 3。bug 在循环里的 total = 0。 |
| `'第 1 轮 1\n第 2 轮 3\n第 3 轮 6\n6'` | ❌ 错 | 这是把 total = 0 放在循环外面时才有的结果；这里每一轮都会被清零。 |
| `'第 1 轮 1\n第 2 轮 2\n第 3 轮 3\n6'` | ❌ 错 | 最后的 print(total) 显示的也是被清零后加上 3 的结果：3，不是 6。 |

提示：每一轮开头 total 是多少？

### U6L5-Q3（填空）想看每一轮累加后的 total，print 里填什么？

题面展示的程序：
```python
total = 0
for i in range(1, 4):
    total = total + i
    print("第", i, "轮", {0})
print(total)
```

目标输出：`'第 1 轮 1\n第 2 轮 3\n第 3 轮 6\n6'`；标准答案：`total`。

| 词块 | 对错 | 真实运行 |
|---|---|---|
| `total` | ✅ 对 | '第 1 轮 1\n第 2 轮 3\n第 3 轮 6\n6' |
| `i` | ❌ 错 | '第 1 轮 1\n第 2 轮 2\n第 3 轮 3\n6' |
| `"total"` | ❌ 错 | '第 1 轮 total\n第 2 轮 total\n第 3 轮 total\n6' |

提示：要看变量的值，print 里写变量名，不加引号。

### U6L5-Q4（读报错/怎么改选择）想在循环里加一行 print("total:", total)，看每一轮更新后的值。放在哪一行才对？

题面展示的程序：
```python
total = 0
for i in range(1, 4):
    total = total + i
print(total)
```

| 选项 | 对错 | 为什么 | 真实运行 |
|---|---|---|---|
| `放在 total = 0 的下面，循环外面` | ❌ 错 | 不在循环里，只会显示一次更新之前的值。 | 'total: 0\n6'（要求 'total: 1\ntotal: 3\ntotal: 6\n6'） |
| `放在 total = total + i 的下面，缩进和它一样` | ✅ 对 | 在更新之后、同一个循环里，每一轮都会显示更新后的值。 | 'total: 1\ntotal: 3\ntotal: 6\n6'（要求 'total: 1\ntotal: 3\ntotal: 6\n6'） |
| `放在 total = total + i 的上面，缩进和它一样` | ❌ 错 | 在循环里，但在更新之前，显示的是上一轮的值，第一轮还是 0。 | 'total: 0\ntotal: 1\ntotal: 3\n6'（要求 'total: 1\ntotal: 3\ntotal: 6\n6'） |
| `放在最后一行 print(total) 的下面` | ❌ 错 | 在循环外面，只显示最后一次。 | '6\ntotal: 6'（要求 'total: 1\ntotal: 3\ntotal: 6\n6'） |

提示：更新之后，在同一个循环里。

## U6L6 修好收银程序（一处一处修，每次重新读报错）【待开放，不在地图上】

**讲解**：项目：收银程序有好几处错。price 和 cups 是从点单屏读来的、表示整数的文字，比如 "10" 和 "5"。修的办法：先运行，读最后一行和 line 几；修好一处，再运行，看有没有新的报错；全部不报错了，也要拿几组数据对一对结果，因为有的错不会报错，只会算错。下面三个报错，是按示例的修法逐处修改时可能看到的顺序，你的写法不同，看到的顺序也可能不同。

### U6L6-Q1（读报错/怎么改选择）price 是 "10"、cups 是 "5"，要先算总价 total = 单价 × 杯数。程序先出了下面这个报错，第 3 行怎么改？

题面展示的报错：
```text
Traceback (most recent call last):
  File "main.py", line 3, in <module>
    total = price * cups
TypeError: can't multiply sequence by non-int of type 'str'
```

题面展示的程序：
```python
price = "10"
cups = "5"
total = price * cups
if cups > 5:
    total = total - 5
print("应付：" + total)
```

| 选项 | 对错 | 为什么 | 真实运行 |
|---|---|---|---|
| `第 3 行改成：total = int(price) * int(cups)` | ✅ 对 | price 和 cups 都是表示整数的文字，先分别用 int() 转成整数再乘：10 × 5 = 50。 | '应付：45'（要求 '应付：45'） |
| `第 3 行改成：total = int(price) * cups` | ❌ 错 | cups 还是文字，整数 × 文字还是类型搭配不对，报错 TypeError。 | 报错 TypeError（要求 '应付：45'） |
| `第 3 行改成：total = price * int(cups)` | ❌ 错 | price 还是文字：文字 × 整数不是乘法，是把文字重复 5 遍，后面减 5 又会出错，报错 TypeError。 | 报错 TypeError（要求 '应付：45'） |
| `第 3 行改成：total = str(price) * str(cups)` | ❌ 错 | 两个都变成文字，文字 × 文字没有意思，报错 TypeError。 | 报错 TypeError（要求 '应付：45'） |

提示：两个都是表示整数的文字，乘之前都要转成整数。

### U6L6-Q2（读报错/怎么改选择）第 3 行修好之后，按示例的修法，下一步会看到下面这个报错。第 4 行怎么改？

题面展示的报错：
```text
Traceback (most recent call last):
  File "main.py", line 4, in <module>
    if cups > 5:
TypeError: '>' not supported between instances of 'str' and 'int'
```

题面展示的程序：
```python
price = "10"
cups = "5"
total = int(price) * int(cups)
if cups > 5:
    total = total - 5
print("应付：" + total)
```

| 选项 | 对错 | 为什么 | 真实运行 |
|---|---|---|---|
| `第 4 行改成：if int(cups) >= 5:` | ✅ 对 | cups 先转成整数再比较；正好 5 杯也要减 5 元，所以用 >=。 | '应付：45'（要求 '应付：45'） |
| `第 4 行改成：if int(cups) > 5:` | ❌ 错 | 不报错了，但显示 应付：50，应该是应付：45：正好 5 杯没有减 5 元，边界要用 >=。 | '应付：50'（要求 '应付：45'） |
| `第 4 行改成：if cups >= 5:` | ❌ 错 | cups 还是文字，文字和整数不能比较大小，报错 TypeError。 | 报错 TypeError（要求 '应付：45'） |
| `第 4 行改成：if int(cups) >= "5":` | ❌ 错 | 整数和文字不能比较大小，报错 TypeError。 | 报错 TypeError（要求 '应付：45'） |

提示：正好 5 杯也要减 5 元；cups 还是文字。

### U6L6-Q3（读报错/怎么改选择）前面两处修好之后，按示例的修法，最后一行会看到下面这个报错。第 6 行怎么改？

题面展示的报错：
```text
Traceback (most recent call last):
  File "main.py", line 6, in <module>
    print("应付：" + total)
TypeError: can only concatenate str (not "int") to str
```

题面展示的程序：
```python
price = "10"
cups = "5"
total = int(price) * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + total)
```

| 选项 | 对错 | 为什么 | 真实运行 |
|---|---|---|---|
| `第 6 行改成：print("应付：" + str(total))` | ✅ 对 | total 是整数，拼进文字之前先用 str() 变成文字。 | '应付：45'（要求 '应付：45'） |
| `第 6 行改成：print("应付：" + int(total))` | ❌ 错 | int(total) 还是整数，整数和文字还是不能用 + 接，报错 TypeError。 | 报错 TypeError（要求 '应付：45'） |
| `第 6 行改成：print("应付：", total)` | ❌ 错 | 不报错了，但显示 应付： 45：逗号会在中间加一个空格，和要求的“应付：45”不一样。 | '应付： 45'（要求 '应付：45'） |
| `第 6 行改成：print("应付：" + total)` | ❌ 错 | 没有改：整数 total 不能直接和文字用 + 接，报错 TypeError。 | 报错 TypeError（要求 '应付：45'） |

提示：拼进文字之前，整数要先变成文字；输出要和题目的写法一模一样。

### U6L6-Q4（选输出）三处都改好了。price 是 "8"、cups 是 "6"，屏幕上会显示什么？

题面展示的程序：
```python
price = "8"
cups = "6"
total = int(price) * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + str(total))
```

真实输出：`'应付：43'`

| 选项 | 对错 | 为什么 |
|---|---|---|
| `'应付：43'` | ✅ 对 | 8 × 6 = 48，满 5 杯减 5 元，得 43。 |
| `'应付：48'` | ❌ 错 | 忘了减 5 元：6 杯已经满 5 杯。 |
| `'应付：53'` | ❌ 错 | 满 5 杯是减 5 元，不是加 5 元。 |

提示：先算总价，再看有没有满 5 杯。

### U6L6 待开放代码题（替换第 4 题）

题面：收银程序有好几处错。price 和 cups 是表示整数的文字（比如 "12" 和 "3"）。要求：算出总价（单价 × 杯数），满 5 杯（正好 5 杯也算）减 5 元，输出“应付：金额”。请一处一处改好，每改一处就重新运行。

起始代码（`price`、`cups` 由题目给定，是表示整数的文字）：
```python
total = price * cups
if cups > 5:
    total = total - 5
print("应付：" + total)
```

示范（不同场景，三步拆开）：
```python
width = "20"
height = "3"
w = int(width)
h = int(height)
area = w * h
print("面积：" + str(area))
```
输出 `面积：60`；三步：先把表示整数的文字用 int() 转成整数，再计算，最后输出时用 str() 把整数变回文字拼进句子。

参考答案：
```python
total = int(price) * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + str(total))
```

按示例的修法逐处修改时，**可能**看到的顺序（真实运行；写法不同顺序也可能不同）：

1. `TypeError`（第 1 行）`can't multiply sequence by non-int of type 'str'`
2. `TypeError`（第 2 行）`'>' not supported between instances of 'str' and 'int'`
3. `TypeError`（第 4 行）`can only concatenate str (not "int") to str`
4. 不报错，输出 `'应付：36'`；但“正好 5 杯”的公开用例仍会失败（`> 5` 应为 `>= 5`）

另一种合理的先后：先写 `cups = int(cups)`、`price = int(price)`，就会跳过第 1、2 个报错，直接剩下最后一个拼接报错和边界错。

测试：公开 3 杯（单价 12）→ `应付：36`、正好 5 杯（单价 10）→ `应付：45`；隐藏 6 杯（单价 8）→ `应付：43`、1 杯（单价 15）→ `应付：15`、4 杯（单价 9）→ `应付：36`。

合理写法（`alternatives`）3 种，常见错误（`wrongAnswers`）2 种（`> 5`；`price * int(cups)`）；变化题 `U6L6-M1-V1`：满 4 杯减 3 元，父题答案过不了。

## 验证

- `python3 scripts/verify-content.py`：见文末实际输出。`heldLessons` 里的 L6 也在检查范围内（我把 `verify-content.py` 改成检查 `lessons` + `heldLessons`）。
- `review-code-tasks.py`（来自 `opus/launch-curriculum-map`）对 `U6L6-M1`：**0 问题**（参考答案过全部测试、起始代码至少错一组、写死公开输出被隐藏测试抓到、示范不含完整答案、备选写法判对、常见错误写法判错、变化题父题答案过不了）。
- 没有报错的“怎么改”选择题（L5 Q4）：验证器把每个选项的 `fixed` 真实运行，只有输出等于要求的才算对。
- 测试：`step2`（39 个节点）、`step8-u6`（5 关可玩）、`pick-type`（L6 只在 heldLessons，地图上没有）已更新；浏览器测试只能靠 CI。


```text
选输出 predict：检查 399 项，跳过 0 项，已知问题 0 项，失败 0 项
填空 fill：检查 333 项，跳过 0 项，已知问题 0 项，失败 0 项
排序 order：检查 94029 项，跳过 0 项，已知问题 0 项，失败 0 项
读报错 pick：检查 101 项，跳过 0 项，已知问题 0 项，失败 0 项
代码题 pending：检查 350 项，跳过 0 项，已知问题 0 项，失败 0 项
其他题型：检查 0 项，跳过 0 项，已知问题 0 项，失败 0 项
合计真实运行 47683 次（单次上限 2.0 秒，只防卡死）；失败 0 项
```
