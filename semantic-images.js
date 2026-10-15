'use strict';
// Original on-device semantic illustrations. No requests, images or external APIs.
// Illustrations are simple SVG shapes and device-rendered emoji, not AI images.
(function(){
 const groups=[
 {keys:'apple apples fruit',symbol:'🍎',label:'リンゴ・果物'},
 {keys:'negotiate negotiation agreement contract discuss discussion meeting conference',symbol:'🤝',label:'交渉・話し合い'},
 {keys:'car vehicle automobile drive driving transport',symbol:'🚗',label:'自動車'},
 {keys:'invoice receipt bill payment expense cost price budget refund reimbursement',symbol:'🧾',label:'請求・費用'},
 {keys:'money revenue profit salary income finance financial',symbol:'💰',label:'お金・収益'},
 {keys:'airplane aircraft flight airport travel trip',symbol:'✈️',label:'飛行機・旅行'},
 {keys:'ship shipment shipping delivery deliver package parcel',symbol:'📦',label:'配送・荷物'},
 {keys:'office company business headquarters department branch',symbol:'🏢',label:'会社・オフィス'},
 {keys:'employee employer manager representative applicant candidate interview',symbol:'👥',label:'人物・仕事'},
 {keys:'phone telephone call contact notify notification',symbol:'📞',label:'連絡'},
 {keys:'email mail message letter correspondence',symbol:'✉️',label:'メール・手紙'},
 {keys:'schedule appointment reservation deadline postpone delay calendar annual',symbol:'📅',label:'予定・期限'},
 {keys:'clock time hour minute punctual duration',symbol:'🕒',label:'時間'},
 {keys:'house home residence accommodation accommodate building',symbol:'🏠',label:'家・建物'},
 {keys:'computer laptop software digital online technology equipment',symbol:'💻',label:'コンピューター'},
 {keys:'book read reading textbook vocabulary dictionary document documents',symbol:'📚',label:'本・文書'},
 {keys:'coffee cafe drink beverage',symbol:'☕',label:'コーヒー・飲み物'},
 {keys:'restaurant meal lunch dinner food',symbol:'🍽️',label:'食事'},
 {keys:'factory manufacture manufacturer production inventory warehouse',symbol:'🏭',label:'製造・在庫'},
 {keys:'tool repair maintenance replace implement installation',symbol:'🔧',label:'工具・保守'},
 {keys:'increase growth improve improvement rise',symbol:'📈',label:'増加・改善'},
 {keys:'decrease reduce decline fall',symbol:'📉',label:'減少'},
 {keys:'purchase buy shopping shop store customer',symbol:'🛒',label:'購入・買い物'},
 {keys:'education school study learn learning training qualification',symbol:'🎓',label:'学習・教育'},
 {keys:'medical hospital doctor health medicine',symbol:'🏥',label:'医療'},
 {keys:'weather rain rainy umbrella',symbol:'☂️',label:'雨・天気'},
 {keys:'sun sunny bright daylight',symbol:'☀️',label:'太陽・光'},
 {keys:'tree plant forest environment',symbol:'🌳',label:'自然'},
 {keys:'flower flowers garden',symbol:'🌼',label:'花'},
 {keys:'cat kitten animal pet',symbol:'🐈',label:'猫・動物'},
 {keys:'dog puppy',symbol:'🐕',label:'犬'},
 {keys:'music song sound audio',symbol:'🎵',label:'音楽'},
 {keys:'security secure safety protect password',symbol:'🔒',label:'安全'},
 {keys:'success achieve achievement goal target',symbol:'🎯',label:'目標・達成'},
 {keys:'available availability accessible',symbol:'🔓',label:'利用可能'},
 {keys:'affordable cheap discount sale',symbol:'🏷️',label:'価格・割引'}
 ];
 const exact=new Map();for(const g of groups)for(const word of g.keys.split(' '))exact.set(word,g);
 const jaRules=[[/交渉|協議|合意/,groups[1]],[/請求|領収|経費|精算/,groups[3]],[/車|運転/,groups[2]],[/収益|売上|利益/,groups[4]],[/会議|打合せ/,groups[1]],[/予定|締切|予約/,groups[11]],[/出荷|配送|配達/,groups[6]],[/購入|買い物/,groups[22]],[/在庫|製造/,groups[18]],[/教育|学習/,groups[23]]];
 const NS='http://www.w3.org/2000/svg';
 const node=(tag,attrs={},text)=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e};
 function illustration(word,meaning){
  const en=String(word||'').trim().toLowerCase(),ja=String(meaning||'');
  let group=exact.get(en);
  if(!group){for(const [pattern,g] of jaRules){if(pattern.test(ja)){group=g;break}}}
  const root=node('svg',{viewBox:'0 0 240 140',role:'img','aria-label':group?'単語の意味を表すイメージ: '+group.label:'単語のイメージは未対応'});
  root.append(node('rect',{x:0,y:0,width:240,height:140,rx:18,fill:group?'#eaf4ff':'#f2f3f5'}));
  root.append(node('circle',{cx:196,cy:28,r:22,fill:group?'#d2e8ff':'#e4e5e7'}));
  if(group){
   // Deterministic per-word, local-only procedural background: unique visual variations
   // within each meaning category. Does not use generative AI or third-party images.
   let seed=2166136261;for(const ch of (en+'|'+ja)){seed^=ch.codePointAt(0);seed=Math.imul(seed,16777619)>>>0}
   const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296};
   const palette=['#b7ddff','#ffe3b0','#b9f0df','#efcfff','#ffd2d2'];
   for(let i=0;i<10;i++){
    const r=3+Math.floor(rand()*13),cx=12+rand()*216,cy=10+rand()*110;
    root.append(node(i%3===0?'rect':'circle',i%3===0?{x:cx,y:cy,width:r*2,height:r*2,rx:r/3,fill:palette[Math.floor(rand()*palette.length)],opacity:0.65}:{cx,cy,r,fill:palette[Math.floor(rand()*palette.length)],opacity:0.7}));
   }
   root.append(node('text',{x:120,y:87,'text-anchor':'middle','font-size':65,'font-family':'Apple Color Emoji, sans-serif'},group.symbol));
   root.append(node('text',{x:120,y:123,'text-anchor':'middle','font-size':13,fill:'#274564'},group.label));
  }else{
   root.append(node('text',{x:120,y:71,'text-anchor':'middle','font-size':22,fill:'#667085'},'?'));
   root.append(node('text',{x:120,y:107,'text-anchor':'middle','font-size':12,fill:'#667085'},'意味に合う画像は未登録'));
  }
  return root;
 }
 window.TOEICSemanticIllustration=illustration;
})();
