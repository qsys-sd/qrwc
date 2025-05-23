import { createDefaultEsmPreset } from 'ts-jest'

const presetConfig = createDefaultEsmPreset()

const jestConfig = {
  ...presetConfig,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/FrontendEvents.test.ts']
}

export default jestConfig
