import { IQrcc, IQrccOptions } from "./index.interface"

export default class Qrcc implements IQrcc {
  private url: string
  private websocket: WebSocket | null = null
  private socketPollId: number
  pollChangeGroup: string
  pollInterval: number = 35

  constructor(options: IQrccOptions) {
    this.url = options.url
    this.pollInterval = options.pollInterval
    this.socketPollId = 1
    this.pollChangeGroup = 'ChangeGroup.Poll'
  }

  // private methods for internal use

  private isOpen = () => this.websocket.readyState === WebSocket.OPEN

  private setupWebSocket(): void {
      this.websocket = new WebSocket(this.url)
      this.websocket.onopen = this.onOpen.bind(this)
      this.websocket.onmessage = this.onMessage.bind(this)
      this.websocket.onerror = this.onError.bind(this)
      this.websocket.onclose = this.onClose.bind(this)
  }

  private onOpen(): void {
    console.log("WebSocket connection established.")
    setInterval(() => this.poll(), this.pollInterval)
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
    this.websocket = null
  }

  private poll(): void {
    if (this.isOpen) return
      const message = {
        jsonRpc: "2.0",
        socketPollId: this.socketPollId,
        method: this.pollChangeGroup
      }
      this.websocket.send(JSON.stringify(message))
      this.socketPollId++
  }

  // public methods that can call private handlers

  public getReadyState(): number | string {
    if (this.websocket) {
      return this.websocket.readyState
    } else {
      return "NOT_INITIALIZED"
    }
  }

  public connect(): void {
    if (this.websocket === null) {
      this.setupWebSocket()
    } else {
      console.warn("WebSocket connection is already established.")
    }
  }

  public send(data: object): void {
    if (this.isOpen()) {
      this.websocket.send(JSON.stringify(data))
    } else {
      console.error("WebSocket is not open or not initialized.")
    }
  }

  public close(code?: number, reason?: string): void {
    if (this.isOpen) {
      this.websocket.close(code, reason)
    }
  }
}

