import{a as e,c as t,i as n,l as r,n as i,o as a,s as o,t as s,u as c}from"./errors-CoQSdPdD.js";var l=Object.defineProperty,u=(e,t)=>{let n={};for(var r in e)l(n,r,{get:e[r],enumerable:!0});return t||l(n,Symbol.toStringTag,{value:`Module`}),n};{let e=window.localStorage,t=()=>{let t=[];for(let n=0;n<e.length;n++){let r=e.key(n);r&&r.startsWith(`u8:`)&&t.push(r.slice(3))}return t},n={getItem:t=>e.getItem(`u8:`+t),setItem:(t,n)=>e.setItem(`u8:`+t,n),removeItem:t=>e.removeItem(`u8:`+t),clear:()=>t().forEach(t=>e.removeItem(`u8:`+t)),key:e=>t()[e]??null,get length(){return t().length}},r=!1;try{Object.defineProperty(window,"localStorage",{value:n,configurable:!0}),r=window.localStorage===n}catch{}if(!r){let e=`这个浏览器不允许测试入口隔离存储。为了不碰到正式版的学习记录和登录，测试入口已停止运行，请改用正式站。`;try{document.documentElement.innerHTML=`<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font:16px/1.6 sans-serif;padding:24px;background:#10213a;color:#f3ead7"></body>`,document.body.textContent=e}catch{}throw Error(e)}}var d={title:`Python 入门`,units:[{id:`U1`,title:`奶茶店点单屏`,subtitle:`输出、变量和简单运算`,file:`unit1.json`,available:!0},{id:`U2`,title:`文字与长度`,subtitle:`字符串、len`,file:`unit2.json`,available:!0},{id:`U3`,title:`比较与判断`,subtitle:`比较、if/else/elif、and/or/not`,available:!0,file:`unit3.json`},{id:`U4`,title:`循环`,subtitle:`for、range、while、break`,available:!0,file:`unit4.json`},{id:`U5`,title:`列表与序列`,subtitle:`列表、下标、append、切片`,available:!0,file:`unit5.json`},{id:`U6`,title:`类型与报错`,subtitle:`type、int()/str()、读报错`,available:!0,file:`unit6.json`},{id:`U7`,title:`字典`,subtitle:`dict：按名字存取`,available:!0,file:`unit7.json`},{id:`U8`,title:`函数`,subtitle:`def、参数、return`,available:!0,file:`unit8.json`},{id:`U9`,title:`毕业小项目`,subtitle:`把学过的拼成一个小系统`,available:!1}]},f={id:`U1`,title:`奶茶店点单屏`,subtitle:`输出、变量和简单运算`,lessons:[{id:`U1L1`,title:`让屏幕说话`,concept:`print 输出`,story:`街角的奶茶店想要一块点单屏。第一步：让屏幕显示文字。`,introCode:`print("欢迎光临！")`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print("欢迎光临！")`,options:[{text:`欢迎光临！`,correct:!0,why:`print(...) 会把括号里的内容显示到屏幕上。`},{text:`"欢迎光临！"`,correct:!1,why:`引号只是告诉 Python「这是一段文字」，引号本身不会显示。`},{text:`print("欢迎光临！")`,correct:!1,why:`print、括号和引号是写给 Python 看的，屏幕上只显示引号里的文字。`}],tip:`print(...) 会把括号里的内容显示到屏幕上。文字要放在英文引号 " " 里。`},{type:`fill`,prompt:`屏幕要显示：今日推荐：珍珠奶茶`,code:`print({0})`,tokens:[`"今日推荐：珍珠奶茶"`,`今日推荐：珍珠奶茶`],answer:[`"今日推荐：珍珠奶茶"`],expected:`今日推荐：珍珠奶茶`,why:{"今日推荐：珍珠奶茶":`文字没加引号，Python 会把它当成代码去执行，程序会出错。`},hint:`文字要放在英文引号里。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`print("营业时间")
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
print('共', len(items), '项')`,why:`没检查就 remove，删不存在的项会报 ValueError`}]}}]}]},_={id:`U6`,title:`类型与报错`,subtitle:`type、int()/str()、读报错`,lessons:[{id:`U6L1`,title:`它是什么类型`,concept:`type() 和四种类型`,story:`点单屏里的值有不同的“种类”：15 是整数（int），15.5 是小数（float），"15" 是文字（str），True 是布尔（bool）。同样长得像 15，加了引号就是文字。type() 能让 Python 说出一个值的种类，结果长这样：<class 'int'>，引号里的 int 就是种类名。`,introCode:`print(type(15))
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
print("total:", total)`}],tip:`更新之后，在同一个循环里。`}]}],heldLessons:[{id:`U6L6`,title:`修好收银程序`,concept:`一处一处修，每次重新读报错`,story:`项目：收银程序有好几处错。price 和 cups 是从点单屏读来的、表示整数的文字，比如 "10" 和 "5"。修的办法：先运行，读最后一行和 line 几；修好一处，再运行，看有没有新的报错；全部不报错了，也要拿几组数据对一对结果，因为有的错不会报错，只会算错。下面三个报错，是按示例的修法逐处修改时可能看到的顺序，你的写法不同，看到的顺序也可能不同。`,introCode:`price = "10"
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
print("应付：" + str(total))`},{text:`第 3 行改成：total = int(price) * cups`,correct:!1,why:`cups 还是文字，整数 × 文字还是类型搭配不对，报错 TypeError。`,fixed:`price = "10"
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
`}}}]}]},v={id:`U7`,title:`字典`,subtitle:`dict：按名字存取`,lessons:[{id:`U7L1`,title:`按名字查库存`,concept:`字典、键和值、stock[键]`,story:`库存按名字记：奶茶 12 杯、果茶 5 杯。列表靠位置找（cups[0]），字典（英文叫 dict）靠名字找：stock = {"奶茶": 12, "果茶": 5}。花括号里是一对一对的“键: 值”：键是名字（"奶茶"），值是对应的数量（12），冒号连着，逗号隔开。取值时在方括号里写键：stock["果茶"] 得到 5，写的是名字，不是第几个。键要和字典里写的一模一样；查一个字典里没有的键，会报 KeyError。`,introCode:`stock = {"奶茶": 12, "果茶": 5}
print(stock["奶茶"])
print(stock["果茶"])`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12, "果茶": 5}
print(stock["果茶"])`,options:[{text:`5`,correct:!0,why:`stock["果茶"] 按键“果茶”查，对应的值是 5。`},{text:`12`,correct:!1,why:`12 是奶茶的数量。方括号里写的是“果茶”，查到的是果茶的值 5。`},{text:`果茶`,correct:!1,why:`方括号里写的是键，查出来的是这个键对应的值（5），不是键本身。`},{text:`1`,correct:!1,why:`字典不按位置找。cups[1] 是列表的写法；字典方括号里写的是键，这里是 "果茶"。`}],tip:`stock[键] 查出这个键对应的值。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12, "果茶": 5}
name = "奶茶"
print(name, stock[name])`,options:[{text:`奶茶 12`,correct:!0,why:`name 里放着文字 "奶茶"，stock[name] 就是 stock["奶茶"]，值是 12；print 用逗号隔开，中间补一个空格。`},{text:`name 12`,correct:!1,why:`name 没有引号，是变量，print 显示的是它里面的文字：奶茶。`},{text:`奶茶 5`,correct:!1,why:`5 是果茶的数量；name 里是“奶茶”，奶茶对应的是 12。`},{text:`奶茶 stock[name]`,correct:!1,why:`stock[name] 没有引号，不是文字，是要 Python 去查的：查出来是 12。`}],tip:`方括号里可以放变量：变量里是什么键，就查什么键。`},{type:`fill`,prompt:`屏幕要显示：8`,code:`stock = {"奶茶": 12, "果茶": 5, "咖啡": 8}
print(stock[{0}])`,tokens:[`"咖啡"`,`咖啡`,`2`,`"果茶"`],answer:[`"咖啡"`],expected:`8`,why:{咖啡:`咖啡没有引号，Python 会把它当成变量名去找，找不到，会报 NameError（用到了没有定义的变量名）。键是文字，要写成 "咖啡"。`,2:`字典不按位置找：stock[2] 是在找一个叫 2 的键，字典里没有，会报 KeyError。咖啡虽然写在第 3 个，也不能用 2 去取。`,'"果茶"':`stock["果茶"] 是 5，不是 8。8 是咖啡的数量。`},hint:`要的是咖啡的数量：方括号里写键 "咖啡"，注意带引号。`},{type:`pick`,prompt:`查库存时出了报错。最后一行 KeyError: '咖啡' 合起来是在说什么？`,key:`type`,code:`stock = {"奶茶": 12, "果茶": 5}
print(stock["咖啡"])`,trace:`Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print(stock["咖啡"])
KeyError: '咖啡'`,checks:[{program:`stock = {"奶茶": 12, "果茶": 5}
print(stock["咖啡"])`,type:`KeyError`,line:2,msg:`'咖啡'`}],options:[{text:`字典里没有叫 '咖啡' 的键`,correct:!0,why:`KeyError 就是“键错误”：用来查的键，字典里没有。这个字典只有 "奶茶" 和 "果茶"，没有 "咖啡"，所以查不到。冒号后面的 '咖啡' 就是那个找不到的键。`,value:`KeyError`},{text:`用到了一个还没有定义的变量名`,correct:!1,why:`那是 NameError：程序里用到了一个从没给过值的变量名。这里的 "咖啡" 带着引号，是文字，不是变量名；最后一行写的是 KeyError。`,value:`NameError`},{text:`列表的下标超出了范围`,correct:!1,why:`那是 IndexError：列表只有 2 个元素，却去取第 3 个（位置超出了范围）。这里是字典，查的是键，不是位置；最后一行写的是 KeyError。`,value:`IndexError`},{text:`文字和整数放在一起用 + 接了`,correct:!1,why:`那是 TypeError：类型搭配不对，比如文字和整数用 + 接在一起。这行代码里没有 +；最后一行写的是 KeyError。`,value:`TypeError`}],tip:`最后一行：冒号前面是错误类型，冒号后面是具体信息——这里就是找不到的那个键。`}]},{id:`U7L2`,title:`改库存`,concept:`给已有的键写新值`,story:`卖掉了东西，库存要改。给已经有的键写新值：stock["果茶"] = 9，字典里果茶的数量就换成 9——是替换旧值，不是加上去。想在旧数量的基础上改，右边先查出旧值再算：stock["奶茶"] = stock["奶茶"] - 1，Python 先算右边（12 - 1 得 11），再把 11 存回奶茶。只写 stock["奶茶"] - 1 不行：这只是算了一下，没有存回去，库存没变。改的是字典本身，改完之后再去查，查到的就是新值。这一关只改字典里已经有的键。`,introCode:`stock = {"奶茶": 12, "果茶": 5}
stock["果茶"] = 9
stock["奶茶"] = stock["奶茶"] - 1
print(stock["奶茶"], stock["果茶"])`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12, "果茶": 5}
stock["果茶"] = 9
print(stock["奶茶"], stock["果茶"])`,options:[{text:`12 9`,correct:!0,why:`第 2 行 stock["果茶"] = 9 把果茶的值换成 9，奶茶没动，还是 12。`},{text:`12 14`,correct:!1,why:`= 是“换成”，不是“加上”：5 被换成了 9，不是 5 + 9。`},{text:`12 5`,correct:!1,why:`第 2 行已经运行过了：果茶的值被换成了 9，print 查到的是改完之后的值。`},{text:`9 5`,correct:!1,why:`改错了名字：第 2 行方括号里写的是 "果茶"，被换成 9 的是果茶；奶茶没动，还是 12。`}],tip:`stock[键] = 新值：把这个键原来的值换成新值。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12, "果茶": 5}
stock["奶茶"] = stock["奶茶"] - 1
print(stock["奶茶"], stock["果茶"])`,options:[{text:`11 5`,correct:!0,why:`第 2 行先算右边：stock["奶茶"] 是 12，12 - 1 得 11，存回奶茶；果茶没动，还是 5。`},{text:`12 5`,correct:!1,why:`第 2 行把算出来的 11 存回了奶茶，所以后面查到的是 11，不是原来的 12。`},{text:`1 5`,correct:!1,why:`右边是 stock["奶茶"] - 1，用的是奶茶原来的数量 12 减 1，得 11，不是 1。`},{text:`11 4`,correct:!1,why:`第 2 行只改了奶茶。果茶这个键没有动，还是 5。`}],tip:`等号右边先算，再把结果存回左边的键。`},{type:`order`,prompt:`排好顺序。屏幕先显示“卖前 12”，再显示卖掉 3 杯之后的“卖后 9”`,lines:[`stock = {"奶茶": 12}`,`print("卖前", stock["奶茶"])`,`stock["奶茶"] = stock["奶茶"] - 3`,`print("卖后", stock["奶茶"])`],shuffled:[2,3,0,1],answers:[[0,1,2,3]],expected:`卖前 12
卖后 9`,hint:`先有字典；改之前先看一次；再改；改完再看一次。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12, "果茶": 5}
stock["果茶"] - 1
print(stock["果茶"])`,options:[{text:`5`,correct:!0,why:`第 2 行 stock["果茶"] - 1 只算出了 4，没有存回字典，随后就丢掉了，不会报错，字典没变。`},{text:`4`,correct:!1,why:`算出了 4，但没有写 stock["果茶"] = …，没有存回去，字典里还是 5。`},{text:`报错`,correct:!1,why:`stock["果茶"] - 1 单独写一行不会报错：Python 算完就丢掉结果，库存不变。`}],tip:`想改库存，要写成 stock[键] = 新值；只做计算，字典不会变。`}]},{id:`U7L3`,title:`先问再取`,concept:`in、.get()、None 和默认值`,story:`查一个字典里没有的键，会报 KeyError，程序就停了。想不让它停，有两个办法。第一个：先问一问。"咖啡" in stock 问的是：咖啡是不是字典里的一个键，答案是 True 或 False（not in 是反过来问）。注意字典的 in 只看键，不看值：12 是奶茶的数量（值），所以 12 in stock 是 False。配合 if：先问有没有，有才取。第二个：stock.get("咖啡")，找到这个键，就和 stock["咖啡"] 一样给出值；没有找到这个键，并且没给默认值时，.get() 返回 None（意思是“没有”），不会报错。还可以在逗号后面写一个默认值：stock.get("咖啡", 0)，没找到就返回 0；找到了，返回的仍然是真实的值，默认值不起作用。注意：.get("咖啡", 0) 只是返回默认值，不会把咖啡加进字典。`,introCode:`stock = {"奶茶": 12, "果茶": 5}
print("咖啡" in stock)
print(stock.get("咖啡"))
print(stock.get("咖啡", 0))`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12, "果茶": 5}
print("奶茶" in stock)
print("咖啡" in stock)
print(12 in stock)`,options:[{text:`True
False
False`,correct:!0,why:`奶茶是字典的键，True；咖啡不是键，False；12 是奶茶的数量（值），不是键，in 只看键，False。`},{text:`True
False
True`,correct:!1,why:`最后一行 12 in stock：in 只看键，不看值。12 是值，不是键，是 False。`},{text:`False
False
False`,correct:!1,why:`第一行 "奶茶" in stock：奶茶是字典里的键，是 True。`}],tip:`字典的 in 问的是：这个名字是不是字典里的键。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12, "果茶": 5}
print(stock.get("果茶"))
print(stock.get("咖啡"))
print(stock.get("咖啡", 0))`,options:[{text:`5
None
0`,correct:!0,why:`果茶有，给出 5；咖啡没有找到，也没给默认值，.get() 返回 None；咖啡没有找到，但写了默认值 0，就返回 0。`},{text:`5
0
0`,correct:!1,why:`第二行没给默认值：没有找到这个键，并且没给默认值时，.get() 返回 None（意思是“没有”），不是 0。`},{text:`5
None
None`,correct:!1,why:`第三行逗号后面的 0 是默认值：查不到咖啡，就用它，显示 0。`},{text:`报错`,correct:!1,why:`.get() 查不到时不报错：没有默认值给 None，有默认值给默认值。只有 stock["咖啡"] 这种写法才会报 KeyError。`}],tip:`没找到这个键、又没给默认值：.get() 返回 None；给了默认值：返回默认值。`},{type:`fill`,prompt:`咖啡还没进货。屏幕要显示：没有这个饮品`,code:`stock = {"奶茶": 12, "果茶": 5}
name = "咖啡"
if {0}:
    print(stock[name])
else:
    print("没有这个饮品")`,tokens:[`name in stock`,`name not in stock`,`stock[name]`],answer:[`name in stock`],expected:`没有这个饮品`,why:{"name not in stock":`咖啡不在字典里，所以 name not in stock 是 True，程序会去取 stock[name]，结果报 KeyError。要的是“有才取”：用 name in stock，咖啡没有就走 else。`,"stock[name]":`计算条件时，stock[name] 已经在查咖啡：键不存在就报 KeyError，if 和 else 两个分支都还没执行。`},hint:`先问“name 在不在 stock 里”：在才取，不在就走 else。`},{type:`pick`,prompt:`咖啡还没进货，字典里没有这个键，下面的程序报了 KeyError。要让屏幕显示 0（而不是报错），第 2 行怎么改？`,key:`fix`,code:`stock = {"奶茶": 12, "果茶": 5}
print(stock["咖啡"])`,trace:`Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print(stock["咖啡"])
KeyError: '咖啡'`,checks:[{program:`stock = {"奶茶": 12, "果茶": 5}
print(stock["咖啡"])`,type:`KeyError`,line:2,msg:`'咖啡'`}],expected:`0`,options:[{text:`改成：print(stock.get("咖啡", 0))`,correct:!0,why:`.get() 查不到咖啡不报错，用默认值 0，屏幕显示 0。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
print(stock.get("咖啡", 0))`},{text:`改成：print(stock.get("咖啡"))`,correct:!1,why:`不报错了，但显示 None：没有找到这个键，并且没给默认值，.get() 返回 None，不是 0。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
print(stock.get("咖啡"))`},{text:`改成：print("咖啡" in stock)`,correct:!1,why:`不报错了，但显示 False：in 问的是“在不在”，答案是 True / False，不是数量。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
print("咖啡" in stock)`},{text:`改成：print(stock.get("果茶", 0))`,correct:!1,why:`显示 5：查的是果茶，果茶有，用的是真实的值；要查的是咖啡。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
print(stock.get("果茶", 0))`}],tip:`没有这个键时想要一个默认值：.get(键, 默认值)。`}]},{id:`U7L4`,title:`进货与下架`,concept:`新增、拼错键名、del`,story:`给字典里没有的键写值，就是新增一对：stock["咖啡"] = 8，字典里多了咖啡。写法和上一关的“替换”一样：键已经有，就是替换；键没有，就是新增，Python 不会报错提醒你。所以给拼错的键名赋值时，也不会报错，而是新增这个拼错的键，原来的键没动。（只是读取一个不存在的键，比如 stock["果查"]，仍然会报 KeyError。）删掉一对：del stock["果茶"]，键和值一起删掉；要删的键必须存在，否则也会报 KeyError。现在可以直接看整个字典了：print(stock) 显示 {'奶茶': 12, '果茶': 5}，每一对是 '键': 值，文字外面是单引号（Python 习惯这样显示，你写的双引号也可以）。新增的键排在最后面。`,introCode:`stock = {"奶茶": 12, "果茶": 5}
stock["咖啡"] = 8
del stock["果茶"]
print(stock)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12, "果茶": 5}
stock["咖啡"] = 8
print(stock)`,options:[{text:`{'奶茶': 12, '果茶': 5, '咖啡': 8}`,correct:!0,why:`咖啡原来没有，给它写值就是新增一对，排在最后面。`},{text:`{'奶茶': 12, '果茶': 5}`,correct:!1,why:`第 2 行已经运行了：给没有的键写值，会把这一对加进去。`},{text:`{'咖啡': 8, '奶茶': 12, '果茶': 5}`,correct:!1,why:`新增的键排在最后面，不是最前面。`},{text:`报错`,correct:!1,why:`给没有的键写值不会报错，是新增。只有“取”一个没有的键，才会报 KeyError。`}],tip:`键没有，写值就是新增；键已经有，写值就是替换。`},{type:`predict`,prompt:`小码想把果茶的库存改成 4，却把“茶”打成了“查”。点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12, "果茶": 5}
stock["果查"] = 4
print(stock["果茶"])
print(stock["果查"])`,options:[{text:`5
4`,correct:!0,why:`第 2 行是给 "果查" 赋值，它原来没有，写值就是新增一对，不会报错；果茶根本没被改，还是 5。第 4 行读的是刚新增的 "果查"，是 4。`},{text:`4
4`,correct:!1,why:`果茶没有被改：第 2 行写的是 "果查"，是另一个键。`},{text:`5
报错`,correct:!1,why:`第 2 行是赋值，不是读取：给没有的键写值会新增这一对，所以第 4 行读 stock["果查"] 时它已经存在，是 4。`}],tip:`给拼错的新键赋值时，会新增这个键；直接读取不存在的键，仍会报 KeyError。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12, "果茶": 5}
del stock["果茶"]
print("果茶" in stock)
print(stock.get("果茶", 0))`,options:[{text:`False
0`,correct:!0,why:`del 把果茶这一对（键和值）一起删了，所以果茶不在字典里（False）；用 .get("果茶", 0) 查，查不到，用默认值 0。`},{text:`True
5`,correct:!1,why:`第 2 行 del stock["果茶"] 已经运行：键和值都被删掉了，不是只删值。`},{text:`False
None`,correct:!1,why:`第二个 print 写了默认值 0：查不到果茶，就用 0，不是 None。`},{text:`报错`,correct:!1,why:`果茶在字典里，del 可以删，不会报错。要删的键不存在才会报 KeyError。`}],tip:`del 字典[键]：键和值一起删掉。`},{type:`order`,prompt:`排好顺序。进货 5 杯果茶：字典里没有果茶时，先记成 0，再加上 5，最后显示：5`,lines:[`stock = {"奶茶": 12}`,`if "果茶" not in stock:`,`    stock["果茶"] = 0`,`stock["果茶"] = stock["果茶"] + 5`,`print(stock["果茶"])`],shuffled:[3,1,4,0,2],answers:[[0,1,2,3,4]],expected:`5`,hint:`先有字典；再检查有没有果茶，没有就记成 0；然后加 5；最后显示。`}]},{id:`U7L5`,title:`一个一个看`,concept:`for name in stock、stock[name]`,story:`要把库存表里每一种饮品都看一遍，用 for 遍历字典：for name in stock: 每一轮，name 依次是字典里的一个键（不是值），按字典里的顺序，新增的排在最后。想要这个键对应的值，再写 stock[name]。所以 name 是文字（饮品名），要加起来的数量是 stock[name]。`,introCode:`stock = {"奶茶": 12, "果茶": 5}
for name in stock:
    print(name, stock[name])`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12, "果茶": 5}
for name in stock:
    print(name)`,options:[{text:`奶茶
果茶`,correct:!0,why:`for name in stock：每一轮 name 是一个键，依次是 "奶茶"、"果茶"，print(name) 把它们显示出来。`},{text:`12
5`,correct:!1,why:`name 是键，不是值。要显示值，要写 print(stock[name])。`},{text:`奶茶 12
果茶 5`,correct:!1,why:`循环里只有 print(name)，只显示键；要连值一起显示，要写 print(name, stock[name])。`}],tip:`for name in 字典：name 依次是每一个键。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`stock = {"奶茶": 12, "果茶": 5}
total = 0
for name in stock:
    total = total + stock[name]
print(total)`,options:[{text:`17`,correct:!0,why:`第一轮 name 是 "奶茶"，stock[name] 是 12，total 变成 12；第二轮 name 是 "果茶"，stock[name] 是 5，total 变成 17。`},{text:`2`,correct:!1,why:`total = total + 1 才是数键的个数；这里每轮加的是 stock[name]，这个键对应的值。`},{text:`5`,correct:!1,why:`total = stock[name] 才会每轮覆盖、只剩最后一个；这里是 total = total + stock[name]，每轮累加。`}],tip:`先 total = 0，每一轮加上这一轮的 stock[name]。`},{type:`fill`,prompt:`库存少于 5 杯算“低库存”（正好 5 杯不算）。屏幕要显示低库存有几种：1`,code:`stock = {"奶茶": 12, "果茶": 5, "咖啡": 3}
low = 0
for name in stock:
    if stock[name] {0} 5:
        low = low + 1
print(low)`,tokens:[`<`,`<=`,`>=`],answer:[`<`],expected:`1`,why:{"<=":`果茶正好 5 杯，5 <= 5 成立，也被数进去了，得 2。正好 5 杯不算低库存，要用 <。`,">=":`数的是库存不少于 5 杯的：奶茶 12 和果茶 5，得 2，不是低库存。`},hint:`低库存是“少于 5 杯”：只有咖啡（3 杯）。边界：正好 5 杯不算。`},{type:`pick`,prompt:`下面的程序想把所有饮品的库存加起来，报了 TypeError。第 4 行怎么改，屏幕才会显示 17？`,key:`fix`,code:`stock = {"奶茶": 12, "果茶": 5}
total = 0
for name in stock:
    total = total + name
print(total)`,trace:`Traceback (most recent call last):
  File "main.py", line 4, in <module>
    total = total + name
TypeError: unsupported operand type(s) for +: 'int' and 'str'`,checks:[{program:`stock = {"奶茶": 12, "果茶": 5}
total = 0
for name in stock:
    total = total + name
print(total)`,type:`TypeError`,line:4,msg:`unsupported operand type(s) for +: 'int' and 'str'`}],expected:`17`,options:[{text:`第 4 行改成：total = total + stock[name]`,correct:!0,why:`name 是键（文字），不能和整数相加；要加的是这个键对应的值，stock[name]：12 + 5 得 17。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
total = 0
for name in stock:
    total = total + stock[name]
print(total)`},{text:`第 4 行改成：total = total + int(name)`,correct:!1,why:`int("奶茶") 转不了：文字的内容不是整数写法，报错 ValueError。要加的是键对应的值，不是把键转成整数。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
total = 0
for name in stock:
    total = total + int(name)
print(total)`},{text:`第 4 行改成：total = total + str(name)`,correct:!1,why:`name 本来就是文字，str(name) 还是文字；整数加文字还是类型搭配不对，报错 TypeError。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
total = 0
for name in stock:
    total = total + str(name)
print(total)`},{text:`第 4 行改成：total = total + len(name)`,correct:!1,why:`不报错了，但显示 4：len(name) 数的是名字有几个字，不是库存数量。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
total = 0
for name in stock:
    total = total + len(name)
print(total)`}],tip:`name 是键（文字）；要加的是这个键对应的值。`}]}],heldLessons:[{id:`U7L6`,title:`库存小程序`,concept:`先问有没有，再问够不够，最后才改`,story:`项目：库存小程序。顾客点了 name（饮品）cups 杯，stock 是库存表。先把规则读清楚：饮品不存在（不在 stock 里），输出“没有这个饮品”，库存不变；库存不足（点的杯数比库存多），输出“库存不足”，库存不变；其余情况，库存减去杯数，输出“成交，剩 N 杯”，正好卖完也算成交；不管哪种情况，最后都用 print(stock) 显示库存表。修的办法：先运行，读报错；改好一处，再运行；全部不报错了，也要对一对每种情况的输出，因为有的错不会报错，只会算错。下面的几处，是按示例的修法逐处修改时可能看到的顺序，你的写法不同，看到的顺序也可能不同。`,introCode:`stock = {"奶茶": 12, "果茶": 5}
name = "咖啡"
cups = 2
stock[name] = stock[name] - cups
print("成交，剩", stock[name], "杯")
print(stock)`,exercises:[{type:`pick`,prompt:`起始程序点了咖啡，库存表里没有咖啡，运行报了 KeyError。规则：饮品不存在时，输出“没有这个饮品”，库存不变；最后都显示库存表。第 4 行起改成哪一种，屏幕才会显示：没有这个饮品，再显示 {'奶茶': 12, '果茶': 5}？`,key:`fix`,code:`stock = {"奶茶": 12, "果茶": 5}
name = "咖啡"
cups = 2
stock[name] = stock[name] - cups
print("成交，剩", stock[name], "杯")
print(stock)`,trace:`Traceback (most recent call last):
  File "main.py", line 4, in <module>
    stock[name] = stock[name] - cups
KeyError: '咖啡'`,checks:[{program:`stock = {"奶茶": 12, "果茶": 5}
name = "咖啡"
cups = 2
stock[name] = stock[name] - cups
print("成交，剩", stock[name], "杯")
print(stock)`,type:`KeyError`,line:4,msg:`'咖啡'`}],expected:`没有这个饮品
{'奶茶': 12, '果茶': 5}`,options:[{text:`先问 name 在不在 stock 里：在才取、才改；不在就输出“没有这个饮品”`,correct:!0,why:`先问 name 在不在 stock 里：在才取、才改；不在就输出“没有这个饮品”。最后一行 print(stock) 在 if 外面，每种情况都显示库存表，库存没变。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
name = "咖啡"
cups = 2
if name in stock:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
else:
    print("没有这个饮品")
