// Jest global setup: run knex migrations for test environment
require('dotenv').config();
process.env.NODE_ENV = 'test';

const knexConfig = require('../knexfile')[process.env.NODE_ENV];
const Knex = require('knex');

module.exports = async () => {
    const knex = Knex(knexConfig);
    try {
        await knex.migrate.latest();
        console.log('Test DB migrations applied.');
    } finally {
        await knex.destroy();
    }
};
