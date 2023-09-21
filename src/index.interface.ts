export interface IQrccOptions {
  url: string
  pollInterval?: number
  autoStart?: boolean
}

export interface IControl {
  Name: string
  Value: string | number | boolean
  String?: string
  Position?: number
}

export interface IComponent {
  [key: string]: IControl[]
}

export interface IResultComponent {
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
