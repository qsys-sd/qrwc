import { qrwcEvents } from "../../constants"
import { IChangeRequest } from "../../index.interface"
import { ControlManager, EventManager } from ".."

export default class ChangeRequestManager {
  private changeRequestIds: IChangeRequest[] = [];

  constructor(
    private eventManager: EventManager,
    private controlManager: ControlManager
  ) {
    this.eventManager.on(qrwcEvents.message, (message: MessageEvent) => {
      this.parseMessage(message)
    })
  }

  // a method for parsing messages
  private parseMessage(message: any): void {
    const existingChangeRequestIds = this.changeRequestIds.map(
      (changeRequest: IChangeRequest) => changeRequest.id
    )
    // check message id for ChangeRequest id
    if (message?.id && existingChangeRequestIds.includes(message?.id)) {
      // if message id includes ChangeRequest id, handle ChangeRequest
      this.handleChangeRequest(message)
    }
  }

  public createChangeRequest(componentName: string, requestId: string): void {
    const changeRequest = {
      id: requestId,
      component: componentName,
    }
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
      // move logic into separate method to be removed later
      if (Array.isArray(message.result)) { // TODO: Remove once QRC is updated
        // check if array is empty & throw error
        if (message.result.length === 0) {
          this.eventManager.handleEvent(
            qrwcEvents.error,
            `Change request for ${changeRequest.component} failed`
          )
          return
        }

        // changes exist, send to ControlManager for processing
        this.controlManager.handleControlChanges(message.result)
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

  // a method for initiating clean up for ChangeRequestManager
  public cleanUp(): void {
    // set eventManager to null
    this.eventManager = null

    // set controlManager to null
    this.controlManager = null

    // set changeRequestIds to empty array
    this.changeRequestIds = []
  }
}