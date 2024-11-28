import './InRelief.css'

import { DetailedHTMLProps, HTMLAttributes, MouseEvent, RefObject, useState } from 'react'

export type InReliefProps = {
	children: React.ReactElement
	reversed?: boolean
	hoverable?: boolean
	clickable?: boolean
	disabled?: boolean
	innerRef?: RefObject<HTMLDivElement>
} & DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>

export function InRelief({ children, reversed, hoverable, clickable, disabled, innerRef, className, onClick, ...props }: InReliefProps) {
	const [clicked, setClicked] = useState(false)
	const [runningTimeout, setRunningTimeout] = useState<NodeJS.Timeout | null>(null)

	const onClickInRelief = (ev: MouseEvent<HTMLDivElement>) => {
		onClick?.(ev)

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
			className={`in-relief ${reversed ? 'reverse' : ''} ${hoverable ? 'hover' : ''} ${clickable ? 'clickable' : ''} ${clicked ? 'active' : ''} ${disabled ? 'disabled' : ''} ${className ?? ''}`}
			onClick={onClickInRelief}
			ref={innerRef}
			{...props}
		>
			{children}
		</div>
	)
}