import FrontendEventEmitter from '../src/managers/event/FrontendEvents'

describe('FrontendEventEmitter', () => {
  let frontendEventEmitter: FrontendEventEmitter

  beforeEach(() => {
    frontendEventEmitter = new FrontendEventEmitter()
  })

  it('should allow subscription to and emission of events', () => {
    const mockCallback = jest.fn()
    const eventName = 'testEvent'
    const eventData = { key: 'value' }

    frontendEventEmitter.on(eventName, mockCallback)
    frontendEventEmitter.emit(eventName, eventData)

    expect(mockCallback).toHaveBeenCalledWith(eventData)
  })

  it('should allow removal of a specific event listener', () => {
    const mockCallback = jest.fn()
    const eventName = 'testEvent'

    frontendEventEmitter.on(eventName, mockCallback)
    frontendEventEmitter.removeListener(eventName, mockCallback)
    frontendEventEmitter.emit(eventName)

    expect(mockCallback).not.toHaveBeenCalled()
  })

  it('should remove all event listeners', () => {
    const mockCallback1 = jest.fn()
    const mockCallback2 = jest.fn()
    const eventName1 = 'testEvent1'
    const eventName2 = 'testEvent2'

    frontendEventEmitter.on(eventName1, mockCallback1)
    frontendEventEmitter.on(eventName2, mockCallback2)
    frontendEventEmitter.removeAllListeners()
    frontendEventEmitter.emit(eventName1)
    frontendEventEmitter.emit(eventName2)

    expect(mockCallback1).not.toHaveBeenCalled()
    expect(mockCallback2).not.toHaveBeenCalled()
  })
})