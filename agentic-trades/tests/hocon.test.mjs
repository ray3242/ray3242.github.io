import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {parseHocon} from '../runtime/hocon.js';

test('malformed arrays throw rather than loop',()=>{
  const moduleUrl=new URL('../runtime/hocon.js',import.meta.url).href;
  for(const input of ['{"tools": [}', '{tools: [value }', '{tools: [,]}']) {
    const child=spawnSync(process.execPath,['--input-type=module','-e',`import {parseHocon} from ${JSON.stringify(moduleUrl)}; try {parseHocon(${JSON.stringify(input)});process.exit(2);} catch(error) {if(!error.message.includes('HOCON parse error'))throw error;}`],{timeout:1000});
    assert.equal(child.error,undefined,`parser did not terminate for ${input}`);
    assert.equal(child.status,0,`expected parse error for ${input}`);
  }
});
test('valid empty, nested and commented arrays still parse',()=>{
  assert.deepEqual(parseHocon('{tools: []}'),{tools:[]});
  assert.deepEqual(parseHocon('{tools: [1, [true], {name: "agent"}, # comment\n]}'),{tools:[1,[true],{name:'agent'}]});
  assert.throws(()=>parseHocon('{tools: [1'),/HOCON parse error/);
});
