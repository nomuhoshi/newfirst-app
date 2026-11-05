# U8 第 7 关（项目：价格计算器，call 模式）：题面、输入范围、测试用例

分支 `content/u8-part1`（接在 `docs/33` 之后）。**产品官 16:35：规则、输入范围、八组测试通过；本文件按 16:35 的两条意见改过（验证器改用独立结果通道；讲解和前置题不再出现完整答案），请复核这两处。** 只动内容分支；`rc1/`、#42、`preview/u8`、#43、正式站、Supabase 都不动。这一关放在 `heldLessons`（待代码题运行器开放才会出现在地图上）；运行器开放前，课内 4 题照常有（第 4 题将被代码题替换）。判分用 **call 模式**：调用学生写的 `bill(…)`，**按返回值**比较，不看 `print` 显示了什么。

## 1. 题面（学生看到的）

> 价格计算器：函数 `bill(price, cups)` 要算出顾客应付的钱，用 `return` 交回（不是 `print`）。**输入范围：`price`、`cups` 都是正整数（至少为 1）。** 规则：① 总价 = `price × cups`；② 总价满 30 元（正好 30 元也算）减 5 元，不满不减；③ 只写单价、不写杯数时，按 1 杯算。已经写好的 `total(price, cups)` 可以直接用。

起始代码：`total` 已写好；`bill(price, cups)` 里是 `print`（要改成 `return`），也没有默认杯数（要补 `cups=1`）。这样学生一运行就会看到两类问题：返回值是 `None`、`bill(8)` 少传一个值报 `TypeError`。

## 2. 设计口径（请确认）

| # | 口径 | 说明 |
|---|---|---|
| 1 | **只用 L1–L6 学过的东西** | `def`、两个参数、默认值 `cups=1`、`return`、`if / else`、调用另一个函数 `total(…)`、函数里的局部名字 `amount`。没有关键字传参、没有 `*args`、没有 `global`、没有三元表达式（学生写了也能通过，只是不教）。 |
| 2 | **输入范围写进题面，测试数据都在范围内** | `price`、`cups` 都是正整数且至少为 1；每组测试的参数个数是 1 个（只写单价）或 2 个。生成脚本里对所有测试（含变化题）逐条断言了范围，没有 0、负数、小数、文字。 |
| 3 | **三个函数调用的形态都出现** | 传两个值 `bill(8, 3)`；只传一个值（默认杯数）`bill(8)`；边界 `bill(10, 3)`（总价正好 30）、`bill(29)`（29 不减）、`bill(30)`（1 杯正好 30 也减）。 |
| 4 | **为什么按返回值判分，而不是看显示什么** | 学生可能用 `total(…)`、也可能自己算；只要 `bill(…)` 交回的数对就算对。起始代码用 `print` 显示了正确的数字，但返回 `None`，会被判错——这正是 L3、L4 教的“显示”和“返回”的区别。 |
| 5 | **讲解和课内 4 题不出现与参考答案相同的完整 `bill`（16:35 意见）** | 讲解示例换成“书店逾期费封顶”`late_fee(days, rate=2)`（默认值、局部 `amount`、`if`、`return` 一起出现，但规则和结构与项目不同）。Q1 选输出：停车费 `fee(hours, rate=3)`（封顶 12 元）的三次调用；Q2 选输出：**只给“总价满 30 元减 5 元”的判断片段**（`amount = 10 * 3`，`amount >= 30`；`amount = 29`），没有函数、没有 `total`；Q3 读报错选修法：`fee` 里用了 `print`，`fee(2) + 1` 报 `TypeError`，改成 `return`；Q4 选输出（被代码题替换）：`fee` 里不超过 12 的分支没有 `return`，得到 `None`。生成脚本里断言这些前置程序里**没有** `bill`、`total(`、`price`。项目起始代码里的 `print` 版 `bill` 只出现在代码题里。 |
| 6 | **变化题（看过参考解法之后）** | 满 60 元减 12 元（不再减 5 元），满 30 不满 60 仍减 5 元，不满 30 不减。需要 `elif`（U3 学过）。父题参考答案过不了变化题（测试里 60、59 之外的档位不同）。 |

