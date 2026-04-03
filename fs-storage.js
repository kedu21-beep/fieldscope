// ═══════════════════════════════════════
//  STORAGE — saved, visited, cache
// ═══════════════════════════════════════

let savedSpots  = {};
let visitedSpots = {};
let hideVisited  = false;

// ── SAVED ──
function loadSaved(){
  try{savedSpots=JSON.parse(localStorage.getItem('fs_saved')||'{}');}catch(_){savedSpots={};}
}
function persistSaved(){
  try{localStorage.setItem('fs_saved',JSON.stringify(savedSpots));}catch(_){}
}
function isSaved(id){return !!savedSpots[id];}

function saveSpot(s){
  savedSpots[s.id]={
    id:s.id,name:s.name,lat:s.lat,lng:s.lng,
    dist:s.dist,score:s.score,rareCnt:s.rareCnt,
    rare:s.rare,spCnt:s.spCnt,savedAt:Date.now()
  };
  persistSaved();
  toast('★ '+s.name+' saved',1800);
  document.querySelectorAll('.save-btn[data-id="'+s.id+'"]').forEach(b=>{
    b.classList.add('saved');b.title='Unsave';
  });
}

function unsaveSpot(id){
  const name=(savedSpots[id]||{}).name||'Spot';
  delete savedSpots[id];
  persistSaved();
  toast('Removed: '+name,1800);
  document.querySelectorAll('.save-btn[data-id="'+id+'"]').forEach(b=>{
    b.classList.remove('saved');b.title='Save';
  });
  if(document.getElementById('tabSaved').classList.contains('on'))renderSaved();
}

function toggleSave(id){
  const spot=spots.find(s=>s.id===id);
  if(!spot){if(isSaved(id))unsaveSpot(id);return;}
  isSaved(id)?unsaveSpot(id):saveSpot(spot);
}

function renderSaved(){
  const sv=document.getElementById('savedView');
  const entries=Object.values(savedSpots).sort((a,b)=>b.savedAt-a.savedAt);
  if(!entries.length){
    sv.innerHTML='<div class="state">'
      +'<i class="ti ti-star" style="font-size:42px;color:var(--amber)"></i>'
      +'<div class="state-title">No saved spots yet</div>'
      +'<div class="state-sub">Tap the star on any spot card to save it for quick access.</div>'
      +'</div>';
    return;
  }
  const cards=entries.map((s,i)=>{
    const age=Math.round((Date.now()-s.savedAt)/60000);
    const ageTxt=age<60?age+'min ago':age<1440?Math.floor(age/60)+'h ago':Math.floor(age/1440)+'d ago';
    const rareTags=s.rare&&s.rare.length
      ?s.rare.slice(0,2).map(n=>'<span class="pill r"><i class="ti ti-zap"></i> '+n+'</span>').join('')
      :'';
    return '<div class="saved-card" style="animation-delay:'+Math.min(i*28,300)+'ms">'
      +'<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">'
      +'<div style="flex:1;padding-right:8px">'
      +'<div class="spot-name">'+s.name+'</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">'
      +'<div class="mtag hi"><i class="ti ti-location"></i> '+s.dist+'km</div>'
      +'<div class="mtag hi"><i class="ti ti-car"></i> '+driveTxt(s.dist)+'</div>'
      +'<div class="mtag"><i class="ti ti-feather"></i> '+s.spCnt+' sp.</div>'
      +(s.rareCnt>0?'<div class="mtag rare-t"><i class="ti ti-zap"></i> '+s.rareCnt+' rare</div>':'')
      +'</div></div>'
      +'<div style="display:flex;flex-direction:column;align-items:center;gap:6px">'
      +'<div class="score-block'+(s.rareCnt>0?' rare':'')+'"><div class="n">'+s.score+'</div><div class="l">Score</div></div>'
      +'<button class="save-btn saved" data-id="'+s.id+'" title="Unsave" style="font-size:13px;color:var(--faint)">'
      +'<i class="ti ti-trash"></i></button>'
      +'</div></div>'
      +(rareTags?'<div class="pills" style="margin-bottom:8px">'+rareTags+'</div>':'')
      +'<div style="font-size:9.5px;color:var(--faint);margin-bottom:8px"><i class="ti ti-clock"></i> Saved '+ageTxt+'</div>'
      +'<div class="actions">'
      +'<button class="act go" onclick="navTo('+s.lat+','+s.lng+')"><i class="ti ti-navigation"></i> Directions</button>'
      +'<button class="act map" onclick="flyTo('+s.lat+','+s.lng+')"><i class="ti ti-map"></i> Map</button>'
      +'</div></div>';
  }).join('');

  sv.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0 10px">'
    +'<div style="font-size:9.5px;font-weight:700;color:var(--faint);letter-spacing:.8px;text-transform:uppercase">'+entries.length+' saved spot'+(entries.length>1?'s':'')+'</div>'
    +'<button onclick="clearAllSaved()" style="font-size:10px;color:var(--faint);background:none;border:none;cursor:pointer;font-family:Outfit,sans-serif">Clear all</button>'
    +'</div>'+cards;
}

function clearAllSaved(){
  if(!Object.keys(savedSpots).length)return;
  savedSpots={};
  persistSaved();
  document.querySelectorAll('.save-btn').forEach(b=>{b.classList.remove('saved');b.title='Save';});
  renderSaved();
  toast('All saved spots cleared',2000);
}

// ── VISITED ──
function loadVisited(){
  try{visitedSpots=JSON.parse(localStorage.getItem('fs_visited')||'{}');}catch(_){visitedSpots={};}
}
function persistVisited(){
  try{localStorage.setItem('fs_visited',JSON.stringify(visitedSpots));}catch(_){}
}
function isVisited(id){return !!visitedSpots[id];}

function markVisited(id,name){
  visitedSpots[id]={id,name,visitedAt:Date.now()};
  persistVisited();
  toast('✓ Marked as visited: '+name,1800);
  updateVisitButtons(id,true);
  renderList(false);
}
function unmarkVisited(id){
  const name=(visitedSpots[id]||{}).name||'Spot';
  delete visitedSpots[id];
  persistVisited();
  toast('Removed visited: '+name,1800);
  updateVisitButtons(id,false);
  renderList(false);
}
function toggleVisited(id){
  const spot=spots.find(s=>s.id===id);
  const name=spot?spot.name:(visitedSpots[id]||{}).name||'Spot';
  isVisited(id)?unmarkVisited(id):markVisited(id,name);
}
function updateVisitButtons(id,visited){
  document.querySelectorAll('.visit-btn[data-id="'+id+'"]').forEach(b=>{
    b.classList.toggle('visited',visited);
    b.title=visited?'Unmark visited':'Mark visited';
    const icon=b.querySelector('i');
    if(icon)icon.className=visited?'ti ti-circle-check-filled':'ti ti-circle-check';
  });
}
function toggleHideVisited(){
  hideVisited=!hideVisited;
  renderList(false);
}
