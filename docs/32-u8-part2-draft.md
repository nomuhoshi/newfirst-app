# U8 第 3、4 关（函数：返回结果、组合调用）：题目、答案、错因与验证

分支 `content/u8-part1`（接在 `docs/31` 之后，L1–L2 已审稿通过）。**草稿，供产品官审题。** 只动内容分支；`rc1/`、#42、正式站、Supabase、`preview/u8`、`preview/u7`、#43 都不动。`content/unit8.json` 在这个分支里现在有 L1–L4（16 题），仍**没有挂进** `content/course.json` 的内容分支；已发布的 `u8/` 预览只带 L1–L2，不含这两关。

## 1. 设计口径（请确认）

| # | 口径 | 说明 |
|---|---|---|
| 1 | **两关的分工** | U8L3「返回结果」：`return` 把值交回给调用的地方、**函数里的 `print` 只显示、不交回**、没有 `return` 的函数调用结果是 `None`。U8L4「组合调用」：交回的值存进变量、参与计算（`two(8) + 3`）、套着调用（`coupon(two(10))` 先算里面）、只 print 不 return 的函数拿去计算会 `TypeError`。 |
| 2 | **怎么把 print 和 return 分开** | L3 Q1 把两个函数放进同一段程序：`show_two(8)`（里面 print）会显示 16，`two(8)`（里面 return）单独写一行什么都不显示；Q2 把 `two(8)` 存进 `total`、再 `print(total)` 和 `print(total + 1)`，看到交回的是**值**；Q3 是 `x = say("奶茶")`：函数里 print 显示了文字，但 `x` 是 `None`；Q4（填空）整行写出函数的第二行，错误选项包括 `print(price * 2)`（显示 20 又多显示 None）、`price * 2`（算了没交回，得到 None）。 |
| 3 | **存进变量、参与计算（L4）** | Q1 两个 `two(…)` 相加；Q2 `coupon(two(10))`；Q3 `a = two(8)`、`b = two(?)`、`print(a + b)`；Q4 把“函数里 print”改成 return（读报错后选修法）。 |
| 4 | **函数的运算选得“顺序有区别”** | L3 / L4 用 `two`（×2，“买两杯的价钱”）和 `coupon`（−5，“减 5 元优惠券”）。乘和减不能交换：`coupon(two(10))` = 15，`two(coupon(10))` = 10，所以“里外顺序弄反”是真实的干扰项（若用 +3 和 −5，两种顺序结果相同，区分不出来）。 |
| 5 | **每个函数只有一个参数、函数体一行** | 沿用 L2 的“一个参数”，两关都不出现两个参数、默认参数、作用域，也不出现 `return` 放进 if / for 里、“return 之后的行不再运行”（见第 3 节）。 |
| 6 | **题型和新增** | 选输出 ×5、填空 ×2、读报错选择（`pick`，key=`fix`：选修法）×1。没有新增题型、没有改 app 代码。L4 Q4 是 `fix` 类型：每个选项登记一整段改好的程序，验证器真实运行，只有输出等于 `19` 的算对。 |
| 7 | **填空题的词块是“整行”** | L3 Q4 的词块是 `return price * 2`、`print(price * 2)`、`price * 2`、`show(price * 2)`。原因：如果只让学生填一个词（`return` / `print`），`print price * 2` 不带括号，是 SyntaxError，就做不出“print 显示 20 又多一个 None”这个最重要的错误；整行词块才让 `print(price * 2)` 成为真实的、有教育意义的错误选项。 |
| 8 | **词汇** | “交回”“返回结果”“调用的地方”；首次出现 `None` 时写成“None（什么都没有）”（U7L3 已经教过 `.get()` 查不到时得到 `None`）。变量 `total` 沿用前面几个单元。`return` 后面不加括号。 |

## 2. 前置知识检查

