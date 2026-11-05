# U6 第 5、6 关草稿（调试练习与小项目）——只是草稿，**不进课程分支内容，不发预览**

按产品官要求：等第 3、4 关审稿期间起草。题目的所有“真实输出”已用 Python 跑过；小项目代码题已用 `review-code-tasks.py` 复核（0 问题）。仍未进 `content/`，审完 L3/L4 再按“一次一个部分”做。

## U6L5「用 print 找 bug」

- 主概念：程序不报错、结果却不对时，在中间加 `print` 看变量的值，找到第一处和你预想不一样的地方。
- 前置：L3（读报错）、L4（修错）、U4 的累加循环（`total = total + i`）。
- 易踩的坑：① 把调试 print 放在出错位置之后；② 只看最后结果，不看每一轮；③ 打印时写成字符串 `"total"`，打印出的是单词不是值。
- 不用 `+=`、f-string、input。

### Q1（选输出 · 看懂）小码想算 3 杯 12 元的总价 36，在中间加了一行 print 看看。屏幕上会显示什么？
```python
price = 12
cups = 3
total = price + cups
print("total:", total)
print("应付", total)
```
真实输出：`'total: 15\n应付 15'`。候选选项：`'total: 15\n应付 15'` ✅（中间的 total 是 15，不是 36 → 第 3 行把乘写成了加）；`'total: 36\n应付 36'` ❌（以为算对了）；`'total: 15\n应付 36'` ❌（前后矛盾）。

### Q2（选输出 · 定位）想算 1+2+3=6，加了 print 看每一轮。屏幕上会显示什么？
```python
total = 0
for i in range(1, 4):
    total = 0
    total = total + i
    print("第", i, "轮", total)
print(total)
```
真实输出：`'第 1 轮 1\n第 2 轮 2\n第 3 轮 3\n3'`（每轮 total 都被清零）。对照正确程序的输出：`'第 1 轮 1\n第 2 轮 3\n第 3 轮 6\n6'`。错误选项：正确程序的输出（以为在累加）、只有最后 `6`。

### Q3（填空 · 动手）想看每一轮累加后的 total，print 里填什么？
```python
total = 0
for i in range(1, 4):
    total = total + i
    print("第", i, "轮", {0})
print(total)
```
| 词块 | 真实运行 |
|---|---|
| `total` | '第 1 轮 1\n第 2 轮 3\n第 3 轮 6\n6' |
| `i` | '第 1 轮 1\n第 2 轮 2\n第 3 轮 3\n6' |
| `"total"` | '第 1 轮 total\n第 2 轮 total\n第 3 轮 total\n6' |

目标输出（标准答案 `total`）：`'第 1 轮 1\n第 2 轮 3\n第 3 轮 6\n6'`。

### Q4（排序 · 换个例子）排好顺序，先看到中间值 half，再看到加 1 之后的结果。
```python
n = 4
half = n // 2
print("half:", half)
print(half + 1)
```
目标输出 `'half: 2\n3'`；24 种排列真实运行，能得到目标的有 1 种：[[0, 1, 2, 3]]。

## U6L6 项目「修好收银程序」（改代码题，多处错；**代码题运行器开放前都是待开放**）

- 主概念：一次一个地修，每次修完重新运行，读最新的报错；有的错不报错，只会在测试里算错（边界）。
- 前置：L3、L4、L5；U3 的 `>=` 边界。
- 题目（`U6L6-M1`，`modify`，`checkMode: output`）：

```python
# price、cups 是文字（题目给定），下面是起始代码
total = price * cups
if cups > 5:
    total = total - 5
print("应付：" + total)
```
题面：收银程序有好几处错。price 和 cups 是从点单屏读来的文字（比如 "12" 和 "3"）。要求：算出总价（单价 × 杯数），满 5 杯（正好 5 杯也算）减 5 元，输出“应付：金额”。请一处一处改好。

**错会一个接一个出现**（真实运行）：

1. 起始代码：`TypeError`（第 1 行）`can't multiply sequence by non-int of type 'str'`
2. 修好上一处后：`TypeError`（第 2 行）`'>' not supported between instances of 'str' and 'int'`
3. 修好上一处后：`TypeError`（第 4 行）`can only concatenate str (not "int") to str`
4. 修好上一处后：不报错，`'应付：36'`

第 4 步不报错了，但 5 杯的测试会失败：`> 5` 应为 `>= 5`（边界，只在测试里发现）。

参考答案：
```python
total = int(price) * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + str(total))
```

测试：公开 3 杯→`应付：36`、5 杯（单价 10）→`应付：45`；隐藏 6 杯（单价 8）→`应付：43`、1 杯（单价 15）→`应付：15`、4 杯（单价 9）→`应付：36`。

合理写法（`alternatives`，复核脚本全部判对）：先 `cups = int(cups)`、`price = int(price)` 再算；`int(cups) > 4`；`print("应付：", total, sep="")`。常见错误（`wrongAnswers`，全部判错）：`> 5`（5 杯没减）；`price * int(cups)`（price 还是文字，`"12" * 3` 是重复不是乘法）。

**复核脚本**：`review-code-tasks.py` 对这道题 0 问题（参考答案过全部测试、起始代码至少错一组、写死公开输出被隐藏测试抓到、示范不泄题）。

## 需要你们定的

1. 小项目示范里的 `str(int(price) * int(n))` 一行写了三层嵌套，对新手偏密，是否拆成两行？
2. 小项目需要 `price` / `cups` 以文字形式给定（`given` 数据是文字）。代码题运行器开放前，它仍是“待开放”，和前面各单元的 `pending` 处理一致。
3. L5 的 Q4 是不是该换成代码题（写一写）等运行器开放后再替换？
