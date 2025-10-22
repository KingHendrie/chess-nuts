#!/usr/bin/env node
// bin/worker.js
// A small CLI to start background workers separately from the web server.

require('dotenv').config();
const logger = require('../utils/logger');

const args = process.argv.slice(2);
const startMatchmaker = args.includes('matchmaker');
const startStockfish = args.includes('stockfish');

(async function main() {
    if (startMatchmaker) {
        try {
            const { start } = require('../workers/matchmakerWorker');
            start();
            logger.info('Started matchmaker worker');
        } catch (e) {
            logger.error('Failed to start matchmaker worker: ' + e.stack);
        }
    }

    if (startStockfish) {
        try {
            const stockfish = require('../workers/stockfishWorker');
            stockfish.start();
            logger.info('Started stockfish worker');
        } catch (e) {
            logger.error('Failed to start stockfish worker: ' + e.stack);
        }
    }

    if (!startMatchmaker && !startStockfish) {
        console.log('Usage: node bin/worker.js [matchmaker] [stockfish]');
        process.exit(0);
    }
})();
