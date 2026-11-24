const esbuild=require('esbuild');
const path=require('path');
const stub=(name,code)=>({name,setup(b){b.onResolve({filter:new RegExp(name)},a=>({path:a.path,namespace:'stub-'+name}));b.onLoad({filter:/.*/,namespace:'stub-'+name},()=>({contents:code,loader:'js'}))}});
esbuild.build({
 entryPoints:[require('path').join(__dirname,'../../lib/http.js')],bundle:true,platform:'node',format:'cjs',outfile:require('path').join(__dirname,'http.bundle.js'),logLevel:'error',
 plugins:[
  stub('^expo-secure-store$','const m=globalThis.__mem||(globalThis.__mem=new Map());module.exports={getItemAsync:async k=>m.has(k)?m.get(k):null,setItemAsync:async(k,v)=>{m.set(k,String(v))},deleteItemAsync:async k=>{m.delete(k)}};'),
  stub('^@react-native-async-storage/async-storage$','module.exports={multiRemove:async()=>{},default:{multiRemove:async()=>{}}};'),
  stub('/utils/api$','globalThis.__n=0;module.exports={resolveApiBase:()=>{globalThis.__n++;return (globalThis.__failRefresh&&globalThis.__n%2===0)?"http://localhost:1":"http://localhost:3099"}};'),
  stub('@react-navigation/native','module.exports={createNavigationContainerRef:()=>({isReady:()=>true,reset:(x)=>{(globalThis.__resets=globalThis.__resets||[]).push(x)}})};'),
 ]}).then(()=>console.log('bundled'));
