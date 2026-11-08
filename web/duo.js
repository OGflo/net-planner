/* Net Planner — iPhone Duo (foldable) support.
   Open:   two panes side by side — lists on the left, details / rack / guide on the right.
   Closed: the cover screen is the camera scanner, plus a closed-only Status glance that buzzes when something new goes down.
   The camera only works with the Duo closed; asking to scan while open waits for you to fold it.
   Phones without a hinge (and iPads) keep working as before; wide screens also get the two-pane layout. */
const FOLD={state:'none',angle:0,pending:null,pendingAt:0,formScan:false,downSeen:null};
const isDuo=()=>FOLD.state!=='none';
const duoOpen=()=>FOLD.state==='open'||FOLD.state==='partial';
const duoClosed=()=>FOLD.state==='closed';
const twoPane=()=>duoOpen()||innerWidth>=760;
function haptic(kind){if(NATIVE)window.webkit.messageHandlers.native.postMessage({action:'haptic',kind:kind||'light'})}

/* ---------- called by the app when the hinge moves ---------- */
window.netplannerHinge=(state,angle)=>{
  const prev=FOLD.state;FOLD.state=state||'none';FOLD.angle=+angle||0;
  if(prev===FOLD.state)return;
  UI.field=UI.field||{};
  if(FOLD.state==='closed'){
    if(UI.mode!=='field'){FOLD.wasFull=true;UI.mode='field'}
    const waiting=FOLD.pending&&Date.now()-FOLD.pendingAt<180000;
    UI.field.closed=waiting||FOLD.formScan?'scan':(UI.field.closed||'scan');
    render();
    if(FOLD.formScan&&!$('#modal').classList.contains('hidden')&&$('#fscan')){FOLD.formScan=false;setTimeout(()=>$('#fscan').click(),500);return}
    if(waiting){const ctx=FOLD.pending;FOLD.pending=null;setTimeout(()=>realScan(ctx),500)}
    return;
  }
  if(prev==='closed'&&duoOpen()){
    if(FOLD.wasFull){UI.mode='full';FOLD.wasFull=false}
    if(FSCAN)UI.field.tab='scan';
  }
  render();
};

/* ---------- Control Center buttons / netplanner:// links ---------- */
window.netplannerDeepLink=a=>{
  UI.field=UI.field||{};UI.mode='field';
  if(a==='scan'){
    if(duoClosed()){UI.field.closed='scan';render();realScan(null)}
    else if(duoOpen()){UI.field.tab='scan';render();askToFold(null)}
    else{UI.field.tab='scan';render();realScan(null)}
  }else if(a==='status'){if(duoClosed())UI.field.closed='glance';else UI.field.tab='status';render()}
  else if(a==='check'){if(duoClosed())UI.field.closed='glance';else UI.field.tab='status';render();checkNow()}
  else if(a==='find'){UI.field.tab='find';UI.field.focus=true;render()}
  else render();
};

/* ---------- camera only while closed ---------- */
const realScan=fieldScan;
function askToFold(ctx){
  FOLD.pending=ctx||{};FOLD.pendingAt=Date.now();haptic('light');
  toast(ctx&&ctx.rackId?`Fold your Duo closed to scan into ${refName('racks',ctx.rackId)} U${ctx.u}`:'Fold your Duo closed to use the camera');
  render();
}
fieldScan=async function(ctx){if(duoOpen())return askToFold(ctx);return realScan(ctx)};
if(window.nativeScan){
  const realNativeScan=window.nativeScan;
  window.nativeScan=async()=>{if(duoOpen()){FOLD.formScan=true;haptic('light');toast('Fold your Duo closed to scan — this form stays open');return null}return realNativeScan()};
}
const foldCard=()=>{const p=FOLD.pending&&Date.now()-FOLD.pendingAt<180000?FOLD.pending:null;
  return `<div class="foldcard"><div class="foldicon">⤵︎</div><div><b>Fold your Duo closed to scan</b><br><span class="muted small">The camera works on the cover screen. ${p&&p.rackId?`It will go into <b>${esc(refName('racks',p.rackId))} U${p.u}</b>.`:'The result shows up here when you open it again.'}</span></div></div>`};

