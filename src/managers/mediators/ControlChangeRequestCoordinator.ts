import { ChangeRequestManager, ControlManager } from "..";

export default class ControlChangeRequestCoordinator {

  constructor(
    private controlManager: ControlManager,
    private changeRequestManager: ChangeRequestManager,
  ) {

  }
  // a method for handling control changes
  public handleControlChanges(changes: any): void {
    this.controlManager.handleControlChanges(changes)
  }

  // a method to create a change request
  public createChangeRequest(componentName: string, requestId: string): void {
    this.changeRequestManager.createChangeRequest(componentName, requestId)
  }

  public cleanUp(): void {
    // set controlManager to null
    this.controlManager = null

    // set changeRequestManager to null
    this.changeRequestManager = null
  }
}
