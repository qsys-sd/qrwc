import {
  ManagedConnection,
  createCoreSocket
} from '../src/connection/ManagedConnection'
import { WebSocket, Server } from 'mock-socket'
import { jest } from '@jest/globals'

const emptyLogger = {
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
}

const HOST = 'localhost'
// createCoreSocket builds wss://<host>/qrc-public-api/v0 in managed mode.
const URL = 'wss://localhost/qrc-public-api/v0'

// Readiness gates on the core's unsolicited EngineStatus push, so mock cores
// must send one when a client connects.
const pushEngineStatus = (socket: { send: (data: string) => void }) =>
  socket.send(
    JSON.stringify({
      jsonrpc: '2.0',
      method: 'EngineStatus',
      params: {
        State: 'Active',
        DesignName: 'test design',
        DesignCode: '1',
        IsRedundant: false,
        IsEmulator: false
      }
    })
  )

const fastReconnect = {
  delay: 20,
  maxDelay: 20,
  backoffFactor: 1,
  maxAttempts: 20
}

const nextEvent = (
  emitter: { on: (event: any, listener: any) => void },
  event: string,
  timeoutMs = 3000
): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out waiting for '${event}'`)),
      timeoutMs
    )
    emitter.on(event, (arg: unknown) => {
      clearTimeout(timer)
      resolve(arg)
    })
  })

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('ManagedConnection', () => {
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

  it('connects to the core public-API endpoint and sends over it', async () => {
    const received: string[] = []
    const server = startServer()
    server.on('connection', (socket) => {
      pushEngineStatus(socket)
      socket.on('message', (message) => received.push(message as string))
    })

    const connection = await ManagedConnection.createManagedConnection(
      emptyLogger,
      HOST,
      undefined,
      1000,
      undefined,
      fastReconnect
    )
    connection.send('hello')
    await wait(30)

    expect(received).toContain('hello')
    connection.close()
  })

  it('recovers from a drop: disconnected then reconnected, and send works again', async () => {
    const server = startServer()
    server.on('connection', (socket) => pushEngineStatus(socket))
    const connection = await ManagedConnection.createManagedConnection(
      emptyLogger,
      HOST,
      undefined,
      1000,
      undefined,
      fastReconnect
    )

    const disconnected = jest.fn()
    connection.on('disconnected', disconnected)
    const reconnected = nextEvent(connection, 'reconnected')

    // Drop the client and free the URL, then stand a fresh server back up.
    server.close()
    const received: string[] = []
    const server2 = startServer()
    server2.on('connection', (socket) => {
      pushEngineStatus(socket)
      socket.on('message', (message) => received.push(message as string))
    })

    await reconnected
    expect(disconnected).toHaveBeenCalled()

    connection.send('after-reconnect')
    await wait(30)
    expect(received).toContain('after-reconnect')
    connection.close()
  })

  it('emits a terminal closed once reconnection is exhausted', async () => {
    const server = startServer()
    server.on('connection', (socket) => pushEngineStatus(socket))
    const connection = await ManagedConnection.createManagedConnection(
      emptyLogger,
      HOST,
      undefined,
      100,
      undefined,
      { delay: 5, maxDelay: 5, backoffFactor: 1, maxAttempts: 2 }
    )
    const closed = nextEvent(connection, 'closed')

    // Drop and never restore the server -> retries exhaust.
    server.close()

    await expect(closed).resolves.toBe('reconnection failed')
    connection.close()
  })

  it('close() during a reconnect stops further recovery', async () => {
    const server = startServer()
    server.on('connection', (socket) => pushEngineStatus(socket))
    const connection = await ManagedConnection.createManagedConnection(
      emptyLogger,
      HOST,
      undefined,
      1000,
      undefined,
      { delay: 50, maxDelay: 50, backoffFactor: 1, maxAttempts: 20 }
    )
    const reconnected = jest.fn()
    connection.on('reconnected', reconnected)
    const disconnected = nextEvent(connection, 'disconnected')

    server.close()
    await disconnected

    // Abort mid-recovery, then bring the core back; no reconnect should fire.
    connection.close()
    const server2 = startServer()
    server2.on('connection', () => undefined)
    await wait(200)

    expect(reconnected).not.toHaveBeenCalled()
  })
})

describe('createCoreSocket', () => {
  const originalWebSocket = global.WebSocket
  let captured: { url: string; options?: unknown }[]

  beforeEach(() => {
    captured = []
    class CapturingWebSocket {
      static readonly OPEN = 1
      public readyState = 1
      constructor(url: string, options?: unknown) {
        captured.push({ url, options })
      }
      close() {}
      send() {}
    }
    ;(global as any).WebSocket = CapturingWebSocket
  })

  afterEach(() => {
    ;(global as any).WebSocket = originalWebSocket
  })

  it('defaults to wss:// and appends the core API path', () => {
    createCoreSocket('192.168.1.100')
    expect(captured[0].url).toBe('wss://192.168.1.100/qrc-public-api/v0')
  })

  it('honors an explicit ws:// scheme (for cores that cannot terminate TLS)', () => {
    createCoreSocket('ws://192.168.1.100')
    expect(captured[0].url).toBe('ws://192.168.1.100/qrc-public-api/v0')
  })

  it('honors an explicit wss:// scheme case-insensitively and keeps the port', () => {
    createCoreSocket('WSS://core.example.com:1234')
    expect(captured[0].url).toBe(
      'wss://core.example.com:1234/qrc-public-api/v0'
    )
  })

  it('forwards a dispatcher as the 2nd-arg options bag when provided', () => {
    const dispatcher = { agent: 'undici' }
    createCoreSocket('192.168.1.100', dispatcher)
    expect(captured[0].options).toEqual({ dispatcher })
  })

  it('omits the options bag entirely when no dispatcher is provided', () => {
    createCoreSocket('192.168.1.100')
    expect(captured[0].options).toBeUndefined()
  })
})
