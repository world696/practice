/**
 * 链表
 * 给你两个 非空 的链表，表示两个非负的整数。它们每位数字都是按照 逆序 的方式存储的，并且每个节点只能存储 一位 数字。

请你将两个数相加，并以相同形式返回一个表示和的链表。

你可以假设除了数字 0 之外，这两个数都不会以 0 开头。
 */

/**
 * 思路：
 *
 */
/**
 * 链表节点构造函数
 * @param {*} val
 * @param {*} next
 */
// function ListNode(val, next) {
//   this.val = val;
//   this.next = next || null;
// }

const addTwoNumbers = (l1, l2) => {
  function ListNode(val, next) {
    this.val = val;
    this.next = next || null;
  };
  let dummy = new ListNode(0);
  let curr = dummy;
  let carry = 0;
  while (l1 || l2 || carry) {
    let sum = carry;
    if (l1) {
      sum += l1.val;
      l1 = l1.next;
    }
    if (l2) {
      sum += l2.val;
      l2 = l2.next;
    }
    carry = Math.floor(sum / 10);
    curr.next = new ListNode(sum % 10);
    curr = curr.next;
  }
  return dummy.next;
};

console.log([9, 9, 9, 9, 9, 9, 9][(9, 9, 9, 9)]);