| 本部分用到的 | 学生在哪学过 | 结论 |
|---|---|---|
| 函数的定义和调用、一个参数 | U8L1、U8L2（已审稿通过） | ✅ |
| `None` | U7L3（`.get()` 查不到的键得到 `None`） | ✅；L3 讲解仍写“None（什么都没有）”。 |
| 变量接收一个值、再参与加法 `total + 1`、`a + b` | U1L3–L5 | ✅ |
| `print(函数调用)`，比如 `print(two(10))`、`print(two(8) + 3)` | 前面只在 print 里放过变量和算式；把**函数调用**放进 print 是第一次 | ⚠️ L3 讲解里写了“直接 print(two(8))”，L3 Q4 / L4 Q1 用它。放进 L3 的讲解里一句话，不单独出题。 |
| TypeError | U6L2–L4 | ⚠️ L4 Q4 的报错 `unsupported operand type(s) for +: 'NoneType' and 'int'` 没见过（U6 的 TypeError 是文字 + 整数）；题面里同一句话说明：“None 和整数不能用 + 相加；None 就是‘什么都没有’”。 |
| NameError、SyntaxError | U6L3 的干扰项里带一句话含义出现过；U8L1、L2 已就地解释 | ✅ 这两关出现的地方同样就地解释（L3 Q4 的 `show(price * 2)`、L4 Q3 的 `b`）。 |
| 套着调用 `f(g(x))` | 没有学过 | 在 L4 讲解里先讲“先算里面”，Q2 再考。 |

## 3. 需要产品官知道 / 决定的三件事

1. **“两个参数”还没有安排在哪一关。** 价格计算器最自然的函数是 `total(price, cups)`，默认参数（地图 L5）也需要至少两个参数才有意义。但 L2 只教了一个参数，L3、L4 为了不分心也没有加。建议：**L5 开头先教两个参数，再教默认参数**（或者把 L5 拆成“两个参数”“默认参数”两关）。请你定；我没有在 L3、L4 里夹带。
2. **“return 一执行，函数就结束”没有出现。** 这是 return 的第二个性质（后面的行不会再运行；在 if / else 里分别 return），本部分没有考，因为这两关的函数体只有一行。建议放到 L5 或 L6（作用域）之前，或者项目关。请你定。
3. **L4 Q4 的选项只有 4 个短句，都是一句话**（不是代码），小屏上不会有排版问题；展示的 Traceback 里没有函数内部的帧（`two(8)` 在第 3 行，函数体里没有出错）。

## 4. 验证

- `python3 scripts/make-unit8.py`：生成时的 **断言**：题面和每个干扰项的输出都用真实 Python 取；解释里写到的“第 N 行”（L3 Q2 的第 3 行起、L4 Q4 的第 3 行）对得上程序；L4 Q4 报错的类型 / 行号 / 信息 / 出错行 / 出错前已显示的 `16`；每个填空词块的真实结果（含 SyntaxError / NameError）；`coupon(two(10))` 与 `two(coupon(10))` 的真实结果不同。
- `python3 scripts/verify-content.py --extra content/unit8.json`：**失败 0 项**（选输出 453、填空 365、排序 94029、读报错 132 项；合计真实运行 47722 次，单次上限 2 秒）。
- **变异自检（8 种）**：L3 Q1 正确答案换成错的 / L3 Q3 正确选项文字和真实输出不符 / L3 Q4 标准答案换成 `print(price * 2)` / L4 Q3 标准答案换成 `8` / L4 Q4 修法对错标反 / L4 Q4 正确选项登记的改后程序不对 / L4 Q4 展示的报错被改一个字 / L4 Q4 期望输出写错 —— 验证器每一种都报失败。
- 没有改 `verify` 脚本，也没有改 `src/`。

## 5. 还没做

- 没有挂进 `course.json`、没有做预览（`u8/` 预览只有 L1–L2）；等你审稿后再安排。
- 没有在 app 里实际看这 8 题的显示效果（没有挂载）。其中 L3 Q4 的整行词块（最长 `print(price * 2)`）在手机上的排版，需要预览时看。
- L5 起（两个参数 / 默认参数、作用域、项目）没有开始写。

## U8L3 返回结果（return、print 和 return 的区别、None）

**讲解**：到现在函数只会“显示”：函数里的 print 把东西显示在屏幕上，显示完就没了。想让函数把结果交回给调用它的地方，用 return：def two(price): return price * 2，调用 two(8) 的地方就变成交回来的 16，可以存进变量、拿去计算、再显示。return 自己不显示任何东西：想看到结果，要把它存下来再 print，或者直接 print(two(8))。没有 return 的函数不交回任何东西，得到的是 None（什么都没有）。

讲解示例程序：
```python
def two(price):
    return price * 2
total = two(8)
print(total)
```
真实输出：`16`

### U8L3-Q1（选输出）点单屏运行这段程序，屏幕上会显示什么？

```python
def show_two(price):
    print(price * 2)
def two(price):
    return price * 2
show_two(8)
two(8)
```
真实输出：`16`

