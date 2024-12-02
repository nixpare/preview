import { User } from "./User"

export type Server = {
	name: string
	running: boolean
	players: Record<string, User> | null
}

export type ServersInfo = {
	servers: Record<string, Server>
}