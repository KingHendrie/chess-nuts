const request = require('supertest');

// Mock eloService to observe calls
const mockUpdateElo = jest.fn(async () => ({ newPlayerElo: 1600, newOpponentElo: 1400 }));
jest.mock('../utils/services/eloService', () => ({ updateElo: (...args) => mockUpdateElo(...args), calculateElo: jest.requireActual('../utils/services/eloService').calculateElo }));

// Mock game session service behavior per-test below

describe('Game flow and ELO', () => {
    let app;
    beforeAll(async () => {
        // For these tests we'll mock gameSessionService and chess.js before loading app
        jest.resetModules();

        // Mock gameSessionService - we'll override specific behavior in each test by re-mocking
        jest.mock('../utils/services/gameSessionService', () => ({
            createSession: async () => ({ id: 1, player_white_id: 1, player_black_id: 2, fen: 'start' }),
            makeMove: async () => ({ status: 'finished' }),
            getSession: async () => ({ id: 1, player_white_id: 1, player_black_id: 2, fen: 'fen' })
        }));

        // Mock chess.js to report checkmate for finished games
        jest.mock('chess.js', () => ({
            Chess: function () {
                return {
                    isDraw: () => false,
                    isCheckmate: () => true,
                    turn: () => 'w'
                };
            }
        }));

        app = require('../app');
    });

    afterAll(async () => {
        // clean up mocks
        jest.resetAllMocks();
    });

    test('finished game triggers ELO update', async () => {
        // Register and login to get cookie
        await request(app).post('/api/user/register').send({ firstName: 'G', lastName: 'F', email: 'g@example.com', password: 'pass' });
        const res = await request(app).post('/api/user/login').send({ email: 'g@example.com', password: 'pass' });
        const cookie = res.headers['set-cookie'];

        // Make a move which our mocked services treat as finished
        const moveRes = await request(app).post('/api/game/session/1/move').set('Cookie', cookie).send({ move: { from: 'e2', to: 'e4' } });
        expect(moveRes.statusCode).toBe(200);
        // ELO update should have been called once with winner/loser/drawScore
        expect(mockUpdateElo).toHaveBeenCalled();
        const args = mockUpdateElo.mock.calls[0];
        // Expect call signature: (winnerId, loserId, score)
        expect(args.length).toBeGreaterThanOrEqual(3);
    });

    test('invalid move returns 400', async () => {
        // Re-mock gameSessionService.makeMove to return null for invalid move
        jest.resetModules();
        jest.mock('../utils/services/gameSessionService', () => ({
            createSession: async () => ({ id: 2, player_white_id: 1, player_black_id: 2, fen: 'start' }),
            makeMove: async () => null,
            getSession: async () => null
        }));
        app = require('../app');

        await request(app).post('/api/user/register').send({ firstName: 'I', lastName: 'M', email: 'i@example.com', password: 'pass' });
        const res = await request(app).post('/api/user/login').send({ email: 'i@example.com', password: 'pass' });
        const cookie = res.headers['set-cookie'];

        const moveRes = await request(app).post('/api/game/session/2/move').set('Cookie', cookie).send({ move: { from: 'a1', to: 'a9' } });
        expect(moveRes.statusCode).toBe(400);
    });
});
