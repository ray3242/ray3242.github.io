import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../runtime/engine.js';

test('loading saved provider settings never discovers provider manifests',async(t)=>{
  const base='https://site.example/agentic-trades';
  const urls=[];
  t.mock.method(globalThis,'fetch',async url=>{
    urls.push(url);
    return Response.json({networks:[{name:'northgate'}],llm_router:{base_url:'https://openrouter.ai/api/v1'},deployment:{mode:'static'}});
  });
  const engine=new Engine({originUrl:base,routerOverride:'https://api.openai.com/v1',byokKey:'fake-test-key',modelOverride:'gpt-4.1-mini'});
  engine._compile=async()=>({network:{name:'northgate',findFrontMan:()=> 'concierge'},llm:{mock:false},validation:{errors:[],warnings:[]}});
  await engine.loadTop();
  assert.deepEqual(urls,[`${base}/agent-manifest.json`]);
  assert.equal(engine.routerOverride,'https://api.openai.com/v1');
});
