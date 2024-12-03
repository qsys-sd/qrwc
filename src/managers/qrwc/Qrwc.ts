import {
  AutoStartManager,
  WebSocketManager,
  ControlManager,
  EventManager,
  RequestManager,
  PollingManager,
  ChangeGroupManager,
  ComponentManager
} from '..'
import { IComponent } from '../../index.interface'
import { qrwcEvents } from '../../constants'

export class Qrwc {
  webSocketManager: WebSocketManager | null = null
  autoStartManager: AutoStartManager | null = null
  controlManager: ControlManager
  eventManager: EventManager
  componentManager: ComponentManager
  changeGroupManagers: {
    [key: string]: ChangeGroupManager
  } = {}
  requestManager: RequestManager

  constructor() {
    this.initialize()
  }

  private initialize = async () => {
    // main dependencies
    // create EventManager instance
    this.eventManager = new EventManager()
    await this.eventManager.initializeEmitter()
    // create RequestManager instance
    this.requestManager = new RequestManager(
      this.eventManager
    )
    // create ControlManager instance
    this.controlManager = new ControlManager(
      this.eventManager,
      this.requestManager
    )
    // create component manager
    this.componentManager = new ComponentManager(
      this.eventManager.on.bind(this.eventManager),
      this.eventManager.emit.bind(this.eventManager)
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
      this.eventManager.emit(
        qrwcEvents.error,
        'web socket already attached'
      )
      return
    }

    // create webSocketManager
    this.webSocketManager = new WebSocketManager(socket, this.eventManager)

    // set webSocketManager dependencies
    this.setWsSendDependencies()

    // emit event for websocket attached
    this.eventManager.emit(qrwcEvents.webSocketAttached)
  }

  private setWsSendDependencies(): void {
    // set webSocketSend for controlManager
    this.controlManager.setWebSocketSend(this.webSocketManager.send.bind(this.webSocketManager))

    // set webSocketSend for componentManager
    this.componentManager.setWebSocketSend(this.webSocketManager.send.bind(this.webSocketManager))
  }

  // a method to initate the auto start process
  public autoStart(): void {
    // check if webSocketManager is initialized
    if (!this.webSocketManager) {
      // emit event for webSocketManager not initialized
      this.eventManager.emit(
        qrwcEvents.error,
        'web socket not initialized'
      )
      return
    }

    // check if autoStartManager is initialized
    if (this.autoStartManager) {
      // emit event for auto start already started
      this.eventManager.emit(
        qrwcEvents.error,
        'auto start already initialized'
      )
      return
    }

    // create auto start manager
    this.autoStartManager = new AutoStartManager(
      this.webSocketManager.send,
      this.controlManager,
      this.eventManager,
      this.componentManager.getComponentNames.bind(this.componentManager)
    )

    this.autoStartManager.start()
  }

  // a method to create a change group
  public createChangeGroup(
    changeGroupName: string,
    componentNames: string[]
  ): void {
    // check if changeGroupManager is defined
    if (this.changeGroupManagers[changeGroupName]) {
      // emit error
      this.eventManager.emit(
        qrwcEvents.error,
        `ChangeGroup - ${changeGroupName} - already exists`
      )
      return
    }

    // create change group service
    this.changeGroupManagers[changeGroupName] = new ChangeGroupManager(
      changeGroupName,
      this.webSocketManager.send.bind(this.webSocketManager),
      this.controlManager.handleControlChanges.bind(this.controlManager),
      this.eventManager.emit.bind(this.eventManager)
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
    const groomedComponents = this.changeGroupManagers[
      changeGroupName
    ].groomComponents(filteredComponents)

    // create change group
    this.changeGroupManagers[changeGroupName].createChangeGroup(
      groomedComponents
    )
  }

  // a method to return the polling service for a change group
  public getPollingManager(changeGroupName: string): PollingManager {
    // check if changeGroupManager is defined
    if (!this.changeGroupManagers[changeGroupName]) {
      // emit error
      this.eventManager.emit(
        qrwcEvents.error,
        `ChangeGroup - ${changeGroupName} - is not defined`
      )
    }

    // check if polling service is already initialized
    if (this.changeGroupManagers[changeGroupName].polling) {
      // return polling service
      return this.changeGroupManagers[changeGroupName].polling
    }

    // initiate polling service
    this.changeGroupManagers[changeGroupName].initPollingManager()

    // return polling service
    return this.changeGroupManagers[changeGroupName].polling
  }

  public getReadyState(): number {
    return this.webSocketManager.getReadyState()
  }

  public close(): void {
    this.webSocketManager.close()
  }

  // a method that decorates the .on method of the eventManager
  public on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventManager.on(event, listener)
  }

  // a method for initating clean up for QRWC
  public qrwcCleanUp(): void {
    // remove all listeners from eventManager
    this.eventManager.removeAllEventListeners()

    // set eventManager to null
    this.eventManager = null

    // check if webSocketManager is defined
    if (this.webSocketManager) {
      // initiate cleanup for webSocketManager
      this.webSocketManager.cleanUp()

      // set webSocketManager to null
      this.webSocketManager = null
    }

    // check if autoStartManager is defined
    if (this.autoStartManager) {
      // initiate cleanUp for autoStartManager
      this.autoStartManager.cleanUp()

      // set autoStartManager to null
      this.autoStartManager = null
    }

    // initiate cleanUp for controlManager
    this.controlManager.cleanUp()

    // set controlManager to null
    this.controlManager = null

    // check if requestManager is defined
    if (this.requestManager) {
      // initiate cleanUp for requestManager
      this.requestManager.cleanUp()

      // set requestManager to null
      this.requestManager = null
    }

    // check if changeGroupManagers is defined
    if (this.changeGroupManagers) {
      // initiate cleanUp for each ChangeGroupManager
      for (const key in this.changeGroupManagers) {
        this.changeGroupManagers[key].cleanUp()
      }

      // set changeGroupManagers to null
      this.changeGroupManagers = null
    }
  }
}
