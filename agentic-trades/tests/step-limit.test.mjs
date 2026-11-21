import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgent} from '../runtime/runner.js';
import {AgentNetwork} from '../runtime/kernel.js';
import {TraceBus} from '../runtime/trace.js';

async function run(responses) {
  const network=new AgentNetwork({max_steps:1,tools:[{name:'concierge',instructions:'Help the visitor.'}]},'test');
  return runAgent({network,displayOrigin:'example.test',trace:new TraceBus(),isTop:true,frontMan:'concierge',history:[],llm:{chat:async()=>responses.shift()}},'concierge','Help',null,[]);
}
test('tool call exhausting the step budget returns a visitor-visible explanation',async()=>{
  const result=await run([{content:'',toolCalls:[{id:'last',type:'function',function:{name:'unknown_tool',arguments:'{}'}}]}]);
  assert.match(result.text,/step limit reached/i);
});
test('normal and empty model answers do not report step exhaustion',async()=>{
  assert.equal((await run([{content:'Hello',toolCalls:[]}])).text,'Hello');
  assert.equal((await run([{content:'',toolCalls:[]}])).text,'');
});
test('model errors still propagate',async()=>{
  await assert.rejects(run([]),/./);
});
