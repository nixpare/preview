import './InRelief.css'

import { useState } from 'react'

type InReliefProps = {
	children: React.ReactElement
	reversed?: boolean
	hoverable?: boolean
	clickable?: boolean
	disabled?: boolean
}

export function InRelief({ children, reversed, hoverable, clickable, disabled }: InReliefProps) {
	const [clicked, setClicked] = useState(false)
	const [runningTimeout, setRunningTimeout] = useState<NodeJS.Timeout | null>(null)

	const onClick = () => {
		if (!clickable)
			return

		setClicked(true)
		if (runningTimeout) {
			clearTimeout(runningTimeout)
		}

		setRunningTimeout(setTimeout(() => {
			setClicked(false)
		}, 300))
	}

	return (
		<div
			className={`in-relief ${reversed ? 'reverse' : ''} ${hoverable ? 'hover' : ''} ${clickable ? 'clickable' : ''} ${clicked ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
			onClick={onClick}
		>
			{children}
		</div>
	)
}