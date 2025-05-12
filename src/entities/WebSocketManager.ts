import type {
  IRpcResponse,
  IRpcRequest,
  IWebSocket,
  IJsonRpcMessageTypeMap,
  IWebSocketManagerEvents
} from '../index.interface'
import { v4 as uuidv4 } from 'uuid'
import { EventEmitter } from '../event/EventEmitter'

/**
 * Manages WebSocket communication with the Q-Sys core
 * using a Promise-based API for RPC calls
 */
export class WebSocketManager extends EventEmitter<IWebSocketManagerEvents> {
  // Maps RPC message IDs to their Promise resolvers
  private rpcResolvers = new Map<
    string,
    (
      result: ReturnType<IJsonRpcMessageTypeMap[keyof IJsonRpcMessageTypeMap]>
    ) => void
  >()
  constructor(
    private readonly socket: IWebSocket,
    private readonly timeout: number = 5000
  ) {
    super()

    // binding websocket methods
    this.socket.onmessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data) as IRpcResponse
      if (message.id && this.rpcResolvers.has(message.id)) {
        const resolve = this.rpcResolvers.get(message.id)!
        resolve(message.result)
      } else {
        // Only emit message events for unsolicited messages
        this.emit('message', message)
      }
    }
    this.socket.onerror = (event: Event) => {
      const error = new Error(`Socket error: ${JSON.stringify(event)}`)
      console.error(error)
      this.emit('error', error)
      this.emit('disconnected', 'Websocket error.')
    }
    this.socket.onclose = () => {
      this.emit('disconnected', 'Websocket closed.')
    }
  }

  private isOpen = () => {
    return this.socket.readyState === this.socket.OPEN
  }

  public send = (data: object): void => {
    if (this.socket !== null && this.isOpen()) {
      this.socket.send(JSON.stringify(data))
    } else {
      const error = new Error('QRWC: WebSocket is not open or not initialized.')
      console.error(error)
      this.emit('error', error)
    }
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
      const timeoutRef = setTimeout(() => {
        reject(`${method} timeout: ${id}`)
        this.rpcResolvers.delete(id)
      }, this.timeout)
      this.rpcResolvers.set(id, (result) => {
        clearTimeout(timeoutRef)
        resolve(result as ReturnType<IJsonRpcMessageTypeMap[T]>)
        this.rpcResolvers.delete(id)
      })
      this.send(this.createJSONRPCMessage(method, params, id))
    })

  public close(): void {
    this.rpcResolvers.clear()
    this.removeAllListeners()
    this.socket?.close()
  }
}
