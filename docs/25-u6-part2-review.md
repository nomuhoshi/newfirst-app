# U6 第 3、4 关（类型与报错 · 第 2 部分）：题目、答案、错因与验证（待审）

分支 `content/u6-part2`（基于 `content/u6-part1`）。只动课程分支；`rc1/`、#42、正式站、Supabase 不动。

## 0. 先看这里：需要你们定的三件事

| # | 事项 | 我的做法 | 备选 |
|---|---|---|---|
| 1 | **新题型「读报错选择题」（`pick`）** | 现有选输出题（predict）要求程序正常运行，装不下“给你一段真实报错，让你读”。我在 app 里加了一个很小的题型：展示程序（可选）和真实报错，让学生选；**不运行任何程序**，答完不出现“运行结果”面板。填空题也可以带一段报错（`trace`）。改动：`src/app.js`（选题区 `pickArea`、报错块 `traceBlock`）、`src/game.css`（报错块样式）、`src/practice.js`（随机练习打乱选项）。不影响旧题型、旧存档。 | 不加题型：只能把报错写进选输出题的题面，但选项就得是“屏幕显示什么”，测不到“读报错”本身 |
| 2 | **U6L4 第一次出现 `float()`** | 题目要求保留小数（价格 3.5 元加 1 元要显示 4.5）时，正确修法只能是 `float("3.5")`；如果不教，学生只能把 `"3.5"` 改成 `"3"` 来凑，这正是你不想要的。所以 L4 的讲解里加一句 float()，并在 Q2 / Q4 用到 | 删掉 Q2 的小数场景，改成纯整数场景：可以不教 float()，但“保留小数”的判断练习就没了 |
| 3 | **报错的展示格式** | 和真实 Python 一样（`Traceback (most recent call last):` / `File "main.py", line N, in <module>` / 代码行 / `类型: 信息`），由真实运行生成。**只省略了代码行下面用 ^ 和 ~ 画的小箭头行**（它在中文全角字符下会错位，而且会分散新手注意力），讲解里写了一句“有时还有小箭头，先不用管” | 保留小箭头：需要处理全角字符对齐 |

## 1. 范围对照

- #34 的 U6L3 = 读 Traceback，L4 = 常见错误（NameError、TypeError、IndexError、IndentationError 四种）。你这次的任务把 L4 收窄成「TypeError（类型搭配）和 ValueError（内容转不了）两种怎么修」。**NameError、IndexError、IndentationError 在本次没有出现**（NameError / SyntaxError 只出现在 L3 Q1 的错误选项解释里）。如果 #34 的 L4 要保留四种，需要后续补关或拆关，请定。
- 沿用 L2 的例子（`"杯数：" + 3`）做 L3 的第一道读报错，L4 再换成 `age`、`price`、`cups` 的新场景。
- 前置：L1（type）、L2（int() / str() 与 TypeError）。L3 不再教新的转换函数；L4 只新增 float()。
- 本部分不使用：input、f-string、字符串乘法、`+=`、round()。

## U6L3 读懂报错（先看最后一行，再找行号）

**讲解**：程序出错时，Python 会停下来，给出一段报错。读它分两步：第一步看最后一行，冒号前面是错误类型（比如 TypeError），冒号后面是具体信息；第二步看上面的 line 几，到自己的代码里找那一行。在本关这些从上到下一行一行执行、运行到某一行才出错的例子里，出错行之前的代码已经运行过，之后的代码不会再运行。真实的报错里有时还有用 ^ 和 ~ 画的小箭头，先不用管。以后你自己写的程序出错时，也会看到这三样：错误类型、第几行、具体信息。

### U6L3-Q1（读报错选择）程序出错了。先看报错的最后一行：冒号前面的 TypeError 是错误类型，后面是具体信息。合起来是在说什么？

题面展示的报错：
```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print("杯数：" + cups)
TypeError: can only concatenate str (not "int") to str
```

题面展示的程序：
```python
cups = 3
print("杯数：" + cups)
```

- **真实运行**：`'cups = 3\nprint("杯数：" + cups)'` → `TypeError`，第 2 行，信息 `can only concatenate str (not "int") to str`，出错前屏幕上已显示 `''`

