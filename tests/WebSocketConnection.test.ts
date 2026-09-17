import {
  WebSocketConnection,
  FatalConnectionError,
  ConnectionInitializationError
} from '../src/connection/WebSocketConnection'
import { WebSocket, Server } from 'mock-socket'
import { jest } from '@jest/globals'

const emptyLogger = {
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
}

const URL = 'ws://localhost:9200'

describe('WebSocketConnection', () => {
  let servers: Server[]

  beforeEach(() => {
    servers = []
    ;(global as any).WebSocket = WebSocket
  })

  afterEach(() => {
    servers.forEach((server) => {
      try {
        server.stop()
      } catch {
        /* already stopped */
      }
    })
  })

  const startServer = (): Server => {
    const server = new Server(URL)
    servers.push(server)
    return server
  }

  it('resolves once the socket is open', async () => {
    startServer()
    const connection = await WebSocketConnection.createWebSocketConnection(
      emptyLogger,
      new WebSocket(URL) as any,
      1000
    )
    expect(connection).toBeInstanceOf(WebSocketConnection)
    connection.close()
  })

  it('emits a message event carrying the raw payload, and send() writes to the socket', async () => {
    const server = startServer()
    server.on('connection', (socket) => {
      socket.on('message', () => socket.send('{"pong":true}'))
    })

    const connection = await WebSocketConnection.createWebSocketConnection(
      emptyLogger,
      new WebSocket(URL) as any,
      1000
    )
    const message = new Promise((resolve) => connection.on('message', resolve))
    connection.send('ping')

    await expect(message).resolves.toBe('{"pong":true}')
    connection.close()
  })

  it('emits closed when the socket drops', async () => {
    const server = startServer()
    const connection = await WebSocketConnection.createWebSocketConnection(
      emptyLogger,
      new WebSocket(URL) as any,
      1000
    )
    const closed = new Promise((resolve) => connection.on('closed', resolve))
    server.close()
    await expect(closed).resolves.toEqual(expect.any(String))
  })

  it('rejects with a timeout when the socket never opens', async () => {
    const stuckSocket = {
      readyState: 0,
      OPEN: 1,
      onopen: null,
      onerror: null,
      onclose: null,
      close: jest.fn(),
      send: jest.fn()
    }
    await expect(
      WebSocketConnection.createWebSocketConnection(
        emptyLogger,
        stuckSocket as any,
        30
      )
    ).rejects.toThrow(/timeout/)
  })

  it('rejects with a fatal, actionable error when the core certificate is untrusted', async () => {
    const socket: any = {
      readyState: 0,
      OPEN: 1,
      onopen: null,
      onerror: null,
      onclose: null,
      close: jest.fn(),
      send: jest.fn()
    }
    const pending = WebSocketConnection.createWebSocketConnection(
      emptyLogger,
      socket,
      1000
    )
    socket.onerror({
      error: {
        code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
        message: 'self-signed certificate'
      }
    })

    await expect(pending).rejects.toBeInstanceOf(FatalConnectionError)
    await expect(pending).rejects.toThrow(/self-signed certificate/i)
    await expect(pending).rejects.toThrow(/dispatcher/i)
  })

  it('rejects with the generic connect error for a non-certificate failure', async () => {
    const socket: any = {
      readyState: 0,
      OPEN: 1,
      onopen: null,
      onerror: null,
      onclose: null,
      close: jest.fn(),
      send: jest.fn()
    }
    const pending = WebSocketConnection.createWebSocketConnection(
      emptyLogger,
      socket,
      1000
    )
    socket.onerror({})

    await expect(pending).rejects.toBeInstanceOf(ConnectionInitializationError)
    await expect(pending).rejects.not.toBeInstanceOf(FatalConnectionError)
  })
})
