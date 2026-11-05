# U8 第 5、6 关（函数：两个参数和默认值、函数里的变量）：题目、答案、错因与验证

分支 `content/u8-part1`（接在 `docs/32` 之后，L1–L4 已审稿通过）。**草稿，供产品官审题。** 只动内容分支；`rc1/`、#42、正式站、Supabase、`preview/u8`、#43 都不动。`content/unit8.json` 现在有 L1–L6（24 题），仍没有挂进 `content/course.json` 的内容分支；已发布的 `u8/` 预览只有 L1–L2（4 关预览在 CI 通过后更新）。

## 1. 设计口径（请确认）

| # | 口径 | 说明 |
|---|---|---|
| 1 | **L5 一关里先教两个参数，再教默认值**（15:59 决定，不拆关） | 讲解顺序：`def total(price, cups):` 逗号隔开、`total(8, 3)` 按顺序传值、个数要对得上；然后 `cups=1` 默认值、传了用传的、没传用默认、有默认值的写在后面。顺序按“价格计算器”（单价 × 杯数）的需要排。 |
| 2 | **L5 的 4 题** | Q1 选输出：`order("奶茶", 2)`，`print(cups, "杯", drink)`——值按顺序对参数，显示顺序由函数里的 print 决定；Q2 填空：`def total(____):` 括号里怎么写（逗号 / 漏逗号 / 做运算 / 只写一个参数）；Q3 选输出：`cups=1`，`total(8)`、`total(8, 3)`、`total(5)`；Q4 读报错选修法：`total(8)` 漏传 `cups`，怎么改才显示 8（改成 `cups=1`；`cups=0`、`price=1, cups`（默认值写前面）、删掉参数 都是真实的错误做法）。 |
| 3 | **L6 作用域：只教三件事** | ① 函数里新建的变量（参数也算）只在函数里有效，外面用会 `NameError`；② 函数里和函数外的同名变量是两个互不相干的变量，函数里赋值不会改动外面的；③ 想把函数里算出的结果拿到外面，用 `return` 交回来再接住。 |
| 4 | **L6 的 4 题** | Q1 读报错选行：`print(drink)` 报 NameError（drink 在函数里新建）；Q2 选输出：`price = 100` 在函数里、外面 `price` 仍是 8（`100 ⏎ 8`）；Q3 选输出：函数里改了参数 `price = price * 2`，外面的 `price` 仍是 8（`16 ⏎ 8`）；Q4 读报错选修法：`print(result)` 报 NameError，改成 `return result` + `print(calc(8))`。 |
| 5 | **两关不教的** | 关键字传参（`total(8, cups=3)`）、`*args`、默认值是列表 / 字典、`global` 关键字、在函数里读外面的变量（和随后赋值同名变量时会出 UnboundLocalError）、嵌套函数。 |
| 6 | **题型** | 选输出 ×4、填空 ×1、读报错选择 ×3（`fix` ×2、`line` ×1）。没有新增题型、没有改 app 代码。 |
| 7 | **词汇** | “参数”“默认值”“传值”沿用 L2；L6 新说法：“只在函数里有效”“互不相干的变量”。变量名 `total`、`cups`、`price` 沿用前面几关。 |

## 2. 前置知识检查

| 本部分用到的 | 学生在哪学过 | 结论 |
|---|---|---|
| 一个参数、传值、`return`、`None`、函数调用参与计算 | U8L2–L4（已审稿通过） | ✅ |
| 函数体里有多行（先赋值再 return） | L1–L4 的函数体都是一行；L6 的 `double` / `calc` 是两到三行 | ⚠️ L1 已有缩进的函数体，但多行带赋值是 L6 第一次出现；放在 L6 讲解示例里直接看到。 |
| 变量赋值、重新赋值 | U1L2–L5 | ✅ |
| NameError | U6L3、U8L1 | ✅ |
| TypeError 的新说法 `takes 1 positional argument but 2 were given`、`missing 1 required positional argument` | L2 已讲过 `missing 1 required positional argument: 'price'` | ⚠️ `takes 1 positional argument but 2 were given` 是新的；在 L5 Q2 的错因里写成“值的个数不对”。 |
| 写在前面的默认值导致 SyntaxError | 没学过 | 只出现在 L5 Q4 的干扰项的解释里：“有默认值的参数要写在没有默认值的参数后面”（L5 讲解里已经说了）。 |

## 3. 需要产品官知道 / 决定的三件事

