const {createHash}=require('node:crypto');
const groups=[
  {id:'files',name:'Files & workspace',description:'Read project files, search filenames and show results in Explorer.',tools:['find_files','reveal_file','list_files','read_file','write_file']},
  {id:'web',name:'Web research',description:'Search the web using your saved Ollama Cloud connection.',tools:['web_search']},
  {id:'desktop',name:'Computer control',description:'Open apps and web pages, control music playback, and use observed controls on Windows.',tools:['computer','open_application','control_media']},
  {id:'shell',name:'PowerShell',description:'Run commands after your approval. Commands are not sandboxed.',tools:['run_powershell']},
  {id:'wallet',owner:'gigi',name:'Wallet & markets',description:'Read the user\'s Solana holdings, look up tokens and place simulated paper trades. Read-only; paper only. Gigi only.',tools:['wallet_summary','wallet_holdings','wallet_token','wallet_history','market_discover','token_safety','paper_buy','paper_sell','paper_condition','strategy_list','strategy_create','strategy_status','strategy_run','trade_preview','trade_execute','session_pause','session_resume','show_view','thesis_create','thesis_list','thesis_activate','thesis_share','signal_create','signal_list']}
];
function normalize(data){data.plugins=Object.fromEntries(groups.map(g=>[g.id,data.plugins?.[g.id]!==false]));data.mcpServers=Array.isArray(data.mcpServers)?data.mcpServers.filter(s=>s&&typeof s.id==='string').slice(0,12):[];}
function allowed(data,name,agent){const group=groups.find(g=>g.tools.includes(name));if(!group)return true;if(group.owner&&agent&&agent!==group.owner)return false;return data.plugins[group.id]!==false;}
function serverConfig(value){
  if(!value||typeof value.name!=='string'||!value.name.trim()||value.name.length>80)throw Error('Enter a server name under 80 characters.');
  if(!['http','stdio'].includes(value.transport))throw Error('Choose an MCP transport.');
  const config={name:value.name.trim(),transport:value.transport};
  if(value.transport==='http'){
    let url;try{url=new URL(value.url);}catch{throw Error('Enter a valid MCP endpoint.');}
    const loopback=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
    if((url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))||url.username||url.password||url.search||url.hash)throw Error('MCP endpoints need HTTPS, or HTTP on localhost, without URL credentials, query tokens or fragments.');
    config.url=url.href;
  }else{
    if(typeof value.command!=='string'||!value.command.trim()||value.command.length>1000||/[\r\n\0]/.test(value.command))throw Error('Enter one executable path or command, without shell syntax.');
    if(!Array.isArray(value.args)||value.args.length>30||value.args.some(a=>typeof a!=='string'||a.length>2000||/[\r\n\0]/.test(a)))throw Error('Arguments must be a JSON array of short strings.');
    // SDK spawns an executable directly. Shells, command files and package downloads are not implicit.
    if(/(?:^|[\\/])(cmd|powershell|pwsh|wscript|cscript)(?:\.exe)?$/i.test(value.command.trim())||/\.(cmd|bat|ps1)$/i.test(value.command.trim()))throw Error('Use a server executable directly, such as node.exe or python.exe, rather than a shell or command file.');
    config.command=value.command.trim();config.args=value.args;
  }
  return config;
}
function toolName(id,name){return 'mcp_'+createHash('sha256').update(id+'\0'+name).digest('hex').slice(0,24);}
function createMcpManager({decrypt=()=>'',connectClient,onChange=()=>{}}={}){
  const active=new Map(),connecting=new Set(),pendingClients=new Set(),statuses=new Map();let disposed=false;
  const clean=(text,server)=>{let token='';try{token=decrypt(server);}catch{}return token?String(text).split(token).join('[redacted]'):String(text);};
  async function connect(server){
    if(disposed)throw Error('MCP is shutting down.');serverConfig(server);if(connecting.has(server.id))throw Error('This server is already connecting.');
    connecting.add(server.id);statuses.set(server.id,'connecting');onChange();
    let client;
    try{
      await disconnect(server.id);statuses.set(server.id,'connecting');
      if(connectClient)client=await connectClient(server);
      else{
        const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
        client=new Client({name:'heartflow-aurora',version:require('../package.json').version},{capabilities:{}});
        let transport;
        if(server.transport==='stdio'){
          const {StdioClientTransport}=require('@modelcontextprotocol/sdk/client/stdio.js');
          transport=new StdioClientTransport({command:server.command,args:server.args,stderr:'ignore'});
        }else{
          const {StreamableHTTPClientTransport}=require('@modelcontextprotocol/sdk/client/streamableHttp.js');
          const endpoint=new URL(server.url),token=decrypt(server);
          transport=new StreamableHTTPClientTransport(endpoint,{requestInit:{headers:token?{Authorization:`Bearer ${token}`}:{},redirect:'error'},fetch:async(url,options)=>{
            if(new URL(url instanceof Request?url.url:String(url)).origin!==endpoint.origin)throw Error('MCP request attempted to change endpoint origin.');
            return fetch(url,{...options,redirect:'error'});
          }});
        }
        pendingClients.add(client);await client.connect(transport,{timeout:20000});
      }
      const inventory=[];let cursor;const cursors=new Set();
      do{
        const response=await client.listTools(cursor?{cursor}:undefined,{timeout:20000});
        inventory.push(...response.tools);cursor=response.nextCursor;
        if(inventory.length>60)throw Error('This server offers too many tools. Use a smaller server configuration.');
        if(cursor&&(cursors.has(cursor)||cursors.size>=10))throw Error('Unsupported MCP tool pagination.');
        if(cursor)cursors.add(cursor);
      }while(cursor);
      if(disposed)throw Error('MCP is shutting down.');
      const tools=inventory.map(tool=>{
        if(!tool.name||typeof tool.name!=='string'||JSON.stringify(tool.inputSchema||{}).length>24000)throw Error('Unsupported tool metadata.');
        return {type:'function',function:{name:toolName(server.id,tool.name),description:`External MCP tool from ${server.name}: ${String(tool.description||tool.name).slice(0,1000)}`,parameters:tool.inputSchema||{type:'object',properties:{}}},original:tool.name};
      });
      if(new Set(tools.map(t=>t.function.name)).size!==tools.length)throw Error('Duplicate MCP tool names.');
      client.onclose=()=>{if(active.get(server.id)?.client===client){active.delete(server.id);statuses.set(server.id,'disconnected');onChange();}};
      client.onerror=()=>{};
      active.set(server.id,{client,server,tools});statuses.set(server.id,'connected');onChange();return tools.length;
    }catch(error){await client?.close().catch(()=>{});statuses.set(server.id,'error');onChange();throw Error('MCP connection failed: '+clean(error.message,server));}
    finally{pendingClients.delete(client);connecting.delete(server.id);}
  }
  async function disconnect(id){const entry=active.get(id);active.delete(id);if(entry)await entry.client.close().catch(()=>{});statuses.set(id,'disconnected');onChange();}
  function inventory(){return [...active.values()].flatMap(entry=>entry.tools.map(({original,...tool})=>tool));}
  function snapshot(servers){return servers.map(({encryptedToken,...server})=>({...server,hasToken:!!encryptedToken,status:statuses.get(server.id)||'disconnected',tools:(active.get(server.id)?.tools||[]).map(tool=>({name:tool.original,runtimeName:tool.function.name,description:tool.function.description}))}));}
  async function execute(name,args,{signal,approve}){
    const entry=[...active.values()].find(entry=>entry.tools.some(t=>t.function.name===name));if(!entry)throw Error('This MCP tool is disconnected. Reconnect it in Settings.');
    const tool=entry.tools.find(t=>t.function.name===name);
    if(!args||typeof args!=='object'||Array.isArray(args)||JSON.stringify(args).length>20000)throw Error('Invalid MCP arguments.');
    signal.throwIfAborted();
    if(!await approve('mcp',{server:entry.server.name,tool:tool.original,endpoint:entry.server.url||entry.server.command,arguments:args}))return {denied:true,message:'User declined this external tool. Do not retry.'};
    signal.throwIfAborted();if(active.get(entry.server.id)!==entry)throw Error('MCP server disconnected before execution.');
    const result=await entry.client.callTool({name:tool.original,arguments:args},undefined,{signal,timeout:60000});
    const content=(result.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n').slice(0,24000);
    const structured=result.structuredContent?JSON.stringify(result.structuredContent):'';
    return {server:entry.server.name,tool:tool.original,...(result.isError?{error:clean(content||'MCP server reported an error.',entry.server)}:{content:clean(content,entry.server)}),...(structured&&structured.length<=24000?{structuredContent:JSON.parse(clean(structured,entry.server))}:{})};
  }
  async function close(){disposed=true;await Promise.allSettled([...pendingClients].map(client=>client.close()));await Promise.allSettled([...active.keys()].map(disconnect));}
  return {connect,disconnect,inventory,snapshot,execute,close,connecting};
}
module.exports={groups,normalize,allowed,serverConfig,toolName,createMcpManager};
