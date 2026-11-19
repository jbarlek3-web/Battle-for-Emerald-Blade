/* Lane: The Battle of the Emerald Sword — offline service worker */
const CACHE = 'lane-emerald-v1', ICONS = CACHE + '-icons';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-maskable.svg'];
const SPRITES = ['sprites/knight.png','sprites/castle_foes.png','sprites/warlord.png','sprites/tiles_castle.png',
 'sprites/ui.png','sprites/lane_elf.png','sprites/catacomb_foes.png','sprites/lich_king.png',
 'sprites/tiles_catacomb.png','sprites/fx.png','sprites/items_npcs.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.allSettled(SHELL.concat(SPRITES).map(u => c.add(u))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== ICONS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Synthesize PNG icons at request time (OffscreenCanvas) so install works with zero binary assets */
async function makeIcon(size) {
  try {
    const c = new OffscreenCanvas(size, size), g = c.getContext('2d'), s = size / 512;
    g.fillStyle = '#070c0a'; g.fillRect(0, 0, size, size);
    g.strokeStyle = 'rgba(47,255,136,.3)'; g.lineWidth = 20 * s;
    g.beginPath(); g.arc(size/2, size/2, 168*s, 0, 7); g.stroke();
    g.save(); g.translate(size/2, size/2); g.rotate(Math.PI/4); g.scale(s, s);
    g.fillStyle = '#57e389';
    g.beginPath(); g.moveTo(0,-192); g.lineTo(36,-124); g.lineTo(36,44); g.lineTo(0,80);
    g.lineTo(-36,44); g.lineTo(-36,-124); g.closePath(); g.fill();
    g.fillStyle = '#eafff0'; g.fillRect(-8,-140,16,180);
    g.fillStyle = '#d9a441'; g.fillRect(-80,60,160,28); g.fillRect(-14,88,28,72);
    g.beginPath(); g.arc(0,172,20,0,7); g.fill(); g.restore();
    return await c.convertToBlob({ type: 'image/png' });
  } catch (e) { return null; }
}

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;

  const m = url.pathname.match(/icon-(192|512)\.png$/);
  if (m) { e.respondWith((async () => {
    const cc = await caches.open(ICONS);
    const hit = await cc.match(req); if (hit) return hit;
    const blob = await makeIcon(+m[1]); if (!blob) return Response.error();
    const res = new Response(blob, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000' } });
    cc.put(req, res.clone()); return res; })()); return; }

  if (req.mode === 'navigate') {           /* network-first, offline fallback to cached shell */
    e.respondWith(fetch(req)
      .then(r => { caches.open(CACHE).then(c => c.put('./index.html', r.clone())); return r; })
      .catch(async () => (await caches.match('./index.html')) || (await caches.match('./')) || Response.error()));
    return; }

  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {   /* cache-first + fill */
    if (r.ok) { const cl = r.clone(); caches.open(CACHE).then(c => c.put(req, cl)); }
    return r;
  }).catch(() => caches.match('./'))));
});