export interface WebSocketHandlerOptions {
  ip: string
}

export interface IWebSocketHandler {
  getReadyState(): number | string
  send(data: object): void
  connect(): void
  close(code?: number, reason?: string): void
}