print(stock)`},{text:`把 stock[name] 换成 stock.get(name, 0)，不存在就当库存是 0`,correct:!1,why:`不报错了，但显示 成交，剩 -2 杯 / {'奶茶': 12, '果茶': 5, '咖啡': -2}：不存在的咖啡被当成库存 0，减完成了负数，赋值还把咖啡新增进了库存表。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
name = "咖啡"
cups = 2
stock[name] = stock.get(name, 0) - cups
print("成交，剩", stock[name], "杯")
print(stock)`},{text:`先问 name not in stock：不在才去取、去卖；在的话输出“没有这个饮品”`,correct:!1,why:`条件写反了：咖啡不在 stock 里，name not in stock 为 True，反而去取 stock[name]，报错 KeyError。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
name = "咖啡"
cups = 2
if name not in stock:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
else:
    print("没有这个饮品")
print(stock)`},{text:`不存在时，先给它新增一项 0，再照常卖`,correct:!1,why:`不报错了，但显示 成交，剩 -2 杯 / {'奶茶': 12, '果茶': 5, '咖啡': -2}：先给不存在的咖啡新增了一项再卖，库存表里多了负数的咖啡；要求是不存在就输出“没有这个饮品”，库存不变。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
name = "咖啡"
cups = 2
if name not in stock:
    stock[name] = 0
stock[name] = stock[name] - cups
print("成交，剩", stock[name], "杯")
print(stock)`}],tip:`先问“在不在”：在才取、才改。`},{type:`pick`,prompt:`上面改好之后，换成点 8 杯果茶（只有 5 杯）。程序不报错，却让果茶剩了 -3 杯。规则：库存不足时，输出“库存不足”，库存不变。第 4 行起改成哪一种？`,key:`fix`,code:`stock = {"奶茶": 12, "果茶": 5}
name = "果茶"
cups = 8
if name in stock:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
else:
    print("没有这个饮品")
print(stock)`,checks:[],expected:`库存不足
{'奶茶': 12, '果茶': 5}`,options:[{text:`先问存在，再问杯数是不是比库存多（cups > stock[name]）：多就输出“库存不足”，否则才卖`,correct:!0,why:`杯数比库存多（8 > 5）时输出“库存不足”，什么都不改，库存仍是 5。顺序也对：先看存在不存在，再看够不够，最后才改库存。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
name = "果茶"
cups = 8
if name not in stock:
    print("没有这个饮品")
elif cups > stock[name]:
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)`},{text:`把比较写成 cups < stock[name]：杯数比库存少就输出“库存不足”`,correct:!1,why:`条件写反了：8 < 5 不成立，走到了 else，显示 成交，剩 -3 杯 / {'奶茶': 12, '果茶': -3}。库存不足应该是杯数比库存多：cups > stock[name]。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
name = "果茶"
cups = 8
if name not in stock:
    print("没有这个饮品")
elif cups < stock[name]:
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)`},{text:`先把库存减掉；减完发现小于 0，再输出“库存不足”`,correct:!1,why:`检查得太晚：先减了库存才发现不够，显示 库存不足 / {'奶茶': 12, '果茶': -3}。库存不足时，库存应该保持不变：要先比较、再决定改不改。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
name = "果茶"
cups = 8
if name in stock:
    stock[name] = stock[name] - cups
    if stock[name] < 0:
        print("库存不足")
    else:
        print("成交，剩", stock[name], "杯")
else:
    print("没有这个饮品")
print(stock)`},{text:`只有杯数正好等于库存（cups == stock[name]）时，才输出“库存不足”`,correct:!1,why:`只有杯数正好等于库存才进“库存不足”：8 不等于 5，走到了 else，显示 成交，剩 -3 杯 / {'奶茶': 12, '果茶': -3}。`,fixed:`stock = {"奶茶": 12, "果茶": 5}
name = "果茶"
cups = 8
if name not in stock:
    print("没有这个饮品")
elif cups == stock[name]:
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)`}],tip:`先比较，再决定改不改；库存不足时什么都不改。`},{type:`predict`,prompt:`三种情况都处理好了。点 5 杯果茶，库存表里果茶正好 5 杯，屏幕上会显示什么？`,code:`stock = {"奶茶": 12, "果茶": 5}
name = "果茶"
cups = 5
if name not in stock:
    print("没有这个饮品")
elif cups > stock[name]:
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)`,options:[{text:`成交，剩 0 杯
{'奶茶': 12, '果茶': 0}`,correct:!0,why:`5 不比库存 5 多，不算库存不足；正好卖完也算成交：库存减成 0，输出“成交，剩 0 杯”。最后 print(stock) 显示的是改完之后的库存表。`},{text:`库存不足
{'奶茶': 12, '果茶': 5}`,correct:!1,why:`cups > stock[name] 是 5 > 5，不成立。正好卖完不算库存不足。`},{text:`成交，剩 0 杯
{'奶茶': 12, '果茶': 5}`,correct:!1,why:`print(stock) 在库存减完之后才运行，显示的是改完的库存表，果茶是 0。`},{text:`成交，剩 0 杯`,correct:!1,why:`最后一行 print(stock) 没有缩进，不在 else 里，每种情况都会运行，所以还会再显示库存表。`}],tip:`先看杯数是不是比库存多：5 不比 5 多。`},{type:`predict`,prompt:`再点一次：点 2 杯咖啡，库存表里没有咖啡，屏幕上会显示什么？`,code:`stock = {"奶茶": 12, "果茶": 5}
name = "咖啡"
cups = 2
if name not in stock:
    print("没有这个饮品")
elif cups > stock[name]:
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)`,options:[{text:`没有这个饮品
{'奶茶': 12, '果茶': 5}`,correct:!0,why:`咖啡不在 stock 里，进第一个分支：输出“没有这个饮品”；库存没动，最后 print(stock) 显示原来的库存表。`},{text:`没有这个饮品`,correct:!1,why:`最后一行 print(stock) 没有缩进，每种情况都会运行，所以还会再显示库存表。`},{text:`没有这个饮品
{'奶茶': 12, '果茶': 5, '咖啡': 2}`,correct:!1,why:`这个分支只输出文字，没有给 stock 写任何值，库存表里不会多出咖啡。`},{text:`报错`,correct:!1,why:`先判断 name not in stock，咖啡不在，直接输出文字，没有去取 stock[name]，不会报 KeyError。`}],tip:`先问不存在：不存在就输出文字，其他分支都不会运行。`}],pending:[{type:`modify`,replaces:4,status:`待 Claude 的代码题运行器，暂不开放`,plan:`改一改（项目）：库存小程序；不存在、库存不足、成交三种情况，最后 print(stock)`,task:{id:`U7L6-M1`,version:1,type:`modify`,prompt:`库存小程序：顾客点了 name（饮品）cups 杯，stock 是库存表。输入范围：cups 是正整数（至少 1 杯），stock 里每个库存都是非负整数（可以是 0）。规则：① 饮品不存在（不在 stock 里）：输出“没有这个饮品”，库存不变。② 库存不足（点的杯数比库存多）：输出“库存不足”，库存不变。③ 其余情况：库存减去杯数，输出“成交，剩 N 杯”（N 是卖完后的库存；正好卖完，剩 0 杯，也算成交）。不管是哪种情况，最后都再用 print(stock) 显示一次库存表。起始程序只写了“成交”这一种，请一处一处改好，每改一处就重新运行。`,given:[`stock`,`name`,`cups`],checkMode:`output`,code:`stock[name] = stock[name] - cups
print("成交，剩", stock[name], "杯")
print(stock)
`,tests:[{name:`3 杯奶茶，够`,data:{stock:{奶茶:12,果茶:5},name:`奶茶`,cups:3},expected:`成交，剩 9 杯
{'奶茶': 9, '果茶': 5}`},{name:`8 杯果茶，库存不足`,data:{stock:{奶茶:12,果茶:5},name:`果茶`,cups:8},expected:`库存不足
{'奶茶': 12, '果茶': 5}`},{name:`咖啡，不存在`,data:{stock:{奶茶:12,果茶:5},name:`咖啡`,cups:2},expected:`没有这个饮品
{'奶茶': 12, '果茶': 5}`},{name:`正好卖完`,data:{stock:{奶茶:12,果茶:5},name:`果茶`,cups:5},expected:`成交，剩 0 杯
{'奶茶': 12, '果茶': 0}`,hidden:!0},{name:`库存已经是 0`,data:{stock:{奶茶:12,果茶:0},name:`果茶`,cups:1},expected:`库存不足
{'奶茶': 12, '果茶': 0}`,hidden:!0},{name:`换一张库存表：不存在`,data:{stock:{咖啡:4,奶茶:1},name:`果茶`,cups:1},expected:`没有这个饮品
{'咖啡': 4, '奶茶': 1}`,hidden:!0},{name:`换一张库存表：成交`,data:{stock:{咖啡:4,奶茶:1},name:`咖啡`,cups:3},expected:`成交，剩 1 杯
{'咖啡': 1, '奶茶': 1}`,hidden:!0}],hints:[`先运行，读最后一行的错误类型和 line 几；再对照三种情况：不存在、库存不足、成交。不报错也要对一对输出，有的错不会报错，只会算错。`,`三种情况用 if / elif / else：先问 name not in stock，再问 cups > stock[name]，最后才改库存。最后一行 print(stock) 写在 if 外面，每种情况都要显示。`],reference:`if name not in stock:
    print("没有这个饮品")
elif cups > stock[name]:
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)
`,worked:{code:`books = {"童话": 3, "科幻": 0}
title = "科幻"
if title not in books:
    print("没有这本书")
elif books[title] == 0:
    print("已借完")
else:
    books[title] = books[title] - 1
    print("借走一本")`,output:`已借完`,explain:`三步：先问书在不在（not in）；再问还有没有（等于 0 就是借完了）；两个检查都过了，才改数量并输出结果。检查放在改数量之前。`},alternatives:[`if name in stock:
    if cups <= stock[name]:
        stock[name] = stock[name] - cups
        print("成交，剩", stock[name], "杯")
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
    left = stock[name] - cups
    stock[name] = left
    print("成交，剩", left, "杯")
print(stock)
`,`if name not in stock:
    print("没有这个饮品")
elif stock[name] - cups < 0:
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)
`],wrongAnswers:[{code:`if name not in stock:
    print("没有这个饮品")
elif cups >= stock[name]:
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)
`,why:`边界：正好卖完（杯数等于库存）也算成交，用 > 不用 >=`},{code:`if cups > stock[name]:
    print("库存不足")
elif name not in stock:
    print("没有这个饮品")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)
`,why:`顺序反了：先比较 stock[name]，不存在的饮品直接 KeyError；要先问“有没有”再问“够不够”`},{code:`if cups > stock.get(name, 0):
    print("库存不足")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)
`,why:`用 .get(name, 0) 把不存在的饮品当成库存 0，会输出“库存不足”，要求是“没有这个饮品”（两种情况要分开）`}],requiresVariationAfterSolution:!0,variation:{id:`U7L6-M1-V1`,prompt:`库存不足时，输出“库存不足，还差 N 杯”（N 是点的杯数减去库存），其他情况不变，最后仍用 print(stock) 显示库存表。`,starter:`# stock、name、cups 已经准备好
`,tests:[{name:`8 杯果茶`,data:{stock:{奶茶:12,果茶:5},name:`果茶`,cups:8},expected:`库存不足，还差 3 杯
{'奶茶': 12, '果茶': 5}`},{name:`3 杯奶茶`,data:{stock:{奶茶:12,果茶:5},name:`奶茶`,cups:3},expected:`成交，剩 9 杯
{'奶茶': 9, '果茶': 5}`},{name:`正好卖完`,data:{stock:{奶茶:12,果茶:5},name:`果茶`,cups:5},expected:`成交，剩 0 杯
{'奶茶': 12, '果茶': 0}`,hidden:!0},{name:`咖啡，不存在`,data:{stock:{奶茶:12,果茶:5},name:`咖啡`,cups:2},expected:`没有这个饮品
{'奶茶': 12, '果茶': 5}`,hidden:!0},{name:`差 8 杯`,data:{stock:{奶茶:2},name:`奶茶`,cups:10},expected:`库存不足，还差 8 杯
{'奶茶': 2}`,hidden:!0}],hints:[`三种情况的顺序不变：先判断不存在，再判断库存不足，最后才改库存。`,`库存不足时：print("库存不足，还差", cups - stock[name], "杯")；逗号会在中间补空格。`],solution:`if name not in stock:
    print("没有这个饮品")
elif cups > stock[name]:
    print("库存不足，还差", cups - stock[name], "杯")
else:
    stock[name] = stock[name] - cups
    print("成交，剩", stock[name], "杯")
print(stock)
`}}}]}]},y={id:`U8`,title:`函数`,subtitle:`def、参数、return`,lessons:[{id:`U8L1`,title:`定义和调用`,concept:`def、函数体、调用 welcome()`,story:`奶茶店每次开门都要说“欢迎光临”。同一句话写很多遍太麻烦：用 def 给这段程序起个名字，以后喊一下名字就行。（你一直在用的 print(…) 就是别人写好的函数，写 print(…) 就是在调用它。）写法：def welcome(): 这一行是“起名字”，下面缩进的几行是函数体，也就是要做的事。注意：def 只是把做法记下来，这时函数体一行都不会运行，屏幕上什么都不会显示。要让它真正做事，要写 welcome()，名字后面带括号，这叫调用：调用一次，函数体就运行一次；调用两次，就运行两次。名字要先定义、后调用。`,introCode:`def welcome():
    print("欢迎光临")
welcome()
welcome()`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`def welcome():
    print("欢迎光临")
