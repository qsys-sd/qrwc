import type {
  IControlState,
  IControlEvents,
  ILogger,
  IControlUpdate,
  IQrwcExpandedGenericParameter,
  Prettify
} from '../index.interface.js'
import type { ChangeGroup } from './ChangeGroup.js'
import type { Component } from './Component.js'
import type { QrcClient } from '../connection/QrcClient.js'
import { EventEmitter } from '../event/EventEmitter.js'

/**
 * Represents a Q-Sys control element that can be interacted with
 * @extends EventEmitter<IControlEvents>
 */
export class Control<
  T extends IQrwcExpandedGenericParameter,
  U extends keyof T['components'],
  V extends keyof T['components'][U]['controls']
> extends EventEmitter<IControlEvents<T, U, V>> {
  private _state: Omit<IControlState, 'Bool'>

  /**
   * Creates a new Control instance
   */
  private constructor(
    private readonly logger: ILogger,
    private readonly qrcClient: QrcClient,
    private readonly changeGroup: ChangeGroup<T>,
    readonly component: Component<T, U>,
    readonly name: V & string,
    state: Omit<IControlState, 'Bool'> // Bool is computed so it doesn't need to be provided
  ) {
    super()
    this._state = { ...state }

    // Propagate update events downwards. Control -> Component -> Qrwc
    this.on('update', (state) => {
      component.emit('update', this, state)
    })
    this.on('error', (error) => {
      component.emit('error', error)
    })

    logger.debug(`Control ${name} created in component ${component.name}`)
  }

  public static async createControl<
    T extends IQrwcExpandedGenericParameter,
    U extends keyof T['components'],
    V extends keyof T['components'][U]['controls']
  >(
    logger: ILogger,
    qrcClient: QrcClient,
    changeGroup: ChangeGroup<T>,
    component: Component<T, U>,
    name: V & string,
    state: Omit<IControlState, 'Bool'> // Bool is computed so it doesn't need to be provided
  ) {
    const control = new Control<T, U, V>(
      logger,
      qrcClient,
      changeGroup,
      component,
      name,
      state
    )

    // Register a callback with the changeGroup, so it can tell the control when there is new state
    await changeGroup.registerControl(control, (change) => {
      control._state = { ...control._state, ...change } as const
      control.emit('update', control.state)
    })

    return control
  }

  /**
   * The current state of the control
   * Includes a transient Bool property based on Q-SYS convention
   *
   * @returns {IControlState} The frozen (immutable) current state
   */
  get state(): Readonly<T['components'][U]['controls'][V]['state']> {
    // Bool is transient, as it does not exist on QRC controls.
    // Checking for 0.5 or greater to determine truthfulness is Q-SYS convention
    return Object.freeze({
      ...this._state,
      Bool: !!this._state.Value && this._state.Value >= 0.5
    })
  }

  /**
   * Asynchronously updates a property on the control, and resolves when the update is complete.
   * @param {string | number | boolean} value - The new value for the control.
   * @returns {Promise<IControlState>} The updated state.
   */
  public update = async (
    value:
      | string
      | number
      | boolean
      | Prettify<
          Pick<
            IControlUpdate,
            keyof IControlUpdate &
              keyof T['components'][U]['controls'][V]['state']
          >
        >
  ): Promise<T['components'][U]['controls'][V]['state']> => {
    const data: IControlUpdate =
      typeof value === 'string' || typeof value === 'number'
        ? { Value: value }
        : typeof value === 'boolean'
          ? { Bool: value }
          : { ...value }

    // Bool is computed so if it's present we need to translate it back to Value
    if (data.Bool !== undefined) {
      data.Value = data.Value !== undefined ? data.Value : +data.Bool // Convert true to 1 and false to 0
    }

    try {
      const [change] = await this.qrcClient.sendRpc('Component.Set', {
        ResponseValues: true,
        Name: this.component.name,
        Controls: [
          {
            ...data,
            Name: this.name // needs to come after ...data in case data has a 'Name' prop
          }
        ]
      })

      this._state = { ...this._state, ...change } as const
    } catch (error) {
      const message = `QRWC: Failed to update component ${this.component.name} control ${this.name} for value ${JSON.stringify(value)}`
      if (error instanceof Error) {
        error.message = message
        this.emit('error', error)
      } else {
        this.emit('error', new Error(`${message}\n${error}`))
      }
    }

    // poll early because we know something just changed and we want the update event
    // (emitting update outside ChangeGroup.Poll will cause a double emit from the next poll)
    await this.changeGroup.poll()

    return this.state
  }

  public close = (): void => {
    this.changeGroup.deregisterControl(this)
    this.removeAllListeners()
    this.logger.debug(
      `Control ${this.name} in component ${this.component.name} closed`
    )
  }
}
