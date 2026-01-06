/**
 * 读文件的tool
 */
import 'dotenv/config'
import { ChatOpenAI } from "@langchain/openai";
import { tool } from '@langchain/core/tools';
import { HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import fs from 'node:fs/promises'
import { z } from 'zod'


const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME || 'qwen-coder-turbo',
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0,
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL
    }
})

const readFileTool = tool(
    async ({ filePath }) => {
        const content = await fs.readFile(filePath, 'utf-8');
        console.log(`[工具调用 read_file("${filePath}") - 成功读取 ${content.length}字节]`);
        return `文件内容:  \n${content}`
        
    },
    {
        name: 'read_file',
        description: '用此工具来读取文件内容。当用户要求读取文件、查看代码、分析文件内容时，调用此工具。输入文件路径（可以是相对路径或绝对路径）。',
        schema: z.object({
            filePath: z.string().describe('要读取的文件路径')
        })
    }
)

const tools = [
    readFileTool
]

const modelWithTools = model.bindTools(tools)

let messages = [
    new SystemMessage(`你是一个代码助手，可以使用工具读取文件并解释代码。

工作流程：
1. 用户要求读取文件时，立即调用 read_file 工具
2. 等待工具返回文件内容
3. 基于文件内容进行分析和解释

可用工具：
- read_file: 读取文件内容（使用此工具来获取文件内容）
`),
new HumanMessage(`请读取 src/tool-file-read.mjs 文件内容并解释代码`)
]

let response = await modelWithTools.invoke(messages)

// console.log(response);
/**
 * AIMessage {
  "id": "chatcmpl-9e7299a5-41b4-96a6-b5e0-e57382f66954",
  "content": "",
  "additional_kwargs": {
    "tool_calls": [
      {
        "function": "[Object]",
        "id": "call_d4be9bf5af0a4f1cb378e6",
        "index": 0,
        "type": "function"
      }
    ]
  },
  "response_metadata": {
    "tokenUsage": {
      "promptTokens": 329,
      "completionTokens": 22,
      "totalTokens": 351
    },
    "finish_reason": "tool_calls",
    "model_provider": "openai",
    "model_name": "qwen-coder-turbo"
  },
  "tool_calls": [
    {
      "name": "read_file",
      "args": {
        "filePath": "src/tool-file-read.mjs"
      },
      "type": "tool_call",
      "id": "call_d4be9bf5af0a4f1cb378e6"
    }
  ],
  "invalid_tool_calls": [],
  "usage_metadata": {
    "output_tokens": 22,
    "input_tokens": 329,
    "total_tokens": 351,
    "input_token_details": {},
    "output_token_details": {}
  }
}
 */
messages.push(response)

while(response.tool_calls && response.tool_calls.length > 0) {
    console.log(`\n 监测到 ${response.tool_calls.length} 个工具调用`);
    const toolResults = await Promise.all(
        response.tool_calls.map(async (toolCall) => {
            const tool = tools.find(t => t.name === toolCall.name) // 查找工具
            if(!tool) {
                return `错误: 找不到工具 ${tool.name}`
            }
            try {
                const result = await tool.invoke(toolCall.args)
                return result
            } catch(err) {
                return `错误: ${err?.message}`
            }
        })
    )

// 将工具结果添加到消息历史
response.tool_calls.forEach((toolCall, inx) => {
    messages.push(
        new ToolMessage({
            content: toolResults[inx],
            tool_call_id: toolCall.id
        })
    )
})

response = await modelWithTools.invoke(messages)
messages.push(response)
}

console.log('\n[最终回复]');
console.log(response.content);