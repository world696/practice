const { exec } = require('child_process')
const os = require('os')

// 可以打开浏览器 open:true
function openBrowser(url) {
  if (os.platform() === 'darwin') {  // macOS
    exec(`open ${url}`); //执行shell脚本
  } else if (os.platform() === 'win32') {  // Windows
    exec(`start ${url}`); //执行shell脚本
  } else {  // Linux, Unix-like
    exec(`xdg-open ${url}`); //执行shell脚本
  }
}

// Example usage
openBrowser('https://www.juejin.cn')