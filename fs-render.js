// ═══════════════════════════════════════
//  RENDER + UI
// ═══════════════════════════════════════

function showLoading(){
  document.getElementById('listView').innerHTML=''
    +'<div class="state"><div class="prog-box">'
    +'<div class="prog-lbl">Scanning eBird · All ranges parallel</div>'
    +'<div class="prog-track"><div class="prog-fill" id="progFill" style="width:5%"></div></div>'
    +'<div>'
    +'<div class="pstep"><i class="ti ti-radar ps-i"></i><span class="ps-t act" id="s1">30km · 30 days</span></div>'
    +'<div class="pstep"><i class="ti ti-map ps-i"></i><span class="ps-t act" id="s2">100km · 14 days</span></div>'
    +'<div class="pstep"><i class="ti ti-world ps-i"></i><span class="ps-t act" id="s3">200km · 14 days</span></div>'
    +'</div></div>'
    +'<div style="font-size:10px;color:var(--faint);margin-top:6px">All 3 ranges fetching simultaneously</div></div>';
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
  const isList=tab==='list',isMap=tab==='map',isSavedTab=tab==='saved';
  document.getElementById('listView').style.display=isList?'block':'none';
  document.getElementById('mapView').classList.toggle('on',isMap);
  document.getElementById('savedView').style.display=isSavedTab?'block':'none';
  document.getElementById('tabList').classList.toggle('on',isList);
  document.getElementById('tabMap').classList.toggle('on',isMap);
  document.getElementById('tabSaved').classList.toggle('on',isSavedTab);
  if(isMap){initMap();setTimeout(()=>leafMap&&leafMap.invalidateSize(),55);}
  if(isSavedTab)renderSaved();
}

