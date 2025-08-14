import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from '../redis/redis.service';
import { CurrencyGateway } from '../currency/currency.gateway';
import axios from 'axios';

interface CurrencyData {
  CurrencyCode: string;
  USDBuy: string;
  INRBuy: string;
  USDSell: string;
  INRSell: string;
  DateTime: string;
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly API_URL = 'https://eproxy.moneeflo.com/';

  constructor(
    private readonly redisService: RedisService,
    private readonly currencyGateway: CurrencyGateway
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async fetchAndBroadcastData() {
    try {
      const startTime = Date.now();
      
      const response = await axios.get(this.API_URL, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Currency-Microservice/1.0',
          'Accept': 'application/json',
          'Authorization' : `${process.env.TOKEN}`,
        },
      });

      if (response.data?.detail) {
        const currencies: CurrencyData[] = response.data.detail;
        
        const cacheOperations: Record<string, any> = {
          'currencies:all': currencies,
          'last_sync': new Date().toISOString(),
        };

        currencies.forEach(currency => {
          cacheOperations[`currency:${currency.CurrencyCode}`] = currency;
        });

        const popularCombinations = this.getPopularCombinations(currencies);
        popularCombinations.forEach(({ key, data }) => {
          cacheOperations[key] = data;
        });

        await this.redisService.msetPipeline(cacheOperations, 300);
        await this.currencyGateway.broadcastCurrencyUpdate(currencies);

        const duration = Date.now() - startTime;
        this.logger.log(
          `Processed ${currencies.length} currencies in ${duration}ms`
        );
      }
    } catch (error) {
      this.logger.error('Failed to fetch and broadcast currency data:', error.message);
      
      this.currencyGateway.server.emit('error', {
        type: 'fetch-error',
        message: 'Failed to update currency data',
        timestamp: new Date().toISOString(),
      });
    }
  }

  private getPopularCombinations(currencies: CurrencyData[]): Array<{ key: string; data: CurrencyData[] }> {
    const combinations = [
      ['USD', 'EUR', 'GBP', 'JPY', 'AUD'],
      ['BTC', 'ETH', 'USD', 'EUR'],
      ['USD', 'JPY', 'CNY', 'KRW', 'INR'],
      ['EUR', 'GBP', 'CHF', 'NOK', 'SEK'],
    ];

    return combinations.map(currencyCodes => {
      const filteredData = currencies.filter(c => 
        currencyCodes.includes(c.CurrencyCode)
      );
      
      return {
        key: `currencies:bulk:${currencyCodes.sort().join(',')}`,
        data: filteredData,
      };
    });
  }

  async onModuleInit() {
    this.logger.log('Starting initial data fetch...');
    await this.fetchAndBroadcastData();
  }
}
