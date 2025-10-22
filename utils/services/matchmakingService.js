// utils/services/matchmakingService.js
// Service for matchmaking queue and logic

const { knex } = require('../../utils/db');
const EventBus = require('../../utils/eventBus');
const { createGauge } = require('../metrics');

const USER_TABLE = 'user';
const TABLE = 'matchmaking_queue';
const DEFAULT_ELO = 500;
const ELO_STEP = 100; // ELO range expansion step
const MAX_WAIT = 60; // seconds before expanding ELO range

const queueLengthGauge = createGauge('matchmaking_queue_length', 'Number of users in the matchmaking queue');

const MatchmakingService = {
    async joinQueue(userId) {
        // Get user's ELO or set to default if new
        let user = await knex(USER_TABLE).where({ id: userId }).first();
        let elo = user && user.elo ? user.elo : DEFAULT_ELO;
        // Add to queue. MySQL: insert then fetch the row by last insert id.
        const res = await knex(TABLE).insert({ user_id: userId, status: 'searching', elo });
        const insertedId = Array.isArray(res) ? res[0] : res;
        const inserted = await knex(TABLE).where({ id: insertedId }).first();
        EventBus.emit('queue:joined', { userId, elo });
        await updateQueueLength();
        return inserted;
    },

    async leaveQueue(userId) {
        const res = await knex(TABLE).where({ user_id: userId, status: 'searching' }).del();
        EventBus.emit('queue:left', { userId });
        await updateQueueLength();
        return res;
    },

    async findMatch(userId, elo, waitTime = 0) {
        // Expand ELO range based on wait time
        let range = ELO_STEP + Math.floor(waitTime / MAX_WAIT) * ELO_STEP;
        let minElo = Math.max(elo - range, 0);
        let maxElo = elo + range;
        // Find another searching user in ELO range
        return knex(TABLE)
            .where('user_id', '!=', userId)
            .andWhere('status', 'searching')
            .andWhere('elo', '>=', minElo)
            .andWhere('elo', '<=', maxElo)
            .orderBy('created_at', 'asc')
            .first();
    },

    async setMatched(userId, opponentId) {
        await knex(TABLE).where({ user_id: userId }).update({ status: 'matched', updated_at: knex.fn.now() });
        await knex(TABLE).where({ user_id: opponentId }).update({ status: 'matched', updated_at: knex.fn.now() });
        EventBus.emit('queue:matched', { userId, opponentId });
    },

    async getQueueStatus(userId) {
        return knex(TABLE).where({ user_id: userId }).first();
    },

    async clearQueue() {
        return knex(TABLE).where({ status: 'searching' }).del();
    }
};

async function updateQueueLength() {
    const count = await knex(TABLE).where({ status: 'searching' }).count('* as count');
    queueLengthGauge.set(count[0].count);
}

module.exports = MatchmakingService;
