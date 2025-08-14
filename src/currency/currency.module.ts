import { Module } from '@nestjs/common';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';
import { CurrencyGateway } from './currency.gateway';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [CurrencyController],
  providers: [CurrencyService, CurrencyGateway],
  exports: [CurrencyGateway],
})
export class CurrencyModule {}
