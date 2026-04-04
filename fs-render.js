// ═══════════════════════════════════════
//  RENDER + UI
// ═══════════════════════════════════════

// ── Loading screen — adapts label per activity ──
function showLoading(activity){
  const act=activity||currentActivity||'birding';
  const isBird=act==='birding';
  document.getElementById('listView').innerHTML=''
    +'<div class="state"><div class="prog-box">'
    +'<div class="prog-lbl">'+(isBird?'Scanning eBird · All ranges parallel':'Scanning '+act+' spots…')+'</div>'
    +'<div class="prog-track"><div class="prog-fill" id="progFill" style="width:5%"></div></div>'
    +'<div>'
    +'<div class="pstep"><i class="ti ti-radar ps-i"></i><span class="ps-t act" id="s1">30km</span></div>'
    +'<div class="pstep"><i class="ti ti-map ps-i"></i><span class="ps-t act" id="s2">100km</span></div>'
    +'<div class="pstep"><i class="ti ti-world ps-i"></i><span class="ps-t act" id="s3">200km</span></div>'
    +'</div></div>'
    +'<div style="font-size:10px;color:var(--faint);margin-top:6px">'+(isBird?'All 3 ranges fetching simultaneously':'Fetching from OpenStreetMap')+'</div></div>';
}

function setBar(p){const e=document.getElementById('progFill');if(e)e.style.width=p+'%';}

function setStep(id,state,txt){
  const e=document.getElementById(id);if(!e)return;
  e.className='ps-t '+state;if(txt)e.textContent=txt;e.style.opacity='1';
  if(state==='done'){const nx=document.getElementById({s1:'s2',s2:'s3'}[id]);if(nx)nx.style.opacity='1';}
}

function setDriveFilter(mins){
  driveFilter=mins;
  document.querySelectorAll('.df-btn').forEach(b=>b.classList.toggle('on',parseInt(b.dataset.df)===mins));
  renderList(false);
}

function setRadiusFilter(km){
  if(!rawObs.length){toast('Scan first to use radius filter',2000);return;}
  radiusFilter=km;
  document.querySelectorAll('.rf-btn').forEach(b=>b.classList.toggle('on',parseInt(b.dataset.rf)===km));
  const lim=km||rawRadius||200;
  const bk=km===30?30:rawBack;
  spots=processAndScore(rawObs,rawNotable,lim,bk);
  renderList(false);
  updateMap();
  log('info','Radius filter: '+lim+'km → '+spots.length+' spots');
}

function showTab(tab){
  const isList=tab==='list',isMap=tab==='map',isSavedTab=tab==='saved',isPulse=tab==='pulse';
  document.getElementById('listView').style.display=isList?'block':'none';
  document.getElementById('mapView').classList.toggle('on',isMap);
  document.getElementById('savedView').style.display=isSavedTab?'block':'none';
  document.getElementById('pulseView').style.display=isPulse?'block':'none';
  document.getElementById('tabList').classList.toggle('on',isList);
  document.getElementById('tabMap').classList.toggle('on',isMap);
  document.getElementById('tabSaved').classList.toggle('on',isSavedTab);
  document.getElementById('tabPulse').classList.toggle('on',isPulse);
  if(isMap){initMap();setTimeout(function(){leafMap&&leafMap.invalidateSize();},55);}
  if(isSavedTab)renderSaved();
  if(isPulse)loadMigrationPulse();
}

// ── MASTER renderList — routes to the right renderer ──
function renderList(expanding){
  if(currentActivity==='fishing')  return renderFishingList(expanding);
  if(currentActivity==='hiking')   return renderHikingList(expanding);
  if(currentActivity==='camping')  return renderCampingList(expanding);
  if(currentActivity==='wildlife') return renderWildlifeList(expanding);
  if(currentActivity==='kayaking') return renderKayakingList(expanding);
  return renderBirdingList(expanding);
}

// ════════════════════════════════════════════
//  CAMPING LIST
// ════════════════════════════════════════════
function renderCampingList(expanding){
  const filtered=driveFilter>0?spots.filter(s=>s.driveMin<=driveFilter):spots;

  if(!filtered.length){
    document.getElementById('listView').innerHTML='<div class="state">'
      +'<i class="ti ti-tent" style="font-size:42px;color:var(--accent)"></i>'
      +'<div class="state-title">No camping spots found</div>'
      +'<div class="state-sub">Try scanning or adjusting your drive filter.</div></div>';
    return;
  }

  const expandBanner=expanding?'<div class="expanding"><i class="ti ti-loader spinning"></i> Expanding search…</div>':'';

  const filterBar='<div class="df-bar">'
    +'<button class="df-btn'+(driveFilter===0?' on':'')+'" data-df="0">All drives</button>'
    +'<button class="df-btn'+(driveFilter===30?' on':'')+'" data-df="30">≤ 30 min</button>'
    +'<button class="df-btn'+(driveFilter===60?' on':'')+'" data-df="60">≤ 1 hour</button>'
    +'<button class="df-btn'+(driveFilter===120?' on':'')+'" data-df="120">≤ 2 hours</button>'
    +'</div>';

  const cards=filtered.map((s,i)=>{
    const isTop=i===0;
    const visited=isVisited(s.id);
    const facilitiesTag=s.facilities&&s.facilities!=='Basic'
      ?'<div class="mtag" style="color:var(--accent);border-color:rgba(92,184,92,.25);background:rgba(92,184,92,.07)">'+s.facilities+'</div>'
      :'<div class="mtag">Basic</div>';

    return '<div class="spot'+(visited?' visited-spot':'')+'" style="animation-delay:'+Math.min(i*28,380)+'ms">'
      +'<div class="spot-top"><div>'
      +'<div class="spot-rank'+(isTop?' gold':'')+'">'+(isTop?'★ #1':'#'+(i+1))+'</div>'
      +'<div class="spot-name">'+s.name+'</div></div>'
      +'<div class="score-block"><div class="n">'+s.score+'</div><div class="l">Score</div></div></div>'
      +'<div class="meta">'
      +'<div class="mtag hi"><i class="ti ti-location"></i> '+s.dist+'km</div>'
      +'<div class="mtag hi"><i class="ti ti-car"></i> '+driveTxt(s.dist)+'</div>'
      +(s.sites>0?'<div class="mtag"><i class="ti ti-tent"></i> '+s.sites+' sites</div>':'')
      +facilitiesTag
      +'</div>'
      +'<div class="bars">'
      +'<div class="bar"><span class="bar-l">Prox</span><div class="bar-t"><div class="bar-f p" style="width:'+(s.sP/40*100)+'%"></div></div><span class="bar-v">'+s.sP+'/40</span></div>'
      +'<div class="bar"><span class="bar-l">Facilities</span><div class="bar-t"><div class="bar-f q" style="width:'+(s.sF/30*100)+'%"></div></div><span class="bar-v">'+s.sF+'/30</span></div>'
      +'<div class="bar"><span class="bar-l">Land</span><div class="bar-t"><div class="bar-f" style="width:'+(s.sL/20*100)+'%;background:var(--amber)"></div></div><span class="bar-v">'+s.sL+'/20</span></div>'
      +'</div>'
      +'<div class="actions">'
      +'<button class="act go" onclick="navTo('+s.lat+','+s.lng+')"><i class="ti ti-navigation"></i> Directions</button>'
      +'<button class="act map" onclick="flyTo('+s.lat+','+s.lng+')"><i class="ti ti-map"></i> Map</button>'
      +'<button class="visit-btn'+(visited?' visited':'')+'" data-id="'+s.id+'"><i class="'+(visited?'ti ti-circle-check-filled':'ti ti-circle-check')+'" style="font-size:18px"></i></button>'
      +'<button class="save-btn'+(isSaved(s.id)?' saved':'')+'" data-id="'+s.id+'"><i class="ti ti-star'+(isSaved(s.id)?'-filled':'')+'" style="font-size:18px"></i></button>'
      +'</div></div>';
  }).join('');

  document.getElementById('listView').innerHTML=expandBanner+filterBar
    +'<div style="display:flex;justify-content:space-between;padding:2px 0 7px">'
    +'<div style="font-size:9.5px;font-weight:700;color:var(--faint);letter-spacing:.8px;text-transform:uppercase">'+filtered.length+' camping spots</div>'
    +'<div style="font-size:9.5px;color:var(--faint)">OpenStreetMap</div></div>'+cards;
}