1. **改了 `scripts/verify/pick.py` 一行（删掉一行没用到的调用）。** `fix` 类型的校验里有一行 `real_error(o["fixed"])`，它的返回值没人用，但遇到编译期错误（SyntaxError / IndentationError）会崩溃（IndexError）。L5 Q4 的干扰项 `def total(price=1, cups):` 是真实的 SyntaxError，所以删掉这行，校验仍然用 `run()` 判断“报错 / 输出是否等于期望”。其他题型的校验没有动；全课程验证 0 失败。
2. **L6 不讲“函数里读外面的变量”。** 例如 `rate = 2` 写在函数外、函数里直接用 `rate`，是可以的，但和“函数里同名赋值”混在一起会出 UnboundLocalError，一关里讲不清。项目关（L7）用的是参数和 `return`，用不到它。如果你希望教，建议单独一关或放到复习里。
3. **L5 只有 4 题，要覆盖两个概念。** 两个参数 2 题（Q1、Q2）、默认值 2 题（Q3、Q4）。如果你觉得默认值需要更多练习，可以把 Q2 的填空换成默认值的填空，或者把 L5 拆成两关（你 15:59 说暂不拆，我没有拆）。

## 4. 验证

- `python3 scripts/make-unit8.py`：生成时的断言：每个选项的输出都用真实 Python 取；L5 Q1 的两种误解（以为按调用顺序显示、第二次沿用）和“顺序反了”在真实 Python 里的结果；L5 Q2 三种错误词块的真实结果（SyntaxError ×2、TypeError `total() takes 1 positional argument but 2 were given`）；L5 Q3 的三种误解；L5 Q4 报错的类型 / 行号 / 信息 / 出错行 / 出错前显示；L6 Q1、Q4 报错的类型 / 行号 / 信息 / 出错行 / 出错前显示（Q1 出错前已显示 `做好了 奶茶`）；L6 Q2、Q3 对照程序（去掉函数里的赋值、把外面的 `print(price)` 换成 `print(double(price))`）。
- `python3 scripts/verify-content.py --extra content/unit8.json`：**失败 0 项**（选输出 + 填空 + 排序 + 读报错 + 代码题，合计真实运行 47720 次，单次上限 2 秒）。
- **变异自检（8 种）**：L5 Q1 对错标反 / L5 Q2 标准答案换成 `price` / L5 Q3 两个选项文字对调 / L5 Q4 正确选项登记的改后程序不对 / L6 Q1 行标错 / L6 Q2 两个选项文字对调 / L6 Q4 正确选项登记的改后程序不对 / L6 Q4 期望输出写错 —— 验证器每一种都报失败（失败 1–3 项）。
- 改了 `scripts/verify/pick.py` 的一行（见第 3 节第 1 条）；没有改 `src/`。

## 5. 还没做

- 没有挂进 `course.json`、没有做预览；等你审稿后再安排。
- 没有在 app 里实际看这 8 题的显示效果。L5 Q4 的四个选项都是 `def total(…):` 开头的短句，在 320 宽下的排版需要预览时看。
- L7（项目：call 模式，按返回值判分）没有开始写。

## U8L5 两个参数和默认值（多个参数、按顺序传值、默认值）

**讲解**：价格计算器要两个数：单价和杯数。参数可以有好几个，括号里用逗号隔开：def total(price, cups):。调用时按顺序传值：total(8, 3) 把 8 传给 price，把 3 传给 cups，传的个数要和参数一样多，顺序也要对。如果某个参数大多数时候用同一个值，可以给它一个默认值：def total(price, cups=1): 调用时不传 cups，就用 1；传了，就用传进去的值。有默认值的参数要写在没有默认值的参数后面。

讲解示例程序：
```python
def total(price, cups=1):
    return price * cups
print(total(8, 3))
print(total(8))
```
真实输出：`24 ⏎ 8`

### U8L5-Q1（选输出）点单屏运行这段程序，屏幕上会显示什么？

```python
def order(drink, cups):
    print(cups, "杯", drink)
order("奶茶", 2)
order("果茶", 1)
```
真实输出：`2 杯 奶茶 ⏎ 1 杯 果茶`

| 选项 | 对错 | 错因 / 解释 |
|---|---|---|
| `2 杯 奶茶 ⏎ 1 杯 果茶` | ✅ 正确 | 两个值按顺序传：第 3 行 order("奶茶", 2)，奶茶传给第一个参数 drink，2 传给第二个参数 cups。函数里 print(cups, "杯", drink) 先写 cups，所以先显示 2，再是“杯”，最后是奶茶。第 4 行同理。 |
| `奶茶 杯 2 ⏎ 果茶 杯 1` | ❌ | 显示的顺序由函数里 print 的写法决定：print(cups, "杯", drink) 先显示 cups。传值的顺序和显示的顺序不一定一样。 |
| `2 杯 奶茶 ⏎ 2 杯 奶茶` | ❌ | 每次调用都会重新传值。第 4 行传的是 "果茶" 和 1，drink、cups 这次就是果茶和 1。 |
| `报错` | ❌ | 不会报错：调用时传了 2 个值，def 里正好有 2 个参数，个数是对得上的。 |

