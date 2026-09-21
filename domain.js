/* Shared deterministic accounting and calendar rules (browser + Worker). */
(() => {
  const defaults = {
    america: {name:'Amerika',currency:'$',rate:1.7,tariffs:[3.49,5.49,7.49,9.77]},
    turkey: {name:'Türkiyə',currency:'$',rate:1.7,tariffs:[1.49,2.49,3.49,4.29]},
    spain: {name:'İspaniya',currency:'€',rate:1.96,tariffs:[1.75,3.7,5.6,7.9]}
  };
  const acquired = i => Math.max(0,Number(i.acquiredQty ?? i.qty)||0);
  const sold = i => Math.min(acquired(i),Math.max(0,Number.isFinite(Number(i.soldQty))?Number(i.soldQty):i.sold?acquired(i):0));
  const remaining = i => Math.min(Math.max(0,acquired(i)-sold(i)),Math.max(0,Number(i.qty)||0));
  const country = (s,k) => ({...(defaults[k]||defaults.america),...(s.countries?.[k]||{})});
  const shipping = (weight,c) => { const g=Math.max(0,Number(weight)||0),a=c.tariffs; return !g?0:g<=100?+a[0]:g<=250?+a[1]:g<=500?+a[2]:Math.ceil(g/1000)*+a[3]; };
  const unitCost = (i,s) => {const c=country(s,i.country||'america'),q=acquired(i);return ((Number(i.price)||0)+(q?shipping(i.weight,c)/q:0))*Number(c.rate);};
  const round = n => Math.round((n+Number.EPSILON)*100)/100;
  const bakuDate = (ms=Date.now()) => new Date(ms+4*3600000).toISOString().slice(0,10);
  function scheduleMs(value) {
    if(!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(value))) return NaN;
    const full=value.length===16?value+':00':value;
    const ms=Date.parse(full+'+04:00');
    return Number.isFinite(ms)&&new Date(ms+4*3600000).toISOString().slice(0,19)===full?ms:NaN;
  }
  function scheduleError(value,now=Date.now()) {const ms=scheduleMs(value);return !Number.isFinite(ms)?'Tarix və saat düzgün deyil.':ms<=now?'Keçmiş tarix və saat seçilə bilməz.':ms>now+366*86400000?'Tarix həddən artıq uzaqdır.':null;}
  function normalize(state) {
    const ids=new Set();
    for(const o of state.orders||[]) for(const [n,i] of (o.items||[]).entries()) {
      if(!i.id)i.id=`${o.id}:${n}`;
      if(ids.has(String(i.id))){let candidate=`${o.id}:${n}:legacy`;while(ids.has(candidate))candidate+='-copy';i.id=candidate;}
      ids.add(String(i.id));
    }
    return state;
  }
  globalThis.StockDomain={defaults,acquired,sold,remaining,country,shipping,unitCost,round,bakuDate,scheduleMs,scheduleError,normalize};
})();
