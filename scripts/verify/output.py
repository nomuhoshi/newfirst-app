# 选输出题（predict）：恰好一个正确选项；正确选项 = 真实输出；错误选项 ≠ 真实输出。
# 报错题（predict + expectError，老大 2026-11-17 同意新增）：这段程序真实运行必须报指定的错。
#   expectError = { type: 错误类型, line: 出错行号, stdout: 报错前已经显示的内容（默认空）, msg: 可选，题面引用的错误说明 }
#   选项是文字或改法，不等于程序输出，所以这里核对的是：真实错误类型、行号、报错前的输出、题面引用的说明都和真实运行一致；恰好一个正确选项；选项都有解释。
#   选项带 program（改好后的完整程序）时：正确选项的程序必须不报错且输出 = fixed；错误选项的程序必须报错或输出 ≠ fixed。
from .common import run, run_detail, Check
def check_error(c, w, ex):
    ee = ex["expectError"]
    out, err, line, msg = run_detail(ex["code"])
    c.ok(err == ee["type"], w, f"期望报 {ee['type']}，真实是 {err}")
    c.ok(line == ee["line"], w, f"期望第 {ee['line']} 行出错，真实是第 {line} 行")
    c.ok(out == ee.get("stdout", ""), w, f"报错前的输出期望 {ee.get('stdout', '')!r}，真实是 {out!r}")
    if "msg" in ee:
        c.ok(msg == ee["msg"], w, f"错误说明期望 {ee['msg']!r}，真实是 {msg!r}")
        c.ok(f"{ee['type']}: {ee['msg']}" in ex["prompt"], w, "题面没有原样引用报错的最后一行")
    cor = [o for o in ex["options"] if o["correct"]]
    c.ok(len(cor) == 1, w, f"正确选项有 {len(cor)} 个")
    c.ok(len({o["text"] for o in ex["options"]}) == len(ex["options"]), w, "选项文字有重复")
    for o in ex["options"]:
        c.ok(bool(o.get("why")), w, f"选项 {o['text']!r} 没有解释")
        if "program" in o:
            o2, e2 = run(o["program"])
            if o["correct"]: c.ok(e2 is None and o2 == ex.get("fixed"), w, f"正确改法运行结果 {o2!r}（错误 {e2}）≠ 期望 {ex.get('fixed')!r}")
            else: c.ok(e2 is not None or o2 != ex.get("fixed"), w, f"错误改法 {o['text']!r} 也能得到期望输出")
    if any("program" in o for o in ex["options"]):
        c.ok(all("program" in o for o in ex["options"]) and "fixed" in ex, w, "改法题的每个选项都要有 program，并写明 fixed")
# 选改法 / 选测试输入题（predict，不报错，U9 起）：每个选项都带 program（选了它之后的完整程序），题目写明 fixed（规则要求的输出）。
#   真实运行每个选项的程序：只有不报错且输出 == fixed 的那个选项才是正确选项（恰好一个）；选项文字不是程序输出，所以不按“选输出”核对。
def check_choose(c, w, ex):
    c.ok("fixed" in ex, w, "选改法题要写明 fixed")
    c.ok(all("program" in o for o in ex["options"]), w, "选改法题的每个选项都要有 program")
    c.ok(len({o["text"] for o in ex["options"]}) == len(ex["options"]), w, "选项文字有重复")
    c.ok(sum(1 for o in ex["options"] if o["correct"]) == 1, w, "正确选项不是恰好一个")
    for o in ex["options"]:
        c.ok(bool(o.get("why")), w, f"选项 {o['text']!r} 没有解释")
        if "program" not in o: continue
        out, err = run(o["program"]); good = err is None and out == ex.get("fixed")
        c.ok(good == bool(o["correct"]), w, f"选项 {o['text']!r}：真实运行{'报错 ' + str(err) if err else '输出 ' + repr(out)}，期望 {ex.get('fixed')!r}，correct={o['correct']}")
def check(items):
    c = Check("选输出 predict")
    for w, l, ex in items:
        if ex["type"] != "predict": continue
        if "expectError" in ex: check_error(c, w, ex); continue
        if any("program" in o for o in ex["options"]): check_choose(c, w, ex); continue
        out, err = run(ex["code"])
        c.ok(err is None, w, f"程序出错 {err}")
        cor = [o for o in ex["options"] if o["correct"]]
        c.ok(len(cor) == 1, w, f"正确选项有 {len(cor)} 个")
        if cor: c.ok(cor[0]["text"] == out, w, f"正确选项 {cor[0]['text']!r} ≠ 真实输出 {out!r}")
        for o in ex["options"]:
            if not o["correct"]: c.ok(o["text"] != out, w, f"错误选项 {o['text']!r} 其实就是真实输出")
    return c
