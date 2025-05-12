import { EventEmitter } from '../src/event/EventEmitter'

describe('EventManager', () => {
  let eventEmitter: EventEmitter<any>

  beforeEach(async () => {
    eventEmitter = new EventEmitter()
  })

  it('should allow subscription to and emission of events', () => {
    const mockCallback = jest.fn()
    const eventName = 'message'
    const eventData = {
      jsonrpc: '2.0',
      result: true
    } as const

    eventEmitter.on(eventName, mockCallback)
    eventEmitter.emit(eventName, eventData)

    expect(mockCallback).toHaveBeenCalledWith(eventData)
  })

  it('should allow removal of a specific event listener', () => {
    const mockCallback = jest.fn()
    const eventName = 'message'

    eventEmitter.on(eventName, mockCallback)
    eventEmitter.removeListener(eventName, mockCallback)
    eventEmitter.emit(eventName, {
      jsonrpc: '2.0',
      result: true
    })

    expect(mockCallback).not.toHaveBeenCalled()
  })

  it('should remove all event listeners', async () => {
    const mockCallback1 = jest.fn()
    const mockCallback2 = jest.fn()
    const eventName1 = 'message'
    const eventName2 = 'message'

    eventEmitter.on(eventName1, mockCallback1)
    eventEmitter.on(eventName2, mockCallback2)

    eventEmitter.removeAllListeners()

    eventEmitter.emit(eventName1, {
      jsonrpc: '2.0',
      result: true
    })
    eventEmitter.emit(eventName2, {
      jsonrpc: '2.0',
      result: true
    })

    expect(mockCallback1).not.toHaveBeenCalled()
    expect(mockCallback2).not.toHaveBeenCalled()
  })
})
