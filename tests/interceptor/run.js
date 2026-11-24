const origFetch=globalThis.fetch.bind(globalThis);
const http=require('./http.bundle.js');
const jwt=require(process.env.SERVER_DIR+'/node_modules/jsonwebtoken');
const B=process.env.BASE_URL||'http://localhost:3099'; let pass=0,fail=0;
const ok=(n,c,x)=>{c?pass++:fail++;console.log(c?'PASS':'FAIL',n,c?'':x??'')};
const mem=()=>globalThis.__mem;
const refreshCalls=[]; 
globalThis.fetch=(u,i)=>{ if(String(u).endsWith('/auth/refresh')) refreshCalls.push(Date.now()); return origFetch(u,i); };
(async()=>{
  http.installAuthInterceptor();
  const email=`int${Date.now()}@x.com`;
  const reg=await (await fetch(B+'/users/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({firstName:'I',lastName:'I',email,password:'password-I-1'})})).json();
  const id=reg.user.id; const secret='testsecret-testsecret-123456';
  const expiredTok=()=>jwt.sign({id},secret,{expiresIn:-5});
  const setup=(tok)=>{mem().set('authToken',tok);mem().set('refreshToken',reg.refreshToken);};
  globalThis.__mem=globalThis.__mem||new Map();
  // 1: expired access token -> transparent refresh + retry
  setup(expiredTok()); refreshCalls.length=0;
  let r=await fetch(B+'/users/me',{headers:{Authorization:`Bearer ${mem().get('authToken')}`}});
  ok('expired token: request silently succeeds after refresh',r.status===200,r.status);
  const expiredUsed=mem().get('authToken');
  ok('stored access token is a valid (non-expired) JWT after refresh',(()=>{try{jwt.verify(expiredUsed,secret);return true}catch{return false}})());
  ok('stored refresh token rotated',mem().get('refreshToken')!==reg.refreshToken);
  ok('exactly one refresh call',refreshCalls.length===1,refreshCalls.length);
  // 2: three parallel requests, all expired -> single refresh, all succeed
  const rt=mem().get('refreshToken'); const exp=expiredTok(); mem().set('authToken',exp); refreshCalls.length=0;
  const rs=await Promise.all([1,2,3].map(()=>fetch(B+'/users/me',{headers:{Authorization:`Bearer ${exp}`}})));
  ok('3 parallel expired requests all succeed',rs.every(x=>x.status===200),rs.map(x=>x.status));
  ok('parallel requests share ONE refresh',refreshCalls.length===1,refreshCalls.length);
  // 3: POST with body is retried with its body intact
  mem().set('authToken',expiredTok());
  const food=await fetch(B+`/users/${id}/calendar/foods`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${mem().get('authToken')}`},body:JSON.stringify({date:'2026-05-05',food:{name:'retry-me'}})});
  const fj=await food.json();
  ok('POST retried with body after refresh',food.status===200&&fj.foods.some(f=>f.name==='retry-me'),[food.status]);
  // 4: refresh token revoked -> session ended (storage wiped, navigated to Welcome)
  const cur=mem().get('refreshToken');
  await origFetch(B+'/users/logout',{method:'POST',headers:{'content-type':'application/json',Authorization:`Bearer ${mem().get('authToken')}`},body:JSON.stringify({refreshToken:cur})});
  mem().set('authToken',expiredTok()); globalThis.__resets=[];
  r=await fetch(B+'/users/me',{headers:{Authorization:`Bearer ${mem().get('authToken')}`}});
  ok('revoked session: original 401 surfaced',r.status===401,r.status);
  ok('revoked session: account data wiped',!mem().has('authToken')&&!mem().has('refreshToken'));
  ok('revoked session: sent to Welcome with sessionExpired',globalThis.__resets.length===1&&globalThis.__resets[0].routes[0].name==='Welcome'&&globalThis.__resets[0].routes[0].params.sessionExpired===true,JSON.stringify(globalThis.__resets));
  // 5: wrong-credentials login is NOT treated as an expired session
  mem().set('authToken','keepme'); globalThis.__resets=[];
  r=await fetch(B+'/users/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'wrong-wrong-1'})});
  ok('login failure does not trigger session expiry',globalThis.__resets.length===0&&mem().get('authToken')==='keepme');
  // 6: unauthenticated call (no Authorization) untouched
  r=await fetch(B+'/users/me'); ok('no-auth 401 passes through untouched',r.status===401&&globalThis.__resets.length===0);
  // 7: network failure while refreshing keeps the session (user is NOT logged out)
  const goodRefresh=reg.refreshToken; // may be revoked by now, irrelevant: request never reaches server
  mem().set('authToken',expiredTok()); mem().set('refreshToken','keep-this-refresh-token'); globalThis.__resets=[];
  globalThis.__failRefresh=true; globalThis.__n=0;
  r=await fetch(B+'/users/me',{headers:{Authorization:`Bearer ${mem().get('authToken')}`}});
  globalThis.__failRefresh=false;
  ok('offline refresh: original 401 surfaced',r.status===401,r.status);
  ok('offline refresh: session NOT wiped',mem().get('refreshToken')==='keep-this-refresh-token'&&globalThis.__resets.length===0,JSON.stringify([...mem().keys()]));
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})();