// ════════════════════════════════════════════
//  BIRDING LIST (unchanged)
// ════════════════════════════════════════════
function renderBirdingList(expanding){
  let filtered=spots;
  if(driveFilter>0)filtered=spots.filter(s=>driveMin(s.dist)<=driveFilter);
  if(hideVisited)filtered=filtered.filter(s=>!isVisited(s.id));

  const topRare=spots.find(s=>s.rareCnt>0);
  const rareBanner=topRare
    ?'<div class="rare-banner" onclick="flyTo('+topRare.lat+','+topRare.lng+')">'
      +'<i class="ti ti-zap"></i> '+topRare.rare[0]+' spotted '+topRare.dist+'km away · '+driveTxt(topRare.dist)
      +' <span style="margin-left:auto;color:var(--red)">→</span></div>'
    :'';

  if(!filtered.length){
    const msg=driveFilter>0?'No spots within a '+driveTxt(driveFilter)+' drive. Try a longer filter.':'No observations in the last 7 days for this area.';
    document.getElementById('listView').innerHTML=rareBanner
      +'<div class="state"><i class="ti ti-binoculars" style="font-size:42px;color:var(--accent)"></i>'
      +'<div class="state-title">No spots found</div><div class="state-sub">'+msg+'</div></div>';
    return;
  }

  const hero=filtered[0];
  const heroRecTag=hero.sRec>0
    ?'<div class="mtag" style="color:var(--amber);border-color:rgba(244,185,66,.25);background:rgba(244,185,66,.07)">'
      +'<i class="ti ti-clock"></i> '+(hero.recent24>0?hero.recent24+' list'+(hero.recent24>1?'s':'')+' today':hero.recent48+' list'+(hero.recent48>1?'s':'')+' yest.')+'</div>'
    :'';
  const heroEbirdUrl='https://ebird.org/hotspot/'+hero.id;
  const heroHtml='<div class="hero-card" onclick="flyTo('+hero.lat+','+hero.lng+')">'
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start">'
    +'<div><div style="font-size:9px;font-weight:700;color:var(--amber);letter-spacing:1px;margin-bottom:3px">'
    +'<i class="ti ti-star"></i> BEST SPOT TODAY</div>'
    +'<div style="font-family:Fraunces,serif;font-size:18px;font-weight:700;color:#e8ffe8;line-height:1.2">'+hero.name+'</div></div>'
    +'<div class="score-block'+(hero.rareCnt>0?' rare':'')+'"><div class="n">'+hero.score+'</div><div class="l">Score</div></div>'
    +'</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">'
    +'<div class="mtag hi"><i class="ti ti-location"></i> '+hero.dist+'km</div>'
    +'<div class="mtag hi"><i class="ti ti-car"></i> '+driveTxt(hero.dist)+'</div>'
    +'<div class="mtag"><i class="ti ti-feather"></i> '+hero.spCnt+' species</div>'
    +(hero.rareCnt>0?'<div class="mtag rare-t"><i class="ti ti-zap"></i> '+hero.rareCnt+' rare</div>':'')+heroRecTag
    +'</div>'
    +'<div class="actions">'
    +'<button class="act go" onclick="event.stopPropagation();navTo('+hero.lat+','+hero.lng+')">'
    +'<i class="ti ti-navigation"></i> Go Now</button>'
    +'<button class="act map" onclick="event.stopPropagation();flyTo('+hero.lat+','+hero.lng+')">'
    +'<i class="ti ti-map"></i> Map</button>'
    +'<button class="save-btn'+(isSaved(hero.id)?' saved':'')+'" data-id="'+hero.id+'">'
    +'<i class="ti ti-star'+(isSaved(hero.id)?'-filled':'')+'" style="font-size:18px"></i></button>'
    +'<button class="act" onclick="event.stopPropagation();window.open(\''+heroEbirdUrl+'\',\'_blank\')" '
    +'style="background:rgba(74,158,255,.07);border:1px solid rgba(74,158,255,.18);color:var(--muted);flex:0;padding:8px 10px">'
    +'<i class="ti ti-brand-databricks"></i></button>'
    +'</div></div>';

  const expandBanner=expanding?'<div class="expanding"><i class="ti ti-loader spinning"></i> Expanding scan…</div>':'';

  const radiusBar='<div class="df-bar">'
    +'<button class="rf-btn'+(radiusFilter===0?' on':'')+'" data-rf="0">All</button>'
    +'<button class="rf-btn'+(radiusFilter===30?' on':'')+'" data-rf="30">30 km</button>'
    +'<button class="rf-btn'+(radiusFilter===100?' on':'')+'" data-rf="100">100 km</button>'
    +'<button class="rf-btn'+(radiusFilter===200?' on':'')+'" data-rf="200">200 km</button>'
    +'</div>';

  const visitedCount=Object.keys(visitedSpots).length;
  const filterBar='<div class="df-bar">'
    +'<button class="df-btn'+(driveFilter===0?' on':'')+'" data-df="0">All drives</button>'
    +'<button class="df-btn'+(driveFilter===30?' on':'')+'" data-df="30">≤ 30 min</button>'
    +'<button class="df-btn'+(driveFilter===60?' on':'')+'" data-df="60">≤ 1 hour</button>'
    +'<button class="df-btn'+(driveFilter===120?' on':'')+'" data-df="120">≤ 2 hours</button>'
    +(visitedCount>0?'<button class="df-btn hv-btn'+(hideVisited?' on':'')+'">'+(hideVisited?'Show visited ('+visitedCount+')':'Hide visited ('+visitedCount+')')+'</button>':'')
    +'</div>';

  const cards=filtered.map((s,i)=>{
    const isR=s.rareCnt>0,isTop=i===0;
    const rarePills=s.rare.slice(0,3).map(n=>'<span class="pill r"><i class="ti ti-zap"></i> '+n+'</span>').join('')+(s.rare.length>3?'<span class="pill more">+'+(s.rare.length-3)+'</span>':'');
    const spPills=s.topSp.slice(0,4).map(n=>'<span class="pill">'+n+'</span>').join('')+(s.spCnt>4?'<span class="pill more">+'+(s.spCnt-4)+'</span>':'');
    const recTag=s.sRec>0?'<div class="mtag" style="color:var(--amber);border-color:rgba(244,185,66,.25);background:rgba(244,185,66,.07)"><i class="ti ti-clock"></i> '+(s.recent24>0?s.recent24+' list'+(s.recent24>1?'s':'')+' today':s.recent48+' list'+(s.recent48>1?'s':'')+' yest.')+'</div>':'';
    const momTag=s.momentumLabel?'<div class="mtag" style="color:'+(s.sMom>0?'var(--accent)':'var(--blue)')+';border-color:'+(s.sMom>0?'rgba(92,184,92,.25)':'rgba(74,158,255,.25)')+';background:'+(s.sMom>0?'rgba(92,184,92,.07)':'rgba(74,158,255,.07)')+'">'+s.momentumLabel+'</div>':'';
    const ebirdUrl='https://ebird.org/hotspot/'+s.id;
    const visited=isVisited(s.id);
    return '<div class="spot'+(isR?' rare':'')+(visited?' visited-spot':'')+'" style="animation-delay:'+Math.min(i*28,380)+'ms">'
      +'<div class="spot-top"><div><div class="spot-rank'+(isTop?' gold':'')+'">'+(isTop?'★ #1':'#'+(i+1))+'</div><div class="spot-name">'+s.name+'</div></div>'
      +'<div class="score-block'+(isR?' rare':'')+'"><div class="n">'+s.score+'</div><div class="l">Score</div></div></div>'
      +'<div class="meta"><div class="mtag hi"><i class="ti ti-location"></i> '+s.dist+'km</div><div class="mtag hi"><i class="ti ti-car"></i> '+driveTxt(s.dist)+'</div>'
      +'<div class="mtag'+(s.spCnt>20?' hi':'')+'"><i class="ti ti-feather"></i> '+s.spCnt+' sp.</div>'
      +(isR?'<div class="mtag rare-t"><i class="ti ti-zap"></i> '+s.rareCnt+' rare</div>':'')+recTag+momTag+'</div>'
      +'<div class="bars">'
      +'<div class="bar"><span class="bar-l">Prox</span><div class="bar-t"><div class="bar-f p" style="width:'+(s.sP/40*100)+'%"></div></div><span class="bar-v">'+s.sP+'/40</span></div>'
      +'<div class="bar"><span class="bar-l">Species</span><div class="bar-t"><div class="bar-f q" style="width:'+(s.sQ/35*100)+'%"></div></div><span class="bar-v">'+s.sQ+'/35</span></div>'
      +'<div class="bar"><span class="bar-l">Rarity</span><div class="bar-t"><div class="bar-f r" style="width:'+(s.sR/25*100)+'%"></div></div><span class="bar-v">'+s.sR+'/25</span></div>'
      +(s.sRec>0?'<div class="bar"><span class="bar-l">Recent</span><div class="bar-t"><div class="bar-f" style="width:100%;background:var(--amber)"></div></div><span class="bar-v">+'+s.sRec+'</span></div>':'')
      +(s.sMom!==0?'<div class="bar"><span class="bar-l">Trend</span><div class="bar-t"><div class="bar-f" style="width:'+Math.abs(s.sMom)/5*100+'%;background:'+(s.sMom>0?'var(--accent)':'var(--blue)')+'"></div></div><span class="bar-v">'+(s.sMom>0?'+':'')+s.sMom+'</span></div>':'')
      +'</div>'
      +(isR&&rarePills?'<div class="pills">'+rarePills+'</div>':'')
      +(spPills?'<div class="pills">'+spPills+'</div>':'')
      +'<div class="actions">'
      +'<button class="act go" onclick="navTo('+s.lat+','+s.lng+')"><i class="ti ti-navigation"></i> Directions</button>'
      +'<button class="act map" onclick="flyTo('+s.lat+','+s.lng+')"><i class="ti ti-map"></i> Map</button>'
      +'<button class="visit-btn'+(visited?' visited':'')+'" data-id="'+s.id+'"><i class="'+(visited?'ti ti-circle-check-filled':'ti ti-circle-check')+'" style="font-size:18px"></i></button>'
      +'<button class="save-btn'+(isSaved(s.id)?' saved':'')+'" data-id="'+s.id+'"><i class="ti ti-star'+(isSaved(s.id)?'-filled':'')+'" style="font-size:18px"></i></button>'
      +'<button class="act" onclick="window.open(\''+ebirdUrl+'\',\'_blank\')" style="background:rgba(74,158,255,.07);border:1px solid rgba(74,158,255,.18);color:var(--muted);flex:0;padding:8px 10px"><i class="ti ti-brand-databricks"></i></button>'
      +'</div></div>';
  }).join('');

  document.getElementById('listView').innerHTML=rareBanner+expandBanner+heroHtml+radiusBar+filterBar
    +'<div style="display:flex;justify-content:space-between;padding:2px 0 7px">'
    +'<div style="font-size:9.5px;font-weight:700;color:var(--faint);letter-spacing:.8px;text-transform:uppercase">'+filtered.length+' locations ranked</div>'
    +'<div style="font-size:9.5px;color:var(--faint)">last 7 days</div></div>'+cards;
}

