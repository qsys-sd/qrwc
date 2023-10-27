export interface IControl {
  Name: string
  Value?: string | number | boolean
  String?: string
  Position?: number
  Type?: string
}

export interface IQRCControls {
  Name: string
  Controls: IControl[]
}

export interface IComponent {
  [componentName: string]: {
    [controlName: string]: IControl
  }
}

export interface IChangeGroup {
  Id: string
  Controls: string[]
}

export interface IComponentChangeGroup {
  Id: string
  Component: {
    Name: string
    Controls: IControl[]
  }
}

export interface IChangeRequest {
  id: string
  component: string
}
