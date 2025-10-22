exports.up = async function(knex) {
    const exists = await knex.schema.hasColumn('user', 'elo');
    if (!exists) {
        await knex.schema.table('user', (table) => {
        table.integer('elo');
        });
    }
};

exports.down = async function(knex) {
    const exists = await knex.schema.hasColumn('user', 'elo');
    if (exists) {
        await knex.schema.table('user', (table) => {
        table.dropColumn('elo');
        });
    }
};
