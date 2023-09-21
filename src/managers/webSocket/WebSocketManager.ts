import { qrcMethods, qrccEvents } from "../../constants"
import { createJSONRPCMessage } from "../../utils";
import { EventManager } from "..";

export default class WebSocketManager {
  private readonly url: string;
  private readonly pollInterval: number = 500;
  private socket: WebSocket | null = null;
  private socketPollId: number = 1;
  eventManager: EventManager;

  constructor(url: string, pollInterval: number, eventManager: EventManager) {

    this.url = url;
    this.pollInterval = pollInterval;

    // main dependencies
    this.eventManager = eventManager
  }

  private setupWebSocket(): void {
    this.socket = new WebSocket(this.url)
    this.socket.onopen = this.onOpen.bind(this)
    this.socket.onmessage = this.onMessage.bind(this)
    this.socket.onerror = this.onError.bind(this)
    this.socket.onclose = this.onClose.bind(this)
  }

  private onOpen(): void {
    this.eventManager.handleEvent(qrccEvents.connected)
  }
  
  public async onMessage(event: MessageEvent): Promise<void> {
    const message = await JSON.parse(event.data)
    this.eventManager.handleEvent(qrccEvents.message, message)
  }

  private onError(error: Event): void {
    this.eventManager.handleEvent(qrccEvents.error, error)
  }

  private onClose(event: CloseEvent): void {
    this.eventManager.handleEvent(qrccEvents.disconnected, event)
    this.socket = null
  }

  private isOpen() {
    return this.socket.readyState === WebSocket.OPEN
  }

  private poll(changeGroupId: string): void {
    this.send(
      createJSONRPCMessage(
        qrcMethods.changeGroup.poll,
        { Id: changeGroupId },
        this.socketPollId
      )
    )

    // increment socketPollId
    this.incrementSocketPollId()
  }

  private incrementSocketPollId(): void {
    this.socketPollId++

    // reset socketPollId after 30 seconds
    const numPollsBeforeReset = Math.floor(30000 / this.pollInterval)
    if (this.socketPollId > numPollsBeforeReset) {
      this.socketPollId = 1
    }
  }

  // public methods

  public connect(): void {
    if (!this.socket) {
      this.setupWebSocket()
    } else {
      this.eventManager.handleEvent(qrccEvents.error, "WebSocket is already initialized.")
    }
  }

  public send(data: object): void {
    if (this.isOpen()) {
      this.socket.send(JSON.stringify(data))
    } else {
      this.eventManager.handleEvent(qrccEvents.error, "WebSocket is not open or not initialized.")
    }
  }

  public startPolling(changeGroupId: string): void {
    setInterval(() => this.poll(changeGroupId), this.pollInterval)
  }

  public getReadyState(): number {
    if (this.socket) {
      return this.socket.readyState
    } else {
      this.eventManager.handleEvent(qrccEvents.error, "WebSocket is not initialized.")
    }
  }

  public close(code?: number, reason?: string): void {
    if (this.isOpen()) {
      this.socket.close(code, reason)
    } else {
      this.eventManager.handleEvent(qrccEvents.error, "WebSocket is not open or not initialized.")
    }
  }
}