import {
  AutoStartManager,
  WebSocketManager,
  ControlManager,
  EventManager,
  RequestManager
} from ".."
import { ChangeGroupService, PollingService } from "../../services"
import { IComponent } from "../../index.interface"
import { qrwcEvents } from "../../constants"

export class Qrwc {
  webSocketManager: WebSocketManager | null = null
  autoStartManager: AutoStartManager | null = null
  controlManager: ControlManager
  eventManager: EventManager
  changeGroupServices: {
    [key: string]: ChangeGroupService
  } = {}
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
        this.webSocketManager.send,
        this.controlManager,
        this.eventManager
      )
      this.autoStartManager.start()
    }
  }

  // a method to create a change group
  public createChangeGroup(
    changeGroupName: string,
    componentNames: string[]
  ): void {
    // check if changeGroupManager is defined
    if (this.changeGroupServices[changeGroupName]) {
      // emit error
      this.eventManager.handleEvent(
        qrwcEvents.error,
        `ChangeGroup - ${changeGroupName} - already exists`
      )
      return
    }

    // create change group service
    this.changeGroupServices[changeGroupName] = new ChangeGroupService(
      changeGroupName,
      this.webSocketManager.send.bind(this.webSocketManager),
      this.controlManager.handleControlChanges.bind(this.controlManager),
      this.eventManager.handleEvent.bind(this.eventManager)
    )

    // get a component object from control manager
    const components = this.controlManager.components

    // omit components that are not in componentNames
    const filteredComponents = Object.keys(components).reduce(
      (acc, key) => {
        if (componentNames.includes(key)) {
          acc[key] = components[key]
        }
        return acc
      },
      {} as IComponent
    )

    // groom components for change group
    const groomedComponents = this.changeGroupServices[
      changeGroupName
    ].groomComponents(filteredComponents)

    // create change group
    this.changeGroupServices[changeGroupName].createChangeGroup(
      groomedComponents,
    )
  }

  // a method to return the polling service for a change group
  public getPollingService(changeGroupName: string): PollingService {
    // check if changeGroupManager is defined
    if (!this.changeGroupServices[changeGroupName]) {
      // emit error
      this.eventManager.handleEvent(
        qrwcEvents.error,
        `ChangeGroup - ${changeGroupName} - is not defined`
      )
    }

    // check if polling service is already initialized
    if (this.changeGroupServices[changeGroupName].polling) {
      // return polling service
      return this.changeGroupServices[changeGroupName].polling
    }

    // initiate polling service
    this.changeGroupServices[changeGroupName].initPollingService()

    // return polling service
    return this.changeGroupServices[changeGroupName].polling
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

    // check if requestManager is defined
    if (this.requestManager) {
      // initiate cleanUp for requestManager
      this.requestManager.cleanUp();

      // set requestManager to null
      this.requestManager = null;
    }

    // check if changeGroupServices is defined
    if (this.changeGroupServices) {
      // initiate cleanUp for each ChangeGroupService
      for (let key in this.changeGroupServices) {
        this.changeGroupServices[key].cleanUp();
      }

      // set changeGroupServices to null
      this.changeGroupServices = null;
    }
  }
}
