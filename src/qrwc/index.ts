import {
  AutoStartManager,
  WebSocketManager,
  ControlManager,
  EventManager,
  ChangeGroupManager,
  RequestManager,
} from "../managers"
import { IComponent } from "../index.interface"
import { qrwcEvents } from "../constants"

export class Qrwc {
  webSocketManager: WebSocketManager | null = null
  autoStartManager: AutoStartManager | null = null
  controlManager: ControlManager
  eventManager: EventManager
  changeGroupManager: ChangeGroupManager
  requestManager: RequestManager

  constructor() {
    // main dependencies
    // create EventManager instance
    this.eventManager = new EventManager()
    // create RequestManager instance
    this.requestManager = new RequestManager(
      this.eventManager
    )
    // create ControlManager instance
    this.controlManager = new ControlManager(
      this.eventManager,
      this.requestManager
    )
    // create ChangeGroupManager instance
    this.changeGroupManager = new ChangeGroupManager(
      this.eventManager,
      this.controlManager
    )

    this.eventManager.on(qrwcEvents.disconnected, () => {
      // initate clean up
      this.qrwcCleanUp()
    })
  }

  // a getter method for components
  get components(): IComponent {
    return this.controlManager.components
  }

  // a method to create the websocket manager
  public attachWebSocket(socket: WebSocket): void {
    // check if webSocketManager is defined
    if (this.webSocketManager) {
      // emit event for websocket already attached
      this.eventManager.handleEvent(
        qrwcEvents.error,
        "web socket already attached"
      )
      return
    }

    // create webSocketManager
    this.webSocketManager = new WebSocketManager(socket, this.eventManager)

    // set webSocketManager dependencies
    this.setWsDependencies()

    // emit event for websocket attached
    this.eventManager.handleEvent(qrwcEvents.webSocketAttached)
  }

  private setWsDependencies(): void {
    // set webSocketManager for controlManager
    this.controlManager.setWebSocketManager(this.webSocketManager)

    // set webSocketManager for changeGroupManager
    this.changeGroupManager.setWebSocketManager(this.webSocketManager)
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
        qrwcEvents.error,
        "auto start already initialized"
      )
    } else {
      // create auto start manager
      this.autoStartManager = new AutoStartManager(
        this.webSocketManager,
        this.controlManager,
        this.eventManager,
        this.changeGroupManager.createChangeGroup.bind(this.changeGroupManager)
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

  // a method that decorates the .on method of the eventManager
  public on(event: string, listener: (...args: any[]) => void): void {
    this.eventManager.on(event, listener)
  }

  // a method for initating clean up for QRWC
  public qrwcCleanUp(): void {
    // remove all listeners from eventManager
    this.eventManager.removeAllEventListeners();

    // set eventManager to null
    this.eventManager = null;

    // check if webSocketManager is defined
    if (this.webSocketManager) {
      // initiate cleanup for webSocketManager
      this.webSocketManager.cleanUp();

      // set webSocketManager to null
      this.webSocketManager = null;
    }

    // check if autoStartManager is defined
    if (this.autoStartManager) {
      // initiate cleanUp for autoStartManager
      this.autoStartManager.cleanUp();

      // set autoStartManager to null
      this.autoStartManager = null;
    }

    // initiate cleanUp for controlManager
    this.controlManager.cleanUp();

    // set controlManager to null
    this.controlManager = null;

    // clean up changeGroupManager
    this.changeGroupManager.cleanUp()

    // set changeGroupManager to null
    this.changeGroupManager = null

  }
}
