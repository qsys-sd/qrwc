import { QrcClient } from '../src/connection/QrcClient'
import { EventEmitter } from '../src/event/EventEmitter'
import type { IConnectionEvents } from '../src/index.interface'
import { jest } from '@jest/globals'

const emptyLogger = {
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
}

// A stand-in for IConnection: a real EventEmitter (so we can drive the lifecycle
// events QrcClient subscribes to) plus spyable send/close.
class FakeConnection extends EventEmitter<IConnectionEvents> {
  public send = jest.fn<(data: string) => void>()
  public close = jest.fn<() => void>()
}

// QrcClient's constructor is private; the factory builds a real socket, so
// construct it directly against a fake connection for isolation.
const createClient = (connection: FakeConnection, timeout = 5000): QrcClient =>
  new (QrcClient as any)(emptyLogger, connection, 'test-api-key', timeout)

const lastRequest = (connection: FakeConnection) =>
  JSON.parse(connection.send.mock.calls.at(-1)![0] as string)

const respond = (connection: FakeConnection, id: string, result: unknown) =>
  connection.emit('message', JSON.stringify({ jsonrpc: '2.0', id, result }))

describe('QrcClient', () => {
  it('injects the apiKey and builds a well-formed JSON-RPC request', () => {
    const connection = new FakeConnection()
    const client = createClient(connection)

    client.sendRpc('StatusGet', undefined).catch(() => undefined)

    const request = lastRequest(connection)
    expect(request.apiKey).toBe('test-api-key')
    expect(request.method).toBe('StatusGet')
    expect(request.jsonrpc).toBe('2.0')
    expect(request.id).toEqual(expect.any(String))

    client.close()
  })

  it('correlates concurrent responses to the right caller by id', async () => {
    const connection = new FakeConnection()
    const client = createClient(connection)

    const pending = Array.from({ length: 5 }, (_, i) =>
      client.sendRpc('ChangeGroup.Poll', { Id: `${i}` })
    )
    const requests = connection.send.mock.calls.map((call) =>
      JSON.parse(call[0] as string)
    )

    // respond out of order to prove correlation is by id, not arrival order
    for (let i = requests.length - 1; i >= 0; i--) {
      respond(connection, requests[i].id, {
        Id: requests[i].params.Id,
        Changes: []
      })
    }

    const results = await Promise.all(pending)
    results.forEach((result, i) => expect(result.Id).toBe(`${i}`))
  })

  it('rejects when the core returns a JSON-RPC error', async () => {
    const connection = new FakeConnection()
    const client = createClient(connection)

    const pending = client.sendRpc('StatusGet', undefined)
    const { id } = lastRequest(connection)
    connection.emit(
      'message',
      JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: { code: 5, message: 'nope' }
      })
    )

    await expect(pending).rejects.toThrow('RPC Error')
  })

  it('rejects with a timeout when no response arrives', async () => {
    const connection = new FakeConnection()
    const client = createClient(connection, 30)

    await expect(client.sendRpc('StatusGet', undefined)).rejects.toThrow(
      /timed out/
    )
  })

  it('emits unsolicited (non-response) messages', () => {
    const connection = new FakeConnection()
    const client = createClient(connection)
    const listener = jest.fn()
    client.on('message', listener)

    const unsolicited = { jsonrpc: '2.0', method: 'EngineStatus', params: {} }
    connection.emit('message', JSON.stringify(unsolicited))

    expect(listener).toHaveBeenCalledWith(unsolicited)
    client.close()
  })

  it('cancels pending RPCs on disconnect and then rejects new ones fast', async () => {
    const connection = new FakeConnection()
    const client = createClient(connection)

    const inFlight = client.sendRpc('StatusGet', undefined)
    connection.emit('disconnected', 'dropped')

    await expect(inFlight).rejects.toThrow(/cancelled/)
    // while down, a new RPC rejects immediately instead of queueing
    await expect(client.sendRpc('StatusGet', undefined)).rejects.toThrow(
      /connection is not open/
    )
  })

  it('re-emits connection lifecycle events to consumers', () => {
    const connection = new FakeConnection()
    const client = createClient(connection)
    const disconnected = jest.fn()
    const reconnected = jest.fn()
    const closed = jest.fn()
    const error = jest.fn()
    client.on('disconnected', disconnected)
    client.on('reconnected', reconnected)
    client.on('closed', closed)
    client.on('error', error)

    const err = new Error('boom')
    connection.emit('disconnected', 'drop')
    connection.emit('reconnected')
    connection.emit('error', err)
    connection.emit('closed', 'terminal')

    expect(disconnected).toHaveBeenCalledWith('drop')
    expect(reconnected).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(err)
    expect(closed).toHaveBeenCalledWith('terminal')
  })

  it('close() cancels pending RPCs and closes the connection', async () => {
    const connection = new FakeConnection()
    const client = createClient(connection)

    const inFlight = client.sendRpc('StatusGet', undefined)
    client.close()

    await expect(inFlight).rejects.toThrow(/cancelled/)
    expect(connection.close).toHaveBeenCalled()
  })
})
