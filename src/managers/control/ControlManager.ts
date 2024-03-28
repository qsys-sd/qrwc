import { v4 as uuidv4 } from "uuid"
import { qrcMethods, qrwcEvents } from "../../constants"
import { IComponent, IControl } from "../../index.interface"
import { EventManager, ControlChangeRequestCoordinator, WebSocketManager } from ".."
import { createJSONRPCMessage } from "../../utils"
import { isValidControl } from "../../utils"
import { ControlDecorator } from "./ControlDecorator"

export default class ControlManager {
  public components: IComponent = {}
  private webSocketManager: WebSocketManager
  private controlChangeRequestCoordinator: ControlChangeRequestCoordinator

  constructor(
    private eventManager: EventManager
  ) { }

  // a method for handling changes
  public handleControlChanges(changes: any): void {
    // if changes is empty, return
    if (changes.length === 0) return
    // iterate through changes
    changes.forEach((change: any) => {
      // check if change is valid
      if (!isValidControl(change)) {
        // if change is invalid, emit error
        this.eventManager.handleEvent(qrwcEvents.error, "Invalid change")
        return
      }

      // find existing control
      const existingControl = this.getControl(
        change.Component,
        change.Name
      )

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
        this.eventManager.handleEvent(
          qrwcEvents.error,
          "Connot update Control, existing Control not found"
        )
      }
    })
  }

  // a method to set the ControlChangeRequestCoordinator
  public setControlChangeRequestCoordinator(controlChangeRequestCoordinator: ControlChangeRequestCoordinator): void {
    this.controlChangeRequestCoordinator = controlChangeRequestCoordinator
  }

  // a setter for websocketManager
  public setWebSocketManager(webSocketManager: WebSocketManager): void {
    // check if websocketManager is defined
    if (this.webSocketManager) {
      // emit error
      this.eventManager.handleEvent(
        qrwcEvents.error,
        "Websocket manager already attached"
      )
      return
    }

    this.webSocketManager = webSocketManager
  }

  // a method for adding a new control to components
  private updateControls(newControl: ControlDecorator): void {
    // update component
    this.components = {
      ...this.components,
      [newControl.Component]: {
        ...this.components[newControl.Component],
        [newControl.Name]: newControl
      }
    }

    // create object for event
    const updatedComponent = {
      [newControl.Component]: newControl
    }

    // emit component updated event
    this.eventManager.handleEvent(qrwcEvents.controlsUpdated, updatedComponent)
  }

  // a method for adding a new component to components
  public addComponent(component: IComponent, componentName: string): void {
    // check if component exists
    if (this.components[componentName]) {
      // if component exists, emit error
      this.eventManager.handleEvent(
        qrwcEvents.error,
        "Component already exists"
      )
      return
    }

    // add component to components
    this.components = {
      ...this.components,
      ...component
    }
  }

  // a method for setting a control values for a components
  public setComponent(
    controlToUpdate: IControl,
  ): void {
    // create change request id
    const requestId = uuidv4()

    const componentChange = {
      ResponseValues: true,
      Name: controlToUpdate.Component,
      Controls: [controlToUpdate]
    }

    // create change request
    this.controlChangeRequestCoordinator.createChangeRequest(
      controlToUpdate.Component,
      requestId
    )

    // check if webSocketManager is defined
    if (!this.webSocketManager) {
      // if webSocketManager is not defined, emit error
      this.eventManager.handleEvent(
        qrwcEvents.error,
        "WebSocketManager is not defined"
      )
      return
    }

    // send setControlValue request
    this.webSocketManager.send(
      createJSONRPCMessage(qrcMethods.components.set, componentChange, requestId)
    )
  }

  // a method for retuning a existing control otherwise undefined
  public getControl(componentName: string, controlName: string): ControlDecorator | undefined {
    // check if component exists
    if (!this.components[componentName]) {
      // if component does not exist, emit error
      this.eventManager.handleEvent(
        qrwcEvents.error,
        "Component does not exist"
      )
      return
    }

    // check if control exists
    if (!this.components[componentName][controlName]) {
      // if control does not exist, emit error
      this.eventManager.handleEvent(
        qrwcEvents.error,
        "Control does not exist"
      )
      return
    }

    // return control
    return this.components[componentName][controlName]
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
      this.eventManager.handleEvent.bind(this.eventManager)
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
