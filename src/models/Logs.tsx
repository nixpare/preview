export type ServerLog = {
	id: string
	level: string
	date: string
	message: string
	extra: string
	tags?: string[]
}

export type Logs = {
	rawLogs: ParsedLog[]
	chat: ChatMessage[]
}

export type ParsedLog = {
	id: string
	date: string
	from: string
	level: string
	levelColor: string
	message: string
	tags?: string[]
}

export type ChatMessage = {
	id: string
	date: string
	from: string
	message: string
	self: boolean
}