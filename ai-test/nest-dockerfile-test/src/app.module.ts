import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BookModule } from './book/book.module';
import { ImpactReviewModule } from './impact-review/impact-review.module';

@Module({
  imports: [BookModule, ImpactReviewModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
