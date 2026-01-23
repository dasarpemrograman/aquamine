import { useState, useEffect, useRef } from 'react';

export function useWebSocket(url: string) {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!url) return;

    function connect() {
        const socket = new WebSocket(url);
        
        socket.onopen = () => {
            console.log('WebSocket Connected');
            setIsConnected(true);
        };
        
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setLastMessage(data);
            } catch (e) {
                console.error("WS Parse Error", e);
            }
        };
        
        socket.onclose = () => {
            console.log('WebSocket Disconnected');
            setIsConnected(false);
            // Reconnect after 5s
            setTimeout(connect, 5000);
        };
        
        ws.current = socket;
    }

    connect();

    return () => {
        if (ws.current) {
            ws.current.close();
        }
    };
  }, [url]);

  return { lastMessage, isConnected };
}
