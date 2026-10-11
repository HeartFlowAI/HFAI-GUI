// Exercises the actual workspace renderer using an isolated profile and synthetic events.
// No cloud calls, microphone recording or physical input.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve('test-output',`workspace-ui-${Date.now()}`),profile=path.join(output,'profile');
app.setPath('userData',profile);
const root=process.env.AURORA_SMOKE_SOURCE||path.resolve('src');
require(path.join(root,'provider')).chat=async()=>({role:'assistant',content:'Fixture reply'});
require(path.join(root,'main'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<160;i++){if(await fn())return;await pause(50);}throw Error('Workspace UI check timed out.');}
app.whenReady().then(async()=>{try{
  await fs.mkdir(output,{recursive:true});let win;
  await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html'));return win&&!win.webContents.isLoading();});
  const js=async code=>{try{return await win.webContents.executeJavaScript(code);}catch(error){throw new Error(`Workspace fixture failed while executing ${code}: ${error.message}`);}};const errors=[];
  win.webContents.on('console-message',(_event,level,message)=>{if(level>=3)errors.push(message);});
  await until(()=>js('typeof view!=="undefined"&&!!document.querySelector(".welcome-mark")'));
  await js('document.getElementById("sidebar-toggle").click();if(document.getElementById("companion-toggle").getAttribute("aria-expanded")==="true")document.getElementById("companion-toggle").click();document.getElementById("projects-toggle").click()');
  assert.ok(await js('getComputedStyle(document.querySelector(".sidebar")).display!=="none"&&document.querySelector(".sidebar").getBoundingClientRect().width<=60&&getComputedStyle(document.querySelector(".companion")).display==="none"'));
  assert.equal(await js('document.getElementById("projects").hidden'),true);
  win.webContents.reload();await until(()=>js('typeof view!=="undefined"&&document.getElementById("companion-toggle").getAttribute("aria-expanded")==="false"'));
  assert.equal(await js('document.body.dataset.sidebarHidden'), 'true');
  assert.equal(await js('document.getElementById("projects").hidden'),true);
  await js('document.getElementById("sidebar-toggle").click();if(document.getElementById("companion-toggle").getAttribute("aria-expanded")==="false")document.getElementById("companion-toggle").click();document.getElementById("projects-toggle").click()');
  await js('document.dispatchEvent(new KeyboardEvent("keydown",{key:"k",ctrlKey:true,bubbles:true}))');
  assert.equal(await js('document.activeElement.id'),'session-search');
  await js('document.getElementById("composer-model").click()');assert.equal(await js('document.getElementById("model-picker").hidden'),false);assert.equal(await js('document.querySelectorAll(".model-provider-group").length'),5);const modelPicker=await js('(()=>{const e=document.getElementById("model-picker"),r=e.getBoundingClientRect(),s=getComputedStyle(e),p=document.elementFromPoint(r.left+20,r.top+20);return {display:s.display,visibility:s.visibility,width:r.width,height:r.height,left:r.left,top:r.top,bottom:r.bottom,hit:p?.id||p?.className||p?.tagName}})()');console.log('Picker visibility:',JSON.stringify(modelPicker));assert.ok(modelPicker.display!=="none"&&modelPicker.visibility==="visible"&&modelPicker.width>0&&modelPicker.height>0,JSON.stringify(modelPicker));await pause(150);await fs.writeFile(path.join(output,'model-picker.png'),(await win.webContents.capturePage()).toPNG());await js('document.getElementById("model-picker-settings").click()');assert.equal(await js('document.getElementById("settings-dialog").open'),true);assert.equal(await js('document.querySelector("#settings-dialog .settings-nav .selected").textContent'),'Models');
  await js('document.getElementById("settings-close").click();document.querySelector(".companion-top button").click()');assert.equal(await js('document.querySelectorAll(".appearance-card").length'),6);
  await js('document.getElementById("appearance-close").click()');
  const emit=event=>win.webContents.send('event',event);
  emit({type:'tool-start',name:'web_search',args:{query:'fixture'},id:'ok'});await until(()=>js('!!document.querySelector(".activity-item[data-id=ok]")'));
  assert.equal(await js('document.querySelector(".activity-item[data-id=ok] .tool-label").textContent'),'Searching the web');
  assert.equal(await js('document.querySelector(".activity-item[data-id=ok]").dataset.status'),'running');
  emit({type:'tool-end',id:'ok',result:'{"text":"a document mentions the word error"}'});await until(()=>js('document.querySelector(".activity-item[data-id=ok]").dataset.status==="done"'));
  emit({type:'tool-start',name:'read_file',args:{path:'missing.md'},id:'bad'});emit({type:'tool-end',id:'bad',result:'{"error":"File not found"}'});
  await until(()=>js('document.querySelector(".activity-item[data-id=bad]").dataset.status==="error"'));
  // Keep the screenshot focused on a successful illustrative file search.
  const previewReply='I can help. Choose a project folder, and I’ll look through the notes with you.\n\n### A good starting point\n- Review the files together\n- Decide how you want to group them\n- Check each change before it runs';
  await js(`document.querySelector(".activity-item[data-id=bad]").remove();document.getElementById("welcome").hidden=true;addMessage("user","Aurora, help me organize my project notes.");addMessage("assistant",${JSON.stringify(previewReply)});document.getElementById("status-text").textContent="Ready when you are"`);
  win.setSize(1340,880);win.showInactive();await pause(200);await fs.writeFile(path.join(output,'conversation.png'),(await win.webContents.capturePage()).toPNG());
  await js('document.getElementById("preferences-open").click()');await pause(160);await fs.writeFile(path.join(output,'settings.png'),(await win.webContents.capturePage()).toPNG());await js('document.getElementById("preferences-close").click()');
  win.setSize(950,680);await pause(200);
  const fit=await js('(()=>{const composer=document.getElementById("composer").getBoundingClientRect(),sidebar=document.querySelector(".sidebar-bottom").getBoundingClientRect(),activity=document.getElementById("activity").getBoundingClientRect();return {composer:composer.bottom<=innerHeight,sidebar:sidebar.bottom<=innerHeight,activity:activity.height>=80,horizontal:document.documentElement.scrollWidth<=innerWidth};})()');
  assert.ok(Object.values(fit).every(Boolean),JSON.stringify(fit));
  await fs.writeFile(path.join(output,'compact.png'),(await win.webContents.capturePage()).toPNG());assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,panelsPersist:true,searchShortcut:true,appearanceShortcut:true,activityErrors:true,compactLayout:true}));
  console.log('Workspace UI smoke passed: '+output);app.exit(0);
}catch(error){console.error(error);app.exit(1);}});
