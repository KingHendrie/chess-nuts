// tests/api.test.js
// Unit tests for API functions using Jest and Supertest with mocked DB/services
// Unit tests for API functions using Jest and Supertest with mocked DB/services

const request = require('supertest');

// Mock the DB module before requiring the app
jest.mock('../utils/db', () => {
    const users = {};
    let nextUserId = 1;
    return {
        checkUserExists: async (email) => {
            return Object.values(users).some(u => u.email === email);
        },
        createUser: async (firstName, lastName, email, password, role) => {
            const id = nextUserId++;
            users[id] = { id, firstName, lastName, email, passwordHash: password, role };
            return { id };
        },
        checkUserCredentials: async (email, password) => {
            const user = Object.values(users).find(u => u.email === email && u.passwordHash === password);
            if (!user) return null;
            return { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, two_factor_enabled: false };
        },
        getUserById: async (id) => {
            return users[id] ? { ...users[id] } : null;
        },
        setTwoFA: async (id, enabled) => { if (users[id]) users[id].two_factor_enabled = !!enabled; return true; },
        updateUserPassword: async (id, newPassword) => { if (users[id]) users[id].passwordHash = newPassword; return true; },
        getUsersPaginated: async (page = 1, pageSize = 10) => {
            const all = Object.values(users).map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role, two_factor_enabled: !!u.two_factor_enabled }));
            return { users: all.slice((page-1)*pageSize, page*pageSize), total: all.length, page, pageSize, totalPages: Math.ceil(all.length / pageSize) };
        },
        updateUser: async (id, data) => {
            if (!users[id]) return false;
            Object.assign(users[id], data);
            return true;
        }
    };
});

// Mock mailer so no emails are sent
jest.mock('../utils/mailer', () => ({
    sendMail: async (opts) => ({ accepted: [opts.to] })
}));

// Mock matchmaking service
jest.mock('../utils/services/matchmakingService', () => ({
    joinQueue: async (userId) => ({ userId, joinedAt: Date.now() }),
    leaveQueue: async (userId) => true
}));

// Mock game session service
jest.mock('../utils/services/gameSessionService', () => {
    const sessions = {};
    let mockSessionId = 1;
    return {
        createSession: async (playerWhiteId, playerBlackId, initialFen) => {
            const id = `s${mockSessionId++}`;
            const session = { id, player_white_id: playerWhiteId, player_black_id: playerBlackId, fen: initialFen || 'start' };
            sessions[id] = session;
            return session;
        },
        makeMove: async (sessionId, moveObj) => {
            const session = sessions[sessionId];
            if (!session) return null;
            // For test purposes, accept any move
            session.fen = session.fen + ' ' + JSON.stringify(moveObj);
            return { status: 'ok' };
        },
        getSession: async (id) => sessions[id]
    };
});

// Now require the app after mocks are in place
const app = require('../app');

describe('User Authentication', () => {
    it('should register a new user', async () => {
        const res = await request(app)
            .post('/api/user/register')
            .send({
                firstName: 'Test',
                lastName: 'User',
                email: 'testuser@example.com',
                password: 'password123',
                role: 'user'
            });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should not register duplicate user', async () => {
        const res = await request(app)
            .post('/api/user/register')
            .send({
                firstName: 'Test',
                lastName: 'User',
                email: 'testuser@example.com',
                password: 'password123',
                role: 'user'
            });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/already exists/i);
    });

    it('should login with correct credentials', async () => {
        const res = await request(app)
            .post('/api/user/login')
            .send({
                email: 'testuser@example.com',
                password: 'password123'
            });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should not login with wrong password', async () => {
        const res = await request(app)
            .post('/api/user/login')
            .send({
                email: 'testuser@example.com',
                password: 'wrongpassword'
            });
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/invalid/i);
    });
});

describe('Matchmaking', () => {
    let token;
    beforeAll(async () => {
        // Register and login to get a valid JWT token
        await request(app)
            .post('/api/user/register')
            .send({
                firstName: 'Test',
                lastName: 'User',
                email: 'testuser@example.com',
                password: 'password123',
                role: 'user'
            });

        const res = await request(app)
            .post('/api/user/login')
            .send({
                email: 'testuser@example.com',
                password: 'password123'
            });

        token = res.body.token;
    });

    it('should join matchmaking queue', async () => {
        const res = await request(app)
            .post('/api/matchmaking/join')
            .set('Authorization', `Bearer ${token}`)
            .send();
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should leave matchmaking queue', async () => {
        const res = await request(app)
            .post('/api/matchmaking/leave')
            .set('Authorization', `Bearer ${token}`)
            .send();
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe('Game Session', () => {
    let token;
    let sessionId;
    beforeAll(async () => {
        // Register and login to get a valid JWT token
        await request(app)
            .post('/api/user/register')
            .send({
                firstName: 'Test',
                lastName: 'User',
                email: 'testuser@example.com',
                password: 'password123',
                role: 'user'
            });

        const res = await request(app)
            .post('/api/user/login')
            .send({
                email: 'testuser@example.com',
                password: 'password123'
            });

        token = res.body.token;
    });

    it('should create a game session', async () => {
        const res = await request(app)
            .post('/api/game/session/create')
            .set('Authorization', `Bearer ${token}`)
            .send({ opponentId: 2, color: 'white' });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        sessionId = res.body.session.id;
    });

    it('should make a move in game session', async () => {
        const res = await request(app)
            .post(`/api/game/session/${sessionId}/move`)
            .set('Authorization', `Bearer ${token}`)
            .send({ move: { from: 'e2', to: 'e4' } });
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
