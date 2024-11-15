const /**@type {HTMLInputElement}*/ username = document.querySelector('input[name="username"]')
const /**@type {HTMLInputElement}*/ passcode = document.querySelector('input[type="password"]')
const /**@type {HTMLFormElement}*/ form = document.querySelector('form')

const /**@type {HTMLElement}*/ popup = document.querySelector('.show-message')
const /**@type {HTMLElement}*/ slideSection = document.querySelector('.slide-section')

const /**@type {HTMLButtonElement}*/ serverStatus = document.querySelector('.server-status')
const /**@type {HTMLButtonElement}*/ powerButton = document.getElementById('power-button')
const /**@type {HTMLButtonElement}*/ connectButton = document.getElementById('connect-button')

const /**@type {HTMLElement}*/ serverList = document.getElementById('server-list')
const /**@type {HTMLButtonElement}*/ serverName = serverList.querySelector('button')
const /**@type {HTMLElement}*/ serverNameDropdown = serverList.querySelector('.dropdown-menu')
const /**@type {HTMLButtonElement}*/ logoutBtn = document.getElementById('logout-btn')

const /**@type {HTMLElement}*/ players = document.getElementById('players')
const /**@type {HTMLElement}*/ playersList = players.querySelector('#players-list')

const /**@type {HTMLTableElement}*/ logTable = document.querySelector('div[slide-index="3"] table')
const /**@type {HTMLTableSectionElement}*/ logTableBody = logTable.querySelector('tbody')
const /**@type {HTMLInputElement}*/ cmdInput = document.querySelector('div[slide-index="3"] input.send-cmd')
const /**@type {HTMLButtonElement}*/ cmdButton = document.querySelector('div[slide-index="3"] button.send-cmd')
const /**@type {HTMLInputElement}*/ broadcastInput = document.querySelector('div[slide-index="3"] input.send-broadcast')
const /**@type {HTMLButtonElement}*/ broadcastButton = document.querySelector('div[slide-index="3"] button.send-broadcast')

let user = localStorage.getItem('username')
let server

async function getServers() {
	const resp = await fetch('/servers', {
		signal: AbortSignal.timeout(2000)
	}).catch(() => {
		showMessage('Server is not responding')
		setUndefined()
		setTimeout(getServerStatus, 8000)
	})

	if (!resp)
		return

	if (resp.status >= 400 ) {
		if (resp.status == 401) {
			if (slideIndex != 1) {
				showMessage(await resp.text())
			}
			slideTo(1)
			return
		}
		
		showMessage(await resp.text())
		setTimeout(getServerStatus, 4000)
		return
	}

	let data = await resp.json()
	setServerList(data)

	if (slideIndex == 1) {
		slideTo(2)
	}
}

let serverStatusAbort = new AbortController()
async function getServerStatus() {
	serverStatusAbort = new AbortController()

	let stop = false
	const stopFunc = () => { stop = true }
	serverStatusAbort.signal.addEventListener('abort', stopFunc)

	while (!stop) {
		const resp = await fetch(`/${server}/status`, {
			signal: AbortSignal.timeout(2000)
		}).catch(() => {
			showMessage('Server is not responding')
			setUndefined()
			setTimeout(getServerStatus, 8000)
		})

		if (!resp)
			break

		if (resp.status >= 400 ) {
			if (resp.status == 401) {
				if (slideIndex != 1) {
					showMessage(await resp.text())
				}
				slideTo(1)
				break
			}
			
			showMessage(await resp.text())
			setTimeout(getServerStatus, 4000)
			break
		}
	
		let data = await resp.json()
		setServerStatus(data)

		await new Promise(resolve => setTimeout(resolve, 2000))
	}
}