## 3. 测试用例（请审）

| 用例 | 公开/隐藏 | 调用 | 期望返回值 | 想抓住的错 |
|---|---|---|---|---|
| 3 杯 8 元，不满 30 | 公开 | `bill(8, 3)` | 24 | 不满不该减；没有 `return` |
| 3 杯 12 元，总价满 30 | 公开 | `bill(12, 3)` | 31 | 拿单价去比 30（12 < 30）；每杯减 5 |
| 只写单价，默认 1 杯 | 公开 | `bill(8)` | 8 | 忘了默认值 `cups=1` |
| 总价正好 30 元也减 | 隐藏 | `bill(10, 3)` | 25 | `>` 写成 `>=` 的边界 |
| 默认 1 杯，29 元不减 | 隐藏 | `bill(29)` | 29 | 默认值 + 边界下一格 |
| 默认 1 杯，30 元要减 | 隐藏 | `bill(30)` | 25 | 默认值 + 边界正好 |
| 杯数多 | 隐藏 | `bill(6, 10)` | 55 | 每杯减 5 |
| 1 杯 40 元 | 隐藏 | `bill(40, 1)` | 35 | 显式传 1 杯 |

下面第 5 节的“常见错误写法”逐条列出每个错误写法会在哪几组上失败（7 种），“其他写法”4 种全部通过。

## 4. 需要产品官知道 / 决定的三件事

1. **（16:35 已接受；并按意见修了一处误判）改了 `scripts/verify/codetask.py`，让验证脚本支持 call 模式。** **误判的修复**：之前验证器靠“标准输出最后一行读 `@@OK`”，函数里先 `print("调试", end="")` 再正确返回时会误判为错。现在和正式判题器一样，**返回值走独立的结果文件，不读标准输出**；并在验证里加了 7 条 `call判分自检`（先 `print(…, end="")` 再正确返回→通过；先 `print` 再返回→通过；打印 `@@OK` 但返回错→不通过；只 print 正确的数、没有 `return`→不通过；顶层不换行输出→通过；返回文字 `"24"`→不通过；返回 `True`→不通过）。旧实现在“先 `print(…, end="")` 再正确返回”上返回 `(False, '调试@@OK')`，已复现，新实现通过。 以前它只会验证“输出模式”的代码题（`docs/16` 里写过：call 模式到 U8 才有，那时扩展脚本）。现在 call 模式的题会：用参考答案真实运行每组测试；其他写法必须全过；每个“错误写法”至少要有一组不通过；起始代码不能直接全过；变化题的答案全过、父题答案过不了变化题的隐藏测试、期望返回值至少两种。比较规则是 `src/judge.js` 里 `callHarness` 的那一套（布尔和数字不混、数字按值比较等）的 Python 复刻，没有改 `src/`。**输出模式的验证逻辑没有动**（全课程验证 0 失败）。
2. **这一关不能在预览里玩到。** 代码题运行器（`code-task.js`）的公开入口还没开放，地图入口、WebKit 都没验过，所以 L7 在 `heldLessons` 里；预览 `u8/` 现在只有前四关（L5、L6 审稿通过后接入）。
3. **项目不教输入检查。** 题面写明“都是正整数”，没有要求学生处理 0、负数、文字。如果你想在这一关或下一单元加“参数不合法怎么办”，需要先教 `raise` / 返回特殊值，我不建议放在这里。

## 5. 验证

