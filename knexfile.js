require('dotenv').config();

module.exports = {
    development: {
        client: 'mysql2',
        connection: {
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
        },
        migrations: {
            directory: './migrations'
        },
        seeds: {
            directory: './seeds'
        }
    },
    test: {
        client: 'sqlite3',
        connection: {
            // Use a shared in-memory database URI so separate connections/processes can access the same DB
            // This allows Jest globalSetup to run migrations and the test runners to use the same in-memory DB.
            filename: 'file:memdb1?mode=memory&cache=shared'
        },
        useNullAsDefault: true,
        migrations: {
            directory: './migrations'
        }
    }
};