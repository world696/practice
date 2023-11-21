/**
 * 获取最大的盛水容器 得到能装多少水
 * 【遍历破解】 取决于短的一端的高度
 * 遍历获取---有问题--超出时间限制
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

/**
 * 【双指针】
 * 指针初始指向数组两端开始和结束的元素，然后计算两个之间的最小值距离；指向元素值小的 指针指向前一元素，计算同上；直到两个指针指向同一元素结束
 * @param {*} height []
 */
const maxArea2 = function(height = []) {
  let left = 0
  let right = height.length - 1
  let maxAreaNum = 0
  while(left < right) {
    maxAreaNum = Math.max(maxAreaNum, (right -left) * Math.min(height[left], height[right]))
    if (height[left] >= height[right]) {
        right--
    } else {
        left++
    }
  }
  return maxAreaNum
}

console.log(maxArea2([1,8,6,2,5,4,8,3,7]))
console.log(maxArea2([1,1]));
console.log(maxArea2([1,2]));
