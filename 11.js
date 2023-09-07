/**
 * 获取最大的盛水容器 得到能装多少水
 * 遍历破解 取决于短的一端的高度
 * 遍历获取
 * @param {*} height []
 */
const maxArea = function (height) {
    let maxAreaNum = 0
    let tempAreaNum = 0
    for(let i = 0; i < height.length; i++) {
        for (let j = i+1; j < height.length; j++) {
            tempAreaNum = Math.min(height[i], height[j]) * (j-i)
            maxAreaNum = Math.max(maxAreaNum, tempAreaNum)
        }
    }
    return maxAreaNum
}

console.log(maxArea([1,8,6,2,5,4,8,3,7]))
console.log(maxArea([1,1]));
