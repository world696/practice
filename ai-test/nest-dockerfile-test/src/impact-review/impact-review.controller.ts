import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ImpactReviewService } from './impact-review.service';
import type { CreateReviewDto } from './impact-review.types';

@Controller('impact-reviews')
export class ImpactReviewController {
  constructor(private readonly service: ImpactReviewService) {}

  @Post()
  create(@Body() dto: CreateReviewDto) {
    return this.service.create(dto);
  }

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.service.retry(id);
  }
}
