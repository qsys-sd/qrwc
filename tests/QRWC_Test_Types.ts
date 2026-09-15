export const expectToBe = <T>(a: T): T => {
  return a
}
export const expectNever = <T extends never>(_?: T): void => {}

/**
 * The simplified generic parameter format: component name -> control-name union.
 * This must be a type alias (not an interface) so it carries the implicit index
 * signature required to match Record<string, string>.
 */
export type QRWC_Simple_Type = {
  Gain_0: 'gain' | 'mute'
  Gain_1: 'gain'
}

/**
 * Expanded (detailed) generic parameter for the compile-time type tests.
 * Includes a 'Read Only' control (Meter_0.level) alongside the 'Read/Write'
 * Gain controls so read/write capability can be exercised.
 */
export interface QRWC_Expanded_Type {
  components: {
    Gain_0: {
      controls: {
        bypass: {
          state: {
            Name: 'bypass'
            Type: 'Boolean'
            Value: number
            String: string
            Position: number
            Direction: 'Read/Write'
            Component: 'Gain_0'
            Bool: boolean
          }
        }
        gain: {
          state: {
            Name: 'gain'
            Type: 'Float'
            Value: number
            ValueMin: number
            ValueMax: number
            StringMin: string
            StringMax: string
            String: string
            Position: number
            Direction: 'Read/Write'
            Component: 'Gain_0'
            Bool: boolean
          }
        }
        invert: {
          state: {
            Name: 'invert'
            Type: 'Boolean'
            Value: number
            String: string
            Position: number
            Direction: 'Read/Write'
            Component: 'Gain_0'
            Bool: boolean
          }
        }
        mute: {
          state: {
            Name: 'mute'
            Type: 'Boolean'
            Value: number
            String: string
            Position: number
            Direction: 'Read/Write'
            Component: 'Gain_0'
            Bool: boolean
          }
        }
      }
    }
    Gain_1: {
      controls: {
        bypass: {
          state: {
            Name: 'bypass'
            Type: 'Boolean'
            Value: number
            String: string
            Position: number
            Direction: 'Read/Write'
            Component: 'Gain_1'
            Bool: boolean
          }
        }
        gain: {
          state: {
            Name: 'gain'
            Type: 'Float'
            Value: number
            ValueMin: number
            ValueMax: number
            StringMin: string
            StringMax: string
            String: string
            Position: number
            Direction: 'Read/Write'
            Component: 'Gain_1'
            Bool: boolean
          }
        }
        invert: {
          state: {
            Name: 'invert'
            Type: 'Boolean'
            Value: number
            String: string
            Position: number
            Direction: 'Read/Write'
            Component: 'Gain_1'
            Bool: boolean
          }
        }
        mute: {
          state: {
            Name: 'mute'
            Type: 'Boolean'
            Value: number
            String: string
            Position: number
            Direction: 'Read/Write'
            Component: 'Gain_1'
            Bool: boolean
          }
        }
      }
    }
    Meter_0: {
      controls: {
        level: {
          state: {
            Name: 'level'
            Type: 'Float'
            Value: number
            String: string
            Position: number
            Direction: 'Read Only'
            Component: 'Meter_0'
            Bool: boolean
          }
        }
      }
    }
  }
}
