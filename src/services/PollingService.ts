import { qrcMethods } from "../constants"
import { createJSONRPCMessage } from "../utils";


export default class PollingService {
  private minInterval: number = 350;
  private pollInterval: number = 350;
  private intervalId: NodeJS.Timer | null = null;
  private socketPollId: number = 1;
  public changeGroupId: string;


  constructor(
    changeGroupId: string,
    private send: (data: object) => void
  ){
    this.changeGroupId = changeGroupId;
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


  // a method to start polling
  public start(): void {
    const interval = setInterval(() => this.poll(), this.pollInterval)
    this.intervalId = interval
  }


  // a method to stop polling
  public stop(): void {
    this.clearInterval()
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
    const numPollsBeforeReset = Math.floor(30000 / this.pollInterval)
    if (this.socketPollId > numPollsBeforeReset) {
      this.socketPollId = 1
    }
  }


  // a method to clear interval
  private clearInterval(): void {
    if (this.intervalId) {
      this.intervalId = null
    }
  }

  // a method to clean up the polling service
  public cleanUp(): void {
    // clear the interval
    this.clearInterval();
  
    // reset the pollInterval to its initial value
    this.pollInterval = this.minInterval;
  
    // reset the socketPollId
    this.socketPollId = 1;

    // replace the send method with a no-op
    this.send = () => {};
  }
}