print("开店了")`,options:[{text:`开店了`,correct:!0,why:`def 只是把做法记下来，函数体要等到调用才运行；这段程序里没有调用 welcome()。屏幕上只有第 3 行的 print 显示的“开店了”（它没有缩进，不在函数里）。`},{text:`欢迎光临
开店了`,correct:!1,why:`def 那两行不会自己运行。函数体里的 print 要等到调用 welcome() 才会运行，这段程序从头到尾没有调用。`},{text:`欢迎光临`,correct:!1,why:`显示的是第 3 行普通的 print：“开店了”。函数体里的 print 没有运行，因为没有调用 welcome()。`},{text:`什么都不显示`,correct:!1,why:`第 3 行的 print 没有缩进，不在函数里，是一行普通的程序，会照常运行，显示“开店了”。`}],tip:`def 只是起名字、记做法；看有没有 名字() 这样带括号的调用。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`def welcome():
    print("欢迎光临")
welcome()
print("请点单")
welcome()`,options:[{text:`欢迎光临
请点单
欢迎光临`,correct:!0,why:`函数在被调用的那一行运行：第 3 行调用 → 欢迎光临；第 4 行 → 请点单；第 5 行再调用一次 → 再显示一次欢迎光临。调用几次，函数体就运行几次。`},{text:`欢迎光临
请点单`,correct:!1,why:`第 5 行又调用了一次 welcome()，函数体会再运行一遍，所以欢迎光临显示两次。`},{text:`欢迎光临
欢迎光临
请点单`,correct:!1,why:`程序按顺序一行一行运行：第 3 行调用（欢迎光临），第 4 行 print（请点单），第 5 行再调用（欢迎光临）。两次调用之间夹着“请点单”。`},{text:`欢迎光临
欢迎光临
欢迎光临
请点单`,correct:!1,why:`def 那一行不会运行函数体，不算调用。这段程序只有第 3、5 行两次调用，欢迎光临只显示两次。`}],tip:`一行一行往下走：碰到 welcome() 就把函数体运行一遍。`},{type:`fill`,prompt:`屏幕要显示：欢迎光临`,code:`def welcome():
    print("欢迎光临")
{0}`,tokens:[`welcome()`,`welcome`,`def welcome():`,`Welcome()`],answer:[`welcome()`],expected:`欢迎光临`,why:{welcome:`只写名字、不带括号，只是提到了这个函数，没有调用它，函数体不会运行，屏幕上什么都不显示（也不会报错）。调用要带括号。`,"def welcome():":`def 是“定义”，不是“调用”。而且 def 后面必须有缩进的函数体，这里没有，会报 IndentationError（缩进错误：def 后面缺少缩进的内容）。`,"Welcome()":`大小写不同，Python 当成另一个名字。Welcome 没有定义过，会报 NameError（用到了没有定义的名字）。`},hint:`函数已经定义好了，现在要让它运行：名字加括号。`},{type:`pick`,prompt:`调用写在了定义的前面，运行报了错。最后一行说 NameError: name 'welcome' is not defined（welcome 这个名字还没有定义）。出错的是哪一行？`,key:`line`,code:`welcome()
def welcome():
    print("欢迎光临")`,trace:`Traceback (most recent call last):
  File "main.py", line 1, in <module>
    welcome()
NameError: name 'welcome' is not defined`,checks:[{program:`welcome()
def welcome():
    print("欢迎光临")`,type:`NameError`,line:1,msg:`name 'welcome' is not defined`}],options:[{text:`welcome()`,correct:!0,why:`程序从上往下运行。到第 1 行调用 welcome() 时，下面的 def 还没有运行过，Python 还不知道 welcome 是什么，就在这一行报错了。先定义，后调用。`},{text:`def welcome():`,correct:!1,why:`def 这一行本身没有问题。它只是在调用的后面，程序还没有走到那里，就已经在第 1 行出错停下来了。`},{text:`print("欢迎光临")`,correct:!1,why:`函数体一次都没有运行。程序在第 1 行就停了，根本没有走到这一行。`}],tip:`报错时程序就停在出错的那一行；看看那一行用到的名字，之前有没有被定义过。`}]},{id:`U8L2`,title:`给函数一个参数`,concept:`参数、传入值`,story:`欢迎光临永远是同一句话。想让同一个函数按不同的饮品工作，就给它留一个空位：def say(drink): 括号里的 drink 叫参数，在函数体里它就像一个变量。调用时，括号里写的值会传进这个空位：say("奶茶") 把 "奶茶" 传给 drink，函数体里用到 drink 的地方就是“奶茶”；say("果茶") 再传一个，同一个函数就得到不一样的结果。每次调用都会重新传值。后面的 pay(price) 定义了一个必填参数 price：调用时漏传值，Python 会报 TypeError（类型错误）。`,introCode:`def say(drink):
    print("来一杯", drink)
say("奶茶")
say("果茶")`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`def say(drink):
    print("来一杯", drink)
say("咖啡")
say("果茶")`,options:[{text:`来一杯 咖啡
来一杯 果茶`,correct:!0,why:`第 3 行调用 say("咖啡")，咖啡传给 drink，显示“来一杯 咖啡”；第 4 行再调用 say("果茶")，这次 drink 是果茶，显示“来一杯 果茶”。`},{text:`来一杯 drink
来一杯 drink`,correct:!1,why:`print 里的 drink 没有引号，是参数这个变量，显示的是传进来的值（咖啡、果茶），不是单词 drink。`},{text:`来一杯 咖啡
来一杯 咖啡`,correct:!1,why:`每次调用都会重新传值。第 4 行传的是果茶，drink 这次就是果茶。`},{text:`来一杯 果茶
来一杯 咖啡`,correct:!1,why:`程序按顺序运行：先第 3 行传咖啡，再第 4 行传果茶，所以先显示咖啡。`}],tip:`每次调用，括号里的值传给参数；函数体里的 drink 就是这一次传进来的值。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`def pay(price):
    print("应付", price * 2)
tea = 8
pay(tea)
tea = 5
pay(tea)`,options:[{text:`应付 16
应付 10`,correct:!0,why:`第 4 行调用 pay(tea)，这时 tea 是 8，传给 price，8 × 2 = 16。第 5 行把 tea 改成 5，第 6 行再调用，传进去的是 5，5 × 2 = 10。`},{text:`应付 16
应付 16`,correct:!1,why:`每次调用，传进去的是调用那一刻 tea 里的值。第 5 行已经把 tea 改成 5，第 6 行传的是 5，所以是 10。`},{text:`应付 8
应付 5`,correct:!1,why:`函数体里写的是 price * 2，要乘 2：8 × 2 = 16，5 × 2 = 10。`},{text:`应付 10
应付 10`,correct:!1,why:`函数是在调用的那一行运行的，不是等到最后。第一次调用时 tea 还是 8，得 16，之后 tea 才改成 5。`}],tip:`看调用的那一刻变量里是多少：传进去的是值，不是变量名。`},{type:`fill`,prompt:`屏幕要显示：应付 20`,code:`def pay({0}):
    print("应付", price * 2)
pay(10)`,tokens:[`price`,`cups`,`10`,`"price"`],answer:[`price`],expected:`应付 20`,why:{cups:`参数起名叫 cups，但函数体里用的是 price。price 没有定义过，调用时会报 NameError（用到了没有定义的名字）。参数的名字要和函数体里用的一致。`,10:`def 的括号里要写一个名字（空位的名字），不能直接写具体的值 10，会报 SyntaxError（写法不符合语法）。值要在调用的时候传，pay(10)。`,'"price"':`括号里写的是名字，不是文字，不能加引号，会报 SyntaxError（写法不符合语法）。`},hint:`def 括号里要写一个名字，函数体里用到的就是这个名字。`},{type:`pick`,prompt:`忘了给 pay 传值，运行报了错。最后一行 TypeError: pay() missing 1 required positional argument: 'price' 是在说什么？`,key:`type`,code:`def pay(price):
    print("应付", price * 2)
pay()`,trace:`Traceback (most recent call last):
  File "main.py", line 3, in <module>
    pay()
TypeError: pay() missing 1 required positional argument: 'price'`,checks:[{program:`def pay(price):
    print("应付", price * 2)
pay()`,type:`TypeError`,line:3,msg:`pay() missing 1 required positional argument: 'price'`}],options:[{text:`调用 pay() 时括号里没给值，必填参数 price 没有收到`,correct:!0,why:`本关的 pay(price) 定义了一个必填参数 price，调用时必须传一个值进去。第 3 行 pay() 括号里是空的，漏传了，所以 Python 说“少了 1 个必须给的参数 'price'”。`,value:`TypeError`},{text:`pay 这个名字还没有定义`,correct:!1,why:`那是 NameError。pay 在第 1 行已经 def 过了；这里报的是 TypeError，说的是调用时少了一个值。`,value:`NameError`},{text:`def 那一行少了冒号`,correct:!1,why:`少冒号是 SyntaxError，程序一行都不会运行。这里 def 写得没问题，函数体都定义好了，是第 3 行调用时才出的错。`,value:`SyntaxError`},{text:`函数体没有缩进`,correct:!1,why:`那是 IndentationError。这里函数体的缩进是对的；最后一行写的是 TypeError，说的是调用时少了一个值。`,value:`IndentationError`}],tip:`missing 1 required argument：少了 1 个必须给的值（必填参数）。看看调用那一行括号里有没有东西。`}]},{id:`U8L3`,title:`返回结果`,concept:`return、print 和 return 的区别、None`,story:`到现在函数只会“显示”：函数里的 print 把东西显示在屏幕上，显示完就没了。想让函数把结果交回给调用它的地方，用 return：def two(price): return price * 2，调用 two(8) 的地方就变成交回来的 16，可以存进变量、拿去计算、再显示。return 自己不显示任何东西：想看到结果，要把它存下来再 print，或者直接 print(two(8))。return 一执行，这次函数调用就结束了，后面的语句不再运行：比如在 return price * 2 后面再写 print("算完了")，这一行永远不会运行。函数执行结束时没有遇到 return，会自动返回 None（什么都没有）。`,introCode:`def two(price):
    return price * 2
total = two(8)
print(total)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`def show_two(price):
    print(price * 2)
def two(price):
    return price * 2
show_two(8)
two(8)`,options:[{text:`16`,correct:!0,why:`show_two(8) 里的 print 把 16 显示在屏幕上；two(8) 用的是 return，只是把 16 交回来，这里没有变量接它，也没有 print，16 就丢掉了，不会显示，也不会报错。`},{text:`16
16`,correct:!1,why:`return 不会显示。two(8) 交回的 16 没有被存起来，也没有被 print，屏幕上不会出现。`},{text:`什么都不显示`,correct:!1,why:`show_two(8) 里的 print 会运行，在屏幕上显示 16。`},{text:`报错`,correct:!1,why:`单独写一行 two(8) 不会报错：它交回 16，没人接，就丢掉了。`}],tip:`print 把东西显示出来；return 把值交回给调用的地方，不显示。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`def two(price):
    return price * 2
    print("算完了")
total = two(8)
print(total)
print(total + 1)`,options:[{text:`16
17`,correct:!0,why:`第 4 行 total = two(8)：函数执行到第 2 行的 return 就结束了，第 3 行 print("算完了") 不会运行；two(8) 交回 16，存进 total。第 5 行显示 16，第 6 行 total + 1 是 17。`},{text:`算完了
16
17`,correct:!1,why:`第 3 行在 return 后面：函数执行到 return 这次调用就结束了，后面的 print("算完了") 不会运行，不会显示“算完了”。`},{text:`16
16`,correct:!1,why:`第 6 行是 print(total + 1)，要把 1 加上：16 + 1 = 17。`},{text:`8
9`,correct:!1,why:`total 里存的是 two(8) 交回来的结果 16，不是传进去的 8。`}],tip:`return 一执行，这次函数调用就结束，后面的语句不再运行。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`def say(drink):
    print("来一杯", drink)
x = say("奶茶")
print(x)`,options:[{text:`来一杯 奶茶
None`,correct:!0,why:`第 3 行调用 say("奶茶")：函数里的 print 显示“来一杯 奶茶”。say 执行结束时没有遇到 return，会自动返回 None，x 得到的就是 None，第 4 行 print(x) 就显示 None。`},{text:`来一杯 奶茶
来一杯 奶茶`,correct:!1,why:`函数里 print 显示出来的文字不会被交回来存进 x。x 得到的是 None（什么都没有），不是那句话。`},{text:`来一杯 奶茶`,correct:!1,why:`第 4 行 print(x) 也会运行，会再显示一行：x 里是 None。`},{text:`来一杯 奶茶
奶茶`,correct:!1,why:`say 执行结束时没有遇到 return，自动返回 None，不会把 drink 交回来。x 得到的是 None，不是奶茶。`}],tip:`函数执行结束时没有遇到 return，会自动返回 None。`},{type:`fill`,prompt:`屏幕要显示：20（函数 two 的第二行该怎么写）`,code:`def two(price):
    {0}
print(two(10))`,tokens:[`return price * 2`,`print(price * 2)`,`price * 2`,`show(price * 2)`],answer:[`return price * 2`],expected:`20`,why:{"print(price * 2)":`函数里的 print 先把 20 显示出来，但函数执行结束时没有遇到 return，自动返回 None，外面的 print(two(10)) 就把 None 又显示了一遍：先 20，再 None，不是只显示 20。`,"price * 2":`只算了一下就丢掉了，函数执行结束时没有遇到 return，自动返回 None，外面的 print(two(10)) 显示的是 None。`,"show(price * 2)":`show 这个名字没有定义过，Python 找不到它，会报 NameError（用到了没有定义的名字）。要把结果交回去，用 return。`},hint:`要把 price * 2 交回给调用它的 print(two(10))：用 return。`}]},{id:`U8L4`,title:`组合调用`,concept:`返回结果参与计算、嵌套调用`,story:`return 交回来的值，和平时的数一样用：存进变量 total = two(8)，参与计算 two(8) + 3，再传给另一个函数 coupon(two(10))。碰到 f(g(x)) 这样套着的写法，先算里面的：two(10) 先得 20，20 再传给 coupon，得 15。本关要把算出的数字交给后续计算，所以用 return 返回数字。如果函数里只 print、没有遇到 return，调用它的结果是 None，拿去做加法会报 TypeError。`,introCode:`def two(price):
    return price * 2
def coupon(price):
    return price - 5
total = coupon(two(10))
print(total)`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`def two(price):
    return price * 2
print(two(8) + 3)
print(two(8) + two(5))`,options:[{text:`19
26`,correct:!0,why:`two(8) 交回 16，两个 print 里的 two(…) 都换成它交回来的值：16 + 3 = 19；two(8) 是 16，two(5) 是 10，16 + 10 = 26。`},{text:`11
13`,correct:!1,why:`two(8) 不是 8：函数交回的是 8 × 2 = 16。11、13 是没有经过函数、直接用 8 算出来的。`},{text:`16
26`,correct:!1,why:`第 3 行是 print(two(8) + 3)，要把 3 也加上：16 + 3 = 19。`},{text:`19
13`,correct:!1,why:`two(5) 也要经过函数：5 × 2 = 10，所以是 16 + 10 = 26，不是 8 + 5。`}],tip:`先把每个 two(…) 换成它交回的值，再算加法。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`def two(price):
    return price * 2
def coupon(price):
    return price - 5
print(coupon(two(10)))`,options:[{text:`15`,correct:!0,why:`套着的调用先算里面：two(10) 交回 20，20 再传给 coupon，20 - 5 = 15。`},{text:`10`,correct:!1,why:`顺序反了：这是先 coupon(10)（得 5）再 two(5)（得 10）的结果。题里是 coupon(two(10))，括号里面的 two(10) 先算，得 20，再减 5。`},{text:`5`,correct:!1,why:`5 是 coupon(10) 的结果。题里传给 coupon 的是 two(10) 交回的 20，不是 10。`},{text:`20`,correct:!1,why:`20 是 two(10) 的结果，还要把它传给 coupon，再减 5。`}],tip:`f(g(x))：先算里面的 g(x)，再把结果交给 f。`},{type:`fill`,prompt:`屏幕要显示：24`,code:`def two(price):
    return price * 2
a = two(8)
b = two({0})
print(a + b)`,tokens:[`4`,`8`,`a`,`b`],answer:[`4`],expected:`24`,why:{8:`b = two(8) 是 16，a 也是 16，a + b 是 32，不是 24。`,a:`a 里是 16，two(a) 是 two(16) = 32，a + b 是 16 + 32 = 48，不是 24。`,b:`第 4 行等号右边先算，这时 b 还没有值，用到 b 会报 NameError（用到了没有定义的名字）。`},hint:`a 已经是 16，要让 a + b = 24，b 就得是 8，也就是 two(?) 要交回 8。`},{type:`pick`,prompt:`想算“两杯的价钱再加 3 元”，屏幕要显示 19。运行后先显示了 16，又报了 TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'（None 和整数不能用 + 相加；None 就是“什么都没有”）。怎么改，屏幕才会显示 19？`,key:`fix`,code:`def two(price):
    print(price * 2)
total = two(8) + 3
print(total)`,trace:`Traceback (most recent call last):
  File "main.py", line 3, in <module>
    total = two(8) + 3
TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'`,checks:[{program:`def two(price):
    print(price * 2)
total = two(8) + 3
print(total)`,type:`TypeError`,line:3,msg:`unsupported operand type(s) for +: 'NoneType' and 'int'`}],expected:`19`,options:[{text:`把 two 里的 print(price * 2) 改成 return price * 2`,correct:!0,why:`two 执行结束时没有遇到 return，自动返回 None，None + 3 报错。改成 return 后，two(8) 交回 16，16 + 3 = 19，最后 print(total) 显示 19。`,fixed:`def two(price):
    return price * 2
total = two(8) + 3
print(total)`},{text:`把第 3 行的 + 3 去掉`,correct:!1,why:`两杯的价钱要再加 3，不能去掉。去掉后不报错了，但 two 里的 print 先显示 16，total 得到的还是 None，最后显示 16 和 None，不是 19。`,fixed:`def two(price):
    print(price * 2)
total = two(8)
print(total)`},{text:`删掉最后一行 print(total)`,correct:!1,why:`报错发生在第 3 行 total = two(8) + 3，和最后一行无关，删掉它还是同样的 TypeError。`,fixed:`def two(price):
    print(price * 2)
total = two(8) + 3`},{text:`把 3 改成文字 "3"`,correct:!1,why:`two(8) 得到的还是 None，None 和文字 "3" 也不能用 + 相加，仍然是 TypeError。`,fixed:`def two(price):
    print(price * 2)
total = two(8) + "3"
print(total)`}],tip:`本关要把算出的数字交给后续计算，所以用 return 返回数字；函数里的 print 只是显示。`}]},{id:`U8L5`,title:`两个参数和默认值`,concept:`多个参数、按顺序传值、默认值`,story:`价格计算器要两个数：单价和杯数。参数可以有好几个，括号里用逗号隔开：def total(price, cups):。调用时按顺序传值：total(8, 3) 把 8 传给 price，把 3 传给 cups，传的个数要和参数一样多，顺序也要对。如果某个参数大多数时候用同一个值，可以给它一个默认值：def total(price, cups=1): 调用时不传 cups，就用 1；传了，就用传进去的值。有默认值的参数要写在没有默认值的参数后面。`,introCode:`def total(price, cups=1):
    return price * cups
print(total(8, 3))
print(total(8))`,exercises:[{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`def order(drink, cups):
    print(cups, "杯", drink)
order("奶茶", 2)
order("果茶", 1)`,options:[{text:`2 杯 奶茶
1 杯 果茶`,correct:!0,why:`两个值按顺序传：第 3 行 order("奶茶", 2)，奶茶传给第一个参数 drink，2 传给第二个参数 cups。函数里 print(cups, "杯", drink) 先写 cups，所以先显示 2，再是“杯”，最后是奶茶。第 4 行同理。`},{text:`奶茶 杯 2
果茶 杯 1`,correct:!1,why:`显示的顺序由函数里 print 的写法决定：print(cups, "杯", drink) 先显示 cups。传值的顺序和显示的顺序不一定一样。`},{text:`2 杯 奶茶
2 杯 奶茶`,correct:!1,why:`每次调用都会重新传值。第 4 行传的是 "果茶" 和 1，drink、cups 这次就是果茶和 1。`},{text:`报错`,correct:!1,why:`不会报错：调用时传了 2 个值，def 里正好有 2 个参数，个数是对得上的。`}],tip:`按顺序对应：第一个值给第一个参数，第二个值给第二个参数。`},{type:`fill`,prompt:`屏幕要显示：24（函数 total 的第一行，括号里该怎么写）`,code:`def total({0}):
    return price * cups
print(total(8, 3))`,tokens:[`price, cups`,`price cups`,`price + cups`,`price`],answer:[`price, cups`],expected:`24`,why:{"price cups":`两个参数之间要用逗号隔开。漏了逗号，会报 SyntaxError（写法不符合语法）。`,"price + cups":`括号里写的是参数的名字，不能做运算，会报 SyntaxError（写法不符合语法）。`,price:`只有一个参数 price，调用时却传了 8 和 3 两个值，个数对不上，会报 TypeError（值的个数不对）。函数体里用了 cups，就要在括号里也写上它。`},hint:`有两个参数：名字写在括号里，用逗号隔开。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`def total(price, cups=1):
    return price * cups
print(total(8))
print(total(8, 3))
print(total(5))`,options:[{text:`8
24
5`,correct:!0,why:`cups=1 是默认值。第 3 行 total(8) 没传 cups，用默认的 1：8 × 1 = 8；第 4 行 total(8, 3) 传了 3，就用 3：8 × 3 = 24；第 5 行 total(5) 又没传，5 × 1 = 5。`},{text:`8
8
5`,correct:!1,why:`默认值只在没有传值时才用。第 4 行传了 3，cups 就是 3，不是默认的 1。`},{text:`0
24
0`,correct:!1,why:`没传 cups 时用的是它的默认值 1，不是 0，所以 8 × 1 = 8，5 × 1 = 5。`},{text:`报错`,correct:!1,why:`cups 有默认值，调用时可以不传，不会报错。只有没有默认值的参数，漏传才会报 TypeError。`}],tip:`传了值就用传的值；没传，才用默认值。`},{type:`pick`,prompt:`想让 total(8) 也能用（只买 1 杯，不用写杯数），屏幕要显示 8。现在运行报了错：TypeError: total() missing 1 required positional argument: 'cups'（调用时少了 1 个必须给的参数 cups）。怎么改，屏幕才会显示 8？`,key:`fix`,code:`def total(price, cups):
    return price * cups
print(total(8))`,trace:`Traceback (most recent call last):
  File "main.py", line 3, in <module>
    print(total(8))
TypeError: total() missing 1 required positional argument: 'cups'`,checks:[{program:`def total(price, cups):
    return price * cups
print(total(8))`,type:`TypeError`,line:3,msg:`total() missing 1 required positional argument: 'cups'`}],expected:`8`,options:[{text:`把第 1 行改成 def total(price, cups=1):`,correct:!0,why:`给 cups 一个默认值 1：total(8) 没传 cups，就用 1，8 × 1 = 8。`,fixed:`def total(price, cups=1):
    return price * cups
print(total(8))`},{text:`把第 1 行改成 def total(price, cups=0):`,correct:!1,why:`不报错了，但没传 cups 时它是 0，8 × 0 = 0，显示的是 0，不是 8。`,fixed:`def total(price, cups=0):
    return price * cups
print(total(8))`},{text:`把第 1 行改成 def total(price=1, cups):`,correct:!1,why:`有默认值的参数要写在没有默认值的参数后面。这样写，Python 一行都不会运行，直接报 SyntaxError（写法不符合语法）。`,fixed:`def total(price=1, cups):
    return price * cups
print(total(8))`},{text:`把第 1 行改成 def total(price):`,correct:!1,why:`cups 不再是参数了，但函数体里还在用它，调用时会报 NameError（用到了没有定义的名字）。`,fixed:`def total(price):
    return price * cups
print(total(8))`}],tip:`不想每次都传的值，给它一个默认值；有默认值的参数写在后面。`}]},{id:`U8L6`,title:`函数里的变量`,concept:`作用域：这些例子中，函数里定义的名字不能在函数外直接使用`,story:`这一关的例子里：在函数里定义的名字（包括参数），不能在函数外面直接使用，外面用会报 NameError。如果函数里和函数外面有同名的 price，函数里给 price 重新赋值（price = 100、price = price * 2），不会改变函数外面的 price。想把函数里算出来的结果拿到外面用，要用 return 交回来，再存进变量或 print。`,introCode:`price = 8
def double(price):
    price = price * 2
    return price
print(double(price))
print(price)`,exercises:[{type:`pick`,prompt:`程序报了 NameError: name 'drink' is not defined（drink 这个名字没有定义）。drink 明明在函数里赋过值，出错的是哪一行？`,key:`line`,code:`def make_order():
    drink = "奶茶"
    print("做好了", drink)
make_order()
print(drink)`,trace:`Traceback (most recent call last):
  File "main.py", line 5, in <module>
    print(drink)
NameError: name 'drink' is not defined`,checks:[{program:`def make_order():
    drink = "奶茶"
    print("做好了", drink)
make_order()
print(drink)`,type:`NameError`,line:5,msg:`name 'drink' is not defined`}],options:[{text:`print(drink)`,correct:!0,why:`最后一行报错。drink 是在 make_order() 里面定义的名字，这个例子里它不能在函数外面直接使用，外面的 print(drink) 就找不到它。`},{text:`drink = "奶茶"`,correct:!1,why:`给变量赋值没有问题，函数里的这一行正常运行了。`},{text:`make_order()`,correct:!1,why:`调用没有问题：函数体运行了，屏幕上已经显示了“做好了 奶茶”。`},{text:`print("做好了", drink)`,correct:!1,why:`这一行在函数里面，drink 在函数里有值，它正常运行了，已经显示了“做好了 奶茶”。`}],tip:`这些例子中，函数里定义的名字不能在函数外直接使用。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`price = 8
def change():
    price = 100
    print(price)
change()
print(price)`,options:[{text:`100
8`,correct:!0,why:`本题在函数里给 price 重新赋值（price = 100），函数里的 print 显示 100；这不会改变函数外面的 price，最后一行显示 8。`},{text:`100
100`,correct:!1,why:`本题函数里的 price = 100 不会改变函数外面的 price，最后一行还是 8。`},{text:`8
8`,correct:!1,why:`函数里有自己的 price = 100，函数里的 print 显示的是 100。`},{text:`8
100`,correct:!1,why:`顺序反了：先调用 change()，函数里的 print 先显示 100；最后一行是函数外面的 price，还是 8。`}],tip:`本题在函数里给 price 重新赋值，不会改变函数外面的 price。`},{type:`predict`,prompt:`点单屏运行这段程序，屏幕上会显示什么？`,code:`def double(price):
    price = price * 2
    return price
price = 8
print(double(price))
print(price)`,options:[{text:`16
8`,correct:!0,why:`8 传给参数 price；本题在函数里给参数 price 重新赋值（price = price * 2），交回 16，但不会改变函数外面的 price，最后一行显示 8。`},{text:`16
16`,correct:!1,why:`本题给参数 price 重新赋值，不会改变函数外面的 price，最后一行还是 8。想让外面的 price 变，要自己把交回的结果存回去，比如 price = double(price)。`},{text:`8
8`,correct:!1,why:`第 5 行 print(double(price)) 显示的是函数交回的结果，函数里的 price 已经乘了 2，是 16。`},{text:`8
16`,correct:!1,why:`顺序反了：第 5 行先显示函数交回的 16，最后一行才是函数外面没变的 price，也就是 8。`}],tip:`本题给参数 price 重新赋值，不会改变外面的 price。`},{type:`pick`,prompt:`想让屏幕显示 16。现在最后一行报了 NameError: name 'result' is not defined（result 这个名字没有定义）。怎么改，屏幕才会显示 16？`,key:`fix`,code:`def calc(price):
    result = price * 2
calc(8)
print(result)`,trace:`Traceback (most recent call last):
  File "main.py", line 4, in <module>
    print(result)
NameError: name 'result' is not defined`,checks:[{program:`def calc(price):
    result = price * 2
calc(8)
print(result)`,type:`NameError`,line:4,msg:`name 'result' is not defined`}],expected:`16`,options:[{text:`在函数里加一行 return result，最后一行改成 print(calc(8))`,correct:!0,why:`result 是在 calc 里定义的名字，不能在函数外直接使用。用 return 把它交回来，外面用 print(calc(8)) 接住，就显示 16 了。`,fixed:`def calc(price):
    result = price * 2
    return result
calc(8)
print(calc(8))`},{text:`把最后一行改成 print(price)`,correct:!1,why:`price 是 calc 的参数，这个例子里它也不能在函数外直接使用，外面用它还是 NameError。`,fixed:`def calc(price):
    result = price * 2
calc(8)
print(price)`},{text:`在最后一行前面加 result = 0`,correct:!1,why:`不报错了，但这是函数外面新建的另一个 result，里面是 0，显示的是 0，不是 16。`,fixed:`def calc(price):
    result = price * 2
calc(8)
result = 0
print(result)`},{text:`把 calc(8) 多调用一次`,correct:!1,why:`不管调用几次，result 都是在 calc 里定义的名字，函数外面不能直接使用，仍然是 NameError。`,fixed:`def calc(price):
    result = price * 2
calc(8)
calc(8)
print(result)`}],tip:`想把函数里算出的结果拿到外面，用 return 交回来。`}]}]},b={print:{word:`print`,full:`print`,ipa:`/prɪnt/`,meaning:`打印；印出`,python:`把括号里的内容显示到屏幕上，也就是「输出」。`,example:`print("你好")`,note:`不是缩写，就是普通英文单词 print。`,source:`https://dictionary.cambridge.org/dictionary/english/print`},string:{word:`string`,full:`string`,ipa:`/strɪŋ/`,meaning:`字符串；一串文字字符`,python:`Python 里的一段文字，要放在英文引号里，例如 "珍珠奶茶"。`,example:`drink = "珍珠奶茶"`,note:`不是缩写，就是普通英文单词 string（本意是「线、一串」）。`,source:`https://dictionary.cambridge.org/dictionary/english/string`},len:{word:`len`,full:`length`,ipa:`/leŋθ/`,meaning:`长度`,python:`len(...) 返回括号里文字的字符个数。`,example:`len("珍珠奶茶")`,note:`len 是完整单词 length 的缩写。`,source:`https://dictionary.cambridge.org/dictionary/english/length`}},x={caseMs:5e3,totalMs:1e4,readyCapMs:3e4},S={PASS:`pass`,WRONG:`wrong-output`,WRONG_FILE:`wrong-file`,WRONG_RETURN:`wrong-return`,ERROR:`error`,CASE_TIMEOUT:`case-timeout`,TOTAL_TIMEOUT:`total-timeout`,OUTPUT_LIMIT:`output-limit`,UNAVAILABLE:`unavailable`,INTERNAL:`internal`,CANCELLED:`cancelled`},ee=e=>`${Math.round(e/100)/10} 秒`;function C(e,t=x){return{[S.PASS]:`通过`,[S.WRONG]:`输出和期望不一致`,[S.WRONG_FILE]:`输出文件的内容和期望不一致，或者文件没有生成`,[S.WRONG_RETURN]:`函数的返回值和期望不一致`,[S.ERROR]:`程序运行出错`,[S.CASE_TIMEOUT]:`这一组测试运行超过 ${ee(t.caseMs)}，已停止（可能有死循环）。这次不算作答，不扣红心，代码已保留，改好后再检查`,[S.TOTAL_TIMEOUT]:`全部测试合计超过 ${ee(t.totalMs)}，已停止（程序可能太慢或有死循环）。这次不算作答，不扣红心，代码已保留，改好后再检查`,[S.OUTPUT_LIMIT]:`输出超过安全上限，已停止，请检查循环或打印次数。这次不算作答，不扣红心，代码已保留`,[S.UNAVAILABLE]:`Python 环境暂时不可用，这次不算作答，代码已保留，请重试`,[S.INTERNAL]:`判题出了内部问题，这次不算作答，代码已保留，请重试`,[S.CANCELLED]:`已取消，这次不算作答`}[e]}var w=e=>String(e??``).replace(/\r\n?/g,`
`),T=e=>e.endsWith(`
`)?e.slice(0,-1):e;function E(e,t=`strict`){let n=w(e);return t===`lenient`?n.split(`
`).map(e=>e.replace(/[ \t]+$/,``)).join(`
`).replace(/\n+$/,``):T(n)}var D=()=>globalThis.performance?performance.now():Date.now();function te({code:e,files:t,entry:n}){if(Array.isArray(t)){let e={};for(let n of t){if(!n||typeof n.path!=`string`||typeof n.content!=`string`||!n.path)return null;e[n.path]=n.content}let r=n||`main.py`;return r in e?{files:e,entry:r,code:e[r]}:null}return typeof e==`string`?{files:{"main.py":e},entry:`main.py`,code:e}:null}var O=e=>e&&typeof e==`object`&&!Array.isArray(e),k=e=>O(e)&&Object.values(e).every(e=>typeof e==`string`);function ne(e,t){return Array.isArray(e)&&e.length>0&&e.every(e=>O(e)&&(e.stdin===void 0||typeof e.stdin==`string`||Array.isArray(e.stdin)&&e.stdin.every(e=>typeof e==`string`))&&(e.files===void 0||k(e.files))&&(e.expectedFiles===void 0||k(e.expectedFiles))&&(t===`call`?O(e.call)&&typeof e.call.fn==`string`&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(e.call.fn)&&`expectedReturn`in e:typeof e.expected==`string`))}var re=`__judge_result__.json`;function ie(e){let t=JSON.stringify({fn:e.call.fn,args:e.call.args??[],kwargs:e.call.kwargs??{},expected:e.expectedReturn,tol:e.tol??1e-9});return`

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
    with open(${JSON.stringify(re)}, "w", encoding="utf-8") as fh:
        fh.write(_j.dumps(res, ensure_ascii=False))
_jg_run()
`}async function ae({code:e,files:t,entry:n,tests:r,checkMode:i=`output`,compare:a=`strict`,limits:o={}},s,{signal:c}={}){let l={...x,...o},u=0,d=(e,t,n,r)=>({status:e,attempt:!1,settle:!1,retry:e!==`cancelled`,totalMs:Math.round(u),cases:[...r,{...n,ok:!1,kind:t,ms:0,message:C(t,l)}]}),f={name:``,hidden:!1},p=te({code:e,files:t,entry:n});if(i!==`output`&&i!==`call`||a!==`strict`&&a!==`lenient`||!p||!ne(r,i))return d(`internal-error`,S.INTERNAL,f,[]);let m=[],h=(e,t)=>({status:t.kind===S.OUTPUT_LIMIT?`output-limit`:`timeout`,attempt:!1,settle:!1,retry:!0,totalMs:Math.round(u),cases:[...e,t]});for(let e of r){let t={name:e.name,hidden:!!e.hidden};if(c?.aborted)return d(`cancelled`,S.CANCELLED,t,[]);let n=l.totalMs-u;if(n<=0)return h(m,{...t,ok:!1,kind:S.TOTAL_TIMEOUT,ms:0,message:C(S.TOTAL_TIMEOUT,l)});let r=n<l.caseMs,o=Math.max(1,Math.min(l.caseMs,n)),f,g=D(),_={...e.files||{},...p.files};i===`call`&&(_[p.entry]=p.files[p.entry]+ie(e));let v=[...Object.keys(e.expectedFiles||{}),...i===`call`?[re]:[]];try{f=await s.exec({code:_[p.entry],files:_,entry:p.entry,data:e.data??null,stdin:e.stdin??null,readFiles:v,timeoutMs:o,signal:c,readyCapMs:l.readyCapMs})}catch(e){return e&&e.cancelled?d(`cancelled`,S.CANCELLED,t,[]):e&&e.unavailable?d(`unavailable`,S.UNAVAILABLE,t,[]):d(`internal-error`,S.INTERNAL,t,[])}let y=typeof f.ms==`number`?f.ms:D()-g;u+=f.timedOut?Math.max(y,o):y;let b,x=``,ee=[];if(f.timedOut)b=r?S.TOTAL_TIMEOUT:S.CASE_TIMEOUT;else if(f.limitHit)b=S.OUTPUT_LIMIT;else if(f.error&&f.error.kind===`InternalError`)return d(`internal-error`,S.INTERNAL,t,[]);else if(f.error)b=S.ERROR;else if(i===`call`){let t=null;try{t=JSON.parse(f.files?.[`__judge_result__.json`]??`null`)}catch{t=null}t?t.missing?(b=S.ERROR,f={...f,error:{kind:`NameError`,line:null,msg:`没有找到函数 ${e.call.fn}，请检查函数名`}}):(b=t.ok?S.PASS:S.WRONG_RETURN,x=t.actual):(b=S.ERROR,f={...f,error:{kind:`NoResult`,line:null,msg:`程序没有走到函数调用就结束了（是不是提前 exit 了？）`}})}else{let t=E(f.stdout,a)===E(e.expected,a),n=Object.entries(e.expectedFiles||{}).filter(([e,t])=>typeof f.files?.[e]!=`string`||E(f.files[e],a)!==E(t,a)).map(([e])=>e);b=t?n.length?S.WRONG_FILE:S.PASS:S.WRONG,ee=n}let w={...t,ok:b===S.PASS,kind:b,ms:Math.round(y),message:C(b,l)};if(b===S.ERROR&&(w.error=f.error,i===`call`&&w.error&&w.error.line>p.files[p.entry].split(`
`).length&&(w.error={...w.error,line:null})),!w.hidden&&b!==S.PASS&&b!==S.ERROR&&(i===`call`?(w.expected=JSON.stringify(e.expectedReturn),w.actualReturn=x):(w.expected=e.expected,w.stdout=f.stdout??``,b===S.WRONG_FILE&&(w.files=ee.map(t=>({path:t,expected:e.expectedFiles[t],actual:typeof f.files?.[t]==`string`?f.files[t]:null}))))),b===S.CASE_TIMEOUT||b===S.TOTAL_TIMEOUT||b===S.OUTPUT_LIMIT)return h(m,w);m.push(w)}return{status:m.every(e=>e.ok)?`pass`:`fail`,attempt:!0,settle:m.length===r.length,retry:!1,cases:m,totalMs:Math.round(u)}}function oe(e){async function t(t){(e.state===`idle`||e.state===`loadError`)&&e.boot();let n=await e.whenReady(t);if(n!==`ready`)throw{unavailable:!0,reason:n}}let n=Promise.resolve();async function r({code:n,files:r,entry:i,data:a,stdin:o,readFiles:s,timeoutMs:c,signal:l,readyCapMs:u=x.readyCapMs}){if(l?.aborted||(await t(u),l?.aborted))throw{cancelled:!0};let d={files:r||{"main.py":n},entry:i||`main.py`,stdin:o??null,read:s||[]};return new Promise((t,r)=>{let i=``,o=!1,s=0,u=null,f=e.onStatus,p=e.onOutput,m=()=>{h(()=>r({cancelled:!0})),e.stop()};function h(t){o||(o=!0,clearTimeout(u),e.onStatus=f,e.onOutput=p,l?.removeEventListener?.(`abort`,m),t())}let g=()=>s?D()-s:0;e.onOutput=e=>{i+=e},e.onStatus=(e,n)=>{e!==`running`&&(e===`done`?h(()=>t({stdout:i,error:n?.error??null,timedOut:!1,limitHit:!1,ms:g(),files:n?.files??null})):e===`stopped`||e===`timeout`?h(()=>t({stdout:i,error:null,timedOut:!0,limitHit:!1,ms:g()})):e===`outputLimit`||e===`outputLimitStopped`?h(()=>t({stdout:i,error:null,timedOut:!1,limitHit:!0,ms:g()})):e===`loadError`?h(()=>r({unavailable:!0})):f?.(e,n))},l?.addEventListener?.(`abort`,m);try{if(s=D(),!e.run(n,a,d))return h(()=>r({unavailable:!0,reason:`not-ready`}));u=setTimeout(()=>{o||e.stop()},c)}catch(e){h(()=>r(e instanceof Error?e:Error(String(e))))}})}return{exec(e){let t=n.then(()=>r(e));return n=t.catch(()=>{}),t}}}var se={url:`https://aqlcunkmggzzvyavlkjg.supabase.co`,anonKey:`sb_publishable_Ic9p2Y68XVralcZcAO8b6w_SjeEOIUJ`},ce=`aqlcunkmggzzvyavlkjg`;function le(e){try{let t=new URL(String(e));return/^https?:$/.test(t.protocol)?t.hostname.toLowerCase():``}catch{return``}}var ue=le(se.url);function de(e){let t=le(e);return!t||t===ue||t.split(`.`)[0]===ce||t.includes(ce)}function fe(){try{let e={url:``,anonKey:``};return!e||typeof e.url!=`string`||typeof e.anonKey!=`string`||!e.url.trim()||!e.anonKey.trim()||de(e.url.trim())?{url:``,anonKey:``}:{url:e.url.trim(),anonKey:e.anonKey.trim()}}catch{return{url:``,anonKey:``}}}function pe(){try{if(typeof location<`u`&&/^(localhost|127\.0\.0\.1)$/.test(location.hostname)){let e=JSON.parse(localStorage.getItem(`suipian.cloudConfig`));if(e&&typeof e.url==`string`&&typeof e.anonKey==`string`)return{url:e.url,anonKey:e.anonKey}}}catch{}return fe()}var me=pe(),he=`suipian.progress`,A=18e5;function j(){return{version:3,onboarded:!1,xp:0,hearts:5,heartsAt:Date.now(),streak:0,lastDay:null,done:{},lessonsCompleted:0,installTipClosed:!1,lastActive:0,prefs:{sound:!0,haptics:!0,soundStyle:`J`}}}function ge(e){let t=j();return t.installTipClosed=!!e.installTipClosed,{state:t,notice:`课程改版为关卡模式，旧版的学习记录不再使用，请从第一关开始。`}}var _e=`suipian.progress.unreadable.`,ve=3;function ye(e){try{localStorage.setItem(_e+Date.now(),e);let t=[];for(let e=0;e<localStorage.length;e++){let n=localStorage.key(e);n&&n.startsWith(_e)&&t.push(n)}for(t.sort();t.length>ve;)localStorage.removeItem(t.shift())}catch{}}function be(){let e=[];try{for(let t=0;t<localStorage.length;t++){let n=localStorage.key(t);n&&n.startsWith(_e)&&e.push({key:n,savedAt:Number(n.slice(28)),raw:localStorage.getItem(n)})}}catch{}return e.sort((e,t)=>t.savedAt-e.savedAt)}function xe(){let e;try{e=localStorage.getItem(he)}catch{return{state:j(),notice:`这个浏览器不允许保存进度（可能是无痕模式），关掉页面后进度会丢失。`}}if(!e)return{state:j(),notice:null};let t;try{t=JSON.parse(e)}catch{return ye(e),{state:j(),notice:`本机记录损坏，已从头开始。`}}if(t&&(t.version===1||t.version===2))return ye(e),ge(t);if(!t||t.version!==3)return ye(e),{state:j(),notice:`学习记录的格式无法识别，已从头开始。`};let n=j(),r={...n.prefs,...t.prefs&&typeof t.prefs==`object`?t.prefs:{}};return/^[A-J]$/.test(r.soundStyle)||(r.soundStyle=`J`),delete r.keySound,{state:{...n,...t,prefs:r},notice:null}}function Se(e){try{return e.lastActive=Date.now(),localStorage.setItem(he,JSON.stringify(e)),!0}catch{return!1}}function Ce(){try{localStorage.removeItem(he)}catch{}return j()}function M(e,t=Date.now()){if(e.hearts>=5)return e.heartsAt=t,0;let n=Math.floor((t-e.heartsAt)/A);return n>0&&(e.hearts=Math.min(5,e.hearts+n),e.heartsAt+=n*A,e.hearts>=5&&(e.heartsAt=t)),e.hearts>=5?0:A-(t-e.heartsAt)}function we(e,t=Date.now()){M(e,t),e.hearts>=5&&(e.heartsAt=t),e.hearts=Math.max(0,e.hearts-1)}function Te(e=new Date){let t=e=>String(e).padStart(2,`0`);return`${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())}`}function Ee(e,t){let[n,r,i]=e.split(`-`).map(Number),[a,o,s]=t.split(`-`).map(Number);return Math.round((Date.UTC(a,o-1,s)-Date.UTC(n,r-1,i))/864e5)}function De(e,t=new Date){let n=Te(t);return e.lastDay!==n&&(e.streak=e.lastDay&&Ee(e.lastDay,n)===1?e.streak+1:1,e.lastDay=n,!0)}function N(e,t=new Date){return e.lastDay&&Ee(e.lastDay,Te(t))<=1?e.streak:0}var Oe=/^[A-Za-z0-9_-]{1,64}$/,ke=/^\d{4}-\d{2}-\d{2}$/,Ae=/^[0-9a-f]{8}$/,P=5e3;function je(){let e=globalThis.crypto;if(e?.randomUUID)return e.randomUUID().replace(/-/g,``).slice(0,24);let t=``;for(let e=0;e<24;e++)t+=Math.floor(Math.random()*16).toString(16);return t}var F=e=>typeof e==`string`&&Oe.test(e)&&e!==`__proto__`,I=e=>Number.isFinite(e)&&e>=0?Math.floor(e):0,Me=e=>JSON.parse(JSON.stringify(e)),Ne=e=>{let[t,n,r]=e.split(`-`).map(Number);return Date.UTC(t,n-1,r)},Pe=e=>{let t=new Date(e),n=e=>String(e).padStart(2,`0`);return`${t.getUTCFullYear()}-${n(t.getUTCMonth()+1)}-${n(t.getUTCDate())}`},Fe=(e,t)=>Math.round((Ne(t)-Ne(e))/864e5),Ie=(e,t)=>Pe(Ne(e)+t*864e5),Le=e=>typeof e==`string`&&ke.test(e)&&Pe(Ne(e))===e;function Re(e){if(!e.length)return 0;let t=1;for(let n=e.length-1;n>0&&Fe(e[n-1],e[n])===1;n--)t++;return t}function ze({gen:e=1,lineage:t=je()}={}){return{schema:1,gen:e,lineage:t,xp:{},runs:{},done:{},days:[],hearts:{n:5,msToNext:0},prefs:{sound:!0,haptics:!0,soundStyle:`J`},imported:{}}}function Be(e){if(!e||typeof e!=`object`||Array.isArray(e))return{ok:!1,code:`invalid`,message:`账号记录不是有效的对象`};if(!Number.isInteger(e.schema)||e.schema<1)return{ok:!1,code:`invalid`,message:`账号记录缺少数据版本`};if(e.schema>1)return{ok:!1,code:`schema-newer`,message:`账号记录来自更新的版本，请先更新应用`};if(!Number.isInteger(e.gen)||e.gen<1)return{ok:!1,code:`invalid`,message:`账号记录的代数无效`};if(!F(e.lineage))return{ok:!1,code:`invalid`,message:`账号记录缺少编号`};let t=ze({gen:e.gen,lineage:e.lineage}),n=(e,t)=>{if(e&&typeof e==`object`)for(let[n,r]of Object.entries(e))F(n)&&(t[n]=I(r))};if(n(e.xp,t.xp),n(e.runs,t.runs),e.done&&typeof e.done==`object`)for(let[n,r]of Object.entries(e.done))F(n)&&(t.done[n]=Le(r)?r:``);if(Array.isArray(e.days)&&(t.days=[...new Set(e.days.filter(Le))].sort()),e.hearts&&typeof e.hearts==`object`){let n=Math.min(5,I(e.hearts.n));t.hearts={n,msToNext:n>=5?0:Math.min(A,I(e.hearts.msToNext))}}if(e.prefs&&typeof e.prefs==`object`&&(t.prefs={sound:e.prefs.sound!==!1,haptics:e.prefs.haptics!==!1,soundStyle:/^[A-J]$/.test(e.prefs.soundStyle)?e.prefs.soundStyle:`J`}),e.imported&&typeof e.imported==`object`)for(let[n,r]of Object.entries(e.imported))F(n)&&r&&(t.imported[n]=typeof r==`string`&&Ae.test(r)?r:!0);return{ok:!0,doc:t}}var Ve=e=>Object.values(e.xp).reduce((e,t)=>e+t,0),He=e=>Object.values(e.runs).reduce((e,t)=>e+t,0);function Ue(e){let t=e=>Object.fromEntries(Object.keys(e).sort().map(t=>[t,e[t]]));return JSON.stringify({...e,xp:t(e.xp),runs:t(e.runs),done:t(e.done),imported:t(e.imported),prefs:t(e.prefs),hearts:t(e.hearts)})}function We(e,t){let n=Be(e),r=Be(t);return n.ok&&r.ok&&Ue(n.doc)===Ue(r.doc)}function Ge(e,t,n={}){let r=Be(e),i=Be(t);if(!r.ok)return{error:{code:r.code,message:`本机记录：`+r.message}};if(!i.ok)return{error:{code:i.code,message:`云端记录：`+i.message}};let a=r.doc,o=i.doc;if(a.gen!==o.gen)return a.gen>o.gen?{doc:a,outcome:`local-newer`}:{doc:o,outcome:`remote-newer`};if(a.lineage!==o.lineage)return{doc:a,outcome:`conflict`,remote:o};let s=ze({gen:a.gen,lineage:a.lineage});for(let e of[`xp`,`runs`])for(let t of new Set([...Object.keys(a[e]),...Object.keys(o[e])]))s[e][t]=Math.max(a[e][t]??0,o[e][t]??0);for(let e of new Set([...Object.keys(a.done),...Object.keys(o.done)])){let t=a.done[e],n=o.done[e];s.done[e]=t?n?t<n?t:n:t:n??``}return s.days=[...new Set([...a.days,...o.days])].sort(),s.hearts=Me(n.localHeartsDirty?a.hearts:o.hearts),s.prefs=Me(n.localPrefsDirty?a.prefs:o.prefs),s.imported={...a.imported,...o.imported},{doc:s,outcome:`merged`}}function Ke(e){if(!e||typeof e!=`object`)return null;let t=Object.keys(e.done??{}).filter(t=>e.done[t]).sort(),n=JSON.stringify([I(e.xp),I(e.lessonsCompleted),t,e.lastDay??null,I(e.streak)]),r=2166136261;for(let e=0;e<n.length;e++)r^=n.charCodeAt(e),r=Math.imul(r,16777619)>>>0;return r.toString(16).padStart(8,`0`)}function qe(e){if(!Le(e?.lastDay)||!Number.isInteger(e.streak)||e.streak<1)return[];let t=Math.min(e.streak,P),n=[];for(let r=t-1;r>=0;r--)n.push(Ie(e.lastDay,-r));return n}function Je(e,{deviceId:t,guestId:n,gen:r=1,lineage:i=je(),now:a=Date.now()}={}){if(!F(t)||!F(n))return{ok:!1,code:`bad-ids`,message:`缺少设备编号或游客编号`};if(!e||typeof e!=`object`||e.version!==3)return{ok:!1,code:`guest-invalid`,message:`游客记录不是第 3 版格式`};if(!Number.isFinite(e.xp)||e.xp<0)return{ok:!1,code:`guest-invalid`,message:`游客记录的 XP 无效`};let o=ze({gen:r,lineage:i});if(o.xp[t]=I(e.xp),o.runs[t]=I(e.lessonsCompleted),e.done&&typeof e.done==`object`)for(let[t,n]of Object.entries(e.done))n&&F(t)&&(o.done[t]=``);o.days=qe(e);let s={hearts:Math.min(5,I(e.hearts??5)),heartsAt:Number.isFinite(e.heartsAt)?e.heartsAt:a},c=M(s,a);o.hearts={n:s.hearts,msToNext:s.hearts>=5?0:Math.round(c)};let l=e.prefs&&typeof e.prefs==`object`?e.prefs:{};return o.prefs={sound:l.sound!==!1,haptics:l.haptics!==!1,soundStyle:/^[A-J]$/.test(l.soundStyle)?l.soundStyle:`J`},o.imported[n]=Ke(e),{ok:!0,doc:o}}function Ye(e,t=null,n=Date.now()){let r=e.days,i=e.hearts.n;return{version:3,onboarded:t?.onboarded??!1,xp:Ve(e),hearts:i,heartsAt:i>=5?n:n-(A-e.hearts.msToNext),streak:Re(r),lastDay:r.length?r[r.length-1]:null,done:Object.fromEntries(Object.keys(e.done).map(e=>[e,!0])),lessonsCompleted:He(e),installTipClosed:t?.installTipClosed??!1,lastActive:t?.lastActive??0,prefs:{...e.prefs}}}function Xe(e,t,{deviceId:n,today:r,now:i=Date.now(),baseline:a=null}){if(!F(n))throw Error(`缺少设备编号`);let o=Me(e),s={xp:!1,runs:!1,done:!1,days:!1,hearts:!1,prefs:!1},c=a?I(a.xp):Ve(o),l=a?I(a.lessonsCompleted):He(o),u=I(t.xp)-c;u>0&&(o.xp[n]=(o.xp[n]??0)+u,s.xp=!0);let d=I(t.lessonsCompleted)-l;d>0&&(o.runs[n]=(o.runs[n]??0)+d,s.runs=!0);for(let[e,n]of Object.entries(t.done??{}))n&&F(e)&&!(e in o.done)&&(o.done[e]=Le(r)?r:``,s.done=!0);let f=qe(t).filter(e=>!o.days.includes(e));Le(t.lastDay)&&!o.days.includes(t.lastDay)&&!f.includes(t.lastDay)&&f.push(t.lastDay),f.length&&(o.days=[...new Set([...o.days,...f])].sort(),s.days=!0);let p={hearts:Math.min(5,I(t.hearts)),heartsAt:Number.isFinite(t.heartsAt)?t.heartsAt:i},m=M(p,i),h={n:p.hearts,msToNext:p.hearts>=5?0:Math.round(m)};h.n!==o.hearts.n&&(s.hearts=!0),o.hearts=h;let g=t.prefs??{},_={sound:g.sound!==!1,haptics:g.haptics!==!1,soundStyle:/^[A-J]$/.test(g.soundStyle)?g.soundStyle:`J`};return JSON.stringify(_)!==JSON.stringify(o.prefs)&&(o.prefs=_,s.prefs=!0),{doc:o,changed:s}}function Ze(e,{deviceId:t,guestId:n,cloudDoc:r=null,now:i=Date.now(),choice:a=null}){if(r){let o=Be(r);if(!o.ok)return{ok:!1,code:o.code,message:o.message};let s=o.doc.imported[n];if(s){let t=Ke(e);if(s===!0||s===t)return{ok:!0,doc:o.doc,outcome:`already-imported`};if(a===`keep-cloud`)return{ok:!0,doc:o.doc,outcome:`kept-cloud`};if(a!==`replace`)return{ok:!0,doc:o.doc,outcome:`guest-changed`,choices:[`keep-cloud`,`replace`],message:`这份游客记录导入后又有新的学习进度，请选择保留云端，或用新的游客记录替换`}}let c=Je(e,{deviceId:t,guestId:n,gen:o.doc.gen+1,now:i});return c.ok?{ok:!0,doc:c.doc,outcome:`replaced`}:c}let o=Je(e,{deviceId:t,guestId:n,gen:1,now:i});return o.ok?{ok:!0,doc:o.doc,outcome:`created`}:o}var Qe=`suipian.progress`,$e=`suipian.guestId`,et=`suipian.device`,tt=`suipian.session`,nt=`suipian.acct.`,rt=e=>nt+e;function it(e,t){try{return{ok:!0,value:e.getItem(t)}}catch{return{ok:!1}}}function at(e,t,n){try{return e.setItem(t,n),!0}catch{return!1}}function ot(e,t){try{return e.removeItem(t),!0}catch{return!1}}function st(e,t){let n=it(e,t);if(!n.ok)return{ok:!1,code:`read-failed`,message:`无法读取本机编号`};if(F(n.value))return{ok:!0,id:n.value};let r=je();if(!at(e,t,r))return{ok:!1,code:`save-failed`,message:`无法保存本机编号（存储被禁用或已满）`};let i=it(e,t);return!i.ok||i.value!==r?{ok:!1,code:`save-failed`,message:`本机编号保存后读回不一致`}:{ok:!0,id:r}}var ct=e=>st(e,et),lt=e=>st(e,$e);function ut(e){let t=it(e,Qe);if(!t.ok)return{status:`read-failed`};if(t.value===null)return{status:`none`};try{let e=JSON.parse(t.value);if(e&&typeof e==`object`)return{status:`ok`,raw:t.value,state:e}}catch{}return{status:`corrupt`,raw:t.value}}function dt(e){let t=it(e,tt);return t.ok&&F(t.value)?t.value:null}function ft(e,t){return t===null?ot(e,tt):F(t)?at(e,tt,t):!1}function pt(e,t,{now:n=Date.now()}={}){if(!F(t))return{ok:!1,code:`bad-user`,message:`账号编号无效`};let r=it(e,rt(t));if(!r.ok)return{ok:!1,code:`read-failed`,message:`无法读取这个账号的本机副本`};let i=r.value;if(i===null)return{ok:!0,copy:null};let a;try{a=JSON.parse(i)}catch{return{ok:!1,code:`corrupt`,message:`这个账号的本机副本损坏`}}let o=Be(a?.doc);if(!o.ok)return{ok:!1,code:o.code,message:o.message};let s=o.doc;if(Number.isFinite(a.savedAt)&&n>=a.savedAt&&s.hearts.n<5){let e={hearts:s.hearts.n,heartsAt:a.savedAt-(A-s.hearts.msToNext)},t=M(e,n);s.hearts={n:e.hearts,msToNext:e.hearts>=5?0:Math.round(t)}}return{ok:!0,copy:{doc:s,base:a.base??null,dirty:{hearts:!!a.dirty?.hearts,prefs:!!a.dirty?.prefs,content:!!a.dirty?.content}}}}function mt(e,t,n,{now:r=Date.now(),expectEmpty:i=!1}={}){if(!F(t))return!1;if(i){let n=it(e,rt(t));if(!n.ok||n.value!==null)return!1}let a=Be(n?.doc);if(!a.ok)return!1;let o=JSON.stringify({doc:a.doc,base:n.base??null,dirty:{hearts:!!n.dirty?.hearts,prefs:!!n.dirty?.prefs,content:!!n.dirty?.content},savedAt:r});return at(e,rt(t),o)}function ht(e,t){return F(t)?ot(e,rt(t)):!1}function gt(e,t){let n=ht(e,t),r=ft(e,null);return n&&r}function _t(e,{userChoseTransfer:t,uploadOk:n,uploaded:r,readBack:i,guestSnapshotRaw:a}){if(t!==!0||n!==!0||!i||!r||!We(r,i)||typeof a!=`string`)return!1;let o=it(e,Qe);return!o.ok||o.value!==a?!1:ot(e,Qe)}var vt=`suipian.staleAuth`,yt=`suipian.auth`;function bt(e,t){return e&&e!==`cloud-off`&&e!==t?`proj:${e}:`:``}function xt(e,t){if(!t)return e;let n=e=>e===`suipian.session`||e===`suipian.auth`||e===`suipian.staleAuth`||e.startsWith(`suipian.acct.`)?t+e:e;return{getItem:t=>e.getItem(n(t)),setItem:(t,r)=>e.setItem(n(t),r),removeItem:t=>e.removeItem(n(t))}}function St({storage:e,api:t,projectId:n=null,legacyProject:r=null,now:i=()=>Date.now(),today:a=()=>Te(),schedule:o=(e,t)=>setTimeout(e,t),onStatus:s=()=>{},onState:c=()=>{},onNotice:l=()=>{}}){let u=xt(e,bt(n,r)),d=null,f=null,p=``,m=null,h=!1,g=null,_=!1,v=null,y=null,b=0,x=null,S=``,ee=null,C=(e,t=``)=>{m=e,S=t;try{s(e,t)}catch{}},w=()=>{try{let e=JSON.parse(u.getItem(yt));if(!e||!e.session||!e.session.userId)return null;if(n&&(e.project||r)!==n){try{u.setItem(vt,JSON.stringify({userId:e.session.userId,email:String(e.session.email||``).trim().toLowerCase(),project:e.project||r||``}))}catch{}return null}return e.session}catch{return null}},T=()=>{try{d?u.setItem(yt,JSON.stringify(n?{session:d,project:n}:{session:d})):u.removeItem(yt)}catch{}},E=e=>!!e&&(e.base==null||!!(e.dirty&&(e.dirty.hearts||e.dirty.prefs||e.dirty.content))),D=()=>{try{let e=JSON.parse(u.getItem(vt));return e&&typeof e.userId==`string`?e:null}catch{return null}},te=()=>{try{u.removeItem(vt)}catch{}},O=e=>e.kind===`network`?`offline`:e.kind===`auth`?`need-login`:(e.kind,`error`);function k(){let e=w();return!e||e.userId!==f||!e.refreshToken||d&&(e.refreshToken===d.refreshToken||!(e.expiresAt>d.expiresAt))?!1:(d=e,p=e.email||p,!0)}async function ne(){if(k(),!d)return{ok:!1,kind:`auth`,message:`需要重新登录`};if(d.expiresAt-i()>6e4)return{ok:!0};let e=await t.refresh(d);return e.ok&&e.session.userId===f?(d=e.session,p=d.email||p,T(),{ok:!0}):!e.ok&&e.kind===`auth`&&k()&&d.expiresAt-i()>6e4?{ok:!0}:e.ok?{ok:!1,kind:`auth`,message:`登录账号不一致`}:e}function re(e=null){let t=dt(u);if(!t)return null;let n=pt(u,t,{now:i()});if(!n.ok||!n.copy)return null;let r=w();d=r&&r.userId===t?r:null,f=t,p=d?.email||``;let a=Ye(n.copy.doc,e?{...e,onboarded:!0}:{...j(),onboarded:!0},i());return x={xp:a.xp,lessonsCompleted:a.lessonsCompleted},h=E(n.copy),C(d?`pending`:`need-login`),{userId:f,email:p,state:a}}function ie(e){if(!f)return{ok:!1,code:`no-account`};let t=ct(u);if(!t.ok)return{ok:!1,code:t.code,message:t.message};let n=pt(u,f,{now:i()});if(!n.ok||!n.copy)return{ok:!1,code:n.code||`no-copy`,message:n.message};let{doc:r,changed:o}=Xe(n.copy.doc,e,{deviceId:t.id,today:a(),now:i(),baseline:x}),s={hearts:n.copy.dirty.hearts||o.hearts,prefs:n.copy.dirty.prefs||o.prefs,content:n.copy.dirty.content||o.xp||o.runs||o.done||o.days};return mt(u,f,{doc:r,base:n.copy.base,dirty:s},{now:i()})?(x={xp:e.xp,lessonsCompleted:e.lessonsCompleted},E({base:n.copy.base,dirty:s})&&(h=!0,m!==`offline`&&m!==`need-login`&&C(`pending`),ae(1500)),{ok:!0}):{ok:!1,code:`save-failed`,message:`无法保存到本机`}}function ae(e=1500){f&&d&&(v||(v=o(()=>{v=null,oe()},e)))}function oe(){return f?g?(_=!0,g):(g=(async()=>{try{let e,t=0,n=!1;for(;;){if(_=!1,e=await ce(),e.replacedLocal&&(n=!0),e.ok){if(b=0,_)continue;break}if(e.kind===`network`){if(_&&t++<1)continue;se()}break}return n&&e.ok?{...e,replacedLocal:!0}:e}finally{g=null}})(),g):Promise.resolve({ok:!1,kind:`no-account`})}function se(){if(y||!f||!d)return;let e=[3e3,1e4,3e4,6e4][Math.min(b,3)];b++,y=o(()=>{y=null,oe()},e)}async function ce(){C(`syncing`);let e=await ne();if(!e.ok)return C(O(e),e.message),e;for(let e=0;e<5;e++){let e=await t.getProgress(d);if(!e.ok)return C(O(e),e.message),e;let n=pt(u,f,{now:i()});if(!n.ok||!n.copy)return C(`error`,`本机账号记录读取失败`),{ok:!1,kind:`local`,message:`本机账号记录读取失败`};let r=n.copy,a,o,s=!1;if(e.row){let n=Ge(r.doc,e.row.doc,{localHeartsDirty:r.dirty.hearts,localPrefsDirty:r.dirty.prefs});if(n.error)return C(`error`,n.error.message),{ok:!1,kind:`data`,code:n.error.code,message:n.error.message};if(n.outcome===`conflict`)return C(`conflict`),{ok:!1,kind:`conflict`,message:`这个账号在别处被“覆盖”过，需要选择保留哪一份`};if(a=n.doc,o=e.row.rev,n.outcome===`remote-newer`&&r.dirty.content&&(s=!0),!We(a,e.row.doc)){let n=await t.saveProgress(d,e.row.rev,a);if(!n.ok)return C(O(n),n.message),n;if(n.rev===null)continue;o=n.rev}}else{let e=await t.createProgress(d,r.doc);if(!e.ok)return C(O(e),e.message),e;if(e.rev===null)continue;a=r.doc,o=e.rev}let p=pt(u,f,{now:i()}),m=p.ok&&p.copy?p.copy:r,g=a,v={hearts:!1,prefs:!1,content:!1};if(!We(m.doc,r.doc)){let e=Ge(m.doc,a,{localHeartsDirty:!0,localPrefsDirty:!0});if(e.doc){let t=e.outcome===`remote-newer`;t&&m.dirty.content&&(s=!0),g=e.doc,v={hearts:m.dirty.hearts,prefs:m.dirty.prefs,content:!t&&m.dirty.content},_=!0}}if(mt(u,f,{doc:g,base:o,dirty:v},{now:i()}),!We(m.doc,g)){let e=Ye(g,null,i());x={xp:e.xp,lessonsCompleted:e.lessonsCompleted},c(g)}if(h=_,C(_?`pending`:`synced`),s)try{l(`replaced`,{})}catch{}return s?{ok:!0,rev:o,replacedLocal:!0}:{ok:!0,rev:o}}return C(`error`,`同步冲突太多次，请稍后再试`),{ok:!1,kind:`server`,message:`同步冲突太多次，请稍后再试`}}let le=e=>t.sendCode(String(e).trim());async function ue(e,n,r=null){let i=await t.verifyCode(String(e).trim(),n);return i.ok?de(i.session,r):i}async function de(e,n){let r=!1;if(f&&f!==e.userId){let t=D(),n=String(e.email||``).trim().toLowerCase();if(!d&&t&&t.userId===f&&t.email&&t.email===n)r=!0;else return{ok:!1,kind:`other-account`,message:`请先退出当前账号`}}let a=await t.getProgress(e);if(!a.ok)return a;let o=a.row?Be(a.row.doc):null;if(o&&!o.ok)return{ok:!1,kind:`data`,code:o.code,message:`云端记录：`+o.message};let s=pt(u,e.userId,{now:i()});if(!s.ok)return{ok:!1,kind:`local`,message:s.message};let c=ut(u),l=c.status===`ok`&&Ke(c.state)!==Ke(j()),p=lt(u),m=!!(o&&p.ok&&o.doc.imported[p.id]),h={session:e,remote:a,remoteDoc:o?o.doc:null,copy:s.copy,guest:c,baseState:n,leaveStale:r};return l&&!s.copy&&!m?(ee=h,{ok:!0,needChoice:!0,cloudHasData:!!o&&Ve(o.doc)+Object.keys(o.doc.done).length>0,guest:{xp:c.state.xp??0,lessons:Object.keys(c.state.done??{}).filter(e=>c.state.done[e]).length}}):pe(h,null)}async function fe(e){let t=ee;return ee=null,t?pe(t,e):{ok:!1,kind:`local`,message:`没有等待选择的登录`}}async function pe(e,n){let r=e.session.userId,a=ct(u),o=lt(u);if(!a.ok)return{ok:!1,kind:`local`,message:a.message};let s,c=e.remote.row?e.remote.row.rev:null,l=!1;if(e.copy)s=e.copy.doc,c=e.copy.base??c;else if(n===`transfer`){if(!o.ok||e.guest.status!==`ok`)return{ok:!1,kind:`local`,message:`游客记录读取失败，没有转存`};let t=Ze(e.guest.state,{deviceId:a.id,guestId:o.id,cloudDoc:e.remoteDoc,now:i(),choice:`replace`});if(!t.ok)return{ok:!1,kind:`data`,message:t.message};s=t.doc,l=t.outcome===`created`||t.outcome===`replaced`}else s=e.remoteDoc??ze();if(!mt(u,r,{doc:s,base:c,dirty:{hearts:l,prefs:l,content:l}},{now:i(),expectEmpty:!e.copy}))return{ok:!1,kind:`local`,message:`无法保存到本机，登录没有完成`};if(!ft(u,r))return{ok:!1,kind:`local`,message:`无法记录当前账号`};d=e.session,f=r,p=d.email||``,T();let m=Ye(s,e.baseState?{...e.baseState,onboarded:!0}:{...j(),onboarded:!0},i());x={xp:m.xp,lessonsCompleted:m.lessonsCompleted},h=!0;let g=await oe();e.leaveStale&&te();let _=!1;if(g.ok&&l&&e.guest.status===`ok`){let n=await t.getProgress(d);n.ok&&n.row&&(_=_t(u,{userChoseTransfer:!0,uploadOk:!0,uploaded:s,readBack:n.row.doc,guestSnapshotRaw:e.guest.raw}))}let v=pt(u,r,{now:i()}),y=v.ok&&v.copy?Ye(v.copy.doc,e.baseState?{...e.baseState,onboarded:!0}:{...j(),onboarded:!0},i()):m;return x={xp:y.xp,lessonsCompleted:y.lessonsCompleted},{ok:!0,state:y,account:{userId:f,email:p},synced:g.ok,syncError:g.ok?``:g.message||``,guestCleared:_}}async function me({force:e=!1}={}){if(!f)return{ok:!0};if(h&&!e){let e=await oe();if(!e.ok)return{ok:!1,pending:!0,kind:e.kind,message:e.message}}if(d)try{await t.signOut(d)}catch{}return e&&h?ft(u,null):gt(u,f),te(),d=null,f=null,p=``,x=null,h=!1,ee=null,T(),C(null),{ok:!0}}async function he(){if(!f)return{ok:!1,kind:`no-account`};let e=await ne();if(!e.ok)return e;let n=await t.deleteAccount(d);return n.ok?(gt(u,f),d=null,f=null,p=``,x=null,h=!1,T(),C(null),{ok:!0}):n}return{restore:re,persistLocal:ie,syncNow:oe,scheduleSync:ae,sendCode:le,verify:ue,finishChoice:fe,logout:me,deleteAccount:he,account:()=>f?{userId:f,email:p}:null,status:()=>({status:m,pending:h,message:S})}}var Ct=/^[A-Za-z0-9_-]{1,64}$/,wt=`suipian.draft.`,Tt=()=>{let e=new Uint8Array(12);return(globalThis.crypto||{getRandomValues:e=>e.map(()=>Math.floor(Math.random()*256))}).getRandomValues(e),`g`+[...e].map(e=>e.toString(16).padStart(2,`0`)).join(``)},Et=()=>bt(le(me.url)||`cloud-off`,ue);function Dt(e=globalThis.localStorage,t=Et()){try{let n=xt(e,t).getItem(`suipian.session`);if(Ct.test(n||``))return t+n;let r=e.getItem(`suipian.guestId`);if(!Ct.test(r||``)){r=Tt();try{e.setItem(`suipian.guestId`,r)}catch{}}return r}catch{return`guest`}}var Ot=(e,t)=>`${wt}${e}.${t.id}.v${t.version??1}`;function kt(e,t,n){try{let r=e.getItem(Ot(t,n));if(r==null)return null;let i=JSON.parse(r);return!i||i.v!==1||typeof i.code!=`string`?null:{code:i.code,viewed:!!i.viewed,phase:i.phase===`variation`?`variation`:`original`}}catch{return null}}function At(e,t,n,{code:r,viewed:i,phase:a}){try{return e.setItem(Ot(t,n),JSON.stringify({v:1,code:r,viewed:!!i,phase:a===`variation`?`variation`:`original`,at:Date.now()})),!0}catch{return!1}}function jt(e,t,n){try{return e.removeItem(Ot(t,n)),!0}catch{return!1}}function Mt(e,t,n,r,{ms:i=500,onResult:a=()=>{}}={}){let o=null,s=()=>{o=null,a(At(e,t,n,r()))};return{schedule(){clearTimeout(o),o=setTimeout(s,i)},flush(){o!==null&&(clearTimeout(o),s())},cancel(){clearTimeout(o),o=null},pending:()=>o!==null}}function L(e,t={},...n){let r=document.createElement(e);for(let[e,n]of Object.entries(t))n!=null&&n!==!1&&(e===`class`?r.className=n:e===`text`?r.textContent=n:r.setAttribute(e,n===!0?``:n));for(let e of n.flat())e!=null&&e!==!1&&r.append(e);return r}var Nt=[`modify`,`write`],Pt=e=>Nt.includes(e?.type),Ft=/[“”‘’]/;function It(e,t){let n=E(e).split(`
`),r=E(t).split(`
`),i=Math.max(n.length,r.length);for(let e=0;e<i;e++)if(n[e]!==r[e])return n[e]===void 0?`多输出了第 ${e+1} 行`:r[e]===void 0?`少输出了第 ${e+1} 行及之后的内容`:n[e].trimEnd()===r[e].trimEnd()?`第 ${e+1} 行只有行尾空格不同`:`第 ${e+1} 行不同：期望“${n[e]}”，你的是“${r[e]}”`;return``}var Lt=e=>e&&Object.keys(e).length?Object.entries(e).map(([e,t])=>`${e} = ${JSON.stringify(t)}`).join(`，`):``,Rt=e=>`${e.fn}(${[...(e.args??[]).map(e=>JSON.stringify(e)),...Object.entries(e.kwargs??{}).map(([e,t])=>`${e}=${JSON.stringify(t)}`)].join(`, `)})`;function zt(r,c){let l=c.storage??globalThis.localStorage,{exec:u,runner:d,ui:f}=c,p=Dt(l),m=r.variation??r.variant??null,h=m&&Array.isArray(m.tests)&&m.tests.length&&m.id?{...r,isVariation:!0,id:m.id,version:m.version??r.version??1,type:`write`,prompt:m.prompt??``,given:m.given??r.given,tests:m.tests,hints:m.hints??[],reference:m.solution??m.reference??``,mistakes:m.mistakes??[],starter:m.starter??m.code??``,code:void 0,files:m.files,entry:m.entry,checkMode:m.checkMode??r.checkMode,compare:m.compare??r.compare,worked:void 0}:null,g=e=>e.type===`modify`?e.code??``:e.starter??``,_=kt(l,p,r),v=_?.viewed??!1,y=r,b=g(r),S=h&&_?.phase===`variation`?`variation`:`original`;S===`variation`&&(y=h,b=g(h));let ee=S===`variation`?kt(l,p,h):_,C=0,w=!1,T=!1,D=!1,te=!1,O=null,k=null,ne=!1,re=[],ie=e=>String(e??``).replace(/\s+/g,``);function oe(){let e=r.worked;return!e||!e.code||y.isVariation||r.reference&&ie(e.code).includes(ie(r.reference))?null:L(`details`,{class:`ct-worked`,"data-worked":``},L(`summary`,{text:`先看一个例子（不是本题的答案）`}),L(`pre`,{class:`ct-worked-code`,text:e.code}),e.output==null?null:L(`pre`,{class:`ct-worked-out`,text:`输出：
`+e.output}),e.explain?L(`p`,{class:`ct-worked-explain`,text:e.explain}):null)}function se(){return re=(y.tests||[]).filter(e=>!e.hidden),[y.isVariation?L(`div`,{class:`ct-variation`,role:`note`,"data-variation":``},L(`b`,{text:`变化题`}),L(`p`,{text:`原题已经通过。再做一道有变化的题：不多加 XP，答错也不扣红心。`}),L(`p`,{class:`ct-vprompt`,text:y.prompt})):null,oe(),y.given?.length?L(`p`,{class:`ct-given`},`已经准备好的变量：`,L(`code`,{text:y.given.join(`、`)})):null,re.length?L(`div`,{class:`ct-samples`,role:`list`,"aria-label":`例子`},re.map((e,t)=>L(`div`,{class:`ct-sample`,role:`listitem`},L(`b`,{text:`例 ${t+1}${e.name?` · `+e.name:``}`}),Lt(e.data)?L(`div`,{text:`给定：`+Lt(e.data)}):null,e.call?L(`div`,{text:`调用：`+Rt(e.call)}):null,e.stdin==null?null:L(`div`,{text:`输入：`+(Array.isArray(e.stdin)?e.stdin.join(` ⏎ `):String(e.stdin).replace(/\n$/,``).replace(/\n/g,` ⏎ `))}),e.call?L(`div`,{text:`应该返回：`+JSON.stringify(e.expectedReturn)}):L(`pre`,{class:`ct-exp`,text:`应该输出：
`+(e.expected??``)})))):null]}let ce=L(`div`,{class:`ct-prompt`},se()),le=0;function ue(){le||(le=requestAnimationFrame(()=>{le=0;let e=De.closest(`.lesson`);if(!e||!j.dom.isConnected)return;let t=j.coordsAtPos(j.state.selection.main.head),n=t?{top:t.top,bottom:t.bottom}:fe.getBoundingClientRect(),r=e.getBoundingClientRect();n.bottom>r.bottom-12?e.scrollTop+=n.bottom-(r.bottom-12):n.top<r.top+12&&(e.scrollTop-=r.top+12-n.top)}))}let de=()=>{De.isConnected?j.hasFocus&&ue():window.visualViewport?.removeEventListener(`resize`,de)};window.visualViewport?.addEventListener(`resize`,de);let fe=L(`div`,{class:`ct-editor`,"aria-label":`代码编辑区`,role:`group`}),pe=L(`span`,{class:`ct-savenote`,text:`代码暂存于此设备`}),me=e=>{pe.textContent=e?`代码暂存于此设备`:`⚠ 这台设备存不下草稿（存储不可用）。当前页面里的代码还在，退出后会丢失`,pe.classList.toggle(`bad`,!e)},he=()=>Mt(l,p,y,()=>y.isVariation?{code:_e(),viewed:!1}:{code:_e(),viewed:v,phase:S},{onResult:me}),A=he(),j=n(fe,``,[t.changeFilter.of(()=>!w),o.updateListener.of(e=>{e.docChanged&&ne&&(c.onChange?.(),A.schedule()),ne&&(e.docChanged||e.selectionSet||e.focusChanged)&&ue()})]);j.contentDOM.setAttribute(`aria-label`,`Python 代码`);let ge=ee?ee.code:b;e(j,ge,ge.length),ne=!0;let _e=()=>j.state.doc.toString(),ve=L(`div`,{id:`keyboard`,class:`ct-kb`});function ye(){ve.hidden=D||te,Ce.textContent=D?`回到内置键盘`:te?`展开键盘`:`收起键盘`,ne&&setTimeout(ue,60)}function be(){D=!D,te=!1,a(j,D),ye()}i(ve,j,{onToggleSystem:be});let xe=(e,t,n=`ct-btn`,r={})=>{let i=L(`button`,{type:`button`,class:n,...r},e);return i.addEventListener(`click`,()=>{i.disabled||t()}),i},Se=xe(`运行`,()=>T?O?.abort():je(),`ct-btn run`,{"data-run":``}),Ce=xe(`收起键盘`,()=>{D?be():(te=!te,ye())},`ct-btn ghost`,{"data-toggle-kb":``}),M=xe(`重新开始`,()=>Ie(),`ct-btn ghost`,{"data-reset":``}),we=L(`div`,{class:`ct-status`,role:`status`}),Te=L(`div`,{class:`ct-results`,"aria-live":`polite`,"data-results":``}),Ee=L(`div`,{class:`ct-toolbar`},Se,M,Ce),De=L(`div`,{class:`ct-root`,"data-code-task":r.id||``},ce,fe,Ee,L(`div`,{class:`ct-meta`},pe),we,Te);ye();function N(){let e=d.state;we.replaceChildren(),e===`ready`||e===`running`?we.textContent=`Python 已就绪`:e===`loadError`?we.append(L(`span`,{text:(c.pythonUnavailable?.()??`Python 还没有加载成功。`)+` `}),xe(`重试加载`,()=>d.boot(),`ct-btn small`,{"data-retry-python":``})):we.textContent=`Python 加载中…（可以先写代码）`}N();let Oe=!1,ke=setInterval(()=>{De.isConnected?(Oe=!0,T||N()):Oe&&clearInterval(ke)},600);function Ae(e){T=e,Se.textContent=e?`停止`:`运行`,c.onChange?.()}function P(e,t,n=``){Te.className=`ct-results `+n,Te.replaceChildren(L(`h3`,{text:e}),...t.filter(Boolean).map(e=>typeof e==`string`?L(`p`,{text:e}):e))}async function je(){if(T||w)return;let e=_e(),t=re[0]??y.tests[0];Ae(!0),O=new AbortController,P(`运行中…`,[`只是试一试，不判对错，也不扣红心。`]);try{let n=F(e),r=await u.exec({code:e,files:n,entry:y.entry||`main.py`,data:t?.data??null,stdin:t?.stdin??null,readFiles:[],timeoutMs:x.caseMs,signal:O.signal}),i=[];r.timedOut?i.push(L(`p`,{class:`bad`,text:`运行超过 ${x.caseMs/1e3} 秒，已停止（可能有死循环）。这不影响答题，也不扣红心。`})):r.limitHit&&i.push(L(`p`,{class:`bad`,text:`输出超过安全上限，已停止，请检查循环或打印次数。这不影响答题，也不扣红心。`})),r.error?i.push(L(`pre`,{class:`ct-out bad`,text:(r.stdout?r.stdout+`
`:``)+(r.error.file&&r.error.file!==(y.entry||`main.py`)?`[${r.error.file}] `:``)+s(r.error)})):!r.timedOut&&!r.limitHit&&i.push(L(`pre`,{class:`ct-out`,text:r.stdout||`程序运行完成，没有输出`})),P(`运行结果（试一试，不判对错）`,i)}catch(e){e&&e.cancelled?P(`已停止`,[`这次运行已停止，不影响答题。`]):e&&e.unavailable?P(`Python 还没准备好`,[`这次运行没有执行，不影响答题，也不扣红心。请稍等或点“重试加载”。`],`warn`):P(`运行没有成功`,[`应用内部出了点问题，不影响答题，请再试一次。`],`warn`)}finally{Ae(!1),O=null,N()}}function F(e){if(!y.files)return;let t=y.entry||`main.py`;return Object.fromEntries(y.files.map(n=>[n.path,n.path===t?e:n.content]))}async function I(){if(T)return{status:`internal-error`,attempt:!1,settle:!1,retry:!0,cases:[],totalMs:0};let e=_e();A.flush(),Ae(!0),O=new AbortController,P(`检查中…`,[`正在用几组数据运行你的代码。思考和修改不限时；运行只有安全保护时限。`]);let t;try{let n={tests:y.tests,checkMode:y.checkMode||`output`,compare:y.compare||`strict`};y.files?(n.files=y.files.map(t=>({path:t.path,content:t.path===(y.entry||`main.py`)?e:t.content})),n.entry=y.entry):n.code=e,t=await ae(n,u,{signal:O.signal})}catch{t={status:`internal-error`,attempt:!1,settle:!1,retry:!0,totalMs:0,cases:[{name:``,hidden:!1,ok:!1,kind:`internal`,ms:0,message:`判题出了内部问题，这次不算作答，代码已保留，请重试`}]}}finally{Ae(!1),O=null,N()}if(t.status===`fail`&&Ft.test(e)&&t.cases.some(e=>e.kind===`error`&&e.error?.kind===`SyntaxError`))return t={...t,status:`curly-quotes`,attempt:!1,settle:!1,retry:!0},k=t,P(`代码里有弯引号，这次不算作答`,[`Python 只认直引号 " 或 '，不认弯引号 “ ” ‘ ’。请改成直引号再检查（用内置键盘输入就是直引号）。`,`不扣红心，代码已保留。`],`warn`),t;if(k=t,Pe(t),h&&!y.isVariation&&v&&t.status===`pass`)return t={...t,attempt:!1,settle:!1,retry:!0,assisted:!0},k=t,Me(),t;if(y.isVariation){if(t.status===`pass`)t={...t,attempt:!0,settle:!0,variation:!0};else if(t.status===`fail`){t={...t,attempt:!1,settle:!1,retry:!0,variation:!0};let e=Te.querySelector(`h3`);e&&(e.textContent+=`（变化题：不扣红心，可以继续改）`)}k=t}return t}function Me(){A.flush(),S=`variation`,At(l,p,r,{code:_e(),viewed:v,phase:S}),y=h,b=g(h),A=he();let t=kt(l,p,h),n=t?t.code:b;ne=!1,e(j,n,n.length),ne=!0,ce.replaceChildren(...se().filter(e=>e!=null)),C=0,k=null,P(`原题通过了 ✓`,[`因为看过参考解法，还要再做一道有变化的题才算完成。下面是变化题：不多加 XP，没做对也不扣红心。`],`ok`),A.schedule(),c.onChange?.(),De.scrollIntoView?.({block:`start`})}function Ne(e,t){for(let t of y.mistakes||[]){let n=t.match||{};if(!(n.test&&n.test!==e.name)&&!(n.errorKind&&n.errorKind!==e.error?.kind)&&(n.got===void 0||E(n.got)===E(e.stdout??e.actualReturn??``)))return t.why}return t?.note||``}function Pe(e){let t=y.tests.length,n=e.cases.filter(e=>e.ok).length,r,i=``;e.status===`pass`?(r=`全部通过 ✓（${n}/${t} 组）`,i=`ok`):e.status===`fail`?(r=`还没通过：${n}/${t} 组通过`,i=`bad`):(r={timeout:`运行时间太长，已停止`,"output-limit":`输出太多，已停止`,unavailable:`Python 还没准备好`,cancelled:`已取消`,"internal-error":`判题出了内部问题`}[e.status]||`这次没有判定`,i=`warn`);let a=[];e.attempt||a.push(L(`p`,{class:`warn`,text:(e.cases.at(-1)?.message||``)+(e.status,``)})),e.cases.forEach((t,n)=>{let r=y.tests[n],i=L(`div`,{class:`ct-case `+(t.ok?`ok`:`bad`),role:`group`,"aria-label":`${t.name||`第 `+(n+1)+` 组`}：${t.ok?`通过`:`未通过`}`},L(`div`,{class:`ct-case-head`},L(`b`,{text:t.ok?`✓ 通过 `:`✗ 未通过 `}),L(`span`,{text:(t.hidden?`隐藏测试`:t.name||`第 ${n+1} 组`)+(t.ms?` · ${t.ms} ms`:``)})));if(!t.ok&&e.attempt){t.kind===`error`&&t.error?i.append(L(`pre`,{class:`ct-out bad`,text:(t.error.file&&t.error.file!==(y.entry||`main.py`)?`[${t.error.file}] `:``)+s(t.error)})):t.kind===`wrong-return`?i.append(L(`p`,{text:t.hidden?`函数的返回值和期望不一致。`:`期望返回 ${t.expected}，你的函数返回 ${t.actualReturn}`})):t.kind===`wrong-file`?i.append(L(`p`,{text:t.hidden?t.message:`输出文件不对：`}),...(t.files||[]).map(e=>L(`p`,{text:`${e.path}：期望“${e.expected}”，你的是${e.actual===null?`（没有生成这个文件）`:`“`+e.actual+`”`}`}))):!t.hidden&&t.expected!==void 0?i.append(L(`p`,{class:`ct-diff`,text:It(t.expected,t.stdout)||t.message}),L(`div`,{class:`ct-cmp`},L(`div`,{},L(`b`,{text:`期望输出`}),L(`pre`,{text:t.expected})),L(`div`,{},L(`b`,{text:`你的输出`}),L(`pre`,{text:t.stdout||`（没有输出）`})))):i.append(L(`p`,{text:t.message}));let e=Ne(t,r);e&&i.append(L(`p`,{class:`ct-why`,text:e}))}a.push(i)}),P(r,a,i)}function Fe(){let e=y.hints||[],t=(e,t,n)=>f.sheet(n=>[L(`div`,{class:`lsheet hint`},L(`b`,{text:e}),L(`pre`,{class:`hint-text`,text:t}),f.button(`好的`,n,`btn3d primary wide`))]);C<e.length?(C++,t(`提示 ${C}/${e.length}`,e[C-1])):!h||y.isVariation?t(`没有更多提示了`,`再试一次吧：先看看上面的例子，一步一步对照你的输出和期望输出。`,!0):v?t(`参考解法（你已经查看过）`,r.reference??``,!0):f.sheet(e=>[L(`div`,{class:`lsheet`},L(`h2`,{text:`要看参考解法吗？`}),L(`p`,{text:`看过之后这道题会标记为“已查看解答”：你的代码通过后，还要再做一道有变化的题才算完成（不多扣红心，也不重复加 XP）。先再试一次，自己写出来最有收获。`}),f.button(`再试试`,e,`btn3d primary wide`),f.button(`看参考解法（之后要再做一道变化题）`,()=>{e(),v=!0,A.flush(),A.schedule(),A.flush(),t(`参考解法`,r.reference??``,!0)},`btn3d danger-ghost wide`))])}function Ie(){w||f.sheet(t=>[L(`div`,{class:`lsheet`},L(`h2`,{text:`要重新开始吗？`}),L(`p`,{text:`编辑器会恢复成题目给的初始代码，你现在写的代码会丢失。`}),f.button(`继续写`,t,`btn3d primary wide`),f.button(`重新开始`,()=>{t(),jt(l,p,y),e(j,b,b.length),k=null,Te.replaceChildren(),A.cancel(),c.onChange?.()},`btn3d danger-ghost wide`))])}let Le=()=>{document.visibilityState===`hidden`&&A.flush()};return document.addEventListener(`visibilitychange`,Le),addEventListener(`pagehide`,()=>A.flush()),{kind:`code`,node:De,after:ve,view:j,ready:()=>_e().trim().length>0&&!w,lock(){w=!0,Se.disabled=!0,M.disabled=!0,ve.hidden=!0},mark(){},afterFeedback(){Te.scrollIntoView?.({block:`start`})},check:I,settled(e){e?(jt(l,p,r),h&&jt(l,p,h),A.cancel()):A.flush()},isCorrect:()=>k?.status===`pass`,phase:()=>S,isVariation:()=>y.isVariation===!0,why:()=>`全部测试都通过了。`,whyWrong:()=>{let e=k?.cases?.findIndex(e=>!e.ok)??-1;if(e<0)return``;let t=k.cases[e];return Ne(t,y.tests[e])||t.message||``},code:_e,setCode:t=>e(j,t,t.length),viewedSolution:()=>v,openHint:Fe,destroy(){A.flush(),clearInterval(ke),document.removeEventListener(`visibilitychange`,Le)}}}var Bt=u({DEFAULT_STYLE:()=>`J`,EVENTS:()=>Xt,KEY_SOUNDS:()=>Vt,TRIMS:()=>qt,measureKey:()=>Qt,renderEvent:()=>Zt,renderKey:()=>Yt}),Vt=[{id:`A`,name:`清脆矮轴`,desc:`短促、干净、轻微触底声`},{id:`B`,name:`奶油矮轴`,desc:`更柔和，低频稍多`},{id:`C`,name:`轻段落轴`,desc:`按下时有轻微的段落感`},{id:`D`,name:`铝板矮轴`,desc:`清脆，带极短的金属感`},{id:`E`,name:`塑料外壳`,desc:`轻巧、偏明亮`},{id:`F`,name:`静音矮轴`,desc:`声音很短、很克制`},{id:`G`,name:`深沉矮轴`,desc:`触底声稍厚`},{id:`H`,name:`弹性垫片`,desc:`柔软，带一点回弹感`},{id:`I`,name:`陶瓷清响`,desc:`清亮但不刺耳`},{id:`J`,name:`极简 Tap`,desc:`非常短，适合连续点击`}],Ht=1,Ut=null;function Wt(e){if(Ut&&Ut.sampleRate===e.sampleRate)return Ut;let t=Math.floor(e.sampleRate*.12),n=e.createBuffer(1,t,e.sampleRate),r=n.getChannelData(0),i=12345;for(let e=0;e<t;e++)i=i*1664525+1013904223>>>0,r[e]=i/4294967296*2-1;return Ut=n,n}function R(e,t,n,{freq:r,q:i=1,dur:a=.012,gain:o=.5,type:s=`bandpass`}){let c=e.createBufferSource();c.buffer=Wt(e);let l=e.createBiquadFilter();l.type=s,l.frequency.value=r*Ht,l.Q.value=i;let u=e.createGain();return u.gain.setValueAtTime(1e-4,n),u.gain.exponentialRampToValueAtTime(o,n+8e-4),u.gain.exponentialRampToValueAtTime(1e-4,n+a),c.connect(l),l.connect(u),u.connect(t),c.start(n),c.stop(n+a+.01),n+a}function z(e,t,n,{from:r,to:i,dur:a=.05,gain:o=.3,type:s=`sine`}){let c=e.createOscillator();c.type=s,c.frequency.setValueAtTime(r*Ht,n),c.frequency.exponentialRampToValueAtTime(i*Ht,n+a);let l=e.createGain();return l.gain.setValueAtTime(1e-4,n),l.gain.exponentialRampToValueAtTime(o,n+.003),l.gain.exponentialRampToValueAtTime(1e-4,n+a),c.connect(l),l.connect(t),c.start(n),c.stop(n+a+.01),n+a}function Gt(e,t,n,{freq:r,dur:i=.05,gain:a=.1}){let o=e.createOscillator();o.type=`sine`,o.frequency.value=r*Ht;let s=e.createGain();return s.gain.setValueAtTime(1e-4,n),s.gain.exponentialRampToValueAtTime(a,n+.001),s.gain.exponentialRampToValueAtTime(1e-4,n+i),o.connect(s),s.connect(t),o.start(n),o.stop(n+i+.01),n+i}var Kt={A:{trim:.98,run:(e,t,n)=>Math.max(R(e,t,n,{freq:3500,q:1.2,dur:.014,gain:.5}),z(e,t,n,{from:220,to:140,dur:.045,gain:.35}),R(e,t,n+.022,{freq:2200,q:.9,dur:.018,gain:.25,type:`bandpass`}))},B:{trim:.6,run:(e,t,n)=>Math.max(R(e,t,n,{freq:1800,q:.8,dur:.018,gain:.35}),z(e,t,n,{from:170,to:100,dur:.075,gain:.5}))},C:{trim:1.19,run:(e,t,n)=>Math.max(R(e,t,n,{freq:4200,q:1.2,dur:.008,gain:.35}),R(e,t,n+.028,{freq:3e3,q:1,dur:.012,gain:.4}),z(e,t,n+.028,{from:200,to:130,dur:.05,gain:.3}))},D:{trim:1.07,run:(e,t,n)=>Math.max(R(e,t,n,{freq:3800,q:1.2,dur:.012,gain:.45}),z(e,t,n,{from:190,to:120,dur:.045,gain:.3}),Gt(e,t,n+.002,{freq:2600,dur:.065,gain:.12}))},E:{trim:1.81,run:(e,t,n)=>Math.max(R(e,t,n,{freq:4800,q:.9,dur:.016,gain:.45}),z(e,t,n,{from:300,to:200,dur:.04,gain:.25,type:`triangle`}))},F:{trim:1.93,run:(e,t,n)=>Math.max(R(e,t,n,{freq:1500,q:.8,dur:.01,gain:.22}),z(e,t,n,{from:150,to:110,dur:.04,gain:.22}))},G:{trim:.48,run:(e,t,n)=>Math.max(z(e,t,n,{from:140,to:80,dur:.09,gain:.6}),R(e,t,n,{freq:1200,q:.8,dur:.014,gain:.4}))},H:{trim:.8,run:(e,t,n)=>Math.max(z(e,t,n,{from:190,to:120,dur:.055,gain:.4}),z(e,t,n+.03,{from:260,to:200,dur:.035,gain:.15}),R(e,t,n,{freq:2400,q:1,dur:.012,gain:.3}))},I:{trim:1.1,run:(e,t,n)=>Math.max(Gt(e,t,n,{freq:3200,dur:.075,gain:.22}),Gt(e,t,n,{freq:4800,dur:.05,gain:.08}),R(e,t,n,{freq:5200,q:1.2,dur:.006,gain:.25}),z(e,t,n,{from:260,to:180,dur:.03,gain:.15}))},J:{trim:1.45,run:(e,t,n)=>Math.max(R(e,t,n,{freq:3e3,q:1,dur:.008,gain:.45}),z(e,t,n,{from:240,to:170,dur:.04,gain:.25}))}},qt=Object.fromEntries(Object.entries(Kt).map(([e,t])=>[e,t.trim]));function Jt(e,t,n,r,i,a){let o=e.createGain();o.gain.value=Kt[n].trim*a,o.connect(t),Ht=i;try{return Kt[n].run(e,o,r)-r}finally{Ht=1}}function Yt(e,t,n,r){return Math.round(Jt(e,t,n,r,1,1)*1e3)}var Xt={select:[[0,1,1]],place:[[0,.82,1.1]],undo:[[0,1.25,.9]],correct:[[0,1,.9],[.075,1.5,1]],wrong:[[0,.8,.9],[.085,.6,.9]],finish:[[0,1,.8],[.09,1.25,.9],[.18,1.5,1]]};function Zt(e,t,n,r,i){let a=0;for(let[o,s,c]of Xt[r])a=Math.max(a,o+Jt(e,t,n,i+o,s,c));return Math.round(a*1e3)}async function Qt(e,t=`select`){let n=44100,r=new OfflineAudioContext(1,26460,n),i=Zt(r,r.destination,e,t,0),a=(await r.startRendering()).getChannelData(0),o=0;for(let e=0;e<a.length;e++){let t=Math.abs(a[e]);t>o&&(o=t)}let s=0;for(let e=a.length-1;e>=0;e--)if(Math.abs(a[e])>o*.01){s=e;break}let c=0;for(let e=0;e<a.length;e++)c+=a[e]*a[e];return{ms:i,audibleMs:Math.round(s/n*1e3),peak:o,rms:Math.sqrt(c/(.1*n))}}var $t=u({activeCount:()=>fn,audioContext:()=>gn,currentStyle:()=>hn,diagnostics:()=>bn,haptic:()=>yn,hapticsSupported:()=>rn,log:()=>en,masterNode:()=>_n,play:()=>U,playStyle:()=>mn,preview:()=>vn,reducedMotion:()=>nn,setPrefs:()=>an,stats:()=>V,unlock:()=>cn}),B={sound:!0,haptics:!0,soundStyle:`J`},en=[],tn=e=>{en.push(e),en.length>200&&en.shift()},V={played:0,dropped:0,resumed:0,unlocks:0,lastError:``,history:[]},nn=()=>{try{return matchMedia(`(prefers-reduced-motion: reduce)`).matches}catch{return!1}},rn=()=>typeof navigator<`u`&&typeof navigator.vibrate==`function`;function an(e){B.sound=e?.sound!==!1,B.haptics=e?.haptics!==!1,B.soundStyle=Vt.some(t=>t.id===e?.soundStyle)?e.soundStyle:`J`}var H=null,on=null;function sn(){if(H)return H;try{let e=window.AudioContext||window.webkitAudioContext;if(!e)return V.lastError=`浏览器没有 AudioContext`,null;H=new e,V.history.push(`创建:${H.state}`),H.addEventListener?.(`statechange`,()=>{V.history.push(`→${H.state}`),V.history.length>8&&V.history.shift()}),on=H.createGain(),on.gain.value=.9,on.connect(H.destination);try{navigator.audioSession&&(navigator.audioSession.type=`ambient`)}catch{}}catch(e){H=null,V.lastError=`创建音频失败：`+(e?.message||e)}return H}function cn(){let e=sn();if(e)try{if(e.state!==`running`){V.unlocks++,e.resume().then(()=>{V.resumed++}).catch(e=>{V.lastError=`resume 失败：`+(e?.message||e)});let t=e.createBufferSource();t.buffer=e.createBuffer(1,1,22050),t.connect(e.destination),t.start(0)}}catch(e){V.lastError=`解锁失败：`+(e?.message||e)}}var ln={select:40,place:55,undo:40,correct:140,wrong:150,finish:280},un={},dn=[],fn=()=>dn.filter(e=>e.until>performance.now()).length;function pn(e,t,n=B.soundStyle){let r=performance.now();for(dn=dn.filter(e=>e.until>r);dn.length>=3;){let t=dn.shift();try{t.gain.gain.cancelScheduledValues?.(e.currentTime),t.gain.gain.setValueAtTime?.(t.gain.gain.value??1,e.currentTime),t.gain.gain.linearRampToValueAtTime?.(1e-4,e.currentTime+.01)}catch{}}let i=e.createGain();i.connect(on);let a=Zt(e,i,n,t,e.currentTime+.005);dn.push({gain:i,until:r+Math.max(a,ln[t]||0)+20}),V.played++}function U(e,{force:t=!1}={}){if(!B.sound&&!t||!Xt[e])return Promise.resolve(!1);tn(e);try{let n=performance.now();if(!t&&n-(un[e]||-1e9)<25)return Promise.resolve(!1);un[e]=n;let r=sn();if(!r)return V.dropped++,Promise.resolve(!1);if(r.state===`running`)return pn(r,e),Promise.resolve(!0);let i=performance.now();return r.resume().then(()=>r.state===`running`&&performance.now()-i<(t?2e3:300)?(V.resumed++,pn(r,e),!0):(V.dropped++,!1)).catch(e=>(V.dropped++,V.lastError=`resume 失败：`+(e?.message||e),!1))}catch(e){return V.lastError=`播放失败：`+(e?.message||e),Promise.resolve(!1)}}function mn(e,t=`select`){cn();let n=sn();if(!n||!Vt.some(t=>t.id===e)||!Xt[t])return{ok:!1,state:n?n.state:`不可用`};tn(`${e}:${t}`);try{return pn(n,t,e),{ok:n.state===`running`,state:n.state}}catch(e){return V.lastError=`试听失败：`+(e?.message||e),{ok:!1,state:n.state}}}var hn=()=>B.soundStyle;function gn(){return cn(),sn()}function _n(){return on}function vn(){return cn(),U(`correct`,{force:!0})}function yn(){if(B.haptics&&rn()){tn(`haptic`);try{navigator.vibrate(12)}catch{}}}function bn(){return{audioState:H?H.state:`未创建`,sampleRate:H?H.sampleRate:0,hasAudioContext:!!(window.AudioContext||window.webkitAudioContext),audioSession:(()=>{try{return navigator.audioSession?navigator.audioSession.type:`无`}catch{return`无`}})(),vibrate:rn(),soundPref:B.sound,soundStyle:B.soundStyle,hapticsPref:B.haptics,...V,history:V.history.join(` `)}}if(typeof document<`u`){for(let e of[`touchend`,`click`,`keydown`])document.addEventListener(e,cn,{capture:!0,passive:!0});document.addEventListener(`visibilitychange`,()=>{H&&(document.visibilityState===`hidden`?H.suspend().catch(()=>{}):H.resume().catch(()=>{}))})}function xn({url:e,anonKey:t,fetchFn:n=(...e)=>fetch(...e),timeoutMs:r=15e3}){let i=String(e||``).replace(/\/+$/,``),a=!!(i&&t);async function o(e,{method:o=`GET`,body:s,token:c,query:l}={}){if(!a)return{ok:!1,kind:`config`,message:`云端暂未开通`};let u=typeof AbortController<`u`?new AbortController:null,d=u?setTimeout(()=>u.abort(),r):null,f;try{f=await n(i+e+(l?`?`+l:``),{method:o,signal:u?.signal,headers:{apikey:t,Authorization:`Bearer `+(c||t),"Content-Type":`application/json`},body:s===void 0?void 0:JSON.stringify(s)})}catch{return{ok:!1,kind:`network`,message:`网络连不上，请检查网络后重试`}}finally{d&&clearTimeout(d)}let p=null,m=await f.text().catch(()=>``);if(m)try{p=JSON.parse(m)}catch{p=m}if(f.ok)return{ok:!0,status:f.status,data:p};let h=p&&(p.msg||p.message||p.error_description||p.error)||`服务器返回 ${f.status}`;return{ok:!1,kind:f.status===429?`rate-limit`:f.status===401||f.status===403?`auth`:`server`,status:f.status,message:String(h)}}let s=e=>e&&e.access_token&&e.user?.id?{accessToken:e.access_token,refreshToken:e.refresh_token,expiresAt:Number.isFinite(e.expires_at)?e.expires_at*1e3:Date.now()+(e.expires_in??3600)*1e3,userId:e.user.id,email:e.user.email||``}:null;return{configured:a,async sendCode(e){let t=await o(`/auth/v1/otp`,{method:`POST`,body:{email:e,create_user:!0}});return t.ok?{ok:!0}:t},async verifyCode(e,t){let n=await o(`/auth/v1/verify`,{method:`POST`,body:{type:`email`,email:e,token:String(t).trim()}});if(!n.ok)return n.kind===`server`&&n.status&&n.status<500?{...n,kind:`auth`}:n;let r=s(n.data);return r?{ok:!0,session:r}:{ok:!1,kind:`server`,message:`登录返回的内容无法识别`}},async refresh(e){let t=await o(`/auth/v1/token`,{method:`POST`,query:`grant_type=refresh_token`,body:{refresh_token:e.refreshToken}});if(!t.ok)return t.kind===`server`&&t.status&&t.status<500?{...t,kind:`auth`}:t;let n=s(t.data);return n?{ok:!0,session:n}:{ok:!1,kind:`server`,message:`刷新登录返回的内容无法识别`}},async signOut(e){return await o(`/auth/v1/logout`,{method:`POST`,token:e.accessToken}),{ok:!0}},async getProgress(e){let t=await o(`/rest/v1/progress`,{token:e.accessToken,query:`select=doc,rev&limit=2`});return t.ok?!Array.isArray(t.data)||t.data.length>1?{ok:!1,kind:`server`,message:`读到的进度行数不对`}:{ok:!0,row:t.data[0]?{doc:t.data[0].doc,rev:t.data[0].rev}:null}:t},async createProgress(e,t){let n=await o(`/rest/v1/rpc/create_progress`,{method:`POST`,token:e.accessToken,body:{new_doc:t}});return n.ok?{ok:!0,rev:Number.isInteger(n.data)?n.data:null}:n},async saveProgress(e,t,n){let r=await o(`/rest/v1/rpc/save_progress`,{method:`POST`,token:e.accessToken,body:{expected_rev:t,new_doc:n}});return r.ok?{ok:!0,rev:Number.isInteger(r.data)?r.data:null}:r},async deleteAccount(e){let t=await o(`/rest/v1/rpc/delete_my_account`,{method:`POST`,token:e.accessToken,body:{}});return t.ok?{ok:!0}:t}}}function Sn(e){let t=e?.status;return t===`synced`?`已同步 ✓`:t===`syncing`?`同步中…`:t===`pending`?`有进度等待上传（联网后自动同步）`:t===`offline`?`现在离线：进度已存在这台设备，联网后自动同步`:t===`need-login`?`登录已过期，需要重新登录才能同步（进度还在这台设备上）`:t===`conflict`?`这个账号在别处被覆盖过，需要选择保留哪一份`:t===`error`?`同步失败：`+(e.message||`请稍后再试`):`已登录，正在准备同步…`}var Cn={network:`网络连不上，请检查网络后重试。`,"rate-limit":`发送太频繁了，请等一分钟再试。`,config:`云端暂未开通。`},wn=e=>Cn[e.kind]||e.message||`出错了，请稍后再试。`;function Tn({h:e,button:t,sheet:n,icon:r,showToast:i,sync:a,api:o,getState:s,onSwitchedIn:c,onSwitchedOut:l,rerender:u}){let d=new Set;function f(){let e=a.status();for(let t of[...d])t.__shown&&!t.isConnected?d.delete(t):p(t,e)}function p(e,t){e.textContent=Sn(t),e.dataset.status=t.status||``,e.isConnected&&(e.__shown=!0)}function m({reason:r=``}={}){if(!o.configured)i(`云端暂未开通，现在只能在这台设备上学习。`);else return n(n=>{let o=e(`div`,{class:`lsheet login`,"data-login":``}),l=``,u=!1,d=null,f=0,p=e(`p`,{class:`login-msg`,role:`alert`,"data-login-msg":``}),m=(e,t=!0)=>{p.textContent=e,p.classList.toggle(`bad`,t)},h=()=>{clearInterval(d),n()};function g(){let n=e(`input`,{class:`login-input`,type:`email`,inputmode:`email`,autocomplete:`email`,autocapitalize:`off`,spellcheck:`false`,placeholder:`you@example.com`,"aria-label":`邮箱`,"data-email":``});n.value=l;let i=t(`发送验证码`,async()=>{let e=n.value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)){m(`请输入有效的邮箱地址。`);return}if(u)return;u=!0,i.disabled=!0,m(`正在发送…`,!1);let t=await a.sendCode(e);u=!1,i.disabled=!1,t.ok?(l=e,f=Date.now()+6e4,m(``),_()):m(wn(t))},`btn3d primary wide`,{"data-send-code":``});n.addEventListener(`keydown`,e=>{e.key===`Enter`&&i.click()}),o.replaceChildren(e(`h2`,{text:`登录 / 注册`}),e(`p`,{text:r||`用邮箱登录，换手机或 iPad 也能接着学。没有账号会自动创建；不用设密码。`}),n,i,p,t(`先不登录`,h,`btn3d ghost wide`)),setTimeout(()=>n.focus(),50)}function _(){let n=e(`input`,{class:`login-input code`,type:`text`,inputmode:`numeric`,pattern:`[0-9]*`,autocomplete:`one-time-code`,maxlength:`10`,placeholder:`验证码`,"aria-label":`邮箱验证码`,"data-code":``}),r=t(`重新发送`,async()=>{if(Date.now()<f||u)return;u=!0;let e=await a.sendCode(l);u=!1,e.ok?(f=Date.now()+6e4,m(`已重新发送。`,!1),i()):m(wn(e))},`btn3d ghost`,{"data-resend":``}),i=()=>{let e=Math.ceil((f-Date.now())/1e3);r.disabled=e>0,r.textContent=e>0?`重新发送（${e} 秒）`:`重新发送`};clearInterval(d),d=setInterval(()=>{o.isConnected?i():clearInterval(d)},1e3),i();let c=t(`登录`,async()=>{let e=n.value.replace(/\s+/g,``);if(e.length<4){m(`请输入邮件里的验证码。`);return}if(u)return;u=!0,c.disabled=!0,m(`正在登录…`,!1);let t=await a.verify(l,e,s());u=!1,c.disabled=!1,t.ok?t.needChoice?v(t):y(t):m(t.kind===`auth`?`验证码错误或已过期，请检查后重试，或点“重新发送”。`:wn(t))},`btn3d primary wide`,{"data-verify":``});n.addEventListener(`keydown`,e=>{e.key===`Enter`&&c.click()}),o.replaceChildren(e(`h2`,{text:`输入验证码`}),e(`p`,{text:`验证码已发到 ${l}。没收到？看看垃圾邮件，或稍等再重新发送。`}),n,c,r,p,t(`换个邮箱`,()=>{m(``),g()},`btn3d ghost wide`)),setTimeout(()=>n.focus(),50)}function v(n){let r=`${n.guest.xp} XP、${n.guest.lessons} 关`,i=async(e,t)=>{if(u)return;u=!0,m(`正在处理…`,!1);let n=await a.finishChoice(e);u=!1,n.ok?y(n):m(wn(n))};n.cloudHasData?o.replaceChildren(e(`h2`,{text:`这个账号已有学习进度`}),e(`p`,{text:`云端已经有这个账号的进度。这台设备上还有没登录时学的进度（${r}）。`}),t(`用账号里的进度（推荐）`,()=>i(`cloud`),`btn3d primary wide`,{"data-choice":`cloud`}),t(`用这台设备的进度覆盖账号`,()=>{o.replaceChildren(e(`h2`,{text:`确定覆盖吗？`}),e(`p`,{text:`账号里原来的进度会被这台设备的进度替换，不能撤销。`}),t(`确定覆盖`,()=>i(`transfer`),`btn3d danger wide`,{"data-choice":`transfer`}),t(`返回`,()=>v(n),`btn3d ghost wide`),p)},`btn3d wide`,{"data-choice":`ask-replace`}),e(`p`,{class:`muted small`,text:`选“用账号里的进度”时，这台设备上的游客记录会原样保留，不会删除。`}),p):o.replaceChildren(e(`h2`,{text:`转存这台设备上的进度？`}),e(`p`,{text:`这台设备上有没登录时学的进度（${r}）。要放进这个账号吗？`}),t(`转存到账号`,()=>i(`transfer`),`btn3d primary wide`,{"data-choice":`transfer`}),t(`不转存，用全新账号`,()=>i(`cloud`),`btn3d wide`,{"data-choice":`cloud`}),e(`p`,{class:`muted small`,text:`转存成功并确认云端一致后，这台设备上的游客记录才会清除；不转存则原样保留。`}),p)}function y(e){h(),c(e),i(e.synced?`登录成功，进度已同步。`:`登录成功。`+(e.syncError?`云端暂时没同步上（`+e.syncError+`），联网后会自动补上。`:``))}return g(),[o]},{cls:`login-sheet`})}function h(){let r=a.account(),s=e(`section`,{class:`acct-card`,"data-account":``});if(!o.configured)return s.append(e(`h3`,{text:`账号`}),e(`p`,{class:`muted`,text:`云端暂未开通：学习进度只保存在这台设备上。`})),s;if(!r)return s.append(e(`h3`,{text:`账号`}),e(`p`,{class:`muted`,text:`登录后，进度会保存到云端，换手机或 iPad 也能接着学。`}),t(`邮箱登录 / 注册`,()=>m(),`btn3d primary wide`,{"data-open-login":``})),s;let c=e(`p`,{class:`acct-status`,role:`status`,"data-sync-status":``});d.add(c);let f=(r,i,a,o,s=!1)=>n(n=>[e(`div`,{class:`lsheet`},e(`h2`,{text:r}),e(`p`,{text:i}),t(a,async()=>{n(),await o()},`btn3d wide `+(s?`danger`:`primary`)),t(`取消`,n,`btn3d ghost wide`))]);async function h(e){let t=await a.logout();t.ok?(l(),i(`已退出登录。`),e&&e()):t.pending?f(`有进度还没上传`,`现在连不上云端。退出后这些进度会先留在这台设备上，用同一个账号重新登录时会接着上传；建议联网后再退出。`,`仍然退出`,async()=>{await a.logout({force:!0}),l(),i(`已退出登录。`),e&&e()},!0):i(wn(t))}return s.append(e(`h3`,{text:`账号`}),e(`p`,{class:`acct-email`,text:r.email||`已登录`}),c,t(`立即同步`,async()=>{let e=await a.syncNow();e.ok?u():i(wn(e))},`btn3d wide`,{"data-sync-now":``}),e(`div`,{class:`acct-row`},t(`退出登录`,()=>h(),`btn3d`,{"data-logout":``}),t(`切换账号`,()=>h(()=>m()),`btn3d`,{"data-switch":``})),t(`删除账号和云端记录`,()=>f(`删除账号？`,`会永久删除这个账号和云端的学习记录，不能恢复。这台设备上也会退出登录。`,`永久删除`,async()=>{let e=await a.deleteAccount();e.ok?(l(),i(`账号已删除。`)):i(wn(e))},!0),`btn3d danger-ghost wide`,{"data-delete-account":``})),p(c,a.status()),s}function g(){if(!o.configured)return null;let n=a.account();if(!n)return t(`登录 / 注册：换设备也能接着学`,()=>m(),`acct-link`,{"data-login-link":``});let r=e(`span`,{class:`acct-mini`,"data-sync-mini":``});d.add(r);let i=e(`div`,{class:`acct-row-mini`},e(`span`,{text:n.email||`已登录`}),r);return p(r,a.status()),i}return{openLogin:m,accountCard:h,accountRow:g,refreshStatus:f}}var En=`suipian-progress`,Dn=/^[A-Za-z0-9_-]{1,40}$/,On=/^\d{4}-\d{2}-\d{2}$/,kn=(e,t)=>Number.isInteger(e)&&e>=0&&e<=t;function An(e=new Date){let t=e=>String(e).padStart(2,`0`);return`suipian-progress-${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())}.json`}function jn(e,{now:t=Date.now(),build:n=``,unreadable:r=[]}={}){return{format:En,exportVersion:1,exportedAt:new Date(t).toISOString(),build:String(n||``),state:e,unreadable:r.map(e=>({savedAt:e.savedAt,raw:e.raw}))}}function Mn(e){if(typeof e!=`string`||!e.trim())return{ok:!1,error:`文件是空的。`};if(e.length>1048576)return{ok:!1,error:`文件太大，不像是从碎片编程导出的进度文件。`};let t;try{t=JSON.parse(e)}catch{return{ok:!1,error:`文件内容不是有效的进度文件（无法读取）。`}}if(!t||typeof t!=`object`||t.format!==`suipian-progress`)return{ok:!1,error:`这不是碎片编程的进度文件。`};if(t.exportVersion!==1)return{ok:!1,error:`这个进度文件来自不同版本，当前版本不认识，没有导入任何内容。`};let n=t.state;if(!n||typeof n!=`object`||n.version!==3)return{ok:!1,error:`进度文件里的学习记录格式不对，没有导入任何内容。`};if(!kn(n.xp,1e7)||!kn(n.streak,1e5)||!kn(n.lessonsCompleted??0,1e7))return{ok:!1,error:`进度文件里的数字不合理，没有导入任何内容。`};if(n.lastDay!=null&&!(typeof n.lastDay==`string`&&On.test(n.lastDay)))return{ok:!1,error:`进度文件里的日期不合理，没有导入任何内容。`};if(!n.done||typeof n.done!=`object`||Array.isArray(n.done))return{ok:!1,error:`进度文件里缺少关卡完成记录，没有导入任何内容。`};let r={};for(let[e,t]of Object.entries(n.done)){if(!Dn.test(e)||e===`__proto__`)return{ok:!1,error:`进度文件里有不合法的关卡编号，没有导入任何内容。`};t===!0&&(r[e]=!0)}return{ok:!0,exportedAt:typeof t.exportedAt==`string`?t.exportedAt:null,state:{xp:n.xp,streak:n.streak,lastDay:n.lastDay??null,done:r,lessonsCompleted:n.lessonsCompleted??0}}}function Nn(e,t){let n={...e.done};for(let e of Object.keys(t.done))n[e]=!0;let r=e.lastDay,i=t.lastDay,a=e.streak,o=r;return i&&(!r||i>r)?(a=t.streak,o=i):i&&r===i&&(a=Math.max(e.streak,t.streak)),{...e,onboarded:!0,xp:Math.max(e.xp,t.xp),lessonsCompleted:Math.max(e.lessonsCompleted||0,t.lessonsCompleted||0),done:n,streak:a,lastDay:o,hearts:Math.min(5,e.hearts)}}function Pn(e){return{xp:e.xp,lessons:Object.keys(e.done).length,streak:e.streak,lastDay:e.lastDay}}var Fn=[5,10,20],In=(e,t)=>`${e}#${t}`;function Ln(e,t){return e.map(e=>({id:e.id,title:e.title,lessons:e.lessons.filter(e=>t&&t[e.id]===!0).map(e=>({id:e.id,title:e.title,count:e.exercises.length}))})).filter(e=>e.lessons.length>0)}function Rn(e,t,n){let r=new Set(n),i=[],a=new Set;for(let n of e)for(let e of n.lessons)t&&t[e.id]===!0&&r.has(e.id)&&e.exercises.forEach((t,r)=>{let o=In(e.id,r);a.has(o)||(a.add(o),i.push({id:o,lessonId:e.id,unitId:n.id,index:r,ex:t}))});return i}function zn(e,t=Math.random){let n=[...e];for(let e=n.length-1;e>0;e--){let r=Math.floor(t()*(e+1));[n[e],n[r]]=[n[r],n[e]]}return n}function Bn(e,t,n=Math.random){let r=[...new Map(e.map(e=>[e.id,e])).values()],i=Math.min(t,r.length);return{items:zn(r,n).slice(0,i),requested:t,actual:i,short:i<t}}function Vn(e,t=Math.random){let n=JSON.parse(JSON.stringify(e));return n.type===`predict`||n.type===`pick`?n.options=zn(n.options,t):n.type===`fill`?n.tokens=zn(n.tokens,t):n.type===`order`&&(n.shuffled=zn(n.shuffled,t)),n}var Hn=`modulepreload`,Un=function(e,t){return new URL(e,t).href},Wn={},Gn=function(e){return e.pathname.endsWith(`.css`)},Kn=function(e,t,n){if(t in e)return e[t];let r=n();if(!r){e[t]=void 0;return}let i=r.then(()=>{e[t]=void 0},n=>{throw e[t]=void 0,n});return e[t]=i,i},qn=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e,i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?new URL(import.meta.resolve(e)):new URL(e,import.meta.url)}r=o(t.map(t=>{t=Un(t,n);let r=s(t),i=Gn(r);return Kn(Wn,r.href,()=>{if(e===void 0){e={all:new Set,styles:new Set};let t=document.getElementsByTagName(`link`);for(let n=t.length-1;n>=0;n--){let r=t[n];e.all.add(r.href),r.rel===`stylesheet`&&e.styles.add(r.href)}}if((i?e.styles:e.all).has(r.href))return;let t=document.createElement(`link`);if(t.rel=i?`stylesheet`:Hn,i||(t.as=`script`),t.crossOrigin=``,t.href=r.href,a&&t.setAttribute(`nonce`,a),document.head.appendChild(t),i)return new Promise((e,n)=>{t.addEventListener(`load`,e),t.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${r}`)))})})}).filter(e=>e!==void 0))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},Jn={U1:f,U2:p,U3:m,U4:h,U5:g,U6:_,U7:v,U8:y},Yn=10,Xn=5,Zn=10,Qn=120,$n=/iP(hone|ad|od)/.test(navigator.userAgent)||navigator.platform===`MacIntel`&&navigator.maxTouchPoints>1,er=navigator.standalone===!0||matchMedia(`(display-mode: standalone)`).matches;$n&&!er&&document.documentElement.classList.add(`ios-browser`);function W(e,t={},...n){let r=document.createElement(e);for(let[e,n]of Object.entries(t))n!=null&&n!==!1&&(e===`class`?r.className=n:e===`text`?r.textContent=n:e.startsWith(`on`)?r.addEventListener(e.slice(2),n):r.setAttribute(e,n===!0?``:n));for(let e of n.flat())e!=null&&e!==!1&&r.append(e);return r}function G(e,t,n=`btn`,r={}){let i=W(`button`,{type:`button`,class:n,...r},e);return i.addEventListener(`click`,e=>{i.disabled||t(e)}),i}var tr=`http://www.w3.org/2000/svg`;function K(e,t,...n){let r=document.createElementNS(tr,e);for(let[e,n]of Object.entries(t))r.setAttribute(e,n);return n.forEach(e=>{e!=null&&e!==!1&&r.append(e)}),r}var nr={flame:`M12 3c.8 3.2 5 5.2 5 9.8a5 5 0 0 1-10 0c0-2 .9-3.3 2.2-4.4.4 1.6 1.2 2.3 2 2.6-.4-2.6-.2-5 .8-8z`,bolt:`M13 2.5 5.5 13H11l-1 8.5L18.5 10H13z`,heart:`M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z`,home:`M4 11l8-7 8 7v9H4zM10 20v-6h4v6`,user:`M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21c0-4 3.5-6 7.5-6s7.5 2 7.5 6`,check:`M5 12.5l4.5 4.5L19 7`,lock:`M7 11h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM8.5 11V8a3.5 3.5 0 0 1 7 0v3`,star:`M12 3l2.7 5.9 6.3.7-4.7 4.3 1.3 6.2L12 16.8l-5.6 3.3 1.3-6.2L3 9.6l6.3-.7z`,trophy:`M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8`,shield:`M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z`,close:`M6 6l12 12M18 6L6 18`,cross:`M7 7l10 10M17 7L7 17`,play:`M8 5.5v13l11-6.5z`,review:`M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5`};function q(e,{size:t=22,fill:n=!1,cls:r=``}={}){return K(`svg`,{viewBox:`0 0 24 24`,width:t,height:t,class:`ico `+r,"aria-hidden":`true`,fill:n?`currentColor`:`none`,stroke:`currentColor`,"stroke-width":`2`,"stroke-linecap":`round`,"stroke-linejoin":`round`},K(`path`,{d:nr[e]}))}var rr=16;function ir(e,t,n){let r=Math.round,i=[],a=(e,t,n)=>i.push({d:e,pulse:t,pads:n});if(e===`edge`){let e=(e,n,i,a)=>`M${e} ${r(n)}V${r(i)}L${e+(e<t/2?6:-6)} ${r(i+6)}V${r(a)}`,o=e(6,0,n*.26,n*.6);a(o,o,[[12,r(n*.6)]]);let s=e(t-6,n*.12,n*.45,n*.83);a(s,s,[[t-12,r(n*.83)]]);let c=`M6 ${r(n*.72)}V${r(n)}`;a(c,c,[[6,r(n)]]);let l=`M${t-6} ${r(n*.9)}V${r(n)}`;return a(l,l,[[t-6,r(n)]]),{lines:i,pulses:[[0,11,0],[1,9,-5]]}}let o=(e,n,i,o,s,c)=>{let l=n=>r(e?t-n:n),u=o>=n?1:-1,d=i+rr,f=`M${e?r(t):0} ${r(n)}H${l(i)}L${l(d)} ${r(n+rr*u)}V${r(o)}`,p=[[l(d),r(o)]],m=f;s!=null&&(m+=`M${l(d)} ${r(s)}H${l(d+c)}`,p.push([l(d+c),r(s)],[l(d),r(s)])),a(m,f,p)},s=(e,t,n)=>{let i=`M${r(e)} 0V${r(t)}L${r(e+rr)} ${r(t+rr)}H${r(n)}`;a(i,i,[[r(n),r(t+rr)]])};return o(!1,n*.12,t*.1,n*.31,n*.215,t*.1),s(t*.3,n*.12,t*.43),o(!0,n*.17,t*.09,n*.39,n*.29,t*.08),o(!1,n*.52,t*.08,n*.68,n*.6,t*.08),o(!0,n*.64,t*.09,n*.84,n*.75,t*.08),o(!1,n*.9,t*.16,n*.82,null,0),s(t*.74,n*.1,t*.88),{lines:i,pulses:[[0,10,0],[2,12,-4],[3,9,-2],[4,11,-7]]}}function ar(e,t){let n=Math.max(240,Math.round(window.innerWidth)),r=Math.max(240,Math.round(window.innerHeight));e.setAttribute(`viewBox`,`0 0 ${n} ${r}`);let i=ir(t,n,r);e.replaceChildren(...i.lines.map(e=>K(`path`,{d:e.d,class:`trace`})),...i.lines.flatMap(e=>e.pads.map(([e,t])=>K(`circle`,{cx:String(e),cy:String(t),r:`3.5`,class:`pad`}))),...i.pulses.map(([e,t,n])=>K(`path`,{d:i.lines[e].pulse,class:`pulse`,pathLength:`100`,style:`animation-duration:${t}s;animation-delay:${n}s`})))}var or=new Set;function sr(e=`full`){let t=K(`svg`,{class:`circuit-bg `+e,preserveAspectRatio:`none`,"aria-hidden":`true`,focusable:`false`});return ar(t,e),or.add([t,e]),t}var cr;window.addEventListener(`resize`,()=>{clearTimeout(cr),cr=setTimeout(()=>{for(let e of[...or])e[0].isConnected?ar(e[0],e[1]):or.delete(e)},120)}),document.addEventListener(`visibilitychange`,()=>document.documentElement.classList.toggle(`bg-paused`,document.hidden));function lr(e,t){let n=e===`done`?`check`:e===`current`?t?`review`:`play`:t?`review`:`lock`,r=q(n,{size:32,fill:n===`play`,cls:`hex-ico`});r.setAttribute(`x`,`20`),r.setAttribute(`y`,`20`);let i=e===`locked`&&t?q(`lock`,{size:16,cls:`hex-badge`}):null;return i&&(i.setAttribute(`x`,`47`),i.setAttribute(`y`,`46`)),K(`svg`,{viewBox:`0 0 72 72`,width:`72`,height:`72`,class:`hexnode`,"aria-hidden":`true`,"data-icon":n},e===`current`?K(`polygon`,{points:`36,1 67,19 67,53 36,71 5,53 5,19`,class:`hex-ring`}):null,K(`polygon`,{points:`36,5 63,20.5 63,51.5 36,67 9,51.5 9,20.5`,class:`hex-body`}),K(`circle`,{cx:`36`,cy:`5`,r:`2.8`,class:`hex-pad`}),K(`circle`,{cx:`36`,cy:`67`,r:`2.8`,class:`hex-pad`}),r,i)}function ur(e=96,t=`happy`){t===`sad`&&(t=`companion`);let n=e=>K(`path`,{d:e,class:`m-ink`}),r={happy:[n(`M36 44Q31 51 36 58`),n(`M64 44Q69 51 64 58`)],think:[n(`M37 40Q32 47 37 54`),n(`M66 40Q71 47 66 54`)],companion:[n(`M31 50Q36 56 41 50`),n(`M59 50Q64 56 69 50`)],celebrate:[n(`M31 54Q36 46 41 54`),n(`M59 54Q64 46 69 54`)]}[t],i={happy:K(`path`,{d:`M42 68Q50 75 58 68`,class:`m-ink`}),think:K(`path`,{d:`M45 69H57`,class:`m-ink`}),companion:K(`path`,{d:`M44 68Q50 72 56 68`,class:`m-ink`}),celebrate:K(`path`,{d:`M42 66Q50 80 58 66z`,class:`m-ink m-solid`})}[t];return K(`svg`,{viewBox:`0 0 100 100`,width:e,height:e,class:`mascot`,"aria-hidden":`true`},K(`rect`,{x:`26`,y:`86`,width:`14`,height:`9`,rx:`3`,class:`m-solid m-ink`}),K(`rect`,{x:`60`,y:`86`,width:`14`,height:`9`,rx:`3`,class:`m-solid m-ink`}),K(`path`,{d:`M22 12H66L90 36V80Q90 90 80 90H22Q12 90 12 80V22Q12 12 22 12Z`,class:`m-body`}),K(`path`,{d:`M66 12L90 36H76Q66 36 66 26Z`,class:`m-fold`}),...r,i,t===`celebrate`?K(`path`,{d:`M14 6v8M10 10h8`,class:`m-spark`}):null)}var dr=e=>W(`span`,{class:`tk-txt`,text:e});function fr(e){let t=[],n=/("[^"]*"?)|(\b\d+(?:\.\d+)?\b)|(\bprint\b)|([=+\-*/()])/g,r=0,i;for(;i=n.exec(e);){i.index>r&&t.push(dr(e.slice(r,i.index)));let n=i[1]?`tk-str`:i[2]?`tk-num`:i[3]?`tk-fn`:`tk-op`;t.push(W(`span`,{class:n,text:i[0]})),r=i.index+i[0].length}return r<e.length&&t.push(dr(e.slice(r))),t}function pr(e,t=``){return W(`div`,{class:`codeblock `+t},e.split(`
`).map((e,t)=>W(`div`,{class:`cl`},W(`span`,{class:`ln`,text:String(t+1)}),W(`span`,{class:`lc`},fr(e)))))}var mr=xe(),J=mr.state,hr=mr.notice;an(J.prefs),hr&&Se(J);var gr=null;try{gr=window.localStorage}catch{}var _r=xn({url:me.url,anonKey:me.anonKey}),vr=null,Y=`path`,yr=`这个账号的进度已在别的设备上被替换，这台设备上还没上传的学习内容没有保留。`,br=!1,xr=null;function Sr(e){return br?(br=!1,xr=e):xr!==e&&(xr=null),xr===e?yr:null}var X=gr?St({storage:gr,api:_r,projectId:le(me.url)||`cloud-off`,legacyProject:ue,onStatus:()=>vr?.refreshStatus(),onNotice:e=>{e===`replaced`&&(br=!0,Y===`path`?$():Y===`me`&&ti())},onState:e=>{J=Ye(e,J),an(J.prefs),Y===`path`?$():Y===`me`&&ti()}}):null,Cr=X?X.restore(J):null;Cr&&(J=Cr.state,hr=null,an(J.prefs));function wr(){if(X&&X.account()){let e=X.persistLocal(J);e.ok||Br(`无法保存进度到这台设备（`+(e.message||`存储不可用`)+`），关掉页面后进度可能丢失。`)}else Se(J)||Br(`无法保存进度（可能是无痕模式或存储已满），关掉页面后进度会丢失。`)}vr=Tn({h:W,button:G,sheet:Rr,icon:q,showToast:Br,sync:X,api:_r,getState:()=>J,rerender:()=>Y===`me`?ti():$(),onSwitchedIn:e=>{J=e.state,an(J.prefs),hr=null,Y===`me`?ti():$()},onSwitchedOut:()=>{let e=xe();J=e.state,hr=e.notice,an(J.prefs),Y===`me`?ti():$()}}),X&&Cr&&X.syncNow(),X&&(addEventListener(`online`,()=>{X.account()&&X.syncNow()}),document.addEventListener(`visibilitychange`,()=>{document.visibilityState===`visible`&&X.account()&&X.syncNow()}),setInterval(()=>{document.visibilityState===`visible`&&X.account()&&X.status().pending&&X.syncNow()},6e4));var Tr=()=>d.units.filter(e=>e.available).flatMap(e=>Jn[e.id].lessons.map(t=>({...t,unit:e.id}))),Er=()=>Tr().find(e=>!J.done[e.id]);function Dr(e){return J.done[e.id]?`done`:Er()?.id===e.id?`current`:`locked`}var Or=null,Z={status:`未启用`,caches:[]},Q=document.getElementById(`app`),kr=new Set,Ar=null,jr=new c({onStatus(e,t){e===`loadError`&&(Ar=t||{});for(let n of[...kr])n.status?.(e,t)},onOutput(e){for(let t of[...kr])t.output?.(e)}}),Mr=oe(jr);function Nr(e){return new Promise(t=>{let n=null,i=null,a=e=>{clearTimeout(i),n&&kr.delete(n),t(e)},o=()=>{let n=``,r={output:e=>{n+=e},status:(e,i)=>{[`done`,`timeout`,`stopped`,`outputLimit`,`outputLimitStopped`].includes(e)&&(kr.delete(r),t(e===`done`?{out:n,error:i.error}:{out:n,error:{kind:`Stopped`,line:null,msg:`运行被停止`}}))}};kr.add(r),jr.run(e)||(kr.delete(r),t(null))};if(jr.state===`ready`)return o();n={status:e=>{e===`ready`?(kr.delete(n),clearTimeout(i),o()):e===`loadError`&&a(null)}},kr.add(n),i=setTimeout(()=>a(null),r.loadMs+2e3),jr.state===`loadError`&&jr.boot()})}function Pr(){let e=`选择、填空、排序的判分不受影响。`;if(navigator.onLine===!1)return`你现在离线。Python运行功能需要联网后加载，联网后点“重试”。`+e;let t=[];if(typeof WebAssembly>`u`&&t.push(`WebAssembly`),typeof Worker>`u`&&t.push(`后台线程（Worker）`),t.length)return`这个浏览器不支持运行 Python 需要的功能（缺少：${t.join(`、`)}）。可以升级系统或浏览器，或换成 Safari / Chrome 打开。选择、填空、排序的判分不受影响。`;if(Ar?.kind===`noWorker`)return`这个环境不允许启动 Python 运行线程（可能是浏览器版本较旧，或应用内置浏览器的限制）。可以点右上角“···”选“在浏览器打开”，或换成 Safari / Chrome。`+e;let n=navigator.userAgent.match(/OS (\d+)[_.](\d+)/),r=n?n[1]+`_`+n[2]:``;if(n&&/iPhone|iPod/.test(navigator.userAgent)&&(+n[1]<16||+n[1]==16&&+n[2]<4))return`这台设备的系统是 iOS ${n[1]}.${n[2]}，低于运行 Python 所需的 iOS 16.4（Pyodide 官方要求），所以看不到“运行结果”。升级系统后即可显示。选择、填空、排序的判分不受影响。`;let i=`诊断：${String(Ar?.msg||`无错误信息`).slice(0,120)}；在线：${navigator.onLine?`是`:`否`}${r?`；iOS `+r.replace(`_`,`.`):``}${/MicroMessenger|QQ\//i.test(navigator.userAgent)?`；微信/QQ 内`:``}`;return`Python 运行环境没有加载成功，原因未确认（可能是网络、浏览器版本，或应用内置浏览器的限制）。Python运行功能需要联网后加载，联网后点“重试”；仍然不行，请把下面的诊断信息发给开发者。`+e+`
`+i}function Fr(e,t){let n=e.querySelector(`pre`);e.querySelector(`.py-retry`)?.remove(),n.className=`out`,n.textContent=`运行中…`,e.open=!0,Nr(t).then(r=>{n.isConnected&&(r?(n.textContent=r.error?(r.out?r.out+`
`:``)+s(r.error):r.out||`程序运行完成，没有输出`,n.className=`out`+(r.error?` error`:``)):(n.textContent=Pr(),n.className=`out offline`,e.append(G(`重试`,()=>Fr(e,t),`btn small py-retry`,{"data-retry-python":``}))))})}var Ir=`button, a[href], input, select, textarea, [tabindex]`;function Lr(e){return[...e.querySelectorAll(Ir)].filter(e=>{if(e.disabled||e.getAttribute(`tabindex`)===`-1`||e.closest(`[hidden]`)||e.tagName===`INPUT`&&e.type===`hidden`)return!1;let t=getComputedStyle(e);if(t.visibility===`hidden`||t.display===`none`)return!1;let n=e.getBoundingClientRect();return n.width>0&&n.height>0})}function Rr(e,{onClose:t,cls:n=``}={}){let r=document.activeElement,i=()=>{if(!o.isConnected)return;let e=o.contains(document.activeElement);o.remove(),t?.(),r&&r!==document.body&&r.isConnected&&r.focus?r.focus({preventScroll:!0}):e&&document.activeElement&&document.activeElement!==document.body&&document.activeElement.blur?.()},a=Date.now(),o=W(`div`,{class:`overlay `+n,role:`dialog`,"aria-modal":`true`,tabindex:`-1`},W(`div`,{class:`sheet`},e(i)));o.addEventListener(`click`,e=>{e.target===o&&Date.now()-a>800&&i()}),o.addEventListener(`keydown`,e=>{if(e.key===`Escape`){e.preventDefault(),i();return}if(e.key!==`Tab`)return;let t=Lr(o);if(!t.length){e.preventDefault(),o.focus({preventScroll:!0});return}e.preventDefault();let n=t.indexOf(document.activeElement);(e.shiftKey?n<=0?t[t.length-1]:t[n-1]:n<0||n===t.length-1?t[0]:t[n+1]).focus()});let s=o.querySelector(`h2, h1`);return s&&(s.id||(s.id=`sheet-title-`+a),o.setAttribute(`aria-labelledby`,s.id)),document.body.append(o),(Lr(o)[0]||o).focus({preventScroll:!0}),i}var zr;function Br(e){let t=document.querySelector(`.toast`);t||(t=W(`div`,{class:`toast`,role:`alert`}),document.body.append(t)),t.textContent=e,clearTimeout(zr),zr=setTimeout(()=>t.remove(),6e3)}var Vr=e=>{let t=Math.ceil(e/6e4);return t>=60?`${Math.floor(t/60)} 小时 ${t%60} 分钟`:`${t} 分钟`};function Hr(e=0){let t=[{text:`你好，我是小码！`,sub:``,mood:`happy`},{text:`我会陪你一关一关学 Python。`,sub:`每关只要两三分钟，全部用点的，不用打字。`,mood:`companion`},{text:`卡住了就点我，我会给你提示。`,sub:`做题时我在左下角。`,mood:`think`}],n=t[e];Q.replaceChildren(W(`main`,{class:`onboard`},W(`div`,{class:`onboard-mid`},ur(120,n.mood),W(`h1`,{text:n.text}),n.sub?W(`p`,{text:n.sub}):null),W(`div`,{class:`onboard-dots`},t.map((t,n)=>W(`span`,{class:n===e?`on`:``}))),e===t.length-1&&_r.configured?G(`已有账号？登录`,()=>vr.openLogin({reason:`登录后会取回你在云端保存的进度。`}),`btn3d ghost wide`,{"data-onboard-login":``}):null,G(e<t.length-1?`继续`:`开始学习`,()=>{e<t.length-1?Hr(e+1):(J.onboarded=!0,wr(),$())},`btn3d primary wide`)))}function Ur(e=``){return W(`span`,{class:`stat hearts `+e,title:`红心`,"aria-label":`红心 ${J.hearts}`},q(`heart`,{size:20,fill:J.hearts>0}),String(J.hearts))}function Wr(){let e=M(J),t=Ur();return t.title=e?`下一颗红心：${Vr(e)}后`:`红心已满`,W(`header`,{class:`statsbar`},W(`span`,{class:`stat streak`,"aria-label":`连续 ${N(J)} 天`},q(`flame`,{size:20}),String(N(J))),W(`span`,{class:`stat xp`,"aria-label":`经验值 ${J.xp}`},q(`bolt`,{size:20}),String(J.xp)),t)}function Gr(e){return W(`nav`,{class:`tabbar`},G(W(`span`,{},q(`home`,{size:24}),W(`small`,{text:`学习`})),$,`tab`+(e===`path`?` on`:``),{"aria-label":`学习`}),G(W(`span`,{},q(`user`,{size:24}),W(`small`,{text:`我的`})),ti,`tab`+(e===`me`?` on`:``),{"aria-label":`我的`}))}function $(){oi?.destroy?.(),oi=null,Y=`path`;{let e=Sr(`path`);e&&(hr=e)}M(J),Or=null;let e=d.units.map(e=>{if(!e.available)return W(`section`,{class:`unit locked`},W(`div`,{class:`unit-banner`},W(`div`,{class:`unit-no`,text:`第 ${d.units.indexOf(e)+1} 单元 · 即将推出`}),W(`h2`,{text:e.title}),W(`p`,{text:e.subtitle})));let t=Jn[e.id].lessons,n=t.every(e=>J.done[e.id]);return W(`section`,{class:`unit`+(n?` complete`:``)},W(`div`,{class:`unit-banner`},W(`div`,{class:`unit-no`,text:`第 ${d.units.indexOf(e)+1} 单元${n?` · 已完成`:``}`}),W(`h2`,{text:e.title}),W(`p`,{text:e.subtitle})),W(`ol`,{class:`path`},t.map((e,t)=>{let n=Dr(e),r=[0,1,2,1,0,-1][t%6],i=G(W(`span`,{class:`node-face`,"aria-hidden":`true`},lr(n,!!e.review)),()=>qr(e),`node ${n}${e.review?` review`:``}`,{"aria-label":`${e.title}（${n===`done`?`已完成`:n===`current`?`当前关卡`:`未解锁`}）`,"data-lesson":e.id});return W(`li`,{class:`path-item`,style:`--off:${r}`},n===`current`?W(`div`,{class:`bubble`,"aria-hidden":`true`,onclick:()=>qr(e),text:t===0&&!J.done[e.id]&&J.xp===0?`从这里开始`:`开始`}):null,i,W(`div`,{class:`node-label`,text:e.title}))})))});Q.replaceChildren(sr(`full`),Wr(),W(`main`,{class:`view pathview`},hr?W(`p`,{class:`notice`,role:`status`,text:hr}):null,_i(),vr?.accountRow(),e),Gr(`path`)),hr=null,Kr()}function Kr(){let e=Q.querySelector(`.pathview`),t=e?.querySelector(`.node.current`);if(!t)return;let n=[t,t.parentElement?.querySelector(`.bubble`),t.parentElement?.querySelector(`.node-label`)].filter(Boolean),r=e.getBoundingClientRect(),i=e.querySelector(`.practice-entry-wrap`),a=i?Math.max(r.top,i.getBoundingClientRect().bottom):r.top,o=Math.min(...n.map(e=>e.getBoundingClientRect().top)),s=Math.max(...n.map(e=>e.getBoundingClientRect().bottom)),c=r.bottom-a,l=s-o,u=l>=c?a+4:a+(c-l)/2;e.scrollTop+=o-u}function qr(e){let t=Dr(e);Rr(n=>[W(`div`,{class:`lsheet`},W(`div`,{class:`lsheet-concept`,text:e.concept}),W(`h2`,{text:e.title}),W(`p`,{text:t===`locked`?`先完成前面的关卡，这一关才会解锁。`:e.story}),t===`locked`?G(`知道了`,n,`btn3d wide`):t===`done`?[G(`复习（不扣红心，完成后 +1 红心）`,()=>{n(),ni(e,{review:!0})},`btn3d primary wide`),G(`关闭`,n,`btn3d ghost wide`)]:[G(`开始 +${e.exercises.length*Yn+Zn} XP`,()=>{n(),ni(e)},`btn3d primary wide`),G(`关闭`,n,`btn3d ghost wide`)])])}function Jr(e){let t=M(J),n=Tr().filter(e=>J.done[e.id]),r=n[n.length-1]||e;Rr(e=>[W(`div`,{class:`lsheet`},ur(72,`companion`),W(`h2`,{text:`红心用完了`}),W(`p`,{text:`每 30 分钟恢复 1 颗，下一颗还要 ${Vr(t)}。也可以做一关复习：复习不扣红心，完成后恢复 1 颗。`}),G(`复习「${r.title}」`,()=>{e(),ni(r,{review:!0})},`btn3d primary wide`),G(`稍后再来`,e,`btn3d ghost wide`))])}function Yr(e,t,n,{disabled:r=!1}={}){let i=!!J.prefs[n]&&!r,a=W(`button`,{type:`button`,class:`switch`+(i?` on`:``),role:`switch`,"aria-checked":String(i),"aria-label":e,"data-pref":n,disabled:r||null},W(`span`,{class:`knob`}));return a.addEventListener(`click`,()=>{a.disabled||(J.prefs[n]=!J.prefs[n],an(J.prefs),wr(),a.classList.toggle(`on`,J.prefs[n]),a.setAttribute(`aria-checked`,String(J.prefs[n])),n===`sound`&&J.prefs.sound&&U(`select`),n===`haptics`&&J.prefs.haptics&&yn())}),W(`div`,{class:`toggle-row`},W(`div`,{},W(`b`,{text:e}),W(`small`,{text:t})),a)}function Xr(){let e=W(`pre`,{class:`diag`,"aria-label":`诊断信息`}),t=(t=``)=>{let n=bn();e.textContent=[`应用版本：2026-11-05 08:19 UTC（测试入口 u8）`,`缓存版本：${Z.caches.length?Z.caches.join(`、`).replace(/suipian-/g,``).slice(0,40):`无`}`,`离线支持：${Z.status}`,`网络：${navigator.onLine===!1?`离线`:`在线`}`,`运行方式：${er?`主屏幕 App`:`浏览器`}`,`音效开关：${n.soundPref?`开`:`关`}`,`AudioContext：${n.audioState}${n.sampleRate?`（${n.sampleRate} Hz）`:``}`,`音频会话：${n.audioSession}`,`已播放 ${n.played} 次，被丢弃 ${n.dropped} 次，解锁尝试 ${n.unlocks} 次`,`状态变化：${n.history||`无`}`,`网页振动接口：${n.vibrate?`有`:`没有`}`,`最近错误：${n.lastError||`无`}`,t].filter(Boolean).join(`
`)};return t(),Di().then(()=>{e.isConnected&&t()}),W(`div`,{class:`selftest`},W(`div`,{class:`selftest-btns`},G(`试听音效`,()=>{vn().then(e=>t(e?`试听：已播放答对音（听不到就看上面的状态）`:`试听：没有播放成功`)),t(`试听：请求中…`)},`btn3d wide`,{"data-selftest":`sound`}),rn()?G(`试振动`,()=>{let e=`没有网页振动接口，这个按钮不会振动`;if(rn())try{e=navigator.vibrate(12)?`已请求 12ms 振动`:`振动请求被浏览器拒绝`}catch{e=`振动请求出错`}t(`试振动：`+e)},`btn3d wide`,{"data-selftest":`haptic`}):null),W(`div`,{class:`soundrow`,role:`group`,"aria-label":`正式音效试听`},...[[`select`,`点选`],[`place`,`放入`],[`undo`,`撤销`],[`correct`,`答对`],[`wrong`,`答错`],[`finish`,`过关`]].map(([e,n])=>G(n,()=>{U(e,{force:!0}).then(e=>t(`正式音效「${n}」：${e?`已播放`:`没有播放成功`}`))},`chip`,{"data-sound":e}))),e)}function Zr(){let e=[],t=W(`pre`,{class:`diag`,"aria-label":`音频测试结果`}),n=()=>{try{return navigator.audioSession?navigator.audioSession.type:`（浏览器没有 audioSession）`}catch{return`（读取失败）`}},r=(navigator.userAgent.match(/(Version|CriOS|Chrome|OS) ?\/?[\d._]+/g)||[]).slice(0,2).join(` `),i=()=>{t.textContent=[`运行方式：${er?`主屏幕 App`:`Safari / 浏览器`}`,`系统：${r||`未知`}`,`音频会话：${n()}`,`—`,...e].join(`
`)},a=t=>{e.push(t),e.length>14&&e.shift(),i()},o=new URL(`sfx/test-beep.wav`,document.baseURI).href,s=new Audio;s.preload=`auto`,s.addEventListener(`canplaythrough`,()=>a(`[文件] 加载成功（${Number.isFinite(s.duration)?s.duration.toFixed(2):`?`} 秒）`)),s.addEventListener(`error`,()=>a(`[文件] 加载失败（code ${s.error?.code}：${s.error?.message||`无信息`}）`)),s.src=o;try{s.load()}catch(e){a(`[文件] load() 出错：${e.message}`)}fetch(o).then(e=>e.arrayBuffer().then(t=>a(`[文件] 网络读取 ${e.status}，${t.byteLength} 字节`))).catch(e=>a(`[文件] 网络读取失败：${e.message}`)),i();let c=(e,t)=>()=>{try{let n=``;try{navigator.audioSession&&(navigator.audioSession.type=e,n=`，audioSession 设为 ${e}`)}catch(e){n=`，audioSession 设置失败：${e.message}`}let r=window.AudioContext||window.webkitAudioContext;if(!r){a(`[${t}] 浏览器没有 AudioContext`);return}let i=new r,o=i.state;i.resume();let s=i.createOscillator(),c=i.createGain();s.type=`sine`,s.frequency.value=880,c.gain.setValueAtTime(1e-4,i.currentTime),c.gain.exponentialRampToValueAtTime(.6,i.currentTime+.01),c.gain.exponentialRampToValueAtTime(1e-4,i.currentTime+.3),s.connect(c),c.connect(i.destination),s.start(),s.stop(i.currentTime+.35),a(`[${t}] 点击内已发出声音指令；创建时 state=${o}${n}`),setTimeout(()=>a(`[${t}] 0.4 秒后 state=${i.state}，currentTime=${i.currentTime.toFixed(3)}（大于 0 说明音频时钟在走）`),400)}catch(e){a(`[${t}] 出错：${e.name}：${e.message}`)}};return W(`div`,{class:`selftest audiolab`},W(`h3`,{text:`音频兼容性测试`}),W(`p`,{class:`muted small`,text:`排查 iPhone 无声：每个按钮都在点击里直接发声。请先关掉静音键，把音量调到一半，三个都点一遍，告诉我哪个能响，并截图下面的结果。`}),W(`button`,{type:`button`,class:`btn3d wide`,"data-audiotest":`webaudio`,onclick:c(`ambient`,`A`)},`测试 A：Web Audio 提示音`),W(`button`,{type:`button`,class:`btn3d wide`,"data-audiotest":`file`,onclick:()=>{try{a(`[B] 点击：readyState=${s.readyState}，networkState=${s.networkState}，error=${s.error?s.error.code:`无`}`),s.pause(),s.currentTime=0;let e=s.play();e&&e.then?e.then(()=>a(`[B] audio.play() 成功`)).catch(e=>a(`[B] audio.play() 失败：${e.name}：${e.message}`)):a(`[B] audio.play() 已调用（浏览器没有返回 Promise）`)}catch(e){a(`[B] play() 抛出：${e.name}：${e.message}`)}}},`测试 B：本地 WAV 文件（<audio>）`),W(`button`,{type:`button`,class:`btn3d wide`,"data-audiotest":`playback`,onclick:c(`playback`,`C`)},`测试 C：Web Audio + 播放模式`),t)}function Qr(){let e=W(`pre`,{class:`diag`,"aria-label":`振动测试结果`},`每个都点几下，凭手感告诉我哪几个有轻微触感。`),t={},n=n=>()=>{t[n]=(t[n]||0)+1;let r=``;if(rn())try{r=navigator.vibrate(12)?`；已请求 navigator.vibrate(12)`:`；vibrate 被拒绝`}catch{r=`；vibrate 出错`}else r=`；没有 navigator.vibrate`;e.textContent=Object.entries(t).map(([e,t])=>`${e}：点了 ${t} 次`).join(`
`)+r+`
（是否真的有触感：等待 iPhone 真机确认）`},r=W(`input`,{type:`checkbox`,switch:!0,"data-haptic":`switch`,"aria-label":`原生开关`});r.addEventListener(`change`,n(`2 原生开关`));let i=W(`input`,{type:`checkbox`,switch:!0,class:`hap-hidden`,"data-haptic":`check-label`,"aria-label":`检查按钮样式`});return i.addEventListener(`change`,n(`4 检查按钮样式`)),W(`div`,{class:`selftest hapticlab`},W(`h3`,{text:`振动测试`}),W(`p`,{class:`muted small`,text:`四种控件各点几下，告诉我哪几个手上有轻微触感（iPhone 的 Safari 没有振动接口，这是在找系统自带的反馈）。`}),W(`button`,{type:`button`,class:`btn3d wide`,"data-haptic":`button`,onclick:n(`1 普通按钮`)},`1 普通按钮`),W(`label`,{class:`hap-row`},W(`span`,{text:`2 原生开关（直接点右边的开关）`}),r),W(`button`,{type:`button`,class:`choice hap-choice`,"data-haptic":`choice`,onclick:n(`3 选项样式`)},`3 选项样式的按钮`),W(`label`,{class:`btn3d primary hap-check`,"data-haptic":`check-box`},`4 检查按钮样式（外观是按钮，里面是隐藏的开关）`,i),e)}function $r(){let e=W(`p`,{class:`muted small keylab-status`,role:`status`}),t=()=>Vt.some(e=>e.id===J.prefs.soundStyle)?J.prefs.soundStyle:`J`,n=()=>{let n=Vt.find(e=>e.id===t());e.textContent=`当前按键音效：${n.id} ${n.name}${n.id===`J`?`（默认）`:``}`},r=Vt.map(i=>{let a=t()===i.id,o=W(`button`,{type:`button`,class:`keybtn`+(a?` sel`:``),"data-keysound":i.id,"aria-pressed":String(a)},W(`b`,{text:i.id}),W(`span`,{text:i.name+(i.id===`J`?`（默认）`:``)}),W(`small`,{text:i.desc}));return o.addEventListener(`click`,()=>{J.prefs.soundStyle=i.id,an(J.prefs),wr();let t=mn(i.id,`select`);r.forEach(e=>{let t=e===o;e.classList.toggle(`sel`,t),e.setAttribute(`aria-pressed`,String(t))}),n(),t.ok?J.prefs.sound||(e.textContent+=`（上面的“音效”开关是关的，答题时不会响）`):e.textContent+=`（这次没有发出声音：`+(t.state||`音频环境不可用`)+`）`}),o});return n(),W(`div`,{class:`keylab`},W(`h3`,{text:`按键音效`}),W(`p`,{class:`muted small`,text:`十个原创的矮轴键盘风格，默认 J。点一下试听并选用，答题时的点选、放入、撤销、答对、答错、过关都用同一个风格。`}),W(`div`,{class:`keygrid`},r),e)}function ei(){let e=!!X?.account(),t=W(`p`,{class:`backup-msg small muted`,role:`status`,"data-backup-msg":``}),n=W(`div`,{class:`backup-panel`}),r=(e,n=!1)=>{t.textContent=e,t.classList.toggle(`bad`,n)},i=()=>X?.account()?(n.replaceChildren(),r(`已登录账号，不能导入进度文件。要导入请先退出登录，导入后再登录并选“转存到账号”。`,!0),!0):!1,a=()=>{try{let e=jn(J,{build:`2026-11-05T08:19:30.380Z`,unreadable:be()}),t=new Blob([JSON.stringify(e,null,2)],{type:`application/json`}),n=URL.createObjectURL(t),i=W(`a`,{href:n,download:An(new Date),hidden:``});document.body.appendChild(i),i.click(),i.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e4),r(`已导出。文件在浏览器的下载位置（iPhone：“文件”App → 下载），请自己保管好。`)}catch{r(`导出失败，请换个浏览器再试。`,!0)}},o=W(`input`,{type:`file`,accept:`application/json,.json`,hidden:``,"data-import-file":``});return o.addEventListener(`change`,async()=>{let e=o.files&&o.files[0];if(o.value=``,n.replaceChildren(),!e||i())return;let t=``;try{t=await e.text()}catch{r(`读取文件失败。`,!0);return}let a=Mn(t);if(!a.ok){r(a.error,!0);return}let s=Pn(a.state);r(``),n.replaceChildren(W(`div`,{class:`confirm`,role:`alertdialog`,"data-import-confirm":``},W(`p`,{text:`文件里有：${s.lessons} 个已完成关卡，${s.xp} XP，连续 ${s.streak} 天${a.exportedAt?`（导出于 ${a.exportedAt.slice(0,10)}）`:``}。导入会把这些合并进当前记录：关卡取并集，XP 取较大的，不会让你现有的进度变少。`}),G(`确认导入`,()=>{i()||(J=Nn(J,a.state),wr(),ti(),Br(`进度已导入。`))},`btn3d primary`),G(`取消`,()=>{n.replaceChildren()},`btn`)))}),W(`section`,{class:`backup`,"data-backup":``},W(`h3`,{text:`备份学习记录`}),W(`p`,{class:`small muted`,text:e?`导出本机学习记录，云端状态以上方为准。已登录时不能导入（要导入请先退出登录）。`:`记录只在这台设备上。导出一份文件自己留着，换手机或清了浏览器数据后可以导回来。`}),W(`div`,{class:`acct-row`},G(`导出进度文件`,a,`btn3d`,{"data-export":``}),e?null:G(`导入进度文件`,()=>o.click(),`btn3d`,{"data-import":``})),o,n,t)}function ti(){Y=`me`,Or=null;let e=Sr(`me`),t=null,n=G(`清除学习记录`,()=>{t||(t=W(`div`,{class:`confirm`,role:`alertdialog`},W(`p`,{text:`确定要清除这台设备上的全部学习记录吗？XP、连续天数和关卡进度都会清空。`}),G(`确定清除`,()=>{let e=J.prefs;J=Ce(),J.prefs=e,J.onboarded=!0,wr(),ti(),Br(`学习记录已清除。`)},`btn danger`),G(`取消`,()=>{t.remove(),t=null},`btn`)),n.after(t))},`link small`),r=M(J),i=Tr().filter(e=>J.done[e.id]).length,a=(e,t,n)=>W(`div`,{class:`me-card`},W(`b`,{},e?q(e,{size:20}):null,t),W(`span`,{text:n}));Q.replaceChildren(Wr(),W(`main`,{class:`view me`},e?W(`p`,{class:`notice`,role:`status`,"data-replaced-notice":``,text:e}):null,W(`div`,{class:`me-head`},ur(64),W(`div`,{},W(`h1`,{text:`我的学习`}),W(`p`,{class:`muted`,text:X?.account()?`记录已关联账号，会同步到云端`:`没登录时，记录只保存在这台设备上`}))),W(`div`,{class:`me-grid`},a(`flame`,String(N(J)),`连续天数`),a(`bolt`,String(J.xp),`经验值 XP`),a(null,`${i}/${Tr().length}`,`已完成关卡`),a(`heart`,`${J.hearts}/5`,r?`${Vr(r)}后 +1`:`红心已满`)),vr?.accountCard(),ei(),W(`h3`,{text:`声音与振动`}),Yr(`音效`,`点选、答对、答错、过关的短提示音；跟随手机静音键`,`sound`),rn()?Yr(`振动`,`点“检查”和结算页“继续”时请求一次短振；有没有振动取决于你的手机和浏览器，下面可以自测`,`haptics`):W(`div`,{class:`toggle-row no-haptics`,"data-no-haptics":``},W(`div`,{},W(`b`,{text:`振动`}),W(`small`,{text:`此设备暂不支持网页触感反馈。`}))),$r(),Xr(),Zr(),rn()||/[?&]haptic-lab\b/.test(location.search)?Qr():null,W(`h3`,{text:`规则`}),W(`ul`,{class:`rules`},W(`li`,{text:`答对一题 +${Yn} XP，完成一关再 +${Zn} XP；复习每题 +${Xn} XP。`}),W(`li`,{text:`答错扣 1 颗红心，这道题会放到本关最后再做一次。`}),W(`li`,{text:`红心每 30 分钟恢复 1 颗；复习关不扣红心，完成后恢复 1 颗。`}),W(`li`,{text:`每天完成至少一关，连续天数 +1；断一天就从头算。`})),W(`h3`,{text:`添加到主屏幕`}),W(`p`,{text:`iPhone：用 Safari 打开 → 分享按钮 → 「添加到主屏幕」。从主屏幕打开是全屏的，记录也和 Safari 分开保存。`}),X?.account()?null:n),Gr(`me`))}function ni(e,{review:t=!1}={}){if(Y=`lesson`,xr=null,M(J),!t&&J.hearts<=0)return Jr(e);let n={lesson:e,review:t,queue:e.exercises.map((e,t)=>t),total:e.exercises.length,correct:0,xp:0,wrongOnce:new Set,mistakes:0};Or=n,ai(n)}function ri(e){let t=Math.round(e.correct/e.total*100);return W(`header`,{class:`lessonbar`},G(q(`close`,{size:24}),()=>ii(e),`icon-btn ghost`,{"aria-label":`退出本关`}),W(`div`,{class:`progress`,role:`progressbar`,"aria-valuenow":String(t),"aria-valuemin":`0`,"aria-valuemax":`100`},W(`div`,{class:`progress-fill`,style:`width:${Math.max(4,t)}%`})),e.review?W(`span`,{class:`stat shield`,title:`复习不扣红心`},q(`shield`,{size:22})):Ur())}function ii(e){Rr(e=>[W(`div`,{class:`lsheet`},W(`h2`,{text:`要退出这一关吗？`}),W(`p`,{text:`退出后，本关答题位置不会保存，下次从第 1 题重新开始。已得的 XP 和已扣的红心会保留。`}),G(`继续学习`,e,`btn3d primary wide`),G(`退出`,()=>{e(),$()},`btn3d danger-ghost wide`))])}function ai(e){let t=e.lesson;Q.replaceChildren(sr(`full`),ri(e),W(`main`,{class:`lesson`},W(`div`,{class:`intro-screen`},pr(t.introCode,`phone`)),W(`div`,{class:`intro-panel`},W(`div`,{class:`intro-concept`,text:(e.review?`复习 · `:``)+t.concept}),W(`h1`,{class:`intro-title`,text:t.title}),W(`p`,{class:`intro-story`,text:t.story}))),W(`footer`,{class:`lessonfoot`},W(`span`,{class:`mascot-slot`},ur(56)),G(`继续`,()=>si(e),`btn3d primary grow`)))}var oi=null;function si(e){if(oi?.destroy?.(),oi=null,e.queue.length===0)return mi(e);let t=e.queue[0],n=e.lesson.exercises[t];window.__app.currentEx=n,window.__app.renders=(window.__app.renders||0)+1;let r=!1,i=!1,a=Pt(n),o=a||n.type===`pick`?null:W(`details`,{class:`outpanel`},W(`summary`,{text:`运行结果`}),W(`pre`,{class:`out`,text:``})),s=G(`检查`,()=>d(),`btn3d primary grow`,{"data-check":``});s.disabled=!0;let c=()=>{i||(s.disabled=!l.ready())},l=a?zt(n,{exec:Mr,runner:jr,onChange:c,ui:{sheet:Rr,button:G},pythonUnavailable:()=>typeof Pr==`function`?Pr():void 0}):n.type===`predict`?li(n,c):n.type===`pick`?ui(n,c):n.type===`fill`?fi(n,c):pi(n,c);oi=a?l:null,window.__app.currentArea=l;let u=G(ur(56,`think`),()=>{if(l.openHint)return l.openHint();let e=r||!n.hint?ci(n):n.hint,t=r||!n.hint?`答案是：`:`小码提示：`;r=!0,Rr(n=>[W(`div`,{class:`lsheet hint`},W(`div`,{class:`hint-row`},ur(48,`think`),W(`b`,{text:t})),W(`pre`,{class:`hint-text`,text:e}),G(`好的`,n,`btn3d primary wide`))])},`mascot-btn`,{"aria-label":`让小码给个提示`});Q.replaceChildren(sr(`edge`),ri(e),W(`main`,{class:`lesson`},n.tip?W(`p`,{class:`tip-line`},W(`b`,{text:`提示 `}),n.tip):null,W(`h2`,{class:`q`,text:n.prompt}),n.trace?di(n.trace):null,l.node,o),W(`footer`,{class:`lessonfoot`},u,s),...l.after?[l.after]:[]);function d(){if(!(i||s.disabled)){if(a)return p();m(l.isCorrect(),!1)}}let f=!1;async function p(){if(f)return;f=!0,s.disabled=!0,s.textContent=`检查中…`,yn();let e;try{e=await l.check()}finally{f=!1}s.isConnected&&!i&&(e.attempt&&e.settle?m(e.status===`pass`,!0):(s.textContent=`检查`,s.disabled=!l.ready()))}function m(r,c){i=!0,s.disabled=!0,s.textContent=`检查中`,l.lock(),c||yn(),l.settled?.(r);let u=nn();if(r){e.correct++;let t=e.review?Xn:Yn;e.xp+=t,J.xp+=t,wr()}else e.mistakes++,e.review||(we(J),wr()),e.queue.push(t);e.queue.shift();let d=r?l.why():l.whyWrong(),f=!r&&!e.review&&J.hearts<=0;!a&&o&&Fr(o,n.type===`predict`?n.code:l.code());let p=!1,m=G(f?`红心用完了`:`继续`,()=>{p||(p=!0,f?($(),Jr(e.lesson)):si(e))},`btn3d `+(r?`primary`:`danger`)+` wide`,{"data-continue":``});m.disabled=!0;let h=W(`div`,{class:`feedbar `+(r?`ok`:`bad`),role:`status`},W(`div`,{class:`fb-head`},q(r?`check`:`cross`,{size:26,cls:`fb-ico`}),W(`b`,{text:r?`答对了！`:`不对哦`}),r?W(`span`,{class:`fb-xp`,text:`+${e.review?Xn:Yn} XP`}):null),d?W(`p`,{text:d}):null,!r&&!a?W(`p`,{class:`fb-answer`},`正确答案：`,W(`code`,{text:ci(n)})):null,!r&&!e.review?W(`p`,{class:`fb-heart`},q(`heart`,{size:16}),`红心 -1（剩 ${J.hearts} 颗）。这道题稍后再做一次。`):null,m);setTimeout(()=>{s.isConnected&&(l.mark(),U(r?`correct`:`wrong`),Q.querySelector(`.lessonfoot`).replaceWith(h),l.afterFeedback?.(),setTimeout(()=>{h.isConnected&&(Q.querySelector(`.lessonbar`).replaceWith(ri(e)),!r&&!e.review&&Q.querySelector(`.lessonbar .hearts`)?.classList.add(`lost`))},u?0:120),setTimeout(()=>{h.isConnected&&(m.disabled=!1)},u?0:160))},Qn)}}function ci(e){if(e.type===`predict`||e.type===`pick`)return e.options.find(e=>e.correct).text;if(e.type===`fill`){let t=e.code;return e.answer.forEach((e,n)=>t=t.replace(`{${n}}`,e)),t}return e.answers[0].map(t=>e.lines[t]).join(`
`)}function li(e,t){let n=null,r=!1,i=W(`div`,{class:`choices`},e.options.map((e,a)=>G(W(`pre`,{text:e.text}),()=>{r||(n=a,U(`select`),i.querySelectorAll(`.choice`).forEach((e,t)=>e.classList.toggle(`sel`,t===a)),t())},`choice`,{"aria-label":`选项：${e.text.replace(/\n/g,` 换行 `)}`})));return{node:W(`div`,{},pr(e.code),i),ready:()=>n!==null,lock:()=>{r=!0},mark:()=>{i.querySelectorAll(`.choice`).forEach((t,r)=>{e.options[r].correct?t.classList.add(`right`):r===n&&t.classList.add(`wrong`)})},isCorrect:()=>!!e.options[n].correct,why:()=>e.options[n].why,whyWrong:()=>e.options[n].why,code:()=>e.code}}function ui(e,t){let n=li({...e,code:e.code||``},t);return e.code||(n.node=W(`div`,{},n.node.lastChild)),n.code=()=>e.code||``,n}function di(e){return W(`div`,{class:`trace`,role:`group`,"aria-label":`Python 的报错信息`},W(`div`,{class:`trace-cap`,text:`Python 的报错`}),W(`pre`,{class:`trace-pre`,text:e}))}function fi(e,t){let n=(e.code.match(/\{\d+\}/g)||[]).length,r=e.initial?[...e.initial]:Array(n).fill(null),i=Math.max(0,r.findIndex(t=>t===null||e.initial&&t===e.initial[0])),a=!1,o=!1,s=W(`div`,{class:`codeblock fill`}),c=W(`div`,{class:`bank`}),l=()=>{s.replaceChildren(...e.code.split(`
`).map((t,n)=>{let s=t.split(/(\{\d+\})/);return W(`div`,{class:`cl`},W(`span`,{class:`ln`,text:String(n+1)}),W(`span`,{class:`lc`},s.flatMap(t=>{let n=/^\{(\d+)\}$/.exec(t);if(!n)return fr(t);let s=Number(n[1]),c=o&&r[s]!==e.answer[s];return G(r[s]??``,()=>{a||(i=s,U(`select`),l())},`slot`+(r[s]?` filled`:``)+(s===i&&!a?` active`:``)+(o?c?` wrong`:` right`:``),{"aria-label":`空格 ${s+1}：${r[s]||`空`}`,"data-slot":String(s)})})))})),c.replaceChildren(W(`div`,{class:`bank-ctrl`},G(`⌫`,()=>{a||(r[i]=null,U(`undo`),l(),t())},`kchip ctrl`,{"aria-label":`清空当前空格`}),G(`‹`,()=>{a||(i=Math.max(0,i-1),U(`select`),l())},`kchip ctrl`,{"aria-label":`上一个空格`}),G(`›`,()=>{a||(i=Math.min(n-1,i+1),U(`select`),l())},`kchip ctrl`,{"aria-label":`下一个空格`})),W(`div`,{class:`bank-tokens`},e.tokens.map(e=>G(e,()=>{if(a)return;r[i]=e,U(`place`);let n=r.findIndex(e=>e===null);n!==-1&&(i=n),l(),t()},`kchip tok`,{"data-token":e}))))};l();let u=G(`↺ 重新开始`,()=>{a||(r=e.initial?[...e.initial]:Array(n).fill(null),i=0,U(`undo`),l(),t())},`link small reset`),d=()=>{let t=e.code;return r.forEach((e,n)=>t=t.replace(`{${n}}`,e??``)),t},f=()=>r.find((t,n)=>t!==e.answer[n]);return{node:W(`div`,{},s,c,u),ready:()=>r.every(e=>e!==null)&&!(e.initial&&r.every((t,n)=>t===e.initial[n])),lock:()=>{a=!0,l()},mark:()=>{o=!0,l()},isCorrect:()=>r.every((t,n)=>t===e.answer[n]),why:()=>``,whyWrong:()=>e.why?.[f()]||`这样运行出来的结果和要求不一样，看看下面的运行结果。`,code:d}}function pi(e,t){let n=[],r=!1,i=W(`div`,{class:`order-mine`,"aria-label":`你的程序`}),a=W(`div`,{class:`order-bank`}),o=()=>{i.replaceChildren(...n.length?n.map((i,a)=>G(W(`span`,{},W(`span`,{class:`ln`,text:String(a+1)}),fr(e.lines[i])),()=>{r||(n.splice(a,1),U(`undo`),o(),t())},`line-chip in`,{"data-line":String(i)})):[W(`p`,{class:`muted order-empty`,text:`点下面的代码行，按顺序放到这里`})]),a.replaceChildren(...e.shuffled.filter(e=>!n.includes(e)).map(i=>G(W(`span`,{},fr(e.lines[i])),()=>{r||(n.push(i),U(`place`),o(),t())},`line-chip`,{"data-line":String(i)})))};o();let s=G(`↺ 重新开始`,()=>{r||(n=[],U(`undo`),o(),t())},`link small reset`),c=()=>n.map(t=>e.lines[t]).join(`
`),l=e.answers.map(t=>t.map(t=>e.lines[t]).join(`
`));return{node:W(`div`,{},W(`div`,{class:`order-label`,text:`你的程序`}),i,W(`div`,{class:`order-label`,text:`代码行`}),a,s),ready:()=>n.length===e.lines.length,lock:()=>{r=!0},mark:()=>{i.classList.add(l.includes(c())?`right`:`wrong`)},isCorrect:()=>l.includes(c()),why:()=>``,whyWrong:()=>`顺序不对。程序从上往下一行一行执行：变量要先存好值，才能拿来用；想先显示的，就放在前面。`,code:c}}function mi(e){let t=e.lesson,n=!J.done[t.id];J.done[t.id]=!0,J.lessonsCompleted++;let r=e.review?0:Zn;e.xp+=r,J.xp+=r;let i=De(J),a=null;e.review&&(M(J),J.hearts<5&&(J.hearts++,a=`复习奖励：恢复 1 颗红心（现在 ${J.hearts} 颗）`)),wr(),Or=null,U(`finish`);let o=Math.round(e.total/(e.total+e.mistakes)*100);Q.replaceChildren(W(`main`,{class:`finish`},ur(120,`celebrate`),W(`h1`,{text:e.mistakes===0?`完美！`:`完成！`}),W(`p`,{class:`muted`,text:n?`「${t.title}」通关`:`复习「${t.title}」完成`}),W(`div`,{class:`finish-stats`},W(`div`,{class:`fs`},W(`small`,{text:`本关 XP`}),W(`b`,{},q(`bolt`,{size:20}),`+${e.xp}`)),W(`div`,{class:`fs`},W(`small`,{text:`正确率`}),W(`b`,{text:`${o}%`})),W(`div`,{class:`fs`},W(`small`,{text:`连续天数`}),W(`b`,{},q(`flame`,{size:20}),String(N(J))))),i?W(`p`,{class:`streak-msg`,text:N(J)>1?`连续学习 ${N(J)} 天，保持住！`:`今天的学习完成了，明天再来续上连续天数！`}):null,a?W(`p`,{class:`heart-msg`,text:a}):null,G(`继续`,()=>{yn(),$()},`btn3d primary wide`,{"data-continue":``})))}var hi=null,gi=()=>d.units.filter(e=>e.available).map(e=>({id:e.id,title:e.title,lessons:Jn[e.id].lessons}));function _i(){let e=Ln(gi(),J.done).length>0,t=G(W(`span`,{class:`practice-entry-text`},W(`b`,{text:`随机练习`}),W(`small`,{text:`无奖励，自由练习`})),()=>vi(),`btn3d practice-entry wide`,{"data-practice-entry":``});return t.disabled=!e,W(`div`,{class:`practice-entry-wrap`},t,e?null:W(`p`,{class:`muted small practice-empty`,"data-practice-empty":``,text:`完成第一关后可开始刷题`}))}function vi(e){Y=`practice`,xr=null,Or=null,hi=null;let t=Ln(gi(),J.done);if(!t.length){Q.replaceChildren(sr(`full`),Wr(),W(`main`,{class:`view practice-setup`},ur(96,`companion`),W(`h1`,{text:`还不能刷题哦`}),W(`p`,{"data-practice-empty":``,text:`随机练习只用你已经通关的关卡出题。完成第一关后可开始刷题，先去闯一关吧！`}),G(`回到地图`,$,`btn3d primary wide`)),Gr(`path`));return}let n=new Set(e?.selected||t.flatMap(e=>e.lessons.map(e=>e.id))),r=e?.size||10,i=W(`p`,{class:`practice-info`,role:`status`,"data-practice-info":``}),a=G(`开始练习`,()=>{let e=Rn(gi(),J.done,n);e.length&&yi(e,r,{selected:[...n],size:r})},`btn3d primary wide`,{"data-practice-start":``}),o=W(`div`,{class:`practice-units`}),s=W(`div`,{class:`practice-sizes`,role:`group`,"aria-label":`每轮题数`}),c=()=>{let e=Rn(gi(),J.done,n).length,l=Math.min(r,e);a.disabled=e===0,i.textContent=e===0?`请至少选一个关卡。`:l<r?`已选范围只有 ${e} 道题，不够 ${r} 道，本轮用全部 ${l} 道。`:`本轮 ${l} 道题（已选范围共 ${e} 道）。`,o.replaceChildren(...t.map(e=>{let t=e.lessons.map(e=>e.id),r=t.every(e=>n.has(e)),i=t.some(e=>n.has(e));return W(`div`,{class:`practice-unit`},G(W(`span`,{},W(`b`,{text:e.title}),W(`small`,{text:`已通关 ${t.length} 关`})),()=>{r?t.forEach(e=>n.delete(e)):t.forEach(e=>n.add(e)),U(`select`),c()},`pchip unit-chip`+(r?` sel`:i?` part`:``),{"aria-pressed":String(r),"data-practice-unit":e.id}),W(`div`,{class:`practice-lessons`},e.lessons.map(e=>G(e.title,()=>{n.has(e.id)?n.delete(e.id):n.add(e.id),U(`select`),c()},`pchip`+(n.has(e.id)?` sel`:``),{"aria-pressed":String(n.has(e.id)),"data-practice-lesson":e.id}))))})),s.replaceChildren(...Fn.map(e=>G(`${e} 题`,()=>{r=e,U(`select`),c()},`pchip size`+(e===r?` sel`:``),{"aria-pressed":String(e===r),"data-practice-size":String(e)})))},l=G(`全部已学`,()=>{t.forEach(e=>e.lessons.forEach(e=>n.add(e.id))),c()},`link small`,{"data-practice-all":``}),u=G(`取消全部`,()=>{n.clear(),c()},`link small`,{"data-practice-none":``});c(),Q.replaceChildren(sr(`full`),Wr(),W(`main`,{class:`view practice-setup`},W(`h1`,{text:`随机练习`}),W(`p`,{class:`muted`,text:`无奖励，自由练习：只从已通关的关卡出题，不加 XP、不扣红心、不计连续天数，也不影响解锁。`}),W(`div`,{class:`practice-head`},W(`h3`,{text:`范围`}),W(`span`,{class:`practice-links`},l,u)),o,W(`h3`,{text:`每轮题数`}),s,i,a,G(`回到地图`,$,`btn3d ghost wide`)),Gr(`path`))}function yi(e,t,n){let r=Bn(e,t);hi={setup:n,requested:r.requested,total:r.actual,items:r.items.map(e=>({...e,ex:Vn(e.ex)})),queue:r.items.map((e,t)=>({i:t,retry:!1})),results:r.items.map(()=>({first:null,retry:null})),answered:0},Si(hi)}function bi(e){let t=Math.round(e.answered/Math.max(1,e.total+e.results.filter(e=>e.first===!1).length)*100);return W(`header`,{class:`lessonbar`},G(q(`close`,{size:24}),()=>xi(e),`icon-btn ghost`,{"aria-label":`退出练习`}),W(`div`,{class:`progress`,role:`progressbar`,"aria-valuenow":String(t),"aria-valuemin":`0`,"aria-valuemax":`100`},W(`div`,{class:`progress-fill`,style:`width:${Math.max(4,t)}%`})),W(`span`,{class:`stat practice-tag`,title:`随机练习无奖励`},`练习`))}function xi(e){Rr(t=>[W(`div`,{class:`lsheet`},W(`h2`,{text:`要退出练习吗？`}),W(`p`,{text:`本轮练习位置不保存。随机练习不影响 XP、红心、连续天数和解锁。`}),G(`继续练习`,t,`btn3d primary wide`),G(`退出`,()=>{t(),hi===e&&(hi=null),$()},`btn3d danger-ghost wide`,{"data-practice-quit":``}))])}function Si(e){if(hi!==e)return;if(e.queue.length===0)return wi(e);let{i:t,retry:n}=e.queue[0],r=e.items[t],i=r.ex;window.__app.currentEx=i,window.__app.currentPracticeItem={id:r.id,retry:n};let a=!1,o=i.type===`pick`?null:W(`details`,{class:`outpanel`},W(`summary`,{text:`运行结果`}),W(`pre`,{class:`out`,text:``})),s=G(`检查`,()=>u(),`btn3d primary grow`,{"data-check":``});s.disabled=!0;let c=()=>{a||(s.disabled=!l.ready())},l=i.type===`predict`?li(i,c):i.type===`pick`?ui(i,c):i.type===`fill`?fi(i,c):pi(i,c);Q.replaceChildren(sr(`edge`),bi(e),W(`main`,{class:`lesson`},W(`p`,{class:`tip-line practice-src`},W(`b`,{text:n?`重练 `:`随机练习 `}),Ci(r.lessonId)),i.tip?W(`p`,{class:`tip-line`},W(`b`,{text:`提示 `}),i.tip):null,W(`h2`,{class:`q`,text:i.prompt}),i.trace?di(i.trace):null,l.node,o),W(`footer`,{class:`lessonfoot`},W(`span`,{class:`mascot-slot`},ur(56,`think`)),s));function u(){if(a||s.disabled)return;a=!0,s.disabled=!0,s.textContent=`检查中`,l.lock(),yn();let r=l.isCorrect(),c=nn();n?e.results[t].retry=r:e.results[t].first=r,e.answered++,e.queue.shift(),!r&&!n&&e.queue.push({i:t,retry:!0});let u=r?l.why():l.whyWrong();o&&Fr(o,i.type===`predict`?i.code:l.code());let d=!1,f=G(`继续`,()=>{d||(d=!0,Si(e))},`btn3d `+(r?`primary`:`danger`)+` wide`,{"data-continue":``});f.disabled=!0;let p=W(`div`,{class:`feedbar `+(r?`ok`:`bad`),role:`status`},W(`div`,{class:`fb-head`},q(r?`check`:`cross`,{size:26,cls:`fb-ico`}),W(`b`,{text:r?`答对了！`:`不对哦`})),u?W(`p`,{text:u}):null,!r&&n?W(`p`,{class:`fb-answer`},`解答：`,W(`code`,{text:ci(i)})):null,!r&&!n?W(`p`,{class:`fb-retry`,text:`这道题会在本轮最后再练一次。`}):null,f);setTimeout(()=>{s.isConnected&&(l.mark(),U(r?`correct`:`wrong`),Q.querySelector(`.lessonfoot`).replaceWith(p),setTimeout(()=>{p.isConnected&&(f.disabled=!1)},c?0:160))},Qn)}}function Ci(e){let t=Tr().find(t=>t.id===e);return t?t.title:e}function wi(e){let t=e.results.filter(e=>e.first===!0).length,n=e.items.map((t,n)=>({it:t,r:e.results[n]})).filter(e=>e.r.first===!1),r=n.filter(e=>e.r.retry===!0).length;U(`finish`);let i=e.setup;hi=null,Q.replaceChildren(W(`main`,{class:`finish practice-finish`},ur(110,n.length?`companion`:`celebrate`),W(`h1`,{text:`练习完成`}),e.total<e.requested?W(`p`,{class:`muted`,text:`题目不够 ${e.requested} 道，本轮用了全部 ${e.total} 道。`}):null,W(`div`,{class:`finish-stats`},W(`div`,{class:`fs`},W(`small`,{text:`首次答对`}),W(`b`,{"data-practice-first":``,text:`${t}/${e.total}`})),W(`div`,{class:`fs`},W(`small`,{text:`重练答对`}),W(`b`,{"data-practice-retry":``,text:`${r}/${n.length}`}))),n.length?W(`div`,{class:`practice-wrong`},W(`h3`,{text:`错题`}),W(`ul`,{},n.map(e=>W(`li`,{},W(`span`,{text:`${Ci(e.it.lessonId)}：${e.it.ex.prompt}`}),W(`small`,{text:e.r.retry?`重练答对`:`重练仍错，已看解答`}))))):null,W(`p`,{class:`muted small`,text:`随机练习不加 XP、不扣红心、不计连续天数。`}),G(`再来一轮`,()=>vi(i),`btn3d primary wide`,{"data-practice-again":``}),G(`回到地图`,()=>{yn(),$()},`btn3d ghost wide`,{"data-continue":``})))}var Ti=window.visualViewport;if(Ti){let e=()=>document.documentElement.style.setProperty(`--app-h`,Ti.height+`px`);Ti.addEventListener(`resize`,e),e()}document.addEventListener(`visibilitychange`,()=>{document.visibilityState===`visible`&&Q.querySelector(`.statsbar`)&&(M(J),wr(),Q.querySelector(`.statsbar`).replaceWith(Wr()))}),window.__app={allLessons:Tr,startLesson:ni,sync:X,accountUi:vr,sheet:Rr,LIMITS:r,pythonUnavailableText:Pr,swInfo:Z,refreshSwInfo:Di,keysounds:()=>qn(()=>Promise.resolve().then(()=>Bt),void 0,import.meta.url),runner:jr,getState:()=>J,setState:e=>{J=e,an(e.prefs)},persist:wr,renderPath:$,words:b,feel:$t,getRun:()=>Or,getPractice:()=>hi};var Ei=null;async function Di(){if(!(`serviceWorker`in navigator))return Z.status=`此浏览器不支持`,Z;try{Z.caches=typeof caches<`u`?(await caches.keys()).filter(e=>e.startsWith(`suipian-`)):[],Z.status=navigator.serviceWorker.controller?`已启用（断网后可打开地图和课程）`:Ei?`正在安装，刷新一次后生效`:`未启用`}catch{Z.status=`读取失败`}return Z}if(`serviceWorker`in navigator){let e=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener(`controllerchange`,()=>{e&&Br(`已更新到新版本，刷新页面后使用最新内容。`),Di()});let t=()=>navigator.serviceWorker.register(`./sw.js`).then(e=>{Ei=e,Di()}).catch(e=>{Z.status=`注册失败：`+(e?.message||e)});document.readyState===`complete`?t():window.addEventListener(`load`,t),document.addEventListener(`visibilitychange`,()=>{document.visibilityState===`visible`&&Ei?.update().catch(()=>{})})}window.addEventListener(`online`,()=>{jr.state===`loadError`&&jr.boot(),Ei?.update().catch(()=>{})}),J.onboarded?$():Hr();try{jr.boot()}catch{}