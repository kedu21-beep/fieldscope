// ═══════════════════════════════════════
//  SCAN + FETCH
// ═══════════════════════════════════════

const FETCH_TIMEOUT_MS  = 30000;
const SCAN_WATCHDOG_MS  = 120000;
let watchdogRef = null;

function fetchWithTimeout(url,timeoutMs){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  return fetch(url,{signal:ctrl.signal}).finally(()=>clearTimeout(timer));
}

async function ebirdFetch(radiusKm,backDays){
  const back=backDays||7;
  const t0=Date.now();
  const params='lat='+userLat+'&lng='+userLng+'&dist='+radiusKm+'&back='+back;
  log('info','Fetching eBird '+radiusKm+'km · '+back+' days...');
  let obsRes,notRes;
  try{
    [obsRes,notRes]=await Promise.all([
      fetchWithTimeout(WORKER_URL+'/obs?'+params,FETCH_TIMEOUT_MS),
      fetchWithTimeout(WORKER_URL+'/notable?'+params,FETCH_TIMEOUT_MS)
    ]);
  }catch(netErr){
    const isTimeout=netErr.name==='AbortError';
    const msg=isTimeout
      ?'Worker timeout after 30s — check Cloudflare dashboard'
      :'Network error: '+netErr.message+' (CORS or Worker offline?)';
    log('err',msg);
    throw new Error(isTimeout?'Request timed out (30s). Worker may be sleeping.':'Cannot reach Worker. Check connection or CORS.');
  }
  const elapsed=((Date.now()-t0)/1000).toFixed(1);
  const tiles=obsRes.headers.get('X-Tiles')||'1';
  const cacheObs=obsRes.headers.get('X-Cache')||'?';
  const cacheNot=notRes.headers.get('X-Cache')||'?';
  log('info','HTTP '+obsRes.status+'/'+notRes.status+' · '+elapsed+'s · '+obsRes.headers.get('X-eBird-Records')+' rec · '+tiles+' tiles · cache '+cacheObs+'/'+cacheNot);
  if(!obsRes.ok){
    let body='';
    try{body=await obsRes.text();}catch(_){}
    const isHtml=body.trim().startsWith('<');
    const detail=isHtml?'Worker returned HTML (crash/cold-start error)':body.slice(0,150);
    log('err','OBS HTTP '+obsRes.status+': '+detail);
    throw new Error('Worker error '+obsRes.status+(isHtml?' — may be a cold-start crash, try again':': '+detail));
  }
  const obs=await obsRes.json();
  const notable=notRes.ok?await notRes.json():[];
  if(!notRes.ok)log('warn','Notable HTTP '+notRes.status+' — no rare birds this scan');
  if(!Array.isArray(obs)){log('err','OBS not array: '+JSON.stringify(obs).slice(0,100));throw new Error('OBS response not an array');}
  log('ok','✓ '+obs.length+' obs + '+notable.length+' notable in '+elapsed+'s');
  return {obs,notable};
}

function resetScanState(){
  scanning=false;
  if(watchdogRef){clearTimeout(watchdogRef);watchdogRef=null;}
  const btn=document.getElementById('scanBtn');
  if(btn){btn.disabled=false;btn.classList.remove('scanning');}
  const icon=document.getElementById('scanIcon');
  if(icon){icon.className='ti ti-radar';icon.style.fontSize='22px';}
  const txt=document.getElementById('scanTxt');
  if(txt)txt.textContent='Scan Again';
}

function done(){
  stopTimer();
  resetScanState();
  const banner=document.getElementById('staleBanner');
  if(banner)banner.remove();
}

function cache(){
  try{localStorage.setItem('fs_cache',JSON.stringify({ts:Date.now(),spots,lat:userLat,lng:userLng}));}catch(_){}
}

