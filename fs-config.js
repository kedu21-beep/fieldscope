// ═══════════════════════════════════════
//  CONFIG + GLOBAL STATE + UTILS
// ═══════════════════════════════════════
const MAX_KM     = 200;
const WORKER_URL = 'https://polished-waterfall-c720.kevinducharme21.workers.dev';
const KPH        = 70;

let userLat  = 46.0156;
let userLng  = -73.4509;
let gpsReady = false;
let spots    = [];
let scanning = false;
let leafMap  = null;
let mapPins  = [];
let driveFilter  = 0;
let radiusFilter = 0;
let rawObs = [], rawNotable = [], rawBack = 14, rawRadius = 0;
let pulseData = null;    // cached migration pulse computation
let pulseLoading = false; // prevent concurrent pulse fetches
let cachedLat = null, cachedLng = null;
let currentActivity = 'birding';

// ── UTILS ──
function km(la1,lo1,la2,lo2){
  const R=6371,dL=(la2-la1)*Math.PI/180,dG=(lo2-lo1)*Math.PI/180;
  const a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dG/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function driveMin(d){return Math.round(d/KPH*60);}
function driveTxt(d){const m=driveMin(d);return m<60?'~'+m+' min':'~'+Math.floor(m/60)+'h'+(m%60?m%60+'m':'');}
function toast(msg,dur){const e=document.getElementById('toast');e.textContent=msg;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),dur||2500);}

// ── LOGGING ──
let logOpen=false, logHasErr=false;
function log(type,msg){
  const ts=new Date().toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const lines=document.getElementById('logLines');
  if(lines){
    const row=document.createElement('div');
    row.className='ll';
    row.innerHTML='<span class="ll-ts">'+ts+'</span><span class="ll-'+type+'">'+msg+'</span>';
    lines.appendChild(row);
    lines.scrollTop=lines.scrollHeight;
  }
  if(type==='err'){logHasErr=true;setLdot('err');document.getElementById('logPanel').classList.add('on');logOpen=true;}
  else if(type==='warn'&&!logHasErr)setLdot('warn');
  console[type==='err'?'error':type==='warn'?'warn':'log']('['+type+'] '+msg);
}
function setLdot(s){const d=document.getElementById('ldot');if(d)d.className='ldot '+s;}
function toggleLog(){logOpen=!logOpen;document.getElementById('logPanel').classList.toggle('on',logOpen);}
function clearLog(){const el=document.getElementById('logLines');if(el)el.innerHTML='';logHasErr=false;setLdot('');}

// ── TIMER ──
let timerRef=null, timerT0=0;
function startTimer(phase){
  timerT0=Date.now();
  document.getElementById('timerBar').classList.add('on');
  document.getElementById('tPhase').textContent=phase;
  clearInterval(timerRef);
  timerRef=setInterval(()=>{
    const s=(Date.now()-timerT0)/1000;
    const min=Math.floor(s/60),sec=Math.floor(s%60);
    document.getElementById('tClock').textContent=min+':'+(sec<10?'0':'')+sec;
  },200);
}
function setPhase(p){document.getElementById('tPhase').textContent=p;}
function stopTimer(){
  clearInterval(timerRef);timerRef=null;
  const s=((Date.now()-timerT0)/1000).toFixed(1);
  setPhase('done · '+s+'s');
  log('ok','⏱ Total: '+s+'s');
}

// ── GPS ──
function initGPS(){
  if(!navigator.geolocation){setGPS(false,'No GPS');return;}
  setGPS(null,'Locating…');
  navigator.geolocation.getCurrentPosition(
    p=>{
      userLat=p.coords.latitude;userLng=p.coords.longitude;gpsReady=true;
      setGPS(true,userLat.toFixed(3)+', '+userLng.toFixed(3));
      log('ok','GPS: '+userLat.toFixed(5)+', '+userLng.toFixed(5));
      if(leafMap)leafMap.setView([userLat,userLng]);
      if(cachedLat!==null){
        const d=km(userLat,userLng,cachedLat,cachedLng);
        if(d>15&&!scanning){
          log('warn','Location changed '+Math.round(d)+'km from cached — auto-rescanning');
          showStaleLocationBanner();
          setTimeout(()=>scan(),800);
        }
      }
    },
    e=>{setGPS(false,'GPS off · using Joliette');log('warn','GPS error: '+e.message);},
    {enableHighAccuracy:true,timeout:8000}
  );
}
function setGPS(ok,txt){
  document.getElementById('gdot').className='gdot'+(ok===true?' ok':ok===false?' err':'');
  document.getElementById('gTxt').textContent=txt;
}

