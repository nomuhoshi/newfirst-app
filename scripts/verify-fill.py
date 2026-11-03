#!/usr/bin/env python3
"""用真实 Python 验证 fill 题每个词块：正确词块的输出必须等于 expected，
错误词块的输出必须不等于 expected；同时打印错误词块的解释，供人工核对解释里的数字。
用法：python3 scripts/verify-fill.py [content/*.json ...]（默认全部 content/unit*.json）"""
import json, sys, glob, io, contextlib
files = sys.argv[1:] or sorted(glob.glob('content/unit*.json'))
fails = checked = 0
def run(code):
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf): exec(code, {})
        return buf.getvalue().rstrip('\n')
    except Exception as e: return f'<{type(e).__name__}>'
for f in files:
    d = json.load(open(f, encoding='utf-8'))
    for l in (d['lessons'] if isinstance(d, dict) else d):
        for i, q in enumerate(l.get('exercises', []), 1):
            if q.get('type') != 'fill' or 'expected' not in q: continue
            qid = f"{l['id']}-Q{i}"; n = q['code'].count('{0}')
            if n != 1 or len(q['answer']) != 1: print(f'SKIP {qid}（多空，未验证）'); continue
            for t in q['tokens']:
                out = run(q['code'].replace('{0}', t)); checked += 1
                ok_tok = t in q['answer']; why = q.get('why', {}).get(t, '')
                good = (out == q['expected']) if ok_tok else (out != q['expected'])
                print(f"{'PASS' if good else 'FAIL'} {qid} [{t}] -> {out!r} {'(正确词块)' if ok_tok else '(错误词块) why: ' + why}")
                fails += not good
print(f'checked={checked} fails={fails}')
sys.exit(1 if fails else 0)
