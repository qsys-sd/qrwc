import { qrwcEvents } from "../../constants"
import { WebSocket as WsWebsocket } from 'ws';
import { EventManager } from "..";

export default class WebSocketManager {
  private socket: WebSocket | WsWebsocket | null = null;
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
    this.eventManager.emit(qrwcEvents.message, message)
  }

  private onError(error: Event): void {
    this.eventManager.emit(qrwcEvents.error, error)
  }

  private onClose(event: CloseEvent): void {
    this.eventManager.emit(qrwcEvents.disconnected, event)
  }

  private isOpen() {
    return this.getReadyState() === this.socket.OPEN
  }

  public send = (data: object): void => {
    if (this.socket !== null && this.isOpen()) {
      this.socket.send(JSON.stringify(data))
    } else {
      this.eventManager.emit(qrwcEvents.error, "WebSocket is not open or not initialized.")
    }
  }

  public getReadyState(): number {
    if (this.socket) {
      return this.socket.readyState
    } else {
      this.eventManager.emit(qrwcEvents.error, "WebSocket is not initialized.")
    }
  }

  public close(code?: number, reason?: string): void {
    if (this.socket !== null && this.isOpen()) {
      // this.clearIntervals()
      // emit event for websocket close
      this.eventManager.emit(qrwcEvents.disconnected, "WebSocket closed.")

      this.socket.close(code, reason)
    } else {
      this.eventManager.emit(qrwcEvents.error, "WebSocket is not open or not initialized.")
    }
  }


  // a method to clean up the websocket
  public cleanUp(): void {
    this.close();
  }
}