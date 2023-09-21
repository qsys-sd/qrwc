import { AutoStartManager, WebSocketManager, ControlManager, EventManager } from "../managers"
import { IComponent, IQrccOptions } from "../index.interface"

export default class Qrcc {
  private webSocketManager: WebSocketManager
  public components: IComponent = {}
  autoStartManager: AutoStartManager | null = null
  controlManager: ControlManager
  eventManager: EventManager

  constructor({ url, pollInterval, autoStart }: IQrccOptions) {

    // main dependencies
    this.eventManager = new EventManager()
    this.webSocketManager = new WebSocketManager(url, pollInterval, this.eventManager)
    this.controlManager = new ControlManager(this.eventManager, this.webSocketManager)

    // optional dependencies
    this.autoStartManager = autoStart
      ? new AutoStartManager(this.webSocketManager, this.controlManager, this.eventManager)
      : null

    // event listeners
  }

  public connect(): void {
    this.webSocketManager.connect()
  }

  public startPolling(changeGroupId: string): void {
    this.webSocketManager.startPolling(changeGroupId)
  }

  public getReadyState(): number {
    return this.webSocketManager.getReadyState()
  }

  public close(): void {
    this.webSocketManager.close()
  }
}
