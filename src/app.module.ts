import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CurrencyModule } from './currency/currency.module';
import { RedisModule } from './redis/redis.module';
import { ConfigModule } from '@nestjs/config'; // ✅ Add this

import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    RedisModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // ✅ Load environment variables from .env file
    }),
    CurrencyModule,
    SchedulerModule,
  ],
})
export class AppModule {}
