const api=(path,options={})=>fetch(path,{...options,credentials:'same-origin',headers:{'content-type':'application/json',...(options.headers||{})}});
const esc=(s)=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const money=(n)=>`${(Number(n)||0).toLocaleString('az-AZ',{minimumFractionDigits:2,maximumFractionDigits:2})} ₼`;
let payload={watches:[],countries:{}};
let query='',filter='all';
let scanning=false;
function when(value){if(!value)return 'Yoxlanmayıb';try{return new Intl.DateTimeFormat('az-AZ',{dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(typeof value==='string'&&/^\d{4}-\d{2}-\d{2} \d{2}:/.test(value)?value.replace(' ','T')+'Z':value))}catch{return value}}
function savings(w){return w.currentTotalAzn>0&&w.bestTotalAzn>0?Math.max(0,w.currentTotalAzn-w.bestTotalAzn):0}
function savingPct(w){return w.currentTotalAzn>0&&w.bestTotalAzn>0?((w.currentTotalAzn-w.bestTotalAzn)/w.currentTotalAzn)*100:0}
function setStatus(text,type=''){const el=document.getElementById('status');el.textContent=text||'';el.dataset.type=type}
async function load(){
  setStatus('Məhsullar və qiymət monitoru yüklənir…');
  const [me,res]=await Promise.all([api('/api/me'),api('/api/ai-purchases')]);
  if(me.status===401){localStorage.removeItem('stockpilotToken');location.replace('index.html');return}
  if(!me.ok)throw new Error('Profil yüklənmədi.');
  const user=(await me.json()).user;
  document.getElementById('profileInitial').textContent=(user.firstName||'U')[0].toUpperCase();
  document.getElementById('profileName').textContent=`${user.firstName||''} ${user.lastName||''}`.trim();
  const store=`store.html?shop=${encodeURIComponent(user.username)}`;
  for(const id of ['storeLink','mobileStoreLink']){const link=document.getElementById(id);if(link)link.href=store;}
  if(!res.ok){const err=await res.json().catch(()=>({}));setStatus(`${err.error||'AI alış məlumatı yüklənmədi.'} Səhifəni yenidən yoxlamaq üçün “Hamısını yoxla” düyməsini istifadə edə bilərsiniz.`,'error');document.getElementById('watchList').innerHTML='<div class="ai-empty"><b>Monitor məlumatı açıla bilmədi</b><br><small>Worker yeniləndikdən sonra səhifəni yeniləyin.</small></div>';return}
  payload=await res.json();render();setStatus('');autoScanIfNeeded();
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
  if(filter==='error')list=list.filter(w=>w.scanStatus==='error');
  list.sort((a,b)=>savings(b)-savings(a));
  const host=document.getElementById('watchList');
  host.innerHTML=list.length?list.map(card).join(''):'<div class="ai-empty">Bu filtrə uyğun məhsul yoxdur.</div>';
  host.querySelectorAll('[data-scan]').forEach(b=>b.onclick=()=>scanOne(b.dataset.scan,b));
  host.querySelectorAll('[data-enabled]').forEach(x=>x.onchange=()=>updateWatch(x.dataset.enabled,{enabled:x.checked,thresholdPct:Number(document.querySelector(`[data-threshold="${CSS.escape(x.dataset.enabled)}"]`)?.value ?? 8)}));
  host.querySelectorAll('[data-threshold]').forEach(x=>x.onchange=()=>updateWatch(x.dataset.threshold,{enabled:document.querySelector(`[data-enabled="${CSS.escape(x.dataset.threshold)}"]`)?.checked!==false,thresholdPct:Number.isFinite(Number(x.value))?Number(x.value):8}));
}
function card(w){
  const pct=savingPct(w),save=savings(w),deal=w.bestTotalAzn>0&&pct>=w.thresholdPct;
  const offers=(w.offers||[]).map(o=>`<div class="ai-offer"><div><b>${esc(o.title)}</b><small>${esc(o.source)} · Səhifədən oxunmuş qiymət · Məhsul ${money(o.productPriceAzn)} · Karqo ${money(o.shippingAzn)}</small></div><div class="ai-offer-price"><b>${money(o.totalAzn)}</b><a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">Mənbəyə bax ↗</a></div></div>`).join('');
  return `<article class="ai-watch" id="product-${esc(w.productId)}"><div class="ai-watch-head"><div><h2 class="ai-product-title">${esc(w.productName)}</h2><div class="ai-meta"><span>${esc(payload.countries?.[w.countryKey]?.name||w.countryKey)}</span><span>${Number(w.weightGrams)||0} qr</span><span>Son yoxlama: ${esc(when(w.lastScanAt))}</span></div></div><details class="ai-watch-settings"><summary>İzləmə ayarları</summary><div class="ai-actions"><label class="ai-toggle"><input type="checkbox" data-enabled="${esc(w.productId)}" ${w.enabled?'checked':''}> Daim izlə</label><input class="ai-threshold" data-threshold="${esc(w.productId)}" type="number" min="0" max="90" step="1" value="${w.thresholdPct}" title="Bildiriş həddi %"><button class="scan" data-scan="${esc(w.productId)}">İndi yoxla</button></div></details></div><div class="ai-best"><div class="ai-metric"><span>Sənin vahid mayan</span><b>${money(w.currentTotalAzn)}</b></div><div class="ai-metric ${deal?'good':''}"><span>Tapılan təxmini maya</span><b>${w.bestTotalAzn?money(w.bestTotalAzn):'—'}</b></div><div class="ai-metric"><span>Təxmini karqo</span><b>${w.bestTotalAzn?money(w.bestShippingAzn):'—'}</b></div><div class="ai-metric ${deal?'good':''}"><span>Potensial fərq</span><b>${w.bestTotalAzn?`${money(save)} · ${pct.toFixed(1)}%`:'—'}</b></div></div>${offers?`<details class="ai-offers" ${deal?'open':''}><summary>${w.offers.length} təklif tapıldı</summary>${offers}</details>`:`<div class="ai-offers"><small>${w.scanStatus==='error'?esc(w.scanError||'Mənbə yoxlanmadı. Yenidən cəhd edin.'):w.lastScanAt?'Məhsul, ölçü, stok və valyutası uyğun açıq qiymət tapılmadı.':'Hələ yoxlanmayıb.'}</small></div>`}</article>`
}
async function scanOne(id,button){
  if(scanning)return;scanning=true;
  const old=button.textContent;button.disabled=true;button.textContent='Axtarılır…';setStatus('Rəsmi və etibarlı mağaza səhifələrində təsdiqlənmiş qiymətlər yoxlanır…');
  try{const res=await api(`/api/ai-purchases/${encodeURIComponent(id)}/scan`,{method:'POST',body:'{}'});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Yoxlama alınmadı');await refresh();setStatus(data.status==='error'?(data.error||'Yoxlama alınmadı.'):data.best?`Ən yaxşı variant: ${money(data.best.totalAzn)} (karqo daxil).`:'Uyğun açıq qiymət tapılmadı.');}catch(e){setStatus(e.message||'Yoxlama alınmadı','error')}finally{scanning=false;button.disabled=false;button.textContent=old}
}
async function refresh(){const res=await api('/api/ai-purchases');if(!res.ok)throw new Error('Nəticələr yenilənmədi.');payload=await res.json();render()}
async function updateWatch(id,body){try{const res=await api(`/api/ai-purchases/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)});if(res.ok){setStatus(body.enabled?`İzləmə aktivdir. ${body.thresholdPct}% və daha çox qənaətdə bildiriş gələcək.`:'Bu məhsul üçün daimi izləmə dayandırıldı.');await refresh()}else setStatus('Ayar yadda saxlanmadı.','error')}catch{setStatus('Ayar yadda saxlanmadı. İnterneti yoxlayın.','error')}}
async function scanAll(){
  if(scanning)return;scanning=true;
  const button=document.getElementById('scanAll');button.disabled=true;
  let offset=0,scanned=0,failed=0;
  try {
    do {
      const response=await api('/api/ai-purchases/scan-all',{method:'POST',body:JSON.stringify({offset})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Yoxlama alınmadı.');
      scanned+=data.scanned||0;failed+=data.failed||0;offset=data.nextOffset;
      setStatus(`${data.total} məhsuldan ${scanned+failed} yoxlanıldı; ${failed} xəta.`);
      await refresh();
    } while(offset!==null&&offset!==undefined);
    setStatus(`${scanned} məhsul yoxlanıldı, ${failed} yoxlama alınmadı. Maya təxminidir; satıcının çatdırılma və əlavə xərcləri daxil deyil.`,failed?'error':'');
  }catch(error){setStatus(error.message,'error');}
  finally{scanning=false;button.disabled=false;button.textContent='Hamısını yoxla';}
}
async function autoScanIfNeeded(){
  const stale=(payload.watches||[]).filter(w=>w.enabled&&(!w.lastScanAt||Date.now()-new Date(w.lastScanAt).getTime()>6*3600000));
  if(!stale.length)return;
  const key='stockpilotAiAutoScanAt';if(Date.now()-Number(sessionStorage.getItem(key)||0)<600000)return;
  sessionStorage.setItem(key,String(Date.now()));await scanAll();
}
document.getElementById('scanAll').onclick=scanAll;
document.getElementById('search').oninput=e=>{query=String(e.target.value||'').trim().toLocaleLowerCase('az');render()};
document.getElementById('dealFilter').onchange=e=>{filter=e.target.value;render()};
document.getElementById('logout').onclick=async()=>{localStorage.removeItem('stockpilotToken');try{await fetch('/api/logout',{method:'POST',credentials:'same-origin'})}catch{}location.href='index.html'};
document.getElementById('profileButton').onclick=()=>location.href='profile.html';
load().catch(error=>setStatus(error.message||'Məlumat yüklənmədi.','error'));
