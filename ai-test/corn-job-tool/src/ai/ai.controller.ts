import { Controller, Get, Query, Sse, MessageEvent } from '@nestjs/common';
import { AiService } from './ai.service';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('chat')
  async chat(@Query('query') query: string) {
    const answer = await this.aiService.runChain(query);
    return { answer };
  }

  @Sse('chat/stream')
  chatStream(@Query('query') query: string): Observable<MessageEvent> {
    // Observable 可以不断产生数据的流；1
    const stream = this.aiService.runChainStream(query);
    return from(stream).pipe(
      map((chunk) => ({
        data: chunk,
      })),
    );
  }
}
