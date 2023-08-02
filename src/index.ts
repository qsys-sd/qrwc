import { WebSocketHandlerOptions, IWebSocketHandler } from './index.interface'

export default class Qrcc implements IWebSocketHandler {
  private ip: string
  private websocket: WebSocket | null = null

  constructor(options: WebSocketHandlerOptions) {
    this.ip = options.ip
  }

  // private methods for internal use

  private setupWebSocket(): void {
    if (!this.websocket) {
      this.websocket = new WebSocket(`ws://${this.ip}/qrc`)
      this.websocket.onopen = this.onOpen
      this.websocket.onmessage = this.onMessage
      this.websocket.onerror = this.onError
      this.websocket.onclose = this.onClose
    }
  }

  private onOpen(): void {
    console.log("WebSocket connection established.")
  }

  private onMessage(event: MessageEvent): void {
    const data = event.data
    console.log("Received message:", data)
  }

  private onError(event: Event): void {
    console.error("WebSocket error:", event)
  }

  private onClose(event: CloseEvent): void {
    console.log("WebSocket connection closed:", event.code, event.reason)
  }

  // public methods that can call private handlers

  public getReadyState(): number | string {
    if (this.websocket) {
      return this.websocket.readyState
    } else {
      return "NOT_INITIALIZED"
    }
  }

  public async connect(): Promise<void> {
    if (this.websocket === null) {
      await this.setupWebSocket()
    } else {
      console.warn("WebSocket connection is already established.")
    }
  }

  public send(data: object): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(data))
    } else {
      console.error("WebSocket is not open or not initialized.")
    }
  }

  public close(code?: number, reason?: string): void {
    if (this.websocket) {
      this.websocket.close(code, reason)
      this.websocket = null
    }
  }
}

