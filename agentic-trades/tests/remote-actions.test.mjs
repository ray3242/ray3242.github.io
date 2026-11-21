import test from 'node:test';
import assert from 'node:assert/strict';
import {registerRemoteActions,ActionBridgeClient} from '../runtime/action-transport.js';
import {ActionRegistry} from '../runtime/actions.js';

test('remote actions skip absent bridge without attempting a connection',async()=>{
  const original=ActionBridgeClient.prototype.connect;
  const attempted=[];
  ActionBridgeClient.prototype.connect=async function(){attempted.push(this.url);throw new Error('unexpected bridge discovery');};
  try {
    for(const manifest of [{},{actions:{version:1,module:'./site-actions.js'}}]) {
      await registerRemoteActions(new ActionRegistry(),{base:'https://peer.example/site',network:'peer'},manifest);
    }
    assert.deepEqual(attempted,[]);
  } finally {ActionBridgeClient.prototype.connect=original;}
});
