const {spawn}=require('node:child_process');
const {validateNavigation}=require('./computer-control');

// Friendly names the model is likely to send, mapped to the real macOS app name.
// Anything not listed is passed through, so any installed app works by name.
const aliases={opera:'Opera',chrome:'Google Chrome','google chrome':'Google Chrome',edge:'Microsoft Edge','microsoft edge':'Microsoft Edge',brave:'Brave Browser','brave browser':'Brave Browser',firefox:'Firefox',safari:'Safari',explorer:'Finder',finder:'Finder',notepad:'TextEdit',textedit:'TextEdit',calculator:'Calculator',terminal:'Terminal',spotify:'Spotify',music:'Music','apple music':'Music',code:'Visual Studio Code','vs code':'Visual Studio Code','visual studio code':'Visual Studio Code'};
const actions=new Set(['observe','focus','move','click','type','keys','scroll','wait','navigate']);

function applicationName(name){
  if(typeof name!=='string')throw Error('Choose an application.');
  const trimmed=name.trim();
  if(!trimmed||trimmed.length>120||/[\x00-\x1f]/.test(trimmed)||trimmed.startsWith('-'))throw Error('Choose an application by name.');
  return aliases[trimmed.toLowerCase()]||trimmed;
}
function delay(ms,signal){signal.throwIfAborted();return new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(Error('Computer control stopped.'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});});}
function createComputerControl({onActivity=()=>{},spawnImpl=spawn}={}){
  function run(args,signal,label){
    return new Promise((resolve,reject)=>{
      signal.throwIfAborted();
      const child=spawnImpl('open',args,{stdio:['ignore','pipe','pipe']});
      let error='',settled=false;
      child.stderr?.on('data',chunk=>{if(error.length<2000)error+=chunk;});
      const abort=()=>child.kill();
      signal.addEventListener('abort',abort,{once:true});
      const done=failure=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);failure?reject(failure):resolve();};
      child.on('error',err=>done(signal.aborted?Error('Computer control stopped.'):err.code==='ENOENT'?Error('The macOS open command is unavailable.'):err));
      child.on('close',code=>{const first=error.trim().split('\n').find(line=>line.trim())||'';done(signal.aborted?Error('Computer control stopped.'):code===0?null:Error(first||`${label||'That'} could not be opened.`));});
    });
  }
  async function open(name,signal,url){
    signal.throwIfAborted();
    if(url!==undefined)validateNavigation(url);
    const app=name?applicationName(name):'';
    if(!app&&url===undefined)throw Error('Choose an application or a web address.');
    await onActivity({action:'open',text:`Opening ${app||url}`});
    signal.throwIfAborted();
    if(app){
      try{
        await run(['-a',app,...(url!==undefined?[url]:[])],signal,app);
        if(url!==undefined)onActivity({action:'navigate',url});
        return {application:app,...(url!==undefined?{navigated:url}:{})};
      }catch(error){if(url===undefined)throw error;}
    }
    await run([url],signal,'The web address');
    onActivity({action:'navigate',url});
    return {navigated:url};
  }
  async function action(args,signal){
    signal.throwIfAborted();
    if(!args||typeof args!=='object'||!actions.has(args.action))throw Error('Choose a supported computer action.');
    if(args.action==='wait'){await delay(800,signal);return {waitedMs:800};}
    if(args.action==='navigate'){validateNavigation(args.url);await onActivity({action:'navigate',url:args.url});await run([args.url],signal,'The web address');return {navigated:args.url};}
    throw Error('Only opening apps and web pages is available on macOS so far. Observing windows and driving the mouse and keyboard are not supported yet.');
  }
  function cancel(){}
  return {action,open,cancel,prepare:async()=>{}};
}
module.exports={createComputerControl,applicationName};
