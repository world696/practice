
/**
 * 【19链表】
 * (存储这当前节点数据&&指向下一个节点的数据)
 * 【删除链表的倒数第 N 个结点】
 * 1) 【快慢指针】
 * 思路：目的是让 要删除的前一节点 指向要删除的后一节点
 * 定义虚拟头节点 dummyHead;快指针q;慢指针s;初始指向虚拟头节点
 * 然后让快指针 移动n+1次
 * 然后快慢指针同时移动n+1次
 * 修改慢指针的指向节点为之前快指针的下下节点
 * 
 * @param {*ListNode} head 
 * @param {*number} n 
 * @return {ListNode}
 */
const removeNthFromEnd = (head = [], n) => {
  let dummyHead = new ListNode(0, head),
      q = s = dummyHead;
  while(n != 0) {
    q = q.next;
    n--;
  }
  // 快慢指针一起往后遍历
  while(q.next != null) {
    q = q.next;
    s = s.next;
  }
  s.next = s.next.next;
  return dummyHead.next;
}

console.log(removeNthFromEnd([1,2,3,4,5], 2))
console.log(removeNthFromEnd([1,2], 1))
console.log(removeNthFromEnd([1], 1))

