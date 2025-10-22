// models/matchmakingQueue.js
// Model for the matchmaking_queue table

class MatchmakingQueue {
    constructor() {
        this.tableName = 'matchmaking_queue';
        this.columns = [
            { name: 'user_id', type: 'integer', references: { table: 'user', column: 'id' }, notNull: true },
            { name: 'status', type: 'string', length: 32, notNull: true }, // 'searching', 'matched', 'in_game', 'cancelled'
            { name: 'elo', type: 'integer', notNull: true },
            { name: 'created_at', type: 'timestamp', default: 'now' },
            { name: 'updated_at', type: 'timestamp', default: 'now' }
        ];
    }
}

module.exports = MatchmakingQueue;
