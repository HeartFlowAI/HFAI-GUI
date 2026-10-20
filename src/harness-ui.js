// Settings sections and the companion dock share the existing renderer and IPC boundary.
(() => {
  const el=id=>document.getElementById(id);
  document.querySelector('.sidebar-library').prepend(document.querySelector('.session-search'));
  const extensionDialog=document.createElement('dialog');extensionDialog.id='extensions-dialog';
  extensionDialog.innerHTML=`<div class="dialog-heading"><div><div class="eyebrow">AURORA'S TOOLKIT</div><h2>Capabilities</h2></div><button id="extensions-close" class="icon-button" aria-label="Close capabilities">×</button></div><p>Everything Aurora can do, and everything you have connected.</p><div id="cap-summary" class="cap-summary"></div><div class="cap-heading"><div><h3>Aurora tools</h3><small>Built-in, local and permissioned.</small></div><span id="cap-builtin-count" class="conn-badge muted">0 on</span></div><div id="plugin-list" class="cap-grid"></div><div class="cap-heading"><div><h3>Connected servers</h3><small>Bring your own MCP tools.</small></div><span id="cap-mcp-count" class="conn-badge muted">0 connected</span></div><p class="field-help">Servers start disconnected. Connecting a local server runs its executable with your user permissions. Only connect servers you trust. Each external tool call asks for approval.</p><div id="mcp-list" class="cap-mcp-list"></div><form id="mcp-form" class="cap-add-form"><div class="cap-form-head"><h3 id="mcp-form-title">Add a server</h3><small>Remote endpoint or local executable.</small></div><label for="mcp-name">Name</label><input id="mcp-name" required maxlength="80" placeholder="My MCP server"><label for="mcp-transport">Transport</label><select id="mcp-transport"><option value="http">Remote · Streamable HTTP</option><option value="stdio">Local · standard input/output</option></select><div id="mcp-http"><label for="mcp-url">MCP endpoint</label><input id="mcp-url" placeholder="https://your-server.example/mcp"><label for="mcp-token">Bearer token (optional)</label><input id="mcp-token" type="password" autocomplete="off"><p class="field-help">Tokens are encrypted on this device. Leave blank to keep a saved token.</p></div><div id="mcp-stdio" hidden><label for="mcp-command">Server executable</label><input id="mcp-command" placeholder="node"><label for="mcp-args">Arguments · JSON array</label><textarea id="mcp-args" rows="3" placeholder='["/path/to/server.js"]'></textarea><p class="field-help">Use an installed server executable directly. Aurora does not download or install server packages. Arguments are saved as local plain text at rest; keep credentials out of them.</p></div><div id="mcp-status" role="status"></div><div class="dialog-footer"><button id="mcp-new" type="button" class="text-button">Clear form</button><button class="primary" type="submit">Save server</button></div></form>`;
  document.body.append(extensionDialog);el('extensions-close').onclick=()=>extensionDialog.close();
  const connectionsDialog=document.createElement('dialog');connectionsDialog.id='connections-dialog';
  connectionsDialog.innerHTML=`<div class="dialog-heading"><div><div class="eyebrow">KEYS AND SERVICES</div><h2>Connections</h2></div><button id="connections-close" class="icon-button" aria-label="Close connections">×</button></div><p>One place for the keys and endpoints Aurora uses. Keys are encrypted on this device and never sent to a model.</p><div class="connections-grid">
    <section class="connection-tile"><header><strong>Model provider</strong><span id="conn-model-badge" class="conn-badge muted">Not connected</span></header><small id="conn-model-detail">Choose a provider and model.</small><input id="conn-model-key" type="password" autocomplete="off" placeholder="Paste API key"><div id="conn-model-status" class="field-help" role="status"></div><div class="conn-actions"><button id="conn-model-save" type="button" class="secondary">Save key</button><button id="conn-model-test" type="button" class="secondary">Test</button><button id="conn-model-manage" type="button" class="text-button">Manage model</button><button id="conn-model-key-link" type="button" class="text-button">Get key</button></div></section>
    <section class="connection-tile"><header><strong>Web search</strong><span id="conn-search-badge" class="conn-badge muted">No key</span></header><small>Ollama Cloud key, used only for web search.</small><input id="conn-search-key" type="password" autocomplete="off" placeholder="Paste Ollama Cloud key" maxlength="1000"><div class="field-help">Create a key at ollama.com/settings/keys.</div><div id="conn-search-status" class="field-help" role="status"></div><div class="conn-actions"><button id="conn-search-save" type="button" class="primary">Save</button><button id="conn-search-test" type="button" class="secondary">Test</button><button id="conn-search-forget" type="button" class="text-button">Forget</button><button id="conn-search-link" type="button" class="text-button">Get key</button></div></section>
    <section class="connection-tile"><header><strong>Voice and wake word</strong><span id="conn-voice-badge" class="conn-badge muted">Off</span></header><small id="conn-voice-detail">Spoken replies and cloud recognition.</small><div class="conn-actions"><button id="conn-voice-manage" type="button" class="secondary">Manage voice</button></div></section>
    <section class="connection-tile"><header><strong>Market data and wallets</strong><span id="conn-market-badge" class="conn-badge muted">Public RPC</span></header><small>A custom Solana RPC makes wallet scans and portfolio reads reliable. WalletConnect handles live swaps.</small><input id="conn-rpc" type="url" placeholder="https://your-rpc.example" maxlength="200" spellcheck="false"><div class="field-help">Leave blank to use the public Solana RPC.</div><div id="conn-market-status" class="field-help" role="status"></div><div class="conn-actions"><button id="conn-rpc-save" type="button" class="secondary">Save RPC</button><button id="conn-rpc-test" type="button" class="secondary">Test</button><button id="conn-wallet-manage" type="button" class="text-button">Manage wallet</button></div><div class="conn-sub"><span id="conn-helius-detail">Parsed swap history off</span><span id="conn-helius-badge" class="conn-badge muted">Helius</span></div><input id="conn-helius-key" type="password" autocomplete="off" placeholder="Helius API key (optional)" maxlength="1000"><div class="field-help">Unlocks parsed swap descriptions for followed wallets.</div><div id="conn-helius-status" class="field-help" role="status"></div><div class="conn-actions"><button id="conn-helius-save" type="button" class="secondary">Save Helius</button><button id="conn-helius-test" type="button" class="secondary">Test</button><button id="conn-helius-forget" type="button" class="text-button">Forget</button><button id="conn-helius-link" type="button" class="text-button">Get key</button></div><div class="conn-sub"><span id="conn-jupiter-detail">Jupiter key off</span><span id="conn-jupiter-badge" class="conn-badge muted">Jupiter</span></div><input id="conn-jupiter-key" type="password" autocomplete="off" placeholder="Jupiter API key (optional)" maxlength="1000"><div class="field-help">Optional. Raises the price API limit for scans and charts.</div><div id="conn-jupiter-status" class="field-help" role="status"></div><div class="conn-actions"><button id="conn-jupiter-save" type="button" class="secondary">Save Jupiter</button><button id="conn-jupiter-test" type="button" class="secondary">Test</button><button id="conn-jupiter-forget" type="button" class="text-button">Forget</button><button id="conn-jupiter-link" type="button" class="text-button">Get key</button></div><div class="conn-sub"><span id="conn-wc-detail">WalletConnect not connected</span><span id="conn-wc-badge" class="conn-badge muted">Wallet</span></div></section>
  </div><div id="connections-status" class="field-help" role="status"></div>`;
  document.body.append(connectionsDialog);el('connections-close').onclick=()=>connectionsDialog.close();
  const sections=[['preferences-dialog','General','preferences-open'],['connections-dialog','Connections',null],['settings-dialog','Models','settings-open'],['voice-dialog','Voice & wake word','voice-open'],['wallet-dialog','Wallet','wallet-open'],['theme-dialog','Theme','theme-open'],['appearance-dialog','Pet','appearance-open'],['extensions-dialog','Capabilities',null],['updates-dialog','Updates','updates-open']];
  function openSection(id){for(const [other]of sections)if(el(other).open)el(other).close();const section=sections.find(s=>s[0]===id);if(section[2])el(section[2]).click();else if(id==='connections-dialog'){renderConnections();connectionsDialog.showModal();}else{renderExtensions();extensionDialog.showModal();}el(id).querySelector('.settings-nav .selected').focus();}
  for(const [id,label]of sections){
    const dialog=el(id);dialog.classList.add('settings-workspace');
    const content=document.createElement('div');content.className='settings-content';while(dialog.firstChild)content.append(dialog.firstChild);
    const nav=document.createElement('nav');nav.className='settings-nav';nav.setAttribute('aria-label','Settings sections');
    const heading=document.createElement('h2');heading.textContent='Settings';nav.append(heading);
    for(const [target,name]of sections){const button=document.createElement('button');button.type='button';button.textContent=name;button.dataset.settingsTarget=target;button.className=target===id?'selected':'';if(target===id)button.setAttribute('aria-current','page');button.onclick=()=>openSection(target);nav.append(button);}
    const footer=document.createElement('p');footer.textContent='Aurora · Heartflow AI';nav.append(footer);dialog.append(nav,content);dialog.setAttribute('aria-label',label+' settings');
  }
  const KEY_URLS={'ollama-cloud':'https://ollama.com/settings/keys','openai':'https://platform.openai.com/api-keys','anthropic':'https://console.anthropic.com/settings/keys','openrouter':'https://openrouter.ai/keys'};
  function setBadge(id,text,state){const badge=el(id);if(!badge)return;badge.textContent=text;badge.className='conn-badge'+(state==='ok'?' ok':state==='warn'?' warn':' muted');}
  function renderConnections(){
    if(typeof view==='undefined')return;
    const active=view.connections[view.provider]||{};
    setBadge('conn-model-badge',active.key?(active.hasKey?'Connected':'Needs key'):(active.model?'Local ready':'Not connected'),active.key?(active.hasKey?'ok':'warn'):(active.model?'ok':'warn'));
    el('conn-model-detail').textContent=`${active.name||view.provider}${view.model?' · '+view.model:' · no model selected'}`;
    const localModel=view.provider==='ollama-local';
    el('conn-model-key').hidden=localModel;
    el('conn-model-save').hidden=localModel;
    el('conn-model-key').value='';
    el('conn-model-key').placeholder=localModel?'Local Ollama needs no key':`Paste ${active.name||view.provider} API key`;
    el('conn-model-status').textContent='';
    const search=view.connections['ollama-cloud'];
    setBadge('conn-search-badge',search?.hasKey?'Key saved':'No key',search?.hasKey?'ok':'warn');
    el('conn-search-key').value='';
    el('conn-search-status').textContent='';
    const voice=view.voice||{};
    const voiceKey=(voice[voice.provider]||{}).hasKey||voice.elevenlabs?.hasKey||voice.fish?.hasKey;
    setBadge('conn-voice-badge',voiceKey?'Key saved':'No key',voiceKey?'ok':'muted');
    const selectedVoice=voice[voice.provider]||{};el('conn-voice-detail').textContent=`${voice.provider==='fish'?'Fish Audio':'ElevenLabs'} · ${selectedVoice.voiceId?'voice selected':'no voice selected'}`;
    const wallet=view.wallet;
    const rpc=wallet?.config?.rpc||'';
    el('conn-rpc').value=rpc;
    setBadge('conn-market-badge',rpc?'Custom RPC':'Public RPC',rpc?'ok':'warn');
    el('conn-market-status').textContent='';
    const helius=view.heliusHasKey===true;
    setBadge('conn-helius-badge',helius?'Key saved':'No key',helius?'ok':'muted');
    el('conn-helius-detail').textContent=helius?'Parsed swap history on':'Parsed swap history off';
    el('conn-helius-key').value='';
    el('conn-helius-status').textContent='';
    const jupiter=view.jupiterHasKey===true;
    setBadge('conn-jupiter-badge',jupiter?'Key saved':'No key',jupiter?'ok':'muted');
    el('conn-jupiter-detail').textContent=jupiter?'Jupiter API key on':'Jupiter key off';
    el('conn-jupiter-key').value='';
    el('conn-jupiter-status').textContent='';
    const connected=wallet?.wc?.connected===true;
    setBadge('conn-wc-badge',connected?'Connected':'Not connected',connected?'ok':'muted');
    el('conn-wc-detail').textContent=connected?`WalletConnect ${((wallet.wc.accounts[0]||'').split(':').pop()||'').slice(0,8)}…`:'WalletConnect not connected';
    el('connections-status').textContent='';
  }
  el('conn-model-manage').onclick=()=>openSection('settings-dialog');
  el('conn-model-key-link').onclick=()=>call(window.aurora.openLink(KEY_URLS[view?.provider]||KEY_URLS['ollama-cloud'])).catch(error=>{el('connections-status').textContent=error.message;});
  el('conn-model-save').onclick=action(async()=>{const key=el('conn-model-key').value.trim();if(!key)throw new Error('Paste an API key first.');if(!view.model)throw new Error('Choose a model first with Manage model.');render(await call(window.aurora.saveSettings({provider:view.provider,model:view.model,key})));renderConnections();el('conn-model-status').textContent='Model key saved.';toast('Model key saved.');});
  el('conn-model-test').onclick=action(async()=>{const status=el('conn-model-status');status.textContent='Testing connection…';const models=await call(window.aurora.models({provider:view.provider,key:el('conn-model-key').value.trim()||undefined,baseUrl:view.connections[view.provider]?.baseUrl}));status.textContent=`Connected. ${models.length} models available.`;});
  el('conn-search-link').onclick=()=>call(window.aurora.openLink(KEY_URLS['ollama-cloud'])).catch(error=>{el('connections-status').textContent=error.message;});
  el('conn-search-save').onclick=action(async()=>{const key=el('conn-search-key').value.trim();if(!key)throw new Error('Paste an Ollama Cloud key first.');render(await call(window.aurora.searchSettings({key})));renderConnections();el('conn-search-status').textContent='Web search key saved.';toast('Web search key saved.');});
  el('conn-search-test').onclick=action(async()=>{const status=el('conn-search-status');status.textContent='Testing web search…';const result=await call(window.aurora.searchTest(el('conn-search-key').value.trim()));status.textContent=`Web search works${result.results?` · ${result.results} results`:''}.`;});
  el('conn-search-forget').onclick=action(async()=>{render(await call(window.aurora.searchSettings({forgetKey:true})));renderConnections();el('conn-search-status').textContent='Web search key removed.';});
  el('conn-voice-manage').onclick=()=>openSection('voice-dialog');
  el('conn-wallet-manage').onclick=()=>openSection('wallet-dialog');
  el('conn-rpc-save').onclick=action(async()=>{render(await call(window.aurora.walletConfig({rpc:el('conn-rpc').value.trim()})));renderConnections();el('conn-market-status').textContent='RPC saved.';toast('RPC saved.');});
  el('conn-rpc-test').onclick=action(async()=>{const status=el('conn-market-status');status.textContent='Testing RPC…';const result=await call(window.aurora.walletRpcTest(el('conn-rpc').value.trim()));status.textContent=`RPC responded (${result.version}).`;});
  el('conn-helius-link').onclick=()=>call(window.aurora.openLink('https://dashboard.helius.dev')).catch(error=>{el('connections-status').textContent=error.message;});
  el('conn-helius-save').onclick=action(async()=>{const key=el('conn-helius-key').value.trim();if(!key)throw new Error('Paste a Helius key first.');render(await call(window.aurora.heliusSettings({key})));renderConnections();el('conn-helius-status').textContent='Helius key saved.';toast('Helius key saved.');});
  el('conn-helius-test').onclick=action(async()=>{const status=el('conn-helius-status');status.textContent='Testing Helius…';const result=await call(window.aurora.heliusTest(el('conn-helius-key').value.trim()));status.textContent=`Helius works${result.transactions?` · ${result.transactions} transaction${result.transactions===1?'':'s'}`:''}.`;});
  el('conn-helius-forget').onclick=action(async()=>{render(await call(window.aurora.heliusSettings({forgetKey:true})));renderConnections();el('conn-helius-status').textContent='Helius key removed.';});
  el('conn-jupiter-link').onclick=()=>call(window.aurora.openLink('https://portal.jup.ag')).catch(error=>{el('connections-status').textContent=error.message;});
  el('conn-jupiter-save').onclick=action(async()=>{const key=el('conn-jupiter-key').value.trim();if(!key)throw new Error('Paste a Jupiter key first.');render(await call(window.aurora.jupiterSettings({key})));renderConnections();el('conn-jupiter-status').textContent='Jupiter key saved.';toast('Jupiter key saved.');});
  el('conn-jupiter-test').onclick=action(async()=>{const status=el('conn-jupiter-status');status.textContent='Testing Jupiter…';const result=await call(window.aurora.jupiterTest(el('conn-jupiter-key').value.trim()));status.textContent=`Jupiter works${result.priced?' · SOL priced':''}.`;});
  el('conn-jupiter-forget').onclick=action(async()=>{render(await call(window.aurora.jupiterSettings({forgetKey:true})));renderConnections();el('conn-jupiter-status').textContent='Jupiter key removed.';});
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
  const connectionsButton=document.createElement('button');connectionsButton.id='connections-open';connectionsButton.type='button';connectionsButton.dataset.settingsSection='';connectionsButton.innerHTML='<span class="preference-icon" aria-hidden="true">✦</span><span><strong>Connections</strong><small id="preferences-connections">Model, web search, voice, RPC and wallet keys</small></span><span aria-hidden="true">›</span>';connectionsButton.onclick=()=>openSection('connections-dialog');document.querySelector('.preferences-sections').prepend(connectionsButton);
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
  const shortcut=document.createElement('button');shortcut.id='extensions-open';shortcut.className='sidebar-action';shortcut.textContent='◇ Capabilities';shortcut.onclick=()=>openSection('extensions-dialog');
  document.querySelector('.sidebar-bottom').prepend(shortcut);
  let editingServer='';
  const transport=()=>{const remote=el('mcp-transport').value==='http';el('mcp-http').hidden=!remote;el('mcp-stdio').hidden=remote;};el('mcp-transport').onchange=transport;
  function resetServer(){editingServer='';el('mcp-form').reset();el('mcp-token').value='';el('mcp-form-title').textContent='Add a server';el('mcp-status').textContent='';transport();}el('mcp-new').onclick=resetServer;
  const CAP_ICONS={files:'▱',web:'⌕',desktop:'▣',shell:'⌘',wallet:'◎'};
  function capabilityCard(plugin){
    const card=document.createElement('article');card.className='cap-card'+(plugin.enabled?' on':'');
    const head=document.createElement('div');head.className='cap-card-head';
    const icon=document.createElement('span');icon.className='cap-icon';icon.textContent=CAP_ICONS[plugin.id]||'◆';
    const title=document.createElement('div');title.className='cap-card-title';
    const name=document.createElement('strong');name.textContent=plugin.name;
    const desc=document.createElement('small');desc.textContent=plugin.description;
    title.append(name,desc);
    const toggle=document.createElement('button');toggle.type='button';toggle.className='cap-switch';toggle.setAttribute('role','switch');toggle.setAttribute('aria-checked',String(plugin.enabled));toggle.setAttribute('aria-label',`${plugin.enabled?'Disable':'Enable'} ${plugin.name}`);toggle.disabled=busy;toggle.append(document.createElement('i'));
    toggle.onclick=action(async()=>{toggle.disabled=true;render(await call(window.aurora.pluginToggle(plugin.id,!plugin.enabled)));renderExtensions();});
    head.append(icon,title,toggle);
    const meta=document.createElement('div');meta.className='cap-card-meta';
    const tools=document.createElement('span');tools.className='cap-chip';tools.textContent=`${plugin.tools.length} tool${plugin.tools.length===1?'':'s'}`;meta.append(tools);
    if(plugin.owner){const owner=document.createElement('span');owner.className='cap-chip accent';owner.textContent='Gigi only';meta.append(owner);}
    const state=document.createElement('span');state.className='cap-chip'+(plugin.enabled?' on':'');state.textContent=plugin.enabled?'On':'Off';meta.append(state);
    const details=document.createElement('details');details.className='cap-tools';
    const summary=document.createElement('summary');summary.textContent='View tools';
    const list=document.createElement('div');list.className='cap-tool-list';
    for(const tool of plugin.tools){const chip=document.createElement('span');chip.textContent=tool;list.append(chip);}
    details.append(summary,list);
    card.append(head,meta,details);return card;
  }
  function capabilityServer(server){
    const card=document.createElement('article');card.className='cap-mcp-card';
    const head=document.createElement('div');head.className='cap-mcp-head';
    const dot=document.createElement('span');dot.className=`cap-status ${server.status==='connected'?'on':server.status==='error'?'error':''}`;
    const title=document.createElement('div');title.className='cap-mcp-title';
    const name=document.createElement('strong');name.textContent=server.name;
    const detail=document.createElement('small');detail.textContent=`${server.transport==='http'?'Remote endpoint':'Local executable'} · ${server.tools.length} tool${server.tools.length===1?'':'s'}`;
    title.append(name,detail);
    const badge=document.createElement('span');badge.className=`conn-badge ${server.status==='connected'?'ok':server.status==='connecting'?'warn':'muted'}`;badge.textContent=server.status;
    head.append(dot,title,badge);
    const controls=document.createElement('div');controls.className='cap-mcp-controls';
    for(const [label,operation]of [[server.status==='connected'?'Disconnect':server.transport==='stdio'?'Run & connect':'Connect',server.status==='connected'?'disconnect':'connect'],['Edit','edit'],['Remove','remove']]){
      const button=document.createElement('button');button.type='button';button.className=operation==='remove'?'text-button danger':operation==='connect'?'secondary':'text-button';button.textContent=label;button.disabled=busy||server.status==='connecting';button.onclick=action(async()=>{
        if(operation==='edit'){editingServer=server.id;el('mcp-form-title').textContent='Edit '+server.name;el('mcp-name').value=server.name;el('mcp-transport').value=server.transport;el('mcp-url').value=server.url||'';el('mcp-command').value=server.command||'';el('mcp-args').value=JSON.stringify(server.args||[]);el('mcp-token').value='';transport();el('mcp-name').focus();return;}
        button.disabled=true;try{render(await call(window.aurora.mcpAction(server.id,operation)));el('mcp-status').textContent=operation==='connect'?'Connected. Tools are available to Aurora.':'';}catch(error){el('mcp-status').textContent=error.message;}finally{renderExtensions();}
      });controls.append(button);
    }
    card.append(head,controls);
    if(server.tools.length){const details=document.createElement('details');details.className='cap-tools';const summary=document.createElement('summary');summary.textContent='View tools';const list=document.createElement('div');list.className='cap-tool-list';for(const tool of server.tools){const chip=document.createElement('span');chip.textContent=tool.name;list.append(chip);}details.append(summary,list);card.append(details);}
    return card;
  }
  function renderExtensions(){
    if(typeof view==='undefined')return;
    const plugins=view.plugins||[],servers=view.mcpServers||[];
    const enabled=plugins.filter(plugin=>plugin.enabled).length;
    const connected=servers.filter(server=>server.status==='connected').length;
    const liveTools=plugins.filter(plugin=>plugin.enabled).reduce((sum,plugin)=>sum+plugin.tools.length,0)+servers.filter(server=>server.status==='connected').reduce((sum,server)=>sum+server.tools.length,0);
    el('cap-builtin-count').textContent=`${enabled} / ${plugins.length} on`;
    el('cap-builtin-count').className='conn-badge '+(enabled===plugins.length?'ok':enabled?'warn':'muted');
    el('cap-mcp-count').textContent=`${connected} / ${servers.length} connected`;
    el('cap-mcp-count').className='conn-badge '+(connected?'ok':'muted');
    const summary=el('cap-summary');summary.replaceChildren();
    for(const [value,label] of [[liveTools,'tools live'],[enabled,'built-in on'],[connected,'MCP connected']]){const item=document.createElement('div');const strong=document.createElement('strong');strong.textContent=String(value);const small=document.createElement('span');small.textContent=label;item.append(strong,small);summary.append(item);}
    el('plugin-list').replaceChildren();
    for(const plugin of plugins)el('plugin-list').append(capabilityCard(plugin));
    el('mcp-list').replaceChildren();
    for(const server of servers)el('mcp-list').append(capabilityServer(server));
    if(!servers.length){const text=document.createElement('p');text.className='cap-empty';text.textContent='No MCP servers yet. Add a remote endpoint or a local executable below.';el('mcp-list').append(text);}
  }
  el('mcp-form').onsubmit=event=>{event.preventDefault();action(async()=>{try{const value={id:editingServer,name:el('mcp-name').value,transport:el('mcp-transport').value,url:el('mcp-url').value,command:el('mcp-command').value,args:el('mcp-transport').value==='stdio'?JSON.parse(el('mcp-args').value||'[]'):[],token:el('mcp-token').value};render(await call(window.aurora.mcpSave(value)));resetServer();renderExtensions();el('mcp-status').textContent='Saved. Choose Connect when you want to use this server.';}catch(error){el('mcp-status').textContent=error.message;}})();};
  // The character stays visible above two workspace tabs.
  const dock=document.querySelector('.companion');const tabs=document.createElement('div');tabs.className='dock-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Companion panel');
  const activityPanel=document.createElement('div');activityPanel.id='dock-activity';activityPanel.className='dock-page';activityPanel.setAttribute('role','tabpanel');
  const filesPanel=document.createElement('div');filesPanel.id='dock-files';filesPanel.className='dock-page';filesPanel.setAttribute('role','tabpanel');filesPanel.hidden=true;
  filesPanel.innerHTML='<div class="file-toolbar"><button id="file-up" title="Parent folder">↑</button><span id="file-location">Workspace files</span><button id="file-refresh" title="Refresh files">↻</button></div><div id="workspace-file-list"></div><div id="workspace-preview" hidden><button id="file-preview-close" class="text-button">Back to files</button><strong id="file-preview-name"></strong><pre id="file-preview-content"></pre></div><p id="file-browser-status" role="status"></p>';
  for(const node of [dock.querySelector('.activity-heading'),el('file-results-open'),el('activity')])activityPanel.append(node);
  const marketsPanel=document.createElement('div');marketsPanel.id='dock-markets';marketsPanel.className='dock-page';marketsPanel.setAttribute('role','tabpanel');marketsPanel.hidden=true;marketsPanel.innerHTML='<div id="market-panel-body"></div>';
  const dockPanels=[activityPanel,filesPanel,marketsPanel];
  for(const [id,label]of [['dock-activity','Activity'],['dock-files','Files'],['dock-markets','Markets']]){const button=document.createElement('button');button.id=id+'-tab';button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls',id);button.setAttribute('aria-selected',String(id==='dock-activity'));button.onclick=()=>{for(const pane of dockPanels){pane.hidden=pane.id!==id;el(pane.id+'-tab').setAttribute('aria-selected',String(pane.id===id));}if(id==='dock-files')browseFiles();if(id==='dock-markets')window.AuroraWorkspace?.open();};tabs.append(button);}
  dock.querySelector('.companion-foot').before(tabs,activityPanel,filesPanel,marketsPanel);
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
  function syncView(){if(typeof view==='undefined')return;connections();renderExtensions();if(connectionsDialog.open)renderConnections();if(workspace!==view.workspace){workspace=view.workspace;directory='.';fileGeneration++;el('workspace-file-list').replaceChildren();el('file-preview-content').textContent='';el('workspace-preview').hidden=true;if(!filesPanel.hidden)browseFiles();}}
  window.addEventListener('aurora-view-rendered',syncView);
  window.aurora.onEvent(event=>{
    if(event.type==='extensions'){if(typeof view==='undefined')return;view.plugins=event.plugins;view.mcpServers=event.servers;renderExtensions();}
    if(event.type==='wallet'&&connectionsDialog.open)renderConnections();
    if(event.type==='snapshot')syncView();
  });
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key===','&&!event.repeat&&!document.querySelector('dialog[open]')){event.preventDefault();openSection('preferences-dialog');}});
})();
