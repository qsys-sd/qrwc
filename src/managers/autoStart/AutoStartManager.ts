import { v4 as uuidv4 } from "uuid"
import { qrcMethods, qrccEvents } from "../../constants"
import { createJSONRPCMessage } from "../../utils"
import { IResultComponent } from "../../index.interface"
import { WebSocketManager, ControlManager, EventManager } from ".."

export default class AutoStartManager {
  private webSocketManager: WebSocketManager
  private getComponentsId: string = ""
  private componentList: string[] = []
  private getControlIds: string[] = []
  private autoStartChangeGroupId: string = ""
  controlManager: ControlManager
  eventManager: EventManager

  constructor(
    webSocketManager: WebSocketManager,
    controlManager: ControlManager,
    eventManager: EventManager
  ) {
    // main dependencies
    this.webSocketManager = webSocketManager
    this.controlManager = controlManager
    this.eventManager = eventManager

    // auto start
    this.webSocketManager.connect()

    //event listener for handling websocket messages
    this.eventManager.on(qrccEvents.message, (message: MessageEvent) => {
      this.parseMessage(message)
    })

    // event listeners auto start flow
    this.eventManager.on(qrccEvents.connected, () => {
      this.getComponents()
    })

    this.eventManager.on(qrccEvents.componentsRecieved, () => {
      this.getControls()
    })

    this.eventManager.on(qrccEvents.controlsRecieved, () => {
      this.createChangeGroup()
    })

    // listen for change group created event
    this.eventManager.on(
      qrccEvents.componentChangeGroupCreated,
      (changeGroupId: string) => {
        // check if change group id matches autoStartChangeGroupId
        if (changeGroupId === this.autoStartChangeGroupId) {
          // if change group id matches autoStartChangeGroupId, start polling
          this.webSocketManager.startPolling(this.autoStartChangeGroupId)
        }
      }
    )
  }

  // a method for parsing messages
  private parseMessage(message: any): void {
    // check for getComponents response
    if (message?.id === this.getComponentsId) {
      this.handleComponentGetResponse(message.result)
    }

    // check for getControls response
    if (this.getControlIds.includes(message?.id)) {
      this.handleControlGetResponse(message.result, message.id)
    }
  }

  // a method for getting components
  private getComponents(): void {
    // create id for getComponents request
    this.getComponentsId = uuidv4()

    // send getComponents request for all components
    this.webSocketManager.send(
      createJSONRPCMessage(
        qrcMethods.components.getComponents,
        "test",
        this.getComponentsId
      )
    )
  }

  // a method for handling getComponents response
  private handleComponentGetResponse(result: any) {
    // iterate through components in response
    result.forEach((component: any) => {
      // check if component is not already in componentList
      if (!this.componentList.includes(component.Name)) {
        // add component to componentList
        this.componentList = [...this.componentList, component.Name]
      }
    })

    // emit event when all components have been added to componentList
    this.eventManager.handleEvent(qrccEvents.componentsRecieved)

    // reset getComponentsId
    this.getComponentsId = ""
  }

  // a method for getting controls
  private getControls(): void {
    // iterate through components list
    this.componentList.forEach((component: string) => {
      const id = uuidv4()
      // send getControls request for each component with id
      this.webSocketManager.send(
        createJSONRPCMessage(
          qrcMethods.components.getControls,
          { Name: component },
          id
        )
      )
      // add id to getControlIds
      this.getControlIds = [...this.getControlIds, id]
    })
  }

  // a method for handling getControls response
  private handleControlGetResponse(result: IResultComponent, id: string) {
    // check if the results has "Name" and "Controls" populated
    if (result?.Name && result?.Controls) {
      // add component to this.components in ControlManager
      this.controlManager.addComponent(result)
    }

    // remove id from getControlIds
    this.getControlIds = this.getControlIds.filter(
      (getId: string) => getId !== id
    )

    // check if getControlIds is empty
    if (this.getControlIds.length === 0) {
      // emit event
      this.eventManager.handleEvent(qrccEvents.controlsRecieved)
    }
  }

  // a method for creating change groups
  private createChangeGroup(): void {
    // create change group id
    const changeGroupId = uuidv4()

    // set autoStartChangeGroupId
    this.autoStartChangeGroupId = changeGroupId

    // create change group from component controls
    this.controlManager.createChangeGroup(this.componentList, changeGroupId)
  }
}
