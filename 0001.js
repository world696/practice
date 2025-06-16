/**
 * 两数之和
 * 给定一个整数数组 nums 和一个整数目标值 target
 * 请你在该数组中找出 和为目标值 target  的那 两个 整数，
 * 并返回它们的数组下标。
 * 你可以假设每种输入只会对应一个答案，并且你不能使用两次相同的元素。你可以按任意顺序返回答案。
 */

/**
 * 思路：
 * 哈希表法：
 * 1哈希表记录每个数以及下标；
 * 2遍历数组，判断当前差值是否在哈希表中，在的话直接返回这两个数的下标；否则，把当前的值以及下标存进去
 * 
 */

const twoNums = (nums, target) => {
  const map = new Map()
  for(let i =0; i< nums.length;i++) {
    const diff = target - nums[i]
    if (map.has(diff)) {
        // 如果存在差值
        return [map.get(diff), i]
    }
    map.set(nums[i], i)
  }
  return []
}

console.log(twoNums([2, 7, 11, 15], 9))

/**
 * 哈希表
 * 是以一种键值对的形式存储的数据结构。可以在O(1)时间内完成插入/删除操作（理想情况）
 * 
 * Map
 * es6新增的数据结构。键可以是任意类型
 * 
 * 3. 常用操作
  对象（Object）
    新增/修改：obj[key] = value
    读取：obj[key]
    删除：delete obj[key]
    判断是否有某个 key：key in obj
  Map
    新增/修改：map.set(key, value)
    读取：map.get(key)
    删除：map.delete(key)
    判断是否有某个 key：map.has(key)
    获取大小：map.size
    清空：map.clear()
    遍历：for (let [key, value] of map) { ... }
 */