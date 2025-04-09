import { v4 as uuidv4 } from 'uuid'
import { qrcMethods } from '../../constants'
import {
  IChange,
  IComponent,
  IControl,
  IControlUpdate
} from '../../index.interface'
import { EventManager, ChangeRequestManager } from '..'
import {
  createJSONRPCMessage,
  isValidControlChange,
  JSONRPCMessage
} from '../../utils'
import { ControlDecorator } from './ControlDecorator'

export default class ControlManager {
  public components: Record<string, IComponent> = {}

  constructor(
    private webSocketSend: (message: JSONRPCMessage) => void,
    private eventManager: EventManager,
    private changeRequestManager: ChangeRequestManager
  ) {}

  public decorateControl(control: IControl): ControlDecorator {
    return new ControlDecorator(
      control,
      this.setComponent.bind(this),
      this.eventManager.emit.bind(this.eventManager)
    )
  }

  // a method for handling changes
  public handleControlChanges(changes: IChange[]): void {
    // if changes is empty, return
    if (changes.length === 0) return
    // iterate through changes
    changes.forEach((change: IChange) => {
      // check if change is valid
      if (!isValidControlChange(change)) {
        // if change is invalid, emit error
        this.eventManager.emit('error', 'Invalid change')
        return
      }

      // find existing control
      const existingControl = this.getControl(change.Component, change.Name)

      // check if existing control exists
      if (existingControl) {
        // if existing control exists, update existing control
        const newControl = this.createUpdatedControl(
          existingControl.getProperties(),
          change
        )

        // update controls
        this.updateControls(newControl)
      } else {
        // emit error
        this.eventManager.emit(
          'error',
          'Connot update Control, existing Control not found'
        )
      }
    })
  }

  // a setter for websocket send method
  public setWebSocketSend(send: (message: JSONRPCMessage) => void): void {
    // check if websocketManager is defined
    if (this.webSocketSend) {
      // emit error
      this.eventManager.emit('error', 'Websocket send already attached')
      return
    }

    this.webSocketSend = send
  }

  // a method for adding a new control to components
  public updateControls(newControl: ControlDecorator): void {
    // update component
    this.components = {
      ...this.components,
      [newControl.Component]: {
        ...this.components[newControl.Component],
        Controls: {
          ...this.components[newControl.Component].Controls,
          [newControl.Name]: newControl
        }
      }
    }

    // emit component updated event
    this.eventManager.emit(
      'controlsUpdated',
      this.components[newControl.Component]
    )
  }

  // a method for adding a new component to components
  public addComponent(component: IComponent, componentName: string): void {
    // check if component exists
    if (this.components[componentName]) {
      // if component exists, emit error
      this.eventManager.emit('error', 'Component already exists')
      return
    }

    // add component to components
    this.components = {
      ...this.components,
      [componentName]: component
    }
  }

  // a method for setting a control values for a components
  public setComponent(
    componentName: string,
    controlToUpdate: IControlUpdate
  ): void {
    // create change request id
    const requestId = uuidv4()

    const componentChange = {
      ResponseValues: true,
      Name: componentName,
      Controls: [controlToUpdate]
    }

    // create change request
    this.changeRequestManager.createChangeRequest(
      componentName,
      requestId,
      this.controlChangeCallback
    )

    // check if webSocketSend is defined
    if (!this.webSocketSend) {
      // if webSocketManager is not defined, emit error
      this.eventManager.emit('error', 'WebSocketManager is not defined')
      return
    }

    // send setControlValue request
    this.webSocketSend(
      createJSONRPCMessage(
        qrcMethods.components.set,
        componentChange,
        requestId
      )
    )
  }

  // callBack for changeRequestManager
  private controlChangeCallback = (changes: IChange[]) => {
    // handle control changes
    this.handleControlChanges(changes)
  }

  // a method for retuning a existing control otherwise undefined
  public getControl(
    componentName: string,
    controlName: string
  ): ControlDecorator | undefined {
    // check if component exists
    if (!this.components[componentName]) {
      // if component does not exist, emit error
      this.eventManager.emit('error', 'Component does not exist')
      return
    }

    // check if control exists
    if (!this.components[componentName].Controls[controlName]) {
      // if control does not exist, emit error
      this.eventManager.emit('error', 'Control does not exist')
      return
    }

    // return control
    return this.components[componentName].Controls[controlName]
  }

  // a method for creating a new decorated control based on both old and updated properties
  public createUpdatedControl(
    oldControl: IControl,
    updatedControl: IControl
  ): ControlDecorator {
    // create new control
    const newControl = { ...oldControl, ...updatedControl }

    // return decorated control
    return new ControlDecorator(
      newControl,
      this.setComponent.bind(this),
      this.eventManager.emit.bind(this.eventManager)
    )
  }

  // a method for returning all component names
  public getComponentNames(): string[] {
    return Object.keys(this.components)
  }

  // a method for returning all control names for a component
  public getControlNamesByComponent(componentName: string): string[] {
    return Object.keys(this.components[componentName])
  }

  // a method for clean up
  public cleanUp() {
    // reset components
    this.components = {}
  }
}
