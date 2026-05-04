/**
 * useCalendarSocket
 * -----------------
 * Opens a single WebSocket connection to Django Channels and keeps it alive
 * with automatic reconnection (exponential back-off, max 30 s).
 *
 * Returns an object with:
 *   lastMessage  – the most-recent parsed JSON payload (or null)
 *   connected    – boolean connection state
 *
 * Usage:
 *   const { lastMessage, connected } = useCalendarSocket();
 *
 * The hook authenticates via a DRF token appended as a query-string param
 * because WebSocket headers aren't supported in browsers.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const BASE_RECONNECT_DELAY = 1000;   // ms
const MAX_RECONNECT_DELAY  = 30000;  // ms
const PING_INTERVAL        = 25000;  // keep-alive heartbeat

function getWsUrl() {
  const token = localStorage.getItem('token');
  // Same host as the page; swap http(s) for ws(s)
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host; // e.g. localhost:8000
  return `${protocol}://${host}/ws/calendar/?token=${token || ''}`;
}

export function useCalendarSocket() {
  const [lastMessage, setLastMessage] = useState(null);
  const [connected, setConnected]     = useState(false);

  const wsRef            = useRef(null);
  const reconnectDelay   = useRef(BASE_RECONNECT_DELAY);
  const reconnectTimeout = useRef(null);
  const pingInterval     = useRef(null);
  const unmounted        = useRef(false);

  const clearTimers = () => {
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    if (pingInterval.current)     clearInterval(pingInterval.current);
  };

  const connect = useCallback(() => {
    if (unmounted.current) return;

    const token = localStorage.getItem('token');
    if (!token) return; // not logged in yet — don't open socket

    const url = getWsUrl();
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmounted.current) { ws.close(); return; }
      setConnected(true);
      reconnectDelay.current = BASE_RECONNECT_DELAY; // reset back-off

      // send a periodic no-op so the connection doesn't time out behind
      // load balancers / proxies that have short idle timeouts
      pingInterval.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setLastMessage(data);
      } catch {
        // ignore non-JSON frames
      }
    };

    ws.onclose = (e) => {
      clearTimers();
      setConnected(false);
      if (unmounted.current) return;

      // 4001 = auth failed — don't retry
      if (e.code === 4001) return;

      // exponential back-off
      reconnectTimeout.current = setTimeout(() => {
        reconnectDelay.current = Math.min(
          reconnectDelay.current * 2,
          MAX_RECONNECT_DELAY
        );
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = () => {
      ws.close(); // triggers onclose which handles reconnect
    };
  }, []);

  useEffect(() => {
    unmounted.current = false;
    connect();

    return () => {
      unmounted.current = true;
      clearTimers();
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { lastMessage, connected };
}
