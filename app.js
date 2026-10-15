'use strict';
// TOEIC Flash private v2. All personal data is stored in first-party IndexedDB.
const $=id=>document.getElementById(id);
const LEGACY='toeicflash-pwa-v1',DB_NAME='toeicflash-private-v2',STORE='cards';
const seed=[['affordable','手頃な価格の'],['revenue','収益、売上高'],['approximately','およそ、約'],['mandatory','必須の'],['invoice','請求書'],['postpone','延期する'],['reimbursement','払い戻し、経費精算'],['accommodate','収容する、要望に応じる'],['inventory','在庫'],['implement','実施する、導入する'],['quotation','見積書'],['shipment','出荷'],['venue','会場'],['deadline','締め切り'],['negotiate','交渉する'],['purchase','購入する'],['notify','知らせる'],['applicant','応募者'],['annual','年1回の'],['available','利用できる']];
const dictionary=Object.fromEntries([...seed,['appointment','予約'],['reservation','予約'],['schedule','予定'],['conference','会議'],['meeting','会議'],['department','部署'],['employee','従業員'],['customer','顧客'],['receipt','領収書'],['refund','返金'],['delivery','配達'],['discount','割引'],['promotion','昇進、販促'],['advertisement','広告'],['agreement','契約、合意'],['contract','契約'],['budget','予算'],['expense','費用'],['estimate','見積もり'],['equipment','設備'],['maintenance','保守点検'],['facility','施設'],['supplier','仕入先'],['manufacturer','製造業者'],['attend','出席する'],['confirm','確認する'],['require','必要とする'],['submit','提出する'],['policy','方針'],['replace','交換する'],['renew','更新する'],['branch','支店'],['headquarters','本社'],['application','申請書'],['position','職位'],['interview','面接'],['qualification','資格'],['benefit','福利厚生、利点'],['eligible','資格がある'],['efficient','効率的な'],['increase','増加する'],['decrease','減少する'],['representative','担当者']]);
const uid=()=>crypto.randomUUID(),clean=s=>String(s??'').trim(),normalize=s=>clean(s).toLowerCase();
let db,words=[],deck=[],pos=0,flipped=false,candidates=[],editing=null,ocrWorker=null,previewUrl=null,persistQueue=Promise.resolve();
function toast(s){const t=$('toast');t.textContent=s;t.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.style.display='none',3500)}
function openDB(){return new Promise((res,rej)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)})}
function dbRead(){return new Promise((res,rej)=>{let tx=db.transaction(STORE,'readonly');let req=tx.objectStore(STORE).getAll();req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)})}
function dbReplace(items){return new Promise((res,rej)=>{let tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);s.clear();items.forEach(w=>s.put(w));tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error)})}
function save(){const snapshot=structuredClone(words);persistQueue=persistQueue.catch(()=>{}).then(()=>dbReplace(snapshot)).catch(e=>{console.error('保存に失敗',e);toast('保存失敗。バックアップを確認してください')});return persistQueue}
function sanitize(w){if(!w||typeof w.en!=='string'||typeof w.ja!=='string')return null;let en=normalize(w.en).slice(0,100),ja=clean(w.ja).slice(0,500);if(!en||!ja)return null;return {id:typeof w.id==='string'&&w.id.length<150?w.id:uid(),en,ja,status:['new','known','missed'].includes(w.status)?w.status:'new',...(typeof w.reviewedAt==='string'?{reviewedAt:w.reviewedAt}:{})}}
function legacyRead(){try{const data=JSON.parse(localStorage.getItem(LEGACY)||'null');return Array.isArray(data)?data.map(sanitize).filter(Boolean):[]}catch(e){console.warn('旧データの読み取り失敗',e);return []}}
function mergeIncoming(incoming){const byId=new Map(words.map(w=>[w.id,w])),byEn=new Map(words.map(w=>[normalize(w.en),w]));let n=0;for(let w of incoming){if(byId.has(w.id)||byEn.has(normalize(w.en)))continue;words.push(w);byId.set(w.id,w);byEn.set(normalize(w.en),w);n++}return n}
async function migrate(){let old=legacyRead();let added=mergeIncoming(old);if(added)await save();return {found:old.length,added}}
function stats(){$('total').textContent=words.length;$('learned').textContent=words.filter(w=>w.status==='known').length;$('weak').textContent=words.filter(w=>w.status!=='known').length}
function filtered(){let f=$('filter').value;return words.filter(w=>f==='all'||(f==='weak'&&w.status!=='known')||w.status===f)}
function rebuild(shuffle=false){let old=deck[pos];deck=filtered().map(w=>w.id);if(shuffle)for(let i=deck.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}pos=Math.max(0,deck.indexOf(old));flipped=false;drawCard()}
function drawCard(){let w=words.find(w=>w.id===deck[pos]);$('front').textContent=w?.en||'単語がありません';$('back').textContent=w&&flipped?w.ja:'';drawMnemonic(w);$('progress').textContent=deck.length?`${pos+1} / ${deck.length} 枚`:'この条件のカードはありません';['card','speak','miss','know','prev','next'].forEach(id=>$(id).disabled=!w);stats()}
function move(i){if(!deck.length)return;pos=(pos+i+deck.length)%deck.length;flipped=false;drawCard()}
async function grade(status){let w=words.find(w=>w.id===deck[pos]);if(!w)return;w.status=status;w.reviewedAt=new Date().toISOString();await save();let p=pos;deck=filtered().map(w=>w.id);pos=deck.length?Math.min(p,deck.length-1):0;flipped=false;drawCard();toast('学習記録を保存しました')}
function tab(id){for(let t of ['study','scan','words','privacy'])$(t).hidden=t!==id;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));if(id==='words')drawWords();if(id==='study')rebuild()}
function drawWords(){let root=$('wordList');root.replaceChildren();let q=normalize($('search').value);let arr=words.filter(w=>normalize(w.en).includes(q)||w.ja.includes(q));if(!arr.length){let p=document.createElement('p');p.className='muted';p.textContent='該当する単語がありません';root.append(p)}for(let w of arr){let el=document.createElement('div');el.className='word';let text=document.createElement('div');let b=document.createElement('strong');b.textContent=w.en;let small=document.createElement('small');small.textContent=w.ja+' · '+({new:'未学習',known:'覚えた',missed:'復習対象'}[w.status]||'未学習');text.append(b,small);let edit=document.createElement('button');edit.className='secondary';edit.textContent='編集';edit.onclick=()=>editor(w);let del=document.createElement('button');del.className='danger';del.textContent='削除';del.onclick=async()=>{if(!confirm(`${w.en} を削除しますか？`))return;words=words.filter(x=>x.id!==w.id);await save();drawWords();rebuild()};el.append(text,edit,del);root.append(el)}}
function editor(w){editing=w?.id||null;$('editEn').value=w?.en||'';$('editJa').value=w?.ja||'';$('editor').showModal()}
function extractText(text){let matches=(text.match(/[A-Za-z][A-Za-z'-]{2,}/g)||[]).map(normalize);let skip=new Set('the and for with from that this have your are was were will can not you our their they them its into may but has had one two three about these those which when where what there here some any all how why who use used using also than then page unit lesson vocabulary words word list chapter reading listening exercise part test practice english toeic'.split(' '));candidates=[...new Set(matches)].filter(w=>w.length>=3&&!skip.has(w)).slice(0,100).map(en=>({en,ja:dictionary[en]||'',selected:true}));renderCandidates()}
function renderCandidates(){let root=$('candidateList');root.replaceChildren();$('candidates').hidden=!candidates.length;if(!candidates.length){toast('単語を検出できませんでした');return}for(let w of candidates){let row=document.createElement('div');row.className='candidate';let cb=document.createElement('input');cb.type='checkbox';cb.checked=w.selected;cb.setAttribute('aria-label',w.en+' を登録');cb.onchange=()=>w.selected=cb.checked;let group=document.createElement('div');let en=document.createElement('input');en.type='text';en.value=w.en;en.setAttribute('aria-label','英単語');en.oninput=()=>w.en=en.value;let ja=document.createElement('input');ja.type='text';ja.value=w.ja;ja.placeholder='日本語訳を入力';ja.setAttribute('aria-label','日本語訳');ja.oninput=()=>w.ja=ja.value;group.append(en,ja);row.append(cb,group);root.append(row)}toast(candidates.length+'語を抽出しました')}
function discardPhoto(){if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null}$('photo').value='';$('preview').removeAttribute('src');$('preview').hidden=true;$('ocr').disabled=true}
function loadScript(url){return new Promise((res,rej)=>{let s=document.createElement('script');s.src=url;s.onload=res;s.onerror=()=>rej(Error('ローカルOCR部品がありません。READMEの導入手順を確認してください'));document.head.append(s)})}
async function doOCR(){let file=$('photo').files[0];if(!file)return;let btn=$('ocr');btn.disabled=true;$('ocrStatus').textContent='端末内OCR部品を確認しています';try{if(!window.Tesseract)await loadScript('./vendor/tesseract/tesseract.min.js');if(!ocrWorker)ocrWorker=await Tesseract.createWorker('eng',1,{workerPath:'./vendor/tesseract/worker.min.js',corePath:'./vendor/tesseract-core/tesseract-core-simd-lstm.wasm.js',langPath:'./vendor/tessdata',gzip:true,logger:m=>{if(m.status)$('ocrStatus').textContent=`${m.status} ${Math.round((m.progress||0)*100)}%`}});$('ocrStatus').textContent='写真を端末内で解析中…';let result=await ocrWorker.recognize(file);let text=result.data.text||'';if(!text.trim())throw Error('文字が検出できませんでした');extractText(text);$('ocrStatus').textContent='認識完了。日本語訳を確認して保存してください'}catch(e){$('ocrStatus').textContent='認識できませんでした: '+e.message}finally{discardPhoto()}}
// AES-256-GCM backup. Only encrypted bytes are written to downloadable files.
const bytesToB64=u=>{let out='';for(const b of u)out+=String.fromCharCode(b);return btoa(out)};
const b64ToBytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function derive(pass,salt){let base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
function download(obj,name){const u=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000)}
async function exportEncrypted(){let pass=$('password').value;if(pass.length<8)return toast('8文字以上のパスワードを入力してください');try{await persistQueue;let salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await derive(pass,salt);let plain=new TextEncoder().encode(JSON.stringify({version:3,words,studyTime:timeState,exportedAt:new Date().toISOString()}));let encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain);download({format:'toeicflash-encrypted-v2',kdf:'PBKDF2-SHA256',iterations:250000,salt:bytesToB64(salt),iv:bytesToB64(iv),ciphertext:bytesToB64(new Uint8Array(encrypted))},'toeicflash-private-backup.json');toast('暗号化バックアップを作成しました')}catch(e){toast('バックアップに失敗しました')}}
async function importData(data,mode){let raw;if(mode==='encrypted'){if(data.format!=='toeicflash-encrypted-v2')throw Error('暗号化ファイルではありません');let pass=$('password').value;if(!pass)throw Error('バックアップ時のパスワードを入力してください');let key=await derive(pass,b64ToBytes(data.salt));let result=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(data.iv)},key,b64ToBytes(data.ciphertext));raw=JSON.parse(new TextDecoder().decode(result))}else raw=data;if(!Array.isArray(raw.words))throw Error('単語データがありません');let incoming=raw.words.slice(0,10000).map(sanitize).filter(Boolean);if(!confirm(`${incoming.length}語を現在の単語に追加しますか？（既存単語は削除しません）`))return;let n=mergeIncoming(incoming);await save();if(mode==='encrypted'&&raw.studyTime&&Number.isFinite(Number(raw.studyTime.totalMs))){timeState.totalMs=Math.max(timeState.totalMs,Math.max(0,Number(raw.studyTime.totalMs)));timeSave();timeRender()}rebuild();toast(n+'語を追加しました')}

