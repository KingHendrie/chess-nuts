// models/gameSession.js
// Model for the game_sessions table

class GameSession {
    constructor() {
        this.tableName = 'game_sessions';
        this.columns = [
            { name: 'player_white_id', type: 'integer', references: { table: 'user', column: 'id' }, notNull: true },
            { name: 'player_black_id', type: 'integer', references: { table: 'user', column: 'id' }, notNull: true },
            { name: 'fen', type: 'string', length: 128, notNull: true },
            { name: 'moves', type: 'text', notNull: true },
            { name: 'status', type: 'string', length: 32, notNull: true }, // active, finished, aborted
            { name: 'created_at', type: 'timestamp', default: 'now' },
            { name: 'updated_at', type: 'timestamp', default: 'now' }
        ];
    }
}

module.exports = GameSession;
