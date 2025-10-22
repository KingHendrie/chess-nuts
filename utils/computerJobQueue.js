// utils/computerJobQueue.js
// Simple abstraction for enqueuing jobs for the stockfish worker.

const logger = require('./logger');

async function enqueueComputerMove(sessionId, difficulty = 10) {
    const job = { sessionId, difficulty };
    if (process.env.REDIS_URL) {
        try {
            const IORedis = require('ioredis');
            const redis = new IORedis(process.env.REDIS_URL);
            await redis.lpush('stockfish:jobs', JSON.stringify(job));
            logger.info('Pushed stockfish job to Redis queue');
            return true;
        } catch (e) {
            logger.warn('Failed to push job to redis: ' + e.message);
            return false;
        }
    } else {
        // In-memory fallback - worker must be running in same process
        // We directly require the worker and enqueue
        try {
            const worker = require('../workers/stockfishWorker');
            // Start the in-memory worker if it's not already running so jobs will be processed
            try { worker.start(); logger.info('Started in-memory stockfish worker'); } catch (e) { /* ignore if already started */ }
            await worker.enqueue(job);
            logger.info('Enqueued job to in-memory stockfish worker');
            return true;
        } catch (e) {
            logger.error('Failed to enqueue job to in-memory worker: ' + e.stack);
            return false;
        }
    }
}

module.exports = { enqueueComputerMove };
