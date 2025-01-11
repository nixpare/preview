export function isWebSocket(ws: WebSocket | boolean): ws is WebSocket {
	// @ts-ignore
	return ws && ws.OPEN != undefined
}

export function wsIsActive(ws: WebSocket | boolean): ws is WebSocket {
	return isWebSocket(ws) && ws.readyState === ws.OPEN
}

export function wsCleanup(ws: WebSocket | boolean) {
	wsIsActive(ws) && ws.close()
}