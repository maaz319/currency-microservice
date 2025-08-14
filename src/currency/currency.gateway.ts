import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/currency-stream',
  transports: ['websocket'],
})
export class CurrencyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CurrencyGateway.name);
  private connectionCurrencyMap = new Map<string, Set<string>>();

  constructor(private readonly redisService: RedisService) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectionCurrencyMap.set(client.id, new Set());
  }

  handleDisconnect(client: Socket) {
    this.connectionCurrencyMap.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe-currencies')
  async handleSubscribeCurrencies(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { currencies: string[] }
  ) {
    try {
      const { currencies } = data;
      const startTime = Date.now();

      if (currencies.length > 100) {
        client.emit('error', { 
          message: 'Maximum 100 currencies allowed per subscription' 
        });
        return;
      }

      const currencyData = await this.redisService.getBulkCurrencies(currencies);
      
      const clientCurrencies = this.connectionCurrencyMap.get(client.id) || new Set();
      currencies.forEach(currency => {
        clientCurrencies.add(currency.toUpperCase());
        client.join(`currency-${currency.toUpperCase()}`);
      });
      
      this.connectionCurrencyMap.set(client.id, clientCurrencies);

      const responseTime = Date.now() - startTime;
      
      client.emit('subscription-confirmed', {
        currencies,
        count: currencyData.length,
        data: currencyData,
        responseTime,
        timestamp: new Date().toISOString(),
      });
      
      this.logger.log(
        `Client ${client.id} subscribed to ${currencies.length} currencies in ${responseTime}ms`
      );
    } catch (error) {
      this.logger.error('Subscription error:', error.message);
      client.emit('error', { message: 'Failed to subscribe to currencies' });
    }
  }

  @SubscribeMessage('get-currencies-bulk')
  async handleGetCurrenciesBulk(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { currencies: string[] }
  ) {
    try {
      const startTime = Date.now();
      const currencyData = await this.redisService.getBulkCurrencies(data.currencies);
      const responseTime = Date.now() - startTime;

      client.emit('currencies-bulk-response', {
        currencies: data.currencies,
        count: currencyData.length,
        data: currencyData,
        responseTime,
        cached: true,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Bulk request for ${data.currencies.length} currencies: ${responseTime}ms`);
    } catch (error) {
      client.emit('error', { message: 'Failed to fetch bulk currencies' });
    }
  }

  async broadcastCurrencyUpdate(currencies: any[]) {
    const startTime = Date.now();

    this.server.emit('currency-update', {
      type: 'live-update',
      data: currencies,
      count: currencies.length,
      timestamp: new Date().toISOString(),
    });

    const batchSize = 10;
    for (let i = 0; i < currencies.length; i += batchSize) {
      const batch = currencies.slice(i, i + batchSize);
      
      batch.forEach(currency => {
        this.server.to(`currency-${currency.CurrencyCode}`).emit('currency-specific-update', {
          currency: currency.CurrencyCode,
          data: currency,
          timestamp: new Date().toISOString(),
        });
      });

      if (i + batchSize < currencies.length) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(`Broadcasted ${currencies.length} currencies in ${duration}ms`);
  }

  getConnectionStats() {
    const connections = this.connectionCurrencyMap.size;
    const totalSubscriptions = Array.from(this.connectionCurrencyMap.values())
      .reduce((total, currencies) => total + currencies.size, 0);

    return {
      activeConnections: connections,
      totalSubscriptions,
      averageSubscriptionsPerConnection: connections > 0 ? totalSubscriptions / connections : 0,
    };
  }
}
