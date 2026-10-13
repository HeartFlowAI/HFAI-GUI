const {randomUUID}=require('node:crypto');
const mode=value=>value==='code'?'code':'normal';
function project(data,id){return data.projects.find(p=>p.id===id);}
function syncWorkspace(data){data.workspace=project(data,data.activeProjectId)?.workspace||(!data.activeProjectId?data.defaultWorkspace:'')||'';}
function createSession(data){const defaultAgent=typeof data.agent==='string'?data.agent:'aurora';const chat={id:randomUUID(),title:'New conversation',messages:[],created:Date.now(),updated:Date.now(),mode:mode(data.mode),projectId:data.activeProjectId||null,agent:defaultAgent,agents:[defaultAgent],combo:'',custom:[]};data.chats.unshift(chat);data.currentId=chat.id;syncWorkspace(data);return chat;}
function selectSession(data,id){const chat=data.chats.find(c=>c.id===id);if(!chat)throw Error('Session not found.');data.currentId=id;data.mode=chat.mode;data.activeProjectId=chat.projectId;if(typeof chat.agent==='string')data.agent=chat.agent;syncWorkspace(data);return chat;}
function normalize(data){
 data.projects=Array.isArray(data.projects)?data.projects.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string').map(p=>({...p,workspace:typeof p.workspace==='string'?p.workspace:''})):[];
 data.defaultWorkspace=typeof data.defaultWorkspace==='string'?data.defaultWorkspace:(data.workspace||'');
 data.chats=Array.isArray(data.chats)?data.chats:[];
 for(const chat of data.chats){chat.mode=mode(chat.mode);chat.projectId=project(data,chat.projectId)?chat.projectId:null;chat.updated=chat.updated||chat.created||Date.now();chat.title=typeof chat.title==='string'&&chat.title.trim()?chat.title.trim():'New conversation';chat.pinned=chat.pinned===true;chat.archived=chat.archived===true;chat.agent=typeof chat.agent==='string'?chat.agent:(typeof data.agent==='string'?data.agent:'aurora');chat.agents=Array.isArray(chat.agents)&&chat.agents.length?chat.agents.filter(id=>typeof id==='string'):[chat.agent];chat.combo=typeof chat.combo==='string'?chat.combo:'';chat.custom=Array.isArray(chat.custom)?chat.custom.filter(id=>typeof id==='string'):[];}
 data.mode=mode(data.mode);data.activeProjectId=project(data,data.activeProjectId)?data.activeProjectId:null;
 if(data.chats.some(c=>c.id===data.currentId))selectSession(data,data.currentId);else chooseContext(data,data.mode,data.activeProjectId);
 return data;
}
function chooseContext(data,nextMode,projectId){
 if(!['normal','code'].includes(nextMode))throw Error('Choose Normal or Aurora Code.');
 if(projectId!==null&&!project(data,projectId))throw Error('Project not found.');
 data.mode=nextMode;data.activeProjectId=projectId;
 const chat=data.chats.find(c=>c.mode===nextMode&&c.projectId===projectId);
 if(chat)selectSession(data,chat.id);else createSession(data);
}
function addProject(data,name){if(typeof name!=='string'||!name.trim()||name.trim().length>80)throw Error('Use a project name between 1 and 80 characters.');const p={id:randomUUID(),name:name.trim(),workspace:'',created:Date.now()};data.projects.push(p);chooseContext(data,data.mode,p.id);return p;}
function deleteProject(data,id){const target=project(data,id);if(!target)throw Error('Workspace not found.');data.projects=data.projects.filter(p=>p.id!==id);for(const chat of data.chats)if(chat.projectId===id)chat.projectId=null;if(data.activeProjectId===id){data.activeProjectId=null;const current=data.chats.find(c=>c.id===data.currentId);if(current){current.projectId=null;data.mode=current.mode;}else createSession(data);}syncWorkspace(data);return target;}
function assignProject(data,id){if(id!==null&&!project(data,id))throw Error('Project not found.');const chat=data.chats.find(c=>c.id===data.currentId);chat.projectId=id;data.activeProjectId=id;syncWorkspace(data);}
function deleteSession(data,id){if(!data.chats.some(c=>c.id===id))throw Error('Session not found.');data.chats=data.chats.filter(c=>c.id!==id);if(data.currentId===id)chooseContext(data,data.mode,data.activeProjectId);}
function setWorkspace(data,folder){const p=project(data,data.activeProjectId);if(p)p.workspace=folder;else data.defaultWorkspace=folder;syncWorkspace(data);}
function renameSession(data,id,title){const chat=data.chats.find(c=>c.id===id);if(!chat)throw Error('Session not found.');if(typeof title!=='string'||!title.trim()||title.trim().length>120)throw Error('Use a session name between 1 and 120 characters.');chat.title=title.trim();chat.updated=Date.now();return chat;}
function togglePinned(data,id){const chat=data.chats.find(c=>c.id===id);if(!chat)throw Error('Session not found.');chat.pinned=!chat.pinned;chat.updated=Date.now();return chat;}
function archiveSession(data,id,archived=true){const chat=data.chats.find(c=>c.id===id);if(!chat)throw Error('Session not found.');chat.archived=!!archived;if(data.currentId===id&&chat.archived)chooseContext(data,data.mode,data.activeProjectId);return chat;}
function duplicateSession(data,id){const source=data.chats.find(c=>c.id===id);if(!source)throw Error('Session not found.');const copy={...source,id:randomUUID(),title:`${source.title} copy`,messages:source.messages.map(message=>({...message})),created:Date.now(),updated:Date.now(),pinned:false,archived:false};data.chats.unshift(copy);data.currentId=copy.id;data.mode=copy.mode;data.activeProjectId=copy.projectId;syncWorkspace(data);return copy;}
function currentChat(data){return data.chats.find(c=>c.id===data.currentId);}
function retitle(chat){const first=chat.messages.find(m=>m.role==='user'&&typeof m.content==='string'&&m.content.trim());chat.title=first?first.content.trim().slice(0,42):'New conversation';}
function editMessage(data,index,content){
  const chat=currentChat(data);if(!chat)throw Error('Session not found.');
  if(!Number.isInteger(index)||index<0||index>=chat.messages.length)throw Error('That message is no longer here.');
  if(chat.messages[index].role!=='user')throw Error('Only your own messages can be edited.');
  if(typeof content!=='string'||!content.trim()||content.length>20000)throw Error('Enter a message under 20,000 characters.');
  const wasFirst=chat.messages.findIndex(m=>m.role==='user')===index;
  chat.messages[index].content=content.trim();
  delete chat.messages[index].attachments;delete chat.messages[index].display;
  chat.messages.splice(index+1);
  if(wasFirst)retitle(chat);
  chat.updated=Date.now();
  return chat;
}
function retryMessage(data){
  const chat=currentChat(data);if(!chat)throw Error('Session not found.');
  const lastUser=chat.messages.findLastIndex(m=>m.role==='user');
  if(lastUser<0)throw Error('Nothing to regenerate yet.');
  chat.messages.splice(lastUser+1);
  chat.updated=Date.now();
  return chat;
}
function deleteMessage(data,index){
  const chat=currentChat(data);if(!chat)throw Error('Session not found.');
  if(!Number.isInteger(index)||index<0||index>=chat.messages.length)throw Error('That message is no longer here.');
  const wasFirst=chat.messages.findIndex(m=>m.role==='user')===index;
  const [removed]=chat.messages.splice(index,1);
  if(removed.role==='user')while(chat.messages[index]&&chat.messages[index].role!=='user')chat.messages.splice(index,1);
  else if(removed.role==='assistant')while(chat.messages[index]&&chat.messages[index].role==='tool')chat.messages.splice(index,1);
  if(wasFirst)retitle(chat);
  chat.updated=Date.now();
  return chat;
}
function summaries(data){return data.chats.filter(c=>!c.archived).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updated-a.updated).map(c=>({id:c.id,title:c.title,mode:c.mode,projectId:c.projectId,updated:c.updated,pinned:!!c.pinned,agent:c.agent,agents:c.agents,combo:c.combo||''}));}
function searchSessions(data,query){
 if(typeof query!=='string'||query.length>200)throw Error('Search with up to 200 characters.');const term=query.trim().toLocaleLowerCase();if(!term)return [];
 const hits=[];for(const chat of data.chats){let snippet='';let matched=chat.title.toLocaleLowerCase().includes(term);
 for(const message of chat.messages){if(!['user','assistant'].includes(message.role)||typeof message.content!=='string')continue;const index=message.content.toLocaleLowerCase().indexOf(term);if(index>=0){matched=true;snippet=message.content.slice(Math.max(0,index-35),index+120).replace(/\s+/g,' ');break;}}
 if(matched)hits.push({...summaries({chats:[chat]})[0],snippet});if(hits.length===100)break;}
 return hits;
}
module.exports={normalize,createSession,selectSession,chooseContext,addProject,deleteProject,assignProject,deleteSession,renameSession,togglePinned,archiveSession,duplicateSession,setWorkspace,summaries,searchSessions,editMessage,retryMessage,deleteMessage};
