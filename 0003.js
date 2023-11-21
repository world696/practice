
/**
 * 【03】获取最长字串长度
 * @param {*} str 字符串
 * @returns number 字符串长度
 * 时间复杂度 
 * charAt 返回字符串中的第x个字符
 */
const lengthOfLongstring = function(str) {
    let arr = [], max = 0
    for(let i = 0; i< str.length; i++) {
        let index = arr.indexOf(str[i])
        if (index !== -1) {
            arr.splice(0, index + 1)
        }
        arr.push(str.charAt(i))
        max = Math.max(arr.length, max)
    }
    return max
}

console.log(lengthOfLongstring('abcabcbb'))