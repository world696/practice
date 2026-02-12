import 'dotenv/config'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import chalk from 'chalk'

const __dirname = dirname(fileURLToPath(import.meta.url))

const model = new ChatOpenAI({
    modelName: 'qwen-plus',
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL
    }
})

const mcpClient = new MultiServerMCPClient({
    mcpServers: {
        'my-mcp-server': {
            command: 'node',
            args: [join(__dirname, 'my-mcp-serve.mjs')]
        },
        // 高德地图官方mcp
        'amap-maps-streamableHTTP': {
            url: `https://mcp.amap.com/mcp?key=${process.env.AMAP_MAPS_API_KEY}`
        },
        'fileSystem': {
            command: 'npx',
            args: ["-y", "@modelcontextprotocol/server-filesystem",...process.env.ALLOWED_SYSTEM_PATH.split(',') || '']
        },
        // chrome Devtools 的 MCP
        "chrome-devtools": {
            "command": "npx",
            "args": ["-y", "chrome-devtools-mcp@latest"]
        }
    }
})

const tools = await mcpClient.getTools()
const modelWithTools = model.bindTools(tools)

async function runAgentWithTools(query, maxIterations = 30) {
    const messages = [
        new HumanMessage(query)
    ]
    for(let i = 0; i < maxIterations; i++) {
        console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`))
        const response = await modelWithTools.invoke(messages)
        messages.push(response)
        if(!response.tool_calls || response.tool_calls.length === 0) {
            console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
            return response.content;
        }
        console.log(chalk.bgBlue(`🔍 检测到 ${response.tool_calls.length} 个工具调用`));
        console.log(chalk.bgBlue(`🔍 工具调用: ${response.tool_calls.map(t => t.name).join(', ')}`));
        for (const toolCall of response.tool_calls) {
            const tool = tools.find(t => t.name === toolCall.name)
            if (tool) {
                const toolResult = await tool.invoke(toolCall.args)
                // 把各种格式的 tool 返回值统一转成字符串，传给 ToolMessage
                let contentStr

                if (typeof toolResult === 'string') {
                    contentStr = toolResult
                } else if (toolResult && typeof toolResult.text === 'string') {
                    // 如果返回对象有 text 字段，优先使用
                    contentStr = toolResult.text
                } else if (toolResult && Array.isArray(toolResult.content)) {
                    // MCP CallToolResult 形如 { content: [{ type: 'text', text: 'xxx' }, ...] }
                    const texts = toolResult.content
                        .map((c) => {
                            if (typeof c === 'string') return c
                            if (c && typeof c.text === 'string') return c.text
                            return ''
                        })
                        .filter(Boolean)
                    contentStr = texts.join('\n')
                } else {
                    // 兜底：直接把对象序列化成 JSON 字符串
                    contentStr = JSON.stringify(toolResult, null, 2)
                }

                messages.push(new ToolMessage({
                    content: contentStr,
                    tool_call_id: toolCall.id
                }))
            }
        }
    }
    return messages[messages.length - 1].content
}

// await runAgentWithTools('北京南站附近的酒店，以及去的路线')
// await runAgentWithTools("北京南站附近的5个酒店，以及去的路线，路线规划生成文档保存到 /Users/qy/Desktop 的一个 md 文件");
await runAgentWithTools("北京南站附近的酒店，最近的 3 个酒店，拿到酒店图片，打开浏览器，展示每个酒店的图片，每个 tab 一个 url 展示，并且在把那个页面标题改为酒店名");
await mcpClient.close();