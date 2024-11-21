// Imports
import { IControl } from '../../index.interface'
import { qrwcEvents } from "../../constants"

/**
 * ControlDecorator class
 * 
 * This class is used to decorate an Control object, providing getters and setters for its properties.
 * The decorator pattern allows us to add new behavior or responsibilities to objects without modifying their code.
 * This class also provides a method to update the control using a provided function and a method to handle events.
 * 
 * The updateQsysDesign method is used to update a property on the control and triggers an update request of the parent component.
 * The getMetaProperty method returns the value of a requested property, or undefined if the property does not exist.
 * If the property does not exist, an error event is also emitted.
 */
export class ControlDecorator {
  // Private property to hold the control
  private control: IControl

  // Private property to hold the function to update the control
  private setComponent: (controlToUpdate: IControl) => void

  // Private property to hold the function to handle events
  private emit: (event: string, message?: string) => void

  /**
   * ControlDecorator constructor
   * @param control - The control to decorate
   * @param setComponent - The function to use to update the control
   * @param emit - The function to handle events
   */
  constructor(control: IControl, setComponent: (controlToUpdate: IControl) => void, emit: (event: string, message?: string) => void) {
    this.control = control
    this.setComponent = setComponent
    this.emit = emit
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
    this.updateQsysDesign('Value', value);
  }

  // Getter and setter for the String property of the control
  get String(): string | undefined {
    return this.control.String
  }

  set String(string: string | undefined) {
    this.updateQsysDesign('String', string); // TODO: Set only uses Value & Position may change
  }

  // Getter and setter for the Position property of the control
  get Position(): number | undefined {
    return this.control.Position
  }

  set Position(position: number | undefined) {
    this.updateQsysDesign('Position', position);
  }

  /**
   * Getter for Bool.
   * This getter first checks if the Type property is 'Boolean'.
   * If the Type is not 'Boolean', it emits an error event and returns.
   * If the Type is 'Boolean', it checks if the Position property is 0.5 or greater.
   * @returns {boolean} True if Position is 0.5 or greater, false otherwise.
   * If the Type is not 'Boolean', it returns undefined.
   */
  get Bool(): boolean | undefined {
    if (this.Type !== 'Boolean') {
      this.emit(qrwcEvents.error, `Type mismatch for property Bool. This control is Type ${this.Type}`);
      return undefined;
    }

    return this.control.Position >= 0.5;
  }

  /**
   * Setter for Bool.
   * This setter checks if the value is a boolean and if the Type is 'Boolean' before updating the Position.
   * If the value is not a boolean or the Type is not 'Boolean', it emits an error event.
   * It also converts true to 1 and false to 0, for compatibility with Q-SYS.
   * @param {boolean | undefined} value - The new value for the Position property.
   */
  set Bool(value: boolean | undefined) {
    if (typeof value !== 'boolean') {
      this.emit(qrwcEvents.error, `Type mismatch for property Bool. Expected boolean, got ${typeof value}`);
      return;
    }

    if (this.Type !== 'Boolean') {
      this.emit(qrwcEvents.error, `Type mismatch for property Bool. Expected Boolean, got ${this.Type}`);
      return;
    }

    // Convert true to 1 and false to 0
    const numericValue = +value;
    this.updateQsysDesign('Position', numericValue);
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
  private updateQsysDesign(property: keyof IControl, value: string | number | boolean): void {
    if (!(property in this.control)) {
      this.emit(qrwcEvents.error, `Property ${property} does not exist on the control: ${this.control.Name}`);
      return;
    }
    
    const expectedType = typeof this.control[property];
    const valueType = typeof value;
  
    if (expectedType !== valueType) {
      this.emit(qrwcEvents.error, `Type mismatch for property ${property}. Expected ${expectedType}, got ${valueType}`);
      return;
    }

    if (property === 'String') { // TODO: Set only uses Value & Position this may change
      const updatedControl = { ...this.control, Value: value };
      this.setComponent(updatedControl);
      return;
    }

    const { Value, ...controlWithoutValue } = this.control;

    this.setComponent({ ...controlWithoutValue, [property]: value });
  }

  /**
   * Returns a deep copy of all the properties of the control.
   * 
   * This method uses JSON.parse and JSON.stringify to create a deep copy of the control object.
   * This ensures that modifications to the returned object do not affect the original control.
   * 
   * @returns A deep copy of the control's properties.
   * @example
   * const properties = controlDecorator.getProperties();
   * console.log(properties);
   * // { Name: 'Control Name', Component: 'Component Name', Value: 'Control Value', String: 'Control String', Position: 1, Type: 'Control Type' }
   */
  public getProperties(): IControl {
    return JSON.parse(JSON.stringify(this.control));
  }

  /**
   * Gets a property from the control that is not defined in the IControl interface.
   * 
   * If the property does not exist, an error event is emitted and the function execution ends.
   * 
   * @param propertyName - The name of the property to get.
   * @returns The value of the property, or undefined if the property does not exist.
   * @example
   * const valueMin = controlDecorator.getMetaProperty('ValueMin');
   * console.log(valueMin);
   * // Output: The minimum value of the control, or undefined if the 'ValueMin' property does not exist.
   */
  public getMetaProperty(propertyName: string): string | number | boolean | undefined {
    if (!this.control.hasOwnProperty(propertyName)) {
      this.emit(qrwcEvents.error, `Property ${propertyName} does not exist on the control: ${this.control.Name}`);
      return;
    }
    return this.control[propertyName as keyof IControl];
  }
}