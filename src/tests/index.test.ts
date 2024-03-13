import { Qrwc } from '..'
import { Server } from 'mock-socket'

describe('Qrwc', () => {
  const mockUrl = 'ws://localhost:8080/qrc'

  // test('websocket should not be connected by default', () => {
  //   // Create the mock server
  //   const mockServer = new Server(mockUrl)

  //   // Create mock socket
  //   const mockSocket = new WebSocket(mockUrl)

  //   // Create the Qrwc instance
  //   const mockQrwc = new Qrwc({ socket: mockSocket })

  //   // Check that the WebSocket is not open
  //   expect(mockQrwc.getReadyState()).toBe('NOT_INITIALIZED')

  //   // Stop the mock server
  //   mockServer.stop()
  // })

  // test('connect method should establish WebSocket connection', async () => {
  //   // Create the mock server
  //   const mockServer = new Server(mockUrl)

  //   // Create mock socket
  //   const mockSocket = new WebSocket(mockUrl)

  //   // Create the Qrwc instance
  //   const mockQrwc = new Qrwc({ socket: mockSocket })

  //   // Check that the WebSocket is not open
  //   expect(mockQrwc.getReadyState()).toBe('NOT_INITIALIZED')

  //   // Connect Qrwc to the mock server
  //   mockQrwc.connect()

  //   // Wait for the connection to be established
  //   await new Promise(resolve => {
  //     mockServer.on('connection', resolve)
  //   })

  //   // Check that the WebSocket is open
  //   expect(mockQrwc.getReadyState()).toBe(WebSocket.OPEN)

  //   // Close the WebSocket connection
  //   mockQrwc.close()

  //   // Wait for close event to be emitted
  //   await new Promise(resolve => {
  //     mockServer.on('close', resolve)
  //   })

  //   // Stop the mock server
  //   mockServer.stop()
  // })

  // test('websocket should connect by default with auto start option', async () => {
  //   // Create the mock server
  //   const mockServer = new Server(mockUrl)

  //   // Create mock socket
  //   const mockSocket = new WebSocket(mockUrl)

  //   // Create the Qrwc instance
  //   const mockQrwc = new Qrwc({ socket: mockSocket, autoStart: true})

  //   // Wait for the connection to be established
  //   await new Promise(resolve => {
  //     mockServer.on('connection', resolve)
  //   })

  //   // Check that the WebSocket is open
  //   expect(mockQrwc.getReadyState()).toBe(WebSocket.OPEN)

  //   // Close the WebSocket connection
  //   mockQrwc.close()

  //   // Wait for close event to be emitted
  //   await new Promise(resolve => {
  //     mockServer.on('close', resolve)
  //   })

  //   // Stop the mock server
  //   mockServer.stop()
  // })

  // // Other tests to come...
})