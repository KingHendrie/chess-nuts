const Knex = require('knex');
const knexfile = require('../knexfile');

(async () => {
  const config = knexfile.test;
  const knex = Knex(config);
  try {
    console.log('Running migrations...');
    await knex.migrate.latest();
    console.log('Migrations done. Inspecting user table...');
    const cols = await knex.raw("PRAGMA table_info('user')");
    console.log(cols);
  } catch (err) {
    console.error(err);
  } finally {
    await knex.destroy();
  }
})();
