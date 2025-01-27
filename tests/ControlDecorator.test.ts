import { ControlDecorator } from '../src/managers/components/ControlDecorator'
import { IControl } from '../src/index.interface'

describe('ControlDecorator setters', () => {
  let mockControl: IControl
  let controlDecorator: ControlDecorator
  let setComponent: jest.Mock
  let emit: jest.Mock

  beforeEach(() => {
    mockControl = {
      Name: 'TestControl',
      Component: 'TestComponent',
      Position: 1,
      Value: 'TestValue',
      String: 'TestString'
    }

    // Mock functions for updating the control and handling events
    setComponent = jest.fn()
    emit = jest.fn()

    // Initialize the ControlDecorator with the mock control
    controlDecorator = new ControlDecorator(mockControl, setComponent, emit)
  })

  test('should request update with new Position', () => {
    // Set the Position property of the control
    controlDecorator.Position = 2
    // Verify setComponent was called with two arguments
    expect(setComponent).toHaveBeenCalledWith('TestComponent', { Name: 'TestControl', Value: 2 })
  })

  test('should request update with new Value', () => {
    // Set the Value property of the control
    controlDecorator.Value = 'NewValue'
    // Verify setComponent was called with two arguments
    expect(setComponent).toHaveBeenCalledWith('TestComponent', { Name: 'TestControl', Value: 'NewValue' })
  })

  test('should request update with new String', () => {
    // Set the String property of the control
    controlDecorator.String = 'NewString'
    // Verify setComponent was called with two arguments
    expect(setComponent).toHaveBeenCalledWith('TestComponent', { Name: 'TestControl', Value: 'NewString' })
  })
})
