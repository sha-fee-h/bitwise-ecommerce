const redis = require('redis');

const client = redis.createClient({
    url: 'redis://localhost:6379', // Default Redis URL
});

client.on('error', (err) => console.error('Redis Client Error:', err));

(async () => {
    await client.connect(); // Connect to Redis
})();

module.exports = client;