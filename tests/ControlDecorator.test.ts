import { ControlDecorator } from '../src/managers/control/ControlDecorator';
import { IControl } from '../src/index.interface'

describe('ControlDecorator setters', () => {
  let mockControl: IControl;
  let controlDecorator: ControlDecorator;
  let setComponent: jest.Mock;
  let handleEvent: jest.Mock;

  beforeEach(() => {
    mockControl = {
      Name: 'TestControl',
      Component: 'TestComponent',
      Position: 1,
      Value: 'TestValue',
      String: 'TestString'
    };

    // Mock functions for updating the control and handling events
    setComponent = jest.fn();
    handleEvent = jest.fn();

    // Initialize the ControlDecorator with the mock control
    controlDecorator = new ControlDecorator(mockControl, setComponent, handleEvent);
  });

  test('should request update with new Position', () => {
    controlDecorator.Position = 2;
    // Verify setComponent was called with the updated control
    expect(setComponent).toHaveBeenCalledWith(expect.objectContaining({ Position: 2 }));
  });

  test('should request update with new Value', () => {
    controlDecorator.Value = 'NewValue';
    // Verify setComponent was called with the updated control
    // TODO: Set only uses Value & Position may change
    expect(setComponent).toHaveBeenCalledWith(expect.objectContaining({ Value: 'NewValue' }));
  });

  test('should request update with new String', () => {
    controlDecorator.String = 'NewString';
    // Verify setComponent was called with the updated control
    // TODO: Set only uses Value & Position may change
    expect(setComponent).toHaveBeenCalledWith(expect.objectContaining({ Value: 'NewString' }));
  });
});