- `python3 scripts/make-unit8.py`：生成时的断言：期望返回值由参考答案真实运行得到并和手算对过（24、31、8、25、29、25、55、35；变化题 24、49、48、54、88）；起始代码在 8 组测试上全部不通过；4 种其他写法全过；7 种错误写法各自失败的用例集合和预期完全一致；变化题答案全过、父题答案过不了；输入范围；课内 4 题的每个选项都用真实 Python 取输出，Q3 的报错类型 / 行号 / 信息 / 出错行 / 出错前显示的 `31`。
- `python3 scripts/verify-content.py --extra content/unit8.json`：**失败 0 项**（合计真实运行 47801 次；比之前多出的 7 次是 `call判分自检`）。
- **变异自检（10 种，验证器每一种都报失败）**：参考答案的 `>= 30` 改成 `> 30` / 一种其他写法被改坏 / 一个错误写法被换成参考答案 / 一组测试的期望返回值写错 / Q1 对错标反 / Q3 正确选项登记的改后程序不对 / 变化题答案换成父题答案 / 起始代码换成参考答案 / 一组测试里函数名写错 / Q2 两个选项文字对调。
- 没有改 `src/`，没有改输出模式的验证逻辑。

## 6. 还没做

- 没有挂进 `course.json`、没有做预览；运行器开放后，才能在 app 里实际走一遍（含 WebKit、地图入口）。**“返回 None”“漏传参数（TypeError）”在代码题界面里的反馈，Python 验证不能替代，要等真实运行器验证。**
- 课内 4 题在 app 里的显示没看过。Q3 的四个选项都是一句话，没有代码块。
- 代码题里的“示范”（咖啡店满 20 减 3 的 `pay`）是看过参考解法或提示之后才用，结构上和项目相似（默认值 + `amount` + `if` + `return`），但规则、名字都不同，不能原样照抄；如果你觉得仍然太近，我可以换成别的结构。

## U8L7 价格计算器（项目：算总价、满减、默认杯数，用 return 交回）

**讲解**：项目：奶茶店的价格计算器。函数 bill(price, cups) 算顾客应付的钱：总价 = 单价 × 杯数；总价满 30 元（正好 30 元也算）减 5 元；只写单价时按 1 杯算。结果要用 return 交回，让别的地方可以接住它、继续算。已经写好的 total(price, cups) 可以直接调用。

讲解示例程序：
```python
def late_fee(days, rate=2):
    amount = days * rate
    if amount > 10:
        amount = 10
    return amount
print(late_fee(3))
print(late_fee(8))
print(late_fee(8, 1))
```
真实输出：`6 ⏎ 10 ⏎ 8`

### U8L7-Q1（选输出）点单屏运行这段程序，屏幕上会显示什么？

```python
def fee(hours, rate=3):
    amount = hours * rate
    if amount > 12:
        return 12
    return amount
print(fee(2))
print(fee(5))
print(fee(5, 2))
```
真实输出：`6 ⏎ 12 ⏎ 10`

| 选项 | 对错 | 错因 / 解释 |
|---|---|---|
| `6 ⏎ 12 ⏎ 10` | ✅ 正确 | fee(2)：2 × 3 = 6，不超过 12，交回 6。fee(5)：5 × 3 = 15，超过 12，return 12。fee(5, 2)：传了 rate 是 2，5 × 2 = 10，不超过 12，交回 10。 |
| `6 ⏎ 15 ⏎ 10` | ❌ | 15 超过 12，会执行 return 12，封顶交回 12，不是 15。 |
| `6 ⏎ 12 ⏎ 12` | ❌ | fee(5, 2) 传了 rate = 2，不是默认的 3：5 × 2 = 10，没超过 12。 |
| `6 ⏎ 12 ⏎ 20` | ❌ | fee(5, 2) 的第二个值传给 rate，不是乘 2 的倍数：5 × 2 = 10。 |

提示：先算 amount，再看是不是超过 12；传了第二个值就用它，没传才用默认值 3。

### U8L7-Q2（选输出）下面是“总价满 30 元减 5 元”的判断（总价正好 30 元也算）。屏幕上会显示什么？

```python
amount = 10 * 3
if amount >= 30:
    amount = amount - 5
print(amount)
amount = 29
if amount >= 30:
    amount = amount - 5
print(amount)
```
真实输出：`25 ⏎ 29`

