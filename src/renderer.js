const $ = id => document.getElementById(id);
let view, busy = false, detached = false, replyElement, replyText = '', replyTimer, approvalId, toastTimer;
let searchTimer,searchGeneration=0,searchResults=null,deletingId,editingSessionId,deletingProjectId;
let workspaceSort='updated',lastLibraryContext;
let pendingAttachments=[];
const toolCards=new Map();
let comboBuilding=false, customSelection=[];
const expandedProjects=new Set();
try{const saved=JSON.parse(localStorage.getItem('aurora-project-groups')||'[]');if(Array.isArray(saved))saved.filter(id=>typeof id==='string').forEach(id=>expandedProjects.add(id));}catch{}
const captions = { idle: 'Here to help. Happy to be here.', thinking: 'Connecting the little dots…', browsing: 'A little curiosity goes a long way.', coding: 'Making something good, together.', waiting: 'I’ll wait for your say-so.', celebrating: 'We made it happen! ✦', error: 'A little hiccup. Let’s try again.' };
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 7000); }
async function call(promise) { const result = await promise; if (!result.ok) throw new Error(result.error); return result.value; }
function action(fn) { return async (...args) => { try { await fn(...args); } catch (error) { toast(error.message); } }; }
function scroll() { $('messages').scrollTop = $('messages').scrollHeight; }
function pinned() { const area=$('messages');return area.scrollHeight-area.scrollTop-area.clientHeight<100; }
function updateScrollButton() { const area=$('messages'),button=$('scroll-latest'); if(!area||!button)return; button.hidden=area.scrollHeight-area.scrollTop-area.clientHeight<160; }
function renderAttachments() {
  const box=$('composer-attachments'); if(!box)return; box.replaceChildren();
  if(!pendingAttachments.length){box.hidden=true;return;}
  box.hidden=false;
  pendingAttachments.forEach((file,index)=>{
    const chip=document.createElement('span');chip.className='attachment-chip';
    const label=document.createElement('span');label.className='attachment-name';label.textContent=file.name;label.title=file.path||file.name;
    const remove=document.createElement('button');remove.type='button';remove.className='attachment-remove';remove.setAttribute('aria-label',`Remove ${file.name}`);remove.textContent='×';
    remove.onclick=()=>{pendingAttachments.splice(index,1);renderAttachments();};
    chip.append(label,remove);box.append(chip);
  });
}
function clearAttachments(){pendingAttachments=[];renderAttachments();}
function toolCardLabel(name, args) {
  const external=view?.mcpServers?.find(server=>server.tools?.some(tool=>tool.runtimeName===name));
  if(external)return `${external.name} · ${external.tools.find(tool=>tool.runtimeName===name).name}`;
  if(name==='computer')return {observe:'Looking at an app',focus:'Switching to an app',move:'Moving the pointer',click:'Clicking a control',type:'Typing',keys:'Using the keyboard',scroll:'Scrolling',wait:'Waiting for an app',navigate:'Opening a page'}[args?.action]||'Using your computer';
  return toolLabels[name]||String(name||'tool').replaceAll('_',' ');
}
function toolCard(name, args, result, id) {
  const item=document.createElement('details');item.className='tool-card';item.dataset.status=result==null?'running':'done';if(id)item.dataset.id=id;
  const summary=document.createElement('summary');
  const icon=document.createElement('span');icon.className='tool-card-icon';icon.textContent=result==null?'◌':'✓';icon.setAttribute('aria-hidden','true');
  const label=document.createElement('span');label.className='tool-card-label';label.textContent=toolCardLabel(name,args);label.title=name||'';
  const status=document.createElement('span');status.className='tool-card-status';status.textContent=result==null?'Working':'Done';
  summary.append(icon,label,status);
  const body=document.createElement('pre');body.className='tool-card-body';
  let text='';try{text=args!=null?JSON.stringify(args,null,2):'';}catch{text=String(args);}
  if(result!=null)text+=(text?'\n\n':'')+result;
  body.textContent=text;
  item.append(summary,body);return item;
}
function timeAgo(at) {
  if(!at)return '';
  const seconds=Math.max(0,Math.round((Date.now()-at)/1000));
  if(seconds<45)return 'just now';
  const minutes=Math.round(seconds/60);if(minutes<60)return minutes+'m ago';
  const hours=Math.round(minutes/60);if(hours<24)return hours+'h ago';
  const days=Math.round(hours/24);if(days<7)return days+'d ago';
  return new Date(at).toLocaleDateString();
}
function reasoningText(message) {
  if(typeof message.thinking==='string'&&message.thinking.trim())return message.thinking.trim();
  if(Array.isArray(message.reasoning_details))return message.reasoning_details.map(part=>part?.text||part?.summary||'').filter(Boolean).join('\n').trim();
  return '';
}
function addMessage(role, content, autoScroll = true, options = {}) {
  const element = document.createElement('div'); element.className = `message ${role}`;
  if(Number.isInteger(options.index))element.dataset.index=options.index;
  const author = document.createElement('div'); author.className = 'message-author'; author.textContent = role === 'user' ? 'You' : 'Aurora ✦';
  element.append(author);
  const thinking = role === 'assistant' ? reasoningText(options) : '';
  if(thinking){const block=document.createElement('details');block.className='thinking-block';const summary=document.createElement('summary');summary.textContent='Thought for a moment';const pre=document.createElement('pre');pre.className='thinking-body';pre.textContent=thinking;block.append(summary,pre);element.append(block);}
  const body = document.createElement('div'); body.className = 'message-body';
  if(role==='assistant')AuroraMarkdown.render(body,content);else body.textContent=content;
  element.append(body);
  if(role==='user'&&Array.isArray(options.attachments)&&options.attachments.length){const chips=document.createElement('div');chips.className='message-attachments';for(const file of options.attachments){const chip=document.createElement('span');chip.className='message-attachment';chip.textContent=(typeof file.name==='string'?file.name:'file');chip.title=file.path||file.name||'';chips.append(chip);}element.append(chips);}
  if(options.at)element.append(Object.assign(document.createElement('time'),{className:'message-time',textContent:timeAgo(options.at)}));
  if(Number.isInteger(options.index))element.append(messageActions(role, options));
  $('messages').append(element); if(autoScroll)scroll(); return body;
}
function messageActions(role, options) {
  const bar=document.createElement('div');bar.className='message-actions';
  const make=(name,label,icon,run)=>{const button=document.createElement('button');button.type='button';button.className='message-action';button.dataset.action=name;button.title=label;button.setAttribute('aria-label',label);button.innerHTML=icon;button.onclick=run;return button;};
  bar.append(make('copy','Copy message','<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="9" rx="1.6"/><path d="M10.5 5.5V3.6A1.6 1.6 0 0 0 8.9 2H4.1A1.6 1.6 0 0 0 2.5 3.6v6.4a1.6 1.6 0 0 0 1.6 1.6h1.4"/></svg>',()=>action(async()=>{await call(window.aurora.copyText(options.content||''));toast('Message copied.');})()));
  if(role==='user')bar.append(make('edit','Edit and resend','<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.6 13.4 4.5 5.6 12.3 3 13 3.7 10.4z"/></svg>',()=>beginEdit(options)));
  if(role==='assistant'&&options.canRegenerate)bar.append(make('regenerate','Regenerate reply','<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8a5 5 0 1 1-1.47-3.54"/><path d="M13 2.6V5.2h-2.6"/></svg>',()=>action(async()=>{if(busy)return;setBusy(true);try{await call(window.aurora.retry());}catch(error){setBusy(false);throw error;}})()));
  bar.append(make('delete','Delete message','<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h10"/><path d="M6.5 4.5V3.2A1.2 1.2 0 0 1 7.7 2h.6a1.2 1.2 0 0 1 1.2 1.2V4.5"/><path d="M4.3 4.5 5 13a1.3 1.3 0 0 0 1.3 1.2h3.4A1.3 1.3 0 0 0 11 13l.7-8.5"/></svg>',()=>action(async()=>{if(busy)return;render(await call(window.aurora.deleteMessage(options.index)));renderHistory();toast('Message deleted.');})()));
  return bar;
}
function beginEdit(options) {
  if(busy)return;
  const element=$('messages').querySelector(`.message[data-index="${options.index}"]`);if(!element)return;
  const body=element.querySelector('.message-body'),actions=element.querySelector('.message-actions');
  const editor=document.createElement('div');editor.className='message-editor';
  const area=document.createElement('textarea');area.className='message-edit-input';area.value=options.content||'';area.rows=3;
  const footer=document.createElement('div');footer.className='message-edit-footer';
  const hint=document.createElement('span');hint.className='message-edit-hint';hint.textContent='Editing replaces this message and every reply after it.';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent='Cancel';
  const save=document.createElement('button');save.type='button';save.className='primary';save.textContent='Save & resend';
  footer.append(hint,cancel,save);editor.append(area,footer);body.replaceWith(editor);actions?.remove();
  area.focus();area.setSelectionRange(area.value.length,area.value.length);
  area.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();save.click();}if(event.key==='Escape')cancel.click();});
  cancel.onclick=()=>{if(!busy)renderMessages(view.messages);};
  save.onclick=action(async()=>{const text=area.value.trim();if(!text){toast('Write a message to send.');return;}setBusy(true);try{await call(window.aurora.editMessage(options.index,text));}catch(error){setBusy(false);throw error;}});
}
function flushReply() {
  clearTimeout(replyTimer);replyTimer=null;
  if(!replyElement?.isConnected)return;
  const follow=pinned();AuroraMarkdown.render(replyElement,replyText);if(follow)scroll();updateScrollButton();
}
window.addEventListener('aurora-notice',event=>toast(event.detail));
const toolLabels={ask_user_question:'Waiting for your answer',voice_reply:'Preparing a spoken reply',find_files:'Searching your files',reveal_file:'Showing a file',list_files:'Exploring a folder',read_file:'Reading a file',write_file:'Writing a file',run_powershell:'Running a command',web_search:'Searching the web',computer:'Using your computer',open_application:'Opening an app',control_media:'Controlling playback'};
function finishActivity(item,result) {
  let failed=false;try{failed=!!JSON.parse(result)?.error;}catch{}
  item.dataset.status=failed?'error':'done';
  item.querySelector('.tool-icon').textContent=failed?'!':'✓';
  item.querySelector('.tool-status').textContent=failed?'Needs attention':'Done';
}
function activity(name, args, result, id, live = false) {
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
  if(live){const card=toolCard(name,args,result,id);$('messages').append(card);if(id)toolCards.set(id,card);if(pinned())scroll();updateScrollButton();}
}
function setBusy(value) { busy = value; $('stop').hidden = !value; $('send').disabled = value; $('new-chat').disabled = value; $('workspace').disabled = value;for(const id of ['project-add','session-project','session-delete','composer-model','composer-attach','reasoning-effort','composer-agent','composer-combo'])$(id).disabled=value; }
function petDisplay(value) { detached = value; $('pet-host').hidden = value; const roam=$('pet-roam'); if(roam)roam.hidden=!value; const toggle=$('pet-desktop'); if(toggle){toggle.setAttribute('aria-pressed',String(value));toggle.textContent=value?'↙ Bring Aurora home':'↗ Send Aurora to your desktop';} }
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
  const more=document.createElement('button');more.type='button';more.className='session-row-more';more.disabled=busy;more.setAttribute('aria-haspopup','menu');more.textContent='⋯';more.title='Session options';more.setAttribute('aria-label',`Options for ${chat.title}`);more.onclick=e=>showSidebarMenu(e,sessionMenuItems(chat));row.oncontextmenu=e=>showSidebarMenu(e,sessionMenuItems(chat));
  const agent=(view.agents||[]).find(item=>item.id===chat.agent)||(view.agents||[])[0];
  if(agent){const avatar=document.createElement('img');avatar.className='session-agent';avatar.src=agent.avatar;avatar.alt='';avatar.title=`${agent.name} · ${agent.role}`;avatar.loading='lazy';row.append(avatar);}
  row.append(button,more);return row;
}
function render(data) {
  const changedChat=view?.currentId!==data.currentId;
  if (changedChat) { $('file-results-open').hidden = true; $('file-results-dialog').close(); $('file-results').replaceChildren(); clearAttachments(); }
  view = data; setBusy(data.busy); petDisplay(data.detached);
  document.body.dataset.theme = data.theme || 'heartflow';
  $('pet-host').dataset.appearance = data.appearance || 'classic';
  $('app-version').textContent = data.version;
  renderUpdates(data.updates);
  window.renderAuroraVoice?.(data.voice);
  $('pet-host').dataset.state = data.state || 'idle'; $('pet-caption').textContent = captions[data.state] || captions.idle;
  $('composer-model-label').textContent = data.model || `${data.connections[data.provider].name} · not connected`;
  $('reasoning-effort').value=data.reasoningEffort||'';
  $('workspace-label').textContent = data.workspace ? data.workspace.split(/[\\/]/).filter(Boolean).pop() || data.workspace : 'Choose folder'; $('workspace').title = data.workspace || 'Choose workspace folder';
  renderLibrary();
  renderAgent();
  renderCombo();
  if (!data.busy) renderMessages(data.messages,changedChat);
  window.dispatchEvent(new Event('aurora-view-rendered'));
}
function renderLibrary(){
  const context=view.mode+':'+(view.activeProjectId||'ungrouped');if(lastLibraryContext!==context){expandedProjects.add(view.activeProjectId||'ungrouped');lastLibraryContext=context;}
  const code=view.mode==='code',p=view.projects.find(p=>p.id===view.activeProjectId),chat=view.chats.find(c=>c.id===view.currentId);
  document.body.dataset.mode=view.mode;
  for(const id of ['project-add','session-project','session-delete','composer-model','composer-attach','reasoning-effort','composer-agent','composer-combo'])$(id).disabled=busy;
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
$('composer-attach').onclick=()=>{const menu=$('composer-add-menu');const open=menu.hidden;menu.hidden=!open;$('composer-attach').setAttribute('aria-expanded',String(open));if(open)menu.querySelector('button')?.focus();};
$('add-files').onclick=action(async()=>{closeAddMenu();const result=await call(window.aurora.attachFiles());if(result.skipped?.length)toast('Skipped '+result.skipped.join(', '));if(result.attachments?.length){pendingAttachments.push(...result.attachments);renderAttachments();}});
$('add-reference').onclick=()=>{closeAddMenu();const area=$('prompt');if(area.value&&!/\s$/.test(area.value))area.value+=' ';area.value+='@';const pos=area.value.length;area.focus();area.setSelectionRange(pos,pos);updateMentionMenu();};
$('add-workspace').onclick=action(async()=>{closeAddMenu();render(await call(window.aurora.workspace()));});
function closeAddMenu(){$('composer-add-menu').hidden=true;$('composer-attach').setAttribute('aria-expanded','false');}
document.addEventListener('click',event=>{if(!event.target.closest('#composer-add-menu')&&!event.target.closest('#composer-attach'))closeAddMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeAddMenu();});
$('project-add').onclick=()=>{$('project-name').value='';$('project-dialog').showModal();$('project-name').focus();};$('project-close').onclick=()=>$('project-dialog').close();
$('project-form').onsubmit=event=>{event.preventDefault();action(async()=>{const data=await call(window.aurora.createProject($('project-name').value));$('project-dialog').close();clearSearch();render(data);renderHistory();})()};
$('session-project').onchange=action(async()=>{render(await call(window.aurora.sessionProject($('session-project').value||null)));renderHistory();});
$('session-delete').onclick=()=>requestSessionDelete(view.currentId);$('delete-session-cancel').onclick=()=>$('delete-session-dialog').close();
$('delete-session-confirm').onclick=action(async()=>{const data=await call(window.aurora.deleteSession(deletingId));$('delete-session-dialog').close();clearSearch();render(data);renderHistory();toast('Session deleted.');});
$('delete-project-cancel').onclick=()=>$('delete-project-dialog').close();$('delete-project-confirm').onclick=action(async()=>{const data=await call(window.aurora.deleteProject(deletingProjectId));$('delete-project-dialog').close();deletingProjectId=null;clearSearch();render(data);renderHistory();toast('Workspace removed. Its sessions are in Default workspace.');});
document.addEventListener('click',event=>{if(!event.target.closest('.sidebar-context-menu'))document.querySelector('.sidebar-context-menu')?.remove();});document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('.sidebar-context-menu')?.remove();});
$('rename-session-cancel').onclick=()=>$('rename-session-dialog').close();$('rename-session-form').onsubmit=event=>{event.preventDefault();action(async()=>{const data=await call(window.aurora.renameSession(editingSessionId,$('rename-session-input').value));$('rename-session-dialog').close();render(data);renderHistory();toast('Session renamed.');})();};
$('plugins-nav').onclick=()=>document.getElementById('extensions-open')?.click();$('workspace-search-toggle').onclick=()=>{$('session-search').focus();$('session-search').select();};
function renderMessages(messages,changedChat=false) {
  const follow=changedChat||pinned(),top=$('messages').scrollTop;$('messages').replaceChildren();
  const lastAssistant=messages.findLastIndex(m=>m.role==='assistant'&&m.content);
  const callArgs=new Map();
  for(let index=0;index<messages.length;index++){
    const m=messages[index];
    if(m.role==='assistant'&&m.tool_calls)for(const call of m.tool_calls)callArgs.set(call.id||call.function?.name,call.function?.arguments);
    if(m.role==='tool'){
      if(m.tool_name==='ask_user_question'){try{const result=JSON.parse(m.content);if(result.question&&result.answer){addMessage('assistant',result.question,false);addMessage('user',result.answer,false);}}catch{}}
      else $('messages').append(toolCard(m.tool_name,callArgs.get(m.tool_call_id)||callArgs.get(m.tool_name),m.content));
      continue;
    }
    const shown=m.role==='user'&&m.display?m.display:m.content;
    if(['user','assistant'].includes(m.role)&&shown)addMessage(m.role,shown,false,{index,content:shown,attachments:m.attachments,thinking:m.thinking,reasoning_details:m.reasoning_details,at:m.at,canRegenerate:m.role==='assistant'&&index===lastAssistant});
  }
  $('welcome').hidden=messages.some(m=>m.role==='user');if(follow)scroll();else $('messages').scrollTop=top;updateScrollButton();
}
function renderHistory() { $('activity').replaceChildren(); const messages = view.messages; for (let i = 0; i < messages.length; i++) { const m = messages[i]; if (m.role === 'tool') activity(m.tool_name, {}, m.content); } if (!$('activity').children.length) { const empty = document.createElement('div'); empty.className = 'activity-empty'; empty.textContent = 'Our next adventure starts with your first message.'; $('activity').append(empty); } }
async function submit() {
  const text = $('prompt').value.trim(); if (!text || busy) return;
  if (!view.hasKey || !view.model) { openSettings(); toast('Choose a model connection to start chatting with Aurora.'); return; }
  closeMentionMenu();
  const files = [...pendingAttachments.map(file => ({name:file.name,path:file.path,content:file.content})), ...await resolveMentions(text)];
  $('prompt').value = ''; $('prompt').style.height=''; $('welcome').hidden = true;
  addMessage('user', text, true, {at:Date.now(), ...(files.length ? {attachments:files} : {})}); clearAttachments(); setBusy(true);
  try { await call(window.aurora.send(text, files)); } catch (error) { toast(error.message); setBusy(false); }
}
$('composer').addEventListener('submit', event => { event.preventDefault(); submit(); });
$('prompt').addEventListener('input', updateMentionMenu);
$('prompt').addEventListener('keydown', event => {
  if(!$('mention-menu').hidden && mentionMatches.length){
    if(event.key==='ArrowDown'){event.preventDefault();mentionIndex=(mentionIndex+1)%mentionMatches.length;renderMentionMenu();return;}
    if(event.key==='ArrowUp'){event.preventDefault();mentionIndex=(mentionIndex-1+mentionMatches.length)%mentionMatches.length;renderMentionMenu();return;}
    if(event.key==='Enter'||event.key==='Tab'){event.preventDefault();chooseMention(mentionIndex);return;}
    if(event.key==='Escape'){event.preventDefault();closeMentionMenu();return;}
  }
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
});
$('prompt').addEventListener('blur',()=>setTimeout(closeMentionMenu,120));
$('messages').addEventListener('scroll', updateScrollButton);
$('scroll-latest').onclick = () => { scroll(); updateScrollButton(); };

