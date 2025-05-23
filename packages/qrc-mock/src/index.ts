import { WebSocketServer } from 'ws'
import http from 'http'

// Get port from command line arguments or use default
const port = parseInt(process.argv[2]) || 3100

// Create HTTP server that responds with 200 for all requests
const httpServer = http.createServer((_req, res) => {
  res.writeHead(200)
  res.end('OK')
})

// Use the HTTP server as the base for the WebSocket server
const server = new WebSocketServer({ server: httpServer })

// Start the combined server
httpServer.listen(port, () => {
  console.log(`HTTP and WebSocket server started on port ${port}`)
})

interface IComponentGetComponentsResult {
  Properties: {
    Name: string
    Value: string
    PrettyName: string
  }[]
  ID: string
  Name: string
  Type: string
  Controls: null
  ControlSource: number
}

interface IChangeGroupAddComponentControlRequest {
  Id: string
  Component: {
    Name: string
    Controls: {
      Name: string
    }[]
  }
}

const mockComponents: IComponentGetComponentsResult[] = [
  {
    ID: 'component-1',
    Name: 'TestComponent1',
    Type: 'custom_controls',
    Properties: [],
    Controls: null,
    ControlSource: 2
  },
  {
    ID: 'component-2',
    Name: 'TestComponent2',
    Type: 'custom_controls',
    Properties: [],
    Controls: null,
    ControlSource: 2
  }
]

const mockControls = {
  TestComponent1: {
    Name: 'TestComponent1',
    Controls: [
      {
        Name: 'control1',
        Type: 'Text',
        String: 'Test Value 1',
        Direction: 'Read/Write',
        Position: 0,
        Value: 0
      }
    ]
  },
  TestComponent2: {
    Name: 'TestComponent2',
    Controls: [
      {
        Name: 'control2',
        Type: 'Boolean',
        String: 'false',
        Direction: 'Read/Write',
        Position: 0,
        Value: 0
      }
    ]
  }
}

// Set up server to respond to RPC requests
server.on('connection', (socket) => {
  socket.on('message', (message) => {
    const data = JSON.parse(message.toString())

    // Handle Component.GetComponents
    if (data.method === 'Component.GetComponents') {
      socket.send(
        JSON.stringify({
          id: data.id,
          result: mockComponents
        })
      )
    }

    // Handle Component.GetControls
    if (data.method === 'Component.GetControls') {
      const componentName = data.params.Name as keyof typeof mockControls
      socket.send(
        JSON.stringify({
          id: data.id,
          result: mockControls[componentName]!
        })
      )
    }

    // Handle ChangeGroup.AddComponentControl
    if (data.method === 'ChangeGroup.AddComponentControl') {
      const params = data.params as IChangeGroupAddComponentControlRequest
      socket.send(
        JSON.stringify({
          id: data.id,
          result: {
            Id: params.Id,
            Controls: params.Component.Controls.map((c) => c.Name)
          }
        })
      )
    }

    // Handle ChangeGroup.Poll
    if (data.method === 'ChangeGroup.Poll') {
      socket.send(
        JSON.stringify({
          id: data.id,
          result: {
            Id: data.params.Id,
            Changes: []
          }
        })
      )
    }
  })
})
