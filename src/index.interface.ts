export interface IQrccOptions {
  url: string
  pollInterval?: number
  controls?: IControl[]
}

export interface IControl {
  Name: string,
  Value: string | number | boolean,
  String?: string,
  Position?: number 
}

// export interface Component { // TODO: determine if this is needed
//   ID: string,
//   Name: string,
//   Type: string,
// }

export interface IChangeGroup {
  Id: string,
  Controls: string[]
}
