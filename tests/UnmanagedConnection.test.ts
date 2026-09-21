import { UnmanagedConnection } from '../src/connection/UnmanagedConnection'
import { WebSocket, Server } from 'mock-socket'
import { jest } from '@jest/globals'

const emptyLogger = {
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
}

const URL = 'ws://localhost:9300'

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

describe('UnmanagedConnection', () => {
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

  it('forwards message events from the caller-provided socket', async () => {
    const server = startServer()
    server.on('connection', (socket) => {
      pushEngineStatus(socket)
      socket.on('message', () => socket.send('pong'))
    })

    const connection = await UnmanagedConnection.createUnmanagedConnection(
      emptyLogger,
      new WebSocket(URL) as any,
      1000
    )
    const message = new Promise((resolve) => connection.on('message', resolve))
    connection.send('ping')

    await expect(message).resolves.toBe('pong')
    connection.close()
  })

  it('emits only a terminal closed (never disconnected/reconnected) when the socket drops', async () => {
    const server = startServer()
    server.on('connection', (socket) => pushEngineStatus(socket))
    const connection = await UnmanagedConnection.createUnmanagedConnection(
      emptyLogger,
      new WebSocket(URL) as any,
      1000
    )
    const disconnected = jest.fn()
    const reconnected = jest.fn()
    connection.on('disconnected', disconnected)
    connection.on('reconnected', reconnected)
    const closed = new Promise((resolve) => connection.on('closed', resolve))

    server.close()

    await expect(closed).resolves.toEqual(expect.any(String))
    expect(disconnected).not.toHaveBeenCalled()
    expect(reconnected).not.toHaveBeenCalled()
  })
})