| 选项 | 对错 | 错因 / 解释 |
|---|---|---|
| `25 ⏎ 29` | ✅ 正确 | 第一段：amount 是 30，amount >= 30 成立（正好 30 也成立），减 5 得 25。第二段：amount 是 29，不满 30，不减，显示 29。 |
| `30 ⏎ 29` | ❌ | 条件是 amount >= 30，30 也成立，要减 5。 |
| `25 ⏎ 24` | ❌ | 第二段 amount 是 29，不满 30，不减，仍是 29。 |
| `5 ⏎ 29` | ❌ | amount = amount - 5 是在原来的数上减 5：30 - 5 = 25，不是直接变成 5。 |

提示：边界：>= 30 包含 30。

### U8L7-Q3（读报错选择）想显示 7（6 再加 1）。现在运行先显示了 6，又报了 TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'（None 和整数不能用 + 相加）。怎么改，屏幕才会显示 7？

```python
def fee(hours, rate=3):
    amount = hours * rate
    print(amount)
result = fee(2) + 1
print(result)
```
展示给学生的报错（真实运行，和 CPython 一致，不含 ^ 箭头）：
```
Traceback (most recent call last):
  File "main.py", line 4, in <module>
    result = fee(2) + 1
TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'
```

期望输出：`7`

| 选项 | 真实运行 | 对错 | 错因 / 解释 |
|---|---|---|---|
| 把 fee 里的 print(amount) 改成 return amount | 显示 7 | ✅ 正确 | fee 里是 print：显示了 6，函数却没遇到 return，自动返回 None，None + 1 报错。改成 return amount，fee(2) 交回 6，6 + 1 = 7。 |
| 把第 4 行的 + 1 去掉 | 显示 6 ⏎ None | ❌ | 不报错了，但 fee 里的 print 先显示 6，result 得到的是 None，最后显示 6 和 None，不是 7。 |
| 把第 4 行改成 result = fee(2, 1) + 1 | 报错 TypeError | ❌ | 多传一个值给 rate，fee 还是只 print、不 return，得到的仍是 None，None + 1 仍然是 TypeError。 |
| 把第 4 行改成 print(fee(2) + 1) | 报错 TypeError | ❌ | fee(2) 得到的还是 None，None + 1 仍然是 TypeError。 |

提示：想把结果拿去继续算，函数里要用 return 交回。

### U8L7-Q4（选输出）点单屏运行这段程序，屏幕上会显示什么？

```python
def fee(hours, rate=3):
    amount = hours * rate
    if amount > 12:
        return 12
print(fee(2))
print(fee(5))
```
真实输出：`None ⏎ 12`

| 选项 | 对错 | 错因 / 解释 |
|---|---|---|
| `None ⏎ 12` | ✅ 正确 | fee(2)：amount 是 6，不超过 12，if 里的 return 没有执行，函数执行结束时没有遇到 return，自动返回 None。fee(5)：15 超过 12，return 12。 |
| `6 ⏎ 12` | ❌ | 不超过 12 的情况没有 return amount，函数不会自己把 amount 交回来，得到的是 None。 |
| `6 ⏎ 15` | ❌ | fee(5) 超过 12，会执行 return 12，交回 12，不是 15。 |
| `报错` | ❌ | 没有 return 的调用不会报错，只是得到 None；print(None) 显示 None。 |

提示：每一种情况都要有 return；没遇到 return，就是 None。

### U8L7-M1（改一改，代码题，**call 模式：按返回值判分**；替换第 4 题；**待运行器开放**）

**题面**：价格计算器：函数 bill(price, cups) 要算出顾客应付的钱，用 return 交回（不是 print）。输入范围：price、cups 都是正整数（至少为 1）。规则：① 总价 = price × cups；② 总价满 30 元（正好 30 元也算）减 5 元，不满不减；③ 只写单价、不写杯数时，按 1 杯算。已经写好的 total(price, cups) 可以直接用。

起始代码（学生看到的）：
```python
def total(price, cups):
    return price * cups

def bill(price, cups):
    amount = total(price, cups)
    if amount >= 30:
        print(amount - 5)
    else:
        print(amount)
```

