/* Net Planner — native bridge, live status board, Proxmox / TrueNAS integrations, network scan. */

/* ============ native app bridge ============ */
const NATIVE_ASYNC=NATIVE&&!!(window.webkit.messageHandlers.nativeAsync);
async function nativeCall(action,payload={}){
  if(!NATIVE_ASYNC)throw new Error('Only available in the Net Planner app');
  return await window.webkit.messageHandlers.nativeAsync.postMessage(Object.assign({action},payload));
}
if(NATIVE_ASYNC){
  /* camera (iPhone/iPad) or a photo (Mac / older devices) → recognized text and barcodes */
  window.nativeScan=async()=>{try{const r=await nativeCall('scan');return r&&r.length?r:null}catch(e){if(String(e).includes('cancel'))return null;toast('Scan failed: '+e);return null}};
}
const pmap=async(list,n,fn)=>{const out=new Array(list.length);let i=0;await Promise.all(Array.from({length:Math.min(n,list.length)},async()=>{while(i<list.length){const k=i++;try{out[k]=await fn(list[k],k)}catch(e){out[k]=undefined}}}));return out};
const gb=b=>b?Math.round(b/1073741824*10)/10:'';

/* ============ status: checks without a server (in the app) ============ */
function checkTargets(){
  const t=[];
  S.devices.forEach(d=>{const ip=String(d.mgmtIp||'').trim();if(ip&&d.check!=='none')t.push({id:d.id,ip,check:d.check||'ping'})});
  S.vms.forEach(v=>{const ip=String(v.ip||'').trim();if(ip&&v.check!=='none')t.push({id:v.id,ip,check:v.check||'ping'})});
  return t;
}
async function runLocalChecks(){
  if(!NATIVE_ASYNC)return;
  const t=checkTargets();
  if(t.length){
    const res=await nativeCall('probe',{targets:t.map(x=>{const m=/^tcp:(\d+)$/.exec(x.check);return {id:x.id,host:x.ip,port:m?+m[1]:443,strict:!!m}})}).catch(()=>[]);
    const now=Date.now()/1000;const items={};
    (res||[]).forEach(r=>{const prev=LIVE.items&&LIVE.items[r.id]||{};items[r.id]={state:r.state,ms:r.ms||'',detail:r.detail+' (from this device)',checked:now,since:prev.state===r.state?prev.since:now}});
    LIVE.items=items;
  }
  for(const c of localIntegrations()){try{Object.assign(LIVE.ext,await integStatus(c));LIVE.integrations[c.id]={ok:true,checked:Date.now()/1000}}catch(e){LIVE.integrations[c.id]={ok:false,error:e.message}}}
  LIVE.checked=Date.now()/1000;
  paintLamps();setSync();
  if(['status','dash'].includes(UI.tab)||UI.mode==='field')softRender();
}
let localTimer=null;
function startLocalChecks(){
  clearInterval(localTimer);
  if(!NATIVE_ASYNC)return;
  const tick=()=>{if(!SV.linked&&document.visibilityState==='visible')runLocalChecks()};
  setTimeout(tick,1500);localTimer=setInterval(tick,60000);
}
async function checkNow(){
  try{
    if(SV.linked){toast('Checking every device…');LIVE=await api('/api/check',{method:'POST',timeout:60000});paintLamps();setSync();softRender();toast('Status updated');return}
    if(NATIVE_ASYNC){toast('Checking from this device…');await runLocalChecks();toast('Status updated');return}
    toast('Live checks need the Net Planner server or the app');
  }catch(e){toast('Check failed: '+e.message)}
}

