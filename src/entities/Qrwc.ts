import type {
  IStartOptions,
  IQrwcEvents,
  ILogger,
  IEngineStatus,
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
  // overwritten in createQrwc; a returned instance always has it populated
  private _components: Readonly<Record<string, Component<T, string>>> =
    Object.freeze({})
  private constructor(
    private readonly logger: ILogger,
    private readonly qrcClient: QrcClient,
    private readonly changeGroup: ChangeGroup<T>
  ) {
    super()
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
   * The core's latest engine status
   * @public
   */
  get engineStatus(): Readonly<IEngineStatus> {
    return Object.freeze(
      this.qrcClient
        ? { ...this.qrcClient?.engineStatus }
        : { State: 'Disconnected' }
    )
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
   * @returns {Promise<Qrwc | undefined>} A fully initialized Qrwc instance, or `undefined` if the connection or component fetch fails (the error is logged, not thrown)
   * @public
   * @static
   */
  public static async createQrwc<
    T extends
      | IQrwcExpandedGenericParameter
      | IQrwcSimpleGenericParameter = IQrwcExpandedGenericParameter
  >(
    options: IStartOptions
  ): Promise<Qrwc<INormalizedQrwcParameter<T>> | undefined> {
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

    let qrcClient: QrcClient

    try {
      qrcClient = await QrcClient.createQrcClient(logger, options)
    } catch (error) {
      logger.error(error)
      return
    }

    logger.debug('QRC is ready.')

    logger.info(
      `QRWC connected to ${qrcClient.engineStatus.Platform} running ${qrcClient.engineStatus?.DesignName}`
    )

    const changeGroup = new ChangeGroup<INormalizedQrwcParameter<T>>(
      logger,
      qrcClient,
      pollingInterval
    )

    const qrwc = new Qrwc<INormalizedQrwcParameter<T>>(
      logger,
      qrcClient,
      changeGroup
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
    qrcClient.on('engineStatus', (status) => {
      qrwc.emit('engineStatus', status)
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
      const message = 'Failed to fetch components from Q-SYS core.'
      // tear down so a managed socket can't keep reconnecting to a dead instance
      qrwc.close()
      if (error instanceof Error) {
        error.message = `${message}\n${error.message}`
        logger.error(error.message)
      } else {
        logger.error(`${message}\n${error}`)
      }
      return
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
