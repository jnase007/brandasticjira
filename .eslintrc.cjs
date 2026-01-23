module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  plugins: ['react', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    'no-unused-vars': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'react-refresh/only-export-components': 'off',
    'react-hooks/exhaustive-deps': 'off',
  },
  overrides: [
    {
      files: [
        'scripts/**/*.js',
        '*.config.js',
        '*.config.cjs',
        'vite.config.js',
        'tailwind.config.js',
        'tests/**/*.js',
        'netlify/functions/**/*.js',
      ],
      env: {
        node: true,
        browser: false,
      },
    },
  ],
  ignorePatterns: ['dist/', 'node_modules/'],
}

