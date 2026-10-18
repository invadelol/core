/** Local-only screenshot fixtures. Never used to authenticate a production request. */
import {readFileSync,writeFileSync} from 'node:fs'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {Client} from 'pg'
import {Encryption} from '@adonisjs/encryption'
import {CookieClient} from '@adonisjs/http-server'
const env=Object.fromEntries(readFileSync('.env','utf8').split('\n').map(l=>l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(([,k,v])=>[k,v.replace(/^(['"])(.*)\1$/,'$2')]))
if(env.NODE_ENV!=='development'||env.DB_DATABASE!=='invade_accounts_design_v2'||!['localhost','127.0.0.1'].includes(env.DB_HOST))throw Error('This seed requires the isolated accounts development database.')
const db=new Client({host:env.DB_HOST,port:+env.DB_PORT,user:env.DB_USER,password:env.DB_PASSWORD,database:env.DB_DATABASE});await db.connect()
const hash=t=>createHash('sha256').update(t).digest('hex')
const user='a3602d0a-1290-4f0d-b1f2-935666430ec6'
await db.query(`INSERT INTO invade_user (id,provider,subject,display_name) VALUES ($1,'discord','local-accounts-design','Aster') ON CONFLICT (id) DO NOTHING`,[user])
// Fictional demo accounts already used by the site, supplemented by a few teammates.
const me=(await db.query("SELECT * FROM riot_player WHERE game_name='Briar Signal' AND tag_line='5555' LIMIT 1")).rows[0]
const specs=[
 {id:me?.puuid||'accounts-design-lumen',name:me?.game_name||'Lumen',tag:me?.tag_line||'EUW',icon:me?.profile_icon_id||6634,rank:'DIAMOND',division:'II',lp:64},
 {id:'accounts-design-afterglow',name:'Afterglow',tag:'MID',icon:5367,rank:'EMERALD',division:'I',lp:38},
 {id:'accounts-design-lowlight',name:'Lowlight',tag:'ALT',icon:5212,rank:'PLATINUM',division:'II',lp:71},
 {id:'accounts-design-juniper',name:'Juniper',tag:'TOP',icon:4568},
 {id:'accounts-design-moss',name:'Moss',tag:'JG',icon:29},
 {id:'accounts-design-vesper',name:'Vesper',tag:'MID',icon:4648},
 {id:'accounts-design-cinder',name:'Cinder',tag:'ADC',icon:5891},
 {id:'accounts-design-wisp',name:'Wisp',tag:'SUP',icon:6634},
 {id:'accounts-design-nori',name:'Nori',tag:'DUO',icon:5367},
]
for(const p of specs){if(p.id.startsWith('accounts-design-'))p.id=p.id.padEnd(78,'x');await db.query(`INSERT INTO riot_player(puuid,game_name,tag_line,platform,profile_icon_id,summoner_level,last_refresh_at) VALUES($1,$2,$3,'EUW1',$4,284,now()) ON CONFLICT(puuid) DO NOTHING`,[p.id,p.name,p.tag,p.icon]);if(p.rank&&!me?.puuid?.includes(p.id))await db.query(`INSERT INTO riot_rank(puuid,queue_type,tier,division,league_points,wins,losses,fetched_at) VALUES($1,'RANKED_SOLO_5x5',$2,$3,$4,78,65,now())`,[p.id,p.rank,p.division,p.lp])}
const registered=await fetch('http://127.0.0.1:3341/api/desktop/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app:'0.3.3',os:'macos'})});if(!registered.ok)throw Error('Cannot register the local preview device: '+registered.status)
const device=await registered.json()
await db.query('INSERT INTO invade_device_user(device_id,user_id) VALUES($1,$2)',[device.deviceId,user])
for(const p of specs.slice(0,3))await db.query('INSERT INTO invade_owned_account(user_id,puuid,device_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[user,p.id,device.deviceId])
await db.query('UPDATE invade_user SET main_puuid=$1 WHERE id=$2',[specs[0].id,user])
const folders=[{id:'0b8fbf91-1c77-49a3-a2e9-326b21e26dc9',name:'Clash team'},{id:'28bc2887-4fdc-4f5d-bf95-019bb48ec1cb',name:'Duo'}]
for(const f of folders)await db.query('INSERT INTO invade_favorite_folder(id,user_id,name) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',[f.id,user,f.name])
for(const [i,p] of specs.slice(3).entries())await db.query('INSERT INTO invade_profile_favorite(user_id,puuid,folder_id) VALUES($1,$2,$3) ON CONFLICT(user_id,puuid) DO UPDATE SET folder_id=excluded.folder_id',[user,p.id,folders[i<5?0:1].id])
const token=randomBytes(32).toString('base64url');await db.query("INSERT INTO invade_session(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')",[hash(token),user])
const cookies=new CookieClient(new Encryption({secret:env.APP_KEY}))
writeFileSync('../accounts-preview.json',JSON.stringify({cookie:cookies.sign('invade_session',token),user,profiles:specs,device,folders},{},2),{mode:0o600})
await db.end();console.log('Created fictional account fixtures and a local-only screenshot session.')