| 选项 | 对错 | 为什么 | 真实运行证据 |
|---|---|---|---|
| `文字和整数放在一起用 + 接了，类型搭配不对` | ✅ 对 | 最后一行写着 TypeError：can only concatenate str (not "int") to str，意思是 str（文字）不能和 int（整数）直接用 + 接起来。 | 对应错误类型 TypeError |
| `用到了一个还没有定义的变量名` | ❌ 错 | 那种错误叫 NameError，信息里会写 name '…' is not defined。这里最后一行写的是 TypeError。 | 对应错误类型 NameError |
| `int() 转换的文字内容不对` | ❌ 错 | 那种错误叫 ValueError。这里最后一行写的是 TypeError，说的是类型搭配。 | 对应错误类型 ValueError |
| `代码写法不对，比如少了冒号` | ❌ 错 | 那种错误叫 SyntaxError。这里最后一行写的是 TypeError，程序的写法没问题，是运行到这一行才出错。 | 对应错误类型 SyntaxError |

提示：最后一行：冒号前面是错误类型，冒号后面是具体信息。

### U6L3-Q2（读报错选择）报错里的 line 数字，指向程序里出错的那一行。是下面哪一行代码出错了？

题面展示的报错：
```text
Traceback (most recent call last):
  File "main.py", line 4, in <module>
    print(label + cups)
TypeError: can only concatenate str (not "int") to str
```

题面展示的程序：
```python
cups = 3
label = "杯数："
print(label)
print(label + cups)
print(cups)
```

- **真实运行**：`'cups = 3\nlabel = "杯数："\nprint(label)\nprint(label + cups)\nprint(cups)'` → `TypeError`，第 4 行，信息 `can only concatenate str (not "int") to str`，出错前屏幕上已显示 `'杯数：'`

| 选项 | 对错 | 为什么 | 真实运行证据 |
|---|---|---|---|
| `print(label)` | ❌ 错 | 这一行是第 3 行，它正常运行了，屏幕上已经显示了“杯数：”。出错的是后面那一行。 | 真实出错行：print(label + cups) |
| `print(label + cups)` | ✅ 对 | 报错写着 line 4，第 4 行就是 print(label + cups)：label 是文字，cups 是整数，不能直接用 + 接。 | 真实出错行：print(label + cups) |
| `print(cups)` | ❌ 错 | 这一行是第 5 行，出错后 Python 就停了，它根本没有运行。 | 真实出错行：print(label + cups) |
| `cups = 3` | ❌ 错 | 给变量赋值没有问题，这一行是第 1 行，正常运行了。 | 真实出错行：print(label + cups) |

提示：用 line 几去数程序的行号，第一行是 line 1。

### U6L3-Q3（填空）小码写的 print("共" + n + "杯") 出了下面的报错。把它改好，屏幕要显示：共4杯

题面展示的报错：
```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print("共" + n + "杯")
TypeError: can only concatenate str (not "int") to str
```

```python
n = 4
print("共" + {0} + "杯")
```

目标输出：`共4杯`；标准答案：`str(n)`。

| 词块 | 对错 | 真实运行 | 为什么 |
|---|---|---|---|
| `str(n)` | ✅ 对 | 输出 '共4杯' |  |
| `n` | ❌ 错 | 报错 TypeError | "共" 是文字，n 是整数 4，不能直接用 + 接，还是 TypeError。 |
| `int(n)` | ❌ 错 | 报错 TypeError | int(n) 还是整数 4，整数和文字照样不能用 + 接，TypeError。 |

提示：报错说文字和整数搭配不对：把整数 n 变成文字就行，用 str()。

### U6L3-Q4（读报错选择）运行这段程序，屏幕上会先显示什么，然后出现报错？

题面展示的报错：
```text
Traceback (most recent call last):
  File "main.py", line 3, in <module>
    num = int(text)
ValueError: invalid literal for int() with base 10: 'abc'
```

题面展示的程序：
```python
text = "abc"
print("准备转换")
num = int(text)
print(num)
```

