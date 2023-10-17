export interface IQrccOptions {
  url: string
  pollInterval?: number
  autoStart?: boolean
  components?: IComponent[]
}

export interface IControl {
  Name: string
  Value: string | number | boolean
  String?: string
  Position?: number
  Type?: string
}

export interface IComponent {
  Name: string
  Controls: IControl[]
}

export interface IChangeGroup {
  Id: string
  Controls: string[]
}

export interface IComponentChangeGroup {
  Id: string
  Component: {
    Name: string
    Controls: { Name: string }[]
  }
}

export interface IChangeRequest {
  id: string
  component: string
  control: string
  controlType: string
}
