'use strict';
const CACHE='toeicflash-private-v57';
const FILES=['./','./index.html','./app.js','./semantic-images.js','./style.css','./manifest.webmanifest','./icon.svg'];
// Third-party OCR assets are fetched directly by Safari. Do not intercept or
// cache opaque cross-origin responses in the app service worker: failed/opaque
// responses can otherwise become stuck and prevent later retries.
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('toeicflash-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{}))}
  return response;
 })));
});
