'use strict';
// TOEIC Flash private v2. All personal data is stored in first-party IndexedDB.
const $=id=>document.getElementById(id);
const LEGACY='toeicflash-pwa-v1',DB_NAME='toeicflash-private-v2',STORE='cards';
const seed=[['affordable','手頃な価格の'],['revenue','収益、売上高'],['approximately','およそ、約'],['mandatory','必須の'],['invoice','請求書'],['postpone','延期する'],['reimbursement','払い戻し、経費精算'],['accommodate','収容する、要望に応じる'],['inventory','在庫'],['implement','実施する、導入する'],['quotation','見積書'],['shipment','出荷'],['venue','会場'],['deadline','締め切り'],['negotiate','交渉する'],['purchase','購入する'],['notify','知らせる'],['applicant','応募者'],['annual','年1回の'],['available','利用できる']];
const dictionary=Object.fromEntries([...seed,['appointment','予約'],['reservation','予約'],['schedule','予定'],['conference','会議'],['meeting','会議'],['department','部署'],['employee','従業員'],['customer','顧客'],['receipt','領収書'],['refund','返金'],['delivery','配達'],['discount','割引'],['promotion','昇進、販促'],['advertisement','広告'],['agreement','契約、合意'],['contract','契約'],['budget','予算'],['expense','費用'],['estimate','見積もり'],['equipment','設備'],['maintenance','保守点検'],['facility','施設'],['supplier','仕入先'],['manufacturer','製造業者'],['attend','出席する'],['confirm','確認する'],['require','必要とする'],['submit','提出する'],['policy','方針'],['replace','交換する'],['renew','更新する'],['branch','支店'],['headquarters','本社'],['application','申請書'],['position','職位'],['interview','面接'],['qualification','資格'],['benefit','福利厚生、利点'],['eligible','資格がある'],['efficient','効率的な'],['increase','増加する'],['decrease','減少する'],['representative','担当者']]);
const uid=()=>crypto.randomUUID(),clean=s=>String(s??'').trim(),normalize=s=>clean(s).toLowerCase();
let db,words=[],deck=[],pos=0,flipped=false,lastViewedCard=null,autoTimer=null,candidates=[],editing=null,ocrWorker=null,previewUrl=null,persistQueue=Promise.resolve();
function toast(s){const t=$('toast');t.textContent=s;t.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.style.display='none',3500)}
// Local-only diagnostics: no photos, card text, or personal study records are logged.
const BUG_KEY='toeicflash-bugs-v42',BUG_LIMIT=40;
function safeBugMessage(value){
 const raw=String(value?.message||value||'不明なエラー');
 return raw.replace(/https?:\/\/[^\s)]+/g,'[URL]').replace(/(?:[A-Za-z]:)?\/?(?:[^\s/]+\/){2,}[^\s/]+/g,'[path]').slice(0,160);
}
function readBugs(){try{const v=JSON.parse(localStorage.getItem(BUG_KEY)||'[]');return Array.isArray(v)?v.slice(-BUG_LIMIT):[]}catch{return []}}
function reportBug(type,error){
 try{const a=readBugs();const msg=safeBugMessage(error);const now=new Date().toISOString();
 const last=a[a.length-1];if(last&&last.type===type&&last.message===msg&&Date.now()-Date.parse(last.at)<60000){last.count=(last.count||1)+1;last.at=now}else a.push({at:now,type:String(type).slice(0,50),message:msg,count:1,status:'unresolved'});
 localStorage.setItem(BUG_KEY,JSON.stringify(a.slice(-BUG_LIMIT)));renderBugs()}catch{}
}
// This error was fixed by adding the missing autoRepeats control and guarding its access.
// Historical logs remain intact; a successful current-version check is not proof of every fix.
function isOldAutoRepeatsBug(b){return b.type==='初期化'&&/autoRepeats/.test(b.message||'')&&/null is not an object|Cannot set properties of null|value/i.test(b.message||'')}
function hasAutoRepeatsControl(){return !!$('autoRepeats')&&['1','2','3','4','5'].some(v=>[...$('autoRepeats').options].some(o=>o.value===v))}
function classifyKnownBugs(){
 const list=readBugs();if(!list.length)return;
 let changed=false;
 for(const b of list){if(isOldAutoRepeatsBug(b)&&hasAutoRepeatsControl()&&b.status!=='recovered'){
  b.status='recovered';b.detail='v50で該当UIの存在と安全な参照を確認。過去のエラー記録を保持';changed=true;
 }}
 if(changed){try{localStorage.setItem(BUG_KEY,JSON.stringify(list))}catch{}}
 renderBugs();
}
function renderBugs(){
 const root=$('bugList');if(!root)return;root.replaceChildren();
 const bugs=readBugs().slice().reverse();$('bugCount').textContent=bugs.length+'件の記録（最大'+BUG_LIMIT+'件）';
 if(!bugs.length){const p=document.createElement('p');p.textContent='記録されたエラーはありません。未検出の不具合がないことを保証しません。';root.append(p);return}
 for(const bug of bugs){const p=document.createElement('p');p.className='bug-entry';const status=bug.status==='recovered'?'復旧確認済み（暫定）':bug.status==='difficult'?'自動修復困難':'未対応／確認待ち';p.textContent=`${new Date(bug.at).toLocaleString('ja-JP')} | ${status} | ${bug.type} | ${bug.message}${bug.count>1?' (繰返し'+bug.count+'回)':''}`;root.append(p)}
}
async function repairBugs(){
 const list=readBugs();if(!list.length)return toast('修復対象の記録はありません');
 let recovered=0,difficult=0;
 for(const item of list){
  if(item.status==='recovered')continue;
  if(isOldAutoRepeatsBug(item)&&hasAutoRepeatsControl()){item.status='recovered';item.detail='現在の画面部品と安全な参照を確認';recovered++;continue;}
  if(item.type==='単語保存'){
   // A harmless read-only check cannot prove a failed write was recovered.
   item.status='difficult';item.detail='保存失敗は自動上書きせず、バックアップ確認が必要';difficult++;continue;
  }
  if(item.type==='音声'||item.type==='読み上げ'){
   item.status='difficult';item.detail='iOS音声制限・音声データはユーザー操作が必要';difficult++;continue;
  }
  if(item.type==='診断テスト'){
   item.status='recovered';item.detail='テスト記録のみ';recovered++;continue;
  }
  if(item.type==='非同期処理'||item.type==='JavaScript'||item.type==='初期化'){
   item.status='difficult';item.detail='原因不明のコードエラーは安全に自動書換えできません';difficult++;continue;
  }
  item.status='difficult';item.detail='安全な自動修復手順がありません';difficult++;
 }
 try{localStorage.setItem(BUG_KEY,JSON.stringify(list));renderBugs();toast(`診断完了：暫定復旧${recovered}件／自動修復困難${difficult}件`)}catch(e){toast('診断結果を保存できませんでした')}
}
window.addEventListener('error',e=>reportBug('JavaScript',e.message||'スクリプト実行エラー'));
window.addEventListener('unhandledrejection',e=>reportBug('非同期処理',e.reason));
function speakCurrent(){
 const w=words.find(w=>w.id===deck[pos]);if(!w)return;
 if(!('speechSynthesis'in window)){reportBug('音声','音声合成非対応');toast('この端末では音声を再生できません');return}
 try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(w.en);u.lang='en-US';u.rate=.82;
 u.onerror=e=>{if(e.error!=='canceled'&&e.error!=='interrupted')reportBug('読み上げ',e.error||'音声再生失敗')};
 speechSynthesis.speak(u)}catch(e){reportBug('読み上げ',e);toast('音声再生に失敗しました')}
}
function speakJapanese(){
 const w=words.find(w=>w.id===deck[pos]);
 if(!w||!w.ja||!('speechSynthesis'in window))return;
 try{
  speechSynthesis.cancel();
  // Speak only the translation; avoid unnatural pauses from notes and separators.
  const text=String(w.ja).replace(/\s*[［\[【（(][^］\]】）)]*[］\]】）)]/g,'').replace(/[／/|｜]/g,'、').replace(/\s+/g,' ').trim();
  if(!text)return;
  const u=new SpeechSynthesisUtterance(text);
  u.lang='ja-JP';u.rate=1.02;u.pitch=1;
  const voices=speechSynthesis.getVoices();
  const japanese=voices.filter(v=>/^ja(?:-|_)/i.test(v.lang));
  const preferred=japanese.find(v=>/Kyoko|Otoya|Siri|Hattori|Nanami|Haruka/i.test(v.name))||japanese.find(v=>v.localService)||japanese[0];
  if(preferred)u.voice=preferred;
  u.onerror=e=>{if(!['canceled','interrupted'].includes(e.error))reportBug('日本語読み上げ',e.error||'音声再生失敗')};
  speechSynthesis.speak(u);
 }catch(e){reportBug('日本語読み上げ',e)}
}
function maybeSpeakJapanese(){if($('autoJapanese')?.checked&&deck.length)speakJapanese()}
function maybeAutoSpeak(){
 if(!$('autoPronounce')?.checked||!deck.length)return;
 // iOS may require the first user gesture to enable speech synthesis.
 speakCurrent();
}
function openDB(){return new Promise((res,rej)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)})}
function dbRead(){return new Promise((res,rej)=>{let tx=db.transaction(STORE,'readonly');let req=tx.objectStore(STORE).getAll();req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)})}
function dbReplace(items){return new Promise((res,rej)=>{let tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);s.clear();items.forEach(w=>s.put(w));tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error)})}
function save(){const snapshot=structuredClone(words);persistQueue=persistQueue.catch(()=>{}).then(()=>dbReplace(snapshot));return persistQueue.catch(e=>{console.error('保存に失敗',e);reportBug('単語保存',e);toast('保存失敗。データを確認してください');throw e})}
function sanitize(w){if(!w||typeof w.en!=='string'||typeof w.ja!=='string')return null;let en=normalize(w.en).slice(0,100),ja=clean(w.ja).slice(0,500);if(!en||!ja)return null;return {id:typeof w.id==='string'&&w.id.length<150?w.id:uid(),en,ja,status:['new','known','missed'].includes(w.status)?w.status:'new',...(typeof w.reviewedAt==='string'?{reviewedAt:w.reviewedAt}:{}),viewCount:Math.max(0,Math.floor(Number(w.viewCount)||0)),correctCount:Math.max(0,Math.floor(Number(w.correctCount)||0)),wrongCount:Math.max(0,Math.floor(Number(w.wrongCount)||0)),...(typeof w.ipa==='string'?{ipa:w.ipa.slice(0,80)}:{}),kind:['headword','example'].includes(w.kind)?w.kind:'headword',note:typeof w.note==='string'?w.note.slice(0,500):'',...(Number.isSafeInteger(w.order)&&w.order>=0?{order:w.order}:{})}}
function legacyRead(){try{const data=JSON.parse(localStorage.getItem(LEGACY)||'null');return Array.isArray(data)?data.map(sanitize).filter(Boolean):[]}catch(e){console.warn('旧データの読み取り失敗',e);return []}}
function mergeIncoming(incoming){ensureWordOrder();const byId=new Map(words.map(w=>[w.id,w])),byEn=new Map(words.map(w=>[normalize(w.en),w]));let n=0;for(let w of incoming){if(byId.has(w.id)||byEn.has(normalize(w.en)))continue;words.push(w);byId.set(w.id,w);byEn.set(normalize(w.en),w);n++}ensureWordOrder();return n}
async function migrate(){let old=legacyRead();let added=mergeIncoming(old);if(added)await save();return {found:old.length,added}}
function stats(){$('total').textContent=words.length;$('learned').textContent=words.filter(w=>w.status==='known').length;$('weak').textContent=words.filter(w=>w.status!=='known').length}
function reviewScore(w){return (w.wrongCount||0)*3-(w.correctCount||0)+(w.status==='missed'?3:0)+(w.status==='new'?1:0)}
function filtered(){let f=$('filter').value;let result=words.filter(w=>f==='all'||(f==='weak'&&w.status!=='known')||(f==='priority'&&((w.wrongCount||0)>0||w.status==='missed'))||w.status===f);if(f==='priority')result.sort((a,b)=>reviewScore(b)-reviewScore(a));return result}
function rebuild(shuffle=false,allowSpeech=true,countView=false){let old=deck[pos];deck=filtered().map(w=>w.id);if(shuffle)for(let i=deck.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}pos=Math.max(0,deck.indexOf(old));flipped=false;if(countView)recordView();drawCard();if(allowSpeech)maybeAutoSpeak()}
function recordView(){const w=words.find(w=>w.id===deck[pos]);if(!w)return;/* Count each deliberate visit, including revisiting the same card in a one-card deck. Do not count flip or redraw. */w.viewCount=(w.viewCount||0)+1;save().catch(()=>{});}
function drawCard(){let w=words.find(w=>w.id===deck[pos]);const test=isTestMode();$('front').textContent=w?.en||'単語がありません';$('pronunciation').textContent=w?(getPronunciation(w)||'発音記号：未登録（音声で確認）'):'';$('answerStats').textContent=w?(test?`正解 ${w.correctCount||0}回`:`カード閲覧 ${w.viewCount||0}回`):'';$('back').textContent=w&&flipped?(w.ja+(w.note?'\n補足：'+w.note:'')):'';$('wordImage').hidden=!flipped; if(flipped)drawMnemonic(w);else $('wordImage').replaceChildren();$('progress').textContent=deck.length?`${pos+1} / ${deck.length} 枚`:'この条件のカードはありません';['card','speak','prev','next'].forEach(id=>$(id).disabled=!w);['miss','know'].forEach(id=>{$(id).disabled=!w;$(id).hidden=!test});$('autoControls').hidden=test;stats()}
function isTestMode(){return $('studyMode').value==='test'}
let autoRepeatDone=0;
function stopAuto(){if(autoTimer!==null){clearInterval(autoTimer);autoTimer=null}const b=$('autoToggle');if(b)b.textContent='▶ 自動'}
function autoStep(){if(!deck.length||isTestMode()||$('study').hidden){stopAuto();return}
 if(!flipped){flipped=true;drawCard();maybeSpeakJapanese();return}
 autoRepeatDone++;
 const limit=Math.min(5,Math.max(1,Number($('autoRepeats')?.value)||1));
 if(autoRepeatDone<limit){flipped=false;drawCard();maybeAutoSpeak()}
 else{autoRepeatDone=0;move(1)}
}
function startAuto(){stopAuto();autoRepeatDone=0;if(isTestMode())return;const sec=Number($('autoSeconds').value);if(!Number.isInteger(sec)||sec<2||sec>120)return toast('2〜120秒で設定してください');$('autoSeconds').value=String(sec);autoTimer=setInterval(autoStep,sec*1000);maybeAutoSpeak();$('autoToggle').textContent='■ 停止';toast(`${sec}秒ごとに表・裏を切り替え、${$('autoRepeats')?.value||1}回繰り返します`)}
// v56: Safari-compatible swipe tracking with pointer fallback.
// Horizontal swipes navigate, taps flip, and vertical movements remain scrollable.
let swipeStart=null, suppressCardClick=false, swipeConsumedAt=0;
function installCardSwipe(){
 const card=$('card');if(!card)return;
 const start=(x,y,source)=>{if(!deck.length)return;swipeStart={x,y,source,done:false};};
 const finish=(x,y,source)=>{
  const a=swipeStart;if(!a||a.source!==source||a.done)return;
  swipeStart=null;
  const dx=x-a.x,dy=y-a.y;
  if(Math.abs(dx)<42||Math.abs(dx)<Math.abs(dy)*1.15)return;
  if(Date.now()-swipeConsumedAt<350)return;
  swipeConsumedAt=Date.now();
  suppressCardClick=true;
  setTimeout(()=>{suppressCardClick=false},650);
  stopAuto();autoRepeatDone=0;
  move(dx<0?1:-1);
  if(deck.length===1)toast(dx<0?'次へ → （1枚目に戻りました）':'← 前へ （1枚目に戻りました）');
 };
 card.addEventListener('touchstart',e=>{if(e.touches.length===1){const t=e.touches[0];start(t.clientX,t.clientY,'touch')}},{passive:true});
 card.addEventListener('touchend',e=>{if(e.changedTouches.length===1){const t=e.changedTouches[0];finish(t.clientX,t.clientY,'touch')}},{passive:true});
 card.addEventListener('touchcancel',()=>{swipeStart=null},{passive:true});
 // Pointer events cover browsers that do not dispatch TouchEvents.
 card.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||e.pointerType==='pen')start(e.clientX,e.clientY,'pointer')},{passive:true});
 card.addEventListener('pointerup',e=>{if(e.pointerType==='mouse'||e.pointerType==='pen')finish(e.clientX,e.clientY,'pointer')},{passive:true});
 card.addEventListener('click',e=>{if(suppressCardClick){e.preventDefault();e.stopImmediatePropagation();suppressCardClick=false}},true);
}
function move(i){if(!deck.length)return;pos=(pos+i+deck.length)%deck.length;flipped=false;recordView();drawCard();maybeAutoSpeak()}
async function grade(status){let w=words.find(w=>w.id===deck[pos]);if(!w)return;w.status=status;if(status==='known')w.correctCount=(w.correctCount||0)+1;else w.wrongCount=(w.wrongCount||0)+1;w.reviewedAt=new Date().toISOString();await save();let p=pos;deck=filtered().map(w=>w.id);pos=deck.length?Math.min(p,deck.length-1):0;flipped=false;recordView();drawCard();maybeAutoSpeak();toast('学習記録を保存しました')}
function tab(id){
 const ids=['study','timer','scan','words','privacy'];
 if(!ids.includes(id))id='study';
 document.body.classList.toggle('study-fullscreen',id==='study');
 stopAuto();
 for(const t of ids){const el=$(t);if(!el)continue;el.hidden=t!==id;el.style.setProperty('display',t===id?'block':'none','important');}
 document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===id);b.setAttribute('aria-selected',String(b.dataset.tab===id))});
 try{if(id==='words')drawWords();if(id==='study')rebuild(false,false,true);if(id==='timer')renderDaily()}catch(e){reportBug('画面表示 '+id,e);console.error(e)}
}
let selectedIds=new Set();let movingWordId=null;
// Stable user-defined order; saved with each card in IndexedDB.
function ensureWordOrder(){
 const used=new Set();let next=Math.max(-1,...words.map(w=>Number.isSafeInteger(w.order)?w.order:-1))+1;
 for(const w of words){if(!Number.isSafeInteger(w.order)||w.order<0||used.has(w.order))w.order=next++;used.add(w.order)}
 words.sort((a,b)=>a.order-b.order);
}
async function moveWord(id,step){
 if(clean($('search').value)){toast('順番変更は検索を解除してから行ってください');return}
 ensureWordOrder();const i=words.findIndex(w=>w.id===id),j=i+step;
 if(i<0||j<0||j>=words.length)return;
 const previous=words.map(w=>({id:w.id,order:w.order}));
 [words[i],words[j]]=[words[j],words[i]];
 words.forEach((w,index)=>w.order=index);
 try{await save()}catch(e){const m=new Map(previous.map(w=>[w.id,w.order]));words.forEach(w=>w.order=m.get(w.id));words.sort((a,b)=>a.order-b.order);return}
 drawWords();rebuild(false,false);toast('単語の順番を保存しました');
}
// v61: long-press drag ordering with touch/pointer support (iOS Safari).
let reorderDrag=null;
function installDragHandle(handle,row,id){
 let pressTimer=null,startX=0,startY=0,pointerId=null,active=false;
 const clear=()=>{if(pressTimer!==null){clearTimeout(pressTimer);pressTimer=null}};
 const finish=async(commit)=>{
  clear();if(!active){reorderDrag=null;return}
  active=false;row.classList.remove('dragging');document.querySelectorAll('#wordList .word.drag-over').forEach(el=>el.classList.remove('drag-over'));
  const target=reorderDrag?.targetId;reorderDrag=null;
  if(!commit||!target||target===id)return;
  const before=words.map(w=>({id:w.id,order:w.order}));
  const from=words.findIndex(w=>w.id===id),to=words.findIndex(w=>w.id===target);
  if(from<0||to<0)return;
  const [moved]=words.splice(from,1);words.splice(to,0,moved);words.forEach((w,i)=>w.order=i);
  try{await save();drawWords();rebuild(false,false);toast('並び順を保存しました')}
  catch(e){const orders=new Map(before.map(w=>[w.id,w.order]));words.forEach(w=>w.order=orders.get(w.id));words.sort((a,b)=>a.order-b.order);drawWords();toast('並び順を保存できませんでした')}
 };
 handle.addEventListener('pointerdown',e=>{
  if(clean($('search').value)||e.button!==0||reorderDrag)return;
  pointerId=e.pointerId;startX=e.clientX;startY=e.clientY;
  const activate=()=>{active=true;reorderDrag={id,targetId:id};row.classList.add('dragging');if(navigator.vibrate)navigator.vibrate(20);toast('移動先までドラッグして指を離してください')};
  if(e.pointerType==='mouse')activate();else pressTimer=setTimeout(activate,320);
  try{handle.setPointerCapture(e.pointerId)}catch(_){}
 });
 handle.addEventListener('pointermove',e=>{
  if(e.pointerId!==pointerId)return;
  if(!active){if(Math.hypot(e.clientX-startX,e.clientY-startY)>13)clear();return}
  e.preventDefault();
  const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('#wordList .word');
  document.querySelectorAll('#wordList .word.drag-over').forEach(el=>el.classList.remove('drag-over'));
  if(hit){hit.classList.add('drag-over');reorderDrag.targetId=hit.dataset.wordId}
  if(e.clientY>window.innerHeight-65)window.scrollBy(0,14);
  else if(e.clientY<85)window.scrollBy(0,-14);
 });
 handle.addEventListener('pointerup',e=>{if(e.pointerId===pointerId){pointerId=null;finish(true)}});
 handle.addEventListener('pointercancel',()=>{pointerId=null;finish(false)});
 handle.addEventListener('lostpointercapture',()=>{if(pointerId!==null){pointerId=null;finish(false)}});
 handle.addEventListener('contextmenu',e=>e.preventDefault());
}
function beginWordMove(id){
 movingWordId=movingWordId===id?null:id;
 drawWords();
 if(movingWordId)toast('移動先の単語にある「ここへ移動」を押してください');
}
async function placeWordBefore(targetId){
 const id=movingWordId;
 if(!id||id===targetId){movingWordId=null;drawWords();return}
 const before=words.map(w=>({id:w.id,order:w.order}));
 const from=words.findIndex(w=>w.id===id),to=words.findIndex(w=>w.id===targetId);
 if(from<0||to<0)return;
 const [item]=words.splice(from,1);
 const newIndex=words.findIndex(w=>w.id===targetId);
 words.splice(newIndex,0,item);words.forEach((w,i)=>w.order=i);
 movingWordId=null;
 try{await save();drawWords();rebuild(false,false);toast('選んだ位置へ移動しました')}
 catch(e){const old=new Map(before.map(w=>[w.id,w.order]));words.forEach(w=>w.order=old.get(w.id));words.sort((a,b)=>a.order-b.order);drawWords()}
}
function drawWords(){let root=$('wordList');root.replaceChildren();let q=normalize($('search').value);let arr=words.filter(w=>normalize(w.en).includes(q)||w.ja.includes(q));const reorderEnabled=!q;
 if(!reorderEnabled)movingWordId=null;
 $('orderHint').textContent=reorderEnabled?(movingWordId?'② 移動先の「ここへ移動」を押すと、その単語の直前に入ります。もう一度「移動を取消」で中止できます。':'① 移動したい単語の「移動」を押す → ② 移動先の「ここへ移動」を押す。≡ の長押しドラッグも利用できます。'):'順番変更は検索を解除すると使えます。';$('selectionCount').textContent=`${selectedIds.size}語選択中`;if(!arr.length){let p=document.createElement('p');p.className='muted';p.textContent='該当する単語がありません';root.append(p)}for(let [rowIndex,w] of arr.entries()){let el=document.createElement('div');el.className='word';if(movingWordId===w.id)el.classList.add('move-source');let cb=document.createElement('input');cb.type='checkbox';cb.checked=selectedIds.has(w.id);cb.setAttribute('aria-label',w.en+' を選択');cb.onchange=()=>{if(cb.checked)selectedIds.add(w.id);else selectedIds.delete(w.id);$('selectionCount').textContent=`${selectedIds.size}語選択中`};let text=document.createElement('div');let b=document.createElement('strong');b.textContent=w.en;let small=document.createElement('small');small.textContent=(w.kind==='example'?'📌 例文重要語句 · ':'')+w.ja+(w.note?' · 補足あり':'')+' · '+({new:'未学習',known:'覚えた',missed:'復習対象'}[w.status]||'未学習')+` · 利用${w.viewCount||0}回 · 正解${w.correctCount||0}回`;text.append(b,small);let edit=document.createElement('button');edit.className='secondary';edit.textContent='編集';edit.onclick=()=>editor(w);let del=document.createElement('button');del.className='danger';del.textContent='削除';del.onclick=async()=>{if(!confirm(`${w.en} を削除しますか？`))return;words=words.filter(x=>x.id!==w.id);selectedIds.delete(w.id);await save();drawWords();rebuild()};let handle=document.createElement('button');handle.type='button';handle.className='drag-handle secondary';handle.textContent='≡';handle.title='長押しして並べ替え';handle.setAttribute('aria-label',w.en+' を長押しして並べ替え');handle.disabled=!reorderEnabled;el.dataset.wordId=w.id;installDragHandle(handle,el,w.id);let orderNumber=document.createElement('span');orderNumber.className='order-number';orderNumber.textContent=String(rowIndex+1);
 let moveBtn=document.createElement('button');moveBtn.type='button';moveBtn.className='secondary move-word-button';
 moveBtn.disabled=!reorderEnabled;
 moveBtn.textContent=movingWordId===w.id?'移動を取消':movingWordId?'ここへ移動':'移動';
 moveBtn.onclick=()=>movingWordId&&movingWordId!==w.id?placeWordBefore(w.id):beginWordMove(w.id);
 el.append(orderNumber,cb,handle,text,moveBtn,edit,del);root.append(el)}}

