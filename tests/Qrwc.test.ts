import { Qrwc } from '../src/managers/qrwc/Qrwc'
import { EventManager, ControlManager, RequestManager } from '../src/managers'
import { Server, WebSocket} from 'mock-socket'

describe('Qrwc', () => {
  let qrwc: Qrwc

  beforeEach(()=> {
    qrwc = new Qrwc()
  })

  it('should properly instantiate its dependencies', () => {
    expect(qrwc.eventManager).toBeInstanceOf(EventManager)
    expect(qrwc.requestManager).toBeInstanceOf(RequestManager)
    expect(qrwc.controlManager).toBeInstanceOf(ControlManager)
  })

  it('should attach a websocket', () => {
    const mockServer = new Server('ws://localhost:8081')
    const mockSocket = new WebSocket('ws://localhost:8081')

    mockSocket.onopen = () => {
      qrwc.attachWebSocket(mockSocket)
      expect(qrwc.webSocketManager).toBeDefined()
      expect(qrwc.webSocketManager?.getReadyState()).toBe(1)
    }

    // Clean up
    mockServer.stop()
  })
})
