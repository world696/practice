import { Module } from '@nestjs/common';
import { ImpactReviewController } from './impact-review.controller';
import { ImpactReviewService } from './impact-review.service';

@Module({
  controllers: [ImpactReviewController],
  providers: [ImpactReviewService],
})
export class ImpactReviewModule {}
