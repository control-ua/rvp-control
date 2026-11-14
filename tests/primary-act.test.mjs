import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import {resolveActFiles} from '../supabase/functions/smart-api/act_files.ts';

test('completion checks the registry, approves with current auth, and verifies committed state', async () => {
  let acts=[],status='in_progress',calls=[],failed=false,commit=true;
  const supabase={
    auth:{getSession:async()=>({data:{session:{access_token:'test-office-token'}}})},
    functions:{invoke:async(name,options)=>{
      calls.push({name,...options});
      if(failed) return {error:{message:'Non-2xx response',context:Response.json({error:'Недостатньо прав для цієї дії.'},{status:403})}};
      if(commit){acts[0].status='approved';status='completed';}
      return {data:{ok:true}};
    }},
    from(table){return {select(){return this;},eq(){return this;},in(){return this;},
      order:async()=>({data:acts,error:null}),single:async()=>({data:{status},error:null})};},
  };
  const source=(await fs.readFile(new URL('../src/lib/actsApi.ts',import.meta.url),'utf8'))
    .replaceAll('import.meta.env.VITE_SUPABASE_URL',JSON.stringify('https://test.example'));
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const api={};new Function('require','exports',compiled)(()=>({supabase}),api);
  await assert.rejects(api.completeApplicationWithAct('app'),/Додайте первинний акт/);
  assert.equal(calls.length,0);
  acts=[{id:'act',status:'pending'}];failed=true;
  await assert.rejects(api.completeApplicationWithAct('app'),/Недостатньо прав для цієї дії/);
  failed=false;commit=false;
  await assert.rejects(api.completeApplicationWithAct('app'),/Завершення ще не підтверджено/);
  commit=true;await api.completeApplicationWithAct('app');
  const last=calls.at(-1);
  assert.equal(last.headers.Authorization,'Bearer test-office-token');
  assert.equal(last.body.action,'approve_act_from_web');
  assert.equal(last.body.act_id,'act');
  const count=calls.length;await api.completeApplicationWithAct('app');assert.equal(calls.length,count);
  acts=[{id:'rejected',status:'rejected'}];
  // Database filtering is covered by the SQL workflow regression.
});

test('bot opens private Storage originals and legacy Telegram files without duplicates', async () => {
  let rows=[{telegram_file_id:'legacy',file_type:'photo'},
    {storage_path:'app/act/page.pdf',file_type:'document'}];
  let denied=false;
  const db={from:()=>({select(){return this;},eq(){return this;},order:async()=>({data:rows})}),
    storage:{from:bucket=>({createSignedUrl:async(path,ttl)=>{
      assert.equal(bucket,'application-media');assert.equal(ttl,600);
      return denied?{error:{message:'denied'}}:{data:{signedUrl:'https://private.example/temporary'}};
    }})}};
  const files=await resolveActFiles(db,{id:'act',telegram_file_id:'legacy'});
  assert.equal(files.length,2);assert.equal(files[0].source,'legacy');
  assert.equal(files[1].source,'https://private.example/temporary');
  denied=true;await assert.rejects(resolveActFiles(db,{id:'act'}),/недоступний/);
  rows=[];assert.deepEqual(await resolveActFiles(db,{id:'act'}),[]);
});
