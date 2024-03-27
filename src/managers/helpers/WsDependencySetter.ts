import { WebSocketManager } from "..";

export default class WsDependencySetter {
    public websocketManager: WebSocketManager;
  
    setDependency(wsManager: WebSocketManager) {
      this.websocketManager = wsManager;
    }

    getWebSocketManager(): WebSocketManager {
      if (!this.websocketManager) {
        throw new Error('WebSocketManager has not been set yet');
      }
      return this.websocketManager;
    }
  }