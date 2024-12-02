import './InRelief.css'

import { DetailedHTMLProps, HTMLAttributes, MouseEvent, PointerEvent, RefObject, useEffect, useState } from 'react'

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

	// Mobile hover hack
	const [isHoverable, setIsHoverable] = useState(hoverable ?? false)
	useEffect(() => {
		setIsHoverable(hoverable ?? false)
	}, [hoverable])

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

	// Mobile hover hack
	const onHover = (ev: PointerEvent<HTMLDivElement>) => {
		if (ev.pointerType == 'mouse' || !hoverable)
			return;

		if (!isHoverable) {
			ev.currentTarget.click();
			setIsHoverable(true);
		}

		setTimeout(() => {
			setIsHoverable(false);
		}, 500)
	}

	var classList = ['in-relief' ]

	if (reversed) classList.push('reversed')
	if (flat) classList.push('flat')
	if (isHoverable) classList.push('hoverable')
	if (clickable) classList.push('clickable')
	if (clicked) classList.push('active')
	if (disabled) classList.push('disabled')
	if (className) classList.push(className)

	return (
		<div
			className={classList.join(' ')}
			onClick={onClickInRelief}
			onPointerEnter={onHover} // Mobile hover hack
			ref={innerRef}
			{...props}
		>
			{children}
		</div>
	)
}