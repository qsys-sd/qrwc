import { createDefaultEsmPreset } from 'ts-jest'

const presetConfig = createDefaultEsmPreset()

const jestConfig = {
  ...presetConfig,
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/tests/FrontendEvents.test.ts'],
  moduleNameMapper: {
    '(.+EventPolyfill)\\.js': '$1.node',
    '(.+)\\.js': '$1'
  }
}

export default jestConfig
