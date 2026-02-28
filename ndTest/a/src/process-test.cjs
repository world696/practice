/**
 * process
 * 是Nodejs操作当前进程和控制当前进程的API;
 * 并且是挂载到globalThis下面的全局API
 */

// process.cwd() 返回当前的工作目录
console.log('cwd===', process.cwd()); // D:\d_w\practice\ndTest\a

/**
 * process.argv
 * 获取执行进程后面的参数 返回是一个数组;
 * --open       → 传给脚本的命令行参数
 * --xm         → 传给脚本的命令行参数
 * 
 * 
 * [
  'C:\\Program Files\\nodejs\\node.exe',
  'D:\\d_w\\practice\\ndTest\\a\\src\\process-test.cjs'
]
 */
console.log('argv', process.argv);

/**
 * process.memoryUsage() 用于获取当前进程的内存使用情况
 * 返回一个对象
 * rss（Resident Set Size，常驻集大小）、heapTotal（堆区总大小）、heapUsed（已用堆大小）和 external（外部内存使用量）
 * 
 * memoryUsage: {
    rss: 33660928,
    heapTotal: 4689920,
    heapUsed: 4003136,
    external: 1489167,
    arrayBuffers: 10515
   }
 */
console.log('memoryUsage:', process.memoryUsage());

/**
 * process.exit()
 * 调用 process.exit() 将强制进程尽快退出，即使仍有未完全完成的异步操作挂起
 */

// setTimeout(() => {
//     console.log('55'); // 不会打印出来，因为2s的时候进程已经被退出
// }, 5 * 1000);

// setTimeout(() => {
//     process.exit()
// }, 2 * 1000)

// process.on('exit', () => {
//     console.log('进程被退出');
// })

/**
 * process.kill()
 * 与exit类似，kill用来杀死一个进程，接受一个参数进程id可以通过process.pid 获取
 */

/**
 * process.env
 * 用于读取操作系统所有的环境变量，也可以修改和查询环境变量。
 * 注意修改并不会真正影响操作系统的变量，而是只在当前线程生效，线程结束便释放。
 */

process.env.JAVA_HOEM = 'QQY'
console.log(process.env)

/**
 * cross-env
 * cross-env 是 跨平台设置和使用环境变量 不论是在Windows系统还是POSIX系统
 * 同时，它提供了一个设置环境变量的脚本，使得您可以在脚本中以unix方式设置环境变量，然后在Windows上也能兼容运行
 */