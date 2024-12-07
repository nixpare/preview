export type Server = {
	name: string
	type: string
	version: string
	running: boolean
}

export type PublicServer = Server & {
	players: number
}

export type PrivateServer = Server & {
	players: string[]
}

export type ServersInfo = {
	servers: Record<string, PublicServer>
}