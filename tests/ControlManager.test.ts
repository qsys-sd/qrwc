import {
  ControlManager,
  EventManager,
  ChangeRequestManager
} from '../src/managers'
import { ControlDecorator } from '../src/managers/components/ControlDecorator'
import { IComponent, IControl } from '../src/index.interface'

jest.mock('../src/managers/event/EventManager')
jest.mock('../src/managers/qsys/ChangeRequestManager')
jest.mock('../src/managers/webSocket/WebSocketManager')

describe('ControlManager', () => {
  let controlManager: ControlManager
  let webSocketSend: jest.Mock
  let mockEventManager: EventManager
  let mockChangeRequestManager: ChangeRequestManager

  beforeEach(() => {
    mockEventManager = new EventManager()

    webSocketSend = jest.fn()

    mockChangeRequestManager = new ChangeRequestManager(mockEventManager)

    controlManager = new ControlManager(
      webSocketSend,
      mockEventManager,
      mockChangeRequestManager
    )
  })

  it('should add a new control', () => {
    const mockComponent: IComponent = {
      Name: 'TestComponent',
      Controls: null,
      Properties: [],
      Type: 'TestType',
      ControlSource: 1,
      ID: 'TestID'
    }
    controlManager.addComponent(mockComponent, 'TestComponent')

    const mockControl: IControl = {
      Name: 'TestControl',
      Component: 'TestComponent',
      Position: 1,
      Value: 'TestValue',
      String: 'TestString'
    }
    const newControl = new ControlDecorator(mockControl, jest.fn(), jest.fn())

    // Use type assertion to access private method
    const controlManagerWithPrivateMethods = controlManager as unknown as {
      updateControls: (control: ControlDecorator) => void
    }
    controlManagerWithPrivateMethods.updateControls(newControl)

    const retrievedControl = controlManager.getControl(
      'TestComponent',
      'TestControl'
    )
    expect(retrievedControl).toBeDefined()
    expect(retrievedControl).toBeInstanceOf(ControlDecorator)
    expect(retrievedControl).toEqual(newControl)
  })

  it('should return undefined for a non-existent control', () => {
    const control = controlManager.getControl(
      'NonExistentComponent',
      'NonExistentControl'
    )
    expect(control).toBeUndefined()
  })
})
