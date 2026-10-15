'use strict';
const CACHE='toeicflash-private-v31';
const FILES=['./','./index.html','./app.js','./semantic-images.js','./style.css','./manifest.webmanifest','./icon.svg'];
const OCR_HOSTS=new Set(['cdn.jsdelivr.net','tessdata.projectnaptha.com']);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('toeicflash-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET')return;
 const own=url.origin===self.location.origin;
 const ocr=url.protocol==='https:'&&OCR_HOSTS.has(url.hostname)&&(
   (url.hostname==='cdn.jsdelivr.net'&&url.pathname.startsWith('/npm/tesseract'))||
   (url.hostname==='tessdata.projectnaptha.com'&&url.pathname.startsWith('/4.0.0/'))
 );
 if(!own&&!ocr){event.respondWith(Promise.reject(Error('External requests disabled')));return}
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{
  if(response.ok||response.type==='opaque'){
   const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{}));
  }
  return response;
 })));
});