// ════════════════════════════════════════════
//  FISHING LIST
// ════════════════════════════════════════════
function renderFishingList(expanding){
  const filtered=driveFilter>0?spots.filter(s=>s.driveMin<=driveFilter):spots;

  if(!filtered.length){
    document.getElementById('listView').innerHTML='<div class="state">'
      +'<i class="ti ti-ripple" style="font-size:42px;color:var(--blue)"></i>'
      +'<div class="state-title">No fishing spots found</div>'
      +'<div class="state-sub">Try scanning or adjusting your drive filter.</div></div>';
    return;
  }

  const expandBanner=expanding?'<div class="expanding"><i class="ti ti-loader spinning"></i> Expanding search…</div>':'';

  const filterBar='<div class="df-bar">'
    +'<button class="df-btn'+(driveFilter===0?' on':'')+'" data-df="0">All drives</button>'
    +'<button class="df-btn'+(driveFilter===30?' on':'')+'" data-df="30">≤ 30 min</button>'
    +'<button class="df-btn'+(driveFilter===60?' on':'')+'" data-df="60">≤ 1 hour</button>'
    +'<button class="df-btn'+(driveFilter===120?' on':'')+'" data-df="120">≤ 2 hours</button>'
    +'</div>';

  const cards=filtered.map((s,i)=>{
    const isTop=i===0;
    const visited=isVisited(s.id);

    // Water type label
    const waterLabel={river:'River',stream:'Stream',lake:'Lake',reservoir:'Reservoir',
      pond:'Pond',basin:'Basin',oxbow:'Oxbow',canal:'Canal',water:'Water'}[s.waterType]||'Water';

    // Fish species pills — primary (up to 3), rare with star, no secondary clutter
    const fishPrimary=(s.fishSpecies||[]).slice(0,3)
      .map(function(f){return '<span class="pill" style="color:var(--blue);border-color:rgba(74,158,255,.25);background:rgba(74,158,255,.07)"><i class="ti ti-fish"></i> '+f+'</span>';})
      .join('');
    const fishRare=(s.fishRare||[]).slice(0,2)
      .map(function(f){return '<span class="pill r"><i class="ti ti-star"></i> '+f+'</span>';})
      .join('');
    const fishSourceTag=s.fishSource==='osm'
      ?'<span class="pill" style="color:var(--accent);border-color:rgba(92,184,92,.2);font-size:9px">OSM verified</span>'
      :'<span class="pill more" style="font-size:9px">inferred</span>';
    const fishWarningTag=s.accessWarning
      ?'<span class="pill r" style="font-size:9px"><i class="ti ti-lock"></i> Private access</span>'
      :'';

    // Access tag
    const accessTag=s.fishing==='yes'
      ?'<div class="mtag" style="color:var(--accent);border-color:rgba(92,184,92,.25);background:rgba(92,184,92,.07)"><i class="ti ti-check"></i> Fishing spot</div>'
      :'';

    return '<div class="spot'+(visited?' visited-spot':'')+'" style="animation-delay:'+Math.min(i*28,380)+'ms">'
      +'<div class="spot-top"><div>'
      +'<div class="spot-rank'+(isTop?' gold':'')+'">'+(isTop?'★ #1':'#'+(i+1))+'</div>'
      +'<div class="spot-name">'+s.name+'</div></div>'
      +'<div class="score-block"><div class="n">'+s.score+'</div><div class="l">Score</div></div></div>'
      +'<div class="meta">'
      +'<div class="mtag hi"><i class="ti ti-location"></i> '+s.dist+'km</div>'
      +'<div class="mtag hi"><i class="ti ti-car"></i> '+driveTxt(s.dist)+'</div>'
      +'<div class="mtag"><i class="ti ti-droplet"></i> '+waterLabel+'</div>'
      +accessTag
      +'</div>'
      +'<div class="bars">'
      +'<div class="bar"><span class="bar-l">Prox</span><div class="bar-t"><div class="bar-f p" style="width:'+(s.sP/40*100)+'%"></div></div><span class="bar-v">'+s.sP+'/40</span></div>'
      +'<div class="bar"><span class="bar-l">Water</span><div class="bar-t"><div class="bar-f" style="width:'+(s.sW/30*100)+'%;background:var(--blue)"></div></div><span class="bar-v">'+s.sW+'/30</span></div>'
      +'<div class="bar"><span class="bar-l">Access</span><div class="bar-t"><div class="bar-f q" style="width:'+(s.sA/20*100)+'%"></div></div><span class="bar-v">'+s.sA+'/20</span></div>'
      +(s.fishBonus>0?'<div class="bar"><span class="bar-l">Fish</span><div class="bar-t"><div class="bar-f" style="width:'+(s.fishBonus/10*100)+'%;background:var(--amber)"></div></div><span class="bar-v">+'+s.fishBonus+'</span></div>':'')
      +'</div>'
      // Fish species section
      +'<div style="margin-bottom:8px">'
      +'<div style="font-size:8.5px;font-weight:700;color:var(--faint);letter-spacing:.6px;text-transform:uppercase;margin-bottom:4px">Expected species</div>'
      +'<div class="pills">'+fishPrimary+fishRare+fishWarningTag+fishSourceTag+'</div>'
      +'</div>'
      +'<div class="actions">'
      +'<button class="act go" onclick="navTo('+s.lat+','+s.lng+')"><i class="ti ti-navigation"></i> Directions</button>'
      +'<button class="act map" onclick="flyTo('+s.lat+','+s.lng+')"><i class="ti ti-map"></i> Map</button>'
      +'<button class="visit-btn'+(visited?' visited':'')+'" data-id="'+s.id+'"><i class="'+(visited?'ti ti-circle-check-filled':'ti ti-circle-check')+'" style="font-size:18px"></i></button>'
      +'<button class="save-btn'+(isSaved(s.id)?' saved':'')+'" data-id="'+s.id+'"><i class="ti ti-star'+(isSaved(s.id)?'-filled':'')+'" style="font-size:18px"></i></button>'
      +'</div></div>';
  }).join('');

  document.getElementById('listView').innerHTML=expandBanner+filterBar
    +'<div style="display:flex;justify-content:space-between;padding:2px 0 7px">'
    +'<div style="font-size:9.5px;font-weight:700;color:var(--faint);letter-spacing:.8px;text-transform:uppercase">'+filtered.length+' fishing spots</div>'
    +'<div style="font-size:9.5px;color:var(--faint)">OpenStreetMap</div></div>'+cards;
}

