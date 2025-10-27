import type {
  IControlState,
  IControlEvents,
  ILogger,
  IControlUpdate
} from '../index.interface.js'
import type { ChangeGroup } from './ChangeGroup.js'
import type { Component } from './Component.js'
import type { WebSocketManager } from './WebSocketManager.js'
import { EventEmitter } from '../event/EventEmitter.js'

/**
 * Represents a Q-Sys control element that can be interacted with
 * @extends EventEmitter<IControlEvents>
 */
export class Control extends EventEmitter<IControlEvents> {
  private _state: Omit<IControlState, 'Bool'>

  /**
   * Creates a new Control instance
   */
  private constructor(
    private readonly logger: ILogger,
    private readonly websocketManager: WebSocketManager,
    private readonly changeGroup: ChangeGroup,
    readonly component: Component,
    readonly name: string,
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

  public static async createControl(
    logger: ILogger,
    websocketManager: WebSocketManager,
    changeGroup: ChangeGroup,
    component: Component,
    name: string,
    state: Omit<IControlState, 'Bool'> // Bool is computed so it doesn't need to be provided
  ) {
    const control = new Control(
      logger,
      websocketManager,
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
   * Gets the current state of the control
   * Includes a transient Bool property based on Q-SYS convention
   *
   * @returns {IControlState} The frozen (immutable) current state
   */
  get state(): IControlState {
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
  public async update(
    value: string | number | boolean | IControlUpdate
  ): Promise<IControlState> {
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
      const [change] = await this.websocketManager.sendRpc('Component.Set', {
        ResponseValues: true,
        Name: this.component.name,
        Controls: [
          {
            Name: this.name,
            ...data
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

    /**
     * Emit an update event with the new state
     */
    const state = this.state
    this.emit('update', state)
    return state
  }

  public close() {
    this.changeGroup.deregisterControl(this)
    this.removeAllListeners()
    this.logger.debug(
      `Control ${this.name} in component ${this.component.name} closed`
    )
  }
}
