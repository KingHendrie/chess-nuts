const path = require('path');
const MigrationBuilder = require(path.join(__dirname, '../migrationClasses/MigrationBuilder'));

const GameSession = require(path.join(__dirname, '../models/gameSession'));

exports.up = async function(knex) {
    await new MigrationBuilder(knex, new GameSession()).up();
};

exports.down = async function(knex) {
    await new MigrationBuilder(knex, new GameSession()).down();
};
