// Isolated profile, local fixtures only. No microphone or physical desktop input.
const {app,BrowserWindow,dialog}=require('electron'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve('test-output',`harness-ui-${Date.now()}`),profile=path.join(output,'profile'),root=process.env.AURORA_SMOKE_SOURCE||path.resolve('src');app.setPath('userData',profile);
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn){for(let i=0;i<180;i++){if(await fn())return;await pause(60);}throw Error('Harness fixture timed out.');}
let capturedTools,externalCall=false;
require(path.join(root,'provider')).chat=async({tools})=>{capturedTools=tools;if(externalCall){externalCall=false;return {role:'assistant',content:'',tool_calls:[{id:'fixture-call',function:{name:tools.find(t=>t.function.name.startsWith('mcp_')).function.name,arguments:{message:'hello'}}}]};}return {role:'assistant',content:'Fixture reply.'};};
require(path.join(root,'main'));
app.whenReady().then(async()=>{try{
  await fs.mkdir(output,{recursive:true});let win;await until(()=>{win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('index.html'));return win&&!win.webContents.isLoading();});
  const js=code=>win.webContents.executeJavaScript(code),load=async()=>(await js('window.aurora.load()')).value;await until(()=>js('typeof view!=="undefined"&&!!document.getElementById("extensions-open")'));
  const errors=[];win.webContents.on('console-message',(_event,level,message)=>{if(level>=3)errors.push(message);});
  const folder=path.join(output,'workspace');await fs.mkdir(folder);await fs.mkdir(path.join(folder,'notes'));await fs.writeFile(path.join(folder,'README.md'),'# A project\n<script>do not execute</script>');
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});await js('document.getElementById("workspace").click()');await until(async()=>(await load()).workspace===folder);
  await js('document.getElementById("dock-files-tab").click()');await until(()=>js('document.querySelectorAll(".workspace-file").length===2'));
  await js('Array.from(document.querySelectorAll(".workspace-file")).find(b=>b.textContent.includes("README.md")).click()');await until(()=>js('!document.getElementById("workspace-preview").hidden'));
  assert.equal(await js('document.getElementById("file-preview-content").textContent'),'# A project\n<script>do not execute</script>');assert.equal(await js('document.querySelectorAll("#workspace-preview script").length'),0);
  assert.equal((await js('window.aurora.workspacePreview("../outside.txt")')).ok,false);
  const earlier=(await load()).currentId;
  await js('(async()=>render((await window.aurora.createProject("Example project")).value))()');
  const projectChat=(await load()).currentId;assert.notEqual(projectChat,earlier);
  await js('document.querySelector(".project-expand").click()');assert.equal((await load()).currentId,projectChat);
  await js('document.querySelector("#project-sessions-ungrouped .project-session").click()');await until(async()=>(await load()).currentId===earlier);
  await js('document.dispatchEvent(new KeyboardEvent("keydown",{key:",",ctrlKey:true,bubbles:true}))');assert.equal(await js('document.getElementById("preferences-dialog").open'),true);
  await js('document.querySelector("#preferences-dialog [data-settings-target=settings-dialog]").click()');assert.equal(await js('document.getElementById("settings-dialog").open'),true);assert.equal(await js('document.querySelectorAll(".connection-card").length'),5);
  win.setSize(1340,880);win.show();await pause(600);await fs.writeFile(path.join(output,'connections.png'),(await win.webContents.capturePage()).toPNG());
  await js('document.querySelector("#settings-dialog [data-settings-target=extensions-dialog]").click()');assert.equal(await js('document.querySelectorAll(".plugin-row").length'),4);
  await js('document.querySelector(".plugin-row input").click()');await until(async()=>(await load()).plugins[0].enabled===false);
  const server={name:'Local fixture',transport:'stdio',command:process.env.ProgramFiles+'\\nodejs\\node.exe',args:[path.resolve('test/fixtures/mcp-server.js')]};
  // Use the actual installed Node path rather than assuming a per-machine install.
  const {execFileSync}=require('node:child_process');server.command=execFileSync('where.exe',['node'],{encoding:'utf8'}).trim().split(/\r?\n/)[0];
  assert.ok((await js(`window.aurora.mcpSave(${JSON.stringify(server)})`)).ok);let id=(await load()).mcpServers[0].id;
  assert.ok((await js(`window.aurora.mcpAction(${JSON.stringify(id)},"connect")`)).ok);await until(()=>js('view.mcpServers[0]?.status==="connected"'));
  await pause(600);await fs.writeFile(path.join(output,'extensions.png'),(await win.webContents.capturePage()).toPNG());
  await js('document.getElementById("extensions-close").click()');await js('window.aurora.saveSettings({key:"fixture-key",model:"fixture"})');assert.ok((await js('window.aurora.send("Fixture")')).ok);
  assert.ok(!capturedTools.some(t=>t.function.name==='read_file'));assert.ok(capturedTools.some(t=>t.function.name.startsWith('mcp_')));
  externalCall=true;const task=js('window.aurora.send("Use the fixture tool")');await until(()=>js('document.getElementById("approval-dialog").open'));
  assert.ok(await js('document.getElementById("approval-content").textContent.includes("hello")'));assert.ok(await js('document.getElementById("approval-description").textContent.includes("echo")'));
  await js('document.getElementById("allow").click()');assert.ok((await task).ok);assert.ok((await load()).messages.some(m=>m.role==='tool'&&m.content.includes('1: hello')));
  assert.ok((await js(`window.aurora.mcpAction(${JSON.stringify(id)},"disconnect")`)).ok);
  const remote={name:'Remote fixture',transport:'http',url:'https://server.example/mcp',token:'private-fixture-token'};assert.ok((await js(`window.aurora.mcpSave(${JSON.stringify(remote)})`)).ok);
  const value=await load();assert.ok(!JSON.stringify(value).includes('private-fixture-token'));const saved=JSON.parse(await fs.readFile(path.join(profile,'aurora.json'),'utf8'));assert.ok(!JSON.stringify(saved).includes('private-fixture-token'));assert.ok(saved.mcpServers[1].encryptedToken);
  win.setSize(950,680);await js('document.getElementById("extensions-open").click()');await pause(500);
  assert.ok(await js('document.documentElement.scrollWidth<=innerWidth&&document.querySelector(".settings-content").getBoundingClientRect().bottom<=innerHeight'));
  await fs.writeFile(path.join(output,'compact-settings.png'),(await win.webContents.capturePage()).toPNG());assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,files:true,projectGroups:true,settingsNavigation:true,plugins:true,mcpDiscovery:true,mcpApproval:true,encryptedToken:true,compactSettings:true}));console.log('Harness UI smoke passed: '+output);app.exit(0);
}catch(error){console.error(error);app.exit(1);}});
