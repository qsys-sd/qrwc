import type {
  IComponentEvents,
  IComponentGetComponentsResult,
  IComponentState,
  ILogger,
  IQrwcExpandedGenericParameter,
  ReadOnlyControl
} from '../index.interface.js'
import type { ChangeGroup } from './ChangeGroup.js'
import type { Qrwc } from './Qrwc.js'
import type { QrcClient } from '../connection/QrcClient.js'
import { Control } from './Control.js'
import { EventEmitter } from '../event/EventEmitter.js'

/**
 * Represents a component in the Q-Sys system with its associated controls
 * @extends EventEmitter<IComponentEvents>
 */
export class Component<
  T extends IQrwcExpandedGenericParameter,
  U extends keyof T['components']
> extends EventEmitter<IComponentEvents<T, U>> {
  // temporary value--overwritten in createComponent
  private _controls: Readonly<Record<string, Control<T, U, string>>> = {}

  /**
   * This constructor is private because this object has an asynchronous
   * construction, and we are using a static async factory method for object
   * instantiation instead.
   */
  private constructor(
    private readonly logger: ILogger,
    private readonly _state: Readonly<IComponentGetComponentsResult>,
    readonly qrwc: Qrwc<T>, // The global Qrwc instance
    readonly name: U & string
  ) {
    super()
    logger.debug(`Component ${name} created.`)
  }

  /**
   * Asynchronously creates a new Component instance
   * This factory method handles the async initialization process including fetching controls
   */
  public static async createComponent<
    T extends IQrwcExpandedGenericParameter,
    U extends keyof T['components']
  >(
    logger: ILogger,
    qrcClient: QrcClient, // The global QrcClient instance
    changeGroup: ChangeGroup<T>, // The global ChangeGroup instance
    qrwc: Qrwc<T>, // The global Qrwc instance
    name: U & string,
    state: IComponentGetComponentsResult
  ): Promise<Component<T, U>> {
    const component = new Component<T, U>(
      logger,
      Object.freeze(state),
      qrwc,
      name
    )
    // Propagate events downwards. Control -> Component -> Qrwc
    component.on('update', (control, state) => {
      qrwc.emit('update', component, control, state)
    })
    component.on('error', (error) => {
      qrwc.emit('error', error)
    })

    // Populate the controls for the component
    const getResult = await (async () => {
      try {
        const result = await qrcClient.sendRpc('Component.GetControls', {
          Name: name
        })
        return result
      } catch (error) {
        const message = `QRWC: Failed to fetch controls for component ${name}`
        // log error rather than emit b/c client app is still awaiting qrwc factory and can't listen to events
        if (error instanceof Error) {
          error.message = message
          logger.error(error)
        } else {
          logger.error(new Error(message))
        }
        return {
          Name: name,
          Controls: []
        }
      }
    })()

    const controls = await Promise.all(
      getResult.Controls.map((control) =>
        Control.createControl(
          logger,
          qrcClient,
          changeGroup,
          component,
          control.Name,
          control
        )
      )
    )

    // Freeze the object so it's readonly in javascript too
    component._controls = Object.freeze(
      controls.reduce<Record<string, Control<T, U, string>>>((acc, current) => {
        acc[current.name] = current
        return acc
      }, {})
    )

    return component
  }

  /**
   * Get the controls associated with this component
   * @returns {Readonly<Record<string, Control>>} A read-only record of controls, keyed by control name
   * @public
   */
  get controls(): Readonly<{
    [V in keyof T['components'][U]['controls']]: T['components'][U]['controls'][V]['state']['Direction'] extends 'Read Only'
      ? string extends V
        ? ReadOnlyControl<T, U, V> | undefined
        : ReadOnlyControl<T, U, V>
      : string extends V
        ? Control<T, U, V> | undefined
        : Control<T, U, V>
  }> {
    return this._controls as Readonly<{
      [V in keyof T['components'][U]['controls']]: Control<T, U, V>
    }>
  }

  /**
   * Cached copy of everything QRWC has received for this component.
   *
   * @returns {IComponentState} The frozen (immutable) current state
   */
  get state(): IComponentState<T['components'][U]['controls']> {
    return Object.freeze({
      ...this._state,
      Controls: Object.freeze(
        Object.values(this._controls).map((control) => control.state)
      )
    })
  }

  public close = (): void => {
    const controls: Control<T, U, string>[] = Object.values(this._controls)
    controls.forEach((control) => control.close())
    this.removeAllListeners()
    this.logger.debug(`Component ${this.name} closed.`)
  }
}
