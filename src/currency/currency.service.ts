import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(private readonly redisService: RedisService) {}

  async getBulkCurrencies(currencyCodes: string[]) {
    const startTime = Date.now();
    
    try {
      const result = await this.redisService.getBulkCurrencies(currencyCodes);
      
      if (result.length === 0) {
        throw new NotFoundException('No currency data available');
      }

      const missing = currencyCodes.filter(code => 
        !result.some(currency => currency.CurrencyCode === code.toUpperCase())
      );

      const responseTime = Date.now() - startTime;
      
      return {
        detail: result,
        requested: currencyCodes.length,
        found: result.length,
        missing: missing.length > 0 ? missing : undefined,
        responseTime,
        cached: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Bulk fetch error for ${currencyCodes.length} currencies:`, error.message);
      throw error;
    }
  }

  async getAllCurrencies() {
    const currencies = await this.redisService.get('currencies:all');
    const lastSync = await this.redisService.get('last_sync');
    
    if (!currencies) {
      throw new NotFoundException('Currency data not available');
    }
    
    return {
      detail: currencies,
      count: currencies.length,
      lastSync,
      cached: true,
      timestamp: new Date().toISOString(),
    };
  }

  async getHealthStatus() {
    const lastSync = await this.redisService.get('last_sync');
    const allCurrencies = await this.redisService.get('currencies:all');
    
    return {
      status: 'healthy',
      lastSync,
      currenciesCount: allCurrencies ? allCurrencies.length : 0,
      cacheActive: !!allCurrencies,
      redisConnected: this.redisService.client.isReady,
    };
  }
}
