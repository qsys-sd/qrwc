import { WebSocketManager } from '../src/entities/WebSocketManager'
import { WebSocket, Server } from 'mock-socket'
import {
  IChangeGroupPollResult,
  IChangeGroupPollRequest,
  IRpcRequest
} from '../src/index.interface'
import { jest } from '@jest/globals'

describe('WebSocketManager', () => {
  let mockServer: Server
  let wsManager: WebSocketManager
  let mockSocket: WebSocket

  beforeEach(async () => {
    mockServer = new Server('ws://localhost:8080')
    global.WebSocket = WebSocket // Mock global WebSocket with mock-socket WebSocket

    // Create a promise that resolves when the connection is open
    const connectionPromise = new Promise<void>((resolve) => {
      mockSocket = new WebSocket('ws://localhost:8080')
      mockSocket.onopen = () => {
        wsManager = new WebSocketManager(mockSocket)
        resolve()
      }
    })

    // Wait for the connection to be established
    await connectionPromise
  })

  afterEach(() => {
    mockServer.stop()
  })

  test('should correctly identify RPC responses', async () => {
    const testServer = new Server('ws://localhost:8081')

    // Create and connect the socket
    const connectionPromise = new Promise<WebSocketManager>((resolve) => {
      const testSocket = new WebSocket('ws://localhost:8081')
      testSocket.onopen = () => {
        resolve(new WebSocketManager(testSocket))
      }
    })

    // Set up the server to respond to messages
    testServer.on('connection', (socket) => {
      socket.on('message', (message) => {
        const body = JSON.parse(message as string) as IRpcRequest
        const result: IChangeGroupPollResult = {
          ...(body.params as IChangeGroupPollRequest),
          Changes: []
        }
        const response = {
          id: body.id,
          result
        }
        setTimeout(
          () => socket.send(JSON.stringify(response)),
          Math.random() * 100 // randomize response order
        )
      })
    })

    const testWsManager = await connectionPromise

    // Create multiple RPC calls
    const rpcs: Promise<IChangeGroupPollResult>[] = []
    const TESTS = 100
    for (let i = 0; i < TESTS; i++) {
      rpcs.push(testWsManager.sendRpc('ChangeGroup.Poll', { Id: `${i}` }))
    }

    // Wait for all responses
    const responses = await Promise.all(rpcs)

    // Verify responses
    for (let i = 0; i < TESTS; i++) {
      expect(responses[i].Id).toEqual(`${i}`)
    }

    // Clean up
    testWsManager.close()
    testServer.stop()
  })

  test('should close the WebSocket connection', async () => {
    jest.spyOn(mockSocket, 'close')
    // Close the connection
    wsManager.close()

    expect(mockSocket.close).toHaveBeenCalled()
  })
})
