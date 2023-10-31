import { v4 as uuidv4 } from "uuid"
import { qrcMethods, qrccEvents } from "../../constants"
import { IChangeRequest, IComponent, IControl } from "../../index.interface"
import { EventManager, WebSocketManager } from ".."
import { createJSONRPCMessage } from "../../utils"

export default class ControlManager {
  public components: IComponent = {}
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

  // a method for attaching the websocket manager
  public attachWebSocketManager(websocketManager: WebSocketManager): void {
    // check if websocketManager is defined
    if (this.websocketManager) {
      // emit event for websocket already attached
      this.eventManager.handleEvent(
        qrccEvents.error,
        "web socket already attached"
      )
    }

    // attach websocketManager
    this.websocketManager = websocketManager
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
        // create & format updated control
        const updatedControl = {
          Name: change.Name,
          Value: change.Value,
          Position: change.Position,
          String: change.String
        }

        // update controls
        this.updateControls(updatedControl, change.Component, change.Name)
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
  private updateControls(
    controlToUpdate: IControl,
    componentName: string,
    controlName: string
  ): void {
    // update component
    this.components = {
      ...this.components,
      [componentName]: {
        ...this.components[componentName],
        [controlName]: {
          ...this.components[componentName][controlName],
          ...controlToUpdate
        }
      }
    }

    // create object for event
    const updatedComponent = {
      [componentName]: controlToUpdate
    }

    // emit component updated event
    this.eventManager.handleEvent(qrccEvents.controlsUpdated, updatedComponent)
  }

  // a method for adding a new component to components
  public addComponent(component: IComponent, componentName: string): void {
    // check if component exists
    if (this.components[componentName]) {
      // if component exists, emit error
      this.eventManager.handleEvent(
        qrccEvents.error,
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
    componentName: string,
    controlsToUpdate: IControl[],
  ): void {
    // create change request id
    const requestId = uuidv4()

    const componentChange = {
      Name: componentName,
      Controls: controlsToUpdate
    }

    // create change request
    this.createChangeGroupRequest(
      componentName,
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
        `Change request for ${changeRequest.component} failed`
      )
    }
  }
}