// Mentions, drag & drop / paste attachments, find bar and reasoning effort.
let mentionFiles=[], mentionMatches=[], mentionIndex=0, mentionStart=-1;
async function ensureMentionFiles(){if(mentionFiles.length)return;try{mentionFiles=await call(window.aurora.workspaceFiles());}catch{mentionFiles=[];}}
function currentMention(){const area=$('prompt'),value=area.value,caret=area.selectionStart;const match=/(^|\s)@([^\s@]*)$/.exec(value.slice(0,caret));if(!match)return null;return {query:match[2].toLowerCase(),start:caret-match[2].length-1};}
function renderMentionMenu(){const menu=$('mention-menu');menu.replaceChildren();mentionMatches.forEach((file,index)=>{const button=document.createElement('button');button.type='button';button.className='mention-item'+(index===mentionIndex?' active':'');button.setAttribute('role','option');const name=document.createElement('span');name.textContent=file.name;const path=document.createElement('small');path.textContent=file.path;button.append(name,path);button.onmousedown=event=>{event.preventDefault();chooseMention(index);};menu.append(button);});menu.hidden=false;menu.children[mentionIndex]?.scrollIntoView({block:'nearest'});}
async function updateMentionMenu(){const menu=$('mention-menu');const match=currentMention();if(!match){menu.hidden=true;mentionMatches=[];return;}await ensureMentionFiles();mentionMatches=mentionFiles.filter(file=>file.path.toLowerCase().includes(match.query)||file.name.toLowerCase().includes(match.query)).slice(0,8);if(!mentionMatches.length){menu.hidden=true;return;}mentionStart=match.start;mentionIndex=0;renderMentionMenu();}
function closeMentionMenu(){mentionMatches=[];$('mention-menu').hidden=true;}
function chooseMention(index){const file=mentionMatches[index];if(!file)return;const area=$('prompt'),value=area.value,caret=area.selectionStart;area.value=value.slice(0,mentionStart)+'@'+file.path+' '+value.slice(caret);const pos=mentionStart+file.path.length+2;area.focus();area.setSelectionRange(pos,pos);closeMentionMenu();}
async function resolveMentions(text){const tokens=[...text.matchAll(/@([^\s@]+)/g)].map(match=>match[1]);if(!tokens.length)return [];await ensureMentionFiles();const known=new Set(pendingAttachments.map(file=>file.path)),extra=[];for(const token of new Set(tokens)){const hit=mentionFiles.find(file=>file.path===token||file.path.toLowerCase()===token.toLowerCase());if(!hit||known.has(hit.path))continue;try{const preview=await call(window.aurora.workspacePreview(hit.path));extra.push({name:hit.name,path:hit.path,content:preview.content});known.add(hit.path);}catch{}}return extra;}
async function addDroppedFiles(files){let added=0;for(const file of files.slice(0,10)){if(file.size>200000){toast(`${file.name} is over 200 KB.`);continue;}let text;try{text=await file.text();}catch{toast(`Could not read ${file.name}.`);continue;}if(text.includes('\u0000')){toast(`${file.name} is not a text file.`);continue;}if(pendingAttachments.some(item=>item.name===file.name&&item.content===text))continue;pendingAttachments.push({name:file.name,path:file.path||'',content:text});added++;}if(added)renderAttachments();}
const composerForm=$('composer'),hasFiles=event=>[...(event.dataTransfer?.types||[])].includes('Files');
composerForm.addEventListener('dragover',event=>{if(hasFiles(event)){event.preventDefault();composerForm.classList.add('drag-over');}});
composerForm.addEventListener('dragleave',event=>{if(event.target===composerForm)composerForm.classList.remove('drag-over');});
composerForm.addEventListener('drop',event=>{if(!hasFiles(event))return;event.preventDefault();composerForm.classList.remove('drag-over');addDroppedFiles([...event.dataTransfer.files]);});
$('prompt').addEventListener('paste',event=>{const files=[...(event.clipboardData?.files||[])];if(files.length){event.preventDefault();addDroppedFiles(files);}});
$('reasoning-effort').onchange=action(async()=>{render(await call(window.aurora.reasoningEffort($('reasoning-effort').value)));});
function openFind(){$('find-bar').hidden=false;$('find-input').focus();$('find-input').select();}
function closeFind(){$('find-bar').hidden=true;$('find-count').textContent='';window.aurora.stopFind();}
function runFind(forward){const text=$('find-input').value;if(!text){window.aurora.stopFind();$('find-count').textContent='';return;}window.aurora.findInPage(text,forward,true);}
$('find-input').addEventListener('input',()=>runFind(true));
$('find-input').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();runFind(!event.shiftKey);}else if(event.key==='Escape'){event.preventDefault();closeFind();}});
$('find-next').onclick=()=>runFind(true);$('find-prev').onclick=()=>runFind(false);$('find-close').onclick=closeFind;
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'){event.preventDefault();openFind();}});
function conversationMarkdown(){const title=view.chats.find(chat=>chat.id===view.currentId)?.title||'Aurora conversation';const lines=[`# ${title}`,''];for(const m of view.messages){if(m.role==='user')lines.push('**You**','',(m.display||m.content||''),'');else if(m.role==='assistant'&&m.content)lines.push('**Aurora**','',m.content,'');else if(m.role==='tool'&&m.tool_name)lines.push(`> Tool · ${toolCardLabel(m.tool_name)}`,'');}return lines.join('\n').trimEnd()+'\n';}
$('session-copy').onclick=action(async()=>{$('session-menu').open=false;await call(window.aurora.copyText(conversationMarkdown()));toast('Conversation copied as Markdown.');});
$('session-export').onclick=action(async()=>{$('session-menu').open=false;const saved=await call(window.aurora.exportConversation(conversationMarkdown(),view.chats.find(chat=>chat.id===view.currentId)?.title||'Aurora conversation'));if(saved)toast('Exported to '+saved);});
function renderAgent(){
  const list=view.agents||[];if(!list.length)return;
  const agent=list.find(item=>item.id===view.agent)||list[0];
  $('composer-agent-avatar').src=agent.avatar;$('composer-agent-name').textContent=agent.name;
  const heading=document.querySelector('.pet-intro h3');if(heading)heading.innerHTML=`Hi, I’m ${agent.name} <span>✦</span>`;
  const portrait=$('agent-portrait'),pet=$('pet-host');
  portrait.hidden=!!agent.companion;
  if(!agent.companion)portrait.src=agent.avatar;
  pet.hidden=!agent.companion||detached;
  if(view.mode!=='code'){const paragraph=$('welcome')?.querySelector('p');if(paragraph)paragraph.textContent=`I’m ${agent.name}. ${agent.essence||''} Tell me what we’re working on.`;}
  buildAgentPicker();
}
function buildAgentPicker(){
  const picker=$('agent-picker');picker.replaceChildren();
  const heading=document.createElement('div');heading.className='agent-picker-heading';heading.textContent='Choose your waifu';picker.append(heading);
  for(const agent of view.agents||[]){
    const button=document.createElement('button');button.type='button';button.className='agent-card'+(agent.id===view.agent?' selected':'');button.setAttribute('role','option');button.setAttribute('aria-selected',String(agent.id===view.agent));
    const img=document.createElement('img');img.className='agent-card-avatar';img.src=agent.avatar;img.alt='';img.loading='lazy';
    const text=document.createElement('span');text.className='agent-card-text';const name=document.createElement('strong');name.textContent=agent.name;const tag=document.createElement('small');tag.textContent=agent.tagline;text.append(name,tag);button.title=`${agent.role} · ${agent.focus}`;
    button.append(img,text);
    button.onclick=action(async()=>{closeAgentPicker();render(await call(window.aurora.agent(agent.id)));renderHistory();toast(`${agent.name} is here.`);if(agent.id==='gigi')window.AuroraWorkspace?.enter?.();else window.AuroraWorkspace?.close?.();});
    picker.append(button);
  }
}
function closeAgentPicker(){$('agent-picker').hidden=true;$('composer-agent').setAttribute('aria-expanded','false');}
$('composer-agent').onclick=()=>{closeComboPicker();const picker=$('agent-picker');const open=picker.hidden;picker.hidden=!open;$('composer-agent').setAttribute('aria-expanded',String(open));};
document.addEventListener('click',event=>{if(!event.target.closest('#agent-picker')&&!event.target.closest('#composer-agent'))closeAgentPicker();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeAgentPicker();});
function renderCombo(){
  const combos=view.combos||[];const combo=combos.find(team=>team.id===view.combo)||combos[0];
  const locked=!!(combo&&combo.aura&&!view.auraMember);
  $('composer-combo-label').textContent=combo?(combo.id.startsWith('custom:')?`Team of ${combo.members.length}`:combo.label.replace(/^\S+ solo$/,'Solo')):'Solo';
  $('composer-combo').classList.toggle('locked',locked);
  $('composer-combo').title=locked?'HFAI Aura members only':'Choose your team';
  buildComboPicker();
}
function buildComboPicker(){
  const picker=$('combo-picker');picker.replaceChildren();
  if(comboBuilding){buildCustomTeam(picker);return;}
  const heading=document.createElement('div');heading.className='combo-picker-heading';heading.textContent='Choose your team';picker.append(heading);
  const byId=id=>(view.agents||[]).find(agent=>agent.id===id);
  for(const combo of view.combos||[]){
    const locked=combo.aura&&!view.auraMember;
    const button=document.createElement('button');button.type='button';button.className='combo-card'+(combo.id===view.combo?' selected':'')+(locked?' locked':'');button.disabled=locked;button.setAttribute('aria-selected',String(combo.id===view.combo));
    const members=document.createElement('span');members.className='combo-card-members';
    for(const id of combo.members){const agent=byId(id);if(!agent)continue;const img=document.createElement('img');img.className='combo-member';img.src=agent.avatar;img.alt='';img.title=agent.name;members.append(img);}
    const text=document.createElement('span');text.className='combo-card-text';const label=document.createElement('strong');label.textContent=combo.label;const tag=document.createElement('small');tag.textContent=locked?'Unlock with an HFAI Aura code':(combo.members.length>1?`Team of ${combo.members.length}`:'Going solo');text.append(label,tag);
    button.append(members,text);
    if(locked){const lock=document.createElement('span');lock.className='combo-card-lock';lock.textContent='🔒';lock.setAttribute('aria-hidden','true');button.append(lock);}
    else button.onclick=action(async()=>{closeComboPicker();render(await call(window.aurora.combo(combo.id)));renderHistory();});
    picker.append(button);
  }
  const divider=document.createElement('div');divider.className='combo-divider';picker.append(divider);
  const customLocked=!view.auraMember;
  const custom=document.createElement('button');custom.type='button';custom.className='combo-card'+((typeof view.combo==='string'&&view.combo.startsWith('custom:'))?' selected':'')+(customLocked?' locked':'');custom.disabled=customLocked;
  const icon=document.createElement('span');icon.className='combo-card-members combo-custom-icon';icon.textContent='＋';icon.setAttribute('aria-hidden','true');
  const text=document.createElement('span');text.className='combo-card-text';const label=document.createElement('strong');label.textContent='Build your own team';const tag=document.createElement('small');tag.textContent=customLocked?'Unlock with an HFAI Aura code':'Pick who works with your waifu';text.append(label,tag);
  custom.append(icon,text);
  if(customLocked){const lock=document.createElement('span');lock.className='combo-card-lock';lock.textContent='🔒';lock.setAttribute('aria-hidden','true');custom.append(lock);}
  else custom.onclick=()=>{customSelection=[...(view.custom||[])];comboBuilding=true;buildComboPicker();};
  picker.append(custom);
}
function buildCustomTeam(picker){
  const main=(view.agents||[]).find(agent=>agent.id===view.agent)||(view.agents||[])[0];
  const heading=document.createElement('div');heading.className='combo-picker-heading';heading.textContent='Build your team';picker.append(heading);
  const pinned=document.createElement('div');pinned.className='team-pinned';
  const mainImg=document.createElement('img');mainImg.className='combo-member';mainImg.src=main.avatar;mainImg.alt='';
  const mainText=document.createElement('span');mainText.className='combo-card-text';const mName=document.createElement('strong');mName.textContent=main.name;const mTag=document.createElement('small');mTag.textContent='Your main waifu';mainText.append(mName,mTag);
  pinned.append(mainImg,mainText);picker.append(pinned);
  for(const agent of view.agents||[]){
    if(agent.id===main.id)continue;
    const on=customSelection.includes(agent.id);
    const row=document.createElement('button');row.type='button';row.className='team-toggle'+(on?' on':'');row.setAttribute('aria-pressed',String(on));
    const img=document.createElement('img');img.className='combo-member';img.src=agent.avatar;img.alt='';
    const text=document.createElement('span');text.className='combo-card-text';const name=document.createElement('strong');name.textContent=agent.name;const tag=document.createElement('small');tag.textContent=agent.tagline;text.append(name,tag);
    const check=document.createElement('span');check.className='team-check';check.textContent=on?'✓':'';check.setAttribute('aria-hidden','true');
    row.append(img,text,check);
    row.onclick=()=>{if(customSelection.includes(agent.id))customSelection=customSelection.filter(id=>id!==agent.id);else if(customSelection.length<2)customSelection=[...customSelection,agent.id];buildComboPicker();};
    picker.append(row);
  }
  const footer=document.createElement('div');footer.className='team-footer';
  const back=document.createElement('button');back.type='button';back.className='secondary';back.textContent='Back';back.onclick=()=>{comboBuilding=false;buildComboPicker();};
  const apply=document.createElement('button');apply.type='button';apply.className='primary';apply.textContent=customSelection.length?`Use team of ${customSelection.length+1}`:'Go solo';
  apply.onclick=action(async()=>{closeComboPicker();render(await call(window.aurora.teamCustom(customSelection)));renderHistory();});
  footer.append(back,apply);picker.append(footer);
}
function closeComboPicker(){$('combo-picker').hidden=true;$('composer-combo').setAttribute('aria-expanded','false');}
$('composer-combo').onclick=()=>{closeAgentPicker();const picker=$('combo-picker');const open=picker.hidden;if(open)comboBuilding=false;picker.hidden=!open;$('composer-combo').setAttribute('aria-expanded',String(open));};
document.addEventListener('click',event=>{const path=event.composedPath?event.composedPath():[];if(!path.some(node=>node&&(node.id==='combo-picker'||node.id==='composer-combo')))closeComboPicker();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeComboPicker();});

