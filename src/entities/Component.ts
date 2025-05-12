import type { IComponentEvents, IComponentState } from '../index.interface'
import type { ChangeGroup } from './ChangeGroup'
import type { Qrwc } from './Qrwc'
import type { WebSocketManager } from './WebSocketManager'
import { Control } from './Control'
import { EventEmitter } from '../event/EventEmitter'

/**
 * Represents a component in the Q-Sys system with its associated controls
 * @extends EventEmitter<IComponentEvents>
 */
export class Component<
  T extends string = string
> extends EventEmitter<IComponentEvents> {
  // temporary value--overwritten in createComponent
  private _controls: Readonly<Record<T, Control>> = {} as Readonly<
    Record<T, Control>
  >

  /**
   * This constructor is private because this object has an asynchronous
   * construction, and we are using a static async factory method for object
   * instantiation instead.
   */
  private constructor(
    readonly qrwc: Qrwc, // The global Qrwc instance
    readonly name: string,
    readonly state: IComponentState
  ) {
    super()
  }

  /**
   * Asynchronously creates a new Component instance
   * This factory method handles the async initialization process including fetching controls
   */
  public static async createComponent<T extends string = string>(
    websocketManager: WebSocketManager, // The global WebSocketManager instance
    changeGroup: ChangeGroup, // The global ChangeGroup instance
    qrwc: Qrwc, // The global Qrwc instance
    name: string,
    state: IComponentState // grab bag for potentially unknown properties
  ): Promise<Component<T>> {
    const component = new Component(qrwc, name, Object.freeze(state))
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
        const result = await websocketManager.sendRpc('Component.GetControls', {
          Name: name
        })
        return result
      } catch (error) {
        const message = `QRWC: RPC Error: Component.GetControls failed to fetch controls for component ${name}`
        // log error rather than emit b/c client app is still awaiting qrwc factory and can't listen to events
        if (error instanceof Error) {
          error.message = message
          console.error(error)
        } else {
          console.error(new Error(message))
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
          websocketManager,
          changeGroup,
          component,
          control.Name,
          control
        )
      )
    )

    // Freeze the object so it's readonly in javascript too
    component._controls = Object.freeze(
      controls.reduce<Record<string, Control>>((acc, current) => {
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
  get controls(): Readonly<
    Record<T, Control> & Record<string, Control | undefined>
  > {
    return this._controls
  }

  public cleanUp() {
    this.removeAllListeners()
    const controls: Control[] = Object.values(this._controls)
    controls.forEach((control) => control.cleanUp())
  }
}
