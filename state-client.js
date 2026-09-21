/* Serialized, versioned saves. Failed snapshots remain recoverable in this tab. */
(() => {
  let version=null,owner='',chain=Promise.resolve(),pending=0,failed=null,conflict=false,dirty=false;
  const key=()=>`stockpilot-draft:${owner}`;
  function status(text,error=false) {
    let box=document.getElementById('saveStatus');
    if(!box){box=document.createElement('div');box.id='saveStatus';box.setAttribute('role','status');box.style.cssText='position:fixed;bottom:76px;right:16px;max-width:90vw;padding:10px 16px;background:#fff;color:#17212b;box-shadow:0 3px 18px #0003;border-radius:10px;z-index:10000';document.body.append(box);}
    box.replaceChildren(document.createTextNode(text));
    if(error&&failed){
      const download=document.createElement('button');download.textContent='Dəyişiklikləri endir';download.onclick=()=>{const url=URL.createObjectURL(new Blob([failed.raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='stockpilot-unsaved.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};box.append(' ',download);
      const reload=document.createElement('button');reload.textContent='Serverdən yenilə';reload.onclick=()=>{if(confirm('Saxlanmamış yerli dəyişikliklər silinəcək. Əvvəl endirmisiniz?')){sessionStorage.removeItem(key());failed=null;dirty=false;conflict=false;location.reload();}};box.append(' ',reload);
      if(!conflict){const retry=document.createElement('button');retry.textContent='Yenidən cəhd et';retry.onclick=async()=>{if(await save(JSON.parse(failed.raw)))location.reload();};box.append(' ',retry);}
    }
  }
  function init(v,id){version=v;owner=id;const draft=sessionStorage.getItem(key());if(draft){try{failed=JSON.parse(draft);conflict=true;dirty=true;status('Əvvəlki saxlanmamış dəyişikliklər var. Endirib müqayisə edin.',true);}catch{sessionStorage.removeItem(key());}}}
  function loaded(v){if(!pending&&!dirty&&!failed)version=v;}
  function markDirty(state){dirty=true;if(state){failed={raw:JSON.stringify(state),version};try{sessionStorage.setItem(key(),JSON.stringify(failed));}catch{}}status('Saxlanır…');}
  function save(state) {
    const raw=JSON.stringify(state);markDirty(state);pending++;
    const work=chain.then(async()=>{
      if(conflict){pending--;status('Başqa səhifədə dəyişiklik var. Yerli nüsxəni endirib səhifəni yeniləyin.',true);return false;}
      try {
        if(!version)throw new Error('Məlumat tam yüklənməyib.');
        const response=await fetch('/api/state',{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({state:JSON.parse(raw),version})});
        const body=await response.json().catch(()=>({}));
        if(!response.ok){conflict=response.status===409;throw new Error(body.error||'Saxlama alınmadı.');}
        version=body.version;
        if(failed?.raw===raw){failed=null;dirty=false;sessionStorage.removeItem(key());status('Saxlandı');}
        return true;
      } catch(error){status(error.message||'Saxlanmadı. Yenidən cəhd edin.',true);return false;}
      finally{pending--;}
    });
    chain=work.catch(()=>false);return work;
  }
  addEventListener('beforeunload',event=>{if(dirty||pending||failed){event.preventDefault();event.returnValue='';}});
  window.StockState={init,loaded,save,markDirty,status,isDirty:()=>dirty||pending>0||!!failed,flush:()=>chain};
})();
