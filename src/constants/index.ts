export const QrwcMinPollInterval = 34
export const QrwcDefaultPollInterval = 350

export const QrwcCoreApiPath = '/qrc-public-api/v0'

export const QrwcDefaultReconnect = {
  maxAttempts: 10,
  delay: 250,
  maxDelay: 10000,
  backoffFactor: 2
} as const
