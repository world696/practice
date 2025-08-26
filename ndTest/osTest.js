const os = require('node:os')

// console.log('os=========', os)

console.log(os.type()) // 操作系统类型 Windows_NT
console.log(os.platform()) // win32
console.log(os.release()); // 10.0.19044 操作系统版本
console.log(os.homedir()); // C:\Users\yan.qi 用户目录
console.log(os.arch()); // x64  CPU架构


// cpu 线程信息
console.log(os.cpus());
/**
 * [
  {
    model: '11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz',
    speed: 2803,
    times: {
      user: 1015203,
      nice: 0,
      sys: 1226718,
      idle: 55992250,
      irq: 127437
    }
  },
  {
    model: '11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz',
    speed: 2803,
    times: { user: 426437, nice: 0, sys: 280046, idle: 57527468, irq: 4468 }
  },
  {
    model: '11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz',
    speed: 2803,
    times: { user: 1127875, nice: 0, sys: 801796, idle: 56304281, irq: 25687 }
  },
  {
    model: '11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz',
    speed: 2803,
    times: { user: 481859, nice: 0, sys: 256531, idle: 57495562, irq: 3703 }
  },
  {
    model: '11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz',
    speed: 2803,
    times: { user: 737890, nice: 0, sys: 490703, idle: 57005359, irq: 11156 }
  },
  {
    model: '11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz',
    speed: 2803,
    times: { user: 478828, nice: 0, sys: 294656, idle: 57460453, irq: 5343 }
  },
  {
    model: '11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz',
    speed: 2803,
    times: { user: 762890, nice: 0, sys: 510343, idle: 56960718, irq: 10859 }
  },
  {
    model: '11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz',
    speed: 2803,
    times: { user: 482406, nice: 0, sys: 310484, idle: 57441046, irq: 5296 }
  }
]
 */




