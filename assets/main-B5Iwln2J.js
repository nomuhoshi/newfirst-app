const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./code-task-CUrdL1Du.js","./keyboard-d9Xcoz37.js","./errors-BKwIAuf4.js","./errors-DE9dolOj.css","./code-task-BkF6sDyn.css"])))=>i.map(i=>d[i]);
import{n as e,r as t,t as n}from"./errors-BKwIAuf4.js";var r=Object.defineProperty,i=(e,t)=>{let n={};for(var i in e)r(n,i,{get:e[i],enumerable:!0});return t||r(n,Symbol.toStringTag,{value:`Module`}),n};{let e=window.localStorage,t=`u67c:`,n=()=>{let n=[];for(let r=0;r<e.length;r++){let i=e.key(r);i&&i.startsWith(t)&&n.push(i.slice(5))}return n},r={getItem:n=>e.getItem(t+n),setItem:(n,r)=>e.setItem(t+n,r),removeItem:n=>e.removeItem(t+n),clear:()=>n().forEach(n=>e.removeItem(t+n)),key:e=>n()[e]??null,get length(){return n().length}},i=!1;try{Object.defineProperty(window,"localStorage",{value:r,configurable:!0}),i=window.localStorage===r}catch{}if(!i){let e=`这个浏览器不允许测试入口隔离存储。为了不碰到正式版的学习记录和登录，测试入口已停止运行，请改用正式站。`;try{document.documentElement.innerHTML=`<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font:16px/1.6 sans-serif;padding:24px;background:#10213a;color:#f3ead7"></body>`,document.body.textContent=e}catch{}throw Error(e)}}var a={title:`Python 入门`,units:[{id:`U1`,title:`奶茶店点单屏`,subtitle:`输出、变量和简单运算`,file:`unit1.json`,available:!0},{id:`U2`,title:`文字与长度`,subtitle:`字符串、len`,file:`unit2.json`,available:!0},{id:`U3`,title:`比较与判断`,subtitle:`比较、if/else/elif、and/or/not`,available:!0,file:`unit3.json`},{id:`U4`,title:`循环`,subtitle:`for、range、while、break`,available:!0,file:`unit4.json`},{id:`U5`,title:`列表与序列`,subtitle:`列表、下标、append、切片`,available:!0,file:`unit5.json`},{id:`U6`,title:`类型与报错`,subtitle:`type、int()/str()、读报错`,available:!0,file:`unit6.json`},{id:`U7`,title:`字典`,subtitle:`dict：键和值、查、改、增删、遍历`,available:!0,file:`unit7.json`}]},o={id:`U1`,title:`奶茶店点单屏`,subtitle:`输出、变量和简单运算`,lessons:[{id:`U1L1`,title:`让屏幕说话`,concept:`print 输出`,story:`街角的奶茶店想要一块点单屏。第一步：让屏幕显示文字。`,introCode:`print("欢迎光临！")`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print("欢迎光临！")`,options:[{text:`欢迎光临！`,correct:!0,why:`print(...) 会把括号里的内容显示到屏幕上。`},{text:`"欢迎光临！"`,correct:!1,why:`引号只是告诉 Python「这是一段文字」，引号本身不会显示。`},{text:`print("欢迎光临！")`,correct:!1,why:`print、括号和引号是写给 Python 看的，屏幕上只显示引号里的文字。`}],tip:`print(...) 会把括号里的内容显示到屏幕上。文字要放在英文引号 " " 里。`},{type:`fill`,prompt:`屏幕要显示：今日推荐：珍珠奶茶`,code:`print({0})`,tokens:[`"今日推荐：珍珠奶茶"`,`今日推荐：珍珠奶茶`],answer:[`"今日推荐：珍珠奶茶"`],expected:`今日推荐：珍珠奶茶`,why:{"今日推荐：珍珠奶茶":`文字没加引号，Python 会把它当成代码去执行，程序会出错。`},hint:`文字要放在英文引号里。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print("营业时间")
print(10)
print(22)`,options:[{text:`营业时间
10
22`,correct:!0,why:`每个 print 单独显示一行，从上往下依次执行。`},{text:`营业时间 10 22`,correct:!1,why:`每个 print 都会单独占一行，不会挤在同一行。`},{text:`10
22
营业时间`,correct:!1,why:`程序从上往下执行，第一行的 print 先显示。`}],tip:`数字可以直接写，不用加引号。程序从上往下，一行一行执行。`},{type:`order`,prompt:`排好顺序，让屏幕依次显示：欢迎光临！、今天有新品、请点单`,lines:[`print("欢迎光临！")`,`print("今天有新品")`,`print("请点单")`],shuffled:[2,0,1],answers:[[0,1,2]],expected:`欢迎光临！
今天有新品
请点单`,hint:`想先显示哪一行，就把它放在最上面。`}]},{id:`U1L2`,title:`记住顾客`,concept:`变量`,story:`顾客点单时，屏幕要记住他的名字。这就要用到「变量」。`,introCode:`name = "小林"
print(name)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`name = "小林"
print(name)`,options:[{text:`小林`,correct:!0,why:`变量 name 里存着「小林」，print(name) 显示的是存的值。`},{text:`name`,correct:!1,why:`print(name) 里没有引号，所以显示的是变量里存的值，不是 name 这个词。`},{text:`"小林"`,correct:!1,why:`引号不会显示出来。`}],tip:`变量是一个名字，用来存值。写法：名字 = 值。这里的 = 意思是「把右边的值存进左边」。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`name = "小林"
print("name")`,options:[{text:`name`,correct:!0,why:`加了引号，"name" 就只是一段普通文字。`},{text:`小林`,correct:!1,why:`这里 name 加了引号，就变成了文字 name 本身，不再是变量。`}],tip:`变量名不加引号；加了引号就成了普通文字。`},{type:`fill`,prompt:`新顾客叫「阿杰」。把名字存进变量 name。`,code:`name = {0}
print(name)`,tokens:[`"阿杰"`,`阿杰`,`"name"`],answer:[`"阿杰"`],expected:`阿杰`,why:{阿杰:`文字要加引号，不然 Python 会去找一个叫「阿杰」的变量，找不到就出错。`,'"name"':`这样存进去的是文字 name，屏幕会显示 name。`},hint:`名字是文字，要加引号。`},{type:`fill`,prompt:`屏幕应该显示杯数 2，但程序出错了。修好它。`,code:`cups = 2
print({0})`,tokens:[`cups`,`Cups`,`"cups"`],answer:[`cups`],expected:`2`,why:{Cups:`大小写不同就是不同的名字：Cups 和 cups 是两个变量，Cups 没有存过值。`,'"cups"':`加了引号会显示 cups 这个词，不是 2。`},initial:[`Cups`],hint:`变量名要和存值时一模一样，包括大小写。`}]},{id:`U1L3`,title:`顾客改单`,concept:`重新赋值`,story:`顾客说：「还是要 3 杯吧。」变量里的值可以换成新的。`,introCode:`cups = 2
cups = 3
print(cups)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = 2
cups = 3
print(cups)`,options:[{text:`3`,correct:!0,why:`第二行把 cups 改成了 3，旧值 2 被替换掉。`},{text:`2`,correct:!1,why:`第二行已经把 cups 改成了 3。`},{text:`2
3`,correct:!1,why:`只有一个 print，所以只显示一次。`}],tip:`给变量重新赋值，新值会替换旧值。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = 2
print(cups)
cups = 3`,options:[{text:`2`,correct:!0,why:`print 在改单之前执行，那时 cups 还是 2。`},{text:`3`,correct:!1,why:`程序从上往下执行：print 在第二行，那时 cups 还没改成 3。`}],tip:`程序从上往下执行，print 显示的是那一刻的值。`},{type:`order`,prompt:`排好顺序，让屏幕先显示改单前的 2，再显示改单后的 3`,lines:[`cups = 2`,`print(cups)`,`cups = 3`,`print(cups)`],shuffled:[2,3,0,1],answers:[[0,1,2,3]],expected:`2
3`,hint:`先存 2 并显示，再改成 3 并显示。`},{type:`fill`,prompt:`顾客最后改成了 5 杯。补全程序。`,code:`cups = 3
cups = {0}
print(cups)`,tokens:[`5`,`2`,`cups`],answer:[`5`],expected:`5`,why:{2:`2 是更早的旧数字，顾客要的是 5 杯。`,cups:`cups = cups 不会改变任何值，还是 3。`},hint:`把新的杯数存进 cups。`}]},{id:`U1L4`,title:`算价格`,concept:`加减乘除`,story:`珍珠奶茶 15 元一杯。让程序帮店员算钱。`,introCode:`print(15 * 3)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print(15 * 3)`,options:[{text:`45`,correct:!0,why:`15 × 3 = 45。`},{text:`15 * 3`,correct:!1,why:`没有引号，Python 会把它当算式算出结果。`},{text:`153`,correct:!1,why:`* 是乘号，不是把数字拼在一起。`}],tip:`+ 加，- 减，* 乘，/ 除。乘号是 *，不是 ×。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print(15 * 2 + 5)`,options:[{text:`35`,correct:!0,why:`先算 15 * 2 = 30，再加 5。`},{text:`105`,correct:!1,why:`和数学一样先乘除后加减：先算 15 * 2，不是先算 2 + 5。`}],tip:`和数学一样：先乘除，后加减；括号里的先算。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print(30 / 2)`,options:[{text:`15.0`,correct:!0,why:`用 / 做除法，结果总是带小数点。`},{text:`15`,correct:!1,why:`用 / 除，结果总带小数点，所以是 15.0。`}],tip:`用 / 做除法，结果总是带小数点，即使能整除。`},{type:`fill`,prompt:`3 杯一共 45 元。补全运算符。`,code:`print(15 {0} 3)`,tokens:[`*`,`+`,`x`],answer:[`*`],expected:`45`,why:{"+":`15 + 3 = 18，这是加法。`,x:`乘号是 *，不是字母 x。`},hint:`一杯 15 元，3 杯是乘法。`}]},{id:`U1L5`,title:`加一杯`,concept:`变量参与计算`,story:`把单价和杯数存进变量，程序就能自己算总价。顾客还想再加一杯。`,introCode:`price = 15
cups = 3
print(price * cups)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`price = 15
cups = 3
print(price * cups)`,options:[{text:`45`,correct:!0,why:`price * cups 就是 15 * 3。`},{text:`price * cups`,correct:!1,why:`没有引号，Python 会用变量里的值算出结果。`},{text:`153`,correct:!1,why:`* 是乘号，不是把数字拼在一起。`}],tip:`变量也能参与计算：Python 会先取出变量里的值再算。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = 3
cups = cups + 1
print(cups)`,options:[{text:`4`,correct:!0,why:`先算右边 3 + 1 = 4，再存回 cups。`},{text:`3`,correct:!1,why:`第二行已经把 cups 加了 1。`},{text:`1`,correct:!1,why:`cups + 1 是在旧值 3 的基础上加 1。`}],tip:`cups = cups + 1：先算右边（旧值加 1），再把结果存回 cups。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = 4
print("杯数", cups)`,options:[{text:`杯数 4`,correct:!0,why:`逗号隔开的两个值，显示时中间自动加一个空格。`},{text:`杯数4`,correct:!1,why:`用逗号隔开的值之间会自动加一个空格。`},{text:`杯数, 4`,correct:!1,why:`逗号是用来分隔的，不会显示出来。`}],tip:`print 里用逗号隔开多个值，显示时中间会加一个空格。`},{type:`fill`,prompt:`用单价和杯数两个变量计算总价，补全程序。`,code:`price = 15
cups = 4
print("总价", {0})`,tokens:[`price * cups`,`price - cups`,`price + cups`],answer:[`price * cups`],expected:`总价 60`,why:{"price - cups":`单价减杯数，得到 11。`,"price + cups":`15 + 4 = 19，这是加法。`},hint:`总价 = 单价 × 杯数。`}]},{id:`U1L6`,title:`结账小票`,concept:`单元复习`,review:!0,story:`最后一关：把学过的连起来，做一张结账小票。`,introCode:`price = 15
cups = 2
print("总价", price * cups)`,exercises:[{type:`order`,prompt:`排好顺序，让小票显示：总价 30`,lines:[`price = 15`,`cups = 2`,`print("总价", price * cups)`],shuffled:[2,1,0],answers:[[0,1,2],[1,0,2]],expected:`总价 30`,hint:`变量要先存好值，才能拿来算。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`name = "小林"
name = "阿杰"
print("顾客", name)`,options:[{text:`顾客 阿杰`,correct:!0,why:`第二行把名字换成了阿杰。`},{text:`顾客 小林`,correct:!1,why:`第二行已经把 name 换成了阿杰。`},{text:`顾客 name`,correct:!1,why:`name 没有引号，显示的是变量里存的值。`}]},{type:`fill`,prompt:`顾客又加了一杯，屏幕应该显示 3`,code:`cups = 2
cups = cups {0} 1
print(cups)`,tokens:[`+`,`-`,`*`],answer:[`+`],expected:`3`,why:{"-":`2 - 1 = 1，杯数变少了。`,"*":`2 * 1 = 2，没有变化。`},hint:`加一杯，用加号。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print(45 / 2)`,options:[{text:`22.5`,correct:!0,why:`45 ÷ 2 = 22.5。`},{text:`22`,correct:!1,why:`/ 不会去掉小数部分。`},{text:`22.0`,correct:!1,why:`45 ÷ 2 是 22.5，不是整数。`}]}]}]},s={id:`U2`,title:`文字与长度`,subtitle:`字符串、len`,lessons:[{id:`U2L1`,title:`保存饮品名`,concept:`字符串`,story:`菜单上要显示饮品的名字。一段文字在 Python 里叫「字符串」，可以存进变量，和数字一样。`,introCode:`drink = "珍珠奶茶"
print(drink)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`drink = "珍珠奶茶"
print(drink)`,options:[{text:`珍珠奶茶`,correct:!0,why:`drink 里存着字符串「珍珠奶茶」，print(drink) 显示变量里存的内容。`},{text:`drink`,correct:!1,why:`print(drink) 里 drink 没有加引号，它是变量名，显示的是它存的值。`},{text:`"珍珠奶茶"`,correct:!1,why:`引号只是告诉 Python「这是文字」，引号本身不会显示出来。`}],tip:`文字叫字符串，值要放在英文引号里；变量名不加引号。`},{type:`fill`,prompt:`把饮品名存进变量 drink，屏幕要显示：芋泥奶茶`,code:`drink = {0}
print(drink)`,tokens:[`"芋泥奶茶"`,`芋泥奶茶`,`"drink"`],answer:[`"芋泥奶茶"`],expected:`芋泥奶茶`,why:{芋泥奶茶:`文字没加引号，Python 会把它当成变量名去找，找不到就出错。`,'"drink"':`这样存进去的是文字 drink，屏幕会显示 drink，不是芋泥奶茶。`},hint:`文字（字符串）要放在英文引号里。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print(15)
print("15")`,options:[{text:`15
15`,correct:!0,why:`两行看起来一样：引号不会显示出来。但没加引号的 15 是数字，加了引号的 "15" 是文字，Python 把它们当成不同的东西。`},{text:`15
"15"`,correct:!1,why:`引号只是标记「这是文字」，不会显示出来。`},{text:`15`,correct:!1,why:`有两个 print，每个 print 单独显示一行，所以是两行。`}],tip:`数字不加引号；加了引号的 15 是文字，不是数字。屏幕上看起来一样，下一关就能看出区别。`},{type:`order`,prompt:`排好顺序，让屏幕先显示珍珠奶茶，再显示芋泥奶茶`,lines:[`drink = "珍珠奶茶"`,`print(drink)`,`drink = "芋泥奶茶"`,`print(drink)`],shuffled:[2,3,0,1],answers:[[0,1,2,3]],expected:`珍珠奶茶
芋泥奶茶`,hint:`先存珍珠奶茶并显示，再换成芋泥奶茶并显示。`}]},{id:`U2L2`,title:`拼出菜单文字`,concept:`字符串拼接`,story:`菜单要把「口味」和「奶茶」拼成完整的名字。文字也可以用 + 连起来。`,introCode:`drink = "芋泥"
print(drink + "奶茶")`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`drink = "芋泥"
print(drink + "奶茶")`,options:[{text:`芋泥奶茶`,correct:!0,why:`+ 把两段文字直接连在一起：芋泥 + 奶茶 = 芋泥奶茶。`},{text:`芋泥 奶茶`,correct:!1,why:`+ 不会自动加空格。想要空格，得自己写在字符串里。`},{text:`drink奶茶`,correct:!1,why:`drink 没有加引号，是变量，显示的是它存的「芋泥」，不是 drink 这个词。`}],tip:`文字用 + 是「拼起来」，不会自动加空格。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print("15" + "5")`,options:[{text:`155`,correct:!0,why:`"15" 和 "5" 加了引号，是文字。文字用 + 是连在一起，不是加法。`},{text:`20`,correct:!1,why:`只有没加引号的数字才会相加：15 + 5 才是 20。`},{text:`15 5`,correct:!1,why:`+ 不会自动加空格，两段文字直接连在一起。`}],tip:`数字用 + 是加法，文字用 + 是拼接。`},{type:`fill`,prompt:`屏幕要显示：黑糖 珍珠（中间有一个空格）`,code:`print("黑糖" + {0} + "珍珠")`,tokens:[`" "`,`""`,`"空格"`],answer:[`" "`],expected:`黑糖 珍珠`,why:{'""':`引号里什么都没有，等于没有加空格，会显示「黑糖珍珠」。`,'"空格"':`这样拼进去的是「空格」两个字，会显示「黑糖空格珍珠」。`},hint:`空格也是一个字符，要写在引号里。`},{type:`order`,prompt:`排好顺序，让屏幕显示：草莓奶茶`,lines:[`flavor = "草莓"`,`name = "奶茶"`,`drink = flavor + name`,`print(drink)`],shuffled:[3,2,1,0],answers:[[0,1,2,3],[1,0,2,3]],expected:`草莓奶茶`,hint:`变量要先存好文字，才能拿来拼；拼好之后再显示。`}]},{id:`U2L3`,title:`名字有多长`,concept:`len 长度`,story:`标签纸的宽度有限，要先知道名字有几个字。Python 用 len 来数，它来自英文单词 length（长度）。`,introCode:`print(len("珍珠奶茶"))`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print(len("珍珠奶茶"))`,options:[{text:`4`,correct:!0,why:`len 数的是字符的个数：珍、珠、奶、茶，一共 4 个。`},{text:`珍珠奶茶`,correct:!1,why:`len 返回的是个数（一个数字），不是文字本身。`},{text:`6`,correct:!1,why:`引号只是标记，不算在长度里。`}],tip:`len(...) 数括号里的字符有几个。引号不计入。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print(len("latte"))`,options:[{text:`5`,correct:!0,why:`l、a、t、t、e，每个英文字母算一个字符。`},{text:`1`,correct:!1,why:`len 数的是字符，不是单词；latte 虽然是一个单词，但有 5 个字母。`},{text:`7`,correct:!1,why:`引号不算在长度里。`}],tip:`每个汉字、每个字母、每个数字都算一个字符。`},{type:`fill`,prompt:`屏幕要显示「抹茶拿铁」有几个字`,code:`print({0}("抹茶拿铁"))`,tokens:[`len`,`length`,`Len`],answer:[`len`],expected:`4`,why:{length:`Python 里的函数名是缩写 len，不是完整的 length，写 length 会出错。`,Len:`大小写不同就是不同的名字，Python 里是小写 len，写 Len 会出错。`},hint:`名字是 len，全小写。`},{type:`order`,prompt:`排好顺序，让屏幕显示：新品、2、柠檬茶、3`,lines:[`print("新品")`,`print(len("新品"))`,`print("柠檬茶")`,`print(len("柠檬茶"))`],shuffled:[3,0,2,1],answers:[[0,1,2,3]],expected:`新品
2
柠檬茶
3`,hint:`屏幕上从上往下显示，就把要先显示的行放在上面。`}]},{id:`U2L4`,title:`空格也算一个`,concept:`len 数什么`,story:`标签上有空格、数字和标点吗？它们也都算一个字符。len 也可以数变量里存的文字。`,introCode:`name = "milk tea"
print(len(name))`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`name = "milk tea"
print(len(name))`,options:[{text:`8`,correct:!0,why:`milk 4 个字母 + 1 个空格 + tea 3 个字母 = 8。空格也算一个字符。`},{text:`7`,correct:!1,why:`中间的空格也算一个字符，要数进去。`},{text:`2`,correct:!1,why:`len 数的是字符，不是单词的个数。`}],tip:`len(name) 数的是变量 name 里存的文字。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print(len("第1杯！"))`,options:[{text:`4`,correct:!0,why:`第、1、杯、！ 各算一个字符：数字字符和标点也算。`},{text:`3`,correct:!1,why:`感叹号 ！也是一个字符，也要数进去。`},{text:`6`,correct:!1,why:`引号只是标记，不算在长度里。`}],tip:`数字字符、标点、空格都算一个字符。`},{type:`fill`,prompt:`屏幕要显示 3。哪一个能做到？`,code:`print(len({0}))`,tokens:[`"15杯"`,`"15 杯"`,`15`],answer:[`"15杯"`],expected:`3`,why:{'"15 杯"':`中间有一个空格，空格也算一个字符，长度是 4。`,15:`没有引号的 15 是数字，len 只能数文字，会出错。`},hint:`引号里的每个字符都算一个：1、5、杯。`},{type:`order`,prompt:`排好顺序，让屏幕先显示 milk tea，再显示它的长度`,lines:[`name = "milk tea"`,`print(name)`,`print(len(name))`],shuffled:[2,0,1],answers:[[0,1,2]],expected:`milk tea
8`,hint:`变量要先存好文字，才能显示和数长度。`}]},{id:`U2L5`,title:`菜单标签`,concept:`单元复习`,review:!0,story:`最后一关：把学过的连起来，做一张菜单标签。`,introCode:`label = "新品："
label = label + "芋泥奶茶"
print(label)
print(len(label))`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`label = "新品："
print(label + "芋泥奶茶")`,options:[{text:`新品：芋泥奶茶`,correct:!0,why:`label 里存着「新品：」，+ 把它和「芋泥奶茶」连在一起再显示。`},{text:`新品： 芋泥奶茶`,correct:!1,why:`+ 不会自动加空格。`},{text:`新品：`,correct:!1,why:`print 里是 label + "芋泥奶茶"，拼好之后一起显示，不是只显示 label。`}]},{type:`fill`,prompt:`标签要显示长度 7。补全程序。`,code:`label = "新品："
label = {0} + "芋泥奶茶"
print(len(label))`,tokens:[`label`,`"label"`,`""`],answer:[`label`],expected:`7`,why:{'"label"':`加了引号，拼的是文字 label（5 个字符），长度是 9，不是 7。`,'""':`引号里什么都没有，原来的「新品：」就丢了，长度只剩 4。`},hint:`要把变量里原来的文字接上去，变量名不加引号。`},{type:`order`,prompt:`排好顺序，让屏幕显示：新品：芋泥奶茶，然后是它的长度 7`,lines:[`label = "新品："`,`label = label + "芋泥奶茶"`,`print(label)`,`print(len(label))`],shuffled:[3,1,0,2],answers:[[0,1,2,3]],expected:`新品：芋泥奶茶
7`,hint:`先存「新品：」，再接上芋泥奶茶，最后先显示文字、再显示长度。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`size = "大杯"
drink = "珍珠奶茶"
label = drink + " " + size
print(label)
print(len(label))`,options:[{text:`珍珠奶茶 大杯
7`,correct:!0,why:`引号里的空格被拼进去，显示时有空格；长度是 4 + 1 + 2 = 7。`},{text:`珍珠奶茶 大杯
6`,correct:!1,why:`空格也算一个字符，长度是 4 + 1 + 2 = 7。`},{text:`珍珠奶茶大杯
7`,correct:!1,why:`拼接时中间写了一个 " "，所以显示的文字里有空格。`}]}]}]},c={id:`U3`,title:`比较与判断`,subtitle:`比较、if/else/elif、and/or/not`,lessons:[{id:`U3L1`,title:`满不满 100 元`,concept:`比较大小`,story:`店里搞活动：满 100 元有优惠。程序要先判断“够不够”。比较两个数，结果只有两种：True（成立）或 False（不成立）。> 读作“大于”，< 读作“小于”。`,introCode:`total = 120
print(total > 100)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`total = 80
print(total < 100)`,options:[{text:`True`,correct:!0,why:`80 小于 100，比较成立，结果是 True。`},{text:`80`,correct:!1,why:`比较的结果不是数字，而是 True 或 False。`},{text:`False`,correct:!1,why:`< 是“小于”：80 < 100 成立，所以是 True。`}],tip:`比较的结果只有 True 或 False，首字母大写，不加引号。< 读作“小于”。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print(100 >= 100)
print(100 > 100)`,options:[{text:`True
False`,correct:!0,why:`>= 是“大于或等于”，100 等于 100，成立；> 只算“大于”，100 不大于自己。`},{text:`True
True`,correct:!1,why:`> 不包含相等：100 > 100 是 False。`},{text:`False
False`,correct:!1,why:`>= 包含相等，100 >= 100 是 True。`}],tip:`>= 读作“大于或等于”，<= 读作“小于或等于”。`},{type:`fill`,prompt:`买满 3 杯（正好 3 杯也算）就显示 True，补全比较符号。`,code:`cups = 3
print(cups {0} 3)`,tokens:[`>=`,`=>`,`>`],answer:[`>=`],expected:`True`,why:{"=>":`Python 里没有 =>，要写成 >=：大于号在前，等号在后。`,">":`3 > 3 不成立，> 不包含正好相等的情况。`},hint:`“正好 3 杯也算”要用包含相等的比较符号，大于号写在前面。`},{type:`order`,prompt:`排好顺序，让屏幕先显示总价，再显示是否满 100 元：
120
True`,lines:[`total = 120`,`print(total)`,`print(total >= 100)`],shuffled:[2,0,1],answers:[[0,1,2]],expected:`120
True`,hint:`变量要先存好值；先显示总价，再显示比较结果。`}]},{id:`U3L2`,title:`是不是大杯`,concept:`等于和不等于`,story:`要判断顾客点的是不是大杯。比较“是否相等”用两个等号 ==；“不相等”用 !=。一个等号 = 是把值存进变量，不是比较。文字要一模一样才相等，连大小写也要一样："vip" 和 "VIP" 不相等。`,introCode:`size = "大杯"
print(size == "大杯")`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = 2
print(cups == 2)
print(cups != 2)`,options:[{text:`True
False`,correct:!0,why:`cups 是 2：== 2 成立；!= 2（不等于 2）不成立。`},{text:`2
False`,correct:!1,why:`== 是比较，不是存值，结果是 True 或 False，不会显示 2。`},{text:`True
True`,correct:!1,why:`!= 的意思是“不等于”，cups 正好等于 2，所以是 False。`}],tip:`== 比较是否相等；!= 比较是否不相等。`},{type:`fill`,prompt:`判断顾客点的是不是大杯，屏幕要显示 True。`,code:`size = "大杯"
print(size {0} "大杯")`,tokens:[`==`,`=`,`!=`],answer:[`==`],expected:`True`,why:{"=":`一个等号是存值，不能用来比较，这里会报错。比较相等要用两个等号 ==。`,"!=":`!= 是“不等于”，大杯等于大杯，结果是 False。`},hint:`比较“是否相等”要用两个等号。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print("15" == 15)`,options:[{text:`False`,correct:!0,why:`加了引号的 "15" 是文字，15 是数字，类型不同，不相等。`},{text:`True`,correct:!1,why:`看起来一样，但文字 "15" 和数字 15 是不同的东西，所以不相等。`},{text:`15`,correct:!1,why:`== 的结果是 True 或 False，不会显示 15。`}],tip:`回想第 2 单元：加引号的是文字（字符串），不加引号的是数字。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = 2
cups == 3
print(cups)`,options:[{text:`2`,correct:!0,why:`cups == 3 只是做了一次比较，结果不会改掉 cups，也不会自己显示出来；cups 还是 2，print(cups) 显示 2。`},{text:`3`,correct:!1,why:`== 是比较，不是存值：cups 里存的还是 2。要存值才用一个等号 =。`},{text:`False`,correct:!1,why:`单独写一行 cups == 3 并不会自动显示结果；只有 print(...) 才会显示，这里 print 的是 cups。`}],tip:`比较不会改掉变量，单独写一行比较也不会显示结果。`}]},{id:`U3L3`,title:`记住是不是会员`,concept:`布尔值存进变量`,story:`True 和 False 叫“布尔值”。比较的结果可以存进变量，以后直接用。注意：True 不加引号，加了引号就变成文字了。`,introCode:`total = 150
big = total >= 100
print(big)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`total = 150
big = total >= 100
print(big)`,options:[{text:`True`,correct:!0,why:`big 里存的是比较的结果：150 >= 100 成立，所以是 True。`},{text:`total >= 100`,correct:!1,why:`变量存的是比较算出来的结果，不是这段文字。`},{text:`150`,correct:!1,why:`big 存的是比较结果，不是 total 的值。`}],tip:`先算等号右边的比较，再把结果（True/False）存进左边的变量。`},{type:`fill`,prompt:`顾客是会员。把真正的布尔值存进 is_vip，屏幕要显示 True。`,code:`is_vip = {0}
print(is_vip == True)`,tokens:[`True`,`"True"`,`true`],answer:[`True`],expected:`True`,why:{'"True"':`加了引号是文字 "True"，和布尔值 True 不相等，结果是 False。`,true:`Python 区分大小写，布尔值要写成首字母大写的 True；小写的 true 会报错。`},hint:`布尔值首字母大写，不加引号。`},{type:`order`,prompt:`排好顺序：先存杯数，再把“是否买了 3 杯以上”存进 many，最后显示它。屏幕显示：True`,lines:[`cups = 4`,`many = cups >= 3`,`print(many)`],shuffled:[1,2,0],answers:[[0,1,2]],expected:`True`,hint:`用到的变量必须先存好：先有 cups，才能算 many；先有 many，才能显示。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`is_vip = "True"
print(is_vip == True)`,options:[{text:`False`,correct:!0,why:`is_vip 存的是文字 "True"（有引号），不是布尔值 True，两者不相等。`},{text:`True`,correct:!1,why:`看起来一样，但加了引号就是文字，和布尔值 True 不是同一个东西。`}],tip:`"True" 是文字，True 是布尔值。`}]},{id:`U3L4`,title:`满 100 才减`,concept:`if 和缩进`,story:`if 让程序“条件成立才做”。if 后面写条件，行末要有英文冒号 :，下面要做的事往里缩进 4 个空格。没有缩进的行不属于 if，无论条件如何都会执行。`,introCode:`total = 120
if total >= 100:
    print("满减 20 元")
print("谢谢光临")`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`total = 80
if total >= 100:
    print("满减 20 元")
print("谢谢光临")`,options:[{text:`谢谢光临`,correct:!0,why:`80 >= 100 不成立，缩进的那行被跳过；最后一行没有缩进，不属于 if，照常执行。`},{text:`满减 20 元
谢谢光临`,correct:!1,why:`条件不成立时，if 里缩进的行不会执行。`},{text:`（什么也不显示）`,correct:!1,why:`print("谢谢光临") 没有缩进，不属于 if，一定会执行。`}],tip:`缩进的行属于 if；没缩进的行和 if 无关。`},{type:`order`,prompt:`排好顺序：满 100 元时显示满减，最后一定显示谢谢光临。屏幕显示：
满减 20 元
谢谢光临`,lines:[`total = 150`,`if total >= 100:`,`    print("满减 20 元")`,`print("谢谢光临")`],shuffled:[3,2,0,1],answers:[[0,1,2,3]],expected:`满减 20 元
谢谢光临`,hint:`先存总价；缩进的那行要紧跟在 if 下面；不缩进的谢谢光临放最后。`},{type:`fill`,prompt:`买满 3 杯送一张优惠券，补全 if 这一行。屏幕要显示：送一张优惠券`,code:`cups = 3
if cups >= 3{0}
    print("送一张优惠券")`,tokens:[`:`,`：`,`;`],answer:[`:`],expected:`送一张优惠券`,why:{"：":`这是中文冒号。Python 只认英文冒号 :，会报语法错误。`,";":`if 行的末尾要写冒号 :，不是分号。`},hint:`if 这一行最后要写英文冒号。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = 1
if cups >= 3:
    print("送一张优惠券")
    print("优惠券已发放")
print("下单完成")`,options:[{text:`下单完成`,correct:!0,why:`1 >= 3 不成立，缩进的两行都属于 if，都被跳过；只有没缩进的最后一行执行。`},{text:`优惠券已发放
下单完成`,correct:!1,why:`第二个 print 也缩进了，同样属于 if，条件不成立就不执行。`},{text:`送一张优惠券
优惠券已发放
下单完成`,correct:!1,why:`cups 是 1，不满 3 杯，if 里的内容不执行。`}],tip:`if 下面所有缩进相同的行，都属于这个 if。`}]},{id:`U3L5`,title:`不满就提示差多少`,concept:`else 二选一`,story:`if 条件不成立时，可以用 else 做另一件事：两条路只走一条。else 后面不写条件，直接写英文冒号；else 下面要做的事同样缩进 4 格。`,introCode:`total = 80
if total >= 100:
    print("满减 20 元")
else:
    print("还差", 100 - total, "元")`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`total = 80
if total >= 100:
    print("满减 20 元")
else:
    print("还差", 100 - total, "元")`,options:[{text:`还差 20 元`,correct:!0,why:`80 >= 100 不成立，跳过 if 里的行，走 else 那条路。`},{text:`满减 20 元
还差 20 元`,correct:!1,why:`if 和 else 只会走一条，不会两边都执行。`},{text:`满减 20 元`,correct:!1,why:`条件不成立，if 里的行不执行。`}],tip:`if 成立走 if，不成立走 else，只走一条。`},{type:`fill`,prompt:`补全 else 这一行。顾客只买了 1 杯，屏幕要显示：不送券`,code:`cups = 1
if cups >= 3:
    print("送券")
else{0}
    print("不送券")`,tokens:[`:`,` cups < 3:`,`：`],answer:[`:`],expected:`不送券`,why:{" cups < 3:":`else 后面不写条件：if 不成立的情况全都归 else。写了条件会报语法错误。`,"：":`这是中文冒号，Python 只认英文冒号 :。`},hint:`else 后面直接写英文冒号，不写条件。`},{type:`order`,prompt:`排好顺序：会员显示会员价，不是会员显示原价。屏幕显示：会员价`,lines:[`is_vip = True`,`if is_vip:`,`    print("会员价")`,`else:`,`    print("原价")`],shuffled:[3,4,1,0,2],answers:[[0,1,2,3,4]],expected:`会员价`,hint:`先存好 is_vip；if 下面紧跟它缩进的行，再写 else 和它缩进的行。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`total = 150
if total >= 100:
    print("满减 20 元")
else:
    print("不满减")
print("谢谢光临")`,options:[{text:`满减 20 元
谢谢光临`,correct:!0,why:`走 if 这条路；最后一行没有缩进，不属于 else，一定执行。`},{text:`满减 20 元`,correct:!1,why:`print("谢谢光临") 没缩进，不属于 else，照常执行。`},{text:`满减 20 元
不满减
谢谢光临`,correct:!1,why:`else 里缩进的行只有条件不成立时才执行。`}],tip:`看缩进：缩进的行属于上面的 if 或 else，没缩进的行谁都不属于。`}],pending:[{type:`modify`,replaces:4,status:`待 Claude 的代码题运行器，暂不开放`,plan:`改一改：把 else 写成 else total < 100: 的程序改正确`,task:{id:`U3L5-M1`,version:1,type:`modify`,prompt:`这段程序想做到：满 100 元显示“满减 20 元”，不满就显示还差多少。它运行会报错，请改正。`,given:[`total`],checkMode:`output`,code:`if total >= 100:
    print("满减 20 元")
else total < 100:
    print("还差", 100 - total, "元")
`,tests:[{name:`满 100`,data:{total:120},expected:`满减 20 元`},{name:`不满 100`,data:{total:80},expected:`还差 20 元`},{name:`正好 100`,data:{total:100},expected:`满减 20 元`,hidden:!0},{name:`差 1 元`,data:{total:99},expected:`还差 1 元`,hidden:!0}],hints:[`看 else 那一行：else 后面能写条件吗？`,`else 后面直接写英文冒号：把 else total < 100: 改成 else:`],reference:`if total >= 100:
    print("满减 20 元")
else:
    print("还差", 100 - total, "元")
`,worked:{code:`cups = 1
if cups >= 3:
    print("送券")
else:
    print("不送券")`,output:`不送券`,explain:`if 不成立的情况全归 else，else 后面不写条件，只写冒号。`},requiresVariationAfterSolution:!0,variation:{id:`U3L5-M1-V1`,prompt:`满 50 元显示“送小料”，不满就显示还差多少。`,starter:`# total 已经准备好
`,tests:[{name:`60 元`,data:{total:60},expected:`送小料`},{name:`30 元`,data:{total:30},expected:`还差 20 元`},{name:`80 元`,data:{total:80},expected:`送小料`,hidden:!0},{name:`49 元`,data:{total:49},expected:`还差 1 元`,hidden:!0}],hints:[`if total >= 50: 下面显示送小料；其余交给 else。`,`else: 下面 print("还差", 50 - total, "元")。`],solution:`if total >= 50:
    print("送小料")
else:
    print("还差", 50 - total, "元")
`}}}]},{id:`U3L6`,title:`满多少减多少`,concept:`elif 多分支`,story:`有好几档优惠时，用 elif（意思是“否则如果”）。Python 从上往下检查，遇到第一个成立的条件就执行它，后面的都跳过。所以要把更严格的条件（比如 >= 100）放在前面。`,introCode:`total = 120
if total >= 100:
    print("减 20")
elif total >= 50:
    print("减 5")
else:
    print("不减")`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`total = 120
if total >= 100:
    print("减 20")
elif total >= 50:
    print("减 5")
else:
    print("不减")`,options:[{text:`减 20`,correct:!0,why:`120 >= 100 成立，执行第一档；后面的 elif 和 else 都跳过。`},{text:`减 20
减 5`,correct:!1,why:`120 也 >= 50，但前面已经有成立的条件，elif 不再检查。只走一条。`},{text:`减 5`,correct:!1,why:`从上往下检查，第一个条件已经成立。`}],tip:`if / elif / else 从上往下，只执行第一个成立的。`},{type:`order`,prompt:`排好顺序：60 元满 50，屏幕显示：减 5`,lines:[`total = 60`,`if total >= 100:`,`    print("减 20")`,`elif total >= 50:`,`    print("减 5")`],shuffled:[4,3,0,2,1],answers:[[0,1,2,3,4]],expected:`减 5`,hint:`先存总价；if 在前，elif 在后，每个条件下面紧跟缩进的那行。`},{type:`fill`,prompt:`规则：满 100 减 20，满 50 减 5。顾客买了 60 元，补全两个数字，让屏幕显示：减 5`,code:`total = 60
if total >= {0}:
    print("减 20")
elif total >= {1}:
    print("减 5")`,tokens:[`100`,`50`],answer:[`100`,`50`],expected:`减 5`,why:{50:`如果先检查 >= 50，60 元会先命中“减 20”那一档。严格的条件要放前面。`},hint:`从上往下只走第一个成立的：门槛高的放前面。`},{type:`fill`,prompt:`满 200 减 50，满 100 减 20（只减一档）。顾客买了 150 元，补全两个数字，屏幕要显示：应付 130`,code:`total = 150
pay = total
if total >= {0}:
    pay = pay - 50
elif total >= {1}:
    pay = pay - 20
print("应付", pay)`,tokens:[`200`,`100`],answer:[`200`,`100`],expected:`应付 130`,why:{100:`门槛顺序反了：150 元会先命中“减 50”那一档（150 >= 100），多减了钱。门槛高的要放前面。`},hint:`elif 从上往下只走一个：门槛高的放前面。`}],pending:[{type:`modify`,replaces:3,status:`待 Claude 的代码题运行器，暂不开放`,plan:`改一改：把 >=50 写在 >=100 前面的程序改对`,task:{id:`U3L6-M1`,version:1,type:`modify`,prompt:`规则：满 100 减 20，满 50 减 5，其余不减。这段程序买 120 元时显示“减 5”，不对。请改正。`,given:[`total`],checkMode:`output`,code:`if total >= 50:
    print("减 5")
elif total >= 100:
    print("减 20")
else:
    print("不减")
`,tests:[{name:`120 元`,data:{total:120},expected:`减 20`},{name:`60 元`,data:{total:60},expected:`减 5`},{name:`30 元`,data:{total:30},expected:`不减`},{name:`正好 100`,data:{total:100},expected:`减 20`,hidden:!0},{name:`正好 50`,data:{total:50},expected:`减 5`,hidden:!0}],hints:[`从上往下只走第一个成立的条件。120 元先碰到哪个条件？`,`把门槛高的 total >= 100 放在最前面，total >= 50 放到 elif。`],reference:`if total >= 100:
    print("减 20")
elif total >= 50:
    print("减 5")
else:
    print("不减")
`,worked:{code:`total = 60
if total >= 100:
    print("减 20")
elif total >= 50:
    print("减 5")`,output:`减 5`,explain:`从上往下检查，门槛高的放前面；遇到第一个成立的就停。`},requiresVariationAfterSolution:!0,variation:{id:`U3L6-M1-V1`,prompt:`规则：满 200 减 50，满 100 减 15，其余不减。`,starter:`# total 已经准备好
`,tests:[{name:`250 元`,data:{total:250},expected:`减 50`},{name:`120 元`,data:{total:120},expected:`减 15`},{name:`80 元`,data:{total:80},expected:`不减`,hidden:!0},{name:`正好 200`,data:{total:200},expected:`减 50`,hidden:!0}],hints:[`门槛高的放前面。`,`if total >= 200 / elif total >= 100 / else。`],solution:`if total >= 200:
    print("减 50")
elif total >= 100:
    print("减 15")
else:
    print("不减")
`}}}]},{id:`U3L7`,title:`会员或满额送赠品`,concept:`and / or / not`,story:`把几个条件组合起来：and 是“两个都成立才成立”；or 是“有一个成立就成立”；not 把 True 变 False、False 变 True。每个比较都要写完整：cups > 3 and cups < 10，不能写成 cups > 3 and < 10。`,introCode:`total = 120
is_vip = False
print(total >= 100 and is_vip)
print(total >= 100 or is_vip)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`total = 120
is_vip = False
print(total >= 100 and is_vip)
print(total >= 100 or is_vip)`,options:[{text:`False
True`,correct:!0,why:`and 要两个都成立，is_vip 是 False，所以 False；or 有一个成立就行，所以 True。`},{text:`True
True`,correct:!1,why:`and 要求两个条件都成立，is_vip 是 False。`},{text:`False
False`,correct:!1,why:`or 只要一个成立：120 >= 100 成立。`}],tip:`and：都要；or：有一个就行。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`is_vip = True
print(not is_vip)`,options:[{text:`False`,correct:!0,why:`not 把 True 变成 False。`},{text:`True`,correct:!1,why:`not 会反过来：True 变 False。`},{text:`not True`,correct:!1,why:`not 会被计算，显示的是结果，不是这段文字。`}],tip:`not 读作“不是”。`},{type:`fill`,prompt:`杯数在 3 到 10 之间（不含两端）才显示 True。补全条件。`,code:`cups = 5
print(cups > 3 and {0} 10)`,tokens:[`cups <`,`<`,`cups >`],answer:[`cups <`],expected:`True`,why:{"<":`and 两边要各是完整的比较，不能省掉 cups。会报语法错误。`,"cups >":`5 > 10 不成立，结果是 False。`},hint:`and 后面也要写完整：变量、符号、数字。`},{type:`fill`,prompt:`会员或者满 100 元，都能拿赠品。顾客不是会员但买了 120 元，屏幕要显示：有赠品`,code:`is_vip = False
total = 120
if is_vip {0} total >= 100:
    print("有赠品")
else:
    print("没有赠品")`,tokens:[`or`,`and`],answer:[`or`],expected:`有赠品`,why:{and:`and 要两个都成立；这位顾客不是会员，结果是没有赠品。“或者”要用 or。`},hint:`“有一个成立就行”用哪个词？`}],pending:[{type:`modify`,replaces:4,status:`待 Claude 的代码题运行器，暂不开放`,plan:`改一改：把 cups > 3 and < 10 改成完整条件`,task:{id:`U3L7-M1`,version:1,type:`modify`,prompt:`杯数大于 3 且小于 10 时显示“团购价”，否则显示“原价”。这段程序会报错，请改正。`,given:[`cups`],checkMode:`output`,code:`if cups > 3 and < 10:
    print("团购价")
else:
    print("原价")
`,tests:[{name:`5 杯`,data:{cups:5},expected:`团购价`},{name:`3 杯`,data:{cups:3},expected:`原价`},{name:`10 杯`,data:{cups:10},expected:`原价`},{name:`4 杯`,data:{cups:4},expected:`团购价`,hidden:!0},{name:`9 杯`,data:{cups:9},expected:`团购价`,hidden:!0}],hints:[`and 两边都要是完整的比较。`,`把 and < 10 写成 and cups < 10。`],reference:`if cups > 3 and cups < 10:
    print("团购价")
else:
    print("原价")
`,worked:{code:`cups = 5
print(cups > 3 and cups < 10)`,output:`True`,explain:`and 两边各写一个完整的比较：变量、符号、数字。`},requiresVariationAfterSolution:!0,variation:{id:`U3L7-M1-V1`,prompt:`杯数大于等于 5 且小于等于 20 时显示“团购价”，否则显示“原价”。`,starter:`# cups 已经准备好
`,tests:[{name:`10 杯`,data:{cups:10},expected:`团购价`},{name:`3 杯`,data:{cups:3},expected:`原价`},{name:`5 杯`,data:{cups:5},expected:`团购价`,hidden:!0},{name:`20 杯`,data:{cups:20},expected:`团购价`,hidden:!0},{name:`21 杯`,data:{cups:21},expected:`原价`,hidden:!0}],hints:[`“大于等于”和“小于等于”都包含边界。`,`if cups >= 5 and cups <= 20:`],solution:`if cups >= 5 and cups <= 20:
    print("团购价")
else:
    print("原价")
`}}}]},{id:`U3L8`,title:`项目：折扣检查`,concept:`if 套 if + 单元项目`,story:`先看一个新写法：if 里面还可以再写 if（if 套 if），先判断外层，成立了再判断里层，里层要再缩进 4 格。然后做单元项目：折扣检查器。规则：满 100 元（正好 100 也算）减 20；会员再减 5。程序用 pay 记住应付金额，一步步减。`,introCode:`total = 120
is_vip = True
pay = total
if total >= 100:
    pay = pay - 20
if is_vip:
    pay = pay - 5
print("应付", pay)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`total = 120
is_vip = False
if total >= 100:
    if is_vip:
        print("减 25")
    else:
        print("减 20")
else:
    print("不减")`,options:[{text:`减 20`,correct:!0,why:`外层：120 >= 100 成立，进入里面；里层：不是会员，走里面的 else。`},{text:`减 25`,correct:!1,why:`is_vip 是 False，里层的 if 不成立。`},{text:`不减`,correct:!1,why:`外层条件成立，最外面的 else 不执行。`}],tip:`if 套 if：先看外层，成立了再看里层。缩进越深，层越里面。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`total = 100
is_vip = False
pay = total
if total >= 100:
    pay = pay - 20
if is_vip:
    pay = pay - 5
print("应付", pay)`,options:[{text:`应付 80`,correct:!0,why:`正好 100：>= 包含相等，减 20；不是会员，不再减。`},{text:`应付 100`,correct:!1,why:`>= 100 包含正好 100，所以要减。`},{text:`应付 75`,correct:!1,why:`is_vip 是 False，会员那一步不执行。`}],tip:`边界值：正好 100 算不算，看用的是 > 还是 >=。`},{type:`order`,prompt:`排好顺序：会员正好买 100 元，算出要付多少。屏幕显示：应付 75`,lines:[`total = 100`,`is_vip = True`,`pay = total`,`if total >= 100:`,`    pay = pay - 20`,`if is_vip:`,`    pay = pay - 5`,`print("应付", pay)`],shuffled:[7,4,5,2,6,3,1,0],answers:[[0,1,2,3,4,5,6,7],[0,1,2,5,6,3,4,7],[0,2,1,3,4,5,6,7],[0,2,1,5,6,3,4,7],[0,2,3,4,1,5,6,7],[1,0,2,3,4,5,6,7],[1,0,2,5,6,3,4,7]],expected:`应付 75`,hint:`先有 total 才能算 pay；满减看的是原价 total；每个 if 下面紧跟它该做的那一行（满减减 20，会员减 5）。`,equivCases:[{total:80,is_vip:!0},{total:80,is_vip:!1},{total:99,is_vip:!0},{total:99,is_vip:!1},{total:100,is_vip:!0},{total:100,is_vip:!1},{total:104,is_vip:!0},{total:104,is_vip:!1},{total:120,is_vip:!0},{total:120,is_vip:!1},{total:150,is_vip:!0},{total:150,is_vip:!1}]},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`total = 80
is_vip = True
pay = total
if total >= 100:
    pay = pay - 20
if is_vip:
    pay = pay - 5
print("应付", pay)`,options:[{text:`应付 75`,correct:!0,why:`80 不满 100，不减 20；是会员，减 5。两个 if 是分开的，各自判断。`},{text:`应付 55`,correct:!1,why:`80 < 100，满减那步不执行。`},{text:`应付 80`,correct:!1,why:`两个 if 各自独立：第一个不成立，第二个仍会检查。`}],tip:`两个分开的 if 都会检查；if/elif 才是只走一个。`}],pending:[{type:`write`,replaces:4,keep:`第 2 题（边界值 100）保留`,status:`待 Claude 的代码题运行器，暂不开放`,plan:`写一写：已给 total、is_vip，输出 应付 <金额>。测试：(120, False)→应付 100；(120, True)→应付 95；(80, True)→应付 75；(100, False)→应付 80`,reference:`pay = total
if total >= 100:
    pay = pay - 20
if is_vip:
    pay = pay - 5
print("应付", pay)`,tests:[{data:{total:120,is_vip:!1},stdout:`应付 100`},{data:{total:120,is_vip:!0},stdout:`应付 95`},{data:{total:80,is_vip:!0},stdout:`应付 75`},{data:{total:100,is_vip:!1},stdout:`应付 80`}],task:{id:`U3L8-W1`,version:1,type:`write`,prompt:`写一个折扣检查器：满 100 元（正好 100 也算）减 20；会员再减 5。输出“应付 金额”。`,given:[`total`,`is_vip`],checkMode:`output`,starter:`# total（总价）和 is_vip（是不是会员，True/False）已经准备好
`,tests:[{name:`120 元，非会员`,data:{total:120,is_vip:!1},expected:`应付 100`},{name:`80 元，会员`,data:{total:80,is_vip:!0},expected:`应付 75`},{name:`120 元，会员`,data:{total:120,is_vip:!0},expected:`应付 95`,hidden:!0},{name:`正好 100，非会员`,data:{total:100,is_vip:!1},expected:`应付 80`,hidden:!0},{name:`99 元，会员`,data:{total:99,is_vip:!0},expected:`应付 94`,hidden:!0}],hints:[`先用 pay = total 记住应付金额，再分两步判断：满额、会员。`,`if total >= 100: 下面 pay = pay - 20；另起一个 if is_vip: 下面 pay = pay - 5；最后 print("应付", pay)。`],reference:`pay = total
if total >= 100:
    pay = pay - 20
if is_vip:
    pay = pay - 5
print("应付", pay)
`,worked:{code:`total = 100
is_vip = False
pay = total
if total >= 100:
    pay = pay - 20
if is_vip:
    pay = pay - 5
print("应付", pay)`,output:`应付 80`,explain:`本关第 2、3 题就是示范：两个独立的 if，满额看原价 total。`},requiresVariationAfterSolution:!0,variation:{id:`U3L8-W1-V1`,prompt:`满 150 元减 30；会员再减 10。输出“应付 金额”。`,starter:`# total、is_vip 已经准备好
`,tests:[{name:`160 元，非会员`,data:{total:160,is_vip:!1},expected:`应付 130`},{name:`90 元，会员`,data:{total:90,is_vip:!0},expected:`应付 80`},{name:`正好 150，会员`,data:{total:150,is_vip:!0},expected:`应付 110`,hidden:!0},{name:`120 元，非会员`,data:{total:120,is_vip:!1},expected:`应付 120`,hidden:!0}],hints:[`和父题一样两个独立的 if，只是门槛和金额变了。`,`pay = total / if total >= 150: pay = pay - 30 / if is_vip: pay = pay - 10。`],solution:`pay = total
if total >= 150:
    pay = pay - 30
if is_vip:
    pay = pay - 10
print("应付", pay)
`}}}]}]},l={id:`U4`,title:`重复`,subtitle:`for、range、while、break`,lessons:[{id:`U4L1`,title:`一次做好几杯`,concept:`for 重复同一件事`,story:`要重复做同一件事，不用把 print 抄好几遍。for i in range(3): 表示“重复 3 次”，下面缩进 4 格的行就是每次都做的事（叫循环体）。没缩进的行不重复，循环做完后才执行一次。`,introCode:`for i in range(3):
    print("做一杯奶茶")
print("全部做好")`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`for i in range(3):
    print("做一杯")`,options:[{text:`做一杯
做一杯
做一杯`,correct:!0,why:`range(3) 让循环体执行 3 次。`},{text:`做一杯
做一杯
做一杯
做一杯`,correct:!1,why:`range(3) 是 3 次，不是 4 次：数到 3 之前就停。`},{text:`做一杯`,correct:!1,why:`for 会重复循环体，不只执行一次。`}],tip:`range(n) 重复 n 次。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`for i in range(2):
    print("摇匀")
print("出杯")`,options:[{text:`摇匀
摇匀
出杯`,correct:!0,why:`只有缩进的 摇匀 重复 2 次；出杯 没缩进，循环结束后执行一次。`},{text:`摇匀
出杯
摇匀
出杯`,correct:!1,why:`没缩进的行不属于循环，不会每次都执行。`},{text:`摇匀
出杯`,correct:!1,why:`range(2) 让缩进的行执行 2 次。`}],tip:`缩进的行重复；没缩进的行只执行一次。`},{type:`order`,prompt:`排好顺序。屏幕显示：
开始做
加冰
加冰
做好了`,lines:[`print("开始做")`,`for i in range(2):`,`    print("加冰")`,`print("做好了")`],shuffled:[3,2,1,0],answers:[[0,1,2,3]],expected:`开始做
加冰
加冰
做好了`,hint:`开始做 只出现一次，放最前；缩进的 加冰 紧跟 for；做好了 放最后。`},{type:`fill`,prompt:`出餐铃要响 4 声，补全数字。屏幕显示 4 行：叮`,code:`for i in range({0}):
    print("叮")`,tokens:[`4`,`3`,`5`],answer:[`4`],expected:`叮
叮
叮
叮`,why:{3:`range(3) 只重复 3 次。`,5:`range(5) 会重复 5 次，多了一声。`},hint:`range(n) 正好重复 n 次。`}]},{id:`U4L2`,title:`从几数到几`,concept:`range 的起点和步长`,story:`循环变量 i 每次会换成 range 里的下一个数。range(3) 是 0、1、2；range(1, 4) 从 1 开始，到 4 之前停：1、2、3（不含 4）。range(0, 10, 3) 每次加 3；步长也可以是负数，用来倒数。`,introCode:`for i in range(1, 4):
    print(i)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`for i in range(1, 4):
    print(i)`,options:[{text:`1
2
3`,correct:!0,why:`从 1 开始，到 4 之前停，不含 4。`},{text:`1
2
3
4`,correct:!1,why:`range(1, 4) 不包含结尾的 4。`},{text:`0
1
2
3`,correct:!1,why:`写了起点 1，就从 1 开始。`}],tip:`range(a, b)：包含 a，不包含 b。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`for i in range(0, 10, 3):
    print(i)`,options:[{text:`0
3
6
9`,correct:!0,why:`从 0 开始每次加 3：0、3、6、9；下一个 12 超过了 10 之前的范围。`},{text:`0
3
6`,correct:!1,why:`9 还小于 10，也算在里面。`},{text:`3
6
9`,correct:!1,why:`起点是 0，第一个数就是 0。`}],tip:`第三个数是步长：每次加多少。`},{type:`fill`,prompt:`要显示 1 到 5 这五个数，补全结尾的数字。`,code:`for i in range(1, {0}):
    print(i)`,tokens:[`6`,`5`,`4`],answer:[`6`],expected:`1
2
3
4
5`,why:{5:`range(1, 5) 到 5 之前就停，只有 1 到 4。`,4:`range(1, 4) 只有 1、2、3。`},hint:`结尾的数字本身不包含在内，要比 5 多 1。`},{type:`fill`,prompt:`倒数开门：屏幕依次显示 3、2、1。补全步长。`,code:`for i in range(3, 0, {0}):
    print(i)`,tokens:[`-1`,`1`,`0`],answer:[`-1`],expected:`3
2
1`,why:{1:`步长 1 是往上数，从 3 往上永远到不了 0，一个数也不显示。`,0:`步长不能是 0，会报错。`},hint:`倒着数，每次要减 1。`}]},{id:`U4L3`,title:`第几号订单`,concept:`使用循环变量`,story:`每一轮，循环变量 i 都是不同的数，可以拿来显示或计算。range(3) 里 i 从 0 开始；想从 1 开始显示，可以写 i + 1，或者用 range(1, 4)。循环结束后，i 还在，保留最后一轮的值。`,introCode:`for i in range(1, 4):
    print("订单", i)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`for i in range(3):
    print("第", i + 1, "单")`,options:[{text:`第 1 单
第 2 单
第 3 单`,correct:!0,why:`i 依次是 0、1、2，加 1 后是 1、2、3。`},{text:`第 0 单
第 1 单
第 2 单`,correct:!1,why:`显示的是 i + 1，不是 i。`},{text:`第 i + 1 单
第 i + 1 单
第 i + 1 单`,correct:!1,why:`i + 1 没加引号，会算出数字。`}],tip:`range(3) 的 i 从 0 开始。`},{type:`fill`,prompt:`显示每一杯的编号。屏幕显示：
杯 1
杯 2
杯 3`,code:`for i in range(1, 4):
    print("杯", {0})`,tokens:[`i`,`"i"`,`3`],answer:[`i`],expected:`杯 1
杯 2
杯 3`,why:{'"i"':`加了引号就是文字 i，每行都会显示“杯 i”。`,3:`写死 3，每行都是杯 3。要用每轮会变的 i。`},hint:`每一轮会变的是循环变量。`},{type:`order`,prompt:`排好顺序。屏幕显示：
订单 1
完成
订单 2
完成`,lines:[`for i in range(1, 3):`,`    print("订单", i)`,`    print("完成")`],shuffled:[2,0,1],answers:[[0,1,2]],expected:`订单 1
完成
订单 2
完成`,hint:`两行都缩进、都在循环里，每轮先显示订单号再显示完成。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`for i in range(3):
    print("做")
print(i)`,options:[{text:`做
做
做
2`,correct:!0,why:`循环结束后 i 还在，是最后一轮的值 2。`},{text:`做
做
做
3`,correct:!1,why:`range(3) 最后一轮的 i 是 2，没有 3。`},{text:`做
做
做`,correct:!1,why:`最后一行没缩进，循环后会执行一次，i 仍然存在。`}],tip:`循环做完，i 保留最后一轮的值。`}],pending:[{type:`modify`,status:`待 Claude 的代码题运行器，暂不开放`,replaces:2,plan:`改一改：把从 0 开始的编号改成从 1 开始`,task:{id:`U4L3-M1`,version:1,type:`modify`,prompt:`要显示订单 1 到 n，但这段程序从“订单 0”开始。请改正。`,given:[`n`],checkMode:`output`,code:`for i in range(n):
    print("订单", i)
`,tests:[{name:`3 单`,data:{n:3},expected:`订单 1
订单 2
订单 3`},{name:`1 单`,data:{n:1},expected:`订单 1`},{name:`5 单`,data:{n:5},expected:`订单 1
订单 2
订单 3
订单 4
订单 5`,hidden:!0}],hints:[`range(n) 的 i 从 0 开始。显示时能不能加点什么？`,`把 print("订单", i) 改成 print("订单", i + 1)（或者改用 range(1, n + 1)）。`],reference:`for i in range(n):
    print("订单", i + 1)
`,worked:{code:`for i in range(3):
    print("第", i + 1, "单")`,output:`第 1 单
第 2 单
第 3 单`,explain:`本关第 1 题：i 从 0 开始，显示 i + 1 就从 1 开始。`},requiresVariationAfterSolution:!0,variation:{id:`U4L3-M1-V1`,prompt:`显示“号码 1”到“号码 n”，每个号码隔 2（1、3、5…，共 n 个）。`,starter:`# n 已经准备好
`,tests:[{name:`3 个`,data:{n:3},expected:`号码 1
号码 3
号码 5`},{name:`1 个`,data:{n:1},expected:`号码 1`},{name:`4 个`,data:{n:4},expected:`号码 1
号码 3
号码 5
号码 7`,hidden:!0}],hints:[`第 i 个（i 从 0 开始）的号码是 i * 2 + 1。`,`for i in range(n): print("号码", i * 2 + 1)。`],solution:`for i in range(n):
    print("号码", i * 2 + 1)
`}}}]},{id:`U4L4`,title:`一共几杯`,concept:`累加：total = 0`,story:`要求和或计数，先在循环外准备一个变量 total = 0，每一轮用 total = total + … 往上加，循环结束后再显示。total = 0 要放在循环外面，否则每轮都会被清零。`,introCode:`total = 0
for i in range(1, 4):
    total = total + i
print(total)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`total = 0
for i in range(1, 4):
    total = total + i
print(total)`,options:[{text:`6`,correct:!0,why:`0 + 1 + 2 + 3 = 6；print 在循环外，只显示一次最后结果。`},{text:`1
3
6`,correct:!1,why:`print 没缩进，不在循环里，只在最后显示一次。`},{text:`3`,correct:!1,why:`total 是一轮轮加起来的，不是最后的 i。`}],tip:`累加：每轮在原来的基础上加。`},{type:`order`,prompt:`每单 2 杯，共 3 单。排好顺序。屏幕显示：总杯数 6`,lines:[`cups = 0`,`for i in range(3):`,`    cups = cups + 2`,`print("总杯数", cups)`],shuffled:[3,2,1,0],answers:[[0,1,2,3]],expected:`总杯数 6`,hint:`cups = 0 放循环前面；缩进的累加紧跟 for；显示放最后。`},{type:`fill`,prompt:`算 1 + 2 + 3 + 4。补全两处，屏幕显示：10`,code:`total = {0}
for i in range(1, 5):
    total = total {1} i
print(total)`,tokens:[`0`,`1`,`+`,`*`],answer:[`0`,`+`],expected:`10`,why:{1:`从 1 开始加会多出 1。求和要从 0 开始。`,"*":`* 是乘，这里要加起来。`},hint:`求和：从 0 开始，每轮加上 i。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`total = 0
for i in range(1, 4):
    total = i
print(total)`,options:[{text:`3`,correct:!0,why:`total = i 每轮都把 total 换成 i，没有加起来，最后是 3。`},{text:`6`,correct:!1,why:`要写 total = total + i 才是加起来；这里只是覆盖。`},{text:`0`,correct:!1,why:`循环里给 total 重新存了值，最后是 3。`}],tip:`累加要写 total = total + i。`}],pending:[{type:`modify`,status:`待 Claude 的代码题运行器，暂不开放`,replaces:3,plan:`改一改：把 total = 0 从循环里移到循环外`,task:{id:`U4L4-M1`,version:1,type:`modify`,prompt:`要算 1 + 2 + … + n（range(1, n + 1) 就是 1 到 n），但这段程序结果不对。请改正。`,given:[`n`],checkMode:`output`,code:`for i in range(1, n + 1):
    total = 0
    total = total + i
print(total)
`,tests:[{name:`n = 3`,data:{n:3},expected:`6`},{name:`n = 4`,data:{n:4},expected:`10`},{name:`n = 1`,data:{n:1},expected:`1`,hidden:!0},{name:`n = 0`,data:{n:0},expected:`0`,hidden:!0}],hints:[`total = 0 在循环里，每一轮会发生什么？`,`把 total = 0 移到 for 的上面，并去掉缩进。`],reference:`total = 0
for i in range(1, n + 1):
    total = total + i
print(total)
`,worked:{code:`total = 0
for i in range(1, 4):
    total = total + i
print(total)`,output:`6`,explain:`本关第 1 题：累加器放在循环外，每轮在原来的基础上加。`},requiresVariationAfterSolution:!0,variation:{id:`U4L4-M1-V1`,prompt:`每单 3 元，算 n 单一共多少元：每轮加 3。`,starter:`# n 已经准备好
`,tests:[{name:`n = 2`,data:{n:2},expected:`6`},{name:`n = 4`,data:{n:4},expected:`12`},{name:`n = 3`,data:{n:3},expected:`9`,hidden:!0},{name:`n = 0`,data:{n:0},expected:`0`,hidden:!0}],hints:[`累加器放循环外，每轮加 3。`,`total = 0 / for i in range(n): total = total + 3 / print(total)。`],solution:`total = 0
for i in range(n):
    total = total + 3
print(total)
`}}}]},{id:`U4L5`,title:`只数大单`,concept:`for 里放 if`,story:`循环里可以放 if：每一轮都检查一次，条件成立才做。if 在 for 里面，所以 if 要缩进 4 格，if 要做的事再缩进 4 格（共 8 格）。计数器 count = 0 放在循环外，循环结束后再显示。`,introCode:`count = 0
for i in range(1, 6):
    if i >= 4:
        count = count + 1
print("大单数", count)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`for i in range(1, 6):
    if i >= 4:
        print("大单", i)`,options:[{text:`大单 4
大单 5`,correct:!0,why:`每一轮都检查：只有 i 是 4 和 5 时条件成立。`},{text:`大单 3
大单 4
大单 5`,correct:!1,why:`3 >= 4 不成立。`},{text:`大单 1
大单 2
大单 3
大单 4
大单 5`,correct:!1,why:`print 在 if 里（缩进 8 格），条件不成立的轮次不显示。`}],tip:`for 里的 if 每一轮都会检查一次。`},{type:`fill`,prompt:`数一数 1 到 5 号订单里，编号 3 以上（含 3）的有几单。屏幕显示：3`,code:`count = 0
for i in range(1, 6):
    if i {0} 3:
        count = count + 1
print(count)`,tokens:[`>=`,`>`,`==`],answer:[`>=`],expected:`3`,why:{">":`> 不含 3，只数到 4、5 两单。`,"==":`== 只数正好是 3 的那一单。`},hint:`“3 以上（含 3）”用包含相等的符号。`},{type:`order`,prompt:`排好顺序：数 1 到 4 号里编号大于 2 的订单。屏幕显示：大单数 2`,lines:[`count = 0`,`for i in range(1, 5):`,`    if i > 2:`,`        count = count + 1`,`print("大单数", count)`],shuffled:[4,3,2,1,0],answers:[[0,1,2,3,4]],expected:`大单数 2`,hint:`计数器放循环前；if 在 for 里；加 1 在 if 里；最后显示一次。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`count = 0
for i in range(1, 5):
    if i > 2:
        count = count + 1
    print(count)`,options:[{text:`0
0
1
2`,correct:!0,why:`print 缩进 4 格，在 for 里、if 外：每一轮都显示一次当前的 count。`},{text:`2`,correct:!1,why:`print 缩进了，在循环里，每轮都会显示。`},{text:`1
2`,correct:!1,why:`print 不在 if 里，条件不成立的轮次也会显示。`}],tip:`看缩进判断一行属于谁：0 格在循环外，4 格在 for 里，8 格在 if 里。`}],pending:[{type:`modify`,replaces:2,status:`待 Claude 的代码题运行器，暂不开放`,plan:`改一改：把放错位置的 count = 0（在循环里）移到循环外`,task:{id:`U4L5-M1`,version:1,type:`modify`,prompt:`数一数 1 到 n 号订单里编号大于 2 的有几单，但这段程序结果总是 0 或 1。请改正。`,given:[`n`],checkMode:`output`,code:`for i in range(1, n + 1):
    count = 0
    if i > 2:
        count = count + 1
print("大单数", count)
`,tests:[{name:`5 单`,data:{n:5},expected:`大单数 3`},{name:`4 单`,data:{n:4},expected:`大单数 2`},{name:`2 单`,data:{n:2},expected:`大单数 0`,hidden:!0},{name:`6 单`,data:{n:6},expected:`大单数 4`,hidden:!0}],hints:[`count = 0 在循环里，每一轮都会被清零。`,`把 count = 0 移到 for 上面，去掉缩进。`],reference:`count = 0
for i in range(1, n + 1):
    if i > 2:
        count = count + 1
print("大单数", count)
`,worked:{code:`count = 0
for i in range(1, 6):
    if i >= 4:
        count = count + 1
print("大单数", count)`,output:`大单数 2`,explain:`本关开头的示范：计数器放在循环外，if 成立才加 1。`},requiresVariationAfterSolution:!0,variation:{id:`U4L5-M1-V1`,prompt:`数一数 1 到 n 号订单里编号小于 3 的有几单，输出“小单数 数量”。`,starter:`# n 已经准备好
`,tests:[{name:`5 单`,data:{n:5},expected:`小单数 2`},{name:`1 单`,data:{n:1},expected:`小单数 1`},{name:`6 单`,data:{n:6},expected:`小单数 2`,hidden:!0},{name:`2 单`,data:{n:2},expected:`小单数 2`,hidden:!0}],hints:[`计数器放循环外，if i < 3 才加 1。`,`count = 0 / for i in range(1, n + 1): if i < 3: count = count + 1 / print("小单数", count)。`],solution:`count = 0
for i in range(1, n + 1):
    if i < 3:
        count = count + 1
print("小单数", count)
`}}}]},{id:`U4L6`,title:`做到够为止`,concept:`while`,story:`while 和 if 很像，但不只执行一次：只要条件成立，就一遍遍执行下面缩进的行，每遍做完再回来检查。循环里一定要改变条件里的变量（比如 n = n + 1），否则条件永远成立，程序停不下来——点单屏会提示运行超时，这不算答错、不扣红心，改好再试。`,introCode:`n = 1
while n <= 3:
    print("第", n, "杯")
    n = n + 1`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`n = 1
while n <= 3:
    print(n)
    n = n + 1`,options:[{text:`1
2
3`,correct:!0,why:`n 是 1、2、3 时条件成立；n 变成 4 时不成立，循环结束。`},{text:`1`,correct:!1,why:`while 不是只执行一次：每遍做完会回来再检查条件。`},{text:`1
2
3
4`,correct:!1,why:`n 是 4 时 4 <= 3 不成立，不会再显示。`}],tip:`while：条件成立就再来一遍。`},{type:`order`,prompt:`排好顺序。屏幕显示：
做好第 1 杯
做好第 2 杯
做好第 3 杯`,lines:[`cups = 0`,`while cups < 3:`,`    cups = cups + 1`,`    print("做好第", cups, "杯")`],shuffled:[3,1,2,0],answers:[[0,1,2,3]],expected:`做好第 1 杯
做好第 2 杯
做好第 3 杯`,hint:`先存 cups；while 下面先加 1 再显示，第一杯才是 1。`},{type:`fill`,prompt:`从 1 数到 3。补全条件，屏幕显示：
1
2
3`,code:`n = 1
while n {0} 3:
    print(n)
    n = n + 1`,tokens:[`<=`,`<`,`==`],answer:[`<=`],expected:`1
2
3`,why:{"<":`n < 3 在 n 是 3 时不成立，只显示 1、2。`,"==":`n 一开始是 1，1 == 3 不成立，循环一遍也不执行。`},hint:`要包含 3，用包含相等的符号。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`money = 10
while money >= 4:
    money = money - 4
print(money)`,options:[{text:`2`,correct:!0,why:`10 → 6 → 2；2 >= 4 不成立，停下，显示 2。`},{text:`6`,correct:!1,why:`while 会一遍遍执行，不是只减一次。`},{text:`-2`,correct:!1,why:`每遍开始前都检查：money 是 2 时不再减。`}],tip:`每一遍开始前都检查条件。`}],pending:[{type:`modify`,replaces:3,status:`待 Claude 的代码题运行器，暂不开放`,plan:`改一改：给忘记更新变量的 while 加上 x = x + 1（运行会超时：不算作答、不扣红心）`,task:{id:`U4L6-M1`,version:1,type:`modify`,prompt:`要算 1 + 2 + … + n，但这段程序停不下来（运行会超时，不算答错、不扣红心）。请改正。`,given:[`n`],checkMode:`output`,code:`total = 0
x = 1
while x <= n:
    total = total + x
print(total)
`,tests:[{name:`n = 3`,data:{n:3},expected:`6`},{name:`n = 4`,data:{n:4},expected:`10`},{name:`n = 1`,data:{n:1},expected:`1`,hidden:!0},{name:`n = 5`,data:{n:5},expected:`15`,hidden:!0}],hints:[`循环里有没有改变 x？条件 x <= n 会不会变成不成立？`,`在 total = total + x 下面加一行 x = x + 1（缩进 4 格）。`],reference:`total = 0
x = 1
while x <= n:
    total = total + x
    x = x + 1
print(total)
`,worked:{code:`n = 1
while n <= 3:
    print(n)
    n = n + 1`,output:`1
2
3`,explain:`本关第 1 题：每遍都把 n 加 1，条件最终不成立，循环停下。`},requiresVariationAfterSolution:!0,variation:{id:`U4L6-M1-V1`,prompt:`从 n 倒数到 1（每次减 1）。`,starter:`# n 已经准备好
`,tests:[{name:`n = 3`,data:{n:3},expected:`3
2
1`},{name:`n = 1`,data:{n:1},expected:`1`},{name:`n = 4`,data:{n:4},expected:`4
3
2
1`,hidden:!0}],hints:[`while 的条件写 x >= 1，循环里要让 x 变小。`,`x = n / while x >= 1: print(x) / x = x - 1。`],solution:`x = n
while x >= 1:
    print(x)
    x = x - 1
`}}}]},{id:`U4L7`,title:`售罄就停`,concept:`break 和 continue`,story:`break：立刻结束整个循环，后面的轮次都不做了。continue：只跳过这一轮剩下的部分，直接进入下一轮。它们都写在循环里的 if 下面。`,introCode:`for i in range(1, 6):
    if i == 3:
        break
    print(i)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`for i in range(1, 6):
    if i == 3:
        break
    print(i)`,options:[{text:`1
2`,correct:!0,why:`i 是 3 时 break，整个循环结束，4、5 都不做了。`},{text:`1
2
4
5`,correct:!1,why:`break 不是只跳过一轮，而是结束整个循环。`},{text:`1
2
3`,correct:!1,why:`break 在 print 前面，3 来不及显示。`}],tip:`break = 整个循环到此为止。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`for i in range(1, 6):
    if i == 3:
        continue
    print(i)`,options:[{text:`1
2
4
5`,correct:!0,why:`i 是 3 时 continue，跳过这一轮的 print，接着做 4、5。`},{text:`1
2`,correct:!1,why:`continue 不结束循环，只跳过这一轮。`},{text:`1
2
3
4
5`,correct:!1,why:`i 是 3 那一轮的 print 被跳过了。`}],tip:`continue = 这一轮不做了，下一轮继续。`},{type:`fill`,prompt:`第 4 杯时原料卖完了，之后都不能再卖。补全，屏幕显示：
卖出第 1 杯
卖出第 2 杯
卖出第 3 杯`,code:`for i in range(1, 6):
    if i == 4:
        {0}
    print("卖出第", i, "杯")`,tokens:[`break`,`continue`],answer:[`break`],expected:`卖出第 1 杯
卖出第 2 杯
卖出第 3 杯`,why:{continue:`continue 只跳过第 4 杯，第 5 杯还会卖出。“之后都不能再卖”要结束整个循环。`},hint:`要结束整个循环。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`n = 0
while n < 10:
    n = n + 1
    if n == 3:
        break
print(n)`,options:[{text:`3`,correct:!0,why:`n 加到 3 时 break，循环提前结束，显示 3。`},{text:`10`,correct:!1,why:`break 让循环在 n 是 3 时就结束了。`},{text:`2`,correct:!1,why:`n 先加 1 变成 3，然后才 break。`}],tip:`while 里也能用 break。`}],pending:[{type:`modify`,replaces:4,status:`待 Claude 的代码题运行器，暂不开放`,plan:`改一改：把误用的 continue 改成 break（或反过来）`,task:{id:`U4L7-M1`,version:1,type:`modify`,prompt:`第 stop 杯时原料卖完，之后都不能再卖。这段程序在卖完后还会继续卖。请改正。`,given:[`stop`],checkMode:`output`,code:`for i in range(1, 6):
    if i == stop:
        continue
    print("卖出第", i, "杯")
`,tests:[{name:`第 3 杯卖完`,data:{stop:3},expected:`卖出第 1 杯
卖出第 2 杯`},{name:`第 5 杯卖完`,data:{stop:5},expected:`卖出第 1 杯
卖出第 2 杯
卖出第 3 杯
卖出第 4 杯`},{name:`第 2 杯卖完`,data:{stop:2},expected:`卖出第 1 杯`,hidden:!0}],hints:[`continue 只跳过一轮。“之后都不能再卖”要怎样？`,`把 continue 改成 break。`],reference:`for i in range(1, 6):
    if i == stop:
        break
    print("卖出第", i, "杯")
`,worked:{code:`for i in range(1, 6):
    if i == 3:
        break
    print(i)`,output:`1
2`,explain:`本关第 1 题：break 结束整个循环。`},requiresVariationAfterSolution:!0,variation:{id:`U4L7-M1-V1`,prompt:`第 skip 杯做坏了要跳过，其余照卖（共 5 杯）。`,starter:`# skip 已经准备好
`,tests:[{name:`第 3 杯坏`,data:{skip:3},expected:`卖出第 1 杯
卖出第 2 杯
卖出第 4 杯
卖出第 5 杯`},{name:`第 5 杯坏`,data:{skip:5},expected:`卖出第 1 杯
卖出第 2 杯
卖出第 3 杯
卖出第 4 杯`},{name:`第 1 杯坏`,data:{skip:1},expected:`卖出第 2 杯
卖出第 3 杯
卖出第 4 杯
卖出第 5 杯`,hidden:!0}],hints:[`只跳过这一轮，后面继续：用哪个？`,`if i == skip: continue，然后 print。`],solution:`for i in range(1, 6):
    if i == skip:
        continue
    print("卖出第", i, "杯")
`}}}]},{id:`U4L8`,title:`项目：批量订单统计`,concept:`单元项目：循环 + 累加 + 判断`,story:`单元项目：一共有 n 单，编号 1 到 n，每单 2 杯；第 3 号订单多要 1 杯。用循环算出总杯数。注意：累加器从 0 开始，range 要正好覆盖 1 到 n，特殊订单只加一次。`,introCode:`n = 5
total = 0
for i in range(1, n + 1):
    total = total + 2
    if i == 3:
        total = total + 1
print("总杯数", total)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`n = 5
total = 0
for i in range(1, n + 1):
    total = total + 2
    if i == 3:
        total = total + 1
print("总杯数", total)`,options:[{text:`总杯数 11`,correct:!0,why:`5 单 × 2 杯 = 10，第 3 单多 1 杯，共 11。`},{text:`总杯数 10`,correct:!1,why:`i 是 3 那一轮会多加 1。`},{text:`总杯数 15`,correct:!1,why:`多加的 1 只在 i == 3 那一轮，不是每轮。`}],tip:`特殊订单只在那一轮多加。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`n = 2
total = 0
for i in range(1, n + 1):
    total = total + 2
    if i == 3:
        total = total + 1
print("总杯数", total)`,options:[{text:`总杯数 4`,correct:!0,why:`只有 1、2 号订单，没有第 3 单，不多加。`},{text:`总杯数 5`,correct:!1,why:`n 是 2 时根本没有第 3 号订单。`},{text:`总杯数 6`,correct:!1,why:`range(1, 3) 只有 1、2 两轮。`}],tip:`边界：没有第 3 单时不多加。`},{type:`fill`,prompt:`补全 range，让编号正好是 1 到 n。n 是 3，屏幕显示：总杯数 7`,code:`n = 3
total = 0
for i in range({0}, {1}):
    total = total + 2
    if i == 3:
        total = total + 1
print("总杯数", total)`,tokens:[`1`,`0`,`n`,`n + 1`],answer:[`1`,`n + 1`],expected:`总杯数 7`,why:{0:`从 0 开始会多出一个 0 号订单。`,n:`range 不含结尾，写 n 会少掉第 n 号订单。`},hint:`从 1 开始；结尾要比 n 多 1。`},{type:`order`,prompt:`排好顺序：4 单，算总杯数。屏幕显示：总杯数 9`,lines:[`n = 4`,`total = 0`,`for i in range(1, n + 1):`,`    total = total + 2`,`    if i == 3:`,`        total = total + 1`,`print("总杯数", total)`],shuffled:[6,3,5,0,4,2,1],answers:[[0,1,2,3,4,5,6],[0,1,2,4,5,3,6],[1,0,2,3,4,5,6],[1,0,2,4,5,3,6]],expected:`总杯数 9`,hint:`先有 n 和 total = 0；循环里每单加 2；if 在循环里，多加的 1 在 if 里；最后显示一次。`,equivCases:[{n:0},{n:1},{n:2},{n:3},{n:4},{n:5},{n:6}]}],pending:[{type:`write`,replaces:4,keep:`第 2 题（n=2 没有第 3 单的边界）保留`,status:`待 Claude 的代码题运行器，暂不开放`,plan:`写一写：已给 n（订单数），编号 1…n，每单 2 杯，第 3 号订单多 1 杯，输出 总杯数 <数>。测试：n=5→总杯数 11；n=2→总杯数 4；n=3→总杯数 7`,reference:`total = 0
for i in range(1, n + 1):
    total = total + 2
    if i == 3:
        total = total + 1
print("总杯数", total)`,tests:[{data:{n:5},stdout:`总杯数 11`},{data:{n:2},stdout:`总杯数 4`},{data:{n:3},stdout:`总杯数 7`}],task:{id:`U4L8-W1`,version:1,type:`write`,prompt:`一共 n 单，编号 1 到 n，每单 2 杯；第 3 号订单多要 1 杯。输出“总杯数 数量”。`,given:[`n`],checkMode:`output`,starter:`# n（订单数）已经准备好
`,tests:[{name:`5 单`,data:{n:5},expected:`总杯数 11`},{name:`2 单`,data:{n:2},expected:`总杯数 4`},{name:`3 单`,data:{n:3},expected:`总杯数 7`,hidden:!0},{name:`0 单`,data:{n:0},expected:`总杯数 0`,hidden:!0},{name:`1 单`,data:{n:1},expected:`总杯数 2`,hidden:!0}],hints:[`total = 0 放循环外；for i in range(1, n + 1) 每轮加 2；i == 3 时再加 1。`,`total = 0 / for i in range(1, n + 1): / total = total + 2 / if i == 3: total = total + 1 / 最后 print("总杯数", total)。`],reference:`total = 0
for i in range(1, n + 1):
    total = total + 2
    if i == 3:
        total = total + 1
print("总杯数", total)
`,worked:{code:`n = 5
total = 0
for i in range(1, n + 1):
    total = total + 2
    if i == 3:
        total = total + 1
print("总杯数", total)`,output:`总杯数 11`,explain:`本关第 1 题就是示范。`},requiresVariationAfterSolution:!0,variation:{id:`U4L8-W1-V1`,prompt:`一共 n 单，每单 3 杯；第 2 号订单多要 2 杯。输出“总杯数 数量”。`,starter:`# n 已经准备好
`,tests:[{name:`4 单`,data:{n:4},expected:`总杯数 14`},{name:`1 单`,data:{n:1},expected:`总杯数 3`},{name:`2 单`,data:{n:2},expected:`总杯数 8`,hidden:!0},{name:`0 单`,data:{n:0},expected:`总杯数 0`,hidden:!0}],hints:[`和父题一样的结构，换成每单 3 杯、第 2 单多 2 杯。`,`total = 0 / for i in range(1, n + 1): total = total + 3 / if i == 2: total = total + 2。`],solution:`total = 0
for i in range(1, n + 1):
    total = total + 3
    if i == 2:
        total = total + 2
print("总杯数", total)
`}}}]}]},u={id:`U5`,title:`列表与序列`,subtitle:`列表、下标、遍历、in`,lessons:[{id:`U5L1`,title:`一张点单表`,concept:`列表 [ ] 和 len`,story:`好几单的杯数，不用一单一个变量：用方括号把它们放在一起，逗号隔开，就是一个列表，比如 cups = [2, 5, 1]。len(cups) 数的是列表里有几个元素（几单），不是数字符。同一个列表里可以放不同类型的值，比如 ["奶茶", 2, True]。`,introCode:`cups = [2, 5, 1]
print(cups)
print(len(cups))`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = [3, 1, 4]
print(cups)`,options:[{text:`[3, 1, 4]`,correct:!0,why:`print 一个列表，会连方括号和逗号一起显示。`},{text:`3 1 4`,correct:!1,why:`这是 print(3, 1, 4) 的样子；print 列表会带方括号和逗号。`},{text:`[3 1 4]`,correct:!1,why:`列表显示时元素之间有逗号。`}],tip:`print 列表：方括号、逗号都会显示。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`names = ["奶茶", "果茶"]
print(len(names))`,options:[{text:`2`,correct:!0,why:`列表里有 2 个元素，len 数的是元素个数。`},{text:`4`,correct:!1,why:`4 是 4 个汉字；len 用在列表上数的是元素，不是字符。`},{text:`[2]`,correct:!1,why:`len 得到一个数字，不是列表。`}],tip:`len(列表) = 有几个元素。`},{type:`fill`,prompt:`一单里有：奶茶、2 杯、要冰。列表里可以放不同类型的值。补全，屏幕显示：3`,code:`order = ["奶茶", 2, True]
print({0}(order))`,tokens:[`len`,`print`,`order`],answer:[`len`],expected:`3`,why:{print:`print(order) 显示的是列表本身，外面再 print 一次不会得到个数。`,order:`order 是列表，不能像函数那样加括号使用。`},hint:`数元素个数用 len。`},{type:`order`,prompt:`排好顺序。屏幕显示：共 3 单`,lines:[`cups = [2, 5, 1]`,`n = len(cups)`,`print("共", n, "单")`],shuffled:[2,0,1],answers:[[0,1,2]],expected:`共 3 单`,hint:`先有列表，再算个数，最后显示。`}]},{id:`U5L2`,title:`第几单`,concept:`下标（从 0 开始、负下标）`,story:`要取列表里的某一个，用方括号写它的位置，叫下标：cups[0] 是第一个，cups[1] 是第二个——下标从 0 开始。最后一个是 cups[-1]，也可以写 cups[len(cups) - 1]。cups[len(cups)] 已经超出范围，会报错 IndexError。`,introCode:`cups = [2, 5, 1]
print(cups[0])
print(cups[-1])`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = [2, 5, 1]
print(cups[0])`,options:[{text:`2`,correct:!0,why:`下标从 0 开始：cups[0] 是第一个。`},{text:`5`,correct:!1,why:`5 是第二个，下标是 1。第一个的下标是 0。`},{text:`[2]`,correct:!1,why:`cups[0] 取出的是元素本身，不是列表。`}],tip:`第一个的下标是 0。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = [2, 5, 1]
print(cups[-1])`,options:[{text:`1`,correct:!0,why:`-1 表示倒数第一个，也就是最后一个。`},{text:`2`,correct:!1,why:`2 是第一个（cups[0]）。-1 从末尾数。`},{text:`5`,correct:!1,why:`5 是倒数第二个（cups[-2]）。`}],tip:`负下标从末尾数：-1 是最后一个。注意 cups[3] 会报错 IndexError：3 个元素的下标只有 0、1、2。`},{type:`fill`,prompt:`取最后一单的杯数。屏幕显示：7`,code:`cups = [4, 9, 7]
print(cups[len(cups) {0} 1])`,tokens:[`-`,`+`,`*`],answer:[`-`],expected:`7`,why:{"+":`len(cups) + 1 是 4，超出范围，报错 IndexError。`,"*":`len(cups) * 1 还是 3，下标 3 超出范围（只有 0、1、2），报错 IndexError。`},hint:`3 个元素的下标是 0、1、2：最后一个是长度减 1。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`names = ["奶茶", "果茶", "咖啡"]
print(names[1])`,options:[{text:`果茶`,correct:!0,why:`下标 1 是第二个。`},{text:`奶茶`,correct:!1,why:`奶茶是 names[0]。`},{text:`咖啡`,correct:!1,why:`咖啡是 names[2]，也是 names[-1]。`}],tip:`下标 = 第几个 - 1。`}],pending:[{type:`modify`,replaces:4,status:`待 Claude 的代码题运行器，暂不开放`,plan:`改一改：把取第一单的 cups[1] 改成 cups[0]，把取最后一单的 cups[len(cups)]（IndexError）改成 cups[-1]`,task:{id:`U5L2-M1`,version:1,type:`modify`,prompt:`显示第一单和最后一单的杯数。这段程序取错了第一单，最后一单还会报错 IndexError。请改正。`,given:[`cups`],checkMode:`output`,code:`print("第一单", cups[1])
print("最后一单", cups[len(cups)])
`,tests:[{name:`3 单`,data:{cups:[2,5,1]},expected:`第一单 2
最后一单 1`},{name:`2 单`,data:{cups:[4,9]},expected:`第一单 4
最后一单 9`},{name:`只有 1 单`,data:{cups:[7]},expected:`第一单 7
最后一单 7`,hidden:!0},{name:`4 单`,data:{cups:[3,8,6,5]},expected:`第一单 3
最后一单 5`,hidden:!0}],hints:[`下标从 0 开始；有 len(cups) 个元素时，最大的下标是多少？`,`第一单写 cups[0]，最后一单写 cups[-1]（或 cups[len(cups) - 1]）。`],reference:`print("第一单", cups[0])
print("最后一单", cups[-1])
`,worked:{code:`cups = [2, 5, 1]
print(cups[0])
print(cups[-1])`,output:`2
1`,explain:`本关第 1、2 题：第一个是 [0]，最后一个是 [-1]。`},requiresVariationAfterSolution:!0,variation:{id:`U5L2-M1-V1`,prompt:`显示第二单和倒数第二单的杯数。`,starter:`# cups 已经准备好（至少 2 单）
`,tests:[{name:`3 单`,data:{cups:[2,5,1]},expected:`第二单 5
倒数第二单 5`},{name:`4 单`,data:{cups:[4,9,6,3]},expected:`第二单 9
倒数第二单 6`},{name:`2 单`,data:{cups:[1,8]},expected:`第二单 8
倒数第二单 1`,hidden:!0},{name:`5 单`,data:{cups:[5,4,3,2,1]},expected:`第二单 4
倒数第二单 2`,hidden:!0}],hints:[`第二个的下标是 1；倒数第二个用负下标。`,`print("第二单", cups[1]) / print("倒数第二单", cups[-2])。`],solution:`print("第二单", cups[1])
print("倒数第二单", cups[-2])
`}}}]},{id:`U5L3`,title:`改单、加单、退单`,concept:`改元素、append、remove`,story:`改某一单：cups[1] = 6。加一单到末尾：cups.append(3)。退掉一单：cups.remove(5) 删掉第一个等于 5 的元素——按值删，不是按下标。append 和 remove 直接改原来的列表，不会得到新列表，所以不要写 cups = cups.append(3)。`,introCode:`cups = [2, 5, 1]
cups[1] = 6
cups.append(3)
cups.remove(2)
print(cups)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = [2, 5, 1]
cups[1] = 6
print(cups)`,options:[{text:`[2, 6, 1]`,correct:!0,why:`cups[1] 是第二个，改成 6。`},{text:`[6, 5, 1]`,correct:!1,why:`下标从 0 开始：改的是第二个，不是第一个。`},{text:`[2, 5, 1, 6]`,correct:!1,why:`给下标赋值是替换，不是加到末尾（那是 append）。`}],tip:`列表名[下标] = 新值：替换那一个。`},{type:`fill`,prompt:`加一单 3 杯到末尾。屏幕显示：[2, 5, 3]`,code:`cups = [2, 5]
cups.{0}(3)
print(cups)`,tokens:[`append`,`remove`],answer:[`append`],expected:`[2, 5, 3]`,why:{remove:`remove 是删掉等于 3 的元素；列表里没有 3，会报错 ValueError。`},hint:`加到末尾用 append。`},{type:`order`,prompt:`排好顺序：先退掉 2 杯那单，再把（现在的）第一单改成 8 杯。屏幕显示：[8, 1]`,lines:[`cups = [2, 5, 1]`,`cups.remove(2)`,`cups[0] = 8`,`print(cups)`],shuffled:[3,2,0,1],answers:[[0,1,2,3]],expected:`[8, 1]`,hint:`先建列表；remove(2) 按值删；删完后第一个是 5，再改成 8；最后显示。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = [2, 5]
cups.append(1)
cups.remove(5)
print(cups)`,options:[{text:`[2, 1]`,correct:!0,why:`append 后是 [2, 5, 1]，再按值删掉 5。`},{text:`[2, 5]`,correct:!1,why:`remove(5) 删的是等于 5 的元素，不是下标 5。`},{text:`[2, 5, 1]`,correct:!1,why:`remove(5) 把 5 删掉了。`}],tip:`remove 按值删，append 加到末尾，都直接改原列表。`}],pending:[{type:`modify`,replaces:4,status:`待 Claude 的代码题运行器，暂不开放`,plan:`改一改：把 cups = cups.append(3)（cups 变成 None）改成 cups.append(3)`,task:{id:`U5L3-M1`,version:1,type:`modify`,prompt:`把 add 杯加到清单末尾，再显示清单。这段程序显示的是 None。请改正。`,given:[`cups`,`add`],checkMode:`output`,code:`cups = cups.append(add)
print(cups)
`,tests:[{name:`加 3 杯`,data:{cups:[2,5],add:3},expected:`[2, 5, 3]`},{name:`空清单`,data:{cups:[],add:1},expected:`[1]`},{name:`加重复的`,data:{cups:[4],add:4},expected:`[4, 4]`,hidden:!0},{name:`加到 3 单后`,data:{cups:[1,2,3],add:9},expected:`[1, 2, 3, 9]`,hidden:!0}],hints:[`append 直接改原列表，它本身得到的是什么？`,`去掉 cups = ，只写 cups.append(add)。`],reference:`cups.append(add)
print(cups)
`,worked:{code:`cups = [2, 5]
cups.append(1)
cups.remove(5)
print(cups)`,output:`[2, 1]`,explain:`本关第 4 题：append、remove 直接改原列表，不用再赋值。`},requiresVariationAfterSolution:!0,variation:{id:`U5L3-M1-V1`,prompt:`退掉 drop 杯那单，再把（现在的）第一单改成 first 杯，显示清单。`,starter:`# cups、drop、first 已经准备好
`,tests:[{name:`退 2 杯`,data:{cups:[2,5,1],drop:2,first:8},expected:`[8, 1]`},{name:`有重复`,data:{cups:[3,3,6],drop:3,first:4},expected:`[4, 6]`},{name:`退最后一单`,data:{cups:[5,7],drop:7,first:1},expected:`[1]`,hidden:!0},{name:`退中间`,data:{cups:[1,2,3],drop:2,first:9},expected:`[9, 3]`,hidden:!0}],hints:[`remove 按值删（只删第一个）；删完再按下标改。`,`cups.remove(drop) / cups[0] = first / print(cups)。`],solution:`cups.remove(drop)
cups[0] = first
print(cups)
`}}}]},{id:`U5L4`,title:`取一段`,concept:`切片 [a:b]、[:n]`,story:`cups[1:3] 取下标 1 到 2 的元素——包含开头 1，不包含结尾 3，和 range 一样。cups[:2] 是前 2 个。切片得到一个新列表，原来的列表不变。`,introCode:`cups = [2, 5, 1, 7]
print(cups[1:3])
print(cups[:2])
print(cups)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = [2, 5, 1, 7]
print(cups[1:3])`,options:[{text:`[5, 1]`,correct:!0,why:`下标 1、2；不包含结尾 3。`},{text:`[5, 1, 7]`,correct:!1,why:`切片不包含结尾：下标 3 的 7 不在里面。`},{text:`[2, 5, 1]`,correct:!1,why:`从下标 1 开始，第一个 2 的下标是 0。`}],tip:`[a:b] 包含 a，不包含 b。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = [2, 5, 1, 7]
first = cups[:2]
print(cups)`,options:[{text:`[2, 5, 1, 7]`,correct:!0,why:`切片得到新列表存进 first；cups 本身不变。`},{text:`[2, 5]`,correct:!1,why:`[2, 5] 是 first；切片不会改原列表。`},{text:`[1, 7]`,correct:!1,why:`切片不会从原列表里删东西。`}],tip:`切片 = 复制一段出来，原列表不变。`},{type:`fill`,prompt:`取前 3 单。屏幕显示：[4, 8, 6]`,code:`cups = [4, 8, 6, 3]
print(cups[:{0}])`,tokens:[`3`,`2`,`4`],answer:[`3`],expected:`[4, 8, 6]`,why:{2:`[:2] 只有前 2 个。`,4:`[:4] 是全部 4 个。`},hint:`[:n] 就是前 n 个。`},{type:`fill`,prompt:`取中间两单。屏幕显示：[8, 6]`,code:`cups = [4, 8, 6, 3]
print(cups[{0}:{1}])`,tokens:[`1`,`3`,`2`,`0`],answer:[`1`,`3`],expected:`[8, 6]`,why:{2:`看下标：8 是 1，6 是 2；结尾要写 6 的下一个。`,0:`下标 0 是 4，不在中间。`},hint:`开头写 8 的下标；结尾写 6 的下标再加 1。`}]},{id:`U5L5`,title:`一单一单看`,concept:`遍历列表、sum、max`,story:`店长想知道今天一共卖了多少杯。for c in cups: 会让 c 依次等于列表里的每一个元素，不用写下标。要把杯数加起来，可以像 U4 那样先放一个 total = 0 再一个个加；列表全是数字时，sum(cups) 直接把它们加起来，max(cups) 找出最大的那一个。`,introCode:`cups = [2, 5, 1]
total = 0
for c in cups:
    total = total + c
print(total)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = [2, 5, 1]
print(sum(cups))
print(max(cups))`,options:[{text:`8
5`,correct:!0,why:`sum 把所有元素加起来：2 + 5 + 1 = 8；max 是最大的元素：5。`},{text:`3
5`,correct:!1,why:`3 是元素个数，那是 len(cups)；sum 是把元素加起来。`},{text:`8
1`,correct:!1,why:`max 找的是最大的元素，不是最后一个：最大的是 5。`}],tip:`sum(列表) 是全部相加，max(列表) 是最大的那个，len(列表) 才是个数。`},{type:`order`,prompt:`排好顺序，把三单的杯数加起来。屏幕显示：8`,lines:[`cups = [2, 5, 1]`,`total = 0`,`for c in cups:`,`    total = total + c`,`print(total)`],shuffled:[4,2,0,3,1],answers:[[0,1,2,3,4],[1,0,2,3,4]],expected:`8`,hint:`先有列表，再放累加器 total = 0，然后 for 逐个加，最后在循环外显示。`},{type:`fill`,prompt:`5 杯及以上算大单。数一数有几个大单，屏幕显示：3（正好 5 杯也算）`,code:`cups = [2, 5, 1, 7, 6]
big = 0
for c in cups:
    if c {0} 5:
        big = big + 1
print(big)`,tokens:[`>=`,`>`,`<`],answer:[`>=`],expected:`3`,why:{">":`这样正好 5 杯的不算，只数到 7 和 6，显示 2。“及以上”要包含 5：用 >=。`,"<":`这样数的是不到 5 杯的：2 和 1，显示 2。`},hint:`“5 杯及以上”包含 5，要用 >=。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = [2, 5, 1]
for c in cups:
    total = 0
    total = total + c
print(total)`,options:[{text:`1`,correct:!0,why:`total = 0 在循环里面：每一轮都被清零，最后一轮是 0 + 1，所以显示 1。`},{text:`8`,correct:!1,why:`想得到 8，total = 0 要放在 for 的上面，只清零一次。`},{text:`0`,correct:!1,why:`最后一轮 total 先清零再加上 1，结果是 1，不是 0。`}],tip:`累加器的初值放在循环外面，只设一次。`}],pending:[{type:`write`,replaces:4,status:`待 Claude 的代码题运行器，暂不开放`,plan:`写一写：已给 cups，输出 总杯数 N 和 大单 K（≥5 杯算大单）`,task:{id:`U5L5-W1`,version:1,type:`write`,prompt:`已经准备好 cups（每一单的杯数）。请输出两行：第一行“总杯数”和总杯数，第二行“大单”和大单的数量（一单 5 杯及以上算大单）。例：cups 是 [2, 5, 1, 7] 时，输出
总杯数 15
大单 2`,given:[`cups`],checkMode:`output`,starter:`# cups（每一单的杯数，是一个列表）已经准备好
`,tests:[{name:`四单`,data:{cups:[2,5,1,7]},expected:`总杯数 15
大单 2`},{name:`两单都小`,data:{cups:[1,1]},expected:`总杯数 2
大单 0`},{name:`没有单`,data:{cups:[]},expected:`总杯数 0
大单 0`,hidden:!0},{name:`正好 5 杯`,data:{cups:[5]},expected:`总杯数 5
大单 1`,hidden:!0},{name:`多单混合`,data:{cups:[4,5,6,3,9]},expected:`总杯数 27
大单 3`,hidden:!0}],hints:[`要同时算两个数：总杯数和大单数。各用一个变量，都放在循环外面先设为 0。`,`for c in cups: 里面先把 c 加到总数上，再用 if c >= 5: 数大单；最后在循环外面 print 两行。`],reference:`total = 0
big = 0
for c in cups:
    total = total + c
    if c >= 5:
        big = big + 1
print("总杯数", total)
print("大单", big)
`,worked:{code:`cups = [4, 1]
n = 0
for c in cups:
    if c >= 3:
        n = n + 1
print("够 3 杯的单数", n)`,output:`够 3 杯的单数 1`,explain:`计数器放在循环外；if 成立才加 1。本题要同时数两样东西。`},alternatives:[`total = 0
big = 0
for c in cups:
    total += c
    if c > 4:
        big += 1
print('总杯数', total)
print('大单', big)`,`big = 0
for c in cups:
    if c >= 5:
        big = big + 1
print('总杯数', sum(cups))
print('大单', big)`,`total = 0
big = 0
i = 0
while i < len(cups):
    total = total + cups[i]
    if cups[i] >= 5:
        big = big + 1
    i = i + 1
print('总杯数', total)
print('大单', big)`,`total = 0
big = 0
for i in range(len(cups)):
    total = total + cups[i]
    if cups[i] >= 5:
        big = big + 1
print('总杯数', total)
print('大单', big)`],wrongAnswers:[{code:`total = 0
big = 0
for c in cups:
    total = total + c
    if c > 5:
        big = big + 1
print('总杯数', total)
print('大单', big)`,why:`边界：正好 5 杯也算大单，要用 >= 5（或 > 4）`},{code:`big = 0
for c in cups:
    total = 0
    total = total + c
    if c >= 5:
        big = big + 1
print('总杯数', total)
print('大单', big)`,why:`total = 0 放在循环里，每一轮都被清零；空列表还会报 NameError`}]}}]},{id:`U5L6`,title:`菜单里有吗`,concept:`in、not in`,story:`顾客点了一杯，要先查菜单里有没有。"果茶" in menu 问的是：果茶是不是 menu 里的一个元素，答案是 True 或 False。反过来问“不在”，写 not in（不是 in not）。注意：列表的 in 要整个元素一模一样才算在，"奶茶" 不等于列表里的 "珍珠奶茶"。`,introCode:`menu = ["奶茶", "果茶"]
print("果茶" in menu)
print("咖啡" not in menu)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`menu = ["奶茶", "果茶", "咖啡"]
print("果茶" in menu)`,options:[{text:`True`,correct:!0,why:`果茶是 menu 里的一个元素，所以 in 的结果是 True。`},{text:`False`,correct:!1,why:`果茶就在 menu 里，in 的结果是 True。`},{text:`果茶`,correct:!1,why:`in 问的是“在不在”，结果是 True 或 False，不是元素本身。`}],tip:`x in 列表 → True / False：看 x 是不是列表里的一个元素。`},{type:`fill`,prompt:`顾客点了柠檬茶，菜单里没有。屏幕显示：没有这款`,code:`menu = ["奶茶", "果茶", "咖啡"]
order = "柠檬茶"
if order {0} menu:
    print("没有这款")
else:
    print("可以点")`,tokens:[`not in`,`in`,`in not`],answer:[`not in`],expected:`没有这款`,why:{in:`柠檬茶不在菜单里，order in menu 是 False，会走 else，显示“可以点”。`,"in not":`Python 里没有 in not 这种写法，会报语法错误。“不在”要写成 not in。`},hint:`“不在列表里”写成 not in。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`menu = ["珍珠奶茶", "果茶"]
print("奶茶" in menu)`,options:[{text:`False`,correct:!0,why:`列表的 in 要整个元素一模一样：menu 里的元素是“珍珠奶茶”，不是“奶茶”。`},{text:`True`,correct:!1,why:`“奶茶”只是“珍珠奶茶”的一部分。字符串之间的 in 看是否包含，但列表的 in 要整个元素都相等。`}],tip:`列表的 in：整个元素一模一样才算在。`},{type:`order`,prompt:`排好顺序，查一查果茶在不在菜单里。屏幕显示：有`,lines:[`menu = ["奶茶", "果茶"]`,`drink = "果茶"`,`if drink in menu:`,`    print("有")`,`else:`,`    print("没有")`],shuffled:[3,2,5,0,4,1],answers:[[0,1,2,3,4,5],[1,0,2,3,4,5]],expected:`有`,hint:`先有菜单和点的饮品，再 if 判断；else 要在 if 的内容之后。`}],pending:[{type:`modify`,replaces:4,status:`待 Claude 的代码题运行器，暂不开放`,plan:`改一改：把条件写反的 if menu in item 改成 if item in menu`,task:{id:`U5L6-M1`,version:1,type:`modify`,prompt:`已经准备好 menu（菜单，一个列表）和 item（顾客点的饮品）。有就显示“有这款”，没有就显示“没有这款”。这段程序运行会报错，请改正。`,given:[`menu`,`item`],checkMode:`output`,code:`if menu in item:
    print("有这款")
else:
    print("没有这款")
`,tests:[{name:`菜单里有`,data:{menu:[`奶茶`,`果茶`],item:`果茶`},expected:`有这款`},{name:`菜单里没有`,data:{menu:[`奶茶`,`果茶`],item:`咖啡`},expected:`没有这款`},{name:`空菜单`,data:{menu:[],item:`奶茶`},expected:`没有这款`,hidden:!0},{name:`只是一部分`,data:{menu:[`珍珠奶茶`],item:`奶茶`},expected:`没有这款`,hidden:!0},{name:`正好一款`,data:{menu:[`奶茶`],item:`奶茶`},expected:`有这款`,hidden:!0}],hints:[`in 前面放“要找的东西”，后面放“在哪里找”。现在谁在前面？`,`把 menu in item 改成 item in menu。`],reference:`if item in menu:
    print("有这款")
else:
    print("没有这款")
`,worked:{code:`sizes = ["中杯", "大杯"]
print("超大杯" in sizes)`,output:`False`,explain:`in 的写法是：要找的东西 in 列表。结果是 True 或 False。`},alternatives:[`if item not in menu:
    print('没有这款')
else:
    print('有这款')`,`found = False
for m in menu:
    if m == item:
        found = True
if found:
    print('有这款')
else:
    print('没有这款')`,`if not item in menu:
    print('没有这款')
else:
    print('有这款')`],wrongAnswers:[{code:`if item not in menu:
    print('有这款')
else:
    print('没有这款')`,why:`not in 和 in 的意思相反，结果整个反了`},{code:`found = False
for m in menu:
    if item in m:
        found = True
if found:
    print('有这款')
else:
    print('没有这款')`,why:`item in m 是在字符串里找“包含”，“奶茶”会被当成“珍珠奶茶”里有；列表要整个元素相等`}]}}]},{id:`U5L7`,title:`项目：购物清单`,concept:`综合：列表 + 遍历 + in`,story:`最后一关：用学过的列表、for、in、append、remove 管理一张购物清单。有两条规矩：已经有的不重复加；不在清单里的不能删（不然 remove 会报错 ValueError）。`,introCode:`items = ["奶茶"]
x = "果茶"
if x not in items:
    items.append(x)
print(items)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`items = ["奶茶", "果茶"]
if "咖啡" in items:
    items.remove("咖啡")
print(items)`,options:[{text:`['奶茶', '果茶']`,correct:!0,why:`咖啡不在清单里，if 不成立，remove 根本没执行，所以清单不变。`},{text:`报错 ValueError`,correct:!1,why:`正因为先用 in 判断过，remove 才不会执行；直接 remove 一个不存在的元素才会报 ValueError。`},{text:`[]`,correct:!1,why:`没有东西被删：if 不成立，remove 没有执行。`}],tip:`先用 in 判断存在，再 remove，就不会报错。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`items = ["奶茶"]
for x in ["果茶", "奶茶"]:
    if x not in items:
        items.append(x)
print(items)`,options:[{text:`['奶茶', '果茶']`,correct:!0,why:`果茶不在清单里，加上；奶茶已经在了，跳过，不重复加。`},{text:`['奶茶', '果茶', '奶茶']`,correct:!1,why:`if x not in items 把已经有的挡住了，奶茶不会被再加一次。`},{text:`['果茶']`,correct:!1,why:`append 是往末尾加，不会清空原来的内容。`}],tip:`加之前先 not in 检查，就不会重复。`},{type:`fill`,prompt:`清单是奶茶、果茶，要删的是果茶和咖啡。只删清单里有的，屏幕显示：['奶茶']`,code:`items = ["奶茶", "果茶"]
to_remove = ["果茶", "咖啡"]
for x in to_remove:
    if x {0} items:
        items.remove(x)
print(items)`,tokens:[`in`,`not in`,`==`],answer:[`in`],expected:`['奶茶']`,why:{"not in":`这样会去删不在清单里的东西，咖啡不在，remove("咖啡") 报错 ValueError。`,"==":`x 是文字，items 是列表，它们永远不相等，什么都不会删。`},hint:`只删“在清单里”的：用 in。`},{type:`order`,prompt:`排好顺序，没有咖啡就加上，再显示一共几项。屏幕显示：共 3 项`,lines:[`items = ["奶茶", "果茶"]`,`x = "咖啡"`,`if x not in items:`,`    items.append(x)`,`print("共", len(items), "项")`],shuffled:[4,2,0,3,1],answers:[[0,1,2,3,4],[1,0,2,3,4]],expected:`共 3 项`,hint:`先有清单和要加的，if not in 判断，再 append，最后显示个数。`}],pending:[{type:`write`,replaces:3,status:`待 Claude 的代码题运行器，暂不开放`,plan:`项目写一写：已给 items、to_add、to_remove；先加后删，已有的不重复加，不存在的不删；每行输出一项，再输出 共 N 项`,task:{id:`U5L7-W1`,version:1,type:`write`,prompt:`已经准备好三个列表：items（购物清单）、to_add（要加的）、to_remove（要删的）。规矩：先加后删；已经有的不重复加，不在清单里的不删。最后每行输出一项，再输出“共 N 项”（直接 print 清单不行，要每行一项）。例：items 是 ["奶茶", "果茶"]，to_add 是 ["咖啡"]，to_remove 是 ["果茶"] 时，输出
奶茶
咖啡
共 2 项`,given:[`items`,`to_add`,`to_remove`],checkMode:`output`,starter:`# items（购物清单）、to_add（要加的）、to_remove（要删的）都是列表，已经准备好
`,tests:[{name:`加一个删一个`,data:{items:[`奶茶`,`果茶`],to_add:[`咖啡`],to_remove:[`果茶`]},expected:`奶茶
咖啡
共 2 项`},{name:`什么都不变`,data:{items:[`奶茶`],to_add:[],to_remove:[]},expected:`奶茶
共 1 项`},{name:`空清单`,data:{items:[],to_add:[],to_remove:[]},expected:`共 0 项`,hidden:!0},{name:`要加的里有重复`,data:{items:[],to_add:[`果茶`,`果茶`,`奶茶`],to_remove:[]},expected:`果茶
奶茶
共 2 项`,hidden:!0},{name:`刚加进去又删掉`,data:{items:[`奶茶`],to_add:[`咖啡`],to_remove:[`咖啡`]},expected:`奶茶
共 1 项`,hidden:!0},{name:`全部删光`,data:{items:[`奶茶`],to_add:[],to_remove:[`奶茶`]},expected:`共 0 项`,hidden:!0},{name:`删不存在的`,data:{items:[`奶茶`],to_add:[],to_remove:[`火锅`]},expected:`奶茶
共 1 项`,hidden:!0}],hints:[`分三步：先加（加之前检查有没有），再删（删之前检查在不在），最后输出。`,`第一个 for 遍历 to_add：if x not in items: items.append(x)；第二个 for 遍历 to_remove：if x in items: items.remove(x)；再 for 逐个 print，最后 print("共", len(items), "项")。`],reference:`for x in to_add:
    if x not in items:
        items.append(x)
for x in to_remove:
    if x in items:
        items.remove(x)
for x in items:
    print(x)
print("共", len(items), "项")
`,worked:{code:`cart = ["笔"]
new = "尺"
if new not in cart:
    cart.append(new)
print(cart)`,output:`['笔', '尺']`,explain:`加之前先用 not in 检查；本题要对一整个列表这样做，再删，再逐行输出。`},alternatives:[`for x in to_add:
    if x not in items:
        items.append(x)
for x in to_remove:
    if x in items:
        items.remove(x)
n = 0
for x in items:
    print(x)
    n += 1
print('共', n, '项')`,`i = 0
while i < len(to_add):
    if to_add[i] not in items:
        items.append(to_add[i])
    i = i + 1
i = 0
while i < len(to_remove):
    if to_remove[i] in items:
        items.remove(to_remove[i])
    i = i + 1
for x in items:
    print(x)
print('共', len(items), '项')`,`for x in to_add:
    if not (x in items):
        items.append(x)
for x in to_remove:
    if x in items:
        items.remove(x)
for i in range(len(items)):
    print(items[i])
print('共', len(items), '项')`],wrongAnswers:[{code:`for x in to_remove:
    if x in items:
        items.remove(x)
for x in to_add:
    if x not in items:
        items.append(x)
for x in items:
    print(x)
print('共', len(items), '项')`,why:`顺序反了：规矩是先加后删，先删会让“刚加进去又删掉”的项留在清单里`},{code:`for x in to_add:
    items.append(x)
for x in to_remove:
    if x in items:
        items.remove(x)
for x in items:
    print(x)
print('共', len(items), '项')`,why:`没有检查就 append，已有的和重复的项会被加进去`},{code:`for x in to_add:
    if x not in items:
        items.append(x)
for x in to_remove:
    items.remove(x)
for x in items:
    print(x)
print('共', len(items), '项')`,why:`没检查就 remove，删不存在的项会报 ValueError`}]}}]}]},d={id:`U6`,title:`类型与报错`,subtitle:`type、int()/str()、读报错`,lessons:[{id:`U6L1`,title:`它是什么类型`,concept:`type() 和四种类型`,story:`点单屏里的值有不同的“种类”：15 是整数（int），15.5 是小数（float），"15" 是文字（str），True 是布尔（bool）。同样长得像 15，加了引号就是文字。type() 能让 Python 说出一个值的种类，结果长这样：<class 'int'>，引号里的 int 就是种类名。`,introCode:`print(type(15))
print(type("15"))`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`cups = 3
print(type(cups))`,options:[{text:`<class 'int'>`,correct:!0,why:`3 没有引号，是整数，种类名是 int。`},{text:`<class 'str'>`,correct:!1,why:`cups 里是数字 3，没有引号，不是文字。`},{text:`3`,correct:!1,why:`type() 说的是值的种类，不是值本身。`}],tip:`type(值) 显示这个值的种类：<class '种类名'>。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`a = 15
b = "15"
print(type(a))
print(type(b))`,options:[{text:`<class 'int'>
<class 'str'>`,correct:!0,why:`a 是数字 15（int）；b 加了引号，是文字（str）。`},{text:`<class 'int'>
<class 'int'>`,correct:!1,why:`b 的 15 带着引号，是文字，不是整数。`},{text:`<class 'str'>
<class 'int'>`,correct:!1,why:`顺序反了：a 没有引号，是整数；b 才有引号。`}],tip:`15 和 "15" 看着一样，种类不一样：有引号的是文字。`},{type:`fill`,prompt:`屏幕要显示：<class 'float'>。哪一个能做到？`,code:`print(type({0}))`,tokens:[`30 / 2`,`30 - 2`,`"30"`],answer:[`30 / 2`],expected:`<class 'float'>`,why:{"30 - 2":`30 - 2 是 28，整数，显示 <class 'int'>。`,'"30"':`加了引号的 30 是文字，显示 <class 'str'>。`},hint:`还记得 30 / 2 得到 15.0 吗？除法的结果是小数（float）。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`ok = 5 > 3
print(type(ok))`,options:[{text:`<class 'bool'>`,correct:!0,why:`比较的结果是 True 或 False，种类是布尔 bool。`},{text:`True`,correct:!1,why:`type() 说的是种类，不是比较的结果。`},{text:`<class 'int'>`,correct:!1,why:`True / False 不是整数，是布尔 bool。`}],tip:`比较的结果（True / False）种类是 bool。`}]},{id:`U6L2`,title:`文字和数字互换`,concept:`int() 和 str()`,story:`文字 "15" 和数字 15 不一样。"杯数：" + 3 会报错 TypeError："杯数：" 是文字，3 是整数，Python 不能直接用 + 把它们接起来。解决办法是先统一种类：int() 可以把 "15" 这类表示整数的文字转成整数，str(3) 把整数转成文字。转好之后，才能用 + 做加法，或者拼进文字里。`,introCode:`price = "15"
print(int(price) + 5)
print("杯数：" + str(3))`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`price = "15"
print(int(price) + 5)`,options:[{text:`20`,correct:!0,why:`int(price) 先把文字 "15" 变成数字 15，再加 5 得 20。`},{text:`155`,correct:!1,why:`155 是把 "15" 和 "5" 拼在一起的结果；这里 int() 已经把它变成数字，是做加法。`},{text:`15 + 5`,correct:!1,why:`print 显示的是计算结果，不是算式。`}],tip:`int() 可以把 "15" 这类表示整数的文字转成整数，之后就能做加法。`},{type:`fill`,prompt:`屏幕要显示：杯数：3`,code:`cups = 3
print("杯数：" + {0})`,tokens:[`str(cups)`,`cups`,`int(cups)`],answer:[`str(cups)`],expected:`杯数：3`,why:{cups:`"杯数：" 是文字，cups 是整数 3，Python 不能直接用 + 把它们接起来，所以会报 TypeError。用 str(cups) 转成文字后就能拼接。`,"int(cups)":`int(cups) 还是整数 3，"杯数：" 是文字，文字加整数照样会报 TypeError。要用 str(cups) 转成文字才能拼接。`},hint:`拼进文字里的必须是文字：用 str() 把数字变成文字。`},{type:`order`,prompt:`排好顺序。屏幕显示：20`,lines:[`text = "12"`,`num = int(text)`,`total = num + 8`,`print(total)`],shuffled:[3,1,0,2],answers:[[0,1,2,3]],expected:`20`,hint:`先有文字，再变成整数，再相加，最后显示。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`a = "12"
b = "8"
print(a + b)
print(int(a) + int(b))`,options:[{text:`128
20`,correct:!0,why:`第一行：两段文字拼在一起是 128；第二行：先都变成数字，再相加得 20。`},{text:`20
20`,correct:!1,why:`第一行 a + b 是两段文字，会拼在一起得 128，不会相加。`},{text:`128
128`,correct:!1,why:`第二行先用 int() 把两个都变成数字，再相加得 20。`}],tip:`文字 + 文字 = 拼接；整数 + 整数 = 相加。想相加，先 int()。`}]},{id:`U6L3`,title:`读懂报错`,concept:`先看最后一行，再找行号`,story:`程序出错时，Python 会停下来，给出一段报错。读它分两步：第一步看最后一行，冒号前面是错误类型（比如 TypeError），冒号后面是具体信息；第二步看上面的 line 几，到自己的代码里找那一行。在本关这些从上到下一行一行执行、运行到某一行才出错的例子里，出错行之前的代码已经运行过，之后的代码不会再运行。真实的报错里有时还有用 ^ 和 ~ 画的小箭头，先不用管。以后你自己写的程序出错时，也会看到这三样：错误类型、第几行、具体信息。`,introCode:`cups = 3
print("杯数：" + cups)`,exercises:[{type:`pick`,prompt:`程序出错了。先看报错的最后一行：冒号前面的 TypeError 是错误类型，后面是具体信息。合起来是在说什么？`,key:`type`,code:`cups = 3
print("杯数：" + cups)`,trace:`Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print("杯数：" + cups)
TypeError: can only concatenate str (not "int") to str`,checks:[{program:`cups = 3
print("杯数：" + cups)`,type:`TypeError`,line:2,msg:`can only concatenate str (not "int") to str`}],options:[{text:`文字和整数放在一起用 + 接了，类型搭配不对`,correct:!0,why:`最后一行写着 TypeError：can only concatenate str (not "int") to str，意思是 str（文字）不能和 int（整数）直接用 + 接起来。`,value:`TypeError`},{text:`用到了一个还没有定义的变量名`,correct:!1,why:`那种错误叫 NameError，信息里会写 name '…' is not defined。这里最后一行写的是 TypeError。`,value:`NameError`},{text:`int() 转换的文字内容不对`,correct:!1,why:`那种错误叫 ValueError。这里最后一行写的是 TypeError，说的是类型搭配。`,value:`ValueError`},{text:`代码写法不对，比如少了冒号`,correct:!1,why:`那种错误叫 SyntaxError。这里最后一行写的是 TypeError，程序的写法没问题，是运行到这一行才出错。`,value:`SyntaxError`}],tip:`最后一行：冒号前面是错误类型，冒号后面是具体信息。`},{type:`pick`,prompt:`报错里的 line 数字，指向程序里出错的那一行。是下面哪一行代码出错了？`,key:`line`,code:`cups = 3
label = "杯数："
print(label)
print(label + cups)
print(cups)`,trace:`Traceback (most recent call last):
  File "main.py", line 4, in <module>
    print(label + cups)
TypeError: can only concatenate str (not "int") to str`,checks:[{program:`cups = 3
label = "杯数："
print(label)
print(label + cups)
print(cups)`,type:`TypeError`,line:4,msg:`can only concatenate str (not "int") to str`}],options:[{text:`print(label)`,correct:!1,why:`这一行是第 3 行，它正常运行了，屏幕上已经显示了“杯数：”。出错的是后面那一行。`},{text:`print(label + cups)`,correct:!0,why:`报错写着 line 4，第 4 行就是 print(label + cups)：label 是文字，cups 是整数，不能直接用 + 接。`},{text:`print(cups)`,correct:!1,why:`这一行是第 5 行，出错后 Python 就停了，它根本没有运行。`},{text:`cups = 3`,correct:!1,why:`给变量赋值没有问题，这一行是第 1 行，正常运行了。`}],tip:`用 line 几去数程序的行号，第一行是 line 1。`},{type:`fill`,prompt:`小码写的 print("共" + n + "杯") 出了下面的报错。把它改好，屏幕要显示：共4杯`,code:`n = 4
print("共" + {0} + "杯")`,tokens:[`str(n)`,`n`,`int(n)`],answer:[`str(n)`],expected:`共4杯`,why:{n:`"共" 是文字，n 是整数 4，不能直接用 + 接，还是 TypeError。`,"int(n)":`int(n) 还是整数 4，整数和文字照样不能用 + 接，TypeError。`},hint:`报错说文字和整数搭配不对：把整数 n 变成文字就行，用 str()。`,trace:`Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print("共" + n + "杯")
TypeError: can only concatenate str (not "int") to str`,traceProgram:`n = 4
print("共" + n + "杯")`},{type:`pick`,prompt:`运行这段程序，屏幕上会先显示什么，然后出现报错？`,key:`stdout`,code:`text = "abc"
print("准备转换")
num = int(text)
print(num)`,trace:`Traceback (most recent call last):
  File "main.py", line 3, in <module>
    num = int(text)
ValueError: invalid literal for int() with base 10: 'abc'`,checks:[{program:`text = "abc"
print("准备转换")
num = int(text)
print(num)`,type:`ValueError`,line:3,msg:`invalid literal for int() with base 10: 'abc'`}],options:[{text:`准备转换`,correct:!0,why:`报错在第 3 行，第 2 行的 print("准备转换") 已经运行过，所以先显示“准备转换”；第 4 行没有机会运行。`,value:`准备转换`},{text:`什么都不显示，只有报错`,correct:!1,why:`出错之前的代码已经运行过：第 2 行的 print 已经把“准备转换”显示出来了。`,value:``},{text:`准备转换
abc`,correct:!1,why:`第 4 行 print(num) 在出错的第 3 行之后，不会运行；而且 num 也根本没有生成。`,value:`准备转换
abc`},{text:`准备转换
0`,correct:!1,why:`报错之后程序就停了，第 4 行不会运行，不会显示任何数字。`,value:`准备转换
0`}],tip:`出错的行之前运行过，之后不会运行。`}]},{id:`U6L4`,title:`修正常见错误`,concept:`按错误类型和题意选修法`,story:`两种报错，修法不一样。TypeError 是类型搭配不对，比如 "杯数：" + 3：拼接时，用 str() 把整数变成文字；做整数加法时，用 int() 把 "12" 这类表示整数的文字转成整数。ValueError 是类型对了，但文字的内容转不了，比如 int("3.5")："3.5" 不是整数的写法。这时先看题目要什么：要保留小数，就用 float()，float("3.5") 得到小数 3.5；只能是整数（比如杯数），就把数据改成只写杯数的 "3"，去掉单位“杯”。不能为了不报错就随便改数据，改完显示的结果要和题目要的一样。`,introCode:`price = "3.5"
print(float(price) + 1)`,exercises:[{type:`pick`,prompt:`下面两个报错的最后一行，分别是哪一种问题？`,key:`type`,trace:`A  cups = 3
   print("杯数：" + cups)
   TypeError: can only concatenate str (not "int") to str
B  print(int("3.5"))
   ValueError: invalid literal for int() with base 10: '3.5'`,checks:[{program:`cups = 3
print("杯数：" + cups)`,type:`TypeError`,line:2,msg:`can only concatenate str (not "int") to str`},{program:`print(int("3.5"))`,type:`ValueError`,line:1,msg:`invalid literal for int() with base 10: '3.5'`}],options:[{text:`A 是类型搭配不对，B 是文字的内容转不了整数`,correct:!0,why:`A 是 TypeError：文字和整数不能直接用 + 接。B 是 ValueError：int() 要的是整数写法的文字，"3.5" 带小数点，转不了。`,value:`TypeError,ValueError`},{text:`A 是文字的内容转不了整数，B 是类型搭配不对`,correct:!1,why:`反了。A 的最后一行是 TypeError（类型搭配），B 的最后一行是 ValueError（内容转不了）。`,value:`ValueError,TypeError`},{text:`两个都是类型搭配不对`,correct:!1,why:`只有 A 是 TypeError。B 里 "3.5" 本来就是文字，int() 要转的类型没错，错在内容，所以是 ValueError。`,value:`TypeError,TypeError`},{text:`两个都是文字内容转不了`,correct:!1,why:`只有 B 是 ValueError。A 里没有转换，是文字和整数直接用 + 接，是 TypeError。`,value:`ValueError,ValueError`}],tip:`看最后一行冒号前面：TypeError 是类型搭配，ValueError 是内容转不了。`},{type:`pick`,prompt:`price 是 3.5 元的奶茶价格，要显示加 1 元后的价格：4.5。怎么改才对？`,key:`fix`,code:`price = "3.5"
num = int(price)
print(num + 1)`,trace:`Traceback (most recent call last):
  File "main.py", line 2, in <module>
    num = int(price)
ValueError: invalid literal for int() with base 10: '3.5'`,checks:[{program:`price = "3.5"
num = int(price)
print(num + 1)`,type:`ValueError`,line:2,msg:`invalid literal for int() with base 10: '3.5'`}],expected:`4.5`,options:[{text:`把 int(price) 改成 float(price)`,correct:!0,why:`float() 把 "3.5" 转成小数 3.5，加 1 得 4.5，和题目要的一样。`,fixed:`price = "3.5"
num = float(price)
print(num + 1)`},{text:`把 price = "3.5" 改成 price = "3"`,correct:!1,why:`不报错了，但显示 4，不是 4.5：价格 3.5 元被你改成了 3 元，数据变了。`,fixed:`price = "3"
num = int(price)
print(num + 1)`},{text:`把 int(price) 改成 str(price)`,correct:!1,why:`str(price) 还是文字 "3.5"，文字加 1 又变成类型搭配不对，报错 TypeError。`,fixed:`price = "3.5"
num = str(price)
print(num + 1)`},{text:`把 num + 1 改成 num + "1"`,correct:!1,why:`第 2 行的 int(price) 还是转不了 "3.5"，报错 ValueError，报错没有消失。`,fixed:`price = "3.5"
num = int(price)
print(num + "1")`}],tip:`题目要保留小数，就不能把 "3.5" 改成 "3"。`},{type:`fill`,prompt:`杯数必须是整数。cups 写成 "3杯" 时出了下面的报错；cups 里写什么，程序才能显示 5？`,code:`cups = {0}
print(int(cups) + 2)`,tokens:[`"3"`,`"3杯"`,`"三"`],answer:[`"3"`],expected:`5`,why:{'"3杯"':`"3杯" 里带着单位“杯”，int() 转不了，还是 ValueError。`,'"三"':`汉字“三”不是 int() 认识的整数写法，转不了，ValueError。`},hint:`只填写杯数，例如 "3"，去掉单位“杯”，int() 才能转成整数。`,trace:`Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print(int(cups) + 2)
ValueError: invalid literal for int() with base 10: '3杯'`,traceProgram:`cups = "3杯"
print(int(cups) + 2)`},{type:`pick`,prompt:`age 是 "12"，要显示明年的年龄。输出必须恰好是 13。怎么改才对？`,key:`fix`,code:`age = "12"
print(age + 1)`,trace:`Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print(age + 1)
TypeError: can only concatenate str (not "int") to str`,checks:[{program:`age = "12"
print(age + 1)`,type:`TypeError`,line:2,msg:`can only concatenate str (not "int") to str`}],expected:`13`,options:[{text:`把 age + 1 改成 int(age) + 1`,correct:!0,why:`int(age) 把 "12" 变成整数 12，加 1 得 13。`,fixed:`age = "12"
print(int(age) + 1)`},{text:`把 age + 1 改成 age + "1"`,correct:!1,why:`不报错了，但显示 121：文字加文字是拼接，不是加法，不是 13。`,fixed:`age = "12"
print(age + "1")`},{text:`把 age + 1 改成 float(age) + 1`,correct:!1,why:`不报错了，但显示 13.0：数值和 13 相同，但 float() 得到的是小数，显示成 13.0，格式不符合题目要求的“恰好 13”。`,fixed:`age = "12"
print(float(age) + 1)`},{text:`把 age + 1 改成 str(age) + 1`,correct:!1,why:`str(age) 本来就是文字，文字加 1 还是类型搭配不对，报错 TypeError。`,fixed:`age = "12"
print(str(age) + 1)`}],tip:`输出必须恰好是 13：不是 13.0，也不是 121。`}]},{id:`U6L5`,title:`用 print 找 bug`,concept:`在中间加 print，看变量的值`,story:`有时程序不报错，结果却不对。这时在中间加几行 print，把变量当时的值显示出来，从上往下看，找到第一处和你预想不一样的地方，错就在它附近。加在哪里很重要：想看每一轮更新后的值，print 就要放在更新那一行的下面。`,introCode:`total = 0
for i in range(1, 4):
    total = total + i
    print("第", i, "轮", total)
print(total)`,exercises:[{type:`predict`,prompt:`小码想算 3 杯 12 元的总价 36，在中间加了一行 print 看看。屏幕上会显示什么？`,code:`price = 12
cups = 3
total = price + cups
print("total:", total)
print("应付", total)`,options:[{text:`total: 15
应付 15`,correct:!0,why:`中间的 total 显示 15，不是想要的 36：第 3 行写成了 +，应该是 *。找 bug 就是找第一处和预想不一样的值。`},{text:`total: 36
应付 36`,correct:!1,why:`第 3 行是 price + cups，12 + 3 得 15，不是 36。`},{text:`total: 15
应付 36`,correct:!1,why:`两行显示的是同一个变量 total，值一样，都是 15。`}],tip:`先预想每个变量应该是多少，再对照 print 显示的值。`},{type:`predict`,prompt:`想算 1 + 2 + 3 = 6，小码加了 print 看每一轮。屏幕上会显示什么？`,code:`total = 0
for i in range(1, 4):
    total = 0
    total = total + i
    print("第", i, "轮", total)
print(total)`,options:[{text:`第 1 轮 1
第 2 轮 2
第 3 轮 3
3`,correct:!0,why:`每一轮 total 都先被 total = 0 清零，再加 i，所以显示的是 i 本身，最后是 3。bug 在循环里的 total = 0。`},{text:`第 1 轮 1
第 2 轮 3
第 3 轮 6
6`,correct:!1,why:`这是把 total = 0 放在循环外面时才有的结果；这里每一轮都会被清零。`},{text:`第 1 轮 1
第 2 轮 2
第 3 轮 3
6`,correct:!1,why:`最后的 print(total) 显示的也是被清零后加上 3 的结果：3，不是 6。`}],tip:`每一轮开头 total 是多少？`},{type:`fill`,prompt:`想看每一轮累加后的 total，print 里填什么？`,code:`total = 0
for i in range(1, 4):
    total = total + i
    print("第", i, "轮", {0})
print(total)`,tokens:[`total`,`i`,`"total"`],answer:[`total`],expected:`第 1 轮 1
第 2 轮 3
第 3 轮 6
6`,why:{i:`i 是第几轮的数，显示出来是 1、2、3，看不到累加的值。`,'"total"':`加了引号就是文字 total，显示的是单词，不是变量的值。`},hint:`要看变量的值，print 里写变量名，不加引号。`},{type:`pick`,prompt:`想在循环里加一行 print("total:", total)，看每一轮更新后的值。放在哪一行才对？`,key:`fix`,code:`total = 0
for i in range(1, 4):
    total = total + i
print(total)`,checks:[],expected:`total: 1
total: 3
total: 6
6`,options:[{text:`放在 total = 0 的下面，循环外面`,correct:!1,why:`不在循环里，只会显示一次更新之前的值。`,fixed:`total = 0
print("total:", total)
for i in range(1, 4):
    total = total + i
print(total)`},{text:`放在 total = total + i 的下面，缩进和它一样`,correct:!0,why:`在更新之后、同一个循环里，每一轮都会显示更新后的值。`,fixed:`total = 0
for i in range(1, 4):
    total = total + i
    print("total:", total)
print(total)`},{text:`放在 total = total + i 的上面，缩进和它一样`,correct:!1,why:`在循环里，但在更新之前，显示的是上一轮的值，第一轮还是 0。`,fixed:`total = 0
for i in range(1, 4):
    print("total:", total)
    total = total + i
print(total)`},{text:`放在最后一行 print(total) 的下面`,correct:!1,why:`在循环外面，只显示最后一次。`,fixed:`total = 0
for i in range(1, 4):
    total = total + i
print(total)
print("total:", total)`}],tip:`更新之后，在同一个循环里。`}]},{id:`U6L6`,title:`修好收银程序`,concept:`一处一处修，每次重新读报错`,story:`项目：收银程序有好几处错。price 和 cups 是从点单屏读来的、表示整数的文字，比如 "10" 和 "5"。修的办法：先运行，读最后一行和 line 几；修好一处，再运行，看有没有新的报错；全部不报错了，也要拿几组数据对一对结果，因为有的错不会报错，只会算错。下面三个报错，是按示例的修法逐处修改时可能看到的顺序，你的写法不同，看到的顺序也可能不同。`,introCode:`price = "10"
cups = "5"
total = price * cups
if cups > 5:
    total = total - 5
print("应付：" + total)`,exercises:[{type:`pick`,prompt:`price 是 "10"、cups 是 "5"，要先算总价 total = 单价 × 杯数。程序先出了下面这个报错，第 3 行怎么改？`,key:`fix`,code:`price = "10"
cups = "5"
total = price * cups
if cups > 5:
    total = total - 5
print("应付：" + total)`,trace:`Traceback (most recent call last):
  File "main.py", line 3, in <module>
    total = price * cups
TypeError: can't multiply sequence by non-int of type 'str'`,checks:[{program:`price = "10"
cups = "5"
total = price * cups
if cups > 5:
    total = total - 5
print("应付：" + total)`,type:`TypeError`,line:3,msg:`can't multiply sequence by non-int of type 'str'`}],expected:`应付：45`,options:[{text:`第 3 行改成：total = int(price) * int(cups)`,correct:!0,why:`price 和 cups 都是表示整数的文字，先分别用 int() 转成整数再乘：10 × 5 = 50。`,fixed:`price = "10"
cups = "5"
total = int(price) * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + str(total))`},{text:`第 3 行改成：total = int(price) * cups`,correct:!1,why:`cups 还是文字：整数 × 文字不是乘法，是把文字重复 10 遍，得到 "5555555555"，后面减 5 又会出错，报错 TypeError。`,fixed:`price = "10"
cups = "5"
total = int(price) * cups
if int(cups) >= 5:
    total = total - 5
print("应付：" + str(total))`},{text:`第 3 行改成：total = price * int(cups)`,correct:!1,why:`price 还是文字：文字 × 整数不是乘法，是把文字重复 5 遍，后面减 5 又会出错，报错 TypeError。`,fixed:`price = "10"
cups = "5"
total = price * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + str(total))`},{text:`第 3 行改成：total = str(price) * str(cups)`,correct:!1,why:`两个都变成文字，文字 × 文字没有意思，报错 TypeError。`,fixed:`price = "10"
cups = "5"
total = str(price) * str(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + str(total))`}],tip:`两个都是表示整数的文字，乘之前都要转成整数。`},{type:`pick`,prompt:`第 3 行修好之后，按示例的修法，下一步会看到下面这个报错。第 4 行怎么改？`,key:`fix`,code:`price = "10"
cups = "5"
total = int(price) * int(cups)
if cups > 5:
    total = total - 5
print("应付：" + total)`,trace:`Traceback (most recent call last):
  File "main.py", line 4, in <module>
    if cups > 5:
TypeError: '>' not supported between instances of 'str' and 'int'`,checks:[{program:`price = "10"
cups = "5"
total = int(price) * int(cups)
if cups > 5:
    total = total - 5
print("应付：" + total)`,type:`TypeError`,line:4,msg:`'>' not supported between instances of 'str' and 'int'`}],expected:`应付：45`,options:[{text:`第 4 行改成：if int(cups) >= 5:`,correct:!0,why:`cups 先转成整数再比较；正好 5 杯也要减 5 元，所以用 >=。`,fixed:`price = "10"
cups = "5"
total = int(price) * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + str(total))`},{text:`第 4 行改成：if int(cups) > 5:`,correct:!1,why:`不报错了，但显示 应付：50，应该是应付：45：正好 5 杯没有减 5 元，边界要用 >=。`,fixed:`price = "10"
cups = "5"
total = int(price) * int(cups)
if int(cups) > 5:
    total = total - 5
print("应付：" + str(total))`},{text:`第 4 行改成：if cups >= 5:`,correct:!1,why:`cups 还是文字，文字和整数不能比较大小，报错 TypeError。`,fixed:`price = "10"
cups = "5"
total = int(price) * int(cups)
if cups >= 5:
    total = total - 5
print("应付：" + str(total))`},{text:`第 4 行改成：if int(cups) >= "5":`,correct:!1,why:`整数和文字不能比较大小，报错 TypeError。`,fixed:`price = "10"
cups = "5"
total = int(price) * int(cups)
if int(cups) >= "5":
    total = total - 5
print("应付：" + str(total))`}],tip:`正好 5 杯也要减 5 元；cups 还是文字。`},{type:`pick`,prompt:`前面两处修好之后，按示例的修法，最后一行会看到下面这个报错。第 6 行怎么改？`,key:`fix`,code:`price = "10"
cups = "5"
total = int(price) * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + total)`,trace:`Traceback (most recent call last):
  File "main.py", line 6, in <module>
    print("应付：" + total)
TypeError: can only concatenate str (not "int") to str`,checks:[{program:`price = "10"
cups = "5"
total = int(price) * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + total)`,type:`TypeError`,line:6,msg:`can only concatenate str (not "int") to str`}],expected:`应付：45`,options:[{text:`第 6 行改成：print("应付：" + str(total))`,correct:!0,why:`total 是整数，拼进文字之前先用 str() 变成文字。`,fixed:`price = "10"
cups = "5"
total = int(price) * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + str(total))`},{text:`第 6 行改成：print("应付：" + int(total))`,correct:!1,why:`int(total) 还是整数，整数和文字还是不能用 + 接，报错 TypeError。`,fixed:`price = "10"
cups = "5"
total = int(price) * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + int(total))`},{text:`第 6 行改成：print("应付：", total)`,correct:!1,why:`不报错了，但显示 应付： 45：逗号会在中间加一个空格，和要求的“应付：45”不一样。`,fixed:`price = "10"
cups = "5"
total = int(price) * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：", total)`},{text:`第 6 行改成：print("应付：" + total)`,correct:!1,why:`没有改：整数 total 不能直接和文字用 + 接，报错 TypeError。`,fixed:`price = "10"
cups = "5"
total = int(price) * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + total)`}],tip:`拼进文字之前，整数要先变成文字；输出要和题目的写法一模一样。`},{type:`predict`,prompt:`三处都改好了。price 是 "8"、cups 是 "6"，屏幕上会显示什么？`,code:`price = "8"
cups = "6"
total = int(price) * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + str(total))`,options:[{text:`应付：43`,correct:!0,why:`8 × 6 = 48，满 5 杯减 5 元，得 43。`},{text:`应付：48`,correct:!1,why:`忘了减 5 元：6 杯已经满 5 杯。`},{text:`应付：53`,correct:!1,why:`满 5 杯是减 5 元，不是加 5 元。`}],tip:`先算总价，再看有没有满 5 杯。`}],pending:[{type:`modify`,replaces:4,status:`待 Claude 的代码题运行器，暂不开放`,plan:`改一改（项目）：price、cups 是表示整数的文字；一处一处修好，满 5 杯减 5 元，输出“应付：金额”`,task:{id:`U6L6-M1`,version:1,type:`modify`,prompt:`收银程序有好几处错。price 和 cups 是表示整数的文字（比如 "12" 和 "3"）。要求：算出总价（单价 × 杯数），满 5 杯（正好 5 杯也算）减 5 元，输出“应付：金额”。请一处一处改好，每改一处就重新运行。`,given:[`price`,`cups`],checkMode:`output`,code:`total = price * cups
if cups > 5:
    total = total - 5
print("应付：" + total)
`,tests:[{name:`3 杯`,data:{price:`12`,cups:`3`},expected:`应付：36`},{name:`正好 5 杯`,data:{price:`10`,cups:`5`},expected:`应付：45`},{name:`6 杯`,data:{price:`8`,cups:`6`},expected:`应付：43`,hidden:!0},{name:`1 杯`,data:{price:`15`,cups:`1`},expected:`应付：15`,hidden:!0},{name:`4 杯`,data:{price:`9`,cups:`4`},expected:`应付：36`,hidden:!0}],hints:[`先运行，读最后一行的错误类型和 line 几；修好一处再运行，看有没有新的报错。`,`price、cups 是文字：乘法和比较之前先用 int() 转成整数；拼进“应付：”之前用 str() 把整数变成文字。边界“满 5 杯”要用 >=。`],reference:`total = int(price) * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + str(total))
`,worked:{code:`width = "20"
height = "3"
w = int(width)
h = int(height)
area = w * h
print("面积：" + str(area))`,output:`面积：60`,explain:`三步：先把表示整数的文字用 int() 转成整数，再计算，最后输出时用 str() 把整数变回文字拼进句子。`},alternatives:[`cups = int(cups)
price = int(price)
total = price * cups
if cups >= 5:
    total = total - 5
print("应付：" + str(total))`,`total = int(price) * int(cups)
if int(cups) > 4:
    total = total - 5
print("应付：" + str(total))`,`total = int(price) * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：", total, sep="")`],wrongAnswers:[{code:`total = int(price) * int(cups)
if int(cups) > 5:
    total = total - 5
print("应付：" + str(total))`,why:`正好 5 杯没有减 5 元（边界）`},{code:`total = price * int(cups)
if int(cups) >= 5:
    total = total - 5
print("应付：" + str(total))`,why:`price 还是文字，文字 × 整数是重复，不是乘法`}],requiresVariationAfterSolution:!0,variation:{id:`U6L6-M1-V1`,prompt:`满 4 杯（正好 4 杯也算）减 3 元，其他不变，输出“应付：金额”。`,starter:`# price、cups 是表示整数的文字，已经准备好
`,tests:[{name:`4 杯`,data:{price:`6`,cups:`4`},expected:`应付：21`},{name:`3 杯`,data:{price:`7`,cups:`3`},expected:`应付：21`},{name:`8 杯`,data:{price:`5`,cups:`8`},expected:`应付：37`,hidden:!0},{name:`1 杯`,data:{price:`9`,cups:`1`},expected:`应付：9`,hidden:!0},{name:`正好 4 杯`,data:{price:`10`,cups:`4`},expected:`应付：37`,hidden:!0}],hints:[`先转成整数再算；满额的界线这次是 4 杯。`,`total = int(price) * int(cups) / if int(cups) >= 4: total = total - 3 / print("应付：" + str(total))。`],solution:`total = int(price) * int(cups)
if int(cups) >= 4:
    total = total - 3
print("应付：" + str(total))
`}}}]}]},f={id:`U7`,title:`字典`,subtitle:`dict：按名字存取`,lessons:[{id:`U7L1`,title:`按名字查库存`,concept:`字典、键和值、stock[键]`,story:`列表按位置找，字典（dict）按名字找：stock = {"奶茶": 12, "果茶": 5}。每一对写成“键: 值”，这里键是饮品名，值是杯数；一行写不下时，可以在逗号后换行。stock["果茶"] 查出果茶的值 5。查没有的键，会报 KeyError。`,introCode:`stock = {"奶茶": 12,
         "果茶": 5}
print(stock["奶茶"])
print(stock["果茶"])`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 5}
print(stock["果茶"])`,options:[{text:`5`,correct:!0,why:`按键“果茶”查，得到它的值 5。`},{text:`12`,correct:!1,why:`12 是奶茶的值；方括号里写的是“果茶”。`},{text:`果茶`,correct:!1,why:`查出来的是值，不是键本身。`},{text:`1`,correct:!1,why:`字典不按位置找，方括号里写的是键。`}],tip:`stock[键] 得到这个键的值。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 5}
name = "奶茶"
print(name, stock[name])`,options:[{text:`奶茶 12`,correct:!0,why:`name 里是 "奶茶"，stock[name] 就是 stock["奶茶"]，得 12。`},{text:`name 12`,correct:!1,why:`name 是变量，显示的是它里面的文字：奶茶。`},{text:`奶茶 5`,correct:!1,why:`5 是果茶的值，奶茶的值是 12。`}],tip:`方括号里可以放变量：变量里是哪个键，就查哪个键。`},{type:`fill`,prompt:`屏幕要显示咖啡的库存：8`,code:`stock = {"奶茶": 12,
         "果茶": 5,
         "咖啡": 8}
print(stock[{0}])`,tokens:[`"咖啡"`,`咖啡`,`2`,`"果茶"`],answer:[`"咖啡"`],expected:`8`,why:{咖啡:`没有引号，Python 把咖啡当变量名，报 NameError。键是文字，要带引号。`,2:`字典不按位置找：stock[2] 找的是叫 2 的键，没有，报 KeyError。`,'"果茶"':`果茶的值是 5，不是 8。`},hint:`方括号里写键 "咖啡"，带引号。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 5}
a = stock["奶茶"]
b = stock["果茶"]
print(a + b)`,options:[{text:`17`,correct:!0,why:`a 是 12，b 是 5，都是整数：12 + 5 = 17。`},{text:`奶茶果茶`,correct:!1,why:`a、b 里放的是查出来的值，不是键。`},{text:`125`,correct:!1,why:`值是整数 12 和 5，不是文字，+ 是做加法。`}],tip:`查出来的值可以直接拿去计算。`}]},{id:`U7L2`,title:`改库存`,concept:`stock[键] = 新值`,story:`stock["果茶"] = 9 把果茶的值换成 9。在旧值上改：先算 n = stock["奶茶"] - 3，再用 stock["奶茶"] = n 存回去。只算不存，字典不变。这一关只改已经有的键。`,introCode:`stock = {"奶茶": 12,
         "果茶": 5}
stock["果茶"] = 9
n = stock["奶茶"] - 3
stock["奶茶"] = n
print(stock["奶茶"])
print(stock["果茶"])`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 5}
stock["果茶"] = 9
print(stock["奶茶"])
print(stock["果茶"])`,options:[{text:`12
9`,correct:!0,why:`第 3 行把果茶换成 9；奶茶没动，还是 12。`},{text:`12
14`,correct:!1,why:`= 是换成，不是加上。`},{text:`12
5`,correct:!1,why:`第 3 行已经改了果茶，后面查到的是新值 9。`},{text:`9
5`,correct:!1,why:`被改的是方括号里写的果茶，不是奶茶。`}],tip:`stock[键] = 新值：替换这个键的旧值。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 5}
n = stock["奶茶"] - 3
stock["奶茶"] = n
print(stock["奶茶"])
print(stock["果茶"])`,options:[{text:`9
5`,correct:!0,why:`n 是 12 - 3 = 9；第 4 行把 9 存回奶茶。`},{text:`12
5`,correct:!1,why:`第 4 行已经把 n 存回奶茶了。`},{text:`-3
5`,correct:!1,why:`stock["奶茶"] - 3 先查出旧值 12，再减 3。`}],tip:`先算出新值，再存回这个键。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 5}
stock["果茶"] - 1
print(stock["果茶"])`,options:[{text:`5`,correct:!0,why:`第 3 行只算出 4，没有用 = 存回去，库存不变。`},{text:`4`,correct:!1,why:`算出了 4，但没存回字典。`},{text:`报错 KeyError`,correct:!1,why:`果茶这个键存在，不会报错；只是结果没存。`}],tip:`不写 stock[键] = …，字典就不会变。`},{type:`fill`,prompt:`顾客买了 cups 杯 name。补全，让库存减掉卖出的杯数，屏幕显示：2`,code:`stock = {"奶茶": 12,
         "果茶": 5}
name = "果茶"
cups = 3
n = {0} - cups
stock[name] = n
print(stock[name])`,tokens:[`stock[name]`,`name`,`cups`],answer:[`stock[name]`],expected:`2`,why:{name:`name 是文字 "果茶"，文字减整数报 TypeError。要减的是库存 stock[name]。`,cups:`cups - cups 得 0，库存被清空了。`},hint:`剩下的 = 原来的库存 - 卖出的杯数。`}]},{id:`U7L3`,title:`先问再取`,concept:`in、.get()、None`,story:`取之前先问："咖啡" in stock 看咖啡是不是一个键，得 True 或 False，只看键不看值。或者用 stock.get("咖啡")：有就给值，没有就给 None（表示“没有”），不报错。写成 stock.get("咖啡", 0)，没有时给 0。`,introCode:`stock = {"奶茶": 12,
         "果茶": 5}
k = "咖啡"
print(k in stock)
print(stock.get(k))
print(stock.get(k, 0))`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 5}
print("奶茶" in stock)
print(12 in stock)`,options:[{text:`True
False`,correct:!0,why:`奶茶是键；12 是值不是键，in 只看键。`},{text:`True
True`,correct:!1,why:`12 是奶茶的值，in 只看键。`},{text:`False
False`,correct:!1,why:`奶茶是字典里的键，是 True。`}],tip:`字典的 in 只看键。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 5}
print(stock.get("果茶", 0))
print(stock.get("咖啡"))
print(stock.get("咖啡", 0))`,options:[{text:`5
None
0`,correct:!0,why:`果茶有，给真实的值 5；咖啡没有：不写默认值给 None，写了给 0。`},{text:`0
None
0`,correct:!1,why:`果茶存在时，默认值不起作用，给真实的值 5。`},{text:`5
0
0`,correct:!1,why:`第 4 行没写默认值，没有时给 None。`},{text:`5
None
None`,correct:!1,why:`第 5 行写了默认值 0，没有时给 0。`}],tip:`有：给真实的值；没有：给默认值，没写默认值就是 None。`},{type:`fill`,prompt:`咖啡还没进货。屏幕要显示：没有这个饮品`,code:`stock = {"奶茶": 12,
         "果茶": 5}
name = "咖啡"
if {0}:
    print(stock[name])
else:
    print("没有这个饮品")`,tokens:[`name in stock`,`name not in stock`,`stock[name]`],answer:[`name in stock`],expected:`没有这个饮品`,why:{"name not in stock":`条件反了：咖啡不在，条件成立，去取 stock[name]，报 KeyError。`,"stock[name]":`算条件时就在查咖啡，没有这个键，报 KeyError。`},hint:`有才取：先问 name 在不在 stock 里。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 5}
print(stock.get("咖啡", 0))
print("咖啡" in stock)`,options:[{text:`0
False`,correct:!0,why:`.get() 只是查，没有时给 0；不会把咖啡加进字典。`},{text:`0
True`,correct:!1,why:`.get("咖啡", 0) 不会新增键，咖啡还是不在。`},{text:`None
False`,correct:!1,why:`写了默认值 0，没有时给 0。`}],tip:`.get() 只查不改。`}]},{id:`U7L4`,title:`进货与下架`,concept:`新增、del、print(字典)`,story:`给没有的键赋值就是新增：stock["咖啡"] = 8。键名打错也会悄悄新增，不报错。del stock["果茶"] 删掉这一对；删没有的键报 KeyError。print(stock) 显示 {'奶茶': 12, '咖啡': 8}，新增的排在最后。`,introCode:`stock = {"奶茶": 12,
         "果茶": 5}
stock["咖啡"] = 8
del stock["果茶"]
print(stock)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12}
stock["咖啡"] = 8
print(stock)`,options:[{text:`{'奶茶': 12, '咖啡': 8}`,correct:!0,why:`咖啡原来没有，赋值就新增一对，排在最后。`},{text:`{'奶茶': 12}`,correct:!1,why:`第 2 行已经把咖啡加进去了。`},{text:`{'咖啡': 8, '奶茶': 12}`,correct:!1,why:`新增的排在最后，不是最前。`},{text:`报错 KeyError`,correct:!1,why:`给没有的键赋值是新增，不报错；读取没有的键才报错。`}],tip:`键已有：替换；键没有：新增。`},{type:`predict`,prompt:`小码想把果茶改成 4，却把“茶”打成了“查”。点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 5}
stock["果查"] = 4
print(stock["果茶"])
print(stock["果查"])`,options:[{text:`5
4`,correct:!0,why:`第 3 行新增了一个叫“果查”的键；果茶没被改，还是 5。`},{text:`4
4`,correct:!1,why:`“果查”和“果茶”是两个不同的键，果茶没变。`},{text:`5
报错 KeyError`,correct:!1,why:`第 3 行已经新增了“果查”，再读它不会报错。`}],tip:`键名打错不会报错，会多出一个新键。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 5}
del stock["果茶"]
print(stock)`,options:[{text:`{'奶茶': 12}`,correct:!0,why:`del 把果茶的键和值一起删掉。`},{text:`{'奶茶': 12, '果茶': 0}`,correct:!1,why:`del 是整对删掉，不是把值改成 0。`},{text:`{'奶茶': 12, '果茶': 5}`,correct:!1,why:`第 3 行已经删掉了果茶。`}],tip:`del 字典[键]：键和值一起删。`},{type:`order`,prompt:`排好顺序：进货 5 杯果茶，字典里没有果茶就先记成 0。屏幕显示：{'奶茶': 12, '果茶': 5}`,lines:[`stock = {"奶茶": 12}`,`if "果茶" not in stock:`,`    stock["果茶"] = 0`,`new = stock["果茶"] + 5`,`stock["果茶"] = new`,`print(stock)`],shuffled:[4,1,5,3,0,2],answers:[[0,1,2,3,4,5]],expected:`{'奶茶': 12, '果茶': 5}`,hint:`先有字典；没有果茶先记 0；算出加 5 后的数，存回去；最后显示。`}]},{id:`U7L5`,title:`一个一个看`,concept:`for name in stock`,story:`for name in stock: 每一轮 name 是一个键（饮品名），按字典里的顺序。要这个键的值，写 stock[name]。`,introCode:`stock = {"奶茶": 12,
         "果茶": 5}
for name in stock:
    n = stock[name]
    print(name, n)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 5}
for name in stock:
    print(name)`,options:[{text:`奶茶
果茶`,correct:!0,why:`遍历字典，name 依次是每个键。`},{text:`12
5`,correct:!1,why:`name 是键，不是值；值要写 stock[name]。`},{text:`奶茶 12
果茶 5`,correct:!1,why:`循环里只 print(name)，只有键。`}],tip:`for 遍历字典，拿到的是键。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 5}
total = 0
for name in stock:
    n = stock[name]
    total = total + n
print(total)`,options:[{text:`17`,correct:!0,why:`每轮 n 是这个键的值，加到 total 上：12 + 5 = 17。`},{text:`2`,correct:!1,why:`2 是键的个数；这里加的是值 n。`},{text:`5`,correct:!1,why:`total = total + n，每轮累加，不是只留最后一个。`}],tip:`累加值：n = stock[name]，total = total + n。`},{type:`fill`,prompt:`库存少于 5 杯算低库存（正好 5 杯不算）。屏幕要显示低库存有几种：1`,code:`stock = {"奶茶": 12,
         "果茶": 5,
         "咖啡": 3}
low = 0
for name in stock:
    if stock[name] {0} 5:
        low = low + 1
print(low)`,tokens:[`<`,`<=`,`>=`],answer:[`<`],expected:`1`,why:{"<=":`果茶正好 5 杯也被数进去，得 2。`,">=":`数的是不少于 5 杯的，得 2。`},hint:`少于 5：只有咖啡 3 杯。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 0,
         "咖啡": 0}
for name in stock:
    if stock[name] == 0:
        print(name, "卖完")`,options:[{text:`果茶 卖完
咖啡 卖完`,correct:!0,why:`值等于 0 的键有果茶和咖啡，按字典顺序显示。`},{text:`果茶 卖完`,correct:!1,why:`for 会看完每一个键，咖啡也是 0。`},{text:`0 卖完
0 卖完`,correct:!1,why:`name 是键（饮品名），不是值。`}],tip:`遍历时用 stock[name] 判断，用 name 显示名字。`}]},{id:`U7L6`,title:`项目：库存小程序`,concept:`先问有没有，再问够不够，最后才改`,story:`顾客点了 name 饮品 cups 杯。没有这个饮品：显示“没有这个饮品”；杯数比库存多：显示“库存不足”；否则减库存，显示“成交”和“剩 N 杯”（正好卖完也算成交）。最后都 print(stock)。`,introCode:`stock = {"奶茶": 12,
         "果茶": 5}
name = "果茶"
cups = 8
n = stock[name] - cups
stock[name] = n
print("成交")
print("剩", n, "杯")
print(stock)`,exercises:[{type:`predict`,prompt:`起始程序没有检查库存是否足够，直接扣减库存。点 8 杯果茶（只有 5 杯），屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 5}
name = "果茶"
cups = 8
n = stock[name] - cups
stock[name] = n
print("成交")
print("剩", n, "杯")
print(stock)`,options:[{text:`成交
剩 -3 杯
{'奶茶': 12, '果茶': -3}`,correct:!0,why:`程序没检查够不够，直接减成了 -3。不报错，但结果是错的。`},{text:`库存不足
{'奶茶': 12, '果茶': 5}`,correct:!1,why:`程序里还没有检查库存的 if。`},{text:`报错`,correct:!1,why:`果茶存在，5 - 8 能算，不会报错。`}],tip:`没报错不等于对：要对一对输出。`},{type:`fill`,prompt:`先处理“没有这个饮品”。点 2 杯咖啡，屏幕要显示：没有这个饮品，再显示原来的库存表`,code:`stock = {"奶茶": 12,
         "果茶": 5}
name = "咖啡"
cups = 2
if name {0} stock:
    print("没有这个饮品")
else:
    n = stock[name] - cups
    stock[name] = n
    print("成交")
    print("剩", n, "杯")
print(stock)`,tokens:[`not in`,`in`],answer:[`not in`],expected:`没有这个饮品
{'奶茶': 12, '果茶': 5}`,why:{in:`条件反了：咖啡不在，走 else 去取 stock[name]，报 KeyError。`},hint:`先问：name 不在 stock 里吗？`},{type:`fill`,prompt:`再处理“库存不足”。果茶正好 5 杯，点 5 杯算成交。屏幕要显示：成交、剩 0 杯，再显示库存表`,code:`stock = {"奶茶": 12,
         "果茶": 5}
name = "果茶"
cups = 5
if name not in stock:
    print("没有这个饮品")
elif cups {0} stock[name]:
    print("库存不足")
else:
    n = stock[name] - cups
    stock[name] = n
    print("成交")
    print("剩", n, "杯")
print(stock)`,tokens:[`>`,`>=`,`==`],answer:[`>`],expected:`成交
剩 0 杯
{'奶茶': 12, '果茶': 0}`,why:{">=":`5 >= 5 成立，正好卖完被当成库存不足。`,"==":`5 == 5 成立，正好卖完被当成库存不足。`},hint:`只有杯数比库存多才算不足。`},{type:`predict`,prompt:`三种情况都写好了。点 8 杯果茶（只有 5 杯），屏幕上会显示什么？`,code:`stock = {"奶茶": 12,
         "果茶": 5}
name = "果茶"
cups = 8
if name not in stock:
    print("没有这个饮品")
elif cups > stock[name]:
    print("库存不足")
else:
    n = stock[name] - cups
    stock[name] = n
    print("成交")
    print("剩", n, "杯")
print(stock)`,options:[{text:`库存不足
{'奶茶': 12, '果茶': 5}`,correct:!0,why:`果茶存在；8 > 5，走“库存不足”分支。这个分支只显示提示，不改 stock，最后显示的表里果茶还是 5。`},{text:`成交
剩 -3 杯
{'奶茶': 12, '果茶': -3}`,correct:!1,why:`elif cups > stock[name] 是 8 > 5，成立，走的是“库存不足”，不会进 else 去扣库存。`},{text:`库存不足
{'奶茶': 12, '果茶': -3}`,correct:!1,why:`“库存不足”分支里只有 print，没有给 stock 写值，果茶不会变成 -3。`},{text:`库存不足`,correct:!1,why:`最后一行 print(stock) 不在 if 里，每种情况都会运行，还会显示库存表。`}],tip:`库存不足时只显示提示，库存不变。`}],pending:[{type:`modify`,replaces:4,status:`待 Claude 的代码题运行器，暂不开放`,plan:`改一改（项目）：库存小程序；不存在、库存不足、成交三种情况，最后 print(stock)。替换第 4 题：M1 的公开测试“8 杯果茶，库存不足”要求库存表不变，覆盖第 4 题的考点`,task:{id:`U7L6-M1`,version:1,type:`modify`,prompt:`已经准备好 stock（库存表）、name（饮品）、cups（杯数，正整数）。规则：① name 不在 stock 里：输出“没有这个饮品”。② cups 比库存多：输出“库存不足”。③ 其余：库存减去 cups，输出“成交”，再输出“剩 N 杯”（正好卖完也算成交）。①② 库存不变。最后都 print(stock)。起始程序只写了“成交”，请改好。`,given:[`stock`,`name`,`cups`],checkMode:`output`,code:`n = stock[name] - cups
stock[name] = n
print("成交")
print("剩", n, "杯")
print(stock)
`,tests:[{name:`3 杯奶茶，够`,data:{stock:{奶茶:12,果茶:5},name:`奶茶`,cups:3},expected:`成交
剩 9 杯
{'奶茶': 9, '果茶': 5}`},{name:`8 杯果茶，库存不足`,data:{stock:{奶茶:12,果茶:5},name:`果茶`,cups:8},expected:`库存不足
{'奶茶': 12, '果茶': 5}`},{name:`咖啡，不存在`,data:{stock:{奶茶:12,果茶:5},name:`咖啡`,cups:2},expected:`没有这个饮品
{'奶茶': 12, '果茶': 5}`},{name:`正好卖完`,data:{stock:{奶茶:12,果茶:5},name:`果茶`,cups:5},expected:`成交
剩 0 杯
{'奶茶': 12, '果茶': 0}`,hidden:!0},{name:`库存已经是 0`,data:{stock:{奶茶:12,果茶:0},name:`果茶`,cups:1},expected:`库存不足
{'奶茶': 12, '果茶': 0}`,hidden:!0},{name:`换一张库存表：不存在`,data:{stock:{咖啡:4,奶茶:1},name:`果茶`,cups:1},expected:`没有这个饮品
{'咖啡': 4, '奶茶': 1}`,hidden:!0},{name:`换一张库存表：成交`,data:{stock:{咖啡:4,奶茶:1},name:`咖啡`,cups:3},expected:`成交
剩 1 杯
{'咖啡': 1, '奶茶': 1}`,hidden:!0}],hints:[`先运行，读最后一行的错误类型；不报错也要对一对三种情况的输出。`,`用 if / elif / else：先问 name not in stock，再问 cups > stock[name]，最后才改库存；print(stock) 写在 if 外面。`],reference:`if name not in stock:
    print("没有这个饮品")
elif cups > stock[name]:
    print("库存不足")
else:
    n = stock[name] - cups
    stock[name] = n
    print("成交")
    print("剩", n, "杯")
print(stock)
`,worked:{code:`books = {"童话": 3,
         "科幻": 0}
title = "科幻"
if title not in books:
    print("没有这本书")
elif books[title] == 0:
    print("已借完")
else:
    n = books[title] - 1
    books[title] = n
    print("借走一本")`,output:`已借完`,explain:`先问在不在，再问还有没有，两个检查都过了才改数量。`},alternatives:[`if name in stock:
    have = stock[name]
    if cups <= have:
        n = have - cups
        stock[name] = n
        print("成交")
        print("剩", n, "杯")
    else:
        print("库存不足")
else:
    print("没有这个饮品")
print(stock)
`,`if name not in stock:
    print("没有这个饮品")
elif stock[name] < cups:
    print("库存不足")
else:
    n = stock[name] - cups
    stock[name] = n
    print("成交")
    print("剩", n, "杯")
print(stock)
`],wrongAnswers:[{code:`if name not in stock:
    print("没有这个饮品")
elif cups >= stock[name]:
    print("库存不足")
else:
    n = stock[name] - cups
    stock[name] = n
    print("成交")
    print("剩", n, "杯")
print(stock)
`,why:`边界：正好卖完也算成交，用 > 不用 >=`},{code:`if cups > stock[name]:
    print("库存不足")
elif name not in stock:
    print("没有这个饮品")
else:
    n = stock[name] - cups
    stock[name] = n
    print("成交")
    print("剩", n, "杯")
print(stock)
`,why:`顺序反了：先取 stock[name]，不存在的饮品直接 KeyError`},{code:`have = stock.get(name, 0)
if cups > have:
    print("库存不足")
else:
    n = stock[name] - cups
    stock[name] = n
    print("成交")
    print("剩", n, "杯")
print(stock)
`,why:`把不存在当成库存 0，输出了“库存不足”；两种情况要分开`}],requiresVariationAfterSolution:!0,variation:{id:`U7L6-M1-V1`,prompt:`库存不足时，在“库存不足”下面再输出一行“还差 N 杯”（N = cups 减库存），其他不变，最后仍 print(stock)。`,starter:`# stock、name、cups 已备好
`,tests:[{name:`8 杯果茶`,data:{stock:{奶茶:12,果茶:5},name:`果茶`,cups:8},expected:`库存不足
还差 3 杯
{'奶茶': 12, '果茶': 5}`},{name:`3 杯奶茶`,data:{stock:{奶茶:12,果茶:5},name:`奶茶`,cups:3},expected:`成交
剩 9 杯
{'奶茶': 9, '果茶': 5}`},{name:`正好卖完`,data:{stock:{奶茶:12,果茶:5},name:`果茶`,cups:5},expected:`成交
剩 0 杯
{'奶茶': 12, '果茶': 0}`,hidden:!0},{name:`咖啡，不存在`,data:{stock:{奶茶:12,果茶:5},name:`咖啡`,cups:2},expected:`没有这个饮品
{'奶茶': 12, '果茶': 5}`,hidden:!0},{name:`差 8 杯`,data:{stock:{奶茶:2},name:`奶茶`,cups:10},expected:`库存不足
还差 8 杯
{'奶茶': 2}`,hidden:!0}],hints:[`顺序不变：先判断不存在，再判断不足，最后才改库存。`,`不足时：先 d = cups - stock[name]，再 print("还差", d, "杯")。`],solution:`if name not in stock:
    print("没有这个饮品")
elif cups > stock[name]:
    print("库存不足")
    d = cups - stock[name]
    print("还差", d, "杯")
else:
    n = stock[name] - cups
    stock[name] = n
    print("成交")
    print("剩", n, "杯")
print(stock)
`}}}]}]},p={print:{word:`print`,full:`print`,ipa:`/prɪnt/`,meaning:`打印；印出`,python:`把括号里的内容显示到屏幕上，也就是「输出」。`,example:`print("你好")`,note:`不是缩写，就是普通英文单词 print。`,source:`https://dictionary.cambridge.org/dictionary/english/print`},string:{word:`string`,full:`string`,ipa:`/strɪŋ/`,meaning:`字符串；一串文字字符`,python:`Python 里的一段文字，要放在英文引号里，例如 "珍珠奶茶"。`,example:`drink = "珍珠奶茶"`,note:`不是缩写，就是普通英文单词 string（本意是「线、一串」）。`,source:`https://dictionary.cambridge.org/dictionary/english/string`},len:{word:`len`,full:`length`,ipa:`/leŋθ/`,meaning:`长度`,python:`len(...) 返回括号里文字的字符个数。`,example:`len("珍珠奶茶")`,note:`len 是完整单词 length 的缩写。`,source:`https://dictionary.cambridge.org/dictionary/english/length`}},m={caseMs:5e3,totalMs:1e4,readyCapMs:3e4},h={PASS:`pass`,WRONG:`wrong-output`,WRONG_FILE:`wrong-file`,WRONG_RETURN:`wrong-return`,ERROR:`error`,CASE_TIMEOUT:`case-timeout`,TOTAL_TIMEOUT:`total-timeout`,OUTPUT_LIMIT:`output-limit`,UNAVAILABLE:`unavailable`,INTERNAL:`internal`,CANCELLED:`cancelled`},g=e=>`${Math.round(e/100)/10} 秒`;function _(e,t=m){return{[h.PASS]:`通过`,[h.WRONG]:`输出和期望不一致`,[h.WRONG_FILE]:`输出文件的内容和期望不一致，或者文件没有生成`,[h.WRONG_RETURN]:`函数的返回值和期望不一致`,[h.ERROR]:`程序运行出错`,[h.CASE_TIMEOUT]:`这一组测试运行超过 ${g(t.caseMs)}，已停止（可能有死循环）。这次不算作答，不扣红心，代码已保留，改好后再检查`,[h.TOTAL_TIMEOUT]:`全部测试合计超过 ${g(t.totalMs)}，已停止（程序可能太慢或有死循环）。这次不算作答，不扣红心，代码已保留，改好后再检查`,[h.OUTPUT_LIMIT]:`输出超过安全上限，已停止，请检查循环或打印次数。这次不算作答，不扣红心，代码已保留`,[h.UNAVAILABLE]:`Python 环境暂时不可用，这次不算作答，代码已保留，请重试`,[h.INTERNAL]:`判题出了内部问题，这次不算作答，代码已保留，请重试`,[h.CANCELLED]:`已取消，这次不算作答`}[e]}var v=e=>String(e??``).replace(/\r\n?/g,`
`),y=e=>e.endsWith(`
`)?e.slice(0,-1):e;function b(e,t=`strict`){let n=v(e);return t===`lenient`?n.split(`
`).map(e=>e.replace(/[ \t]+$/,``)).join(`
`).replace(/\n+$/,``):y(n)}var x=()=>globalThis.performance?performance.now():Date.now();function S({code:e,files:t,entry:n}){if(Array.isArray(t)){let e={};for(let n of t){if(!n||typeof n.path!=`string`||typeof n.content!=`string`||!n.path)return null;e[n.path]=n.content}let r=n||`main.py`;return r in e?{files:e,entry:r,code:e[r]}:null}return typeof e==`string`?{files:{"main.py":e},entry:`main.py`,code:e}:null}var C=e=>e&&typeof e==`object`&&!Array.isArray(e),w=e=>C(e)&&Object.values(e).every(e=>typeof e==`string`);function T(e,t){return Array.isArray(e)&&e.length>0&&e.every(e=>C(e)&&(e.stdin===void 0||typeof e.stdin==`string`||Array.isArray(e.stdin)&&e.stdin.every(e=>typeof e==`string`))&&(e.files===void 0||w(e.files))&&(e.expectedFiles===void 0||w(e.expectedFiles))&&(t===`call`?C(e.call)&&typeof e.call.fn==`string`&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(e.call.fn)&&`expectedReturn`in e:typeof e.expected==`string`))}var E=`__judge_result__.json`;function ee(e){let t=JSON.stringify({fn:e.call.fn,args:e.call.args??[],kwargs:e.call.kwargs??{},expected:e.expectedReturn,tol:e.tol??1e-9});return`

# ---- 判题器附加的代码（不属于学生代码）----
def _jg_same(a, e, tol):
    if isinstance(e, bool) or isinstance(a, bool):
        return isinstance(e, bool) and isinstance(a, bool) and a == e
    if isinstance(e, (int, float)):
        if not isinstance(a, (int, float)):
            return False
        return abs(a - e) <= tol * max(1.0, abs(e))
    if isinstance(e, list):
        return isinstance(a, (list, tuple)) and len(a) == len(e) and all(_jg_same(x, y, tol) for x, y in zip(a, e))
    if isinstance(e, dict):
        return isinstance(a, dict) and {str(k): v for k, v in a.items()}.keys() == e.keys() and all(_jg_same(v, e[str(k)], tol) for k, v in a.items())
    return type(a) is type(e) and a == e
def _jg_run():
    import json as _j
    p = _j.loads(${JSON.stringify(t)})
    res = {"ok": False, "missing": False, "actual": ""}
    f = globals().get(p["fn"])
    if not callable(f):
        res["missing"] = True
    else:
        a = f(*p["args"], **p["kwargs"])
        res["ok"] = bool(_jg_same(a, p["expected"], p["tol"]))
        try:
            res["actual"] = repr(a)[:200]
        except BaseException:
            res["actual"] = "<无法显示>"
    with open(${JSON.stringify(E)}, "w", encoding="utf-8") as fh:
        fh.write(_j.dumps(res, ensure_ascii=False))
_jg_run()
`}async function te({code:e,files:t,entry:n,tests:r,checkMode:i=`output`,compare:a=`strict`,limits:o={}},s,{signal:c}={}){let l={...m,...o},u=0,d=(e,t,n,r)=>({status:e,attempt:!1,settle:!1,retry:e!==`cancelled`,totalMs:Math.round(u),cases:[...r,{...n,ok:!1,kind:t,ms:0,message:_(t,l)}]}),f={name:``,hidden:!1},p=S({code:e,files:t,entry:n});if(i!==`output`&&i!==`call`||a!==`strict`&&a!==`lenient`||!p||!T(r,i))return d(`internal-error`,h.INTERNAL,f,[]);let g=[],v=(e,t)=>({status:t.kind===h.OUTPUT_LIMIT?`output-limit`:`timeout`,attempt:!1,settle:!1,retry:!0,totalMs:Math.round(u),cases:[...e,t]});for(let e of r){let t={name:e.name,hidden:!!e.hidden};if(c?.aborted)return d(`cancelled`,h.CANCELLED,t,[]);let n=l.totalMs-u;if(n<=0)return v(g,{...t,ok:!1,kind:h.TOTAL_TIMEOUT,ms:0,message:_(h.TOTAL_TIMEOUT,l)});let r=n<l.caseMs,o=Math.max(1,Math.min(l.caseMs,n)),f,m=x(),y={...e.files||{},...p.files};i===`call`&&(y[p.entry]=p.files[p.entry]+ee(e));let S=[...Object.keys(e.expectedFiles||{}),...i===`call`?[E]:[]];try{f=await s.exec({code:y[p.entry],files:y,entry:p.entry,data:e.data??null,stdin:e.stdin??null,readFiles:S,timeoutMs:o,signal:c,readyCapMs:l.readyCapMs})}catch(e){return e&&e.cancelled?d(`cancelled`,h.CANCELLED,t,[]):e&&e.unavailable?d(`unavailable`,h.UNAVAILABLE,t,[]):d(`internal-error`,h.INTERNAL,t,[])}let C=typeof f.ms==`number`?f.ms:x()-m;u+=f.timedOut?Math.max(C,o):C;let w,T=``,te=[];if(f.timedOut)w=r?h.TOTAL_TIMEOUT:h.CASE_TIMEOUT;else if(f.limitHit)w=h.OUTPUT_LIMIT;else if(f.error&&f.error.kind===`InternalError`)return d(`internal-error`,h.INTERNAL,t,[]);else if(f.error)w=h.ERROR;else if(i===`call`){let t=null;try{t=JSON.parse(f.files?.[`__judge_result__.json`]??`null`)}catch{t=null}t?t.missing?(w=h.ERROR,f={...f,error:{kind:`NameError`,line:null,msg:`没有找到函数 ${e.call.fn}，请检查函数名`}}):(w=t.ok?h.PASS:h.WRONG_RETURN,T=t.actual):(w=h.ERROR,f={...f,error:{kind:`NoResult`,line:null,msg:`程序没有走到函数调用就结束了（是不是提前 exit 了？）`}})}else{let t=b(f.stdout,a)===b(e.expected,a),n=Object.entries(e.expectedFiles||{}).filter(([e,t])=>typeof f.files?.[e]!=`string`||b(f.files[e],a)!==b(t,a)).map(([e])=>e);w=t?n.length?h.WRONG_FILE:h.PASS:h.WRONG,te=n}let D={...t,ok:w===h.PASS,kind:w,ms:Math.round(C),message:_(w,l)};if(w===h.ERROR&&(D.error=f.error,i===`call`&&D.error&&D.error.line>p.files[p.entry].split(`
`).length&&(D.error={...D.error,line:null})),!D.hidden&&w!==h.PASS&&w!==h.ERROR&&(i===`call`?(D.expected=JSON.stringify(e.expectedReturn),D.actualReturn=T):(D.expected=e.expected,D.stdout=f.stdout??``,w===h.WRONG_FILE&&(D.files=te.map(t=>({path:t,expected:e.expectedFiles[t],actual:typeof f.files?.[t]==`string`?f.files[t]:null}))))),w===h.CASE_TIMEOUT||w===h.TOTAL_TIMEOUT||w===h.OUTPUT_LIMIT)return v(g,D);g.push(D)}return{status:g.every(e=>e.ok)?`pass`:`fail`,attempt:!0,settle:g.length===r.length,retry:!1,cases:g,totalMs:Math.round(u)}}function D(e){async function t(t){(e.state===`idle`||e.state===`loadError`)&&e.boot();let n=await e.whenReady(t);if(n!==`ready`)throw{unavailable:!0,reason:n}}let n=Promise.resolve();async function r({code:n,files:r,entry:i,data:a,stdin:o,readFiles:s,timeoutMs:c,signal:l,readyCapMs:u=m.readyCapMs}){if(l?.aborted||(await t(u),l?.aborted))throw{cancelled:!0};let d={files:r||{"main.py":n},entry:i||`main.py`,stdin:o??null,read:s||[]};return new Promise((t,r)=>{let i=``,o=!1,s=0,u=null,f=e.onStatus,p=e.onOutput,m=()=>{h(()=>r({cancelled:!0})),e.stop()};function h(t){o||(o=!0,clearTimeout(u),e.onStatus=f,e.onOutput=p,l?.removeEventListener?.(`abort`,m),t())}let g=()=>s?x()-s:0;e.onOutput=e=>{i+=e},e.onStatus=(e,n)=>{e!==`running`&&(e===`done`?h(()=>t({stdout:i,error:n?.error??null,timedOut:!1,limitHit:!1,ms:g(),files:n?.files??null})):e===`stopped`||e===`timeout`?h(()=>t({stdout:i,error:null,timedOut:!0,limitHit:!1,ms:g()})):e===`outputLimit`||e===`outputLimitStopped`?h(()=>t({stdout:i,error:null,timedOut:!1,limitHit:!0,ms:g()})):e===`loadError`?h(()=>r({unavailable:!0})):f?.(e,n))},l?.addEventListener?.(`abort`,m);try{if(s=x(),!e.run(n,a,d))return h(()=>r({unavailable:!0,reason:`not-ready`}));u=setTimeout(()=>{o||e.stop()},c)}catch(e){h(()=>r(e instanceof Error?e:Error(String(e))))}})}return{exec(e){let t=n.then(()=>r(e));return n=t.catch(()=>{}),t}}}var ne=i({DEFAULT_STYLE:()=>`J`,EVENTS:()=>ce,KEY_SOUNDS:()=>O,TRIMS:()=>oe,measureKey:()=>P,renderEvent:()=>le,renderKey:()=>se}),O=[{id:`A`,name:`清脆矮轴`,desc:`短促、干净、轻微触底声`},{id:`B`,name:`奶油矮轴`,desc:`更柔和，低频稍多`},{id:`C`,name:`轻段落轴`,desc:`按下时有轻微的段落感`},{id:`D`,name:`铝板矮轴`,desc:`清脆，带极短的金属感`},{id:`E`,name:`塑料外壳`,desc:`轻巧、偏明亮`},{id:`F`,name:`静音矮轴`,desc:`声音很短、很克制`},{id:`G`,name:`深沉矮轴`,desc:`触底声稍厚`},{id:`H`,name:`弹性垫片`,desc:`柔软，带一点回弹感`},{id:`I`,name:`陶瓷清响`,desc:`清亮但不刺耳`},{id:`J`,name:`极简 Tap`,desc:`非常短，适合连续点击`}],k=1,re=null;function ie(e){if(re&&re.sampleRate===e.sampleRate)return re;let t=Math.floor(e.sampleRate*.12),n=e.createBuffer(1,t,e.sampleRate),r=n.getChannelData(0),i=12345;for(let e=0;e<t;e++)i=i*1664525+1013904223>>>0,r[e]=i/4294967296*2-1;return re=n,n}function A(e,t,n,{freq:r,q:i=1,dur:a=.012,gain:o=.5,type:s=`bandpass`}){let c=e.createBufferSource();c.buffer=ie(e);let l=e.createBiquadFilter();l.type=s,l.frequency.value=r*k,l.Q.value=i;let u=e.createGain();return u.gain.setValueAtTime(1e-4,n),u.gain.exponentialRampToValueAtTime(o,n+8e-4),u.gain.exponentialRampToValueAtTime(1e-4,n+a),c.connect(l),l.connect(u),u.connect(t),c.start(n),c.stop(n+a+.01),n+a}function j(e,t,n,{from:r,to:i,dur:a=.05,gain:o=.3,type:s=`sine`}){let c=e.createOscillator();c.type=s,c.frequency.setValueAtTime(r*k,n),c.frequency.exponentialRampToValueAtTime(i*k,n+a);let l=e.createGain();return l.gain.setValueAtTime(1e-4,n),l.gain.exponentialRampToValueAtTime(o,n+.003),l.gain.exponentialRampToValueAtTime(1e-4,n+a),c.connect(l),l.connect(t),c.start(n),c.stop(n+a+.01),n+a}function ae(e,t,n,{freq:r,dur:i=.05,gain:a=.1}){let o=e.createOscillator();o.type=`sine`,o.frequency.value=r*k;let s=e.createGain();return s.gain.setValueAtTime(1e-4,n),s.gain.exponentialRampToValueAtTime(a,n+.001),s.gain.exponentialRampToValueAtTime(1e-4,n+i),o.connect(s),s.connect(t),o.start(n),o.stop(n+i+.01),n+i}var M={A:{trim:.98,run:(e,t,n)=>Math.max(A(e,t,n,{freq:3500,q:1.2,dur:.014,gain:.5}),j(e,t,n,{from:220,to:140,dur:.045,gain:.35}),A(e,t,n+.022,{freq:2200,q:.9,dur:.018,gain:.25,type:`bandpass`}))},B:{trim:.6,run:(e,t,n)=>Math.max(A(e,t,n,{freq:1800,q:.8,dur:.018,gain:.35}),j(e,t,n,{from:170,to:100,dur:.075,gain:.5}))},C:{trim:1.19,run:(e,t,n)=>Math.max(A(e,t,n,{freq:4200,q:1.2,dur:.008,gain:.35}),A(e,t,n+.028,{freq:3e3,q:1,dur:.012,gain:.4}),j(e,t,n+.028,{from:200,to:130,dur:.05,gain:.3}))},D:{trim:1.07,run:(e,t,n)=>Math.max(A(e,t,n,{freq:3800,q:1.2,dur:.012,gain:.45}),j(e,t,n,{from:190,to:120,dur:.045,gain:.3}),ae(e,t,n+.002,{freq:2600,dur:.065,gain:.12}))},E:{trim:1.81,run:(e,t,n)=>Math.max(A(e,t,n,{freq:4800,q:.9,dur:.016,gain:.45}),j(e,t,n,{from:300,to:200,dur:.04,gain:.25,type:`triangle`}))},F:{trim:1.93,run:(e,t,n)=>Math.max(A(e,t,n,{freq:1500,q:.8,dur:.01,gain:.22}),j(e,t,n,{from:150,to:110,dur:.04,gain:.22}))},G:{trim:.48,run:(e,t,n)=>Math.max(j(e,t,n,{from:140,to:80,dur:.09,gain:.6}),A(e,t,n,{freq:1200,q:.8,dur:.014,gain:.4}))},H:{trim:.8,run:(e,t,n)=>Math.max(j(e,t,n,{from:190,to:120,dur:.055,gain:.4}),j(e,t,n+.03,{from:260,to:200,dur:.035,gain:.15}),A(e,t,n,{freq:2400,q:1,dur:.012,gain:.3}))},I:{trim:1.1,run:(e,t,n)=>Math.max(ae(e,t,n,{freq:3200,dur:.075,gain:.22}),ae(e,t,n,{freq:4800,dur:.05,gain:.08}),A(e,t,n,{freq:5200,q:1.2,dur:.006,gain:.25}),j(e,t,n,{from:260,to:180,dur:.03,gain:.15}))},J:{trim:1.45,run:(e,t,n)=>Math.max(A(e,t,n,{freq:3e3,q:1,dur:.008,gain:.45}),j(e,t,n,{from:240,to:170,dur:.04,gain:.25}))}},oe=Object.fromEntries(Object.entries(M).map(([e,t])=>[e,t.trim]));function N(e,t,n,r,i,a){let o=e.createGain();o.gain.value=M[n].trim*a,o.connect(t),k=i;try{return M[n].run(e,o,r)-r}finally{k=1}}function se(e,t,n,r){return Math.round(N(e,t,n,r,1,1)*1e3)}var ce={select:[[0,1,1]],place:[[0,.82,1.1]],undo:[[0,1.25,.9]],correct:[[0,1,.9],[.075,1.5,1]],wrong:[[0,.8,.9],[.085,.6,.9]],finish:[[0,1,.8],[.09,1.25,.9],[.18,1.5,1]]};function le(e,t,n,r,i){let a=0;for(let[o,s,c]of ce[r])a=Math.max(a,o+N(e,t,n,i+o,s,c));return Math.round(a*1e3)}async function P(e,t=`select`){let n=44100,r=new OfflineAudioContext(1,26460,n),i=le(r,r.destination,e,t,0),a=(await r.startRendering()).getChannelData(0),o=0;for(let e=0;e<a.length;e++){let t=Math.abs(a[e]);t>o&&(o=t)}let s=0;for(let e=a.length-1;e>=0;e--)if(Math.abs(a[e])>o*.01){s=e;break}let c=0;for(let e=0;e<a.length;e++)c+=a[e]*a[e];return{ms:i,audibleMs:Math.round(s/n*1e3),peak:o,rms:Math.sqrt(c/(.1*n))}}var ue=i({activeCount:()=>xe,audioContext:()=>Te,currentStyle:()=>we,diagnostics:()=>ke,haptic:()=>Oe,hapticsSupported:()=>me,log:()=>de,masterNode:()=>Ee,play:()=>z,playStyle:()=>Ce,preview:()=>De,reducedMotion:()=>pe,setPrefs:()=>he,stats:()=>I,unlock:()=>ve}),F={sound:!0,haptics:!0,soundStyle:`J`},de=[],fe=e=>{de.push(e),de.length>200&&de.shift()},I={played:0,dropped:0,resumed:0,unlocks:0,lastError:``,history:[]},pe=()=>{try{return matchMedia(`(prefers-reduced-motion: reduce)`).matches}catch{return!1}},me=()=>typeof navigator<`u`&&typeof navigator.vibrate==`function`;function he(e){F.sound=e?.sound!==!1,F.haptics=e?.haptics!==!1,F.soundStyle=O.some(t=>t.id===e?.soundStyle)?e.soundStyle:`J`}var L=null,ge=null;function _e(){if(L)return L;try{let e=window.AudioContext||window.webkitAudioContext;if(!e)return I.lastError=`浏览器没有 AudioContext`,null;L=new e,I.history.push(`创建:${L.state}`),L.addEventListener?.(`statechange`,()=>{I.history.push(`→${L.state}`),I.history.length>8&&I.history.shift()}),ge=L.createGain(),ge.gain.value=.9,ge.connect(L.destination);try{navigator.audioSession&&(navigator.audioSession.type=`ambient`)}catch{}}catch(e){L=null,I.lastError=`创建音频失败：`+(e?.message||e)}return L}function ve(){let e=_e();if(e)try{if(e.state!==`running`){I.unlocks++,e.resume().then(()=>{I.resumed++}).catch(e=>{I.lastError=`resume 失败：`+(e?.message||e)});let t=e.createBufferSource();t.buffer=e.createBuffer(1,1,22050),t.connect(e.destination),t.start(0)}}catch(e){I.lastError=`解锁失败：`+(e?.message||e)}}var ye={select:40,place:55,undo:40,correct:140,wrong:150,finish:280},be={},R=[],xe=()=>R.filter(e=>e.until>performance.now()).length;function Se(e,t,n=F.soundStyle){let r=performance.now();for(R=R.filter(e=>e.until>r);R.length>=3;){let t=R.shift();try{t.gain.gain.cancelScheduledValues?.(e.currentTime),t.gain.gain.setValueAtTime?.(t.gain.gain.value??1,e.currentTime),t.gain.gain.linearRampToValueAtTime?.(1e-4,e.currentTime+.01)}catch{}}let i=e.createGain();i.connect(ge);let a=le(e,i,n,t,e.currentTime+.005);R.push({gain:i,until:r+Math.max(a,ye[t]||0)+20}),I.played++}function z(e,{force:t=!1}={}){if(!F.sound&&!t||!ce[e])return Promise.resolve(!1);fe(e);try{let n=performance.now();if(!t&&n-(be[e]||-1e9)<25)return Promise.resolve(!1);be[e]=n;let r=_e();if(!r)return I.dropped++,Promise.resolve(!1);if(r.state===`running`)return Se(r,e),Promise.resolve(!0);let i=performance.now();return r.resume().then(()=>r.state===`running`&&performance.now()-i<(t?2e3:300)?(I.resumed++,Se(r,e),!0):(I.dropped++,!1)).catch(e=>(I.dropped++,I.lastError=`resume 失败：`+(e?.message||e),!1))}catch(e){return I.lastError=`播放失败：`+(e?.message||e),Promise.resolve(!1)}}function Ce(e,t=`select`){ve();let n=_e();if(!n||!O.some(t=>t.id===e)||!ce[t])return{ok:!1,state:n?n.state:`不可用`};fe(`${e}:${t}`);try{return Se(n,t,e),{ok:n.state===`running`,state:n.state}}catch(e){return I.lastError=`试听失败：`+(e?.message||e),{ok:!1,state:n.state}}}var we=()=>F.soundStyle;function Te(){return ve(),_e()}function Ee(){return ge}function De(){return ve(),z(`correct`,{force:!0})}function Oe(){if(F.haptics&&me()){fe(`haptic`);try{navigator.vibrate(12)}catch{}}}function ke(){return{audioState:L?L.state:`未创建`,sampleRate:L?L.sampleRate:0,hasAudioContext:!!(window.AudioContext||window.webkitAudioContext),audioSession:(()=>{try{return navigator.audioSession?navigator.audioSession.type:`无`}catch{return`无`}})(),vibrate:me(),soundPref:F.sound,soundStyle:F.soundStyle,hapticsPref:F.haptics,...I,history:I.history.join(` `)}}if(typeof document<`u`){for(let e of[`touchend`,`click`,`keydown`])document.addEventListener(e,ve,{capture:!0,passive:!0});document.addEventListener(`visibilitychange`,()=>{L&&(document.visibilityState===`hidden`?L.suspend().catch(()=>{}):L.resume().catch(()=>{}))})}var Ae=`suipian.progress`,B=18e5;function je(){return{version:3,onboarded:!1,xp:0,hearts:5,heartsAt:Date.now(),streak:0,lastDay:null,done:{},doneOn:{},lessonsCompleted:0,installTipClosed:!1,lastActive:0,prefs:{sound:!0,haptics:!0,soundStyle:`J`}}}function Me(e){let t=je();return t.installTipClosed=!!e.installTipClosed,{state:t,notice:`课程改版为关卡模式，旧版的学习记录不再使用，请从第一关开始。`}}var Ne=`suipian.progress.unreadable.`,Pe=3;function Fe(e){try{localStorage.setItem(Ne+Date.now(),e);let t=[];for(let e=0;e<localStorage.length;e++){let n=localStorage.key(e);n&&n.startsWith(Ne)&&t.push(n)}for(t.sort();t.length>Pe;)localStorage.removeItem(t.shift())}catch{}}function Ie(){let e=[];try{for(let t=0;t<localStorage.length;t++){let n=localStorage.key(t);n&&n.startsWith(Ne)&&e.push({key:n,savedAt:Number(n.slice(28)),raw:localStorage.getItem(n)})}}catch{}return e.sort((e,t)=>t.savedAt-e.savedAt)}function Le(){let e;try{e=localStorage.getItem(Ae)}catch{return{state:je(),notice:`这个浏览器不允许保存进度（可能是无痕模式），关掉页面后进度会丢失。`}}if(!e)return{state:je(),notice:null};let t;try{t=JSON.parse(e)}catch{return Fe(e),{state:je(),notice:`本机记录损坏，已从头开始。`}}if(t&&(t.version===1||t.version===2))return Fe(e),Me(t);if(!t||t.version!==3)return Fe(e),{state:je(),notice:`学习记录的格式无法识别，已从头开始。`};let n=je(),r={...n.prefs,...t.prefs&&typeof t.prefs==`object`?t.prefs:{}};/^[A-J]$/.test(r.soundStyle)||(r.soundStyle=`J`),delete r.keySound;let i={};if(t.doneOn&&typeof t.doneOn==`object`&&!Array.isArray(t.doneOn))for(let[e,n]of Object.entries(t.doneOn))typeof n==`string`&&/^\d{4}-\d{2}-\d{2}$/.test(n)&&(i[e]=n);return{state:{...n,...t,prefs:r,doneOn:i},notice:null}}function Re(e){try{return e.lastActive=Date.now(),localStorage.setItem(Ae,JSON.stringify(e)),!0}catch{return!1}}function ze(){try{localStorage.removeItem(Ae)}catch{}return je()}function Be(e,t=Date.now()){if(e.hearts>=5)return e.heartsAt=t,0;let n=Math.floor((t-e.heartsAt)/B);return n>0&&(e.hearts=Math.min(5,e.hearts+n),e.heartsAt+=n*B,e.hearts>=5&&(e.heartsAt=t)),e.hearts>=5?0:B-(t-e.heartsAt)}function Ve(e,t=Date.now()){Be(e,t),e.hearts>=5&&(e.heartsAt=t),e.hearts=Math.max(0,e.hearts-1)}function He(e=new Date){let t=e=>String(e).padStart(2,`0`);return`${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())}`}function Ue(e,t){let[n,r,i]=e.split(`-`).map(Number),[a,o,s]=t.split(`-`).map(Number);return Math.round((Date.UTC(a,o-1,s)-Date.UTC(n,r-1,i))/864e5)}function We(e,t=new Date){let n=He(t);return e.lastDay!==n&&(e.streak=e.lastDay&&Ue(e.lastDay,n)===1?e.streak+1:1,e.lastDay=n,!0)}function Ge(e,t=new Date){return e.lastDay&&Ue(e.lastDay,He(t))<=1?e.streak:0}var Ke={url:`https://aqlcunkmggzzvyavlkjg.supabase.co`,anonKey:`sb_publishable_Ic9p2Y68XVralcZcAO8b6w_SjeEOIUJ`},qe=`aqlcunkmggzzvyavlkjg`;function Je(e){try{let t=new URL(String(e));return/^https?:$/.test(t.protocol)?t.hostname.toLowerCase():``}catch{return``}}var Ye=Je(Ke.url);function Xe(e){let t=Je(e);return!t||t===Ye||t.split(`.`)[0]===qe||t.includes(qe)}function Ze(){try{let e={url:`https://tqdwhtrextqlmctkryyg.supabase.co`,anonKey:`sb_publishable_5pBMszP8wcZA8F-96D9NdQ_kixPKDDm`};return!e||typeof e.url!=`string`||typeof e.anonKey!=`string`||!e.url.trim()||!e.anonKey.trim()||Xe(e.url.trim())?{url:``,anonKey:``}:{url:e.url.trim(),anonKey:e.anonKey.trim()}}catch{return{url:``,anonKey:``}}}function Qe(){try{if(typeof location<`u`&&/^(localhost|127\.0\.0\.1)$/.test(location.hostname)){let e=JSON.parse(localStorage.getItem(`suipian.cloudConfig`));if(e&&typeof e.url==`string`&&typeof e.anonKey==`string`){let t=e.url.trim(),n=e.anonKey.trim();return Xe(t)?{url:``,anonKey:``}:{url:t,anonKey:n}}}}catch{}return Ze()}var $e=Qe();function et(){let e=Je($e.url);return e?{mode:`test`,host:e,ref:e.endsWith(`.supabase.co`)?e.split(`.`)[0]:``}:{mode:`off`,host:``,ref:``}}var tt=new Set([`session_not_found`,`user_not_found`,`session_expired`]);function nt(e){if(e.status!==401&&e.status!==403&&e.status!==404)return null;let t=e.errorCode||``;return tt.has(t)?`gone`:t===`bad_jwt`||!t&&e.status===401&&/(jwt|token)[^]*(invalid|expired|malformed)|(invalid|expired|malformed)[^]*(jwt|token)/i.test(String(e.message||``))?`token-invalid`:null}var rt=new Set([`refresh_token_not_found`,`refresh_token_already_used`,`session_not_found`,`session_expired`]);function it(e){return e.status!==400&&e.status!==401&&e.status!==403?!1:e.errorCode?rt.has(e.errorCode):e.oauthError===`invalid_grant`||/^Invalid Refresh Token/i.test(String(e.message||``))}function at({url:e,anonKey:t,fetchFn:n=(...e)=>fetch(...e),timeoutMs:r=15e3,isOnline:i=()=>typeof navigator>`u`||navigator.onLine!==!1}){let a=String(e||``).replace(/\/+$/,``),o=!!(a&&t);async function s(e,{method:s=`GET`,body:c,token:l,query:u}={}){if(!o)return{ok:!1,kind:`config`,message:`云端暂未开通`};let d=typeof AbortController<`u`?new AbortController:null,f=!1,p=d?setTimeout(()=>{f=!0,d.abort()},r):null,m;try{m=await n(a+e+(u?`?`+u:``),{method:s,signal:d?.signal,headers:{apikey:t,Authorization:`Bearer `+(l||t),"Content-Type":`application/json`},body:c===void 0?void 0:JSON.stringify(c)})}catch{return{ok:!1,kind:`network`,message:`网络连不上，请检查网络后重试`,...f?{timedOut:!0}:i()?{}:{offline:!0}}}finally{p&&clearTimeout(p)}let h=null,g=await m.text().catch(()=>``);if(g)try{h=JSON.parse(g)}catch{h=g}if(m.ok)return{ok:!0,status:m.status,data:h};let _=h&&(h.msg||h.message||h.error_description||h.error)||`服务器返回 ${m.status}`,v=m.status===429?`rate-limit`:m.status===401||m.status===403?`auth`:`server`,y=h&&typeof h==`object`&&typeof h.error_code==`string`?h.error_code:void 0,b=h&&typeof h==`object`&&typeof h.error==`string`?h.error:void 0,x=Number(typeof m.headers?.get==`function`?m.headers.get(`retry-after`):NaN);return{ok:!1,kind:v,status:m.status,message:String(_),...y?{errorCode:y}:{},...b?{oauthError:b}:{},...Number.isFinite(x)&&x>0?{retryAfterSec:x}:{}}}let c=e=>e&&e.access_token&&e.user?.id?{accessToken:e.access_token,refreshToken:e.refresh_token,expiresAt:Number.isFinite(e.expires_at)?e.expires_at*1e3:Date.now()+(e.expires_in??3600)*1e3,userId:e.user.id,email:e.user.email||``}:null;return{configured:o,async sendCode(e){let t=await s(`/auth/v1/otp`,{method:`POST`,body:{email:e,create_user:!0}});return t.ok?{ok:!0}:t},async verifyCode(e,t){let n=await s(`/auth/v1/verify`,{method:`POST`,body:{type:`email`,email:e,token:String(t).trim()}});if(!n.ok)return{...n.kind===`server`&&n.status&&n.status<500?{...n,kind:`auth`}:n,stage:`verify`};let r=c(n.data);return r?{ok:!0,session:r}:{ok:!1,kind:`server`,message:`登录返回的内容无法识别`}},async refresh(e){let t=await s(`/auth/v1/token`,{method:`POST`,query:`grant_type=refresh_token`,body:{refresh_token:e.refreshToken}});if(!t.ok){let e=t.kind===`server`&&t.status&&t.status<500?{...t,kind:`auth`}:t;return it(t)?{...e,sessionState:`dead`}:e}let n=c(t.data);return n?{ok:!0,session:n}:{ok:!1,kind:`server`,message:`刷新登录返回的内容无法识别`}},async signOut(e,t=`local`){let n=t===`global`||t===`others`?t:`local`,r=await s(`/auth/v1/logout`,{method:`POST`,token:e.accessToken,query:`scope=`+n});if(r.ok)return{ok:!0};let i=nt(r);return i?{...r,sessionState:i}:r},async getProgress(e){let t=await s(`/rest/v1/progress`,{token:e.accessToken,query:`select=doc,rev&limit=2`});return t.ok?!Array.isArray(t.data)||t.data.length>1?{ok:!1,kind:`server`,message:`读到的进度行数不对`}:{ok:!0,row:t.data[0]?{doc:t.data[0].doc,rev:t.data[0].rev}:null}:t},async createProgress(e,t){let n=await s(`/rest/v1/rpc/create_progress`,{method:`POST`,token:e.accessToken,body:{new_doc:t}});return n.ok?{ok:!0,rev:Number.isInteger(n.data)?n.data:null}:n},async saveProgress(e,t,n){let r=await s(`/rest/v1/rpc/save_progress`,{method:`POST`,token:e.accessToken,body:{expected_rev:t,new_doc:n}});return r.ok?{ok:!0,rev:Number.isInteger(r.data)?r.data:null}:r},async deleteAccount(e){let t=await s(`/rest/v1/rpc/delete_my_account`,{method:`POST`,token:e.accessToken,body:{}});return t.ok?{ok:!0}:t}}}var ot=/^[A-Za-z0-9_-]{1,64}$/,st=/^\d{4}-\d{2}-\d{2}$/,ct=/^[0-9a-f]{8}$/,lt=5e3;function ut(){let e=globalThis.crypto;if(e?.randomUUID)return e.randomUUID().replace(/-/g,``).slice(0,24);let t=``;for(let e=0;e<24;e++)t+=Math.floor(Math.random()*16).toString(16);return t}var V=e=>typeof e==`string`&&ot.test(e)&&e!==`__proto__`,H=e=>Number.isFinite(e)&&e>=0?Math.floor(e):0,dt=e=>JSON.parse(JSON.stringify(e)),ft=e=>{let[t,n,r]=e.split(`-`).map(Number);return Date.UTC(t,n-1,r)},pt=e=>{let t=new Date(e),n=e=>String(e).padStart(2,`0`);return`${t.getUTCFullYear()}-${n(t.getUTCMonth()+1)}-${n(t.getUTCDate())}`},mt=(e,t)=>Math.round((ft(t)-ft(e))/864e5),ht=(e,t)=>pt(ft(e)+t*864e5),gt=e=>typeof e==`string`&&st.test(e)&&pt(ft(e))===e;function _t(e){if(!e.length)return 0;let t=1;for(let n=e.length-1;n>0&&mt(e[n-1],e[n])===1;n--)t++;return t}function vt({gen:e=1,lineage:t=ut()}={}){return{schema:1,gen:e,lineage:t,xp:{},runs:{},done:{},days:[],hearts:{n:5,msToNext:0},prefs:{sound:!0,haptics:!0,soundStyle:`J`},imported:{}}}function U(e){if(!e||typeof e!=`object`||Array.isArray(e))return{ok:!1,code:`invalid`,message:`账号记录不是有效的对象`};if(!Number.isInteger(e.schema)||e.schema<1)return{ok:!1,code:`invalid`,message:`账号记录缺少数据版本`};if(e.schema>1)return{ok:!1,code:`schema-newer`,message:`账号记录来自更新的版本，请先更新应用`};if(!Number.isInteger(e.gen)||e.gen<1)return{ok:!1,code:`invalid`,message:`账号记录的代数无效`};if(!V(e.lineage))return{ok:!1,code:`invalid`,message:`账号记录缺少编号`};let t=vt({gen:e.gen,lineage:e.lineage}),n=(e,t)=>{if(e&&typeof e==`object`)for(let[n,r]of Object.entries(e))V(n)&&(t[n]=H(r))};if(n(e.xp,t.xp),n(e.runs,t.runs),e.done&&typeof e.done==`object`)for(let[n,r]of Object.entries(e.done))V(n)&&(t.done[n]=gt(r)?r:``);if(Array.isArray(e.days)&&(t.days=[...new Set(e.days.filter(gt))].sort()),e.hearts&&typeof e.hearts==`object`){let n=Math.min(5,H(e.hearts.n));t.hearts={n,msToNext:n>=5?0:Math.min(B,H(e.hearts.msToNext))}}if(e.prefs&&typeof e.prefs==`object`&&(t.prefs={sound:e.prefs.sound!==!1,haptics:e.prefs.haptics!==!1,soundStyle:/^[A-J]$/.test(e.prefs.soundStyle)?e.prefs.soundStyle:`J`}),e.imported&&typeof e.imported==`object`)for(let[n,r]of Object.entries(e.imported))V(n)&&r&&(t.imported[n]=typeof r==`string`&&ct.test(r)?r:!0);return{ok:!0,doc:t}}var yt=e=>Object.values(e.xp).reduce((e,t)=>e+t,0),bt=e=>Object.values(e.runs).reduce((e,t)=>e+t,0);function xt(e){let t=e=>Object.fromEntries(Object.keys(e).sort().map(t=>[t,e[t]]));return JSON.stringify({...e,xp:t(e.xp),runs:t(e.runs),done:t(e.done),imported:t(e.imported),prefs:t(e.prefs),hearts:t(e.hearts)})}function St(e,t){let n=U(e),r=U(t);return n.ok&&r.ok&&xt(n.doc)===xt(r.doc)}function Ct(e,t,n,r){let i=vt({gen:r.gen,lineage:r.lineage});for(let n of[`xp`,`runs`])for(let r of new Set([...Object.keys(e[n]),...Object.keys(t[n])]))i[n][r]=Math.max(e[n][r]??0,t[n][r]??0);for(let n of new Set([...Object.keys(e.done),...Object.keys(t.done)])){let r=e.done[n],a=t.done[n];i.done[n]=r?a?r<a?r:a:r:a??``}i.days=[...new Set([...e.days,...t.days])].sort(),i.hearts=dt(n.localHeartsDirty?e.hearts:t.hearts),i.prefs=dt(n.localPrefsDirty?e.prefs:t.prefs),i.imported={...e.imported};for(let[e,n]of Object.entries(t.imported)){let t=i.imported[e];typeof t==`string`&&ct.test(t)&&n===!0||(i.imported[e]=n)}return i}function wt(e,t,n={}){let r=U(e),i=U(t);if(!r.ok)return{error:{code:r.code,message:`本机记录：`+r.message}};if(!i.ok)return{error:{code:i.code,message:`云端记录：`+i.message}};let a=r.doc,o=i.doc;return a.gen===o.gen?a.lineage===o.lineage?{doc:Ct(a,o,n,a),outcome:`merged`}:{doc:a,outcome:`conflict`,remote:o}:a.gen>o.gen?{doc:Ct(a,o,n,o),outcome:`merged`}:{doc:o,outcome:`remote-newer`}}function Tt(e){if(!e||typeof e!=`object`)return null;let t=Object.keys(e.done??{}).filter(t=>e.done[t]).sort(),n=JSON.stringify([H(e.xp),H(e.lessonsCompleted),t,e.lastDay??null,H(e.streak)]),r=2166136261;for(let e=0;e<n.length;e++)r^=n.charCodeAt(e),r=Math.imul(r,16777619)>>>0;return r.toString(16).padStart(8,`0`)}function Et(e){if(!e||typeof e!=`object`)return!1;if(H(e.xp)>0||H(e.lessonsCompleted)>0)return!0;if(e.done&&typeof e.done==`object`){for(let[t,n]of Object.entries(e.done))if(n&&V(t))return!0}return gt(e.lastDay)?!0:Number.isInteger(e.streak)&&e.streak>0}function Dt(e,t,n){if(!e||!V(t))return`new`;let r=U(e);if(!r.ok)return`new`;let i=r.doc.imported[t];if(!i)return`new`;if(!Et(n))return`same`;if(i===!0)return`unknown`;let a=Tt(n);return typeof i==`string`&&i===a?`same`:`changed`}function Ot(e){if(!gt(e?.lastDay)||!Number.isInteger(e.streak)||e.streak<1)return[];let t=Math.min(e.streak,lt),n=[];for(let r=t-1;r>=0;r--)n.push(ht(e.lastDay,-r));return n}function kt(e,t){let n=e?.doneOn?.[t];return gt(n)?n:Object.keys(e?.done??{}).filter(t=>e.done[t]&&V(t)).length===1&&H(e.lessonsCompleted)===1&&gt(e.lastDay)?e.lastDay:``}function At(e,{deviceId:t,guestId:n,gen:r=1,lineage:i=ut(),now:a=Date.now()}={}){if(!V(t)||!V(n))return{ok:!1,code:`bad-ids`,message:`缺少设备编号或游客编号`};if(!e||typeof e!=`object`||e.version!==3)return{ok:!1,code:`guest-invalid`,message:`游客记录不是第 3 版格式`};if(!Number.isFinite(e.xp)||e.xp<0)return{ok:!1,code:`guest-invalid`,message:`游客记录的 XP 无效`};let o=vt({gen:r,lineage:i});if(o.xp[t]=H(e.xp),o.runs[t]=H(e.lessonsCompleted),e.done&&typeof e.done==`object`)for(let[t,n]of Object.entries(e.done))n&&V(t)&&(o.done[t]=kt(e,t));o.days=Ot(e);let s={hearts:Math.min(5,H(e.hearts??5)),heartsAt:Number.isFinite(e.heartsAt)?e.heartsAt:a},c=Be(s,a);o.hearts={n:s.hearts,msToNext:s.hearts>=5?0:Math.round(c)};let l=e.prefs&&typeof e.prefs==`object`?e.prefs:{};return o.prefs={sound:l.sound!==!1,haptics:l.haptics!==!1,soundStyle:/^[A-J]$/.test(l.soundStyle)?l.soundStyle:`J`},o.imported[n]=Tt(e),{ok:!0,doc:o}}function jt(e,t=null,n=Date.now()){let r=e.days,i=e.hearts.n;return{version:3,onboarded:t?.onboarded??!1,xp:yt(e),hearts:i,heartsAt:i>=5?n:n-(B-e.hearts.msToNext),streak:_t(r),lastDay:r.length?r[r.length-1]:null,done:Object.fromEntries(Object.keys(e.done).map(e=>[e,!0])),lessonsCompleted:bt(e),installTipClosed:t?.installTipClosed??!1,lastActive:t?.lastActive??0,prefs:{...e.prefs}}}function Mt(e,t,{deviceId:n,today:r,now:i=Date.now(),baseline:a=null}){if(!V(n))throw Error(`缺少设备编号`);let o=dt(e),s={xp:!1,runs:!1,done:!1,days:!1,hearts:!1,prefs:!1},c=a?H(a.xp):yt(o),l=a?H(a.lessonsCompleted):bt(o),u=H(t.xp)-c;u>0&&(o.xp[n]=(o.xp[n]??0)+u,s.xp=!0);let d=H(t.lessonsCompleted)-l;d>0&&(o.runs[n]=(o.runs[n]??0)+d,s.runs=!0);for(let[e,n]of Object.entries(t.done??{})){if(!n||!V(e))continue;let i=t.doneOn?.[e];e in o.done?!o.done[e]&&gt(i)&&(o.done[e]=i,s.done=!0):(o.done[e]=gt(i)?i:gt(r)?r:``,s.done=!0)}let f=Ot(t).filter(e=>!o.days.includes(e));gt(t.lastDay)&&!o.days.includes(t.lastDay)&&!f.includes(t.lastDay)&&f.push(t.lastDay),f.length&&(o.days=[...new Set([...o.days,...f])].sort(),s.days=!0);let p={hearts:Math.min(5,H(t.hearts)),heartsAt:Number.isFinite(t.heartsAt)?t.heartsAt:i},m=Be(p,i),h={n:p.hearts,msToNext:p.hearts>=5?0:Math.round(m)};h.n!==o.hearts.n&&(s.hearts=!0),o.hearts=h;let g=t.prefs??{},_={sound:g.sound!==!1,haptics:g.haptics!==!1,soundStyle:/^[A-J]$/.test(g.soundStyle)?g.soundStyle:`J`};return JSON.stringify(_)!==JSON.stringify(o.prefs)&&(o.prefs=_,s.prefs=!0),{doc:o,changed:s}}function Nt(e,t,n){if(!V(t))return{ok:!1,code:`bad-ids`,message:`缺少游客编号`};let r=e??vt(),i=U(r);if(!i.ok)return{ok:!1,code:i.code,message:i.message};let a=Tt(n);if(!a)return{ok:!1,code:`guest-invalid`,message:`游客记录无法生成指纹`};let o=dt(r);return o.imported={...o.imported&&typeof o.imported==`object`&&!Array.isArray(o.imported)?o.imported:{},[t]:a},{ok:!0,doc:o,fingerprint:a}}function Pt(e,{deviceId:t,guestId:n,cloudDoc:r=null,now:i=Date.now()}={}){if(!V(t)||!V(n))return{ok:!1,code:`bad-ids`,message:`缺少设备编号或游客编号`};let a=At(e,{deviceId:t,guestId:n,now:i});if(!a.ok)return a;if(!r)return{ok:!0,doc:a.doc,outcome:`created`};let o=U(r);if(!o.ok)return{ok:!1,code:o.code,message:o.message};let s=dt(o.doc),c=a.doc,l=c.xp[t]??0,u=c.runs[t]??0;(l>0||Object.hasOwn(s.xp,t))&&(s.xp[t]=Math.max(s.xp[t]??0,l)),(u>0||Object.hasOwn(s.runs,t))&&(s.runs[t]=Math.max(s.runs[t]??0,u));for(let[e,t]of Object.entries(c.done))Object.hasOwn(s.done,e)?!s.done[e]&&t&&(s.done[e]=t):s.done[e]=t;return s.days=[...new Set([...s.days,...c.days])].sort(),s.imported={...s.imported,[n]:c.imported[n]},{ok:!0,doc:s,outcome:`merged`}}var Ft=`suipian.progress`,It=`suipian.guestId`,Lt=`suipian.device`,Rt=`suipian.session`,zt=`suipian.acct.`,Bt=zt+`import.`,Vt=e=>zt+e,Ht=e=>Bt+e,Ut=/^[0-9a-f]{8}$/;function W(e,t){try{return{ok:!0,value:e.getItem(t)}}catch{return{ok:!1}}}function Wt(e,t,n){try{return e.setItem(t,n),!0}catch{return!1}}function Gt(e,t){try{return e.removeItem(t),!0}catch{return!1}}function Kt(e,t){let n=W(e,t);if(!n.ok)return{ok:!1,code:`read-failed`,message:`无法读取本机编号`};if(V(n.value))return{ok:!0,id:n.value};let r=ut();if(!Wt(e,t,r))return{ok:!1,code:`save-failed`,message:`无法保存本机编号（存储被禁用或已满）`};let i=W(e,t);return!i.ok||i.value!==r?{ok:!1,code:`save-failed`,message:`本机编号保存后读回不一致`}:{ok:!0,id:r}}var qt=e=>Kt(e,Lt),Jt=e=>Kt(e,It);function Yt(e){let t=W(e,Ft);if(!t.ok)return{status:`read-failed`};if(t.value===null)return{status:`none`};try{let e=JSON.parse(t.value);if(e&&typeof e==`object`)return{status:`ok`,raw:t.value,state:e}}catch{}return{status:`corrupt`,raw:t.value}}function Xt(e){let t=W(e,Rt);return t.ok&&V(t.value)?t.value:null}function Zt(e){let t=W(e,Rt);return!t.ok||t.value!==null&&typeof t.value!=`string`?{ok:!1}:{ok:!0,id:V(t.value)?t.value:null}}function Qt(e,t){return t===null?Gt(e,Rt):V(t)?Wt(e,Rt,t):!1}function $t(e,t,{now:n=Date.now()}={}){if(!V(t))return{ok:!1,code:`bad-user`,message:`账号编号无效`};let r=W(e,Vt(t));if(!r.ok)return{ok:!1,code:`read-failed`,message:`无法读取这个账号的本机副本`};let i=r.value;if(i===null)return{ok:!0,copy:null};let a;try{a=JSON.parse(i)}catch{return{ok:!1,code:`corrupt`,message:`这个账号的本机副本损坏`}}let o=U(a?.doc);if(!o.ok)return{ok:!1,code:o.code,message:o.message};let s=o.doc;if(Number.isFinite(a.savedAt)&&n>=a.savedAt&&s.hearts.n<5){let e={hearts:s.hearts.n,heartsAt:a.savedAt-(B-s.hearts.msToNext)},t=Be(e,n);s.hearts={n:e.hearts,msToNext:e.hearts>=5?0:Math.round(t)}}return{ok:!0,copy:{doc:s,base:a.base??null,dirty:{hearts:!!a.dirty?.hearts,prefs:!!a.dirty?.prefs,content:!!a.dirty?.content}}}}function en(e,t,n,{now:r=Date.now(),expectEmpty:i=!1}={}){if(!V(t))return!1;if(i){let n=W(e,Vt(t));if(!n.ok||n.value!==null)return!1}let a=U(n?.doc);if(!a.ok)return!1;let o=JSON.stringify({doc:a.doc,base:n.base??null,dirty:{hearts:!!n.dirty?.hearts,prefs:!!n.dirty?.prefs,content:!!n.dirty?.content},savedAt:r});return Wt(e,Vt(t),o)}function tn(e,t){return V(t)?Gt(e,Vt(t)):!1}function nn(e,t){if(!V(t))return{ok:!1,code:`bad-user`,message:`账号编号无效`};let n=W(e,Ht(t));return n.ok?rn(n.value,t):{ok:!1,code:`read-failed`,message:`无法读取游客导入待办`}}function rn(e,t){if(!V(t))return{ok:!1,code:`bad-user`,message:`账号编号无效`};if(e===null)return{ok:!0,record:null};let n;try{n=JSON.parse(e)}catch{return{ok:!1,code:`corrupt`,message:`游客导入待办损坏`}}if(!(n&&n.version===1&&n.userId===t&&V(n.guestId)&&(n.choice===`cloud`||n.choice===`merge`)&&typeof n.fingerprint==`string`&&Ut.test(n.fingerprint)&&typeof n.guestRaw==`string`&&n.guestState&&typeof n.guestState==`object`&&!Array.isArray(n.guestState)))return{ok:!1,code:`corrupt`,message:`游客导入待办损坏`};let r;try{r=JSON.parse(n.guestRaw)}catch{return{ok:!1,code:`corrupt`,message:`游客导入待办损坏`}}return!r||typeof r!=`object`||Array.isArray(r)||JSON.stringify(r)!==JSON.stringify(n.guestState)||Tt(n.guestState)!==n.fingerprint?{ok:!1,code:`corrupt`,message:`游客导入待办损坏`}:{ok:!0,record:{version:1,userId:t,guestId:n.guestId,choice:n.choice,fingerprint:n.fingerprint,guestRaw:n.guestRaw,guestState:n.guestState,createdAt:Number.isFinite(n.createdAt)?n.createdAt:0}}}function an(e,t,n){if(!V(t)||!n||n.userId!==t||!V(n.guestId)||n.choice!==`cloud`&&n.choice!==`merge`||typeof n.fingerprint!=`string`||!Ut.test(n.fingerprint)||typeof n.guestRaw!=`string`||!n.guestState||typeof n.guestState!=`object`)return!1;let r=JSON.stringify({version:1,userId:t,guestId:n.guestId,choice:n.choice,fingerprint:n.fingerprint,guestRaw:n.guestRaw,guestState:n.guestState,createdAt:Number.isFinite(n.createdAt)?n.createdAt:0});if(!Wt(e,Ht(t),r))return!1;let i=W(e,Ht(t));return i.ok&&i.value===r}function on(e,t){return V(t)?Gt(e,Ht(t)):!1}var sn=zt+`quarantine.`,cn=(e,t)=>sn+e+`.`+t;function ln(e){let t=String(e),n=2166136261,r=2538058380;for(let e=0;e<t.length;e++){let i=t.charCodeAt(e);n=Math.imul(n^i,16777619)>>>0,r=Math.imul(r^i^e&255,16777619)>>>0}return t.length.toString(16)+`-`+n.toString(16).padStart(8,`0`)+r.toString(16).padStart(8,`0`)}function un(e,t){if(!V(t))return{ok:!1};let n=W(e,Ht(t));return!n.ok||n.value!==null&&typeof n.value!=`string`?{ok:!1}:{ok:!0,raw:n.value}}function dn(e){try{let t=JSON.parse(e);return t&&typeof t==`object`?t:null}catch{return null}}function fn(e,t,n,{now:r=0}={}){if(!V(t)||typeof n!=`string`)return{ok:!1,code:`bad-input`};let i=ln(n),a=cn(t,i),o=e=>{let r=dn(e);return!!r&&r.version===1&&r.kind===`pending-import`&&r.userId===t&&r.digest===i&&r.raw===n},s=W(e,a);if(!s.ok||s.value!==null&&typeof s.value!=`string`)return{ok:!1,code:`read-failed`};if(s.value!==null)return o(s.value)?{ok:!0,key:a,digest:i,reused:!0}:{ok:!1,code:`backup-conflict`};if(!Wt(e,a,JSON.stringify({version:1,kind:`pending-import`,userId:t,digest:i,quarantinedAt:Number.isFinite(r)?r:0,raw:n})))return{ok:!1,code:`backup-write-failed`};let c=W(e,a);return!c.ok||typeof c.value!=`string`||!o(c.value)?{ok:!1,code:`backup-readback-failed`}:{ok:!0,key:a,digest:i,reused:!1}}function pn(e,t){let n=tn(e,t),r=Qt(e,null);return n&&r}function mn(e,{userChoseTransfer:t,uploadOk:n,uploaded:r,readBack:i,guestSnapshotRaw:a}){if(t!==!0||n!==!0||!i||!r||!St(r,i)||typeof a!=`string`)return!1;let o=W(e,Ft);return!o.ok||o.value!==a?!1:Gt(e,Ft)}var hn=`suipian.staleAuth`,G=`suipian.auth`,gn=e=>JSON.parse(JSON.stringify(e));function _n(e,t){return e&&e!==`cloud-off`&&e!==t?`proj:${e}:`:``}function vn(e,t){if(!t)return e;let n=e=>e===`suipian.session`||e===`suipian.auth`||e===`suipian.staleAuth`||e.startsWith(`suipian.acct.`)?t+e:e;return{getItem:t=>e.getItem(n(t)),setItem:(t,r)=>e.setItem(n(t),r),removeItem:t=>e.removeItem(n(t))}}function yn({storage:e,api:t,projectId:n=null,legacyProject:r=null,now:i=()=>Date.now(),today:a=()=>He(),schedule:o=(e,t)=>setTimeout(e,t),onStatus:s=()=>{},onState:c=()=>{},onNotice:l=()=>{},retryLocks:u=null}){let d=vn(e,_n(n,r)),f=null,p=null,m=``,h=null,g=!1,_=null,v=!1,y=null,b=null,x=0,S=0,C=null,w=null,T=0,E=!1,ee=!1,te=u||(typeof navigator<`u`?navigator.locks:null),D=()=>`suipian:writeback:${_n(n,r)}:${p}`;async function ne(e,t){if(te&&typeof te.request==`function`){let t=!1;try{return await te.request(D(),{mode:`exclusive`},async()=>{t=!0,ee=!0;try{return await e()}finally{ee=!1}})}catch(e){if(t)throw e;return E=!0,Oe()}}return e()}let O=0,k=null,re=``,ie=null,A=null,j=null,ae=null,M=(e,t=``,n=null)=>{h=e,re=t,ie=n,j=i(),e===`synced`&&(ae=j);try{s(e,t)}catch{}},oe=e=>String(e||``).trim().toLowerCase(),N=e=>!!e&&V(e.userId)&&typeof e.accessToken==`string`&&e.accessToken.trim()!==``&&typeof e.refreshToken==`string`&&e.refreshToken.trim()!==``&&Number.isFinite(e.expiresAt)&&e.expiresAt>0,se=()=>{try{let e=JSON.parse(d.getItem(G));if(!e||!N(e.session))return null;if(n&&(e.project||r)!==n){try{d.setItem(hn,JSON.stringify({userId:e.session.userId,email:oe(e.session.email),project:e.project||r||``}))}catch{}return null}return e.session}catch{return null}},ce=()=>{try{N(f)?d.setItem(G,JSON.stringify(n?{session:f,project:n}:{session:f})):d.removeItem(G)}catch{}},le=e=>!!e&&(e.base==null||!!(e.dirty&&(e.dirty.hearts||e.dirty.prefs||e.dirty.content)));function P(e=null,t=p){if(!t)return null;let n=e??nn(d,t);if(n.ok)return null;let r=n.code===`corrupt`,i={ok:!1,kind:r?`import-corrupt`:`import-read-failed`,code:n.code,pending:!0,pendingImport:!0,retryable:!1,message:r?`游客导入待办损坏，云端同步已暂停。请保留本机数据，等待恢复处理。`:`无法读取游客导入待办，云端同步已暂停。请检查本机存储后重试。`};return g=!0,M(r?`import-recovery-required`:`import-read-failed`,i.message),i}function ue(e,t,n){let r=nn(d,e),i=P(r,e);if(i)return i;let a;try{a=d.getItem(Bt+e)}catch{return P({ok:!1,code:`read-failed`},e)}if(!r.record||a!==n||Object.keys(r.record).some(e=>JSON.stringify(r.record[e])!==JSON.stringify(t[e]))){let e=`游客导入待办已被其他页面替换，当前导入已停止。请保留本机数据。`;return g=!0,M(`import-recovery-required`,e),{ok:!1,kind:`import-changed`,pending:!0,pendingImport:!0,retryable:!1,message:e}}return null}let F=()=>{try{let e=JSON.parse(d.getItem(hn));return e&&typeof e.userId==`string`?e:null}catch{return null}},de=()=>{try{d.removeItem(hn)}catch{}},fe=e=>e?{kind:e.kind,status:e.status,errorCode:e.errorCode,code:e.code}:null,I=e=>e.kind===`network`?`offline`:e.kind===`auth`?`need-login`:(e.kind,`error`),pe=()=>{O=i()+6e4},me=()=>i()<O,he=()=>({ok:!1,kind:`rate-limit`,retryable:!1,retryAt:O,message:`发送太频繁了，请等一分钟再试。`}),L=e=>(e&&e.kind===`rate-limit`&&pe(),e);function ge(e){let t=oe(e);if(!p)return null;if(N(f)&&f.userId===p){let e=oe(f.email||m);return e&&t&&t!==e?{ok:!1,kind:`other-account`,message:`请先退出当前账号`}:null}let n=F();return n&&n.userId===p&&n.email&&t&&t!==oe(n.email)?{ok:!1,kind:`other-account`,message:`请先退出当前账号`}:null}function _e(){let e=se();return!e||e.userId!==p||f&&(e.refreshToken===f.refreshToken||!(e.expiresAt>f.expiresAt))?!1:(f=e,m=e.email||m,!0)}async function ve(){if(_e(),!N(f)||f.userId!==p)return{ok:!1,kind:`auth`,message:`需要重新登录`};if(f.expiresAt-i()>6e4)return{ok:!0};let e=await t.refresh(f);return e.ok&&N(e.session)&&e.session.userId===p?(f=e.session,m=f.email||m,ce(),{ok:!0}):!e.ok&&e.kind===`auth`&&_e()&&f.expiresAt-i()>6e4?{ok:!0}:e.ok?{ok:!1,kind:`auth`,message:`登录账号不一致`}:e}function ye(e=null){let t=Xt(d);if(!t)return null;let n=$t(d,t,{now:i()});if(!n.ok||!n.copy)return null;let r=se();f=r&&r.userId===t?r:null,p=t,m=f?.email||``;let a=jt(n.copy.doc,e?{...e,onboarded:!0}:{...je(),onboarded:!0},i());k={xp:a.xp,lessonsCompleted:a.lessonsCompleted};let o=nn(d,t);return g=le(n.copy)||!o.ok||!!o.record,P(o)||M(f?`pending`:`need-login`),{userId:p,email:m,state:a}}function be(e){if(!p)return{ok:!1,code:`no-account`};let t=qt(d);if(!t.ok)return{ok:!1,code:t.code,message:t.message};let n=$t(d,p,{now:i()});if(!n.ok||!n.copy)return{ok:!1,code:n.code||`no-copy`,message:n.message};let{doc:r,changed:o}=Mt(n.copy.doc,e,{deviceId:t.id,today:a(),now:i(),baseline:k}),s={hearts:n.copy.dirty.hearts||o.hearts,prefs:n.copy.dirty.prefs||o.prefs,content:n.copy.dirty.content||o.xp||o.runs||o.done||o.days};if(!en(d,p,{doc:r,base:n.copy.base,dirty:s},{now:i()}))return{ok:!1,code:`save-failed`,message:`无法保存到本机`};k={xp:e.xp,lessonsCompleted:e.lessonsCompleted};let c=P();return c?{ok:!0,syncBlocked:c.kind}:(le({base:n.copy.base,dirty:s})&&(g=!0,h!==`offline`&&h!==`need-login`&&M(`pending`),Ae(1500)),{ok:!0})}let R=e=>`suipian.acct.writebackRetry.${e}`,xe=()=>{T++,w=null};function Se(){if(!p)return 0;C!==p&&(xe(),C=p,S=0);try{let e=d.getItem(R(p));if(e!==null){let t=Number(e);if(!Number.isInteger(t)||t<0||t>3)return E=!0,3;if(E)return 3;S=t}}catch{return E=!0,3}return E?3:S}function z(){try{let e=R(p),t=d.getItem(e);if(t!==null&&!/^[0-3]$/.test(t))return E=!0,!1;let n=t===null?`0`:t;if(d.setItem(e,n),d.getItem(e)!==n)throw Error(`retry counter did not persist`);return!E}catch{return E=!0,!1}}function Ce(){S=Math.min(3,Se()+1);try{if(d.setItem(R(p),String(S)),d.getItem(R(p))!==String(S))throw Error(`retry counter did not persist`)}catch{E=!0,S=3}return S}function we(){let e=S>0||Se()>0;if(xe(),!e)return!0;try{if(d.setItem(R(p),`0`),d.getItem(R(p))!==`0`)throw Error(`retry counter writeback mismatch`);return S=0,E=!1,!0}catch{return S=3,E=!0,!1}}function Te(){let e=nn(d,p);return!e.ok||e.record?null:typeof window<`u`&&!ee?(E=!0,Oe()):!z()||Se()>=3?Oe():null}let Ee=()=>E?`本机同步重试计数无法确认，已暂停自动同步；请检查浏览器存储空间或权限，然后点击“立即同步”手动重试。`:`本机副本写回连续失败 3 次，已停止自动同步；原有进度仍在本机。请检查浏览器存储空间或权限，然后点击“立即同步”手动重试。`;function De(){if(Se()<3)return!1;let e=nn(d,p);return e.ok&&!e.record}function Oe(){g=!0;let e=Ee();return M(`pending`,e),{ok:!1,kind:`local`,localWritebackFailed:!0,retryLimitReached:!0,retryable:!1,message:e}}function ke(){let e=Se();if(w!==null||e<1||e>=3||!p||!f)return;let t=e===1?3e3:1e4,n=++T;w=o(()=>{if(n!==T)return;w=null;let e=Se();e>0&&e<3&&B()},t)}function Ae(e=1500){p&&f&&!P()&&!De()&&(y||(y=o(()=>{y=null,B()},e)))}function B({manual:e=!1}={}){if(!p)return Promise.resolve({ok:!1,kind:`no-account`});let t=P();return t?Promise.resolve(t):!e&&De()?Promise.resolve(Oe()):(e&&xe(),_?(v=!0,_):(_=(async()=>{try{return await ne(async()=>{if(!e){let e=Te();if(e)return e}let t,n=0,r=!1;for(;;){if(v=!1,t=await Ne({manual:e}),t.replacedLocal&&(r=!0),t.ok){if(x=0,!we()){g=!0;let e=`本机同步重试计数无法清零；云端与本机进度已一致，但自动同步仍暂停。请检查浏览器存储权限并点击“立即同步”手动重试。`;M(`pending`,e),t={ok:!1,kind:`local`,retryLimitReached:!0,retryable:!1,message:e};break}if(v)continue;M(g?`pending`:`synced`);break}if(t.retryLimitReached)break;if(t.localWritebackFailed){xe(),Ce()>=3?(xe(),t={...t,...Oe()}):ke();break}if(t.kind===`network`||t.retryable){if(v&&n++<1)continue;Me()}break}return r&&t.ok?{...t,replacedLocal:!0}:t},e)}finally{_=null}})(),_))}function Me(){if(b||!p||!f||P()||De())return;let e=[3e3,1e4,3e4,6e4][Math.min(x,3)];x++,b=o(()=>{b=null,B()},e)}async function Ne({manual:e=!1}={}){let n=P();if(n)return n;if(M(`syncing`),me()){let e=he();return M(`error`,e.message),e}if(!N(f)||f.userId!==p){let e={ok:!1,kind:`auth`,message:`需要重新登录`};return M(`need-login`,e.message),e}let r=await ve();if(!r.ok)return L(r),M(I(r),r.message,fe(r)),r.kind===`rate-limit`?{...r,retryable:!1}:r;let a=nn(d,p),o=P(a);if(o)return o;if(a.record){let e=await Ye(a.record,f,{notify:!0});if(!e.ok||e.pending)return e.kind===`import-corrupt`||e.kind===`import-read-failed`||e.kind===`import-changed`?{...e,retryable:!1}:(g=!0,M(e.kind===`auth`?`need-login`:`pending`,e.error||e.message||`游客导入还没同步完，联网后会自动重试`),{ok:!1,kind:e.kind||`verify`,message:e.error||e.message||`游客导入还没同步完`,pendingImport:!0,retryable:e.kind!==`local`&&e.kind!==`data`&&e.kind!==`conflict`&&e.kind!==`auth`})}if(!e){let e=Te();if(e)return e}for(let e=0;e<5;e++){let e=await t.getProgress(f),n=P();if(n)return n;if(!e.ok)return L(e),M(I(e),e.message,fe(e)),e.kind===`rate-limit`?{...e,retryable:!1}:e;let r=$t(d,p,{now:i()});if(!r.ok||!r.copy)return M(`error`,`本机账号记录读取失败`),{ok:!1,kind:`local`,message:`本机账号记录读取失败`};let a=r.copy,o,s,u=!1,m=!1;if(e.row){let n=wt(a.doc,e.row.doc,{localHeartsDirty:a.dirty.hearts,localPrefsDirty:a.dirty.prefs});if(n.error)return M(`error`,n.error.message,{kind:`data`,code:n.error.code}),{ok:!1,kind:`data`,code:n.error.code,message:n.error.message};if(n.outcome===`conflict`)return M(`conflict`),{ok:!1,kind:`conflict`,message:`这个账号在别处被“覆盖”过，需要选择保留哪一份`};if(o=n.doc,s=e.row.rev,n.outcome===`remote-newer`&&a.dirty.content&&(u=!0),!St(o,e.row.doc)){let n=P();if(n)return n;let r=await t.saveProgress(f,e.row.rev,o),i=P();if(i)return i;if(!r.ok)return L(r),M(I(r),r.message,fe(r)),r.kind===`rate-limit`?{...r,retryable:!1}:r;if(r.rev===null)continue;s=r.rev,m=!0}}else{let e=P();if(e)return e;let n=await t.createProgress(f,a.doc),r=P();if(r)return r;if(!n.ok)return L(n),M(I(n),n.message,fe(n)),n.kind===`rate-limit`?{...n,retryable:!1}:n;if(n.rev===null)continue;o=a.doc,s=n.rev,m=!0}let h=$t(d,p,{now:i()}),_=h.ok&&h.copy?h.copy:a,y=o,b={hearts:!1,prefs:!1,content:!1};if(!St(_.doc,a.doc)){let e=wt(_.doc,o,{localHeartsDirty:!0,localPrefsDirty:!0});if(e.doc){let t=e.outcome===`remote-newer`;t&&_.dirty.content&&(u=!0),y=e.doc,b={hearts:_.dirty.hearts,prefs:_.dirty.prefs,content:!t&&_.dirty.content},v=!0}}if(!en(d,p,{doc:y,base:s,dirty:b},{now:i()})){g=!0;let e=m?`进度已保存在云端，但本机副本写回失败；原有副本已保留，稍后自动重试`:`本机副本写回失败；原有副本已保留，稍后自动重试`;return M(`pending`,e),{ok:!1,kind:`local`,retryable:!0,localWritebackFailed:!0,rev:s,message:e}}if(!St(_.doc,y)){let e=jt(y,null,i());k={xp:e.xp,lessonsCompleted:e.lessonsCompleted},c(y)}if(g=v,M(v?`pending`:`syncing`),u)try{l(`replaced`,{})}catch{}return u?{ok:!0,rev:s,replacedLocal:!0}:{ok:!0,rev:s}}return g=!0,M(`error`,`同步冲突太多次，请稍后再试`),{ok:!1,kind:`server`,retryable:!1,message:`同步冲突太多次，请稍后再试`}}async function Pe(e){let n=ge(e);if(n)return n;if(me())return he();let r=await t.sendCode(String(e).trim());return r&&r.kind===`rate-limit`&&pe(),r}async function Fe(e,n,r=null){let i=ge(e);if(i)return i;let a=await t.verifyCode(String(e).trim(),n);return a.ok?Ie(a.session,r):a}async function Ie(e,n){if(!N(e))return{ok:!1,kind:`auth`,message:`登录返回的凭证无效`};let r=!1;if(p&&p!==e.userId){let t=F(),n=oe(e.email);if(!f&&t&&t.userId===p&&t.email&&oe(t.email)===n)r=!0;else return{ok:!1,kind:`other-account`,message:`请先退出当前账号`}}let a=await t.getProgress(e);if(!a.ok)return a;let o=a.row?U(a.row.doc):null;if(o&&!o.ok)return{ok:!1,kind:`data`,code:o.code,message:`云端记录：`+o.message};let s=$t(d,e.userId,{now:i()});if(!s.ok)return{ok:!1,kind:`local`,message:s.message};let c=Yt(d),l=c.status===`ok`&&Et(c.state),u=Jt(d),m=(o&&u.ok?Dt(o.doc,u.id,c.state):`new`)===`same`,h={session:e,remote:a,remoteDoc:o?o.doc:null,copy:s.copy,guest:c,guestHas:l,baseState:n,leaveStale:r};return l&&!s.copy&&!m?(A=h,{ok:!0,needChoice:!0,cloudHasData:!!o&&yt(o.doc)+Object.keys(o.doc.done).length>0,guest:{xp:c.state.xp??0,lessons:Object.keys(c.state.done??{}).filter(e=>c.state.done[e]).length}}):Xe(h,null)}async function Le(e){let t=A;if(!t)return{ok:!1,kind:`local`,message:`没有等待选择的登录`};if(t.resume){if(!f||!p||p!==t.session.userId)return A=null,{ok:!1,kind:`auth`,message:`登录状态已变化，请重新操作`};let e=await ve();if(!e.ok)return e;t.session=f}let n=await Xe(t,e);if(n.ok)A=null;else{let e=$t(d,t.session.userId,{now:i()});e.ok&&e.copy&&(t.copy=e.copy)}return n}function Re(){if(!p)return{state:`none`};let e=un(d,p);if(!e.ok)return{state:`read-failed`};if(e.raw===null)return{state:`none`};let t=rn(e.raw,p);return t.ok?{state:`healthy`}:t.code===`corrupt`?{state:`corrupt`,digest:ln(e.raw),bytes:e.raw.length}:{state:`read-failed`}}async function ze({expectedDigest:e=null}={}){let t=(e,t,n={})=>({ok:!1,kind:e,message:t,quarantined:!1,originalKept:!0,...n});if(!p)return t(`no-account`,`没有登录的账号`);if(_)return t(`busy`,`正在同步，请稍后再试`);let n=p,r=()=>{let e=Zt(d);return p===n&&e.ok&&e.id===n};if(!r())return t(`account-changed`,`登录的账号已变化，没有处理待办`);let a=un(d,n);if(!a.ok)return t(`read-failed`,`无法读取游客导入待办。这只是读取失败，不是确认损坏：请检查浏览器存储权限后重试，没有隔离任何内容。`);if(a.raw===null)return t(`no-pending`,`当前没有游客导入待办，不需要处理`);let o=a.raw,s=rn(o,n);if(s.ok)return t(`not-corrupt`,`游客导入待办是完好的，不需要隔离`);if(s.code!==`corrupt`)return t(`read-failed`,`无法确认待办是否损坏，没有隔离任何内容`);let c=ln(o);if(e&&e!==c)return t(`pending-changed`,`游客导入待办在你确认之后又变了，没有处理。请重新查看再确认。`);let l=fn(d,n,o,{now:i()});if(!l.ok)return t(`backup-failed`,`损坏的待办没能备份（`+l.code+`），所以没有动它；本机数据都还在。`);if(!r())return t(`account-changed`,`登录的账号刚刚变了，已停止；原待办没动`,{backedUp:!0});let u=un(d,n);if(!u.ok)return t(`read-failed`,`备份后再次读取待办失败，已停止；原待办没动`,{backedUp:!0});if(u.raw!==o)return t(`pending-changed`,`游客导入待办刚刚被其他页面替换，已停止；没有删除任何待办`,{backedUp:!0});let f=!1;try{d.removeItem(Bt+n)}catch{f=!0}let m=un(d,n);return m.ok?m.raw===o?t(`remove-failed`,f?`原待办删除失败，仍保留在本机；备份已保留`:`原待办没有删掉，仍保留在本机；备份已保留`,{backedUp:!0}):(g=!0,M(`pending`,`已备份并移除损坏的游客导入待办。请重新确认游客进度怎么处理。`),{ok:!0,quarantined:!0,originalKept:!1,digest:c,bytes:o.length,reusedBackup:!!l.reused,replacedByOtherTab:m.raw!==null,message:`损坏的待办已备份到本机并移除。游客记录、账号副本和登录都没动。接下来请重新确认游客进度怎么处理。`}):t(`remove-unverified`,`删除后无法读回确认，没有当作已恢复；备份已保留`,{backedUp:!0})}async function Be(e=null){if(!p||!f)return{ok:!1,kind:`auth`,message:`需要先登录`};let n=P();if(n)return n;if(_)return{ok:!1,kind:`busy`,message:`正在同步，请稍后再试`};let r=await ve();if(!r.ok)return r;let a=f,o=p,s=await t.getProgress(a);if(!s.ok)return s;let c=s.row?U(s.row.doc):null;if(c&&!c.ok)return{ok:!1,kind:`data`,code:c.code,message:`云端记录：`+c.message};let l=$t(d,o,{now:i()});if(!l.ok)return{ok:!1,kind:`local`,message:l.message};let u=Yt(d),m=u.status===`ok`&&Et(u.state),h=Jt(d),g=c&&h.ok?Dt(c.doc,h.id,u.state):`new`;if(!m||g===`same`){let e=await B({manual:!0});return{ok:e.ok,noChoiceNeeded:!0,alreadyImported:g===`same`,sync:e,message:e.ok?``:e.message}}return A={session:a,remote:s,remoteDoc:c?c.doc:null,copy:l.copy,guest:u,guestHas:m,baseState:e,leaveStale:!1,resume:!0},{ok:!0,needChoice:!0,resume:!0,cloudHasData:!!c&&yt(c.doc)+Object.keys(c.doc.done).length>0,guest:{xp:u.state.xp??0,lessons:Object.keys(u.state.done??{}).filter(e=>u.state.done[e]).length}}}async function Ve(e=f){if(!e)return{ok:!1,kind:`auth`,message:`需要重新登录`};if(e===f){let e=await ve();if(!e.ok)return e}let n=await t.getProgress(e);if(!n.ok)return n;if(!n.row)return{ok:!0,row:null};let r=U(n.row.doc);return r.ok?{ok:!0,row:{doc:r.doc,rev:n.row.rev},rawDoc:n.row.doc}:{ok:!1,kind:`data`,code:r.code,message:`云端记录：`+r.message}}let Ue={hearts:!1,prefs:!1,content:!1};function We(e,t,n,r,a){return en(d,e,{doc:t,base:n,dirty:r},{now:i(),expectEmpty:a})}function Ge(e,t,n){let r=$t(d,e,{now:i()});if(!r.ok)return{ok:!1,kind:`local`,message:r.message||`本机账号记录读取失败`};if(!r.copy||n&&St(r.copy.doc,n))return{ok:!0,doc:t};if(r.copy.doc.gen!==t.gen||r.copy.doc.lineage!==t.lineage)return{ok:!1,kind:`conflict`,message:`这个账号在别处被替换过，游客导入需要重新选择`};let a=wt(r.copy.doc,t,{localHeartsDirty:r.copy.dirty.hearts,localPrefsDirty:r.copy.dirty.prefs});return!a.doc||a.outcome===`conflict`?{ok:!1,kind:`conflict`,message:`这个账号在别处被替换过，游客导入需要重新选择`}:{ok:!0,doc:a.doc}}function Ke(e,t,n){let r=gn(e),i=n?.imported?.[t];return i?r.imported[t]=i:delete r.imported[t],r}async function qe(e,n,r,a,o){let s=$t(d,e,{now:i()});if(!s.ok)return{ok:!1,kind:`local`,message:s.message||`本机账号记录读取失败`};let c=await Ve(o);if(!c.ok)return{...c,pending:!0};let l=null,u=null,f=!1,p=``,m=null,h=null,g=null;for(let i=0;i<5;i++){g=c.row?c.row.doc:s.copy?.doc??null,h=c.row?c.row.rev:null;let i=Nt(c.row?c.rawDoc??c.row.doc:s.copy?.doc??vt(),n,r);if(!i.ok)return{ok:!1,kind:`data`,code:i.code,message:i.message};let a=Ge(e,i.doc,g);if(!a.ok)return{...a,pending:!0};if(l=a.doc,!c.row){let e=await t.createProgress(o,l);if(!e.ok){p=e.message||`保存失败`,m=e.kind;break}if(e.rev===null){if(c=await Ve(o),!c.ok)return{...c,pending:!0};continue}u=e.rev,f=!0;break}let d=await t.saveProgress(o,c.row.rev,l);if(!d.ok){p=d.message||`保存失败`,m=d.kind;break}if(d.rev===null){if(c=await Ve(o),!c.ok)return{...c,pending:!0}}else{u=d.rev,f=!0;break}}if(!f){m||(m=`conflict`);let t=g??s.copy?.doc??vt(),n=Ge(e,t,g),r=n.ok?n.doc:t,i=s.copy?s.copy.dirty:Ue;return We(e,r,h,i,!s.copy)?{ok:!0,doc:r,rev:h,synced:!1,verified:!1,guestCleared:!1,saved:!0,pending:!0,kind:m,error:p||`保存游客指纹失败`}:{ok:!1,kind:`local`,message:`无法保存到本机，登录没有完成`}}let _=!1,v=null,y=null,b=``,x=await t.getProgress(o);if(!x.ok)y=x.kind,b=x.message||`读回失败`;else if(!x.row)y=`data`,b=`读回时云端记录不见了`;else{let e=U(x.row.doc);e.ok?(v=e.doc,_=St(l,e.doc)&&e.doc.imported[n]===a):(y=`data`,b=`云端记录：`+e.message)}if(!_){let t=Ge(e,l,g),r=Ke(t.ok?t.doc:l,n,g),i=s.copy?s.copy.dirty:Ue;return We(e,r,u,i,!s.copy)?{ok:!0,doc:r,rev:u,synced:!1,verified:!1,guestCleared:!1,saved:!0,pending:!0,kind:y||`verify`,error:b||`上传成功，但读回校验失败，游客记录已保留`}:{ok:!1,kind:`local`,message:`无法保存到本机，登录没有完成`}}return We(e,v,u,Ue,!1)?{ok:!0,doc:v,rev:u,synced:!0,verified:!0,guestCleared:!1,saved:!0,pending:!1,error:``}:{ok:!1,kind:`local`,message:`无法保存到本机，登录没有完成`}}async function Je(e,n,r,a,o){let s=r.guestId,c=r.guestState,l=$t(d,e,{now:i()});if(!l.ok)return{ok:!1,kind:`local`,message:l.message||`本机账号记录读取失败`};let u=await Ve(a);if(!u.ok)return{...u,pending:!0};let f=null,p=null,m=!1,h=``,g=null,_=null,v=null;for(let r=0;r<5;r++){v=u.row?u.row.doc:l.copy?.doc??null,_=u.row?u.row.rev:null;let r=Pt(c,{deviceId:n,guestId:s,cloudDoc:v,now:i()});if(!r.ok)return{ok:!1,kind:`data`,code:r.code,message:r.message};let o=Ge(e,r.doc,v);if(!o.ok)return{...o,pending:!0};if(f=o.doc,!u.row){let e=await t.createProgress(a,f);if(!e.ok){h=e.message||`上传失败`,g=e.kind;break}if(e.rev===null){if(u=await Ve(a),!u.ok)return{...u,pending:!0};continue}p=e.rev,m=!0;break}let d=await t.saveProgress(a,u.row.rev,f);if(!d.ok){h=d.message||`上传失败`,g=d.kind;break}if(d.rev===null){if(u=await Ve(a),!u.ok)return{...u,pending:!0}}else{p=d.rev,m=!0;break}}if(!m){g||(g=`conflict`);let t=Ke(f,s,v),n={hearts:!!l.copy?.dirty.hearts,prefs:!!l.copy?.dirty.prefs,content:!0};return We(e,t,_,n,!l.copy)?{ok:!0,doc:t,rev:_,synced:!1,verified:!1,guestCleared:!1,saved:!0,pending:!0,kind:g,error:h||`合并冲突太多次，请稍后再试`}:{ok:!1,kind:`local`,message:`无法保存到本机，登录没有完成`}}let y=!1,b=null,x=null,S=``,C=await t.getProgress(a);if(!C.ok)x=C.kind,S=C.message||`读回失败`;else if(!C.row)x=`data`,S=`读回时云端记录不见了`;else{let e=U(C.row.doc);e.ok?(b=e.doc,y=St(f,e.doc)):(x=`data`,S=`云端记录：`+e.message)}if(!y){let t=Ke(f,s,v),n={hearts:!!l.copy?.dirty.hearts,prefs:!!l.copy?.dirty.prefs,content:!0};return We(e,t,p,n,!l.copy)?{ok:!0,doc:t,rev:p,synced:!1,verified:!1,guestCleared:!1,saved:!0,pending:!0,kind:x||`verify`,error:S||`上传成功，但读回校验失败，游客记录已保留`}:{ok:!1,kind:`local`,message:`无法保存到本机，登录没有完成`}}let w=ue(e,r,o);if(w){let t=Ke(f,s,v),n={hearts:!!l.copy?.dirty.hearts,prefs:!!l.copy?.dirty.prefs,content:!0};return We(e,t,p,n,!l.copy)?{...w,doc:t,rev:p,synced:!1,verified:!0,guestCleared:!1,saved:!0}:{ok:!1,kind:`local`,message:`无法保存到本机，登录没有完成`}}if(!We(e,b,p,Ue,!1))return{ok:!1,kind:`local`,message:`无法保存到本机，登录没有完成`};let T=!1,E=!1,ee=``,te=Yt(d);return te.status===`ok`&&te.raw===r.guestRaw?(T=mn(d,{userChoseTransfer:!0,uploadOk:!0,uploaded:f,readBack:b,guestSnapshotRaw:r.guestRaw}),T||(E=!0,ee=`云端已写入并读回一致，但游客记录删除失败，将重试`)):te.status===`read-failed`&&(E=!0,ee=`云端已写入，但游客记录读取失败，暂不删除，将重试`),{ok:!0,doc:b,rev:p,synced:!0,verified:!0,guestCleared:T,saved:!0,pending:E,error:ee}}async function Ye(e,t,{notify:n=!1}={}){let r=e.userId,a;try{a=d.getItem(Bt+r)}catch{return P({ok:!1,code:`read-failed`},r)}let o=ue(r,e,a);if(o)return o;let s;if(e.choice===`cloud`)s=await qe(r,e.guestId,e.guestState,e.fingerprint,t);else{let n=qt(d);if(!n.ok)return{ok:!1,kind:`local`,message:n.message};s=await Je(r,n.id,e,t,a)}if(!s.ok)return s;if(s.pending)return g=!0,s;let l=ue(r,e,a);if(l)return l;if(!on(d,r))return g=!0,{...s,pending:!0,synced:!1,error:`游客导入已完成，但待办清除失败，将重试`};if(n&&s.doc){let e=jt(s.doc,null,i());k={xp:e.xp,lessonsCompleted:e.lessonsCompleted};try{c(s.doc)}catch{}}return s}async function Xe(e,t){let n=e.session.userId,r=qt(d),a=Jt(d);if(!r.ok)return{ok:!1,kind:`local`,message:r.message};let o=t===`cloud`?`cloud`:t===`transfer`||t===`merge`?`merge`:null,s,c=e.remote.row?e.remote.row.rev:null,l=null,u=!1;if(e.guestHas&&o){if(!a.ok||e.guest.status!==`ok`)return{ok:!1,kind:`local`,message:o===`cloud`?`游客记录读取失败，没有保存游客指纹`:`游客记录读取失败，没有合并`};let t=nn(d,n);if(!t.ok)return{ok:!1,kind:`local`,message:t.message||`无法读取游客导入待办`};let r=t.record;if(!r||r.userId!==n||r.guestId!==a.id||r.choice!==o){let t=Tt(e.guest.state);if(!t)return{ok:!1,kind:`data`,message:`游客记录无法生成指纹`};if(r={version:1,userId:n,guestId:a.id,choice:o,fingerprint:t,guestState:gn(e.guest.state),guestRaw:e.guest.raw,createdAt:i()},!an(d,n,r))return{ok:!1,kind:`local`,message:`无法保存游客导入待办，登录没有完成`}}if(l=await Ye(r,e.session),!l.ok)return l;s=l.doc,c=l.rev,u=o===`merge`}else e.copy?(s=e.copy.doc,c=e.copy.base??c):s=e.remoteDoc??vt();if(!l||!l.saved){let t=e.copy?e.copy.dirty:Ue;if(!en(d,n,{doc:s,base:c,dirty:t},{now:i(),expectEmpty:!e.copy}))return{ok:!1,kind:`local`,message:`无法保存到本机，登录没有完成`}}if(!Qt(d,n))return{ok:!1,kind:`local`,message:`无法记录当前账号`};f=e.session,p=n,m=f.email||``,ce();let h=jt(s,e.baseState?{...e.baseState,onboarded:!0}:{...je(),onboarded:!0},i());k={xp:h.xp,lessonsCompleted:h.lessonsCompleted};let _=!1,v=!1,y=``;if(l)_=l.synced,v=!!l.guestCleared,y=l.error||``,g=!_||!!l.pending,_&&l.verified!==!1&&!l.pending?M(`synced`):_&&l.verified!==!1?M(`pending`,y||`游客导入还有收尾没完成，联网后会自动重试`):_?M(`error`,y):M(`pending`,y||l.message||`游客导入还没同步完，联网后会自动重试`);else{g=!0;let e=await B();_=e.ok,y=e.ok?``:e.message||``}e.leaveStale&&de();let b=$t(d,n,{now:i()}),x=b.ok&&b.copy?jt(b.copy.doc,e.baseState?{...e.baseState,onboarded:!0}:{...je(),onboarded:!0},i()):h;return k={xp:x.xp,lessonsCompleted:x.lessonsCompleted},{ok:!0,state:x,account:{userId:p,email:m},synced:_,syncError:y,guestCleared:v,transferred:u,pending:!_}}function Ze(e){let t=$t(d,e,{now:i()});return!!(t.ok&&t.copy&&le(t.copy))}function Qe(){try{d.removeItem(G)}catch{}try{if(d.getItem(`suipian.auth`)===null)return!0;try{d.setItem(G,JSON.stringify({revoked:!0,reason:`logout-cleanup-failed`}))}catch{}let e=d.getItem(G);if(e===null)return!0;let t=JSON.parse(e);return t?.revoked===!0&&!t.session&&!t.accessToken&&!t.refreshToken}catch{return!1}}function $e(e){let t=$t(d,e,{now:i()});if(!t.ok)return{ok:!1};let n=null;try{n=d.getItem(G)}catch{}return{ok:!0,copy:t.copy?gn(t.copy):null,authRaw:n}}function et(e,t){let n=!t.copy||en(d,e,t.copy,{now:i()}),r=Qt(d,e),a=!0;if(typeof t.authRaw==`string`)try{d.getItem(`suipian.auth`)!==t.authRaw&&d.setItem(G,t.authRaw),a=d.getItem(G)===t.authRaw}catch{a=!1}return g=Ze(e)||g,{copyRestored:n,accountRestored:r,authRestored:a,all:n&&r&&a}}function tt(e,{clearAuth:t,keepCopy:n}){let r=$e(e);if(!r.ok)return{ok:!1,result:{ok:!1,kind:`local`,pending:!0,message:`无法确认本机副本状态，暂未退出`}};let i=n?Qt(d,null):pn(d,e),a=i&&(!t||Qe());if(i&&a)return{ok:!0,snap:r};let o=et(e,r),s=i?`无法确认本机凭证已清除`:`本机退出未完成`,c=o.all?`${s}，登录状态和学习副本已恢复；云端会话没有动`:`${s}；请检查本机登录状态和学习副本`;return M(g?`pending`:`error`,c),{ok:!1,result:{ok:!1,kind:`local`,pending:!0,copyRestored:o.copyRestored,accountRestored:o.accountRestored,authRestored:o.authRestored,cloudUntouched:!0,message:c}}}async function nt(e,{onSession:n}={}){if(!e||!N(e))return{ok:!0,alreadyInvalid:!0};let r=e=>({ok:!1,kind:e.kind||`server`,message:e.message||`退出云端失败`});try{let i=await t.signOut(e,`local`);if(!i||i.ok!==!1)return{ok:!0};if(i.sessionState===`gone`)return{ok:!0,alreadyInvalid:!0};if(i.sessionState!==`token-invalid`)return r(i);_e();let a=await t.refresh(N(f)?f:e);return a.ok?!N(a.session)||a.session.userId!==p?{ok:!1,kind:`auth`,message:`登录账号不一致，暂未退出`}:(f=a.session,m=f.email||m,ce(),n&&n(),i=await t.signOut(f,`local`),!i||i.ok!==!1?{ok:!0}:i.sessionState===`gone`?{ok:!0,alreadyInvalid:!0}:r(i)):a.sessionState===`dead`?{ok:!0,alreadyInvalid:!0}:r(a)}catch{return{ok:!1,kind:`server`,message:`退出云端失败`}}}function rt(){if(p){xe();try{d.removeItem(R(p))}catch{}C=null,S=0,E=!1}de(),f=null,p=null,m=``,k=null,g=!1,A=null,ae=null,M(null)}async function it({force:e=!1,forceLocal:t=!1}={}){if(!p)return{ok:!0};let n=e||t,r=P();if(r){if(!n)return r;let e=p,t=Qt(d,null),i=!1;try{i=d.getItem(Rt)===null}catch{}if(!t||!i){let t=Qt(d,e),n=!1;try{n=d.getItem(Rt)===e}catch{}return{ok:!1,kind:`local`,pending:!0,rollbackFailed:!t||!n,message:n?`账号指针删除失败，退出未完成；本机数据仍保留`:`账号指针清理与恢复均失败，请保留本机数据并人工恢复`}}let a=!1;try{d.removeItem(G)}catch{}try{a=d.getItem(G)===null}catch{}if(!a){let t=Qt(d,e),n=!1;try{n=d.getItem(Rt)===e}catch{}return{ok:!1,kind:`local`,pending:!0,rollbackFailed:!t||!n,message:n?`本机凭证清理失败，退出未完成；数据仍保留`:`凭证清理失败且账号指针回滚失败，请保留本机数据并人工恢复`}}return rt(),{ok:!0,cloudSessionMaybeValid:!0,warning:`cloud-session-maybe-valid`,message:`已在这台设备退出。损坏的游客导入记录和本机进度已保留；云端会话可能仍有效。`}}if(g&&!n){let e=await B();if(!e.ok)return{ok:!1,pending:!0,kind:e.kind,message:e.message}}let i=p;if(!n&&Ze(i))return g=!0,M(`pending`,`还有进度没上传，没有退出`),{ok:!1,pending:!0,kind:`pending`,message:`还有进度没上传，没有退出`};let a=f,o=n&&(g||Ze(i));if(n){let e=tt(i,{clearAuth:!0,keepCopy:o});if(!e.ok)return e.result;if(t)return rt(),{ok:!0,cloudSessionMaybeValid:!0,warning:`cloud-session-maybe-valid`,message:`已在这台设备退出（没有联网）。云端会话可能仍有效。`};let n=await nt(a);return rt(),n.ok?{ok:!0}:{ok:!0,cloudSessionMaybeValid:!0,warning:`cloud-session-maybe-valid`,message:`已在这台设备退出。云端会话可能仍有效。`}}if(a&&N(a)){let e=await ve();if(!e.ok&&e.sessionState!==`dead`)return{ok:!1,stayed:!0,kind:e.kind||`server`,pending:Ze(i),message:e.message||`退出云端失败，暂未退出`}}let s=tt(i,{clearAuth:!1,keepCopy:!1});if(!s.ok)return s.result;let c=await nt(f,{onSession:()=>{try{s.snap.authRaw=d.getItem(G)}catch{}}});if(!c.ok){let e=et(i,s.snap),t=e.all?c.message:`${c.message}（本机状态恢复不完整，请检查登录状态和学习副本）`;return{ok:!1,stayed:!0,kind:c.kind,pending:Ze(i),copyRestored:e.copyRestored,accountRestored:e.accountRestored,message:t}}let l=N(f)?f.expiresAt:null,u=N(f)?f.refreshToken:null,m=Qe();if(rt(),!m){at=!0,ot=u;let e=Number.isFinite(l)?new Date(l).toLocaleTimeString(`zh-CN`,{hour:`2-digit`,minute:`2-digit`}):null;return{ok:!0,warning:`local-auth-leftover`,authLeftover:!0,accessTokenValidUntil:l,message:`已退出，云端已撤销这台设备的登录。但本机残留的登录凭证没清掉：它的刷新令牌已失效，访问令牌${e?`最晚到 `+e+` 前`:`在到期前`}仍可能有效。请再次清理。`}}return{ok:!0}}let at=!1,ot=null;function st(){let e;try{e=d.getItem(G)}catch{return{state:`read-failed`}}if(e===null)return{state:`absent`};if(typeof e!=`string`)return{state:`read-failed`};let t;try{t=JSON.parse(e)}catch{return{state:`inert`}}return!t||!N(t.session)?{state:`inert`}:n&&(t.project||r)!==n?{state:`other`}:{state:`ours`,session:t.session,raw:e}}function ct(e){let t=()=>{try{return{ok:!0,v:d.getItem(G)}}catch{return{ok:!1}}},n=t();if(!n.ok)return{ok:!1};if(n.v!==e)return{ok:!1,changed:!0};try{d.removeItem(G)}catch{}if(n=t(),!n.ok)return{ok:!1};if(n.v===null)return{ok:!0};if(n.v!==e)return{ok:!1,changed:!0};try{d.setItem(G,JSON.stringify({revoked:!0,reason:`logout-cleanup-failed`}))}catch{}if(n=t(),!n.ok)return{ok:!1};if(n.v===null)return{ok:!0};try{let e=JSON.parse(n.v);if(e?.revoked===!0&&!e.session&&!e.accessToken&&!e.refreshToken)return{ok:!0}}catch{}return{ok:!1}}function lt(){if(p)return!1;let e=Zt(d);if(!e.ok)return!0;if(e.id)return!1;if(at)return!0;let t=st();return t.state===`ours`||t.state===`read-failed`}async function ut(){if(p)return{ok:!1,kind:`logged-in`,message:`还在登录状态，不能清理登录凭证`};let e=Zt(d);if(!e.ok)return{ok:!1,kind:`read-failed`,message:`无法读取本机的登录状态，不能确认别的标签页是否还在登录，所以没有清理。请检查浏览器的存储权限后再试。`};if(e.id)return{ok:!1,kind:`logged-in`,message:`这台设备上已经有账号在登录（可能是另一个标签页），不能清理登录凭证`};let t=st();if(t.state===`read-failed`)return at=!0,{ok:!1,kind:`read-failed`,message:`无法读取本机的登录凭证，无法确认有没有清干净。请检查浏览器的存储权限后再试。`};if(t.state!==`ours`)return at=!1,ot=null,{ok:!0,nothingToClean:!0};if(ot&&t.session.refreshToken!==ot)return{ok:!1,kind:`changed`,message:`本机的登录凭证已经不是上次退出时留下的那一份（可能被另一个标签页重新登录），没有清理。`};let n=Zt(d);if(!n.ok||n.id)return{ok:!1,kind:n.ok?`logged-in`:`read-failed`,message:`刚刚检测到登录状态变化，没有清理。`};let r=ct(t.raw);if(r.changed)return{ok:!1,kind:`changed`,message:`本机的登录凭证刚刚被另一个标签页换过，没有清理。`};if(r.ok){let e=st();if(e.state===`absent`||e.state===`inert`)return at=!1,ot=null,{ok:!0}}return at=!0,{ok:!1,kind:`local`,message:`本机登录凭证还是没清掉；请检查浏览器的存储权限后再试`}}function H(){return it({force:!0,forceLocal:!0})}function dt(){f=null;try{d.removeItem(G)}catch{}try{d.getItem(`suipian.auth`)!==null&&d.setItem(G,JSON.stringify({revoked:!0,reason:`account-deleted-cleanup-failed`}))}catch{}try{Xt(d)&&d.setItem(Rt,``)}catch{}}async function ft(){if(!p)return{ok:!1,kind:`no-account`};let e=P();if(e)return e;let n=await ve();if(!n.ok)return n;let r=P();if(r)return r;let i=await t.deleteAccount(f);if(!i.ok)return i;let a=p,o=!1;try{o=pn(d,a)&&on(d,a)}catch{o=!1}return o?(f=null,p=null,m=``,k=null,g=!1,A=null,ae=null,ce(),M(null),{ok:!0}):(dt(),p=null,m=``,k=null,g=!1,A=null,ae=null,M(`pending-local-cleanup`,`账号已在云端删除，但这台设备还没清理完。请不要继续用这个登录。`),{ok:!1,kind:`local-cleanup`,pendingLocalCleanup:!0,tokenRevokedLocally:!0,copyIsolated:!0,message:`账号已在云端删除，但这台设备还没清理完。旧登录已停用，请不要继续用。`})}return{restore:ye,persistLocal:be,syncNow:B,scheduleSync:Ae,sendCode:Pe,verify:Fe,finishChoice:Le,logout:it,forceLocalLogout:H,hasLeftoverAuth:lt,retryAuthCleanup:ut,pendingRecoveryInfo:Re,quarantinePendingImport:ze,resumeGuestImportChoice:Be,deleteAccount:ft,account:()=>p?{userId:p,email:m}:null,status:()=>({status:h,pending:g,message:re,detail:ie,lastStatusAt:j,lastSyncedAt:ae})}}var bn=e=>Number.isInteger(e)&&e>=100&&e<=599?e:0,xn=e=>typeof e==`string`&&/^[a-z0-9_]{3,40}$/.test(e)?e:``,Sn=!0,Cn=e=>e<=90?`${e} 秒`:`约 ${Math.ceil(e/60)} 分钟`,wn={CFG:{text:()=>`云端暂未开通，现在只能在这台设备上学习。`,cooldown:0,diag:!1},S1a:{text:()=>`没连上网络，验证码没发出去。联网后再点「发送验证码」。`,cooldown:0,diag:!1},S1b:{text:e=>e.timedOut?`请求超时，邮件可能已发出。请先检查邮箱（含垃圾邮件），收到后在下面输入验证码。`:`网络不稳，没等到回应。验证码可能已经发出，先看看邮箱（含垃圾邮件）。`,cooldown:0,diag:!1},S2:{text:e=>`刚刚已经发过验证码，请等 ${Cn(e.n)}再发。先看看邮箱（含垃圾邮件），验证码还能用。`,cooldown:`server`,fallback:6e4,diag:!1,secondary:`enter-code`},S3:{text:()=>`登录邮件发得太多，暂时发不出验证码。请过一会儿再试，最久可能要等一小时。`,cooldown:3e5,diag:!1},S4:{text:e=>`邮件服务暂时出问题，验证码没发出去。不是你的操作有误，过几分钟再试。`+(e.fails>=3?`先继续学习，晚点再登录也行。`:``),cooldown:0,diag:!0},S5:{text:()=>`这个邮箱暂时收不到登录验证码。请换一个邮箱试试。`,cooldown:0,diag:!0},S5t:{text:()=>`这个邮箱不在测试名单里。测试入口只允许指定邮箱登录。`,cooldown:0,diag:!0},S6:{text:()=>`验证码没发出去。请检查邮箱地址，或稍后再试。仍不行请截图下方诊断信息。`,cooldown:0,diag:!0}},Tn={CFG:wn.CFG,V1:{text:()=>`验证码错误或已过期，请检查后重试，或点“重新发送”。`,cooldown:0,diag:!1},V2:{text:e=>`输入得太频繁了，请等 ${Cn(e.n)}再试。`,cooldown:`server`,fallback:6e4,diag:!1},V3:{text:()=>`网络不稳，登录没有确认。再点一次「登录」；如果提示验证码无效，点「重新发送」换新的。`,cooldown:0,diag:!1},V4:{text:()=>`登录服务暂时出问题，请等几分钟再点「登录」。`,cooldown:0,diag:!0},V5:{text:()=>`验证码对了，但读取云端记录没成功，没有完成登录。稍后再点「登录」。`,cooldown:0,diag:!0}},En={C1:{text:()=>`没有处理完。你的游客进度原样留在这台设备上，可以再试一次。`,cooldown:0,diag:!1},C1d:{text:()=>`没有处理完。你的游客进度原样留在这台设备上，可以再试一次。`,cooldown:0,diag:!0}},Dn={Y3b:`云端请求太频繁，稍后会自动重试。`,Y3c:`云端暂时出问题，稍后会自动重试。进度还在这台设备上。`,Y3d:`云端的进度记录读不出来，同步已暂停。你的进度没有动，请截图下面的诊断信息发给我们。`,AUTH:`登录状态有问题，请重新登录。进度还在这台设备上。`,GENERIC:`这次没有成功，请稍后再试。进度还在这台设备上。`},On=e=>bn(e?.status),kn=e=>String(e?.message||``),An=e=>{let t=/(\d{1,5})\s*seconds?/i.exec(kn(e));return t?Number(t[1]):0};function jn(e){let t=Number(e?.retryAfterSec);if(Number.isFinite(t)&&t>0)return Math.min(3600,Math.max(1,Math.round(t)));let n=An(e);return n>0?Math.min(3600,n):0}var Mn=new Set([`email_address_not_authorized`,`email_address_invalid`,`signup_disabled`,`otp_disabled`]);function Nn(e,{preview:t=Sn}={}){if(!e||e.ok)return``;if(e.kind===`config`)return`CFG`;if(e.kind===`network`)return e.offline?`S1a`:`S1b`;let n=On(e),r=xn(e.errorCode);return n===429||e.kind===`rate-limit`||r===`over_email_send_rate_limit`||r===`over_request_rate_limit`?jn(e)>0||r===`over_request_rate_limit`?`S2`:`S3`:Mn.has(r)||/not authorized|Signups not allowed/i.test(kn(e))?t?`S5t`:`S5`:n>=500||/Error sending .* email/i.test(kn(e))?`S4`:`S6`}function Pn(e){return!e||e.ok?``:e.kind===`config`?`CFG`:e.kind===`network`?`V3`:e.kind===`rate-limit`||On(e)===429?`V2`:e.stage===`verify`&&e.kind===`auth`?`V1`:On(e)>=500?`V4`:e.stage!==`verify`&&e.kind===`auth`?`V5`:`V4`}function Fn(e){let t=On(e),n=xn(e?.errorCode)||xn(e?.code),r=[t?String(t):e?.kind===`network`?`断网`:e?.kind===`data`?`数据`:``,n].filter(Boolean);return r.length?`诊断：`+r.join(` · `):``}var In=e=>Number.isFinite(e)&&e>0?`你的 ${Math.floor(e)} XP 仍在这台设备上，云端同步未完成。`:``,Ln=e=>Number.isFinite(e)&&e>0?`你的 ${Math.floor(e)} XP 还在这台设备上，没有受影响。`:``,Rn=e=>Math.min(36e5,Math.max(1e4,e));function zn(e,t,n,{xp:r=0,fails:i=1}={}){let a=e[t],o=jn(n)||(t===`S2`||t===`V2`?60:0),s=t===`S4`?i>=3?3e5:3e4:a.cooldown===`server`?Rn((jn(n)?jn(n)+1:a.fallback/1e3)*1e3):a.cooldown||0;return{id:t,design:t,text:a.text({n:o,fails:i,timedOut:n?.timedOut===!0}),diag:a.diag?Fn(n):``,xp:(t===`C1`||t===`C1d`?In:Ln)(r),cooldownMs:s,scope:t===`S2`||t===`V2`?`email`:``,uncertainSent:t===`S1b`&&n?.timedOut===!0,secondary:a.secondary||``,cooldownLabel:t===`S2`?`可再发`:t===`S3`?`约 5 分钟后可再试`:t===`S4`?i>=3?`约 5 分钟后可再试`:`30 秒后可再试`:``}}var Bn=(e,t={})=>e&&!e.ok?zn(wn,Nn(e,t),e,t):null,Vn=(e,t={})=>e&&!e.ok?zn(Tn,Pn(e),e,t):null;function Hn(e,t={}){return!e||e.ok?null:zn(En,e.kind===`data`?`C1d`:`C1`,e,t)}var Un=e=>e.replace(/（[A-Za-z0-9_.:-]{1,40}）/g,``),Wn=e=>typeof e==`string`&&/[一-鿿]/.test(e)&&!/[A-Za-z]{4,}/.test(Un(e));function Gn(e,t=Dn.GENERIC){return Wn(e)?e:t}function Kn(e,t=null){let n=t||{};return n.kind===`rate-limit`||On(n)===429?{text:Dn.Y3b,diag:``}:n.kind===`data`?{text:Dn.Y3d,diag:Fn(n)}:n.kind===`auth`?{text:Dn.AUTH,diag:``}:On(n)>=500||n.kind===`server`?{text:Dn.Y3c,diag:Fn(n)}:Wn(e)?{text:e,diag:``}:{text:Dn.GENERIC,diag:``}}function qn(e){let t=e?.status;if(t===`import-recovery-required`)return`游客导入记录损坏：云端同步已暂停。学习进度仍保存在本机，请保留数据等待恢复处理。`;if(t===`import-read-failed`)return`无法读取游客导入记录：云端同步已暂停。请检查本机存储后重试。`;if(t===`synced`)return`已同步 ✓`;if(t===`syncing`)return`同步中…`;if(t===`pending`)return e?.message&&(e.message.includes(`本机副本写回`)||e.message.includes(`本机同步重试计数`))?e.message:`有进度等待上传（联网后自动同步）`;if(t===`offline`)return`现在离线：进度已存在这台设备，联网后自动同步`;if(t===`need-login`)return`登录已过期，需要重新登录才能同步（进度还在这台设备上）`;if(t===`conflict`)return`这个账号在别处被覆盖过，同步已暂停。你在这台设备上的进度还在，可以继续学习。请先在下面的“备份学习记录”里导出进度文件，再联系我们处理。`;if(t===`pending-local-cleanup`)return`账号已在云端删除，但这台设备还没清理完。请不要继续用这个登录。`;if(t===`error`){let t=Kn(e.message,e.detail);return t.text+(t.diag?t.diag:``)}return`已登录，正在准备同步…`}var Jn={network:`网络连不上，请检查网络后重试。`,"rate-limit":`发送太频繁了，请等一分钟再试。`,config:`云端暂未开通。`},Yn=e=>Jn[e?.kind]?Jn[e.kind]:e?.kind===`auth`?Dn.AUTH:e?.status>=500||e?.kind===`server`?`云端暂时出问题，请稍后再试。进度还在这台设备上。`:Gn(e?.message,`出错了，请稍后再试。进度还在这台设备上。`),Xn=(e,t,n)=>e.synced?t:n+(e.syncError?`本机进度仍在，云端同步未完成，联网后会自动补上。`:``),Zn=e=>{let t=Math.max(1,Math.ceil(e/1e3));return t<=90?`${t} 秒`:`约 ${Math.ceil(t/60)} 分钟`};function Qn({h:e,button:t,sheet:n,icon:r,showToast:i,sync:a,api:o,getState:s,onSwitchedIn:c,onSwitchedOut:l,rerender:u}){let d=new Set;function f(){let e=a.status();for(let t of[...d])t.__shown&&!t.isConnected?d.delete(t):p(t,e)}function p(e,t){e.textContent=qn(t),e.dataset.status=t.status||``,e.isConnected&&(e.__shown=!0)}function m({reason:r=``,email:l=``}={}){if(!o.configured){i(`云端暂未开通，现在只能在这台设备上学习。`);return}let u=!1,d=!1,f=!1;return n(n=>{let o=e(`div`,{class:`lsheet login`,"data-login":``}),p=l,m=null,g=0,_=0,v=``,y=0,b=!1,x=``,S=``,C=e=>String(e||``).trim().toLowerCase(),w=e=>g>Date.now()&&(!x||x===C(e))?g-Date.now():0,T=(e,t,n)=>{g=Date.now()+e,x=n===`email`?C(t):``},E=e(`p`,{class:`login-msg`,"data-login-msg":``}),ee=e(`p`,{class:`login-xp`,"data-login-xp":``}),te=e(`p`,{class:`login-diag`,"data-login-diag":``}),D=e(`div`,{class:`login-feedback`,role:`alert`,"data-login-feedback":``},E,ee,te),ne=e(`div`,{class:`login-extra`,"data-login-extra":``}),O=(e,t=!0,n=null)=>{if(E.textContent=e,E.classList.toggle(`bad`,t),te.textContent=n?.diag||``,ee.textContent=n?.xp||``,ne.replaceChildren(),o.classList.toggle(`has-error`,!!e&&t),ae(),e&&D.scrollIntoView)try{D.scrollIntoView({block:`nearest`})}catch{}},k=()=>{try{let e=s()?.xp;return Number.isFinite(e)?e:0}catch{return 0}},re=e=>O(e.text,!0,e),ie=()=>{clearInterval(m),f=!0,n()},A=e(`p`,{class:`login-desc`,"data-login-desc":``}),j=()=>{let e=k();return b?e>0?`你的 ${Math.floor(e)} XP 保存在这台设备上。不用设密码。`:`不用设密码。`:e>0?r?`${r}你现在的 ${Math.floor(e)} XP 保存在这台设备上。`:`你现在的 ${Math.floor(e)} XP 保存在这台设备上。登录后会多存一份到云端，换手机或 iPad 也能接着学。没有账号会自动创建；不用设密码。`:r||`用邮箱登录，换手机或 iPad 也能接着学。没有账号会自动创建；不用设密码。`};function ae(){let e=window.visualViewport;b=!!e&&e.height<window.innerHeight*.75,o.classList.toggle(`kb-open`,b),(M||oe)&&(A.textContent=j())}let M=!1,oe=!1,N=()=>{},se=window.visualViewport,ce=()=>{o.isConnected?ae():se?.removeEventListener(`resize`,ce)};se?.addEventListener(`resize`,ce);let le=()=>{o.isConnected?document.visibilityState===`visible`&&N():document.removeEventListener(`visibilitychange`,le)};document.addEventListener(`visibilitychange`,le);function P(){M=!0,oe=!1,d=!1;let n=e(`input`,{class:`login-input`,type:`email`,inputmode:`email`,autocomplete:`email`,autocapitalize:`off`,spellcheck:`false`,placeholder:`you@example.com`,"aria-label":`邮箱`,"data-email":``});n.value=p;let r=t(`发送验证码`,async()=>{let e=n.value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)){O(`请输入有效的邮箱地址。`);return}if(u||w(e)>0)return;u=!0,r.disabled=!0,r.textContent=`发送中…`,O(`正在发送…`,!1);let o=await a.sendCode(e);if(u=!1,!o.ok){let n=Bn(o,{xp:k(),fails:1});y=n.id===`S4`?y+1:0;let r=n.id===`S4`?Bn(o,{xp:k(),fails:y}):n;if(r.cooldownMs&&T(r.cooldownMs,e,r.scope),v=r.cooldownLabel,r.uncertainSent){p=e,T(6e4,e,`email`),F(),re(r);return}re(r),r.secondary===`enter-code`&&ne.append(t(`我已收到，去输入验证码`,()=>{p=e,F()},`btn3d ghost wide`,{"data-enter-code":``})),i()}else y=0,v=``,p=e,T(6e4,e,`email`),O(``),F()},`btn3d primary wide`,{"data-send-code":``}),i=()=>{let e=w(n.value);r.disabled=u||e>0,r.textContent=u?`发送中…`:e>0?v===`可再发`?`${Zn(e)}后可再发`:v||`${Zn(e)}后可再发`:`发送验证码`,clearInterval(m),e>0&&(m=setInterval(()=>{o.isConnected?(i(),w(n.value)<=0&&clearInterval(m)):clearInterval(m)},1e3))};N=i,i(),n.addEventListener(`input`,()=>{!u&&x&&C(n.value)!==x&&o.classList.contains(`has-error`)&&O(``),i()}),n.addEventListener(`keydown`,e=>{e.key===`Enter`&&r.click()}),A.textContent=j(),o.replaceChildren(e(`h2`,{text:`登录 / 注册`}),A,n,D,e(`div`,{class:`login-actions`},r,ne),...a.hasLeftoverAuth&&a.hasLeftoverAuth()?[ue()]:[],t(`先不登录`,ie,`btn3d ghost wide`),h()),setTimeout(()=>n.focus(),50)}function ue(){let e=t(`清理本机残留的登录凭证`,async()=>{e.disabled=!0;let t=await a.retryAuthCleanup();t.ok?(e.remove(),O(t.nothingToClean?`没有发现需要清理的登录凭证。`:`已清理本机残留的登录凭证。`,!1)):(e.disabled=!1,O(Gn(t.message,`还是没清掉，请检查浏览器的存储权限后再试。`)))},`btn3d ghost wide`,{"data-clean-auth":``});return e}function F(){M=!1,oe=!0,d=!1;let n=0,r=e(`input`,{class:`login-input code`,type:`text`,inputmode:`numeric`,pattern:`[0-9]*`,autocomplete:`one-time-code`,maxlength:`10`,placeholder:`验证码`,"aria-label":`邮箱验证码`,"data-code":``}),i=t(`重新发送`,async()=>{if(w(p)>0||u)return;u=!0,i.disabled=!0,i.textContent=`发送中…`;let t=await a.sendCode(p);if(u=!1,!t.ok){let e=Bn(t,{xp:k(),fails:1});y=e.id===`S4`?y+1:0;let n=e.id===`S4`?Bn(t,{xp:k(),fails:y}):e;n.cooldownMs&&T(n.cooldownMs,p,n.scope),re(n),c()}else y=0,n++,T(6e4,p,`email`),O(`已重新发送。请查收邮件（含垃圾邮件）。`,!1),n>=2&&ne.append(e(`p`,{class:`login-hint`,text:`还是没收到？确认邮箱 ${p} 拼写正确，或点「换个邮箱」。`})),c()},`btn3d ghost`,{"data-resend":``}),c=()=>{let e=Math.ceil(w(p)/1e3);u||(i.disabled=e>0,i.textContent=e>0?`重新发送（${e} 秒）`:`重新发送`),!u&&_>Date.now()&&S===C(p)?l.disabled=!0:u||(l.disabled=!1)};N=c,clearInterval(m),m=setInterval(()=>{o.isConnected?c():clearInterval(m)},1e3);let l=t(`登录`,async()=>{let e=r.value.replace(/\s+/g,``);if(e.length<4){O(`请输入邮件里的验证码。`);return}if(u)return;u=!0,l.disabled=!0,l.textContent=`登录中…`,O(`正在登录…`,!1);let t=await a.verify(p,e,s());if(u=!1,l.disabled=!1,l.textContent=`登录`,!t.ok){if(t.kind===`other-account`||t.kind===`data`||t.kind===`local`){O(Yn(t)),c();return}let e=Vn(t,{xp:k()});if(e.id===`V2`&&(_=Date.now()+e.cooldownMs,S=C(p),(_>g||x===C(p))&&T(_-Date.now(),p,`email`)),re(e),c(),e.id===`V1`)try{r.focus(),r.select()}catch{}}else t.needChoice?de(t):fe(t)},`btn3d primary wide`,{"data-verify":``});c(),r.addEventListener(`keydown`,e=>{e.key===`Enter`&&l.click()}),A.textContent=``,o.replaceChildren(e(`h2`,{text:`输入验证码`}),e(`p`,{class:`login-sent`,text:`验证码已发到 ${p}。没收到？看看垃圾邮件，或稍等再重新发送。`}),r,D,e(`div`,{class:`login-actions`},l,i,ne),t(`换个邮箱`,()=>{O(``),P()},`btn3d ghost wide`)),setTimeout(()=>r.focus(),50)}function de(r){M=!1,oe=!1,d=!0;let i=`${r.guest.xp} XP、${r.guest.lessons} 关`,s=[],c=async e=>{if(u)return;u=!0,s.forEach(e=>{e.disabled=!0}),O(`正在上传并核对…`,!1);let t=await a.finishChoice(e);u=!1,s.forEach(e=>{e.disabled=!1}),t.ok?fe(t):re(Hn(t,{xp:r.guest.xp}))},l=(e,n,r)=>{let i=t(e,()=>c(n),r,{"data-choice":n});return s.push(i),i},f=t(`稍后再说`,()=>{u||n()},`btn3d ghost wide`,{"data-choice-later":``});r.cloudHasData?o.replaceChildren(e(`h2`,{text:`这个账号已有学习进度`}),e(`p`,{text:`云端已经有这个账号的进度。这台设备上还有没登录时学的进度（${i}）。`}),l(`保留云端进度（推荐）`,`cloud`,`btn3d primary wide`),l(`安全合并游客进度`,`transfer`,`btn3d wide`),e(`p`,{class:`muted small`,text:`安全合并不会整份覆盖：其他设备的 XP、关卡、红心和设置都会保留，XP / 次数按设备取较大值，关卡和日期取并集。选“保留云端进度”时游客记录原样保留，只记下它的指纹，之后游客再变才会再次提示。`}),D,f):o.replaceChildren(e(`h2`,{text:`转存这台设备上的进度？`}),e(`p`,{text:`这台设备上有没登录时学的进度（${i}）。要放进这个账号吗？`}),l(`安全合并到账号`,`transfer`,`btn3d primary wide`),l(`不转存，用全新账号`,`cloud`,`btn3d wide`),e(`p`,{class:`muted small`,text:`安全合并：XP / 次数按设备取较大值，关卡和日期取并集；上传成功并确认云端一致后，游客记录才会清除。不转存则原样保留。`}),D,f);try{s[0]?.focus({preventScroll:!0})}catch{}}function fe(e){ie(),c(e),i(Xn(e,`登录成功，进度已同步。`,`登录成功。`))}return P(),[o]},{cls:`login-sheet`,canClose:()=>!u,onClose:()=>{if(d&&!f){let e=Math.floor(s()?.xp??0);i(`已取消登录。`+(e>0?`你的 ${e} XP 还在这台设备上。`:`你的进度原样留在这台设备上。`))}}})}function h(){return e(`p`,{class:`privacy-note`,"data-privacy-note":``},`登录即表示你已阅读`,e(`a`,{href:`./privacy.html`,target:`_blank`,rel:`noopener`,"data-privacy-link":``,text:`隐私说明`}),`。`)}function g(){let r=a.account(),f=e(`section`,{class:`acct-card`,"data-account":``});if(!o.configured)return f.append(e(`h3`,{text:`账号`}),e(`p`,{class:`muted`,text:`云端暂未开通：学习进度只保存在这台设备上。`})),f;if(!r)return f.append(e(`h3`,{text:`账号`}),e(`p`,{class:`muted`,text:`登录后，进度会保存到云端，换手机或 iPad 也能接着学。`}),t(`邮箱登录 / 注册`,()=>m(),`btn3d primary wide`,{"data-open-login":``}),h()),f;let g=e(`p`,{class:`acct-status`,role:`status`,"data-sync-status":``});d.add(g);let _=(r,i,a,o,s=!1)=>n(n=>[e(`div`,{class:`lsheet`},e(`h2`,{text:r}),e(`p`,{text:i}),t(a,async()=>{n(),await o()},`btn3d wide `+(s?`danger`:`primary`)),t(`取消`,n,`btn3d ghost wide`))]);function v(r){let o=`${r.guest.xp} XP、${r.guest.lessons} 关`;n(n=>{let s=e(`p`,{class:`login-msg`,role:`alert`,"data-choice-msg":``}),l=async e=>{s.textContent=`正在处理…`,s.classList.remove(`bad`);let t=await a.finishChoice(e);t.ok?(n(),c(t),i(Xn(t,`游客进度已处理，已同步。`,`游客进度已处理。`))):(s.textContent=Hn(t,{xp:r.guest.xp}).text,s.classList.add(`bad`))};return[e(`div`,{class:`lsheet`,"data-import-choice":``},r.cloudHasData?[e(`h2`,{text:`这个账号已有学习进度`}),e(`p`,{text:`云端已经有这个账号的进度。这台设备上还有没登录时学的进度（${o}）。`}),t(`保留云端进度（推荐）`,()=>l(`cloud`),`btn3d primary wide`,{"data-choice":`cloud`}),t(`安全合并游客进度`,()=>l(`transfer`),`btn3d wide`,{"data-choice":`transfer`})]:[e(`h2`,{text:`转存这台设备上的进度？`}),e(`p`,{text:`这台设备上有没登录时学的进度（${o}）。要放进这个账号吗？`}),t(`安全合并到账号`,()=>l(`transfer`),`btn3d primary wide`,{"data-choice":`transfer`}),t(`不转存，用全新账号`,()=>l(`cloud`),`btn3d wide`,{"data-choice":`cloud`})],s,t(`稍后再说`,n,`btn3d ghost wide`))]})}async function y(e){let t=await a.quarantinePendingImport({expectedDigest:e});if(!t.ok){i(Gn(t.message,`没有处理成功，原来的待办还在。`)),u();return}i(`损坏的待办已备份并移除。`);let n=await a.resumeGuestImportChoice(s());n.ok?n.needChoice?(u(),v(n)):(i(n.alreadyImported?`云端已经有这份游客进度，不会重复加分。`:`已同步。`),u()):(i(`待办已处理，但还没能确认云端：`+Yn(n)+` 点“立即同步”可重试。`),u())}function b(){let n=a.pendingRecoveryInfo();return n.state===`corrupt`?e(`div`,{class:`acct-recover`,"data-recovery":`corrupt`},e(`p`,{class:`muted small`,text:`游客导入待办损坏，云端同步已锁定。可以先把损坏的内容备份在本机，再重新确认游客进度怎么处理；游客记录、账号副本和登录都不会被删。`}),t(`备份并重新导入`,()=>_(`备份损坏的待办？`,`会把损坏的待办原文备份在这台设备上（读回确认后才移除原待办），不联网。之后会重新问你游客进度怎么处理，不会重复加分。`,`备份并继续`,()=>y(n.digest)),`btn3d wide`,{"data-quarantine":``})):n.state===`read-failed`?e(`div`,{class:`acct-recover`,"data-recovery":`read-failed`},e(`p`,{class:`muted small`,text:`现在读不出游客导入待办。这只是读取失败，不能当作损坏，所以不会备份或删除任何东西。请检查浏览器存储权限后重试。`}),t(`重试读取`,async()=>{let e=await a.syncNow({manual:!0});e.ok||i(Yn(e)),u()},`btn3d wide`,{"data-pending-retry":``})):null}let x=()=>{try{return a.status().status===`synced`}catch{return!1}},S=()=>{try{let e=Math.floor(s()?.xp??0);return e>0?e:0}catch{return 0}},C=(e,t=!0)=>`已退出登录。`+(t?e>0?`账号里的 ${e} XP 在云端，重新登录就回来。`:``:`已同步的进度在云端；还没上传的进度留在这台设备上，用同一个账号重新登录会接着上传。`);async function w(e){let t=S(),n=x(),r=await a.logout();r.ok?(l(),i(r.warning?Gn(r.message,C(t,n)):C(t,n)),e&&e()):r.stayed?_(`云端退出失败`,`这台设备仍保持登录。已同步的进度在云端；没同步的留在这台设备上，用同一个账号重新登录会接着上传，XP 会回来。可以稍后再试，或只在这台设备退出（云端会话可能仍有效）。`,`只在这台设备退出`,async()=>{let r=await a.forceLocalLogout();r.ok?(l(),i(r.warning?Gn(r.message,C(t,n)):C(t,n)),e&&e()):i(Gn(r.message,`还没退出。`))},!0):r.kind===`import-corrupt`||r.kind===`import-read-failed`?_(`游客导入待办需要恢复`,`云端同步已锁定，继续学习可保存在本机。仅在本机退出会保留游客记录、损坏待办和未上传账号副本；重新登录后仍需专门恢复，云端会话可能仍有效。`,`仅在本机退出`,async()=>{let t=await a.forceLocalLogout();t.ok?(l(),i(Gn(t.message,`已在本机退出，数据已保留。`)),e&&e()):i(Gn(t.message,`还没退出。`))},!0):r.pending?_(`有进度还没上传`,`现在连不上云端。退出后这些进度会先留在这台设备上，用同一个账号重新登录时会接着上传，XP 会回来；建议联网后再退出。`,`仍然退出`,async()=>{let n=await a.logout({force:!0});n.ok?(l(),i(n.warning?Gn(n.message,C(t,!1)):C(t,!1)),e&&e()):i(Gn(n.message,`还没退出。`))},!0):i(Yn(r))}return f.append(e(`h3`,{text:`账号`}),e(`p`,{class:`acct-email`,text:r.email||`已登录`}),g,...[b()].filter(Boolean),...a.status().status===`need-login`?[t(`重新登录`,()=>m({reason:`登录已过期，重新登录后会接着上传。`,email:r.email||``}),`btn3d primary wide`,{"data-relogin":``})]:[],(()=>{let e=a.status().status===`conflict`,n=t(`立即同步`,async()=>{let e=await a.syncNow({manual:!0});e.ok?u():i(Yn(e))},`btn3d wide`,{"data-sync-now":``});return e&&(n.disabled=!0,n.title=`同步已暂停：这个账号在别处被覆盖过`),n})(),e(`div`,{class:`acct-row`},t(`退出登录`,()=>w(),`btn3d`,{"data-logout":``}),t(`切换账号`,()=>w(()=>m()),`btn3d`,{"data-switch":``})),t(`删除账号和云端记录`,()=>_(`删除账号？`,`会永久删除这个账号和云端的学习记录，不能恢复。这台设备上也会退出登录。`,`永久删除`,async()=>{let e=await a.deleteAccount();e.ok?(l(),i(`账号已删除。`)):e.pendingLocalCleanup?(l(),i(Gn(e.message,`账号已在云端删除，但这台设备还没清理完。`))):i(Yn(e))},!0),`btn3d danger-ghost wide`,{"data-delete-account":``})),p(g,a.status()),f}function _(){if(!o.configured)return null;let n=a.account();if(!n)return t(`登录 / 注册：换设备也能接着学`,()=>m(),`acct-link`,{"data-login-link":``});let r=e(`span`,{class:`acct-mini`,"data-sync-mini":``});d.add(r);let i=e(`div`,{class:`acct-row-mini`},e(`span`,{text:n.email||`已登录`}),r);return p(r,a.status()),i}return{openLogin:m,accountCard:g,accountRow:_,refreshStatus:f}}function $n(e,t){if(!Number.isFinite(e))return``;try{return new Date(e).toLocaleTimeString(`zh-CN`,{hour12:!1,timeZone:t})}catch{return``}}function er({sha:e,previewId:t,target:n,status:r,account:i,recovery:a,build:o,online:s=!0,tz:c}){let l=r||{},u=i?l.status===`synced`?`已同步 ✓`:l.status===`syncing`?`同步中…`:l.status===`offline`?`离线：进度在这台设备，联网后自动同步`:l.status===`need-login`?`登录已过期，需要重新登录`:l.status===`pending`?`有进度等待上传`:l.status===`error`?`同步失败：`+(l.message||`未知`):l.status===`import-recovery-required`?`游客导入待办损坏：同步已锁定`:l.status===`import-read-failed`?`读不出游客导入待办：同步已锁定`:`准备中…`:`没有登录（游客，只存在这台设备）`,d=n?.mode===`off`?`关闭（这个构建没有连云端）`:n?.mode===`test`?`${n.host}${n.ref?`（项目 `+n.ref+`）`:``}`:n?.mode===`prod`?`⚠ 正式项目（测试入口不该是这个）`:`未知`;return[[`测试入口`,t||`（无）`],[`源码提交`,e||`unknown`],[`构建时间`,o?String(o).slice(0,19).replace(`T`,` `)+` UTC`:`开发版`],[`云项目`,d],[`账号`,i?`${i.email||`已登录`}（${String(i.userId||``).slice(0,8)}…）`:`未登录`],[`同步状态`,u],[`最近确认同步`,i?Number.isFinite(l.lastSyncedAt)?$n(l.lastSyncedAt,c):`本次打开后还没有`:`—`],[`有待上传`,i?l.pending?`是`:`否`:`—`],[`游客导入待办`,{none:`无`,healthy:`有（完好，会自动继续）`,corrupt:`损坏（同步已锁定，见上方账号卡片）`,"read-failed":`读不出来（同步已锁定，可重试）`}[a]||`—`],[`网络`,s?`在线`:`离线`]]}function tr({h:e,isPreview:t,sha:n,previewId:r,target:i,build:a,getStatus:o,getAccount:s,getRecovery:c,getOnline:l=()=>!0}){if(!t)return{card:()=>null,refresh(){}};let u=new Set,d=e=>{e.textContent=er({sha:n,previewId:r,target:i,build:a,status:o(),account:s(),recovery:c(),online:l()}).map(([e,t])=>`${e}：${t}`).join(`
`)};return{card(){let t=e(`pre`,{class:`diag preview-info`,"aria-label":`测试入口信息`,"data-preview-info":``});return t.dataset.sha=n||``,t.dataset.cloudHost=i?.host||``,d(t),u.add(t),e(`div`,{class:`selftest`},e(`h3`,{text:`测试入口信息`}),t)},refresh(){for(let e of[...u])e.isConnected?d(e):u.delete(e)}}}var nr=`suipian-progress`,rr=/^[A-Za-z0-9_-]{1,40}$/,ir=/^\d{4}-\d{2}-\d{2}$/,ar=(e,t)=>Number.isInteger(e)&&e>=0&&e<=t;function or(e=new Date){let t=e=>String(e).padStart(2,`0`);return`suipian-progress-${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())}.json`}function sr(e,{now:t=Date.now(),build:n=``,unreadable:r=[]}={}){return{format:nr,exportVersion:1,exportedAt:new Date(t).toISOString(),build:String(n||``),state:e,unreadable:r.map(e=>({savedAt:e.savedAt,raw:e.raw}))}}function cr(e){if(typeof e!=`string`||!e.trim())return{ok:!1,error:`文件是空的。`};if(e.length>1048576)return{ok:!1,error:`文件太大，不像是从碎片编程导出的进度文件。`};let t;try{t=JSON.parse(e)}catch{return{ok:!1,error:`文件内容不是有效的进度文件（无法读取）。`}}if(!t||typeof t!=`object`||t.format!==`suipian-progress`)return{ok:!1,error:`这不是碎片编程的进度文件。`};if(t.exportVersion!==1)return{ok:!1,error:`这个进度文件来自不同版本，当前版本不认识，没有导入任何内容。`};let n=t.state;if(!n||typeof n!=`object`||n.version!==3)return{ok:!1,error:`进度文件里的学习记录格式不对，没有导入任何内容。`};if(!ar(n.xp,1e7)||!ar(n.streak,1e5)||!ar(n.lessonsCompleted??0,1e7))return{ok:!1,error:`进度文件里的数字不合理，没有导入任何内容。`};if(n.lastDay!=null&&!(typeof n.lastDay==`string`&&ir.test(n.lastDay)))return{ok:!1,error:`进度文件里的日期不合理，没有导入任何内容。`};if(!n.done||typeof n.done!=`object`||Array.isArray(n.done))return{ok:!1,error:`进度文件里缺少关卡完成记录，没有导入任何内容。`};let r={};for(let[e,t]of Object.entries(n.done)){if(!rr.test(e)||e===`__proto__`)return{ok:!1,error:`进度文件里有不合法的关卡编号，没有导入任何内容。`};t===!0&&(r[e]=!0)}return{ok:!0,exportedAt:typeof t.exportedAt==`string`?t.exportedAt:null,state:{xp:n.xp,streak:n.streak,lastDay:n.lastDay??null,done:r,lessonsCompleted:n.lessonsCompleted??0}}}function lr(e,t){let n={...e.done};for(let e of Object.keys(t.done))n[e]=!0;let r=e.lastDay,i=t.lastDay,a=e.streak,o=r;return i&&(!r||i>r)?(a=t.streak,o=i):i&&r===i&&(a=Math.max(e.streak,t.streak)),{...e,onboarded:!0,xp:Math.max(e.xp,t.xp),lessonsCompleted:Math.max(e.lessonsCompleted||0,t.lessonsCompleted||0),done:n,streak:a,lastDay:o,hearts:Math.min(5,e.hearts)}}function ur(e){return{xp:e.xp,lessons:Object.keys(e.done).length,streak:e.streak,lastDay:e.lastDay}}var dr=[5,10,20],fr=(e,t)=>`${e}#${t}`;function pr(e,t){return e.map(e=>({id:e.id,title:e.title,lessons:e.lessons.filter(e=>t&&t[e.id]===!0).map(e=>({id:e.id,title:e.title,count:e.exercises.length}))})).filter(e=>e.lessons.length>0)}function mr(e,t,n){let r=new Set(n),i=[],a=new Set;for(let n of e)for(let e of n.lessons)t&&t[e.id]===!0&&r.has(e.id)&&e.exercises.forEach((t,r)=>{let o=fr(e.id,r);a.has(o)||(a.add(o),i.push({id:o,lessonId:e.id,unitId:n.id,index:r,ex:t}))});return i}function hr(e,t=Math.random){let n=[...e];for(let e=n.length-1;e>0;e--){let r=Math.floor(t()*(e+1));[n[e],n[r]]=[n[r],n[e]]}return n}function gr(e,t,n=Math.random){let r=[...new Map(e.map(e=>[e.id,e])).values()],i=Math.min(t,r.length);return{items:hr(r,n).slice(0,i),requested:t,actual:i,short:i<t}}function _r(e,t=Math.random){let n=JSON.parse(JSON.stringify(e));return n.type===`predict`||n.type===`pick`?n.options=hr(n.options,t):n.type===`fill`?n.tokens=hr(n.tokens,t):n.type===`order`&&(n.shuffled=hr(n.shuffled,t)),n}var vr=`modulepreload`,yr=function(e,t){return new URL(e,t).href},br={},xr=function(e){return e.pathname.endsWith(`.css`)},Sr=function(e,t,n){if(t in e)return e[t];let r=n();if(!r){e[t]=void 0;return}let i=r.then(()=>{e[t]=void 0},n=>{throw e[t]=void 0,n});return e[t]=i,i},Cr=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e,i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?new URL(import.meta.resolve(e)):new URL(e,import.meta.url)}r=o(t.map(t=>{t=yr(t,n);let r=s(t),i=xr(r);return Sr(br,r.href,()=>{if(e===void 0){e={all:new Set,styles:new Set};let t=document.getElementsByTagName(`link`);for(let n=t.length-1;n>=0;n--){let r=t[n];e.all.add(r.href),r.rel===`stylesheet`&&e.styles.add(r.href)}}if((i?e.styles:e.all).has(r.href))return;let t=document.createElement(`link`);if(t.rel=i?`stylesheet`:vr,i||(t.as=`script`),t.crossOrigin=``,t.href=r.href,a&&t.setAttribute(`nonce`,a),document.head.appendChild(t),i)return new Promise((e,n)=>{t.addEventListener(`load`,e),t.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${r}`)))})})}).filter(e=>e!==void 0))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},wr=[`modify`,`write`],Tr=e=>wr.includes(e?.type),Er=null,Dr=null;function Or(){let e=()=>Cr(()=>import(`./code-task-CUrdL1Du.js`).then(e=>{if(!e?.createCodeArea)throw Error(`代码题模块没有加载成功`);return e}),__vite__mapDeps([0,1,2,3,4]),import.meta.url);return Dr||(Dr=e().catch(e).then(e=>Er=e).catch(e=>{throw Dr=null,e})),Dr}var kr={U1:o,U2:s,U3:c,U4:l,U5:u,U6:d,U7:f},Ar=10,jr=5,Mr=10,Nr=120,Pr=/iP(hone|ad|od)/.test(navigator.userAgent)||navigator.platform===`MacIntel`&&navigator.maxTouchPoints>1,Fr=navigator.standalone===!0||matchMedia(`(display-mode: standalone)`).matches;Pr&&!Fr&&document.documentElement.classList.add(`ios-browser`);function K(e,t={},...n){let r=document.createElement(e);for(let[e,n]of Object.entries(t))n!=null&&n!==!1&&(e===`class`?r.className=n:e===`text`?r.textContent=n:e.startsWith(`on`)?r.addEventListener(e.slice(2),n):r.setAttribute(e,n===!0?``:n));for(let e of n.flat())e!=null&&e!==!1&&r.append(e);return r}function q(e,t,n=`btn`,r={}){let i=K(`button`,{type:`button`,class:n,...r},e);return i.addEventListener(`click`,e=>{i.disabled||t(e)}),i}var Ir=`http://www.w3.org/2000/svg`;function J(e,t,...n){let r=document.createElementNS(Ir,e);for(let[e,n]of Object.entries(t))r.setAttribute(e,n);return n.forEach(e=>{e!=null&&e!==!1&&r.append(e)}),r}var Lr={flame:`M12 3c.8 3.2 5 5.2 5 9.8a5 5 0 0 1-10 0c0-2 .9-3.3 2.2-4.4.4 1.6 1.2 2.3 2 2.6-.4-2.6-.2-5 .8-8z`,bolt:`M13 2.5 5.5 13H11l-1 8.5L18.5 10H13z`,heart:`M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z`,home:`M4 11l8-7 8 7v9H4zM10 20v-6h4v6`,user:`M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21c0-4 3.5-6 7.5-6s7.5 2 7.5 6`,check:`M5 12.5l4.5 4.5L19 7`,lock:`M7 11h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM8.5 11V8a3.5 3.5 0 0 1 7 0v3`,star:`M12 3l2.7 5.9 6.3.7-4.7 4.3 1.3 6.2L12 16.8l-5.6 3.3 1.3-6.2L3 9.6l6.3-.7z`,trophy:`M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8`,shield:`M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z`,close:`M6 6l12 12M18 6L6 18`,cross:`M7 7l10 10M17 7L7 17`,play:`M8 5.5v13l11-6.5z`,review:`M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5`};function Y(e,{size:t=22,fill:n=!1,cls:r=``}={}){return J(`svg`,{viewBox:`0 0 24 24`,width:t,height:t,class:`ico `+r,"aria-hidden":`true`,fill:n?`currentColor`:`none`,stroke:`currentColor`,"stroke-width":`2`,"stroke-linecap":`round`,"stroke-linejoin":`round`},J(`path`,{d:Lr[e]}))}var Rr=16;function zr(e,t,n){let r=Math.round,i=[],a=(e,t,n)=>i.push({d:e,pulse:t,pads:n});if(e===`edge`){let e=(e,n,i,a)=>`M${e} ${r(n)}V${r(i)}L${e+(e<t/2?6:-6)} ${r(i+6)}V${r(a)}`,o=e(6,0,n*.26,n*.6);a(o,o,[[12,r(n*.6)]]);let s=e(t-6,n*.12,n*.45,n*.83);a(s,s,[[t-12,r(n*.83)]]);let c=`M6 ${r(n*.72)}V${r(n)}`;a(c,c,[[6,r(n)]]);let l=`M${t-6} ${r(n*.9)}V${r(n)}`;return a(l,l,[[t-6,r(n)]]),{lines:i,pulses:[[0,11,0],[1,9,-5]]}}let o=(e,n,i,o,s,c)=>{let l=n=>r(e?t-n:n),u=o>=n?1:-1,d=i+Rr,f=`M${e?r(t):0} ${r(n)}H${l(i)}L${l(d)} ${r(n+Rr*u)}V${r(o)}`,p=[[l(d),r(o)]],m=f;s!=null&&(m+=`M${l(d)} ${r(s)}H${l(d+c)}`,p.push([l(d+c),r(s)],[l(d),r(s)])),a(m,f,p)},s=(e,t,n)=>{let i=`M${r(e)} 0V${r(t)}L${r(e+Rr)} ${r(t+Rr)}H${r(n)}`;a(i,i,[[r(n),r(t+Rr)]])};return o(!1,n*.12,t*.1,n*.31,n*.215,t*.1),s(t*.3,n*.12,t*.43),o(!0,n*.17,t*.09,n*.39,n*.29,t*.08),o(!1,n*.52,t*.08,n*.68,n*.6,t*.08),o(!0,n*.64,t*.09,n*.84,n*.75,t*.08),o(!1,n*.9,t*.16,n*.82,null,0),s(t*.74,n*.1,t*.88),{lines:i,pulses:[[0,10,0],[2,12,-4],[3,9,-2],[4,11,-7]]}}function Br(e,t){let n=Math.max(240,Math.round(window.innerWidth)),r=Math.max(240,Math.round(window.innerHeight));e.setAttribute(`viewBox`,`0 0 ${n} ${r}`);let i=zr(t,n,r);e.replaceChildren(...i.lines.map(e=>J(`path`,{d:e.d,class:`trace`})),...i.lines.flatMap(e=>e.pads.map(([e,t])=>J(`circle`,{cx:String(e),cy:String(t),r:`3.5`,class:`pad`}))),...i.pulses.map(([e,t,n])=>J(`path`,{d:i.lines[e].pulse,class:`pulse`,pathLength:`100`,style:`animation-duration:${t}s;animation-delay:${n}s`})))}var Vr=new Set;function Hr(e=`full`){let t=J(`svg`,{class:`circuit-bg `+e,preserveAspectRatio:`none`,"aria-hidden":`true`,focusable:`false`});return Br(t,e),Vr.add([t,e]),t}var Ur;window.addEventListener(`resize`,()=>{clearTimeout(Ur),Ur=setTimeout(()=>{for(let e of[...Vr])e[0].isConnected?Br(e[0],e[1]):Vr.delete(e)},120)}),document.addEventListener(`visibilitychange`,()=>document.documentElement.classList.toggle(`bg-paused`,document.hidden));function Wr(e,t){let n=e===`done`?`check`:e===`current`?t?`review`:`play`:t?`review`:`lock`,r=Y(n,{size:32,fill:n===`play`,cls:`hex-ico`});r.setAttribute(`x`,`20`),r.setAttribute(`y`,`20`);let i=e===`locked`&&t?Y(`lock`,{size:16,cls:`hex-badge`}):null;return i&&(i.setAttribute(`x`,`47`),i.setAttribute(`y`,`46`)),J(`svg`,{viewBox:`0 0 72 72`,width:`72`,height:`72`,class:`hexnode`,"aria-hidden":`true`,"data-icon":n},e===`current`?J(`polygon`,{points:`36,1 67,19 67,53 36,71 5,53 5,19`,class:`hex-ring`}):null,J(`polygon`,{points:`36,5 63,20.5 63,51.5 36,67 9,51.5 9,20.5`,class:`hex-body`}),J(`circle`,{cx:`36`,cy:`5`,r:`2.8`,class:`hex-pad`}),J(`circle`,{cx:`36`,cy:`67`,r:`2.8`,class:`hex-pad`}),r,i)}function Gr(e=96,t=`happy`){t===`sad`&&(t=`companion`);let n=e=>J(`path`,{d:e,class:`m-ink`}),r={happy:[n(`M36 44Q31 51 36 58`),n(`M64 44Q69 51 64 58`)],think:[n(`M37 40Q32 47 37 54`),n(`M66 40Q71 47 66 54`)],companion:[n(`M31 50Q36 56 41 50`),n(`M59 50Q64 56 69 50`)],celebrate:[n(`M31 54Q36 46 41 54`),n(`M59 54Q64 46 69 54`)]}[t],i={happy:J(`path`,{d:`M42 68Q50 75 58 68`,class:`m-ink`}),think:J(`path`,{d:`M45 69H57`,class:`m-ink`}),companion:J(`path`,{d:`M44 68Q50 72 56 68`,class:`m-ink`}),celebrate:J(`path`,{d:`M42 66Q50 80 58 66z`,class:`m-ink m-solid`})}[t];return J(`svg`,{viewBox:`0 0 100 100`,width:e,height:e,class:`mascot`,"aria-hidden":`true`},J(`rect`,{x:`26`,y:`86`,width:`14`,height:`9`,rx:`3`,class:`m-solid m-ink`}),J(`rect`,{x:`60`,y:`86`,width:`14`,height:`9`,rx:`3`,class:`m-solid m-ink`}),J(`path`,{d:`M22 12H66L90 36V80Q90 90 80 90H22Q12 90 12 80V22Q12 12 22 12Z`,class:`m-body`}),J(`path`,{d:`M66 12L90 36H76Q66 36 66 26Z`,class:`m-fold`}),...r,i,t===`celebrate`?J(`path`,{d:`M14 6v8M10 10h8`,class:`m-spark`}):null)}var Kr=e=>K(`span`,{class:`tk-txt`,text:e});function qr(e){let t=[],n=/("[^"]*"?)|(\b\d+(?:\.\d+)?\b)|(\bprint\b)|([=+\-*/()])/g,r=0,i;for(;i=n.exec(e);){i.index>r&&t.push(Kr(e.slice(r,i.index)));let n=i[1]?`tk-str`:i[2]?`tk-num`:i[3]?`tk-fn`:`tk-op`;t.push(K(`span`,{class:n,text:i[0]})),r=i.index+i[0].length}return r<e.length&&t.push(Kr(e.slice(r))),t}function Jr(e,t=``){return K(`div`,{class:`codeblock `+t},e.split(`
`).map((e,t)=>K(`div`,{class:`cl`},K(`span`,{class:`ln`,text:String(t+1)}),K(`span`,{class:`lc`},qr(e)))))}var Yr=Le(),X=Yr.state,Xr=Yr.notice;he(X.prefs),Xr&&Re(X);var Zr=null;try{Zr=window.localStorage}catch{}var Qr=at({url:$e.url,anonKey:$e.anonKey}),$r=null,ei=`path`,ti=`这个账号的进度已在别的设备上被替换，这台设备上还没上传的学习内容没有保留。`,ni=!1,ri=null;function ii(e){return ni?(ni=!1,ri=e):ri!==e&&(ri=null),ri===e?ti:null}var ai=null,Z=Zr?yn({storage:Zr,api:Qr,projectId:Je($e.url)||`cloud-off`,legacyProject:Ye,onStatus:()=>{$r?.refreshStatus(),ai?.refresh()},onNotice:e=>{e===`replaced`&&(ni=!0,ei===`path`?$():ei===`me`&&zi())},onState:e=>{X=jt(e,X),he(X.prefs),ei===`path`?$():ei===`me`&&zi()}}):null,oi=Z?Z.restore(X):null;oi&&(X=oi.state,Xr=null,he(X.prefs));function si(){if(Z&&Z.account()){let e=Z.persistLocal(X);e.ok||wi(`无法保存进度到这台设备（`+(e.message||`存储不可用`)+`），关掉页面后进度可能丢失。`)}else Re(X)||wi(`无法保存进度（可能是无痕模式或存储已满），关掉页面后进度会丢失。`)}$r=Qn({h:K,button:q,sheet:Si,icon:Y,showToast:wi,sync:Z,api:Qr,getState:()=>X,rerender:()=>ei===`me`?zi():$(),onSwitchedIn:e=>{X=e.state,he(X.prefs),Xr=null,ei===`me`?zi():$()},onSwitchedOut:()=>{let e=Le();X=e.state,Xr=e.notice,X.onboarded||(X.onboarded=!0,si()),he(X.prefs),ei===`me`?zi():$()}}),ai=tr({h:K,isPreview:!0,sha:`cc90e07194a9dc1ad0e90b7c75afedb990a83463`,previewId:`u67c`,build:`2026-11-10T20:11:53.620Z`,target:et(),getStatus:()=>Z?Z.status():{},getAccount:()=>Z?Z.account():null,getRecovery:()=>Z&&Z.account()?Z.pendingRecoveryInfo().state:`none`,getOnline:()=>navigator.onLine!==!1}),Z&&oi&&Z.syncNow(),addEventListener(`online`,()=>ai?.refresh()),addEventListener(`offline`,()=>ai?.refresh()),Z&&(addEventListener(`online`,()=>{Z.account()&&Z.syncNow()}),document.addEventListener(`visibilitychange`,()=>{document.visibilityState===`visible`&&Z.account()&&Z.syncNow()}),setInterval(()=>{document.visibilityState===`visible`&&Z.account()&&Z.status().pending&&Z.syncNow()},6e4));var ci=()=>a.units.filter(e=>e.available).flatMap(e=>kr[e.id].lessons.map(t=>({...t,unit:e.id}))),li=()=>ci().find(e=>!X.done[e.id]);function ui(e){return X.done[e.id]?`done`:li()?.id===e.id?`current`:`locked`}var di=null,fi={status:`未启用`,caches:[]},Q=document.getElementById(`app`),pi=new Set,mi=null,hi=new t({onStatus(e,t){e===`loadError`&&(mi=t||{});for(let n of[...pi])n.status?.(e,t)},onOutput(e){for(let t of[...pi])t.output?.(e)}}),gi=D(hi);function _i(t){return new Promise(n=>{let r=null,i=null,a=e=>{clearTimeout(i),r&&pi.delete(r),n(e)},o=()=>{let e=``,r={output:t=>{e+=t},status:(t,i)=>{[`done`,`timeout`,`stopped`,`outputLimit`,`outputLimitStopped`].includes(t)&&(pi.delete(r),n(t===`done`?{out:e,error:i.error}:{out:e,error:{kind:`Stopped`,line:null,msg:`运行被停止`}}))}};pi.add(r),hi.run(t)||(pi.delete(r),n(null))};if(hi.state===`ready`)return o();r={status:e=>{e===`ready`?(pi.delete(r),clearTimeout(i),o()):e===`loadError`&&a(null)}},pi.add(r),i=setTimeout(()=>a(null),e.loadMs+2e3),hi.state===`loadError`&&hi.boot()})}function vi(){let e=`选择、填空、排序的判分不受影响。`;if(navigator.onLine===!1)return`你现在离线。Python运行功能需要联网后加载，联网后点“重试”。`+e;let t=[];if(typeof WebAssembly>`u`&&t.push(`WebAssembly`),typeof Worker>`u`&&t.push(`后台线程（Worker）`),t.length)return`这个浏览器不支持运行 Python 需要的功能（缺少：${t.join(`、`)}）。可以升级系统或浏览器，或换成 Safari / Chrome 打开。选择、填空、排序的判分不受影响。`;if(mi?.kind===`noWorker`)return`这个环境不允许启动 Python 运行线程（可能是浏览器版本较旧，或应用内置浏览器的限制）。可以点右上角“···”选“在浏览器打开”，或换成 Safari / Chrome。`+e;let n=navigator.userAgent.match(/OS (\d+)[_.](\d+)/),r=n?n[1]+`_`+n[2]:``;if(n&&/iPhone|iPod/.test(navigator.userAgent)&&(+n[1]<16||+n[1]==16&&+n[2]<4))return`这台设备的系统是 iOS ${n[1]}.${n[2]}，低于运行 Python 所需的 iOS 16.4（Pyodide 官方要求），所以看不到“运行结果”。升级系统后即可显示。选择、填空、排序的判分不受影响。`;let i=`诊断：${String(mi?.msg||`无错误信息`).slice(0,120)}；在线：${navigator.onLine?`是`:`否`}${r?`；iOS `+r.replace(`_`,`.`):``}${/MicroMessenger|QQ\//i.test(navigator.userAgent)?`；微信/QQ 内`:``}`;return`Python 运行环境没有加载成功，原因未确认（可能是网络、浏览器版本，或应用内置浏览器的限制）。Python运行功能需要联网后加载，联网后点“重试”；仍然不行，请把下面的诊断信息发给开发者。`+e+`
`+i}function yi(e,t){let r=e.querySelector(`pre`);e.querySelector(`.py-retry`)?.remove(),r.className=`out`,r.textContent=`运行中…`,e.open=!0,_i(t).then(i=>{r.isConnected&&(i?(r.textContent=i.error?(i.out?i.out+`
`:``)+n(i.error):i.out||`程序运行完成，没有输出`,r.className=`out`+(i.error?` error`:``)):(r.textContent=vi(),r.className=`out offline`,e.append(q(`重试`,()=>yi(e,t),`btn small py-retry`,{"data-retry-python":``}))))})}var bi=`button, a[href], input, select, textarea, [tabindex]`;function xi(e){return[...e.querySelectorAll(bi)].filter(e=>{if(e.disabled||e.getAttribute(`tabindex`)===`-1`||e.closest(`[hidden]`)||e.tagName===`INPUT`&&e.type===`hidden`)return!1;let t=getComputedStyle(e);if(t.visibility===`hidden`||t.display===`none`)return!1;let n=e.getBoundingClientRect();return n.width>0&&n.height>0})}function Si(e,{onClose:t,cls:n=``,canClose:r}={}){let i=document.activeElement,a=()=>{if(!s.isConnected)return;let e=s.contains(document.activeElement);s.remove(),t?.(),i&&i!==document.body&&i.isConnected&&i.focus?i.focus({preventScroll:!0}):e&&document.activeElement&&document.activeElement!==document.body&&document.activeElement.blur?.()},o=Date.now(),s=K(`div`,{class:`overlay `+n,role:`dialog`,"aria-modal":`true`,tabindex:`-1`},K(`div`,{class:`sheet`},e(a)));s.addEventListener(`click`,e=>{e.target===s&&Date.now()-o>800&&(!r||r())&&a()}),s.addEventListener(`keydown`,e=>{if(e.key===`Escape`){e.preventDefault(),(!r||r())&&a();return}if(e.key!==`Tab`)return;let t=xi(s);if(!t.length){e.preventDefault(),s.focus({preventScroll:!0});return}e.preventDefault();let n=t.indexOf(document.activeElement);(e.shiftKey?n<=0?t[t.length-1]:t[n-1]:n<0||n===t.length-1?t[0]:t[n+1]).focus()});let c=s.querySelector(`h2, h1`);return c&&(c.id||(c.id=`sheet-title-`+o),s.setAttribute(`aria-labelledby`,c.id)),document.body.append(s),(xi(s)[0]||s).focus({preventScroll:!0}),a}var Ci;function wi(e){let t=document.querySelector(`.toast`);t||(t=K(`div`,{class:`toast`,role:`alert`}),document.body.append(t)),t.textContent=e,clearTimeout(Ci),Ci=setTimeout(()=>t.remove(),6e3)}var Ti=e=>{let t=Math.ceil(e/6e4);return t>=60?`${Math.floor(t/60)} 小时 ${t%60} 分钟`:`${t} 分钟`};function Ei(e=0){let t=[{text:`你好，我是小码！`,sub:``,mood:`happy`},{text:`我会陪你一关一关学 Python。`,sub:`每关只要两三分钟，全部用点的，不用打字。`,mood:`companion`},{text:`卡住了就点我，我会给你提示。`,sub:`做题时我在左下角。`,mood:`think`}],n=t[e];Q.replaceChildren(K(`main`,{class:`onboard`},K(`div`,{class:`onboard-mid`},Gr(120,n.mood),K(`h1`,{text:n.text}),n.sub?K(`p`,{text:n.sub}):null),K(`div`,{class:`onboard-dots`},t.map((t,n)=>K(`span`,{class:n===e?`on`:``}))),e===t.length-1&&Qr.configured?q(`已有账号？登录`,()=>$r.openLogin({reason:`登录后会取回你在云端保存的进度。`}),`btn3d ghost wide`,{"data-onboard-login":``}):null,q(e<t.length-1?`继续`:`开始学习`,()=>{e<t.length-1?Ei(e+1):(X.onboarded=!0,si(),$())},`btn3d primary wide`)))}function Di(e=``){return K(`span`,{class:`stat hearts `+e,title:`红心`,"aria-label":`红心 ${X.hearts}`},Y(`heart`,{size:20,fill:X.hearts>0}),String(X.hearts))}function Oi(){let e=Be(X),t=Di();return t.title=e?`下一颗红心：${Ti(e)}后`:`红心已满`,K(`header`,{class:`statsbar`},K(`span`,{class:`stat streak`,"aria-label":`连续 ${Ge(X)} 天`},Y(`flame`,{size:20}),String(Ge(X))),K(`span`,{class:`stat xp`,"aria-label":`经验值 ${X.xp}`},Y(`bolt`,{size:20}),String(X.xp)),t)}function ki(e){return K(`nav`,{class:`tabbar`},q(K(`span`,{},Y(`home`,{size:24}),K(`small`,{text:`学习`})),$,`tab`+(e===`path`?` on`:``),{"aria-label":`学习`}),q(K(`span`,{},Y(`user`,{size:24}),K(`small`,{text:`我的`})),zi,`tab`+(e===`me`?` on`:``),{"aria-label":`我的`}))}function $(){Wi?.destroy?.(),Wi=null,ei=`path`;{let e=ii(`path`);e&&(Xr=e)}Be(X),di=null;let e=a.units.map(e=>{if(!e.available)return K(`section`,{class:`unit locked`},K(`div`,{class:`unit-banner`},K(`div`,{class:`unit-no`,text:`第 ${a.units.indexOf(e)+1} 单元 · 即将推出`}),K(`h2`,{text:e.title}),K(`p`,{text:e.subtitle})));let t=kr[e.id].lessons,n=t.every(e=>X.done[e.id]);return K(`section`,{class:`unit`+(n?` complete`:``)},K(`div`,{class:`unit-banner`},K(`div`,{class:`unit-no`,text:`第 ${a.units.indexOf(e)+1} 单元${n?` · 已完成`:``}`}),K(`h2`,{text:e.title}),K(`p`,{text:e.subtitle})),K(`ol`,{class:`path`},t.map((e,t)=>{let n=ui(e),r=[0,1,2,1,0,-1][t%6],i=q(K(`span`,{class:`node-face`,"aria-hidden":`true`},Wr(n,!!e.review)),()=>ji(e),`node ${n}${e.review?` review`:``}`,{"aria-label":`${e.title}（${n===`done`?`已完成`:n===`current`?`当前关卡`:`未解锁`}）`,"data-lesson":e.id});return K(`li`,{class:`path-item`,style:`--off:${r}`},n===`current`?K(`div`,{class:`bubble`,"aria-hidden":`true`,onclick:()=>ji(e),text:t===0&&!X.done[e.id]&&X.xp===0?`从这里开始`:`开始`}):null,i,K(`div`,{class:`node-label`,text:e.title}))})))});Q.replaceChildren(Hr(`full`),Oi(),K(`main`,{class:`view pathview`},Xr?K(`p`,{class:`notice`,role:`status`,text:Xr}):null,na(),$r?.accountRow(),e),ki(`path`)),Xr=null,Ai()}function Ai(){let e=Q.querySelector(`.pathview`),t=e?.querySelector(`.node.current`);if(!t)return;let n=[t,t.parentElement?.querySelector(`.bubble`),t.parentElement?.querySelector(`.node-label`)].filter(Boolean),r=e.getBoundingClientRect(),i=e.querySelector(`.practice-entry-wrap`),a=i?Math.max(r.top,i.getBoundingClientRect().bottom):r.top,o=Math.min(...n.map(e=>e.getBoundingClientRect().top)),s=Math.max(...n.map(e=>e.getBoundingClientRect().bottom)),c=r.bottom-a,l=s-o,u=l>=c?a+4:a+(c-l)/2;e.scrollTop+=o-u}function ji(e){let t=ui(e);Si(n=>[K(`div`,{class:`lsheet`},K(`div`,{class:`lsheet-concept`,text:e.concept}),K(`h2`,{text:e.title}),K(`p`,{text:t===`locked`?`先完成前面的关卡，这一关才会解锁。`:e.story}),t===`locked`?q(`知道了`,n,`btn3d wide`):t===`done`?[q(`复习（不扣红心，完成后 +1 红心）`,()=>{n(),Bi(e,{review:!0})},`btn3d primary wide`),q(`关闭`,n,`btn3d ghost wide`)]:[q(`开始 +${e.exercises.length*Ar+Mr} XP`,()=>{n(),Bi(e)},`btn3d primary wide`),q(`关闭`,n,`btn3d ghost wide`)])])}function Mi(e){let t=Be(X),n=ci().filter(e=>X.done[e.id]),r=n[n.length-1]||e;Si(e=>[K(`div`,{class:`lsheet`},Gr(72,`companion`),K(`h2`,{text:`红心用完了`}),K(`p`,{text:`每 30 分钟恢复 1 颗，下一颗还要 ${Ti(t)}。也可以做一关复习：复习不扣红心，完成后恢复 1 颗。`}),q(`复习「${r.title}」`,()=>{e(),Bi(r,{review:!0})},`btn3d primary wide`),q(`稍后再来`,e,`btn3d ghost wide`))])}function Ni(e,t,n,{disabled:r=!1}={}){let i=!!X.prefs[n]&&!r,a=K(`button`,{type:`button`,class:`switch`+(i?` on`:``),role:`switch`,"aria-checked":String(i),"aria-label":e,"data-pref":n,disabled:r||null},K(`span`,{class:`knob`}));return a.addEventListener(`click`,()=>{a.disabled||(X.prefs[n]=!X.prefs[n],he(X.prefs),si(),a.classList.toggle(`on`,X.prefs[n]),a.setAttribute(`aria-checked`,String(X.prefs[n])),n===`sound`&&X.prefs.sound&&z(`select`),n===`haptics`&&X.prefs.haptics&&Oe())}),K(`div`,{class:`toggle-row`},K(`div`,{},K(`b`,{text:e}),K(`small`,{text:t})),a)}function Pi(){let e=K(`pre`,{class:`diag`,"aria-label":`诊断信息`}),t=(t=``)=>{let n=ke();e.textContent=[`应用版本：2026-11-10 20:11 UTC（测试入口 u67c）`,`缓存版本：${fi.caches.length?fi.caches.join(`、`).replace(/suipian-/g,``).slice(0,40):`无`}`,`离线支持：${fi.status}`,`网络：${navigator.onLine===!1?`离线`:`在线`}`,`运行方式：${Fr?`主屏幕 App`:`浏览器`}`,`音效开关：${n.soundPref?`开`:`关`}`,`AudioContext：${n.audioState}${n.sampleRate?`（${n.sampleRate} Hz）`:``}`,`音频会话：${n.audioSession}`,`已播放 ${n.played} 次，被丢弃 ${n.dropped} 次，解锁尝试 ${n.unlocks} 次`,`状态变化：${n.history||`无`}`,`网页振动接口：${n.vibrate?`有`:`没有`}`,`最近错误：${n.lastError||`无`}`,t].filter(Boolean).join(`
`)};return t(),fa().then(()=>{e.isConnected&&t()}),K(`div`,{class:`selftest`},K(`div`,{class:`selftest-btns`},q(`试听音效`,()=>{De().then(e=>t(e?`试听：已播放答对音（听不到就看上面的状态）`:`试听：没有播放成功`)),t(`试听：请求中…`)},`btn3d wide`,{"data-selftest":`sound`}),me()?q(`试振动`,()=>{let e=`没有网页振动接口，这个按钮不会振动`;if(me())try{e=navigator.vibrate(12)?`已请求 12ms 振动`:`振动请求被浏览器拒绝`}catch{e=`振动请求出错`}t(`试振动：`+e)},`btn3d wide`,{"data-selftest":`haptic`}):null),K(`div`,{class:`soundrow`,role:`group`,"aria-label":`正式音效试听`},...[[`select`,`点选`],[`place`,`放入`],[`undo`,`撤销`],[`correct`,`答对`],[`wrong`,`答错`],[`finish`,`过关`]].map(([e,n])=>q(n,()=>{z(e,{force:!0}).then(e=>t(`正式音效「${n}」：${e?`已播放`:`没有播放成功`}`))},`chip`,{"data-sound":e}))),e)}function Fi(){let e=[],t=K(`pre`,{class:`diag`,"aria-label":`音频测试结果`}),n=()=>{try{return navigator.audioSession?navigator.audioSession.type:`（浏览器没有 audioSession）`}catch{return`（读取失败）`}},r=(navigator.userAgent.match(/(Version|CriOS|Chrome|OS) ?\/?[\d._]+/g)||[]).slice(0,2).join(` `),i=()=>{t.textContent=[`运行方式：${Fr?`主屏幕 App`:`Safari / 浏览器`}`,`系统：${r||`未知`}`,`音频会话：${n()}`,`—`,...e].join(`
`)},a=t=>{e.push(t),e.length>14&&e.shift(),i()},o=new URL(`sfx/test-beep.wav`,document.baseURI).href,s=new Audio;s.preload=`auto`,s.addEventListener(`canplaythrough`,()=>a(`[文件] 加载成功（${Number.isFinite(s.duration)?s.duration.toFixed(2):`?`} 秒）`)),s.addEventListener(`error`,()=>a(`[文件] 加载失败（code ${s.error?.code}：${s.error?.message||`无信息`}）`)),s.src=o;try{s.load()}catch(e){a(`[文件] load() 出错：${e.message}`)}fetch(o).then(e=>e.arrayBuffer().then(t=>a(`[文件] 网络读取 ${e.status}，${t.byteLength} 字节`))).catch(e=>a(`[文件] 网络读取失败：${e.message}`)),i();let c=(e,t)=>()=>{try{let n=``;try{navigator.audioSession&&(navigator.audioSession.type=e,n=`，audioSession 设为 ${e}`)}catch(e){n=`，audioSession 设置失败：${e.message}`}let r=window.AudioContext||window.webkitAudioContext;if(!r){a(`[${t}] 浏览器没有 AudioContext`);return}let i=new r,o=i.state;i.resume();let s=i.createOscillator(),c=i.createGain();s.type=`sine`,s.frequency.value=880,c.gain.setValueAtTime(1e-4,i.currentTime),c.gain.exponentialRampToValueAtTime(.6,i.currentTime+.01),c.gain.exponentialRampToValueAtTime(1e-4,i.currentTime+.3),s.connect(c),c.connect(i.destination),s.start(),s.stop(i.currentTime+.35),a(`[${t}] 点击内已发出声音指令；创建时 state=${o}${n}`),setTimeout(()=>a(`[${t}] 0.4 秒后 state=${i.state}，currentTime=${i.currentTime.toFixed(3)}（大于 0 说明音频时钟在走）`),400)}catch(e){a(`[${t}] 出错：${e.name}：${e.message}`)}};return K(`div`,{class:`selftest audiolab`},K(`h3`,{text:`音频兼容性测试`}),K(`p`,{class:`muted small`,text:`排查 iPhone 无声：每个按钮都在点击里直接发声。请先关掉静音键，把音量调到一半，三个都点一遍，告诉我哪个能响，并截图下面的结果。`}),K(`button`,{type:`button`,class:`btn3d wide`,"data-audiotest":`webaudio`,onclick:c(`ambient`,`A`)},`测试 A：Web Audio 提示音`),K(`button`,{type:`button`,class:`btn3d wide`,"data-audiotest":`file`,onclick:()=>{try{a(`[B] 点击：readyState=${s.readyState}，networkState=${s.networkState}，error=${s.error?s.error.code:`无`}`),s.pause(),s.currentTime=0;let e=s.play();e&&e.then?e.then(()=>a(`[B] audio.play() 成功`)).catch(e=>a(`[B] audio.play() 失败：${e.name}：${e.message}`)):a(`[B] audio.play() 已调用（浏览器没有返回 Promise）`)}catch(e){a(`[B] play() 抛出：${e.name}：${e.message}`)}}},`测试 B：本地 WAV 文件（<audio>）`),K(`button`,{type:`button`,class:`btn3d wide`,"data-audiotest":`playback`,onclick:c(`playback`,`C`)},`测试 C：Web Audio + 播放模式`),t)}function Ii(){let e=K(`pre`,{class:`diag`,"aria-label":`振动测试结果`},`每个都点几下，凭手感告诉我哪几个有轻微触感。`),t={},n=n=>()=>{t[n]=(t[n]||0)+1;let r=``;if(me())try{r=navigator.vibrate(12)?`；已请求 navigator.vibrate(12)`:`；vibrate 被拒绝`}catch{r=`；vibrate 出错`}else r=`；没有 navigator.vibrate`;e.textContent=Object.entries(t).map(([e,t])=>`${e}：点了 ${t} 次`).join(`
`)+r+`
（是否真的有触感：等待 iPhone 真机确认）`},r=K(`input`,{type:`checkbox`,switch:!0,"data-haptic":`switch`,"aria-label":`原生开关`});r.addEventListener(`change`,n(`2 原生开关`));let i=K(`input`,{type:`checkbox`,switch:!0,class:`hap-hidden`,"data-haptic":`check-label`,"aria-label":`检查按钮样式`});return i.addEventListener(`change`,n(`4 检查按钮样式`)),K(`div`,{class:`selftest hapticlab`},K(`h3`,{text:`振动测试`}),K(`p`,{class:`muted small`,text:`四种控件各点几下，告诉我哪几个手上有轻微触感（iPhone 的 Safari 没有振动接口，这是在找系统自带的反馈）。`}),K(`button`,{type:`button`,class:`btn3d wide`,"data-haptic":`button`,onclick:n(`1 普通按钮`)},`1 普通按钮`),K(`label`,{class:`hap-row`},K(`span`,{text:`2 原生开关（直接点右边的开关）`}),r),K(`button`,{type:`button`,class:`choice hap-choice`,"data-haptic":`choice`,onclick:n(`3 选项样式`)},`3 选项样式的按钮`),K(`label`,{class:`btn3d primary hap-check`,"data-haptic":`check-box`},`4 检查按钮样式（外观是按钮，里面是隐藏的开关）`,i),e)}function Li(){let e=K(`p`,{class:`muted small keylab-status`,role:`status`}),t=()=>O.some(e=>e.id===X.prefs.soundStyle)?X.prefs.soundStyle:`J`,n=()=>{let n=O.find(e=>e.id===t());e.textContent=`当前按键音效：${n.id} ${n.name}${n.id===`J`?`（默认）`:``}`},r=O.map(i=>{let a=t()===i.id,o=K(`button`,{type:`button`,class:`keybtn`+(a?` sel`:``),"data-keysound":i.id,"aria-pressed":String(a)},K(`b`,{text:i.id}),K(`span`,{text:i.name+(i.id===`J`?`（默认）`:``)}),K(`small`,{text:i.desc}));return o.addEventListener(`click`,()=>{X.prefs.soundStyle=i.id,he(X.prefs),si();let t=Ce(i.id,`select`);r.forEach(e=>{let t=e===o;e.classList.toggle(`sel`,t),e.setAttribute(`aria-pressed`,String(t))}),n(),t.ok?X.prefs.sound||(e.textContent+=`（上面的“音效”开关是关的，答题时不会响）`):e.textContent+=`（这次没有发出声音：`+(t.state||`音频环境不可用`)+`）`}),o});return n(),K(`div`,{class:`keylab`},K(`h3`,{text:`按键音效`}),K(`p`,{class:`muted small`,text:`十个原创的矮轴键盘风格，默认 J。点一下试听并选用，答题时的点选、放入、撤销、答对、答错、过关都用同一个风格。`}),K(`div`,{class:`keygrid`},r),e)}function Ri(){let e=!!Z?.account(),t=K(`p`,{class:`backup-msg small muted`,role:`status`,"data-backup-msg":``}),n=K(`div`,{class:`backup-panel`}),r=(e,n=!1)=>{t.textContent=e,t.classList.toggle(`bad`,n)},i=()=>Z?.account()?(n.replaceChildren(),r(`已登录账号，不能导入进度文件。要导入请先退出登录，导入后再登录并选“转存到账号”。`,!0),!0):!1,a=()=>{try{let e=sr(X,{build:`2026-11-10T20:11:53.620Z`,unreadable:Ie()}),t=new Blob([JSON.stringify(e,null,2)],{type:`application/json`}),n=URL.createObjectURL(t),i=K(`a`,{href:n,download:or(new Date),hidden:``});document.body.appendChild(i),i.click(),i.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e4),r(`已导出。文件在浏览器的下载位置（iPhone：“文件”App → 下载），请自己保管好。`)}catch{r(`导出失败，请换个浏览器再试。`,!0)}},o=K(`input`,{type:`file`,accept:`application/json,.json`,hidden:``,"data-import-file":``});return o.addEventListener(`change`,async()=>{let e=o.files&&o.files[0];if(o.value=``,n.replaceChildren(),!e||i())return;let t=``;try{t=await e.text()}catch{r(`读取文件失败。`,!0);return}let a=cr(t);if(!a.ok){r(a.error,!0);return}let s=ur(a.state);r(``),n.replaceChildren(K(`div`,{class:`confirm`,role:`alertdialog`,"data-import-confirm":``},K(`p`,{text:`文件里有：${s.lessons} 个已完成关卡，${s.xp} XP，连续 ${s.streak} 天${a.exportedAt?`（导出于 ${a.exportedAt.slice(0,10)}）`:``}。导入会把这些合并进当前记录：关卡取并集，XP 取较大的，不会让你现有的进度变少。`}),q(`确认导入`,()=>{i()||(X=lr(X,a.state),si(),zi(),wi(`进度已导入。`))},`btn3d primary`),q(`取消`,()=>{n.replaceChildren()},`btn`)))}),K(`section`,{class:`backup`,"data-backup":``},K(`h3`,{text:`备份学习记录`}),K(`p`,{class:`small muted`,text:e?`导出本机学习记录，云端状态以上方为准。已登录时不能导入（要导入请先退出登录）。`:`记录只在这台设备上。导出一份文件自己留着，换手机或清了浏览器数据后可以导回来。`}),K(`div`,{class:`acct-row`},q(`导出进度文件`,a,`btn3d`,{"data-export":``}),e?null:q(`导入进度文件`,()=>o.click(),`btn3d`,{"data-import":``})),o,n,t)}function zi(){ei=`me`,di=null;let e=ii(`me`),t=null,n=q(`清除学习记录`,()=>{t||(t=K(`div`,{class:`confirm`,role:`alertdialog`},K(`p`,{text:`确定要清除这台设备上的全部学习记录吗？XP、连续天数和关卡进度都会清空。`}),q(`确定清除`,()=>{let e=X.prefs;X=ze(),X.prefs=e,X.onboarded=!0,si(),zi(),wi(`学习记录已清除。`)},`btn danger`),q(`取消`,()=>{t.remove(),t=null},`btn`)),n.after(t))},`link small`),r=Be(X),i=ci().filter(e=>X.done[e.id]).length,a=(e,t,n)=>K(`div`,{class:`me-card`},K(`b`,{},e?Y(e,{size:20}):null,t),K(`span`,{text:n}));Q.replaceChildren(Oi(),K(`main`,{class:`view me`},e?K(`p`,{class:`notice`,role:`status`,"data-replaced-notice":``,text:e}):null,K(`div`,{class:`me-head`},Gr(64),K(`div`,{},K(`h1`,{text:`我的学习`}),K(`p`,{class:`muted`,text:Z?.account()?`记录已关联账号，会同步到云端`:`没登录时，记录只保存在这台设备上`}))),K(`div`,{class:`me-grid`},a(`flame`,String(Ge(X)),`连续天数`),a(`bolt`,String(X.xp),`经验值 XP`),a(null,`${i}/${ci().length}`,`已完成关卡`),a(`heart`,`${X.hearts}/5`,r?`${Ti(r)}后 +1`:`红心已满`)),$r?.accountCard(),ai?.card(),Ri(),K(`h3`,{text:`声音与振动`}),Ni(`音效`,`点选、答对、答错、过关的短提示音；跟随手机静音键`,`sound`),me()?Ni(`振动`,`点“检查”和结算页“继续”时请求一次短振；有没有振动取决于你的手机和浏览器，下面可以自测`,`haptics`):K(`div`,{class:`toggle-row no-haptics`,"data-no-haptics":``},K(`div`,{},K(`b`,{text:`振动`}),K(`small`,{text:`此设备暂不支持网页触感反馈。`}))),Li(),Pi(),Fi(),me()||/[?&]haptic-lab\b/.test(location.search)?Ii():null,K(`h3`,{text:`规则`}),K(`ul`,{class:`rules`},K(`li`,{text:`答对一题 +${Ar} XP，完成一关再 +${Mr} XP；复习每题 +${jr} XP。`}),K(`li`,{text:`答错扣 1 颗红心，这道题会放到本关最后再做一次。`}),K(`li`,{text:`红心每 30 分钟恢复 1 颗；复习关不扣红心，完成后恢复 1 颗。`}),K(`li`,{text:`每天完成至少一关，连续天数 +1；断一天就从头算。`})),K(`h3`,{text:`添加到主屏幕`}),K(`p`,{text:`iPhone：用 Safari 打开 → 分享按钮 → 「添加到主屏幕」。从主屏幕打开是全屏的，记录也和 Safari 分开保存。`}),Z?.account()?null:n,K(`p`,{class:`me-foot`},K(`a`,{href:`./privacy.html`,target:`_blank`,rel:`noopener`,"data-privacy-link":``,text:`隐私说明`}))),ki(`me`))}function Bi(e,{review:t=!1}={}){if(ei=`lesson`,ri=null,Be(X),!t&&X.hearts<=0)return Mi(e);let n={lesson:e,review:t,queue:e.exercises.map((e,t)=>t),total:e.exercises.length,correct:0,xp:0,wrongOnce:new Set,mistakes:0};di=n,e.exercises.some(Tr)&&Or().catch(()=>{}),Ui(n)}function Vi(e){let t=Math.round(e.correct/e.total*100);return K(`header`,{class:`lessonbar`},q(Y(`close`,{size:24}),()=>Hi(e),`icon-btn ghost`,{"aria-label":`退出本关`}),K(`div`,{class:`progress`,role:`progressbar`,"aria-valuenow":String(t),"aria-valuemin":`0`,"aria-valuemax":`100`},K(`div`,{class:`progress-fill`,style:`width:${Math.max(4,t)}%`})),e.review?K(`span`,{class:`stat shield`,title:`复习不扣红心`},Y(`shield`,{size:22})):Di())}function Hi(e){Si(e=>[K(`div`,{class:`lsheet`},K(`h2`,{text:`要退出这一关吗？`}),K(`p`,{text:`退出后，本关答题位置不会保存，下次从第 1 题重新开始。已得的 XP 和已扣的红心会保留。`}),q(`继续学习`,e,`btn3d primary wide`),q(`退出`,()=>{e(),$()},`btn3d danger-ghost wide`))])}function Ui(e){let t=e.lesson;Q.replaceChildren(Hr(`full`),Vi(e),K(`main`,{class:`lesson`},K(`div`,{class:`intro-panel intro-head`},K(`div`,{class:`intro-concept`,text:(e.review?`复习 · `:``)+t.concept}),K(`h1`,{class:`intro-title`,text:t.title})),K(`div`,{class:`intro-screen`},Jr(t.introCode,`phone`)),K(`div`,{class:`intro-panel`},K(`p`,{class:`intro-story`,text:t.story}))),K(`footer`,{class:`lessonfoot`},K(`span`,{class:`mascot-slot`},Gr(56)),q(`继续`,()=>Gi(e),`btn3d primary grow`)))}var Wi=null;function Gi(e){if(Wi?.destroy?.(),Wi=null,e.queue.length===0)return $i(e);let t=e.queue[0],n=e.lesson.exercises[t];if(Tr(n)&&!Er)return Ki(e,t);window.__app.currentEx=n,window.__app.renders=(window.__app.renders||0)+1;let r=!1,i=!1,a=Tr(n),o=a||n.type===`pick`?null:K(`details`,{class:`outpanel`},K(`summary`,{text:`运行结果`}),K(`pre`,{class:`out`,text:``})),s=q(`检查`,()=>d(),`btn3d primary grow`,{"data-check":``});s.disabled=!0;let c=()=>{i||(s.disabled=!l.ready())},l=a?Er.createCodeArea(n,{exec:gi,runner:hi,onChange:c,ui:{sheet:Si,button:q},pythonUnavailable:()=>typeof vi==`function`?vi():void 0}):n.type===`predict`?Ji(n,c):n.type===`pick`?Yi(n,c):n.type===`fill`?Zi(n,c):Qi(n,c);Wi=a?l:null,window.__app.currentArea=l;let u=q(Gr(56,`think`),()=>{if(l.openHint)return l.openHint();let e=r||!n.hint?qi(n):n.hint,t=r||!n.hint?`答案是：`:`小码提示：`;r=!0,Si(n=>[K(`div`,{class:`lsheet hint`},K(`div`,{class:`hint-row`},Gr(48,`think`),K(`b`,{text:t})),K(`pre`,{class:`hint-text`,text:e}),q(`好的`,n,`btn3d primary wide`))])},`mascot-btn`,{"aria-label":`让小码给个提示`});Q.replaceChildren(Hr(`edge`),Vi(e),K(`main`,{class:`lesson`},n.tip?K(`p`,{class:`tip-line`},K(`b`,{text:`提示 `}),n.tip):null,K(`h2`,{class:`q`,text:n.prompt}),n.trace?Xi(n.trace):null,l.node,o),K(`footer`,{class:`lessonfoot`},u,s),...l.after?[l.after]:[]);function d(){if(!(i||s.disabled)){if(a)return p();m(l.isCorrect(),!1)}}let f=!1;async function p(){if(f)return;f=!0,s.disabled=!0,s.textContent=`检查中…`,Oe();let e;try{e=await l.check()}finally{f=!1}s.isConnected&&!i&&(e.attempt&&e.settle?m(e.status===`pass`,!0):(s.textContent=`检查`,s.disabled=!l.ready()))}function m(r,c){i=!0,s.disabled=!0,s.textContent=`检查中`,l.lock(),c||Oe(),l.settled?.(r);let u=pe();if(r){e.correct++;let t=e.review?jr:Ar;e.xp+=t,X.xp+=t,si()}else e.mistakes++,e.review||(Ve(X),si()),e.queue.push(t);e.queue.shift();let d=r?l.why():l.whyWrong(),f=!r&&!e.review&&X.hearts<=0;!a&&o&&yi(o,n.type===`predict`?n.code:l.code());let p=!1,m=q(f?`红心用完了`:`继续`,()=>{p||(p=!0,f?($(),Mi(e.lesson)):Gi(e))},`btn3d `+(r?`primary`:`danger`)+` wide`,{"data-continue":``});m.disabled=!0;let h=K(`div`,{class:`feedbar `+(r?`ok`:`bad`),role:`status`},K(`div`,{class:`fb-head`},Y(r?`check`:`cross`,{size:26,cls:`fb-ico`}),K(`b`,{text:r?`答对了！`:`不对哦`}),r?K(`span`,{class:`fb-xp`,text:`+${e.review?jr:Ar} XP`}):null),d?K(`p`,{text:d}):null,!r&&!a?K(`p`,{class:`fb-answer`},`正确答案：`,K(`code`,{text:qi(n)})):null,!r&&!e.review?K(`p`,{class:`fb-heart`},Y(`heart`,{size:16}),`红心 -1（剩 ${X.hearts} 颗）。这道题稍后再做一次。`):null,m);setTimeout(()=>{s.isConnected&&(l.mark(),z(r?`correct`:`wrong`),Q.querySelector(`.lessonfoot`).replaceWith(h),l.afterFeedback?.(),setTimeout(()=>{h.isConnected&&(Q.querySelector(`.lessonbar`).replaceWith(Vi(e)),!r&&!e.review&&Q.querySelector(`.lessonbar .hearts`)?.classList.add(`lost`))},u?0:120),setTimeout(()=>{h.isConnected&&(m.disabled=!1)},u?0:160))},Nr)}}function Ki(e,t){let n=K(`p`,{class:`muted`,role:`status`,text:`正在加载代码题…`});Q.replaceChildren(Hr(`edge`),Vi(e),K(`main`,{class:`lesson`},n));let r=()=>di===e&&e.queue[0]===t&&n.isConnected;Or().then(()=>{r()&&Gi(e)},()=>{r()&&(n.textContent=`代码题没有加载成功（可能是网络问题）。联网后点“重试”；仍不行会重新加载页面：回到地图，这一关从第 1 题开始，已得的 XP 会保留。`,n.after(q(`重试`,()=>Or().then(()=>{di===e&&e.queue[0]===t&&Gi(e)},()=>location.reload()),`btn small`,{"data-retry-code-task":``})))})}function qi(e){if(e.type===`predict`||e.type===`pick`)return e.options.find(e=>e.correct).text;if(e.type===`fill`){let t=e.code;return e.answer.forEach((e,n)=>t=t.replace(`{${n}}`,e)),t}return e.answers[0].map(t=>e.lines[t]).join(`
`)}function Ji(e,t){let n=null,r=!1,i=K(`div`,{class:`choices`},e.options.map((e,a)=>q(K(`pre`,{text:e.text}),()=>{r||(n=a,z(`select`),i.querySelectorAll(`.choice`).forEach((e,t)=>e.classList.toggle(`sel`,t===a)),t())},`choice`,{"aria-label":`选项：${e.text.replace(/\n/g,` 换行 `)}`})));return{node:K(`div`,{},Jr(e.code),i),ready:()=>n!==null,lock:()=>{r=!0},mark:()=>{i.querySelectorAll(`.choice`).forEach((t,r)=>{e.options[r].correct?t.classList.add(`right`):r===n&&t.classList.add(`wrong`)})},isCorrect:()=>!!e.options[n].correct,why:()=>e.options[n].why,whyWrong:()=>e.options[n].why,code:()=>e.code}}function Yi(e,t){let n=Ji({...e,code:e.code||``},t);return e.code||(n.node=K(`div`,{},n.node.lastChild)),n.code=()=>e.code||``,n}function Xi(e){return K(`div`,{class:`trace`,role:`group`,"aria-label":`Python 的报错信息`},K(`div`,{class:`trace-cap`,text:`Python 的报错`}),K(`pre`,{class:`trace-pre`,text:e}))}function Zi(e,t){let n=(e.code.match(/\{\d+\}/g)||[]).length,r=e.initial?[...e.initial]:Array(n).fill(null),i=Math.max(0,r.findIndex(t=>t===null||e.initial&&t===e.initial[0])),a=!1,o=!1,s=K(`div`,{class:`codeblock fill`}),c=K(`div`,{class:`bank`}),l=()=>{s.replaceChildren(...e.code.split(`
`).map((t,n)=>{let s=t.split(/(\{\d+\})/);return K(`div`,{class:`cl`},K(`span`,{class:`ln`,text:String(n+1)}),K(`span`,{class:`lc`},s.flatMap(t=>{let n=/^\{(\d+)\}$/.exec(t);if(!n)return qr(t);let s=Number(n[1]),c=o&&r[s]!==e.answer[s];return q(r[s]??``,()=>{a||(i=s,z(`select`),l())},`slot`+(r[s]?` filled`:``)+(s===i&&!a?` active`:``)+(o?c?` wrong`:` right`:``),{"aria-label":`空格 ${s+1}：${r[s]||`空`}`,"data-slot":String(s)})})))})),c.replaceChildren(K(`div`,{class:`bank-ctrl`},q(`⌫`,()=>{a||(r[i]=null,z(`undo`),l(),t())},`kchip ctrl`,{"aria-label":`清空当前空格`}),q(`‹`,()=>{a||(i=Math.max(0,i-1),z(`select`),l())},`kchip ctrl`,{"aria-label":`上一个空格`}),q(`›`,()=>{a||(i=Math.min(n-1,i+1),z(`select`),l())},`kchip ctrl`,{"aria-label":`下一个空格`})),K(`div`,{class:`bank-tokens`},e.tokens.map(e=>q(e,()=>{if(a)return;r[i]=e,z(`place`);let n=r.findIndex(e=>e===null);n!==-1&&(i=n),l(),t()},`kchip tok`,{"data-token":e}))))};l();let u=q(`↺ 重新开始`,()=>{a||(r=e.initial?[...e.initial]:Array(n).fill(null),i=0,z(`undo`),l(),t())},`link small reset`),d=()=>{let t=e.code;return r.forEach((e,n)=>t=t.replace(`{${n}}`,e??``)),t},f=()=>r.find((t,n)=>t!==e.answer[n]);return{node:K(`div`,{},s,c,u),ready:()=>r.every(e=>e!==null)&&!(e.initial&&r.every((t,n)=>t===e.initial[n])),lock:()=>{a=!0,l()},mark:()=>{o=!0,l()},isCorrect:()=>r.every((t,n)=>t===e.answer[n]),why:()=>``,whyWrong:()=>e.why?.[f()]||`这样运行出来的结果和要求不一样，看看下面的运行结果。`,code:d}}function Qi(e,t){let n=[],r=!1,i=K(`div`,{class:`order-mine`,"aria-label":`你的程序`}),a=K(`div`,{class:`order-bank`}),o=()=>{i.replaceChildren(...n.length?n.map((i,a)=>q(K(`span`,{},K(`span`,{class:`ln`,text:String(a+1)}),qr(e.lines[i])),()=>{r||(n.splice(a,1),z(`undo`),o(),t())},`line-chip in`,{"data-line":String(i)})):[K(`p`,{class:`muted order-empty`,text:`点下面的代码行，按顺序放到这里`})]),a.replaceChildren(...e.shuffled.filter(e=>!n.includes(e)).map(i=>q(K(`span`,{},qr(e.lines[i])),()=>{r||(n.push(i),z(`place`),o(),t())},`line-chip`,{"data-line":String(i)})))};o();let s=q(`↺ 重新开始`,()=>{r||(n=[],z(`undo`),o(),t())},`link small reset`),c=()=>n.map(t=>e.lines[t]).join(`
`),l=e.answers.map(t=>t.map(t=>e.lines[t]).join(`
`));return{node:K(`div`,{},K(`div`,{class:`order-label`,text:`你的程序`}),i,K(`div`,{class:`order-label`,text:`代码行`}),a,s),ready:()=>n.length===e.lines.length,lock:()=>{r=!0},mark:()=>{i.classList.add(l.includes(c())?`right`:`wrong`)},isCorrect:()=>l.includes(c()),why:()=>``,whyWrong:()=>`顺序不对。程序从上往下一行一行执行：变量要先存好值，才能拿来用；想先显示的，就放在前面。`,code:c}}function $i(e){let t=e.lesson,n=!X.done[t.id];X.done[t.id]=!0,X.lessonsCompleted++;let r=e.review?0:Mr;e.xp+=r,X.xp+=r;let i=We(X);n&&X.lastDay&&(X.doneOn={...X.doneOn??{},[t.id]:X.lastDay});let a=null;e.review&&(Be(X),X.hearts<5&&(X.hearts++,a=`复习奖励：恢复 1 颗红心（现在 ${X.hearts} 颗）`)),si(),di=null,z(`finish`);let o=Math.round(e.total/(e.total+e.mistakes)*100);Q.replaceChildren(K(`main`,{class:`finish`},Gr(120,`celebrate`),K(`h1`,{text:e.mistakes===0?`完美！`:`完成！`}),K(`p`,{class:`muted`,text:n?`「${t.title}」通关`:`复习「${t.title}」完成`}),K(`div`,{class:`finish-stats`},K(`div`,{class:`fs`},K(`small`,{text:`本关 XP`}),K(`b`,{},Y(`bolt`,{size:20}),`+${e.xp}`)),K(`div`,{class:`fs`},K(`small`,{text:`正确率`}),K(`b`,{text:`${o}%`})),K(`div`,{class:`fs`},K(`small`,{text:`连续天数`}),K(`b`,{},Y(`flame`,{size:20}),String(Ge(X))))),i?K(`p`,{class:`streak-msg`,text:Ge(X)>1?`连续学习 ${Ge(X)} 天，保持住！`:`今天的学习完成了，明天再来续上连续天数！`}):null,a?K(`p`,{class:`heart-msg`,text:a}):null,q(`继续`,()=>{Oe(),$()},`btn3d primary wide`,{"data-continue":``})))}var ea=null,ta=()=>a.units.filter(e=>e.available).map(e=>({id:e.id,title:e.title,lessons:kr[e.id].lessons}));function na(){let e=pr(ta(),X.done).length>0,t=q(K(`span`,{class:`practice-entry-text`},K(`b`,{text:`随机练习`}),K(`small`,{text:`无奖励，自由练习`})),()=>ra(),`btn3d practice-entry wide`,{"data-practice-entry":``});return t.disabled=!e,K(`div`,{class:`practice-entry-wrap`},t,e?null:K(`p`,{class:`muted small practice-empty`,"data-practice-empty":``,text:`完成第一关后可开始刷题`}))}function ra(e){ei=`practice`,ri=null,di=null,ea=null;let t=pr(ta(),X.done);if(!t.length){Q.replaceChildren(Hr(`full`),Oi(),K(`main`,{class:`view practice-setup`},Gr(96,`companion`),K(`h1`,{text:`还不能刷题哦`}),K(`p`,{"data-practice-empty":``,text:`随机练习只用你已经通关的关卡出题。完成第一关后可开始刷题，先去闯一关吧！`}),q(`回到地图`,$,`btn3d primary wide`)),ki(`path`));return}let n=new Set(e?.selected||t.flatMap(e=>e.lessons.map(e=>e.id))),r=e?.size||10,i=K(`p`,{class:`practice-info`,role:`status`,"data-practice-info":``}),a=q(`开始练习`,()=>{let e=mr(ta(),X.done,n);e.length&&ia(e,r,{selected:[...n],size:r})},`btn3d primary wide`,{"data-practice-start":``}),o=K(`div`,{class:`practice-units`}),s=K(`div`,{class:`practice-sizes`,role:`group`,"aria-label":`每轮题数`}),c=()=>{let e=mr(ta(),X.done,n).length,l=Math.min(r,e);a.disabled=e===0,i.textContent=e===0?`请至少选一个关卡。`:l<r?`已选范围只有 ${e} 道题，不够 ${r} 道，本轮用全部 ${l} 道。`:`本轮 ${l} 道题（已选范围共 ${e} 道）。`,o.replaceChildren(...t.map(e=>{let t=e.lessons.map(e=>e.id),r=t.every(e=>n.has(e)),i=t.some(e=>n.has(e));return K(`div`,{class:`practice-unit`},q(K(`span`,{},K(`b`,{text:e.title}),K(`small`,{text:`已通关 ${t.length} 关`})),()=>{r?t.forEach(e=>n.delete(e)):t.forEach(e=>n.add(e)),z(`select`),c()},`pchip unit-chip`+(r?` sel`:i?` part`:``),{"aria-pressed":String(r),"data-practice-unit":e.id}),K(`div`,{class:`practice-lessons`},e.lessons.map(e=>q(e.title,()=>{n.has(e.id)?n.delete(e.id):n.add(e.id),z(`select`),c()},`pchip`+(n.has(e.id)?` sel`:``),{"aria-pressed":String(n.has(e.id)),"data-practice-lesson":e.id}))))})),s.replaceChildren(...dr.map(e=>q(`${e} 题`,()=>{r=e,z(`select`),c()},`pchip size`+(e===r?` sel`:``),{"aria-pressed":String(e===r),"data-practice-size":String(e)})))},l=q(`全部已学`,()=>{t.forEach(e=>e.lessons.forEach(e=>n.add(e.id))),c()},`link small`,{"data-practice-all":``}),u=q(`取消全部`,()=>{n.clear(),c()},`link small`,{"data-practice-none":``});c(),Q.replaceChildren(Hr(`full`),Oi(),K(`main`,{class:`view practice-setup`},K(`h1`,{text:`随机练习`}),K(`p`,{class:`muted`,text:`无奖励，自由练习：只从已通关的关卡出题，不加 XP、不扣红心、不计连续天数，也不影响解锁。`}),K(`div`,{class:`practice-head`},K(`h3`,{text:`范围`}),K(`span`,{class:`practice-links`},l,u)),o,K(`h3`,{text:`每轮题数`}),s,i,a,q(`回到地图`,$,`btn3d ghost wide`)),ki(`path`))}function ia(e,t,n){let r=gr(e,t);ea={setup:n,requested:r.requested,total:r.actual,items:r.items.map(e=>({...e,ex:_r(e.ex)})),queue:r.items.map((e,t)=>({i:t,retry:!1})),results:r.items.map(()=>({first:null,retry:null})),answered:0},sa(ea)}function aa(e){let t=Math.round(e.answered/Math.max(1,e.total+e.results.filter(e=>e.first===!1).length)*100);return K(`header`,{class:`lessonbar`},q(Y(`close`,{size:24}),()=>oa(e),`icon-btn ghost`,{"aria-label":`退出练习`}),K(`div`,{class:`progress`,role:`progressbar`,"aria-valuenow":String(t),"aria-valuemin":`0`,"aria-valuemax":`100`},K(`div`,{class:`progress-fill`,style:`width:${Math.max(4,t)}%`})),K(`span`,{class:`stat practice-tag`,title:`随机练习无奖励`},`练习`))}function oa(e){Si(t=>[K(`div`,{class:`lsheet`},K(`h2`,{text:`要退出练习吗？`}),K(`p`,{text:`本轮练习位置不保存。随机练习不影响 XP、红心、连续天数和解锁。`}),q(`继续练习`,t,`btn3d primary wide`),q(`退出`,()=>{t(),ea===e&&(ea=null),$()},`btn3d danger-ghost wide`,{"data-practice-quit":``}))])}function sa(e){if(ea!==e)return;if(e.queue.length===0)return la(e);let{i:t,retry:n}=e.queue[0],r=e.items[t],i=r.ex;window.__app.currentEx=i,window.__app.currentPracticeItem={id:r.id,retry:n};let a=!1,o=i.type===`pick`?null:K(`details`,{class:`outpanel`},K(`summary`,{text:`运行结果`}),K(`pre`,{class:`out`,text:``})),s=q(`检查`,()=>u(),`btn3d primary grow`,{"data-check":``});s.disabled=!0;let c=()=>{a||(s.disabled=!l.ready())},l=i.type===`predict`?Ji(i,c):i.type===`pick`?Yi(i,c):i.type===`fill`?Zi(i,c):Qi(i,c);Q.replaceChildren(Hr(`edge`),aa(e),K(`main`,{class:`lesson`},K(`p`,{class:`tip-line practice-src`},K(`b`,{text:n?`重练 `:`随机练习 `}),ca(r.lessonId)),i.tip?K(`p`,{class:`tip-line`},K(`b`,{text:`提示 `}),i.tip):null,K(`h2`,{class:`q`,text:i.prompt}),i.trace?Xi(i.trace):null,l.node,o),K(`footer`,{class:`lessonfoot`},K(`span`,{class:`mascot-slot`},Gr(56,`think`)),s));function u(){if(a||s.disabled)return;a=!0,s.disabled=!0,s.textContent=`检查中`,l.lock(),Oe();let r=l.isCorrect(),c=pe();n?e.results[t].retry=r:e.results[t].first=r,e.answered++,e.queue.shift(),!r&&!n&&e.queue.push({i:t,retry:!0});let u=r?l.why():l.whyWrong();o&&yi(o,i.type===`predict`?i.code:l.code());let d=!1,f=q(`继续`,()=>{d||(d=!0,sa(e))},`btn3d `+(r?`primary`:`danger`)+` wide`,{"data-continue":``});f.disabled=!0;let p=K(`div`,{class:`feedbar `+(r?`ok`:`bad`),role:`status`},K(`div`,{class:`fb-head`},Y(r?`check`:`cross`,{size:26,cls:`fb-ico`}),K(`b`,{text:r?`答对了！`:`不对哦`})),u?K(`p`,{text:u}):null,!r&&n?K(`p`,{class:`fb-answer`},`解答：`,K(`code`,{text:qi(i)})):null,!r&&!n?K(`p`,{class:`fb-retry`,text:`这道题会在本轮最后再练一次。`}):null,f);setTimeout(()=>{s.isConnected&&(l.mark(),z(r?`correct`:`wrong`),Q.querySelector(`.lessonfoot`).replaceWith(p),setTimeout(()=>{p.isConnected&&(f.disabled=!1)},c?0:160))},Nr)}}function ca(e){let t=ci().find(t=>t.id===e);return t?t.title:e}function la(e){let t=e.results.filter(e=>e.first===!0).length,n=e.items.map((t,n)=>({it:t,r:e.results[n]})).filter(e=>e.r.first===!1),r=n.filter(e=>e.r.retry===!0).length;z(`finish`);let i=e.setup;ea=null,Q.replaceChildren(K(`main`,{class:`finish practice-finish`},Gr(110,n.length?`companion`:`celebrate`),K(`h1`,{text:`练习完成`}),e.total<e.requested?K(`p`,{class:`muted`,text:`题目不够 ${e.requested} 道，本轮用了全部 ${e.total} 道。`}):null,K(`div`,{class:`finish-stats`},K(`div`,{class:`fs`},K(`small`,{text:`首次答对`}),K(`b`,{"data-practice-first":``,text:`${t}/${e.total}`})),K(`div`,{class:`fs`},K(`small`,{text:`重练答对`}),K(`b`,{"data-practice-retry":``,text:`${r}/${n.length}`}))),n.length?K(`div`,{class:`practice-wrong`},K(`h3`,{text:`错题`}),K(`ul`,{},n.map(e=>K(`li`,{},K(`span`,{text:`${ca(e.it.lessonId)}：${e.it.ex.prompt}`}),K(`small`,{text:e.r.retry?`重练答对`:`重练仍错，已看解答`}))))):null,K(`p`,{class:`muted small`,text:`随机练习不加 XP、不扣红心、不计连续天数。`}),q(`再来一轮`,()=>ra(i),`btn3d primary wide`,{"data-practice-again":``}),q(`回到地图`,()=>{Oe(),$()},`btn3d ghost wide`,{"data-continue":``})))}var ua=window.visualViewport;if(ua){let e=()=>document.documentElement.style.setProperty(`--app-h`,ua.height+`px`);ua.addEventListener(`resize`,e),e()}document.addEventListener(`visibilitychange`,()=>{document.visibilityState===`visible`&&Q.querySelector(`.statsbar`)&&(Be(X),si(),Q.querySelector(`.statsbar`).replaceWith(Oi()))}),window.__app={allLessons:ci,startLesson:Bi,sync:Z,accountUi:$r,sheet:Si,LIMITS:e,pythonUnavailableText:vi,swInfo:fi,refreshSwInfo:fa,keysounds:()=>Cr(()=>Promise.resolve().then(()=>ne),void 0,import.meta.url),runner:hi,getState:()=>X,setState:e=>{X=e,he(e.prefs)},persist:si,renderPath:$,words:p,feel:ue,getRun:()=>di,getPractice:()=>ea};var da=null;async function fa(){if(!(`serviceWorker`in navigator))return fi.status=`此浏览器不支持`,fi;try{fi.caches=typeof caches<`u`?(await caches.keys()).filter(e=>e.startsWith(`suipian-`)):[],fi.status=navigator.serviceWorker.controller?`已启用（断网后可打开地图和课程）`:da?`正在安装，刷新一次后生效`:`未启用`}catch{fi.status=`读取失败`}return fi}if(`serviceWorker`in navigator){let e=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener(`controllerchange`,()=>{e&&wi(`已更新到新版本，刷新页面后使用最新内容。`),fa()});let t=()=>navigator.serviceWorker.register(`./sw.js`).then(e=>{da=e,fa()}).catch(e=>{fi.status=`注册失败：`+(e?.message||e)});document.readyState===`complete`?t():window.addEventListener(`load`,t),document.addEventListener(`visibilitychange`,()=>{document.visibilityState===`visible`&&da?.update().catch(()=>{})})}window.addEventListener(`online`,()=>{hi.state===`loadError`&&hi.boot(),da?.update().catch(()=>{})}),X.onboarded?$():Ei();try{hi.boot()}catch{}export{Je as a,b as c,Ye as i,vn as n,m as o,$e as r,te as s,_n as t};