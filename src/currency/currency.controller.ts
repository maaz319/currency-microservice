import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { CurrencyGateway } from './currency.gateway';

@Controller()
export class CurrencyController {
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly currencyGateway: CurrencyGateway
  ) {}

  @Get('/')
  async getAllCurrencies() {
    return this.currencyService.getAllCurrencies();
  }

  @Get('/health')
  async getHealth() {
    return this.currencyService.getHealthStatus();
  }

  @Post('/currencies/bulk')
  async getBulkCurrencies(@Body() body: { currencies: string[] }) {
    return this.currencyService.getBulkCurrencies(body.currencies);
  }

  @Get('/currencies')
  async getSpecificCurrencies(@Query('codes') codes: string) {
    const currencyCodes = codes ? codes.split(',') : [];
    return this.currencyService.getBulkCurrencies(currencyCodes);
  }

  @Get('/stats')
  async getConnectionStats() {
    return this.currencyGateway.getConnectionStats();
  }
}
