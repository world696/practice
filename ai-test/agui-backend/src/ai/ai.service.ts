import { Injectable, Inject } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessageChunk, createAgent } from 'langchain';
import { UIMessage } from 'ai';
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';

/**
 * Nest 编译为 CJS 后，agent 产出的是 CJS 版 @langchain/core 的 AIMessageChunk；
 * @ai-sdk/langchain 是 ESM，内部用 ESM 版 AIMessageChunk.isInstance() 判断，
 * 跨副本会返回 false，导致 text-delta 被全部丢掉。
 * 把消息 toJSON() 成 plain constructor 对象后，适配器的兜底逻辑才能识别。
 */
async function* bridgeLangGraphStreamForAiSdk(
  stream: AsyncIterable<unknown>,
): AsyncGenerator<unknown> {
  for await (const event of stream) {
    if (!Array.isArray(event)) {
      yield event;
      continue;
    }

    const hasNamespace = event.length === 3;
    const mode = hasNamespace ? event[1] : event[0];
    const data = hasNamespace ? event[2] : event[1];

    if (mode === 'messages' && Array.isArray(data)) {
      const [msg, meta] = data;
      const plain =
        msg && typeof (msg as { toJSON?: () => unknown }).toJSON === 'function'
          ? (msg as { toJSON: () => unknown }).toJSON()
          : msg;
      const next: [unknown, unknown] = [mode, [plain, meta]];
      yield hasNamespace ? [event[0], ...next] : next;
      continue;
    }

    if (
      mode === 'values' &&
      data &&
      typeof data === 'object' &&
      Array.isArray((data as { messages?: unknown[] }).messages)
    ) {
      const state = data as { messages: unknown[] };
      const messages = state.messages.map((m) =>
        m && typeof (m as { toJSON?: () => unknown }).toJSON === 'function'
          ? (m as { toJSON: () => unknown }).toJSON()
          : m,
      );
      const next: [unknown, unknown] = [mode, { ...state, messages }];
      yield hasNamespace ? [event[0], ...next] : next;
      continue;
    }

    yield event;
  }
}

@Injectable()
export class AiService {
  private readonly agent: ReturnType<typeof createAgent>;

  constructor(
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: any,
    @Inject('CHAT_MODEL') model: ChatOpenAI,
    @Inject('SEND_MAIL_TOOL') private readonly sendMailTool,
  ) {
    this.agent = createAgent({
      model,
      tools: [this.webSearchTool, this.sendMailTool],
      systemPrompt:
        '你是 AI 助手，需要最新信息、事实核查或联网信息时，请使用 web_search 工具搜索后再作答。发送邮件用 send_mail 工具',
    });
  }

  async stream(messages: UIMessage[]) {
    const lcMessages = await toBaseMessages(messages);
    const lgStream = await this.agent.stream(
      { messages: lcMessages },
      {
        streamMode: ['messages', 'values'],
        recursionLimit: 12,
      },
    );
    return toUIMessageStream(
      bridgeLangGraphStreamForAiSdk(lgStream) as AsyncIterable<AIMessageChunk>,
    );
  }
}
