import { IChange, IChangeRequest, IServerMessage, IMessageChangeResult, IOnChangeRequest } from '../../index.interface'
import { EventManager } from '..'

export default class ChangeRequestManager {
  private changeRequestIds: IChangeRequest[] = []

  constructor(
    private eventManager: EventManager
  ) {
    this.eventManager.on('message', (message: IServerMessage) => {
      this.parseMessage(message)
    })
  }

  // a method for parsing messages
  private parseMessage(message: IServerMessage): void {
    // if no meesage id return
    if (!message?.id) return

    // get ChangeRequest by id
    const changeRequest = this.findChangeRequestById(message.id)

    // check if changeRequest exists
    if (changeRequest) {
      // handle ChangeRequest
      this.handleChangeRequest(message as IMessageChangeResult, changeRequest)
    }
  }

  // a method to create a request it takes in a component name and request id and a callback function
  public createChangeRequest(componentName: string, requestId: string, onChangeRequest: IOnChangeRequest): void {
    // construct change request object
    const changeRequest = {
      id: requestId,
      component: componentName,
      onChangeRequest
    }

    // add change request to changeRequestIds
    this.addChangeRequest(changeRequest)
  }

  // a method for adding a change request
  private addChangeRequest(changeRequest: IChangeRequest): void {
    this.changeRequestIds = [...this.changeRequestIds, changeRequest]
  }

  // a method for handling change requests
  private handleChangeRequest(message: IMessageChangeResult, changeRequest: IChangeRequest): void {
    // check if change request is successful
    if (message.result) {
      // check if result is an array
      const areChangesArray = this.isArrayNotEmpty(message.result as IChange[])

      // if changes array is empty, return
      if (!areChangesArray) return

      //call the callback function with the changes
      changeRequest.onChangeRequest(message.result)

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
    this.eventManager.emit('changeRequestSuccessful', changeRequest)
  }

  // a method for emitting a failed change request
  private emitFailedChangeRequest(changeRequest: IChangeRequest): void {
    const errorMessage = `Change request for ${changeRequest.component} failed`
    this.eventManager.emit('error', errorMessage)
  }

  // a temp method to check if is array and not emtpy
  private isArrayNotEmpty(array: IChange[]): boolean {
    return Array.isArray(array) && array.length > 0
  }

  // a method for initiating clean up for ChangeChangeRequestManager
  public cleanUp(): void {
    // set eventManager to null
    this.eventManager = null

    // set changeRequestIds to empty array
    this.changeRequestIds = []
  }
}
