import { qrwcEvents } from "../../constants"
import { IChangeRequest } from "../../index.interface"
import { EventManager, ControlChangeRequestCoordinator } from ".."

export default class ChangeRequestManager {
  private changeRequestIds: IChangeRequest[] = [];
  private controlChangeRequestCoordinator: ControlChangeRequestCoordinator

  constructor(
    private eventManager: EventManager
  ) {
    this.eventManager.on(qrwcEvents.message, (message: any) => {
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

  // a method to set the ControlChangeRequestCoordinator
  public setControlChangeRequestCoordinator(controlChangeRequestCoordinator: ControlChangeRequestCoordinator): void {
    this.controlChangeRequestCoordinator = controlChangeRequestCoordinator
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
    const changeRequest = this.findChangeRequestById(message.id)

    // check if change request is successful
    if (message.result) {
      // check if result is an array
      const areChangesArray = this.isArrayNotEmpty(message.result)

      // if changes array is empty, return
      if (!areChangesArray) return

      // changes exist, send to ControlManager for processing
      this.controlChangeRequestCoordinator.handleControlChanges(message.result)

      // remove change request from changeRequestIds
      this.removeChangeRequest(changeRequest.id)

      // emit change request successful event
      this.emitSuccessfulChangeRequest(changeRequest)

    } else {
      // if change request is not successful, emit failed change request
      this.emitFailedChangeRequest(changeRequest)

      // remove change request from changeRequestIds
      this.removeChangeRequest(changeRequest.id)
    }
  }

  // a method for removing change request
  private removeChangeRequest(requestId: string): void {
    this.changeRequestIds = this.changeRequestIds.filter(
      (changeRequest: IChangeRequest) => changeRequest.id !== requestId
    )
  }

  // a method for finding change request by id
  private findChangeRequestById(requestId: string): IChangeRequest {
    return this.changeRequestIds.find(
      (changeRequest: IChangeRequest) => changeRequest.id === requestId
    )
  }

  // a method for emitting a successful change request
  private emitSuccessfulChangeRequest(changeRequest: IChangeRequest): void {
    this.eventManager.handleEvent(qrwcEvents.changeRequestSuccessful, changeRequest)
  }

  // a method for emitting a failed change request
  private emitFailedChangeRequest(changeRequest: IChangeRequest): void {
    const errorMessage = `Change request for ${changeRequest.component} failed`
    this.eventManager.handleEvent(qrwcEvents.error, errorMessage)
  }

  // a temp method to check if is array and not emtpy
  private isArrayNotEmpty(array: any[]): boolean {
    return Array.isArray(array) && array.length > 0
  }

  // a method for initiating clean up for ChangeRequestManager
  public cleanUp(): void {
    // set eventManager to null
    this.eventManager = null

    // set controlChangeRequestCoordinator to null
    this.controlChangeRequestCoordinator = null

    // set changeRequestIds to empty array
    this.changeRequestIds = []
  }
}