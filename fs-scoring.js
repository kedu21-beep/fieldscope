// ═══════════════════════════════════════
//  SCORING
// ═══════════════════════════════════════

const COMMON_SP=new Set([
  'American Crow','American Robin','Black-capped Chickadee',
  'Blue Jay','Canada Goose','Common Grackle','Common Raven',
  'Dark-eyed Junco','European Starling','House Finch',
  'House Sparrow','Mallard','Mourning Dove','Northern Cardinal',
  'Red-winged Blackbird','Rock Pigeon','Song Sparrow',
  'White-breasted Nuthatch','White-throated Sparrow',
  'Downy Woodpecker','Hairy Woodpecker','American Goldfinch',
  'Cedar Waxwing','Tree Swallow','Common Yellowthroat',
]);

function p90(values){
  if(!values.length)return 60;
  const sorted=[...values].sort((a,b)=>a-b);
  const idx=Math.floor(sorted.length*0.9);
  return sorted[Math.min(idx,sorted.length-1)];
}

function processAndScore(obs,notable,maxKm,backDays){
  const lim=maxKm||MAX_KM;
  const back=backDays||7;
  const now=Date.now();
  const H7 =7 *24*3600000;
  const H14=14*24*3600000;
  const H24=24*3600000;
  const H48=48*3600000;
  const H30=30*24*3600000;
  const map=new Map();

  function add(item,isRare){
    if(!item?.lat||!item?.lng||!item?.locId)return;
    const d=km(userLat,userLng,item.lat,item.lng);
    if(d>lim)return;
    if(!map.has(item.locId))map.set(item.locId,{
      id:item.locId,name:item.locName||item.locId,
      lat:item.lat,lng:item.lng,dist:Math.round(d*10)/10,
      species:new Set(),rare:new Set(),recent:[],
      checklists:new Map(),
    });
    const loc=map.get(item.locId);
    if(item.comName){loc.species.add(item.comName);if(isRare)loc.rare.add(item.comName);loc.recent.push(item.comName);}
    if(item.subId&&item.obsDt){
      const t=new Date(item.obsDt.replace(' ','T')).getTime();
      if(!isNaN(t)){
        const prev=loc.checklists.get(item.subId)||0;
        if(t>prev)loc.checklists.set(item.subId,t);
      }
    } else if(item.subId){
      if(!loc.checklists.has(item.subId))loc.checklists.set(item.subId,0);
    }
  }

  (Array.isArray(obs)?obs:[]).forEach(o=>add(o,false));
  (Array.isArray(notable)?notable:[]).forEach(n=>add(n,true));

  const allLocs=Array.from(map.values());
  const spCounts=allLocs.map(l=>l.species.size);
  const spNorm=Math.max(15,p90(spCounts));
  log('info','Species norm ceiling: '+spNorm+' (p90 of '+allLocs.length+' locations)');

  const driveMaxMin=driveMin(lim);

  return allLocs.map(loc=>{
    const spCnt=loc.species.size,rareCnt=loc.rare.size;
    const totalChecklists=Math.max(1,loc.checklists.size);

    const locDriveMin=driveMin(loc.dist);
    const sP=Math.round(Math.max(0,(1-locDriveMin/driveMaxMin)*40));

    const effSpCnt=[...loc.species].reduce((acc,sp)=>acc+(COMMON_SP.has(sp)?0.5:1.0),0);
    const sQ=Math.round(Math.min(35,(effSpCnt/spNorm)*35));

    const concentration=Math.min(1,10/totalChecklists);
    const rareMult=0.7+(concentration*0.3);
    const sR=Math.round(Math.min(25,rareCnt*8*rareMult));

    const timestamps=[...loc.checklists.values()];
    const latestTs=timestamps.length>0?Math.max(...timestamps):0;
    const recent24=timestamps.filter(t=>t>0&&(now-t)<=H24).length;
    const recent48=timestamps.filter(t=>t>0&&(now-t)>H24&&(now-t)<=H48).length;
    const raw24=Math.min(5,recent24);
    const raw48=Math.min(3,recent48*0.5);
    const sRec=Math.min(5,Math.round(raw24>0?raw24:raw48));

    let sMom=0,momentumLabel='';
    if(back>=14){
      const w1=timestamps.filter(t=>t>0&&(now-t)<=H7).length;
      const w2=timestamps.filter(t=>t>0&&(now-t)>H7&&(now-t)<=H14).length;
      const w3=back>=30?timestamps.filter(t=>t>0&&(now-t)>H14&&(now-t)<=H30).length/2:0;
      const baseline=back>=30?(w2+w3)/2:w2;
      const trend=w1-baseline;
      const raw=trend===0?0:Math.sign(trend)*Math.min(5,Math.sqrt(Math.abs(trend)*2.5));
      sMom=Math.round(raw);
      if(sMom>=2)momentumLabel='▲ Heating up';
      else if(sMom===1)momentumLabel='↑ Picking up';
      else if(sMom<=-2)momentumLabel='▼ Slowing down';
      else if(sMom===-1)momentumLabel='↓ Quieting';
    }

    const seen=new Set(),top=[];
    for(const n of loc.recent){if(!seen.has(n)){seen.add(n);top.push(n);}if(top.length>=6)break;}

    const ageH=latestTs>0?Math.round((now-latestTs)/3600000):999;

    return {id:loc.id,name:loc.name,lat:loc.lat,lng:loc.lng,dist:loc.dist,driveMin:locDriveMin,
      score:sP+sQ+sR+sRec+sMom,sP,sQ,sR,sRec,sMom,momentumLabel,ageH,
      recent24,recent48,
      spCnt,effSpCnt:Math.round(effSpCnt*10)/10,rareCnt,totalChecklists,spNorm,
      concentration:Math.round(concentration*100),
      rare:[...loc.rare],topSp:top};
  }).sort((a,b)=>b.score-a.score);
}