/* ============ status board ============ */
function statusRows(){
  const rows=[];
  S.devices.forEach(d=>rows.push({kind:'devices',it:d,name:d.name,sub:[d.mgmtIp,d.role||d.model].filter(Boolean).join(' · '),group:d.type}));
  S.vms.forEach(v=>rows.push({kind:'vms',it:v,name:v.name,sub:[v.ip,(v.kind||'vm')+(v.hostId?' on '+refName('devices',v.hostId):'')].filter(Boolean).join(' · '),group:'vm'}));
  S.storage.filter(x=>x.extId&&(x.kind==='pool'||x.kind==='storage')).forEach(x=>rows.push({kind:'storage',it:x,name:x.name,sub:[x.kind,refName('devices',x.deviceId)].filter(Boolean).join(' · '),group:'storage'}));
  rows.forEach(r=>{const l=liveOf(r.it);r.state=l?l.state:'pending';r.l=l});
  return rows;
}
function statusCounts(rows){const c={up:0,down:0,off:0,none:0,pending:0};rows.forEach(r=>c[r.state]=(c[r.state]||0)+1);return c}
function statCard(r){
  const l=r.l;const det=l?[l.ms?l.ms+' ms':'',l.detail||''].filter(Boolean).join(' · '):'not checked yet';
  return `<div class="stat ${r.state==='down'?'down':''}" data-act="edit" data-kind="${r.kind}" data-id="${r.it.id}">${lamp(r.it)}<div style="min-width:0"><b>${esc(r.name)}</b><span>${esc(r.sub||'')}</span><span style="display:block">${esc(det)}</span></div></div>`;
}
function statusSummaryCard(){
  const rows=statusRows();if(!rows.length)return '';
  const c=statusCounts(rows);const down=rows.filter(r=>r.state==='down');
  const src=SV.linked?'checked by the server every '+(LIVE.interval||30)+' s':NATIVE?'checked from this device every minute':'open the server website or the app for live status';
  return `<div class="card"><div class="row"><h3 style="margin:0">Live status</h3><span class="pill ok">${c.up} up</span>${c.down?`<span class="pill bad">${c.down} down</span>`:''}${c.off?`<span class="pill">${c.off} stopped</span>`:''}
    <span class="muted small">${src}</span><span class="spacer"></span><button class="btn icon" data-act="checknow">Check now</button><button class="btn icon" data-act="tab" data-tab="status">Open</button></div>
    ${down.length?`<div class="stat-grid" style="margin-top:10px">${down.slice(0,6).map(statCard).join('')}</div>`:''}</div>`;
}
function viewStatus(){
  const rows=statusRows();const c=statusCounts(rows);
  const order={down:0,pending:1,up:2,off:3,none:4};
  const groups={};rows.forEach(r=>(groups[r.group]=groups[r.group]||[]).push(r));
  const names={vm:'VMs, containers & apps',storage:'Storage pools'};
  const integ=allIntegrations();
  return `<div class="row"><h2>Status</h2><span class="spacer"></span><span class="pill ok">${c.up} up</span>${c.down?`<span class="pill bad">${c.down} down</span>`:''}${c.off?`<span class="pill">${c.off} stopped</span>`:''}<span class="pill">${c.none+c.pending} not checked</span>
    <button class="btn pri" data-act="checknow">Check now</button></div>
  <p class="muted small" style="margin-top:0">${SV.linked?`The server checks every device every ${LIVE.interval||30} s (ping, or a TCP port set in the device's Health check — e.g. <span class="mono">tcp:8006</span> for Proxmox). Last round ${LIVE.checked?new Date(LIVE.checked*1000).toLocaleTimeString():'—'}.`:NATIVE?'Checked from this device with a quick TCP probe every minute. Link to the server (Import / Export → Server) for real pings and Proxmox/TrueNAS status around the clock.':'Live checks run on the Net Planner server. Open this page from the server (http://&lt;server&gt;:8770) or use the app.'}</p>
  ${integ.length?`<div class="card"><h3>Integrations</h3>${integ.map(i=>{const st=LIVE.integrations&&LIVE.integrations[i.id];return `<div class="row small" style="margin:4px 0"><i class="lamp ${st?(st.ok?'up':'down'):'pending'}"></i><b>${esc(i.name)}</b><span class="muted">${esc(i.type)} · ${esc(i.url)}</span>${st&&st.error?`<span style="color:var(--bad)">${esc(st.error)}</span>`:''}</div>`}).join('')}</div>`:''}
  ${rows.length?Object.entries(groups).sort((a,b)=>Math.min(...a[1].map(r=>order[r.state]))-Math.min(...b[1].map(r=>order[r.state]))).map(([g,list])=>`<h3 style="margin:16px 0 8px">${esc(names[g]||g)} <span class="muted small">${list.length}</span></h3>
    <div class="stat-grid">${list.sort((a,b)=>order[a.state]-order[b.state]||String(a.name).localeCompare(b.name)).map(statCard).join('')}</div>`).join(''):'<div class="card empty">Add devices with an IP to see their status.</div>'}`;
}

/* ============ integrations: Proxmox VE and TrueNAS ============ */
let REMOTE_INTEG=[],REMOTE_LOADED=false;
function localIntegrations(){return (UI.integrations||[]).map(i=>Object.assign({},i,{remote:false}))}
function allIntegrations(){return [...(SV.linked?REMOTE_INTEG:[]),...localIntegrations()]}
async function loadRemoteInteg(){if(!SV.linked)return;try{REMOTE_INTEG=await api('/api/integrations')}catch(e){REMOTE_INTEG=[]}}
async function integGet(cfg,path){
  if(cfg.remote){const r=await api('/api/integrations/'+encodeURIComponent(cfg.id)+'/get?path='+encodeURIComponent(path),{timeout:30000});return r.data}
  if(!NATIVE_ASYNC)throw new Error('Open Net Planner from the server or use the app to reach '+cfg.type);
  const headers={Accept:'application/json',Authorization:cfg.type==='proxmox'?`PVEAPIToken=${cfg.tokenId}=${cfg.secret}`:`Bearer ${cfg.secret}`};
  const r=await nativeCall('http',{url:cfg.url.replace(/\/+$/,'')+path,method:'GET',headers,insecure:!cfg.verifyTls,timeout:15});
  if(r.status>=400)throw new Error(`${cfg.name}: HTTP ${r.status} ${String(r.body||'').slice(0,160)}`);
  return JSON.parse(r.body||'null');
}
const host=u=>{try{return new URL(u).hostname}catch(e){return ''}};

async function syncProxmox(cfg){
  const g=async p=>((await integGet(cfg,'/api2/json'+p))||{}).data;
  const [nodes,res,cstat]=await Promise.all([g('/nodes'),g('/cluster/resources?type=vm'),g('/cluster/status').catch(()=>[])]);
  const out={devices:[],vms:[],storage:[]};
  for(const n of nodes||[]){
    const ip=((cstat||[]).find(x=>x.type==='node'&&x.name===n.node)||{}).ip||((nodes||[]).length===1?host(cfg.url):'');
    let ver='';try{ver=(await g(`/nodes/${n.node}/version`)).version}catch(e){}
    const hostExt=`${cfg.id}:node/${n.node}`;
    out.devices.push({extId:hostExt,name:n.node,type:'server',role:'Proxmox VE host',os:ver?'Proxmox VE '+ver:'Proxmox VE',mgmtIp:ip,check:'tcp:8006',cpu:n.maxcpu?n.maxcpu+' threads':'',ramGb:gb(n.maxmem),runState:n.status,source:'proxmox'});
    try{(await g(`/nodes/${n.node}/storage`)||[]).forEach(s=>out.storage.push({extId:`${cfg.id}:${n.node}/storage/${s.storage}`,deviceExt:hostExt,kind:'storage',name:`${s.storage} (${n.node})`,layout:s.type,sizeGb:gb(s.total),usedGb:gb(s.used),health:s.active?'active':'inactive',source:'proxmox'}))}catch(e){}
  }
  const guests=(res||[]).filter(v=>!v.template&&(v.type==='qemu'||v.type==='lxc'));
  await pmap(guests,6,async v=>{
    let ip='',vlan='',mac='',os='';
    try{const c=await g(`/nodes/${v.node}/${v.type}/${v.vmid}/config`);const net=String(c.net0||'');
      const t=/(?:^|,)tag=(\d+)/.exec(net);if(t)vlan=+t[1];
      const m=/([0-9A-F]{2}(?::[0-9A-F]{2}){5})/i.exec(net);if(m)mac=m[1].toUpperCase();
      const i=/(?:^|,)ip=(\d+\.\d+\.\d+\.\d+)/.exec(net);if(i)ip=i[1];
      os=c.ostype||'';}catch(e){}
    if(!ip&&v.status==='running'){
      try{
        if(v.type==='qemu'){const a=await g(`/nodes/${v.node}/qemu/${v.vmid}/agent/network-get-interfaces`);
          for(const itf of (a&&a.result)||[])for(const ad of itf['ip-addresses']||[])if(!ip&&ad['ip-address-type']==='ipv4'&&!ad['ip-address'].startsWith('127.'))ip=ad['ip-address'];}
        else{const ifs=await g(`/nodes/${v.node}/lxc/${v.vmid}/interfaces`);for(const itf of ifs||[]){const a=String(itf.inet||'').split('/')[0];if(!ip&&a&&!a.startsWith('127.'))ip=a}}
      }catch(e){}
    }
    const sv=KB.service(v.name);
    out.vms.push({extId:`${cfg.id}:${v.type}/${v.vmid}`,hostExt:`${cfg.id}:node/${v.node}`,name:v.name||`${v.type} ${v.vmid}`,kind:v.type==='lxc'?'lxc':'vm',vmid:v.vmid,ip,vlan,mac,
      os:os?(v.type==='lxc'?'LXC ':'')+os:'',cpu:v.maxcpu,ramGb:gb(v.maxmem),diskGb:gb(v.maxdisk),runState:v.status,check:sv?'tcp:'+sv.port:'',source:'proxmox'});
  });
  return out;
}
async function syncTrueNAS(cfg){
  const g=p=>integGet(cfg,'/api/v2.0'+p);
  const info=await g('/system/info');
  const devExt=`${cfg.id}:system`;
  const out={devices:[{extId:devExt,name:info.hostname||cfg.name,type:'storage',role:'TrueNAS',os:String(info.version||'TrueNAS').replace(/^TrueNAS-?/,'TrueNAS '),model:info.system_product||'',make:info.system_manufacturer||'',
    serial:info.system_serial||'',cpu:info.model?`${info.model} (${info.cores||'?'} cores)`:'',ramGb:gb(info.physmem),mgmtIp:host(cfg.url),check:'tcp:443',source:'truenas'}],vms:[],storage:[]};
  const pools=await g('/pool').catch(()=>[]);
  for(const p of pools||[]){
    const data=((p.topology||{}).data)||[];
    const layout=data.map(v=>`${v.type}${v.children&&v.children.length?' ×'+v.children.length:''}`).join(' + ');
    out.storage.push({extId:`${cfg.id}:pool/${p.name}`,deviceExt:devExt,kind:'pool',name:p.name,layout,sizeGb:gb(p.size),usedGb:gb(p.allocated),health:p.healthy?'healthy':(p.status||'unhealthy'),path:p.path||'/mnt/'+p.name,source:'truenas'});
  }
  const ds=await g('/pool/dataset?limit=500').catch(()=>[]);
  const flat=[];const walk=(arr,depth)=>{for(const d of arr||[]){if(flat.length>=300)return;if(depth>0)flat.push(d);walk(d.children,depth+1)}};
  walk(ds,0);
  flat.forEach(d=>{const used=d.used&&d.used.parsed,avail=d.available&&d.available.parsed;
    out.storage.push({extId:`${cfg.id}:dataset/${d.id}`,deviceExt:devExt,kind:'dataset',name:d.id,layout:d.type,usedGb:gb(used),sizeGb:used!=null&&avail!=null?gb(used+avail):'',path:d.mountpoint||'',source:'truenas'})});
  for(const sh of await g('/sharing/smb').catch(()=>[])||[])out.storage.push({extId:`${cfg.id}:smb/${sh.id}`,deviceExt:devExt,kind:'share',name:sh.name||sh.path,protocol:'SMB',path:sh.path||'',health:sh.enabled===false?'disabled':'enabled',source:'truenas'});
  for(const sh of await g('/sharing/nfs').catch(()=>[])||[])out.storage.push({extId:`${cfg.id}:nfs/${sh.id}`,deviceExt:devExt,kind:'share',name:'NFS '+(sh.path||(sh.paths||[])[0]||sh.id),protocol:'NFS',path:sh.path||(sh.paths||[])[0]||'',health:sh.enabled===false?'disabled':'enabled',source:'truenas'});
  for(const dk of await g('/disk').catch(()=>[])||[])out.storage.push({extId:`${cfg.id}:disk/${dk.identifier||dk.name}`,deviceExt:devExt,kind:'disk',name:dk.name,layout:[dk.type,dk.model].filter(Boolean).join(' · '),sizeGb:gb(dk.size),health:dk.pool?'in pool '+dk.pool:'',notes:dk.serial?'Serial '+dk.serial:'',source:'truenas'});
  for(const v of await g('/vm').catch(()=>[])||[])out.vms.push({extId:`${cfg.id}:vm/${v.id}`,hostExt:devExt,name:v.name,kind:'vm',vmid:v.id,cpu:v.vcpus,ramGb:v.memory?Math.round(v.memory/1024*10)/10:'',runState:(v.status||{}).state||'',source:'truenas'});
  for(const a of await g('/app').catch(()=>[])||[]){const sv=KB.service(a.name);out.vms.push({extId:`${cfg.id}:app/${a.name}`,hostExt:devExt,name:a.name,kind:'app',runState:a.state||'',os:a.version?'app '+a.version:'',check:sv?'tcp:'+sv.port:'',source:'truenas'})}
  return out;
}
/* light-weight live status (same keys as the server's background poll) */
async function integStatus(cfg){
  const ext={};
  if(cfg.type==='proxmox'){
    const res=((await integGet(cfg,'/api2/json/cluster/resources'))||{}).data||[];
    for(const r of res){
      if(r.type==='node')ext[`${cfg.id}:node/${r.node}`]={state:r.status==='online'?'up':'down',detail:r.status};
      else if(r.type==='qemu'||r.type==='lxc')ext[`${cfg.id}:${r.type}/${r.vmid}`]={state:r.status==='running'?'up':'off',detail:r.status};
      else if(r.type==='storage')ext[`${cfg.id}:${r.node}/storage/${r.storage}`]={state:r.status==='available'?'up':'down',detail:r.status};
    }
  }else{
    await integGet(cfg,'/api/v2.0/system/info');ext[`${cfg.id}:system`]={state:'up',detail:'API reachable'};
    for(const p of await integGet(cfg,'/api/v2.0/pool')||[])ext[`${cfg.id}:pool/${p.name}`]={state:p.healthy?'up':'down',detail:p.status};
  }
  return ext;
}
const LIVEFIELDS=new Set(['extId','runState','os','cpu','ramGb','diskGb','sizeGb','usedGb','health','layout','vmid','ip','vlan','mac','kind','source','serial']);
function upsert(kind,obj){
  let ex=obj.extId&&S[kind].find(x=>x.extId===obj.extId);
  if(!ex&&obj.name)ex=S[kind].find(x=>!x.extId&&String(x.name).trim().toLowerCase()===String(obj.name).trim().toLowerCase()&&(kind!=='storage'||!x.deviceId||x.deviceId===obj.deviceId));
  const clean={};Object.entries(obj).forEach(([k,v])=>{if(v!==''&&v!=null&&!['hostExt','deviceExt'].includes(k))clean[k]=v});
  if(ex){let changed=false;for(const [k,v] of Object.entries(clean)){if((LIVEFIELDS.has(k)||ex[k]===''||ex[k]==null)&&ex[k]!==v){ex[k]=v;changed=true}}if(changed){ex.by=CLIENT+' sync';ex.at=Date.now()}return ex}
  const it=Object.assign({id:uid(),status:'live',by:CLIENT+' sync',at:Date.now()},clean);S[kind].push(it);return it;
}
async function syncIntegration(cfg){
  toast(`Syncing ${cfg.name}…`);
  try{
    const r=cfg.type==='proxmox'?await syncProxmox(cfg):await syncTrueNAS(cfg);
    const map={};
    r.devices.forEach(d=>{const it=upsert('devices',d);map[d.extId]=it.id});
    r.vms.forEach(v=>{const o=Object.assign({},v);if(v.hostExt&&map[v.hostExt])o.hostId=map[v.hostExt];upsert('vms',o)});
    r.storage.forEach(x=>{const o=Object.assign({},x);if(x.deviceExt&&map[x.deviceExt])o.deviceId=map[x.deviceExt];upsert('storage',o)});
    LIVE.integrations[cfg.id]={ok:true,checked:Date.now()/1000};
    try{Object.assign(LIVE.ext,await integStatus(cfg))}catch(e){}
    commit();
    toast(`${cfg.name}: ${r.devices.length} host${r.devices.length===1?'':'s'}, ${r.vms.length} VMs/containers/apps, ${r.storage.length} storage items`);
  }catch(e){LIVE.integrations[cfg.id]={ok:false,error:e.message};render();toast('Sync failed: '+e.message)}
}
function integForm(type,existing){
  const isPx=type==='proxmox';const d=existing||{};
  const where=SV.linked?'Saved on the Net Planner server (the token never leaves it), so it also feeds live status.':NATIVE?'Saved on this device only.':'';
  openModal(`<h3>${existing?'Edit':'Connect'} ${isPx?'Proxmox VE':'TrueNAS'}</h3>
    <form class="form" id="ifrm">
      <label class="fld"><span>Name</span><input id="i_name" value="${esc(d.name||(isPx?'Proxmox':'TrueNAS'))}"></label>
      <label class="fld"><span>URL</span><input id="i_url" placeholder="${isPx?'https://10.0.10.5:8006':'https://10.0.20.10'}" value="${esc(d.url||'')}" autocapitalize="off" autocorrect="off"></label>
      ${isPx?`<label class="fld wide"><span>API token ID</span><input id="i_tok" placeholder="root@pam!netplanner" value="${esc(d.tokenId||'')}" autocapitalize="off" autocorrect="off"></label>`:''}
      <label class="fld wide"><span>${isPx?'Token secret':'API key'} ${existing&&(d.hasSecret||d.secret)?'<i>(leave blank to keep the saved one)</i>':''}</span><input id="i_sec" type="password" autocomplete="off" placeholder="${isPx?'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx':'1-AbCd…'}"></label>
      <label class="wide"><input type="checkbox" id="i_tls" ${d.verifyTls?'checked':''}> Verify TLS certificate (leave off for the default self-signed certificate)</label>
    </form>
    <p class="muted small">${isPx?'In Proxmox: <b>Datacenter → Permissions → API Tokens → Add</b>. Pick a user (e.g. root@pam), give the token an ID like <i>netplanner</i>, then grant it the read-only <b>PVEAuditor</b> role on <b>/</b> (or untick Privilege Separation). Copy the Token ID and Secret.':'In TrueNAS: click the user icon (top right) → <b>API Keys → Add</b> (25.04+: <b>Credentials → API Keys</b>). Copy the key — it is shown once.'} ${where}</p>
    <div class="err" id="ierr"></div>
    <div class="row" style="margin-top:10px"><span class="spacer"></span><button class="btn" data-act="close">Cancel</button><button class="btn pri" id="isave">Save &amp; sync</button></div>`);
  $('#isave').onclick=async()=>{
    const b={type,name:$('#i_name').value.trim(),url:$('#i_url').value.trim().replace(/\/+$/,''),tokenId:isPx?$('#i_tok').value.trim():'',secret:$('#i_sec').value.trim(),verifyTls:$('#i_tls').checked};
    if(!/^https?:\/\/[^\s/]+$/.test(b.url)){$('#ierr').textContent='URL must look like https://10.0.10.5'+(isPx?':8006':'')+' (no path)';return}
    if(!existing&&!b.secret){$('#ierr').textContent='Paste the '+(isPx?'token secret':'API key');return}
    if(isPx&&!/^[^@\s]+@[^!\s]+![^\s]+$/.test(b.tokenId)){$('#ierr').textContent='Token ID looks like user@realm!tokenname';return}
    let cfg;
    try{
      if(SV.linked&&(!existing||existing.remote)){cfg=existing?await api('/api/integrations/'+existing.id,{method:'PUT',body:JSON.stringify(b)}):await api('/api/integrations',{method:'POST',body:JSON.stringify(b)});await loadRemoteInteg()}
      else if(NATIVE_ASYNC){UI.integrations=UI.integrations||[];if(existing){const x=UI.integrations.find(i=>i.id===existing.id);Object.assign(x,b,b.secret?{}:{secret:x.secret})}else UI.integrations.push(Object.assign({id:type+'-'+uid().slice(0,6)},b));saveUI();cfg=localIntegrations().find(i=>i.name===b.name&&i.url===b.url)}
      else{$('#ierr').textContent='Open Net Planner from the server (or use the app) to add integrations.';return}
    }catch(e){$('#ierr').textContent=e.message;return}
    closeModal();render();if(cfg)syncIntegration(cfg);
  };
}
async function integAct(op,id){
  const cfg=allIntegrations().find(i=>i.id===id);
  if(op==='add-proxmox')return integForm('proxmox');
  if(op==='add-truenas')return integForm('truenas');
  if(!cfg)return;
  if(op==='sync')return syncIntegration(cfg);
  if(op==='edit')return integForm(cfg.type,cfg);
  if(op==='del'){if(!confirm(`Remove the ${cfg.name} connection? Items it created stay in your plan.`))return;
    if(cfg.remote){try{await api('/api/integrations/'+id,{method:'DELETE'});await loadRemoteInteg()}catch(e){toast(e.message)}}
    else{UI.integrations=(UI.integrations||[]).filter(i=>i.id!==id);saveUI()}
    render()}
}

/* ============ network scan (find IoT and unknown devices) ============ */
let SCAN={cidr:'',hosts:null,busy:false};
async function runDiscover(){
  const cidr=($('#scanCidr')||{}).value||SCAN.cidr;SCAN.cidr=cidr;
  if(!SV.linked){toast('Network scan runs on the Net Planner server — link to it first');return}
  SCAN.busy=true;render();
  try{const r=await api('/api/discover',{method:'POST',body:JSON.stringify({cidr,ports:true}),timeout:120000});SCAN.hosts=r.hosts||[]}
  catch(e){toast('Scan failed: '+e.message);SCAN.hosts=null}
  SCAN.busy=false;render();
}
function knownFor(h){return S.devices.find(d=>String(d.mgmtIp||'').trim()===h.ip||(h.mac&&d.mac&&d.mac.toUpperCase()===h.mac))||S.vms.find(v=>String(v.ip||'').trim()===h.ip||(h.mac&&v.mac&&v.mac.toUpperCase()===h.mac))}
function addScanned(){
  const picks=[...document.querySelectorAll('[data-scanpick]:checked')].map(c=>SCAN.hosts[+c.dataset.scanpick]);
  let n=0;
  picks.forEach(h=>{const vendor=KB.macVendor(h.mac);const g=KB.guessFromPorts(h.ports,vendor);const known=knownFor(h);
    if(known){if(h.mac&&!known.mac)known.mac=h.mac;touch(known);return}
    const name=(h.hostname||'').split('.')[0]||`${g.role||vendor.split(' ')[0]||'Device'} ${h.ip.split('.').pop()}`;
    S.devices.push(touch({id:uid(),name,type:g.type,role:g.role,mgmtIp:h.ip,mac:h.mac,make:vendor.replace(/ \(.*\)$/,''),check:g.check,status:'live',uSize:1,
      mgmtVlan:(vlanByIp(h.ip)||{}).vlanId||'',notes:`Found by network scan ${new Date().toLocaleDateString()}${h.ports&&h.ports.length?' · open ports '+h.ports.join(', '):''}`}));n++});
  commit();toast(`Added ${n} device(s)`);
}
function viewInteg(){
  if(SV.linked&&!REMOTE_LOADED){REMOTE_LOADED=true;loadRemoteInteg().then(()=>{if(UI.tab==='integ')render()})}
  const list=allIntegrations();
  const can=SV.linked||NATIVE_ASYNC;
  if(!SCAN.cidr){const v=S.vlans.find(x=>cidr(x.subnet)&&/iot/i.test(x.name))||S.vlans.find(x=>cidr(x.subnet));SCAN.cidr=v?v.subnet:'192.168.1.0/24'}
  const hosts=SCAN.hosts;
  return `<h2>Integrations</h2>
  <div class="grid g2">
   <div class="card"><h3>Proxmox VE &amp; TrueNAS</h3>
     <p class="muted small">Pull hosts, VMs, LXC containers, apps, pools, datasets, shares and disks straight from the APIs, with live running/stopped and pool health. Sync again any time — your own notes and rack placement are kept.</p>
     ${list.length?list.map(i=>{const st=LIVE.integrations&&LIVE.integrations[i.id];return `<div class="inbox-item"><i class="lamp ${st?(st.ok?'up':'down'):'pending'}"></i><div style="flex:1;min-width:180px"><b>${esc(i.name)}</b> <span class="pill">${esc(i.type)}</span><br><span class="muted small mono">${esc(i.url)}</span>${st&&st.error?`<br><span class="small" style="color:var(--bad)">${esc(st.error)}</span>`:''}<br><span class="muted small">${i.remote?'stored on the server':'stored on this device'}</span></div>
       <button class="btn pri icon" data-act="integ" data-op="sync" data-id="${esc(i.id)}">Sync now</button><button class="btn icon" data-act="integ" data-op="edit" data-id="${esc(i.id)}">Edit</button><button class="btn icon danger" data-act="integ" data-op="del" data-id="${esc(i.id)}">✕</button></div>`}).join(''):''}
     <div class="row" style="margin-top:10px">${can?`<button class="btn" data-act="integ" data-op="add-proxmox">+ Proxmox VE</button><button class="btn" data-act="integ" data-op="add-truenas">+ TrueNAS</button>`:'<span class="muted small">Open Net Planner from your server (http://&lt;server&gt;:8770) or use the app to connect these.</span>'}</div></div>
   <div class="card"><h3>Network scan — IoT &amp; unknown devices</h3>
     <p class="muted small">The server pings every address, reads its ARP table for MAC addresses, guesses the maker from the MAC and checks common ports (Proxmox 8006, Home Assistant 8123, RTSP cameras 554, MQTT 1883…). Pick what to add. ${SV.linked?'':'<b>Needs the server</b> — link to it on Import / Export.'}</p>
     <div class="row"><input id="scanCidr" value="${esc(SCAN.cidr)}" style="width:170px" autocapitalize="off"><button class="btn pri" data-act="discover" ${SCAN.busy||!SV.linked?'disabled':''}>${SCAN.busy?'Scanning… (up to a minute)':'Scan'}</button>
     ${S.vlans.filter(v=>cidr(v.subnet)).slice(0,8).map(v=>`<button class="chipbtn" data-act="scancidr" data-cidr="${esc(v.subnet)}">${v.vlanId} ${esc(v.name)}</button>`).join('')}</div></div>
  </div>
  ${hosts?`<div class="card"><div class="row"><h3 style="margin:0">Found ${hosts.length} device${hosts.length===1?'':'s'} on ${esc(SCAN.cidr)}</h3><span class="spacer"></span><button class="btn pri" data-act="addscanned">Add selected</button></div>
   <div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th></th><th>IP</th><th>MAC</th><th>Likely maker</th><th>Hostname</th><th>Open ports</th><th>Looks like</th><th>In plan</th></tr></thead><tbody>
   ${hosts.map((h,i)=>{const v=KB.macVendor(h.mac);const g=KB.guessFromPorts(h.ports,v);const k=knownFor(h);return `<tr><td><input type="checkbox" data-scanpick="${i}" ${k?'':'checked'}></td><td class="mono">${h.ping?'<i class="lamp up"></i> ':'<i class="lamp none" title="no ping reply (seen in ARP)"></i> '}${esc(h.ip)}</td><td class="mono">${esc(h.mac||'—')}</td><td>${esc(v||'')}</td><td>${esc(h.hostname||'')}</td><td class="mono">${esc((h.ports||[]).join(', '))}</td><td>${esc(g.role||g.type)}</td><td>${k?esc(k.name):'<span class="muted">new</span>'}</td></tr>`}).join('')}
   </tbody></table></div></div>`:''}
  <div class="card"><h3>IoT checklist</h3><ul class="small muted" style="margin:0;padding-left:18px;line-height:1.6">
    <li>Put smart-home gear on its own VLAN (e.g. 40 IOT) and cameras on another (e.g. 50 CAMERAS) with no internet.</li>
    <li>HomeKit, AirPlay, Sonos and Chromecast need mDNS/SSDP across VLANs — enable the Avahi reflector on pfSense/OPNsense.</li>
    <li>Allow ICMP (and the TCP ports you check) from the Net Planner server to each VLAN, or status lights will show down.</li>
    <li>Set a device's <b>Health check</b> to <span class="mono">tcp:PORT</span> for gear that ignores ping (cameras 554, Home Assistant 8123).</li>
    <li>Zigbee/Z-Wave/Thread devices have no IP — add them with type <i>iot</i>, Health check <i>none</i>, and the hub in “Connects via”.</li></ul></div>`;
}
ACT.integ=a=>integAct(a.dataset.op,a.dataset.id);
ACT.discover=()=>runDiscover();
ACT.scancidr=a=>{SCAN.cidr=a.dataset.cidr;render()};
ACT.addscanned=()=>addScanned();