function editor(w){editing=w?.id||null;$('editEn').value=w?.en||'';$('editJa').value=w?.ja||'';$('editIpa').value=w?.ipa||getPronunciation(w||{en:''})||'';$('editNote').value=w?.note||'';$('editKind').value=w?.kind||'headword';$('editor').showModal()}
// Conservative bilingual row extraction. Sentences and uncertain pairings are excluded.
function extractPairs(text){
 const out=[],seen=new Set();
 const lines=text.replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean);
 const hasJa=/[\u3040-\u30ff\u3400-\u9fff]/;
 const english=/^(?:[0-9]{1,4}[.)\s-]+)?([A-Za-z][A-Za-z'-]{1,34}(?: [A-Za-z][A-Za-z'-]{1,20}){0,2})$/;
 let section='headword';
 function add(en,ja,kind=section,note=''){
  en=normalize(en);ja=ja.replace(/^[：:・\-\s]+/,'').trim();
  if(!ja||ja.length>90||!hasJa.test(ja)||en.split(' ').length>3||seen.has(en)||/[.!?]$/.test(en))return false;
  // OCR noise gate: reject implausibly short fragments and mixed-script junk.
  if(en.replace(/[^a-z]/g,'').length<3||/(?:[|\\<>]|[A-Za-z]{3,})/.test(ja)||/[ぁ-んァ-ン一-龥]\s*[|＆&]\s*[A-Za-z]/.test(ja))return false;
  seen.add(en);out.push({en,ja,selected:true,source:kind==='example'?'例文の重要語句候補':'印刷語句候補',kind,note,needsReview:true});return true;
 }
 for(let i=0;i<lines.length;i++){
  let line=lines[i];
  // Optional section headers are explicit user guidance, never inferred from typography.
  if(/^(?:【?\s*(?:例文の重要語句|例文語句|下線語句|重要表現)\s*】?|#\s*例文)/.test(line)&&line.length<24){section='example';continue}
  if(/^(?:【?\s*(?:見出し語|見出し単語|基本単語)\s*】?|#\s*見出し)/.test(line)&&line.length<24){section='headword';continue}
  let forced=null;
  const prefix=line.match(/^(見出し語|見出し単語|基本単語|例文語句|下線語句|重要表現)\s*[：:]\s*(.+)$/);
  if(prefix){forced=/^(例文|下線|重要)/.test(prefix[1])?'example':'headword';line=prefix[2]}
  let m=line.match(/^(?:[0-9]{1,4}[.)\s-]+)?([A-Za-z][A-Za-z'-]{1,34}(?: [A-Za-z][A-Za-z'-]{1,20}){0,2})\s*(?:[:：=｜|\t]|[—–-]\s+| {2,})\s*(.+)$/);
  if(m&&hasJa.test(m[2])){add(m[1],m[2],forced||section);continue}
  const boundary=line.search(/[\u3040-\u30ff\u3400-\u9fff]/);
  if(boundary>0){
   const lhs=line.slice(0,boundary).trim().replace(/[：:=｜|・\-\s]+$/,'').trim();
   const match=lhs.match(english);
   if(match){add(match[1],line.slice(boundary),forced||section);continue}
  }
  m=line.match(english);
  if(m&&i+1<lines.length&&hasJa.test(lines[i+1])&&!/[A-Za-z]{4,}.*[A-Za-z]{4,}/.test(lines[i+1])){
   if(add(m[1],lines[i+1],forced||section))i++;
  }
 }
 return out.slice(0,150);
}
// User-confirmed underlined or handwritten pairs, kept separate from uncertain OCR.
function addMarkedPair(){const en=normalize($('markedEnglish').value),ja=clean($('markedJapanese').value);if(!/^[a-z][a-z' -]{0,95}$/.test(en)||!/[\u3040-\u30ff\u3400-\u9fff]/.test(ja)){toast('英語と日本語訳を両方入力してください');return}const result=mergeCandidateProposal({en,ja,selected:true,source:'下線・手書き（手動確認）',kind:$('markedKind').value,note:clean($('markedNote').value).slice(0,500),needsReview:true});if(result==='same'){toast('同じ英語と日本語訳は既に候補にあります');return}renderCandidates();$('markedEnglish').value='';$('markedJapanese').value='';$('markedNote').value='';$('pairHint').textContent='下線・手書き候補を追加しました。保存前に教材写真と照合してください。'}
function mergeCandidateProposal(item){
 const existing=candidates.find(w=>normalize(w.en)===normalize(item.en));
 if(!existing){candidates.push(item);return 'added'}
 const same=clean(existing.ja)===clean(item.ja);
 if(same){if((existing.kind||'headword')!==(item.kind||'headword')){existing.verified=false;existing.needsReview=true;const msg='カード種別の競合（要確認）：'+(item.kind==='example'?'例文の重要語句':'見出し単語');if(!(existing.note||'').includes(msg))existing.note=[existing.note||'',msg].filter(Boolean).join('\n').slice(0,500);return 'alternative'}return 'same'}
 const alt=clean(item.ja);
 const lines=(existing.note||'').split('\n');
 const marker='別候補の日本語訳（要確認）：'+alt;
 if(!lines.includes(marker)){
  existing.note=[existing.note||'',marker].filter(Boolean).join('\n').slice(0,500);
  existing.verified=false;existing.needsReview=true;
  existing.source=(existing.source||'')+'・別訳あり';
  return 'alternative';
 }
 return 'same';
}
function extractText(text){if(text.length>60000)return toast('一度に読み取る文字数が多すぎます。ページを分けてください');if(!text.trim())return toast('テキストがありません');const fresh=extractPairs(text);let added=0,alternatives=0;for(const w of fresh){const result=mergeCandidateProposal(w);if(result==='added')added++;if(result==='alternative')alternatives++;}renderCandidates();if(!candidates.length)$('pairHint').textContent='英単語と日本語訳の組を見つけられませんでした。英文や単語だけの行は除外しています。例：negotiate　交渉する（同じ行）、または単語の次の行に日本語訳を置いてください。';else $('pairHint').textContent=`候補${candidates.length}組（新規${added}組・異なる訳の候補${alternatives}組）。別訳は補足欄に保留し、必ず教材と照合してください。`}
const IPA_LOCAL={apple:'/ˈæp.əl/',negotiate:'/nɪˈɡoʊ.ʃi.eɪt/',affordable:'/əˈfɔːr.də.bəl/',revenue:'/ˈrev.ə.nuː/',invoice:'/ˈɪn.vɔɪs/',audit:'/ˈɔː.dɪt/',awareness:'/əˈwer.nəs/',municipal:'/mjuːˈnɪs.ɪ.pəl/',municipality:'/mjuːˌnɪs.ɪˈpæl.ə.ti/',customer:'/ˈkʌs.tə.mɚ/',employee:'/ɪmˈplɔɪ.iː/',purchase:'/ˈpɝː.tʃəs/',schedule:'/ˈskedʒ.uːl/',inventory:'/ˈɪn.vən.tɔːr.i/',reimbursement:'/ˌriː.ɪmˈbɝːs.mənt/',available:'/əˈveɪ.lə.bəl/',appointment:'/əˈpɔɪnt.mənt/',confirm:'/kənˈfɝːm/',delivery:'/dɪˈlɪv.ɚ.i/',receipt:'/rɪˈsiːt/'};
function getPronunciation(w){return w.ipa||IPA_LOCAL[normalize(w.en)]||''}

function moveCandidate(index,step){
 const next=index+step;
 if(next<0||next>=candidates.length)return;
 [candidates[index],candidates[next]]=[candidates[next],candidates[index]];
 renderCandidates();
 const rows=$('candidateList').children;
 rows[next]?.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function renderCandidates(){let root=$('candidateList');root.replaceChildren();$('candidates').hidden=!candidates.length;if(!candidates.length){toast('単語を検出できませんでした');return}for(let [idx,w] of candidates.entries()){let row=document.createElement('div');row.className='candidate';let tag=document.createElement('small');tag.textContent=`候補 ${idx+1}・${w.source||'要確認'}・保存前に照合`;tag.className='muted candidate-source';row.append(tag);
 let orderTools=document.createElement('div');orderTools.className='candidate-order';
 let up=document.createElement('button');up.type='button';up.className='secondary';up.textContent='↑ 上へ';up.disabled=idx===0;up.onclick=()=>moveCandidate(idx,-1);
 let down=document.createElement('button');down.type='button';down.className='secondary';down.textContent='↓ 下へ';down.disabled=idx===candidates.length-1;down.onclick=()=>moveCandidate(idx,1);
 orderTools.append(up,down);row.append(orderTools);
 let cb=document.createElement('input');cb.type='checkbox';cb.checked=w.selected;cb.setAttribute('aria-label',w.en+' を登録');cb.onchange=()=>{w.selected=cb.checked;updateCandidateAudit()};let group=document.createElement('div');let verified=document.createElement('label');verified.className='muted';let vcb=document.createElement('input');vcb.type='checkbox';vcb.checked=!!w.verified;vcb.onchange=()=>{w.verified=vcb.checked;updateCandidateAudit()};verified.append(vcb,document.createTextNode('教材写真・原文と照合済み'));let en=document.createElement('input');en.type='text';en.value=w.en;en.setAttribute('aria-label','英単語');en.oninput=()=>w.en=en.value;let ja=document.createElement('input');ja.type='text';ja.value=w.ja;ja.placeholder='日本語訳を入力';ja.setAttribute('aria-label','日本語訳');ja.oninput=()=>w.ja=ja.value;let kind=document.createElement('select');kind.setAttribute('aria-label','カード種別');for(const [value,label] of [['headword','見出し単語'],['example','例文の重要語句']]){let opt=document.createElement('option');opt.value=value;opt.textContent=label;kind.append(opt)}kind.value=w.kind||'headword';kind.onchange=()=>w.kind=kind.value;let note=document.createElement('textarea');note.rows=2;note.placeholder='補足・追加の意味（任意）';note.value=w.note||'';note.setAttribute('aria-label','補足メモ');note.oninput=()=>w.note=note.value.slice(0,500);group.append(en,ja,kind,note,verified);row.append(cb,group);root.append(row)}updateCandidateAudit();toast(candidates.length+'語を抽出しました')}
function showUnverifiedCandidates(){for(const row of $('candidateList').children){const checkbox=row.querySelector('label.muted input[type=checkbox]');row.hidden=!!(checkbox&&checkbox.checked)}$('candidates').scrollIntoView({behavior:'smooth',block:'start'})}
function showAllCandidates(){for(const row of $('candidateList').children)row.hidden=false}
function updateCandidateAudit(){const selected=candidates.filter(w=>w.selected);const confirmed=selected.filter(w=>w.verified).length;const status=$('candidateAudit');if(status)status.textContent=`選択中 ${selected.length}件 ／ 照合済み ${confirmed}件 ／ 要確認 ${selected.length-confirmed}件`;}

async function splitSpread(){
 const file=$('photo').files[0];if(!file)return toast('写真を選択してください');
 const button=$('splitSpread');button.disabled=true;
 try{
  const image=await createImageBitmap(file);
  try{
   if(image.width*image.height>24000000)throw Error('画像が大きすぎます。写真を縮小してください');
   const half=Math.floor(image.width*Number($('splitPosition').value)/100);
   if(half<200)throw Error('見開き写真の幅が小さすぎます');
   for(const [id,x,width] of [['spreadLeft',0,half],['spreadRight',half,image.width-half]]){
    const canvas=document.createElement('canvas');const ratio=Math.min(1,1500/width);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(image.height*ratio);
    canvas.getContext('2d').drawImage(image,x,0,width,image.height,0,0,canvas.width,canvas.height);
    $(id).src=canvas.toDataURL('image/jpeg',.85);canvas.width=canvas.height=0;
   }
   $('spreadHalves').hidden=false;
  }finally{image.close()}
 }catch(e){toast('左右分割できません: '+e.message)}finally{button.disabled=false}
}
async function splitEntries(){
 const file=$('photo').files[0];if(!file)return toast('先に見開き写真を選んでください');
 const btn=$('splitEntries');btn.disabled=true;
 try{
  const img=await createImageBitmap(file);
  try{
   if(img.width*img.height>24000000)throw Error('写真が大きすぎます。縮小してください');
   const split=Math.floor(img.width*Number($('splitPosition').value)/100);
   const root=$('entryRegions');const oldInputs=new Map([...root.querySelectorAll('textarea[data-region]')].map(el=>[el.dataset.region,el.value]));root.replaceChildren();
   for(let page=0;page<2;page++){
    const x=page===0?0:split,w=page===0?split:img.width-split;
    for(let i=0;i<5;i++){
     const top=Math.floor(img.height*i/5),bottom=Math.floor(img.height*(i+1)/5),height=bottom-top;
     const scale=Math.min(1,1100/w);
     const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(height*scale));
     canvas.getContext('2d').drawImage(img,x,top,w,height,0,0,canvas.width,canvas.height);
     const label=document.createElement('p');label.className='muted';label.textContent=`${page?'右':'左'}ページ・領域 ${i+1}（目視確認）`;
     const picture=document.createElement('img');picture.className='preview';picture.alt=label.textContent;
     picture.src=canvas.toDataURL('image/jpeg',.84);
     const field=document.createElement('textarea');field.rows=3;field.maxLength=6000;
     field.placeholder='この領域の英語と日本語を貼り付け（例：contract 契約）';
     field.setAttribute('aria-label',label.textContent+'の文字入力');field.dataset.region=String(page*5+i+1);field.value=oldInputs.get(field.dataset.region)||'';
     const copyHint=document.createElement('p');copyHint.className='muted';
     copyHint.textContent='iPhoneの写真アプリで認識した文字を貼り付けてください。画像そのものからのOCRではありません。';
     const shareButton=document.createElement('button');shareButton.type='button';shareButton.className='secondary full';
     shareButton.textContent='📤 この領域を共有・写真に保存';
     const regionNumber=page*5+i+1;
     shareButton.onclick=()=>shareRegion(regionNumber,shareButton);
     root.append(label,picture,shareButton,copyHint,field);canvas.width=canvas.height=0;
    }
   }
   root.hidden=false;toast('10領域の確認画像を作成しました');
  }finally{img.close()}
 }catch(e){toast('領域分割に失敗しました: '+e.message)}finally{btn.disabled=false}
}
async function shareRegion(number,button){
 const file=$('photo').files[0];if(!file)return toast('先に写真を選んでください');
 if(!Number.isInteger(number)||number<1||number>10)return;
 button.disabled=true;
 try{
  const img=await createImageBitmap(file);
  try{
   if(img.width*img.height>24000000)throw Error('写真が大きすぎます。縮小してください');
   const split=Math.floor(img.width*Number($('splitPosition').value)/100);
   const page=Math.floor((number-1)/5),part=(number-1)%5;
   const x=page===0?0:split,w=page===0?split:img.width-split;
   const top=Math.floor(img.height*part/5),bottom=Math.floor(img.height*(part+1)/5),height=bottom-top;
   const scale=Math.min(1,1800/w);
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(height*scale));
   canvas.getContext('2d').drawImage(img,x,top,w,height,0,0,canvas.width,canvas.height);
   const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('画像を作成できませんでした')),'image/jpeg',.93));
   canvas.width=canvas.height=0;
   const name=`toeic-region-${number}.jpg`;
   const imageFile=new File([blob],name,{type:'image/jpeg'});
   if(navigator.canShare?.({files:[imageFile]})&&navigator.share){
    try{await navigator.share({files:[imageFile],title:'TOEIC教材の確認画像'});return}
    catch(e){if(e.name==='AbortError')return}
   }
   const url=URL.createObjectURL(blob);
   try{const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();toast('領域画像を保存しました。写真アプリでテキスト認識できます')}
   finally{setTimeout(()=>URL.revokeObjectURL(url),30000)}
  }finally{img.close()}
 }catch(e){toast('画像の共有に失敗しました: '+e.message)}
 finally{button.disabled=false}
}
function extractRegions(){
 const fields=[...$('entryRegions').querySelectorAll('textarea[data-region]')];
 let total=0,alternativeTotal=0;
 for(const field of fields){
  const text=field.value.trim();if(!text)continue;
  const fresh=extractPairs(text);
  for(const item of fresh){
   item.source=`写真領域 ${field.dataset.region}・文字貼り付け`;
   item.needsReview=true;item.verified=false;item.selected=false;
   const result=mergeCandidateProposal(item);
   if(result==='added')total++;
   if(result==='alternative')alternativeTotal++;
  }
 }
 if(candidates.length)renderCandidates();
 $('pairHint').textContent=`領域別に新規${total}件・異なる訳の候補${alternativeTotal}件を取り込みました。別訳は補足欄で照合してください。`;
 if(!total&&!alternativeTotal)toast('新しい英日ペアはありません。日本語訳も貼り付けてください');
}
function clearSpread(){
 $('spreadTools').hidden=true;$('spreadHalves').hidden=true;$('entryRegions').hidden=true;$('entryRegions').replaceChildren();
 for(const id of ['spreadLeft','spreadRight'])$(id).removeAttribute('src');
}
function discardPhoto(){clearSpread();if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null}$('photo').value='';$('preview').removeAttribute('src');$('preview').hidden=true;$('ocr').disabled=true}
async function importClipboardText(){
 const status=$('ocrStatus');
 try{
  if(!navigator.clipboard||!navigator.clipboard.readText)throw Error('この環境ではクリップボードの読み取りが使えません');
  const text=(await navigator.clipboard.readText()).trim();
  if(!text){status.textContent='クリップボードが空です。iPhone写真アプリで文字をコピーしてください。';return}
  if(text.length>50000){status.textContent='文字数が多すぎます。教材1ページずつコピーしてください。';return}
  $('paste').value=text;
  const before=candidates.length;
  extractText(text);
  status.textContent=`クリップボードから${text.length}文字を読み込みました。登録候補は教材写真と照合してください。`;
  if(candidates.length===before)status.textContent+=' 英語と日本語訳が同じ行にない場合は、貼り付け欄で組み合わせを修正してください。';
 }catch(e){
  status.textContent='クリップボードを直接読めませんでした。Safariの権限設定を確認するか、下のテキスト欄に長押しで貼り付けてください。';
  $('paste').focus();
 }
}
function loadScript(url){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=url;el.async=true;el.onload=()=>{if(window.Tesseract)resolve();else{el.remove();reject(Error('OCRスクリプトは読み込めましたがTesseractが見つかりません：'+url))}};el.onerror=()=>{el.remove();reject(Error('OCRスクリプトを取得できません：'+url))};document.head.append(el)})}
const OCR_SOURCES=[
 {name:'jsDelivr',script:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',worker:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',core:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0'},
 {name:'unpkg',script:'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js',worker:'https://unpkg.com/tesseract.js@5.1.1/dist/worker.min.js',core:'https://unpkg.com/tesseract.js-core@5.0.0'},
 {name:'cdnjs',script:'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js',worker:'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/worker.min.js',core:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0'}
];
let activeOCRSource=null;
let ocrPhase='待機中';
function setOCRPhase(phase){ocrPhase=phase;$('ocrStatus').textContent='OCR準備：'+phase}
async function loadOCRScript(){
 const errors=[];
 for(const source of OCR_SOURCES){
  try{
   setOCRPhase(`スクリプト取得 ${source.name}`);
   await loadScript(source.script);
   activeOCRSource=source;
   return;
  }catch(e){errors.push(source.name+': '+e.message)}
 }
 throw Error('OCRスクリプトを取得できません。通信制限・コンテンツブロッカー・GitHub Pagesの更新を確認してください。 '+errors.join(' / '));
}
async function createLocalOCRWorker(source){
 return window.Tesseract.createWorker('jpn+eng',1,{
  workerPath:source.worker,corePath:source.core,
  langPath:'https://tessdata.projectnaptha.com/4.0.0',
  workerBlobURL:true,gzip:true,cacheMethod:'write',
  logger:m=>{if(m.status){ocrPhase=m.status;$('ocrStatus').textContent='日本語OCR：'+m.status+' '+Math.round((m.progress||0)*100)+'%'}}
 });
}
async function getPhotoOCREngine(){
 if(typeof window.TextDetector==='function'){
  return {name:'ブラウザー内蔵OCR',recognize:async canvas=>(await (new window.TextDetector()).detect(canvas)).map(b=>b.rawValue||'').join('\n')};
 }
 if(!window.Tesseract)await loadOCRScript();
 if(!ocrWorker){
  const sources=activeOCRSource?[activeOCRSource,...OCR_SOURCES.filter(s=>s!==activeOCRSource)]:OCR_SOURCES;
  const errors=[];
  for(const source of sources){
   try{
    setOCRPhase(`ワーカー・WASM・言語データ準備 ${source.name}（初回は大容量）`);
    ocrWorker=await createLocalOCRWorker(source);
    activeOCRSource=source;
    break;
   }catch(e){
    errors.push(source.name+': '+(e?.message||String(e)));
    ocrWorker=null;
   }
  }
  if(!ocrWorker)throw Error('OCRワーカー／認識データの準備に失敗しました。 '+errors.join(' / '));
 }
 return {name:'日本語OCR（Tesseract.js／端末内処理）',recognize:async canvas=>(await ocrWorker.recognize(canvas)).data.text};
}
async function testJapaneseOCR(){
 const btn=$('ocrSelfTest'),status=$('ocrStatus');btn.disabled=true;
 try{
  status.textContent='v40 OCR診断中：認識エンジンを読み込んでいます…';
  const engine=await getPhotoOCREngine();
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=250;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1200,250);
  ctx.fillStyle='#111';ctx.font='bold 80px sans-serif';ctx.fillText('apple りんご',35,150);
  let raw='';try{raw=await engine.recognize(canvas)}finally{canvas.width=canvas.height=0}
  const hasEnglish=/apple/i.test(raw),hasJapanese=/りんご|リンゴ|林檎/.test(raw);
  status.textContent=`OCR診断（${engine.name}）：英語 ${hasEnglish?'検出':'未検出'}／日本語 ${hasJapanese?'検出':'未検出'}。認識文字「${raw.replace(/\s+/g,' ').slice(0,150)}」。${hasEnglish&&hasJapanese?'基本認識に成功しました。実際の教材での精度は別途確認してください。':'日本語OCRの準備・設定を確認してください。'}`;
 }catch(e){status.textContent='v40 OCR診断失敗（段階：'+ocrPhase+'）：'+e.message+'。URLや表示内容を記録してください。'}
 finally{btn.disabled=false}
}
// v54: textbook-aware OCR. All pixels and recognized text remain on this device.
function colorMatch(r,g,b,kind){
 const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
 if(kind==='blue')return b>r*1.08&&b>g*.98&&b>75&&delta>20&&r<195;
 return r>g*1.15&&g>b*1.05&&r>115&&delta>28;
}
function inkRows(canvas,kind){
 const w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d',{willReadFrequently:true});
 const d=ctx.getImageData(0,0,w,h).data,rows=new Array(h).fill(0);
 for(let y=0;y<h;y+=2){let n=0;for(let x=0;x<w;x+=2){const i=(y*w+x)*4;if(colorMatch(d[i],d[i+1],d[i+2],kind))n++}rows[y]=rows[Math.max(0,y-1)]=n}
 return rows;
}
function clusters(rows,threshold,minGap=13){
 let groups=[],open=-1,last=-1;
 for(let y=0;y<rows.length;y++){if(rows[y]>=threshold){if(open<0)open=y;last=y}else if(open>=0&&y-last>minGap){groups.push({top:open,bottom:last});open=-1}}
 if(open>=0)groups.push({top:open,bottom:last});
 return groups.filter(g=>g.bottom-g.top>=7);
}
function makeCanvas(img,x,y,w,h,scale=2){
 const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));
 c.getContext('2d').drawImage(img,x,y,w,h,0,0,c.width,c.height);return c;
}
function isolateColor(canvas,kind){
 const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0);
 const im=ctx.getImageData(0,0,c.width,c.height),d=im.data;
 for(let i=0;i<d.length;i+=4){if(colorMatch(d[i],d[i+1],d[i+2],kind)){d[i]=d[i+1]=d[i+2]=0}else{d[i]=d[i+1]=d[i+2]=255}}
 ctx.putImageData(im,0,0);return c;
}
function cleanHeadword(raw){
 const parts=raw.replace(/[|\\]/g,' ').split(/\s+/).map(v=>v.replace(/[^A-Za-z'-]/g,'').toLowerCase()).filter(v=>/^[a-z][a-z'-]{2,30}$/.test(v));
 return parts.find(v=>v.length>=4)||parts[0]||'';
}
function cleanTranslation(raw){
 return raw.replace(/[\r\n]+/g,' ').replace(/\[[^\]]*\]/g,'').replace(/^[^ぁ-んァ-ン一-龥]+/,'').replace(/\s+/g,' ').trim().slice(0,70);
}
async function doLayoutOCR(image,engine,status){
 const split=Math.floor(image.width*Number($('splitPosition').value)/100);
 const diagnostics=[];let added=0,alternatives=0;
 for(let page=0;page<2;page++){
  const x0=page?split:0,pw=page?image.width-split:split;
  // Locate the blue printed headings, not arbitrary fifths of the whole photograph.
  const scan=makeCanvas(image,x0,0,pw,image.height,Math.min(1,650/pw));
  const rows=inkRows(scan,'blue');
  const minInk=Math.max(4,Math.floor(scan.width*.014));
  let groups=clusters(rows,minInk,12).filter(g=>g.top>scan.height*.09&&g.top<scan.height*.88);
  scan.width=scan.height=0;
  // Ignore tiny blue marks; merge adjacent fragments of one title.
  groups=groups.filter(g=>g.bottom-g.top>=8).sort((a,b)=>a.top-b.top);
  // Page decoration may be blue. Limit to five strongest separated heading regions.
  const selected=[];
  for(const g of groups){if(selected.length&&g.top-selected[selected.length-1].bottom<9){const prev=selected[selected.length-1];prev.bottom=Math.max(prev.bottom,g.bottom)}else selected.push({...g})}
  // Use all groups but avoid merging heading words across lines.
  const ratio=1/Math.min(1,650/pw);
  groups=selected.filter(g=>g.top*ratio>image.height*.12&&g.top*ratio<image.height*.78).slice(0,7);
  if(groups.length!==5){diagnostics.push(`${page?'右':'左'}ページ：見出し位置${groups.length}件（想定5件）。領域の確認が必要`)}
  for(let i=0;i<Math.min(5,groups.length);i++){
   const g=groups[i],cy=g.top*ratio, next=groups[i+1]?.top*ratio||cy+image.height*.13;
   const headingH=Math.max(28,(g.bottom-g.top+17)*ratio);
   const hx=x0+pw*.06,hw=pw*.78;
   const head=makeCanvas(image,hx,Math.max(0,cy-7*ratio),hw,Math.min(headingH,image.height-cy),Math.min(2.4,1400/hw));
   const blue=isolateColor(head,'blue');head.width=head.height=0;
   let en='';try{en=cleanHeadword(await engine.recognize(blue))}catch(e){diagnostics.push(`見出し${page*5+i+1}: ${e.message}`)}finally{blue.width=blue.height=0}
   const jaY=Math.max(0,cy-8*ratio),jaH=Math.min(Math.max(35,headingH*.95),Math.max(35,next-cy-5),image.height-jaY);
   const translation=makeCanvas(image,x0+pw*.29,jaY,pw*.67,jaH,Math.min(2.3,1300/(pw*.67)));
   const orange=isolateColor(translation,'orange');translation.width=translation.height=0;
   let ja='';try{ja=cleanTranslation(await engine.recognize(orange))}catch(e){diagnostics.push(`日本語${page*5+i+1}: ${e.message}`)}finally{orange.width=orange.height=0}
   if(!en){diagnostics.push(`${page?'右':'左'}${i+1}: 英語の読み取り失敗`);continue}
   const validJa=/[ぁ-んァ-ン一-龥]/.test(ja)&&!/[a-zA-Z]{3}/.test(ja);
   const item={en,ja:validJa?ja:'',selected:false,verified:false,needsReview:true,kind:'headword',note:'',source:`v54 色分離・${page?'右':'左'}ページ${i+1}番目（${validJa?'英日要照合':'日本語要修正'}）`};
   const result=mergeCandidateProposal(item);if(result==='added')added++;if(result==='alternative')alternatives++;
   if(!validJa)diagnostics.push(`${en}: 日本語訳の認識に失敗／手動確認`);
  }
 }
 if(candidates.length)renderCandidates();
 status.textContent=`教材レイアウトOCR：新規${added}件、別訳${alternatives}件。${diagnostics.length?'要確認：'+diagnostics.join(' / '):'全件、原文との照合が必要です。'} 誤認識の可能性があるため未選択です。`;
 if(!added)toast('見出し語が検出できませんでした。写真の傾きや明るさを調整してください');
}
async function doOCR(){
 const file=$('photo').files[0];
 if(!file)return toast('先に教材写真を選択してください');
 const btn=$('ocr'),status=$('ocrStatus');btn.disabled=true;
 try{
  const engine=await getPhotoOCREngine();
  const image=await createImageBitmap(file);
  try{
   if(image.width*image.height>24000000)throw Error('画像が大きすぎます。縮小してください');
   const split=Math.floor(image.width*Number($('splitPosition').value)/100);
   let added=0,alternatives=0,recognized=0;
   const mode=$('ocrLayout').value;
   if(mode==='layout'){await doLayoutOCR(image,engine,status);return}
   const count=mode==='pages'?2:10;
   const failed=[];
   for(let region=0;region<count;region++){
    const page=mode==='pages'?region:Math.floor(region/5);
    const part=mode==='pages'?0:region%5;
    const x=page?split:0,w=page?image.width-split:split;
    const top=mode==='pages'?0:Math.floor(image.height*part/5);
    const bottom=mode==='pages'?image.height:Math.floor(image.height*(part+1)/5);
    const canvas=document.createElement('canvas');
    const scale=Math.min(2,1800/w,2200/(bottom-top));
    canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round((bottom-top)*scale));
    canvas.getContext('2d').drawImage(image,x,top,w,bottom-top,0,0,canvas.width,canvas.height);
    status.textContent=`画像OCRを実行中：${region+1}/${count}（写真は外部送信しません）`;
    let raw;
    try{raw=await engine.recognize(canvas)}catch(e){failed.push(`${region+1}: ${e.message}`);continue}finally{canvas.width=canvas.height=0}
    if(!raw.trim())continue;
    recognized++;
    if(mode==='regions'){
     const field=$('entryRegions').querySelector(`textarea[data-region="${region+1}"]`);
     if(field&&!field.value.trim())field.value=raw;
    }else{
     const target=$('paste');
     const heading=page?'【右ページOCR】':'【左ページOCR】';
     const block=heading+'\n'+raw;
     if(!target.value.includes(block))target.value=(target.value?target.value+'\n\n':'')+block;
    }
    for(const item of extractPairs(raw)){
     item.source=`画像OCR・${mode==='pages'?(page?'右ページ':'左ページ'):'領域'+(region+1)}（要照合）`;
     item.needsReview=true;item.verified=false;item.selected=false;
     const result=mergeCandidateProposal(item);
     if(result==='added')added++;
     if(result==='alternative')alternatives++;
    }
   }
   if(candidates.length)renderCandidates();
   status.textContent=`${engine.name}完了：文字検出${recognized}/${count}${mode==='pages'?'ページ':'領域'}、新規候補${added}件、別訳${alternatives}件。誤認識や未抽出があり得ます。原文と照合してください。${failed.length?' 失敗した箇所：'+failed.join(' / '): ''}`;
   if(!recognized)toast('文字が検出されませんでした');
  }finally{image.close()}
 }catch(e){status.textContent='OCRを完了できませんでした：'+e.message+'。通信接続を確認するか、写真アプリでコピーして貼り付けてください。'}
 finally{btn.disabled=false}
}
// AES-256-GCM backup. Only encrypted bytes are written to downloadable files.
const bytesToB64=u=>{let out='';for(const b of u)out+=String.fromCharCode(b);return btoa(out)};
const b64ToBytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function derive(pass,salt){let base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
function download(obj,name){const u=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000)}
async function exportEncrypted(){let pass=$('password').value;if(pass.length<8)return toast('8文字以上のパスワードを入力してください');try{await persistQueue;let salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await derive(pass,salt);let plain=new TextEncoder().encode(JSON.stringify({version:4,words,studyTime:timeState,exportedAt:new Date().toISOString()}));let encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain);download({format:'toeicflash-encrypted-v2',kdf:'PBKDF2-SHA256',iterations:250000,salt:bytesToB64(salt),iv:bytesToB64(iv),ciphertext:bytesToB64(new Uint8Array(encrypted))},'toeicflash-private-backup.json');toast('暗号化バックアップを作成しました')}catch(e){toast('バックアップに失敗しました')}}
async function importData(data,mode){let raw;if(mode==='encrypted'){if(data.format!=='toeicflash-encrypted-v2')throw Error('暗号化ファイルではありません');let pass=$('password').value;if(!pass)throw Error('バックアップ時のパスワードを入力してください');let key=await derive(pass,b64ToBytes(data.salt));let result=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(data.iv)},key,b64ToBytes(data.ciphertext));raw=JSON.parse(new TextDecoder().decode(result))}else raw=data;if(!Array.isArray(raw.words))throw Error('単語データがありません');let incoming=raw.words.slice(0,10000).map(sanitize).filter(Boolean);if(!confirm(`${incoming.length}語を現在の単語に追加しますか？（既存単語は削除しません）`))return;let n=mergeIncoming(incoming);await save();if(mode==='encrypted'&&raw.studyTime&&Number.isFinite(Number(raw.studyTime.totalMs))){timeState.totalMs=Math.max(timeState.totalMs,Math.max(0,Number(raw.studyTime.totalMs)));if(raw.studyTime.daily&&typeof raw.studyTime.daily==='object'){timeState.daily={...timeState.daily,...raw.studyTime.daily}}timeSave();timeRender();renderDaily()}rebuild();toast(n+'語を追加しました')}

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
let timeState={totalMs:0,sessions:0,daily:{}},sessionMs=0,lastTick=0,active=false;
function fmtTime(ms){const sec=Math.floor(ms/1000);return [Math.floor(sec/3600),Math.floor(sec%3600/60),sec%60].map(n=>String(n).padStart(2,'0')).join(':')}
function timeLoad(){try{const v=JSON.parse(localStorage.getItem(TIMER_KEY)||'{}');timeState.totalMs=Math.max(0,Number(v.totalMs)||0);timeState.sessions=Math.max(0,Number(v.sessions)||0);timeState.daily=v.daily&&typeof v.daily==='object'?v.daily:{};for(const [day,ms] of Object.entries(timeState.daily)){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Number(ms))||Number(ms)<0)delete timeState.daily[day]}}catch{}timeState.sessions++;timeSave()}
function timeSave(){try{localStorage.setItem(TIMER_KEY,JSON.stringify(timeState))}catch{}}
function timeRender(){$('sessionTime').textContent=fmtTime(sessionMs);$('totalTime').textContent=fmtTime(timeState.totalMs)}
function localDay(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const GOAL_KEY='toeicflash-daily-goal-min-v49',GOAL_NOTICE_KEY='toeicflash-daily-goal-notified-v49';
function getGoalMinutes(){return Math.max(0,Math.min(1440,Number(localStorage.getItem(GOAL_KEY))||0))}
function showGoal(){
 const el=$('goalProgress');if(!el)return;
 const target=getGoalMinutes(),today=Number(timeState.daily[localDay()]||0);
 el.textContent=target?`今日の学習：${Math.floor(today/60000)}分 / 目標${target}分（${Math.min(100,Math.floor(today/(target*60000)*100))}%）`:'目標は未設定です';

}
function checkGoalReached(){
 const target=getGoalMinutes();if(!target)return;
 const day=localDay(),key=day+':'+target;
 if(Number(timeState.daily[day]||0)<target*60000||localStorage.getItem(GOAL_NOTICE_KEY)===key)return;
 localStorage.setItem(GOAL_NOTICE_KEY,key);
 toast(`🎉 今日の目標${target}分を達成しました！`);
 const banner=$('goalAchievement');if(banner){banner.hidden=false;banner.textContent=`🎉 本日の目標 ${target}分を達成しました！`}
 // Browser notifications only when previously permitted. No automatic permission request.
 if('Notification'in window&&Notification.permission==='granted'){
  try{new Notification('TOEIC Flash：学習目標達成',{body:`今日の学習時間が${target}分に到達しました。`})}catch(e){reportBug('目標通知',e)}
 }
}
function installPullRefresh(){
 let start=null,tracking=false;
 window.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||window.scrollY>8||document.querySelector('dialog[open]')){start=null;return}
  const t=e.touches[0];start={x:t.clientX,y:t.clientY};tracking=true;
 },{passive:true});
 window.addEventListener('touchend',e=>{
  if(!tracking||!start||e.changedTouches.length!==1){start=null;tracking=false;return}
  const t=e.changedTouches[0],dy=t.clientY-start.y,dx=Math.abs(t.clientX-start.x);
  start=null;tracking=false;
  if(window.scrollY>8||dy<105||dx>dy*.55)return;
  if(!navigator.onLine){toast('オフラインのため更新確認できません');return}
  toast('最新版を確認しています…');
  checkForUpdate().catch(err=>reportBug('更新確認',err));
 },{passive:true});
 window.addEventListener('touchcancel',()=>{start=null;tracking=false},{passive:true});
}
function timeTick(){if(active){const now=performance.now();const delta=Math.min(60000,Math.max(0,now-lastTick));lastTick=now;sessionMs+=delta;timeState.totalMs+=delta;const day=localDay();timeState.daily[day]=(Number(timeState.daily[day])||0)+delta;timeSave();checkGoalReached()}timeRender();if(!$('timer').hidden){renderDaily();showGoal()}}
function renderDaily(){const root=$('dailyList');if(!root)return;root.replaceChildren();const days=Object.keys(timeState.daily||{}).sort().reverse();if(!days.length){root.textContent='日別記録はまだありません。従来の累計時間は保持しています。';return}for(const day of days){const row=document.createElement('div');row.className='daily-row';const date=document.createElement('span');date.textContent=day;const inp=document.createElement('input');inp.type='number';inp.min='0';inp.max='1440';inp.step='1';inp.value=String(Math.round((Number(timeState.daily[day])||0)/60000));inp.setAttribute('aria-label',day+' の学習時間（分）');const unit=document.createElement('span');unit.textContent='分';const btn=document.createElement('button');btn.className='secondary';btn.textContent='保存';btn.onclick=()=>{const mins=Number(inp.value);if(!Number.isInteger(mins)||mins<0||mins>1440)return toast('0〜1440分の整数で入力してください');timePause();const old=Number(timeState.daily[day])||0;const next=mins*60000;timeState.daily[day]=next;timeState.totalMs=Math.max(0,timeState.totalMs+next-old);timeSave();timeRender();renderDaily();timeResume();toast(day+'の学習時間を保存しました')};row.append(date,inp,unit,btn);root.append(row)}}
function addDailyDate(){const day=$('dailyDate').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||new Date(day+'T00:00:00').toString()==='Invalid Date')return toast('日付を選択してください');if(!(day in timeState.daily)){timeState.daily[day]=0;timeSave()}renderDaily()}
function timeResume(){if(active||document.hidden)return;active=true;lastTick=performance.now()}
function timePause(){timeTick();active=false;timeSave()}
function initTimer(){timeLoad();timeResume();timeRender();setInterval(timeTick,1000);document.addEventListener('visibilitychange',()=>document.hidden?timePause():timeResume());window.addEventListener('pagehide',timePause);window.addEventListener('pageshow',timeResume)}

