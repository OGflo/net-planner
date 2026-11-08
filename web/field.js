/* Net Planner — Field mode: the iPhone at the rack.
   Big buttons: Scan a label · Walk a rack · Find anything · Live status · More.
   Everything saves instantly and, when linked, shows up on the Mac within seconds. */
const FTABS=[['scan','Scan','📷'],['racks','Racks','🗄'],['find','Find','🔎'],['status','Status','●'],['more','More','⋯']];
let FSCAN=null; // last scan result {raw, parsed, matches, ctx}

function viewField(){
  UI.field=UI.field||{};const t=UI.field.tab||'scan';
  const body={scan:fieldScanView,racks:fieldRacksView,find:fieldFindView,status:fieldStatusView,more:fieldMoreView,help:()=>`<button class="bigbtn alt" data-act="ftab" data-t="more">‹ Back to More</button>${helpHtml()}`}[t]||fieldScanView;
  const title={scan:'Scan & add',racks:'Walk a rack',find:'Find',status:'Live status',more:'More',help:'How to use'}[t];
  return `<div class="fwrap"><div class="ftop"><h1>${title}</h1><span id="fsync"></span></div>${body()}</div>
  <nav class="fbar">${FTABS.map(([k,l,i])=>`<button class="${t===k||(t==='help'&&k==='more')?'on':''}" data-act="ftab" data-t="${k}"><i>${i}</i>${l}</button>`).join('')}</nav>`;
}
function afterField(){const q=$('#fq');if(q&&UI.field.focus){q.focus();UI.field.focus=false}}
ACT.ftab=a=>{UI.field.tab=a.dataset.t;saveUI();render();scrollTo(0,0)};

