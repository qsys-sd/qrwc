import { AutoStartManager, WebSocketManager, ControlManager, EventManager } from "../managers"
import { IComponent, IControl, IQrccOptions } from "../index.interface"
import { qrccEvents } from "../constants"

export default class Qrcc {
  private webSocketManager: WebSocketManager
  public components: IComponent[] = []
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
    this.eventManager.on(qrccEvents.componentUpdated, (component: any) => {
      // update components
      this.components = this.controlManager.components
    })
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

  public setComponent(componentName: string, controlName: string, controlValues: Omit<IControl, 'Name'>): void {
    this.controlManager.setComponent(componentName, controlName, controlValues)
  }

  public on(eventName: string, listener: (...args: any[]) => void): void {
    this.eventManager.on(eventName, listener)
  }
}
