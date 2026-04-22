import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import z from "zod";

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const scientistSchema = z.object({
  name: z.string().describe("科学家的全名"),
  birth_year: z.number().describe("出生年份"),
  nationality: z.string().describe("国籍"),
  fields: z.array(z.string()).describe("研究领域列表"),
});

// 使用 withStructuredOutput 方法
const structuredModel = model.withStructuredOutput(scientistSchema);

// 调用模型
const result = await structuredModel.invoke("介绍一下爱因斯坦");

console.log("结构化结果:", JSON.stringify(result, null, 2));
console.log(`\n姓名: ${result.name}`);
console.log(`出生年份: ${result.birth_year}`);
console.log(`国籍: ${result.nationality}`);
console.log(`研究领域: ${result.fields.join(", ")}`);

/**
 * 结构化结果: {
  "name": "阿尔伯特·爱因斯坦",
  "birth_year": 1879,
  "nationality": "德国→瑞士→美国（归化）",
  "fields": [
    "理论物理学",
    "哲学",
    "科学哲学"
  ]
}

姓名: 阿尔伯特·爱因斯坦
出生年份: 1879
国籍: 德国→瑞士→美国（归化）
研究领域: 理论物理学, 哲学, 科学哲学
 */