let lastLog = 0
let serverLogAbort = new AbortController()
async function getServerLog() {
	serverLogAbort = new AbortController()

	let stop = false
	const stopFunc = () => { stop = true }
	serverLogAbort.signal.addEventListener('abort', stopFunc)

	while (!stop) {
		const resp = await fetch(`/${server}/cmd`, {
			method: 'POST',
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				cmd: "get-logs",
				args: [lastLog.toString()]
			}),
			signal: AbortSignal.timeout(2000)
		}).catch(() => {
			showMessage('Server is not responding')
			setUndefined()
			setTimeout(getServerLog, 8000)
		})

		if (!resp) break

		if (resp.status >= 400 ) {
			showMessage(await resp.text())
			if (resp.status == 401) {
				slideTo(1, true)
			} else {
				slideTo(2, true)
			}
			
			break
		}

		if (lastLog == 0) {
			logTableBody.innerHTML = ''
		}

		const /**@type [] */data = await resp.json()
		lastLog += data.length

		data.forEach((/**@type {{ id: string, level: string, date: Date, message: string, extra: string, tags: []string }}*/ e) => {
			if (e.message == '') {
				return
			}

			const row = document.createElement("tr")
			
			const col1 = document.createElement("td")
			col1.style.color = '#ccc'
			col1.style.overflowWrap = 'normal'
			col1.style.whiteSpace = 'pre'
			col1.textContent = new Date(e.date).toLocaleDateString(undefined, {
				year: "numeric", month: "2-digit", day: "2-digit",
				hour: "2-digit", minute: "2-digit", second: "2-digit",
			}).replace(', ', '\n').replaceAll('/', '-')
			row.appendChild(col1)

			const col2 = document.createElement("td")
			const col3 = document.createElement("td")

			let message = e.message
			
			if (e.tags.includes('stderr')) {
				col2.textContent = 'Server'
				col3.textContent = "FATAL"
				col3.style.color = 'hsl(0, 80%, 60%)'
			} else if (e.tags.includes('user')) {
				col2.textContent = 'Nixpare'
				col3.textContent = "USER"
				col3.style.color = 'hsl(90, 80%, 60%)'
			} else {
				const [from, level, messageParsed] = parseLog(e.message)
				message = messageParsed

				col2.textContent = from
				col3.textContent = level

				switch (level) {
					case 'INFO':
						col3.style.color = 'hsl(190, 80%, 60%)'
						break
					case 'WARN':
						col3.style.color = 'hsl(20, 80%, 60%)'
						break
					case 'ERROR':
						col3.style.color = 'hsl(0, 80%, 60%)'
						break
				}
			}

			row.appendChild(col2)
			row.appendChild(col3)

			const col4 = document.createElement("td")
			col4.textContent = message
			col4.style.maxWidth = '60vw'
			col4.style.textAlign = 'start'
			col4.style.padding = '.3em 1em'
			row.appendChild(col4)

			logTableBody.appendChild(row)
		})

		if (!scrolling) scrollDown()

		await new Promise(resolve => setTimeout(resolve, 1000))
	}
}

function parseLog(/**@type{string}*/message) {
	let from = ''
	let level = ''

	switch (true) {
		case message.indexOf('] ') >= 0 && message.indexOf(']: ') > message.indexOf('] '):
			message = message.substring(message.indexOf('] ') + 2, message.length);
			[ from, level ] = message.substring(1, message.indexOf(']: ')).split('/', 2)
			message = message.substring(message.indexOf(']: ') + 3, message.length)
		
			break
		case message.indexOf(']: ') >= 0:
			from = 'Server'
			level = message.substring(1, message.indexOf(']: ')).split(' ', 2)[1]
			message = message.substring(message.indexOf(']: ') + 3, message.length)

			break
		default:
			from = 'Server'
			break
 	}

	return [from, level, message]
}

form.addEventListener('submit', async (e) => {
	e.preventDefault()

	const resp = await fetch(location.href, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			username: username.value,
			passcode: passcode.value
		}),
		signal: AbortSignal.timeout(2000)
	}).catch(() => {
		showMessage('Server is not responding')
		setUndefined()
	})

	if (!resp) return

	if (resp.status >= 400) {
		showMessage(`Error ${resp.status}: ${await resp.text()}`)
		return
	}

	user = username.value
	localStorage.setItem('username', user)

	username.value = ""
	passcode.value = ""

	slideTo(2)
})

logoutBtn.addEventListener('click', async () => {
	await fetch('/logout')
})

