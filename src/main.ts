import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for WebSocket connections
  app.enableCors({
    origin: '*', // Configure for your domain in production
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  Logger.log(`Currency Microservice running on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`WebSocket endpoint: ws://localhost:${port}/currency-stream`, 'Bootstrap');
}

bootstrap();
