const urls = __SW_FILES
	.concat(".")
	.map(ent => new URL(ent, self.location.href).href)

const MAIN_CACHE = "v1"

function until(f) {
	return ev => {
		ev.waitUntil(f(ev))
	}
}
function respond(f) {
	return ev => {
		ev.respondWith(f(ev))
	}
}

let fetchCache = null
async function getCache() {
	if (!fetchCache) {
		fetchCache = await caches.open(MAIN_CACHE)
	}
	return fetchCache
}

// Download all files when installed
self.addEventListener(
	"install",
	until(async () => {
		self.skipWaiting()
		if (navigator.onLine) {
			await (await getCache()).addAll(urls.map(url => new Request(url)))
		}
	})
)

// Cleanup - remove entries that aren't present in new manifest
self.addEventListener(
	"activate",
	until(async () => {
		const cache = await getCache()
		for (const req of await cache.keys()) {
			if (urls.includes(req.url)) continue
			await cache.delete(req)
		}
		await clients.claim()
	})
)

self.addEventListener(
	"fetch",
	respond(async ev => {
		const url = new URL(ev.request.url)
		if (!urls.includes(url.href))
			return fetch(ev.request).catch(() => Response.error())

		if (navigator.onLine) {
			const res = await fetch(ev.request).catch(() => null)
			if (res?.ok) {
				await (await getCache()).put(ev.request, res.clone())
				return res
			}
		}
		const res = await (await getCache()).match(ev.request)
		if (res?.ok) return res
		return Response.error()
	})
)