connectButton.addEventListener('click', async () => {
	const resp = await fetch(`/${server}/connect`, {
		method: 'POST',
		signal: AbortSignal.timeout(2000)
	}).catch(() => {
		showMessage('Server is not responding')
		setUndefined()
	})

	if (!resp)
		return

	if (resp.status >= 400) {
		showMessage(`Error ${resp.status}: ${await resp.text()}`)
		if (resp.status == 401) {
			slideTo(1)
		} else {
			setUndefined()
		}
		
		return
	}

	showMessage(await resp.text())
})

powerButton.addEventListener('click', async () => {
	const req = serverOnlineStatus ? `/${server}/stop` : `/${server}/start`

	const resp = await fetch(req, {
		method: 'POST',
		body: serverName.innerText,
		signal: AbortSignal.timeout(2000)
	}).catch(() => {
		showMessage('Server is not responding')
		setUndefined()
	})

	if (!resp) return

	if (resp.status >= 400) {
		showMessage(`Error ${resp.status}: ${await resp.text()}`)
		if (resp.status == 401) {
			slideTo(1)
		}
		return
	}

	showMessage(await resp.text())
	setOnline()
})

cmdInput.addEventListener('keypress', (ev) => {
	if (ev.key === "Enter") {
		ev.preventDefault()
		cmdButton.click()
	}
})

cmdButton.addEventListener('click', async () => {
	const resp = await fetch(`/${server}/cmd`, {
		method: 'POST',
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			cmd: "send",
			args: [user, cmdInput.value]
		}),
		signal: AbortSignal.timeout(2000)
	}).catch(() => {
		showMessage('Server is not responding')
		setUndefined()
	})

	if (!resp) return

	cmdInput.value = ""

	if (resp.status >= 400 ) {
		showMessage(await resp.text())
		if (resp.status == 401) {
			slideTo(1)
		}
		return
	}
})

broadcastInput.addEventListener('keypress', (ev) => {
	if (ev.key === "Enter") {
		ev.preventDefault()
		broadcastButton.click()
	}
})

broadcastButton.addEventListener('click', async () => {
	const resp = await fetch(`/${server}/cmd`, {
		method: 'POST',
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			cmd: "send-broadcast",
			args: [user, broadcastInput.value]
		}),
		signal: AbortSignal.timeout(2000)
	}).catch(() => {
		showMessage('Server is not responding')
		setUndefined()
	})

	if (!resp) return

	broadcastInput.value = ""

	if (resp.status >= 400 ) {
		showMessage(await resp.text())
		if (resp.status == 401) {
			slideTo(1)
		}
		return
	}
})

let scrolling = false
const /**@type{HTMLButtonElement}*/goDownBtn = document.querySelector('button.go-down')
logTable.parentElement.addEventListener('scroll', ({ target }) => {
	if (logTable.offsetHeight - target.offsetHeight - target.scrollTop > 0) {
		scrolling = true
		goDownBtn.style = ''
	} else {
		scrolling = false
		goDownBtn.style.opacity = 0
		goDownBtn.style.pointerEvents = 'none'
		goDownBtn.style.cursor = 'none'
	}
})
goDownBtn.style.opacity = 0
goDownBtn.style.pointerEvents = 'none'
goDownBtn.style.cursor = 'none'
function scrollDown() {
	logTable.parentElement.scroll({ top: logTable.offsetHeight })
}
goDownBtn.addEventListener('click', scrollDown)

function showMessage(/**@type {string}*/message) {
	if (popup.classList.contains('showing')) {
		setTimeout(() => {
			showMessage(message)
		}, 2300)
		return
	}
	
	popup.querySelector('p').innerText = message
	popup.classList.add('showing')
	setTimeout(() => {
		popup.classList.remove('showing')
	}, 2000)
}

