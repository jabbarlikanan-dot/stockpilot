const token=localStorage.stockpilotToken;
if(!token) location.replace('index.html');
const api=(path,options={})=>fetch(path,{...options,headers:{Authorization:`Bearer ${token}`,'content-type':'application/json',...(options.headers||{})}});
const esc=(s)=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const money=(n)=>`${(Number(n)||0).toLocaleString('az-AZ',{minimumFractionDigits:2,maximumFractionDigits:2})} ₼`;
let payload={watches:[],countries:{}};
let query='',filter='all';
function when(value){if(!value)return 'Yoxlanmayıb';try{return new Intl.DateTimeFormat('az-AZ',{dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(value))}catch{return value}}
function savings(w){return w.currentTotalAzn>0&&w.bestTotalAzn>0?Math.max(0,w.currentTotalAzn-w.bestTotalAzn):0}
function savingPct(w){return w.currentTotalAzn>0&&w.bestTotalAzn>0?((w.currentTotalAzn-w.bestTotalAzn)/w.currentTotalAzn)*100:0}
function setStatus(text,type=''){const el=document.getElementById('status');el.textContent=text||'';el.dataset.type=type}
async function load(){
  setStatus('Məhsullar və qiymət monitoru yüklənir…');
  const [me,res]=await Promise.all([api('/api/me'),api('/api/ai-purchases')]);
  if(!me.ok){localStorage.removeItem('stockpilotToken');location.replace('index.html');return}
  const user=(await me.json()).user;
  document.getElementById('profileInitial').textContent=(user.firstName||'U')[0].toUpperCase();
  document.getElementById('profileName').textContent=`${user.firstName||''} ${user.lastName||''}`.trim();
  const store=`store.html?shop=${encodeURIComponent(user.username)}`;
  document.getElementById('storeLink').href=store;document.getElementById('mobileStoreLink').href=store;
  if(!res.ok){setStatus('AI alış məlumatı yüklənmədi.','error');return}
  payload=await res.json();render();setStatus('');
}
function render(){
  const watches=payload.watches||[];
  const active=watches.filter(w=>w.enabled);
  const deals=active.filter(w=>savingPct(w)>=w.thresholdPct&&w.bestTotalAzn>0);
  document.getElementById('watchCount').textContent=active.length;
  document.getElementById('dealCount').textContent=deals.length;
  document.getElementById('savingTotal').textContent=money(deals.reduce((s,w)=>s+savings(w),0));
  let list=watches.filter(w=>w.productName.toLocaleLowerCase('az').includes(query));
  if(filter==='deals')list=list.filter(w=>savingPct(w)>=w.thresholdPct&&w.bestTotalAzn>0);
  if(filter==='unscanned')list=list.filter(w=>!w.lastScanAt);
  const host=document.getElementById('watchList');
  host.innerHTML=list.length?list.map(card).join(''):'<div class="ai-empty">Bu filtrə uyğun məhsul yoxdur.</div>';
  host.querySelectorAll('[data-scan]').forEach(b=>b.onclick=()=>scanOne(b.dataset.scan,b));
  host.querySelectorAll('[data-enabled]').forEach(x=>x.onchange=()=>updateWatch(x.dataset.enabled,{enabled:x.checked,thresholdPct:Number(document.querySelector(`[data-threshold="${CSS.escape(x.dataset.enabled)}"]`)?.value)||8}));
  host.querySelectorAll('[data-threshold]').forEach(x=>x.onchange=()=>updateWatch(x.dataset.threshold,{enabled:document.querySelector(`[data-enabled="${CSS.escape(x.dataset.threshold)}"]`)?.checked!==false,thresholdPct:Number(x.value)||8}));
}
function card(w){
  const pct=savingPct(w),save=savings(w),deal=w.bestTotalAzn>0&&pct>=w.thresholdPct;
  const offers=(w.offers||[]).map(o=>`<div class="ai-offer"><div><b>${esc(o.title)}</b><small>${esc(o.source)} · Məhsul ${money(o.productPriceAzn)} · Karqo ${money(o.shippingAzn)}</small></div><div class="ai-offer-price"><b>${money(o.totalAzn)}</b><a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">Mənbəyə bax ↗</a></div></div>`).join('');
  return `<article class="ai-watch" id="product-${esc(w.productId)}"><div class="ai-watch-head"><div><h2 class="ai-product-title">${esc(w.productName)}</h2><div class="ai-meta"><span>${esc(payload.countries?.[w.countryKey]?.name||w.countryKey)}</span><span>${Number(w.weightGrams)||0} qr</span><span>Son yoxlama: ${esc(when(w.lastScanAt))}</span></div></div><div class="ai-actions"><label class="ai-toggle"><input type="checkbox" data-enabled="${esc(w.productId)}" ${w.enabled?'checked':''}> Daim izlə</label><input class="ai-threshold" data-threshold="${esc(w.productId)}" type="number" min="0" max="90" step="1" value="${w.thresholdPct}" title="Bildiriş həddi %"><button class="scan" data-scan="${esc(w.productId)}">İndi yoxla</button></div></div><div class="ai-best"><div class="ai-metric"><span>Cari maya</span><b>${money(w.currentTotalAzn)}</b></div><div class="ai-metric ${deal?'good':''}"><span>Ən yaxşı tapılan</span><b>${w.bestTotalAzn?money(w.bestTotalAzn):'—'}</b></div><div class="ai-metric"><span>Karqo daxil</span><b>${w.bestShippingAzn?money(w.bestShippingAzn):'—'}</b></div><div class="ai-metric ${deal?'good':''}"><span>Qənaət</span><b>${w.bestTotalAzn?`${money(save)} · ${pct.toFixed(1)}%`:'—'}</b></div></div>${offers?`<details class="ai-offers" ${deal?'open':''}><summary>${w.offers.length} təklif tapıldı</summary>${offers}</details>`:`<div class="ai-offers"><small>Hələ uyğun qiymət tapılmayıb.</small></div>`}</article>`
}
async function scanOne(id,button){
  const old=button.textContent;button.disabled=true;button.textContent='Axtarılır…';setStatus('Web-də qiymətlər yoxlanır. Bəzi mağazalar avtomatik oxunu bloklaya bilər.');
  try{const res=await api(`/api/ai-purchases/${encodeURIComponent(id)}/scan`,{method:'POST',body:'{}'});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Yoxlama alınmadı');await refresh();setStatus(data.best?`Ən yaxşı variant: ${money(data.best.totalAzn)} (karqo daxil).`:'Uyğun açıq qiymət tapılmadı.');}catch(e){setStatus(e.message||'Yoxlama alınmadı','error')}finally{button.disabled=false;button.textContent=old}
}
async function refresh(){const res=await api('/api/ai-purchases');if(res.ok){payload=await res.json();render()}}
async function updateWatch(id,body){const res=await api(`/api/ai-purchases/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)});if(res.ok){setStatus(body.enabled?`İzləmə aktivdir. ${body.thresholdPct}% və daha çox qənaətdə bildiriş gələcək.`:'Bu məhsul üçün daimi izləmə dayandırıldı.');await refresh()}else setStatus('Ayar yadda saxlanmadı.','error')}
document.getElementById('scanAll').onclick=async()=>{const b=document.getElementById('scanAll');b.disabled=true;b.textContent='Yoxlanır…';setStatus('Aktiv məhsullar növbə ilə yoxlanır…');try{const r=await api('/api/ai-purchases/scan-all',{method:'POST',body:'{}'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Yoxlama alınmadı');await refresh();setStatus(`${d.scanned||0} məhsul yoxlanıldı.`)}catch(e){setStatus(e.message||'Yoxlama alınmadı','error')}finally{b.disabled=false;b.textContent='Hamısını yoxla'}};
document.getElementById('search').oninput=e=>{query=String(e.target.value||'').trim().toLocaleLowerCase('az');render()};
document.getElementById('dealFilter').onchange=e=>{filter=e.target.value;render()};
document.getElementById('logout').onclick=()=>{localStorage.removeItem('stockpilotToken');location.href='index.html'};
document.getElementById('profileButton').onclick=()=>location.href='profile.html';
load();
