import { Annotation, START, END, StateGraph } from "@langchain/langgraph";


/**
 * Annotation.Root
 * 字段名你自己决定
    字段类型你自己决定
    是否需要 reducer（合并规则）根据业务决定
    Node 返回的数据必须匹配这些字段；

    Reducer 默认行为 后面的值会覆盖前面的值
 */
const StateAnnotation = Annotation.Root({
    query: Annotation({
        reducer: (_prev, next) => next,
        default: () => ''
    }),
    route: Annotation({
        reducer: (_prev, next) => next,
        default: () => 'chat'
    }),
    answer: Annotation({
        reducer: (_prev, next) => next,
        default: () => '',
    })
})

const router = (state) => {
    const isMatch = /[+\-*/]/.test(state.query)
    return { route: isMatch ? 'math': 'chat' }
}

const mathNode = (state) => {
    try {
        return { answer: String(eval(state.query))}
    } catch {
        return { answer: '表达式无法计算' }
    }
}

const chatNode = (state) => ({ answer: `你说的是 ${state.query}`});

/**
 * addConditionalEdges 条件分支
 */
const graph = new StateGraph(StateAnnotation)
    .addNode('router', router)
    .addNode('math', mathNode)
    .addNode('chat', chatNode)
    .addEdge(START, 'router')
    .addConditionalEdges('router', (state) => state.route, {
        math: 'math',
        chat: 'chat'
    })
    .addEdge('math', END)
    .addEdge('chat', END)
    .compile()

const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);


const result1 = await graph.invoke({ query: "hello" });
console.log("result1:", result1);

const result2 = await graph.invoke({ query: "10 * 8" });
console.log("result2:", result2);

/**
 * %%{init: {'flowchart': {'curve': 'linear'}}}%%
graph TD;
        __start__([<p>__start__</p>]):::first
        router(router)
        math(math)
        chat(chat)
        __end__([<p>__end__</p>]):::last
        __start__ --> router;
        chat --> __end__;
        math --> __end__;
        router -.-> math;
        router -.-> chat;
        classDef default fill:#f2f0ff,line-height:1.2;
        classDef first fill-opacity:0;
        classDef last fill:#bfb6fc;

result1: { query: 'hello', route: 'chat', answer: '你说的是 hello' }
result2: { query: '10 * 8', route: 'math', answer: '80' }
 */