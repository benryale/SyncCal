/**
 * WebSocketContext.jsx
 * --------------------
 * Provides a SINGLE WebSocket connection for the entire app via React context.
 * Any component can call useWebSocket() to subscribe to real-time messages.
 *
 * Features:
 *  - Authenticates via DRF token in query-string (?token=...)
 *  - Exponential back-off reconnect (1 s → 2 s → … → 30 s max)
 *  - 25-second ping keepalive so the connection survives idle load-balancers
 *  - Exposes { lastMessage, connected, subscribe } to consumers
 *
 * subscribe(fn) registers a callback that receives every parsed JSON message.
 * Returns an unsubscribe function for use in useEffect cleanup.
 *
 * Usage in a component:
 *   const { connected, subscribe } = useWebSocket();
 *   useEffect(() => {
 *     const unsub = subscribe((msg) => {
 *       if (msg.type === 'calendar_event') { ... }
 *     });
 *     return unsub;
 *   }, [subscribe]);
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const WebSocketContext = createContext(null);

const MIN_DELAY = 1000;
const MAX_DELAY = 30000;
const PING_MS   = 25000;

export function WebSocketProvider({ children }) {
  const [connected, setConnected]   = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  const wsRef          = useRef(null);
  const delayRef       = useRef(MIN_DELAY);
  const reconnectTimer = useRef(null);
  const pingTimer      = useRef(null);
  const subscribersRef = useRef(new Set());
  const unmounted      = useRef(false);

  const clearTimers = () => {
    clearTimeout(reconnectTimer.current);
    clearInterval(pingTimer.current);
  };

  const connect = useCallback(() => {
    if (unmounted.current) return;
    const token = localStorage.getItem('token');
    if (!token) return; // not logged in yet

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url   = `${proto}://${window.location.host}/ws/synccal/?token=${token}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmounted.current) { ws.close(); return; }
      setConnected(true);
      delayRef.current = MIN_DELAY;

      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, PING_MS);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setLastMessage(data);
        subscribersRef.current.forEach(fn => {
          try { fn(data); } catch { /* subscriber errors must not crash the WS */ }
        });
      } catch { /* ignore malformed frames */ }
    };

    ws.onclose = (e) => {
      clearTimers();
      setConnected(false);
      if (unmounted.current) return;
      if (e.code === 4001) return; // auth failure – don't retry

      reconnectTimer.current = setTimeout(() => {
        delayRef.current = Math.min(delayRef.current * 2, MAX_DELAY);
        connect();
      }, delayRef.current);
    };

    ws.onerror = () => ws.close();
  }, []);

  // Open connection once on mount; reconnect whenever token changes (login/logout)
  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      clearTimers();
      wsRef.current?.close();
    };
  }, [connect]);

  // Allow components to re-trigger connect after login
  const reconnect = useCallback(() => {
    clearTimers();
    wsRef.current?.close();
    delayRef.current = MIN_DELAY;
    connect();
  }, [connect]);

  /** Register a message handler. Returns unsubscribe function. */
  const subscribe = useCallback((fn) => {
    subscribersRef.current.add(fn);
    return () => subscribersRef.current.delete(fn);
  }, []);

  return (
    <WebSocketContext.Provider value={{ connected, lastMessage, subscribe, reconnect }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocket must be used inside <WebSocketProvider>');
  return ctx;
}
