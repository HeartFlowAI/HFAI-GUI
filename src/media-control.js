const {spawn}=require('node:child_process');

const ACTIONS={play:'play',pause:'pause',playpause:'playpause',next:'next track',previous:'previous track'};
const APPS={spotify:'Spotify',music:'Music','apple music':'Music'};
const MEDIA_KEYS={play:0xb3,pause:0xb3,playpause:0xb3,next:0xb0,previous:0xb1};

function powerShell(action){
  const key=MEDIA_KEYS[action].toString(16);
  return `Add-Type -Namespace Aurora -Name Media -MemberDefinition '[System.Runtime.InteropServices.DllImport("user32.dll")]public static extern void keybd_event(byte bVk,byte bScan,uint dwFlags,System.UIntPtr dwExtraInfo);';[Aurora.Media]::keybd_event(0x${key},0,0,[System.UIntPtr]::Zero);[Aurora.Media]::keybd_event(0x${key},0,2,[System.UIntPtr]::Zero)`;
}
function controlMedia(action,app,signal,{platform=process.platform,spawnImpl=spawn}={}){
  if(!Object.hasOwn(ACTIONS,action))throw Error('Choose play, pause, playpause, next or previous.');
  const key=String(app||'spotify').trim().toLowerCase();
  if(!Object.hasOwn(APPS,key))throw Error('Choose spotify or music as the player.');
  signal.throwIfAborted();
  const command=platform==='win32'
    ? {file:'powershell.exe',args:['-NoLogo','-NoProfile','-NonInteractive','-Command',powerShell(action)]}
    : platform==='darwin'
      ? {file:'osascript',args:['-e',`tell application "${APPS[key]}" to ${ACTIONS[action]}`]}
      : null;
  if(!command)throw Error('Music control is not supported on this system.');
  return new Promise((resolve,reject)=>{
    const child=spawnImpl(command.file,command.args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
    let error='',settled=false;
    child.stderr?.on('data',chunk=>{if(error.length<2000)error+=chunk;});
    const abort=()=>child.kill();
    signal.addEventListener('abort',abort,{once:true});
    const done=failure=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);failure?reject(failure):resolve({action,app:APPS[key]});};
    child.on('error',err=>done(signal.aborted?Error('Music control stopped.'):err));
    child.on('close',code=>{const first=error.trim().split('\n').find(line=>line.trim())||'';done(signal.aborted?Error('Music control stopped.'):code===0?null:Error(first||`${APPS[key]} playback could not be controlled. Open ${APPS[key]} first.`));});
  });
}
module.exports={controlMedia,ACTIONS,APPS};