- **真实运行**：`'text = "abc"\nprint("准备转换")\nnum = int(text)\nprint(num)'` → `ValueError`，第 3 行，信息 `invalid literal for int() with base 10: 'abc'`，出错前屏幕上已显示 `'准备转换'`

| 选项 | 对错 | 为什么 | 真实运行证据 |
|---|---|---|---|
| `准备转换` | ✅ 对 | 报错在第 3 行，第 2 行的 print("准备转换") 已经运行过，所以先显示“准备转换”；第 4 行没有机会运行。 | value='准备转换' |
| `什么都不显示，只有报错` | ❌ 错 | 出错之前的代码已经运行过：第 2 行的 print 已经把“准备转换”显示出来了。 | value='' |
| `准备转换
abc` | ❌ 错 | 第 4 行 print(num) 在出错的第 3 行之后，不会运行；而且 num 也根本没有生成。 | value='准备转换\nabc' |
| `准备转换
0` | ❌ 错 | 报错之后程序就停了，第 4 行不会运行，不会显示任何数字。 | value='准备转换\n0' |

提示：出错的行之前运行过，之后不会运行。

## U6L4 修正常见错误（按错误类型和题意选修法）

**讲解**：两种报错，修法不一样。TypeError 是类型搭配不对，比如 "杯数：" + 3：拼接时，用 str() 把整数变成文字；做整数加法时，用 int() 把 "12" 这类表示整数的文字转成整数。ValueError 是类型对了，但文字的内容转不了，比如 int("3.5")："3.5" 不是整数的写法。这时先看题目要什么：要保留小数，就用 float()，float("3.5") 得到小数 3.5；只能是整数（比如杯数），就把数据改成只写杯数的 "3"，去掉单位“杯”。不能为了不报错就随便改数据，改完显示的结果要和题目要的一样。

### U6L4-Q1（读报错选择）下面两个报错的最后一行，分别是哪一种问题？

题面展示的报错：
```text
A  cups = 3
   print("杯数：" + cups)
   TypeError: can only concatenate str (not "int") to str
B  print(int("3.5"))
   ValueError: invalid literal for int() with base 10: '3.5'
```

- **真实运行**：`'cups = 3\nprint("杯数：" + cups)'` → `TypeError`，第 2 行，信息 `can only concatenate str (not "int") to str`，出错前屏幕上已显示 `''`
- **真实运行**：`'print(int("3.5"))'` → `ValueError`，第 1 行，信息 `invalid literal for int() with base 10: '3.5'`，出错前屏幕上已显示 `''`

| 选项 | 对错 | 为什么 | 真实运行证据 |
|---|---|---|---|
| `A 是类型搭配不对，B 是文字的内容转不了整数` | ✅ 对 | A 是 TypeError：文字和整数不能直接用 + 接。B 是 ValueError：int() 要的是整数写法的文字，"3.5" 带小数点，转不了。 | 对应错误类型 TypeError,ValueError |
| `A 是文字的内容转不了整数，B 是类型搭配不对` | ❌ 错 | 反了。A 的最后一行是 TypeError（类型搭配），B 的最后一行是 ValueError（内容转不了）。 | 对应错误类型 ValueError,TypeError |
| `两个都是类型搭配不对` | ❌ 错 | 只有 A 是 TypeError。B 里 "3.5" 本来就是文字，int() 要转的类型没错，错在内容，所以是 ValueError。 | 对应错误类型 TypeError,TypeError |
| `两个都是文字内容转不了` | ❌ 错 | 只有 B 是 ValueError。A 里没有转换，是文字和整数直接用 + 接，是 TypeError。 | 对应错误类型 ValueError,ValueError |

提示：看最后一行冒号前面：TypeError 是类型搭配，ValueError 是内容转不了。

### U6L4-Q2（读报错选择）price 是 3.5 元的奶茶价格，要显示加 1 元后的价格：4.5。怎么改才对？

题面展示的报错：
```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    num = int(price)
ValueError: invalid literal for int() with base 10: '3.5'
```

题面展示的程序：
```python
price = "3.5"
num = int(price)
print(num + 1)
```

