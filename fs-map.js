// ═══════════════════════════════════════
//  MAP
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

function updateMap(){
  if(!leafMap)return;
  mapPins.forEach(m=>m.remove());mapPins=[];

  const maxScore=spots.length>0?spots[0].score:100;

  const userPin=L.circleMarker([userLat,userLng],{
    radius:5,fillColor:'#ffffff',color:'rgba(255,255,255,.5)',
    weight:6,fillOpacity:1
  });
  userPin.bindPopup('<div class="p-name">Your Location</div>');
  userPin.addTo(leafMap);mapPins.push(userPin);

  spots.forEach((s,i)=>{
    const isR=s.rareCnt>0;
    const col=isR?'#e06c6c':i===0?'#f4b942':'#5cb85c';
    const baseRad=6+Math.round((s.score/maxScore)*10);
    const rad=isR?Math.min(16,baseRad+2):baseRad;
    const opacity=i===0?0.95:Math.max(0.65,0.9-(i*0.01));
    const m=L.circleMarker([s.lat,s.lng],{
      radius:rad,fillColor:col,
      color:'rgba(255,255,255,.4)',weight:i===0?2:1.5,
      fillOpacity:opacity
    });
    m.bindPopup(
      '<div class="p-name">'+s.name+'</div>'
      +'<div class="p-score">'+s.score+'<span style="font-size:11px;color:var(--muted);font-family:Outfit"> / 100</span></div>'
      +'<div class="p-meta">'
      +'<i class="ti ti-location"></i> '+s.dist+'km · '
      +'<i class="ti ti-car"></i> '+driveTxt(s.dist)+' · '
      +'<i class="ti ti-feather"></i> '+s.spCnt+' sp.'
      +(isR?' · <i class="ti ti-zap"></i> '+s.rareCnt+' rare':'')
      +'</div>'
      +'<button class="p-go" onclick="navTo('+s.lat+','+s.lng+')">'
      +'<i class="ti ti-navigation"></i> Get Directions</button>'
    );
    m.addTo(leafMap);mapPins.push(m);
  });
}

function flyTo(lat,lng){
  showTab('map');
  setTimeout(()=>{if(leafMap)leafMap.flyTo([lat,lng],13,{duration:.9});},55);
}

function navTo(lat,lng){
  var isAndroid=/Android/i.test(navigator.userAgent);
  var url=isAndroid
    ?'https://www.google.com/maps/dir/?api=1&destination='+lat+','+lng+'&travelmode=driving'
    :'https://maps.apple.com/?daddr='+lat+','+lng+'&dirflg=d';
  window.open(url,'_blank');
}