// ════════════════════════════════════════════
//  HIKING LIST
// ════════════════════════════════════════════
function renderHikingList(expanding){
  const filtered=driveFilter>0?spots.filter(s=>s.driveMin<=driveFilter):spots;

  if(!filtered.length){
    document.getElementById('listView').innerHTML='<div class="state">'
      +'<i class="ti ti-walk" style="font-size:42px;color:var(--accent)"></i>'
      +'<div class="state-title">No trails found</div>'
      +'<div class="state-sub">Try scanning or adjusting your drive filter.</div></div>';
    return;
  }

  const expandBanner=expanding?'<div class="expanding"><i class="ti ti-loader spinning"></i> Expanding search…</div>':'';

  const filterBar='<div class="df-bar">'
    +'<button class="df-btn'+(driveFilter===0?' on':'')+'" data-df="0">All drives</button>'
    +'<button class="df-btn'+(driveFilter===30?' on':'')+'" data-df="30">≤ 30 min</button>'
    +'<button class="df-btn'+(driveFilter===60?' on':'')+'" data-df="60">≤ 1 hour</button>'
    +'<button class="df-btn'+(driveFilter===120?' on':'')+'" data-df="120">≤ 2 hours</button>'
    +'</div>';

  // Difficulty label map
  const diffLabel={hiking:'Easy',mountain_hiking:'Moderate',demanding_mountain_hiking:'Hard',
    alpine_hiking:'Alpine',demanding_alpine_hiking:'Expert',difficult_alpine_hiking:'Extreme'};

  const cards=filtered.map((s,i)=>{
    const isTop=i===0;
    const visited=isVisited(s.id);
    const diff=diffLabel[s.difficulty]||'';
    const diffColor=diff==='Easy'?'var(--accent)':diff==='Moderate'?'var(--amber)':'var(--red)';
    const surface=s.surface?s.surface.charAt(0).toUpperCase()+s.surface.slice(1):'';
    const isRelation=s.type==='relation';

    return '<div class="spot'+(visited?' visited-spot':'')+'" style="animation-delay:'+Math.min(i*28,380)+'ms">'
      +'<div class="spot-top"><div>'
      +'<div class="spot-rank'+(isTop?' gold':'')+'">'+(isTop?'★ #1':'#'+(i+1))+'</div>'
      +'<div class="spot-name">'+s.name+'</div></div>'
      +'<div class="score-block"><div class="n">'+s.score+'</div><div class="l">Score</div></div></div>'
      +'<div class="meta">'
      +'<div class="mtag hi"><i class="ti ti-location"></i> '+s.dist+'km</div>'
      +'<div class="mtag hi"><i class="ti ti-car"></i> '+driveTxt(s.dist)+'</div>'
      +(s.lengthKm>0?'<div class="mtag"><i class="ti ti-route"></i> '+s.lengthKm+'km</div>':'')
      +(diff?'<div class="mtag" style="color:'+diffColor+';border-color:'+diffColor+'44;background:'+diffColor+'11">'+diff+'</div>':'')
      +(isRelation?'<div class="mtag" style="color:var(--amber);border-color:rgba(244,185,66,.25);background:rgba(244,185,66,.07)"><i class="ti ti-route"></i> Named route</div>':'')
      +(surface?'<div class="mtag">'+surface+'</div>':'')
      +'</div>'
      +'<div class="bars">'
      +'<div class="bar"><span class="bar-l">Prox</span><div class="bar-t"><div class="bar-f p" style="width:'+(s.sP/40*100)+'%"></div></div><span class="bar-v">'+s.sP+'/40</span></div>'
      +'<div class="bar"><span class="bar-l">Length</span><div class="bar-t"><div class="bar-f q" style="width:'+(s.sL/30*100)+'%"></div></div><span class="bar-v">'+s.sL+'/30</span></div>'
      +'<div class="bar"><span class="bar-l">Quality</span><div class="bar-t"><div class="bar-f" style="width:'+(s.sQ/20*100)+'%;background:var(--amber)"></div></div><span class="bar-v">'+s.sQ+'/20</span></div>'
      +'</div>'
      +'<div class="actions">'
      +'<button class="act go" onclick="navTo('+s.lat+','+s.lng+')"><i class="ti ti-navigation"></i> Directions</button>'
      +'<button class="act map" onclick="flyTo('+s.lat+','+s.lng+')"><i class="ti ti-map"></i> Map</button>'
      +'<button class="visit-btn'+(visited?' visited':'')+'" data-id="'+s.id+'"><i class="'+(visited?'ti ti-circle-check-filled':'ti ti-circle-check')+'" style="font-size:18px"></i></button>'
      +'<button class="save-btn'+(isSaved(s.id)?' saved':'')+'" data-id="'+s.id+'"><i class="ti ti-star'+(isSaved(s.id)?'-filled':'')+'" style="font-size:18px"></i></button>'
      +'</div></div>';
  }).join('');

  document.getElementById('listView').innerHTML=expandBanner+filterBar
    +'<div style="display:flex;justify-content:space-between;padding:2px 0 7px">'
    +'<div style="font-size:9.5px;font-weight:700;color:var(--faint);letter-spacing:.8px;text-transform:uppercase">'+filtered.length+' trails</div>'
    +'<div style="font-size:9.5px;color:var(--faint)">OpenStreetMap</div></div>'+cards;
}

