// Jest global teardown: nothing special needed for in-memory sqlite, but keep for symmetry
module.exports = async () => {
    // Placeholder: knex in-memory DB will be destroyed when process exits
    console.log('Global teardown complete.');
};