function renderList(expanding){
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
    +'<button class="save-btn'+(isSaved(hero.id)?' saved':'')+'" data-id="'+hero.id+'" title="'+(isSaved(hero.id)?'Unsave':'Save')+'">'
    +'<i class="ti ti-star'+(isSaved(hero.id)?'-filled':'')+'" style="font-size:18px"></i></button>'
    +'<button class="act" onclick="event.stopPropagation();window.open(\''+heroEbirdUrl+'\',\'_blank\')" '
    +'style="background:rgba(74,158,255,.07);border:1px solid rgba(74,158,255,.18);color:var(--muted);flex:0;padding:8px 10px">'
    +'<i class="ti ti-brand-databricks"></i></button>'
    +'</div></div>';

  const expandBanner=expanding
    ?'<div class="expanding"><i class="ti ti-loader spinning"></i> Expanding scan…</div>'
    :'';

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
    +(visitedCount>0
      ?'<button class="df-btn hv-btn'+(hideVisited?' on':'')+'">'
        +(hideVisited?'Show visited ('+visitedCount+')':'Hide visited ('+visitedCount+')')
        +'</button>'
      :'')
    +'</div>';

  const cards=filtered.map((s,i)=>{
    const isR=s.rareCnt>0,isTop=i===0;
    const rarePills=s.rare.slice(0,3).map(n=>'<span class="pill r"><i class="ti ti-zap"></i> '+n+'</span>').join('')
      +(s.rare.length>3?'<span class="pill more">+'+(s.rare.length-3)+'</span>':'');
    const spPills=s.topSp.slice(0,4).map(n=>'<span class="pill">'+n+'</span>').join('')
      +(s.spCnt>4?'<span class="pill more">+'+(s.spCnt-4)+'</span>':'');
    const recTag=s.sRec>0
      ?'<div class="mtag" style="color:var(--amber);border-color:rgba(244,185,66,.25);background:rgba(244,185,66,.07)">'
        +'<i class="ti ti-clock"></i> '+(s.recent24>0?s.recent24+' list'+(s.recent24>1?'s':'')+' today':s.recent48+' list'+(s.recent48>1?'s':'')+' yest.')+'</div>'
      :'';
    const momTag=s.momentumLabel
      ?'<div class="mtag" style="color:'+(s.sMom>0?'var(--accent)':'var(--blue)')
        +';border-color:'+(s.sMom>0?'rgba(92,184,92,.25)':'rgba(74,158,255,.25)')
        +';background:'+(s.sMom>0?'rgba(92,184,92,.07)':'rgba(74,158,255,.07)')+'">'+s.momentumLabel+'</div>'
      :'';
    const ebirdUrl='https://ebird.org/hotspot/'+s.id;
    const visited=isVisited(s.id);
    return '<div class="spot'+(isR?' rare':'')+(visited?' visited-spot':'')+'" style="animation-delay:'+Math.min(i*28,380)+'ms">'
      +'<div class="spot-top"><div>'
      +'<div class="spot-rank'+(isTop?' gold':'')+'">'+(isTop?'★ #1':'#'+(i+1))+'</div>'
      +'<div class="spot-name">'+s.name+'</div></div>'
      +'<div class="score-block'+(isR?' rare':'')+'"><div class="n">'+s.score+'</div><div class="l">Score</div></div></div>'
      +'<div class="meta">'
      +'<div class="mtag hi"><i class="ti ti-location"></i> '+s.dist+'km</div>'
      +'<div class="mtag hi"><i class="ti ti-car"></i> '+driveTxt(s.dist)+'</div>'
      +'<div class="mtag'+(s.spCnt>20?' hi':'')+'"><i class="ti ti-feather"></i> '+s.spCnt+' sp.</div>'
      +(isR?'<div class="mtag rare-t"><i class="ti ti-zap"></i> '+s.rareCnt+' rare</div>':'')+recTag+momTag+'</div>'
      +'<div class="bars">'
      +'<div class="bar"><span class="bar-l">Prox</span><div class="bar-t"><div class="bar-f p" style="width:'+(s.sP/40*100)+'%"></div></div><span class="bar-v">'+s.sP+'/40</span></div>'
      +'<div class="bar"><span class="bar-l">Species</span><div class="bar-t"><div class="bar-f q" style="width:'+(s.sQ/35*100)+'%"></div></div><span class="bar-v" title="'+s.effSpCnt+' eff / '+s.spCnt+' raw (ceiling '+s.spNorm+')">'+s.sQ+'/35</span></div>'
      +'<div class="bar"><span class="bar-l">Rarity</span><div class="bar-t"><div class="bar-f r" style="width:'+(s.sR/25*100)+'%"></div></div><span class="bar-v" title="'+s.rareCnt+' rare / '+s.totalChecklists+' lists · conc '+s.concentration+'%">'+s.sR+'/25</span></div>'
      +(s.sRec>0?'<div class="bar"><span class="bar-l">Recent</span><div class="bar-t"><div class="bar-f" style="width:100%;background:var(--amber)"></div></div><span class="bar-v">+'+s.sRec+'</span></div>':'')
      +(s.sMom!==0?'<div class="bar"><span class="bar-l">Trend</span><div class="bar-t"><div class="bar-f" style="width:'+Math.abs(s.sMom)/5*100+'%;background:'+(s.sMom>0?'var(--accent)':'var(--blue)')+'"></div></div><span class="bar-v">'+(s.sMom>0?'+':'')+s.sMom+'</span></div>':'')
      +'</div>'
      +(isR&&rarePills?'<div class="pills">'+rarePills+'</div>':'')
      +(spPills?'<div class="pills">'+spPills+'</div>':'')
      +'<div class="actions">'
      +'<button class="act go" onclick="navTo('+s.lat+','+s.lng+')"><i class="ti ti-navigation"></i> Directions</button>'
      +'<button class="act map" onclick="flyTo('+s.lat+','+s.lng+')"><i class="ti ti-map"></i> Map</button>'
      +'<button class="visit-btn'+(visited?' visited':'')+'" data-id="'+s.id+'" title="'+(visited?'Unmark visited':'Mark visited')+'">'
      +'<i class="'+(visited?'ti ti-circle-check-filled':'ti ti-circle-check')+'" style="font-size:18px"></i></button>'
      +'<button class="save-btn'+(isSaved(s.id)?' saved':'')+'" data-id="'+s.id+'" title="'+(isSaved(s.id)?'Unsave':'Save')+'">'
      +'<i class="ti ti-star'+(isSaved(s.id)?'-filled':'')+'" style="font-size:18px"></i></button>'
      +'<button class="act" onclick="window.open(\''+ebirdUrl+'\',\'_blank\')" style="background:rgba(74,158,255,.07);border:1px solid rgba(74,158,255,.18);color:var(--muted);flex:0;padding:8px 10px"><i class="ti ti-brand-databricks"></i></button>'
      +'</div></div>';
  }).join('');

  document.getElementById('listView').innerHTML=rareBanner+expandBanner+heroHtml+radiusBar+filterBar
    +'<div style="display:flex;justify-content:space-between;padding:2px 0 7px">'
    +'<div style="font-size:9.5px;font-weight:700;color:var(--faint);letter-spacing:.8px;text-transform:uppercase">'+filtered.length+' locations ranked</div>'
    +'<div style="font-size:9.5px;color:var(--faint)">last 7 days</div></div>'+cards;
}
