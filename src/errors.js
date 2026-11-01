// 把 Python 的英文错误类型配上中文说明（第一步先覆盖课程范围内常见的几种）。
const HINTS = {
  SyntaxError: "语法错误：代码的写法不符合 Python 规则，常见原因是少了冒号、括号或引号。",
  IndentationError: "缩进错误：这一行前面的空格数量不对。冒号后的下一行通常要多缩进 4 个空格。",
  TabError: "缩进混用了 Tab 和空格。请统一用 4 个空格。",
  NameError: "名字错误：用到了一个还没有定义的变量或函数，检查拼写和大小写。",
  TypeError: "类型错误：把不能一起用的东西放在了一起，例如文字和数字直接相加。",
  ValueError: "数值错误：类型对了，但值不合适，例如 int(\"abc\")。",
  ZeroDivisionError: "除以零错误：除数不能是 0。",
  IndexError: "索引错误：取的位置超出了列表的范围。",
  KeyError: "键错误：字典里没有这个键。",
  AttributeError: "属性错误：这个对象没有你写的这个功能，检查拼写。",
  RuntimeError: "运行时错误。",
  InternalError: "应用内部出错，请重试。",
};

export function describeError(err) {
  const where = err.line ? `第 ${err.line} 行` : "位置未知";
  const hint = HINTS[err.kind] || "程序运行出错。";
  return `${err.kind}（${where}）：${err.msg}\n${hint}`;
}
