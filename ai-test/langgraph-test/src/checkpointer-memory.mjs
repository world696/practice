import { Annotation, START, END, StateGraph, MemorySaver } from "@langchain/langgraph";

/**
 * 定义了初始状态{"visitCount": 0, "message": ''}
 */
const StateAnnotation = Annotation.Root({
    visitCount: Annotation({
        reducer: (_prev, next) => next,
        default: () => 0
    }),
    message: Annotation({
        reducer: (_prev, next) => next,
        default: () => ''
    })
})

/** 每跑一轮图，给「当前会话」访问次数 +1 */
function recordVisit(state) {
  const visitCount = state.visitCount + 1;
  const message =
    visitCount === 1
      ? "这是你在本会话里第 1 次进入。"
      : `这是你在本会话里第 ${visitCount} 次进入`;
  return { visitCount, message };
}

/**
 * checkPoint 持久化
 * thread_id: Graph 执行会话的唯一标识；
 * Agent工作流运行过程中的State保存下来，下次可以直接根据thread_id进行恢复；
 */

const graph = new StateGraph(StateAnnotation)
    .addNode('recordVisit', recordVisit)
    .addEdge(START, 'recordVisit')
    .addEdge('recordVisit', END)

const checkPointer = new MemorySaver()
const app = graph.compile({ checkPointer })

const user1 = { configurable: { thread_id: 'li' }};
const user2 = { configurable: { thread_id: 'qw'}}

const res1 = await app.invoke({}, user1)
const res2 = await app.invoke({}, user1)
const res3 = await app.invoke({}, user1)
const res4 = await app.invoke({}, user2)

console.log(res1)
console.log(res2); 
console.log(res3); 
console.log(res4);
