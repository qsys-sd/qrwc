import { v4 as uuidv4 } from "uuid"
import { qrcMethods, qrccEvents } from "../../constants"
import { IChangeRequest, IComponent, IControl } from "../../index.interface"
import { EventManager, WebSocketManager } from ".."
import { createJSONRPCMessage } from "../../utils"

export default class ControlManager {
  public components: IComponent[] = []
  private changeGroups: { [changeGroupId: string]: string[] } = {}
  private requestChangeGroupId: string = ""
  private changeGroupRequests: string[] = []
  private changeRequestIds: IChangeRequest[] = []
  eventManager: EventManager
  websocketManager: WebSocketManager

  constructor(eventManager: EventManager, websocketManager: WebSocketManager) {
    // main dependencies
    this.eventManager = eventManager
    this.websocketManager = websocketManager

    // event listener for handling websocket messages
    this.eventManager.on(qrccEvents.message, (message: MessageEvent) => {
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
      // check if change is a component
      if (change.Component) {
        // create & format component for JSON RPC message
        const componentFromChange = {
          Name: change.Component,
          Controls: [
            {
              Name: change.Name,
              Value: change.Value,
              Position: change.Position,
              String: change.String
            }
          ]
        }

        // does the component already exist?
        const existingComponent = this.findComponentByName(componentFromChange.Name)

        // if component already exists, update component
        if (existingComponent) {
          // update component
          this.updatedControls(existingComponent, componentFromChange)
        } else {
          // add component
          this.addComponent(componentFromChange)
        }
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
          qrccEvents.componentChangeGroupCreated,
          this.requestChangeGroupId
        )

        // reset requestChangeGroupId
        this.requestChangeGroupId = ""
      }
    } else {
      // emit error
      this.eventManager.handleEvent(
        qrccEvents.error,
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
        qrccEvents.error,
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

  // a method for finding a component by name
  public findComponentByName(componentName: string): IComponent | undefined {
    // find component
    const component = this.components.find(
      (component: IComponent) => component.Name === componentName
    )

    // return component
    return component
  }

  // a method for getting a control by name
  public getControlByName(
    componentName: string,
    controlName: string
  ): IControl | undefined {
    // find component
    const component = this.findComponentByName(componentName)

    // find control
    const control = component?.Controls.find(
      (control: IControl) => control.Name === controlName
    )

    // return control
    return control
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

    //find component
    const component = this.findComponentByName(componentName)

    // create & format component for message
    const newComponent = {
      Id: changeGroupId,
      Component: {
        Name: componentName,
        Controls: component?.Controls
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
  private updatedControls(
    existingComponent: IComponent,
    componentToUpdate: IComponent
  ): void {
    const controlsToUpdate = componentToUpdate.Controls

    // get existing controls for component
    const existingControls = existingComponent?.Controls

    // iterate through controls to update
    controlsToUpdate.forEach((controlToUpdate: IControl) => {
      // find control to update
      const existingControl = existingControls?.find(
        (control: IControl) => control.Name === controlToUpdate.Name
      )

      // check if control exists
      if (existingControl) {
        // update control
        existingControl.Value = controlToUpdate.Value
        existingControl.Position = controlToUpdate.Position
        existingControl.String = controlToUpdate.String
      } else {
        // add control
        existingControls?.push(controlToUpdate)
      }
    })

    // emit component updated event
    this.eventManager.handleEvent(
      qrccEvents.componentUpdated,
      existingComponent
    )
  }

  public addComponent(component: IComponent): void {
    this.components = [...this.components, component]
  }

  // a method for setting a control values for a components
  public setComponent(componentName: string, controlName: string, controlValues: Omit<IControl, 'Name'>): void {
    // create change request id
    const requestId = uuidv4()

    // find component
    const component = this.findComponentByName(componentName)

    // find control
    const control = this.getControlByName(componentName, controlName)

    // create change request
    this.createChangeGroupRequest(componentName, controlName, control.Type, requestId)

    // update control values
    control.Value = controlValues.Value
    control.Position = controlValues.Position

    // send setControlValue request
    this.websocketManager.send(
      createJSONRPCMessage(qrcMethods.components.set, component, requestId)
    )
  }

  // a method for creating a change request
  public createChangeGroupRequest(
    componentName: string,
    controlName: string,
    controlType: string,
    requestId: string
  ): void {
    // create change request
    const changeRequest = {
      id: requestId,
      component: componentName,
      control: controlName,
      controlType: controlType
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
      // remove change request from changeRequestIds
      this.changeRequestIds = this.changeRequestIds.filter(
        (changeRequest: IChangeRequest) => changeRequest.id !== message.id
      )

      // emit change request successful event
      this.eventManager.handleEvent(
        qrccEvents.changeRequestSuccessful,
        changeRequest
      )
    } else {
      // emit error
      this.eventManager.handleEvent(
        qrccEvents.error,
        `Change request for ${changeRequest.component} - ${changeRequest.control} failed`
      )
    }
  }
}
