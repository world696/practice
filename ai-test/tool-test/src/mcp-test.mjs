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
        'amap-maps-streamableHTTP': {
            url: `https://mcp.amap.com/mcp?key=${process.env.AMAP_MAPS_API_KEY}`
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
        for(const toolCall of response.tool_calls) {
            const tool = tools.find(t => t.name === toolCall.name)
            if(tool) {
                const toolResult = await tool.invoke(toolCall.args)
                messages.push(new ToolMessage({
                    content: toolResult,
                    tool_call_id: toolCall.id
                }))
            }
        }
    }
    return messages[messages.length - 1].content
}

await runAgentWithTools('北京南站附近的酒店，以及去的路线')
await mcpClient.close();