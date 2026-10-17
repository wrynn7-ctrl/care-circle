// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      'dist-screens/*',
      'node_modules/*',
      'supabase/functions/*',
      'coverage/*',
      '.expo/*',
    ],
  },
  {
    rules: {
      // Health data must never be logged in production code paths.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]);
