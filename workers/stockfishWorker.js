/*
 * workers/stockfishWorker.js
 * Background worker that processes computer-move jobs.
 * If REDIS_URL is provided, it will use a Redis list named 'stockfish:jobs'.
 * Otherwise it will use an in-memory queue (not persistent).
 */

const { Worker, isMainThread, parentPort } = require('worker_threads');
const logger = require('../utils/logger');
const ComputerGameService = require('../utils/services/computerGameService');

let running = false;
let intervalId = null;
const inMemoryQueue = [];

async function processJob(job) {
    try {
        logger.info('Processing stockfish job: ' + JSON.stringify(job));
        const { sessionId, difficulty } = job;
        const result = await ComputerGameService.computerMove(sessionId, difficulty);
        return result;
    } catch (e) {
        logger.error('Stockfish job failed: ' + e.stack);
        return null;
    }
}

async function pollRedisAndProcess(redis) {
    try {
        // BRPOP blocks until a job becomes available
        const res = await redis.brpop('stockfish:jobs', 0);
        if (res && res[1]) {
            const job = JSON.parse(res[1]);
            await processJob(job);
        }
    } catch (e) {
        logger.error('Redis poll error in stockfish worker: ' + e.stack);
        // backoff
        await new Promise(r => setTimeout(r, 1000));
    }
}

function start(options = {}) {
    if (running) return;
    running = true;
    if (process.env.REDIS_URL) {
        try {
            const IORedis = require('ioredis');
            const redis = new IORedis(process.env.REDIS_URL);
            // Poll continuously using BRPOP
            (async function loop() {
                while (running) {
                    await pollRedisAndProcess(redis);
                }
            })();
            logger.info('Stockfish worker using Redis queue');
        } catch (e) {
            logger.warn('Failed to start Redis-backed stockfish worker: ' + e.message);
            // fallback to in-memory polling
            intervalId = setInterval(async () => {
                const job = inMemoryQueue.shift();
                if (job) await processJob(job);
            }, 500);
        }
    } else {
        // in-memory queue polling
        intervalId = setInterval(async () => {
            const job = inMemoryQueue.shift();
            if (job) await processJob(job);
        }, 500);
        logger.info('Stockfish worker using in-memory queue');
    }
}

function stop() {
    running = false;
    if (intervalId) clearInterval(intervalId);
}

function enqueue(job) {
    if (process.env.REDIS_URL) {
        try {
            const IORedis = require('ioredis');
            const redis = new IORedis(process.env.REDIS_URL);
            return redis.lpush('stockfish:jobs', JSON.stringify(job));
        } catch (e) {
            logger.warn('Failed to enqueue job to Redis, falling back to memory: ' + e.message);
            inMemoryQueue.push(job);
            return Promise.resolve();
        }
    } else {
        inMemoryQueue.push(job);
        return Promise.resolve();
    }
}

module.exports = { start, stop, enqueue };
