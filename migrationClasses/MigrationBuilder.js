class MigrationBuilder {
    constructor(knex, model) {
        this.knex = knex;
        this.tableName = model.tableName;
        this.columns = model.columns;
    }

    async up() {
        return this.knex.schema.createTable(this.tableName, (table) => {
            table.increments('id').primary(); // Default primary key

            this.columns.forEach((col) => {
                if (col.type === 'string') table.string(col.name, col.length || 255);
                else if (col.type === 'integer') table.integer(col.name);
                else if (col.type === 'decimal') table.decimal(col.name);
                else if (col.type === 'text') table.text(col.name);
                else if (col.type === 'longtext') table.text(col.name, 'longtext');
                else if (col.type === 'boolean') table.boolean(col.name);
                // Note: do NOT add timestamps inside the loop per column. We add a single
                // pair of timestamps at the end to avoid duplicate `created_at`/`updated_at`.
                else if (col.type === 'date') table.date(col.name);
                else if (col.type === 'datetime') table.dateTime(col.name);
                else if (col.type === 'enum') table.enu(col.name, col.values);
                else if (col.type === 'foreign') {
                    table.integer(col.name).unsigned();
                    table.foreign(col.name).references(col.references).onDelete(col.onDelete || 'CASCADE');
                }
            });

            // Add a single pair of timestamps for the table (created_at, updated_at)
            table.timestamps(true, true);
        });
    }

    async down() {
        return this.knex.schema.dropTable(this.tableName);
    }
}

module.exports = MigrationBuilder;