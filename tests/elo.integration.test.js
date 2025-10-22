const { knex } = require('../utils/db');
const EloService = require('../utils/services/eloService');

beforeAll(async () => {
    process.env.NODE_ENV = 'test';
});

afterAll(async () => {
    await knex.destroy();
});

describe('ELO integration', () => {
    test('updateElo updates user rows', async () => {
        // Create two users
        const [id1] = await knex('user').insert({ firstName: 'A', lastName: 'B', email: 'a@example.com', passwordHash: 'x', role: 'user' });
        const [id2] = await knex('user').insert({ firstName: 'C', lastName: 'D', email: 'c@example.com', passwordHash: 'x', role: 'user' });

        // Ensure default elo column exists and default to 500
        await knex('user').where({ id: id1 }).update({ elo: 1500 });
        await knex('user').where({ id: id2 }).update({ elo: 1500 });

        const res = await EloService.updateElo(id1, id2, 1);
        expect(res).toHaveProperty('newPlayerElo');
        expect(res).toHaveProperty('newOpponentElo');
    });
});