**参考答案**：
```python
def total(price, cups):
    return price * cups

def bill(price, cups=1):
    amount = total(price, cups)
    if amount >= 30:
        return amount - 5
    return amount
```

**测试**（期望返回值由参考答案真实运行得到，并和手写的规则逐条对过；判分按值比较，不看 print 显示了什么）：

| 用例 | 公开/隐藏 | 调用 | 期望返回值 |
|---|---|---|---|
| 3 杯 8 元，不满 30 | 公开 | `bill(8, 3)` | `24` |
| 3 杯 12 元，总价满 30 | 公开 | `bill(12, 3)` | `31` |
| 只写单价，默认 1 杯 | 公开 | `bill(8)` | `8` |
| 总价正好 30 元也减 | 隐藏 | `bill(10, 3)` | `25` |
| 默认 1 杯，29 元不减 | 隐藏 | `bill(29)` | `29` |
| 默认 1 杯，30 元要减 | 隐藏 | `bill(30)` | `25` |
| 杯数多 | 隐藏 | `bill(6, 10)` | `55` |
| 1 杯 40 元 | 隐藏 | `bill(40, 1)` | `35` |

**起始代码在每组测试上的真实结果**（学生第一次点“检查”会看到的）：

| 用例 | 起始代码 |
|---|---|
| 3 杯 8 元，不满 30 | ❌ 报错 None |
| 3 杯 12 元，总价满 30 | ❌ 报错 None |
| 只写单价，默认 1 杯 | ❌ 报错 TypeError |
| 总价正好 30 元也减 | ❌ 报错 None |
| 默认 1 杯，29 元不减 | ❌ 报错 TypeError |
| 默认 1 杯，30 元要减 | ❌ 报错 TypeError |
| 杯数多 | ❌ 报错 None |
| 1 杯 40 元 | ❌ 报错 None |

**提示**：
1. 先运行：起始代码的 bill 里是 print，调用 bill(…) 得到的是 None；再看规则 ③：只写单价时 cups 要有默认值。
2. bill 里先算总价 amount = total(price, cups)；总价满 30 才减 5；每种情况都要把结果 return 交回，不是 print。

**示范（换一个场景，三步）**：
```python
def pay(price, cups=1):
    amount = price * cups
    if amount >= 20:
        amount = amount - 3
    return amount
print(pay(9, 3))
```
真实输出：`24`。三步：先算总价 amount；再判断：满 20 才减 3；最后把 amount return 交回去。函数里只算不 return，调用得到的就是 None。

**合理的其他写法（alternatives，全部通过全部用例）**：

写法 1：全部通过
```python
def total(price, cups):
    return price * cups

def bill(price, cups=1):
    amount = total(price, cups)
    if amount >= 30:
        return amount - 5
    else:
        return amount
```
写法 2：全部通过
```python
def bill(price, cups=1):
    amount = price * cups
    if amount >= 30:
        amount = amount - 5
    return amount
```
写法 3：全部通过
```python
def total(price, cups):
    return price * cups

def bill(price, cups=1):
    if total(price, cups) >= 30:
        return total(price, cups) - 5
    return total(price, cups)
```
写法 4：全部通过
```python
def bill(price, cups=1):
    amount = price * cups
    if amount < 30:
        return amount
    return amount - 5
```
**常见错误写法（wrongAnswers，必须被判错）**：

