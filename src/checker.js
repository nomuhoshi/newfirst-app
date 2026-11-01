// 判分：把“程序的真实输出”和“题目要求”对比，给出具体的中文原因。
// 规则（规格 §4.2）：只统一换行符和末尾一个换行，不删行内空格。

export function normalize(text) {
  return text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
}

const lines = (text) => (normalize(text) === "" ? [] : normalize(text).split("\n"));

// 精确比较输出
export function checkExact(actual, expected) {
  const a = lines(actual);
  const e = lines(expected);
  if (a.join("\n") === e.join("\n")) return { pass: true };
  if (a.length === 0) return { pass: false, message: "程序没有输出任何内容。记得用 print 把内容显示出来。" };
  if (a.length === e.length && [...a].sort().join("\n") === [...e].sort().join("\n")) {
    return { pass: false, message: "内容都对，但顺序不对。程序从上往下执行：想先显示的，就写在前面。" };
  }
  if (a.length < e.length) {
    return { pass: false, message: `应该输出 ${e.length} 行，你的程序输出了 ${a.length} 行。每个 print 输出一行，看看是不是少写了一个。` };
  }
  if (a.length > e.length) {
    return { pass: false, message: `应该输出 ${e.length} 行，你的程序输出了 ${a.length} 行，多了 ${a.length - e.length} 行。` };
  }
  const i = a.findIndex((line, k) => line !== e[k]);
  let msg = `第 ${i + 1} 行应该是「${e[i]}」，你的程序输出的是「${a[i]}」。`;
  const lead = (t) => /^ */.exec(t)[0].length;
  if (a[i].trim() === e[i].trim() && lead(a[i]) !== lead(e[i])) msg += `这一行前面应该有 ${lead(e[i])} 个空格，你的有 ${lead(a[i])} 个。空格要写在引号里面。`;
  else if (a[i].replace(/\s/g, "") === e[i].replace(/\s/g, "")) msg += "差别在空格上，注意不要多打或少打空格。";
  else if (/^["'“”].*["'“”]$/.test(a[i])) msg += "引号不会显示出来，只要把文字放在引号里面。";
  return { pass: false, message: msg };
}

// N01 小任务：名字 / 爱好 / 自我介绍。内容是自由的，只检查行数、顺序和“爱好：”开头。
const HOBBY = /^爱好\s*[：:]\s*\S/;
export function checkSelfIntro(actual, order) {
  const a = lines(actual);
  if (a.length === 0) return { pass: false, message: "程序没有输出任何内容。需要写三行 print。" };
  if (a.length !== 3) return { pass: false, message: `需要正好输出 3 行，你的程序输出了 ${a.length} 行。每个 print 输出一行。` };
  const empty = a.findIndex((l) => l.trim() === "");
  if (empty !== -1) return { pass: false, message: `第 ${empty + 1} 行是空的，请在引号里写上内容。` };
  const hobbyAt = order.indexOf("hobby");
  const realHobby = a.findIndex((l) => HOBBY.test(l));
  if (realHobby === -1) {
    if (a.some((l) => /^爱好/.test(l))) return { pass: false, message: "爱好那一行要写成「爱好：」加上具体内容，例如「爱好：画画」。" };
    return { pass: false, message: `第 ${hobbyAt + 1} 行要以「爱好：」开头，例如「爱好：画画」。` };
  }
  if (realHobby !== hobbyAt) {
    return { pass: false, message: `「爱好：…」应该在第 ${hobbyAt + 1} 行，你的程序把它放在了第 ${realHobby + 1} 行。程序从上往下执行，调整一下 print 的先后顺序。` };
  }
  if (a.some((l) => /^你的名字$|^一句自我介绍$/.test(l.trim()))) {
    return { pass: false, message: "把示例文字换成你自己的内容。" };
  }
  return { pass: true };
}

export function checkOutput(check, actual) {
  if (check.kind === "exact") return checkExact(actual, check.expected);
  if (check.kind === "selfIntro") return checkSelfIntro(actual, check.order);
  throw new Error("未知的判分方式：" + check.kind);
}

// 针对初学者常见错误，补充一句更具体的说明
export function explainForBeginner(err, code = "") {
  if (!err) return "";
  const m = String(err.msg || "");
  // 先看代码里有没有中文引号/括号：这是手机上最常见的错误，报错类型可能各不相同
  if (/[“”‘’（）]/.test(code) || (err.kind === "SyntaxError" && /invalid character/.test(m))) {
    return "你用了中文符号（例如 “ ” （ ））。代码里的引号和括号必须是英文半角：\" ( )。可以切回内置键盘输入符号。";
  }
  if (err.kind === "SyntaxError" && /unterminated string|EOL/.test(m)) {
    return "引号没有配对：文字的两边各需要一个英文双引号 \"。";
  }
  if (err.kind === "SyntaxError" && /was never closed|unmatched/.test(m)) {
    return "括号没有配对：每个 ( 都需要一个 ) 。";
  }
  if (err.kind === "NameError") {
    return "Python 把没加引号的文字当成了一个名字（变量），但这个名字不存在。要显示文字，请用英文双引号把它包起来。";
  }
  if (err.kind === "IndentationError") {
    return "这一节的代码每行都应该从最左边开始写，前面不要有空格。";
  }
  return "";
}
