/**
 * 【16】最接近三数之和
 * 排序+双指针
 * @param {*} nums []
 * @param {*} target 目标值 
 */

const threeSumClosest =  function(nums = [], target) {
  // 数组先排序-从小到大
  nums = nums.sort((a, b) => {return a - b })
  let closetNum = nums[0] + nums[1] + nums[2] // 最接近的数组
  for(let i = 0; i < nums.length; i++) {
    let left = i + 1 // 左指针
    let right = nums.length - 1 // 右指针
    while(left < right) {
      let sum = nums[i] + nums[left] + nums[right] // 总和
      if (Math.abs(target - sum) < Math.abs(target - closetNum)) {
        closetNum = sum
      }

      if (sum < target) {
        left++
      } else if (sum > target) {
        right--
      } else {
        return closetNum
      }
    }
  }
  return closetNum
}

console.log(threeSumClosest([-1,2,1,-4], 1))
console.log(threeSumClosest([0,0,0], 0))


