import { Annotation, END, START, StateGraph } from '@langchain/langgraph'

/**
 * Annotation： 定义公共state结构的一种方式
 * 定义有哪些共享数据以及怎么去更新
 */
const StateAnnotation = Annotation.Root({
    text: Annotation({
        reducer: (_prev, next) => next,
        default: () => '',
    })
})

const step1 = (state) => ({ text: `${state.text } => step1 `});
const step2 = (state) => ({ text: `${state.text } => step2 `});

/**
 * LangGraph
 * addNode 添加节点；
 * addEdge 添加连接；
 * StateGraph 创建图；
 * compile 编译一次；
 * 
 * getGraphSync 获取DrawableGraph 对象
 * drawMermaid() 生成Mermaid；
 * drawMermaidPng() 生成png图片；
 */
const graph = new StateGraph(StateAnnotation)
    .addNode('step1', step1)
    .addNode('step2', step2)
    .addEdge(START, 'step1')
    .addEdge('step1', 'step2')
    .addEdge('step1', END)
    .compile()


// 导出为 Mermaid：可复制到 https://mermaid.live 或 Markdown 的 ```mermaid 代码块
const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);
const result = await graph.invoke({ text: "hello" });
console.log("result:", result);

/**
 * %%{init: {'flowchart': {'curve': 'linear'}}}%%
graph TD;
        __start__([<p>__start__</p>]):::first
        step1(step1)
        step2(step2)
        __end__([<p>__end__</p>]):::last
        __start__ --> step1;
        step1 --> step2;
        step1 --> __end__;
        step2 --> __end__;
        classDef default fill:#f2f0ff,line-height:1.2;
        classDef first fill-opacity:0;
        classDef last fill:#bfb6fc;

result: { text: 'hello => step1  => step2 ' }
 */