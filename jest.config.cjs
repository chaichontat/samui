/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js?$': require.resolve('babel-jest'),
    '^.+\\.svelte$': [
      'svelte-jester',
      {
        preprocess: true
      }
    ]
  },
  transformIgnorePatterns: ['node_modules/(?!ol).+.js$'],
  moduleFileExtensions: ['js', 'svelte', 'ts']
};
