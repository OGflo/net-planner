/* Net Planner — topology map with live status (NetMap-style) and NetMap import. */
const MW=172,MH=54;
const ICONS={
  internet:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  firewall:'<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19"/>',
  router:'<circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8M9 9l-2-2M15 15l2 2"/>',
  switch:'<rect x="2.5" y="7" width="19" height="10" rx="1.5"/><path d="M6 11h1.5M9.5 11H11M13 11h1.5M16.5 11H18M6 13.8h12"/>',
  server:'<rect x="4" y="3.5" width="16" height="7" rx="1"/><rect x="4" y="13.5" width="16" height="7" rx="1"/><path d="M7.5 7h.01M7.5 17h.01M11 7h6M11 17h6"/>',
  vm:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  storage:'<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
  ap:'<path d="M5 9.5a10 10 0 0 1 14 0M7.8 12.4a6 6 0 0 1 8.4 0M10.6 15.2a2 2 0 0 1 2.8 0"/><circle cx="12" cy="18" r="1"/>',
  camera:'<rect x="3" y="7" width="13" height="10" rx="1.5"/><path d="M16 10.5l5-3v9l-5-3"/>',
  iot:'<path d="M4 11l8-6.5 8 6.5M6.5 9.5V19h11V9.5"/><circle cx="12" cy="14" r="2"/>',
  pc:'<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>',
  phone:'<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
  ups:'<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M12.8 7.5l-2.6 4.5h3.6l-2.6 4.5"/>',
  pdu:'<rect x="9" y="2.5" width="6" height="19" rx="1"/><path d="M12 6v.01M12 10v.01M12 14v.01M12 18v.01"/>',
  'patch-panel':'<rect x="2.5" y="8" width="19" height="8" rx="1"/><path d="M6 12h.01M9 12h.01M12 12h.01M15 12h.01M18 12h.01"/>',
  other:'<circle cx="12" cy="12" r="8"/><path d="M8.5 12h7"/>'
};
const TIER={internet:0,firewall:1,router:1,switch:2,'patch-panel':2,server:3,storage:3,ups:4,pdu:4,ap:4,camera:5,iot:5,pc:5,phone:5,other:4,vm:6};
let MAP={sel:null,connect:false,pendingA:null,focus:null,showVms:true};

function mapNodes(){
  const nodes=S.devices.map(d=>({id:d.id,kind:'devices',it:d,type:d.type,name:d.name,sub:d.mgmtIp||d.role||d.model||d.type,vlan:d.mgmtVlan}));
  if(UI.mapVms!==false)S.vms.forEach(v=>nodes.push({id:v.id,kind:'vms',it:v,type:'vm',name:v.name,sub:v.ip||(v.kind||'vm'),vlan:v.vlan}));
  // auto-place anything without a position, tier by tier
  const tiers={};nodes.filter(n=>n.it.x==null||n.it.y==null).forEach(n=>(tiers[TIER[n.type]??4]=tiers[TIER[n.type]??4]||[]).push(n));
  Object.entries(tiers).forEach(([t,list])=>{const used=nodes.filter(n=>n.it.x!=null&&(TIER[n.type]??4)==t).length;list.forEach((n,i)=>{n.it.x=(used+i)*200-((used+list.length-1)*100);n.it.y=+t*120})});
  return nodes;
}
function mapLinks(nodes){
  const ids=new Set(nodes.map(n=>n.id));const out=[];const pair=new Set();
  const key=(a,b)=>[a,b].sort().join('|');
  S.links.forEach(l=>{if(ids.has(l.a)&&ids.has(l.b)){out.push(Object.assign({src:'link'},l));pair.add(key(l.a,l.b))}});
  S.ports.forEach(p=>{if(!p.connectedTo||!ids.has(p.switchId)||!ids.has(p.connectedTo)||pair.has(key(p.switchId,p.connectedTo)))return;
    const sw=dev(p.switchId);pair.add(key(p.switchId,p.connectedTo));
    out.push({id:'port-'+p.id,src:'port',portId:p.id,a:p.switchId,b:p.connectedTo,kind:p.mode==='trunk'?'trunk':p.mode==='disabled'?'other':'access',aPort:sw?ifName(sw,p.port):'',bPort:p.remotePort||'',vlans:p.mode==='trunk'?(p.allowed||'all'):String(p.vlan||'')})});
  if(UI.mapVms!==false)S.vms.forEach(v=>{if(v.hostId&&ids.has(v.hostId)&&!pair.has(key(v.id,v.hostId)))out.push({id:'vm-'+v.id,src:'vm',a:v.hostId,b:v.id,kind:'virtual',vlans:String(v.vlan||'')})});
  return out;
}
function linkCarries(l,v){const s=String(l.vlans||'').trim().toLowerCase();if(s==='all')return true;if(s)return parseVlanList(s).has(+v);return false}
function nodeInVlan(n,v,links){if(+n.vlan===+v)return true;return links.some(l=>(l.a===n.id||l.b===n.id)&&linkCarries(l,v))}
const mstate=n=>{const l=liveOf(n.it);return l?l.state:'pending'};
const trunc=(s,n)=>{s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s};

