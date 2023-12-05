// Imports
import { IControl } from '../../index.interface'
import { qrccEvents } from "../../constants"

/**
 * ControlDecorator class
 * 
 * This class is used to decorate an Control object, providing getters and setters for its properties.
 * The decorator pattern allows us to add new behavior or responsibilities to objects without modifying their code.
 * This class also provides a method to update the control using a provided function and a method to handle events.
 * 
 * The updateControl method is used to update a property on the control and triggers an update request of the parent component.
 * The getMetaProperty method returns the value of a requested property, or undefined if the property does not exist.
 * If the property does not exist, an error event is also emitted.
 */
export class ControlDecorator {
  // Private property to hold the control
  private control: IControl

  // Private property to hold the function to update the control
  private setComponent: (controlToUpdate: IControl) => void

  // Private property to hold the function to handle events
  private handleEvent: (event: string, data?: any) => void

  /**
   * ControlDecorator constructor
   * @param control - The control to decorate
   * @param setComponent - The function to use to update the control
   * @param handleEvent - The function to handle events
   */
  constructor(control: IControl, setComponent: (controlToUpdate: IControl) => void, handleEvent: (event: string, data?: any) => void) {
    this.control = control
    this.setComponent = setComponent
    this.handleEvent = handleEvent
  }

  // Getter for the Name property of the control
  get Name(): string {
    return this.control.Name
  }

  // Getter for the Component property of the control
  get Component(): string {
    return this.control.Component
  }

  // Getter and setter for the Value property of the control
  get Value(): string | number | boolean | undefined {
    return this.control.Value
  }

  set Value(value: string | number | boolean | undefined) {
    this.updateControl('Value', value);
  }

  // Getter and setter for the String property of the control
  get String(): string | undefined {
    return this.control.String
  }

  set String(string: string | undefined) {
    this.updateControl('String', string);
  }

  // Getter and setter for the Position property of the control
  get Position(): number | undefined {
    return this.control.Position
  }

  set Position(position: number | undefined) {
    this.updateControl('Position', position);
  }

  // Getter for the Type property of the control
  get Type(): string | undefined {
    return this.control.Type
  }

  /**
   * Updates a property on the control and triggers an update request of the parent component.
   * 
   * @param property - The name of the property to update.
   * @param value - The new value for the property.
   */
  private updateControl(property: keyof IControl, value: any): void {
    if (!(property in this.control)) {
      this.handleEvent(qrccEvents.error, `Property ${property} does not exist on the control: ${this.control.Name}`);
      return;
    }
  
    const expectedType = typeof this.control[property];
    const valueType = typeof value;
  
    if (expectedType !== valueType) {
      this.handleEvent(qrccEvents.error, `Type mismatch for property ${property}. Expected ${expectedType}, got ${valueType}`);
      return;
    }
  
    const updatedControl = { ...this.control, [property]: value };
    this.setComponent(updatedControl);
  }

  /**
   * Gets a property from the control that is not defined in the IControl interface.
   * 
   * If the property does not exist, an error event is emitted and the function execution ends.
   * 
   * @param propertyName - The name of the property to get.
   * @returns The value of the property, or undefined if the property does not exist.
   */
  public getMetaProperty(propertyName: string): any | undefined {
    if (!this.control.hasOwnProperty(propertyName)) {
      this.handleEvent(qrccEvents.error, `Property ${propertyName} does not exist on the control: ${this.control.Name}`);
      return;
    }
    return this.control[propertyName];
  }
}