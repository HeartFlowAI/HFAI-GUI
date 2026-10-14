const {test}=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createComputerControl,applicationName}=require('../src/computer-control-macos');
const {controlMedia}=require('../src/media-control');
const {executeTool}=require('../src/tools');

function fakeSpawn(record,{fail=false,error=''}={}){
  return (file,args)=>{
    record.push({file,args});
    const child=new EventEmitter();
    child.stderr=new EventEmitter();
    child.kill=()=>{};
    process.nextTick(()=>{if(fail){if(error)child.stderr.emit('data',error);child.emit('close',1);}else child.emit('close',0);});
    return child;
  };
}

test('macOS app names resolve friendly aliases and pass unknown apps through',()=>{
  assert.equal(applicationName('chrome'),'Google Chrome');
  assert.equal(applicationName('Brave'),'Brave Browser');
  assert.equal(applicationName('explorer'),'Finder');
  assert.equal(applicationName('Spotify'),'Spotify');
  assert.equal(applicationName('Some Custom App'),'Some Custom App');
  for(const bad of ['','   ','-rf /','open\nsafari'])assert.throws(()=>applicationName(bad),/application/i);
});

test('macOS open launches an app, a URL, or both in one open call',async()=>{
  const calls=[];const computer=createComputerControl({spawnImpl:fakeSpawn(calls)});const signal=()=>new AbortController().signal;
  assert.deepEqual(await computer.open('spotify',signal()),{application:'Spotify'});
  assert.deepEqual(calls[0],{file:'open',args:['-a','Spotify']});
  assert.deepEqual(await computer.open('chrome',signal(),'https://www.youtube.com/results?search_query=despacito'),{application:'Google Chrome',navigated:'https://www.youtube.com/results?search_query=despacito'});
  assert.deepEqual(calls[1],{file:'open',args:['-a','Google Chrome','https://www.youtube.com/results?search_query=despacito']});
  assert.deepEqual(await computer.open('',signal(),'https://youtube.com'),{navigated:'https://youtube.com'});
  assert.deepEqual(calls[2],{file:'open',args:['https://youtube.com']});
});

test('macOS open falls back to the browser URL when the named app is missing',async()=>{
  const record=[];
  const spawnImpl=(file,args)=>{record.push({file,args});const child=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};process.nextTick(()=>{if(args.includes('-a'))child.emit('close',1);else child.emit('close',0);});return child;};
  const computer=createComputerControl({spawnImpl});
  assert.deepEqual(await computer.open('nonexistent-app',new AbortController().signal,'https://youtube.com'),{navigated:'https://youtube.com'});
  assert.equal(record.length,2);
});

test('macOS navigation opens a web page and rejects unsupported actions',async()=>{
  const calls=[];const computer=createComputerControl({spawnImpl:fakeSpawn(calls)});
  assert.deepEqual(await computer.action({action:'navigate',url:'https://youtube.com'},new AbortController().signal),{navigated:'https://youtube.com'});
  assert.deepEqual(calls[0],{file:'open',args:['https://youtube.com']});
  await assert.rejects(computer.action({action:'click',target:'v1:1'},new AbortController().signal),/macOS/);
  await assert.rejects(computer.action({action:'navigate',url:'javascript:alert(1)'},new AbortController().signal),/http or https/);
  await assert.rejects(computer.open('safari',new AbortController().signal,'javascript:alert(1)'),/http or https/);
});

test('open_application accepts an app, a URL, or both and rejects neither',async()=>{
  const calls=[];
  const context=name=>({signal:new AbortController().signal,openApplication:async(...args)=>{calls.push(args);return {ok:true};}});
  await executeTool('open_application',{application:'spotify'},context('a'));
  await executeTool('open_application',{url:'https://youtube.com'},context('b'));
  assert.deepEqual(calls[0],['spotify',undefined]);
  assert.deepEqual(calls[1],['','https://youtube.com']);
  await assert.rejects(executeTool('open_application',{},context('c')),/Provide an application/);
});

test('control_media drives the requested player through AppleScript on macOS',async()=>{
  const calls=[];
  assert.deepEqual(await controlMedia('play','spotify',new AbortController().signal,{platform:'darwin',spawnImpl:fakeSpawn(calls)}),{action:'play',app:'Spotify'});
  assert.deepEqual(calls[0],{file:'osascript',args:['-e','tell application "Spotify" to play']});
  await controlMedia('next','music',new AbortController().signal,{platform:'darwin',spawnImpl:fakeSpawn(calls)});
  assert.deepEqual(calls[1],{file:'osascript',args:['-e','tell application "Music" to next track']});
});

test('control_media sends a media key on Windows and validates its input',async()=>{
  const calls=[];
  await controlMedia('pause','spotify',new AbortController().signal,{platform:'win32',spawnImpl:fakeSpawn(calls)});
  assert.equal(calls[0].file,'powershell.exe');
  assert.match(calls[0].args.at(-1),/keybd_event/);
  assert.throws(()=>controlMedia('dance','spotify',new AbortController().signal),/play, pause/);
  assert.throws(()=>controlMedia('play','winamp',new AbortController().signal),/spotify or music/);
});

test('control_media surfaces player errors and is reachable through the tool',async()=>{
  await assert.rejects(controlMedia('play','spotify',new AbortController().signal,{platform:'darwin',spawnImpl:fakeSpawn([],{fail:true,error:"Spotify got an error: A privilege violation occurred."})}),/privilege/);
  const calls=[];
  await executeTool('control_media',{action:'play'},{signal:new AbortController().signal,controlMedia:async(action,app)=>{calls.push([action,app]);return {ok:true};}});
  assert.deepEqual(calls,[['play','spotify']]);
});