let slideIndex = 1
function slideTo(/**@type {int}*/ index, /**@type {bool}*/ forced = false) {
	if (index == slideIndex) {
		return
	}

	if (slideIndex == 3 && index == 2 && !forced) {
		return
	}

	const /**@type {HTMLElement}*/ toShow = document.querySelector(`div[slide-index="${index}"]`)
	if (!toShow) {
		return
	}

	const /**@type {HTMLElement}*/ nowShowing = document.querySelector('div[slide-show]')
	slideIndex = index

	if (toShow != nowShowing) {
		let oldHeight = slideSection.offsetHeight - nowShowing.offsetHeight

		toShow.style.opacity = '0'
		toShow.style.transform = 'translateX(-1000px)'
		toShow.style.display = 'block'

		let height = oldHeight + Math.max(toShow.offsetHeight, nowShowing.offsetHeight)
		slideSection.style.height = `${height}px`

		toShow.style.opacity = ''
		toShow.style.transform = ''
		toShow.style.display = ''

		nowShowing.classList.add('slide-out')

		toShow.setAttribute('slide-show', '')
		toShow.classList.add('slide-in')
	}

	switch (index) {
		case 2:
			document.getElementById('name').innerText = document.getElementById('name').innerText.replace("PLACEHOLDER", user)
			break;
	}

	setTimeout(() => {
		toShow.classList.remove('slide-in')

		nowShowing.classList.remove('slide-out')
		nowShowing.removeAttribute('slide-show')

		slideSection.style.height = ''

		switch (index) {
			case 1:
				logoutBtn.classList.add('d-none')

				serverStatusAbort.abort()
				serverLogAbort.abort()

				break
			case 2:
				logoutBtn.classList.remove('d-none')

				serverLogAbort.abort()
				serverStatusAbort.abort()
				getServerStatus()

				break
			case 3:
				serverLogAbort.abort()
				getServerLog()

				break
		}
	}, 1000)
}

const menuTemplate = '<button class="dropdown-item"></button>'

function setServerList(/**@type {string[]}*/ data) {
	if (serverNameDropdown.innerHTML == '') {
		data.sort().forEach(name => {
			let el = document.createElement('button')
			el.classList.add('dropdown-item')
			el.innerText = name
	
			el.addEventListener('click', (e) => {
				server = e.target.innerText
				localStorage.setItem('server', server)
				serverName.innerText = server
				serverName.click()

				lastLog = 0
				getServerStatus()
			})
	
			serverNameDropdown.appendChild(el)
		})

		server = localStorage.getItem('server') ?? data[0]
		localStorage.getItem('server', server)
		serverName.innerText = server

		getServerStatus()
	}
}

let /**@type{ boolean | undefined } */serverOnlineStatus = undefined
function setServerStatus(/**@type {{ name: string, running: boolean, players: string[] }}*/ data) {
	let playersHTML = []
	if (data.players) {
		data.players.sort().forEach(player => {
			let e = document.createElement('p')
			e.className = 'rounded-1 p-3 flex-grow-1'
			e.style.boxShadow = '0 0.5rem 1rem color-mix(in srgb, var(--bs-primary), transparent 40%)'
			e.innerText = player

			playersHTML.push(e)
		})
	}
	playersList.replaceChildren(...playersHTML)

	if (data.running) {
		setOnline()
	} else {
		setOffline()
	}
}

function setOnline() {
	if (serverOnlineStatus === false) {
		lastLog = 0
	}
	serverOnlineStatus = true

	serverStatus.classList.remove('offline')
	serverStatus.classList.add('online')
	serverStatus.disabled = false

	powerButton.innerText = 'Power Off'
	powerButton.classList.remove('disabled')
	powerButton.disabled = false

	connectButton.disabled = false
	connectButton.classList.remove('disabled')

	players.classList.remove('d-none')
}

function setOffline() {
	serverOnlineStatus = false

	serverStatus.classList.remove('online')
	serverStatus.classList.add('offline')
	serverStatus.disabled = false

	powerButton.innerText = 'Power On'
	powerButton.classList.remove('disabled')
	powerButton.disabled = false

	connectButton.disabled = false
	connectButton.classList.remove('disabled')

	players.classList.add('d-none')
}

function setUndefined() {
	serverOnlineStatus = undefined

	serverStatus.classList.remove('online')
	serverStatus.classList.remove('offline')
	serverStatus.disabled = true

	powerButton.disabled = true
	powerButton.classList.add('disabled')

	connectButton.disabled = true
	connectButton.classList.add('disabled')

	players.classList.add('d-none')
}

getServers()