- **真实运行**：`'price = "3.5"\nnum = int(price)\nprint(num + 1)'` → `ValueError`，第 2 行，信息 `invalid literal for int() with base 10: '3.5'`，出错前屏幕上已显示 `''`

| 选项 | 对错 | 为什么 | 真实运行证据 |
|---|---|---|---|
| `把 int(price) 改成 float(price)` | ✅ 对 | float() 把 "3.5" 转成小数 3.5，加 1 得 4.5，和题目要的一样。 | 改后真实输出 '4.5'（要求 '4.5'） |
| `把 price = "3.5" 改成 price = "3"` | ❌ 错 | 不报错了，但显示 4，不是 4.5：价格 3.5 元被你改成了 3 元，数据变了。 | 改后真实输出 '4'（要求 '4.5'） |
| `把 int(price) 改成 str(price)` | ❌ 错 | str(price) 还是文字 "3.5"，文字加 1 又变成类型搭配不对，报错 TypeError。 | 改后真实报错 TypeError（要求 '4.5'） |
| `把 num + 1 改成 num + "1"` | ❌ 错 | 第 2 行的 int(price) 还是转不了 "3.5"，报错 ValueError，报错没有消失。 | 改后真实报错 ValueError（要求 '4.5'） |

提示：题目要保留小数，就不能把 "3.5" 改成 "3"。

### U6L4-Q3（填空）杯数必须是整数。cups 写成 "3杯" 时出了下面的报错；cups 里写什么，程序才能显示 5？

题面展示的报错：
```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print(int(cups) + 2)
ValueError: invalid literal for int() with base 10: '3杯'
```

```python
cups = {0}
print(int(cups) + 2)
```

目标输出：`5`；标准答案：`"3"`。

| 词块 | 对错 | 真实运行 | 为什么 |
|---|---|---|---|
| `"3"` | ✅ 对 | 输出 '5' |  |
| `"3杯"` | ❌ 错 | 报错 ValueError | "3杯" 里带着单位“杯”，int() 转不了，还是 ValueError。 |
| `"三"` | ❌ 错 | 报错 ValueError | 汉字“三”不是 int() 认识的整数写法，转不了，ValueError。 |

提示：只填写杯数，例如 "3"，去掉单位“杯”，int() 才能转成整数。

### U6L4-Q4（读报错选择）age 是 "12"，要显示明年的年龄。输出必须恰好是 13。怎么改才对？

题面展示的报错：
```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print(age + 1)
TypeError: can only concatenate str (not "int") to str
```

题面展示的程序：
```python
age = "12"
print(age + 1)
```

- **真实运行**：`'age = "12"\nprint(age + 1)'` → `TypeError`，第 2 行，信息 `can only concatenate str (not "int") to str`，出错前屏幕上已显示 `''`

| 选项 | 对错 | 为什么 | 真实运行证据 |
|---|---|---|---|
| `把 age + 1 改成 int(age) + 1` | ✅ 对 | int(age) 把 "12" 变成整数 12，加 1 得 13。 | 改后真实输出 '13'（要求 '13'） |
| `把 age + 1 改成 age + "1"` | ❌ 错 | 不报错了，但显示 121：文字加文字是拼接，不是加法，不是 13。 | 改后真实输出 '121'（要求 '13'） |
| `把 age + 1 改成 float(age) + 1` | ❌ 错 | 不报错了，但显示 13.0：数值和 13 相同，但 float() 得到的是小数，显示成 13.0，格式不符合题目要求的“恰好 13”。 | 改后真实输出 '13.0'（要求 '13'） |
| `把 age + 1 改成 str(age) + 1` | ❌ 错 | str(age) 本来就是文字，文字加 1 还是类型搭配不对，报错 TypeError。 | 改后真实报错 TypeError（要求 '13'） |

提示：输出必须恰好是 13：不是 13.0，也不是 121。

## 4. 每关的学习目标、前置、易踩的坑

