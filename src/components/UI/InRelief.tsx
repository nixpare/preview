import './InRelief.css'

import { DetailedHTMLProps, HTMLAttributes, MouseEvent, RefObject, useState } from 'react'

export type InReliefProps = {
	children: React.ReactElement
	reversed?: boolean
	flat?: boolean
	hoverable?: boolean
	clickable?: boolean
	disabled?: boolean
	innerRef?: RefObject<HTMLDivElement>
} & DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>

export function InRelief({ children, reversed, flat, hoverable, clickable, disabled, innerRef, className, onClick, ...props }: InReliefProps) {
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

	var classList = ['in-relief' ]

	if (reversed) classList.push('reversed')
	if (flat) classList.push('flat')
	if (hoverable) classList.push('hoverable')
	if (clickable) classList.push('clickable')
	if (clicked) classList.push('active')
	if (disabled) classList.push('disabled')
	if (className) classList.push(className)

	return (
		<div
			className={classList.join(' ')}
			onClick={onClickInRelief}
			ref={innerRef}
			{...props}
		>
			{children}
		</div>
	)
}