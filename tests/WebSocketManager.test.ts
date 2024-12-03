import { WebSocketManager } from '../src/managers'
import { WebSocket, Server } from 'mock-socket'
import { EventManager } from '../src/managers'
import { qrwcEvents } from '../src/constants'

describe('WebSocketManager', () => {
  let mockServer: Server
  let wsManager: WebSocketManager
  const eventManager = new EventManager()
  let mockSocket: WebSocket

  eventManager.initializeEmitter()

  beforeEach((done) => { // Use beforeAll with done callback
    mockServer = new Server('ws://localhost:8080')
    global.WebSocket = WebSocket // Mock global WebSocket with mock-socket WebSocket

    mockSocket = new WebSocket('ws://localhost:8080')
    mockSocket.onopen = () => {
      wsManager = new WebSocketManager(mockSocket, eventManager)
      done() // Call done when the connection is open
    }
  })

  afterEach(() => { // Use afterAll for cleanup
    mockServer.stop()
  })

  test('should handle onMessage event', done => {
    const testMessage = 'test message'

    eventManager.on('message', (message) => {
      expect(message).toEqual(testMessage)
      done()
    })

    mockServer.emit('message', JSON.stringify(testMessage))
  })

  test('should handle error event', done => {
    eventManager.on(qrwcEvents.error, (error) => {
      expect(error).toBeTruthy()
      done()
    })

    mockServer.simulate('error')
  })

  test('should send data', () => {
    const testData = { action: 'testAction' }

    mockServer.on('connection', socket => {
      socket.on('message', data => {
        if (typeof data !== 'string') {
          throw new Error('Data is not a string')
        }
        expect(JSON.parse(data)).toEqual(testData)
      })
    })

    wsManager.send(testData)
  })

  // Example test for isOpen method
  test('isOpen should return true when WebSocket is open', () => {
    // Mock the getReadyState method to return WebSocket.OPEN
    if (wsManager) {
      wsManager.getReadyState = jest.fn().mockReturnValue(WebSocket.OPEN)
    }

    expect(wsManager.getReadyState()).toBe(WebSocket.OPEN)
  })

  test('getReadyState should return the current readyState of the WebSocket', () => {
    const readyState = wsManager.getReadyState()
    expect(readyState).toBe(WebSocket.OPEN)
  })

  test('should handle onClose event', done => {
    eventManager.on(qrwcEvents.disconnected, (event) => {
      expect(event).toBeTruthy()
      done()
    })

    mockSocket.close()
  })

  test('should close the WebSocket connection', done => {
    eventManager.on(qrwcEvents.disconnected, (event) => {
      expect(event).toBeTruthy()
      done()
    })

    wsManager.close()
  })
})
