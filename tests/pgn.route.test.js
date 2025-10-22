const request = require('supertest');
const app = require('../app');

describe('PGN route', () => {
    let cookie;
    beforeAll(async () => {
        await request(app).post('/api/user/register').send({ firstName: 'PGN', lastName: 'User', email: 'pgn@example.com', password: 'pass' });
        const res = await request(app).post('/api/user/login').send({ email: 'pgn@example.com', password: 'pass' });
        cookie = res.headers['set-cookie'];
    });

    it('returns 404 for non-existent session', async () => {
        const res = await request(app).get('/api/game/session/9999/export/pgn').set('Cookie', cookie);
        expect(res.statusCode).toBe(404);
    });
});
