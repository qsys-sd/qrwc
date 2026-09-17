import type {
  IConnection,
  IConnectionEvents,
  ILogger,
  IReconnectOptions,
  IWebSocket
} from '../index.interface.js'
import { QrwcCoreApiPath, QrwcDefaultReconnect } from '../constants/index.js'
import { EventEmitter } from '../event/EventEmitter.js'
import {
  FatalConnectionError,
  WebSocketConnection
} from './WebSocketConnection.js'

// Defaults to wss://, but honors an explicit ws:// for cores that can't terminate TLS.
export function createCoreSocket(
  host: string,
  dispatcher?: unknown
): IWebSocket {
  const schemeMatch = /^(wss?):\/\//i.exec(host)
  const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : 'wss'
  const domain = schemeMatch ? host.slice(schemeMatch[0].length) : host
  const url = `${scheme}://${domain}${QrwcCoreApiPath}`
  // Node/undici accepts an options bag as the 2nd arg, which the DOM `protocols` type omits.
  return dispatcher
    ? new WebSocket(url, { dispatcher } as unknown as string)
    : new WebSocket(url)
}

/**
 * Owns socket resilience: on a drop it rebuilds the socket and swaps the live
 * transport in place so QrcClient never sees the swap. Emits `disconnected`
 * then `reconnected` on recovery, or a terminal `closed` once backoff gives up.
 */
export class ManagedConnection
  extends EventEmitter<IConnectionEvents>
  implements IConnection
{
  private transport: WebSocketConnection | null = null
  private cancelBackoff: (() => void) | null = null
  private closed = false
  private readonly reconnectConfig: Required<IReconnectOptions>

  private constructor(
    private readonly logger: ILogger,
    private readonly host: string,
    private readonly dispatcher: unknown,
    private readonly timeout: number,
    reconnect?: IReconnectOptions
  ) {
    super()
    this.reconnectConfig = {
      ...QrwcDefaultReconnect,
      ...(reconnect ?? {})
    }
  }

  public static createManagedConnection = async (
    logger: ILogger,
    host: string,
    dispatcher: unknown,
    timeout: number,
    reconnect?: IReconnectOptions
  ) => {
    const connection = new ManagedConnection(
      logger,
      host,
      dispatcher,
      timeout,
      reconnect
    )
    await connection.connect()
    return connection
  }

  private connect = async (): Promise<void> => {
    // Detach the previous transport first so its trailing close event cannot
    // re-enter the reconnect loop.
    if (this.transport) {
      this.transport.removeAllListeners()
      this.transport.close()
      this.transport = null
    }

    const transport = await this.openWithRetry()
    this.cancelBackoff = null
    // close() may have landed while the last socket was opening; don't leak it.
    if (this.closed) {
      transport.close()
      return
    }

    transport.on('message', (raw) => this.emit('message', raw))
    transport.on('error', (error) => this.emit('error', error))
    transport.on('closed', (reason) => {
      this.emit('disconnected', reason)
      this.reconnect()
    })
    this.transport = transport
  }

  // Retry-with-backoff loop for both the initial connect and post-drop recovery;
  // throws once maxAttempts is exhausted or close() intervenes.
  private openWithRetry = async (): Promise<WebSocketConnection> => {
    for (let attempt = 0; ; attempt++) {
      if (this.closed) {
        throw new Error('Connection closed.')
      }
      const socket = createCoreSocket(this.host, this.dispatcher)
      try {
        return await WebSocketConnection.createWebSocketConnection(
          this.logger,
          socket,
          this.timeout
        )
      } catch (error) {
        socket.close()
        // An untrusted cert (etc.) fails identically every attempt, so give up
        // now and surface the actionable reason instead of blocking on backoff.
        if (error instanceof FatalConnectionError) {
          this.logger.error(error, 'Managed connection failed permanently.')
          throw error
        }
        if (this.closed || attempt >= this.reconnectConfig.maxAttempts) {
          throw error
        }

        const { delay, maxDelay, backoffFactor } = this.reconnectConfig
        const backoffMs = Math.min(maxDelay, delay * backoffFactor ** attempt)

        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, backoffMs)
          // Let close() end the wait early so the loop can observe `closed` and bail.
          this.cancelBackoff = () => {
            clearTimeout(timer)
            resolve()
          }
        })
      }
    }
  }

  public send = (data: string): void => {
    if (!this.transport) {
      throw new Error('Cannot send: managed connection is not open.')
    }
    this.transport.send(data)
  }

  public close = (): void => {
    this.closed = true
    this.cancelBackoff?.()

    if (this.transport) {
      this.transport.removeAllListeners() // prevent reconnect event
      this.transport.close()
      this.transport = null
    }
    this.removeAllListeners()
    this.logger.debug('ManagedConnection closed.')
  }

  private reconnect = async (): Promise<void> => {
    try {
      await this.connect()
      this.emit('reconnected')
    } catch {
      this.emit('closed', 'reconnection failed')
    }
  }
}
