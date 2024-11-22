import EventManager from '../src/managers/event/EventManager'

describe('EventManager', () => {
  let eventManager: EventManager

  beforeEach( async () => {
    eventManager = new EventManager()
    await eventManager.initializeEmitter()
  })

  it('should allow subscription to and emission of events', () => {
    const mockCallback = jest.fn()
    const eventName = 'testEvent'
    const eventData = { key: 'value' }

    eventManager.on(eventName, mockCallback)
    eventManager.emit(eventName, eventData)

    expect(mockCallback).toHaveBeenCalledWith(eventData)
  })

  it('should allow removal of a specific event listener', () => {
    const mockCallback = jest.fn()
    const eventName = 'testEvent'

    eventManager.on(eventName, mockCallback)
    eventManager.removeListener(eventName, mockCallback)
    eventManager.emit(eventName)

    expect(mockCallback).not.toHaveBeenCalled()
  })

  it('should remove all event listeners', async () => {
    const mockCallback1 = jest.fn()
    const mockCallback2 = jest.fn()
    const eventName1 = 'testEvent1'
    const eventName2 = 'testEvent2'

    eventManager.on(eventName1, mockCallback1)
    eventManager.on(eventName2, mockCallback2)

    eventManager.removeAllEventListeners()

    eventManager.emit(eventName1)
    eventManager.emit(eventName2)

    expect(mockCallback1).not.toHaveBeenCalled()
    expect(mockCallback2).not.toHaveBeenCalled()
  })
})