document.querySelectorAll('[data-prompt]').forEach(button => button.onclick = () => { $('prompt').value = button.dataset.prompt; $('prompt').focus(); });
$('stop').onclick = action(() => call(window.aurora.stop()));
$('new-chat').onclick = action(async () => { clearSearch();render(await call(window.aurora.newChat())); renderHistory(); });
$('sidebar-collapse').addEventListener('click', event => { event.stopPropagation(); $('sidebar-toggle').click(); });
$('workspace').onclick = action(async () => render(await call(window.aurora.workspace())));
$('pet-roam').onclick = action(() => call(window.aurora.pet('roam')));
$('pet-desktop').onclick = action(() => call(window.aurora.pet(detached ? 'dock' : 'detach')));
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
function renderAura() { const active=view.auraMember===true;$('aura-status').textContent=active?`Active${view.auraKey?' · '+view.auraKey:''}. Teams and the custom team builder are unlocked.`:'Not active. Unlock multi-waifu teams and the custom team builder with an Aura code.';$('aura-unlock').hidden=active;$('aura-lock').hidden=!active;$('aura-code').hidden=active;$('aura-code').value=''; }
function openSettings() { $('llm-provider').value=view.provider;selectProvider();$('computer-enabled').checked=view.computerEnabled!==false;renderAura();renderSearchFolders();$('settings-dialog').showModal(); }
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
$('aura-unlock').onclick = action(async () => { render(await call(window.aurora.auraUnlock($('aura-code').value))); renderAura(); toast('HFAI Aura unlocked. Teams are ready.'); });
$('aura-lock').onclick = action(async () => { render(await call(window.aurora.auraLock())); renderAura(); toast('HFAI Aura locked.'); });
function renderAppearances() {
  $('appearance-cards').replaceChildren();
  for (const appearance of view.appearances) {
    const button = document.createElement('button');button.className='appearance-card';button.setAttribute('aria-pressed',String(view.appearance===appearance.id));
    const image = document.createElement(appearance.atlas?'canvas':'img');image.className='skin-preview';image.dataset.appearance=appearance.id;
    if(appearance.atlas){image.width=150;image.height=160;image.setAttribute('aria-hidden','true');const atlas=new Image();atlas.onload=()=>{const prepared=AuroraSpriteFrames.prepareFrame(atlas,window.AuroraAppearances.frameRect(appearance,0,atlas.naturalWidth,atlas.naturalHeight)),[x,y,w,h]=prepared.bounds;const ctx=image.getContext('2d');ctx.imageSmoothingEnabled=false;const scale=Math.min(image.width/w,image.height/h);ctx.drawImage(prepared.canvas,x,y,w,h,(image.width-w*scale)/2,image.height-h*scale,w*scale,h*scale);};atlas.src=appearance.atlas;}else{image.src='assets/aurora/reference.png';image.alt='';if(appearance.filter&&appearance.filter!=='none')image.style.filter=appearance.filter;}
    const name=document.createElement('strong');name.textContent=appearance.name;const description=document.createElement('small');description.textContent=appearance.description;
    button.append(image,name);if(appearance.creator){const credit=document.createElement('small');credit.className='appearance-credit';credit.textContent=`Created by ${appearance.creator}`;button.append(credit);}button.append(description);button.onclick=action(async()=>{render(await call(window.aurora.appearance(appearance.id)));renderAppearances();$('appearance-status').textContent=`${appearance.name} selected.`;});$('appearance-cards').append(button);
  }
}
$('appearance-open').onclick=()=>{renderAppearances();$('appearance-status').textContent='';$('appearance-dialog').showModal();};$('appearance-close').onclick=()=>$('appearance-dialog').close();
function renderThemes() {
  $('theme-cards').replaceChildren();
  for (const theme of view.themes || []) {
    const button=document.createElement('button');button.type='button';button.className='theme-card';button.setAttribute('aria-pressed',String(view.theme===theme.id));
    const swatches=document.createElement('div');swatches.className='theme-swatches';for(const color of theme.swatches||[]){const swatch=document.createElement('span');swatch.style.background=color;swatches.append(swatch);}
    const name=document.createElement('strong');name.textContent=theme.name;const description=document.createElement('small');description.textContent=theme.description;
    button.append(swatches,name,description);
    button.onclick=action(async()=>{render(await call(window.aurora.theme(theme.id)));renderThemes();$('theme-status').textContent=`${theme.name} theme applied.`;});
    $('theme-cards').append(button);
  }
}
$('theme-open').onclick=()=>{renderThemes();$('theme-status').textContent='';$('theme-dialog').showModal();};$('theme-close').onclick=()=>$('theme-dialog').close();
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
    case 'tool-start': activity(event.name, event.args, null, event.id, true); break;
    case 'tool-end': {
      const item = [...$('activity').children].find(e => e.dataset.id === event.id); if (item) { finishActivity(item,event.result); item.querySelector('pre').textContent += `\n\n${event.result}`; }
      const card = toolCards.get(event.id);
      if (card) { let failed=false; try{failed=!!JSON.parse(event.result)?.error;}catch{} card.dataset.status=failed?'error':'done'; card.querySelector('.tool-card-icon').textContent=failed?'!':'✓'; card.querySelector('.tool-card-status').textContent=failed?'Needs attention':'Done'; const body=card.querySelector('.tool-card-body'); body.textContent += (body.textContent?'\n\n':'')+event.result; toolCards.delete(event.id); if(pinned())scroll(); updateScrollButton(); }
      break;
    }
    case 'find-result': $('find-count').textContent = event.result?.matches ? `${event.result.active}/${event.result.matches}` : 'No results'; break;
    case 'approval': {
      approvalId=event.id;const external=event.name==='mcp',write=event.name==='write_file';
      $('approval-title').textContent=external?'May I use this external tool?':write?'May I write this file?':'May I run this command?';
      $('approval-description').textContent=external?`${event.args.server} · ${event.args.tool}\n${event.args.endpoint}\nReview the arguments before sending them to this server.`:write?`Create or replace ${event.args.path} in your selected workspace.`:'PowerShell runs with your user permissions. It can access files and services outside the workspace. Review the command before approving.';
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
