import { qrwcEvents } from "../../constants"
import { IChangeRequest } from "../../index.interface"
import { isValidControl } from "../../utils"
import EventManager from "../event/EventManager"
import WebSocketManager from "../webSocket/WebSocketManager"

export default class ChangeRequestManager {
    private changeRequestIds: IChangeRequest[] = [];
  
    constructor(private eventManager: EventManager, private websocketManager: WebSocketManager) {}
  
    public createChangeGroupRequest(componentName: string, requestId: string): void {
      const changeRequest = {
        id: requestId,
        component: componentName,
      }
      this.changeRequestIds = [...this.changeRequestIds, changeRequest]
    }
  
    public handleIncomingMessage(message: any): void {
      const changeRequest = this.changeRequestIds.find(
        (changeRequest: IChangeRequest) => changeRequest.id === message.id
      )
  
      if (message.result) {
        if (Array.isArray(message.result)) {
          if (message.result.length === 0) {
            this.eventManager.handleEvent(
              qrwcEvents.error,
              `Change request for ${changeRequest.component} failed`
            )
            return
          }
  
          message.result.forEach((control: any) => {
            if (!isValidControl(control)) {
              this.eventManager.handleEvent(
                qrwcEvents.error,
                `Invalid control for ${changeRequest.component}`
              )
              return
            }
          })
        }
  
        this.changeRequestIds = this.changeRequestIds.filter(
          (changeRequest: IChangeRequest) => changeRequest.id !== message.id
        )
  
        this.eventManager.handleEvent(
          qrwcEvents.changeRequestSuccessful,
          changeRequest
        )
      } else {
        this.eventManager.handleEvent(
          qrwcEvents.error,
          `Change request for ${changeRequest.component} failed`
        )
      }
    }
  }