| 关 | 学习目标（只有一个主概念） | 前置 | 易踩的坑 |
|---|---|---|---|
| U6L3 读懂报错 | 先看最后一行（错误类型 + 信息），再用 line 几找到自己代码里的那一行；出错行之前的代码已运行、之后不运行 | L2 里见过 TypeError | ① 以为 `cups = 3` 那一行有问题（真正出错的是用了它的那一行）；② 以为出错前什么都没显示；③ 把错误类型当成“程序写法错”（SyntaxError）；④ 看到英文就放弃 |
| U6L4 修正常见错误 | 按错误类型选修法：TypeError → 统一类型（str() / int()）；ValueError → 看题意：要小数用 float()，要整数就把数据写成纯数字 | L2（int() / str()）、L3（读报错） | ① 为了不报错把 `"3.5"` 改成 `"3"`，结果不是题目要的 4.5；② `age + "1"` 不报错但是拼接得 121；③ `float()` 得到 13.0 而不是 13；④ `str()` 转错方向 |

## 5. 验证结果

| 检查 | 结果 |
|---|---|
| `python3 scripts/verify-content.py` | 见下方实际输出（本文件生成时运行）：0 失败 |
| 报错题的程序都真的报这个错 | 每道 pick 的 `checks`：类型、行号、信息都和真实运行一致；展示的报错逐字等于真实运行生成的报错 |
| 选项对错来自真实运行 | `fix` 题每个选项把改完的整段程序真实运行：只有“不报错且输出等于要求”的算对；`stdout` 题的正确选项等于出错前真实输出；`line` 题的正确选项等于真实出错的代码行；`type` 题的正确选项等于真实错误类型 |
| 错因文字里的数字 | L4 Q2 / Q4 错误选项的“显示 4 / 121 / 13.0 / 报错 TypeError”由生成器真实运行后写入 |
| 填空题 | L3-Q3、L4-Q3 每个词块真实运行：见上表，只有标准答案输出目标 |
| 不保留小数就改数据的坑 | L4-Q2 的 `"3"` 选项真实输出 `4`，不是 `4.5`，被判错 |

```text
选输出 predict：检查 384 项，跳过 0 项，已知问题 0 项，失败 0 项
填空 fill：检查 327 项，跳过 0 项，已知问题 0 项，失败 0 项
排序 order：检查 94029 项，跳过 0 项，已知问题 0 项，失败 0 项
读报错 pick：检查 69 项，跳过 0 项，已知问题 0 项，失败 0 项
代码题 pending：检查 325 项，跳过 0 项，已知问题 0 项，失败 0 项
其他题型：检查 0 项，跳过 0 项，已知问题 0 项，失败 0 项
合计真实运行 47621 次（单次上限 2.0 秒，只防卡死）；失败 0 项
```

**本机没法验证的**：浏览器里的真实渲染（长报错在 390px 宽手机上能否完整读到、选项是否被挤出屏幕）和 `step8-u6` 通关测试，靠 CI；真机观感请旅行者试玩预览后反馈。

## 6. 审稿通过后的修改（产品官 2026-11-05）

审稿决定：保留 pick 题型；L4 引入 float()（先展示 `float("3.5")` 得到 3.5，再考保留小数；Q2 保留“改成 `"3"` 能运行但结果是 4”的对照）；报错可省略 ^ 和 ~；这次不补 NameError / IndexError / IndentationError。三处文案修改：

| # | 修改 | 位置 |
|---|---|---|
| 1 | “出错行之前的代码已经运行过”限定为“本关这些从上到下一行一行执行、运行到某一行才出错的例子里”，以后教语法错误时不会让学生以为前面的代码也一定运行过 | U6L3 讲解 |
| 2 | 讲解直接说“拼接时用 str() 把整数变成文字；做整数加法时用 int() 把 `"12"` 这类表示整数的文字转成整数”；杯数题改为“只填写杯数，例如 `"3"`，去掉单位‘杯’”，删掉“只能是纯数字”的绝对说法；`float("3.5")` 得到 3.5 写进讲解 | U6L4 讲解、Q3 提示、Q3 两个错误词块的解释 |
| 3 | 题干写明“输出必须恰好是 13”；反馈说明 13.0 数值相同，但格式不符合题目要求的“恰好 13” | U6L4 Q4 题干、提示、`float` 选项解释 |

只改文案；题目、选项、答案、判分没动，`verify-content` 仍 0 失败。
