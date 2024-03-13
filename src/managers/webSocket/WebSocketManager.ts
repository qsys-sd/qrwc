import { qrcMethods, qrwcEvents } from "../../constants"
import { WebSocket as WsWebsocket } from 'ws';
import { createJSONRPCMessage } from "../../utils";
import { EventManager } from "..";

export default class WebSocketManager {
  private pollInterval: number = 300;
  private intervalIds: NodeJS.Timer[] = [];
  private socket: WebSocket | WsWebsocket | null = null;
  private socketPollId: number = 1;
  eventManager: EventManager;

  constructor(socket: WebSocket, eventManager: EventManager) {
    this.socket = socket;

    // main dependencies
    this.eventManager = eventManager

    // binding websocket methods
    this.socket.onmessage = this.onMessage.bind(this)
    this.socket.onerror = this.onError.bind(this)
    this.socket.onclose = this.onClose.bind(this)
  }
  
  public onMessage(event: MessageEvent) {
    const message = JSON.parse(event.data)
    this.eventManager.handleEvent(qrwcEvents.message, message)
  }

  private onError(error: Event): void {
    this.eventManager.handleEvent(qrwcEvents.error, error)
  }

  private onClose(event: CloseEvent): void {
    this.eventManager.handleEvent(qrwcEvents.disconnected, event)
  }

  private isOpen() {
    return this.getReadyState() === this.socket.OPEN
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

  public send(data: object): void {
    if (this.socket !== null && this.isOpen()) {
      this.socket.send(JSON.stringify(data))
    } else {
      this.eventManager.handleEvent(qrwcEvents.error, "WebSocket is not open or not initialized.")
    }
  }

  public startPolling(changeGroupId: string): void {
    const intervalId = setInterval(() => this.poll(changeGroupId), this.pollInterval)
    this.intervalIds = [...this.intervalIds, intervalId]
  }

  public getReadyState(): number {
    if (this.socket) {
      return this.socket.readyState
    } else {
      this.eventManager.handleEvent(qrwcEvents.error, "WebSocket is not initialized.")
    }
  }

  public close(code?: number, reason?: string): void {
    if (this.socket !== null && this.isOpen()) {
      this.clearIntervals()

      this.socket.close(code, reason)
    } else {
      this.eventManager.handleEvent(qrwcEvents.error, "WebSocket is not open or not initialized.")
    }
  }

  // a method to clear intervals
  private clearIntervals(): void {
    if (!this.intervalIds.length) return
    this.intervalIds.forEach(id => clearInterval(id))
    this.intervalIds = []
  }

  // a method to remove socket if it exists
  public removeSocket(): void {
    if (this?.socket) {
      this.socket.onmessage = null
      this.socket.onerror = null
      this.socket.onclose = null
      this.socket.close()
      this.socket = null
    }
  }

  // a method to clean up the websocket
  public cleanUp(): void {
    this.clearIntervals();
    this.removeSocket();
  }
}