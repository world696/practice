import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { JsonOutputParser } from '@langchain/core/output_parsers';

// 初始化模型
const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0,
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
    },
});

const parser = new JsonOutputParser();

const question = `请介绍一下爱因斯坦的信息。请以 JSON 格式返回，包含以下字段：name（姓名）、birth_year（出生年份）、nationality（国籍）、major_achievements（主要成就，数组）、famous_theory（著名理论）。

${parser.getFormatInstructions()}`;

console.log('question:',question)
try {
    console.log("🤔 正在调用大模型（使用 JsonOutputParser）...\n");

    const response = await model.invoke(question);

    console.log("📤 模型原始响应:\n");
    console.log(response.content);

    const result = await parser.parse(response.content);

    console.log("✅ JsonOutputParser 自动解析的结果:\n");
    console.log(result);
    console.log(`姓名: ${result.name}`);
    console.log(`出生年份: ${result.birth_year}`);
    console.log(`国籍: ${result.nationality}`);
    console.log(`著名理论: ${result.famous_theory}`);
    console.log(`主要成就:`, result.major_achievements);

} catch (error) {
    console.error("❌ 错误:", error.message);
}


/**
 * 
 * question: 请介绍一下爱因斯坦的信息。请以 JSON 格式返回，包含以下字段：name（姓名）、birth_year（出生年份）、nationality（国籍）、major_achievements（主要成就，数组）、famous_theory（著名理论）。


🤔 正在调用大模型（使用 JsonOutputParser）...

📤 模型原始响应:

```json
{
  "name": "阿尔伯特·爱因斯坦",
  "birth_year": 1879,
  "nationality": ["德国", "瑞士", "美国"],
  "major_achievements": [
    "提出狭义相对论（1905年）",
    "提出广义相对论（1915年）",
    "解释光电效应并提出光量子假说（1905年），为此获1921年诺贝尔物理学奖",
    "推动量子力学发展，虽对哥本哈根诠释持保留态度，但贡献深远",
    "提出质能等价公式 E=mc²",
    "预言引力波与引力透镜效应（后均被实验证实）"
  ],
  "famous_theory": "相对论（包括狭义相对论和广义相对论）"
}
```
✅ JsonOutputParser 自动解析的结果:

{
  name: '阿尔伯特·爱因斯坦',
  birth_year: 1879,
  nationality: [ '德国', '瑞士', '美国' ],
  major_achievements: [
    '提出狭义相对论（1905年）',
    '提出广义相对论（1915年）',
    '解释光电效应并提出光量子假说（1905年），为此获1921年诺贝尔物理学奖',
    '推动量子力学发展，虽对哥本哈根诠释持保留态度，但贡献深远',
    '提出质能等价公式 E=mc²',
    '预言引力波与引力透镜效应（后均被实验证实）'
  ],
  famous_theory: '相对论（包括狭义相对论和广义相对论）'
}
姓名: 阿尔伯特·爱因斯坦
出生年份: 1879
国籍: 德国,瑞士,美国
著名理论: 相对论（包括狭义相对论和广义相对论）
主要成就: [
  '提出狭义相对论（1905年）',
  '提出广义相对论（1915年）',
  '解释光电效应并提出光量子假说（1905年），为此获1921年诺贝尔物理学奖',
  '推动量子力学发展，虽对哥本哈根诠释持保留态度，但贡献深远',
  '提出质能等价公式 E=mc²',
  '预言引力波与引力透镜效应（后均被实验证实）'
]
 */