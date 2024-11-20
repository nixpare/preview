import { User } from "./User"

export type Server = {
	name: string
	running: boolean
	players: User[]
}

export type ServersInfo = {
	servers: Record<string, Server>
}