function viewMap(){
  return `<div class="row"><h2>Map</h2><span class="muted small">Drag devices to arrange · scroll or pinch to zoom · drag empty space to pan</span><span class="spacer"></span>
    <label class="small"><input type="checkbox" data-act="mapvms" ${UI.mapVms!==false?'checked':''}> show VMs</label>
    <button class="btn ${MAP.connect?'pri':''}" data-act="mapconnect">${MAP.connect?'Cancel connect':'Connect'}</button>
    <button class="btn" data-act="checknow">Check now</button>
    <label class="btn" title="Import a map.json exported from NetMap">Import NetMap<input type="file" accept=".json" data-file="plan" hidden></label></div>
  <div class="mapwrap"><div class="stage" id="stage"><svg id="msvg" xmlns="http://www.w3.org/2000/svg">
    <defs><pattern id="mdots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="var(--line)"></circle></pattern>
    <clipPath id="mclip" clipPathUnits="userSpaceOnUse"><rect x="${-MW/2}" y="${-MH/2}" width="${MW}" height="${MH}" rx="7"></rect></clipPath></defs>
    <g id="mworld"><rect x="-6000" y="-6000" width="12000" height="12000" fill="url(#mdots)"></rect><g id="mlinks"></g><path id="mghost" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 4" fill="none"></path><g id="mnodes"></g></g></svg>
    ${MAP.connect?`<div class="maphint">${MAP.pendingA?'Now click the device to connect to':'Click the first device'} · Esc cancels</div>`:''}
    <div class="mapbar"><button class="btn icon" data-act="mapzoom" data-f="1.2">+</button><button class="btn icon" data-act="mapzoom" data-f="0.83">−</button><button class="btn icon" data-act="mapfit">Fit</button><button class="btn icon" data-act="maparrange">Auto-arrange</button></div></div>
    <aside class="mside" id="mside"></aside></div>`;
}
function drawMap(){
  const nodes=mapNodes(),links=mapLinks(nodes),byId=Object.fromEntries(nodes.map(n=>[n.id,n]));
  const f=MAP.focus;
  let ls='';
  for(const l of links){const a=byId[l.a],b=byId[l.b];if(!a||!b)continue;
    const A=a.it,B=b.it,d=`M${A.x},${A.y}L${B.x},${B.y}`;
    let color='var(--muted)';if((l.kind==='access'||l.kind==='wireless')&&l.vlans&&vlanById(l.vlans))color=vlanColor(l.vlans);
    const w={lag:`<path class="w" d="${d}" stroke="${color}" stroke-width="7"/><path d="${d}" stroke="var(--panel)" stroke-width="2.4" fill="none"/>`,trunk:`<path class="w" d="${d}" stroke="${color}" stroke-width="3.4"/>`,
      virtual:`<path class="w" d="${d}" stroke="${color}" stroke-width="1.6" stroke-dasharray="6 5"/>`,wireless:`<path class="w" d="${d}" stroke="${color}" stroke-width="2" stroke-dasharray="1 5"/>`,
      other:`<path class="w" d="${d}" stroke="${color}" stroke-width="1.4" stroke-dasharray="2 4"/>`}[l.kind]||`<path class="w" d="${d}" stroke="${color}" stroke-width="2"/>`;
    const down=mstate(a)==='down'||mstate(b)==='down';const dim=f!=null&&!linkCarries(l,f)&&!(+a.vlan===+f&&+b.vlan===+f);
    ls+=`<g class="mlink${down?' ldown':''}" data-mlink="${esc(l.id)}" style="${dim?'opacity:.15':''}${MAP.sel===l.id?';filter:drop-shadow(0 0 3px var(--accent))':''}"><path class="hit" d="${d}"/>${w}</g>`}
  $('#mlinks').innerHTML=ls;
  let ns='';
  for(const n of nodes){const A=n.it,st=mstate(n),v=vlanById(n.vlan);const dim=f!=null&&!nodeInVlan(n,f,links);
    ns+=`<g class="mnode${MAP.sel===n.id?' sel':''}${st==='down'?' isdown':''}" data-mnode="${n.id}" transform="translate(${A.x},${A.y})" style="${dim?'opacity:.15':''}${MAP.pendingA===n.id?';stroke-dasharray:4 3':''}">
      <rect class="card" x="${-MW/2}" y="${-MH/2}" width="${MW}" height="${MH}" rx="7"/>
      ${v?`<rect x="${-MW/2}" y="${-MH/2}" width="5" height="${MH}" fill="${vlanColor(n.vlan)}" clip-path="url(#mclip)"/>`:''}
      <svg x="${-MW/2+12}" y="-12" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[n.type]||ICONS.other}</svg>
      <text class="nn" x="${-MW/2+46}" y="-3">${esc(trunc(n.name||'Untitled',17))}</text><text class="ns" x="${-MW/2+46}" y="14">${esc(trunc(n.sub,20))}</text>
      ${v?`<text x="${MW/2-8}" y="${MH/2-7}" text-anchor="end" font-size="10" font-family="var(--mono)" fill="${vlanColor(n.vlan)}">${n.vlan}</text>`:''}
      <circle class="mled ${st}" data-mled="${n.id}" cx="${MW/2-11}" cy="${-MH/2+11}" r="5"><title>${esc(lampText(liveOf(n.it)))}</title></circle></g>`}
  $('#mnodes').innerHTML=ns;
  applyMapView();drawMapSide(nodes,links);
}
function paintMapStatus(){document.querySelectorAll('[data-mled]').forEach(c=>{const it=findAny(c.dataset.mled);if(!it)return;const l=liveOf(it);c.setAttribute('class','mled '+(l?l.state:'pending'));const g=c.closest('.mnode');if(g)g.classList.toggle('isdown',l&&l.state==='down')})}
function applyMapView(){const v=UI.mapView||(UI.mapView={x:400,y:80,k:.8});const w=$('#mworld');if(w)w.setAttribute('transform',`translate(${v.x},${v.y}) scale(${v.k})`)}
function drawMapSide(nodes,links){
  const side=$('#mside');if(!side)return;
  const n=nodes.find(x=>x.id===MAP.sel);const l=!n&&links.find(x=>x.id===MAP.sel);
  if(n){const it=n.it,live=liveOf(it),conns=links.filter(x=>x.a===n.id||x.b===n.id);
    side.innerHTML=`<h3>${lamp(it)} ${esc(n.name)}</h3><p class="muted small" style="margin-top:0">${esc(n.kind==='vms'?(it.kind||'vm')+' on '+(refName('devices',it.hostId)||'?'):[it.type,it.role,it.model].filter(Boolean).join(' · '))}</p>
      <div class="small" style="line-height:1.7"><b>Status:</b> ${esc(lampText(live))}<br><b>IP:</b> <span class="mono">${esc(it.mgmtIp||it.ip||'—')}</span><br><b>VLAN:</b> ${esc(n.vlan||'—')} ${esc(vlanById(n.vlan)?.name||'')}
      ${it.rackId?`<br><b>Rack:</b> ${esc(refName('racks',it.rackId))} U${esc(it.uStart||'?')}`:''}${it.check?`<br><b>Check:</b> <span class="mono">${esc(it.check)}</span>`:''}</div>
      <div class="row" style="margin:10px 0"><button class="btn icon pri" data-act="edit" data-kind="${n.kind}" data-id="${n.id}">Edit</button>${n.kind==='devices'?`<button class="btn icon" data-act="mapconnectfrom" data-id="${n.id}">Connect from here</button>`:''}</div>
      <h3 class="small muted">Connections · ${conns.length}</h3>${conns.map(c=>{const o=nodes.find(x=>x.id===(c.a===n.id?c.b:c.a));return `<div class="sugg" data-act="mapsel" data-id="${esc(c.id)}">${esc(o?o.name:'?')} <span class="muted">${esc([c.a===n.id?c.aPort:c.bPort,LINKKINDS[c.kind]?.split(' ')[0],c.src==='port'?'switch port':''].filter(Boolean).join(' · '))}</span></div>`}).join('')||'<p class="muted small">Not connected yet.</p>'}`;
    return}
  if(l){const a=nodes.find(x=>x.id===l.a),b=nodes.find(x=>x.id===l.b);
    side.innerHTML=`<h3>${esc(a?.name)} ↔ ${esc(b?.name)}</h3><p class="muted small">${esc(LINKKINDS[l.kind]||l.kind)}${l.speed?' · '+esc(l.speed):''}</p>
      <div class="small" style="line-height:1.7"><b>Ports:</b> <span class="mono">${esc(l.aPort||'—')} ↔ ${esc(l.bPort||'—')}</span><br><b>VLANs:</b> <span class="mono">${esc(l.vlans||'—')}</span>${l.notes?`<br>${esc(l.notes)}`:''}</div>
      <div class="row" style="margin-top:10px">${l.src==='link'?`<button class="btn icon pri" data-act="edit" data-kind="links" data-id="${l.id}">Edit link</button><button class="btn icon danger" data-act="del" data-kind="links" data-id="${l.id}">Delete</button>`:l.src==='port'?`<button class="btn icon" data-act="mode" data-mode="full" data-tab="ports">Edit on Ports tab</button>`:'<span class="muted small">VM on its host — change the host on the VM.</span>'}</div>`;
    return}
  side.innerHTML=`<h3>VLANs</h3><p class="muted small" style="margin-top:0">◉ highlights every device and trunk that carries a VLAN.</p>
    ${S.vlans.sort((a,b)=>a.vlanId-b.vlanId).map(v=>`<div class="sugg" data-act="mapfocus" data-v="${v.vlanId}" style="${+MAP.focus===+v.vlanId?'border-color:var(--accent)':''}"><span class="dot" style="background:${vlanColor(v.vlanId)}"></span><b>${v.vlanId}</b> ${esc(v.name)} <span class="muted mono">${esc(v.subnet||'')}</span></div>`).join('')||'<p class="muted small">No VLANs yet.</p>'}
    <h3 style="margin-top:14px">Cables</h3><div class="small muted" style="line-height:1.8">Thin = access · thick = trunk · double = LAG · dashed = virtual · dotted = wireless<br>Red cable = a device on it is down. Red lamp pulses when a device stops answering.</div>`;
}
function bindMap(){
  const svg=$('#msvg');if(!svg)return;drawMap();
  let drag=null;const pt=e=>{const r=svg.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}};
  const toW=(p)=>{const v=UI.mapView;return {x:(p.x-v.x)/v.k,y:(p.y-v.y)/v.k}};
  const pointers=new Map();let pinch=null;
  svg.addEventListener('pointerdown',e=>{
    pointers.set(e.pointerId,pt(e));
    if(pointers.size===2){const [p1,p2]=[...pointers.values()];pinch={d:Math.hypot(p1.x-p2.x,p1.y-p2.y),k:UI.mapView.k};drag=null;return}
    const node=e.target.closest('[data-mnode]'),link=e.target.closest('[data-mlink]');
    if(node){const id=node.dataset.mnode;
      if(MAP.connect){if(!MAP.pendingA){MAP.pendingA=id;drawMap();render()}else if(MAP.pendingA!==id){const a=MAP.pendingA;MAP.connect=false;MAP.pendingA=null;
        const l=touch({id:uid(),a,b:id,kind:'access',aPort:'',bPort:'',vlans:'',speed:'',notes:''});S.links.push(l);commit();openForm('links',{...l},saveEntity('links'))}return}
      const it=findAny(id);const w=toW(pt(e));drag={type:'node',id,it,dx:w.x-it.x,dy:w.y-it.y,moved:false};svg.setPointerCapture(e.pointerId);return}
    if(link){MAP.sel=link.dataset.mlink;drawMap();return}
    drag={type:'pan',sx:pt(e).x,sy:pt(e).y,vx:UI.mapView.x,vy:UI.mapView.y,moved:false};svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove',e=>{
    if(pointers.has(e.pointerId))pointers.set(e.pointerId,pt(e));
    if(pinch&&pointers.size===2){const [p1,p2]=[...pointers.values()];const d=Math.hypot(p1.x-p2.x,p1.y-p2.y);zoomMap(pinch.k*d/pinch.d/UI.mapView.k,(p1.x+p2.x)/2,(p1.y+p2.y)/2);return}
    if(!drag)return;const p=pt(e);
    if(drag.type==='node'){const w=toW(p);drag.it.x=Math.round((w.x-drag.dx)/10)*10;drag.it.y=Math.round((w.y-drag.dy)/10)*10;drag.moved=true;drawMap()}
    else{UI.mapView.x=drag.vx+p.x-drag.sx;UI.mapView.y=drag.vy+p.y-drag.sy;drag.moved=Math.abs(p.x-drag.sx)+Math.abs(p.y-drag.sy)>3;applyMapView()}
  });
  const end=e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;if(!drag)return;
    if(drag.type==='node'){if(drag.moved){touch(drag.it);save()}else{MAP.sel=drag.id;drawMap()}}
    else{if(!drag.moved&&MAP.sel){MAP.sel=null;drawMap()}saveUI()}
    drag=null};
  svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
  svg.addEventListener('wheel',e=>{e.preventDefault();const p=pt(e);zoomMap(Math.exp(-e.deltaY*0.0015),p.x,p.y)},{passive:false});
}
function zoomMap(f,sx,sy){const v=UI.mapView;const svg=$('#msvg');if(!svg)return;const r=svg.getBoundingClientRect();if(sx==null){sx=r.width/2;sy=r.height/2}
  const k=Math.min(2.5,Math.max(.15,v.k*f));const wx=(sx-v.x)/v.k,wy=(sy-v.y)/v.k;v.k=k;v.x=sx-wx*k;v.y=sy-wy*k;applyMapView()}
