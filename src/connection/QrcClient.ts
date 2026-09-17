import type {
  IRpcResponse,
  IRpcRequest,
  IJsonRpcMessageTypeMap,
  IConnection,
  IQrcClientEvents,
  ILogger,
  IRpcError,
  IStartOptions
} from '../index.interface.js'
import { v4 as uuidv4 } from 'uuid'
import { EventEmitter } from '../event/EventEmitter.js'
import { ManagedConnection } from './ManagedConnection.js'
import { UnmanagedConnection } from './UnmanagedConnection.js'

/**
 * JSON-RPC client that owns the core connection: its factory builds and opens
 * the socket for the chosen mode, so callers above never touch the connection.
 * It reads the connection's `message` stream rather than a socket, so socket
 * swaps and reconnections are invisible here and never require re-subscription.
 */
export class QrcClient extends EventEmitter<IQrcClientEvents> {
  private pendingRpcs = new Map<
    string,
    {
      resolve: (
        result: ReturnType<IJsonRpcMessageTypeMap[keyof IJsonRpcMessageTypeMap]>
      ) => void
      reject: (error: IRpcError) => void
      cancel: (reason?: unknown) => void
    }
  >()

  // The client is constructed only after the connection is open.
  private connected = true

  private constructor(
    private readonly logger: ILogger,
    private readonly connection: IConnection,
    private readonly apiKey: string | undefined,
    private readonly timeout: number = 5000
  ) {
    super()
    this.connection.on('message', this.handleMessage)
    this.connection.on('disconnected', this.handleDisconnected)
    this.connection.on('reconnected', this.handleReconnected)
    this.connection.on('error', this.handleError)
    this.connection.on('closed', this.handleClosed)
  }

  // host → managed (QRWC owns the socket + reconnection); socket → unmanaged.
  // Resolves once the connection is open, so the returned client is ready to use.
  public static createQrcClient = async (
    logger: ILogger,
    options: IStartOptions
  ): Promise<QrcClient> => {
    const timeout = options.timeout ?? 5000
    return new QrcClient(
      logger,
      typeof options.host === 'string'
        ? await ManagedConnection.createManagedConnection(
            logger,
            options.host,
            options.dispatcher,
            timeout,
            options.reconnect
          )
        : await UnmanagedConnection.createUnmanagedConnection(
            logger,
            options.socket,
            timeout
          ),
      options.apiKey,
      timeout
    )
  }

  private handleMessage = (raw: string): void => {
    const message = JSON.parse(raw) as IRpcResponse | IRpcError
    if (message.id && this.pendingRpcs.has(message.id)) {
      this.logger.trace(message, 'RPC RESPONSE')
      if (isIRpcError(message)) {
        this.pendingRpcs.get(message.id)!.reject(message)
      }
      if (isIRpcResponse(message)) {
        this.pendingRpcs.get(message.id)!.resolve(message.result)
      }
    } else {
      this.logger.trace(message, 'ONMESSAGE')
      this.emit('message', message)
    }
  }

  // Cancel pending RPCs on a drop so callers reject now instead of waiting out
  // the timeout; they are never replayed after reconnect.
  private handleDisconnected = (reason: string): void => {
    this.connected = false
    this.cancelRpcs()
    this.pendingRpcs.clear()
    this.emit('disconnected', reason)
  }

  private handleReconnected = (): void => {
    this.connected = true
    this.emit('reconnected')
  }

  private handleError = (error: Error): void => {
    this.emit('error', error)
  }

  private handleClosed = (reason: string): void => {
    this.connected = false
    this.emit('closed', reason)
  }

  public send = (data: object): void => {
    const { apiKey: _, ...loggable } = data as Record<string, unknown>
    this.logger.trace(loggable, 'RPC SEND')
    this.connection.send(JSON.stringify(data))
  }

  public createJSONRPCMessage = <
    T extends keyof IJsonRpcMessageTypeMap,
    U extends Parameters<IJsonRpcMessageTypeMap[T]>[0]
  >(
    method: T,
    params: U,
    id: string
  ): IRpcRequest => {
    return {
      apiKey: this.apiKey,
      jsonrpc: '2.0',
      method,
      params,
      id
    } as const
  }

  // Rejects immediately (no queueing) when the connection is down.
  public sendRpc = async <
    T extends keyof IJsonRpcMessageTypeMap,
    U extends Parameters<IJsonRpcMessageTypeMap[T]>[0]
  >(
    method: T,
    params: U
  ): Promise<ReturnType<IJsonRpcMessageTypeMap[T]>> => {
    if (!this.connected) {
      throw new Error(`RPC rejected (${method}): connection is not open.`)
    }
    return new Promise<ReturnType<IJsonRpcMessageTypeMap[T]>>(
      (resolve, reject) => {
        const id = uuidv4()
        const request = this.createJSONRPCMessage(method, params, id)

        const resolveRpc = (
          result: ReturnType<
            IJsonRpcMessageTypeMap[keyof IJsonRpcMessageTypeMap]
          >
        ) => {
          clearTimeout(timeout)
          resolve(result as ReturnType<IJsonRpcMessageTypeMap[T]>)
          this.pendingRpcs.delete(id)
        }
        const rejectRpc = (error: IRpcError) => {
          clearTimeout(timeout)
          reject(
            new Error(
              `RPC Error (${method}, ${id}):\n${JSON.stringify(error.error, null, 2)}`
            )
          )
          this.pendingRpcs.delete(id)
        }
        const cancelRpc = (reason?: unknown) => {
          clearTimeout(timeout)
          reject(new Error(`RPC cancelled (${method}, ${id})\n${reason}`))
          this.pendingRpcs.delete(id)
        }
        this.pendingRpcs.set(id, {
          resolve: resolveRpc,
          reject: rejectRpc,
          cancel: cancelRpc
        })

        const timeoutRpc = () => {
          reject(new Error(`RPC timed out (${method}, ${id})`))
          this.pendingRpcs.delete(id)
        }
        const timeout = setTimeout(timeoutRpc, this.timeout)
        this.send(request)
      }
    )
  }

  private cancelRpcs = (): void => {
    for (const rpc of this.pendingRpcs.values()) {
      rpc.cancel()
    }
  }

  public close = (): void => {
    this.cancelRpcs()
    this.pendingRpcs.clear()
    this.removeAllListeners()
    this.connection.close()
    this.logger.debug('QrcClient closed.')
  }
}

const isIRpcError = (
  response: IRpcResponse | IRpcError
): response is IRpcError => {
  return !!(response as IRpcError).error
}

const isIRpcResponse = (
  response: IRpcResponse | IRpcError
): response is IRpcResponse => {
  return !!(response as IRpcResponse).result
}