// Locally generated mnemonic illustration: deterministic SVG shapes, no images fetched/uploaded.
// Visual mnemonic is an abstract illustration, not an AI-generated semantic depiction.
const pictureTypes=[
 ['☀','太陽'],['✉','手紙'],['✈','旅行'],['⌂','家'],['♬','音楽'],
 ['★','星'],['⚙','道具'],['♧','植物'],['◆','形'],['☕','コーヒー'],
 ['◉','目標'],['☂','雨'],['♫','音'],['⚑','旗'],['✦','光'],['⌛','時間']
];
function drawMnemonic(w){
 const root=$('wordImage');if(!root)return;
 root.replaceChildren();if(!w)return;
 if(window.TOEICSemanticIllustration){root.append(window.TOEICSemanticIllustration(w.en,w.ja));return;}
 let hash=0;for(const c of w.en)hash=((hash*31+c.charCodeAt(0))>>>0);
 const [symbol,description]=pictureTypes[hash%pictureTypes.length];
 const hues=[195,155,35,270,15,225];const hue=hues[hash%hues.length];
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 240 104');svg.setAttribute('role','img');
 svg.setAttribute('aria-label','記憶の目印 '+description);
 const ns='http://www.w3.org/2000/svg';
 const rect=document.createElementNS(ns,'rect');rect.setAttribute('width','240');rect.setAttribute('height','104');rect.setAttribute('rx','16');rect.setAttribute('fill',`hsl(${hue} 48% 22%)`);svg.append(rect);
 for(let i=0;i<7;i++){let circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',String((hash+i*43)%240));circle.setAttribute('cy',String((hash+i*29)%104));circle.setAttribute('r',String(3+i%3));circle.setAttribute('fill','white');circle.setAttribute('opacity','.14');svg.append(circle)}
 let t=document.createElementNS(ns,'text');t.setAttribute('x','120');t.setAttribute('y','68');t.setAttribute('font-size','51');t.setAttribute('text-anchor','middle');t.setAttribute('fill','#ffffff');t.textContent=symbol;svg.append(t);
 root.append(svg);
}
async function loadPdfJs(){
 if(window.pdfjsLib)return window.pdfjsLib;
 await loadScript('./vendor/pdfjs/pdf.min.js');
 if(!window.pdfjsLib)throw Error('PDFライブラリの読み込みに失敗しました');
 window.pdfjsLib.GlobalWorkerOptions.workerSrc='./vendor/pdfjs/pdf.worker.min.js';
 return window.pdfjsLib;
}
async function getOcrWorker(){
 if(!window.Tesseract)await loadScript('./vendor/tesseract/tesseract.min.js');
 if(!ocrWorker)ocrWorker=await Tesseract.createWorker('eng',1,{workerPath:'./vendor/tesseract/worker.min.js',corePath:'./vendor/tesseract-core/tesseract-core-simd-lstm.wasm.js',langPath:'./vendor/tessdata',gzip:true,logger:m=>{if(m.status)$('pdfStatus').textContent='OCR: '+m.status+' '+Math.round((m.progress||0)*100)+'%'}});
 return ocrWorker;
}
let pdfBusy=false;
async function readPdf(){
 if(pdfBusy)return;
 const file=$('pdfFile').files[0];if(!file)return toast('PDFを選択してください');
 if(file.size>40*1024*1024)return toast('PDFが40MBを超えています。分割してください');
 pdfBusy=true;$('pdfRead').disabled=true;
 let doc;
 try{
  $('pdfStatus').textContent='PDFを端末内で開いています…';
  const pdfjs=await loadPdfJs();
  doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,disableFontFace:true}).promise;
  const limit=Math.min(doc.numPages,Number($('pdfLimit').value)||10);
  let chunks=[];
  for(let n=1;n<=limit;n++){
   $('pdfStatus').textContent=`${n}/${limit}ページを解析中…`;
   let page=await doc.getPage(n);
   const text=(await page.getTextContent()).items.map(i=>i.str||'').join(' ');
   if(text.replace(/\s/g,'').length>=30){chunks.push(text)}
   else{
    const viewport=page.getViewport({scale:1.15});
    if(viewport.width*viewport.height>9000000)throw Error('ページ画像が大きすぎます。PDFを分割・縮小してください');
    const canvas=document.createElement('canvas');
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    const ctx=canvas.getContext('2d',{alpha:false});
    await page.render({canvasContext:ctx,viewport}).promise;
    const worker=await getOcrWorker();
    const result=await worker.recognize(canvas);
    chunks.push(result.data.text||'');
    canvas.width=canvas.height=0;
   }
   page.cleanup();
  }
  extractText(chunks.join('\n'));
  $('pdfStatus').textContent=`完了：${limit}ページから${candidates.length}語の候補を抽出しました。訳を確認して保存してください。`;
 }catch(e){console.error(e);$('pdfStatus').textContent='PDF解析に失敗しました: '+e.message}
 finally{try{await doc?.destroy()}catch{};$('pdfFile').value='';pdfBusy=false;$('pdfRead').disabled=false}
}
// Foreground study time only. pagehide persists immediately; iOS may terminate without
// a close event, so last seconds can be lost. No timer data is sent to a server.
const TIMER_KEY='toeicflash-study-time-v3';
let timeState={totalMs:0,sessions:0},sessionMs=0,lastTick=0,active=false;
function fmtTime(ms){const sec=Math.floor(ms/1000);return [Math.floor(sec/3600),Math.floor(sec%3600/60),sec%60].map(n=>String(n).padStart(2,'0')).join(':')}
function timeLoad(){try{const v=JSON.parse(localStorage.getItem(TIMER_KEY)||'{}');timeState.totalMs=Math.max(0,Number(v.totalMs)||0);timeState.sessions=Math.max(0,Number(v.sessions)||0)}catch{}timeState.sessions++;timeSave()}
function timeSave(){try{localStorage.setItem(TIMER_KEY,JSON.stringify(timeState))}catch{}}
function timeRender(){$('sessionTime').textContent=fmtTime(sessionMs);$('totalTime').textContent=fmtTime(timeState.totalMs)}
function timeTick(){if(active){const now=performance.now();const delta=Math.max(0,now-lastTick);lastTick=now;sessionMs+=delta;timeState.totalMs+=delta;timeSave()}timeRender()}
function timeResume(){if(active||document.hidden)return;active=true;lastTick=performance.now()}
function timePause(){timeTick();active=false;timeSave()}
function initTimer(){timeLoad();timeResume();timeRender();setInterval(timeTick,1000);document.addEventListener('visibilitychange',()=>document.hidden?timePause():timeResume());window.addEventListener('pagehide',timePause);window.addEventListener('pageshow',timeResume)}

