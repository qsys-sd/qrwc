import {
  AutoStartManager,
  WebSocketManager,
  ControlManager,
  EventManager
} from "../managers"
import { IComponent, IControl } from "../index.interface"
import { qrccEvents } from "../constants"

export class Qrcc {
  webSocketManager: WebSocketManager | null = null
  autoStartManager: AutoStartManager | null = null
  controlManager: ControlManager
  eventManager: EventManager
  public components: IComponent = {}

  constructor() {
    // main dependencies
    this.eventManager = new EventManager()
    this.controlManager = new ControlManager(
      this.eventManager
    )

    // event listeners
    this.eventManager.on(qrccEvents.controlsReceived, () => {
      // update components
      this.components = this.controlManager.components
    })

    this.eventManager.on(qrccEvents.controlsUpdated, () => {
      // update components
      this.components = this.controlManager.components
    })

    this.eventManager.on(qrccEvents.disconnected, () => {
      // update components
      this.qrccCleanUp()
    })
  }

  // a method to create the websocket manager
  public attachWebSocket(socket: WebSocket): void {
    // check if webSocketManager is defined
    if (this.webSocketManager) {
      // emit event for websocket already attached
      this.eventManager.handleEvent(
        qrccEvents.error,
        "web socket already attached"
      )
      return
    }
    
    // create webSocketManager
    this.webSocketManager = new WebSocketManager(socket, this.eventManager)

    // attach web socket to control manager
    this.controlManager.attachWebSocketManager(this.webSocketManager)

    // emit event for websocket attached
    this.eventManager.handleEvent(qrccEvents.webSocketAttached)
  }

  // a method to initate the auto start process
  public autoStart(): void {
    // check if webSocketManager is defined
    if (!this.webSocketManager) {
      throw new Error("WebSocketManager is not defined")
    }

    // check if autoStartManager is defined
    if (this.autoStartManager) {
      // emit event for auto start already started
      this.eventManager.handleEvent(
        qrccEvents.error,
        "auto start already initialized"
      )
    } else {
      // create auto start manager
      this.autoStartManager = new AutoStartManager(
        this.webSocketManager,
        this.controlManager,
        this.eventManager
      )
      this.autoStartManager.start()
    }
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

  public setComponent(
    componentName: string,
    controlsToUpdate: IControl[]
  ): void {
    this.controlManager.setComponent(componentName, controlsToUpdate)
  }

  // a method that decorates the .on method of the eventManager
  public on(event: string, listener: (...args: any[]) => void): void {
    this.eventManager.on(event, listener)
  }

  // an async method for initating clean up for QRCC
  public async qrccCleanUp(): Promise<void> {
    // remove all listeners from eventManager
    await this.eventManager.removeAllEventListeners()

    // set eventManager to null
    this.eventManager = null

    // check if webSocketManager is defined
    if (this.webSocketManager) {
      // initiate cleanup for webSocketManager
      await this.webSocketManager.cleanUp()

      // set webSocketManager to null
      this.webSocketManager = null
    }

    // check if autoStartManager is defined
    if (this.autoStartManager) {
      // initiate cleanUp for autoStartManager
      await this.autoStartManager.cleanUp()

      // set autoStartManager to null
      this.autoStartManager = null
    }

    // initiate cleanUp for controlManager
    await this.controlManager.cleanUp()

    // set controlManager to null
    this.controlManager = null

    // set components to empty object
    this.components = {}

    // return
    return
  }
}
