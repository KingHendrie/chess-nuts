export default [
        {
            files: ['**/*.js'],
            languageOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                globals: {
                    module: 'readonly',
                    process: 'readonly',
                    require: 'readonly',
                    console: 'readonly'
                }
            },
            ignores: ['node_modules'],
            plugins: ['node'],
            rules: {
                'no-console': 'off',
                'node/no-unsupported-features/es-syntax': ['error', { ignores: ['modules'] }]
            },
            linterOptions: {
                reportUnusedDisableDirectives: true
            }
        }
];