| 选项 | 对错 | 错因 / 解释 |
|---|---|---|
| `16` | ✅ 正确 | show_two(8) 里的 print 把 16 显示在屏幕上；two(8) 用的是 return，只是把 16 交回来，这里没有变量接它，也没有 print，16 就丢掉了，不会显示，也不会报错。 |
| `16 ⏎ 16` | ❌ | return 不会显示。two(8) 交回的 16 没有被存起来，也没有被 print，屏幕上不会出现。 |
| `什么都不显示` | ❌ | show_two(8) 里的 print 会运行，在屏幕上显示 16。 |
| `报错` | ❌ | 单独写一行 two(8) 不会报错：它交回 16，没人接，就丢掉了。 |

提示：print 把东西显示出来；return 把值交回给调用的地方，不显示。

### U8L3-Q2（选输出）点单屏运行这段程序，屏幕上会显示什么？

```python
def two(price):
    return price * 2
total = two(8)
print(total)
print(total + 1)
```
真实输出：`16 ⏎ 17`

| 选项 | 对错 | 错因 / 解释 |
|---|---|---|
| `16 ⏎ 17` | ✅ 正确 | 第 3 行 total = two(8)：two(8) 交回 16，存进 total。第 4 行显示 16，第 5 行 total + 1 是 17。 |
| `16 ⏎ 16` | ❌ | 第 5 行是 print(total + 1)，要把 1 加上：16 + 1 = 17。 |
| `8 ⏎ 9` | ❌ | total 里存的是 two(8) 交回来的结果 16，不是传进去的 8。 |
| `16` | ❌ | 第 5 行 print(total + 1) 也会运行，再显示一行 17。 |

提示：total = two(8)：先调用，再把交回来的值存进 total。

### U8L3-Q3（选输出）点单屏运行这段程序，屏幕上会显示什么？

```python
def say(drink):
    print("来一杯", drink)
x = say("奶茶")
print(x)
```
真实输出：`来一杯 奶茶 ⏎ None`

| 选项 | 对错 | 错因 / 解释 |
|---|---|---|
| `来一杯 奶茶 ⏎ None` | ✅ 正确 | 第 3 行调用 say("奶茶")：函数里的 print 显示“来一杯 奶茶”。say 没有 return，什么也没交回，x 得到的是 None，第 4 行 print(x) 就显示 None。 |
| `来一杯 奶茶 ⏎ 来一杯 奶茶` | ❌ | 函数里 print 显示出来的文字不会被交回来存进 x。x 得到的是 None（什么都没有），不是那句话。 |
| `来一杯 奶茶` | ❌ | 第 4 行 print(x) 也会运行，会再显示一行：x 里是 None。 |
| `来一杯 奶茶 ⏎ 奶茶` | ❌ | 没有 return，函数不会把 drink 交回来。x 得到的是 None，不是奶茶。 |

提示：函数里没有 return，调用它得到的就是 None。

### U8L3-Q4（填空）屏幕要显示：20（函数 two 的第二行该怎么写）

```python
def two(price):
    {0}
print(two(10))
```
标准答案：`return price * 2`；期望输出 `20`

| 词块 | 真实运行 | 说明 |
|---|---|---|
| `return price * 2` | 显示 20 | ✅ 正确 |
| `print(price * 2)` | 显示 20 ⏎ None | 函数里的 print 先把 20 显示出来，但函数没有交回任何东西，外面的 print(two(10)) 就把 None 又显示了一遍：先 20，再 None，不是只显示 20。 |
| `price * 2` | 显示 None | 只算了一下就丢掉了，没有 return，函数什么也没交回，外面的 print(two(10)) 显示的是 None。 |
| `show(price * 2)` | 报错 NameError | show 这个名字没有定义过，Python 找不到它，会报 NameError（用到了没有定义的名字）。要把结果交回去，用 return。 |

提示：要把 price * 2 交回给调用它的 print(two(10))：用 return。

## U8L4 组合调用（返回结果参与计算、嵌套调用）

**讲解**：return 交回来的值，和平时的数一样用：存进变量 total = two(8)，参与计算 two(8) + 3，再传给另一个函数 coupon(two(10))。碰到 f(g(x)) 这样套着的写法，先算里面的：two(10) 先得 20，20 再传给 coupon，得 15。注意：只有 return 的函数才能这样用。函数里只 print、没有 return，调用它的结果是 None，拿去做加法会报 TypeError。

讲解示例程序：
```python
def two(price):
    return price * 2
def coupon(price):
    return price - 5
total = coupon(two(10))
print(total)
```
真实输出：`15`

### U8L4-Q1（选输出）点单屏运行这段程序，屏幕上会显示什么？

