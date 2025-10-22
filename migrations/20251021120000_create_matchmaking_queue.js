const path = require('path');
const MigrationBuilder = require(path.join(__dirname, '../migrationClasses/MigrationBuilder'));

const MatchmakingQueue = require(path.join(__dirname, '../models/matchmakingQueue'));

exports.up = async function(knex) {
    await new MigrationBuilder(knex, new MatchmakingQueue()).up();
};

exports.down = async function(knex) {
    await new MigrationBuilder(knex, new MatchmakingQueue()).down();
};
