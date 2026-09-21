import type {
  IConnectionEvents,
  IEngineStatus,
  ILogger,
  IWebSocket
} from '../index.interface.js'
import { QrwcDefaultHeartbeatInterval } from '../constants/index.js'
import { EventEmitter } from '../event/EventEmitter.js'

const HeartbeatId = 'qrwc-heartbeat'

// `disconnected`/`reconnected` are supervision concerns owned by IConnection,
// not a single socket, so they are excluded here.
type IWebSocketConnectionEvents = Pick<
  IConnectionEvents,
  'message' | 'error' | 'closed' | 'engineStatus'
>

/**
 * A failure to bring a socket up (open error, timeout, or an early close).
 */
export class ConnectionInitializationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ConnectionInitializationError'
  }
}

// Pulls a human-readable cause off a WebSocket `error` event without assuming a
// concrete event shape (DOM Event vs. undici/ws ErrorEvent differ).
function readErrorMessage(event: unknown): string | undefined {
  const source = (event ?? {}) as {
    message?: unknown
    error?: { message?: unknown }
  }
  const rawMessage = source.error?.message ?? source.message
  return typeof rawMessage === 'string' ? rawMessage : undefined
}

export class WebSocketConnection extends EventEmitter<IWebSocketConnectionEvents> {
  private _engineStatus: IEngineStatus = { State: 'Disconnected' }
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private awaitingHeartbeat = false
  private ready = false

  private constructor(
    private readonly logger: ILogger,
    private readonly socket: IWebSocket,
    private readonly apiKey: string | undefined,
    private readonly heartbeatInterval: number
  ) {
    super()

    this.socket.onmessage = (event: MessageEvent) => {
      const raw = event.data as string
      // Any inbound frame proves the socket is still two-way.
      this.awaitingHeartbeat = false
      if (raw.includes(HeartbeatId)) {
        try {
          if ((JSON.parse(raw) as { id?: string }).id === HeartbeatId) return
        } catch {
          // not our probe reply; fall through to normal handling
        }
      }
      if (raw.includes('EngineStatus')) {
        try {
          const message = JSON.parse(raw) as {
            method?: string
            params?: IEngineStatus
          }
          if (message.method === 'EngineStatus' && message.params) {
            const status = message.params
            this.ready = true
            this.logger.trace(status, 'ENGINE STATUS')
            this._engineStatus = status
            this.emit('engineStatus', status)
          } else {
            this.emit('message', raw)
          }
        } catch {
          this.emit('message', raw)
        }
      } else {
        this.emit('message', raw)
      }
    }
    this.socket.onerror = (event: Event) => {
      const message = readErrorMessage(event)
      const error = new Error(`WebSocket error: ${message ?? 'unknown cause'}`)
      this.logger.error(error, 'WebSocket error.')
      this.emit('error', error)
    }
    this.socket.onclose = (event: CloseEvent) => {
      this.stopHeartbeat()
      this.logger.debug(`WebSocket disconnected. ${event.reason}`)
      this.emit(
        'closed',
        event.reason || 'WebSocket connection closed by Q-SYS core.'
      )
    }

    // A half-open socket (e.g. a yanked cable) never fires `onclose`, so we probe
    // with a NoOp each interval; a probe still unanswered at the next tick means
    // the link is dead.
    this.heartbeatTimer = setInterval(() => {
      if (!this.ready) return
      if (this.awaitingHeartbeat) {
        this.stopHeartbeat()
        this.detachHandlers()
        this.socket.close()
        this.emit('closed', 'Connection unresponsive (heartbeat timed out).')
        return
      }
      this.awaitingHeartbeat = true
      this.socket.send(
        JSON.stringify({
          apiKey: this.apiKey,
          jsonrpc: '2.0',
          method: 'NoOp',
          params: {},
          id: HeartbeatId
        })
      )
    }, this.heartbeatInterval)
  }

  public get engineStatus(): IEngineStatus {
    return this._engineStatus
  }

  public static createWebSocketConnection = async (
    logger: ILogger,
    socket: IWebSocket,
    timeout: number,
    apiKey?: string,
    heartbeatInterval: number = QrwcDefaultHeartbeatInterval
  ): Promise<WebSocketConnection> => {
    const connection = new WebSocketConnection(
      logger,
      socket,
      apiKey,
      heartbeatInterval
    )

    return new Promise<WebSocketConnection>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer)
        connection.removeAllListeners()
      }

      const timer = setTimeout(() => {
        cleanup()
        connection.close()
        reject(
          new ConnectionInitializationError(
            'WebSocket failed to connect (timeout). Check Q-SYS core IP address or wait and retry.'
          )
        )
      }, timeout)
      /*
        When the core is shutting down or booting up, QRC will open and then
        immediately close the websocket connection, so we also need to verify
        QRC is ACTUALLY ready and throw an informative error if it is not. We
        can do this by listening for an initial EngineStatus message.
      */
      connection.on('engineStatus', () => {
        cleanup()
        resolve(connection)
      })
      connection.on('error', () => {
        cleanup()
        connection.close()
        reject(
          new ConnectionInitializationError(
            'WebSocket failed to connect (error). Check Q-SYS core IP address or wait and retry.'
          )
        )
      })
      connection.on('closed', () => {
        cleanup()
        connection.close()
        reject(
          new ConnectionInitializationError(
            'WebSocket failed to connect (connection closed by Q-SYS core). Wait and retry.'
          )
        )
      })
    })
  }

  public send = (data: string): void => {
    this.socket.send(data)
  }

  public close = (): void => {
    this.stopHeartbeat()
    this.detachHandlers()
    this.socket.close()
  }

  private detachHandlers = (): void => {
    this.socket.onmessage = null
    this.socket.onerror = null
    this.socket.onclose = null
  }

  private stopHeartbeat = (): void => {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}
