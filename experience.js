/* View preferences stay on this device; they never rewrite stock state. */
(() => {
  const path=(location.pathname.split('/').pop()||'dashboard.html').replace('.html','');
  document.body.dataset.experience=path;
  try{document.documentElement.dataset.density=localStorage.getItem('stockpilot.density')||'comfortable';}catch{}
  const setup=()=>{
    const nav=document.querySelector('.app-nav');
    if(nav){
      nav.querySelectorAll('.nav-section-label').forEach(el=>el.remove());
      const entries=Array.from(nav.children).filter(el=>el.matches('a,button'));
      for(const [key,title] of [['dashboard','İş sahəsi'],['inventory','Məhsullar'],['profile','Hesab']]){
        const before=entries.find(el=>(el.getAttribute('href')||'').includes(key)||(key==='dashboard'&&el.id==='personalOrdersPanel'));
        if(before){const label=document.createElement('span');label.className='ux-nav-label';label.textContent=title;nav.insertBefore(label,before);}
      }
    }
    const host=document.querySelector('.topbar-actions,.top>div');
    if(host&&['dashboard','inventory'].includes(path)){
      const button=document.createElement('button');button.className='secondary ux-density';button.type='button';
      const paint=()=>{const compact=document.documentElement.dataset.density==='compact';button.textContent=compact?'Rahat görünüş':'Yığcam görünüş';button.setAttribute('aria-pressed',String(compact));};
      button.onclick=()=>{const value=document.documentElement.dataset.density==='compact'?'comfortable':'compact';document.documentElement.dataset.density=value;try{localStorage.setItem('stockpilot.density',value);}catch{}paint();};paint();host.prepend(button);
    }
    if(path==='profile'){
      const personal=document.querySelector('.profile-layout'),delivery=document.querySelector('.store-settings-section');
      if(personal&&delivery){personal.id='personal-settings';delivery.id='delivery-settings';const nav=document.createElement('nav');nav.className='settings-navigation';nav.setAttribute('aria-label','Ayar bölmələri');nav.innerHTML='<a class="secondary" href="#personal-settings">Şəxsi məlumatlar</a><a class="secondary" href="#delivery-settings">Çatdırılma ayarları</a>';personal.before(nav);}
    }
    document.addEventListener('keydown',event=>{
      if(event.key.toLowerCase()!=='n'||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,[contenteditable],dialog'))return;
      const add=document.getElementById('openProductEditor');if(add){event.preventDefault();add.click();}
    });
  };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',setup,{once:true}):setup();
})();
