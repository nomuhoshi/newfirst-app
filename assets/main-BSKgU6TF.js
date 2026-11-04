import{a as e,c as t,i as n,l as r,n as i,o as a,s as o,t as s,u as c}from"./errors-CoQSdPdD.js";var l=Object.defineProperty,u=(e,t)=>{let n={};for(var r in e)l(n,r,{get:e[r],enumerable:!0});return t||l(n,Symbol.toStringTag,{value:`Module`}),n};{let e=window.localStorage,t=`rc1:`,n=()=>{let n=[];for(let r=0;r<e.length;r++){let i=e.key(r);i&&i.startsWith(t)&&n.push(i.slice(4))}return n},r={getItem:n=>e.getItem(t+n),setItem:(n,r)=>e.setItem(t+n,r),removeItem:n=>e.removeItem(t+n),clear:()=>n().forEach(n=>e.removeItem(t+n)),key:e=>n()[e]??null,get length(){return n().length}},i=!1;try{Object.defineProperty(window,"localStorage",{value:r,configurable:!0}),i=window.localStorage===r}catch{}if(!i){let e=`这个浏览器不允许测试入口隔离存储。为了不碰到正式版的学习记录和登录，测试入口已停止运行，请改用正式站。`;try{document.documentElement.innerHTML=`<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font:16px/1.6 sans-serif;padding:24px;background:#10213a;color:#f3ead7"></body>`,document.body.textContent=e}catch{}throw Error(e)}}var d={title:`Python 入门`,units:[{id:`U1`,title:`奶茶店点单屏`,subtitle:`输出、变量和简单运算`,file:`unit1.json`,available:!0},{id:`U2`,title:`文字与长度`,subtitle:`字符串、len`,file:`unit2.json`,available:!0},{id:`U3`,title:`比较与判断`,subtitle:`比较、if/else/elif、and/or/not`,available:!0,file:`unit3.json`},{id:`U4`,title:`循环`,subtitle:`for、range、while、break`,available:!0,file:`unit4.json`},{id:`U5`,title:`列表与序列`,subtitle:`列表、下标、append、切片`,available:!0,file:`unit5.json`},{id:`U6`,title:`字典与集合`,subtitle:`dict、set`,available:!1}]},f={id:`U1`,title:`奶茶店点单屏`,subtitle:`输出、变量和简单运算`,lessons:[{id:`U1L1`,title:`让屏幕说话`,concept:`print 输出`,story:`街角的奶茶店想要一块点单屏。第一步：让屏幕显示文字。`,introCode:`print("欢迎光临！")`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print("欢迎光临！")`,options:[{text:`欢迎光临！`,correct:!0,why:`print(...) 会把括号里的内容显示到屏幕上。`},{text:`"欢迎光临！"`,correct:!1,why:`引号只是告诉 Python「这是一段文字」，引号本身不会显示。`},{text:`print("欢迎光临！")`,correct:!1,why:`print、括号和引号是写给 Python 看的，屏幕上只显示引号里的文字。`}],tip:`print(...) 会把括号里的内容显示到屏幕上。文字要放在英文引号 " " 里。`},{type:`fill`,prompt:`屏幕要显示：今日推荐：珍珠奶茶`,code:`print({0})`,tokens:[`"今日推荐：珍珠奶茶"`,`今日推荐：珍珠奶茶`],answer:[`"今日推荐：珍珠奶茶"`],expected:`今日推荐：珍珠奶茶`,why:{"今日推荐：珍珠奶茶":`文字没加引号，Python 会把它当成代码去执行，程序会出错。`},hint:`文字要放在英文引号里。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print("营业时间")
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
print(cups)`,tokens:[`+`,`-`,`*`],answer:[`+`],expected:`3`,why:{"-":`2 - 1 = 1，杯数变少了。`,"*":`2 * 1 = 2，没有变化。`},hint:`加一杯，用加号。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print(45 / 2)`,options:[{text:`22.5`,correct:!0,why:`45 ÷ 2 = 22.5。`},{text:`22`,correct:!1,why:`/ 不会去掉小数部分。`},{text:`22.0`,correct:!1,why:`45 ÷ 2 是 22.5，不是整数。`}]}]}]},p={id:`U2`,title:`文字与长度`,subtitle:`字符串、len`,lessons:[{id:`U2L1`,title:`保存饮品名`,concept:`字符串`,story:`菜单上要显示饮品的名字。一段文字在 Python 里叫「字符串」，可以存进变量，和数字一样。`,introCode:`drink = "珍珠奶茶"
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
7`,correct:!1,why:`拼接时中间写了一个 " "，所以显示的文字里有空格。`}]}]}]},m={id:`U3`,title:`比较与判断`,subtitle:`比较、if/else/elif、and/or/not`,lessons:[{id:`U3L1`,title:`满不满 100 元`,concept:`比较大小`,story:`店里搞活动：满 100 元有优惠。程序要先判断“够不够”。比较两个数，结果只有两种：True（成立）或 False（不成立）。> 读作“大于”，< 读作“小于”。`,introCode:`total = 120
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
`}}}]}]},h={id:`U4`,title:`重复`,subtitle:`for、range、while、break`,lessons:[{id:`U4L1`,title:`一次做好几杯`,concept:`for 重复同一件事`,story:`要重复做同一件事，不用把 print 抄好几遍。for i in range(3): 表示“重复 3 次”，下面缩进 4 格的行就是每次都做的事（叫循环体）。没缩进的行不重复，循环做完后才执行一次。`,introCode:`for i in range(3):
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
`}}}]}]},g={id:`U5`,title:`列表与序列`,subtitle:`列表、下标、遍历、in`,lessons:[{id:`U5L1`,title:`一张点单表`,concept:`列表 [ ] 和 len`,story:`好几单的杯数，不用一单一个变量：用方括号把它们放在一起，逗号隔开，就是一个列表，比如 cups = [2, 5, 1]。len(cups) 数的是列表里有几个元素（几单），不是数字符。同一个列表里可以放不同类型的值，比如 ["奶茶", 2, True]。`,introCode:`cups = [2, 5, 1]
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
print('共', len(items), '项')`,why:`没检查就 remove，删不存在的项会报 ValueError`}]}}]}]},_={print:{word:`print`,full:`print`,ipa:`/prɪnt/`,meaning:`打印；印出`,python:`把括号里的内容显示到屏幕上，也就是「输出」。`,example:`print("你好")`,note:`不是缩写，就是普通英文单词 print。`,source:`https://dictionary.cambridge.org/dictionary/english/print`},string:{word:`string`,full:`string`,ipa:`/strɪŋ/`,meaning:`字符串；一串文字字符`,python:`Python 里的一段文字，要放在英文引号里，例如 "珍珠奶茶"。`,example:`drink = "珍珠奶茶"`,note:`不是缩写，就是普通英文单词 string（本意是「线、一串」）。`,source:`https://dictionary.cambridge.org/dictionary/english/string`},len:{word:`len`,full:`length`,ipa:`/leŋθ/`,meaning:`长度`,python:`len(...) 返回括号里文字的字符个数。`,example:`len("珍珠奶茶")`,note:`len 是完整单词 length 的缩写。`,source:`https://dictionary.cambridge.org/dictionary/english/length`}},v={caseMs:5e3,totalMs:1e4,readyCapMs:3e4},y={PASS:`pass`,WRONG:`wrong-output`,WRONG_FILE:`wrong-file`,WRONG_RETURN:`wrong-return`,ERROR:`error`,CASE_TIMEOUT:`case-timeout`,TOTAL_TIMEOUT:`total-timeout`,OUTPUT_LIMIT:`output-limit`,UNAVAILABLE:`unavailable`,INTERNAL:`internal`,CANCELLED:`cancelled`},b=e=>`${Math.round(e/100)/10} 秒`;function x(e,t=v){return{[y.PASS]:`通过`,[y.WRONG]:`输出和期望不一致`,[y.WRONG_FILE]:`输出文件的内容和期望不一致，或者文件没有生成`,[y.WRONG_RETURN]:`函数的返回值和期望不一致`,[y.ERROR]:`程序运行出错`,[y.CASE_TIMEOUT]:`这一组测试运行超过 ${b(t.caseMs)}，已停止（可能有死循环）。这次不算作答，不扣红心，代码已保留，改好后再检查`,[y.TOTAL_TIMEOUT]:`全部测试合计超过 ${b(t.totalMs)}，已停止（程序可能太慢或有死循环）。这次不算作答，不扣红心，代码已保留，改好后再检查`,[y.OUTPUT_LIMIT]:`输出超过安全上限，已停止，请检查循环或打印次数。这次不算作答，不扣红心，代码已保留`,[y.UNAVAILABLE]:`Python 环境暂时不可用，这次不算作答，代码已保留，请重试`,[y.INTERNAL]:`判题出了内部问题，这次不算作答，代码已保留，请重试`,[y.CANCELLED]:`已取消，这次不算作答`}[e]}var S=e=>String(e??``).replace(/\r\n?/g,`
`),ee=e=>e.endsWith(`
`)?e.slice(0,-1):e;function C(e,t=`strict`){let n=S(e);return t===`lenient`?n.split(`
`).map(e=>e.replace(/[ \t]+$/,``)).join(`
`).replace(/\n+$/,``):ee(n)}var w=()=>globalThis.performance?performance.now():Date.now();function T({code:e,files:t,entry:n}){if(Array.isArray(t)){let e={};for(let n of t){if(!n||typeof n.path!=`string`||typeof n.content!=`string`||!n.path)return null;e[n.path]=n.content}let r=n||`main.py`;return r in e?{files:e,entry:r,code:e[r]}:null}return typeof e==`string`?{files:{"main.py":e},entry:`main.py`,code:e}:null}var E=e=>e&&typeof e==`object`&&!Array.isArray(e),te=e=>E(e)&&Object.values(e).every(e=>typeof e==`string`);function ne(e,t){return Array.isArray(e)&&e.length>0&&e.every(e=>E(e)&&(e.stdin===void 0||typeof e.stdin==`string`||Array.isArray(e.stdin)&&e.stdin.every(e=>typeof e==`string`))&&(e.files===void 0||te(e.files))&&(e.expectedFiles===void 0||te(e.expectedFiles))&&(t===`call`?E(e.call)&&typeof e.call.fn==`string`&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(e.call.fn)&&`expectedReturn`in e:typeof e.expected==`string`))}var D=`__judge_result__.json`;function O(e){let t=JSON.stringify({fn:e.call.fn,args:e.call.args??[],kwargs:e.call.kwargs??{},expected:e.expectedReturn,tol:e.tol??1e-9});return`

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
    with open(${JSON.stringify(D)}, "w", encoding="utf-8") as fh:
        fh.write(_j.dumps(res, ensure_ascii=False))
_jg_run()
`}async function re({code:e,files:t,entry:n,tests:r,checkMode:i=`output`,compare:a=`strict`,limits:o={}},s,{signal:c}={}){let l={...v,...o},u=0,d=(e,t,n,r)=>({status:e,attempt:!1,settle:!1,retry:e!==`cancelled`,totalMs:Math.round(u),cases:[...r,{...n,ok:!1,kind:t,ms:0,message:x(t,l)}]}),f={name:``,hidden:!1},p=T({code:e,files:t,entry:n});if(i!==`output`&&i!==`call`||a!==`strict`&&a!==`lenient`||!p||!ne(r,i))return d(`internal-error`,y.INTERNAL,f,[]);let m=[],h=(e,t)=>({status:t.kind===y.OUTPUT_LIMIT?`output-limit`:`timeout`,attempt:!1,settle:!1,retry:!0,totalMs:Math.round(u),cases:[...e,t]});for(let e of r){let t={name:e.name,hidden:!!e.hidden};if(c?.aborted)return d(`cancelled`,y.CANCELLED,t,[]);let n=l.totalMs-u;if(n<=0)return h(m,{...t,ok:!1,kind:y.TOTAL_TIMEOUT,ms:0,message:x(y.TOTAL_TIMEOUT,l)});let r=n<l.caseMs,o=Math.max(1,Math.min(l.caseMs,n)),f,g=w(),_={...e.files||{},...p.files};i===`call`&&(_[p.entry]=p.files[p.entry]+O(e));let v=[...Object.keys(e.expectedFiles||{}),...i===`call`?[D]:[]];try{f=await s.exec({code:_[p.entry],files:_,entry:p.entry,data:e.data??null,stdin:e.stdin??null,readFiles:v,timeoutMs:o,signal:c,readyCapMs:l.readyCapMs})}catch(e){return e&&e.cancelled?d(`cancelled`,y.CANCELLED,t,[]):e&&e.unavailable?d(`unavailable`,y.UNAVAILABLE,t,[]):d(`internal-error`,y.INTERNAL,t,[])}let b=typeof f.ms==`number`?f.ms:w()-g;u+=f.timedOut?Math.max(b,o):b;let S,ee=``,T=[];if(f.timedOut)S=r?y.TOTAL_TIMEOUT:y.CASE_TIMEOUT;else if(f.limitHit)S=y.OUTPUT_LIMIT;else if(f.error&&f.error.kind===`InternalError`)return d(`internal-error`,y.INTERNAL,t,[]);else if(f.error)S=y.ERROR;else if(i===`call`){let t=null;try{t=JSON.parse(f.files?.[`__judge_result__.json`]??`null`)}catch{t=null}t?t.missing?(S=y.ERROR,f={...f,error:{kind:`NameError`,line:null,msg:`没有找到函数 ${e.call.fn}，请检查函数名`}}):(S=t.ok?y.PASS:y.WRONG_RETURN,ee=t.actual):(S=y.ERROR,f={...f,error:{kind:`NoResult`,line:null,msg:`程序没有走到函数调用就结束了（是不是提前 exit 了？）`}})}else{let t=C(f.stdout,a)===C(e.expected,a),n=Object.entries(e.expectedFiles||{}).filter(([e,t])=>typeof f.files?.[e]!=`string`||C(f.files[e],a)!==C(t,a)).map(([e])=>e);S=t?n.length?y.WRONG_FILE:y.PASS:y.WRONG,T=n}let E={...t,ok:S===y.PASS,kind:S,ms:Math.round(b),message:x(S,l)};if(S===y.ERROR&&(E.error=f.error,i===`call`&&E.error&&E.error.line>p.files[p.entry].split(`
`).length&&(E.error={...E.error,line:null})),!E.hidden&&S!==y.PASS&&S!==y.ERROR&&(i===`call`?(E.expected=JSON.stringify(e.expectedReturn),E.actualReturn=ee):(E.expected=e.expected,E.stdout=f.stdout??``,S===y.WRONG_FILE&&(E.files=T.map(t=>({path:t,expected:e.expectedFiles[t],actual:typeof f.files?.[t]==`string`?f.files[t]:null}))))),S===y.CASE_TIMEOUT||S===y.TOTAL_TIMEOUT||S===y.OUTPUT_LIMIT)return h(m,E);m.push(E)}return{status:m.every(e=>e.ok)?`pass`:`fail`,attempt:!0,settle:m.length===r.length,retry:!1,cases:m,totalMs:Math.round(u)}}function ie(e){async function t(t){(e.state===`idle`||e.state===`loadError`)&&e.boot();let n=await e.whenReady(t);if(n!==`ready`)throw{unavailable:!0,reason:n}}let n=Promise.resolve();async function r({code:n,files:r,entry:i,data:a,stdin:o,readFiles:s,timeoutMs:c,signal:l,readyCapMs:u=v.readyCapMs}){if(l?.aborted||(await t(u),l?.aborted))throw{cancelled:!0};let d={files:r||{"main.py":n},entry:i||`main.py`,stdin:o??null,read:s||[]};return new Promise((t,r)=>{let i=``,o=!1,s=0,u=null,f=e.onStatus,p=e.onOutput,m=()=>{h(()=>r({cancelled:!0})),e.stop()};function h(t){o||(o=!0,clearTimeout(u),e.onStatus=f,e.onOutput=p,l?.removeEventListener?.(`abort`,m),t())}let g=()=>s?w()-s:0;e.onOutput=e=>{i+=e},e.onStatus=(e,n)=>{e!==`running`&&(e===`done`?h(()=>t({stdout:i,error:n?.error??null,timedOut:!1,limitHit:!1,ms:g(),files:n?.files??null})):e===`stopped`||e===`timeout`?h(()=>t({stdout:i,error:null,timedOut:!0,limitHit:!1,ms:g()})):e===`outputLimit`||e===`outputLimitStopped`?h(()=>t({stdout:i,error:null,timedOut:!1,limitHit:!0,ms:g()})):e===`loadError`?h(()=>r({unavailable:!0})):f?.(e,n))},l?.addEventListener?.(`abort`,m);try{if(s=w(),!e.run(n,a,d))return h(()=>r({unavailable:!0,reason:`not-ready`}));u=setTimeout(()=>{o||e.stop()},c)}catch(e){h(()=>r(e instanceof Error?e:Error(String(e))))}})}return{exec(e){let t=n.then(()=>r(e));return n=t.catch(()=>{}),t}}}var ae={url:`https://aqlcunkmggzzvyavlkjg.supabase.co`,anonKey:`sb_publishable_Ic9p2Y68XVralcZcAO8b6w_SjeEOIUJ`},oe=`aqlcunkmggzzvyavlkjg`;function se(e){try{let t=new URL(String(e));return/^https?:$/.test(t.protocol)?t.hostname.toLowerCase():``}catch{return``}}var ce=se(ae.url);function le(e){let t=se(e);return!t||t===ce||t.split(`.`)[0]===oe||t.includes(oe)}function ue(){try{let e={url:``,anonKey:``};return!e||typeof e.url!=`string`||typeof e.anonKey!=`string`||!e.url.trim()||!e.anonKey.trim()||le(e.url.trim())?{url:``,anonKey:``}:{url:e.url.trim(),anonKey:e.anonKey.trim()}}catch{return{url:``,anonKey:``}}}function de(){try{if(typeof location<`u`&&/^(localhost|127\.0\.0\.1)$/.test(location.hostname)){let e=JSON.parse(localStorage.getItem(`suipian.cloudConfig`));if(e&&typeof e.url==`string`&&typeof e.anonKey==`string`)return{url:e.url,anonKey:e.anonKey}}}catch{}return ue()}var fe=de(),pe=`suipian.progress`,k=18e5;function A(){return{version:3,onboarded:!1,xp:0,hearts:5,heartsAt:Date.now(),streak:0,lastDay:null,done:{},lessonsCompleted:0,installTipClosed:!1,lastActive:0,prefs:{sound:!0,haptics:!0,soundStyle:`J`}}}function me(e){let t=A();return t.installTipClosed=!!e.installTipClosed,{state:t,notice:`课程改版为关卡模式，旧版的学习记录不再使用，请从第一关开始。`}}var j=`suipian.progress.unreadable.`,M=3;function he(e){try{localStorage.setItem(j+Date.now(),e);let t=[];for(let e=0;e<localStorage.length;e++){let n=localStorage.key(e);n&&n.startsWith(j)&&t.push(n)}for(t.sort();t.length>M;)localStorage.removeItem(t.shift())}catch{}}function ge(){let e=[];try{for(let t=0;t<localStorage.length;t++){let n=localStorage.key(t);n&&n.startsWith(j)&&e.push({key:n,savedAt:Number(n.slice(28)),raw:localStorage.getItem(n)})}}catch{}return e.sort((e,t)=>t.savedAt-e.savedAt)}function _e(){let e;try{e=localStorage.getItem(pe)}catch{return{state:A(),notice:`这个浏览器不允许保存进度（可能是无痕模式），关掉页面后进度会丢失。`}}if(!e)return{state:A(),notice:null};let t;try{t=JSON.parse(e)}catch{return he(e),{state:A(),notice:`本机记录损坏，已从头开始。`}}if(t&&(t.version===1||t.version===2))return he(e),me(t);if(!t||t.version!==3)return he(e),{state:A(),notice:`学习记录的格式无法识别，已从头开始。`};let n=A(),r={...n.prefs,...t.prefs&&typeof t.prefs==`object`?t.prefs:{}};return/^[A-J]$/.test(r.soundStyle)||(r.soundStyle=`J`),delete r.keySound,{state:{...n,...t,prefs:r},notice:null}}function ve(e){try{return e.lastActive=Date.now(),localStorage.setItem(pe,JSON.stringify(e)),!0}catch{return!1}}function ye(){try{localStorage.removeItem(pe)}catch{}return A()}function N(e,t=Date.now()){if(e.hearts>=5)return e.heartsAt=t,0;let n=Math.floor((t-e.heartsAt)/k);return n>0&&(e.hearts=Math.min(5,e.hearts+n),e.heartsAt+=n*k,e.hearts>=5&&(e.heartsAt=t)),e.hearts>=5?0:k-(t-e.heartsAt)}function be(e,t=Date.now()){N(e,t),e.hearts>=5&&(e.heartsAt=t),e.hearts=Math.max(0,e.hearts-1)}function xe(e=new Date){let t=e=>String(e).padStart(2,`0`);return`${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())}`}function Se(e,t){let[n,r,i]=e.split(`-`).map(Number),[a,o,s]=t.split(`-`).map(Number);return Math.round((Date.UTC(a,o-1,s)-Date.UTC(n,r-1,i))/864e5)}function Ce(e,t=new Date){let n=xe(t);return e.lastDay!==n&&(e.streak=e.lastDay&&Se(e.lastDay,n)===1?e.streak+1:1,e.lastDay=n,!0)}function P(e,t=new Date){return e.lastDay&&Se(e.lastDay,xe(t))<=1?e.streak:0}var we=/^[A-Za-z0-9_-]{1,64}$/,Te=/^\d{4}-\d{2}-\d{2}$/,Ee=/^[0-9a-f]{8}$/,De=5e3;function Oe(){let e=globalThis.crypto;if(e?.randomUUID)return e.randomUUID().replace(/-/g,``).slice(0,24);let t=``;for(let e=0;e<24;e++)t+=Math.floor(Math.random()*16).toString(16);return t}var F=e=>typeof e==`string`&&we.test(e)&&e!==`__proto__`,I=e=>Number.isFinite(e)&&e>=0?Math.floor(e):0,ke=e=>JSON.parse(JSON.stringify(e)),Ae=e=>{let[t,n,r]=e.split(`-`).map(Number);return Date.UTC(t,n-1,r)},je=e=>{let t=new Date(e),n=e=>String(e).padStart(2,`0`);return`${t.getUTCFullYear()}-${n(t.getUTCMonth()+1)}-${n(t.getUTCDate())}`},Me=(e,t)=>Math.round((Ae(t)-Ae(e))/864e5),Ne=(e,t)=>je(Ae(e)+t*864e5),Pe=e=>typeof e==`string`&&Te.test(e)&&je(Ae(e))===e;function Fe(e){if(!e.length)return 0;let t=1;for(let n=e.length-1;n>0&&Me(e[n-1],e[n])===1;n--)t++;return t}function Ie({gen:e=1,lineage:t=Oe()}={}){return{schema:1,gen:e,lineage:t,xp:{},runs:{},done:{},days:[],hearts:{n:5,msToNext:0},prefs:{sound:!0,haptics:!0,soundStyle:`J`},imported:{}}}function Le(e){if(!e||typeof e!=`object`||Array.isArray(e))return{ok:!1,code:`invalid`,message:`账号记录不是有效的对象`};if(!Number.isInteger(e.schema)||e.schema<1)return{ok:!1,code:`invalid`,message:`账号记录缺少数据版本`};if(e.schema>1)return{ok:!1,code:`schema-newer`,message:`账号记录来自更新的版本，请先更新应用`};if(!Number.isInteger(e.gen)||e.gen<1)return{ok:!1,code:`invalid`,message:`账号记录的代数无效`};if(!F(e.lineage))return{ok:!1,code:`invalid`,message:`账号记录缺少编号`};let t=Ie({gen:e.gen,lineage:e.lineage}),n=(e,t)=>{if(e&&typeof e==`object`)for(let[n,r]of Object.entries(e))F(n)&&(t[n]=I(r))};if(n(e.xp,t.xp),n(e.runs,t.runs),e.done&&typeof e.done==`object`)for(let[n,r]of Object.entries(e.done))F(n)&&(t.done[n]=Pe(r)?r:``);if(Array.isArray(e.days)&&(t.days=[...new Set(e.days.filter(Pe))].sort()),e.hearts&&typeof e.hearts==`object`){let n=Math.min(5,I(e.hearts.n));t.hearts={n,msToNext:n>=5?0:Math.min(k,I(e.hearts.msToNext))}}if(e.prefs&&typeof e.prefs==`object`&&(t.prefs={sound:e.prefs.sound!==!1,haptics:e.prefs.haptics!==!1,soundStyle:/^[A-J]$/.test(e.prefs.soundStyle)?e.prefs.soundStyle:`J`}),e.imported&&typeof e.imported==`object`)for(let[n,r]of Object.entries(e.imported))F(n)&&r&&(t.imported[n]=typeof r==`string`&&Ee.test(r)?r:!0);return{ok:!0,doc:t}}var Re=e=>Object.values(e.xp).reduce((e,t)=>e+t,0),ze=e=>Object.values(e.runs).reduce((e,t)=>e+t,0);function Be(e){let t=e=>Object.fromEntries(Object.keys(e).sort().map(t=>[t,e[t]]));return JSON.stringify({...e,xp:t(e.xp),runs:t(e.runs),done:t(e.done),imported:t(e.imported),prefs:t(e.prefs),hearts:t(e.hearts)})}function Ve(e,t){let n=Le(e),r=Le(t);return n.ok&&r.ok&&Be(n.doc)===Be(r.doc)}function He(e,t,n={}){let r=Le(e),i=Le(t);if(!r.ok)return{error:{code:r.code,message:`本机记录：`+r.message}};if(!i.ok)return{error:{code:i.code,message:`云端记录：`+i.message}};let a=r.doc,o=i.doc;if(a.gen!==o.gen)return a.gen>o.gen?{doc:a,outcome:`local-newer`}:{doc:o,outcome:`remote-newer`};if(a.lineage!==o.lineage)return{doc:a,outcome:`conflict`,remote:o};let s=Ie({gen:a.gen,lineage:a.lineage});for(let e of[`xp`,`runs`])for(let t of new Set([...Object.keys(a[e]),...Object.keys(o[e])]))s[e][t]=Math.max(a[e][t]??0,o[e][t]??0);for(let e of new Set([...Object.keys(a.done),...Object.keys(o.done)])){let t=a.done[e],n=o.done[e];s.done[e]=t?n?t<n?t:n:t:n??``}return s.days=[...new Set([...a.days,...o.days])].sort(),s.hearts=ke(n.localHeartsDirty?a.hearts:o.hearts),s.prefs=ke(n.localPrefsDirty?a.prefs:o.prefs),s.imported={...a.imported,...o.imported},{doc:s,outcome:`merged`}}function Ue(e){if(!e||typeof e!=`object`)return null;let t=Object.keys(e.done??{}).filter(t=>e.done[t]).sort(),n=JSON.stringify([I(e.xp),I(e.lessonsCompleted),t,e.lastDay??null,I(e.streak)]),r=2166136261;for(let e=0;e<n.length;e++)r^=n.charCodeAt(e),r=Math.imul(r,16777619)>>>0;return r.toString(16).padStart(8,`0`)}function We(e){if(!Pe(e?.lastDay)||!Number.isInteger(e.streak)||e.streak<1)return[];let t=Math.min(e.streak,De),n=[];for(let r=t-1;r>=0;r--)n.push(Ne(e.lastDay,-r));return n}function Ge(e,{deviceId:t,guestId:n,gen:r=1,lineage:i=Oe(),now:a=Date.now()}={}){if(!F(t)||!F(n))return{ok:!1,code:`bad-ids`,message:`缺少设备编号或游客编号`};if(!e||typeof e!=`object`||e.version!==3)return{ok:!1,code:`guest-invalid`,message:`游客记录不是第 3 版格式`};if(!Number.isFinite(e.xp)||e.xp<0)return{ok:!1,code:`guest-invalid`,message:`游客记录的 XP 无效`};let o=Ie({gen:r,lineage:i});if(o.xp[t]=I(e.xp),o.runs[t]=I(e.lessonsCompleted),e.done&&typeof e.done==`object`)for(let[t,n]of Object.entries(e.done))n&&F(t)&&(o.done[t]=``);o.days=We(e);let s={hearts:Math.min(5,I(e.hearts??5)),heartsAt:Number.isFinite(e.heartsAt)?e.heartsAt:a},c=N(s,a);o.hearts={n:s.hearts,msToNext:s.hearts>=5?0:Math.round(c)};let l=e.prefs&&typeof e.prefs==`object`?e.prefs:{};return o.prefs={sound:l.sound!==!1,haptics:l.haptics!==!1,soundStyle:/^[A-J]$/.test(l.soundStyle)?l.soundStyle:`J`},o.imported[n]=Ue(e),{ok:!0,doc:o}}function Ke(e,t=null,n=Date.now()){let r=e.days,i=e.hearts.n;return{version:3,onboarded:t?.onboarded??!1,xp:Re(e),hearts:i,heartsAt:i>=5?n:n-(k-e.hearts.msToNext),streak:Fe(r),lastDay:r.length?r[r.length-1]:null,done:Object.fromEntries(Object.keys(e.done).map(e=>[e,!0])),lessonsCompleted:ze(e),installTipClosed:t?.installTipClosed??!1,lastActive:t?.lastActive??0,prefs:{...e.prefs}}}function qe(e,t,{deviceId:n,today:r,now:i=Date.now(),baseline:a=null}){if(!F(n))throw Error(`缺少设备编号`);let o=ke(e),s={xp:!1,runs:!1,done:!1,days:!1,hearts:!1,prefs:!1},c=a?I(a.xp):Re(o),l=a?I(a.lessonsCompleted):ze(o),u=I(t.xp)-c;u>0&&(o.xp[n]=(o.xp[n]??0)+u,s.xp=!0);let d=I(t.lessonsCompleted)-l;d>0&&(o.runs[n]=(o.runs[n]??0)+d,s.runs=!0);for(let[e,n]of Object.entries(t.done??{}))n&&F(e)&&!(e in o.done)&&(o.done[e]=Pe(r)?r:``,s.done=!0);let f=We(t).filter(e=>!o.days.includes(e));Pe(t.lastDay)&&!o.days.includes(t.lastDay)&&!f.includes(t.lastDay)&&f.push(t.lastDay),f.length&&(o.days=[...new Set([...o.days,...f])].sort(),s.days=!0);let p={hearts:Math.min(5,I(t.hearts)),heartsAt:Number.isFinite(t.heartsAt)?t.heartsAt:i},m=N(p,i),h={n:p.hearts,msToNext:p.hearts>=5?0:Math.round(m)};h.n!==o.hearts.n&&(s.hearts=!0),o.hearts=h;let g=t.prefs??{},_={sound:g.sound!==!1,haptics:g.haptics!==!1,soundStyle:/^[A-J]$/.test(g.soundStyle)?g.soundStyle:`J`};return JSON.stringify(_)!==JSON.stringify(o.prefs)&&(o.prefs=_,s.prefs=!0),{doc:o,changed:s}}function Je(e,{deviceId:t,guestId:n,cloudDoc:r=null,now:i=Date.now(),choice:a=null}){if(r){let o=Le(r);if(!o.ok)return{ok:!1,code:o.code,message:o.message};let s=o.doc.imported[n];if(s){let t=Ue(e);if(s===!0||s===t)return{ok:!0,doc:o.doc,outcome:`already-imported`};if(a===`keep-cloud`)return{ok:!0,doc:o.doc,outcome:`kept-cloud`};if(a!==`replace`)return{ok:!0,doc:o.doc,outcome:`guest-changed`,choices:[`keep-cloud`,`replace`],message:`这份游客记录导入后又有新的学习进度，请选择保留云端，或用新的游客记录替换`}}let c=Ge(e,{deviceId:t,guestId:n,gen:o.doc.gen+1,now:i});return c.ok?{ok:!0,doc:c.doc,outcome:`replaced`}:c}let o=Ge(e,{deviceId:t,guestId:n,gen:1,now:i});return o.ok?{ok:!0,doc:o.doc,outcome:`created`}:o}var Ye=`suipian.progress`,Xe=`suipian.guestId`,Ze=`suipian.device`,Qe=`suipian.session`,$e=`suipian.acct.`,et=e=>$e+e;function tt(e,t){try{return{ok:!0,value:e.getItem(t)}}catch{return{ok:!1}}}function nt(e,t,n){try{return e.setItem(t,n),!0}catch{return!1}}function rt(e,t){try{return e.removeItem(t),!0}catch{return!1}}function it(e,t){let n=tt(e,t);if(!n.ok)return{ok:!1,code:`read-failed`,message:`无法读取本机编号`};if(F(n.value))return{ok:!0,id:n.value};let r=Oe();if(!nt(e,t,r))return{ok:!1,code:`save-failed`,message:`无法保存本机编号（存储被禁用或已满）`};let i=tt(e,t);return!i.ok||i.value!==r?{ok:!1,code:`save-failed`,message:`本机编号保存后读回不一致`}:{ok:!0,id:r}}var at=e=>it(e,Ze),ot=e=>it(e,Xe);function st(e){let t=tt(e,Ye);if(!t.ok)return{status:`read-failed`};if(t.value===null)return{status:`none`};try{let e=JSON.parse(t.value);if(e&&typeof e==`object`)return{status:`ok`,raw:t.value,state:e}}catch{}return{status:`corrupt`,raw:t.value}}function ct(e){let t=tt(e,Qe);return t.ok&&F(t.value)?t.value:null}function lt(e,t){return t===null?rt(e,Qe):F(t)?nt(e,Qe,t):!1}function ut(e,t,{now:n=Date.now()}={}){if(!F(t))return{ok:!1,code:`bad-user`,message:`账号编号无效`};let r=tt(e,et(t));if(!r.ok)return{ok:!1,code:`read-failed`,message:`无法读取这个账号的本机副本`};let i=r.value;if(i===null)return{ok:!0,copy:null};let a;try{a=JSON.parse(i)}catch{return{ok:!1,code:`corrupt`,message:`这个账号的本机副本损坏`}}let o=Le(a?.doc);if(!o.ok)return{ok:!1,code:o.code,message:o.message};let s=o.doc;if(Number.isFinite(a.savedAt)&&n>=a.savedAt&&s.hearts.n<5){let e={hearts:s.hearts.n,heartsAt:a.savedAt-(k-s.hearts.msToNext)},t=N(e,n);s.hearts={n:e.hearts,msToNext:e.hearts>=5?0:Math.round(t)}}return{ok:!0,copy:{doc:s,base:a.base??null,dirty:{hearts:!!a.dirty?.hearts,prefs:!!a.dirty?.prefs,content:!!a.dirty?.content}}}}function dt(e,t,n,{now:r=Date.now(),expectEmpty:i=!1}={}){if(!F(t))return!1;if(i){let n=tt(e,et(t));if(!n.ok||n.value!==null)return!1}let a=Le(n?.doc);if(!a.ok)return!1;let o=JSON.stringify({doc:a.doc,base:n.base??null,dirty:{hearts:!!n.dirty?.hearts,prefs:!!n.dirty?.prefs,content:!!n.dirty?.content},savedAt:r});return nt(e,et(t),o)}function ft(e,t){return F(t)?rt(e,et(t)):!1}function pt(e,t){let n=ft(e,t),r=lt(e,null);return n&&r}function mt(e,{userChoseTransfer:t,uploadOk:n,uploaded:r,readBack:i,guestSnapshotRaw:a}){if(t!==!0||n!==!0||!i||!r||!Ve(r,i)||typeof a!=`string`)return!1;let o=tt(e,Ye);return!o.ok||o.value!==a?!1:rt(e,Ye)}var ht=`suipian.staleAuth`,gt=`suipian.auth`;function _t(e,t){return e&&e!==`cloud-off`&&e!==t?`proj:${e}:`:``}function vt(e,t){if(!t)return e;let n=e=>e===`suipian.session`||e===`suipian.auth`||e===`suipian.staleAuth`||e.startsWith(`suipian.acct.`)?t+e:e;return{getItem:t=>e.getItem(n(t)),setItem:(t,r)=>e.setItem(n(t),r),removeItem:t=>e.removeItem(n(t))}}function yt({storage:e,api:t,projectId:n=null,legacyProject:r=null,now:i=()=>Date.now(),today:a=()=>xe(),schedule:o=(e,t)=>setTimeout(e,t),onStatus:s=()=>{},onState:c=()=>{},onNotice:l=()=>{}}){let u=vt(e,_t(n,r)),d=null,f=null,p=``,m=null,h=!1,g=null,_=!1,v=null,y=null,b=0,x=null,S=``,ee=null,C=(e,t=``)=>{m=e,S=t;try{s(e,t)}catch{}},w=()=>{try{let e=JSON.parse(u.getItem(gt));if(!e||!e.session||!e.session.userId)return null;if(n&&(e.project||r)!==n){try{u.setItem(ht,JSON.stringify({userId:e.session.userId,email:String(e.session.email||``).trim().toLowerCase(),project:e.project||r||``}))}catch{}return null}return e.session}catch{return null}},T=()=>{try{d?u.setItem(gt,JSON.stringify(n?{session:d,project:n}:{session:d})):u.removeItem(gt)}catch{}},E=e=>!!e&&(e.base==null||!!(e.dirty&&(e.dirty.hearts||e.dirty.prefs||e.dirty.content))),te=()=>{try{let e=JSON.parse(u.getItem(ht));return e&&typeof e.userId==`string`?e:null}catch{return null}},ne=()=>{try{u.removeItem(ht)}catch{}},D=e=>e.kind===`network`?`offline`:e.kind===`auth`?`need-login`:(e.kind,`error`);function O(){let e=w();return!e||e.userId!==f||!e.refreshToken||d&&(e.refreshToken===d.refreshToken||!(e.expiresAt>d.expiresAt))?!1:(d=e,p=e.email||p,!0)}async function re(){if(O(),!d)return{ok:!1,kind:`auth`,message:`需要重新登录`};if(d.expiresAt-i()>6e4)return{ok:!0};let e=await t.refresh(d);return e.ok&&e.session.userId===f?(d=e.session,p=d.email||p,T(),{ok:!0}):!e.ok&&e.kind===`auth`&&O()&&d.expiresAt-i()>6e4?{ok:!0}:e.ok?{ok:!1,kind:`auth`,message:`登录账号不一致`}:e}function ie(e=null){let t=ct(u);if(!t)return null;let n=ut(u,t,{now:i()});if(!n.ok||!n.copy)return null;let r=w();d=r&&r.userId===t?r:null,f=t,p=d?.email||``;let a=Ke(n.copy.doc,e?{...e,onboarded:!0}:{...A(),onboarded:!0},i());return x={xp:a.xp,lessonsCompleted:a.lessonsCompleted},h=E(n.copy),C(d?`pending`:`need-login`),{userId:f,email:p,state:a}}function ae(e){if(!f)return{ok:!1,code:`no-account`};let t=at(u);if(!t.ok)return{ok:!1,code:t.code,message:t.message};let n=ut(u,f,{now:i()});if(!n.ok||!n.copy)return{ok:!1,code:n.code||`no-copy`,message:n.message};let{doc:r,changed:o}=qe(n.copy.doc,e,{deviceId:t.id,today:a(),now:i(),baseline:x}),s={hearts:n.copy.dirty.hearts||o.hearts,prefs:n.copy.dirty.prefs||o.prefs,content:n.copy.dirty.content||o.xp||o.runs||o.done||o.days};return dt(u,f,{doc:r,base:n.copy.base,dirty:s},{now:i()})?(x={xp:e.xp,lessonsCompleted:e.lessonsCompleted},E({base:n.copy.base,dirty:s})&&(h=!0,m!==`offline`&&m!==`need-login`&&C(`pending`),oe(1500)),{ok:!0}):{ok:!1,code:`save-failed`,message:`无法保存到本机`}}function oe(e=1500){f&&d&&(v||(v=o(()=>{v=null,se()},e)))}function se(){return f?g?(_=!0,g):(g=(async()=>{try{let e,t=0,n=!1;for(;;){if(_=!1,e=await le(),e.replacedLocal&&(n=!0),e.ok){if(b=0,_)continue;break}if(e.kind===`network`){if(_&&t++<1)continue;ce()}break}return n&&e.ok?{...e,replacedLocal:!0}:e}finally{g=null}})(),g):Promise.resolve({ok:!1,kind:`no-account`})}function ce(){if(y||!f||!d)return;let e=[3e3,1e4,3e4,6e4][Math.min(b,3)];b++,y=o(()=>{y=null,se()},e)}async function le(){C(`syncing`);let e=await re();if(!e.ok)return C(D(e),e.message),e;for(let e=0;e<5;e++){let e=await t.getProgress(d);if(!e.ok)return C(D(e),e.message),e;let n=ut(u,f,{now:i()});if(!n.ok||!n.copy)return C(`error`,`本机账号记录读取失败`),{ok:!1,kind:`local`,message:`本机账号记录读取失败`};let r=n.copy,a,o,s=!1;if(e.row){let n=He(r.doc,e.row.doc,{localHeartsDirty:r.dirty.hearts,localPrefsDirty:r.dirty.prefs});if(n.error)return C(`error`,n.error.message),{ok:!1,kind:`data`,code:n.error.code,message:n.error.message};if(n.outcome===`conflict`)return C(`conflict`),{ok:!1,kind:`conflict`,message:`这个账号在别处被“覆盖”过，需要选择保留哪一份`};if(a=n.doc,o=e.row.rev,n.outcome===`remote-newer`&&r.dirty.content&&(s=!0),!Ve(a,e.row.doc)){let n=await t.saveProgress(d,e.row.rev,a);if(!n.ok)return C(D(n),n.message),n;if(n.rev===null)continue;o=n.rev}}else{let e=await t.createProgress(d,r.doc);if(!e.ok)return C(D(e),e.message),e;if(e.rev===null)continue;a=r.doc,o=e.rev}let p=ut(u,f,{now:i()}),m=p.ok&&p.copy?p.copy:r,g=a,v={hearts:!1,prefs:!1,content:!1};if(!Ve(m.doc,r.doc)){let e=He(m.doc,a,{localHeartsDirty:!0,localPrefsDirty:!0});if(e.doc){let t=e.outcome===`remote-newer`;t&&m.dirty.content&&(s=!0),g=e.doc,v={hearts:m.dirty.hearts,prefs:m.dirty.prefs,content:!t&&m.dirty.content},_=!0}}if(dt(u,f,{doc:g,base:o,dirty:v},{now:i()}),!Ve(m.doc,g)){let e=Ke(g,null,i());x={xp:e.xp,lessonsCompleted:e.lessonsCompleted},c(g)}if(h=_,C(_?`pending`:`synced`),s)try{l(`replaced`,{})}catch{}return s?{ok:!0,rev:o,replacedLocal:!0}:{ok:!0,rev:o}}return C(`error`,`同步冲突太多次，请稍后再试`),{ok:!1,kind:`server`,message:`同步冲突太多次，请稍后再试`}}let ue=e=>t.sendCode(String(e).trim());async function de(e,n,r=null){let i=await t.verifyCode(String(e).trim(),n);return i.ok?fe(i.session,r):i}async function fe(e,n){let r=!1;if(f&&f!==e.userId){let t=te(),n=String(e.email||``).trim().toLowerCase();if(!d&&t&&t.userId===f&&t.email&&t.email===n)r=!0;else return{ok:!1,kind:`other-account`,message:`请先退出当前账号`}}let a=await t.getProgress(e);if(!a.ok)return a;let o=a.row?Le(a.row.doc):null;if(o&&!o.ok)return{ok:!1,kind:`data`,code:o.code,message:`云端记录：`+o.message};let s=ut(u,e.userId,{now:i()});if(!s.ok)return{ok:!1,kind:`local`,message:s.message};let c=st(u),l=c.status===`ok`&&Ue(c.state)!==Ue(A()),p=ot(u),m=!!(o&&p.ok&&o.doc.imported[p.id]),h={session:e,remote:a,remoteDoc:o?o.doc:null,copy:s.copy,guest:c,baseState:n,leaveStale:r};return l&&!s.copy&&!m?(ee=h,{ok:!0,needChoice:!0,cloudHasData:!!o&&Re(o.doc)+Object.keys(o.doc.done).length>0,guest:{xp:c.state.xp??0,lessons:Object.keys(c.state.done??{}).filter(e=>c.state.done[e]).length}}):k(h,null)}async function pe(e){let t=ee;return ee=null,t?k(t,e):{ok:!1,kind:`local`,message:`没有等待选择的登录`}}async function k(e,n){let r=e.session.userId,a=at(u),o=ot(u);if(!a.ok)return{ok:!1,kind:`local`,message:a.message};let s,c=e.remote.row?e.remote.row.rev:null,l=!1;if(e.copy)s=e.copy.doc,c=e.copy.base??c;else if(n===`transfer`){if(!o.ok||e.guest.status!==`ok`)return{ok:!1,kind:`local`,message:`游客记录读取失败，没有转存`};let t=Je(e.guest.state,{deviceId:a.id,guestId:o.id,cloudDoc:e.remoteDoc,now:i(),choice:`replace`});if(!t.ok)return{ok:!1,kind:`data`,message:t.message};s=t.doc,l=t.outcome===`created`||t.outcome===`replaced`}else s=e.remoteDoc??Ie();if(!dt(u,r,{doc:s,base:c,dirty:{hearts:l,prefs:l,content:l}},{now:i(),expectEmpty:!e.copy}))return{ok:!1,kind:`local`,message:`无法保存到本机，登录没有完成`};if(!lt(u,r))return{ok:!1,kind:`local`,message:`无法记录当前账号`};d=e.session,f=r,p=d.email||``,T();let m=Ke(s,e.baseState?{...e.baseState,onboarded:!0}:{...A(),onboarded:!0},i());x={xp:m.xp,lessonsCompleted:m.lessonsCompleted},h=!0;let g=await se();e.leaveStale&&ne();let _=!1;if(g.ok&&l&&e.guest.status===`ok`){let n=await t.getProgress(d);n.ok&&n.row&&(_=mt(u,{userChoseTransfer:!0,uploadOk:!0,uploaded:s,readBack:n.row.doc,guestSnapshotRaw:e.guest.raw}))}let v=ut(u,r,{now:i()}),y=v.ok&&v.copy?Ke(v.copy.doc,e.baseState?{...e.baseState,onboarded:!0}:{...A(),onboarded:!0},i()):m;return x={xp:y.xp,lessonsCompleted:y.lessonsCompleted},{ok:!0,state:y,account:{userId:f,email:p},synced:g.ok,syncError:g.ok?``:g.message||``,guestCleared:_}}async function me({force:e=!1}={}){if(!f)return{ok:!0};if(h&&!e){let e=await se();if(!e.ok)return{ok:!1,pending:!0,kind:e.kind,message:e.message}}if(d)try{await t.signOut(d)}catch{}return e&&h?lt(u,null):pt(u,f),ne(),d=null,f=null,p=``,x=null,h=!1,ee=null,T(),C(null),{ok:!0}}async function j(){if(!f)return{ok:!1,kind:`no-account`};let e=await re();if(!e.ok)return e;let n=await t.deleteAccount(d);return n.ok?(pt(u,f),d=null,f=null,p=``,x=null,h=!1,T(),C(null),{ok:!0}):n}return{restore:ie,persistLocal:ae,syncNow:se,scheduleSync:oe,sendCode:ue,verify:de,finishChoice:pe,logout:me,deleteAccount:j,account:()=>f?{userId:f,email:p}:null,status:()=>({status:m,pending:h,message:S})}}var bt=/^[A-Za-z0-9_-]{1,64}$/,xt=`suipian.draft.`,St=()=>{let e=new Uint8Array(12);return(globalThis.crypto||{getRandomValues:e=>e.map(()=>Math.floor(Math.random()*256))}).getRandomValues(e),`g`+[...e].map(e=>e.toString(16).padStart(2,`0`)).join(``)},Ct=()=>_t(se(fe.url)||`cloud-off`,ce);function wt(e=globalThis.localStorage,t=Ct()){try{let n=vt(e,t).getItem(`suipian.session`);if(bt.test(n||``))return t+n;let r=e.getItem(`suipian.guestId`);if(!bt.test(r||``)){r=St();try{e.setItem(`suipian.guestId`,r)}catch{}}return r}catch{return`guest`}}var Tt=(e,t)=>`${xt}${e}.${t.id}.v${t.version??1}`;function Et(e,t,n){try{let r=e.getItem(Tt(t,n));if(r==null)return null;let i=JSON.parse(r);return!i||i.v!==1||typeof i.code!=`string`?null:{code:i.code,viewed:!!i.viewed,phase:i.phase===`variation`?`variation`:`original`}}catch{return null}}function Dt(e,t,n,{code:r,viewed:i,phase:a}){try{return e.setItem(Tt(t,n),JSON.stringify({v:1,code:r,viewed:!!i,phase:a===`variation`?`variation`:`original`,at:Date.now()})),!0}catch{return!1}}function Ot(e,t,n){try{return e.removeItem(Tt(t,n)),!0}catch{return!1}}function kt(e,t,n,r,{ms:i=500,onResult:a=()=>{}}={}){let o=null,s=()=>{o=null,a(Dt(e,t,n,r()))};return{schedule(){clearTimeout(o),o=setTimeout(s,i)},flush(){o!==null&&(clearTimeout(o),s())},cancel(){clearTimeout(o),o=null},pending:()=>o!==null}}function L(e,t={},...n){let r=document.createElement(e);for(let[e,n]of Object.entries(t))n!=null&&n!==!1&&(e===`class`?r.className=n:e===`text`?r.textContent=n:r.setAttribute(e,n===!0?``:n));for(let e of n.flat())e!=null&&e!==!1&&r.append(e);return r}var At=[`modify`,`write`],jt=e=>At.includes(e?.type),Mt=/[“”‘’]/;function Nt(e,t){let n=C(e).split(`
`),r=C(t).split(`
`),i=Math.max(n.length,r.length);for(let e=0;e<i;e++)if(n[e]!==r[e])return n[e]===void 0?`多输出了第 ${e+1} 行`:r[e]===void 0?`少输出了第 ${e+1} 行及之后的内容`:n[e].trimEnd()===r[e].trimEnd()?`第 ${e+1} 行只有行尾空格不同`:`第 ${e+1} 行不同：期望“${n[e]}”，你的是“${r[e]}”`;return``}var Pt=e=>e&&Object.keys(e).length?Object.entries(e).map(([e,t])=>`${e} = ${JSON.stringify(t)}`).join(`，`):``,Ft=e=>`${e.fn}(${[...(e.args??[]).map(e=>JSON.stringify(e)),...Object.entries(e.kwargs??{}).map(([e,t])=>`${e}=${JSON.stringify(t)}`)].join(`, `)})`;function It(r,c){let l=c.storage??globalThis.localStorage,{exec:u,runner:d,ui:f}=c,p=wt(l),m=r.variation??r.variant??null,h=m&&Array.isArray(m.tests)&&m.tests.length&&m.id?{...r,isVariation:!0,id:m.id,version:m.version??r.version??1,type:`write`,prompt:m.prompt??``,given:m.given??r.given,tests:m.tests,hints:m.hints??[],reference:m.solution??m.reference??``,mistakes:m.mistakes??[],starter:m.starter??m.code??``,code:void 0,files:m.files,entry:m.entry,checkMode:m.checkMode??r.checkMode,compare:m.compare??r.compare,worked:void 0}:null,g=e=>e.type===`modify`?e.code??``:e.starter??``,_=Et(l,p,r),y=_?.viewed??!1,b=r,x=g(r),S=h&&_?.phase===`variation`?`variation`:`original`;S===`variation`&&(b=h,x=g(h));let ee=S===`variation`?Et(l,p,h):_,w=0,T=!1,E=!1,te=!1,ne=!1,D=null,O=null,ie=!1,ae=[],oe=e=>String(e??``).replace(/\s+/g,``);function se(){let e=r.worked;return!e||!e.code||b.isVariation||r.reference&&oe(e.code).includes(oe(r.reference))?null:L(`details`,{class:`ct-worked`,"data-worked":``},L(`summary`,{text:`先看一个例子（不是本题的答案）`}),L(`pre`,{class:`ct-worked-code`,text:e.code}),e.output==null?null:L(`pre`,{class:`ct-worked-out`,text:`输出：
`+e.output}),e.explain?L(`p`,{class:`ct-worked-explain`,text:e.explain}):null)}function ce(){return ae=(b.tests||[]).filter(e=>!e.hidden),[b.isVariation?L(`div`,{class:`ct-variation`,role:`note`,"data-variation":``},L(`b`,{text:`变化题`}),L(`p`,{text:`原题已经通过。再做一道有变化的题：不多加 XP，答错也不扣红心。`}),L(`p`,{class:`ct-vprompt`,text:b.prompt})):null,se(),b.given?.length?L(`p`,{class:`ct-given`},`已经准备好的变量：`,L(`code`,{text:b.given.join(`、`)})):null,ae.length?L(`div`,{class:`ct-samples`,role:`list`,"aria-label":`例子`},ae.map((e,t)=>L(`div`,{class:`ct-sample`,role:`listitem`},L(`b`,{text:`例 ${t+1}${e.name?` · `+e.name:``}`}),Pt(e.data)?L(`div`,{text:`给定：`+Pt(e.data)}):null,e.call?L(`div`,{text:`调用：`+Ft(e.call)}):null,e.stdin==null?null:L(`div`,{text:`输入：`+(Array.isArray(e.stdin)?e.stdin.join(` ⏎ `):String(e.stdin).replace(/\n$/,``).replace(/\n/g,` ⏎ `))}),e.call?L(`div`,{text:`应该返回：`+JSON.stringify(e.expectedReturn)}):L(`pre`,{class:`ct-exp`,text:`应该输出：
`+(e.expected??``)})))):null]}let le=L(`div`,{class:`ct-prompt`},ce()),ue=0;function de(){ue||(ue=requestAnimationFrame(()=>{ue=0;let e=Te.closest(`.lesson`);if(!e||!M.dom.isConnected)return;let t=M.coordsAtPos(M.state.selection.main.head),n=t?{top:t.top,bottom:t.bottom}:pe.getBoundingClientRect(),r=e.getBoundingClientRect();n.bottom>r.bottom-12?e.scrollTop+=n.bottom-(r.bottom-12):n.top<r.top+12&&(e.scrollTop-=r.top+12-n.top)}))}let fe=()=>{Te.isConnected?M.hasFocus&&de():window.visualViewport?.removeEventListener(`resize`,fe)};window.visualViewport?.addEventListener(`resize`,fe);let pe=L(`div`,{class:`ct-editor`,"aria-label":`代码编辑区`,role:`group`}),k=L(`span`,{class:`ct-savenote`,text:`代码暂存于此设备`}),A=e=>{k.textContent=e?`代码暂存于此设备`:`⚠ 这台设备存不下草稿（存储不可用）。当前页面里的代码还在，退出后会丢失`,k.classList.toggle(`bad`,!e)},me=()=>kt(l,p,b,()=>b.isVariation?{code:ge(),viewed:!1}:{code:ge(),viewed:y,phase:S},{onResult:A}),j=me(),M=n(pe,``,[t.changeFilter.of(()=>!T),o.updateListener.of(e=>{e.docChanged&&ie&&(c.onChange?.(),j.schedule()),ie&&(e.docChanged||e.selectionSet||e.focusChanged)&&de()})]);M.contentDOM.setAttribute(`aria-label`,`Python 代码`);let he=ee?ee.code:x;e(M,he,he.length),ie=!0;let ge=()=>M.state.doc.toString(),_e=L(`div`,{id:`keyboard`,class:`ct-kb`});function ve(){_e.hidden=te||ne,xe.textContent=te?`回到内置键盘`:ne?`展开键盘`:`收起键盘`,ie&&setTimeout(de,60)}function ye(){te=!te,ne=!1,a(M,te),ve()}i(_e,M,{onToggleSystem:ye});let N=(e,t,n=`ct-btn`,r={})=>{let i=L(`button`,{type:`button`,class:n,...r},e);return i.addEventListener(`click`,()=>{i.disabled||t()}),i},be=N(`运行`,()=>E?D?.abort():ke(),`ct-btn run`,{"data-run":``}),xe=N(`收起键盘`,()=>{te?ye():(ne=!ne,ve())},`ct-btn ghost`,{"data-toggle-kb":``}),Se=N(`重新开始`,()=>Ie(),`ct-btn ghost`,{"data-reset":``}),Ce=L(`div`,{class:`ct-status`,role:`status`}),P=L(`div`,{class:`ct-results`,"aria-live":`polite`,"data-results":``}),we=L(`div`,{class:`ct-toolbar`},be,Se,xe),Te=L(`div`,{class:`ct-root`,"data-code-task":r.id||``},le,pe,we,L(`div`,{class:`ct-meta`},k),Ce,P);ve();function Ee(){let e=d.state;Ce.replaceChildren(),e===`ready`||e===`running`?Ce.textContent=`Python 已就绪`:e===`loadError`?Ce.append(L(`span`,{text:(c.pythonUnavailable?.()??`Python 还没有加载成功。`)+` `}),N(`重试加载`,()=>d.boot(),`ct-btn small`,{"data-retry-python":``})):Ce.textContent=`Python 加载中…（可以先写代码）`}Ee();let De=!1,Oe=setInterval(()=>{Te.isConnected?(De=!0,E||Ee()):De&&clearInterval(Oe)},600);function F(e){E=e,be.textContent=e?`停止`:`运行`,c.onChange?.()}function I(e,t,n=``){P.className=`ct-results `+n,P.replaceChildren(L(`h3`,{text:e}),...t.filter(Boolean).map(e=>typeof e==`string`?L(`p`,{text:e}):e))}async function ke(){if(E||T)return;let e=ge(),t=ae[0]??b.tests[0];F(!0),D=new AbortController,I(`运行中…`,[`只是试一试，不判对错，也不扣红心。`]);try{let n=Ae(e),r=await u.exec({code:e,files:n,entry:b.entry||`main.py`,data:t?.data??null,stdin:t?.stdin??null,readFiles:[],timeoutMs:v.caseMs,signal:D.signal}),i=[];r.timedOut?i.push(L(`p`,{class:`bad`,text:`运行超过 ${v.caseMs/1e3} 秒，已停止（可能有死循环）。这不影响答题，也不扣红心。`})):r.limitHit&&i.push(L(`p`,{class:`bad`,text:`输出超过安全上限，已停止，请检查循环或打印次数。这不影响答题，也不扣红心。`})),r.error?i.push(L(`pre`,{class:`ct-out bad`,text:(r.stdout?r.stdout+`
`:``)+(r.error.file&&r.error.file!==(b.entry||`main.py`)?`[${r.error.file}] `:``)+s(r.error)})):!r.timedOut&&!r.limitHit&&i.push(L(`pre`,{class:`ct-out`,text:r.stdout||`程序运行完成，没有输出`})),I(`运行结果（试一试，不判对错）`,i)}catch(e){e&&e.cancelled?I(`已停止`,[`这次运行已停止，不影响答题。`]):e&&e.unavailable?I(`Python 还没准备好`,[`这次运行没有执行，不影响答题，也不扣红心。请稍等或点“重试加载”。`],`warn`):I(`运行没有成功`,[`应用内部出了点问题，不影响答题，请再试一次。`],`warn`)}finally{F(!1),D=null,Ee()}}function Ae(e){if(!b.files)return;let t=b.entry||`main.py`;return Object.fromEntries(b.files.map(n=>[n.path,n.path===t?e:n.content]))}async function je(){if(E)return{status:`internal-error`,attempt:!1,settle:!1,retry:!0,cases:[],totalMs:0};let e=ge();j.flush(),F(!0),D=new AbortController,I(`检查中…`,[`正在用几组数据运行你的代码。思考和修改不限时；运行只有安全保护时限。`]);let t;try{let n={tests:b.tests,checkMode:b.checkMode||`output`,compare:b.compare||`strict`};b.files?(n.files=b.files.map(t=>({path:t.path,content:t.path===(b.entry||`main.py`)?e:t.content})),n.entry=b.entry):n.code=e,t=await re(n,u,{signal:D.signal})}catch{t={status:`internal-error`,attempt:!1,settle:!1,retry:!0,totalMs:0,cases:[{name:``,hidden:!1,ok:!1,kind:`internal`,ms:0,message:`判题出了内部问题，这次不算作答，代码已保留，请重试`}]}}finally{F(!1),D=null,Ee()}if(t.status===`fail`&&Mt.test(e)&&t.cases.some(e=>e.kind===`error`&&e.error?.kind===`SyntaxError`))return t={...t,status:`curly-quotes`,attempt:!1,settle:!1,retry:!0},O=t,I(`代码里有弯引号，这次不算作答`,[`Python 只认直引号 " 或 '，不认弯引号 “ ” ‘ ’。请改成直引号再检查（用内置键盘输入就是直引号）。`,`不扣红心，代码已保留。`],`warn`),t;if(O=t,Pe(t),h&&!b.isVariation&&y&&t.status===`pass`)return t={...t,attempt:!1,settle:!1,retry:!0,assisted:!0},O=t,Me(),t;if(b.isVariation){if(t.status===`pass`)t={...t,attempt:!0,settle:!0,variation:!0};else if(t.status===`fail`){t={...t,attempt:!1,settle:!1,retry:!0,variation:!0};let e=P.querySelector(`h3`);e&&(e.textContent+=`（变化题：不扣红心，可以继续改）`)}O=t}return t}function Me(){j.flush(),S=`variation`,Dt(l,p,r,{code:ge(),viewed:y,phase:S}),b=h,x=g(h),j=me();let t=Et(l,p,h),n=t?t.code:x;ie=!1,e(M,n,n.length),ie=!0,le.replaceChildren(...ce().filter(e=>e!=null)),w=0,O=null,I(`原题通过了 ✓`,[`因为看过参考解法，还要再做一道有变化的题才算完成。下面是变化题：不多加 XP，没做对也不扣红心。`],`ok`),j.schedule(),c.onChange?.(),Te.scrollIntoView?.({block:`start`})}function Ne(e,t){for(let t of b.mistakes||[]){let n=t.match||{};if(!(n.test&&n.test!==e.name)&&!(n.errorKind&&n.errorKind!==e.error?.kind)&&(n.got===void 0||C(n.got)===C(e.stdout??e.actualReturn??``)))return t.why}return t?.note||``}function Pe(e){let t=b.tests.length,n=e.cases.filter(e=>e.ok).length,r,i=``;e.status===`pass`?(r=`全部通过 ✓（${n}/${t} 组）`,i=`ok`):e.status===`fail`?(r=`还没通过：${n}/${t} 组通过`,i=`bad`):(r={timeout:`运行时间太长，已停止`,"output-limit":`输出太多，已停止`,unavailable:`Python 还没准备好`,cancelled:`已取消`,"internal-error":`判题出了内部问题`}[e.status]||`这次没有判定`,i=`warn`);let a=[];e.attempt||a.push(L(`p`,{class:`warn`,text:(e.cases.at(-1)?.message||``)+(e.status,``)})),e.cases.forEach((t,n)=>{let r=b.tests[n],i=L(`div`,{class:`ct-case `+(t.ok?`ok`:`bad`),role:`group`,"aria-label":`${t.name||`第 `+(n+1)+` 组`}：${t.ok?`通过`:`未通过`}`},L(`div`,{class:`ct-case-head`},L(`b`,{text:t.ok?`✓ 通过 `:`✗ 未通过 `}),L(`span`,{text:(t.hidden?`隐藏测试`:t.name||`第 ${n+1} 组`)+(t.ms?` · ${t.ms} ms`:``)})));if(!t.ok&&e.attempt){t.kind===`error`&&t.error?i.append(L(`pre`,{class:`ct-out bad`,text:(t.error.file&&t.error.file!==(b.entry||`main.py`)?`[${t.error.file}] `:``)+s(t.error)})):t.kind===`wrong-return`?i.append(L(`p`,{text:t.hidden?`函数的返回值和期望不一致。`:`期望返回 ${t.expected}，你的函数返回 ${t.actualReturn}`})):t.kind===`wrong-file`?i.append(L(`p`,{text:t.hidden?t.message:`输出文件不对：`}),...(t.files||[]).map(e=>L(`p`,{text:`${e.path}：期望“${e.expected}”，你的是${e.actual===null?`（没有生成这个文件）`:`“`+e.actual+`”`}`}))):!t.hidden&&t.expected!==void 0?i.append(L(`p`,{class:`ct-diff`,text:Nt(t.expected,t.stdout)||t.message}),L(`div`,{class:`ct-cmp`},L(`div`,{},L(`b`,{text:`期望输出`}),L(`pre`,{text:t.expected})),L(`div`,{},L(`b`,{text:`你的输出`}),L(`pre`,{text:t.stdout||`（没有输出）`})))):i.append(L(`p`,{text:t.message}));let e=Ne(t,r);e&&i.append(L(`p`,{class:`ct-why`,text:e}))}a.push(i)}),I(r,a,i)}function Fe(){let e=b.hints||[],t=(e,t,n)=>f.sheet(n=>[L(`div`,{class:`lsheet hint`},L(`b`,{text:e}),L(`pre`,{class:`hint-text`,text:t}),f.button(`好的`,n,`btn3d primary wide`))]);w<e.length?(w++,t(`提示 ${w}/${e.length}`,e[w-1])):!h||b.isVariation?t(`没有更多提示了`,`再试一次吧：先看看上面的例子，一步一步对照你的输出和期望输出。`,!0):y?t(`参考解法（你已经查看过）`,r.reference??``,!0):f.sheet(e=>[L(`div`,{class:`lsheet`},L(`h2`,{text:`要看参考解法吗？`}),L(`p`,{text:`看过之后这道题会标记为“已查看解答”：你的代码通过后，还要再做一道有变化的题才算完成（不多扣红心，也不重复加 XP）。先再试一次，自己写出来最有收获。`}),f.button(`再试试`,e,`btn3d primary wide`),f.button(`看参考解法（之后要再做一道变化题）`,()=>{e(),y=!0,j.flush(),j.schedule(),j.flush(),t(`参考解法`,r.reference??``,!0)},`btn3d danger-ghost wide`))])}function Ie(){T||f.sheet(t=>[L(`div`,{class:`lsheet`},L(`h2`,{text:`要重新开始吗？`}),L(`p`,{text:`编辑器会恢复成题目给的初始代码，你现在写的代码会丢失。`}),f.button(`继续写`,t,`btn3d primary wide`),f.button(`重新开始`,()=>{t(),Ot(l,p,b),e(M,x,x.length),O=null,P.replaceChildren(),j.cancel(),c.onChange?.()},`btn3d danger-ghost wide`))])}let Le=()=>{document.visibilityState===`hidden`&&j.flush()};return document.addEventListener(`visibilitychange`,Le),addEventListener(`pagehide`,()=>j.flush()),{kind:`code`,node:Te,after:_e,view:M,ready:()=>ge().trim().length>0&&!T,lock(){T=!0,be.disabled=!0,Se.disabled=!0,_e.hidden=!0},mark(){},afterFeedback(){P.scrollIntoView?.({block:`start`})},check:je,settled(e){e?(Ot(l,p,r),h&&Ot(l,p,h),j.cancel()):j.flush()},isCorrect:()=>O?.status===`pass`,phase:()=>S,isVariation:()=>b.isVariation===!0,why:()=>`全部测试都通过了。`,whyWrong:()=>{let e=O?.cases?.findIndex(e=>!e.ok)??-1;if(e<0)return``;let t=O.cases[e];return Ne(t,b.tests[e])||t.message||``},code:ge,setCode:t=>e(M,t,t.length),viewedSolution:()=>y,openHint:Fe,destroy(){j.flush(),clearInterval(Oe),document.removeEventListener(`visibilitychange`,Le)}}}var Lt=u({DEFAULT_STYLE:()=>`J`,EVENTS:()=>qt,KEY_SOUNDS:()=>Rt,TRIMS:()=>Wt,measureKey:()=>Yt,renderEvent:()=>Jt,renderKey:()=>Kt}),Rt=[{id:`A`,name:`清脆矮轴`,desc:`短促、干净、轻微触底声`},{id:`B`,name:`奶油矮轴`,desc:`更柔和，低频稍多`},{id:`C`,name:`轻段落轴`,desc:`按下时有轻微的段落感`},{id:`D`,name:`铝板矮轴`,desc:`清脆，带极短的金属感`},{id:`E`,name:`塑料外壳`,desc:`轻巧、偏明亮`},{id:`F`,name:`静音矮轴`,desc:`声音很短、很克制`},{id:`G`,name:`深沉矮轴`,desc:`触底声稍厚`},{id:`H`,name:`弹性垫片`,desc:`柔软，带一点回弹感`},{id:`I`,name:`陶瓷清响`,desc:`清亮但不刺耳`},{id:`J`,name:`极简 Tap`,desc:`非常短，适合连续点击`}],zt=1,Bt=null;function Vt(e){if(Bt&&Bt.sampleRate===e.sampleRate)return Bt;let t=Math.floor(e.sampleRate*.12),n=e.createBuffer(1,t,e.sampleRate),r=n.getChannelData(0),i=12345;for(let e=0;e<t;e++)i=i*1664525+1013904223>>>0,r[e]=i/4294967296*2-1;return Bt=n,n}function R(e,t,n,{freq:r,q:i=1,dur:a=.012,gain:o=.5,type:s=`bandpass`}){let c=e.createBufferSource();c.buffer=Vt(e);let l=e.createBiquadFilter();l.type=s,l.frequency.value=r*zt,l.Q.value=i;let u=e.createGain();return u.gain.setValueAtTime(1e-4,n),u.gain.exponentialRampToValueAtTime(o,n+8e-4),u.gain.exponentialRampToValueAtTime(1e-4,n+a),c.connect(l),l.connect(u),u.connect(t),c.start(n),c.stop(n+a+.01),n+a}function z(e,t,n,{from:r,to:i,dur:a=.05,gain:o=.3,type:s=`sine`}){let c=e.createOscillator();c.type=s,c.frequency.setValueAtTime(r*zt,n),c.frequency.exponentialRampToValueAtTime(i*zt,n+a);let l=e.createGain();return l.gain.setValueAtTime(1e-4,n),l.gain.exponentialRampToValueAtTime(o,n+.003),l.gain.exponentialRampToValueAtTime(1e-4,n+a),c.connect(l),l.connect(t),c.start(n),c.stop(n+a+.01),n+a}function Ht(e,t,n,{freq:r,dur:i=.05,gain:a=.1}){let o=e.createOscillator();o.type=`sine`,o.frequency.value=r*zt;let s=e.createGain();return s.gain.setValueAtTime(1e-4,n),s.gain.exponentialRampToValueAtTime(a,n+.001),s.gain.exponentialRampToValueAtTime(1e-4,n+i),o.connect(s),s.connect(t),o.start(n),o.stop(n+i+.01),n+i}var Ut={A:{trim:.98,run:(e,t,n)=>Math.max(R(e,t,n,{freq:3500,q:1.2,dur:.014,gain:.5}),z(e,t,n,{from:220,to:140,dur:.045,gain:.35}),R(e,t,n+.022,{freq:2200,q:.9,dur:.018,gain:.25,type:`bandpass`}))},B:{trim:.6,run:(e,t,n)=>Math.max(R(e,t,n,{freq:1800,q:.8,dur:.018,gain:.35}),z(e,t,n,{from:170,to:100,dur:.075,gain:.5}))},C:{trim:1.19,run:(e,t,n)=>Math.max(R(e,t,n,{freq:4200,q:1.2,dur:.008,gain:.35}),R(e,t,n+.028,{freq:3e3,q:1,dur:.012,gain:.4}),z(e,t,n+.028,{from:200,to:130,dur:.05,gain:.3}))},D:{trim:1.07,run:(e,t,n)=>Math.max(R(e,t,n,{freq:3800,q:1.2,dur:.012,gain:.45}),z(e,t,n,{from:190,to:120,dur:.045,gain:.3}),Ht(e,t,n+.002,{freq:2600,dur:.065,gain:.12}))},E:{trim:1.81,run:(e,t,n)=>Math.max(R(e,t,n,{freq:4800,q:.9,dur:.016,gain:.45}),z(e,t,n,{from:300,to:200,dur:.04,gain:.25,type:`triangle`}))},F:{trim:1.93,run:(e,t,n)=>Math.max(R(e,t,n,{freq:1500,q:.8,dur:.01,gain:.22}),z(e,t,n,{from:150,to:110,dur:.04,gain:.22}))},G:{trim:.48,run:(e,t,n)=>Math.max(z(e,t,n,{from:140,to:80,dur:.09,gain:.6}),R(e,t,n,{freq:1200,q:.8,dur:.014,gain:.4}))},H:{trim:.8,run:(e,t,n)=>Math.max(z(e,t,n,{from:190,to:120,dur:.055,gain:.4}),z(e,t,n+.03,{from:260,to:200,dur:.035,gain:.15}),R(e,t,n,{freq:2400,q:1,dur:.012,gain:.3}))},I:{trim:1.1,run:(e,t,n)=>Math.max(Ht(e,t,n,{freq:3200,dur:.075,gain:.22}),Ht(e,t,n,{freq:4800,dur:.05,gain:.08}),R(e,t,n,{freq:5200,q:1.2,dur:.006,gain:.25}),z(e,t,n,{from:260,to:180,dur:.03,gain:.15}))},J:{trim:1.45,run:(e,t,n)=>Math.max(R(e,t,n,{freq:3e3,q:1,dur:.008,gain:.45}),z(e,t,n,{from:240,to:170,dur:.04,gain:.25}))}},Wt=Object.fromEntries(Object.entries(Ut).map(([e,t])=>[e,t.trim]));function Gt(e,t,n,r,i,a){let o=e.createGain();o.gain.value=Ut[n].trim*a,o.connect(t),zt=i;try{return Ut[n].run(e,o,r)-r}finally{zt=1}}function Kt(e,t,n,r){return Math.round(Gt(e,t,n,r,1,1)*1e3)}var qt={select:[[0,1,1]],place:[[0,.82,1.1]],undo:[[0,1.25,.9]],correct:[[0,1,.9],[.075,1.5,1]],wrong:[[0,.8,.9],[.085,.6,.9]],finish:[[0,1,.8],[.09,1.25,.9],[.18,1.5,1]]};function Jt(e,t,n,r,i){let a=0;for(let[o,s,c]of qt[r])a=Math.max(a,o+Gt(e,t,n,i+o,s,c));return Math.round(a*1e3)}async function Yt(e,t=`select`){let n=44100,r=new OfflineAudioContext(1,26460,n),i=Jt(r,r.destination,e,t,0),a=(await r.startRendering()).getChannelData(0),o=0;for(let e=0;e<a.length;e++){let t=Math.abs(a[e]);t>o&&(o=t)}let s=0;for(let e=a.length-1;e>=0;e--)if(Math.abs(a[e])>o*.01){s=e;break}let c=0;for(let e=0;e<a.length;e++)c+=a[e]*a[e];return{ms:i,audibleMs:Math.round(s/n*1e3),peak:o,rms:Math.sqrt(c/(.1*n))}}var Xt=u({activeCount:()=>un,audioContext:()=>mn,currentStyle:()=>pn,diagnostics:()=>vn,haptic:()=>_n,hapticsSupported:()=>tn,log:()=>Qt,masterNode:()=>hn,play:()=>H,playStyle:()=>fn,preview:()=>gn,reducedMotion:()=>en,setPrefs:()=>nn,stats:()=>B,unlock:()=>on}),Zt={sound:!0,haptics:!0,soundStyle:`J`},Qt=[],$t=e=>{Qt.push(e),Qt.length>200&&Qt.shift()},B={played:0,dropped:0,resumed:0,unlocks:0,lastError:``,history:[]},en=()=>{try{return matchMedia(`(prefers-reduced-motion: reduce)`).matches}catch{return!1}},tn=()=>typeof navigator<`u`&&typeof navigator.vibrate==`function`;function nn(e){Zt.sound=e?.sound!==!1,Zt.haptics=e?.haptics!==!1,Zt.soundStyle=Rt.some(t=>t.id===e?.soundStyle)?e.soundStyle:`J`}var V=null,rn=null;function an(){if(V)return V;try{let e=window.AudioContext||window.webkitAudioContext;if(!e)return B.lastError=`浏览器没有 AudioContext`,null;V=new e,B.history.push(`创建:${V.state}`),V.addEventListener?.(`statechange`,()=>{B.history.push(`→${V.state}`),B.history.length>8&&B.history.shift()}),rn=V.createGain(),rn.gain.value=.9,rn.connect(V.destination);try{navigator.audioSession&&(navigator.audioSession.type=`ambient`)}catch{}}catch(e){V=null,B.lastError=`创建音频失败：`+(e?.message||e)}return V}function on(){let e=an();if(e)try{if(e.state!==`running`){B.unlocks++,e.resume().then(()=>{B.resumed++}).catch(e=>{B.lastError=`resume 失败：`+(e?.message||e)});let t=e.createBufferSource();t.buffer=e.createBuffer(1,1,22050),t.connect(e.destination),t.start(0)}}catch(e){B.lastError=`解锁失败：`+(e?.message||e)}}var sn={select:40,place:55,undo:40,correct:140,wrong:150,finish:280},cn={},ln=[],un=()=>ln.filter(e=>e.until>performance.now()).length;function dn(e,t,n=Zt.soundStyle){let r=performance.now();for(ln=ln.filter(e=>e.until>r);ln.length>=3;){let t=ln.shift();try{t.gain.gain.cancelScheduledValues?.(e.currentTime),t.gain.gain.setValueAtTime?.(t.gain.gain.value??1,e.currentTime),t.gain.gain.linearRampToValueAtTime?.(1e-4,e.currentTime+.01)}catch{}}let i=e.createGain();i.connect(rn);let a=Jt(e,i,n,t,e.currentTime+.005);ln.push({gain:i,until:r+Math.max(a,sn[t]||0)+20}),B.played++}function H(e,{force:t=!1}={}){if(!Zt.sound&&!t||!qt[e])return Promise.resolve(!1);$t(e);try{let n=performance.now();if(!t&&n-(cn[e]||-1e9)<25)return Promise.resolve(!1);cn[e]=n;let r=an();if(!r)return B.dropped++,Promise.resolve(!1);if(r.state===`running`)return dn(r,e),Promise.resolve(!0);let i=performance.now();return r.resume().then(()=>r.state===`running`&&performance.now()-i<(t?2e3:300)?(B.resumed++,dn(r,e),!0):(B.dropped++,!1)).catch(e=>(B.dropped++,B.lastError=`resume 失败：`+(e?.message||e),!1))}catch(e){return B.lastError=`播放失败：`+(e?.message||e),Promise.resolve(!1)}}function fn(e,t=`select`){on();let n=an();if(!n||!Rt.some(t=>t.id===e)||!qt[t])return{ok:!1,state:n?n.state:`不可用`};$t(`${e}:${t}`);try{return dn(n,t,e),{ok:n.state===`running`,state:n.state}}catch(e){return B.lastError=`试听失败：`+(e?.message||e),{ok:!1,state:n.state}}}var pn=()=>Zt.soundStyle;function mn(){return on(),an()}function hn(){return rn}function gn(){return on(),H(`correct`,{force:!0})}function _n(){if(Zt.haptics&&tn()){$t(`haptic`);try{navigator.vibrate(12)}catch{}}}function vn(){return{audioState:V?V.state:`未创建`,sampleRate:V?V.sampleRate:0,hasAudioContext:!!(window.AudioContext||window.webkitAudioContext),audioSession:(()=>{try{return navigator.audioSession?navigator.audioSession.type:`无`}catch{return`无`}})(),vibrate:tn(),soundPref:Zt.sound,soundStyle:Zt.soundStyle,hapticsPref:Zt.haptics,...B,history:B.history.join(` `)}}if(typeof document<`u`){for(let e of[`touchend`,`click`,`keydown`])document.addEventListener(e,on,{capture:!0,passive:!0});document.addEventListener(`visibilitychange`,()=>{V&&(document.visibilityState===`hidden`?V.suspend().catch(()=>{}):V.resume().catch(()=>{}))})}function yn({url:e,anonKey:t,fetchFn:n=(...e)=>fetch(...e),timeoutMs:r=15e3}){let i=String(e||``).replace(/\/+$/,``),a=!!(i&&t);async function o(e,{method:o=`GET`,body:s,token:c,query:l}={}){if(!a)return{ok:!1,kind:`config`,message:`云端暂未开通`};let u=typeof AbortController<`u`?new AbortController:null,d=u?setTimeout(()=>u.abort(),r):null,f;try{f=await n(i+e+(l?`?`+l:``),{method:o,signal:u?.signal,headers:{apikey:t,Authorization:`Bearer `+(c||t),"Content-Type":`application/json`},body:s===void 0?void 0:JSON.stringify(s)})}catch{return{ok:!1,kind:`network`,message:`网络连不上，请检查网络后重试`}}finally{d&&clearTimeout(d)}let p=null,m=await f.text().catch(()=>``);if(m)try{p=JSON.parse(m)}catch{p=m}if(f.ok)return{ok:!0,status:f.status,data:p};let h=p&&(p.msg||p.message||p.error_description||p.error)||`服务器返回 ${f.status}`;return{ok:!1,kind:f.status===429?`rate-limit`:f.status===401||f.status===403?`auth`:`server`,status:f.status,message:String(h)}}let s=e=>e&&e.access_token&&e.user?.id?{accessToken:e.access_token,refreshToken:e.refresh_token,expiresAt:Number.isFinite(e.expires_at)?e.expires_at*1e3:Date.now()+(e.expires_in??3600)*1e3,userId:e.user.id,email:e.user.email||``}:null;return{configured:a,async sendCode(e){let t=await o(`/auth/v1/otp`,{method:`POST`,body:{email:e,create_user:!0}});return t.ok?{ok:!0}:t},async verifyCode(e,t){let n=await o(`/auth/v1/verify`,{method:`POST`,body:{type:`email`,email:e,token:String(t).trim()}});if(!n.ok)return n.kind===`server`&&n.status&&n.status<500?{...n,kind:`auth`}:n;let r=s(n.data);return r?{ok:!0,session:r}:{ok:!1,kind:`server`,message:`登录返回的内容无法识别`}},async refresh(e){let t=await o(`/auth/v1/token`,{method:`POST`,query:`grant_type=refresh_token`,body:{refresh_token:e.refreshToken}});if(!t.ok)return t.kind===`server`&&t.status&&t.status<500?{...t,kind:`auth`}:t;let n=s(t.data);return n?{ok:!0,session:n}:{ok:!1,kind:`server`,message:`刷新登录返回的内容无法识别`}},async signOut(e){return await o(`/auth/v1/logout`,{method:`POST`,token:e.accessToken}),{ok:!0}},async getProgress(e){let t=await o(`/rest/v1/progress`,{token:e.accessToken,query:`select=doc,rev&limit=2`});return t.ok?!Array.isArray(t.data)||t.data.length>1?{ok:!1,kind:`server`,message:`读到的进度行数不对`}:{ok:!0,row:t.data[0]?{doc:t.data[0].doc,rev:t.data[0].rev}:null}:t},async createProgress(e,t){let n=await o(`/rest/v1/rpc/create_progress`,{method:`POST`,token:e.accessToken,body:{new_doc:t}});return n.ok?{ok:!0,rev:Number.isInteger(n.data)?n.data:null}:n},async saveProgress(e,t,n){let r=await o(`/rest/v1/rpc/save_progress`,{method:`POST`,token:e.accessToken,body:{expected_rev:t,new_doc:n}});return r.ok?{ok:!0,rev:Number.isInteger(r.data)?r.data:null}:r},async deleteAccount(e){let t=await o(`/rest/v1/rpc/delete_my_account`,{method:`POST`,token:e.accessToken,body:{}});return t.ok?{ok:!0}:t}}}function bn(e){let t=e?.status;return t===`synced`?`已同步 ✓`:t===`syncing`?`同步中…`:t===`pending`?`有进度等待上传（联网后自动同步）`:t===`offline`?`现在离线：进度已存在这台设备，联网后自动同步`:t===`need-login`?`登录已过期，需要重新登录才能同步（进度还在这台设备上）`:t===`conflict`?`这个账号在别处被覆盖过，需要选择保留哪一份`:t===`error`?`同步失败：`+(e.message||`请稍后再试`):`已登录，正在准备同步…`}var xn={network:`网络连不上，请检查网络后重试。`,"rate-limit":`发送太频繁了，请等一分钟再试。`,config:`云端暂未开通。`},Sn=e=>xn[e.kind]||e.message||`出错了，请稍后再试。`;function Cn({h:e,button:t,sheet:n,icon:r,showToast:i,sync:a,api:o,getState:s,onSwitchedIn:c,onSwitchedOut:l,rerender:u}){let d=new Set;function f(){let e=a.status();for(let t of[...d])t.__shown&&!t.isConnected?d.delete(t):p(t,e)}function p(e,t){e.textContent=bn(t),e.dataset.status=t.status||``,e.isConnected&&(e.__shown=!0)}function m({reason:r=``}={}){if(!o.configured)i(`云端暂未开通，现在只能在这台设备上学习。`);else return n(n=>{let o=e(`div`,{class:`lsheet login`,"data-login":``}),l=``,u=!1,d=null,f=0,p=e(`p`,{class:`login-msg`,role:`alert`,"data-login-msg":``}),m=(e,t=!0)=>{p.textContent=e,p.classList.toggle(`bad`,t)},h=()=>{clearInterval(d),n()};function g(){let n=e(`input`,{class:`login-input`,type:`email`,inputmode:`email`,autocomplete:`email`,autocapitalize:`off`,spellcheck:`false`,placeholder:`you@example.com`,"aria-label":`邮箱`,"data-email":``});n.value=l;let i=t(`发送验证码`,async()=>{let e=n.value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)){m(`请输入有效的邮箱地址。`);return}if(u)return;u=!0,i.disabled=!0,m(`正在发送…`,!1);let t=await a.sendCode(e);u=!1,i.disabled=!1,t.ok?(l=e,f=Date.now()+6e4,m(``),_()):m(Sn(t))},`btn3d primary wide`,{"data-send-code":``});n.addEventListener(`keydown`,e=>{e.key===`Enter`&&i.click()}),o.replaceChildren(e(`h2`,{text:`登录 / 注册`}),e(`p`,{text:r||`用邮箱登录，换手机或 iPad 也能接着学。没有账号会自动创建；不用设密码。`}),n,i,p,t(`先不登录`,h,`btn3d ghost wide`)),setTimeout(()=>n.focus(),50)}function _(){let n=e(`input`,{class:`login-input code`,type:`text`,inputmode:`numeric`,pattern:`[0-9]*`,autocomplete:`one-time-code`,maxlength:`10`,placeholder:`验证码`,"aria-label":`邮箱验证码`,"data-code":``}),r=t(`重新发送`,async()=>{if(Date.now()<f||u)return;u=!0;let e=await a.sendCode(l);u=!1,e.ok?(f=Date.now()+6e4,m(`已重新发送。`,!1),i()):m(Sn(e))},`btn3d ghost`,{"data-resend":``}),i=()=>{let e=Math.ceil((f-Date.now())/1e3);r.disabled=e>0,r.textContent=e>0?`重新发送（${e} 秒）`:`重新发送`};clearInterval(d),d=setInterval(()=>{o.isConnected?i():clearInterval(d)},1e3),i();let c=t(`登录`,async()=>{let e=n.value.replace(/\s+/g,``);if(e.length<4){m(`请输入邮件里的验证码。`);return}if(u)return;u=!0,c.disabled=!0,m(`正在登录…`,!1);let t=await a.verify(l,e,s());u=!1,c.disabled=!1,t.ok?t.needChoice?v(t):y(t):m(t.kind===`auth`?`验证码错误或已过期，请检查后重试，或点“重新发送”。`:Sn(t))},`btn3d primary wide`,{"data-verify":``});n.addEventListener(`keydown`,e=>{e.key===`Enter`&&c.click()}),o.replaceChildren(e(`h2`,{text:`输入验证码`}),e(`p`,{text:`验证码已发到 ${l}。没收到？看看垃圾邮件，或稍等再重新发送。`}),n,c,r,p,t(`换个邮箱`,()=>{m(``),g()},`btn3d ghost wide`)),setTimeout(()=>n.focus(),50)}function v(n){let r=`${n.guest.xp} XP、${n.guest.lessons} 关`,i=async(e,t)=>{if(u)return;u=!0,m(`正在处理…`,!1);let n=await a.finishChoice(e);u=!1,n.ok?y(n):m(Sn(n))};n.cloudHasData?o.replaceChildren(e(`h2`,{text:`这个账号已有学习进度`}),e(`p`,{text:`云端已经有这个账号的进度。这台设备上还有没登录时学的进度（${r}）。`}),t(`用账号里的进度（推荐）`,()=>i(`cloud`),`btn3d primary wide`,{"data-choice":`cloud`}),t(`用这台设备的进度覆盖账号`,()=>{o.replaceChildren(e(`h2`,{text:`确定覆盖吗？`}),e(`p`,{text:`账号里原来的进度会被这台设备的进度替换，不能撤销。`}),t(`确定覆盖`,()=>i(`transfer`),`btn3d danger wide`,{"data-choice":`transfer`}),t(`返回`,()=>v(n),`btn3d ghost wide`),p)},`btn3d wide`,{"data-choice":`ask-replace`}),e(`p`,{class:`muted small`,text:`选“用账号里的进度”时，这台设备上的游客记录会原样保留，不会删除。`}),p):o.replaceChildren(e(`h2`,{text:`转存这台设备上的进度？`}),e(`p`,{text:`这台设备上有没登录时学的进度（${r}）。要放进这个账号吗？`}),t(`转存到账号`,()=>i(`transfer`),`btn3d primary wide`,{"data-choice":`transfer`}),t(`不转存，用全新账号`,()=>i(`cloud`),`btn3d wide`,{"data-choice":`cloud`}),e(`p`,{class:`muted small`,text:`转存成功并确认云端一致后，这台设备上的游客记录才会清除；不转存则原样保留。`}),p)}function y(e){h(),c(e),i(e.synced?`登录成功，进度已同步。`:`登录成功。`+(e.syncError?`云端暂时没同步上（`+e.syncError+`），联网后会自动补上。`:``))}return g(),[o]},{cls:`login-sheet`})}function h(){let r=a.account(),s=e(`section`,{class:`acct-card`,"data-account":``});if(!o.configured)return s.append(e(`h3`,{text:`账号`}),e(`p`,{class:`muted`,text:`云端暂未开通：学习进度只保存在这台设备上。`})),s;if(!r)return s.append(e(`h3`,{text:`账号`}),e(`p`,{class:`muted`,text:`登录后，进度会保存到云端，换手机或 iPad 也能接着学。`}),t(`邮箱登录 / 注册`,()=>m(),`btn3d primary wide`,{"data-open-login":``})),s;let c=e(`p`,{class:`acct-status`,role:`status`,"data-sync-status":``});d.add(c);let f=(r,i,a,o,s=!1)=>n(n=>[e(`div`,{class:`lsheet`},e(`h2`,{text:r}),e(`p`,{text:i}),t(a,async()=>{n(),await o()},`btn3d wide `+(s?`danger`:`primary`)),t(`取消`,n,`btn3d ghost wide`))]);async function h(e){let t=await a.logout();t.ok?(l(),i(`已退出登录。`),e&&e()):t.pending?f(`有进度还没上传`,`现在连不上云端。退出后这些进度会先留在这台设备上，用同一个账号重新登录时会接着上传；建议联网后再退出。`,`仍然退出`,async()=>{await a.logout({force:!0}),l(),i(`已退出登录。`),e&&e()},!0):i(Sn(t))}return s.append(e(`h3`,{text:`账号`}),e(`p`,{class:`acct-email`,text:r.email||`已登录`}),c,t(`立即同步`,async()=>{let e=await a.syncNow();e.ok?u():i(Sn(e))},`btn3d wide`,{"data-sync-now":``}),e(`div`,{class:`acct-row`},t(`退出登录`,()=>h(),`btn3d`,{"data-logout":``}),t(`切换账号`,()=>h(()=>m()),`btn3d`,{"data-switch":``})),t(`删除账号和云端记录`,()=>f(`删除账号？`,`会永久删除这个账号和云端的学习记录，不能恢复。这台设备上也会退出登录。`,`永久删除`,async()=>{let e=await a.deleteAccount();e.ok?(l(),i(`账号已删除。`)):i(Sn(e))},!0),`btn3d danger-ghost wide`,{"data-delete-account":``})),p(c,a.status()),s}function g(){if(!o.configured)return null;let n=a.account();if(!n)return t(`登录 / 注册：换设备也能接着学`,()=>m(),`acct-link`,{"data-login-link":``});let r=e(`span`,{class:`acct-mini`,"data-sync-mini":``});d.add(r);let i=e(`div`,{class:`acct-row-mini`},e(`span`,{text:n.email||`已登录`}),r);return p(r,a.status()),i}return{openLogin:m,accountCard:h,accountRow:g,refreshStatus:f}}var wn=`suipian-progress`,Tn=/^[A-Za-z0-9_-]{1,40}$/,En=/^\d{4}-\d{2}-\d{2}$/,Dn=(e,t)=>Number.isInteger(e)&&e>=0&&e<=t;function On(e=new Date){let t=e=>String(e).padStart(2,`0`);return`suipian-progress-${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())}.json`}function kn(e,{now:t=Date.now(),build:n=``,unreadable:r=[]}={}){return{format:wn,exportVersion:1,exportedAt:new Date(t).toISOString(),build:String(n||``),state:e,unreadable:r.map(e=>({savedAt:e.savedAt,raw:e.raw}))}}function An(e){if(typeof e!=`string`||!e.trim())return{ok:!1,error:`文件是空的。`};if(e.length>1048576)return{ok:!1,error:`文件太大，不像是从碎片编程导出的进度文件。`};let t;try{t=JSON.parse(e)}catch{return{ok:!1,error:`文件内容不是有效的进度文件（无法读取）。`}}if(!t||typeof t!=`object`||t.format!==`suipian-progress`)return{ok:!1,error:`这不是碎片编程的进度文件。`};if(t.exportVersion!==1)return{ok:!1,error:`这个进度文件来自不同版本，当前版本不认识，没有导入任何内容。`};let n=t.state;if(!n||typeof n!=`object`||n.version!==3)return{ok:!1,error:`进度文件里的学习记录格式不对，没有导入任何内容。`};if(!Dn(n.xp,1e7)||!Dn(n.streak,1e5)||!Dn(n.lessonsCompleted??0,1e7))return{ok:!1,error:`进度文件里的数字不合理，没有导入任何内容。`};if(n.lastDay!=null&&!(typeof n.lastDay==`string`&&En.test(n.lastDay)))return{ok:!1,error:`进度文件里的日期不合理，没有导入任何内容。`};if(!n.done||typeof n.done!=`object`||Array.isArray(n.done))return{ok:!1,error:`进度文件里缺少关卡完成记录，没有导入任何内容。`};let r={};for(let[e,t]of Object.entries(n.done)){if(!Tn.test(e)||e===`__proto__`)return{ok:!1,error:`进度文件里有不合法的关卡编号，没有导入任何内容。`};t===!0&&(r[e]=!0)}return{ok:!0,exportedAt:typeof t.exportedAt==`string`?t.exportedAt:null,state:{xp:n.xp,streak:n.streak,lastDay:n.lastDay??null,done:r,lessonsCompleted:n.lessonsCompleted??0}}}function jn(e,t){let n={...e.done};for(let e of Object.keys(t.done))n[e]=!0;let r=e.lastDay,i=t.lastDay,a=e.streak,o=r;return i&&(!r||i>r)?(a=t.streak,o=i):i&&r===i&&(a=Math.max(e.streak,t.streak)),{...e,onboarded:!0,xp:Math.max(e.xp,t.xp),lessonsCompleted:Math.max(e.lessonsCompleted||0,t.lessonsCompleted||0),done:n,streak:a,lastDay:o,hearts:Math.min(5,e.hearts)}}function Mn(e){return{xp:e.xp,lessons:Object.keys(e.done).length,streak:e.streak,lastDay:e.lastDay}}var Nn=[5,10,20],Pn=(e,t)=>`${e}#${t}`;function Fn(e,t){return e.map(e=>({id:e.id,title:e.title,lessons:e.lessons.filter(e=>t&&t[e.id]===!0).map(e=>({id:e.id,title:e.title,count:e.exercises.length}))})).filter(e=>e.lessons.length>0)}function In(e,t,n){let r=new Set(n),i=[],a=new Set;for(let n of e)for(let e of n.lessons)t&&t[e.id]===!0&&r.has(e.id)&&e.exercises.forEach((t,r)=>{let o=Pn(e.id,r);a.has(o)||(a.add(o),i.push({id:o,lessonId:e.id,unitId:n.id,index:r,ex:t}))});return i}function Ln(e,t=Math.random){let n=[...e];for(let e=n.length-1;e>0;e--){let r=Math.floor(t()*(e+1));[n[e],n[r]]=[n[r],n[e]]}return n}function Rn(e,t,n=Math.random){let r=[...new Map(e.map(e=>[e.id,e])).values()],i=Math.min(t,r.length);return{items:Ln(r,n).slice(0,i),requested:t,actual:i,short:i<t}}function zn(e,t=Math.random){let n=JSON.parse(JSON.stringify(e));return n.type===`predict`?n.options=Ln(n.options,t):n.type===`fill`?n.tokens=Ln(n.tokens,t):n.type===`order`&&(n.shuffled=Ln(n.shuffled,t)),n}var Bn=`modulepreload`,Vn=function(e,t){return new URL(e,t).href},Hn={},Un=function(e){return e.pathname.endsWith(`.css`)},Wn=function(e,t,n){if(t in e)return e[t];let r=n();if(!r){e[t]=void 0;return}let i=r.then(()=>{e[t]=void 0},n=>{throw e[t]=void 0,n});return e[t]=i,i},Gn=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e,i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?new URL(import.meta.resolve(e)):new URL(e,import.meta.url)}r=o(t.map(t=>{t=Vn(t,n);let r=s(t),i=Un(r);return Wn(Hn,r.href,()=>{if(e===void 0){e={all:new Set,styles:new Set};let t=document.getElementsByTagName(`link`);for(let n=t.length-1;n>=0;n--){let r=t[n];e.all.add(r.href),r.rel===`stylesheet`&&e.styles.add(r.href)}}if((i?e.styles:e.all).has(r.href))return;let t=document.createElement(`link`);if(t.rel=i?`stylesheet`:Bn,i||(t.as=`script`),t.crossOrigin=``,t.href=r.href,a&&t.setAttribute(`nonce`,a),document.head.appendChild(t),i)return new Promise((e,n)=>{t.addEventListener(`load`,e),t.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${r}`)))})})}).filter(e=>e!==void 0))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},Kn={U1:f,U2:p,U3:m,U4:h,U5:g},qn=10,Jn=5,Yn=10,Xn=120,Zn=/iP(hone|ad|od)/.test(navigator.userAgent)||navigator.platform===`MacIntel`&&navigator.maxTouchPoints>1,Qn=navigator.standalone===!0||matchMedia(`(display-mode: standalone)`).matches;Zn&&!Qn&&document.documentElement.classList.add(`ios-browser`);function U(e,t={},...n){let r=document.createElement(e);for(let[e,n]of Object.entries(t))n!=null&&n!==!1&&(e===`class`?r.className=n:e===`text`?r.textContent=n:e.startsWith(`on`)?r.addEventListener(e.slice(2),n):r.setAttribute(e,n===!0?``:n));for(let e of n.flat())e!=null&&e!==!1&&r.append(e);return r}function W(e,t,n=`btn`,r={}){let i=U(`button`,{type:`button`,class:n,...r},e);return i.addEventListener(`click`,e=>{i.disabled||t(e)}),i}var $n=`http://www.w3.org/2000/svg`;function G(e,t,...n){let r=document.createElementNS($n,e);for(let[e,n]of Object.entries(t))r.setAttribute(e,n);return n.forEach(e=>{e!=null&&e!==!1&&r.append(e)}),r}var er={flame:`M12 3c.8 3.2 5 5.2 5 9.8a5 5 0 0 1-10 0c0-2 .9-3.3 2.2-4.4.4 1.6 1.2 2.3 2 2.6-.4-2.6-.2-5 .8-8z`,bolt:`M13 2.5 5.5 13H11l-1 8.5L18.5 10H13z`,heart:`M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z`,home:`M4 11l8-7 8 7v9H4zM10 20v-6h4v6`,user:`M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21c0-4 3.5-6 7.5-6s7.5 2 7.5 6`,check:`M5 12.5l4.5 4.5L19 7`,lock:`M7 11h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM8.5 11V8a3.5 3.5 0 0 1 7 0v3`,star:`M12 3l2.7 5.9 6.3.7-4.7 4.3 1.3 6.2L12 16.8l-5.6 3.3 1.3-6.2L3 9.6l6.3-.7z`,trophy:`M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8`,shield:`M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z`,close:`M6 6l12 12M18 6L6 18`,cross:`M7 7l10 10M17 7L7 17`,play:`M8 5.5v13l11-6.5z`,review:`M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5`};function K(e,{size:t=22,fill:n=!1,cls:r=``}={}){return G(`svg`,{viewBox:`0 0 24 24`,width:t,height:t,class:`ico `+r,"aria-hidden":`true`,fill:n?`currentColor`:`none`,stroke:`currentColor`,"stroke-width":`2`,"stroke-linecap":`round`,"stroke-linejoin":`round`},G(`path`,{d:er[e]}))}var tr=16;function nr(e,t,n){let r=Math.round,i=[],a=(e,t,n)=>i.push({d:e,pulse:t,pads:n});if(e===`edge`){let e=(e,n,i,a)=>`M${e} ${r(n)}V${r(i)}L${e+(e<t/2?6:-6)} ${r(i+6)}V${r(a)}`,o=e(6,0,n*.26,n*.6);a(o,o,[[12,r(n*.6)]]);let s=e(t-6,n*.12,n*.45,n*.83);a(s,s,[[t-12,r(n*.83)]]);let c=`M6 ${r(n*.72)}V${r(n)}`;a(c,c,[[6,r(n)]]);let l=`M${t-6} ${r(n*.9)}V${r(n)}`;return a(l,l,[[t-6,r(n)]]),{lines:i,pulses:[[0,11,0],[1,9,-5]]}}let o=(e,n,i,o,s,c)=>{let l=n=>r(e?t-n:n),u=o>=n?1:-1,d=i+tr,f=`M${e?r(t):0} ${r(n)}H${l(i)}L${l(d)} ${r(n+tr*u)}V${r(o)}`,p=[[l(d),r(o)]],m=f;s!=null&&(m+=`M${l(d)} ${r(s)}H${l(d+c)}`,p.push([l(d+c),r(s)],[l(d),r(s)])),a(m,f,p)},s=(e,t,n)=>{let i=`M${r(e)} 0V${r(t)}L${r(e+tr)} ${r(t+tr)}H${r(n)}`;a(i,i,[[r(n),r(t+tr)]])};return o(!1,n*.12,t*.1,n*.31,n*.215,t*.1),s(t*.3,n*.12,t*.43),o(!0,n*.17,t*.09,n*.39,n*.29,t*.08),o(!1,n*.52,t*.08,n*.68,n*.6,t*.08),o(!0,n*.64,t*.09,n*.84,n*.75,t*.08),o(!1,n*.9,t*.16,n*.82,null,0),s(t*.74,n*.1,t*.88),{lines:i,pulses:[[0,10,0],[2,12,-4],[3,9,-2],[4,11,-7]]}}function rr(e,t){let n=Math.max(240,Math.round(window.innerWidth)),r=Math.max(240,Math.round(window.innerHeight));e.setAttribute(`viewBox`,`0 0 ${n} ${r}`);let i=nr(t,n,r);e.replaceChildren(...i.lines.map(e=>G(`path`,{d:e.d,class:`trace`})),...i.lines.flatMap(e=>e.pads.map(([e,t])=>G(`circle`,{cx:String(e),cy:String(t),r:`3.5`,class:`pad`}))),...i.pulses.map(([e,t,n])=>G(`path`,{d:i.lines[e].pulse,class:`pulse`,pathLength:`100`,style:`animation-duration:${t}s;animation-delay:${n}s`})))}var ir=new Set;function ar(e=`full`){let t=G(`svg`,{class:`circuit-bg `+e,preserveAspectRatio:`none`,"aria-hidden":`true`,focusable:`false`});return rr(t,e),ir.add([t,e]),t}var or;window.addEventListener(`resize`,()=>{clearTimeout(or),or=setTimeout(()=>{for(let e of[...ir])e[0].isConnected?rr(e[0],e[1]):ir.delete(e)},120)}),document.addEventListener(`visibilitychange`,()=>document.documentElement.classList.toggle(`bg-paused`,document.hidden));function sr(e,t){let n=e===`done`?`check`:e===`current`?t?`review`:`play`:t?`review`:`lock`,r=K(n,{size:32,fill:n===`play`,cls:`hex-ico`});r.setAttribute(`x`,`20`),r.setAttribute(`y`,`20`);let i=e===`locked`&&t?K(`lock`,{size:16,cls:`hex-badge`}):null;return i&&(i.setAttribute(`x`,`47`),i.setAttribute(`y`,`46`)),G(`svg`,{viewBox:`0 0 72 72`,width:`72`,height:`72`,class:`hexnode`,"aria-hidden":`true`,"data-icon":n},e===`current`?G(`polygon`,{points:`36,1 67,19 67,53 36,71 5,53 5,19`,class:`hex-ring`}):null,G(`polygon`,{points:`36,5 63,20.5 63,51.5 36,67 9,51.5 9,20.5`,class:`hex-body`}),G(`circle`,{cx:`36`,cy:`5`,r:`2.8`,class:`hex-pad`}),G(`circle`,{cx:`36`,cy:`67`,r:`2.8`,class:`hex-pad`}),r,i)}function cr(e=96,t=`happy`){t===`sad`&&(t=`companion`);let n=e=>G(`path`,{d:e,class:`m-ink`}),r={happy:[n(`M36 44Q31 51 36 58`),n(`M64 44Q69 51 64 58`)],think:[n(`M37 40Q32 47 37 54`),n(`M66 40Q71 47 66 54`)],companion:[n(`M31 50Q36 56 41 50`),n(`M59 50Q64 56 69 50`)],celebrate:[n(`M31 54Q36 46 41 54`),n(`M59 54Q64 46 69 54`)]}[t],i={happy:G(`path`,{d:`M42 68Q50 75 58 68`,class:`m-ink`}),think:G(`path`,{d:`M45 69H57`,class:`m-ink`}),companion:G(`path`,{d:`M44 68Q50 72 56 68`,class:`m-ink`}),celebrate:G(`path`,{d:`M42 66Q50 80 58 66z`,class:`m-ink m-solid`})}[t];return G(`svg`,{viewBox:`0 0 100 100`,width:e,height:e,class:`mascot`,"aria-hidden":`true`},G(`rect`,{x:`26`,y:`86`,width:`14`,height:`9`,rx:`3`,class:`m-solid m-ink`}),G(`rect`,{x:`60`,y:`86`,width:`14`,height:`9`,rx:`3`,class:`m-solid m-ink`}),G(`path`,{d:`M22 12H66L90 36V80Q90 90 80 90H22Q12 90 12 80V22Q12 12 22 12Z`,class:`m-body`}),G(`path`,{d:`M66 12L90 36H76Q66 36 66 26Z`,class:`m-fold`}),...r,i,t===`celebrate`?G(`path`,{d:`M14 6v8M10 10h8`,class:`m-spark`}):null)}function lr(e){let t=[],n=/("[^"]*"?)|(\b\d+(?:\.\d+)?\b)|(\bprint\b)|([=+\-*/()])/g,r=0,i;for(;i=n.exec(e);){i.index>r&&t.push(document.createTextNode(e.slice(r,i.index)));let n=i[1]?`tk-str`:i[2]?`tk-num`:i[3]?`tk-fn`:`tk-op`;t.push(U(`span`,{class:n,text:i[0]})),r=i.index+i[0].length}return r<e.length&&t.push(document.createTextNode(e.slice(r))),t}function ur(e,t=``){return U(`div`,{class:`codeblock `+t},e.split(`
`).map((e,t)=>U(`div`,{class:`cl`},U(`span`,{class:`ln`,text:String(t+1)}),U(`span`,{class:`lc`},lr(e)))))}var dr=_e(),q=dr.state,fr=dr.notice;nn(q.prefs),fr&&ve(q);var pr=null;try{pr=window.localStorage}catch{}var mr=yn({url:fe.url,anonKey:fe.anonKey}),hr=null,J=`path`,gr=`这个账号的进度已在别的设备上被替换，这台设备上还没上传的学习内容没有保留。`,_r=!1,vr=null;function yr(e){return _r?(_r=!1,vr=e):vr!==e&&(vr=null),vr===e?gr:null}var Y=pr?yt({storage:pr,api:mr,projectId:se(fe.url)||`cloud-off`,legacyProject:ce,onStatus:()=>hr?.refreshStatus(),onNotice:e=>{e===`replaced`&&(_r=!0,J===`path`?$():J===`me`&&Zr())},onState:e=>{q=Ke(e,q),nn(q.prefs),J===`path`?$():J===`me`&&Zr()}}):null,br=Y?Y.restore(q):null;br&&(q=br.state,fr=null,nn(q.prefs));function X(){if(Y&&Y.account()){let e=Y.persistLocal(q);e.ok||Ir(`无法保存进度到这台设备（`+(e.message||`存储不可用`)+`），关掉页面后进度可能丢失。`)}else ve(q)||Ir(`无法保存进度（可能是无痕模式或存储已满），关掉页面后进度会丢失。`)}hr=Cn({h:U,button:W,sheet:Pr,icon:K,showToast:Ir,sync:Y,api:mr,getState:()=>q,rerender:()=>J===`me`?Zr():$(),onSwitchedIn:e=>{q=e.state,nn(q.prefs),fr=null,J===`me`?Zr():$()},onSwitchedOut:()=>{let e=_e();q=e.state,fr=e.notice,nn(q.prefs),J===`me`?Zr():$()}}),Y&&br&&Y.syncNow(),Y&&(addEventListener(`online`,()=>{Y.account()&&Y.syncNow()}),document.addEventListener(`visibilitychange`,()=>{document.visibilityState===`visible`&&Y.account()&&Y.syncNow()}),setInterval(()=>{document.visibilityState===`visible`&&Y.account()&&Y.status().pending&&Y.syncNow()},6e4));var xr=()=>d.units.filter(e=>e.available).flatMap(e=>Kn[e.id].lessons.map(t=>({...t,unit:e.id}))),Sr=()=>xr().find(e=>!q.done[e.id]);function Cr(e){return q.done[e.id]?`done`:Sr()?.id===e.id?`current`:`locked`}var wr=null,Z={status:`未启用`,caches:[]},Q=document.getElementById(`app`),Tr=new Set,Er=null,Dr=new c({onStatus(e,t){e===`loadError`&&(Er=t||{});for(let n of[...Tr])n.status?.(e,t)},onOutput(e){for(let t of[...Tr])t.output?.(e)}}),Or=ie(Dr);function kr(e){return new Promise(t=>{let n=null,i=null,a=e=>{clearTimeout(i),n&&Tr.delete(n),t(e)},o=()=>{let n=``,r={output:e=>{n+=e},status:(e,i)=>{[`done`,`timeout`,`stopped`,`outputLimit`,`outputLimitStopped`].includes(e)&&(Tr.delete(r),t(e===`done`?{out:n,error:i.error}:{out:n,error:{kind:`Stopped`,line:null,msg:`运行被停止`}}))}};Tr.add(r),Dr.run(e)||(Tr.delete(r),t(null))};if(Dr.state===`ready`)return o();n={status:e=>{e===`ready`?(Tr.delete(n),clearTimeout(i),o()):e===`loadError`&&a(null)}},Tr.add(n),i=setTimeout(()=>a(null),r.loadMs+2e3),Dr.state===`loadError`&&Dr.boot()})}function Ar(){let e=`选择、填空、排序的判分不受影响。`;if(navigator.onLine===!1)return`你现在离线。Python运行功能需要联网后加载，联网后点“重试”。`+e;let t=[];if(typeof WebAssembly>`u`&&t.push(`WebAssembly`),typeof Worker>`u`&&t.push(`后台线程（Worker）`),t.length)return`这个浏览器不支持运行 Python 需要的功能（缺少：${t.join(`、`)}）。可以升级系统或浏览器，或换成 Safari / Chrome 打开。选择、填空、排序的判分不受影响。`;if(Er?.kind===`noWorker`)return`这个环境不允许启动 Python 运行线程（可能是浏览器版本较旧，或应用内置浏览器的限制）。可以点右上角“···”选“在浏览器打开”，或换成 Safari / Chrome。`+e;let n=navigator.userAgent.match(/OS (\d+)[_.](\d+)/),r=n?n[1]+`_`+n[2]:``;if(n&&/iPhone|iPod/.test(navigator.userAgent)&&(+n[1]<16||+n[1]==16&&+n[2]<4))return`这台设备的系统是 iOS ${n[1]}.${n[2]}，低于运行 Python 所需的 iOS 16.4（Pyodide 官方要求），所以看不到“运行结果”。升级系统后即可显示。选择、填空、排序的判分不受影响。`;let i=`诊断：${String(Er?.msg||`无错误信息`).slice(0,120)}；在线：${navigator.onLine?`是`:`否`}${r?`；iOS `+r.replace(`_`,`.`):``}${/MicroMessenger|QQ\//i.test(navigator.userAgent)?`；微信/QQ 内`:``}`;return`Python 运行环境没有加载成功，原因未确认（可能是网络、浏览器版本，或应用内置浏览器的限制）。Python运行功能需要联网后加载，联网后点“重试”；仍然不行，请把下面的诊断信息发给开发者。`+e+`
`+i}function jr(e,t){let n=e.querySelector(`pre`);e.querySelector(`.py-retry`)?.remove(),n.className=`out`,n.textContent=`运行中…`,e.open=!0,kr(t).then(r=>{n.isConnected&&(r?(n.textContent=r.error?(r.out?r.out+`
`:``)+s(r.error):r.out||`程序运行完成，没有输出`,n.className=`out`+(r.error?` error`:``)):(n.textContent=Ar(),n.className=`out offline`,e.append(W(`重试`,()=>jr(e,t),`btn small py-retry`,{"data-retry-python":``}))))})}var Mr=`button, a[href], input, select, textarea, [tabindex]`;function Nr(e){return[...e.querySelectorAll(Mr)].filter(e=>{if(e.disabled||e.getAttribute(`tabindex`)===`-1`||e.closest(`[hidden]`)||e.tagName===`INPUT`&&e.type===`hidden`)return!1;let t=getComputedStyle(e);if(t.visibility===`hidden`||t.display===`none`)return!1;let n=e.getBoundingClientRect();return n.width>0&&n.height>0})}function Pr(e,{onClose:t,cls:n=``}={}){let r=document.activeElement,i=()=>{if(!o.isConnected)return;let e=o.contains(document.activeElement);o.remove(),t?.(),r&&r!==document.body&&r.isConnected&&r.focus?r.focus({preventScroll:!0}):e&&document.activeElement&&document.activeElement!==document.body&&document.activeElement.blur?.()},a=Date.now(),o=U(`div`,{class:`overlay `+n,role:`dialog`,"aria-modal":`true`,tabindex:`-1`},U(`div`,{class:`sheet`},e(i)));o.addEventListener(`click`,e=>{e.target===o&&Date.now()-a>800&&i()}),o.addEventListener(`keydown`,e=>{if(e.key===`Escape`){e.preventDefault(),i();return}if(e.key!==`Tab`)return;let t=Nr(o);if(!t.length){e.preventDefault(),o.focus({preventScroll:!0});return}e.preventDefault();let n=t.indexOf(document.activeElement);(e.shiftKey?n<=0?t[t.length-1]:t[n-1]:n<0||n===t.length-1?t[0]:t[n+1]).focus()});let s=o.querySelector(`h2, h1`);return s&&(s.id||(s.id=`sheet-title-`+a),o.setAttribute(`aria-labelledby`,s.id)),document.body.append(o),(Nr(o)[0]||o).focus({preventScroll:!0}),i}var Fr;function Ir(e){let t=document.querySelector(`.toast`);t||(t=U(`div`,{class:`toast`,role:`alert`}),document.body.append(t)),t.textContent=e,clearTimeout(Fr),Fr=setTimeout(()=>t.remove(),6e3)}var Lr=e=>{let t=Math.ceil(e/6e4);return t>=60?`${Math.floor(t/60)} 小时 ${t%60} 分钟`:`${t} 分钟`};function Rr(e=0){let t=[{text:`你好，我是小码！`,sub:``,mood:`happy`},{text:`我会陪你一关一关学 Python。`,sub:`每关只要两三分钟，全部用点的，不用打字。`,mood:`companion`},{text:`卡住了就点我，我会给你提示。`,sub:`做题时我在左下角。`,mood:`think`}],n=t[e];Q.replaceChildren(U(`main`,{class:`onboard`},U(`div`,{class:`onboard-mid`},cr(120,n.mood),U(`h1`,{text:n.text}),n.sub?U(`p`,{text:n.sub}):null),U(`div`,{class:`onboard-dots`},t.map((t,n)=>U(`span`,{class:n===e?`on`:``}))),e===t.length-1&&mr.configured?W(`已有账号？登录`,()=>hr.openLogin({reason:`登录后会取回你在云端保存的进度。`}),`btn3d ghost wide`,{"data-onboard-login":``}):null,W(e<t.length-1?`继续`:`开始学习`,()=>{e<t.length-1?Rr(e+1):(q.onboarded=!0,X(),$())},`btn3d primary wide`)))}function zr(e=``){return U(`span`,{class:`stat hearts `+e,title:`红心`,"aria-label":`红心 ${q.hearts}`},K(`heart`,{size:20,fill:q.hearts>0}),String(q.hearts))}function Br(){let e=N(q),t=zr();return t.title=e?`下一颗红心：${Lr(e)}后`:`红心已满`,U(`header`,{class:`statsbar`},U(`span`,{class:`stat streak`,"aria-label":`连续 ${P(q)} 天`},K(`flame`,{size:20}),String(P(q))),U(`span`,{class:`stat xp`,"aria-label":`经验值 ${q.xp}`},K(`bolt`,{size:20}),String(q.xp)),t)}function Vr(e){return U(`nav`,{class:`tabbar`},W(U(`span`,{},K(`home`,{size:24}),U(`small`,{text:`学习`})),$,`tab`+(e===`path`?` on`:``),{"aria-label":`学习`}),W(U(`span`,{},K(`user`,{size:24}),U(`small`,{text:`我的`})),Zr,`tab`+(e===`me`?` on`:``),{"aria-label":`我的`}))}function $(){ni?.destroy?.(),ni=null,J=`path`;{let e=yr(`path`);e&&(fr=e)}N(q),wr=null;let e=d.units.map(e=>{if(!e.available)return U(`section`,{class:`unit locked`},U(`div`,{class:`unit-banner`},U(`div`,{class:`unit-no`,text:`第 ${d.units.indexOf(e)+1} 单元 · 即将推出`}),U(`h2`,{text:e.title}),U(`p`,{text:e.subtitle})));let t=Kn[e.id].lessons,n=t.every(e=>q.done[e.id]);return U(`section`,{class:`unit`+(n?` complete`:``)},U(`div`,{class:`unit-banner`},U(`div`,{class:`unit-no`,text:`第 ${d.units.indexOf(e)+1} 单元${n?` · 已完成`:``}`}),U(`h2`,{text:e.title}),U(`p`,{text:e.subtitle})),U(`ol`,{class:`path`},t.map((e,t)=>{let n=Cr(e),r=[0,1,2,1,0,-1][t%6],i=W(U(`span`,{class:`node-face`,"aria-hidden":`true`},sr(n,!!e.review)),()=>Ur(e),`node ${n}${e.review?` review`:``}`,{"aria-label":`${e.title}（${n===`done`?`已完成`:n===`current`?`当前关卡`:`未解锁`}）`,"data-lesson":e.id});return U(`li`,{class:`path-item`,style:`--off:${r}`},n===`current`?U(`div`,{class:`bubble`,"aria-hidden":`true`,onclick:()=>Ur(e),text:t===0&&!q.done[e.id]&&q.xp===0?`从这里开始`:`开始`}):null,i,U(`div`,{class:`node-label`,text:e.title}))})))});Q.replaceChildren(ar(`full`),Br(),U(`main`,{class:`view pathview`},fr?U(`p`,{class:`notice`,role:`status`,text:fr}):null,di(),hr?.accountRow(),e),Vr(`path`)),fr=null,Hr()}function Hr(){let e=Q.querySelector(`.pathview`),t=e?.querySelector(`.node.current`);if(!t)return;let n=[t,t.parentElement?.querySelector(`.bubble`),t.parentElement?.querySelector(`.node-label`)].filter(Boolean),r=e.getBoundingClientRect(),i=e.querySelector(`.practice-entry-wrap`),a=i?Math.max(r.top,i.getBoundingClientRect().bottom):r.top,o=Math.min(...n.map(e=>e.getBoundingClientRect().top)),s=Math.max(...n.map(e=>e.getBoundingClientRect().bottom)),c=r.bottom-a,l=s-o,u=l>=c?a+4:a+(c-l)/2;e.scrollTop+=o-u}function Ur(e){let t=Cr(e);Pr(n=>[U(`div`,{class:`lsheet`},U(`div`,{class:`lsheet-concept`,text:e.concept}),U(`h2`,{text:e.title}),U(`p`,{text:t===`locked`?`先完成前面的关卡，这一关才会解锁。`:e.story}),t===`locked`?W(`知道了`,n,`btn3d wide`):t===`done`?[W(`复习（不扣红心，完成后 +1 红心）`,()=>{n(),Qr(e,{review:!0})},`btn3d primary wide`),W(`关闭`,n,`btn3d ghost wide`)]:[W(`开始 +${e.exercises.length*qn+Yn} XP`,()=>{n(),Qr(e)},`btn3d primary wide`),W(`关闭`,n,`btn3d ghost wide`)])])}function Wr(e){let t=N(q),n=xr().filter(e=>q.done[e.id]),r=n[n.length-1]||e;Pr(e=>[U(`div`,{class:`lsheet`},cr(72,`companion`),U(`h2`,{text:`红心用完了`}),U(`p`,{text:`每 30 分钟恢复 1 颗，下一颗还要 ${Lr(t)}。也可以做一关复习：复习不扣红心，完成后恢复 1 颗。`}),W(`复习「${r.title}」`,()=>{e(),Qr(r,{review:!0})},`btn3d primary wide`),W(`稍后再来`,e,`btn3d ghost wide`))])}function Gr(e,t,n,{disabled:r=!1}={}){let i=!!q.prefs[n]&&!r,a=U(`button`,{type:`button`,class:`switch`+(i?` on`:``),role:`switch`,"aria-checked":String(i),"aria-label":e,"data-pref":n,disabled:r||null},U(`span`,{class:`knob`}));return a.addEventListener(`click`,()=>{a.disabled||(q.prefs[n]=!q.prefs[n],nn(q.prefs),X(),a.classList.toggle(`on`,q.prefs[n]),a.setAttribute(`aria-checked`,String(q.prefs[n])),n===`sound`&&q.prefs.sound&&H(`select`),n===`haptics`&&q.prefs.haptics&&_n())}),U(`div`,{class:`toggle-row`},U(`div`,{},U(`b`,{text:e}),U(`small`,{text:t})),a)}function Kr(){let e=U(`pre`,{class:`diag`,"aria-label":`诊断信息`}),t=(t=``)=>{let n=vn();e.textContent=[`应用版本：2026-11-04 22:32 UTC（测试入口 rc1）`,`缓存版本：${Z.caches.length?Z.caches.join(`、`).replace(/suipian-/g,``).slice(0,40):`无`}`,`离线支持：${Z.status}`,`网络：${navigator.onLine===!1?`离线`:`在线`}`,`运行方式：${Qn?`主屏幕 App`:`浏览器`}`,`音效开关：${n.soundPref?`开`:`关`}`,`AudioContext：${n.audioState}${n.sampleRate?`（${n.sampleRate} Hz）`:``}`,`音频会话：${n.audioSession}`,`已播放 ${n.played} 次，被丢弃 ${n.dropped} 次，解锁尝试 ${n.unlocks} 次`,`状态变化：${n.history||`无`}`,`网页振动接口：${n.vibrate?`有`:`没有`}`,`最近错误：${n.lastError||`无`}`,t].filter(Boolean).join(`
`)};return t(),xi().then(()=>{e.isConnected&&t()}),U(`div`,{class:`selftest`},U(`div`,{class:`selftest-btns`},W(`试听音效`,()=>{gn().then(e=>t(e?`试听：已播放答对音（听不到就看上面的状态）`:`试听：没有播放成功`)),t(`试听：请求中…`)},`btn3d wide`,{"data-selftest":`sound`}),tn()?W(`试振动`,()=>{let e=`没有网页振动接口，这个按钮不会振动`;if(tn())try{e=navigator.vibrate(12)?`已请求 12ms 振动`:`振动请求被浏览器拒绝`}catch{e=`振动请求出错`}t(`试振动：`+e)},`btn3d wide`,{"data-selftest":`haptic`}):null),U(`div`,{class:`soundrow`,role:`group`,"aria-label":`正式音效试听`},...[[`select`,`点选`],[`place`,`放入`],[`undo`,`撤销`],[`correct`,`答对`],[`wrong`,`答错`],[`finish`,`过关`]].map(([e,n])=>W(n,()=>{H(e,{force:!0}).then(e=>t(`正式音效「${n}」：${e?`已播放`:`没有播放成功`}`))},`chip`,{"data-sound":e}))),e)}function qr(){let e=[],t=U(`pre`,{class:`diag`,"aria-label":`音频测试结果`}),n=()=>{try{return navigator.audioSession?navigator.audioSession.type:`（浏览器没有 audioSession）`}catch{return`（读取失败）`}},r=(navigator.userAgent.match(/(Version|CriOS|Chrome|OS) ?\/?[\d._]+/g)||[]).slice(0,2).join(` `),i=()=>{t.textContent=[`运行方式：${Qn?`主屏幕 App`:`Safari / 浏览器`}`,`系统：${r||`未知`}`,`音频会话：${n()}`,`—`,...e].join(`
`)},a=t=>{e.push(t),e.length>14&&e.shift(),i()},o=new URL(`sfx/test-beep.wav`,document.baseURI).href,s=new Audio;s.preload=`auto`,s.addEventListener(`canplaythrough`,()=>a(`[文件] 加载成功（${Number.isFinite(s.duration)?s.duration.toFixed(2):`?`} 秒）`)),s.addEventListener(`error`,()=>a(`[文件] 加载失败（code ${s.error?.code}：${s.error?.message||`无信息`}）`)),s.src=o;try{s.load()}catch(e){a(`[文件] load() 出错：${e.message}`)}fetch(o).then(e=>e.arrayBuffer().then(t=>a(`[文件] 网络读取 ${e.status}，${t.byteLength} 字节`))).catch(e=>a(`[文件] 网络读取失败：${e.message}`)),i();let c=(e,t)=>()=>{try{let n=``;try{navigator.audioSession&&(navigator.audioSession.type=e,n=`，audioSession 设为 ${e}`)}catch(e){n=`，audioSession 设置失败：${e.message}`}let r=window.AudioContext||window.webkitAudioContext;if(!r){a(`[${t}] 浏览器没有 AudioContext`);return}let i=new r,o=i.state;i.resume();let s=i.createOscillator(),c=i.createGain();s.type=`sine`,s.frequency.value=880,c.gain.setValueAtTime(1e-4,i.currentTime),c.gain.exponentialRampToValueAtTime(.6,i.currentTime+.01),c.gain.exponentialRampToValueAtTime(1e-4,i.currentTime+.3),s.connect(c),c.connect(i.destination),s.start(),s.stop(i.currentTime+.35),a(`[${t}] 点击内已发出声音指令；创建时 state=${o}${n}`),setTimeout(()=>a(`[${t}] 0.4 秒后 state=${i.state}，currentTime=${i.currentTime.toFixed(3)}（大于 0 说明音频时钟在走）`),400)}catch(e){a(`[${t}] 出错：${e.name}：${e.message}`)}};return U(`div`,{class:`selftest audiolab`},U(`h3`,{text:`音频兼容性测试`}),U(`p`,{class:`muted small`,text:`排查 iPhone 无声：每个按钮都在点击里直接发声。请先关掉静音键，把音量调到一半，三个都点一遍，告诉我哪个能响，并截图下面的结果。`}),U(`button`,{type:`button`,class:`btn3d wide`,"data-audiotest":`webaudio`,onclick:c(`ambient`,`A`)},`测试 A：Web Audio 提示音`),U(`button`,{type:`button`,class:`btn3d wide`,"data-audiotest":`file`,onclick:()=>{try{a(`[B] 点击：readyState=${s.readyState}，networkState=${s.networkState}，error=${s.error?s.error.code:`无`}`),s.pause(),s.currentTime=0;let e=s.play();e&&e.then?e.then(()=>a(`[B] audio.play() 成功`)).catch(e=>a(`[B] audio.play() 失败：${e.name}：${e.message}`)):a(`[B] audio.play() 已调用（浏览器没有返回 Promise）`)}catch(e){a(`[B] play() 抛出：${e.name}：${e.message}`)}}},`测试 B：本地 WAV 文件（<audio>）`),U(`button`,{type:`button`,class:`btn3d wide`,"data-audiotest":`playback`,onclick:c(`playback`,`C`)},`测试 C：Web Audio + 播放模式`),t)}function Jr(){let e=U(`pre`,{class:`diag`,"aria-label":`振动测试结果`},`每个都点几下，凭手感告诉我哪几个有轻微触感。`),t={},n=n=>()=>{t[n]=(t[n]||0)+1;let r=``;if(tn())try{r=navigator.vibrate(12)?`；已请求 navigator.vibrate(12)`:`；vibrate 被拒绝`}catch{r=`；vibrate 出错`}else r=`；没有 navigator.vibrate`;e.textContent=Object.entries(t).map(([e,t])=>`${e}：点了 ${t} 次`).join(`
`)+r+`
（是否真的有触感：等待 iPhone 真机确认）`},r=U(`input`,{type:`checkbox`,switch:!0,"data-haptic":`switch`,"aria-label":`原生开关`});r.addEventListener(`change`,n(`2 原生开关`));let i=U(`input`,{type:`checkbox`,switch:!0,class:`hap-hidden`,"data-haptic":`check-label`,"aria-label":`检查按钮样式`});return i.addEventListener(`change`,n(`4 检查按钮样式`)),U(`div`,{class:`selftest hapticlab`},U(`h3`,{text:`振动测试`}),U(`p`,{class:`muted small`,text:`四种控件各点几下，告诉我哪几个手上有轻微触感（iPhone 的 Safari 没有振动接口，这是在找系统自带的反馈）。`}),U(`button`,{type:`button`,class:`btn3d wide`,"data-haptic":`button`,onclick:n(`1 普通按钮`)},`1 普通按钮`),U(`label`,{class:`hap-row`},U(`span`,{text:`2 原生开关（直接点右边的开关）`}),r),U(`button`,{type:`button`,class:`choice hap-choice`,"data-haptic":`choice`,onclick:n(`3 选项样式`)},`3 选项样式的按钮`),U(`label`,{class:`btn3d primary hap-check`,"data-haptic":`check-box`},`4 检查按钮样式（外观是按钮，里面是隐藏的开关）`,i),e)}function Yr(){let e=U(`p`,{class:`muted small keylab-status`,role:`status`}),t=()=>Rt.some(e=>e.id===q.prefs.soundStyle)?q.prefs.soundStyle:`J`,n=()=>{let n=Rt.find(e=>e.id===t());e.textContent=`当前按键音效：${n.id} ${n.name}${n.id===`J`?`（默认）`:``}`},r=Rt.map(i=>{let a=t()===i.id,o=U(`button`,{type:`button`,class:`keybtn`+(a?` sel`:``),"data-keysound":i.id,"aria-pressed":String(a)},U(`b`,{text:i.id}),U(`span`,{text:i.name+(i.id===`J`?`（默认）`:``)}),U(`small`,{text:i.desc}));return o.addEventListener(`click`,()=>{q.prefs.soundStyle=i.id,nn(q.prefs),X();let t=fn(i.id,`select`);r.forEach(e=>{let t=e===o;e.classList.toggle(`sel`,t),e.setAttribute(`aria-pressed`,String(t))}),n(),t.ok?q.prefs.sound||(e.textContent+=`（上面的“音效”开关是关的，答题时不会响）`):e.textContent+=`（这次没有发出声音：`+(t.state||`音频环境不可用`)+`）`}),o});return n(),U(`div`,{class:`keylab`},U(`h3`,{text:`按键音效`}),U(`p`,{class:`muted small`,text:`十个原创的矮轴键盘风格，默认 J。点一下试听并选用，答题时的点选、放入、撤销、答对、答错、过关都用同一个风格。`}),U(`div`,{class:`keygrid`},r),e)}function Xr(){let e=!!Y?.account(),t=U(`p`,{class:`backup-msg small muted`,role:`status`,"data-backup-msg":``}),n=U(`div`,{class:`backup-panel`}),r=(e,n=!1)=>{t.textContent=e,t.classList.toggle(`bad`,n)},i=()=>Y?.account()?(n.replaceChildren(),r(`已登录账号，不能导入进度文件。要导入请先退出登录，导入后再登录并选“转存到账号”。`,!0),!0):!1,a=()=>{try{let e=kn(q,{build:`2026-11-04T22:32:17.438Z`,unreadable:ge()}),t=new Blob([JSON.stringify(e,null,2)],{type:`application/json`}),n=URL.createObjectURL(t),i=U(`a`,{href:n,download:On(new Date),hidden:``});document.body.appendChild(i),i.click(),i.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e4),r(`已导出。文件在浏览器的下载位置（iPhone：“文件”App → 下载），请自己保管好。`)}catch{r(`导出失败，请换个浏览器再试。`,!0)}},o=U(`input`,{type:`file`,accept:`application/json,.json`,hidden:``,"data-import-file":``});return o.addEventListener(`change`,async()=>{let e=o.files&&o.files[0];if(o.value=``,n.replaceChildren(),!e||i())return;let t=``;try{t=await e.text()}catch{r(`读取文件失败。`,!0);return}let a=An(t);if(!a.ok){r(a.error,!0);return}let s=Mn(a.state);r(``),n.replaceChildren(U(`div`,{class:`confirm`,role:`alertdialog`,"data-import-confirm":``},U(`p`,{text:`文件里有：${s.lessons} 个已完成关卡，${s.xp} XP，连续 ${s.streak} 天${a.exportedAt?`（导出于 ${a.exportedAt.slice(0,10)}）`:``}。导入会把这些合并进当前记录：关卡取并集，XP 取较大的，不会让你现有的进度变少。`}),W(`确认导入`,()=>{i()||(q=jn(q,a.state),X(),Zr(),Ir(`进度已导入。`))},`btn3d primary`),W(`取消`,()=>{n.replaceChildren()},`btn`)))}),U(`section`,{class:`backup`,"data-backup":``},U(`h3`,{text:`备份学习记录`}),U(`p`,{class:`small muted`,text:e?`导出本机学习记录，云端状态以上方为准。已登录时不能导入（要导入请先退出登录）。`:`记录只在这台设备上。导出一份文件自己留着，换手机或清了浏览器数据后可以导回来。`}),U(`div`,{class:`acct-row`},W(`导出进度文件`,a,`btn3d`,{"data-export":``}),e?null:W(`导入进度文件`,()=>o.click(),`btn3d`,{"data-import":``})),o,n,t)}function Zr(){J=`me`,wr=null;let e=yr(`me`),t=null,n=W(`清除学习记录`,()=>{t||(t=U(`div`,{class:`confirm`,role:`alertdialog`},U(`p`,{text:`确定要清除这台设备上的全部学习记录吗？XP、连续天数和关卡进度都会清空。`}),W(`确定清除`,()=>{let e=q.prefs;q=ye(),q.prefs=e,q.onboarded=!0,X(),Zr(),Ir(`学习记录已清除。`)},`btn danger`),W(`取消`,()=>{t.remove(),t=null},`btn`)),n.after(t))},`link small`),r=N(q),i=xr().filter(e=>q.done[e.id]).length,a=(e,t,n)=>U(`div`,{class:`me-card`},U(`b`,{},e?K(e,{size:20}):null,t),U(`span`,{text:n}));Q.replaceChildren(Br(),U(`main`,{class:`view me`},e?U(`p`,{class:`notice`,role:`status`,"data-replaced-notice":``,text:e}):null,U(`div`,{class:`me-head`},cr(64),U(`div`,{},U(`h1`,{text:`我的学习`}),U(`p`,{class:`muted`,text:Y?.account()?`记录已关联账号，会同步到云端`:`没登录时，记录只保存在这台设备上`}))),U(`div`,{class:`me-grid`},a(`flame`,String(P(q)),`连续天数`),a(`bolt`,String(q.xp),`经验值 XP`),a(null,`${i}/${xr().length}`,`已完成关卡`),a(`heart`,`${q.hearts}/5`,r?`${Lr(r)}后 +1`:`红心已满`)),hr?.accountCard(),Xr(),U(`h3`,{text:`声音与振动`}),Gr(`音效`,`点选、答对、答错、过关的短提示音；跟随手机静音键`,`sound`),tn()?Gr(`振动`,`点“检查”和结算页“继续”时请求一次短振；有没有振动取决于你的手机和浏览器，下面可以自测`,`haptics`):U(`div`,{class:`toggle-row no-haptics`,"data-no-haptics":``},U(`div`,{},U(`b`,{text:`振动`}),U(`small`,{text:`此设备暂不支持网页触感反馈。`}))),Yr(),Kr(),qr(),tn()||/[?&]haptic-lab\b/.test(location.search)?Jr():null,U(`h3`,{text:`规则`}),U(`ul`,{class:`rules`},U(`li`,{text:`答对一题 +${qn} XP，完成一关再 +${Yn} XP；复习每题 +${Jn} XP。`}),U(`li`,{text:`答错扣 1 颗红心，这道题会放到本关最后再做一次。`}),U(`li`,{text:`红心每 30 分钟恢复 1 颗；复习关不扣红心，完成后恢复 1 颗。`}),U(`li`,{text:`每天完成至少一关，连续天数 +1；断一天就从头算。`})),U(`h3`,{text:`添加到主屏幕`}),U(`p`,{text:`iPhone：用 Safari 打开 → 分享按钮 → 「添加到主屏幕」。从主屏幕打开是全屏的，记录也和 Safari 分开保存。`}),Y?.account()?null:n),Vr(`me`))}function Qr(e,{review:t=!1}={}){if(J=`lesson`,vr=null,N(q),!t&&q.hearts<=0)return Wr(e);let n={lesson:e,review:t,queue:e.exercises.map((e,t)=>t),total:e.exercises.length,correct:0,xp:0,wrongOnce:new Set,mistakes:0};wr=n,ti(n)}function $r(e){let t=Math.round(e.correct/e.total*100);return U(`header`,{class:`lessonbar`},W(K(`close`,{size:24}),()=>ei(e),`icon-btn ghost`,{"aria-label":`退出本关`}),U(`div`,{class:`progress`,role:`progressbar`,"aria-valuenow":String(t),"aria-valuemin":`0`,"aria-valuemax":`100`},U(`div`,{class:`progress-fill`,style:`width:${Math.max(4,t)}%`})),e.review?U(`span`,{class:`stat shield`,title:`复习不扣红心`},K(`shield`,{size:22})):zr())}function ei(e){Pr(e=>[U(`div`,{class:`lsheet`},U(`h2`,{text:`要退出这一关吗？`}),U(`p`,{text:`退出后，本关答题位置不会保存，下次从第 1 题重新开始。已得的 XP 和已扣的红心会保留。`}),W(`继续学习`,e,`btn3d primary wide`),W(`退出`,()=>{e(),$()},`btn3d danger-ghost wide`))])}function ti(e){let t=e.lesson;Q.replaceChildren(ar(`full`),$r(e),U(`main`,{class:`lesson`},U(`div`,{class:`intro-screen`},ur(t.introCode,`phone`)),U(`div`,{class:`intro-panel`},U(`div`,{class:`intro-concept`,text:(e.review?`复习 · `:``)+t.concept}),U(`h1`,{class:`intro-title`,text:t.title}),U(`p`,{class:`intro-story`,text:t.story}))),U(`footer`,{class:`lessonfoot`},U(`span`,{class:`mascot-slot`},cr(56)),W(`继续`,()=>ri(e),`btn3d primary grow`)))}var ni=null;function ri(e){if(ni?.destroy?.(),ni=null,e.queue.length===0)return ci(e);let t=e.queue[0],n=e.lesson.exercises[t];window.__app.currentEx=n,window.__app.renders=(window.__app.renders||0)+1;let r=!1,i=!1,a=jt(n),o=a?null:U(`details`,{class:`outpanel`},U(`summary`,{text:`运行结果`}),U(`pre`,{class:`out`,text:``})),s=W(`检查`,()=>d(),`btn3d primary grow`,{"data-check":``});s.disabled=!0;let c=()=>{i||(s.disabled=!l.ready())},l=a?It(n,{exec:Or,runner:Dr,onChange:c,ui:{sheet:Pr,button:W},pythonUnavailable:()=>typeof Ar==`function`?Ar():void 0}):n.type===`predict`?ai(n,c):n.type===`fill`?oi(n,c):si(n,c);ni=a?l:null,window.__app.currentArea=l;let u=W(cr(56,`think`),()=>{if(l.openHint)return l.openHint();let e=r||!n.hint?ii(n):n.hint,t=r||!n.hint?`答案是：`:`小码提示：`;r=!0,Pr(n=>[U(`div`,{class:`lsheet hint`},U(`div`,{class:`hint-row`},cr(48,`think`),U(`b`,{text:t})),U(`pre`,{class:`hint-text`,text:e}),W(`好的`,n,`btn3d primary wide`))])},`mascot-btn`,{"aria-label":`让小码给个提示`});Q.replaceChildren(ar(`edge`),$r(e),U(`main`,{class:`lesson`},n.tip?U(`p`,{class:`tip-line`},U(`b`,{text:`提示 `}),n.tip):null,U(`h2`,{class:`q`,text:n.prompt}),l.node,o),U(`footer`,{class:`lessonfoot`},u,s),...l.after?[l.after]:[]);function d(){if(!(i||s.disabled)){if(a)return p();m(l.isCorrect(),!1)}}let f=!1;async function p(){if(f)return;f=!0,s.disabled=!0,s.textContent=`检查中…`,_n();let e;try{e=await l.check()}finally{f=!1}s.isConnected&&!i&&(e.attempt&&e.settle?m(e.status===`pass`,!0):(s.textContent=`检查`,s.disabled=!l.ready()))}function m(r,c){i=!0,s.disabled=!0,s.textContent=`检查中`,l.lock(),c||_n(),l.settled?.(r);let u=en();if(r){e.correct++;let t=e.review?Jn:qn;e.xp+=t,q.xp+=t,X()}else e.mistakes++,e.review||(be(q),X()),e.queue.push(t);e.queue.shift();let d=r?l.why():l.whyWrong(),f=!r&&!e.review&&q.hearts<=0;a||jr(o,n.type===`predict`?n.code:l.code());let p=!1,m=W(f?`红心用完了`:`继续`,()=>{p||(p=!0,f?($(),Wr(e.lesson)):ri(e))},`btn3d `+(r?`primary`:`danger`)+` wide`,{"data-continue":``});m.disabled=!0;let h=U(`div`,{class:`feedbar `+(r?`ok`:`bad`),role:`status`},U(`div`,{class:`fb-head`},K(r?`check`:`cross`,{size:26,cls:`fb-ico`}),U(`b`,{text:r?`答对了！`:`不对哦`}),r?U(`span`,{class:`fb-xp`,text:`+${e.review?Jn:qn} XP`}):null),d?U(`p`,{text:d}):null,!r&&!a?U(`p`,{class:`fb-answer`},`正确答案：`,U(`code`,{text:ii(n)})):null,!r&&!e.review?U(`p`,{class:`fb-heart`},K(`heart`,{size:16}),`红心 -1（剩 ${q.hearts} 颗）。这道题稍后再做一次。`):null,m);setTimeout(()=>{s.isConnected&&(l.mark(),H(r?`correct`:`wrong`),Q.querySelector(`.lessonfoot`).replaceWith(h),l.afterFeedback?.(),setTimeout(()=>{h.isConnected&&(Q.querySelector(`.lessonbar`).replaceWith($r(e)),!r&&!e.review&&Q.querySelector(`.lessonbar .hearts`)?.classList.add(`lost`))},u?0:120),setTimeout(()=>{h.isConnected&&(m.disabled=!1)},u?0:160))},Xn)}}function ii(e){if(e.type===`predict`)return e.options.find(e=>e.correct).text;if(e.type===`fill`){let t=e.code;return e.answer.forEach((e,n)=>t=t.replace(`{${n}}`,e)),t}return e.answers[0].map(t=>e.lines[t]).join(`
`)}function ai(e,t){let n=null,r=!1,i=U(`div`,{class:`choices`},e.options.map((e,a)=>W(U(`pre`,{text:e.text}),()=>{r||(n=a,H(`select`),i.querySelectorAll(`.choice`).forEach((e,t)=>e.classList.toggle(`sel`,t===a)),t())},`choice`,{"aria-label":`选项：${e.text.replace(/\n/g,` 换行 `)}`})));return{node:U(`div`,{},ur(e.code),i),ready:()=>n!==null,lock:()=>{r=!0},mark:()=>{i.querySelectorAll(`.choice`).forEach((t,r)=>{e.options[r].correct?t.classList.add(`right`):r===n&&t.classList.add(`wrong`)})},isCorrect:()=>!!e.options[n].correct,why:()=>e.options[n].why,whyWrong:()=>e.options[n].why,code:()=>e.code}}function oi(e,t){let n=(e.code.match(/\{\d+\}/g)||[]).length,r=e.initial?[...e.initial]:Array(n).fill(null),i=Math.max(0,r.findIndex(t=>t===null||e.initial&&t===e.initial[0])),a=!1,o=!1,s=U(`div`,{class:`codeblock fill`}),c=U(`div`,{class:`bank`}),l=()=>{s.replaceChildren(...e.code.split(`
`).map((t,n)=>{let s=t.split(/(\{\d+\})/);return U(`div`,{class:`cl`},U(`span`,{class:`ln`,text:String(n+1)}),U(`span`,{class:`lc`},s.flatMap(t=>{let n=/^\{(\d+)\}$/.exec(t);if(!n)return lr(t);let s=Number(n[1]),c=o&&r[s]!==e.answer[s];return W(r[s]??``,()=>{a||(i=s,H(`select`),l())},`slot`+(r[s]?` filled`:``)+(s===i&&!a?` active`:``)+(o?c?` wrong`:` right`:``),{"aria-label":`空格 ${s+1}：${r[s]||`空`}`,"data-slot":String(s)})})))})),c.replaceChildren(U(`div`,{class:`bank-ctrl`},W(`⌫`,()=>{a||(r[i]=null,H(`undo`),l(),t())},`kchip ctrl`,{"aria-label":`清空当前空格`}),W(`‹`,()=>{a||(i=Math.max(0,i-1),H(`select`),l())},`kchip ctrl`,{"aria-label":`上一个空格`}),W(`›`,()=>{a||(i=Math.min(n-1,i+1),H(`select`),l())},`kchip ctrl`,{"aria-label":`下一个空格`})),U(`div`,{class:`bank-tokens`},e.tokens.map(e=>W(e,()=>{if(a)return;r[i]=e,H(`place`);let n=r.findIndex(e=>e===null);n!==-1&&(i=n),l(),t()},`kchip tok`,{"data-token":e}))))};l();let u=W(`↺ 重新开始`,()=>{a||(r=e.initial?[...e.initial]:Array(n).fill(null),i=0,H(`undo`),l(),t())},`link small reset`),d=()=>{let t=e.code;return r.forEach((e,n)=>t=t.replace(`{${n}}`,e??``)),t},f=()=>r.find((t,n)=>t!==e.answer[n]);return{node:U(`div`,{},s,c,u),ready:()=>r.every(e=>e!==null)&&!(e.initial&&r.every((t,n)=>t===e.initial[n])),lock:()=>{a=!0,l()},mark:()=>{o=!0,l()},isCorrect:()=>r.every((t,n)=>t===e.answer[n]),why:()=>``,whyWrong:()=>e.why?.[f()]||`这样运行出来的结果和要求不一样，看看下面的运行结果。`,code:d}}function si(e,t){let n=[],r=!1,i=U(`div`,{class:`order-mine`,"aria-label":`你的程序`}),a=U(`div`,{class:`order-bank`}),o=()=>{i.replaceChildren(...n.length?n.map((i,a)=>W(U(`span`,{},U(`span`,{class:`ln`,text:String(a+1)}),lr(e.lines[i])),()=>{r||(n.splice(a,1),H(`undo`),o(),t())},`line-chip in`,{"data-line":String(i)})):[U(`p`,{class:`muted order-empty`,text:`点下面的代码行，按顺序放到这里`})]),a.replaceChildren(...e.shuffled.filter(e=>!n.includes(e)).map(i=>W(U(`span`,{},lr(e.lines[i])),()=>{r||(n.push(i),H(`place`),o(),t())},`line-chip`,{"data-line":String(i)})))};o();let s=W(`↺ 重新开始`,()=>{r||(n=[],H(`undo`),o(),t())},`link small reset`),c=()=>n.map(t=>e.lines[t]).join(`
`),l=e.answers.map(t=>t.map(t=>e.lines[t]).join(`
`));return{node:U(`div`,{},U(`div`,{class:`order-label`,text:`你的程序`}),i,U(`div`,{class:`order-label`,text:`代码行`}),a,s),ready:()=>n.length===e.lines.length,lock:()=>{r=!0},mark:()=>{i.classList.add(l.includes(c())?`right`:`wrong`)},isCorrect:()=>l.includes(c()),why:()=>``,whyWrong:()=>`顺序不对。程序从上往下一行一行执行：变量要先存好值，才能拿来用；想先显示的，就放在前面。`,code:c}}function ci(e){let t=e.lesson,n=!q.done[t.id];q.done[t.id]=!0,q.lessonsCompleted++;let r=e.review?0:Yn;e.xp+=r,q.xp+=r;let i=Ce(q),a=null;e.review&&(N(q),q.hearts<5&&(q.hearts++,a=`复习奖励：恢复 1 颗红心（现在 ${q.hearts} 颗）`)),X(),wr=null,H(`finish`);let o=Math.round(e.total/(e.total+e.mistakes)*100);Q.replaceChildren(U(`main`,{class:`finish`},cr(120,`celebrate`),U(`h1`,{text:e.mistakes===0?`完美！`:`完成！`}),U(`p`,{class:`muted`,text:n?`「${t.title}」通关`:`复习「${t.title}」完成`}),U(`div`,{class:`finish-stats`},U(`div`,{class:`fs`},U(`small`,{text:`本关 XP`}),U(`b`,{},K(`bolt`,{size:20}),`+${e.xp}`)),U(`div`,{class:`fs`},U(`small`,{text:`正确率`}),U(`b`,{text:`${o}%`})),U(`div`,{class:`fs`},U(`small`,{text:`连续天数`}),U(`b`,{},K(`flame`,{size:20}),String(P(q))))),i?U(`p`,{class:`streak-msg`,text:P(q)>1?`连续学习 ${P(q)} 天，保持住！`:`今天的学习完成了，明天再来续上连续天数！`}):null,a?U(`p`,{class:`heart-msg`,text:a}):null,W(`继续`,()=>{_n(),$()},`btn3d primary wide`,{"data-continue":``})))}var li=null,ui=()=>d.units.filter(e=>e.available).map(e=>({id:e.id,title:e.title,lessons:Kn[e.id].lessons}));function di(){let e=Fn(ui(),q.done).length>0,t=W(U(`span`,{class:`practice-entry-text`},U(`b`,{text:`随机练习`}),U(`small`,{text:`无奖励，自由练习`})),()=>fi(),`btn3d practice-entry wide`,{"data-practice-entry":``});return t.disabled=!e,U(`div`,{class:`practice-entry-wrap`},t,e?null:U(`p`,{class:`muted small practice-empty`,"data-practice-empty":``,text:`完成第一关后可开始刷题`}))}function fi(e){J=`practice`,vr=null,wr=null,li=null;let t=Fn(ui(),q.done);if(!t.length){Q.replaceChildren(ar(`full`),Br(),U(`main`,{class:`view practice-setup`},cr(96,`companion`),U(`h1`,{text:`还不能刷题哦`}),U(`p`,{"data-practice-empty":``,text:`随机练习只用你已经通关的关卡出题。完成第一关后可开始刷题，先去闯一关吧！`}),W(`回到地图`,$,`btn3d primary wide`)),Vr(`path`));return}let n=new Set(e?.selected||t.flatMap(e=>e.lessons.map(e=>e.id))),r=e?.size||10,i=U(`p`,{class:`practice-info`,role:`status`,"data-practice-info":``}),a=W(`开始练习`,()=>{let e=In(ui(),q.done,n);e.length&&pi(e,r,{selected:[...n],size:r})},`btn3d primary wide`,{"data-practice-start":``}),o=U(`div`,{class:`practice-units`}),s=U(`div`,{class:`practice-sizes`,role:`group`,"aria-label":`每轮题数`}),c=()=>{let e=In(ui(),q.done,n).length,l=Math.min(r,e);a.disabled=e===0,i.textContent=e===0?`请至少选一个关卡。`:l<r?`已选范围只有 ${e} 道题，不够 ${r} 道，本轮用全部 ${l} 道。`:`本轮 ${l} 道题（已选范围共 ${e} 道）。`,o.replaceChildren(...t.map(e=>{let t=e.lessons.map(e=>e.id),r=t.every(e=>n.has(e)),i=t.some(e=>n.has(e));return U(`div`,{class:`practice-unit`},W(U(`span`,{},U(`b`,{text:e.title}),U(`small`,{text:`已通关 ${t.length} 关`})),()=>{r?t.forEach(e=>n.delete(e)):t.forEach(e=>n.add(e)),H(`select`),c()},`pchip unit-chip`+(r?` sel`:i?` part`:``),{"aria-pressed":String(r),"data-practice-unit":e.id}),U(`div`,{class:`practice-lessons`},e.lessons.map(e=>W(e.title,()=>{n.has(e.id)?n.delete(e.id):n.add(e.id),H(`select`),c()},`pchip`+(n.has(e.id)?` sel`:``),{"aria-pressed":String(n.has(e.id)),"data-practice-lesson":e.id}))))})),s.replaceChildren(...Nn.map(e=>W(`${e} 题`,()=>{r=e,H(`select`),c()},`pchip size`+(e===r?` sel`:``),{"aria-pressed":String(e===r),"data-practice-size":String(e)})))},l=W(`全部已学`,()=>{t.forEach(e=>e.lessons.forEach(e=>n.add(e.id))),c()},`link small`,{"data-practice-all":``}),u=W(`取消全部`,()=>{n.clear(),c()},`link small`,{"data-practice-none":``});c(),Q.replaceChildren(ar(`full`),Br(),U(`main`,{class:`view practice-setup`},U(`h1`,{text:`随机练习`}),U(`p`,{class:`muted`,text:`无奖励，自由练习：只从已通关的关卡出题，不加 XP、不扣红心、不计连续天数，也不影响解锁。`}),U(`div`,{class:`practice-head`},U(`h3`,{text:`范围`}),U(`span`,{class:`practice-links`},l,u)),o,U(`h3`,{text:`每轮题数`}),s,i,a,W(`回到地图`,$,`btn3d ghost wide`)),Vr(`path`))}function pi(e,t,n){let r=Rn(e,t);li={setup:n,requested:r.requested,total:r.actual,items:r.items.map(e=>({...e,ex:zn(e.ex)})),queue:r.items.map((e,t)=>({i:t,retry:!1})),results:r.items.map(()=>({first:null,retry:null})),answered:0},gi(li)}function mi(e){let t=Math.round(e.answered/Math.max(1,e.total+e.results.filter(e=>e.first===!1).length)*100);return U(`header`,{class:`lessonbar`},W(K(`close`,{size:24}),()=>hi(e),`icon-btn ghost`,{"aria-label":`退出练习`}),U(`div`,{class:`progress`,role:`progressbar`,"aria-valuenow":String(t),"aria-valuemin":`0`,"aria-valuemax":`100`},U(`div`,{class:`progress-fill`,style:`width:${Math.max(4,t)}%`})),U(`span`,{class:`stat practice-tag`,title:`随机练习无奖励`},`练习`))}function hi(e){Pr(t=>[U(`div`,{class:`lsheet`},U(`h2`,{text:`要退出练习吗？`}),U(`p`,{text:`本轮练习位置不保存。随机练习不影响 XP、红心、连续天数和解锁。`}),W(`继续练习`,t,`btn3d primary wide`),W(`退出`,()=>{t(),li===e&&(li=null),$()},`btn3d danger-ghost wide`,{"data-practice-quit":``}))])}function gi(e){if(li!==e)return;if(e.queue.length===0)return vi(e);let{i:t,retry:n}=e.queue[0],r=e.items[t],i=r.ex;window.__app.currentEx=i,window.__app.currentPracticeItem={id:r.id,retry:n};let a=!1,o=U(`details`,{class:`outpanel`},U(`summary`,{text:`运行结果`}),U(`pre`,{class:`out`,text:``})),s=W(`检查`,()=>u(),`btn3d primary grow`,{"data-check":``});s.disabled=!0;let c=()=>{a||(s.disabled=!l.ready())},l=i.type===`predict`?ai(i,c):i.type===`fill`?oi(i,c):si(i,c);Q.replaceChildren(ar(`edge`),mi(e),U(`main`,{class:`lesson`},U(`p`,{class:`tip-line practice-src`},U(`b`,{text:n?`重练 `:`随机练习 `}),_i(r.lessonId)),i.tip?U(`p`,{class:`tip-line`},U(`b`,{text:`提示 `}),i.tip):null,U(`h2`,{class:`q`,text:i.prompt}),l.node,o),U(`footer`,{class:`lessonfoot`},U(`span`,{class:`mascot-slot`},cr(56,`think`)),s));function u(){if(a||s.disabled)return;a=!0,s.disabled=!0,s.textContent=`检查中`,l.lock(),_n();let r=l.isCorrect(),c=en();n?e.results[t].retry=r:e.results[t].first=r,e.answered++,e.queue.shift(),!r&&!n&&e.queue.push({i:t,retry:!0});let u=r?l.why():l.whyWrong();jr(o,i.type===`predict`?i.code:l.code());let d=!1,f=W(`继续`,()=>{d||(d=!0,gi(e))},`btn3d `+(r?`primary`:`danger`)+` wide`,{"data-continue":``});f.disabled=!0;let p=U(`div`,{class:`feedbar `+(r?`ok`:`bad`),role:`status`},U(`div`,{class:`fb-head`},K(r?`check`:`cross`,{size:26,cls:`fb-ico`}),U(`b`,{text:r?`答对了！`:`不对哦`})),u?U(`p`,{text:u}):null,!r&&n?U(`p`,{class:`fb-answer`},`解答：`,U(`code`,{text:ii(i)})):null,!r&&!n?U(`p`,{class:`fb-retry`,text:`这道题会在本轮最后再练一次。`}):null,f);setTimeout(()=>{s.isConnected&&(l.mark(),H(r?`correct`:`wrong`),Q.querySelector(`.lessonfoot`).replaceWith(p),setTimeout(()=>{p.isConnected&&(f.disabled=!1)},c?0:160))},Xn)}}function _i(e){let t=xr().find(t=>t.id===e);return t?t.title:e}function vi(e){let t=e.results.filter(e=>e.first===!0).length,n=e.items.map((t,n)=>({it:t,r:e.results[n]})).filter(e=>e.r.first===!1),r=n.filter(e=>e.r.retry===!0).length;H(`finish`);let i=e.setup;li=null,Q.replaceChildren(U(`main`,{class:`finish practice-finish`},cr(110,n.length?`companion`:`celebrate`),U(`h1`,{text:`练习完成`}),e.total<e.requested?U(`p`,{class:`muted`,text:`题目不够 ${e.requested} 道，本轮用了全部 ${e.total} 道。`}):null,U(`div`,{class:`finish-stats`},U(`div`,{class:`fs`},U(`small`,{text:`首次答对`}),U(`b`,{"data-practice-first":``,text:`${t}/${e.total}`})),U(`div`,{class:`fs`},U(`small`,{text:`重练答对`}),U(`b`,{"data-practice-retry":``,text:`${r}/${n.length}`}))),n.length?U(`div`,{class:`practice-wrong`},U(`h3`,{text:`错题`}),U(`ul`,{},n.map(e=>U(`li`,{},U(`span`,{text:`${_i(e.it.lessonId)}：${e.it.ex.prompt}`}),U(`small`,{text:e.r.retry?`重练答对`:`重练仍错，已看解答`}))))):null,U(`p`,{class:`muted small`,text:`随机练习不加 XP、不扣红心、不计连续天数。`}),W(`再来一轮`,()=>fi(i),`btn3d primary wide`,{"data-practice-again":``}),W(`回到地图`,()=>{_n(),$()},`btn3d ghost wide`,{"data-continue":``})))}var yi=window.visualViewport;if(yi){let e=()=>document.documentElement.style.setProperty(`--app-h`,yi.height+`px`);yi.addEventListener(`resize`,e),e()}document.addEventListener(`visibilitychange`,()=>{document.visibilityState===`visible`&&Q.querySelector(`.statsbar`)&&(N(q),X(),Q.querySelector(`.statsbar`).replaceWith(Br()))}),window.__app={allLessons:xr,startLesson:Qr,sync:Y,accountUi:hr,sheet:Pr,LIMITS:r,pythonUnavailableText:Ar,swInfo:Z,refreshSwInfo:xi,keysounds:()=>Gn(()=>Promise.resolve().then(()=>Lt),void 0,import.meta.url),runner:Dr,getState:()=>q,setState:e=>{q=e,nn(e.prefs)},persist:X,renderPath:$,words:_,feel:Xt,getRun:()=>wr,getPractice:()=>li};var bi=null;async function xi(){if(!(`serviceWorker`in navigator))return Z.status=`此浏览器不支持`,Z;try{Z.caches=typeof caches<`u`?(await caches.keys()).filter(e=>e.startsWith(`suipian-`)):[],Z.status=navigator.serviceWorker.controller?`已启用（断网后可打开地图和课程）`:bi?`正在安装，刷新一次后生效`:`未启用`}catch{Z.status=`读取失败`}return Z}if(`serviceWorker`in navigator){let e=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener(`controllerchange`,()=>{e&&Ir(`已更新到新版本，刷新页面后使用最新内容。`),xi()});let t=()=>navigator.serviceWorker.register(`./sw.js`).then(e=>{bi=e,xi()}).catch(e=>{Z.status=`注册失败：`+(e?.message||e)});document.readyState===`complete`?t():window.addEventListener(`load`,t),document.addEventListener(`visibilitychange`,()=>{document.visibilityState===`visible`&&bi?.update().catch(()=>{})})}window.addEventListener(`online`,()=>{Dr.state===`loadError`&&Dr.boot(),bi?.update().catch(()=>{})}),q.onboarded?$():Rr();try{Dr.boot()}catch{}