function bind(){$('pdfRead').onclick=readPdf;document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));$('card').onclick=()=>{flipped=!flipped;drawCard()};$('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);$('shuffle').onclick=()=>rebuild(true);$('filter').onchange=()=>rebuild();$('know').onclick=()=>grade('known');$('miss').onclick=()=>grade('missed');$('speak').onclick=()=>{let w=words.find(w=>w.id===deck[pos]);if(!w||!('speechSynthesis'in window))return toast('音声を再生できません');speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(w.en);u.lang='en-US';u.rate=.82;speechSynthesis.speak(u)};
$('pasteClipboard').onclick=async()=>{try{if(!navigator.clipboard?.readText)throw Error('Safariでクリップボードの直接読み取りに対応していません');const text=await navigator.clipboard.readText();if(!text.trim())throw Error('コピーされた文字がありません');if(text.length>50000)throw Error('文字数が多すぎます。写真ごとにコピーしてください');$('paste').value=text;extractText(text);$('clipboardStatus').textContent=`${candidates.length}語を抽出しました。日本語訳を確認してください。`;if(candidates.length)$('candidates').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){$('clipboardStatus').textContent='直接取り込みできませんでした。下の「テキストを貼り付けて登録」を開き、長押しで貼り付けてください。';}};$('photo').onchange=()=>{discardPreviewOnly();let file=$('photo').files[0];if(!file)return;previewUrl=URL.createObjectURL(file);$('preview').src=previewUrl;$('preview').hidden=false;$('ocr').disabled=false;$('ocrStatus').textContent='写真を選択しました。文字認識後に写真は破棄します'};$('discard').onclick=()=>{discardPhoto();$('ocrStatus').textContent='写真を破棄しました'};$('ocr').onclick=doOCR;$('fromText').onclick=()=>extractText($('paste').value);$('allSelect').onclick=()=>{candidates.forEach(w=>w.selected=true);renderCandidates()};$('noneSelect').onclick=()=>{candidates.forEach(w=>w.selected=false);renderCandidates()};$('saveCandidates').onclick=async()=>{let selected=candidates.filter(w=>w.selected).map(w=>({en:normalize(w.en),ja:clean(w.ja)}));if(!selected.length)return toast('単語を選択してください');if(selected.some(w=>!w.en||!w.ja))return toast('日本語訳を入力してください');let n=mergeIncoming(selected.filter(w=>/^[a-z][a-z' -]*$/.test(w.en)).map(w=>({...w,id:uid(),status:'new'})));await save();candidates=[];$('paste').value='';rebuild();tab('words');toast(n+'語を登録しました')};$('addManual').onclick=()=>editor();$('search').oninput=drawWords;
$('editorForm').addEventListener('submit',async e=>{if(e.submitter?.value!=='save')return;e.preventDefault();let en=normalize($('editEn').value),ja=clean($('editJa').value);if(!en||!ja)return;if(editing){let w=words.find(w=>w.id===editing);if(w)Object.assign(w,{en,ja})}else if(words.some(w=>normalize(w.en)===en))return toast('同じ単語が登録済みです');else words.push({id:uid(),en,ja,status:'new'});$('editor').close();await save();rebuild();drawWords();toast('保存しました')});
$('exportEncrypted').onclick=exportEncrypted;$('importEncrypted').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{await importData(JSON.parse(await f.text()),'encrypted')}catch(err){toast('復元失敗: パスワードまたはファイルを確認してください')}finally{e.target.value=''}};$('importLegacy').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{await importData(JSON.parse(await f.text()),'legacy')}catch(err){toast('有効な旧バックアップではありません')}finally{e.target.value=''}};$('migrateAgain').onclick=async()=>{try{let r=await migrate();rebuild();toast(`旧版 ${r.found} 語を確認、${r.added} 語を追加`)}catch{toast('旧データの移行に失敗しました')}};$('deleteAll').onclick=async()=>{if(!confirm('新保存領域の全単語と学習履歴を削除します。暗号化バックアップを取りましたか？'))return;if(!confirm('本当に削除しますか？ 旧版の保存データは残ります。'))return;words=[];await save();rebuild();drawWords();toast('新保存領域を削除しました')}}
function discardPreviewOnly(){if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null}$('preview').removeAttribute('src');$('preview').hidden=true}
async function init(){initTimer();try{db=await openDB();words=(await dbRead()).map(sanitize).filter(Boolean);let r=await migrate();if(!words.length&&r.found===0){words=seed.map(([en,ja])=>({id:uid(),en,ja,status:'new'}));await save()}$('migration').textContent=r.found?`旧版データ ${r.found}語を確認し、${r.added}語を安全に統合しました。元データは削除していません。`:'端末内保存を利用中。写真・単語・学習履歴はGitHubへ送信されません。';bind();rebuild();if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{})}catch(e){console.error(e);$('migration').textContent='保存領域を開けません。Safariのプライベートブラウズ設定・空き容量・サイトデータを確認し、元データを消さずに再度開いてください。';toast('アプリを開始できませんでした')}}
init();
