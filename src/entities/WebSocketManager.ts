import type {
  IRpcResponse,
  IRpcRequest,
  IWebSocket,
  IJsonRpcMessageTypeMap,
  IWebSocketManagerEvents,
  ILogger,
  IRpcError
} from '../index.interface.js'
import { v4 as uuidv4 } from 'uuid'
import { EventEmitter } from '../event/EventEmitter.js'

/**
 * Manages WebSocket communication with the Q-Sys core
 * using a Promise-based API for RPC calls
 */
export class WebSocketManager extends EventEmitter<IWebSocketManagerEvents> {
  // Maps RPC message IDs to their Promise resolvers
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

  private constructor(
    private readonly logger: ILogger,
    private readonly socket: IWebSocket,
    private readonly timeout: number = 5000
  ) {
    super()

    // binding websocket methods
    this.socket.onerror = (event: Event) => {
      const error = new Error(`WebSocket error: ${JSON.stringify(event)}`)
      this.logger.error(error, 'WebSocket error.')
      this.emit('error', error)
    }

    this.socket.onmessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data) as IRpcResponse | IRpcError
      if (message.id && this.pendingRpcs.has(message.id)) {
        this.logger.trace(message, 'RPC RESPONSE')
        if (isIRpcError(message)) {
          const reject = this.pendingRpcs.get(message.id)!.reject
          reject(message)
        }
        if (isIRpcResponse(message)) {
          const resolve = this.pendingRpcs.get(message.id)!.resolve
          resolve(message.result)
        }
      } else {
        this.logger.trace(message, 'ONMESSAGE')
        // Only emit message events for unsolicited messages
        this.emit('message', message)
      }
    }
    this.socket.onclose = (event: CloseEvent) => {
      this.logger.debug(`WebSocket disconnected. ${event.reason}`)
      this.emit('disconnected', 'WebSocket connection closed by Q-SYS core.')
    }
  }

  /**
   * Creates the WebSocketManager and waits for the websocket readyState to be OPEN
   *
   * @param socket - WebSocket instance
   * @param timeout - Timeout in milliseconds for websocket messages
   */
  public static async createWebSocketManager(
    logger: ILogger,
    socket: IWebSocket,
    timeout: number = 5000
  ) {
    // we need to wait for the socket to be opened and ready before we can do anything
    logger.info('Connecting to QRC...')
    if (socket.readyState !== socket.OPEN) {
      await new Promise<void>((resolve, reject) => {
        const timeoutRef = setTimeout(
          () =>
            reject(
              new Error(
                'WebSocket failed to connect (timeout). Check Q-SYS core IP address or wait and retry.'
              )
            ),
          timeout
        )
        // temporary socket listeners just for startup process
        socket.onerror = () => {
          clearTimeout(timeoutRef)
          reject(
            new Error(
              'WebSocket failed to connect (error). Check Q-SYS core IP address or wait and retry.'
            )
          )
        }
        socket.onclose = () => {
          clearTimeout(timeoutRef)
          reject(
            new Error(
              'WebSocket failed to connect (connection closed by Q-SYS core). Wait and retry.'
            )
          )
        }
        socket.onopen = () => {
          clearTimeout(timeoutRef)
          resolve()
        }
      })
    }

    return new WebSocketManager(logger, socket, timeout)
  }

  public send = (data: object): void => {
    this.logger.trace(data, 'RPC SEND')
    this.socket.send(JSON.stringify(data))
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
      jsonrpc: '2.0',
      method,
      params,
      id
    } as const
  }

  /**
   * Sends a JSON-RPC message and returns a Promise for the result
   */
  public sendRpc = async <
    T extends keyof IJsonRpcMessageTypeMap,
    U extends Parameters<IJsonRpcMessageTypeMap[T]>[0]
  >(
    method: T,
    params: U
  ): Promise<ReturnType<IJsonRpcMessageTypeMap[T]>> =>
    new Promise<ReturnType<IJsonRpcMessageTypeMap[T]>>((resolve, reject) => {
      const id = uuidv4()
      const request = this.createJSONRPCMessage(method, params, id)

      const resolveRpc = (
        result: ReturnType<IJsonRpcMessageTypeMap[keyof IJsonRpcMessageTypeMap]>
      ) => {
        clearTimeout(timeout)
        resolve(result as ReturnType<IJsonRpcMessageTypeMap[T]>)
        this.pendingRpcs.delete(id)
      }
      const rejectRpc = (error: IRpcError) => {
        clearTimeout(timeout)
        reject(
          `RPC Error (${method}, ${id}):\n${JSON.stringify(error.error, null, 2)}`
        )
        this.pendingRpcs.delete(id)
      }
      const cancelRpc = (reason?: unknown) => {
        clearTimeout(timeout)
        reject(`RPC cancelled (${method}, ${id})\n${reason}`)
        this.pendingRpcs.delete(id)
      }
      this.pendingRpcs.set(id, {
        resolve: resolveRpc,
        reject: rejectRpc,
        cancel: cancelRpc
      })

      const timeoutRpc = () => {
        reject(`RPC timed out (${method}, ${id})`)
        this.pendingRpcs.delete(id)
      }
      const timeout = setTimeout(timeoutRpc, this.timeout)
      this.send(request)
    })

  private cancelRpcs(): void {
    for (const rpc of this.pendingRpcs.values()) {
      rpc.cancel()
    }
  }

  public close(): void {
    this.cancelRpcs()
    this.pendingRpcs.clear()
    this.removeAllListeners()
    this.socket?.close()
    this.logger.debug('WebSocketManager closed.')
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
