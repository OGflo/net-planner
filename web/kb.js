/* Net Planner knowledge base — built-in, works offline.
   Type or scan a model and it fills in the basics (type, rack units, ports, management, health check).
   Specs are typical values for the base model; always confirm against the unit in front of you. */
(function(){
const K=[]; // {id, keys:[...], re?:RegExp, vendor, model, type, u, ports, ifPrefix, style, check, role, mgmt, cpu, ram, poe, uplinks, notes}
const add=(o)=>K.push(o);

/* ---------- servers ---------- */
const dell=(m,u,cpu,ram,mgmt,extra={})=>add({id:'dell-'+m.toLowerCase(),keys:[m,'poweredge '+m],vendor:'Dell',model:'PowerEdge '+m,type:'server',u,cpu,ram,mgmt,check:'ping',...extra});
dell('R620',1,'2× Xeon E5-2600 v1/v2','24 DIMM DDR3 (up to 768 GB)','iDRAC7 (dedicated NIC)');
dell('R630',1,'2× Xeon E5-2600 v3/v4','24 DIMM DDR4','iDRAC8');
dell('R640',1,'2× Xeon Scalable (1st/2nd gen)','24 DIMM DDR4','iDRAC9');
dell('R650',1,'2× Xeon Scalable 3rd gen','32 DIMM DDR4','iDRAC9');
dell('R660',1,'2× Xeon Scalable 4th/5th gen','32 DIMM DDR5','iDRAC9');
dell('R720',2,'2× Xeon E5-2600 v1/v2','24 DIMM DDR3','iDRAC7');
dell('R730',2,'2× Xeon E5-2600 v3/v4','24 DIMM DDR4','iDRAC8');
dell('R730xd',2,'2× Xeon E5-2600 v3/v4','24 DIMM DDR4','iDRAC8',{notes:'Storage-dense: up to 12×3.5" or 24×2.5" front bays.'});
dell('R740',2,'2× Xeon Scalable (1st/2nd gen)','24 DIMM DDR4','iDRAC9');
dell('R740xd',2,'2× Xeon Scalable (1st/2nd gen)','24 DIMM DDR4','iDRAC9',{notes:'Storage-dense chassis.'});
dell('R750',2,'2× Xeon Scalable 3rd gen','32 DIMM DDR4','iDRAC9');
dell('R760',2,'2× Xeon Scalable 4th/5th gen','32 DIMM DDR5','iDRAC9');
dell('R330',1,'1× Xeon E3-1200 v5/v6','4 DIMM DDR4','iDRAC8');
dell('R340',1,'1× Xeon E-2100/2200','4 DIMM DDR4','iDRAC9');
dell('R350',1,'1× Xeon E-2300','4 DIMM DDR4','iDRAC9');
dell('R430',1,'2× Xeon E5-2600 v3/v4','12 DIMM DDR4','iDRAC8');
dell('R440',1,'2× Xeon Scalable','16 DIMM DDR4','iDRAC9');
dell('R540',2,'2× Xeon Scalable','16 DIMM DDR4','iDRAC9');
dell('R6515',1,'1× AMD EPYC 7002/7003','16 DIMM DDR4','iDRAC9');
dell('R6525',1,'2× AMD EPYC 7002/7003','32 DIMM DDR4','iDRAC9');
dell('R7515',2,'1× AMD EPYC 7002/7003','16 DIMM DDR4','iDRAC9');
dell('R7525',2,'2× AMD EPYC 7002/7003','32 DIMM DDR4','iDRAC9');
dell('T340',0,'1× Xeon E-2100/2200','4 DIMM DDR4','iDRAC9',{notes:'Tower (5U if rack-converted).'});
dell('T440',0,'2× Xeon Scalable','16 DIMM DDR4','iDRAC9',{notes:'Tower (5U if rack-converted).'});
dell('T640',0,'2× Xeon Scalable','24 DIMM DDR4','iDRAC9',{notes:'Tower (5U if rack-converted).'});
add({id:'dell-precision-5820',keys:['precision 5820','5820 tower','precision tower 5820'],vendor:'Dell',model:'Precision 5820 Tower',type:'server',u:0,cpu:'1× Xeon W-2100/W-2200 or Core X',ram:'8 DIMM DDR4 (up to 512 GB)',mgmt:'none (no iDRAC) — Intel AMT on some CPUs',check:'ping',notes:'Workstation tower. Popular Proxmox host; 2× full-length GPU slots.'});
add({id:'dell-precision-7820',keys:['precision 7820'],vendor:'Dell',model:'Precision 7820 Tower',type:'server',u:0,cpu:'2× Xeon Scalable',ram:'12 DIMM DDR4',mgmt:'none',check:'ping'});
add({id:'dell-precision-7920',keys:['precision 7920'],vendor:'Dell',model:'Precision 7920',type:'server',u:0,cpu:'2× Xeon Scalable',ram:'24 DIMM DDR4',mgmt:'none (rack version has iDRAC)',check:'ping'});
add({id:'dell-optiplex-micro',keys:['optiplex micro','optiplex 3070 micro','optiplex 7060 micro','optiplex 7070 micro','optiplex 7080 micro','optiplex 3080 micro'],vendor:'Dell',model:'OptiPlex Micro',type:'server',u:0,cpu:'Core i3/i5/i7 (T series)',ram:'2 SODIMM',mgmt:'Intel vPro/AMT on vPro models',check:'ping',notes:'1L mini PC — common Proxmox node.'});
const hpe=(m,g,u,cpu,ram,ilo,extra={})=>add({id:('hpe-'+m+'-'+g).toLowerCase().replace(/\s+/g,''),keys:[m+' '+g,m+g,m.replace('DL','dl ')+' '+g,'proliant '+m+' '+g],vendor:'HPE',model:'ProLiant '+m+' '+g,type:'server',u,cpu,ram,mgmt:ilo,check:'ping',...extra});
hpe('DL360','Gen8',1,'2× Xeon E5-2600 v1/v2','24 DIMM DDR3','iLO 4');
hpe('DL360','Gen9',1,'2× Xeon E5-2600 v3/v4','24 DIMM DDR4','iLO 4');
hpe('DL360','Gen10',1,'2× Xeon Scalable','24 DIMM DDR4','iLO 5');
hpe('DL360','Gen10 Plus',1,'2× Xeon Scalable 3rd gen','32 DIMM DDR4','iLO 5');
hpe('DL360','Gen11',1,'2× Xeon Scalable 4th/5th gen','32 DIMM DDR5','iLO 6');
hpe('DL380','Gen8',2,'2× Xeon E5-2600 v1/v2','24 DIMM DDR3','iLO 4');
hpe('DL380','Gen9',2,'2× Xeon E5-2600 v3/v4','24 DIMM DDR4','iLO 4');
hpe('DL380','Gen10',2,'2× Xeon Scalable','24 DIMM DDR4','iLO 5');
hpe('DL380','Gen10 Plus',2,'2× Xeon Scalable 3rd gen','32 DIMM DDR4','iLO 5');
hpe('DL380','Gen11',2,'2× Xeon Scalable 4th/5th gen','32 DIMM DDR5','iLO 6');
hpe('DL20','Gen10',1,'1× Xeon E-2100/2200','4 DIMM DDR4','iLO 5');
hpe('ML30','Gen10',0,'1× Xeon E-2100/2200','4 DIMM DDR4','iLO 5',{notes:'Tower.'});
add({id:'hpe-microserver-gen10plus',keys:['microserver gen10 plus','microserver gen10+','microserver'],vendor:'HPE',model:'ProLiant MicroServer Gen10 Plus',type:'server',u:0,cpu:'Xeon E-2224 or Pentium G5420',ram:'2 DIMM DDR4 (32 GB)',mgmt:'iLO 5 (needs enablement kit)',check:'ping',notes:'4× 3.5" bays, 4× 1GbE. Great small TrueNAS/Proxmox box.'});
const lenovo=(m,u,cpu,ram)=>add({id:'lenovo-'+m.toLowerCase(),keys:[m,'thinksystem '+m],vendor:'Lenovo',model:'ThinkSystem '+m,type:'server',u,cpu,ram,mgmt:'XClarity Controller (XCC)',check:'ping'});
lenovo('SR630',1,'2× Xeon Scalable','24 DIMM DDR4');lenovo('SR650',2,'2× Xeon Scalable','24 DIMM DDR4');lenovo('SR250',1,'1× Xeon E-2100/2200','4 DIMM DDR4');lenovo('ST250',0,'1× Xeon E-2100/2200','4 DIMM DDR4');
add({id:'lenovo-tiny',keys:['m720q','m920q','m70q','m80q','m90q','thinkcentre tiny'],vendor:'Lenovo',model:'ThinkCentre Tiny',type:'server',u:0,cpu:'Core i5/i7 (T series)',ram:'2 SODIMM (up to 64 GB)',mgmt:'vPro/AMT on vPro models',check:'ping',notes:'1L mini PC; M720q/M920q have a PCIe slot (riser) for a 10G NIC.'});
add({id:'cisco-ucs-c220',keys:['ucs c220','c220 m4','c220 m5','ucsc-c220'],vendor:'Cisco',model:'UCS C220',type:'server',u:1,cpu:'2× Xeon',ram:'24 DIMM',mgmt:'CIMC',check:'ping'});
add({id:'cisco-ucs-c240',keys:['ucs c240','c240 m4','c240 m5','ucsc-c240'],vendor:'Cisco',model:'UCS C240',type:'server',u:2,cpu:'2× Xeon',ram:'24 DIMM',mgmt:'CIMC',check:'ping'});
add({id:'supermicro',keys:['supermicro','superserver','sys-'],vendor:'Supermicro',model:'SuperServer',type:'server',u:1,mgmt:'IPMI (BMC)',check:'ping',notes:'Set U size from the chassis (1U/2U/4U). BMC default user ADMIN; newer boards use a unique password on the label.'});
add({id:'minisforum-ms01',keys:['ms-01','ms01','minisforum ms-01'],vendor:'Minisforum',model:'MS-01',type:'server',u:0,cpu:'Core i5-12600H / i9-12900H / i9-13900H',ram:'2 SODIMM DDR5 (up to 96 GB)',mgmt:'vPro on i9-13900H model',ports:4,check:'ping',notes:'2× 10G SFP+, 2× 2.5GbE, 3× M.2. Popular Proxmox node.'});
add({id:'n6005-minipc',keys:['n6005','pentium n6005','n5105','n100','intel n100','beelink','firebat'],vendor:'Generic',model:'Intel N-series mini PC',type:'server',u:0,cpu:'Pentium N6005 / Celeron N5105 / Intel N100',ram:'1–2 SODIMM (16–32 GB)',mgmt:'none',check:'ping',notes:'Low-power mini PC. Many models have 2–4× 2.5GbE (Intel i225/i226) — good for pfSense/OPNsense or light Proxmox.'});
add({id:'intel-nuc',keys:['nuc','intel nuc'],vendor:'Intel',model:'NUC',type:'server',u:0,mgmt:'vPro on some models',check:'ping'});
add({id:'rpi5',keys:['raspberry pi 5','rpi5','pi 5'],vendor:'Raspberry Pi',model:'Raspberry Pi 5',type:'server',u:0,cpu:'BCM2712 4× Cortex-A76',ram:'4/8/16 GB',mgmt:'none',check:'tcp:22'});
add({id:'rpi4',keys:['raspberry pi 4','rpi4','pi 4','pi4'],vendor:'Raspberry Pi',model:'Raspberry Pi 4',type:'server',u:0,cpu:'BCM2711 4× Cortex-A72',ram:'1–8 GB',mgmt:'none',check:'tcp:22'});
add({id:'mac-mini',keys:['mac mini','macmini'],vendor:'Apple',model:'Mac mini',type:'server',u:0,mgmt:'none',check:'ping'});

/* ---------- switches ---------- */
const sw=(id,keys,vendor,model,ports,o={})=>add({id,keys,vendor,model,type:'switch',u:1,ports,...o});
sw('c2960x-48lps',['ws-c2960x-48lps-l','2960x-48lps','c2960x-48lps'],'Cisco','Catalyst 2960X-48LPS-L',48,{style:'cisco-ios',ifPrefix:'GigabitEthernet1/0/',poe:'PoE+ 370 W',uplinks:'4× 1G SFP',mgmt:'SSH/console',check:'ping',notes:'Stackable with FlexStack-Plus; interfaces renumber to Gi2/0/x on stack member 2. LAN Lite (-LL) models cannot stack.'});
sw('c2960x-48lpd',['ws-c2960x-48lpd-l','2960x-48lpd'],'Cisco','Catalyst 2960X-48LPD-L',48,{style:'cisco-ios',ifPrefix:'GigabitEthernet1/0/',poe:'PoE+ 370 W',uplinks:'2× 10G SFP+',check:'ping'});
sw('c2960x-48fpd',['ws-c2960x-48fpd-l','2960x-48fpd'],'Cisco','Catalyst 2960X-48FPD-L',48,{style:'cisco-ios',ifPrefix:'GigabitEthernet1/0/',poe:'PoE+ 740 W',uplinks:'2× 10G SFP+',check:'ping'});
sw('c2960x-48ts',['ws-c2960x-48ts-l','2960x-48ts'],'Cisco','Catalyst 2960X-48TS-L',48,{style:'cisco-ios',ifPrefix:'GigabitEthernet1/0/',uplinks:'4× 1G SFP',check:'ping'});
sw('c2960x-24ps',['ws-c2960x-24ps-l','2960x-24ps'],'Cisco','Catalyst 2960X-24PS-L',24,{style:'cisco-ios',ifPrefix:'GigabitEthernet1/0/',poe:'PoE+ 370 W',uplinks:'4× 1G SFP',check:'ping'});
sw('c2960x-24ts-ll',['ws-c2960x-24ts-ll','2960x-24ts-ll'],'Cisco','Catalyst 2960X-24TS-LL',24,{style:'cisco-ios',ifPrefix:'GigabitEthernet1/0/',uplinks:'2× 1G SFP',check:'ping',notes:'LAN Lite: no stacking, limited feature set (no IP routing).'});
sw('c2960x-24ts',['ws-c2960x-24ts-l','2960x-24ts'],'Cisco','Catalyst 2960X-24TS-L',24,{style:'cisco-ios',ifPrefix:'GigabitEthernet1/0/',uplinks:'4× 1G SFP',check:'ping'});
sw('c2960-24tt',['ws-c2960-24tt-l','2960-24tt'],'Cisco','Catalyst 2960-24TT-L',24,{style:'cisco-ios',ifPrefix:'FastEthernet0/',uplinks:'2× 1G (Gi0/1-2)',check:'ping',notes:'Access ports are 10/100 (Fa0/x).'});
sw('c2960g-24tc',['ws-c2960g-24tc-l','2960g-24tc'],'Cisco','Catalyst 2960G-24TC-L',24,{style:'cisco-ios',ifPrefix:'GigabitEthernet0/',check:'ping'});
sw('c3750x-48p',['ws-c3750x-48p','3750x-48p','3750x'],'Cisco','Catalyst 3750-X 48P',48,{style:'cisco-ios',ifPrefix:'GigabitEthernet1/0/',poe:'PoE+ (PSU dependent)',uplinks:'network module',check:'ping'});
sw('c3850-48p',['ws-c3850-48p','3850-48p','c3850'],'Cisco','Catalyst 3850-48P',48,{style:'cisco-ios',ifPrefix:'GigabitEthernet1/0/',poe:'PoE+ (PSU dependent)',uplinks:'network module (Gi/Te1/1/x)',check:'ping'});
sw('c3850-24t',['ws-c3850-24t','3850-24t'],'Cisco','Catalyst 3850-24T',24,{style:'cisco-ios',ifPrefix:'GigabitEthernet1/0/',check:'ping'});
sw('c9200l-24p',['c9200l-24p-4g','9200l-24p','c9200l'],'Cisco','Catalyst 9200L-24P-4G',24,{style:'cisco-ios',ifPrefix:'GigabitEthernet1/0/',poe:'PoE+ 370 W',uplinks:'4× 1G SFP (Gi1/1/1-4)',check:'ping'});
sw('c9300-48p',['c9300-48p','9300-48p'],'Cisco','Catalyst 9300-48P',48,{style:'cisco-ios',ifPrefix:'GigabitEthernet1/0/',poe:'UPoE/PoE+ (PSU dependent)',uplinks:'network module (Te1/1/x)',check:'ping'});
sw('c9300-24p',['c9300-24p','9300-24p'],'Cisco','Catalyst 9300-24P',24,{style:'cisco-ios',ifPrefix:'GigabitEthernet1/0/',check:'ping'});
sw('c1000-24t',['c1000-24t-4g-l','c1000-24t','c1000'],'Cisco','Catalyst 1000-24T-4G-L',24,{style:'cisco-ios',ifPrefix:'GigabitEthernet1/0/',uplinks:'4× 1G SFP',check:'ping'});
sw('aruba-6100-24g',['jl677a','6100 24g','aruba 6100','cx 6100'],'HPE Aruba','CX 6100 24G Class4 PoE',24,{style:'aruba-cx',ifPrefix:'1/1/',poe:'PoE 370 W',uplinks:'4× 10G SFP+ (1/1/25-28)',check:'ping'});
sw('aruba-6200f',['6200f','aruba 6200'],'HPE Aruba','CX 6200F',48,{style:'aruba-cx',ifPrefix:'1/1/',check:'ping'});
sw('aruba-6300',['6300m','6300f','aruba 6300'],'HPE Aruba','CX 6300',48,{style:'aruba-cx',ifPrefix:'1/1/',check:'ping'});
sw('aruba-2930f-48g',['jl260a','2930f-48g','2930f 48g'],'HPE Aruba','2930F 48G 4SFP',48,{style:'generic',ifPrefix:'',uplinks:'4× 1G SFP',check:'ping',notes:'ArubaOS-Switch (AOS-S): ports are numbered 1-48; VLANs are configured per-VLAN (tagged/untagged lists).'});
sw('aruba-2930f-24g',['jl259a','2930f-24g','2930f 24g'],'HPE Aruba','2930F 24G 4SFP',24,{style:'generic',ifPrefix:'',check:'ping',notes:'ArubaOS-Switch (AOS-S).'});
sw('aruba-2530-48g',['j9775a','2530-48g','aruba 2530'],'HPE Aruba','2530 48G',48,{style:'generic',ifPrefix:'',check:'ping'});
sw('aruba-io-1930',['instant on 1930','1930 24g','jl682a','jl683a'],'HPE Aruba','Instant On 1930',24,{style:'generic',ifPrefix:'',check:'ping',notes:'Web/cloud managed — no CLI config.'});
sw('ex2300-48p',['ex2300-48p','ex2300'],'Juniper','EX2300-48P',48,{style:'generic',ifPrefix:'ge-0/0/',poe:'PoE+ 740 W',uplinks:'4× 10G SFP+ (xe-0/1/x)',check:'ping',notes:'Junos: port 1 = ge-0/0/0 — numbering starts at 0.'});
sw('ex3400-48p',['ex3400-48p','ex3400'],'Juniper','EX3400-48P',48,{style:'generic',ifPrefix:'ge-0/0/',check:'ping',notes:'Junos numbering starts at ge-0/0/0.'});
sw('ex4300-48p',['ex4300-48p','ex4300'],'Juniper','EX4300-48P',48,{style:'generic',ifPrefix:'ge-0/0/',check:'ping'});
sw('usw-24-poe',['usw-24-poe','unifi switch 24 poe'],'Ubiquiti','UniFi USW-24-PoE',24,{style:'generic',ifPrefix:'Port ',poe:'95 W (16 PoE+ ports)',uplinks:'2× 1G SFP',check:'ping',notes:'Managed from the UniFi controller.'});
sw('usw-48-poe',['usw-48-poe'],'Ubiquiti','UniFi USW-48-PoE',48,{style:'generic',ifPrefix:'Port ',poe:'195 W',uplinks:'4× 1G SFP',check:'ping'});
sw('usw-pro-24-poe',['usw-pro-24-poe'],'Ubiquiti','UniFi USW-Pro-24-PoE',24,{style:'generic',ifPrefix:'Port ',poe:'400 W',uplinks:'2× 10G SFP+',check:'ping'});
sw('usw-pro-48-poe',['usw-pro-48-poe'],'Ubiquiti','UniFi USW-Pro-48-PoE',48,{style:'generic',ifPrefix:'Port ',poe:'600 W',uplinks:'4× 10G SFP+',check:'ping'});
sw('usw-lite-16-poe',['usw-lite-16-poe'],'Ubiquiti','UniFi USW-Lite-16-PoE',16,{style:'generic',ifPrefix:'Port ',poe:'45 W (8 PoE+)',check:'ping',u:1});
sw('usw-lite-8-poe',['usw-lite-8-poe'],'Ubiquiti','UniFi USW-Lite-8-PoE',8,{style:'generic',ifPrefix:'Port ',poe:'52 W (4 PoE+)',check:'ping',u:0});
sw('usw-aggregation',['usw-aggregation'],'Ubiquiti','UniFi USW-Aggregation',8,{style:'generic',ifPrefix:'SFP+ ',uplinks:'8× 10G SFP+',check:'ping'});
sw('usw-enterprise-24-poe',['usw-enterprise-24-poe'],'Ubiquiti','UniFi USW-Enterprise-24-PoE',24,{style:'generic',ifPrefix:'Port ',poe:'400 W (2.5GbE)',uplinks:'2× 10G SFP+',check:'ping'});
sw('crs326-24g',['crs326-24g-2s+rm','crs326-24g','crs326'],'MikroTik','CRS326-24G-2S+RM',24,{style:'generic',ifPrefix:'ether',uplinks:'2× 10G SFP+',check:'ping',notes:'RouterOS/SwOS dual boot. Ports are ether1-24.'});
sw('crs309',['crs309-1g-8s+in','crs309'],'MikroTik','CRS309-1G-8S+IN',9,{style:'generic',ifPrefix:'sfp-sfpplus',check:'ping',u:0});
sw('crs317',['crs317-1g-16s+rm','crs317'],'MikroTik','CRS317-1G-16S+RM',17,{style:'generic',ifPrefix:'sfp-sfpplus',check:'ping'});
sw('gs724t',['gs724t'],'Netgear','GS724T Smart Switch',24,{style:'generic',ifPrefix:'g',check:'ping'});
sw('gs752tp',['gs752tp'],'Netgear','GS752TP Smart Switch',48,{style:'generic',ifPrefix:'g',poe:'PoE+ 380 W',check:'ping'});
sw('gs308',['gs308','gs108','gs105','gs116'],'Netgear','GS1xx/GS3xx unmanaged',8,{style:'generic',ifPrefix:'',check:'none',u:0,notes:'Unmanaged: no IP, no VLANs — passes tagged frames but cannot assign them.'});
sw('tl-sg108e',['tl-sg108e','tl-sg105e','tl-sg116e'],'TP-Link','TL-SG108E Easy Smart',8,{style:'generic',ifPrefix:'',check:'ping',u:0,notes:'Basic 802.1Q VLANs via web UI.'});
sw('tl-sg2428p',['tl-sg2428p','sg2428p'],'TP-Link','Omada SG2428P',24,{style:'generic',ifPrefix:'gi1/0/',poe:'PoE+ 250 W',uplinks:'4× 1G SFP',check:'ping'});
sw('teg-s380',['teg-s380','teg-s350','teg-s750'],'TRENDnet','TEG-S380 / S350 unmanaged 2.5G',8,{style:'generic',ifPrefix:'',check:'none',u:0,notes:'UNMANAGED — no 802.1Q VLAN configuration and no management IP. Use the web-smart TEG-3102WS or a managed switch for trunks.'});
sw('teg-3102ws',['teg-3102ws','teg-30102ws','teg-30284'],'TRENDnet','TEG-3102WS 2.5G Web Smart',10,{style:'generic',ifPrefix:'',uplinks:'2× 10G SFP+',check:'ping',u:0,notes:'Web smart: supports 802.1Q VLANs and LACP link aggregation.'});

/* ---------- gateways / firewalls ---------- */
const fw=(id,keys,vendor,model,ports,o={})=>add({id,keys,vendor,model,type:'firewall',u:o.u??1,ports,style:'generic',check:'tcp:443',...o});
fw('netgate-1100',['netgate 1100','sg-1100'],'Netgate','1100 (pfSense+)',3,{u:0,ifPrefix:'mvneta'});
fw('netgate-2100',['netgate 2100','sg-2100'],'Netgate','2100 (pfSense+)',5,{u:0});
fw('netgate-4100',['netgate 4100'],'Netgate','4100 (pfSense+)',6,{u:0,notes:'4× 2.5GbE + 2× 1G/SFP combo ports.'});
fw('netgate-6100',['netgate 6100','sg-6100'],'Netgate','6100 (pfSense+)',8,{u:0,notes:'2× 10G SFP+, 2× 1G/SFP combo, 4× 2.5GbE.'});
fw('netgate-8200',['netgate 8200'],'Netgate','8200 (pfSense+)',8,{u:1});
fw('pfsense',['pfsense','opnsense'],'Netgate / Deciso','pfSense / OPNsense',0,{u:0,role:'Router / firewall',notes:'Web UI on 443. If virtualized on Proxmox, pass the WAN NIC through or use a dedicated bridge.'});
fw('protectli-vp2420',['vp2420','protectli'],'Protectli','Vault VP2420',4,{u:0,ifPrefix:'igc',notes:'4× 2.5GbE (Intel i225) — common pfSense/OPNsense box.'});
fw('fortigate-40f',['fortigate 40f','fg-40f'],'Fortinet','FortiGate 40F',5,{u:0,ifPrefix:'lan'});
fw('fortigate-60f',['fortigate 60f','fg-60f'],'Fortinet','FortiGate 60F',10,{u:0,ifPrefix:'internal'});
fw('fortigate-100f',['fortigate 100f','fg-100f'],'Fortinet','FortiGate 100F',22,{u:1,ifPrefix:'port'});
fw('pa-440',['pa-440'],'Palo Alto','PA-440',8,{u:0,ifPrefix:'ethernet1/'});
fw('pa-220',['pa-220'],'Palo Alto','PA-220',8,{u:0,ifPrefix:'ethernet1/'});
fw('pa-3220',['pa-3220'],'Palo Alto','PA-3220',12,{u:1,ifPrefix:'ethernet1/'});
fw('asa-5506',['asa 5506','asa5506-x','asa 5506-x'],'Cisco','ASA 5506-X',8,{u:0,ifPrefix:'GigabitEthernet1/'});
fw('fpr-1010',['fpr1010','firepower 1010'],'Cisco','Firepower 1010',8,{u:0,ifPrefix:'Ethernet1/'});
fw('tz370',['tz370','tz470','tz270'],'SonicWall','TZ series',8,{u:0,ifPrefix:'X'});
fw('udm-pro',['udm pro','udm-pro','dream machine pro'],'Ubiquiti','UniFi Dream Machine Pro',10,{u:1,ifPrefix:'Port ',notes:'8× 1GbE LAN + 1G WAN + 10G SFP+ WAN/LAN. Runs the UniFi controller (Network app on 443).'});
fw('udm-se',['udm se','udm-se','dream machine se'],'Ubiquiti','UniFi Dream Machine SE',11,{u:1,ifPrefix:'Port ',notes:'8 LAN ports (2 PoE+, 6 PoE), 2.5G WAN, 10G SFP+.'});
fw('ucg-ultra',['ucg-ultra','cloud gateway ultra'],'Ubiquiti','UniFi Cloud Gateway Ultra',5,{u:0,ifPrefix:'Port '});
fw('usg-3p',['usg-3p','usg'],'Ubiquiti','UniFi Security Gateway',3,{u:0,ifPrefix:'eth'});
add({id:'mikrotik-ccr2004',keys:['ccr2004-16g-2s+','ccr2004'],vendor:'MikroTik',model:'CCR2004-16G-2S+',type:'router',u:1,ports:18,ifPrefix:'ether',style:'generic',check:'ping'});
add({id:'mikrotik-rb5009',keys:['rb5009','rb5009ug+s+in'],vendor:'MikroTik',model:'RB5009UG+S+IN',type:'router',u:0,ports:9,ifPrefix:'ether',style:'generic',check:'ping'});
add({id:'mikrotik-hex',keys:['hex','rb750gr3'],vendor:'MikroTik',model:'hEX RB750Gr3',type:'router',u:0,ports:5,ifPrefix:'ether',style:'generic',check:'ping'});

/* ---------- storage ---------- */
const nas=(id,keys,vendor,model,u,o={})=>add({id,keys,vendor,model,type:'storage',u,check:o.check||'tcp:443',...o});
nas('truenas-mini-x',['truenas mini x','mini x+','mini x'],'iXsystems','TrueNAS Mini X / X+',0,{bays:'5× 3.5" + 2× 2.5"',role:'TrueNAS',mgmt:'IPMI',notes:'Web UI and API on 443.'});
nas('truenas-mini-r',['truenas mini r','mini r'],'iXsystems','TrueNAS Mini R',2,{bays:'12× 3.5"',role:'TrueNAS',mgmt:'IPMI'});
nas('truenas-r20',['truenas r20','r20'],'iXsystems','TrueNAS R20',2,{role:'TrueNAS'});
nas('truenas-x20',['truenas x20','x20'],'iXsystems','TrueNAS X20',2,{role:'TrueNAS Enterprise',notes:'Dual controller (HA).'});
nas('truenas-m30',['truenas m30','m30'],'iXsystems','TrueNAS M30',3,{role:'TrueNAS Enterprise'});
nas('truenas',['truenas','truenas scale','truenas core','freenas'],'iXsystems','TrueNAS (DIY)',0,{role:'TrueNAS',notes:'Connect it on the Integrations tab to pull pools, datasets, shares and disks.'});
nas('ds923p',['ds923+','ds923'],'Synology','DS923+',0,{bays:'4× 3.5"',check:'tcp:5001',notes:'DSM on 5000 (http) / 5001 (https).'});
nas('ds920p',['ds920+','ds920'],'Synology','DS920+',0,{bays:'4× 3.5"',check:'tcp:5001'});
nas('ds220p',['ds220+','ds220'],'Synology','DS220+',0,{bays:'2× 3.5"',check:'tcp:5001'});
nas('ds1621p',['ds1621+','ds1621'],'Synology','DS1621+',0,{bays:'6× 3.5"',check:'tcp:5001'});
nas('ds1821p',['ds1821+','ds1821'],'Synology','DS1821+',0,{bays:'8× 3.5"',check:'tcp:5001'});
nas('rs1221p',['rs1221+','rs1221'],'Synology','RackStation RS1221+',2,{bays:'8× 3.5"',check:'tcp:5001'});
nas('rs422p',['rs422+','rs422'],'Synology','RackStation RS422+',1,{bays:'4× 3.5"',check:'tcp:5001'});
nas('rs2421p',['rs2421+','rs2421'],'Synology','RackStation RS2421+',2,{bays:'12× 3.5"',check:'tcp:5001'});
nas('rs3621xs',['rs3621xs+','rs3621'],'Synology','RackStation RS3621xs+',2,{bays:'12× 3.5"',check:'tcp:5001'});
nas('qnap-ts453d',['ts-453d','ts453d'],'QNAP','TS-453D',0,{bays:'4× 3.5"',check:'tcp:443'});
nas('qnap-ts873a',['ts-873a','ts873a'],'QNAP','TS-873A',0,{bays:'8× 3.5"',check:'tcp:443'});
nas('me5012',['me5012','me4012','powervault me'],'Dell','PowerVault ME4012/ME5012',2,{bays:'12× 3.5"',check:'tcp:443',mgmt:'dual controller web UI'});

/* ---------- power ---------- */
const ups=(id,keys,vendor,model,u,o={})=>add({id,keys,vendor,model,type:'ups',u,check:o.check||'none',...o});
ups('smt1500rm2u',['smt1500rm2u','smt1500rmi2u','smt1500rm2uc'],'APC','Smart-UPS SMT1500RM2U',2,{power:'1500 VA / 1000 W',notes:'Add a network card (AP9640/AP9631) for SNMP/web monitoring, or USB to a host running NUT/apcupsd.'});
ups('smt3000rm2u',['smt3000rm2u','smt3000rmi2u'],'APC','Smart-UPS SMT3000RM2U',2,{power:'3000 VA / 2700 W'});
ups('smx1500rm2u',['smx1500rm2u','smx1500'],'APC','Smart-UPS SMX1500RM2U',2,{power:'1500 VA / 1200 W'});
ups('srt3000',['srt3000rmxla','srt3000'],'APC','Smart-UPS SRT 3000',2,{power:'3000 VA / 2700 W, online double conversion'});
ups('smt1500',['smt1500','smt1500c'],'APC','Smart-UPS SMT1500 (tower)',0,{power:'1500 VA / 1000 W',notes:'USB/serial to a host (NUT or apcupsd), or SmartSlot network card.'});
ups('br1500',['br1500g','br1500ms','back-ups pro 1500','bx1500'],'APC','Back-UPS Pro 1500',0,{power:'1500 VA',notes:'USB only — monitor from a host with NUT/apcupsd (e.g. the Proxmox host).'});
ups('cp1500',['cp1500pfclcd','cp1500avrlcd','cp1500'],'CyberPower','CP1500 series (tower)',0,{power:'1500 VA / 900–1000 W',notes:'USB — use NUT or PowerPanel.'});
ups('or1500',['or1500lcdrm1u','or1500'],'CyberPower','OR1500LCDRM1U',1,{power:'1500 VA / 900 W'});
ups('eaton-5px',['5px1500rt','5px 1500','eaton 5px'],'Eaton','5PX 1500 RT',2,{power:'1500 VA'});
add({id:'apc-ap7900',keys:['ap7900','ap7900b','ap7901','ap7901b'],vendor:'APC',model:'Switched Rack PDU AP7900B/AP7901B',type:'pdu',u:1,ports:8,check:'tcp:80',notes:'Switched PDU with web/SNMP management — per-outlet on/off.'});
add({id:'apc-ap8941',keys:['ap8941','ap8959'],vendor:'APC',model:'Switched Rack PDU 2G (0U)',type:'pdu',u:0,ports:24,check:'tcp:443'});
add({id:'pdu-basic',keys:['power strip','basic pdu','tripp lite pdu','pdumh15'],vendor:'Generic',model:'Basic rack PDU',type:'pdu',u:1,ports:8,check:'none'});

/* ---------- passive ---------- */
add({id:'pp-24',keys:['patch panel 24','24 port patch panel','24-port patch panel'],vendor:'Generic',model:'24-port patch panel',type:'patch-panel',u:1,ports:24,check:'none'});
add({id:'pp-48',keys:['patch panel 48','48 port patch panel','48-port patch panel'],vendor:'Generic',model:'48-port patch panel',type:'patch-panel',u:2,ports:48,check:'none'});
add({id:'cable-mgmt',keys:['cable manager','cable management','brush panel'],vendor:'Generic',model:'Cable manager / brush panel',type:'other',u:1,check:'none'});
add({id:'shelf',keys:['rack shelf','cantilever shelf','vented shelf'],vendor:'Generic',model:'Rack shelf',type:'other',u:1,check:'none',notes:'Use for towers and mini PCs; set U size to the shelf plus clearance.'});

/* ---------- wireless / IoT ---------- */
const iot=(id,keys,vendor,model,type,o={})=>add({id,keys,vendor,model,type,u:0,check:'ping',...o});
iot('u6-lite',['u6 lite','u6-lite'],'Ubiquiti','UniFi U6 Lite','ap',{poe:'802.3af',protocol:'Wi-Fi 6'});
iot('u6-pro',['u6 pro','u6-pro'],'Ubiquiti','UniFi U6 Pro','ap',{poe:'802.3at (PoE+)',protocol:'Wi-Fi 6'});
iot('u6-plus',['u6+','u6 plus'],'Ubiquiti','UniFi U6+','ap',{poe:'802.3af',protocol:'Wi-Fi 6'});
iot('u6-lr',['u6 lr','u6-lr'],'Ubiquiti','UniFi U6 LR','ap',{poe:'802.3at (PoE+)',protocol:'Wi-Fi 6'});
iot('u7-pro',['u7 pro','u7-pro'],'Ubiquiti','UniFi U7 Pro','ap',{poe:'802.3at (PoE+)',protocol:'Wi-Fi 7',notes:'2.5GbE uplink.'});
iot('uap-ac-pro',['uap-ac-pro','ac pro'],'Ubiquiti','UniFi AP AC Pro','ap',{poe:'802.3af or 48V passive',protocol:'Wi-Fi 5'});
iot('uap-ac-lite',['uap-ac-lite','ac lite'],'Ubiquiti','UniFi AP AC Lite','ap',{poe:'24V passive / 802.3af',protocol:'Wi-Fi 5'});
iot('eap670',['eap670','eap650','eap245','eap225'],'TP-Link','Omada EAP','ap',{poe:'802.3af/at',protocol:'Wi-Fi 5/6'});
iot('ap22',['instant on ap22','ap22','ap25'],'HPE Aruba','Instant On AP22/AP25','ap',{poe:'802.3af/at',protocol:'Wi-Fi 6'});
iot('r610',['ruckus r610','r610','r650'],'Ruckus','R610/R650','ap',{poe:'802.3at',protocol:'Wi-Fi 5/6'});
iot('annke-dw81kn',['dw81kn','annke dvr','annke'],'Annke','DW81KN 8-ch DVR','camera',{check:'tcp:80',protocol:'Ethernet',notes:'Hikvision-based firmware: web on 80, RTSP on 554, SDK on 8000. Block internet access on the cameras VLAN.'});
iot('hikvision-cam',['ds-2cd','hikvision'],'Hikvision','DS-2CD IP camera','camera',{check:'tcp:554',protocol:'Ethernet PoE',poe:'802.3af',notes:'RTSP 554, web 80/443, ONVIF.'});
iot('reolink-cam',['rlc-510a','rlc-810a','rlc-520a','reolink'],'Reolink','RLC PoE camera','camera',{check:'tcp:554',protocol:'Ethernet PoE',poe:'802.3af'});
iot('unifi-g4',['g4 bullet','g4 dome','g5 bullet','g5 flex','uvc-g4'],'Ubiquiti','UniFi Protect camera','camera',{check:'ping',protocol:'Ethernet PoE',poe:'802.3af'});
iot('ring',['ring doorbell','ring video doorbell','ring'],'Amazon','Ring doorbell/camera','camera',{protocol:'Wi-Fi (cloud)',check:'ping',notes:'Cloud-dependent: needs internet from the IoT VLAN.'});
iot('ecobee',['ecobee'],'ecobee','ecobee thermostat','iot',{protocol:'Wi-Fi (cloud)',notes:'HomeKit capable; needs internet.'});
iot('kwikset-halo',['kwikset halo','halo'],'Kwikset','Halo Wi-Fi lock','iot',{protocol:'Wi-Fi 2.4 GHz'});
iot('kwikset-aura',['kwikset aura','aura'],'Kwikset','Aura Bluetooth lock','iot',{protocol:'Bluetooth / HomeKit',check:'none'});
iot('hue-bridge',['hue bridge','philips hue'],'Signify','Philips Hue Bridge','iot',{protocol:'Zigbee hub (Ethernet)',check:'tcp:443',notes:'Local API on 443; HomeKit/Matter bridge.'});
iot('ha-green',['home assistant green','home assistant yellow','ha green','ha yellow','home assistant'],'Nabu Casa','Home Assistant','iot',{protocol:'Ethernet (Zigbee/Thread on Yellow)',check:'tcp:8123',notes:'Web UI on 8123.'});
iot('shelly',['shelly','shelly plus','shelly plug'],'Shelly','Shelly relay/plug','iot',{protocol:'Wi-Fi (ESP32), local HTTP + MQTT',check:'tcp:80'});
iot('kasa',['kasa','hs103','hs105','kp115','ep10'],'TP-Link','Kasa smart plug','iot',{protocol:'Wi-Fi 2.4 GHz',check:'ping'});
iot('sonoff-zbdongle',['sonoff zigbee','zbdongle','sonoff'],'SONOFF','Zigbee 3.0 USB dongle','iot',{protocol:'Zigbee (USB to a host)',check:'none',notes:'Pass the USB device through to the Home Assistant / Zigbee2MQTT VM.'});
iot('nest',['nest thermostat','nest hub','nest'],'Google','Nest device','iot',{protocol:'Wi-Fi (cloud)'});
iot('echo',['echo dot','amazon echo','echo show'],'Amazon','Echo','iot',{protocol:'Wi-Fi (cloud)'});
iot('apple-tv',['apple tv','homepod'],'Apple','Apple TV / HomePod','iot',{protocol:'Wi-Fi/Ethernet — HomeKit hub, Thread border router',notes:'Needs mDNS (Avahi reflector) to talk to HomeKit devices across VLANs.'});
iot('sonos',['sonos'],'Sonos','Sonos speaker','iot',{protocol:'Wi-Fi/Ethernet',notes:'Needs mDNS/SSDP across VLANs.'});

/* ---------- software / services (for VMs, LXCs and apps) ---------- */
const SVC=[
 {keys:['plex'],name:'Plex Media Server',port:32400,notes:'GPU transcoding needs the GPU passed through (or /dev/dri for LXC).'},
 {keys:['jellyfin'],name:'Jellyfin',port:8096},
 {keys:['emby'],name:'Emby',port:8096},
 {keys:['ollama'],name:'Ollama',port:11434,notes:'API on 11434.'},
 {keys:['open webui','openwebui'],name:'Open WebUI',port:8080},
 {keys:['homebridge'],name:'Homebridge',port:8581,notes:'Needs mDNS reflection to reach HomeKit devices on other VLANs.'},
 {keys:['home assistant','homeassistant','hass','haos'],name:'Home Assistant',port:8123},
 {keys:['pihole','pi-hole'],name:'Pi-hole',port:80},
 {keys:['adguard'],name:'AdGuard Home',port:3000},
 {keys:['unifi','unifi controller','unifi network'],name:'UniFi Network',port:8443},
 {keys:['pfsense','opnsense'],name:'pfSense / OPNsense',port:443},
 {keys:['truenas'],name:'TrueNAS',port:443},
 {keys:['proxmox backup','pbs'],name:'Proxmox Backup Server',port:8007},
 {keys:['proxmox','pve'],name:'Proxmox VE',port:8006},
 {keys:['portainer'],name:'Portainer',port:9443},
 {keys:['docker'],name:'Docker host',port:22},
 {keys:['nextcloud'],name:'Nextcloud',port:443},
 {keys:['nginx proxy manager','npm'],name:'Nginx Proxy Manager',port:81},
 {keys:['traefik'],name:'Traefik',port:443},
 {keys:['grafana'],name:'Grafana',port:3000},
 {keys:['influxdb','influx'],name:'InfluxDB',port:8086},
 {keys:['prometheus'],name:'Prometheus',port:9090},
 {keys:['uptime kuma','uptime-kuma'],name:'Uptime Kuma',port:3001},
 {keys:['frigate'],name:'Frigate NVR',port:5000},
 {keys:['zigbee2mqtt','z2m'],name:'Zigbee2MQTT',port:8080},
 {keys:['mosquitto','mqtt'],name:'Mosquitto MQTT',port:1883},
 {keys:['node-red','nodered'],name:'Node-RED',port:1880},
 {keys:['wireguard','wg-easy'],name:'WireGuard',port:51821},
 {keys:['vaultwarden','bitwarden'],name:'Vaultwarden',port:443},
 {keys:['gitea','forgejo'],name:'Gitea / Forgejo',port:3000},
 {keys:['netmap'],name:'NetMap',port:8088},
 {keys:['net planner','netplanner'],name:'Net Planner server',port:8770},
 {keys:['windows server','active directory','domain controller','dc-'],name:'Windows Server',port:3389},
 {keys:['ubuntu','debian','linux'],name:'Linux',port:22}
];

/* ---------- MAC vendor prefixes (OUI) — best guess ---------- */
const OUI={};
const o=(v,list)=>list.split(' ').forEach(p=>OUI[p]=v);
o('Raspberry Pi','B827EB DCA632 E45F01 D83ADD 2CCF67');
o('Ubiquiti','24A43C 44D9E7 687251 788A20 802AA8 F09FC2 FCECDA 7483C2 E063DA 18E829');
o('Espressif (ESP8266/ESP32 IoT)','240AC4 30AEA4 84F3EB A4CF12 BCDDC2 CC50E3 ECFABC 3C71BF 246F28 8CAAB5 98F4AB C44F33 5CCF7F 600194 18FE34 2C3AE8 483FDA 08B61F 7C9EBD');
o('Philips Hue (Signify)','001788 ECB5FA');
o('Google / Nest','18B430 F4F5D8 546009');
o('Amazon','44650D 6854FD F0272D 74C246 FC65DE');
o('Sonos','000E58 5CAAFD 949F3E B8E937 48A6B8 347E5C');
o('Hikvision','4419B6 BCAD28 C056E3 4CBD8F 2857BE A41437 54C415');
o('Dahua','3CEF8C 9002A9 E0508B 4C11BF 14A78B');
o('Reolink','EC71DB');
o('TP-Link','50C7BF B0BE76 1C3BF3 60A4B7 98DAC4 54AF97 AC84C6');
o('Dell','001422 180373 1866DA 24B6FD 3417EB 44A842 5CF9DD 74867A 847BEB B083FE B82A72 D4AE52 F8B156 001EC9 141877 509A4C 90B11C D09466 E4434B F48E38 4CD98F');
o('HPE / HP','0017A4 3CD92B 9457A5 9C8E99 A0D3C1 B499BA ECB1D7 1C98EC 48DF37 98F2B3 D4C9EF 5CB901 70106F');
o('Cisco','00000C F872EA 5897BD 0026CB');
o('Supermicro','002590 0CC47A AC1F6B 3CECEF');
o('Synology','001132 9009D0');
o('QNAP','00089B 245EBE');
o('HPE Aruba','000B86 204C03 24DEC6 94B40F D8C7C8 6CF37F 703A0E');
o('Juniper','000585 288A1C');
o('Fortinet','00090F 704CA5 906CAC E81CBA');
o('MikroTik','4C5E0C 64D154 6C3B6B B869F4 CC2DE0 D4CA6D E48D8C 488F5A 2CC81B 085531 18FD74 DC2C6E');
o('Proxmox VM (virtio)','BC2411');
o('QEMU/KVM VM','525400');
o('VMware VM','005056 000C29');
o('Hyper-V VM','00155D');
o('VirtualBox VM','080027');
o('ecobee','446132');
o('Wyze','2CAA8E D03F27 7C78B2');
o('Roku','B0A737 DC3A5E CC6DA0');
o('Brother printer','008077');

/* ---------- lookup ---------- */
const norm=s=>String(s||'').toLowerCase().replace(/[\s_]+/g,' ').trim();
const squash=s=>norm(s).replace(/[\s\-.]/g,'');
const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const wordIn=(t,k)=>k.length>=2&&new RegExp('(^|[^a-z0-9])'+reEsc(k)+'($|[^a-z0-9])').test(t);
function lookup(text){
  const t=norm(text),q=squash(text);if(q.length<2)return null;
  let best=null,score=0;
  for(const e of K){for(const k of e.keys){const ks=squash(k);if(ks.length<2)continue;
    let s=0;
    if(q===ks)s=100+ks.length;
    else if((ks.length>=5&&q.includes(ks))||wordIn(t,norm(k)))s=50+ks.length;
    else if(q.length>=4&&ks.startsWith(q))s=20+q.length;
    if(s>score){score=s;best=e}}}
  if(!best)best=family(t);
  return best?Object.assign({confidence:score>=100?'exact':score>=50?'match':score?'partial':'family'},best):null;
}
/* family rules for models not listed one by one */
function family(t){
  let m;
  if((m=t.match(/\b(?:ws-)?c?(2960x?|2960g|3560|3650|3750x?|3850|9200l?|9300|1000)-(\d{2})/))){
    const n=+m[2];const poe=/-(\d{2})(l?p|f)/.test(t);
    return {id:'cisco-family',vendor:'Cisco',model:'Catalyst '+m[1].toUpperCase()+'-'+n,type:'switch',u:1,ports:n,style:'cisco-ios',ifPrefix:m[1]==='2960'&&/tt/.test(t)?'FastEthernet0/':'GigabitEthernet1/0/',poe:poe?'PoE (check model)':'',check:'ping',notes:'Matched by model family — check uplinks and PoE on the label.'};
  }
  if((m=t.match(/\b(?:poweredge )?([rt])(\d{3,4})(xd)?\b/))&&/^[67]\d|^[34]\d/.test(m[2])){
    const u=m[1]==='t'?0:(m[2][0]==='7'||m[2][0]==='5'?2:1);
    return {id:'dell-family',vendor:'Dell',model:'PowerEdge '+m[1].toUpperCase()+m[2]+(m[3]||''),type:'server',u,mgmt:'iDRAC',check:'ping',notes:'Matched by Dell naming (R6xx = 1U, R7xx = 2U).'};
  }
  if((m=t.match(/\b(dl|ml)(\d{2,3})\s*(gen\s*\d+)?/))){
    const u=m[1]==='ml'?0:(m[2].startsWith('38')?2:1);
    return {id:'hpe-family',vendor:'HPE',model:'ProLiant '+m[1].toUpperCase()+m[2]+(m[3]?' '+m[3].replace(/\s+/,''):''),type:'server',u,mgmt:'iLO',check:'ping'};
  }
  if((m=t.match(/\busw[- ]?(pro[- ])?(\d{1,2})/)))return {id:'unifi-family',vendor:'Ubiquiti',model:'UniFi Switch '+m[2],type:'switch',u:+m[2]>=16?1:0,ports:+m[2],style:'generic',ifPrefix:'Port ',check:'ping'};
  if((m=t.match(/\b(ds|rs)(\d{3,4})\+?/)))return {id:'synology-family',vendor:'Synology',model:(m[1]==='rs'?'RackStation ':'DiskStation ')+m[1].toUpperCase()+m[2],type:'storage',u:m[1]==='rs'?(+m[2]>=1200?2:1):0,check:'tcp:5001'};
  return null;
}
function search(text,limit=8){
  const q=squash(text);if(q.length<2)return [];
  const res=[];
  for(const e of K){let s=0;for(const k of e.keys){const ks=squash(k);if(ks===q)s=Math.max(s,100);else if(ks.includes(q))s=Math.max(s,60-ks.length/10);else if(q.includes(ks)&&ks.length>=5)s=Math.max(s,40)}
    if(!s&&squash(e.model).includes(q))s=30;if(!s&&squash(e.vendor+e.model).includes(q))s=20;if(s)res.push([s,e])}
  res.sort((a,b)=>b[0]-a[0]);
  const out=res.slice(0,limit).map(x=>x[1]);
  if(!out.length){const f=family(norm(text));if(f)out.push(f)}
  return out;
}
function service(text){
  const t=norm(text);if(!t)return null;
  for(const s of SVC)for(const k of s.keys)if(wordIn(t,k)||(k.length>=6&&t.replace(/[\s\-_]/g,'').includes(k.replace(/[\s\-_]/g,''))))return s;
  return null;
}
function macVendor(mac){
  const h=String(mac||'').toUpperCase().replace(/[^0-9A-F]/g,'');if(h.length<6)return '';
  if(parseInt(h[1],16)&2)return 'Private / randomized MAC (phone, tablet or VM)';
  return OUI[h.slice(0,6)]||'';
}
/* What a device with these open ports probably is (network scan). */
function guessFromPorts(ports,vendor){
  const p=new Set(ports||[]);const v=String(vendor||'').toLowerCase();
  if(p.has(8006))return {type:'server',role:'Proxmox VE host',check:'tcp:8006'};
  if(p.has(8007))return {type:'server',role:'Proxmox Backup Server',check:'tcp:8007'};
  if(p.has(8123))return {type:'iot',role:'Home Assistant',check:'tcp:8123'};
  if(p.has(5000)&&p.has(5001)||v.includes('synology'))return {type:'storage',role:'Synology NAS',check:'tcp:5001'};
  if(p.has(554)||v.includes('hikvision')||v.includes('dahua')||v.includes('reolink'))return {type:'camera',role:'IP camera / NVR',check:p.has(554)?'tcp:554':'ping'};
  if(p.has(1883))return {type:'iot',role:'MQTT broker',check:'tcp:1883'};
  if(p.has(9100))return {type:'other',role:'Printer',check:'tcp:9100'};
  if(p.has(32400))return {type:'server',role:'Plex',check:'tcp:32400'};
  if(p.has(445)&&p.has(443))return {type:'storage',role:'NAS / file server',check:'tcp:445'};
  if(v.includes('ubiquiti'))return {type:'ap',role:'UniFi device',check:'ping'};
  if(v.includes('espressif')||v.includes('shelly')||v.includes('wyze')||v.includes('ecobee')||v.includes('hue')||v.includes('nest')||v.includes('amazon')||v.includes('sonos')||v.includes('tp-link')||v.includes('roku'))return {type:'iot',role:'Smart home device',check:'ping'};
  if(v.includes(' vm')||v.includes('vm ')||v.endsWith('vm')||v.includes('virtio'))return {type:'server',role:'Virtual machine',check:'ping'};
  if(p.has(22)&&!p.has(80)&&!p.has(443))return {type:'server',role:'Linux host (SSH)',check:'tcp:22'};
  if(p.has(3389))return {type:'pc',role:'Windows (RDP)',check:'tcp:3389'};
  if(p.has(80)||p.has(443))return {type:'other',role:'Web-managed device',check:p.has(443)?'tcp:443':'tcp:80'};
  return {type:'other',role:'',check:'ping'};
}

/* ---------- scanned text → useful fields ---------- */
const MAC_RE=/\b([0-9A-F]{2}[:\-]){5}[0-9A-F]{2}\b|\b[0-9A-F]{4}\.[0-9A-F]{4}\.[0-9A-F]{4}\b/gi;
const IP_RE=/\b(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\b/g;
function fmtMac(m){const h=m.toUpperCase().replace(/[^0-9A-F]/g,'');return h.match(/../g).join(':')}
function parseScan(strings){
  const lines=[].concat(strings||[]).flatMap(s=>String(s).split(/\r?\n/)).map(s=>s.trim()).filter(Boolean);
  const all=lines.join('\n');
  const out={macs:[],ips:[],serials:[],models:[],assetTags:[],raw:lines};
  const push=(arr,v)=>{if(v&&!arr.includes(v))arr.push(v)};
  (all.match(MAC_RE)||[]).forEach(m=>push(out.macs,fmtMac(m)));
  // bare 12-hex after a MAC label
  lines.forEach(l=>{const m=l.match(/\b(?:mac|ethernet|eth\d?|hw ?addr)\b[^0-9A-F]*([0-9A-F]{12})\b/i);if(m)push(out.macs,fmtMac(m[1]))});
  (all.match(IP_RE)||[]).forEach(ip=>push(out.ips,ip));
  lines.forEach(l=>{
    let m;
    if((m=l.match(/(?:service\s*tag|svc\s*tag|s\/n|sn|serial(?:\s*(?:no|number|#))?|ser\.?\s*no)\s*[:#.\-]?\s*([A-Z0-9\-]{5,20})/i)))push(out.serials,m[1].toUpperCase());
    if((m=l.match(/(?:asset(?:\s*tag)?|inv(?:entory)?(?:\s*(?:no|#))?)\s*[:#\-]?\s*([A-Z0-9\-]{3,20})/i)))push(out.assetTags,m[1].toUpperCase());
    if((m=l.match(/\b([A-Z]{3}\d{4}[A-Z0-9]{4})\b/)))push(out.serials,m[1]); // Cisco serial (FOC1234ABCD)
    if((m=l.match(/(?:pid|model(?:\s*(?:no|number))?|m\/n|p\/n)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-+\/ ]{2,30})/i))){const e=lookup(m[1]);push(out.models,JSON.stringify(e?{text:m[1].trim(),kb:e.id}:{text:m[1].trim()}))}
  });
  // barcodes with only a serial-looking token
  lines.forEach(l=>{if(/^[A-Z0-9]{7}$/.test(l)&&/\d/.test(l)&&/[A-Z]/.test(l))push(out.serials,l)});
  // try every line against the knowledge base
  const seen=new Set();
  lines.forEach(l=>{const e=lookup(l);if(e&&e.confidence!=='partial'&&!seen.has(e.id)){seen.add(e.id);push(out.models,JSON.stringify({text:l,kb:e.id}))}});
  out.models=out.models.map(s=>JSON.parse(s));
  return out;
}
const byId=id=>K.find(e=>e.id===id)||null;

window.KB={entries:K,lookup,search,service,macVendor,guessFromPorts,parseScan,byId,services:SVC,fmtMac};
})();
