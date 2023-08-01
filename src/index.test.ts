import Qrcc from '.'
import { Server } from 'mock-socket'

describe('Qrcc', () => {
  let mockQrcc: Qrcc
  let mockServer: Server

  beforeEach(() => {
    const mockIp = 'localhost:8080'
    mockServer = new Server(`ws://${mockIp}/qrc`)

    // Create the Qrcc instance
    mockQrcc = new Qrcc({ ip: mockIp})
  })

  afterEach(() => {
    // Clean up the server after each test
    mockServer.close()
  })

  test('websocket should not be connected by default', () => {
    // Check that the WebSocket is not open
    expect(mockQrcc.getReadyState()).toBe('NOT_INITIALIZED')
  })

  test('connect method should establish WebSocket connection', async () => {
    // Check that the WebSocket is not open
    expect(mockQrcc.getReadyState()).toBe('NOT_INITIALIZED')

    // Connect Qrcc to the mock server
    await mockQrcc.connect()

    // Wait for the connection to be established
    await new Promise(resolve => {
      mockServer.on('connection', resolve)
    })

    expect(mockQrcc.getReadyState()).toBe(WebSocket.OPEN)
  })

  // Other tests to come...
})