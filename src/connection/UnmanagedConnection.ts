import type {
  IConnection,
  IConnectionEvents,
  IEngineStatus,
  ILogger,
  IWebSocket
} from '../index.interface.js'
import { EventEmitter } from '../event/EventEmitter.js'
import { WebSocketConnection } from './WebSocketConnection.js'

/**
 * Connection strategy for a caller-provided socket. Opens once and fails fast;
 * a dropped socket is never retried (the caller owns reconnection), so it
 * emits only the terminal `closed` event, never `disconnected`.
 */
export class UnmanagedConnection
  extends EventEmitter<IConnectionEvents>
  implements IConnection
{
  private constructor(private readonly socket: WebSocketConnection) {
    super()
    socket.on('message', (raw) => this.emit('message', raw))
    socket.on('error', (error) => this.emit('error', error))
    socket.on('closed', (reason) => this.emit('closed', reason))
    socket.on('engineStatus', (status) => this.emit('engineStatus', status))
  }

  public get engineStatus(): IEngineStatus {
    return this.socket.engineStatus
  }

  public static createUnmanagedConnection = async (
    logger: ILogger,
    socket: IWebSocket,
    timeout: number,
    apiKey?: string
  ) => {
    return new UnmanagedConnection(
      await WebSocketConnection.createWebSocketConnection(
        logger,
        socket,
        timeout,
        apiKey
      )
    )
  }

  public send = (data: string): void => {
    this.socket.send(data)
  }

  public close = (): void => {
    this.socket.close()
    this.removeAllListeners()
  }
}
