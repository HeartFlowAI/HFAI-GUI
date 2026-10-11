const {Server}=require('@modelcontextprotocol/sdk/server/index.js');
const {StdioServerTransport}=require('@modelcontextprotocol/sdk/server/stdio.js');
const {ListToolsRequestSchema,CallToolRequestSchema}=require('@modelcontextprotocol/sdk/types.js');
const server=new Server({name:'aurora-fixture',version:'1.0.0'},{capabilities:{tools:{}}});let calls=0;
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:'echo',description:'Echo fixture input',inputSchema:{type:'object',properties:{message:{type:'string'}},required:['message']}}]}));
server.setRequestHandler(CallToolRequestSchema,async request=>({content:[{type:'text',text:`${++calls}: ${request.params.arguments.message}`}]}));
server.connect(new StdioServerTransport()).catch(()=>process.exit(1));
