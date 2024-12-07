import { PrivateServer } from "./Server"

export type User = {
	name: string
	ip: string
	server?: PrivateServer
}