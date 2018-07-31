# console-with-explain
输出console时自动带上该console所在方法名，文件名，和行数, 支持sourcemap 

## 使用
```javascript
npm install console-with-explain

```

main.js 全局替换console
```javascript
// 浏览器环境
if (process.env.NODE_ENV === 'development') {
    const createConsole = require('console-with-explain')
    window.console = createConsole({preClear: true})
}
```

其他文件 直接使用console
```javascript
// ...otherCode
mounted() {
  console.log('here);
}
// ...other code
test();
```

## 效果图
![image](https://raw.githubusercontent.com/mini-peanut/peanut-img-gallery/master/console%E5%9B%BE%E4%BE%8B.png)

## 配置参数
```

preClear {Boolean} 默认false, 打印之前是否清除之前的控制台输出
enableGroup {Boolean} 默认true, 是否使用group分组
pathDepth {Number} 默认2, 打印路径的深度

```

## 性能

同一位置，只计算一次，之后使用缓存，不存在性能问题

## todolist
* [ ] 支持打印async await方法名


## Q && A

Q：已经有sourcemap了，为什么要用这个

```
A： sourcemap 需要点进去才能看到该代码里相应的位置， 在控制台上查看多个console时并不直观，本插件就是你使用console时，自动为你打印你输出的位置，包括方法名，文件路径，行数，可以更加直观的分析打印出来的数据
```



