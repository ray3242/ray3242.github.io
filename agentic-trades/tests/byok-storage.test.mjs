import test from 'node:test';
import assert from 'node:assert/strict';
import {loadByokStore,upsertByokProfile} from '../runtime/byok.js';

function setGlobal(t,name,value) {
  const previous=Object.getOwnPropertyDescriptor(globalThis,name);
  Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
  t.after(()=>previous?Object.defineProperty(globalThis,name,previous):delete globalThis[name]);
}

test('saving profiles never writes keys to cookies; legacy cookie is removed and ignored',t=>{
  const values=new Map();
  const writes=[];
  const legacy={version:1,selectedId:'legacy',updatedAt:'9999',profiles:[{id:'legacy',key:'fake-legacy-key',router:'https://provider.example/v1'}]};
  setGlobal(t,'location',{hostname:'localhost',protocol:'http:'});
  setGlobal(t,'localStorage',{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)});
  setGlobal(t,'document',{get cookie(){return `nsweb_byok_profiles_v1=${encodeURIComponent(JSON.stringify(legacy))}`;},set cookie(v){writes.push(v);}});
  upsertByokProfile({id:'test',key:'fake-new-key',router:'https://provider.example/v1'});
  assert.ok(writes.every(v=>!v.includes('fake-new-key')&&!v.includes('fake-legacy-key')),'key leaked into cookie write');
  assert.ok(writes.some(v=>v.includes('nsweb_byok_profiles_v1=;')&&v.includes('Max-Age=0')));
  const store=loadByokStore();
  assert.deepEqual(store.profiles.map(p=>p.id),['test']);
  assert.equal(store.profiles[0].key,'fake-new-key');
  assert.match(values.get('nsweb-byok-profiles-v1'),/fake-new-key/);
});
test('unavailable storage yields an empty store without cookie fallback',t=>{
  setGlobal(t,'localStorage',{getItem(){throw new Error('blocked');}});
  assert.deepEqual(loadByokStore().profiles,[]);
});
