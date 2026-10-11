// Settings sections and the companion dock share the existing renderer and IPC boundary.
(() => {
  const el=id=>document.getElementById(id);
  document.querySelector('.sidebar-library').prepend(document.querySelector('.session-search'));
  const extensionDialog=document.createElement('dialog');extensionDialog.id='extensions-dialog';
  extensionDialog.innerHTML=`<div class="dialog-heading"><div><div class="eyebrow">EXTEND AURORA</div><h2>Plugins & MCP</h2></div><button id="extensions-close" class="icon-button" aria-label="Close extensions">×</button></div><p>Choose Aurora’s built-in tools and connect your own MCP servers.</p><h3>Built-in plugins</h3><div id="plugin-list"></div><h3>MCP servers</h3><p class="field-help">Servers start disconnected. Connecting a local server runs its executable with your Windows permissions. Only connect servers you trust. Each external tool call asks for approval.</p><div id="mcp-list"></div><form id="mcp-form"><h3 id="mcp-form-title">Add a server</h3><label for="mcp-name">Name</label><input id="mcp-name" required maxlength="80" placeholder="My MCP server"><label for="mcp-transport">Transport</label><select id="mcp-transport"><option value="http">Remote · Streamable HTTP</option><option value="stdio">Local · standard input/output</option></select><div id="mcp-http"><label for="mcp-url">MCP endpoint</label><input id="mcp-url" placeholder="https://your-server.example/mcp"><label for="mcp-token">Bearer token (optional)</label><input id="mcp-token" type="password" autocomplete="off"><p class="field-help">Tokens are encrypted for your Windows account. Leave blank to keep a saved token.</p></div><div id="mcp-stdio" hidden><label for="mcp-command">Server executable</label><input id="mcp-command" placeholder="node.exe"><label for="mcp-args">Arguments · JSON array</label><textarea id="mcp-args" rows="3" placeholder='["C:/path/to/server.js"]'></textarea><p class="field-help">Use an installed server executable directly. Aurora does not download or install server packages. Arguments are saved as local plain text; keep credentials out of them.</p></div><div id="mcp-status" role="status"></div><div class="dialog-footer"><button id="mcp-new" type="button" class="text-button">Clear form</button><button class="primary" type="submit">Save server</button></div></form>`;
  document.body.append(extensionDialog);el('extensions-close').onclick=()=>extensionDialog.close();
  const sections=[['preferences-dialog','General','preferences-open'],['settings-dialog','Models','settings-open'],['voice-dialog','Voice & wake word','voice-open'],['appearance-dialog','Appearance','appearance-open'],['extensions-dialog','Plugins & MCP',null],['updates-dialog','Updates','updates-open']];
  function openSection(id){for(const [other]of sections)if(el(other).open)el(other).close();const section=sections.find(s=>s[0]===id);if(section[2])el(section[2]).click();else{renderExtensions();extensionDialog.showModal();}el(id).querySelector('.settings-nav .selected').focus();}
  for(const [id,label]of sections){
    const dialog=el(id);dialog.classList.add('settings-workspace');
    const content=document.createElement('div');content.className='settings-content';while(dialog.firstChild)content.append(dialog.firstChild);
    const nav=document.createElement('nav');nav.className='settings-nav';nav.setAttribute('aria-label','Settings sections');
    const heading=document.createElement('h2');heading.textContent='Settings';nav.append(heading);
    for(const [target,name]of sections){const button=document.createElement('button');button.type='button';button.textContent=name;button.dataset.settingsTarget=target;button.className=target===id?'selected':'';if(target===id)button.setAttribute('aria-current','page');button.onclick=()=>openSection(target);nav.append(button);}
    const footer=document.createElement('p');footer.textContent='Aurora · Heartflow AI';nav.append(footer);dialog.append(nav,content);dialog.setAttribute('aria-label',label+' settings');
  }
  const connectionList=document.createElement('div');connectionList.id='connection-list';
  el('settings-form').querySelector('.dialog-heading h2').textContent='Models & providers';
  el('settings-form').querySelector('.dialog-heading').after(connectionList);
  function connections(){
    if(typeof view==='undefined')return;connectionList.replaceChildren();
    for(const [id,item]of Object.entries(view.connections)){
      const button=document.createElement('button');button.type='button';button.className='connection-card'+(id===view.provider?' active':'');
      const name=document.createElement('strong');name.textContent=item.name;
      const details=document.createElement('small');details.textContent=(id===view.provider?'Active · ':'')+(item.key?(item.hasKey?'Key saved':'Not configured'):(item.model?'Local model selected':'Local setup'))+(item.model?' · '+item.model:'');
      const arrow=document.createElement('span');arrow.className='connection-arrow';arrow.textContent='›';button.append(name,details,arrow);button.onclick=()=>{el('llm-provider').value=id;el('llm-provider').dispatchEvent(new Event('change'));el('model').focus();};connectionList.append(button);
    }
  }
  el('settings-open').addEventListener('click',connections);
  const picker=el('model-picker'),pickerList=el('model-picker-list'),pickerStatus=el('model-picker-status'),pickerQuery=el('model-picker-query');
  let pickerModels=new Map(),pickerGeneration=0;
  function closeModelPicker(){picker.hidden=true;el('composer-model').setAttribute('aria-expanded','false');el('composer-model').focus();}
  function drawModelPicker(){
    if(typeof view==='undefined')return;const query=pickerQuery.value.trim().toLocaleLowerCase();pickerList.replaceChildren();
    for(const [id,connection]of Object.entries(view.connections)){
      const available=connection.key?connection.hasKey:!!connection.model;
      const group=document.createElement('section');group.className='model-provider-group';
      const title=document.createElement('div');title.className='model-provider-title';const name=document.createElement('strong');name.textContent=connection.name;const hint=document.createElement('span');hint.textContent=id===view.provider?'Current':'Provider';title.append(name,hint);group.append(title);
      const models=pickerModels.get(id)||[connection.model].filter(Boolean),matching=models.filter(model=>(model+' '+connection.name).toLocaleLowerCase().includes(query));
      if(!available){const setup=document.createElement('button');setup.type='button';setup.className='model-picker-row unavailable';setup.textContent='Connect provider in Settings';setup.onclick=()=>{closeModelPicker();openSection('settings-dialog');};group.append(setup);}
      else if(matching.length){for(const model of matching){const row=document.createElement('button');row.type='button';row.className='model-picker-row'+(id===view.provider&&model===view.model?' selected':'');row.setAttribute('role','option');row.setAttribute('aria-selected',String(id===view.provider&&model===view.model));const label=document.createElement('span');label.textContent=model;const mark=document.createElement('span');mark.textContent=id===view.provider&&model===view.model?'✓':'○';row.append(label,mark);row.onclick=async()=>{if(busy)return;row.disabled=true;pickerStatus.textContent='Switching model…';try{render(await call(window.aurora.saveSettings({provider:id,model,baseUrl:connection.baseUrl})));closeModelPicker();}catch(error){pickerStatus.textContent=error.message;row.disabled=false;}};group.append(row);}}
      else if(!models.length){const empty=document.createElement('p');empty.className='model-picker-empty';empty.textContent=query?'No matching models.':'No model selected';group.append(empty);}
      if(available){const load=document.createElement('button');load.type='button';load.className='model-picker-load';load.textContent=pickerModels.has(id)?'Refresh models':'Load models';load.onclick=async()=>{load.disabled=true;pickerStatus.textContent=`Loading ${connection.name} models…`;const generation=pickerGeneration;try{const models=await call(window.aurora.models({provider:id,baseUrl:connection.baseUrl}));if(generation!==pickerGeneration)return;pickerModels.set(id,[...new Set([connection.model,...models].filter(Boolean))]);pickerStatus.textContent=`${models.length} models available from ${connection.name}.`;drawModelPicker();}catch(error){pickerStatus.textContent=error.message;load.disabled=false;}};group.append(load);}
      pickerList.append(group);
    }
  }
  el('composer-model').onclick=()=>{if(!picker.hidden){closeModelPicker();return;}pickerGeneration++;pickerQuery.value='';pickerStatus.textContent='';drawModelPicker();picker.hidden=false;el('composer-model').setAttribute('aria-expanded','true');pickerQuery.focus();};
  pickerQuery.oninput=drawModelPicker;el('model-picker-settings').onclick=()=>{closeModelPicker();openSection('settings-dialog');};
  document.addEventListener('pointerdown',event=>{if(!picker.hidden&&!event.target.closest('#model-picker')&&!event.target.closest('#composer-model')){picker.hidden=true;el('composer-model').setAttribute('aria-expanded','false');}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!picker.hidden){event.preventDefault();closeModelPicker();}});
  const shortcut=document.createElement('button');shortcut.id='extensions-open';shortcut.className='sidebar-action';shortcut.textContent='◇ Plugins & MCP';shortcut.onclick=()=>openSection('extensions-dialog');
  document.querySelector('.sidebar-bottom').prepend(shortcut);
  let editingServer='';
  const transport=()=>{const remote=el('mcp-transport').value==='http';el('mcp-http').hidden=!remote;el('mcp-stdio').hidden=remote;};el('mcp-transport').onchange=transport;
  function resetServer(){editingServer='';el('mcp-form').reset();el('mcp-token').value='';el('mcp-form-title').textContent='Add a server';el('mcp-status').textContent='';transport();}el('mcp-new').onclick=resetServer;
  function renderExtensions(){
    if(typeof view==='undefined')return;
    el('plugin-list').replaceChildren();
    for(const plugin of view.plugins||[]){const row=document.createElement('label');row.className='plugin-row';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=plugin.enabled;checkbox.disabled=busy;const text=document.createElement('span'),name=document.createElement('strong'),details=document.createElement('small');name.textContent=plugin.name;details.textContent=plugin.description;text.append(name,details);row.append(text,checkbox);checkbox.onchange=action(async()=>{render(await call(window.aurora.pluginToggle(plugin.id,checkbox.checked)));renderExtensions();});el('plugin-list').append(row);}
    el('mcp-list').replaceChildren();
    for(const server of view.mcpServers||[]){
      const row=document.createElement('div');row.className='mcp-row';const name=document.createElement('strong');name.textContent=server.name;const status=document.createElement('small');status.textContent=`${server.transport==='http'?'Remote':'Local'} · ${server.status} · ${server.tools.length} tools`;row.append(name,status);
      const controls=document.createElement('div');controls.className='mcp-controls';
      for(const [label,operation]of [[server.status==='connected'?'Disconnect':server.transport==='stdio'?'Run & connect':'Connect',server.status==='connected'?'disconnect':'connect'],['Edit','edit'],['Remove','remove']]){
        const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=label;button.disabled=busy||server.status==='connecting';button.onclick=action(async()=>{
          if(operation==='edit'){editingServer=server.id;el('mcp-form-title').textContent='Edit '+server.name;el('mcp-name').value=server.name;el('mcp-transport').value=server.transport;el('mcp-url').value=server.url||'';el('mcp-command').value=server.command||'';el('mcp-args').value=JSON.stringify(server.args||[]);el('mcp-token').value='';transport();el('mcp-name').focus();return;}
          button.disabled=true;try{render(await call(window.aurora.mcpAction(server.id,operation)));el('mcp-status').textContent=operation==='connect'?'Connected. Tools are available to Aurora.':'';}catch(error){el('mcp-status').textContent=error.message;}finally{renderExtensions();}
        });controls.append(button);
      }
      row.append(controls);if(server.tools.length){const details=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('ul');summary.textContent='Available tools';for(const tool of server.tools){const item=document.createElement('li');item.textContent=tool.name;list.append(item);}details.append(summary,list);row.append(details);}el('mcp-list').append(row);
    }
    if(!view.mcpServers?.length){const text=document.createElement('p');text.className='field-help';text.textContent='No MCP servers yet. Add a local executable or remote endpoint below.';el('mcp-list').append(text);}
  }
  el('mcp-form').onsubmit=event=>{event.preventDefault();action(async()=>{try{const value={id:editingServer,name:el('mcp-name').value,transport:el('mcp-transport').value,url:el('mcp-url').value,command:el('mcp-command').value,args:el('mcp-transport').value==='stdio'?JSON.parse(el('mcp-args').value||'[]'):[],token:el('mcp-token').value};render(await call(window.aurora.mcpSave(value)));resetServer();renderExtensions();el('mcp-status').textContent='Saved. Choose Connect when you want to use this server.';}catch(error){el('mcp-status').textContent=error.message;}})();};
  // The character stays visible above two workspace tabs.
  const dock=document.querySelector('.companion');const tabs=document.createElement('div');tabs.className='dock-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Companion panel');
  const activityPanel=document.createElement('div');activityPanel.id='dock-activity';activityPanel.className='dock-page';activityPanel.setAttribute('role','tabpanel');
  const filesPanel=document.createElement('div');filesPanel.id='dock-files';filesPanel.className='dock-page';filesPanel.setAttribute('role','tabpanel');filesPanel.hidden=true;
  filesPanel.innerHTML='<div class="file-toolbar"><button id="file-up" title="Parent folder">↑</button><span id="file-location">Workspace files</span><button id="file-refresh" title="Refresh files">↻</button></div><div id="workspace-file-list"></div><div id="workspace-preview" hidden><button id="file-preview-close" class="text-button">Back to files</button><strong id="file-preview-name"></strong><pre id="file-preview-content"></pre></div><p id="file-browser-status" role="status"></p>';
  for(const node of [dock.querySelector('.activity-heading'),el('file-results-open'),el('activity')])activityPanel.append(node);
  for(const [id,label]of [['dock-activity','Activity'],['dock-files','Files']]){const button=document.createElement('button');button.id=id+'-tab';button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls',id);button.setAttribute('aria-selected',String(id==='dock-activity'));button.onclick=()=>{for(const pane of [activityPanel,filesPanel]){pane.hidden=pane.id!==id;el(pane.id+'-tab').setAttribute('aria-selected',String(pane.id===id));}if(id==='dock-files')browseFiles();};tabs.append(button);}
  dock.querySelector('.companion-foot').before(tabs,activityPanel,filesPanel);
  tabs.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...tabs.querySelectorAll('button')],index=buttons.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();buttons[next].focus();});
  let directory='.',fileGeneration=0,workspace='';
  async function browseFiles(relative=directory){
    const generation=++fileGeneration,currentWorkspace=typeof view==='undefined'?'':view.workspace;el('workspace-preview').hidden=true;el('workspace-file-list').hidden=false;el('file-browser-status').textContent='Loading files…';
    try{
      const result=await call(window.aurora.workspaceBrowse(relative));if(generation!==fileGeneration||view.workspace!==currentWorkspace)return;
      directory=relative;el('file-location').textContent=relative==='.'?'Workspace files':relative;el('file-location').title=relative;el('file-up').disabled=directory==='.';el('workspace-file-list').replaceChildren();
      for(const entry of result.entries){const button=document.createElement('button');button.className='workspace-file';button.textContent=(entry.kind==='folder'?'▱ ':'≡ ')+entry.name;button.title=entry.name;const target=directory==='.'?entry.name:directory+'/'+entry.name;button.onclick=entry.kind==='folder'?()=>browseFiles(target):()=>previewFile(target);el('workspace-file-list').append(button);}
      el('file-browser-status').textContent=result.truncated?'Showing the first 300 entries.':result.entries.length?'':'This folder is empty.';
    }catch(error){if(generation===fileGeneration){el('workspace-file-list').replaceChildren();el('file-browser-status').textContent=error.message;}}
  }
  async function previewFile(relative){const generation=++fileGeneration,currentWorkspace=view.workspace;try{const result=await call(window.aurora.workspacePreview(relative));if(generation!==fileGeneration||view.workspace!==currentWorkspace)return;el('file-preview-name').textContent=result.path;el('file-preview-content').textContent=result.content;el('workspace-file-list').hidden=true;el('workspace-preview').hidden=false;el('file-browser-status').textContent='Read-only preview';}catch(error){if(generation===fileGeneration)el('file-browser-status').textContent=error.message;}}
  el('file-preview-close').onclick=()=>browseFiles();el('file-up').onclick=()=>browseFiles(directory.includes('/')?directory.split('/').slice(0,-1).join('/')||'.':'.');el('file-refresh').onclick=()=>browseFiles();
  function syncView(){if(typeof view==='undefined')return;connections();renderExtensions();if(workspace!==view.workspace){workspace=view.workspace;directory='.';fileGeneration++;el('workspace-file-list').replaceChildren();el('file-preview-content').textContent='';el('workspace-preview').hidden=true;if(!filesPanel.hidden)browseFiles();}}
  window.addEventListener('aurora-view-rendered',syncView);
  window.aurora.onEvent(event=>{
    if(event.type==='extensions'){if(typeof view==='undefined')return;view.plugins=event.plugins;view.mcpServers=event.servers;renderExtensions();}
    if(event.type==='snapshot')syncView();
  });
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key===','&&!event.repeat&&!document.querySelector('dialog[open]')){event.preventDefault();openSection('preferences-dialog');}});
})();
