import { setupQrwc } from '../src/managers/qrwc/QrwcConnection'
import { WebSocket } from 'mock-socket'
global.WebSocket = WebSocket

describe('setupQrwc', () => {
  let onError: jest.Mock

  beforeEach((done) => {
    onError = jest.fn()
    done()
  })

  test('should attempt to reconnect after failure', (done) => {
    const { close } = setupQrwc({
      coreIpAddress: 'localhost:8080',
      onError,
      maxReconnectAttempts: 1,
      reconnectDelay: 10
    })

    setTimeout(() => {
      expect(onError).toHaveBeenCalled()
      close()
      done()
    }, 100)
  })

  test('should not attempt to reconnect more than maxReconnectAttempts', (done) => {
    const { close } = setupQrwc({
      coreIpAddress: 'localhost:8080',
      onError,
      maxReconnectAttempts: 2,
      reconnectDelay: 10
    })

    setTimeout(() => {
      expect(onError).toHaveBeenCalledTimes(3)
      close()
      done()
    }, 100)
  })
})
