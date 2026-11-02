# 生成 content/unit2.json（第 2 单元「文字与长度」，5 关 × 4 题）。内容在这里改，再运行：python3 scripts/make-unit2.py
import json, pathlib

def pred(prompt, code, opts, tip=None):
    d = {"type": "predict", "prompt": prompt, "code": code,
         "options": [{"text": t, "correct": c, "why": w} for t, c, w in opts]}
    if tip: d["tip"] = tip
    return d

def fill(prompt, code, tokens, answer, expected, why, hint, initial=None):
    d = {"type": "fill", "prompt": prompt, "code": code, "tokens": tokens, "answer": answer, "expected": expected, "why": why}
    if initial: d["initial"] = initial
    d["hint"] = hint
    return d

def order(prompt, lines, shuffled, answers, expected, hint):
    return {"type": "order", "prompt": prompt, "lines": lines, "shuffled": shuffled, "answers": answers, "expected": expected, "hint": hint}

SHOW = "点单屏运行这段程序，屏幕上会显示什么？"
T, F = True, False

lessons = [
 {"id": "U2L1", "title": "保存饮品名", "concept": "字符串",
  "story": "菜单上要显示饮品的名字。一段文字在 Python 里叫「字符串」，可以存进变量，和数字一样。",
  "introCode": 'drink = "珍珠奶茶"\nprint(drink)',
  "exercises": [
    pred(SHOW, 'drink = "珍珠奶茶"\nprint(drink)', [
        ("珍珠奶茶", T, "drink 里存着字符串「珍珠奶茶」，print(drink) 显示变量里存的内容。"),
        ("drink", F, "print(drink) 里 drink 没有加引号，它是变量名，显示的是它存的值。"),
        ('"珍珠奶茶"', F, "引号只是告诉 Python「这是文字」，引号本身不会显示出来。")],
        "文字叫字符串，值要放在英文引号里；变量名不加引号。"),
    fill("把饮品名存进变量 drink，屏幕要显示：芋泥奶茶", "drink = {0}\nprint(drink)",
         ['"芋泥奶茶"', "芋泥奶茶", '"drink"'], ['"芋泥奶茶"'], "芋泥奶茶",
         {"芋泥奶茶": "文字没加引号，Python 会把它当成变量名去找，找不到就出错。",
          '"drink"': "这样存进去的是文字 drink，屏幕会显示 drink，不是芋泥奶茶。"},
         "文字（字符串）要放在英文引号里。"),
    pred(SHOW, 'print(15)\nprint("15")', [
        ("15\n15", T, "两行看起来一样：引号不会显示出来。但没加引号的 15 是数字，加了引号的 \"15\" 是文字，Python 把它们当成不同的东西。"),
        ('15\n"15"', F, "引号只是标记「这是文字」，不会显示出来。"),
        ("15", F, "有两个 print，每个 print 单独显示一行，所以是两行。")],
        "数字不加引号；加了引号的 15 是文字，不是数字。屏幕上看起来一样，下一关就能看出区别。"),
    order("排好顺序，让屏幕先显示珍珠奶茶，再显示芋泥奶茶",
          ['drink = "珍珠奶茶"', "print(drink)", 'drink = "芋泥奶茶"', "print(drink)"],
          [2, 3, 0, 1], [[0, 1, 2, 3]], "珍珠奶茶\n芋泥奶茶",
          "先存珍珠奶茶并显示，再换成芋泥奶茶并显示。"),
  ]},
 {"id": "U2L2", "title": "拼出菜单文字", "concept": "字符串拼接",
  "story": "菜单要把「口味」和「奶茶」拼成完整的名字。文字也可以用 + 连起来。",
  "introCode": 'drink = "芋泥"\nprint(drink + "奶茶")',
  "exercises": [
    pred(SHOW, 'drink = "芋泥"\nprint(drink + "奶茶")', [
        ("芋泥奶茶", T, "+ 把两段文字直接连在一起：芋泥 + 奶茶 = 芋泥奶茶。"),
        ("芋泥 奶茶", F, "+ 不会自动加空格。想要空格，得自己写在字符串里。"),
        ("drink奶茶", F, "drink 没有加引号，是变量，显示的是它存的「芋泥」，不是 drink 这个词。")],
        "文字用 + 是「拼起来」，不会自动加空格。"),
    pred(SHOW, 'print("15" + "5")', [
        ("155", T, "\"15\" 和 \"5\" 加了引号，是文字。文字用 + 是连在一起，不是加法。"),
        ("20", F, "只有没加引号的数字才会相加：15 + 5 才是 20。"),
        ("15 5", F, "+ 不会自动加空格，两段文字直接连在一起。")],
        "数字用 + 是加法，文字用 + 是拼接。"),
    fill("屏幕要显示：黑糖 珍珠（中间有一个空格）", 'print("黑糖" + {0} + "珍珠")',
         ['" "', '""', '"空格"'], ['" "'], "黑糖 珍珠",
         {'""': "引号里什么都没有，等于没有加空格，会显示「黑糖珍珠」。",
          '"空格"': "这样拼进去的是「空格」两个字，会显示「黑糖空格珍珠」。"},
         "空格也是一个字符，要写在引号里。"),
    order("排好顺序，让屏幕显示：草莓奶茶",
          ['flavor = "草莓"', 'name = "奶茶"', "drink = flavor + name", "print(drink)"],
          [3, 2, 1, 0], [[0, 1, 2, 3], [1, 0, 2, 3]], "草莓奶茶",
          "变量要先存好文字，才能拿来拼；拼好之后再显示。"),
  ]},
 {"id": "U2L3", "title": "名字有多长", "concept": "len 长度",
  "story": "标签纸的宽度有限，要先知道名字有几个字。Python 用 len 来数，它来自英文单词 length（长度）。",
  "introCode": 'print(len("珍珠奶茶"))',
  "exercises": [
    pred(SHOW, 'print(len("珍珠奶茶"))', [
        ("4", T, "len 数的是字符的个数：珍、珠、奶、茶，一共 4 个。"),
        ("珍珠奶茶", F, "len 返回的是个数（一个数字），不是文字本身。"),
        ("6", F, "引号只是标记，不算在长度里。")],
        "len(...) 数括号里的字符有几个。引号不计入。"),
    pred(SHOW, 'print(len("latte"))', [
        ("5", T, "l、a、t、t、e，每个英文字母算一个字符。"),
        ("1", F, "len 数的是字符，不是单词；latte 虽然是一个单词，但有 5 个字母。"),
        ("7", F, "引号不算在长度里。")],
        "每个汉字、每个字母、每个数字都算一个字符。"),
    fill("屏幕要显示「抹茶拿铁」有几个字", 'print({0}("抹茶拿铁"))',
         ["len", "length", "Len"], ["len"], "4",
         {"length": "Python 里的函数名是缩写 len，不是完整的 length，写 length 会出错。",
          "Len": "大小写不同就是不同的名字，Python 里是小写 len，写 Len 会出错。"},
         "名字是 len，全小写。"),
    order("排好顺序，让屏幕显示：新品、2、柠檬茶、3",
          ['print("新品")', 'print(len("新品"))', 'print("柠檬茶")', 'print(len("柠檬茶"))'],
          [3, 0, 2, 1], [[0, 1, 2, 3]], "新品\n2\n柠檬茶\n3",
          "屏幕上从上往下显示，就把要先显示的行放在上面。"),
  ]},
 {"id": "U2L4", "title": "空格也算一个", "concept": "len 数什么",
  "story": "标签上有空格、数字和标点吗？它们也都算一个字符。len 也可以数变量里存的文字。",
  "introCode": 'name = "milk tea"\nprint(len(name))',
  "exercises": [
    pred(SHOW, 'name = "milk tea"\nprint(len(name))', [
        ("8", T, "milk 4 个字母 + 1 个空格 + tea 3 个字母 = 8。空格也算一个字符。"),
        ("7", F, "中间的空格也算一个字符，要数进去。"),
        ("2", F, "len 数的是字符，不是单词的个数。")],
        "len(name) 数的是变量 name 里存的文字。"),
    pred(SHOW, 'print(len("第1杯！"))', [
        ("4", T, "第、1、杯、！ 各算一个字符：数字字符和标点也算。"),
        ("3", F, "感叹号 ！也是一个字符，也要数进去。"),
        ("6", F, "引号只是标记，不算在长度里。")],
        "数字字符、标点、空格都算一个字符。"),
    fill("屏幕要显示 3。哪一个能做到？", "print(len({0}))",
         ['"15杯"', '"15 杯"', "15"], ['"15杯"'], "3",
         {'"15 杯"': "中间有一个空格，空格也算一个字符，长度是 4。",
          "15": "没有引号的 15 是数字，len 只能数文字，会出错。"},
         "引号里的每个字符都算一个：1、5、杯。"),
    order("排好顺序，让屏幕先显示 milk tea，再显示它的长度",
          ['name = "milk tea"', "print(name)", "print(len(name))"],
          [2, 0, 1], [[0, 1, 2]], "milk tea\n8",
          "变量要先存好文字，才能显示和数长度。"),
  ]},
 {"id": "U2L5", "title": "菜单标签", "concept": "单元复习", "review": True,
  "story": "最后一关：把学过的连起来，做一张菜单标签。",
  "introCode": 'label = "新品："\nlabel = label + "芋泥奶茶"\nprint(label)\nprint(len(label))',
  "exercises": [
    pred(SHOW, 'label = "新品："\nprint(label + "芋泥奶茶")', [
        ("新品：芋泥奶茶", T, "label 里存着「新品：」，+ 把它和「芋泥奶茶」连在一起再显示。"),
        ("新品： 芋泥奶茶", F, "+ 不会自动加空格。"),
        ("新品：", F, "print 里是 label + \"芋泥奶茶\"，拼好之后一起显示，不是只显示 label。")]),
    fill("标签要显示长度 7。补全程序。", 'label = "新品："\nlabel = {0} + "芋泥奶茶"\nprint(len(label))',
         ["label", '"label"', '""'], ["label"], "7",
         {'"label"': "加了引号，拼的是文字 label（5 个字符），长度是 9，不是 7。",
          '""': "引号里什么都没有，原来的「新品：」就丢了，长度只剩 4。"},
         "要把变量里原来的文字接上去，变量名不加引号。"),
    order("排好顺序，让屏幕显示：新品：芋泥奶茶，然后是它的长度 7",
          ['label = "新品："', 'label = label + "芋泥奶茶"', "print(label)", "print(len(label))"],
          [3, 1, 0, 2], [[0, 1, 2, 3]], "新品：芋泥奶茶\n7",
          "先存「新品：」，再接上芋泥奶茶，最后先显示文字、再显示长度。"),
    pred(SHOW, 'size = "大杯"\ndrink = "珍珠奶茶"\nlabel = drink + " " + size\nprint(label)\nprint(len(label))', [
        ("珍珠奶茶 大杯\n7", T, "引号里的空格被拼进去，显示时有空格；长度是 4 + 1 + 2 = 7。"),
        ("珍珠奶茶 大杯\n6", F, "空格也算一个字符，长度是 4 + 1 + 2 = 7。"),
        ("珍珠奶茶大杯\n7", F, "拼接时中间写了一个 \" \"，所以显示的文字里有空格。")]),
  ]},
]
unit = {"id": "U2", "title": "文字与长度", "subtitle": "字符串、len", "lessons": lessons}
out = pathlib.Path(__file__).resolve().parent.parent / "content" / "unit2.json"
out.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("wrote", out, sum(len(l["exercises"]) for l in lessons), "题")
