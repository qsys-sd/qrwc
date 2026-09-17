import type {
  IConnectionEvents,
  ILogger,
  IWebSocket
} from '../index.interface.js'
import { EventEmitter } from '../event/EventEmitter.js'

// `disconnected`/`reconnected` are supervision concerns owned by IConnection,
// not a single socket, so they are excluded here.
type IWebSocketConnectionEvents = Pick<
  IConnectionEvents,
  'message' | 'error' | 'closed'
>

// OpenSSL/Node TLS codes raised when a core presents an untrusted or self-signed
// certificate. The browser hides this detail, so the guidance only reaches Node.
const tlsCertificateErrorCodes = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID'
])

/**
 * A failure to bring a socket up (open error, timeout, or an early close).
 */
export class ConnectionInitializationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ConnectionInitializationError'
  }
}

/**
 * A ConnectionInitializationError that retrying cannot fix (e.g. an untrusted
 * certificate). ManagedConnection's backoff checks for this and gives up.
 */
export class FatalConnectionError extends ConnectionInitializationError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'FatalConnectionError'
  }
}

// Pulls the underlying cause off a WebSocket `error` event without assuming a
// concrete event shape (DOM Event vs. undici/ws ErrorEvent differ).
function readErrorDetail(event: unknown): { code?: string; message?: string } {
  const source = (event ?? {}) as {
    code?: unknown
    message?: unknown
    error?: { code?: unknown; message?: unknown }
  }
  const nested = source.error ?? {}
  const rawCode = nested.code ?? source.code
  const rawMessage = nested.message ?? source.message
  return {
    code: typeof rawCode === 'string' ? rawCode : undefined,
    message: typeof rawMessage === 'string' ? rawMessage : undefined
  }
}

function toConnectionInitializationError(
  event: unknown
): ConnectionInitializationError {
  const { code, message } = readErrorDetail(event)
  const isCertificateError =
    (code !== undefined && tlsCertificateErrorCodes.has(code)) ||
    /self[- ]?signed|unable to verify|certificate/i.test(message ?? '')
  if (isCertificateError) {
    return new FatalConnectionError(
      `The Q-SYS core's TLS certificate could not be verified${
        message ? ` (${message})` : ''
      }. This usually means the core is using a self-signed certificate. In ` +
        'managed mode, pass a dispatcher option (an undici Agent created with ' +
        '{ connect: { rejectUnauthorized: false } }) to trust it, or use a ' +
        'ws:// address.'
    )
  }
  return new ConnectionInitializationError(
    'WebSocket failed to connect (error). Check Q-SYS core IP address or wait and retry.'
  )
}

/**
 * Transport over a single socket. Deliberately has no retry or mode awareness —
 * reconnection lives in ManagedConnection, which discards and rebuilds these.
 */
export class WebSocketConnection extends EventEmitter<IWebSocketConnectionEvents> {
  private constructor(
    private readonly logger: ILogger,
    private readonly socket: IWebSocket
  ) {
    super()

    this.socket.onmessage = (event: MessageEvent) => {
      this.emit('message', event.data)
    }
    this.socket.onerror = (event: Event) => {
      const { message } = readErrorDetail(event)
      const error = new Error(`WebSocket error: ${message ?? 'unknown cause'}`)
      this.logger.error(error, 'WebSocket error.')
      this.emit('error', error)
    }
    this.socket.onclose = (event: CloseEvent) => {
      this.logger.debug(`WebSocket disconnected. ${event.reason}`)
      this.emit(
        'closed',
        event.reason || 'WebSocket connection closed by Q-SYS core.'
      )
    }
  }

  public static createWebSocketConnection = async (
    logger: ILogger,
    socket: IWebSocket,
    timeout: number
  ): Promise<WebSocketConnection> => {
    if (socket.readyState === socket.OPEN)
      return new WebSocketConnection(logger, socket)
    return new Promise<WebSocketConnection>((resolve, reject) => {
      const timeoutRef = setTimeout(
        () =>
          reject(
            new ConnectionInitializationError(
              'WebSocket failed to connect (timeout). Check Q-SYS core IP address or wait and retry.'
            )
          ),
        timeout
      )
      socket.onopen = () => {
        clearTimeout(timeoutRef)
        resolve(new WebSocketConnection(logger, socket))
      }
      socket.onerror = (event: Event) => {
        clearTimeout(timeoutRef)
        reject(toConnectionInitializationError(event))
      }
      socket.onclose = () => {
        clearTimeout(timeoutRef)
        reject(
          new ConnectionInitializationError(
            'WebSocket failed to connect (connection closed by Q-SYS core). Wait and retry.'
          )
        )
      }
    })
  }

  public send = (data: string): void => {
    this.socket.send(data)
  }

  public close = (): void => {
    this.detachHandlers()
    this.socket.close()
  }

  private detachHandlers = (): void => {
    this.socket.onmessage = null
    this.socket.onerror = null
    this.socket.onclose = null
  }
}