提示：按顺序对应：第一个值给第一个参数，第二个值给第二个参数。

### U8L5-Q2（填空）屏幕要显示：24（函数 total 的第一行，括号里该怎么写）

```python
def total({0}):
    return price * cups
print(total(8, 3))
```
标准答案：`price, cups`；期望输出 `24`

| 词块 | 真实运行 | 说明 |
|---|---|---|
| `price, cups` | 显示 24 | ✅ 正确 |
| `price cups` | 报错 SyntaxError | 两个参数之间要用逗号隔开。漏了逗号，会报 SyntaxError（写法不符合语法）。 |
| `price + cups` | 报错 SyntaxError | 括号里写的是参数的名字，不能做运算，会报 SyntaxError（写法不符合语法）。 |
| `price` | 报错 TypeError | 只有一个参数 price，调用时却传了 8 和 3 两个值，个数对不上，会报 TypeError（值的个数不对）。函数体里用了 cups，就要在括号里也写上它。 |

提示：有两个参数：名字写在括号里，用逗号隔开。

### U8L5-Q3（选输出）点单屏运行这段程序，屏幕上会显示什么？

```python
def total(price, cups=1):
    return price * cups
print(total(8))
print(total(8, 3))
print(total(5))
```
真实输出：`8 ⏎ 24 ⏎ 5`

| 选项 | 对错 | 错因 / 解释 |
|---|---|---|
| `8 ⏎ 24 ⏎ 5` | ✅ 正确 | cups=1 是默认值。第 3 行 total(8) 没传 cups，用默认的 1：8 × 1 = 8；第 4 行 total(8, 3) 传了 3，就用 3：8 × 3 = 24；第 5 行 total(5) 又没传，5 × 1 = 5。 |
| `8 ⏎ 8 ⏎ 5` | ❌ | 默认值只在没有传值时才用。第 4 行传了 3，cups 就是 3，不是默认的 1。 |
| `0 ⏎ 24 ⏎ 0` | ❌ | 没传 cups 时用的是它的默认值 1，不是 0，所以 8 × 1 = 8，5 × 1 = 5。 |
| `报错` | ❌ | cups 有默认值，调用时可以不传，不会报错。只有没有默认值的参数，漏传才会报 TypeError。 |

提示：传了值就用传的值；没传，才用默认值。

### U8L5-Q4（读报错选择）想让 total(8) 也能用（只买 1 杯，不用写杯数），屏幕要显示 8。现在运行报了错：TypeError: total() missing 1 required positional argument: 'cups'（调用时少了 1 个必须给的参数 cups）。怎么改，屏幕才会显示 8？

```python
def total(price, cups):
    return price * cups
print(total(8))
```
展示给学生的报错（真实运行，和 CPython 一致，不含 ^ 箭头）：
```
Traceback (most recent call last):
  File "main.py", line 3, in <module>
    print(total(8))
TypeError: total() missing 1 required positional argument: 'cups'
```

期望输出：`8`

| 选项 | 真实运行 | 对错 | 错因 / 解释 |
|---|---|---|---|
| 把第 1 行改成 def total(price, cups=1): | 显示 8 | ✅ 正确 | 给 cups 一个默认值 1：total(8) 没传 cups，就用 1，8 × 1 = 8。 |
| 把第 1 行改成 def total(price, cups=0): | 显示 0 | ❌ | 不报错了，但没传 cups 时它是 0，8 × 0 = 0，显示的是 0，不是 8。 |
| 把第 1 行改成 def total(price=1, cups): | 报错 SyntaxError | ❌ | 有默认值的参数要写在没有默认值的参数后面。这样写，Python 一行都不会运行，直接报 SyntaxError（写法不符合语法）。 |
| 把第 1 行改成 def total(price): | 报错 NameError | ❌ | cups 不再是参数了，但函数体里还在用它，调用时会报 NameError（用到了没有定义的名字）。 |

提示：不想每次都传的值，给它一个默认值；有默认值的参数写在后面。

## U8L6 函数里的变量（作用域：函数里的变量只在函数里有效）

**讲解**：在函数里新建的变量，只在这个函数里有效，函数运行完就没有了，函数外面用不了。参数也一样。如果函数里的变量和函数外面的变量同名，它们是两个互不相干的变量：函数里给它赋新值，不会改动函数外面的那个。想把函数里算出来的结果拿到外面用，要用 return 交回来，再存进变量或 print。

讲解示例程序：
```python
price = 8
def double(price):
    price = price * 2
    return price
print(double(price))
print(price)
```
真实输出：`16 ⏎ 8`

