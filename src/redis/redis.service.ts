import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public client: RedisClientType;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://redis:6379');
    
    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            this.logger.error('Redis reconnection failed after 10 attempts');
            return false;
          }
          return Math.min(retries * 100, 3000);
        },
        connectTimeout: 10000,
      },
      // ✅ Optimized for internal network
      commandsQueueMaxLength: 10000,
      disableOfflineQueue: false,
    });
    
    this.client.on('error', (err) => {
      this.logger.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis Client Connected');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis Client Ready');
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('Redis Client Reconnecting...');
    });

    await this.client.connect();
    
    // ✅ Test connection and log performance
    const start = Date.now();
    await this.client.ping();
    const pingTime = Date.now() - start;
    
    this.logger.log(`Redis connected successfully - Ping: ${pingTime}ms`);
  }

  async onModuleDestroy() {
    if (this.client && this.client.isReady) {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    }
  }

  // ✅ Enhanced bulk operations for internal network speed
  async mgetOptimized(keys: string[], chunkSize = 100): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    
    if (keys.length <= chunkSize) {
      return await this.client.mGet(keys) as (string | null)[];
    }

    const chunks = this.chunkArray(keys, chunkSize);
    const promises = chunks.map(chunk => this.client.mGet(chunk));
    const results = await Promise.all(promises);
    return results.flat() as (string | null)[];
  }

  async msetPipeline(keyValuePairs: Record<string, any>, ttl = 300): Promise<void> {
    const pipeline = this.client.multi();
    
    Object.entries(keyValuePairs).forEach(([key, value]) => {
      pipeline.setEx(key, ttl, JSON.stringify(value));
    });
    
    await pipeline.exec();
  }

  async getBulkCurrencies(currencies: string[]): Promise<any[]> {
    const bulkKey = `currencies:bulk:${currencies.sort().join(',')}`;
    
    try {
      const cached = await this.client.get(bulkKey);
      if (cached) {
        return JSON.parse(cached as string);
      }

      const keys = currencies.map(code => `currency:${code.toUpperCase()}`);
      const values = await this.mgetOptimized(keys);
      
      const result = values
        .filter(value => value !== null)
        .map(value => JSON.parse(value!));

      if (result.length > 0) {
        // ✅ Cache bulk results for faster subsequent requests
        await this.client.setEx(bulkKey, 120, JSON.stringify(result));
      }
      
      return result;
    } catch (error) {
      this.logger.error('Redis bulk operation failed:', error);
      throw error;
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async get(key: string): Promise<any> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value as string) : null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const stringValue = JSON.stringify(value);
    if (ttl) {
      await this.client.setEx(key, ttl, stringValue);
    } else {
      await this.client.set(key, stringValue);
    }
  }
}
