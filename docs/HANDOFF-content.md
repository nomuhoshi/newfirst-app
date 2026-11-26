# Content handoff (Grok Bot executor → Claude), 2026-11-03 22:20 JST

Ownership of all course and code-task writing moves to Claude. Nothing below is merged. The preview has not been republished; the live preview is still a0c756d (built with #21 at 1bd361e).

## 1. Branches and PRs (stacked; merge bottom-up)
| PR | Branch | Base | Head | Contents |
|---|---|---|---|---|
| #15 | docs/curriculum-u3-plan | main | 239b1d6 | Curriculum (docs/curriculum.md) and the U3/code-task plan. Defines timeout, cancelled and output-limit: none counts as an answer, costs a heart or gives XP. |
| #20 | content/u3-part1 | main | 7e5235e | U3L1–L4 plus fixed step2 expectations. |
| #21 | content/u3-part2 | content/u3-part1 | b4faf6c | U3L5–L8, the U3 eight-lesson tap version; its 4 code tasks are still to be connected. Also adds the modular verify (scripts/verify/) and changes CI to run tests on all PRs but deploy only from main. |
| #22 | content/u4-part1 | content/u3-part2 | 708473a | U4L1–L4: for, range, loop variable, accumulator. Adds tests/step8-u4. |
| #23 | content/u4-part2 | content/u4-part1 | 3181ff9 | U4L5–L8: for+if, while (including infinite-loop recovery), break/continue, project. Adds hang checks to verify. 3181ff9 removes a node_modules symlink that was committed by mistake. |
| #24 | content/code-tasks | content/u4-part2 | 4cd3ba1 | Code tasks in the #19 schema for U3L5–L8 and U4L3–L8 (10 tasks), plus variation drafts and verify checks for both. |
| #25 | content/u5-part1 | content/u4-part2 | 639e4f8 | U5L1–L4: list/len, index, modify/append/remove, slice. Also cherry-picks #24's three commits (fb47ff0, 6845b4f, 7b8fa78) and adds U5L2-M1 and U5L3-M1 with variations (639e4f8). |

Other branches I pushed (scratch preview integration only, do not merge):
- preview-build-cfg 670b9ff: the local preview build.
- preview-int eb11e25: a merge stack of #7, #12, #14 and #16.

U5 part 2 (content/u5-part2) was not started.

### Merge-order note
#24 and #25 are siblings on content/u4-part2, and #25 contains #24's changes as cherry-picks, which are the same patches under different SHAs. Merge #24 first; #25 should then show only its own commits, or need a trivial resolution.

## 2. Still pending
- **No code task is enabled.** All of them live in `lessons[].pending[]`: `{type, replaces, keep?, status, plan, task?}`. `replaces` is the 1-based exercise index the task will replace once #19's runner is connected. `exercises[]` still holds the tap version, so existing exercise IDs and completion records are unchanged.
- **`task.worked`** (a worked example: {code, output, explain}) is not rendered by #19's UI. Decide whether to render it. As a fallback, an earlier predict question in the same lesson serves as the worked example.
- **`variation` and `requiresVariationAfterSolution`** follow GPT's proposal but are not yet confirmed by Claude. They are isolated in scripts/codetask_variations.py.
- **U5 code tasks:** U5L2-M1 and U5L3-M1 are written (on #25).
- **U5 part 2** (L5 iterating a list, L6 in, L7 tuple, L8 project): not started. The latest request asked for simple list comprehensions, but docs/curriculum.md has none in U5, so this needs a decision.
- **U4L8:** its pending entry also keeps an older top-level `reference`/`tests` (`stdout` key), which the original codetask check still runs. Its `task` uses the #19 format.

## 3. Generators
Content is generated, so do not hand-edit content/unitN.json.
```
python3 scripts/make-unit3.py   # → content/unit3.json
python3 scripts/make-unit4.py   # → content/unit4.json
python3 scripts/make-unit5.py   # → content/unit5.json (on #25)
```
- **Helpers:**
  - `pred(prompt, code, [(text, correct, why)], tip)`
  - `fill(prompt, code_with_{0}{1}, tokens, answer, expected, why_by_token, hint)`
  - `order(prompt, lines, shuffled, answers, expected, hint)`
  - `valid_orders(lines, expected, cases)` computes every accepted ordering by really running each permutation. With `cases`, an ordering must also match the canonical output for every data case; such an exercise gets `equivCases`, as U4L8 does with C48.
- **scripts/codetasks.py:** `TASKS = {lessonId: task}` in the #19 schema: {id, version, type modify|write, prompt, given, code|starter, checkMode "output", tests[{name, data, expected, hidden?}], hints[2], reference, worked}. Each generator attaches `TASKS[id]` to `pending[0].task`.
- **scripts/codetask_variations.py:** `V = {taskId: {prompt, starter, tests, hints, solution}}`. `attach()` adds `variation` (id = taskId + "-V1") and `requiresVariationAfterSolution: true`. To rename or drop these fields, edit only this file and the variation block at the end of scripts/verify/codetask.py.
- **Units:** course.json lists the units. src/app.js `UNITS` must import each unit's JSON. On #25, U5 is available and U6 is a placeholder with `available: false`.

## 4. verify:content
Run `npm run verify:content`, or `python3 scripts/verify-content.py [--verbose]`. It is the single entry point and exits with 1 on any failure. Every run is real Python in a fresh namespace with a 2 s SIGALRM cap. Modules in scripts/verify/:
- **output:** a predict question has exactly one correct option, it equals the real output, and no wrong option equals it.
- **fill:** every token combination is run; only the answer may produce the expected output; a combination that hangs fails. One known issue: U1L5-Q4.
- **order:** every accepted ordering produces the expected output; non-accepted orderings must not; `equivCases` is honoured; permutations are checked up to 8 lines; hangs fail.
- **codetask:**
  - The reference passes all tests (data injected as `name = repr(value)` lines).
  - The code (modify) or starter (write) fails at least one test and does not hang.
  - Exception, `EXPECT_HANG = {"U4L6-M1"}`: that starter must time out and print nothing, so the runner hits the timeout rather than the output limit.
  - Exactly 2 hints; at least one public and one hidden test; ids are unique; the worked output is true.
  - Variations: the solution passes; the starter fails without hanging; 2 hints; public and hidden tests; unique id; the parent's reference fails at least one hidden variation test.

Last results: #24 has 238 code-task checks and 46437 runs, with 0 failures. #25 has 284 code-task checks and 46539 runs, with 0 failures.

## 5. Tests in the isolated network namespace
Other agents on the shared box hold ports such as 4318/4319, which earlier produced fake passes against a stale server. Always run:
```
npm run build
unshare -rn sh -c 'ip link set lo up; npm run verify:content && npm test && node tests/step8-u5.test.mjs webkit && node tests/step8-u4.test.mjs webkit && node tests/step8-u3.test.mjs webkit'
```
Ports: step1 4318, step2 4319, step3 4331, step4 4332, step8-u3 4371/4372 (webkit), step8-u4 4373/4374, step8-u5 4375/4376. A new unit test should take the next pair.
- `SHOT_DIR=…` sets where screenshots go.
- Test runs modify tests/step1-390.png; restore it with `git checkout -- tests/step1-390.png`.
- node_modules is a symlink to /workspace/judge/repo/node_modules; never `git add -A`.
- Kill only PIDs you started; never use a broad pkill.

Last full passes (per file, never summed): 64 / 239 / 30 / 19 / step8-u3 67 / step8-u4 66 / step8-u5 34, with step8-u3/u4/u5 also passing in WebKit.
- #24: full rerun passed at 4cd3ba1.
- #25: full pass at bf1b785. The local rerun at 639e4f8 was interrupted during step8-u5, so it does not count; rely on CI for 639e4f8.

## 6. Known issues and caveats
- WebKit simulation is not real iOS, WeChat or iPad. VoiceOver was not tested.
- step8 tests refill hearts before each lesson. This changes test state only, not the hearts rule.
- A wrong fill in step8 fills every blank, with the first token swapped for a wrong one; otherwise the check button stays disabled.
- Test runs interrupted around 21:00–21:15 JST were rerun and are not used as evidence.
- An earlier broad pkill was used once on the shared box. It has not been used since.
- docs/curriculum.md exists only on #15's branch, not on main.
- Evidence zips are on the box at /workspace/u3p2/u3p2.zip, /workspace/u4p1/u4p1.zip, /workspace/u4p2.zip, /workspace/ctev.zip and /workspace/u5p1-evidence.zip.
