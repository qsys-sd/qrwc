import {
  WebSocketConnection,
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

const ENGINE_STATUS = {
  State: 'Active',
  DesignName: 'test design',
  DesignCode: '1',
  IsRedundant: false,
  IsEmulator: false
}

// Readiness gates on the core's unsolicited EngineStatus push, so mock cores
// must send one when a client connects.
const pushEngineStatus = (
  socket: { send: (data: string) => void },
  params: object = ENGINE_STATUS
) =>
  socket.send(
    JSON.stringify({ jsonrpc: '2.0', method: 'EngineStatus', params })
  )

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

  it('resolves once the core reports EngineStatus, and caches it', async () => {
    const server = startServer()
    server.on('connection', (socket) => pushEngineStatus(socket))
    const connection = await WebSocketConnection.createWebSocketConnection(
      emptyLogger,
      new WebSocket(URL) as any,
      1000
    )
    expect(connection).toBeInstanceOf(WebSocketConnection)
    expect(connection.engineStatus?.DesignName).toBe('test design')
    connection.close()
  })

  it('emits engineStatus on subsequent pushes after it is ready', async () => {
    const server = startServer()
    let coreSocket: any
    server.on('connection', (socket) => {
      coreSocket = socket
      pushEngineStatus(socket)
    })
    const connection = await WebSocketConnection.createWebSocketConnection(
      emptyLogger,
      new WebSocket(URL) as any,
      1000
    )
    const next = new Promise((resolve) =>
      connection.on('engineStatus', resolve)
    )
    pushEngineStatus(coreSocket, { ...ENGINE_STATUS, State: 'Standby' })

    await expect(next).resolves.toMatchObject({ State: 'Standby' })
    expect(connection.engineStatus?.State).toBe('Standby')
    connection.close()
  })

  it('emits a message event carrying the raw payload, and send() writes to the socket', async () => {
    const server = startServer()
    server.on('connection', (socket) => {
      pushEngineStatus(socket)
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
    server.on('connection', (socket) => pushEngineStatus(socket))
    const connection = await WebSocketConnection.createWebSocketConnection(
      emptyLogger,
      new WebSocket(URL) as any,
      1000
    )
    const closed = new Promise((resolve) => connection.on('closed', resolve))
    server.close()
    await expect(closed).resolves.toEqual(expect.any(String))
  })

  const withNoOpEcho = (server: Server) =>
    server.on('connection', (socket) => {
      pushEngineStatus(socket)
      socket.on('message', (raw) => {
        const message = JSON.parse(raw as string)
        if (message.method === 'NoOp') {
          socket.send(
            JSON.stringify({ jsonrpc: '2.0', result: true, id: message.id })
          )
        }
      })
    })

  it('probes with an authenticated NoOp and stays open while the core answers', async () => {
    const received: string[] = []
    const server = startServer()
    server.on('connection', (socket) => {
      pushEngineStatus(socket)
      socket.on('message', (raw) => {
        received.push(raw as string)
        const message = JSON.parse(raw as string)
        if (message.method === 'NoOp') {
          socket.send(
            JSON.stringify({ jsonrpc: '2.0', result: true, id: message.id })
          )
        }
      })
    })
    const connection = await WebSocketConnection.createWebSocketConnection(
      emptyLogger,
      new WebSocket(URL) as any,
      1000,
      'secret-key',
      40
    )
    const closed = jest.fn()
    connection.on('closed', closed)

    await new Promise((resolve) => setTimeout(resolve, 150))

    const noop = received
      .map((raw) => JSON.parse(raw))
      .find((message) => message.method === 'NoOp')
    expect(noop).toMatchObject({ method: 'NoOp', apiKey: 'secret-key' })
    expect(closed).not.toHaveBeenCalled()
    connection.close()
  })

  it('emits closed when a heartbeat goes unanswered', async () => {
    const server = startServer()
    // The core ignores the NoOp, mimicking a half-open (unresponsive) socket.
    server.on('connection', (socket) => pushEngineStatus(socket))
    const connection = await WebSocketConnection.createWebSocketConnection(
      emptyLogger,
      new WebSocket(URL) as any,
      1000,
      undefined,
      40
    )
    const closed = new Promise((resolve) => connection.on('closed', resolve))
    await expect(closed).resolves.toMatch(/unresponsive/)
  })

  it('swallows the heartbeat reply instead of surfacing it as a message', async () => {
    const server = startServer()
    withNoOpEcho(server)
    const connection = await WebSocketConnection.createWebSocketConnection(
      emptyLogger,
      new WebSocket(URL) as any,
      1000,
      'secret-key',
      40
    )
    const message = jest.fn()
    connection.on('message', message)

    await new Promise((resolve) => setTimeout(resolve, 150))

    expect(message).not.toHaveBeenCalled()
    connection.close()
  })

  it('does not probe until the core is ready (waits for EngineStatus)', async () => {
    // The socket is open, but QRC drops the connection if it receives anything
    // before its first EngineStatus, so the heartbeat must hold off.
    const socket: any = {
      readyState: 1,
      onmessage: null,
      onerror: null,
      onclose: null,
      close: jest.fn(),
      send: jest.fn()
    }
    // Bypass the factory (which itself waits for EngineStatus) to drive readiness.
    const connection = new (WebSocketConnection as any)(
      emptyLogger,
      socket,
      'key',
      30
    )

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(socket.send).not.toHaveBeenCalled()

    socket.onmessage({
      data: JSON.stringify({
        jsonrpc: '2.0',
        method: 'EngineStatus',
        params: ENGINE_STATUS
      })
    })

    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(socket.send).toHaveBeenCalled()
    connection.close()
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
  })
})
