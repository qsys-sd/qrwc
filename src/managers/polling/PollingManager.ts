import { qrcMethods, qrwcEvents, qrwcPollReset } from '../../constants'
import { IPollingInterval } from '../../index.interface'
import { createJSONRPCMessage } from '../../utils'


export default class PollingManager {
  public minInterval = 34 as const
  private pollInterval: number = 350
  private intervalId: NodeJS.Timer | null = null
  private socketPollId: number = 1
  public changeGroupId: string


  constructor(
    changeGroupId: string,
    private send: (data: object) => void,
    private emit: (event: string, ...args: unknown[]) => void,
    private newPollingRate?: IPollingInterval
  ){
    this.changeGroupId = changeGroupId

    if (this.newPollingRate && this.isValidInterval(newPollingRate)) {
      this.pollInterval = this.newPollingRate
    } else if (this.newPollingRate && !this.isValidInterval(newPollingRate)) {
      this.emitInvalidPollingInterval()
    }
  }

  // getter for polling interval
  get interval(): number {
    return this.pollInterval
  }

  // setter for polling interval
  set interval(interval: number) {
    // set interval if above Minimum interval
    if(interval >= this.minInterval) this.pollInterval = interval
  }

  // check if given polling interval is valid
  private isValidInterval(interval: number): boolean {
    return interval >= this.minInterval
  }

  // a method to start polling
  public start(): void {
    const interval = setInterval(() => this.poll(), this.pollInterval)
    this.intervalId = interval
  }

  // a method to stop polling
  public stop(): void {
    clearInterval(this.intervalId as NodeJS.Timer)
  }

  // a method to poll the server
  private poll(): void {
    this.send(
      createJSONRPCMessage(
        qrcMethods.changeGroup.poll,
        { Id: this.changeGroupId },
        this.socketPollId
      )
    )

    // increment socketPollId
    this.incrementSocketPollId()
  }

  // a method to increment socketPollId
  private incrementSocketPollId(): void {
    this.socketPollId++

    // reset socketPollId after 30 seconds
    const numPollsBeforeReset = Math.floor(qrwcPollReset / this.pollInterval)
    if (this.socketPollId > numPollsBeforeReset) {
      this.socketPollId = 1
    }
  }

  // a method for emitting an error when new polling rate is invalid
  private emitInvalidPollingInterval(): void {
    const errorMessage = `Invalid polling interval of ${this.newPollingRate}, must be greater than or equal to ${this.minInterval}`
    this.emit(qrwcEvents.error, errorMessage)
  }

  // a method to clean up the polling service
  public cleanUp(): void {
    // clear the interval
    clearInterval(this.intervalId as NodeJS.Timer)

    // reset the pollInterval to its initial value
    this.pollInterval = this.minInterval

    // reset the socketPollId
    this.socketPollId = 1

    // replace the send method with a no-op
    this.send = () => {}
  }
}
