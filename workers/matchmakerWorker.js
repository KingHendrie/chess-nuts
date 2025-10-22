// workers/matchmakerWorker.js
// Periodically scans the matchmaking queue and pairs players.

const EventBus = require('../utils/eventBus');
const { knex } = require('../utils/db');
const matchmakingService = require('../utils/services/matchmakingService');
const gameSessionService = require('../utils/services/gameSessionService');

let running = false;

async function tick() {
    try {
        // Get current searching users ordered by created_at
        const rows = await knex('matchmaking_queue').where({ status: 'searching' }).orderBy('created_at', 'asc');
        for (let i = 0; i < rows.length; i++) {
        const user = rows[i];
        // Try to find a match for this user
        const opponent = await matchmakingService.findMatch(user.user_id, user.elo, 0);
        if (opponent) {
            // Create game session
            const session = await gameSessionService.createSession(user.user_id, opponent.user_id);
            // Mark matched in queue
            await matchmakingService.setMatched(user.user_id, opponent.user_id);
            EventBus.emit('queue:matched', { userId: user.user_id, opponentId: opponent.user_id });
        }
        }
    } catch (e) {
        console.error('Matchmaker error', e);
    }
}

function start(intervalMs = 2000) {
    if (running) return;
    running = true;
    const id = setInterval(tick, intervalMs);
    return () => { clearInterval(id); running = false; };
}

module.exports = { start };
