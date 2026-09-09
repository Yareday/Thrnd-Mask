import { CATEGORIES } from '../extension/core.js';
import test from 'node:test';
import assert from 'node:assert/strict';
test('rolling player: real readiness, slow responses, refill, retry and stale responses', async () => {
  let now = 300, frame; const pending = [], requests = [];
  class Element extends EventTarget {
    constructor(id) { super(); Object.assign(this, { id, checked: true, value: '', textContent: '', style: {}, files: [], readyState: 2, duration: 600, videoWidth: 960, videoHeight: 540, paused: true, seeking: false, _time: 0, children: [] }); }
    set currentTime(t) { this._time = t; queueMicrotask(() => this.dispatchEvent(new Event('seeked'))); } get currentTime() { return this._time; }
    pause() { this.paused = true; } async play() { this.paused = false; }
    getContext() { return { drawImage() { }, fillRect() { } }; } toDataURL() { return 'data:image/jpeg;base64,YQ=='; } replaceChildren(...children) { this.children = children; } appendChild(c) { this.children.push(c); return c; } append(...children) { this.children.push(...children); } setAttribute() { } click() { }
  }
  const nodes = new Map(), el = id => { if (!nodes.has(id)) nodes.set(id, new Element(id)); return nodes.get(id); };
  globalThis.document = { getElementById: el, createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }), addEventListener() { } }; globalThis.window = { addEventListener() { } }; globalThis.requestAnimationFrame = f => { frame = f; };
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body), parts = body.contents[0].parts;
    if (body.systemInstruction) return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ action: 'apply', message: 'I added a spider rule.', groups: { violence: false, sexual: false, language: false }, rules: [{ id: 'custom_spiders', title: 'Spiders', condition: 'A visible spider, not a drawing.', evidence: 'visual', enabled: true }] }) }] } }] }) };
    if (parts[0].text.startsWith('Inspect this generated')) return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"color":"green"}' }] } }] }) };
    requests.push({ url, options }); return new Promise(resolve => pending.push({ resolve, parts }));
  };
  const flush = () => new Promise(r => setImmediate(r));
  const advance = () => { now += 300; frame(); };
  async function answer(delay = 20000, status = 200, drop = []) {
    const job = pending.shift(); assert(job, 'expected analysis request'); now += delay;
    const segments = job.parts.filter(p => p.text?.startsWith('{')).map(p => ({ start_time: JSON.parse(p.text).start_time, scores: { ...Object.fromEntries(CATEGORIES.map(c => [c, 0])), custom_spiders: JSON.parse(p.text).start_time === 0 ? .9 : 0 } })).filter(s => !drop.includes(s.start_time));
    job.resolve({ ok: status === 200, status, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ segments }) }] } }] }) }); await flush(); await flush(); advance();
  }
  await import('../extension/legacy/player.js'); el('strong_language').checked = false;
  el('demo').onclick(); await flush(); advance(); el('play').onclick(); frame(); assert.equal(el('video').paused, false, 'demo has no countdown');
  el('video').currentTime = 10; frame(); assert.equal(el('video').currentTime, 14, 'merged skip');
  el('file').files = [new Blob(['test'])]; el('file').onchange(); await flush(); advance(); assert(el('status').textContent.includes('Enter your key')); assert.equal(requests.length, 0);
  el('key').value = 'test-key'; el('model').value = 'test-model'; el('consent').checked = true;
  await el('test').onclick(); await flush(); assert(el('connectionStatus').textContent.startsWith('Connected'));
  assert.equal(pending.length, 1); assert.equal(pending[0].parts.filter(p => p.inlineData).length, 64, 'four frames per segment plus forward context');
  el('play').onclick(); advance(); assert.equal(el('video').paused, true, 'await readiness');
  await answer(20000); assert.equal(el('video').paused, false, '20s response accepted; starts when first 30s ready'); assert.equal(pending.length, 1, 'continues analysis during playback');
  el('video').currentTime = 25; advance(); assert.equal(el('video').paused, true, 'refill below 6s');
  await answer(20000); assert.equal(el('video').paused, false, 'resumes with 35s ahead');
  while (pending.length) await answer(10000);
  assert(requests.every(r => JSON.parse(r.options.body).contents[0].parts.filter(p => p.inlineData).length <= 68));
  el('video').currentTime = 170; advance(); await flush(); assert(pending.length); assert(pending[0].parts.some(p => p.text?.includes('"start_time":180')), 'analysis moves beyond first three minutes');
  await answer(1, 429); assert(el('diagnostics').textContent.includes('429')); assert.equal(el('video').paused, false, 'ready buffer remains playable'); assert.equal(pending.length, 0, 'no uncontrolled retries');
  el('retry').onclick(); await flush(); assert.equal(el('video').currentTime, 170, 'retry retains position'); assert(pending.length);
  await answer(20000); assert.equal(el('video').paused, false, 'successful retry resumes');
  // The next in-flight batch must not overwrite a newly selected demo session.
  assert(pending.length); el('demo').onclick(); await flush(); await answer(20000); assert.equal(el('coverage').textContent, '90 / 90 classified'); assert.equal(pending.length, 0);
  // A short file can start once its entire shorter buffer is ready.
  el('video').duration = 12; el('probe').duration = 12; el('file').onchange(); await flush(); assert.equal(pending[0].parts.filter(p => p.inlineData).length, 24);
  el('play').onclick(); await answer(20000); assert.equal(el('video').paused, false); assert.equal(el('buffer').textContent, '12s');
  el('video').currentTime = 12; advance(); assert.equal(el('cover').textContent, 'Finished');
  // Preserve good decisions; retry only the missing source interval.
  el('video').duration = 600; el('probe').duration = 600; el('file').onchange(); await flush(); el('play').onclick(); await answer(1, 200, [20]);
  assert.equal(el('video').paused, true, '20s buffer not enough for first start');
  assert.deepEqual(pending[0].parts.filter(p => p.text?.startsWith('{')).map(p => JSON.parse(p.text).start_time), [20], 'only missing row retried');
  await answer(1); assert.equal(el('video').paused, false, 'valid earlier rows retained after repair');
  el('demo').onclick(); await flush(); while (pending.length) await answer(1);
  // Automatic repairs are bounded: at most three attempts per unresolved segment.
  el('video').duration = 12; el('probe').duration = 12; el('file').onchange(); await flush(); el('play').onclick();
  await answer(1, 200, [0, 2, 4, 6, 8, 10]); await answer(1, 200, [0, 2, 4]); await answer(1, 200, [0, 2, 4]);
  assert.equal(pending.length, 0); assert(el('status').textContent.includes('three attempts')); assert.equal(el('video').paused, true);
  el('demo').onclick(); await flush();
  el('chatInput').value = 'Turn off the defaults and skip spiders.'; await el('chatForm').onsubmit({ preventDefault() { } }); await flush(); assert.equal(el('ruleCount').textContent, '1 active custom rules');
  el('video').duration = 600; el('probe').duration = 600; el('file').onchange(); await flush(); assert(pending[0].parts[0].text.includes('custom_spiders')); assert(pending[0].parts[0].text.includes('not a drawing'));
  el('play').onclick(); await answer(20000); assert.equal(el('video').currentTime, 2, 'chat-created custom rule actually triggers skip');
  el('demo').onclick(); await flush(); while (pending.length) await answer(1);
  // Replay the reported valid connection followed by rejected analysis.
  el('file').onchange(); await flush(); assert(!JSON.parse(requests.at(-1).options.body).generationConfig.responseJsonSchema);
  await answer(1, 400); assert.equal(pending[0].parts.filter(p => p.text?.startsWith('{')).length, 5);
  await answer(1, 400); assert.equal(pending[0].parts.filter(p => p.text?.startsWith('{')).length, 1);
  await answer(1, 400); assert.equal(pending.length, 0, 'stop after minimal request rejected'); assert(el('diagnostics').textContent.includes('Analysis compatibility recovery'));
  el('retry').onclick(); await flush(); await answer(1, 200); assert(el('events').textContent.includes('CATEGORY_MATCH'), 'small request success still produces custom skip');
  el('demo').onclick(); await flush(); while (pending.length) await answer(1);

});
