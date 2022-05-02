/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.svelte$': [
      'svelte-jester',
      {
        preprocess: true
      }
    ]
  },
  moduleFileExtensions: ['js', 'svelte', 'ts']
};
