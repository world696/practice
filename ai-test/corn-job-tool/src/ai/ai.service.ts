import { Inject, Injectable } from '@nestjs/common';
// import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  AIMessageChunk,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { Runnable } from '@langchain/core/runnables';
import type { StructuredToolInterface } from '@langchain/core/tools';

// type QueryUserArgs = {
//   userId: string;
// };

// const database = {
//   users: {
//     '001': {
//       id: '001',
//       name: '张三',
//       email: 'zhangsan@example.com',
//       role: 'admin',
//     },
//     '002': { id: '002', name: '李四', email: 'lisi@example.com', role: 'user' },
//     '003': {
//       id: '003',
//       name: '王五',
//       email: 'wangwu@example.com',
//       role: 'user',
//     },
//   },
// };

/**
 * zod 数据结构定义&运行时校验；对比interface--这个时在编译校验；
 * 定义对象结构，必须要有userId格式， 必须时string;
 * describe: 定义描述；
 */
const queryUserArgsSchema = z.object({
  userId: z.string().describe('用户 ID，例如: 001, 002, 00'),
});

// const queryUserTool = tool(
//   async ({ userId }: QueryUserArgs) => {
//     const user = database.users[userId];
//     if (!user) {
//       return `用户 ID ${userId} 不存在。可用的 ID: 001, 002, 003`;
//     }
//     return `用户信息：\n- ID: ${user.id}\n- 姓名: ${user.name}\n- 邮箱: ${user.email}\n- 角色: ${user.role}`;
//   },
//   {
//     name: 'query_user',
//     description:
//       '查询数据库中的用户信息。输入用户 ID，返回该用户的详细信息（姓名、邮箱、角色）。',
//     schema: queryUserArgsSchema,
//   },
// );
@Injectable()
export class AiService {
  private readonly modelWithTools: Runnable<BaseMessage[], AIMessage>;
//   constructor(@Inject('CHAT_MODEL') model: ChatOpenAI) {
//     this.modelWithTools = model.bindTools([queryUserTool]);
//   }

  constructor(
    @Inject('CHAT_MODEL') model: ChatOpenAI,
    @Inject('QUERY_USER_TOOL')
    private readonly queryUserTool: StructuredToolInterface,
    @Inject('SEND_MAIL_TOOL') private readonly sendMailTool,
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: any,
  ) {
    this.modelWithTools = model.bindTools([this.queryUserTool, this.sendMailTool, this.webSearchTool]);
  }

  async runChain(query: string): Promise<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(
        '你是一个智能助手，可以在需要时调用工具（如 query_user）来查询用户信息，再用结果回',
      ),
      new HumanMessage(query),
    ];

    while (true) {
      /**
       * messgae是当前agent的执行轨迹，不仅保存聊天上下文，还有tool调用过程，让模型知道发生了什么；
       */
      const aiMessage = await this.modelWithTools.invoke(messages);
      messages.push(aiMessage);

      const toolCalls = aiMessage.tool_calls ?? [];

      if (!toolCalls.length) {
        /**
         * AIMessage {"id": {}, "content": {}}
         */
        console.log('aiMessage======', aiMessage);
        return aiMessage.content as string;
      }

      //1依次执行本轮需要调用的所有工具
      for (const toolCall of toolCalls) {
        console.log('toolCall==========', toolCall);
        const toolCallId = toolCall.id;
        const toolName = toolCall.name;
        if (toolName === 'query_user') {
          const args = queryUserArgsSchema.parse(toolCall.args);
          const result = await this.queryUserTool.invoke(args);

          if (!toolCallId) {
            throw new Error('Tool call id is missing');
          }
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result,
            }),
          );
        } else if (toolName === 'send_mail') {
          const result = await this.sendMailTool.invoke(toolCall.args);
          if (!toolCallId) {
            throw new Error('Tool call id is missing');
          }
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result,
            }),
          );
        } else if (toolName === 'web_search') {
          const result = await this.webSearchTool.invoke(toolCall.args);
          if (!toolCallId) {
            throw new Error('Tool call id is missing');
          }
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result,
            }),
          );
        }
      }
    }
  }
  // 流式输出1
  async *runChainStream(query: string): AsyncIterable<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(
        '你是一个智能助手，可以在需要时调用工具（如 query_user）来查询用户信息，再用结果回',
      ),
      new HumanMessage(query),
    ];

    while (true) {
      const stream = await this.modelWithTools.stream(messages);
      let fullAIMessage: AIMessageChunk | null = null; // 流式输出类型 每个chunk就是AIMessageChunk
      for await (const chunk of stream as AsyncIterable<AIMessageChunk>) {
        fullAIMessage = fullAIMessage ? fullAIMessage.concat(chunk) : chunk;
        // 判断当前输出有没有工具调用信息 tool_call_chunks 流式生成中；
        const hasToolCallChunk =
          !!fullAIMessage.tool_call_chunks &&
          fullAIMessage.tool_call_chunks.length > 0;

        if (!hasToolCallChunk && chunk.content) {
          yield chunk.content as string;
        }
      }

      if (!fullAIMessage) {
        return;
      }

      messages.push(fullAIMessage);
      //   tool_calls  完整信息
      const toolCalls = fullAIMessage.tool_calls ?? [];

      if (!toolCalls.length) {
        return;
      }

      //1依次执行本轮需要调用的所有工具
      for (const toolCall of toolCalls) {
        console.log('toolCall==========', toolCall);
        const toolCallId = toolCall.id;
        const toolName = toolCall.name;
        if (toolName === 'query_user') {
          const args = queryUserArgsSchema.parse(toolCall.args);
          const result = await this.queryUserTool.invoke(args);

          if (!toolCallId) {
            throw new Error('Tool call id is missing');
          }
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result,
            }),
          );
        } else if (toolName === 'send_mail') {
          const result = await this.sendMailTool.invoke(toolCall.args);
          if (!toolCallId) {
            throw new Error('Tool call id is missing');
          }
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result,
            }),
          );
        } else if (toolName === 'web_search') {
          const result = await this.webSearchTool.invoke(toolCall.args);
          if (!toolCallId) {
            throw new Error('Tool call id is missing');
          }
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result,
            }),
          );
        }
      }
    }
  }
}