function fitMap(){const nodes=mapNodes();const svg=$('#msvg');if(!svg||!nodes.length)return;const r=svg.getBoundingClientRect();
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;nodes.forEach(n=>{x0=Math.min(x0,n.it.x-MW/2);x1=Math.max(x1,n.it.x+MW/2);y0=Math.min(y0,n.it.y-MH/2);y1=Math.max(y1,n.it.y+MH/2)});
  const k=Math.max(.15,Math.min((r.width-60)/(x1-x0),(r.height-60)/(y1-y0),1.3));UI.mapView={k,x:(r.width-(x1-x0)*k)/2-x0*k,y:(r.height-(y1-y0)*k)/2-y0*k};applyMapView();saveUI()}
ACT.mapzoom=a=>{zoomMap(+a.dataset.f);saveUI()};
ACT.mapfit=()=>fitMap();
ACT.maparrange=()=>{if(!confirm('Re-arrange every device by type? (Your hand-placed positions are replaced.)'))return;[...S.devices,...S.vms].forEach(x=>{delete x.x;delete x.y});mapNodes();save();drawMap();setTimeout(fitMap,30)};
ACT.mapconnect=()=>{MAP.connect=!MAP.connect;MAP.pendingA=null;render()};
ACT.mapconnectfrom=a=>{MAP.connect=true;MAP.pendingA=a.dataset.id;render()};
ACT.mapsel=a=>{MAP.sel=a.dataset.id;drawMap()};
ACT.mapfocus=a=>{MAP.focus=+MAP.focus===+a.dataset.v?null:+a.dataset.v;drawMap()};
ACT.mapvms=a=>{UI.mapVms=a.checked;saveUI();render()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&MAP.connect){MAP.connect=false;MAP.pendingA=null;render()}});

