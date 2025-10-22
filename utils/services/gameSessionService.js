// utils/services/gameSessionService.js
// Backend service for chess game session management

const { knex } = require('../../utils/db');
const ChessGame = require('./chessGame');
const { createGauge } = require('../metrics');
const logger = require('../../utils/logger');

const TABLE = 'game_sessions';

const activeSessionsGauge = createGauge('active_game_sessions', 'Number of active game sessions');

const GameSessionService = {
    async createSession(playerWhiteId, playerBlackId, initialFen = null) {
        try {
            const defaultFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
            const chess = new ChessGame(initialFen || defaultFen);
            const fen = chess.getFen();
            const session = {
                player_white_id: playerWhiteId,
                player_black_id: playerBlackId,
                fen,
                moves: JSON.stringify([]),
                status: 'active',
                created_at: new Date(),
                updated_at: new Date()
            };
            // MySQL does not support returning('*') on insert. Insert then fetch by last insert id.
            const res = await knex(TABLE).insert(session);
            // knex with mysql2 returns an array with inserted id at index 0
            const insertedId = Array.isArray(res) ? res[0] : res;
            return await knex(TABLE).where({ id: insertedId }).first();
        } catch (error) {
            logger.error('Error in createSession:', error);
            throw error; // Re-throw the error to propagate it to the caller
        }
    },

    async getSession(sessionId) {
        return knex(TABLE).where({ id: sessionId }).first();
    },

    async makeMove(sessionId, moveObj) {
        // Load session, apply move, update FEN and moves
        const session = await this.getSession(sessionId);
        if (!session || session.status !== 'active') return null;
        const chess = new ChessGame(session.fen);
        const move = chess.move(moveObj);
        if (!move) return null;
        const moves = JSON.parse(session.moves);
        moves.push(move);
        const fen = chess.getFen();
        let status = 'active';
        // ChessGame provides an isGameOver() wrapper which handles API differences
        if (chess.isGameOver && chess.isGameOver()) status = 'finished';
        await knex(TABLE).where({ id: sessionId }).update({ fen, moves: JSON.stringify(moves), status, updated_at: new Date() });
        return { fen, move, status };
    },

    async getMoves(sessionId) {
        const session = await this.getSession(sessionId);
        return session ? JSON.parse(session.moves) : [];
    },

    async endSession(sessionId) {
        await knex(TABLE).where({ id: sessionId }).update({ status: 'finished', updated_at: new Date() });
    }
};

// Update active sessions after session creation or end
async function updateActiveSessions() {
    try {
        const result = await knex(TABLE).where({ status: 'active' }).count('* as count');
        const activeSessions = result[0]?.count || 0; // Safely extract the count
        activeSessionsGauge.set(activeSessions);
    } catch (error) {
        logger.error('Error updating active sessions:', error);
        throw error; // Re-throw to propagate the error
    }
}

// Define the initializeService function
async function initializeService() {
    try {
        await updateActiveSessions();
        console.log('Active sessions initialized successfully');
    } catch (error) {
        console.error('Error initializing active sessions:', error);
        throw error; // Re-throw to propagate the error
    }
}

module.exports = { GameSessionService, initializeService };
