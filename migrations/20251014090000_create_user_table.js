const path = require('path');
const MigrationBuilder = require(path.join(__dirname, '../migrationClasses/MigrationBuilder'));

const User = require(path.join(__dirname, '../models/users'));

exports.up = async function(knex) {
    await new MigrationBuilder(knex, new User()).up();
};

exports.down = async function(knex) {
    await new MigrationBuilder(knex, new User()).down();
};
