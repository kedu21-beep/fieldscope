// ═══════════════════════════════════════
//  MAP — activity-aware, drive rings, GPX export
// ═══════════════════════════════════════

function initMap(){
  if(leafMap)return;
  leafMap=L.map('mapEl',{center:[userLat,userLng],zoom:9});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
    maxZoom:19,
    attribution:'© <a href="https://carto.com/">CARTO</a> · © <a href="https://osm.org/copyright">OSM</a>'
  }).addTo(leafMap);
  setTimeout(()=>leafMap.invalidateSize(),80);
  if(spots.length)updateMap();
}

// Activity → pin color
function pinColor(s,i){
  if(currentActivity==='birding'){
    if(s.rareCnt>0) return '#e06c6c';
    if(i===0)       return '#f4b942';
    return '#5cb85c';
  }
  if(currentActivity==='fishing'){
    if(s.accessWarning)          return '#e06c6c';
    if((s.fishRare||[]).length)  return '#f4b942';
    return '#4a9eff';
  }
  if(currentActivity==='hiking'){
    if(s.difficulty==='mountain_hiking'||s.difficulty==='demanding_mountain_hiking') return '#f4b942';
    return '#5cb85c';
  }
  if(currentActivity==='camping')  return '#f4b942';
  if(currentActivity==='wildlife') return '#a3e4a3';
  if(currentActivity==='kayaking') return '#4a9eff';
  return '#5cb85c';
}

// Build popup content per activity
function buildPopup(s,i){
  var head='<div class="p-name">'+s.name+'</div>'
    +'<div class="p-score">'+s.score+'<span style="font-size:11px;color:var(--muted);font-family:Outfit"> pts</span></div>';

  var meta='<div class="p-meta"><i class="ti ti-location"></i> '+s.dist+'km · <i class="ti ti-car"></i> '+driveTxt(s.dist);

  if(currentActivity==='birding'){
    meta+=' · <i class="ti ti-feather"></i> '+s.spCnt+' sp.';
    if(s.rareCnt>0) meta+=' · <i class="ti ti-zap"></i> '+s.rareCnt+' rare';
  }else if(currentActivity==='fishing'){
    if(s.fishSpecies&&s.fishSpecies.length){
      meta+='<br><i class="ti ti-fish"></i> '+(s.fishSpecies.slice(0,2).join(', '));
      if((s.fishRare||[]).length) meta+=' · ★ '+(s.fishRare[0]);
    }
    if(s.accessWarning) meta+='<br><span style="color:#ffaaaa"><i class="ti ti-lock"></i> Private access</span>';
  }else if(currentActivity==='hiking'){
    if(s.lengthKm>0) meta+=' · <i class="ti ti-route"></i> '+s.lengthKm+'km';
    if(s.difficulty)  meta+=' · '+s.difficulty.replace(/_/g,' ');
  }else if(currentActivity==='camping'){
    if(s.sites>0) meta+=' · <i class="ti ti-tent"></i> '+s.sites+' sites';
    if(s.facilities&&s.facilities!=='Basic') meta+=' · '+s.facilities;
  }
  meta+='</div>';

  var btn='<button class="p-go" onclick="navTo('+s.lat+','+s.lng+')">'
    +'<i class="ti ti-navigation"></i> Get Directions</button>';

  return head+meta+btn;
}

function updateMap(){
  if(!leafMap)return;
  mapPins.forEach(m=>m.remove());mapPins=[];

  const maxScore=spots.length>0?spots[0].score:100;

  // User location pin
  const userPin=L.circleMarker([userLat,userLng],{
    radius:6,fillColor:'#ffffff',color:'rgba(255,255,255,.5)',weight:6,fillOpacity:1
  });
  userPin.bindPopup('<div class="p-name">Your Location</div>');
  userPin.addTo(leafMap);mapPins.push(userPin);

  // Drive-time rings — 30/60/120 min at 70kph
  var ringColors={30:'#f4b942',60:'#5cb85c',120:'#4a9eff'};
  [30,60,120].forEach(function(min){
    var km=Math.round((min/60)*70);
    var ring=L.circle([userLat,userLng],{
      radius:km*1000,
      color:ringColors[min],weight:1.5,opacity:0.45,
      fill:false,dashArray:'6,6'
    });
    ring.bindTooltip('~'+min+' min drive',{
      permanent:false,direction:'center',
      className:'ring-lbl'
    });
    ring.addTo(leafMap);mapPins.push(ring);
  });

  // Spot markers
  spots.forEach(function(s,i){
    var col=pinColor(s,i);
    var baseRad=6+Math.round((s.score/maxScore)*10);
    var rad=Math.min(18,baseRad);
    var opacity=i===0?0.95:Math.max(0.60,0.88-(i*0.008));
    var m=L.circleMarker([s.lat,s.lng],{
      radius:rad,fillColor:col,
      color:'rgba(255,255,255,.5)',weight:i===0?2.5:1.5,
      fillOpacity:opacity
    });
    m.bindPopup(buildPopup(s,i));
    m.addTo(leafMap);mapPins.push(m);
  });
}

function flyTo(lat,lng){
  showTab('map');
  setTimeout(function(){if(leafMap)leafMap.flyTo([lat,lng],13,{duration:.9});},55);
}

function navTo(lat,lng){
  var isAndroid=/Android/i.test(navigator.userAgent);
  var url=isAndroid
    ?'https://www.google.com/maps/dir/?api=1&destination='+lat+','+lng+'&travelmode=driving'
    :'https://maps.apple.com/?daddr='+lat+','+lng+'&dirflg=d';
  window.open(url,'_blank');
}

// ── GPX EXPORT ──
function exportGPX(){
  if(!spots.length){toast('Scan first to export',2000);return;}
  var gpx='<?xml version="1.0" encoding="UTF-8"?>'
    +'<gpx version="1.1" creator="FieldScope">'
    +'<metadata><name>FieldScope — '+currentActivity+'</name></metadata>';
  spots.forEach(function(s){
    var desc=s.dist+'km · Score '+s.score;
    if(currentActivity==='birding'&&s.spCnt) desc+=' · '+s.spCnt+' species';
    if(currentActivity==='fishing'&&s.fishSpecies) desc+=' · '+(s.fishSpecies.slice(0,2).join(', '));
    if(currentActivity==='hiking'&&s.lengthKm) desc+=' · '+s.lengthKm+'km trail';
    gpx+='<wpt lat="'+s.lat+'" lon="'+s.lng+'">'
      +'<name>'+s.name.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</name>'
      +'<desc>'+desc+'</desc>'
      +'</wpt>';
  });
  gpx+='</gpx>';
  var blob=new Blob([gpx],{type:'application/gpx+xml'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;
  a.download='fieldscope-'+currentActivity+'.gpx';
  a.click();
  setTimeout(function(){URL.revokeObjectURL(url);},2000);
  toast('GPX exported — import to Gaia GPS or Maps.me',3000);
}
