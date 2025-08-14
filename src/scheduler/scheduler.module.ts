import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { RedisModule } from '../redis/redis.module';
import { CurrencyModule } from '../currency/currency.module';

@Module({
  imports: [RedisModule,CurrencyModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