// ════════════════════════════════════════════
//  WILDLIFE LIST
// ════════════════════════════════════════════
function renderWildlifeList(expanding){
  const filtered=driveFilter>0?spots.filter(s=>s.driveMin<=driveFilter):spots;
  if(!filtered.length){
    document.getElementById('listView').innerHTML='<div class="state">'
      +'<i class="ti ti-binoculars" style="font-size:42px;color:var(--accent)"></i>'
      +'<div class="state-title">No wildlife spots found</div>'
      +'<div class="state-sub">Try scanning or adjusting your drive filter.</div></div>';
    return;
  }
  const expandBanner=expanding?'<div class="expanding"><i class="ti ti-loader spinning"></i> Expanding search…</div>':'';
  const filterBar='<div class="df-bar">'
    +'<button class="df-btn'+(driveFilter===0?' on':'')+'" data-df="0">All drives</button>'
    +'<button class="df-btn'+(driveFilter===30?' on':'')+'" data-df="30">≤ 30 min</button>'
    +'<button class="df-btn'+(driveFilter===60?' on':'')+'" data-df="60">≤ 1 hour</button>'
    +'<button class="df-btn'+(driveFilter===120?' on':'')+'" data-df="120">≤ 2 hours</button>'
    +'</div>';
  const cards=filtered.map((s,i)=>{
    const isTop=i===0,visited=isVisited(s.id);
    const protectedTag=s.isProtected
      ?'<div class="mtag" style="color:var(--accent);border-color:rgba(92,184,92,.25);background:rgba(92,184,92,.07)"><i class="ti ti-shield"></i> Protected</div>'
      :'';
    const hideTag=s.hasHide
      ?'<div class="mtag" style="color:var(--amber);border-color:rgba(244,185,66,.25);background:rgba(244,185,66,.07)"><i class="ti ti-eye"></i> Observation hide</div>'
      :'';
    return '<div class="spot'+(visited?' visited-spot':'')+'" style="animation-delay:'+Math.min(i*28,380)+'ms">'
      +'<div class="spot-top"><div><div class="spot-rank'+(isTop?' gold':'')+'">'+(isTop?'★ #1':'#'+(i+1))+'</div><div class="spot-name">'+s.name+'</div></div>'
      +'<div class="score-block"><div class="n">'+s.score+'</div><div class="l">Score</div></div></div>'
      +'<div class="meta"><div class="mtag hi"><i class="ti ti-location"></i> '+s.dist+'km</div>'
      +'<div class="mtag hi"><i class="ti ti-car"></i> '+driveTxt(s.dist)+'</div>'
      +'<div class="mtag"><i class="ti ti-leaf"></i> '+s.habitatType+'</div>'
      +protectedTag+hideTag+'</div>'
      +'<div class="bars">'
      +'<div class="bar"><span class="bar-l">Prox</span><div class="bar-t"><div class="bar-f p" style="width:'+(s.sP/40*100)+'%"></div></div><span class="bar-v">'+s.sP+'/40</span></div>'
      +'<div class="bar"><span class="bar-l">Habitat</span><div class="bar-t"><div class="bar-f q" style="width:'+(s.sH/35*100)+'%"></div></div><span class="bar-v">'+s.sH+'/35</span></div>'
      +'<div class="bar"><span class="bar-l">Protected</span><div class="bar-t"><div class="bar-f" style="width:'+(s.sPr/25*100)+'%;background:var(--amber)"></div></div><span class="bar-v">'+s.sPr+'/25</span></div>'
      +'</div>'
      +'<div class="actions">'
      +'<button class="act go" onclick="navTo('+s.lat+','+s.lng+')"><i class="ti ti-navigation"></i> Directions</button>'
      +'<button class="act map" onclick="flyTo('+s.lat+','+s.lng+')"><i class="ti ti-map"></i> Map</button>'
      +'<button class="visit-btn'+(visited?' visited':'')+'" data-id="'+s.id+'"><i class="'+(visited?'ti ti-circle-check-filled':'ti ti-circle-check')+'" style="font-size:18px"></i></button>'
      +'<button class="save-btn'+(isSaved(s.id)?' saved':'')+'" data-id="'+s.id+'"><i class="ti ti-star'+(isSaved(s.id)?'-filled':'')+'" style="font-size:18px"></i></button>'
      +'</div></div>';
  }).join('');
  document.getElementById('listView').innerHTML=expandBanner+filterBar
    +'<div style="display:flex;justify-content:space-between;padding:2px 0 7px">'
    +'<div style="font-size:9.5px;font-weight:700;color:var(--faint);letter-spacing:.8px;text-transform:uppercase">'+filtered.length+' wildlife spots</div>'
    +'<div style="font-size:9.5px;color:var(--faint)">OpenStreetMap</div></div>'+cards;
}