/* ---------- Scan ---------- */
function scanResultHtml(){
  let res='';
  if(FSCAN){const p=FSCAN.parsed;const kb=p.models.find(m=>m.kb);const e=kb&&(KB.byId(kb.kb)||KB.lookup(kb.text));
    res=`<div class="fcard"><h3>Found on the label</h3>
      ${e?`<div style="margin:6px 0"><b>${esc(e.vendor)} ${esc(e.model)}</b><br><span class="muted small">${esc(e.type)}${e.u?` · ${e.u}U`:e.u===0?' · not rack-mounted':''}${e.ports?` · ${e.ports} ports`:''}${e.mgmt?' · '+esc(e.mgmt):''}${e.check?' · check '+esc(e.check):''}</span></div>`:''}
      ${p.serials.length?`<div class="small"><b>Serial:</b> <span class="mono">${p.serials.map(esc).join(', ')}</span></div>`:''}
      ${p.macs.length?`<div class="small"><b>MAC:</b> ${p.macs.map(m=>`<span class="mono">${esc(m)}</span> <span class="muted">${esc(KB.macVendor(m))}</span>`).join('<br>')}</div>`:''}
      ${p.ips.length?`<div class="small"><b>IP:</b> <span class="mono">${p.ips.map(esc).join(', ')}</span></div>`:''}
      ${p.assetTags.length?`<div class="small"><b>Asset tag:</b> ${p.assetTags.map(esc).join(', ')}</div>`:''}
      ${!e&&!p.serials.length&&!p.macs.length&&!p.ips.length?`<div class="small muted">Nothing recognised. Text: ${esc(p.raw.slice(0,6).join(' · '))}</div>`:''}
      ${FSCAN.ctx&&FSCAN.ctx.rackId?`<div class="small" style="margin-top:6px">📍 Going into <b>${esc(refName('racks',FSCAN.ctx.rackId))}</b> at U${FSCAN.ctx.u}</div>`:''}
    </div>
    ${FSCAN.matches.length?`<div class="fcard"><h3>Already in your plan</h3><div class="flist">${FSCAN.matches.map(m=>`<div class="fi" data-act="fscanupd" data-id="${m.it.id}">${lamp(m.it)}<div><b>${esc(m.it.name)}</b><span>matched by ${esc(m.why)} — tap to update it with what was scanned</span></div></div>`).join('')}</div></div>`:''}
    <button class="bigbtn" data-act="fscanadd">＋ Add as new device</button>
    <button class="bigbtn alt" data-act="fscanclear">Clear</button>`;}
  return res;
}
function fieldScanView(){
  const canCam=!!window.nativeScan;
  const res=scanResultHtml();
  return `${canCam?`<button class="bigbtn" data-act="fscan">📷 Scan a label or barcode</button>`:`<div class="fcard small muted">Camera scanning works in the Net Planner app. Here you can type or paste what the label says.</div>`}
    <div class="fcard"><h3>Or type it</h3><div class="row"><input id="ftype" placeholder="model, serial, MAC…  e.g. R740 or 2960X-48LPS" style="flex:1;font-size:16px" autocapitalize="off" autocorrect="off"><button class="btn pri" data-act="ftyped">Go</button></div>
      <div class="kbsug" id="fkb"></div></div>
    ${res}
    <div class="fcard small muted">Tip: on the Racks tab, tap an empty U to scan straight into that slot.</div>`;
}
async function fieldScan(ctx){
  let raw=null;
  if(window.nativeScan)raw=await nativeScan();
  else{const t=prompt('Type or paste the label text:');raw=t?[t]:null}
  if(!raw)return;
  showScan(raw,ctx);
}
function showScan(raw,ctx){
  const p=KB.parseScan(raw);const matches=[];const add=(it,why)=>{if(it&&!matches.some(m=>m.it.id===it.id))matches.push({it,why})};
  const U=s=>String(s||'').toUpperCase();
  [...S.devices,...S.vms].forEach(it=>{
    if(it.serial&&p.serials.includes(U(it.serial)))add(it,'serial');
    if(it.mac&&p.macs.includes(U(it.mac)))add(it,'MAC');
    if(it.assetTag&&p.assetTags.includes(U(it.assetTag)))add(it,'asset tag');
    const ip=String(it.mgmtIp||it.ip||'').trim();if(ip&&p.ips.includes(ip))add(it,'IP');
  });
  FSCAN={raw,parsed:p,matches,ctx:ctx||null};UI.mode='field';UI.field.tab='scan';render();scrollTo(0,0);
}
function scanDraft(){
  const d={type:'server',uSize:1,status:'installed'};
  applyScanToDraft('devices',d,FSCAN.raw);
  if(FSCAN.ctx&&FSCAN.ctx.rackId){d.rackId=FSCAN.ctx.rackId;d.uStart=Math.max(1,FSCAN.ctx.u-(+d.uSize||1)+1)}
  if(!d.name){const p=FSCAN.parsed;d.name=d.model||p.serials[0]||'New device'}
  if(d.mgmtIp&&!d.mgmtVlan){const v=vlanByIp(d.mgmtIp);if(v)d.mgmtVlan=v.vlanId}
  return d;
}
ACT.fscan=()=>fieldScan(null);
ACT.fscanclear=()=>{FSCAN=null;render()};
ACT.fscanadd=()=>{const d=scanDraft();openForm('devices',d,x=>{const r=saveEntity('devices')(x);if(!r){FSCAN=null}return r})};
ACT.fscanupd=a=>{
  const it=findAny(a.dataset.id);if(!it)return;const kind=S.vms.includes(it)?'vms':'devices';
  const d=Object.assign({},it);const before=JSON.stringify(d);applyScanToDraft(kind,d,FSCAN.raw);
  if(FSCAN.ctx&&FSCAN.ctx.rackId&&kind==='devices'){d.rackId=FSCAN.ctx.rackId;d.uStart=Math.max(1,FSCAN.ctx.u-(+d.uSize||1)+1)}
  openForm(kind,d,x=>{const r=saveEntity(kind)(x);if(!r)FSCAN=null;return r},{title:'Update '+it.name+(before===JSON.stringify(d)?'':' (scanned info filled in)')});
};
ACT.ftyped=()=>{const v=($('#ftype')||{}).value||'';if(v.trim())showScan([v.trim()],FSCAN&&FSCAN.ctx)};
document.addEventListener('input',e=>{
  if(e.target.id==='ftype'){const box=$('#fkb');const list=KB.search(e.target.value,5);
    box.innerHTML=list.map((k,i)=>`<button type="button" class="sugg" data-act="fkbpick" data-i="${i}"><b>${esc(k.vendor)} ${esc(k.model)}</b> <span class="muted">${esc(k.type)}${k.u?` · ${k.u}U`:''}${k.ports?` · ${k.ports} ports`:''}</span></button>`).join('');
    box._list=list}
  if(e.target.id==='fq'){UI.field.q=e.target.value;const r=$('#fres');if(r)r.innerHTML=fieldFindResults()}
});
ACT.fkbpick=a=>{const k=$('#fkb')._list[+a.dataset.i];const d=Object.assign({uSize:1,status:'installed'},kbToDevice(k,{}));d.name=k.model;
  if(FSCAN&&FSCAN.ctx&&FSCAN.ctx.rackId){d.rackId=FSCAN.ctx.rackId;d.uStart=Math.max(1,FSCAN.ctx.u-(+d.uSize||1)+1)}
  openForm('devices',d,saveEntity('devices'))};