/* ---------- layouts ---------- */
const _viewField=viewField;
viewField=function(){
  UI.field=UI.field||{};
  if(duoClosed())return viewClosed();
  if(!twoPane())return _viewField();
  const t=UI.field.tab||'scan';
  const title={scan:'Scan & add',racks:'Walk a rack',find:'Find',status:'Live status',more:'More',help:'How to use'}[t];
  return `<div class="fwrap duo"><div class="ftop"><h1>${title}</h1>${isDuo()?'<span class="pill">Duo open</span>':''}<span id="fsync"></span></div>
    <div class="duopanes"><section class="duoL">${duoLeft(t)}</section><section class="duoR" id="duoR">${duoRight(t)}</section></div></div>
    <nav class="fbar">${FTABS.map(([k,l,i])=>`<button class="${t===k||(t==='help'&&k==='more')?'on':''}" data-act="ftab" data-t="${k}"><i>${i}</i>${l}</button>`).join('')}</nav>`;
};
function duoLeft(t){
  if(t==='scan')return (duoOpen()?foldCard():`<button class="bigbtn" data-act="fscan">📷 Scan a label or barcode</button>`)+
    `<div class="fcard"><h3>Or type it</h3><div class="row"><input id="ftype" placeholder="model, serial, MAC…  e.g. R740" style="flex:1;font-size:16px" autocapitalize="off" autocorrect="off"><button class="btn pri" data-act="ftyped">Go</button></div><div class="kbsug" id="fkb"></div></div>
    <div class="fcard small muted">Tip: on Racks, tap an empty U — then fold closed to scan straight into it.</div>`;
  if(t==='racks'){
    if(!S.racks.length)return `<div class="fcard empty">No racks yet.<br><br><button class="btn pri" data-act="add" data-kind="racks">+ Add a rack</button></div>`;
    if(!S.racks.some(r=>r.id===UI.field.rack))UI.field.rack=S.racks[0].id;
    const r=rack(UI.field.rack);const ds=S.devices.filter(d=>d.rackId===r.id&&+d.uStart>0).sort((a,b)=>b.uStart-a.uStart);
    return `<div class="chips">${S.racks.map(x=>`<button class="chipbtn ${x.id===r.id?'on':''}" data-act="frack" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div>
      <div class="fcard small"><b>${esc(r.name)}</b> ${esc(r.location||'')} · ${ds.reduce((a,d)=>a+(+d.uSize||1),0)}/${r.units}U used</div>
      <div class="fcard flist">${ds.map(d=>`<div class="fi ${UI.field.sel&&UI.field.sel.id===d.id?'selrow':''}" data-act="fopen" data-kind="devices" data-id="${d.id}">${lamp(d)}<div><b>${esc(d.name)}</b><span>U${d.uStart}${+d.uSize>1?'–'+(+d.uStart+ +d.uSize-1):''} · ${esc(d.mgmtIp||d.model||d.type)}</span></div></div>`).join('')||'<div class="muted small">Empty rack — tap a U on the right to add.</div>'}</div>`;
  }
  if(t==='find')return fieldFindView();
  if(t==='status')return fieldStatusView();
  return fieldMoreView();
}
function duoRight(t){
  const sel=UI.field.sel;
  const detail=sel&&S[sel.kind]&&S[sel.kind].some(x=>x.id===sel.id)?`<div class="fcard">${fieldDetailHtml(sel.kind,sel.id,true)}</div>`:'';
  if(t==='scan')return FSCAN?scanResultHtml():(detail||`<div class="fcard empty">${duoOpen()?'Fold closed, scan the label, then open your Duo — the result appears here.':'Scan results appear here.'}</div>`);
  if(t==='racks'){if(!S.racks.length)return '';const r=rack(UI.field.rack)||S.racks[0];return `<div class="frack">${rackHtml(r)}</div>${detail}`}
  if(t==='more'||t==='help')return helpHtml();
  return detail||`<div class="fcard empty">Tap something on the left to see it here.</div>`;
}
/* in two-pane mode, tapping an item fills the right pane instead of a pop-up */
const _fopen=ACT.fopen;
ACT.fopen=a=>{if(UI.mode==='field'&&twoPane()&&!duoClosed()){UI.field.sel={kind:a.dataset.kind,id:a.dataset.id};render()}else _fopen(a)};
const _editdev2=ACT.editdev;
ACT.editdev=a=>{if(UI.mode==='field'&&twoPane()&&!duoClosed()){UI.field.sel={kind:'devices',id:a.dataset.dev};render()}else _editdev2(a)};
ACT.fscan=()=>fieldScan(null);

/* ---------- closed (cover screen) ---------- */
function viewClosed(){
  const m=UI.field.closed||'scan';
  const pend=FOLD.pending&&Date.now()-FOLD.pendingAt<180000?FOLD.pending:null;
  return `<div class="fwrap cwrap"><div class="ftop"><h1>Net Planner</h1><span id="fsync"></span></div>
    <div class="cseg"><button class="${m==='scan'?'on':''}" data-act="cmode" data-m="scan">📷 Scan</button><button class="${m==='glance'?'on':''}" data-act="cmode" data-m="glance">● Status glance</button></div>
    ${m==='scan'?`
      ${pend&&pend.rackId?`<div class="fcard small">📍 Scanning into <b>${esc(refName('racks',pend.rackId))}</b> U${pend.u}</div>`:''}
      <button class="bigbtn huge" data-act="cscan">📷 Scan label</button>
      ${FSCAN?scanResultHtml():'<p class="muted small center">Point at a service tag, serial, MAC or model sticker. Open your Duo afterwards to see everything side by side.</p>'}`
    :glanceHtml()}
  </div>`;
}
function glanceHtml(){
  const rows=statusRows();const c=statusCounts(rows);const down=rows.filter(r=>r.state==='down');
  return `<div class="glance"><div class="gnum up"><b>${c.up}</b><span>up</span></div><div class="gnum ${c.down?'down':''}"><b>${c.down}</b><span>down</span></div><div class="gnum"><b>${c.off}</b><span>stopped</span></div></div>
    ${down.length?`<div class="fcard flist">${down.map(r=>`<div class="fi"><i class="lamp down"></i><div><b>${esc(r.name)}</b><span>${esc([r.sub,r.l&&r.l.detail].filter(Boolean).join(' · '))}</span></div></div>`).join('')}</div>`:`<div class="allgood">✓ Everything is answering</div>`}
    <button class="bigbtn alt" data-act="checknow">Check now</button>
    <p class="muted small center">${LIVE.checked?'Last check '+new Date(LIVE.checked*1000).toLocaleTimeString()+' · ':''}Only on the cover screen. Your Duo buzzes when something new goes down.</p>`;
}
ACT.cmode=a=>{UI.field.closed=a.dataset.m;saveUI();render()};
ACT.cscan=()=>{const p=FOLD.pending&&Date.now()-FOLD.pendingAt<180000?FOLD.pending:null;FOLD.pending=null;realScan(p)};

/* buzz when something new goes down while the Duo is closed */
setInterval(()=>{
  if(UI.mode!=='field')return;
  const down=new Set(statusRows().filter(r=>r.state==='down').map(r=>r.it.id));
  if(FOLD.downSeen&&duoClosed()){
    const fresh=[...down].filter(id=>!FOLD.downSeen.has(id));
    if(fresh.length){haptic('warning');const it=findAny(fresh[0]);toast(`${it?it.name:'A device'} stopped answering${fresh.length>1?` (+${fresh.length-1} more)`:''}`)}
    if(UI.field.closed==='glance'&&(fresh.length||down.size!==FOLD.downSeen.size))softRender();
  }
  FOLD.downSeen=down;
},5000);
let duoResize;addEventListener('resize',()=>{if(UI.mode!=='field')return;clearTimeout(duoResize);duoResize=setTimeout(()=>softRender(),150)});
