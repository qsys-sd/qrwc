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
      const error = new Error(`WebSocket error: ${JSON.stringify(event)}`)
      this.emit('error', error)
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
    socket: IWebSocket,
    timeout: number = 5000
  ) {
    // we need to wait for the socket to be opened and ready before we can do anything
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

    const webSocketManager = new WebSocketManager(socket, timeout)

    /*
      When the core is shutting down or booting up, QRC will open and then
      immediately close the websocket connection, so we also need to verify
      QRC is ACTUALLY ready and throw an informative error if it is not. We
      can do this by making a quick one-off RPC call.
    */
    try {
      const _status = await webSocketManager.sendRpc('StatusGet', undefined)
    } catch (_error) {
      throw new Error(
        'QRC initial status check failed. Q-SYS core might be shutting down or booting up. Wait and retry.'
      )
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

  private cancelRpcs(): void {
    for (const rpc of this.rpcResolvers.values()) {
      rpc.cancel()
    }
  }

  public close(): void {
    this.cancelRpcs()
    this.rpcResolvers.clear()
    this.removeAllListeners()
    this.socket?.close()
  }
}