async function scan(){
  if(scanning){
    log('warn','Scan already running — tap again to force-reset');
    resetScanState();
    stopTimer();
    return;
  }
  scanning=true;
  clearLog();logHasErr=false;
  radiusFilter=0;rawObs=[];rawNotable=[];rawBack=14;rawRadius=0;

  watchdogRef=setTimeout(()=>{
    log('err','Watchdog fired — scan hung for 2min, resetting');
    toast('Scan timed out — tap to try again',4000);
    resetScanState();
    stopTimer();
  },SCAN_WATCHDOG_MS);

  const btn=document.getElementById('scanBtn');
  const icon=document.getElementById('scanIcon');
  const txt=document.getElementById('scanTxt');
  btn.disabled=true;btn.classList.add('scanning');
  icon.className='ti ti-loader spinning';icon.style.fontSize='22px';txt.textContent='Scanning…';
  startTimer('all phases · parallel');
  showLoading();
  log('info','Scan — GPS: '+userLat.toFixed(4)+', '+userLng.toFixed(4));
  log('info','Firing all 3 phases simultaneously…');

  let bestRadius=0,settledCount=0;
  const totalPhases=3;

  function renderBest(expanding){if(spots.length)renderList(expanding);updateMap();}

  try{
    const t0=Date.now();

    const p1=ebirdFetch(30,30).then(({obs,notable})=>{
      const t=((Date.now()-t0)/1000).toFixed(1);
      log('ok','Phase 1 (30km): '+obs.length+' obs · '+notable.length+' notable in '+t+'s');
      setStep('s1','done','✓ 30km in '+t+'s');
      setBar(30);
      if(bestRadius<30){
        bestRadius=30;rawObs=obs;rawNotable=notable;rawBack=30;rawRadius=30;
        spots=processAndScore(obs,notable,30,30);
        settledCount++;renderBest(settledCount<totalPhases);
        toast('✓ '+spots.length+' nearby spots found',2000);
        cache();
      }
    }).catch(err=>{
      log('err','Phase 1 failed: '+err.message);
      setStep('s1','fail','✗ 30km failed');
      settledCount++;
      if(bestRadius===0&&settledCount===totalPhases){
        document.getElementById('listView').innerHTML=''
          +'<div class="state"><i class="ti ti-alert-triangle" style="font-size:42px;color:var(--amber)"></i>'
          +'<div class="state-title">Scan Failed</div>'
          +'<div class="state-sub" style="color:var(--red)">'+err.message+'</div>'
          +'<div style="display:flex;gap:8px;margin-top:12px">'
          +'<button class="retry-btn" style="padding:8px 14px;background:rgba(80,160,60,.13);border:1px solid var(--border2);border-radius:8px;color:var(--lime);font-size:12px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif">↩ Retry</button>'
          +'<button onclick="toggleLog()" style="padding:8px 14px;background:rgba(80,160,60,.07);border:1px solid var(--border);border-radius:8px;color:var(--muted);font-size:12px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif">🪵 Log</button>'
          +'</div></div>';
      }
    });

    const p2=ebirdFetch(100,14).then(({obs,notable})=>{
      const t=((Date.now()-t0)/1000).toFixed(1);
      log('ok','Phase 2 (100km): '+obs.length+' obs · '+notable.length+' notable in '+t+'s');
      setStep('s2','done','✓ 100km in '+t+'s');
      setBar(60);
      if(bestRadius<100){
        bestRadius=100;rawObs=obs;rawNotable=notable;rawBack=14;rawRadius=100;
        spots=processAndScore(obs,notable,100,14);
        settledCount++;renderBest(settledCount<totalPhases);
        toast('✓ '+spots.length+' spots within 100km',2000);
        cache();
      }else{settledCount++;}
    }).catch(err=>{
      log('warn','Phase 2 failed: '+err.message);
      setStep('s2','fail','✗ 100km failed');
      settledCount++;
    });

    const p3=ebirdFetch(200,14).then(({obs,notable})=>{
      const t=((Date.now()-t0)/1000).toFixed(1);
      log('ok','Phase 3 (200km): '+obs.length+' obs · '+notable.length+' notable in '+t+'s');
      setStep('s3','done','✓ 200km in '+t+'s');
      setBar(100);
      if(bestRadius<200){
        bestRadius=200;rawObs=obs;rawNotable=notable;rawBack=14;rawRadius=200;
        spots=processAndScore(obs,notable,200,14);
        settledCount++;renderBest(false);
        toast('✓ Full scan — '+spots.length+' spots within 200km');
        cache();
      }else{settledCount++;renderBest(false);}
    }).catch(err=>{
      log('err','Phase 3 failed: '+err.message);
      setStep('s3','fail','✗ 200km failed — showing best available');
      toast('200km failed — showing best available',3000);
      settledCount++;renderBest(false);
    });

    setStep('s1','act','Fetching 30km · 30 days…');
    setStep('s2','act','Fetching 100km · 14 days…');
    setStep('s3','act','Fetching 200km · 14 days…');

    await Promise.allSettled([p1,p2,p3]);
    if(spots.length)renderList(false);

  }finally{
    done();
  }
}
