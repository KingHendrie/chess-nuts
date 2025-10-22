// utils/services/eloService.js
// ELO rating update logic for chess games

// `utils/db.js` exports { knex, ... } so import the knex instance explicitly
const { knex } = require('../../utils/db');
const USER_TABLE = 'user';

function calculateElo(playerElo, opponentElo, result, k = 32) {
    // result: 1 = win, 0.5 = draw, 0 = loss
    const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    return Math.round(playerElo + k * (result - expected));
}

const EloService = {
    async updateElo(playerId, opponentId, result) {
        // Get current ELOs
        const player = await knex(USER_TABLE).where({ id: playerId }).first();
        const opponent = await knex(USER_TABLE).where({ id: opponentId }).first();
        if (!player || !opponent) return;
        const playerElo = player.elo || 500;
        const opponentElo = opponent.elo || 500;
        // Calculate new ELOs
        let playerResult = result; // 1=win, 0.5=draw, 0=loss
        let opponentResult = result === 1 ? 0 : result === 0 ? 1 : 0.5;
        const newPlayerElo = calculateElo(playerElo, opponentElo, playerResult);
        const newOpponentElo = calculateElo(opponentElo, playerElo, opponentResult);
        // Update in DB
        await knex(USER_TABLE).where({ id: playerId }).update({ elo: newPlayerElo });
        await knex(USER_TABLE).where({ id: opponentId }).update({ elo: newOpponentElo });
        return { newPlayerElo, newOpponentElo };
    }
};

// Export calculateElo for unit testing
module.exports = EloService;
module.exports.calculateElo = calculateElo;
