import type {
  IStartOptions,
  IQrwcEvents,
  ILogger,
  IStatusGetResult,
  IQrwcExpandedGenericParameter,
  IQrwcSimpleGenericParameter,
  INormalizedQrwcParameter
} from '../index.interface.js'
import { ChangeGroup } from './ChangeGroup.js'
import { Component } from './Component.js'
import { EventEmitter } from '../event/EventEmitter.js'
import { QrcClient } from '../connection/QrcClient.js'

/**
 * Main entry point for the QRWC library
 * Manages components, controls, and WebSocket communication with the core
 * @extends EventEmitter<IQrwcEvents>
 */
export class Qrwc<
  T extends IQrwcExpandedGenericParameter = IQrwcExpandedGenericParameter
> extends EventEmitter<IQrwcEvents<T>> {
  readonly engineStatus: Readonly<IStatusGetResult>
  // temporary value--overwritten in createQrwc
  private _components: Readonly<Record<string, Component<T, string>>> =
    Object.freeze({})
  private constructor(
    private readonly logger: ILogger,
    private readonly qrcClient: QrcClient,
    private readonly changeGroup: ChangeGroup<T>,
    status: IStatusGetResult
  ) {
    super()
    this.engineStatus = Object.freeze({
      ...status,
      Status: Object.freeze(status.Status)
    })
    this.on('error', (event) => {
      logger.error(event.message)
    })
  }

  /**
   * Gets all available components from the core
   * @returns {Readonly<Record<string, Component>>} A read-only record of components, keyed by component name
   * @public
   */
  get components(): Readonly<{
    [U in keyof T['components']]: string extends U
      ? Component<T, U> | undefined
      : Component<T, U>
  }> {
    return this._components as Readonly<{
      [U in keyof T['components']]: Component<T, U>
    }>
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
    T extends
      | IQrwcExpandedGenericParameter
      | IQrwcSimpleGenericParameter = IQrwcExpandedGenericParameter
  >(options: IStartOptions): Promise<Qrwc<INormalizedQrwcParameter<T>>> {
    const {
      logger: partialLogger = {},
      pollingInterval,
      componentFilter
    } = options
    /*
      Populate the default log functions on the original logger object, because
        the logger object is supplied by the user, and we don't know if the log
        functions are class methods which could rely on `this` pointing to the
        right scope. (e.g. pino)
    */
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

    const startTime = Date.now()
    logger.info('Initializing QRWC')
    logger.debug('Connecting to QRC...')

    const qrcClient = await QrcClient.createQrcClient(logger, options)

    /*
      When the core is shutting down or booting up, QRC will open and then
      immediately close the websocket connection, so we also need to verify
      QRC is ACTUALLY ready and throw an informative error if it is not. We
      can do this by making a quick one-off RPC call.
    */
    let status: IStatusGetResult
    try {
      status = await qrcClient.sendRpc('StatusGet', undefined)
    } catch (_error) {
      const error = new Error(
        'QRC initial status check failed. Q-SYS core might be shutting down or booting up. Wait and retry.'
      )
      logger.error(error.message)
      qrcClient.close()
      throw error
    }
    logger.debug('QRC is ready.')

    logger.info(
      `QRWC connected to ${status.Platform} running ${status.DesignName}`
    )

    const changeGroup = new ChangeGroup<INormalizedQrwcParameter<T>>(
      logger,
      qrcClient,
      pollingInterval
    )

    const qrwc = new Qrwc<INormalizedQrwcParameter<T>>(
      logger,
      qrcClient,
      changeGroup,
      status
    )

    // Wired after qrwc/changeGroup exist: the handlers close over both, and no
    // lifecycle event can fire during the initial connect inside the client.
    qrcClient.on('error', (error) => {
      qrwc.emit('error', error)
    })
    qrcClient.on('disconnected', (reason) => {
      qrwc.emit('disconnected', reason)
      changeGroup.stopPolling()
    })
    qrcClient.on('reconnected', async () => {
      await changeGroup.reregisterAll()
      await changeGroup.startPolling()
      qrwc.emit('reconnected')
    })
    qrcClient.on('closed', (reason) => {
      qrwc.emit('disconnected', reason)
      qrwc.close()
    })

    logger.debug('Fetching components from QRC...')
    try {
      const getComponentsResponse = await qrcClient.sendRpc(
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
            qrcClient,
            changeGroup,
            qrwc,
            component.Name,
            component // add whole obj so users can access props qrwc doesn't know about
          )
        })
      )
      // Freeze the object so it's readonly in javascript too
      qrwc._components = Object.freeze(
        components.reduce<
          Record<string, Component<INormalizedQrwcParameter<T>, string>>
        >((acc, component) => {
          acc[component.name] = component
          return acc
        }, {})
      )

      if (components.length > 0) {
        await changeGroup.startPolling()
      } else {
        logger.info('No components found.')
      }
    } catch (error) {
      // we should log here instead of emitting b/c this is before the client app
      // has had a chance to listen to qrwc's error event
      const message = 'Failed to fetch components from Q-SYS core.'
      // tear down the connection so a managed socket can't keep reconnecting
      qrwc.close()
      if (error instanceof Error) {
        error.message = `${message}\n${error.message}`
        logger.error(error.message)
        throw error
      } else {
        const errorObj = new Error(`${message}\n${error}`)
        logger.error(errorObj.message)
        throw errorObj
      }
    }

    const finishTime = Date.now()
    logger.info(`QRWC is ready. (${finishTime - startTime}ms)`)
    return qrwc
  }

  /**
   * Closes the connection and performs cleanup
   * @public
   */
  public close = (): void => {
    this.changeGroup.close()
    const components = Object.values(this._components)
    components.forEach((component) => {
      component.close()
    })
    this._components = {}
    this.qrcClient.close()
    this.removeAllListeners()
    this.logger.debug('Qrwc closed.')
  }
}
