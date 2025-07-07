import type {
  IRpcResponse,
  IRpcRequest,
  IWebSocket,
  IJsonRpcMessageTypeMap,
  IWebSocketManagerEvents
} from '../index.interface.js'
import { v4 as uuidv4 } from 'uuid'
import { EventEmitter } from '../event/EventEmitter.js'

/**
 * Manages WebSocket communication with the Q-Sys core
 * using a Promise-based API for RPC calls
 */
export class WebSocketManager extends EventEmitter<IWebSocketManagerEvents> {
  // Maps RPC message IDs to their Promise resolvers
  private rpcResolvers = new Map<
    string,
    {
      resolve: (
        result: ReturnType<IJsonRpcMessageTypeMap[keyof IJsonRpcMessageTypeMap]>
      ) => void
      reject: () => void
      cancel: () => void
    }
  >()
  private constructor(
    private readonly socket: IWebSocket,
    private readonly timeout: number = 5000
  ) {
    super()

    // binding websocket methods
    this.socket.onerror = (event: Event) => {
      console.log('WebSocketManager: websocket error.')
      const error = new Error(`Socket error: ${JSON.stringify(event)}`)
      console.error(error)
    }
    this.socket.onmessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data) as IRpcResponse
      if (message.id && this.rpcResolvers.has(message.id)) {
        const resolve = this.rpcResolvers.get(message.id)!.resolve
        resolve(message.result)
      } else {
        // Only emit message events for unsolicited messages
        this.emit('message', message)
      }
    }
    this.socket.onclose = () => {
      console.log('WebSocketManager: websocket closed.')
      this.emit('disconnected', 'Websocket closed.')
    }
  }

  /**
   * Creates the WebSocketManager and waits for the websocket readyState to be OPEN
   *
   * @param socket - WebSocket instance
   * @param timeout - Timeout in milliseconds for websocket messages
   */
  public static async createWebSocketManager(
    socket: IWebSocket,
    timeout: number = 5000
  ) {
    // create the manager b4 waiting for the socket to be open so we can have the error listener!
    const webSocketManager = new WebSocketManager(socket, timeout)

    // we need to wait for the socket to be opened and ready before we can do anything
    if (socket.readyState === socket.CONNECTING) {
      await new Promise<void>((resolve, reject) => {
        const timeoutRef = setTimeout(
          () =>
            reject(
              'WebSocketManager: socket timed out during connection attempt.'
            ),
          timeout
        )
        socket.onopen = () => {
          clearTimeout(timeoutRef)
          resolve()
        }
      })
    }
    return webSocketManager
  }

  public send = (data: object): void => {
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

      const resolveRpc = (
        result: ReturnType<IJsonRpcMessageTypeMap[keyof IJsonRpcMessageTypeMap]>
      ) => {
        clearTimeout(timeout)
        resolve(result as ReturnType<IJsonRpcMessageTypeMap[T]>)
        this.rpcResolvers.delete(id)
      }
      const rejectRpc = () => {
        clearTimeout(timeout)
        reject(`${method} timeout: ${id}`)
        this.rpcResolvers.delete(id)
      }
      const cancelRpc = () => {
        clearTimeout(timeout)
        reject(`${method} cancelled: ${id}`)
        this.rpcResolvers.delete(id)
      }
      this.rpcResolvers.set(id, {
        resolve: resolveRpc,
        reject: rejectRpc,
        cancel: cancelRpc
      })

      const timeout = setTimeout(rejectRpc, this.timeout)
      this.send(this.createJSONRPCMessage(method, params, id))
    })

  public close(): void {
    for (const rpc of this.rpcResolvers.values()) {
      rpc.cancel()
    }
    this.rpcResolvers.clear()
    this.removeAllListeners()
    this.socket?.close()
  }
}
