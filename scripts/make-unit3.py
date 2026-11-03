# 生成 content/unit3.json（第 3 单元「比较与判断」第一部分：U3L1–U3L4，每关 4 题）。
# 内容在这里改，再运行：python3 scripts/make-unit3.py && python3 scripts/verify-content.py
# 只用已学语法：print（含逗号）、变量、+ - * /、字符串、len，加上本关新教的内容。
import json, pathlib

def pred(prompt, code, opts, tip=None):
    d = {"type": "predict", "prompt": prompt, "code": code,
         "options": [{"text": t, "correct": c, "why": w} for t, c, w in opts]}
    if tip: d["tip"] = tip
    return d

def fill(prompt, code, tokens, answer, expected, why, hint):
    return {"type": "fill", "prompt": prompt, "code": code, "tokens": tokens, "answer": answer, "expected": expected, "why": why, "hint": hint}

def order(prompt, lines, shuffled, answers, expected, hint):
    return {"type": "order", "prompt": prompt, "lines": lines, "shuffled": shuffled, "answers": answers, "expected": expected, "hint": hint}

SHOW = "点单屏运行这段程序，屏幕上会显示什么？"
T, F = True, False

lessons = [
 {"id": "U3L1", "title": "满不满 100 元", "concept": "比较大小",
  "story": "店里搞活动：满 100 元有优惠。程序要先判断“够不够”。比较两个数，结果只有两种：True（成立）或 False（不成立）。",
  "introCode": "total = 120\nprint(total > 100)",
  "exercises": [
    pred(SHOW, "total = 80\nprint(total > 100)", [
        ("False", T, "80 不大于 100，比较不成立，结果是 False。"),
        ("80", F, "比较的结果不是数字，而是 True 或 False。"),
        ("True", F, "80 > 100 不成立，所以是 False。")],
        tip="比较的结果只有 True 或 False，首字母大写，不加引号。"),
    pred(SHOW, "print(100 >= 100)\nprint(100 > 100)", [
        ("True\nFalse", T, ">= 是“大于或等于”，100 等于 100，成立；> 只算“大于”，100 不大于自己。"),
        ("True\nTrue", F, "> 不包含相等：100 > 100 是 False。"),
        ("False\nFalse", F, ">= 包含相等，100 >= 100 是 True。")],
        tip=">= 读作“大于或等于”，<= 读作“小于或等于”。"),
    fill("买满 3 杯（正好 3 杯也算）就显示 True，补全比较符号。", "cups = 3\nprint(cups {0} 3)",
        [">=", "=>", ">"], [">="], "True",
        {"=>": "Python 里没有 =>，要写成 >=：大于号在前，等号在后。", ">": "3 > 3 不成立，> 不包含正好相等的情况。"},
        "“正好 3 杯也算”要用包含相等的比较符号，大于号写在前面。"),
    order("排好顺序，让屏幕先显示总价，再显示是否满 100 元：\n120\nTrue",
        ["total = 120", "print(total)", "print(total >= 100)"], [2, 0, 1], [[0, 1, 2]], "120\nTrue",
        "变量要先存好值；先显示总价，再显示比较结果。"),
  ]},
 {"id": "U3L2", "title": "是不是大杯", "concept": "等于和不等于",
  "story": "要判断顾客点的是不是大杯。比较“是否相等”用两个等号 ==；“不相等”用 !=。一个等号 = 是把值存进变量，不是比较。",
  "introCode": "size = \"大杯\"\nprint(size == \"大杯\")",
  "exercises": [
    pred(SHOW, "cups = 2\nprint(cups == 2)\nprint(cups != 2)", [
        ("True\nFalse", T, "cups 是 2：== 2 成立；!= 2（不等于 2）不成立。"),
        ("2\nFalse", F, "== 是比较，不是存值，结果是 True 或 False，不会显示 2。"),
        ("True\nTrue", F, "!= 的意思是“不等于”，cups 正好等于 2，所以是 False。")],
        tip="== 比较是否相等；!= 比较是否不相等。"),
    fill("判断顾客点的是不是大杯，屏幕要显示 True。", "size = \"大杯\"\nprint(size {0} \"大杯\")",
        ["==", "=", "!="], ["=="], "True",
        {"=": "一个等号是存值，不能用来比较，这里会报错。比较相等要用两个等号 ==。", "!=": "!= 是“不等于”，大杯等于大杯，结果是 False。"},
        "比较“是否相等”要用两个等号。"),
    pred(SHOW, "print(\"15\" == 15)", [
        ("False", T, "加了引号的 \"15\" 是文字，15 是数字，类型不同，不相等。"),
        ("True", F, "看起来一样，但文字 \"15\" 和数字 15 是不同的东西，所以不相等。"),
        ("15", F, "== 的结果是 True 或 False，不会显示 15。")],
        tip="回想第 2 单元：加引号的是文字（字符串），不加引号的是数字。"),
    fill("会员码要和 \"VIP\" 完全一样才算。顾客输入的是 \"vip\"，补全程序，让屏幕显示 False（表示不算会员）。", "code = \"vip\"\nprint(code {0} \"VIP\")",
        ["==", "!="], ["=="], "False",
        {"!=": "vip 和 VIP 大小写不同，所以“不相等”成立，!= 的结果是 True，不是题目要的 False。"},
        "大小写不同的文字不相等。要问的是“是否相等”。"),
  ]},
 {"id": "U3L3", "title": "记住是不是会员", "concept": "布尔值存进变量",
  "story": "True 和 False 叫“布尔值”。比较的结果可以存进变量，以后直接用。注意：True 不加引号，加了引号就变成文字了。",
  "introCode": "total = 150\nbig = total >= 100\nprint(big)",
  "exercises": [
    pred(SHOW, "total = 150\nbig = total >= 100\nprint(big)", [
        ("True", T, "big 里存的是比较的结果：150 >= 100 成立，所以是 True。"),
        ("total >= 100", F, "变量存的是比较算出来的结果，不是这段文字。"),
        ("150", F, "big 存的是比较结果，不是 total 的值。")],
        tip="先算等号右边的比较，再把结果（True/False）存进左边的变量。"),
    fill("顾客是会员。把真正的布尔值存进 is_vip，屏幕要显示 True。", "is_vip = {0}\nprint(is_vip == True)",
        ["True", "\"True\"", "true"], ["True"], "True",
        {"\"True\"": "加了引号是文字 \"True\"，和布尔值 True 不相等，结果是 False。", "true": "Python 区分大小写，布尔值要写成首字母大写的 True；小写的 true 会报错。"},
        "布尔值首字母大写，不加引号。"),
    order("排好顺序：先存杯数，再把“是否买了 3 杯以上”存进 many，最后显示它。屏幕显示：True",
        ["cups = 4", "many = cups >= 3", "print(many)"], [1, 2, 0], [[0, 1, 2]], "True",
        "用到的变量必须先存好：先有 cups，才能算 many；先有 many，才能显示。"),
    pred(SHOW, "is_vip = \"True\"\nprint(is_vip == True)", [
        ("False", T, "is_vip 存的是文字 \"True\"（有引号），不是布尔值 True，两者不相等。"),
        ("True", F, "看起来一样，但加了引号就是文字，和布尔值 True 不是同一个东西。")],
        tip="\"True\" 是文字，True 是布尔值。"),
  ]},
 {"id": "U3L4", "title": "满 100 才减", "concept": "if 和缩进",
  "story": "if 让程序“条件成立才做”。if 后面写条件，行末要有英文冒号 :，下面要做的事往里缩进 4 个空格。没有缩进的行不属于 if，无论条件如何都会执行。",
  "introCode": "total = 120\nif total >= 100:\n    print(\"满减 20 元\")\nprint(\"谢谢光临\")",
  "exercises": [
    pred(SHOW, "total = 80\nif total >= 100:\n    print(\"满减 20 元\")\nprint(\"谢谢光临\")", [
        ("谢谢光临", T, "80 >= 100 不成立，缩进的那行被跳过；最后一行没有缩进，不属于 if，照常执行。"),
        ("满减 20 元\n谢谢光临", F, "条件不成立时，if 里缩进的行不会执行。"),
        ("（什么也不显示）", F, "print(\"谢谢光临\") 没有缩进，不属于 if，一定会执行。")],
        tip="缩进的行属于 if；没缩进的行和 if 无关。"),
    order("排好顺序：满 100 元时显示满减，最后一定显示谢谢光临。屏幕显示：\n满减 20 元\n谢谢光临",
        ["total = 150", "if total >= 100:", "    print(\"满减 20 元\")", "print(\"谢谢光临\")"], [3, 2, 0, 1], [[0, 1, 2, 3]], "满减 20 元\n谢谢光临",
        "先存总价；缩进的那行要紧跟在 if 下面；不缩进的谢谢光临放最后。"),
    fill("买满 3 杯送一张优惠券，补全 if 这一行。屏幕要显示：送一张优惠券", "cups = 3\nif cups >= 3{0}\n    print(\"送一张优惠券\")",
        [":", "：", ";"], [":"], "送一张优惠券",
        {"：": "这是中文冒号。Python 只认英文冒号 :，会报语法错误。", ";": "if 行的末尾要写冒号 :，不是分号。"},
        "if 这一行最后要写英文冒号。"),
    pred(SHOW, "cups = 1\nif cups >= 3:\n    print(\"送一张优惠券\")\n    print(\"优惠券已发放\")\nprint(\"下单完成\")", [
        ("下单完成", T, "1 >= 3 不成立，缩进的两行都属于 if，都被跳过；只有没缩进的最后一行执行。"),
        ("优惠券已发放\n下单完成", F, "第二个 print 也缩进了，同样属于 if，条件不成立就不执行。"),
        ("送一张优惠券\n优惠券已发放\n下单完成", F, "cups 是 1，不满 3 杯，if 里的内容不执行。")],
        tip="if 下面所有缩进相同的行，都属于这个 if。"),
  ]},
]

unit = {"id": "U3", "title": "比较与判断", "subtitle": "比较、True/False、if", "lessons": lessons}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit3.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons))
