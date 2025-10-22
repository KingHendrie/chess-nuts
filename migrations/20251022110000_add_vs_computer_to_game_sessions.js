exports.up = async function(knex) {
    const exists = await knex.schema.hasColumn('game_sessions', 'vs_computer');
    if (!exists) {
        await knex.schema.table('game_sessions', (table) => {
        table.boolean('vs_computer').defaultTo(false);
        table.integer('computer_level').nullable();
        });
    }
};

exports.down = async function(knex) {
    const exists = await knex.schema.hasColumn('game_sessions', 'vs_computer');
    if (exists) {
        await knex.schema.table('game_sessions', (table) => {
        table.dropColumn('vs_computer');
        table.dropColumn('computer_level');
        });
    }
};