```python
def two(price):
    return price * 2
print(two(8) + 3)
print(two(8) + two(5))
```
真实输出：`19 ⏎ 26`

| 选项 | 对错 | 错因 / 解释 |
|---|---|---|
| `19 ⏎ 26` | ✅ 正确 | two(8) 交回 16，两个 print 里的 two(…) 都换成它交回来的值：16 + 3 = 19；two(8) 是 16，two(5) 是 10，16 + 10 = 26。 |
| `11 ⏎ 13` | ❌ | two(8) 不是 8：函数交回的是 8 × 2 = 16。11、13 是没有经过函数、直接用 8 算出来的。 |
| `16 ⏎ 26` | ❌ | 第 3 行是 print(two(8) + 3)，要把 3 也加上：16 + 3 = 19。 |
| `19 ⏎ 13` | ❌ | two(5) 也要经过函数：5 × 2 = 10，所以是 16 + 10 = 26，不是 8 + 5。 |

提示：先把每个 two(…) 换成它交回的值，再算加法。

### U8L4-Q2（选输出）点单屏运行这段程序，屏幕上会显示什么？

```python
def two(price):
    return price * 2
def coupon(price):
    return price - 5
print(coupon(two(10)))
```
真实输出：`15`

| 选项 | 对错 | 错因 / 解释 |
|---|---|---|
| `15` | ✅ 正确 | 套着的调用先算里面：two(10) 交回 20，20 再传给 coupon，20 - 5 = 15。 |
| `10` | ❌ | 顺序反了：这是先 coupon(10)（得 5）再 two(5)（得 10）的结果。题里是 coupon(two(10))，括号里面的 two(10) 先算，得 20，再减 5。 |
| `5` | ❌ | 5 是 coupon(10) 的结果。题里传给 coupon 的是 two(10) 交回的 20，不是 10。 |
| `20` | ❌ | 20 是 two(10) 的结果，还要把它传给 coupon，再减 5。 |

提示：f(g(x))：先算里面的 g(x)，再把结果交给 f。

### U8L4-Q3（填空）屏幕要显示：24

```python
def two(price):
    return price * 2
a = two(8)
b = two({0})
print(a + b)
```
标准答案：`4`；期望输出 `24`

| 词块 | 真实运行 | 说明 |
|---|---|---|
| `4` | 显示 24 | ✅ 正确 |
| `8` | 显示 32 | b = two(8) 是 16，a 也是 16，a + b 是 32，不是 24。 |
| `a` | 显示 48 | a 里是 16，two(a) 是 two(16) = 32，a + b 是 16 + 32 = 48，不是 24。 |
| `b` | 报错 NameError | 第 4 行等号右边先算，这时 b 还没有值，用到 b 会报 NameError（用到了没有定义的名字）。 |

提示：a 已经是 16，要让 a + b = 24，b 就得是 8，也就是 two(?) 要交回 8。

### U8L4-Q4（读报错选择）想算“两杯的价钱再加 3 元”，屏幕要显示 19。运行后先显示了 16，又报了 TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'（None 和整数不能用 + 相加；None 就是“什么都没有”）。怎么改，屏幕才会显示 19？

```python
def two(price):
    print(price * 2)
total = two(8) + 3
print(total)
```
展示给学生的报错（真实运行，和 CPython 一致，不含 ^ 箭头）：
```
Traceback (most recent call last):
  File "main.py", line 3, in <module>
    total = two(8) + 3
TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'
```

期望输出：`19`

| 选项 | 真实运行 | 对错 | 错因 / 解释 |
|---|---|---|---|
| 把 two 里的 print(price * 2) 改成 return price * 2 | 显示 19 | ✅ 正确 | two(8) 本来什么也没交回，得到 None，None + 3 报错。改成 return 后，two(8) 交回 16，16 + 3 = 19，最后 print(total) 显示 19。 |
| 把第 3 行的 + 3 去掉 | 显示 16 ⏎ None | ❌ | 两杯的价钱要再加 3，不能去掉。去掉后不报错了，但 two 里的 print 先显示 16，total 得到的还是 None，最后显示 16 和 None，不是 19。 |
| 删掉最后一行 print(total) | 报错 TypeError | ❌ | 报错发生在第 3 行 total = two(8) + 3，和最后一行无关，删掉它还是同样的 TypeError。 |
| 把 3 改成文字 "3" | 报错 TypeError | ❌ | two(8) 得到的还是 None，None 和文字 "3" 也不能用 + 相加，仍然是 TypeError。 |

提示：只有 return 才会把结果交回来；函数里 print 只是显示。
