const io = require('socket.io-client');

// ✅ Connect to your currency stream
const socket = io('ws://currencyms-eforex-rate-x9zwtm-83b11d-35-154-84-50.traefik.me/currency-stream', {
  transports: ['websocket'], // Force WebSocket transport
  upgrade: false,
  rememberUpgrade: false,
});

socket.on('connect', () => {
  console.log('Connected to currency stream');
  
  // ✅ Request all currencies
  socket.emit('get-all-currencies');
});

// ✅ Listen for all currencies response
socket.on('all-currencies-response', (data) => {
  console.log(`Received ${data.count} currencies in ${data.responseTime}ms`);
  console.log('Last sync:', data.lastSync);
  console.log('Currencies:', data.detail);
});

socket.on('connect', () => {
  console.log('✅ Connected to currency stream:', socket.id);
  
  // Test subscription to currencies
  socket.emit('subscribe-currencies', {
    currencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD']
  });
});

socket.on('subscription-confirmed', (data) => {
  console.log('📊 Subscription confirmed:', data);
});

socket.on('currency-update', (data) => {
  console.log('💱 Currency update received:', data.count, 'currencies');
});

socket.on('currency-specific-update', (data) => {
  console.log('🔄 Specific update:', data.currency, data.data);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from currency stream');
});

socket.on('connect_error', (error) => {
  console.error('🚨 Connection error:', error.message);
});

// Test bulk request after connection
setTimeout(() => {
  socket.emit('get-currencies-bulk', {
    currencies: ['USD', 'EUR', 'GBP']
  });
}, 2000);