/* ============ NetMap import (map.json from NetMap's Export) ============ */
function importNetmap(j){
  const nodes=j.nodes||[],links=j.links||[],vlans=j.vlans||[];
  openModal(`<h3>Import NetMap</h3><p>${nodes.length} devices · ${links.length} connections · ${vlans.length} VLANs</p>
    <p class="muted small">Devices and VLANs are matched by name/ID: existing ones are updated, new ones added. Map positions, health checks (ping / tcp:PORT) and "placement not confirmed" come across. VMs linked to a server as <i>virtual</i> become VMs on that host.</p>
    <div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn" data-act="close">Cancel</button><button class="btn pri" id="nmGo">Import</button></div>`);
  $('#nmGo').onclick=()=>{closeModal();doImportNetmap(nodes,links,vlans)};
}
function doImportNetmap(nodes,links,vlans){
  const typeMap={nas:'storage',vm:'vm'};
  vlans.forEach(v=>{if(v.id==null)return;let x=S.vlans.find(y=>+y.vlanId===+v.id);if(!x){x={id:uid(),vlanId:+v.id,name:v.name||'VLAN '+v.id,subnet:'',gateway:'',notes:''};S.vlans.push(x)}
    Object.assign(x,{name:v.name||x.name,subnet:v.subnet||x.subnet,color:v.color||x.color});touch(x)});
  const idMap={};const vmNodes=new Set(nodes.filter(n=>n.type==='vm').map(n=>n.id));
  const hostOf={};links.forEach(l=>{if(l.kind==='virtual'){if(vmNodes.has(l.b)&&!vmNodes.has(l.a))hostOf[l.b]=l.a;else if(vmNodes.has(l.a)&&!vmNodes.has(l.b))hostOf[l.a]=l.b}});
  nodes.filter(n=>n.type!=='vm').forEach(n=>{
    let d=S.devices.find(x=>String(x.name).toLowerCase()===String(n.name||'').toLowerCase());
    if(!d){d={id:uid(),name:n.name||'Device',uSize:1};S.devices.push(d)}
    Object.assign(d,{type:typeMap[n.type]||n.type||'other',model:n.model||d.model||'',mgmtIp:n.ip||d.mgmtIp||'',mgmtVlan:n.vlan===''||n.vlan==null?(d.mgmtVlan||''):+n.vlan,
      notes:n.notes||d.notes||'',x:n.x,y:n.y,check:n.check||d.check||'',status:n.unverified?'planned':(d.status||'live')});
    if(!TYPES.includes(d.type))d.type='other';
    const k=KB.lookup(n.model||'');if(k&&k.confidence!=='partial'&&!d.kbId){Object.assign(d,Object.fromEntries(Object.entries(kbToDevice(k,d)).filter(([key])=>!['type','model','notes'].includes(key)||!d[key])))}
    touch(d);idMap[n.id]=d.id});
  nodes.filter(n=>n.type==='vm').forEach(n=>{
    let v=S.vms.find(x=>String(x.name).toLowerCase()===String(n.name||'').toLowerCase());
    if(!v){v={id:uid(),name:n.name||'VM',kind:'vm',status:'live'};S.vms.push(v)}
    const sv=KB.service(n.name);
    Object.assign(v,{ip:n.ip||v.ip||'',vlan:n.vlan===''||n.vlan==null?(v.vlan||''):+n.vlan,notes:[n.model,n.notes].filter(Boolean).join(' · ')||v.notes||'',x:n.x,y:n.y,check:n.check||v.check||(sv?'tcp:'+sv.port:''),hostId:idMap[hostOf[n.id]]||v.hostId||''});
    touch(v);idMap[n.id]=v.id});
  links.forEach(l=>{if(l.kind==='virtual'&&(vmNodes.has(l.a)||vmNodes.has(l.b)))return;const a=idMap[l.a],b=idMap[l.b];if(!a||!b)return;
    let x=S.links.find(y=>(y.a===a&&y.b===b)||(y.a===b&&y.b===a));if(!x){x={id:uid(),a,b};S.links.push(x)}
    Object.assign(x,{kind:l.kind||'access',aPort:l.aPort||'',bPort:l.bPort||'',vlans:String(l.vlans??''),speed:l.speed||'',notes:l.notes||''});touch(x)});
  commit();UI.tab='map';UI.mode='full';render();setTimeout(fitMap,50);
  toast(`Imported ${nodes.length} devices and ${links.length} connections from NetMap`);
}
