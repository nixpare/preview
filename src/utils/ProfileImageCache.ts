import axios from "axios"

export enum ProfileImageType {
	ARMOR_BUST,
	HEADHELM
}

function profileImageTypeURL(type: ProfileImageType): string {
	switch (type) {
		case ProfileImageType.ARMOR_BUST:
			return "armor_bust"
		case ProfileImageType.HEADHELM:
			return "headhelm"
	}
}

const cache = new Map <ProfileImageType, Map<string, any>>([
	[ProfileImageType.ARMOR_BUST, new Map<string, any>()],
	[ProfileImageType.HEADHELM, new Map<string, any>()],
])

export async function getProfileImage(username: string, type = ProfileImageType.ARMOR_BUST): Promise<any> {
	const imageTypeCache = cache.get(type)
	let data = imageTypeCache?.get(username)
	if (data)
		return data

	const resp = await axios.get(`/profile/${username}?type=${profileImageTypeURL(type)}`, { responseType: 'blob' })
	imageTypeCache?.set(username, resp.data)
	return resp.data
}