function applyTheme(mode){const v=mode==='dark'?'dark':'light';document.documentElement.dataset.theme=v;try{localStorage.setItem('toeicflash-theme',v)}catch{}}
async function checkForUpdate(){const btn=$('checkUpdate');btn.disabled=true;try{if(!navigator.onLine)throw Error('オフラインです');if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.getRegistration('./');if(reg)await reg.update()}const res=await fetch('./sw.js?version-check='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('更新確認に失敗しました');const text=await res.text();const m=text.match(/toeicflash-private-v(\d+)/);if(!m)throw Error('配信中のバージョンを判定できません');const server=Number(m[1]);const local=Number(document.querySelector('#headerVersion')?.textContent?.match(/v(\d+)/)?.[1]||51);if(server>local){if(confirm(`v${server}が公開されています。画面を再読み込みしますか？ 保存前の入力は失われます。`))location.reload()}else toast('公開中のバージョンはv'+server+'です。最新版です')}catch(e){toast('更新確認できません：'+e.message)}finally{btn.disabled=false}}
function bind(){installPullRefresh();$('goalMinutes').value=String(getGoalMinutes()||15);$('goalSave').onclick=()=>{const n=Number($('goalMinutes').value);if(!Number.isInteger(n)||n<1||n>1440)return toast('目標は1〜1440分で設定してください');localStorage.setItem(GOAL_KEY,String(n));$('goalAchievement').hidden=true;showGoal();checkGoalReached();toast('今日の目標を保存しました')};$('goalNotify').onclick=async()=>{if(!('Notification'in window))return toast('この環境では通知に対応していません');try{const state=await Notification.requestPermission();toast(state==='granted'?'通知を許可しました':'通知が許可されていません')}catch(e){reportBug('通知許可',e);toast('通知の許可を取得できませんでした')}};showGoal();$('pdfRead').onclick=readPdf;$('studyMode').onchange=()=>{stopAuto();drawCard()};$('autoToggle').onclick=()=>autoTimer===null?startAuto():stopAuto();$('openFlashSettings').onclick=()=>tab('privacy');$('autoSeconds').onchange=()=>{if(autoTimer!==null)startAuto()};$('dailyDate').value=localDay();$('addDailyDate').onclick=addDailyDate;$('themeMode').value=localStorage.getItem('toeicflash-theme')||'light';$('themeMode').onchange=()=>applyTheme($('themeMode').value);$('checkUpdate').onclick=checkForUpdate;if($('autoRepeats'))$('autoRepeats').value=localStorage.getItem('toeicflash-auto-repeats')||'1';
if($('autoRepeats'))$('autoRepeats').onchange=()=>{localStorage.setItem('toeicflash-auto-repeats',$('autoRepeats').value);autoRepeatDone=0};
$('autoJapanese').checked=localStorage.getItem('toeicflash-auto-japanese')==='true';
$('autoJapanese').onchange=()=>{localStorage.setItem('toeicflash-auto-japanese',String($('autoJapanese').checked));if($('autoJapanese').checked&&flipped)maybeSpeakJapanese()};
$('autoPronounce').checked=localStorage.getItem('toeicflash-auto-pronounce')==='true';$('autoPronounce').onchange=()=>{localStorage.setItem('toeicflash-auto-pronounce',String($('autoPronounce').checked));if($('autoPronounce').checked)maybeAutoSpeak()};$('clearBugs').onclick=()=>{if(!confirm('端末内のエラー記録を消去しますか？'))return;localStorage.removeItem(BUG_KEY);renderBugs()};$('repairBugs').onclick=repairBugs;$('bugSelfTest').onclick=()=>{reportBug('診断テスト','手動診断テスト（実際の不具合ではありません）');toast('テスト記録を追加しました')};renderBugs();document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));$('card').onclick=()=>{if(suppressCardClick){suppressCardClick=false;return}flipped=!flipped;drawCard();if(flipped)maybeSpeakJapanese();else maybeAutoSpeak()};installCardSwipe();$('prev').onclick=()=>{stopAuto();move(-1)};$('next').onclick=()=>{stopAuto();move(1)};$('shuffle').onclick=()=>{stopAuto();rebuild(true)};$('filter').onchange=()=>{stopAuto();rebuild()};$('know').onclick=()=>grade('known');$('miss').onclick=()=>grade('missed');$('speak').onclick=speakCurrent;
$('addMarkedPair').onclick=addMarkedPair;$('pasteClipboard').onclick=async()=>{try{if(!navigator.clipboard?.readText)throw Error('Safariでクリップボードの直接読み取りに対応していません');const text=await navigator.clipboard.readText();if(!text.trim())throw Error('コピーされた文字がありません');if(text.length>50000)throw Error('文字数が多すぎます。写真ごとにコピーしてください');$('paste').value=text;extractText(text);$('clipboardStatus').textContent=`${candidates.length}語を抽出しました。日本語訳を確認してください。`;if(candidates.length)$('candidates').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){$('clipboardStatus').textContent='直接取り込みできませんでした。下の「テキストを貼り付けて登録」を開き、長押しで貼り付けてください。';}};$('splitSpread').onclick=splitSpread;$('splitEntries').onclick=splitEntries;$('extractRegions').onclick=extractRegions;$('splitPosition').oninput=()=>{$('splitValue').textContent=$('splitPosition').value+'%'};$('photo').onchange=()=>{if([...$('entryRegions').querySelectorAll('textarea[data-region]')].some(el=>el.value.trim())&&!confirm('領域別に入力した未保存テキストが消えます。写真を変更しますか？')){$('photo').value='';return}discardPreviewOnly();let file=$('photo').files[0];if(!file)return;previewUrl=URL.createObjectURL(file);$('preview').src=previewUrl;$('preview').hidden=false;$('spreadTools').hidden=false;$('ocr').disabled=false;$('ocrStatus').textContent='写真を選択しました。候補と照合後に「写真を破棄」を押してください'};$('discard').onclick=()=>{if([...$('entryRegions').querySelectorAll('textarea[data-region]')].some(el=>el.value.trim())&&!confirm('領域別の未保存テキストも消えます。写真を破棄しますか？'))return;discardPhoto();$('ocrStatus').textContent='写真を破棄しました'};$('ocr').onclick=doOCR;$('ocrSelfTest').onclick=testJapaneseOCR;$('clipboardImport').onclick=importClipboardText;$('fromText').onclick=()=>extractText($('paste').value);if($('resetTimer'))$('resetTimer').onclick=()=>{if(!confirm('学習時間の今回・累計をリセットしますか？ 単語や正誤記録は残ります。'))return;timePause();sessionMs=0;timeState.totalMs=0;timeState.sessions=0;timeState.daily={};timeSave();timeRender();renderDaily();timeResume();toast('学習時間をリセットしました')};async function resetReviewCounts(ids){
 const targets=words.filter(w=>ids.has(w.id));
 if(!targets.length)return toast('対象の単語がありません');
 if(!confirm(`${targets.length}語の正解・不正解回数をすべて0に戻しますか？\nこの操作は元に戻せません。単語と学習時間は残ります。`))return;
 const previous=structuredClone(words);
 for(const w of targets){w.correctCount=0;w.wrongCount=0}
 try{await save()}catch(e){words=previous;rebuild();drawWords();return}
 rebuild();drawWords();toast(`${targets.length}語の正誤回数をリセットしました`);
}
$('resetAllCounts').onclick=()=>resetReviewCounts(new Set(words.map(w=>w.id)));
$('resetSelectedCounts').onclick=()=>resetReviewCounts(new Set(selectedIds));
$('selectVisible').onclick=()=>{for(const w of words.filter(w=>normalize(w.en).includes(normalize($('search').value))||w.ja.includes(normalize($('search').value))))selectedIds.add(w.id);drawWords()};$('clearSelection').onclick=()=>{selectedIds.clear();drawWords()};$('bulkDelete').onclick=async()=>{const ids=new Set([...selectedIds].filter(id=>words.some(w=>w.id===id)));if(!ids.size)return toast('削除する単語を選択してください');if(!confirm(`${ids.size}語を削除しますか？ この操作は元に戻せません。`))return;words=words.filter(w=>!ids.has(w.id));selectedIds.clear();await save();drawWords();rebuild();toast(`${ids.size}語を削除しました`)};$('showUnverified').onclick=showUnverifiedCandidates;$('showAllCandidates').onclick=showAllCandidates;$('allSelect').onclick=()=>{candidates.forEach(w=>w.selected=true);renderCandidates()};$('noneSelect').onclick=()=>{candidates.forEach(w=>w.selected=false);renderCandidates()};$('saveCandidates').onclick=async()=>{let unverified=candidates.filter(w=>w.selected&&!w.verified);if(unverified.length&&!confirm(`${unverified.length}件が原文と未照合です。確認せずに登録しますか？`))return;let selected=candidates.filter(w=>w.selected).map(w=>({en:normalize(w.en),ja:clean(w.ja),kind:w.kind||'headword',note:clean(w.note||'').slice(0,500)}));if(!selected.length)return toast('単語を選択してください');if(selected.some(w=>!w.en||!w.ja))return toast('日本語訳を入力してください');const invalid=selected.filter(w=>!/^[a-z][a-z' -]*$/.test(w.en));if(invalid.length)return toast('英語表記に問題があります。候補を修正してください');const previous=structuredClone(words);let n=mergeIncoming(selected.map(w=>({...w,id:uid(),status:'new'})));try{await save()}catch(e){words=previous;return}candidates=[];$('paste').value='';rebuild();tab('words');toast(n+'語を登録しました')};$('addManual').onclick=()=>editor();$('search').oninput=drawWords;
$('editorForm').addEventListener('submit',async e=>{if(e.submitter?.value!=='save')return;e.preventDefault();let en=normalize($('editEn').value),ja=clean($('editJa').value),ipa=$('editIpa').value.trim().slice(0,80),note=clean($('editNote').value).slice(0,500),kind=$('editKind').value;if(!en||!ja)return;if(editing){let w=words.find(w=>w.id===editing);if(w)Object.assign(w,{en,ja,ipa,note,kind})}else if(words.some(w=>normalize(w.en)===en))return toast('同じ単語が登録済みです');else words.push({id:uid(),en,ja,ipa,note,kind,status:'new',correctCount:0,wrongCount:0});$('editor').close();await save();rebuild();drawWords();toast('保存しました')});
$('exportEncrypted').onclick=exportEncrypted;$('importEncrypted').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{await importData(JSON.parse(await f.text()),'encrypted')}catch(err){toast('復元失敗: パスワードまたはファイルを確認してください')}finally{e.target.value=''}};$('importLegacy').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{await importData(JSON.parse(await f.text()),'legacy')}catch(err){toast('有効な旧バックアップではありません')}finally{e.target.value=''}};$('migrateAgain').onclick=async()=>{try{let r=await migrate();rebuild();toast(`旧版 ${r.found} 語を確認、${r.added} 語を追加`)}catch{toast('旧データの移行に失敗しました')}};$('deleteAll').onclick=async()=>{if(!confirm('新保存領域の全単語と学習履歴を削除します。暗号化バックアップを取りましたか？'))return;if(!confirm('本当に削除しますか？ 旧版の保存データは残ります。'))return;words=[];await save();rebuild();drawWords();toast('新保存領域を削除しました')}}
function discardPreviewOnly(){clearSpread();if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null}$('preview').removeAttribute('src');$('preview').hidden=true}
async function init(){applyTheme(localStorage.getItem('toeicflash-theme')||'light');initTimer();try{db=await openDB();words=(await dbRead()).map(sanitize).filter(Boolean);ensureWordOrder();let r=await migrate();ensureWordOrder();if(!words.length&&r.found===0){words=seed.map(([en,ja])=>({id:uid(),en,ja,status:'new'}));await save()}$('migration').textContent=r.found?`旧版データ ${r.found}語を確認し、${r.added}語を安全に統合しました。元データは削除していません。`:'端末内保存の準備ができました。';bind();classifyKnownBugs();tab('study');if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{})}catch(e){console.error(e);$('migration').textContent='保存領域を開けません。Safariのプライベートブラウズ設定・空き容量・サイトデータを確認し、元データを消さずに再度開いてください。';reportBug('初期化',e);toast('アプリを開始できませんでした')}}
init();
