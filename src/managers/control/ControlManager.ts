import { v4 as uuidv4 } from "uuid"
import { qrcMethods, qrwcEvents } from "../../constants"
import { IChangeRequest, IComponent, IControl } from "../../index.interface"
import { EventManager, WebSocketManager } from ".."
import { createJSONRPCMessage } from "../../utils"
import { isValidControl } from "../../utils"
import { ControlDecorator } from "./ControlDecorator"

export default class ControlManager {
  public components: IComponent = {}
  private changeGroups: { [changeGroupId: string]: string[] } = {}
  private requestChangeGroupId: string = ""
  private changeGroupRequests: string[] = []
  private changeRequestIds: IChangeRequest[] = []
  eventManager: EventManager
  websocketManager: WebSocketManager

  constructor(eventManager: EventManager) {
    // main dependencies
    this.eventManager = eventManager

    // event listener for handling websocket messages
    this.eventManager.on(qrwcEvents.message, (message: MessageEvent) => {
      this.parseMessage(message)
    })
  }

  // a method for parsing messages
  private parseMessage(message: any): void {
    // check if id exists & includes change group request
    if (message?.id && this.changeGroupRequests.includes(message?.id)) {
      // if id exists & includes change group request, handle change group response
      this.handleChangeGroupResponse(message)
    }

    // get list of existing change group ids
    const existingChangeGroupIds = Object.keys(this.changeGroups)
    // check message for Changes & if message id is included in componentChangeGroupIds
    if (
      message?.result?.Changes &&
      existingChangeGroupIds.includes(message?.result?.Id)
    ) {
      // if message has Changes, handle Changes
      this.handleChanges(message?.result?.Changes)
    }

    // get list of existing change request ids
    const existingChangeRequestIds = this.changeRequestIds.map(
      (changeRequest: IChangeRequest) => changeRequest.id
    )
    // check message id for ChangeRequest id
    if (message?.id && existingChangeRequestIds.includes(message?.id)) {
      // if message id includes ChangeRequest id, handle ChangeRequest
      this.handleChangeRequest(message)
    }
  }

  // a method for handling changes
  private handleChanges(changes: any): void {
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

  // a method for handling change group responses
  private handleChangeGroupResponse(message: any): void {
    // check if change group response is successful
    if (message.result) {
      // remove request id from changeGroupRequests
      this.changeGroupRequests = this.changeGroupRequests.filter(
        (requestId: string) => requestId !== message.id
      )

      // if change group requests is empty, emit change group created event
      if (this.changeGroupRequests.length === 0) {
        this.eventManager.handleEvent(
          qrwcEvents.componentChangeGroupCreated,
          this.requestChangeGroupId
        )

        // reset requestChangeGroupId
        this.requestChangeGroupId = ""
      }
    } else {
      // emit error
      this.eventManager.handleEvent(
        qrwcEvents.error,
        "Change group request failed"
      )
    }
  }

  // a method for creating change groups
  public createChangeGroup(
    componentNames: string[],
    changeGroupId: string
  ): void {
    // get list of existing change group ids
    const existingChangeGroupIds = Object.keys(this.changeGroups)
    // check for existing change group id
    if (existingChangeGroupIds.includes(changeGroupId)) {
      // if change group id exists, emit error
      this.eventManager.handleEvent(
        qrwcEvents.error,
        "Change group id already exists"
      )
      return
    }

    // save change group id to requestChangeGroupId
    this.requestChangeGroupId = changeGroupId

    // add change group to list of change groups
    this.changeGroups = {
      ...this.changeGroups,
      [changeGroupId]: componentNames
    }

    // iterate through component names
    componentNames.forEach((componentName: string) => {
      // add component to change group
      this.addComponentToChangeGroup(componentName, changeGroupId)
    })
  }

  // a method for adding components to change groups
  private addComponentToChangeGroup(
    componentName: string,
    changeGroupId: string
  ): void {
    // create request id
    const requestId = uuidv4()
    // add request id to changeGroupRequests
    this.changeGroupRequests = [...this.changeGroupRequests, requestId]

    // create control names array of objects
    const controlNames = Object.keys(this.components[componentName]).map(
      (controlName: string) => {
        return { Name: controlName }
      }
    )

    // create & format component for message
    const newComponent = {
      Id: changeGroupId,
      Component: {
        Name: componentName,
        Controls: controlNames
      }
    }

    // send addComponentControl request
    this.websocketManager.send(
      createJSONRPCMessage(
        qrcMethods.changeGroup.addComponentControl,
        newComponent,
        requestId
      )
    )
  }

  // a method that returns updated controls
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
    this.createChangeGroupRequest(
      controlToUpdate.Component,
      requestId
    )

    // send setControlValue request
    this.websocketManager.send(
      createJSONRPCMessage(qrcMethods.components.set, componentChange, requestId)
    )
  }

  // a method for creating a change request
  public createChangeGroupRequest(
    componentName: string,
    requestId: string
  ): void {
    // create change request
    const changeRequest = {
      id: requestId,
      component: componentName,
    }

    // add change request to changeRequestIds
    this.changeRequestIds = [...this.changeRequestIds, changeRequest]
  }

  // a method for handling change requests
  public handleChangeRequest(message: any): void {
    // get change request
    const changeRequest = this.changeRequestIds.find(
      (changeRequest: IChangeRequest) => changeRequest.id === message.id
    )

    // check if change request is successful
    if (message.result) {
      // check if result is an array
      if (Array.isArray(message.result)) { // TODO: Remove once QRC is updated
        // check if array is empty & throw error
        if (message.result.length === 0) {
          this.eventManager.handleEvent(
            qrwcEvents.error,
           `Change request for ${changeRequest.component} failed`
          )
          return
        }

        // iterate through array, validate controls, and update controls & throw error if invalid
        message.result.forEach((control: any) => {
          if (!isValidControl(control)) {
            this.eventManager.handleEvent(
              qrwcEvents.error,
              `Invalid control for ${changeRequest.component}`
            )
            return
          }

          // find existing control
          const existingControl = this.getControl(
            control.Component,
            control.Name
          )

          // check if existing control exists
          if (existingControl) {
            // if existing control exists, update existing control
            const newControl = this.createUpdatedControl(
              existingControl.getProperties(),
              control
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

      // remove change request from changeRequestIds
      this.changeRequestIds = this.changeRequestIds.filter(
        (changeRequest: IChangeRequest) => changeRequest.id !== message.id
      )

      // emit change request successful event
      this.eventManager.handleEvent(
        qrwcEvents.changeRequestSuccessful,
        changeRequest
      )
    } else {
      // emit error
      this.eventManager.handleEvent(
        qrwcEvents.error,
        `Change request for ${changeRequest.component} failed`
      )
    }
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

  // a method for clean up 
  public cleanUp() {
    // reset components
    this.components = {}

    // reset change groups
    this.changeGroups = {}

    // reset requestChangeGroupId
    this.requestChangeGroupId = ""

    // reset changeGroupRequests
    this.changeGroupRequests = []

    // reset changeRequestIds
    this.changeRequestIds = []
  }
}
