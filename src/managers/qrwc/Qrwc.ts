import {
  WebSocketManager,
  ControlManager,
  EventManager,
  ChangeRequestManager,
  PollingManager,
  ChangeGroupManager,
  ComponentManager,
  StartManager
} from '..'
import { IComponent, IStartOptions } from '../../index.interface'
import { qrwcEvents } from '../../constants'

export class Qrwc {
  webSocketManager: WebSocketManager | null = null
  startManager: StartManager | null = null
  controlManager: ControlManager
  eventManager: EventManager
  componentManager: ComponentManager
  changeGroupManagers: {
    [key: string]: ChangeGroupManager
  } = {}
  changeRequestManager: ChangeRequestManager

  constructor() {
    this.initialize()
  }

  private initialize = async () => {
    // main dependencies
    // create EventManager instance
    this.eventManager = new EventManager()
    await this.eventManager.initializeEmitter()
    // create ChangeRequestManager instance
    this.changeRequestManager = new ChangeRequestManager(
      this.eventManager
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

    // emit event for websocket attached
    this.eventManager.emit(qrwcEvents.webSocketAttached)
  }

  // a method to initate the QRWC start process
  public start({ componentFilter }: IStartOptions = {}): void {
    // check if webSocketManager is initialized
    if (!this.webSocketManager) {
      // emit event for webSocketManager not initialized
      this.eventManager.emit(
        qrwcEvents.error,
        'web socket not initialized'
      )
      return
    }

    // check if startManager is initialized
    if (this.startManager) {
      // emit event for start already initialized
      this.eventManager.emit(
        qrwcEvents.error,
        'start already initialized'
      )
      return
    }

    // create ControlManager instance
    this.controlManager = new ControlManager(
      this.webSocketManager.send.bind(this.webSocketManager),
      this.eventManager,
      this.changeRequestManager
    )

    // create ComponentManager instance
    this.componentManager = new ComponentManager(
      this.eventManager.on.bind(this.eventManager),
      this.eventManager.emit.bind(this.eventManager),
      this.webSocketManager.send.bind(this.webSocketManager),
      componentFilter
    )

    // create start manager
    this.startManager = new StartManager(
      this.webSocketManager.send,
      this.componentManager,
      this.controlManager,
      this.eventManager
    )

    this.startManager.start()
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

    // check if startManager is defined
    if (this.startManager) {
      // initiate cleanUp for startManager
      this.startManager.cleanUp()

      // set startManager to null
      this.startManager = null
    }

    // check if componentManager is defined
    if (this.componentManager) {

      // set componentManager to null
      this.componentManager = null
    }

    // check if controlManager is defined
    if (this.controlManager) {
      // initiate cleanUp for controlManager
      this.controlManager.cleanUp()

      // set controlManager to null
      this.controlManager = null
    }

    // check if changeRequestManager is defined
    if (this.changeRequestManager) {
      // initiate cleanUp for changeRequestManager
      this.changeRequestManager.cleanUp()

      // set changeRequestManager to null
      this.changeRequestManager = null
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