错误写法 1：只补了默认值，函数里还是 print，没有 return：调用得到 None。未通过的用例：3 杯 8 元，不满 30、3 杯 12 元，总价满 30、只写单价，默认 1 杯、总价正好 30 元也减、默认 1 杯，29 元不减、默认 1 杯，30 元要减、杯数多、1 杯 40 元
```python
def total(price, cups):
    return price * cups

def bill(price, cups=1):
    amount = total(price, cups)
    if amount >= 30:
        print(amount - 5)
    else:
        print(amount)
```
错误写法 2：忘了默认值：bill(8) 只传了一个值，会报 TypeError。未通过的用例：只写单价，默认 1 杯、默认 1 杯，29 元不减、默认 1 杯，30 元要减
```python
def total(price, cups):
    return price * cups

def bill(price, cups):
    amount = total(price, cups)
    if amount >= 30:
        return amount - 5
    return amount
```
错误写法 3：边界：总价正好 30 元也要减，用 >= 不用 >。未通过的用例：总价正好 30 元也减、默认 1 杯，30 元要减
```python
def total(price, cups):
    return price * cups

def bill(price, cups=1):
    amount = total(price, cups)
    if amount > 30:
        return amount - 5
    return amount
```
错误写法 4：拿单价去比，不是总价：12 元 × 3 杯 = 36 元，也要减。未通过的用例：3 杯 12 元，总价满 30、总价正好 30 元也减、杯数多
```python
def total(price, cups):
    return price * cups

def bill(price, cups=1):
    amount = total(price, cups)
    if price >= 30:
        return amount - 5
    return amount
```
错误写法 5：每杯减 5 元，不是总价减 5 元。未通过的用例：3 杯 12 元，总价满 30、总价正好 30 元也减、杯数多
```python
def total(price, cups):
    return price * cups

def bill(price, cups=1):
    amount = total(price, cups)
    if amount >= 30:
        return cups * (price - 5)
    return amount
```
错误写法 6：只算了 amount - 5，没有 return，也没有存回去，还是交回原来的总价。未通过的用例：3 杯 12 元，总价满 30、总价正好 30 元也减、默认 1 杯，30 元要减、杯数多、1 杯 40 元
```python
def total(price, cups):
    return price * cups

def bill(price, cups=1):
    amount = total(price, cups)
    if amount >= 30:
        amount - 5
    return amount
```
错误写法 7：不满 30 的情况没有 return：函数执行结束时没有遇到 return，自动返回 None。未通过的用例：3 杯 8 元，不满 30、只写单价，默认 1 杯、默认 1 杯，29 元不减
```python
def total(price, cups):
    return price * cups

def bill(price, cups=1):
    amount = total(price, cups)
    if amount >= 30:
        return amount - 5
```
**变化题 U8L7-M1-V1**（看过参考解法后才出现；不多加 XP，答错不扣红心）：满 60 元减 12 元（满 60 时只减 12 元，不再减 5 元）；满 30 元但不满 60 元，仍减 5 元；不满 30 元不减。只写单价时按 1 杯算，其他不变。输入范围同上。

起始代码：
```python
def total(price, cups):
    return price * cups

def bill(price, cups=1):
    amount = total(price, cups)
    # 在这里写：满 60 减 12；满 30 不满 60 减 5
    return amount
```

| 用例 | 公开/隐藏 | 调用 | 期望返回值 |
|---|---|---|---|
| 3 杯 8 元 | 公开 | `bill(8, 3)` | `24` |
| 满 30 不满 60 | 公开 | `bill(9, 6)` | `49` |
| 总价正好 60 | 隐藏 | `bill(10, 6)` | `48` |
| 总价 59 | 隐藏 | `bill(59)` | `54` |
| 杯数多 | 隐藏 | `bill(5, 20)` | `88` |

变化题答案：
```python
def total(price, cups):
    return price * cups

def bill(price, cups=1):
    amount = total(price, cups)
    if amount >= 60:
        return amount - 12
    elif amount >= 30:
        return amount - 5
    return amount
```

起始代码在变化题测试上的真实结果：3 杯 8 元 ✅ 通过；满 30 不满 60 ❌ 报错 54；总价正好 60 ❌ 报错 60；总价 59 ❌ 报错 59；杯数多 ❌ 报错 100

父题参考答案在变化题测试上的真实结果（必须至少有一个隐藏测试不通过）：3 杯 8 元 ✅ 通过；满 30 不满 60 ✅ 通过；总价正好 60 ❌ 报错 55；总价 59 ✅ 通过；杯数多 ❌ 报错 95
