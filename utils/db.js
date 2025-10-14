require('dotenv').config();

const environment = process.env.NODE_ENV || 'development';
const config = require('../../knexfile')[environment];
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

const db = {
    //#region User Management

    checkUserExists: async (email) => {
        try {
            const user = await knex('user').select('*').where({ email }).first();
            if (user) {
                logger.info(`User with email ${email} exists.`);
                return true;
            } else {
                logger.warn(`User with email ${email} does not exists.`);
                return false;
            }
        } catch (error) {
            logger.error('Error checking if user exists: ' + error.stack);
            throw error;
        }
    },

    createUser: async (firstName, lastName, email, password, role) => {
        try {
            const passwordHash = await bcrypt.hash(password, 10);
            const newUser = {
                firstName,
                lastName,
                email,
                passwordHash,
                role
            };

            logger.info('Creating new user: ', newUser);
            const result = await knex('user').insert(newUser);
            logger.info('User created: ', newUser);
            return result;
        } catch (error) {
            logger.error('Error creating user: ', error);
            throw error;
        }
    }

    //#endregion User Management
}

// Close connection gracefully
process.on('SIGINT', async () => {
    logger.warn('Shutting down database connection...');
    await knex.destroy();
    process.exit(0);
});

module.exports = { knex, checkConnection, ...db };