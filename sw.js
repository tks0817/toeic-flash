'use strict';
const CACHE='toeicflash-private-v84';
const FILES=['./','./index.html','./app.js','./semantic-images.js','./style.css','./manifest.webmanifest','./icon.svg'];
const SHELL=new Set(FILES.map(path=>new URL(path,self.registration.scope).pathname));
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('toeicflash-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 if(!SHELL.has(url.pathname))return;
 // Network-first for the application shell: do not pin older versions forever.
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{
   const fresh=await fetch(req,{cache:'no-store'});
   if(fresh.ok){await cache.put(req,fresh.clone()).catch(()=>{});return fresh;}
   throw Error('Network response '+fresh.status);
  }catch(err){
   const cached=await cache.match(req,{ignoreSearch:true});
   if(cached)return cached;
   throw err;
  }
 })());
});
