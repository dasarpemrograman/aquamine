export type WebSocketMessage = {
  type: "reading" | "alert";
  timestamp: string;
  data: any;
};

export class AquaMineWebSocket {
  private url: string;
  private ws: WebSocket | null = null;
  private listeners: ((msg: WebSocketMessage) => void)[] = [];
  private reconnectInterval = 5000;

  constructor(url: string = "ws://localhost:8000/ws/realtime") {
    this.url = url;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.notifyListeners(message);
      } catch (e) {
        console.error("Failed to parse WebSocket message", e);
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected, reconnecting...");
      setTimeout(() => this.connect(), this.reconnectInterval);
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error", error);
      this.ws?.close();
    };
  }

  subscribe(callback: (msg: WebSocketMessage) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners(message: WebSocketMessage) {
    this.listeners.forEach((listener) => listener(message));
  }
}

export const wsClient = new AquaMineWebSocket();