// ── ACTIVITY ──
const FORMULA_HTML={
  birding:'<div class="fi"><div class="fd" style="background:var(--blue)"></div>Proximity 40</div>'
    +'<div class="fi"><div class="fd" style="background:var(--accent)"></div>Species 35</div>'
    +'<div class="fi"><div class="fd" style="background:var(--red)"></div>Rarity 25</div>'
    +'<div class="fi"><div class="fd" style="background:var(--amber)"></div>Recent +5</div>',
  fishing:'<div class="fi"><div class="fd" style="background:var(--blue)"></div>Proximity 40</div>'
    +'<div class="fi"><div class="fd" style="background:var(--blue)"></div>Water 30</div>'
    +'<div class="fi"><div class="fd" style="background:var(--accent)"></div>Access 20</div>'
    +'<div class="fi"><div class="fd" style="background:var(--amber)"></div>Fish +10</div>',
  hiking:'<div class="fi"><div class="fd" style="background:var(--blue)"></div>Proximity 40</div>'
    +'<div class="fi"><div class="fd" style="background:var(--accent)"></div>Length 30</div>'
    +'<div class="fi"><div class="fd" style="background:var(--amber)"></div>Quality 20</div>'
    +'<div class="fi"><div class="fd" style="background:var(--red)"></div>Park +10</div>',
  camping:'<div class="fi"><div class="fd" style="background:var(--blue)"></div>Proximity 40</div>'
    +'<div class="fi"><div class="fd" style="background:var(--accent)"></div>Facilities 30</div>'
    +'<div class="fi"><div class="fd" style="background:var(--amber)"></div>Public land 20</div>'
    +'<div class="fi"><div class="fd" style="background:var(--red)"></div>Size 10</div>',
  wildlife:'<div class="fi"><div class="fd" style="background:var(--blue)"></div>Proximity 40</div>'
    +'<div class="fi"><div class="fd" style="background:var(--accent)"></div>Habitat 35</div>'
    +'<div class="fi"><div class="fd" style="background:var(--amber)"></div>Protected 25</div>',
  kayaking:'<div class="fi"><div class="fd" style="background:var(--blue)"></div>Proximity 40</div>'
    +'<div class="fi"><div class="fd" style="background:var(--accent)"></div>Water 35</div>'
    +'<div class="fi"><div class="fd" style="background:var(--amber)"></div>Access 25</div>',
};
const SCAN_ICON={birding:'ti-radar',fishing:'ti-ripple',hiking:'ti-walk',camping:'ti-tent',wildlife:'ti-binoculars',kayaking:'ti-kayak'};
const SCAN_LABEL={birding:'Find Best Birding Spots',fishing:'Find Fishing Spots',hiking:'Find Hiking Trails',camping:'Find Camping Spots',wildlife:'Find Wildlife Spots',kayaking:'Find Paddling Spots'};

function setActivity(act){
  currentActivity=act;
  document.querySelectorAll('.act-btn').forEach(b=>b.classList.toggle('on',b.id==='act-'+act));
  // Update formula bar
  const fb=document.getElementById('formulaBar');
  if(fb)fb.innerHTML=FORMULA_HTML[act]||FORMULA_HTML.birding;
  // Update scan button label + icon (only when not scanning)
  if(!scanning){
    const icon=document.getElementById('scanIcon');
    if(icon)icon.className='ti '+(SCAN_ICON[act]||'ti-radar');
    const txt=document.getElementById('scanTxt');
    if(txt)txt.textContent=SCAN_LABEL[act]||'Find Spots Near Me';
  }
  toast('Switched to '+act.charAt(0).toUpperCase()+act.slice(1)+' mode',1500);
  spots=[];
  renderList(false);
}

