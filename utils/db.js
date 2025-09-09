require('dotenv').config();

const environment = process.env.NODE_ENV || 'development';
const config = require('./knexfile')[environment];
const knex = require('knex')(config);
const bcrypt = require('bcrypt');

const logger = require('./logger');

async function checkConnection() {
    try {
        await knex.raw('SELECT 1');
        logger.info('Database connection successful.');
    } catch (error) {
        logger.error('Database connection failed:', error);
        throw error;
    }
}

// Close conneciton gracefully
process.on('SIGINT', async () => {
    logger.warn('Shutting down database connection...');
    await knex.destroy();
    process.exit(0);
});

const db = {
    // Placeholder
}

module.exports = { knex, checkConnection, ...db };