// ════════════════════════════════════════════
//  KAYAKING LIST
// ════════════════════════════════════════════
function renderKayakingList(expanding){
  const filtered=driveFilter>0?spots.filter(s=>s.driveMin<=driveFilter):spots;
  if(!filtered.length){
    document.getElementById('listView').innerHTML='<div class="state">'
      +'<i class="ti ti-kayak" style="font-size:42px;color:var(--blue)"></i>'
      +'<div class="state-title">No paddling spots found</div>'
      +'<div class="state-sub">Try scanning or adjusting your drive filter.</div></div>';
    return;
  }
  const expandBanner=expanding?'<div class="expanding"><i class="ti ti-loader spinning"></i> Expanding search…</div>':'';
  const filterBar='<div class="df-bar">'
    +'<button class="df-btn'+(driveFilter===0?' on':'')+'" data-df="0">All drives</button>'
    +'<button class="df-btn'+(driveFilter===30?' on':'')+'" data-df="30">≤ 30 min</button>'
    +'<button class="df-btn'+(driveFilter===60?' on':'')+'" data-df="60">≤ 1 hour</button>'
    +'<button class="df-btn'+(driveFilter===120?' on':'')+'" data-df="120">≤ 2 hours</button>'
    +'</div>';
  const cards=filtered.map((s,i)=>{
    const isTop=i===0,visited=isVisited(s.id);
    const slipwayTag=s.hasSlipway
      ?'<div class="mtag" style="color:var(--blue);border-color:rgba(74,158,255,.25);background:rgba(74,158,255,.07)"><i class="ti ti-anchor"></i> Slipway</div>'
      :'';
    const rentalTag=s.hasRental
      ?'<div class="mtag" style="color:var(--accent);border-color:rgba(92,184,92,.25);background:rgba(92,184,92,.07)"><i class="ti ti-kayak"></i> Rental</div>'
      :'';
    return '<div class="spot'+(visited?' visited-spot':'')+'" style="animation-delay:'+Math.min(i*28,380)+'ms">'
      +'<div class="spot-top"><div><div class="spot-rank'+(isTop?' gold':'')+'">'+(isTop?'★ #1':'#'+(i+1))+'</div><div class="spot-name">'+s.name+'</div></div>'
      +'<div class="score-block"><div class="n">'+s.score+'</div><div class="l">Score</div></div></div>'
      +'<div class="meta"><div class="mtag hi"><i class="ti ti-location"></i> '+s.dist+'km</div>'
      +'<div class="mtag hi"><i class="ti ti-car"></i> '+driveTxt(s.dist)+'</div>'
      +'<div class="mtag"><i class="ti ti-droplet"></i> '+s.waterType+'</div>'
      +slipwayTag+rentalTag+'</div>'
      +'<div class="bars">'
      +'<div class="bar"><span class="bar-l">Prox</span><div class="bar-t"><div class="bar-f p" style="width:'+(s.sP/40*100)+'%"></div></div><span class="bar-v">'+s.sP+'/40</span></div>'
      +'<div class="bar"><span class="bar-l">Water</span><div class="bar-t"><div class="bar-f" style="width:'+(s.sW/35*100)+'%;background:var(--blue)"></div></div><span class="bar-v">'+s.sW+'/35</span></div>'
      +'<div class="bar"><span class="bar-l">Access</span><div class="bar-t"><div class="bar-f q" style="width:'+(s.sA/25*100)+'%"></div></div><span class="bar-v">'+s.sA+'/25</span></div>'
      +'</div>'
      +'<div class="actions">'
      +'<button class="act go" onclick="navTo('+s.lat+','+s.lng+')"><i class="ti ti-navigation"></i> Directions</button>'
      +'<button class="act map" onclick="flyTo('+s.lat+','+s.lng+')"><i class="ti ti-map"></i> Map</button>'
      +'<button class="visit-btn'+(visited?' visited':'')+'" data-id="'+s.id+'"><i class="'+(visited?'ti ti-circle-check-filled':'ti ti-circle-check')+'" style="font-size:18px"></i></button>'
      +'<button class="save-btn'+(isSaved(s.id)?' saved':'')+'" data-id="'+s.id+'"><i class="ti ti-star'+(isSaved(s.id)?'-filled':'')+'" style="font-size:18px"></i></button>'
      +'</div></div>';
  }).join('');
  document.getElementById('listView').innerHTML=expandBanner+filterBar
    +'<div style="display:flex;justify-content:space-between;padding:2px 0 7px">'
    +'<div style="font-size:9.5px;font-weight:700;color:var(--faint);letter-spacing:.8px;text-transform:uppercase">'+filtered.length+' paddling spots</div>'
    +'<div style="font-size:9.5px;color:var(--faint)">OpenStreetMap</div></div>'+cards;
}

