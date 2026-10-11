const fs=require('node:fs/promises');
const {workspacePath}=require('./tools');
async function browse(root,relative='.'){
  const directory=await workspacePath(root,relative);const entries=await fs.readdir(directory,{withFileTypes:true});
  return {path:relative,entries:entries.filter(e=>!e.isSymbolicLink()).sort((a,b)=>Number(b.isDirectory())-Number(a.isDirectory())||a.name.localeCompare(b.name)).slice(0,300).map(e=>({name:e.name,kind:e.isDirectory()?'folder':'file'})),truncated:entries.length>300};
}
async function preview(root,relative){
  const file=await workspacePath(root,relative),stat=await fs.stat(file);
  if(!stat.isFile()||stat.size>200000)throw Error('Preview supports text files up to 200 KB.');
  const content=await fs.readFile(file);if(content.includes(0))throw Error('This file is binary. Text preview is unavailable.');
  return {path:relative,content:content.toString('utf8'),size:stat.size};
}
module.exports={browse,preview};
