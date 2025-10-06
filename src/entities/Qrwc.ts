import type { IStartOptions, IQrwcEvents, ILogger } from '../index.interface.js'
import { ChangeGroup } from './ChangeGroup.js'
import { Component } from './Component.js'
import { EventEmitter } from '../event/EventEmitter.js'
import { WebSocketManager } from './WebSocketManager.js'

/**
 * Main entry point for the QRWC library
 * Manages components, controls, and WebSocket communication with the core
 * @extends EventEmitter<IQrwcEvents>
 */
export class Qrwc<
  T extends Record<string, string> = Record<string, string>
> extends EventEmitter<IQrwcEvents> {
  // temporary value--overwritten in createQrwc
  private _components: Readonly<Record<string, Component>> = Object.freeze({})
  private constructor(
    private readonly logger: ILogger,
    private readonly webSocketManager: WebSocketManager,
    private readonly changeGroup: ChangeGroup
  ) {
    super()
  }

  /**
   * Gets all available components from the core
   * @returns {Readonly<Record<string, Component>>} A read-only record of components, keyed by component name
   * @public
   */
  get components(): Readonly<
    { [U in keyof T]: Component<T[U]> } & Record<string, Component | undefined>
  > {
    return this._components as Readonly<
      { [U in keyof T]: Component<T[U]> } & Record<
        string,
        Component | undefined
      >
    >
  }

  /**
   * Creates and initializes a new Qrwc instance
   * Establishes WebSocket connection, fetches all components from the core and starts polling for changes
   *
   * @param {IStartOptions} options - Configuration options
   * @param {WebSocket} options.socket - WebSocket instance
   * @param {number} [options.pollingInterval] - Interval in milliseconds for polling the change group
   * @param {(state: IComponentState) => boolean} [options.componentFilter] - Function to filter components in design
   * @param {number} [options.timeout] - Timeout in milliseconds for websocket messages
   * @returns {Promise<Qrwc>} A fully initialized Qrwc instance
   * @public
   * @static
   */
  public static async createQrwc<
    T extends Record<string, string> = Record<string, string>
  >({
    logger: partialLogger = {},
    socket,
    pollingInterval,
    componentFilter,
    timeout = 5000
  }: IStartOptions): Promise<Qrwc<T>> {
    if (!partialLogger.trace) {
      partialLogger.trace = () => undefined
    }
    if (!partialLogger.debug) {
      partialLogger.debug = () => undefined
    }
    if (!partialLogger.info) {
      partialLogger.info = () => undefined
    }
    if (!partialLogger.warn) {
      partialLogger.warn = () => undefined
    }
    if (!partialLogger.error) {
      partialLogger.error = () => undefined
    }

    const logger = partialLogger as ILogger

    logger.info('Initializing QRWC')
    // This will wait for the websocket to be open, run a quick status check, and HACF if anything fails.
    const websocketManager = await WebSocketManager.createWebSocketManager(
      logger,
      socket,
      timeout
    )
    logger.info('QRC is ready.')

    // note that client apps cannot listen to these emitters until after createQrwc returns
    websocketManager.on('error', (error) => {
      qrwc.emit('error', error)
    })

    websocketManager.on('disconnected', (reason) => {
      qrwc.emit('disconnected', reason)
      qrwc.close()
    })

    const changeGroup = new ChangeGroup(
      logger,
      websocketManager,
      pollingInterval
    )

    const qrwc = new Qrwc<T>(logger, websocketManager, changeGroup)

    logger.info('Fetching components from QRC.')
    try {
      const getComponentsResponse = await websocketManager.sendRpc(
        'Component.GetComponents',
        'test'
      )
      const filteredComponents = componentFilter
        ? getComponentsResponse.filter(componentFilter)
        : getComponentsResponse

      const components = await Promise.all(
        filteredComponents.map((component) => {
          return Component.createComponent(
            logger,
            websocketManager,
            changeGroup,
            qrwc,
            component.Name,
            component // add whole obj so users can access props qrwc doesn't know about
          )
        })
      )
      // Freeze the object so it's readonly in javascript too
      qrwc._components = Object.freeze(
        components.reduce<Record<string, Component>>((acc, component) => {
          acc[component.name] = component
          return acc
        }, {})
      )

      changeGroup.startPolling()
    } catch (error) {
      // we should log here instead of emitting b/c this is before the client app
      // has had a chance to listen to qrwc's error event
      const message = 'Failed to fetch components from Q-SYS core.'
      if (error instanceof Error) {
        error.message = `${message}\n${error.message}`
        logger.error(error)
        throw error
      } else {
        const errorObj = new Error(`${message}\n${error}`)
        logger.error(errorObj)
        throw errorObj
      }
    }

    logger.info('QRWC is ready.')
    return qrwc
  }

  /**
   * Closes the connection and performs cleanup
   * @public
   */
  public close(): void {
    this.changeGroup.close()
    const components = Object.values(this._components)
    components.forEach((component) => {
      component.close()
    })
    this._components = {}
    this.webSocketManager.close()
    this.removeAllListeners()
    this.logger.debug('Qrwc closed.')
  }
}