/* ---------- Racks ---------- */
function fieldRacksView(){
  if(!S.racks.length)return `<div class="fcard empty">No racks yet.<br><br><button class="btn pri" data-act="add" data-kind="racks">+ Add a rack</button></div>`;
  if(!S.racks.some(r=>r.id===UI.field.rack))UI.field.rack=S.racks[0].id;
  const r=rack(UI.field.rack);const ds=S.devices.filter(d=>d.rackId===r.id&&+d.uStart>0);
  const down=ds.filter(d=>(liveOf(d)||{}).state==='down');
  return `<div class="chips">${S.racks.map(x=>`<button class="chipbtn ${x.id===r.id?'on':''}" data-act="frack" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div>
    <div class="fcard small"><b>${esc(r.name)}</b> ${esc(r.location||'')} · ${ds.reduce((a,d)=>a+(+d.uSize||1),0)}/${r.units}U used${down.length?` · <span style="color:var(--bad)">${down.length} down</span>`:''}<br><span class="muted">Tap a device for details · tap an empty U to ${window.nativeScan?'scan and ':''}add a device there</span></div>
    <div class="frack">${rackHtml(r)}</div>`;
}
ACT.frack=a=>{UI.field.rack=a.dataset.id;saveUI();render()};

/* ---------- Find ---------- */
function fieldFindView(){
  return `<input id="fq" class="fsearch" placeholder="Name, IP, MAC, serial, model, VLAN…" value="${esc(UI.field.q||'')}" autocapitalize="off" autocorrect="off">
    <div class="fcard flist" id="fres">${fieldFindResults()}</div>`;
}
function fieldFindResults(){
  const q=String(UI.field.q||'').trim().toLowerCase();
  const all=[...S.devices.map(d=>({k:'devices',it:d,sub:[d.mgmtIp,d.role||d.model,d.rackId?refName('racks',d.rackId)+' U'+(d.uStart||'?'):''].filter(Boolean).join(' · ')})),
    ...S.vms.map(v=>({k:'vms',it:v,sub:[v.ip,(v.kind||'vm')+(v.hostId?' on '+refName('devices',v.hostId):'')].filter(Boolean).join(' · ')})),
    ...S.storage.filter(x=>x.kind==='pool'||x.kind==='share').map(x=>({k:'storage',it:x,sub:[x.kind,x.layout,x.path].filter(Boolean).join(' · ')}))];
  const hay=x=>[x.it.name,x.it.mgmtIp,x.it.ip,x.it.mac,x.it.serial,x.it.model,x.it.role,x.it.make,x.it.assetTag,x.it.location,x.it.vlan,x.it.mgmtVlan,x.sub].join(' ').toLowerCase();
  const list=(q?all.filter(x=>hay(x).includes(q)):all).sort((a,b)=>{const o={down:0,pending:1,up:2,off:3,none:4};return (o[(liveOf(a.it)||{}).state||'pending']??1)-(o[(liveOf(b.it)||{}).state||'pending']??1)||String(a.it.name).localeCompare(b.it.name)}).slice(0,80);
  return list.map(x=>`<div class="fi" data-act="fopen" data-kind="${x.k}" data-id="${x.it.id}">${lamp(x.it)}<div style="min-width:0"><b>${esc(x.it.name)}</b><span>${esc(x.sub)}</span></div></div>`).join('')||'<div class="muted small">Nothing matches.</div>';
}
ACT.fopen=a=>fieldDetail(a.dataset.kind,a.dataset.id);
function fieldDetailHtml(kind,id,inPane){
  const it=S[kind]&&S[kind].find(x=>x.id===id);if(!it)return '<p class="muted">That item no longer exists.</p>';const l=liveOf(it);
  const ports=kind==='devices'?S.ports.filter(p=>p.connectedTo===it.id||p.switchId===it.id&&p.connectedTo):[];
  const rows=[['Status',lampText(l)],['IP',it.mgmtIp||it.ip],['MAC',it.mac&&(it.mac+' '+(KB.macVendor(it.mac)?'('+KB.macVendor(it.mac)+')':''))],['Model',[it.make,it.model].filter(Boolean).join(' ')],['Role',it.role],['Serial',it.serial],
    ['Rack',it.rackId&&`${refName('racks',it.rackId)} · U${it.uStart}${+it.uSize>1?'–'+(+it.uStart+ +it.uSize-1):''}`],['Host',it.hostId&&refName('devices',it.hostId)],['VLAN',(it.mgmtVlan||it.vlan)&&`${it.mgmtVlan||it.vlan} ${vlanById(it.mgmtVlan||it.vlan)?.name||''}`],
    ['Check',it.check],['OS',it.os],['CPU',it.cpu],['Location',it.location],['Connects via',it.protocol]].filter(r=>r[1]);
  return `<h3>${lamp(it)} ${esc(it.name)}</h3>
    <div class="small" style="line-height:1.8">${rows.map(([k,v])=>`<b>${k}:</b> <span class="${/IP|MAC|Serial|Check/.test(k)?'mono':''}">${esc(v)}</span>`).join('<br>')}</div>
    ${ports.length?`<h3 style="margin-top:12px">Cabling</h3><div class="small">${ports.map(p=>{const sw=dev(p.switchId);return p.switchId===it.id?`${esc(ifName(it,p.port))} → ${esc(refName('devices',p.connectedTo))} ${esc(p.remotePort||'')}`:`${esc(p.remotePort||'port')} → ${esc(sw?sw.name:'?')} ${esc(sw?ifName(sw,p.port):'')}`}).join('<br>')}</div>`:''}
    ${it.notes?`<p class="small muted" style="white-space:pre-wrap">${esc(it.notes)}</p>`:''}
    <div class="row" style="margin-top:12px">${window.nativeScan&&kind!=='storage'?`<button class="btn" data-act="fdscan" data-kind="${kind}" data-id="${it.id}">📷 Scan into this</button>`:''}<span class="spacer"></span>${inPane?'':'<button class="btn" data-act="close">Close</button>'}<button class="btn pri" data-act="fdedit" data-kind="${kind}" data-id="${it.id}">Edit</button></div>`;
}
function fieldDetail(kind,id){openModal(fieldDetailHtml(kind,id,false))}
ACT.fdedit=a=>{const it=S[a.dataset.kind].find(x=>x.id===a.dataset.id);if(!it)return;closeModal();openForm(a.dataset.kind,{...it},saveEntity(a.dataset.kind))};
ACT.fdscan=async a=>{const kind=a.dataset.kind,it=S[kind].find(x=>x.id===a.dataset.id);if(!it)return;closeModal();const r=await nativeScan();if(!r)return;const d={...it};applyScanToDraft(kind,d,r);openForm(kind,d,saveEntity(kind),{title:'Update '+it.name})};

/* ---------- Status ---------- */
function fieldStatusView(){
  const rows=statusRows();const c=statusCounts(rows);const order={down:0,pending:1,up:2,off:3,none:4};
  return `<div class="row" style="margin-bottom:10px"><span class="pill ok">${c.up} up</span>${c.down?`<span class="pill bad">${c.down} down</span>`:''}${c.off?`<span class="pill">${c.off} stopped</span>`:''}<span class="spacer"></span><button class="btn pri" data-act="checknow">Check now</button></div>
    <div class="fcard flist">${rows.sort((a,b)=>order[a.state]-order[b.state]||String(a.name).localeCompare(b.name)).map(r=>{const l=r.l;return `<div class="fi" data-act="fopen" data-kind="${r.kind}" data-id="${r.it.id}">${lamp(r.it)}<div style="min-width:0"><b>${esc(r.name)}</b><span>${esc([r.sub,l&&l.ms?l.ms+' ms':'',l&&l.detail].filter(Boolean).join(' · '))}</span></div></div>`}).join('')||'<div class="muted small">Add devices with an IP to see live status.</div>'}</div>
    <p class="small muted">${SV.linked?'Live from the server.':NATIVE?'Checked from this phone (TCP probe) every minute. Link to the server for real pings and Proxmox/TrueNAS status.':''}</p>`;
}

/* ---------- More ---------- */
function fieldMoreView(){
  return `<button class="bigbtn" data-act="ftab" data-t="help">📖 How to use — everything it can do</button>
    <button class="bigbtn alt" data-act="mode" data-mode="full">🖥 Full planner (every tool)</button>
    <button class="bigbtn alt" data-act="netplan">⇪ Export / share .netplan</button>
    <div class="fcard"><h3>Link with your Mac / website</h3>
      <p class="small muted" style="margin-top:0">${SV.linked?`<b style="color:var(--ok)">Live</b> with ${esc(svBase())}. What you add here shows up on the Mac in a few seconds.`:'Enter the server address (shown on the Mac, e.g. http://192.168.1.70:8770) to work as the Mac\'s scanner. Without it, this phone does everything on its own.'}</p>
      <input id="svUrl" data-ui="svUrl" type="url" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="http://192.168.1.70:8770" value="${esc(UI.svUrl||'')}" style="width:100%;font-size:16px;margin-bottom:8px">
      <input id="svToken" data-ui="svToken" autocapitalize="off" autocorrect="off" placeholder="token (only if set on the server)" value="${esc(UI.svToken||'')}" style="width:100%;font-size:16px;margin-bottom:8px">
      <div class="row">${SV.linked?`<button class="btn" data-act="remote" data-op="unlink">Stop live sync</button>`:`<button class="btn pri" data-act="remote" data-op="live">Turn on live sync</button>`}<button class="btn" data-act="remote" data-op="send">Send copy to inbox</button></div></div>
    <div class="fcard small muted">${S.devices.length} devices · ${S.vms.length} VMs · ${S.racks.length} racks · ${S.vlans.length} VLANs<br>Device: ${esc(CLIENT)}</div>`;
}

/* tapping an empty rack U in field mode: scan straight into it */
const _placeDialog=placeDialog;
placeDialog=function(rackId,u){
  if(UI.mode==='field'&&window.nativeScan){
    const un=S.devices.filter(d=>!d.rackId||!(+d.uStart>0));
    openModal(`<h3>${esc(refName('racks',rackId))} · U${u}</h3>
      <button class="bigbtn" id="pScan">📷 Scan the device going here</button>
      <button class="bigbtn alt" id="pNew">＋ Type it in</button>
      ${un.length?`<label class="fld wide"><span>…or place one that isn't racked yet</span><select id="plSel">${un.map(d=>`<option value="${d.id}">${esc(d.name)} (${d.uSize||1}U)</option>`).join('')}</select></label><div class="row" style="margin-top:8px"><span class="spacer"></span><button class="btn pri" data-act="placeit" data-rack="${rackId}" data-u="${u}">Place</button></div>`:''}
      <div class="row" style="margin-top:8px"><span class="spacer"></span><button class="btn" data-act="close">Cancel</button></div>`);
    $('#pScan').onclick=()=>{closeModal();fieldScan({rackId,u})};
    $('#pNew').onclick=()=>{closeModal();openForm('devices',{rackId,uStart:u,uSize:1,status:'installed'},saveEntity('devices'))};
    return;
  }
  _placeDialog(rackId,u);
};
const _editdev=ACT.editdev;
ACT.editdev=a=>{if(UI.mode==='field')fieldDetail('devices',a.dataset.dev);else _editdev(a)};
