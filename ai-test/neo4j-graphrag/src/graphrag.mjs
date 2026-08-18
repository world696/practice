import "dotenv/config";
import { Neo4jGraph } from "@langchain/community/graph/neo4j_graph";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, START, END } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// 连接neo4j 知识图谱
const graph = new Neo4jGraph({
  url: process.env.NEO4J_URI,
  username: process.env.NEO4J_USERNAME,
  password: process.env.NEO4J_PASSWORD,
});

// 大模型
const llm = new ChatOpenAI({
  model: process.env.OPENAI_MODEL,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 定义状态
const state = {
  messages: {
    value: (left, right) => left.concat(Array.isArray(right) ? right : [right]),
    default: () => [],
  },
  query: null,
  cypher: null,
  context: null,
  answer: null,
};

/**
 * 步骤1： 解析问题
 */

function userQuery(state) {
  const last = state.messages[state.messages.length - 1];
  return last.content;
}
/***
 * 步骤2： 生成 Cypher 查询语句
 */
async function generateCypher(state) {
  const prompt = `
      你是一个专业的 Neo4j Cypher 生成器。
      严格按照下面的结构生成正确语句，只返回纯 Cypher 代码，不要任何解释、不要标点、不要 markdown。
  
      节点：
      - Product: 奶茶产品
      - Ingredient: 配料
      - Type: 奶茶类型
      - Method: 制作工艺
      - People: 适合人群
  
      关系方向（必须严格遵守）：
      - (Product)-[:属于]->(Type)
      - (Product)-[:包含]->(Ingredient)
      - (Product)-[:适合]->(People)
      - (Ingredient)-[:使用]->(Method)
  
      规则：
      1. 关系方向绝对不能反
      2. 多跳查询请使用多个 MATCH，不要连错路径
      3. 只返回最终可运行的 Cypher 语句
  
      用户问题：${userQuery(state)}
    `;
  const res = await llm.invoke([new HumanMessage(prompt)]);
  return { cypher: res.content };
}
// ----------------------
// 步骤2：执行图查询
// ----------------------
async function executeGraphQuery(state) {
  try {
    const res = await graph.query(state.cypher);
    return { context: JSON.stringify(res) };
  } catch (e) {
    return { context: "未查询到相关知识" };
  }
}
// ----------------------
// 步骤3：生成答案
// ----------------------
async function generateAnswer(state) {
  const prompt = `
      你是奶茶专家，根据下方「检索结果」回答用户问题；检索结果为空或不足时简要说明无法从图谱得到答案，不要编造。
      回答要求：
      - 直接列出事实，不要推断图谱里未出现的配料（如水、冰、添加剂等）。
  
      检索结果：${state.context}
      用户问题：${userQuery(state)}
    `;
  const res = await llm.invoke([new HumanMessage(prompt)]);
  return { answer: res.content };
}

// ----------------------
// 构建 LangGraph 工作流
// ----------------------
const workflow = new StateGraph({ channels: state })
  .addNode("generateCypher", generateCypher)
  .addNode("executeGraph", executeGraphQuery)
  .addNode("generateAnswer", generateAnswer)
  .addEdge(START, "generateCypher")
  .addEdge("generateCypher", "executeGraph")
  .addEdge("executeGraph", "generateAnswer")
  .addEdge("generateAnswer", END);

const app = workflow.compile();

async function printWorkflowMermaid() {
  const drawable = await app.getGraphAsync();
  const mermaid = drawable.drawMermaid({ withStyles: true });
  console.log("--- LangGraph 工作流 (Mermaid) ---");
  console.log(mermaid);
  console.log("-----------------------------------------------------------");
}

// ----------------------
// 运行 GraphRAG
// ----------------------
async function runGraphRAG(question) {
  const res = await app.invoke({
    messages: [new HumanMessage(question)],
  });

  console.log("======================================");
  console.log("用户问题：", question);
  console.log("生成 Cypher：", res.cypher);
  console.log("检索结果：", res.context);
  console.log("最终回答：", res.answer);
  console.log("======================================");
}

// ======================
// 测试
// ======================
(async () => {
  await printWorkflowMermaid();
  await Promise.all([
    runGraphRAG("我们这款珍珠奶茶有哪些配料？"),
    runGraphRAG("台式奶茶的饮品都有哪些配料？"),
    runGraphRAG("珍珠奶茶适合哪些人群饮用？"),
  ]);
})().catch(console.error);

/**
 * 一、Milvus 向量语义检索

适合场景
• 用户提问没有明确关键词，是自然语言大白话；
• 需要语义相似、意思相近匹配，不是字面一样；
• 模糊查词、泛化查词、推荐类场景；
• 非结构化文档：笔记、手册、文章、FAQ、模糊问答。

不懂关键词、只看意思相近，交给 Milvus。

二、ElasticSearch BM25 关键词检索

适合场景
• 用户有明确专有名词、专业术语、编号、文件名；
• 需要精准分词、字面命中、高亮匹配；
• 官方文档、规章条款、接口文档、目录检索；
• 过滤、排序、时间筛选、字段精准匹配。
要精准匹配关键词、专业名词、固定术语，交给 ES。

三、Neo4j 知识图谱检索（GraphRAG）适合场景
• 需要实体关联、关系查询、多跳推理；
• 要查［A 和 B 什么关系、A 包含哪些、A 属于哪类］；
• 层级结构、分类体系、上下流、从属、配料、品类等链路查询；
• 传统检索给的是零散文本，需要逻辑推理、脉络梳理的场景。
要查关系、层级、脉络、多跳推理，交给知识图谱。
 */