// ════════════════════════════════════════════
//  MIGRATION PULSE RENDER
// ════════════════════════════════════════════
var _pulseChart=null; // Chart.js instance ref — destroy before recreate

function renderMigrationPulse(data,loading,errMsg){
  var el=document.getElementById('pulseView');
  if(!el)return;

  // ── Loading / error states ──
  if(loading){
    el.innerHTML='<div class="state">'
      +'<i class="ti ti-chart-bar" style="font-size:42px;color:var(--accent)"></i>'
      +'<div class="state-title">Loading Migration Pulse</div>'
      +'<div class="state-sub">Scanning last 30 days of eBird data near you…</div>'
      +'</div>';
    return;
  }
  if(!data){
    el.innerHTML='<div class="state">'
      +'<i class="ti ti-alert-triangle" style="font-size:42px;color:var(--amber)"></i>'
      +'<div class="state-title">Pulse Unavailable</div>'
      +'<div class="state-sub">'+(errMsg||'Scan first to load migration data.')+'</div>'
      +'<button class="retry-btn" style="margin-top:12px;padding:8px 14px;background:rgba(80,160,60,.13);border:1px solid var(--border2);border-radius:8px;color:var(--lime);font-size:12px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif">↩ Retry</button>'
      +'</div>';
    el.querySelector('.retry-btn').addEventListener('click',function(){pulseData=null;loadMigrationPulse();});
    return;
  }

  // ── Pulse Score banner ──
  var score=data.pulseScore;
  var scoreCol=score>=70?'var(--red)':score>=45?'var(--amber)':'var(--muted)';
  var scoreLabel=score>=70?'🔥 Migration peaking!':score>=45?'↑ Activity building':score>=25?'Moderate activity':'Quiet period';
  var scoreBg=score>=70?'rgba(224,108,108,.1)':score>=45?'rgba(244,185,66,.07)':'rgba(255,255,255,.03)';

  var pulseBanner='<div style="margin:12px 0 10px;padding:14px 16px;border-radius:14px;border:1px solid '
    +(score>=70?'rgba(224,108,108,.3)':score>=45?'rgba(244,185,66,.25)':'var(--border)')
    +';background:'+scoreBg+'">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
    +'<div style="font-size:9px;font-weight:700;color:var(--faint);letter-spacing:1px;text-transform:uppercase">Migration Pulse Score</div>'
    +'<div style="font-family:Fraunces,serif;font-size:32px;font-weight:700;color:'+scoreCol+'">'+score+'</div>'
    +'</div>'
    +'<div style="font-size:13px;font-weight:700;color:'+scoreCol+'">'+scoreLabel+'</div>'
    +'<div style="font-size:10.5px;color:var(--muted);margin-top:4px">'
    +'Last 7 days avg: '+data.avgRecent+' species/day · Prior 7 days: '+data.avgPrior+' species/day'
    +'</div>'
    +'</div>';

  // ── BirdCast link ──
  var birdcastBtn='<a href="https://birdcast.info/migration-tools/live-migration-maps/" target="_blank" '
    +'style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;'
    +'background:rgba(74,158,255,.07);border:1px solid rgba(74,158,255,.2);'
    +'color:var(--blue);font-size:11px;font-weight:700;text-decoration:none;margin-bottom:12px">'
    +'<i class="ti ti-radar"></i> View live radar on BirdCast.info'
    +'<span style="margin-left:auto;font-size:10px;opacity:.7">↗</span>'
    +'</a>';

  // ── Chart canvas ──
  var chartSection='<div style="margin-bottom:16px">'
    +'<div style="font-size:9px;font-weight:700;color:var(--faint);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">'
    +'30-day observation trend</div>'
    +'<div style="position:relative;height:160px">'
    +'<canvas id="pulseChart"></canvas>'
    +'</div></div>';

  // ── Migrant arrivals ──
  var arrivalsHtml='';
  var arrivalKeys=Object.keys(data.arrivals);
  if(arrivalKeys.length){
    arrivalsHtml='<div style="margin-bottom:16px">'
      +'<div style="font-size:9px;font-weight:700;color:var(--faint);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Migrant groups — last 7 days</div>'
      +'<div style="display:flex;flex-direction:column;gap:6px">';
    arrivalKeys.forEach(function(group){
      var a=data.arrivals[group];
      var trendCol=a.trend>30?'var(--accent)':a.trend>0?'var(--amber)':'var(--muted)';
      var trendArrow=a.trend>30?'▲':a.trend>0?'↑':a.trend<-20?'↓':'→';
      arrivalsHtml+='<div style="display:flex;align-items:center;justify-content:space-between;'
        +'padding:8px 12px;border-radius:10px;background:var(--card);border:1px solid var(--border)">'
        +'<div style="font-size:12px;font-weight:600;color:var(--text)">'+group+'</div>'
        +'<div style="display:flex;align-items:center;gap:8px">'
        +'<div style="font-size:10px;color:var(--muted)">'+a.recent.toLocaleString()+' birds</div>'
        +'<div style="font-size:12px;font-weight:700;color:'+trendCol+'">'+trendArrow
        +(a.trend>0?' +':' ')+a.trend+'%</div>'
        +'</div></div>';
    });
    arrivalsHtml+='</div></div>';
  }

  // ── Big flocks ──
  var flocksHtml='';
  if(data.flocks.length){
    flocksHtml='<div style="margin-bottom:16px">'
      +'<div style="font-size:9px;font-weight:700;color:var(--faint);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">'
      +'Big flocks (500+)</div>'
      +'<div style="display:flex;flex-direction:column;gap:6px">';
    data.flocks.forEach(function(f){
      flocksHtml+='<div style="padding:9px 12px;border-radius:10px;background:var(--card);border:1px solid var(--border)">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">'
        +'<div style="font-size:12px;font-weight:700;color:var(--text)">'+f.species+'</div>'
        +'<div style="font-family:Fraunces,serif;font-size:16px;font-weight:700;color:var(--amber)">'
        +f.count.toLocaleString()+'</div>'
        +'</div>'
        +'<div style="font-size:10px;color:var(--muted)">'+f.loc+' · '+f.date+'</div>'
        +'</div>';
    });
    flocksHtml+='</div></div>';
  }

  // ── Top species ──
  var topHtml='<div style="margin-bottom:16px">'
    +'<div style="font-size:9px;font-weight:700;color:var(--faint);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">'
    +'Most recorded species (30 days)</div>'
    +'<div style="display:flex;flex-direction:column;gap:4px">';
  data.topSpecies.slice(0,8).forEach(function(sp,i){
    var barW=Math.round((sp.total/data.topSpecies[0].total)*100);
    topHtml+='<div style="display:flex;align-items:center;gap:8px">'
      +'<div style="font-size:10px;color:var(--muted);width:16px;text-align:right">'+(i+1)+'</div>'
      +'<div style="flex:1">'
      +'<div style="font-size:11px;color:var(--text);margin-bottom:2px">'+sp.name+'</div>'
      +'<div style="height:3px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden">'
      +'<div style="width:'+barW+'%;height:100%;background:var(--accent);border-radius:2px"></div>'
      +'</div></div>'
      +'<div style="font-size:10px;color:var(--faint);white-space:nowrap">'+sp.total.toLocaleString()+' · '+sp.days+'d</div>'
      +'</div>';
  });
  topHtml+='</div></div>';

  el.innerHTML=pulseBanner+birdcastBtn+chartSection+arrivalsHtml+flocksHtml+topHtml;

  // ── Chart.js rendering ──
  if(_pulseChart){try{_pulseChart.destroy();}catch(_){} _pulseChart=null;}
  var canvas=document.getElementById('pulseChart');
  if(!canvas||!window.Chart)return;

  var labels=data.dailySeries.map(function(d){return d.label;});
  var birdCounts=data.dailySeries.map(function(d){return d.birds;});
  var spCounts=data.dailySeries.map(function(d){return d.species;});

  _pulseChart=new Chart(canvas,{
    type:'bar',
    data:{
      labels:labels,
      datasets:[
        {
          label:'Total birds',
          data:birdCounts,
          backgroundColor:'rgba(92,184,92,.35)',
          borderColor:'rgba(92,184,92,.7)',
          borderWidth:1,
          yAxisID:'y',
          order:2,
        },
        {
          label:'Species diversity',
          data:spCounts,
          type:'line',
          borderColor:'#f4b942',
          backgroundColor:'rgba(244,185,66,.12)',
          borderWidth:2,
          pointRadius:2,
          fill:true,
          tension:0.3,
          yAxisID:'y1',
          order:1,
        }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{
          labels:{color:'#7a9c7a',font:{size:10,family:'Outfit'}},
          position:'bottom'
        },
        tooltip:{
          backgroundColor:'rgba(19,32,26,.97)',
          titleColor:'#e8f5e8',
          bodyColor:'#7a9c7a',
          borderColor:'rgba(92,184,92,.3)',
          borderWidth:1,
        }
      },
      scales:{
        x:{
          ticks:{color:'#2a3a2f',font:{size:9},maxTicksLimit:10},
          grid:{color:'rgba(255,255,255,.04)'}
        },
        y:{
          type:'linear',position:'left',
          ticks:{color:'#5cb85c',font:{size:9}},
          grid:{color:'rgba(255,255,255,.06)'},
          title:{display:true,text:'Birds',color:'#5cb85c',font:{size:9}}
        },
        y1:{
          type:'linear',position:'right',
          ticks:{color:'#f4b942',font:{size:9}},
          grid:{drawOnChartArea:false},
          title:{display:true,text:'Species',color:'#f4b942',font:{size:9}}
        }
      }
    }
  });
}
