/* Bridges the original 8-page mockup to the demo API without changing its visual design. */
(function(){
  let cached = null;
  let online = false;
  const json = (url,options) => fetch(url,options).then(async response=>{
    if(!response.ok) throw new Error('API HTTP '+response.status);
    return response.json();
  });
  async function refresh(){
    try{
      cached = await json('/api/dashboard');
      online = true;
    }catch(e){online=false;}
    decorate();
    return online;
  }
  function decorate(){
    const web = document.querySelector('.web-scroll');
    const mobile = document.querySelector('.mobile-body');
    const marker = online?'<span style="color:#168c87;font-weight:700">● API terhubung</span>':'<span style="color:#9a6a2c;font-weight:700">● API tidak aktif</span>';
    const line = online && cached ? `HR ${cached.vitals.hr_bpm} bpm · RMSSD ${cached.vitals.rmssd_ms} ms · ${cached.summary.unresolved} episode perlu klarifikasi` : 'Tampilan mockup tetap bisa digunakan; jalankan backend untuk menyimpan check-in dan percakapan.';
    const html = `<div data-vm-status="1" style="padding:11px 15px;margin:0 0 13px;border:1px solid #dcece7;border-radius:12px;background:#f0faf7;font-size:12px">${marker} &nbsp;·&nbsp; ${line}<div style="font-size:10px;color:#6d7d8a;margin-top:3px">SYNTHETIC DEMO · tidak menggunakan data pasien nyata</div></div>`;
    [web,mobile].forEach(container=>{
      if(!container) return;
      container.querySelector('[data-vm-status]')?.remove();
      container.insertAdjacentHTML('afterbegin',html);
    });
  }
  window.vmDecorate = decorate;
  window.vmRefresh = refresh;
  window.vmAskAI = async(message)=>{
    try{return (await json('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})})).answer;}
    catch(e){return 'Server API tidak dapat dihubungi. Penjelasan lokal: '+aiReply(message);}
  };
  window.vmSaveContext = async(context,note)=>{
    try{await json('/api/checkins',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_id:'evt-1425',context, note,symptoms:'Tidak tahu'})});await refresh();return true}
    catch(e){say('Gagal menyimpan ke API; perubahan hanya ditampilkan secara lokal.');return false;}
  };
  window.vmCompleteRecommendation = async()=>{
    try{await json('/api/recommendations/review-recovery/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'done'})});return true;}
    catch(e){say('Penandaan selesai hanya lokal: API tidak tersedia.');return false;}
  };
  // Every call to render() now restores the API status indicator.
  const originalRender = render;
  render = function(){originalRender();decorate()};
  render();
  refresh();
})();
