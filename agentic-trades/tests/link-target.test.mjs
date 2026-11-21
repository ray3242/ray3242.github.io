import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../runtime/engine.js';

const base='https://ray3242.github.io/agentic-trades';
const manifest={networks:[{name:'northgate'}]};
test('extensionless site paths use their own manifest with or without a trailing slash',async(t)=>{
  const urls=[];
  t.mock.method(globalThis,'fetch',async url=>{
    urls.push(url);
    assert.equal(url,`${base}/agent-manifest.json`);
    return Response.json(manifest);
  });
  for(const url of [base,`${base}/`])assert.equal(await Engine.prototype._normalizeLinkTarget('trade_partner',url),`${base}/northgate`);
  assert.equal(urls.length,2);
});
test('exact named network URLs fall back to the parent only for a missing directory manifest',async(t)=>{
  const urls=[];
  t.mock.method(globalThis,'fetch',async url=>{
    urls.push(url);
    return url===`${base}/northgate/agent-manifest.json`?new Response('',{status:404}):Response.json(manifest);
  });
  assert.equal(await Engine.prototype._normalizeLinkTarget('trade_partner',`${base}/northgate`),`${base}/northgate`);
  assert.deepEqual(urls,[`${base}/northgate/agent-manifest.json`,`${base}/agent-manifest.json`]);
});
test('directory permission errors do not silently select a parent network',async(t)=>{
  const urls=[];
  t.mock.method(globalThis,'fetch',async url=>{urls.push(url);return new Response('',{status:403});});
  await assert.rejects(Engine.prototype._normalizeLinkTarget('trade_partner',base),/manifest fetch 403/);
  assert.deepEqual(urls,[`${base}/agent-manifest.json`]);
});
test('empty and ambiguous directory manifests cannot select a network',async(t)=>{
  for(const networks of [[],[{name:'one'},{name:'two'}]]) {
    t.mock.method(globalThis,'fetch',async()=>Response.json({networks}));
    await assert.rejects(Engine.prototype._normalizeLinkTarget('trade_partner',base),/No unique network/);
    t.mock.restoreAll();
  }
});
