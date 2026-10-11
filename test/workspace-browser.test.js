const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {browse,preview}=require('../src/workspace-browser');
test('workspace browser sorts folders first and previews plain text without reading outside its root',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'aurora-browser-'));
  try{
    await fs.mkdir(path.join(root,'notes'));await fs.writeFile(path.join(root,'readme.md'),'<script>example</script>');await fs.writeFile(path.join(root,'binary.bin'),Buffer.from([1,0,2]));await fs.writeFile(path.join(root,'large.txt'),'a'.repeat(200001));
    assert.equal((await browse(root)).entries[0].kind,'folder');assert.equal((await preview(root,'readme.md')).content,'<script>example</script>');
    await assert.rejects(preview(root,'binary.bin'),/binary/);await assert.rejects(preview(root,'large.txt'),/200 KB/);await assert.rejects(preview(root,'../escape.txt'));await assert.rejects(browse(root,'../'));await assert.rejects(browse('','.'));
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