// ── PLAN TRIP — enhanced for global fieldtrips ──
async function planTrip(){
  const input=prompt('Plan a fieldtrip anywhere in the world!\n\nCity, park, or country\nOr paste lat,lng (e.g. 51.1789,-1.8262)','');
  if(!input)return;

  var lat,lng,displayName=input.trim();

  // Direct lat,lng input — no network call needed
  var parts=input.split(',').map(function(p){return parseFloat(p.trim());});
  if(parts.length===2&&!isNaN(parts[0])&&!isNaN(parts[1])&&Math.abs(parts[0])<=90&&Math.abs(parts[1])<=180){
    lat=parts[0];lng=parts[1];displayName='Custom coordinates';
  }

  if(!lat){
    log('info','Searching for: '+displayName);
    toast('Searching '+displayName+'…',1500);
    try{
      var res=await fetch('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(displayName)+'&format=json&limit=5&addressdetails=1',{
        headers:{'User-Agent':'FieldScope/1.0'}
      });
      var results=await res.json();
      if(!results.length){toast('No results found — try a different name',2000);return;}
      var choice=results[0];
      lat=parseFloat(choice.lat);
      lng=parseFloat(choice.lon);
      displayName=choice.display_name.split(',')[0];
    }catch(e){
      toast('Location service unavailable',2000);
      log('err','Nominatim: '+e.message);
      return;
    }
  }

  userLat=lat;userLng=lng;cachedLat=lat;cachedLng=lng;
  log('ok','Trip set → '+lat.toFixed(4)+', '+lng.toFixed(4)+' ('+displayName+')');

  // Save to recent trips (up to 5)
  try{
    var recent=JSON.parse(localStorage.getItem('fs_recentTrips')||'[]');
    recent=recent.filter(function(t){return t.name!==displayName;});
    recent.unshift({name:displayName,lat:lat,lng:lng,ts:Date.now()});
    localStorage.setItem('fs_recentTrips',JSON.stringify(recent.slice(0,5)));
  }catch(_){}

  document.getElementById('gTxt').textContent='Trip: '+displayName;
  showStaleLocationBanner();
  setTimeout(function(){scan();},600);
}

// ── RECENT TRIPS — shown from Plan Trip button hold/dblclick ──
function showRecentTrips(){
  try{
    var recent=JSON.parse(localStorage.getItem('fs_recentTrips')||'[]');
    if(!recent.length){toast('No recent trips yet',2000);return;}
    var msg='Recent trips:\n\n';
    recent.forEach(function(t,i){msg+=(i+1)+'. '+t.name+'\n';});
    var choice=prompt(msg+'\nEnter number to reload:');
    if(!choice)return;
    var idx=parseInt(choice)-1;
    if(recent[idx]){
      userLat=recent[idx].lat;userLng=recent[idx].lng;
      cachedLat=userLat;cachedLng=userLng;
      document.getElementById('gTxt').textContent='Trip: '+recent[idx].name;
      showStaleLocationBanner();
      setTimeout(function(){scan();},400);
    }
  }catch(_){}
}

// ── STALE LOCATION BANNER ──
function showStaleLocationBanner(){
  const existing=document.getElementById('staleBanner');
  if(existing)return;
  const banner=document.createElement('div');
  banner.id='staleBanner';
  banner.style.cssText='display:flex;align-items:center;gap:8px;padding:9px 16px;'
    +'background:rgba(244,185,66,.1);border-bottom:1px solid rgba(244,185,66,.3);'
    +'font-size:12px;font-weight:600;color:var(--amber);cursor:pointer;flex-shrink:0;';
  banner.innerHTML='<i class="ti ti-map-pin-off"></i> Results from last location · rescanning…'
    +'<span style="margin-left:auto;font-size:10px;color:rgba(244,185,66,.6)">tap to dismiss</span>';
  banner.onclick=()=>banner.remove();
  const listEl=document.getElementById('listView');
  listEl.parentNode.insertBefore(banner,listEl);
}
// ── OFFLINE DETECTION ──
function initOffline(){
  // Insert banner into the flex column just above listView
  var banner=document.createElement('div');
  banner.id='offlineBanner';
  banner.style.cssText='display:none;align-items:center;gap:8px;padding:8px 16px;'
    +'background:rgba(244,185,66,.1);border-bottom:1px solid rgba(244,185,66,.3);'
    +'font-size:11px;font-weight:700;color:var(--amber);flex-shrink:0;';
  banner.innerHTML='<i class="ti ti-wifi-off"></i> Offline — showing last cached results';
  var listEl=document.getElementById('listView');
  // Insert before listView (both are flex children of body)
  listEl.parentNode.insertBefore(banner,listEl);

  function updateOffline(){
    banner.style.display=navigator.onLine?'none':'flex';
  }
  window.addEventListener('online',updateOffline);
  window.addEventListener('offline',updateOffline);
  updateOffline();
}
