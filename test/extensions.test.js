const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {normalize,allowed,serverConfig,toolName,createMcpManager}=require('../src/extensions');
const config={id:'fixture',name:'Fixture',transport:'stdio',command:process.execPath,args:[path.join(__dirname,'fixtures','mcp-server.js')]};
test('plugins migrate enabled, preserve disabled groups and retain core questions',()=>{
  const data={plugins:{desktop:false}};normalize(data);
  assert.equal(allowed(data,'computer'),false);assert.equal(allowed(data,'read_file'),true);assert.equal(allowed(data,'ask_user_question'),true);
});
test('MCP validates endpoints and direct executables without accepting URL secrets or shell files',()=>{
  for(const url of ['http://remote.example/mcp','https://user:password@example.com/mcp','https://example.com/mcp?token=secret'])assert.throws(()=>serverConfig({name:'Test',transport:'http',url}));
  assert.equal(serverConfig({name:'Test',transport:'http',url:'http://localhost:3000/mcp'}).url,'http://localhost:3000/mcp');
  for(const command of ['cmd.exe',' cmd.exe ','C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','server.cmd','server.cmd '])assert.throws(()=>serverConfig({...config,command}));
  assert.equal(serverConfig(config).command,process.execPath);
  assert.match(toolName('a','unsafe tool name'),/^mcp_[a-f0-9]{24}$/);assert.notEqual(toolName('a','echo'),toolName('b','echo'));
});
test('real stdio server discovers tools, denies without executing, executes after review and disconnects',async()=>{
  const manager=createMcpManager();try{
    assert.equal(await manager.connect(config),1);const tool=manager.inventory()[0];
    const signal=new AbortController().signal;
    const denied=await manager.execute(tool.function.name,{message:'hello'},{signal,approve:async()=>false});assert.equal(denied.denied,true);
    const result=await manager.execute(tool.function.name,{message:'hello'},{signal,approve:async(name,args)=>{assert.equal(name,'mcp');assert.equal(args.tool,'echo');assert.equal(args.arguments.message,'hello');return true;}});
    assert.equal(result.content,'1: hello');assert.equal(manager.snapshot([config])[0].status,'connected');
    await manager.disconnect(config.id);assert.equal(manager.inventory().length,0);
    await assert.rejects(manager.execute(tool.function.name,{}, {signal,approve:async()=>true}),/disconnected/);
  }finally{await manager.close();}
});
test('approval cancellation, token redaction, pagination errors and shutdown close clients',async()=>{
  let calls=0,closed=0;const client={listTools:async()=>({tools:[{name:'echo',inputSchema:{type:'object'}}]}),callTool:async()=>{calls++;return {content:[{type:'text',text:'token-secret'}]};},close:async()=>{closed++;}};
  const manager=createMcpManager({connectClient:async()=>client,decrypt:()=> 'token-secret'});
  await manager.connect(config);const name=manager.inventory()[0].function.name;const controller=new AbortController();
  await assert.rejects(manager.execute(name,{}, {signal:controller.signal,approve:async()=>{controller.abort();return true;}}),/abort/i);assert.equal(calls,0);
  const result=await manager.execute(name,{}, {signal:new AbortController().signal,approve:async()=>true});assert.equal(result.content,'[redacted]');
  await manager.close();assert.ok(closed);await assert.rejects(manager.connect(config),/shutting down/);
  const bad=createMcpManager({connectClient:async()=>({...client,listTools:async()=>({tools:[],nextCursor:'repeat'})})});
  try{await assert.rejects(bad.connect(config),/pagination/);}finally{await bad.close();}
});
test('Streamable HTTP discovers and calls a bearer-authenticated server without exposing the token',async()=>{
  const http=require('node:http');const {Server}=require('@modelcontextprotocol/sdk/server/index.js');
  const {StreamableHTTPServerTransport}=require('@modelcontextprotocol/sdk/server/streamableHttp.js');const {ListToolsRequestSchema,CallToolRequestSchema}=require('@modelcontextprotocol/sdk/types.js');
  const server=new Server({name:'remote-fixture',version:'1.0.0'},{capabilities:{tools:{}}});
  server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:'echo',inputSchema:{type:'object'}}]}));
  server.setRequestHandler(CallToolRequestSchema,async()=>({content:[{type:'text',text:'remote-secret result'}]}));
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:()=>require('node:crypto').randomUUID()});await server.connect(transport);let authorized=0;
  const listener=http.createServer(async(req,res)=>{if(req.headers.authorization!=='Bearer remote-secret'){res.writeHead(403).end();return;}authorized++;try{await transport.handleRequest(req,res);}catch{if(!res.headersSent)res.writeHead(500).end();}});
  await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const remote={id:'http',name:'Remote',transport:'http',url:`http://127.0.0.1:${listener.address().port}/mcp`,encryptedToken:'encrypted'};
  const manager=createMcpManager({decrypt:()=> 'remote-secret'});
  try{
    assert.equal(await manager.connect(remote),1);const result=await manager.execute(manager.inventory()[0].function.name,{}, {signal:new AbortController().signal,approve:async()=>true});assert.equal(result.content,'[redacted] result');assert.ok(authorized>=3);assert.equal(manager.snapshot([remote])[0].encryptedToken,undefined);
  }finally{await manager.close();await server.close();await new Promise(resolve=>listener.close(resolve));}
});
