export const QrwcMinPollInterval = 34
export const QrwcDefaultPollInterval = 350
export const QrwcDefaultHeartbeatInterval = 5000

export const QrwcCoreApiPath = '/qrc-public-api/v0'

export const QrwcDefaultReconnect = {
  maxAttempts: 5,
  delay: 5000,
  maxDelay: 5000,
  backoffFactor: 1
} as const
