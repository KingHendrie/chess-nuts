require('dotenv').config();

const environment = process.env.NODE_ENV || 'development';
const config = require('../knexfile')[environment];
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
    },

    checkUserCredentials: async (email, password) => {
        try {
            const user = await knex('user').select('*')
                .where({ email }).first();

            if (user && await bcrypt.compare(password, user.passwordHash)) {
                logger.info('User credentials verified.');
                return user;
            } else {
                logger.warn('Invalid email or password.');
                return null;
            }
        } catch (error) {
            logger.error('Error checking user credentials:', error);
            throw error;
        }
    },

    getUserById: async (id) => {
        try {
            return await knex('user')
                .select('id', 'firstName', 'lastName', 'email', 'role', 'two_factor_enabled')
                .where({ id })
                .first();
        } catch (error) {
            logger.error('Error fetching user:', error);
            throw error;
        }
    },

    setTwoFA: async (id, enabled) => {
        try {
            await knex('user')
                .where({ id })
                .update({ two_factor_enabled: !!enabled });
            return true;
        } catch (error) {
            logger.error('Error setting 2FA:', error);
            throw error;
        }
    },

    updateUserPassword: async (id, newPassword) => {
        try {
            await knex('user')
                .where({ id })
                .update({ passwordHash });
            return true;
        } catch (error) {
            logger.error('Error updating user password:', error);
            throw error;
        }
    },

    //#endregion User Management

    //#region Admin Actions

    getUsersPaginated: async (page = 1, pageSize = 10) => {
        try {
            const offset = (page - 1) * pageSize;
            const users = await knex('user')
                .select('id', 'firstName', 'lastName', 'email', 'role', 'two_factor_enabled')
                .limit(pageSize)
                .offset(offset);

            const [{ count }] = await knex('user').count('* as count');

            return {
                users,
                total: Number(count),
                page,
                pageSize,
                totalPages: Math.ceil(Number(count) / pageSize)
            };
        } catch (error) {
            logger.error('Error fetching paginated users:', error);
            throw error;
        }
    },

    updateUser: async (id, { firstName, lastName, email, password, role }) => {
        try {
            const updateData = { firstName, lastName, email, role };
            if (password && password.trim() !== '') {
                updateData.passwordHash = await bcrypt.hash(password, 10);
            }

            const result = await knex('user')
                .where({ id })
                .update(updateData);
            return result > 0;
        } catch (error) {
            logger.error('Error updating user:', error);
            throw error;
        }
    }

    //#endregion Admin Actions
}

// Close connection gracefully
process.on('SIGINT', async () => {
    logger.warn('Shutting down database connection...');
    await knex.destroy();
    process.exit(0);
});

module.exports = { knex, checkConnection, ...db };