class User {
    constructor() {
        this.tableName = 'user';
        this.columns = [
            { name: 'firstName', type: 'string', length: 255 },
            { name: 'lastName', type: 'string', length: 255 },
            { name: 'email', type: 'string', length: 255, unique: true },
            { name: 'passwordHash', type: 'string' },
            { name: 'role', type: 'enum', values: ['admin', 'user'] },
            { name: 'two_factor_enabled', type: 'boolean', default: false }
        ]
    }
}

module.exports = User;