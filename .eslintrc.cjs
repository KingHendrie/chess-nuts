module.exports = {
    env: {
        node: true,
        es2021: true,
        jest: true
    },
    extends: [
        'eslint:recommended',
        'plugin:node/recommended',
        'prettier'
    ],
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module'
    },
    rules: {
        'no-console': 'off',
        'node/no-unsupported-features/es-syntax': ['error', { ignores: ['modules'] }]
    }
};