### U8L6-Q1（读报错选择）程序报了 NameError: name 'drink' is not defined（drink 这个名字没有定义）。drink 明明在函数里赋过值，出错的是哪一行？

```python
def make_order():
    drink = "奶茶"
    print("做好了", drink)
make_order()
print(drink)
```
展示给学生的报错（真实运行，和 CPython 一致，不含 ^ 箭头）：
```
Traceback (most recent call last):
  File "main.py", line 5, in <module>
    print(drink)
NameError: name 'drink' is not defined
```

| 选项 | 对错 | 错因 / 解释 |
|---|---|---|
| print(drink) | ✅ 正确 | 最后一行报错。drink 是在 make_order() 里面新建的变量，函数运行完它就没有了，函数外面不认识 drink。 |
| drink = "奶茶" | ❌ | 给变量赋值没有问题，函数里的这一行正常运行了。 |
| make_order() | ❌ | 调用没有问题：函数体运行了，屏幕上已经显示了“做好了 奶茶”。 |
| print("做好了", drink) | ❌ | 这一行在函数里面，drink 在函数里有值，它正常运行了，已经显示了“做好了 奶茶”。 |

提示：函数里新建的变量，函数外面用不了。

### U8L6-Q2（选输出）点单屏运行这段程序，屏幕上会显示什么？

```python
price = 8
def change():
    price = 100
    print(price)
change()
print(price)
```
真实输出：`100 ⏎ 8`

| 选项 | 对错 | 错因 / 解释 |
|---|---|---|
| `100 ⏎ 8` | ✅ 正确 | 函数里的 price = 100 是函数里自己的变量，只在 change() 里有效。函数里 print 显示 100；函数外面的 price 还是 8，最后一行显示 8。 |
| `100 ⏎ 100` | ❌ | 函数里给 price 赋值，不会改动函数外面的 price。它们是两个同名但互不相干的变量。 |
| `8 ⏎ 8` | ❌ | 函数里有自己的 price = 100，函数里的 print 显示的是 100。 |
| `8 ⏎ 100` | ❌ | 顺序反了：先调用 change()，函数里的 print 先显示 100；最后一行是函数外面的 price，还是 8。 |

提示：函数里和函数外的同名变量是两个变量，互不影响。

### U8L6-Q3（选输出）点单屏运行这段程序，屏幕上会显示什么？

```python
def double(price):
    price = price * 2
    return price
price = 8
print(double(price))
print(price)
```
真实输出：`16 ⏎ 8`

| 选项 | 对错 | 错因 / 解释 |
|---|---|---|
| `16 ⏎ 8` | ✅ 正确 | price 传给函数的参数 price，函数里 price = price * 2 改的是函数里这个参数，交回 16。函数外面的 price 还是 8，最后一行显示 8。 |
| `16 ⏎ 16` | ❌ | 函数里改参数，不会改动函数外面的变量 price。想让它变，要自己把交回的结果存回去，比如 price = double(price)。 |
| `8 ⏎ 8` | ❌ | 第 5 行 print(double(price)) 显示的是函数交回的结果，函数里的 price 已经乘了 2，是 16。 |
| `8 ⏎ 16` | ❌ | 顺序反了：第 5 行先显示函数交回的 16，最后一行才是函数外面没变的 price，也就是 8。 |

提示：传进函数的是值；函数里改参数，不会改动函数外面的变量。

### U8L6-Q4（读报错选择）想让屏幕显示 16。现在最后一行报了 NameError: name 'result' is not defined（result 这个名字没有定义）。怎么改，屏幕才会显示 16？

```python
def calc(price):
    result = price * 2
calc(8)
print(result)
```
展示给学生的报错（真实运行，和 CPython 一致，不含 ^ 箭头）：
```
Traceback (most recent call last):
  File "main.py", line 4, in <module>
    print(result)
NameError: name 'result' is not defined
```

期望输出：`16`

| 选项 | 真实运行 | 对错 | 错因 / 解释 |
|---|---|---|---|
| 在函数里加一行 return result，最后一行改成 print(calc(8)) | 显示 16 | ✅ 正确 | result 只在 calc 里有效。用 return 把它交回来，外面用 print(calc(8)) 接住，就显示 16 了。 |
| 把最后一行改成 print(price) | 报错 NameError | ❌ | price 也是 calc 的参数，只在函数里有效，函数外面用它还是 NameError。 |
| 在最后一行前面加 result = 0 | 显示 0 | ❌ | 不报错了，但这是函数外面新建的另一个 result，里面是 0，显示的是 0，不是 16。 |
| 把 calc(8) 多调用一次 | 报错 NameError | ❌ | 不管调用几次，函数里的 result 在函数结束后都没有了，函数外面还是用不了，仍然是 NameError。 |

提示：想把函数里算出的结果拿到外面，用 return 交回来。
