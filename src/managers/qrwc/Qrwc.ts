import {
  WebSocketManager,
  ControlManager,
  EventManager,
  ChangeRequestManager,
  ChangeGroupManager,
  ComponentManager,
  StartManager
} from '..'
import { IComponent, IComponentFilter, IStartOptions } from '../../index.interface'
import { qrwcEvents, qrwcMinPollInterval, qrwcMockComponentGetResult } from '../../constants'

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
  get components(): { [componentName: string]: IComponent } {
    return this.controlManager.components
  }

  // a method to create the websocket manager
  public async attachWebSocket(socket: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      // check if webSocketManager is defined
      if (this.webSocketManager) {
        // reject promise for websocket already attached
        reject(new Error('web socket already attached'))
        return
      }

      // create webSocketManager
      this.webSocketManager = new WebSocketManager(socket, this.eventManager)

      // resolve promise for websocket attached
      resolve()
    })
  }

  // a method to initate the QRWC start process
  public start({ componentFilter, pollingInterval }: IStartOptions = {}): void {
    // check start options
    const validatedComponentFilter =
      componentFilter && this.validateComponentFilter(componentFilter)
        ? componentFilter
        : null
    const validatedPollingInterval =
      pollingInterval && this.validatePollingInterval(pollingInterval)
        ? pollingInterval
        : null

    // check if webSocketManager is initialized
    if (!this.checkWebSocketManagerInitialized()) return

    // check if startManager is initialized
    if (this.checkStartManagerInitialized()) return

    this.createControlManager()
    this.createComponentManager(validatedComponentFilter)
    this.createStartManager(validatedPollingInterval)

    this.startManager.start()
  }

  private createStartManager = (validatedPollingInterval: number) => {
    // create StartManager instance
    this.startManager = new StartManager(
      this.webSocketManager.send.bind(this.webSocketManager),
      this.componentManager,
      this.controlManager,
      this.eventManager,
      validatedPollingInterval
    )
  }

  private createControlManager = () => {
    // create ControlManager instance
    this.controlManager = new ControlManager(
      this.webSocketManager.send.bind(this.webSocketManager),
      this.eventManager,
      this.changeRequestManager
    )
  }

  private createComponentManager = (componentFilter: IComponentFilter) => {
    // create ComponentManager instance
    this.componentManager = new ComponentManager(
      this.eventManager.on.bind(this.eventManager),
      this.eventManager.emit.bind(this.eventManager),
      this.webSocketManager.send.bind(this.webSocketManager),
      componentFilter
    )
  }

  // Helper function to validate component filter
  public validateComponentFilter(componentFilter: IComponentFilter): boolean {
    const isValid = typeof componentFilter === 'function' && typeof componentFilter(qrwcMockComponentGetResult) === 'boolean'
    if (!isValid) {
      this.eventManager.emit(qrwcEvents.error, 'Invalid componentFilter, using defaults')
    }
    return isValid
  }

  // Helper function to validate polling interval
  public validatePollingInterval(pollingInterval: number): boolean {
    const isValid = typeof pollingInterval === 'number' && pollingInterval >= qrwcMinPollInterval
    if (!isValid) {
      this.eventManager.emit(qrwcEvents.error, `Invalid pollingInterval, must be a number greater than ${qrwcMinPollInterval}, using defaults`)
    }
    return isValid
  }

  // Method to check if webSocketManager is initialized
  public checkWebSocketManagerInitialized(): boolean {
    if (!this.webSocketManager) {
      this.eventManager.emit(qrwcEvents.error, 'web socket not initialized')
      return false
    }
    return true
  }

  // Method to check if startManager is initialized
  public checkStartManagerInitialized(): boolean {
    if (this.startManager) {
      this.eventManager.emit(qrwcEvents.error, 'start already initialized')
      return true
    }
    return false
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
