import { v4 as uuidv4 } from "uuid"
import { qrcMethods, qrccEvents } from "../../constants"
import { IComponent, IResultComponent } from "../../index.interface"
import { EventManager, WebSocketManager } from ".."
import { createJSONRPCMessage } from "../../utils"

export default class ControlManager {
  public components: IComponent = {}
  private changeGroups: { [changeGroupId: string]: string[] } = {}
  private requestChangeGroupId: string = ""
  private changeGroupRequests: string[] = []
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

    // event listerners
    this.eventManager.on(qrccEvents.componentUpdated, (component: any) => {
      console.log("component updated", component)
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
    if (message?.result?.Changes && existingChangeGroupIds.includes(message?.result?.Id)) {
      // if message has Changes, handle Changes
      this.handleChanges(message?.result?.Changes)
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
        const component = {
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

        // update component
        this.updateComponent(component)
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

    // create & format component for JSON RPC message
    const newComponent = {
      Id: changeGroupId,
      Component: {
        Name: componentName,
        Controls: this.components[componentName]
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

  // a method for updating a component & its controls
  public updateComponent(component: IResultComponent): void {
    // check if component exists
    if (this.components[component.Name]) {
      // if component exists, update component
      this.components = {
        ...this.components,
        [component.Name]: component.Controls
      }

      // emit component updated event
      this.eventManager.handleEvent(qrccEvents.componentUpdated, component)

    } else {
      // emit error
      this.eventManager.handleEvent(
        qrccEvents.error,
        "Component does not exist"
      )
    }
  }

  public addComponent(component: IResultComponent): void {
    // check if component already exists
    if (this.components[component.Name]) {
      // if component exists, update existing component
      this.updateComponent(component)
    } else {
      // if component does not exist, add component
      this.components = {
        ...this.components,
        [component.Name]: component.Controls
      }
    }
  }
}
