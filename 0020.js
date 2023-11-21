/**
 * 【有效的括号】
 * @param {*string} s 
 * @returns {boolean}
 * 思路：【20栈】
 * 首先, 存在的括号是成双成对的；一定是偶数，否则的话就一定是false
 * 其次, 能拿得到 给定的字符串map
 */

const isValid = function(s) {
  if (s.length % 2) return false
  let mapStr = new Map([[')', '('], [']', '['], ['}', '{']])
  let stack = []
  for (let i of s) {
    if (mapStr.get(i)) {
        if (stack[stack.length - 1] !== mapStr.get(i)) return false;
        else stack.pop();
    } else {
      stack.push(i)
    }
  }
  return !stack.length
}

console.log(isValid("()[]{}"))
console.log(isValid("()"))
console.log(isValid("(]"))

