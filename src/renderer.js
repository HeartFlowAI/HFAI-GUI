const $ = id => document.getElementById(id);
let view, busy = false, detached = false, replyElement, replyText = '', replyTimer, approvalId, toastTimer;
let searchTimer,searchGeneration=0,searchResults=null,deletingId,editingSessionId,deletingProjectId;
let workspaceSort='updated',lastLibraryContext;
const expandedProjects=new Set();
try{const saved=JSON.parse(localStorage.getItem('aurora-project-groups')||'[]');if(Array.isArray(saved))saved.filter(id=>typeof id==='string').forEach(id=>expandedProjects.add(id));}catch{}
const captions = { idle: 'Here to help. Happy to be here.', thinking: 'Connecting the little dots…', browsing: 'A little curiosity goes a long way.', coding: 'Making something good, together.', waiting: 'I’ll wait for your say-so.', celebrating: 'We made it happen! ✦', error: 'A little hiccup. Let’s try again.' };
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 7000); }
async function call(promise) { const result = await promise; if (!result.ok) throw new Error(result.error); return result.value; }
function action(fn) { return async (...args) => { try { await fn(...args); } catch (error) { toast(error.message); } }; }
function scroll() { $('messages').scrollTop = $('messages').scrollHeight; }
function pinned() { const area=$('messages');return area.scrollHeight-area.scrollTop-area.clientHeight<100; }
function addMessage(role, content, autoScroll = true) {
  const element = document.createElement('div'); element.className = `message ${role}`;
  const author = document.createElement('div'); author.className = 'message-author'; author.textContent = role === 'user' ? 'You' : 'Aurora ✦';
  const body = document.createElement('div'); body.className = 'message-body';
  if(role==='assistant')AuroraMarkdown.render(body,content);else body.textContent=content;
  element.append(author, body); $('messages').append(element); if(autoScroll)scroll(); return body;
}
function flushReply() {
  clearTimeout(replyTimer);replyTimer=null;
  if(!replyElement?.isConnected)return;
  const follow=pinned();AuroraMarkdown.render(replyElement,replyText);if(follow)scroll();
}
window.addEventListener('aurora-notice',event=>toast(event.detail));
const toolLabels={ask_user_question:'Waiting for your answer',voice_reply:'Preparing a spoken reply',find_files:'Searching your files',reveal_file:'Showing a file',list_files:'Exploring a folder',read_file:'Reading a file',write_file:'Writing a file',run_powershell:'Running a command',web_search:'Searching the web',computer:'Using your computer',open_application:'Opening an app'};
function finishActivity(item,result) {
  let failed=false;try{failed=!!JSON.parse(result)?.error;}catch{}
  item.dataset.status=failed?'error':'done';
  item.querySelector('.tool-icon').textContent=failed?'!':'✓';
  item.querySelector('.tool-status').textContent=failed?'Needs attention':'Done';
}
function activity(name, args, result, id) {
  const item = document.createElement('details'); item.className = 'activity-item'; if (id) item.dataset.id = id;
  item.dataset.status='running';
  const title = document.createElement('summary');title.title=name;
  const icon=document.createElement('span');icon.className='tool-icon';icon.textContent='◌';icon.setAttribute('aria-hidden','true');
  const external=view?.mcpServers?.find(server=>server.tools.some(tool=>tool.runtimeName===name));
  const externalLabel=external?`${external.name} · ${external.tools.find(tool=>tool.runtimeName===name).name}`:'';
  const label=document.createElement('span');label.className='tool-label';label.textContent=externalLabel||(name==='computer'?{observe:'Looking at an app',focus:'Switching to an app',move:'Moving the pointer',click:'Clicking a control',type:'Typing',keys:'Using the keyboard',scroll:'Scrolling',wait:'Waiting for an app',navigate:'Opening a page'}[args.action]:null)||toolLabels[name]||name.replaceAll('_',' ');
  const status=document.createElement('span');status.className='tool-status';status.textContent='Working';
  title.append(icon,label,status);
  const pre = document.createElement('pre'); pre.textContent = JSON.stringify(args, null, 2) + (result != null ? `\n\n${result}` : '');
  item.append(title, pre);if(result!=null)finishActivity(item,result);
  const empty = $('activity').querySelector('.activity-empty'); empty?.remove(); $('activity').prepend(item);
}
function setBusy(value) { busy = value; $('stop').hidden = !value; $('send').disabled = value; $('new-chat').disabled = value; $('workspace').disabled = value;for(const id of ['project-add','session-project','session-delete','work-mode','composer-model'])$(id).disabled=value; }
function petDisplay(value) { detached = value; $('pet-host').hidden = value; $('detach').textContent = value ? '↙ Bring Aurora home' : '↗ Let me explore your desktop'; $('roam').hidden = !value; }
function requestSessionDelete(id){
  if(busy)return;
  const chat=view.chats.find(c=>c.id===id);if(!chat)return;
  $('session-menu').open=false;deletingId=id;$('delete-session-description').textContent=chat.title;
  $('delete-session-dialog').showModal();
}
function showSidebarMenu(event,items){
  event.preventDefault();event.stopPropagation();if(busy)return;document.querySelector('.sidebar-context-menu')?.remove();
  const menu=document.createElement('div');menu.className='sidebar-context-menu';menu.setAttribute('role','menu');
  for(const item of items){const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.textContent=item.label;if(item.danger)button.classList.add('danger');button.onclick=()=>{menu.remove();item.run();};menu.append(button);}
  document.body.append(menu);const rect=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(event.clientX,innerWidth-rect.width-8))+'px';menu.style.top=Math.max(8,Math.min(event.clientY,innerHeight-rect.height-8))+'px';menu.querySelector('button')?.focus();
}
function sessionMenuItems(chat){return[
  {label:'Rename session',run:()=>{editingSessionId=chat.id;$('rename-session-input').value=chat.title;$('rename-session-dialog').showModal();$('rename-session-input').focus();}},
  {label:chat.pinned?'Unpin session':'Pin session',run:action(async()=>{render(await call(window.aurora.toggleSessionPinned(chat.id)));renderHistory();})},
  {label:'Duplicate session',run:action(async()=>{render(await call(window.aurora.duplicateSession(chat.id)));renderHistory();toast('Session duplicated.');})},
  {label:'Archive session',run:action(async()=>{render(await call(window.aurora.archiveSession(chat.id,true)));renderHistory();toast('Session archived.');})},
  {label:'Delete session',danger:true,run:()=>requestSessionDelete(chat.id)}
];}
function requestProjectDelete(project){if(busy||!project?.id)return;deletingProjectId=project.id;$('delete-project-name').textContent=project.name;$('delete-project-dialog').showModal();}
function sessionRow(chat,button){
  const row=document.createElement('div');row.className='session-row'+(chat.id===view.currentId?' selected':'');row.dataset.sessionId=chat.id;
  if(chat.pinned)row.classList.add('pinned');
  const more=document.createElement('button');more.type='button';more.className='session-row-more';more.disabled=busy;more.setAttribute('aria-haspopup','menu');more.textContent='⋯';more.title='Session options';more.setAttribute('aria-label',`Options for ${chat.title}`);more.onclick=e=>showSidebarMenu(e,sessionMenuItems(chat));row.oncontextmenu=e=>showSidebarMenu(e,sessionMenuItems(chat));row.append(button,more);return row;
}
function render(data) {
  const changedChat=view?.currentId!==data.currentId;
  if (changedChat) { $('file-results-open').hidden = true; $('file-results-dialog').close(); $('file-results').replaceChildren(); }
  view = data; setBusy(data.busy); petDisplay(data.detached);
  $('pet-host').dataset.appearance = data.appearance || 'classic';
  $('app-version').textContent = data.version;
  renderUpdates(data.updates);
  window.renderAuroraVoice?.(data.voice);
  $('pet-host').dataset.state = data.state || 'idle'; $('pet-caption').textContent = captions[data.state] || captions.idle;
  $('composer-model-label').textContent = data.model || `${data.connections[data.provider].name} · not connected`;
  $('work-mode').value=data.mode;
  $('workspace-label').textContent = data.workspace ? data.workspace.split(/[\\/]/).filter(Boolean).pop() || data.workspace : 'Choose folder'; $('workspace').title = data.workspace || 'Choose workspace folder';
  renderLibrary();
  if (!data.busy) renderMessages(data.messages,changedChat);
  window.dispatchEvent(new Event('aurora-view-rendered'));
}
function renderLibrary(){
  const context=view.mode+':'+(view.activeProjectId||'ungrouped');if(lastLibraryContext!==context){expandedProjects.add(view.activeProjectId||'ungrouped');lastLibraryContext=context;}
  const code=view.mode==='code',p=view.projects.find(p=>p.id===view.activeProjectId),chat=view.chats.find(c=>c.id===view.currentId);
  document.body.dataset.mode=view.mode;
  for(const id of ['project-add','session-project','session-delete','work-mode','composer-model'])$(id).disabled=busy;
  document.querySelector('.agent-heading h1').textContent=code?'Aurora Code':'Aurora';document.querySelector('.agent-heading div>span').textContent=code?'Build, debug, and create.':'Your ideas, brought to life.';
  $('prompt').placeholder=code?'What shall we build or fix?':'What shall we work on?';$('session-title').textContent=chat?.title||'New conversation';$('session-context').textContent=`${code?'Aurora Code':'Normal'} · ${p?.name||'No project'}`;
  const welcome=$('welcome');welcome.querySelector('.eyebrow').textContent=code?'YOUR CODING COMPANION':'MEET YOUR NEW COMPANION';welcome.querySelector('h2').textContent=code?'Your next idea starts here.':'A little spark. A lot of possibility.';welcome.querySelector('p').textContent=code?'Choose a project folder, describe your idea, and let’s build it together.':'I’m Aurora. Tell me what you’re imagining, and we’ll make it happen together.';
  const suggestions=code?[
    ['▱ Understand this project','Explore the code and structure ↗','Explore the selected workspace and explain its structure and how to run it.'],
    ['⌘ Review my code','Find issues worth fixing ↗','Review the selected workspace for concrete bugs. Explain findings before proposing changes.'],
    ['✦ Help me build','Start with an idea ↗','Help me build something in this workspace. Ask what I want to create before changing files.']
  ]:[['▱ Explore my workspace','Find your starting point ↗','Explore the selected workspace and tell me what is in it.'],['⌘ Make something with me','Create our first file ↗','Create a file called hello-aurora.txt in my workspace with a short introduction to yourself.'],['◎ Research an idea','Follow your curiosity ↗','Search the web for the latest Ollama cloud documentation and summarize it with source links.']];
  welcome.querySelectorAll('[data-prompt]').forEach((button,i)=>{button.firstChild.textContent=suggestions[i][0];button.querySelector('span').textContent=suggestions[i][1];button.dataset.prompt=suggestions[i][2];});
  const workspaceItems=[{id:null,name:'Default workspace'},...view.projects];
  $('projects').replaceChildren();for(const item of workspaceItems){const b=document.createElement('button');b.className='project-link'+(item.id===view.activeProjectId?' active':'');const label=document.createElement('span');label.className='project-name';label.textContent='▱ '+item.name;const count=document.createElement('span');count.className='project-count';count.textContent=view.chats.filter(c=>c.projectId===item.id&&c.mode===view.mode).length;count.setAttribute('aria-label',`${count.textContent} sessions`);b.append(label,count);b.title=item.name;b.disabled=busy;b.onclick=action(async()=>{clearSearch();render(await call(window.aurora.sessionContext({mode:view.mode,projectId:item.id})));renderHistory();});$('projects').append(b);}
  // Other workspace groups can be expanded without switching the current conversation.
  for(const [i,item]of workspaceItems.entries()){
    const link=$('projects').children[i],group=document.createElement('div');group.className='project-group';
    link.replaceWith(group);group.append(link);const toggle=document.createElement('button');toggle.className='project-expand';toggle.title='Show sessions in '+item.name;toggle.setAttribute('aria-label',toggle.title);toggle.disabled=busy;
    const key=item.id||'ungrouped',list=document.createElement('div');list.className='project-sessions';list.id='project-sessions-'+key;toggle.setAttribute('aria-controls',list.id);
    function fold(){const open=expandedProjects.has(key);list.hidden=!open;toggle.textContent=open?'⌄':'›';toggle.setAttribute('aria-expanded',String(open));}
    toggle.onclick=()=>{if(expandedProjects.has(key))expandedProjects.delete(key);else expandedProjects.add(key);try{localStorage.setItem('aurora-project-groups',JSON.stringify([...expandedProjects]));}catch{}fold();};group.prepend(toggle);
    const projectItems=[{label:'Open workspace',run:action(async()=>{clearSearch();render(await call(window.aurora.sessionContext({mode:view.mode,projectId:item.id})));renderHistory();})}];if(item.id)projectItems.push({label:'Delete workspace',danger:true,run:()=>requestProjectDelete(item)});
    group.oncontextmenu=e=>showSidebarMenu(e,projectItems);const more=document.createElement('button');more.type='button';more.className='project-row-more';more.textContent='⋯';more.title='Workspace options';more.setAttribute('aria-label',`Options for ${item.name}`);more.disabled=busy;more.onclick=e=>showSidebarMenu(e,projectItems);group.append(more);
    for(const chat of view.chats.filter(c=>c.projectId===item.id&&c.mode===view.mode).slice().sort((a,b)=>workspaceSort==='title'?a.title.localeCompare(b.title):Number(b.pinned)-Number(a.pinned)||b.updated-a.updated)){
      const button=document.createElement('button');button.className='project-session'+(chat.id===view.currentId?' active':'');button.textContent=chat.title;button.title=chat.title;button.disabled=busy;
      button.onclick=action(async()=>{clearSearch();render(await call(window.aurora.selectChat(chat.id)));renderHistory();});list.append(sessionRow(chat,button));
    }
    if(!list.children.length){const empty=document.createElement('small');empty.textContent='No sessions yet';list.append(empty);}group.append(list);fold();
  }
  $('session-project').replaceChildren();for(const item of [{id:'',name:'No project'},...view.projects]){const o=document.createElement('option');o.value=item.id;o.textContent=item.name;$('session-project').append(o);}$('session-project').value=view.activeProjectId||'';
  $('chats').replaceChildren();const searching=$('session-search').value.trim();$('sessions-label').textContent=searching?'SEARCH RESULTS · ALL SESSIONS':'SESSIONS';
  $('projects').hidden=!!searching;$('chats').hidden=!searching;$('sessions-label').hidden=!searching;
  if(!searching)return;
  const chats=(searching?(searchResults||[]):view.chats.filter(c=>c.mode===view.mode&&c.projectId===view.activeProjectId)).slice().sort((a,b)=>workspaceSort==='title'?a.title.localeCompare(b.title):Number(b.pinned)-Number(a.pinned)||b.updated-a.updated);
  for(const c of chats){const b=document.createElement('button');b.className='chat-link'+(c.id===view.currentId?' active':'');const title=document.createElement('span');title.textContent=c.title;b.append(title);if(searching){const small=document.createElement('small');small.textContent=(c.mode==='code'?'Aurora Code':'Normal')+' · '+(view.projects.find(p=>p.id===c.projectId)?.name||'No project')+(c.snippet?' — '+c.snippet:'');b.append(small);}b.title=c.title;b.disabled=busy;b.onclick=action(async()=>{clearSearch();render(await call(window.aurora.selectChat(c.id)));renderHistory();});$('chats').append(sessionRow(c,b));}
  if(!chats.length){const empty=document.createElement('p');empty.className='library-empty';empty.textContent=searching?'No matching sessions.':'Start a new conversation.';$('chats').append(empty);}
}
function clearSearch(){searchGeneration++;clearTimeout(searchTimer);searchResults=null;$('session-search').value='';}
$('session-search').oninput=()=>{const generation=++searchGeneration;clearTimeout(searchTimer);const query=$('session-search').value;searchTimer=setTimeout(action(async()=>{const results=query.trim()?await call(window.aurora.searchSessions(query)):null;if(generation!==searchGeneration)return;searchResults=results;renderLibrary();}),180);};
$('workspace-sort-toggle').onclick=()=>{$('workspace-view-options').hidden=!$('workspace-view-options').hidden;};$('workspace-sort').onchange=()=>{workspaceSort=$('workspace-sort').value;renderLibrary();};
$('work-mode').onchange=action(async()=>{const mode=$('work-mode').value;if(mode!==view.mode){clearSearch();render(await call(window.aurora.sessionContext({mode,projectId:view.activeProjectId})));renderHistory();}});$('composer-attach').onclick=()=>{$('workspace').focus();toast(view.workspace?'Workspace context is active for this session.':'Choose a workspace folder first.');};
$('project-add').onclick=()=>{$('project-name').value='';$('project-dialog').showModal();$('project-name').focus();};$('project-close').onclick=()=>$('project-dialog').close();
$('project-form').onsubmit=event=>{event.preventDefault();action(async()=>{const data=await call(window.aurora.createProject($('project-name').value));$('project-dialog').close();clearSearch();render(data);renderHistory();})()};
$('session-project').onchange=action(async()=>{render(await call(window.aurora.sessionProject($('session-project').value||null)));renderHistory();});
$('session-delete').onclick=()=>requestSessionDelete(view.currentId);$('delete-session-cancel').onclick=()=>$('delete-session-dialog').close();
$('delete-session-confirm').onclick=action(async()=>{const data=await call(window.aurora.deleteSession(deletingId));$('delete-session-dialog').close();clearSearch();render(data);renderHistory();toast('Session deleted.');});
$('delete-project-cancel').onclick=()=>$('delete-project-dialog').close();$('delete-project-confirm').onclick=action(async()=>{const data=await call(window.aurora.deleteProject(deletingProjectId));$('delete-project-dialog').close();deletingProjectId=null;clearSearch();render(data);renderHistory();toast('Workspace removed. Its sessions are in Default workspace.');});
document.addEventListener('click',event=>{if(!event.target.closest('.sidebar-context-menu'))document.querySelector('.sidebar-context-menu')?.remove();});document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('.sidebar-context-menu')?.remove();});
$('rename-session-cancel').onclick=()=>$('rename-session-dialog').close();$('rename-session-form').onsubmit=event=>{event.preventDefault();action(async()=>{const data=await call(window.aurora.renameSession(editingSessionId,$('rename-session-input').value));$('rename-session-dialog').close();render(data);renderHistory();toast('Session renamed.');})();};
$('automation-nav').onclick=()=>$('automation-dialog').showModal();$('automation-close').onclick=()=>$('automation-dialog').close();$('automation-plan').onclick=()=>{$('automation-dialog').close();$('prompt').value='Help me plan an automation for this workspace.';$('prompt').focus();};
$('plugins-nav').onclick=()=>document.getElementById('extensions-open')?.click();$('workspace-search-toggle').onclick=()=>{$('session-search').focus();$('session-search').select();};
function renderMessages(messages,changedChat=false) { const follow=changedChat||pinned(),top=$('messages').scrollTop;$('messages').replaceChildren(); for (const m of messages) { if (['user', 'assistant'].includes(m.role) && m.content) addMessage(m.role, m.content,false); if(m.role==='tool'&&m.tool_name==='ask_user_question'){try{const result=JSON.parse(m.content);if(result.question&&result.answer){addMessage('assistant',result.question,false);addMessage('user',result.answer,false);}}catch{}} } $('welcome').hidden = messages.some(m => m.role === 'user'); if(follow)scroll();else $('messages').scrollTop=top; }
function renderHistory() { $('activity').replaceChildren(); const messages = view.messages; for (let i = 0; i < messages.length; i++) { const m = messages[i]; if (m.role === 'tool') activity(m.tool_name, {}, m.content); } if (!$('activity').children.length) { const empty = document.createElement('div'); empty.className = 'activity-empty'; empty.textContent = 'Our next adventure starts with your first message.'; $('activity').append(empty); } }
async function submit() {
  const text = $('prompt').value.trim(); if (!text || busy) return;
  if (!view.hasKey || !view.model) { openSettings(); toast('Choose a model connection to start chatting with Aurora.'); return; }
  $('prompt').value = ''; $('welcome').hidden = true; addMessage('user', text); setBusy(true);
  try { await call(window.aurora.send(text)); } catch (error) { toast(error.message); setBusy(false); }
}
$('composer').addEventListener('submit', event => { event.preventDefault(); submit(); });
$('prompt').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } });
document.querySelectorAll('[data-prompt]').forEach(button => button.onclick = () => { $('prompt').value = button.dataset.prompt; $('prompt').focus(); });
$('stop').onclick = action(() => call(window.aurora.stop()));
$('new-chat').onclick = action(async () => { clearSearch();render(await call(window.aurora.newChat())); renderHistory(); });
$('workspace').onclick = action(async () => render(await call(window.aurora.workspace())));
$('detach').onclick = action(() => call(window.aurora.pet(detached ? 'dock' : 'detach')));
$('roam').onclick = action(() => call(window.aurora.pet('roam')));
function renderSearchFolders() {
  $('search-folders').replaceChildren();
  for (const root of view.searchRoots || []) {
    const row = document.createElement('div'); row.className = 'search-folder';
    const label = document.createElement('span'); label.textContent = root; label.title = root; row.append(label);
    if (view.searchFolders?.includes(root)) { const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.className = 'text-button'; remove.onclick = action(async () => { render(await call(window.aurora.searchFolder(root))); renderSearchFolders(); }); row.append(remove); }
    $('search-folders').append(row);
  }
}
$('search-folder-add').onclick = action(async () => { render(await call(window.aurora.searchFolder())); renderSearchFolders(); });
function selectProvider() {
  const id = $('llm-provider').value, selected = view.connections[id], local = id === 'ollama-local';
  $('api-key').value = ''; $('model').value = selected.model || ''; $('models').replaceChildren();
  $('api-key').hidden = $('api-key-label').hidden = $('forget-key').hidden = local;
  $('local-url').hidden = $('local-url-label').hidden = !local; $('local-url').value = selected.baseUrl || 'http://127.0.0.1:11434';
  $('key-help').textContent = local ? 'Start Ollama on this PC and install a model with tool support. No API key is required.' : selected.hasKey ? 'A key is saved for this provider. Leave blank to keep it, or paste a replacement.' : `Paste an API key from your ${selected.name} account. API billing is separate from chat subscriptions.`;
  $('settings-status').textContent = '';
}
function connectionValues() { return {provider:$('llm-provider').value,key:$('api-key').value,model:$('model').value,baseUrl:$('local-url').value}; }
function openSettings() { $('llm-provider').value=view.provider;selectProvider();$('computer-enabled').checked=view.computerEnabled!==false;renderSearchFolders();$('settings-dialog').showModal(); }
$('preferences-open').onclick=()=>{
  $('preferences-model').textContent=view.connections[view.provider].name+(view.model?` · ${view.model}`:' · Not connected');
  $('preferences-appearance').textContent=view.appearances.find(item=>item.id===view.appearance)?.name||'Classic';
  $('preferences-dialog').showModal();
};
$('preferences-close').onclick=()=>$('preferences-dialog').close();
$('preferences-dialog').addEventListener('click',event=>{if(event.target.closest('[data-settings-section]'))$('preferences-dialog').close();},true);
document.addEventListener('click',event=>{if(!event.target.closest('#session-menu'))$('session-menu').open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape')$('session-menu').open=false;});
$('llm-provider').onchange = selectProvider;
$('settings-open').onclick = openSettings; $('settings-close').onclick = () => $('settings-dialog').close();
$('fetch-models').onclick = async () => { const values=connectionValues();$('fetch-models').disabled = true; $('settings-status').textContent = 'Checking your connection…'; try { const models = await call(window.aurora.models(values));if($('llm-provider').value!==values.provider)return; $('models').replaceChildren(); for (const model of models) { const option = document.createElement('option'); option.value = model; $('models').append(option); } $('settings-status').textContent = `Connected. ${models.length} models available. Choose a tool-capable model.`; } catch (error) { $('settings-status').textContent = error.message; } finally { $('fetch-models').disabled = false; } };
$('settings-form').onsubmit = async event => { event.preventDefault(); try { render(await call(window.aurora.saveSettings({ ...connectionValues(),computerEnabled:$('computer-enabled').checked }))); $('api-key').value = ''; $('settings-dialog').close(); toast('Connection saved. Aurora is ready.'); } catch (error) { $('settings-status').textContent = error.message; } };
$('forget-key').onclick = action(async () => { render(await call(window.aurora.saveSettings({ ...connectionValues(),key:'',forgetKey:true }))); $('api-key').value = ''; $('key-help').textContent = 'Saved key removed.'; });
function renderAppearances() {
  $('appearance-cards').replaceChildren();
  for (const appearance of view.appearances) {
    const button = document.createElement('button');button.className='appearance-card';button.setAttribute('aria-pressed',String(view.appearance===appearance.id));
    const image = document.createElement(appearance.atlas?'canvas':'img');image.className='skin-preview';image.dataset.appearance=appearance.id;
    if(appearance.atlas){image.width=150;image.height=160;image.setAttribute('aria-hidden','true');const atlas=new Image();atlas.onload=()=>{const prepared=AuroraSpriteFrames.prepareFrame(atlas,window.AuroraAppearances.frameRect(appearance,0,atlas.naturalWidth,atlas.naturalHeight)),[x,y,w,h]=prepared.bounds;const ctx=image.getContext('2d');ctx.imageSmoothingEnabled=false;const scale=Math.min(image.width/w,image.height/h);ctx.drawImage(prepared.canvas,x,y,w,h,(image.width-w*scale)/2,image.height-h*scale,w*scale,h*scale);};atlas.src=appearance.atlas;}else{image.src='assets/aurora/reference.png';image.alt='';}
    const name=document.createElement('strong');name.textContent=appearance.name;const description=document.createElement('small');description.textContent=appearance.description;
    button.append(image,name);if(appearance.creator){const credit=document.createElement('small');credit.className='appearance-credit';credit.textContent=`Created by ${appearance.creator}`;button.append(credit);}button.append(description);button.onclick=action(async()=>{render(await call(window.aurora.appearance(appearance.id)));renderAppearances();$('appearance-status').textContent=`${appearance.name} selected.`;});$('appearance-cards').append(button);
  }
}
$('appearance-open').onclick=()=>{renderAppearances();$('appearance-status').textContent='';$('appearance-dialog').showModal();};$('appearance-close').onclick=()=>$('appearance-dialog').close();
let updateState;
function renderUpdates(value) {
  if (!value) return; updateState=value;
  const descriptions={idle:`You’re using Aurora ${value.currentVersion}.`,checking:'Checking for a little something new…',current:`Aurora ${value.currentVersion} is up to date.`,available:`Aurora ${value.version} is ready to download.`,downloading:`Downloading Aurora ${value.version} · ${Math.round(value.percent)}%`,ready:`Aurora ${value.version} is ready. Restart to finish updating.`,error:value.error,development:'This copy uses manual updates. Install Aurora with the Windows installer to receive updates here.'};
  $('update-description').textContent=descriptions[value.status]||'';
  $('preferences-update').textContent=['available','downloading','ready'].includes(value.status)?descriptions[value.status]:`Aurora ${value.currentVersion} · Updates & version`;
  $('update-progress').hidden=value.status!=='downloading';$('update-progress').value=value.percent;
  $('update-primary').textContent=value.status==='ready'?'Restart and update':value.status==='available'?'Download update':'Check for updates';
  $('update-primary').disabled=['development','checking','downloading'].includes(value.status);
  const button=$('update-download');button.hidden=!['available','downloading','ready'].includes(value.status);button.textContent=value.status==='ready'?'✓':value.status==='downloading'?`${Math.round(value.percent)}%`:'↓';button.title=value.status==='ready'?'Restart to update':`Aurora ${value.version} update`;button.setAttribute('aria-label',button.title);
}
$('updates-open').onclick=$('update-download').onclick=()=>$('updates-dialog').showModal();$('updates-close').onclick=()=>$('updates-dialog').close();
$('update-primary').onclick=action(async()=>{renderUpdates(await call(window.aurora.updateAction(updateState.status==='ready'?'install':updateState.status==='available'?'download':'check')));});
async function approve(allow) { if (!approvalId) return; try { await call(window.aurora.approval(approvalId, allow)); } catch (error) { toast(error.message); } }
$('allow').onclick = () => approve(true); $('deny').onclick = () => approve(false); $('approval-dialog').addEventListener('cancel', event => { event.preventDefault(); approve(false); });
window.aurora.onEvent(event => {
  switch (event.type) {
    case 'update': renderUpdates(event.updates); break;
    case 'appearance': $('pet-host').dataset.appearance=event.appearance; break;
    case 'files-found': {
      $('file-results').replaceChildren();
      $('file-results-note').textContent = `${event.matches.length} match${event.matches.length === 1 ? '' : 'es'}${event.truncated ? ' · Search limit reached; narrow your filename keywords.' : ''}. Select a file to show it in Explorer. File contents are not opened.`;
      for (const file of event.matches) {
        const row = document.createElement('div'); row.className = 'file-result';
        const name = document.createElement('strong'); name.textContent = file.name;
        const location = document.createElement('small'); location.textContent = file.path;
        const button = document.createElement('button'); button.className = 'secondary'; button.textContent = 'Show in Explorer';
        button.onclick = action(async () => { $('file-results-dialog').close(); const result = await call(window.aurora.revealFile(file.id)); toast(result.highlighted ? 'Aurora found it — look for the glowing border.' : result.message || 'Selected in Explorer.'); });
        row.append(name,location,button); $('file-results').append(row);
      }
      $('file-results-open').hidden = !event.matches.length;
      break;
    }
    case 'snapshot': render(event.data); break;
    case 'state': $('pet-host').dataset.state = event.state; $('pet-host').dataset.phase=event.phase||''; $('pet-caption').textContent = captions[event.state] || captions.idle; $('status-text').textContent = event.detail || 'Ready when you are'; break;
    case 'pet': petDisplay(event.detached); break;
    case 'voice-expression': $('pet-host').dataset.state=event.pose;break;
    case 'reply-start': flushReply();replyText='';replyElement = addMessage('assistant', '',pinned()); break;
    case 'token': if (replyElement) { replyText += event.text; if(!replyTimer)replyTimer=setTimeout(flushReply,40); } break;
    case 'reply-end': flushReply();if (replyElement && !replyText) replyElement.parentElement.remove(); replyElement = null; break;
    case 'tool-start': activity(event.name, event.args, null, event.id); break;
    case 'tool-end': { const item = [...$('activity').children].find(e => e.dataset.id === event.id); if (item) { finishActivity(item,event.result); item.querySelector('pre').textContent += `\n\n${event.result}`; } break; }
    case 'approval': {
      approvalId=event.id;const external=event.name==='mcp',write=event.name==='write_file';
      $('approval-title').textContent=external?'May I use this external tool?':write?'May I write this file?':'May I run this command?';
      $('approval-description').textContent=external?`${event.args.server} · ${event.args.tool}\n${event.args.endpoint}\nReview the arguments before sending them to this server.`:write?`Create or replace ${event.args.path} in your selected workspace.`:'PowerShell runs with your Windows user permissions. It can access files and services outside the workspace. Review the command before approving.';
      $('approval-content').textContent=external?JSON.stringify(event.args.arguments,null,2):write?event.args.content:event.args.command;
      document.querySelectorAll('dialog.settings-workspace[open]').forEach(dialog=>dialog.close());$('approval-dialog').showModal();break;
    }
    case 'approval-closed': if (approvalId === event.id) { approvalId = null; $('approval-dialog').close(); } break;
    case 'error': toast(event.message); break;
  }
});
$('file-results-close').onclick = () => $('file-results-dialog').close();
$('file-results-open').onclick = () => $('file-results-dialog').showModal();
action(async () => { render(await call(window.aurora.load())); renderHistory(); if (!view.hasKey) $('status-text').textContent = 'Choose a model in Settings to get started'; })();
