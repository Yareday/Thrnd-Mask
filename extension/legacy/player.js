import { analysisBody, smallerBatch, requestSummary } from '../transport.js';
import { CONTRACT, CATEGORIES, horizon, decide, fixture, parseVtt, bufferAhead } from '../core.js';
import { collectRows } from '../decisions.js';
import { expandGroups } from '../rules.js';
import { initChat } from './chat.js';
import { FILTERS, thresholdFor, buildPrompt } from '../categories.js';
import { request, responseText, testConnection, explain, redact, normalizeModel } from '../api.js';
const $ = id => document.getElementById(id), video = $('video'), probe = $('probe'), canvas = $('screen'), ctx = canvas.getContext('2d');
let mode = 'none', url = null, subtitles = [], records = new Map(), log = [], epoch = 0, wanted = false, busy = false, controller = null, skipped = new Set(), lastPaint = 0;
let buffering = true, failure = '', phase = '', phaseStart = 0, connected = '', testing = false, testCtl = null, loading = false, dropped = 0;
let customRules = [], chatUI = null; const attempts = new Map(); let batchLimit = CONTRACT.batchSegments;
const groups = () => ({ violence: $('violence').checked, sexual: $('sexual_content').checked, language: $('strong_language').checked });
const diagnostics = [];
function diagnose(entry) {
  const clean = { at: new Date().toISOString(), ...entry };
  for (const [k, v] of Object.entries(clean)) if (typeof v === 'string') clean[k] = redact(v, $('key').value.trim());
  diagnostics.push(clean); if (diagnostics.length > 300) diagnostics.shift();
  $('diagnostics').textContent = JSON.stringify(diagnostics, null, 2);
  if (testing && entry.state === 'started') $('connectionStatus').textContent = `${clean.stage}${clean.model ? ' · ' + clean.model : ''} · waiting for Google (up to 90s).`;
  if (entry.state === 'failed') $('apiDetails').open = true;
}
$('downloadDiagnostics').onclick = () => {
  const payload = { app: 'Thrnd', version: '7.0.0', diagnostics };
  const u = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = u; a.download = 'thrnd-api-diagnostics.json'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000);
};
const clock = () => performance.now(), toggles = () => ({ ...expandGroups(groups()), ...Object.fromEntries(customRules.filter(r => r.enabled).map(r => [r.id, true])) });
const signature = () => [$('key').value.trim(), $('model').value.trim()].join('\n');
const stamp = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function record(e) { log.push(e); if (log.length > 20000) { log.splice(0, 1000); dropped += 1000; } }
function emit(e) { records.set(e.start_time, e); record({ ...e, session: epoch, emitted_at_ms: clock(), event_type: 'segment' }); }
function hold(message) { video.pause(); video.muted = true; $('cover').style.display = 'grid'; $('cover').textContent = message; }
function cancel() { epoch++; controller?.abort(); busy = false; }
function setupError() { if (mode === 'demo' && customRules.some(r => r.enabled)) return 'DEMO_CUSTOM_RULES'; if (mode !== 'ai') return ''; if (!$('key').value.trim() || !$('consent').checked) return 'AI_SETUP_REQUIRED'; if (connected !== signature()) return 'CONNECTION_REQUIRED'; if ((groups().language || customRules.some(r => r.enabled && r.evidence === 'subtitles')) && !subtitles.length) return 'MISSING_SUBTITLES'; return ''; }
function reset(preserve = false) { const at = preserve ? Math.floor(video.currentTime / 2) * 2 : 0, resume = preserve && wanted; cancel(); wanted = resume; video.pause(); video.currentTime = at; records.clear(); attempts.clear(); skipped.clear(); buffering = true; failure = ''; phase = ''; $('play').disabled = false; $('restart').disabled = false; $('play').textContent = wanted ? 'Pause' : 'Play'; record({ event_type: 'session_settings', session: epoch, filters: toggles(), custom_rules: customRules, groups: groups(), sensitivity: $('sensitivity').value, threshold: thresholdFor($('sensitivity').value) }); hold('Preparing analysis…'); pump(); }
async function load(src, kind) {
  cancel(); const token = epoch; loading = true; wanted = false; video.pause(); mode = kind; records.clear(); log = []; dropped = 0; subtitles = []; $('captions').value = ''; $('captionStatus').textContent = 'No subtitles loaded. Subtitle-based language filters are off until you enable them with captions.'; if (kind === 'ai') $('strong_language').checked = false; chatUI?.refresh(); video.src = src; probe.src = src; hold('Loading video…');
  try { await Promise.all([ready(video), ready(probe)]); if (token !== epoch) return; if (!Number.isFinite(video.duration) || video.duration <= 0) throw Error('A finite, seekable local video is required.'); loading = false; reset(); }
  catch (e) { if (token === epoch) { loading = false; mode = 'none'; hold(e.message); $('status').textContent = e.message; } }
}
function ready(v) { return new Promise((resolve, reject) => { if (v.readyState >= 2) return resolve(); const done = () => { clearTimeout(timer); v.removeEventListener('loadeddata', ok); v.removeEventListener('error', bad); }; const ok = () => { done(); resolve(); }, bad = () => { done(); reject(Error('Chrome could not decode this video. Try an H.264 MP4.')); }; const timer = setTimeout(bad, 15000); v.addEventListener('loadeddata', ok); v.addEventListener('error', bad); }); }
$('demo').onclick = () => { if (url) URL.revokeObjectURL(url); url = null; $('file').value = ''; load('demo.mp4', 'demo'); };
$('file').onchange = () => { const f = $('file').files[0]; if (!f) return; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(f); load(url, 'ai'); };
$('captions').onchange = async () => { const f = $('captions').files[0], token = epoch; if (!f) return; const cues = parseVtt(await f.text()); if (token !== epoch) return; subtitles = cues; $('captionStatus').textContent = `${cues.length} cues loaded. Verify alignment and completeness, then enable the language filters you want.`; if (mode !== 'none') reset(); };
for (const c of ['violence', 'sexual_content', 'strong_language', 'sensitivity']) $(c).onchange = () => { chatUI?.refresh(); if (mode !== 'none' && !loading) reset(true); };
chatUI = initChat({
  getState: () => ({ groups: groups(), rules: customRules.map(r => ({ ...r })) }),
  getConnection: () => ({ ready: !!$('key').value.trim() && $('consent').checked && connected === signature(), key: $('key').value.trim(), model: $('model').value.trim() }),
  report: diagnose,
  applyState: state => { $('violence').checked = state.groups.violence; $('sexual_content').checked = state.groups.sexual; $('strong_language').checked = state.groups.language; customRules = state.rules.map(r => ({ ...r })); if (mode !== 'none' && !loading) reset(true); }
});
function invalidate() { batchLimit = CONTRACT.batchSegments; chatUI?.cancel(); connected = ''; testCtl?.abort(); if (!loading) cancel(); failure = ''; buffering = true; if (mode === 'ai') hold('Connection settings changed. Click Test connection.'); $('connectionStatus').textContent = 'Connection not tested.'; }
for (const id of ['key', 'model', 'consent']) $(id).onchange = invalidate;
$('test').onclick = async () => {
  if (testing) return; if (!$('key').value.trim() || !$('consent').checked) { $('connectionStatus').textContent = explain('AI_SETUP_REQUIRED'); return; }
  testing = true; $('test').disabled = true; testCtl = new AbortController(); const ctl = testCtl, original = signature(); $('connectionStatus').textContent = 'Testing Google with a tiny generated image… up to 90s per request.';
  try { const model = await testConnection($('key').value.trim(), $('model').value.trim(), ctl.signal, diagnose); if (ctl.signal.aborted || original !== signature()) return; $('model').value = model; connected = signature(); $('connectionStatus').textContent = `Connected · ${model}. Image input and JSON output verified.`; failure = ''; pump(); }
  catch (e) { if (!ctl.signal.aborted) { $('connectionStatus').textContent = explain(e.message); if (!e.diagnostic) diagnose({ stage: 'Connection test', state: 'failed', code: e.message }); } }
  finally { testing = false; $('test').disabled = false; }
};
$('restart').onclick = () => reset();
$('retry').onclick = () => { cancel(); failure = ''; buffering = true; attempts.clear(); for (const e of records.values()) if (e.start_time >= Math.floor(video.currentTime / 2) * 2 && e.start_time < video.duration && e.status !== 'classified') emit({ ...e, reason_code: 'PENDING' }); pump(); };
$('play').onclick = () => { wanted = !wanted; if (!wanted) hold('Paused'); $('play').textContent = wanted ? 'Pause' : 'Play'; pump(); };
$('volume').oninput = () => { video.volume = Number($('volume').value); }; video.volume = .7;
$('export').onclick = () => { const data = { schema_version: '3.0', contract: CONTRACT, settings: { sensitivity: $('sensitivity').value, filters: toggles(), groups: groups(), custom_rules: customRules }, mode, dropped_log_entries: dropped, events: log }; const u = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = u; a.download = 'thrnd-events.json'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); };
function pump() {
  if (mode === 'none' || loading || !Number.isFinite(video.duration)) return; const base = Math.floor(video.currentTime / 2) * 2;
  for (const e of horizon(base, video.duration, clock())) if (!records.has(e.start_time)) emit(mode === 'demo' && e.start_time < video.duration ? decide(e, fixture(e.start_time), toggles(), clock(), 'fixture', thresholdFor($('sensitivity').value)) : e);
  for (const t of records.keys()) if (t < base - 180) { records.delete(t); attempts.delete(t); }
  if (mode !== 'ai' || busy || failure || setupError()) return;
  const pending = [...records.values()].filter(e => e.start_time >= base && e.start_time < base + 180 && e.reason_code === 'PENDING').sort((a, b) => a.start_time - b.start_time).slice(0, batchLimit);
  if (pending.length < batchLimit && bufferAhead(records, video.currentTime, video.duration) >= 60 && pending.at(-1)?.end_time < video.duration) return;
  if (pending.length) analyze(pending[0].last_error !== 'API_HTTP_400' && (attempts.get(pending[0].start_time) || 0) > 0 ? pending.filter(e => (attempts.get(e.start_time) || 0) > 0).slice(0, 3) : pending);
}
async function sample(t, signal) {
  if (signal.aborted) throw Error('EXTRACTION_TIMEOUT');
  if (Math.abs(probe.currentTime - t) > .001) await new Promise((resolve, reject) => { const cleanup = () => { probe.removeEventListener('seeked', ok); signal.removeEventListener('abort', bad); }; const ok = () => { cleanup(); resolve(); }, bad = () => { cleanup(); reject(Error('EXTRACTION_TIMEOUT')); }; probe.addEventListener('seeked', ok, { once: true }); signal.addEventListener('abort', bad, { once: true }); probe.currentTime = t; });
  if (signal.aborted) throw Error('EXTRACTION_TIMEOUT'); const c = document.createElement('canvas'); c.width = 320; c.height = Math.max(1, Math.round(320 * probe.videoHeight / probe.videoWidth)); c.getContext('2d').drawImage(probe, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .65).split(',')[1];
}
function retryIncomplete(e, reason) {
  const retry = (attempts.get(e.start_time) || 0) < 3;
  emit({ ...e, status: 'unknown', decision: 'keep', reason_code: retry ? 'PENDING' : 'INCOMPLETE_DECISIONS', last_error: reason, analysis_attempts: attempts.get(e.start_time) });
  if (!retry) failure = 'INCOMPLETE_DECISIONS';
}
async function analyze(batch) {
  const token = epoch; busy = true; for (const e of batch) attempts.set(e.start_time, (attempts.get(e.start_time) || 0) + 1); controller = new AbortController(); const ctl = controller, begin = clock(); phase = `Extracting ${stamp(batch[0].start_time)}–${stamp(batch.at(-1).end_time)}`; phaseStart = clock(); const timer = setTimeout(() => ctl.abort(), CONTRACT.extractionTimeoutMs);
  try {
    const active = toggles();
    const parts = [{ text: buildPrompt(active, customRules) }];
    const addFrame = async (t, context = false) => { if (t < 0 || t >= video.duration) return; parts.push({ text: `${context ? 'Context only' : 'Target'} frame at source second ${t.toFixed(2)}` }, { inlineData: { mimeType: 'image/jpeg', data: await sample(t, ctl.signal) } }); };
    for (const offset of CONTRACT.sampleOffsets) await addFrame(batch[0].start_time - 2 + offset, true);
    for (const e of batch) {
      const caption = subtitles.length ? subtitles.filter(c => c.start < e.end_time && c.end > e.start_time).map(c => c.text).join(' ') : null;
      parts.push({ text: JSON.stringify({ start_time: e.start_time, end_time: e.end_time, subtitles: caption }) });
      for (const offset of CONTRACT.sampleOffsets) await addFrame(Math.min(e.start_time + offset, video.duration - .01));
    }
    for (const offset of CONTRACT.sampleOffsets) await addFrame(batch.at(-1).end_time + offset, true);
    clearTimeout(timer); if (ctl.signal.aborted || clock() - begin > CONTRACT.extractionTimeoutMs) throw Error('EXTRACTION_TIMEOUT');
    phase = `Waiting for Google · ${stamp(batch[0].start_time)}–${stamp(batch.at(-1).end_time)}`; phaseStart = clock();
    const model = normalizeModel($('model').value);
    diagnose(requestSummary(parts, batch));
    const body = await request(`models/${model}:generateContent`, $('key').value.trim(), analysisBody(parts), ctl.signal, diagnose, { stage: `Analyze ${stamp(batch[0].start_time)}–${stamp(batch.at(-1).end_time)}`, model });
    if (token !== epoch) return; const text = responseText(body); if (!text) { diagnose({ stage: 'Validate analysis output', state: 'failed', finish_reason: body.candidates?.[0]?.finishReason || null, block_reason: body.promptFeedback?.blockReason || null }); throw Error('EMPTY_RESPONSE'); } const unique = collectRows(text, batch);
    if (unique.size !== batch.length) diagnose({ stage: 'Validate analysis output', state: 'failed', expected_segments: batch.length, received_valid_timestamps: unique.size, provider_message: 'Keeping valid rows and retrying missing or duplicate timestamps in smaller batches.' });
    for (const e of batch) { const s = unique.get(e.start_time); const definitions = [...FILTERS, ...customRules.map(r => ({ id: r.id, captions: r.evidence === 'subtitles' }))]; const scores = s ? Object.fromEntries(definitions.map(f => [f.id, !active[f.id] || f.captions && !subtitles.length ? null : s.scores?.[f.id]])) : null; const result = decide(e, scores, toggles(), clock(), 'ai', thresholdFor($('sensitivity').value)); if (result.status !== 'classified') { retryIncomplete(e, result.reason_code); continue; } emit({ ...result, matched_rules: customRules.filter(r => r.enabled && scores?.[r.id] >= thresholdFor($('sensitivity').value)).map(r => ({ id: r.id, title: r.title })), batch_latency_ms: clock() - begin }); }
  } catch (e) { if (token !== epoch) return; if (e.message === 'API_HTTP_400' && batch.length > 1) { batchLimit = smallerBatch(batch.length); diagnose({ stage: 'Analysis compatibility recovery', state: 'retrying', next_batch_segments: batchLimit, provider_message: 'Google rejected this request. Retrying fewer target segments; no invalid scores are accepted.' }); for (const item of batch) emit({ ...item, status: 'unknown', decision: 'keep', reason_code: 'PENDING', last_error: 'API_HTTP_400' }); return; } if (e.message === 'INVALID_RESPONSE') { for (const item of batch) retryIncomplete(item, e.message); return; } failure = /^(REQUEST_TIMEOUT|EXTRACTION_TIMEOUT|API_HTTP_\d+|INVALID_RESPONSE|EMPTY_RESPONSE|NETWORK_ERROR|INVALID_JSON|CANCELLED)$/.test(e.message) ? e.message : 'ANALYSIS_FAILED'; if (!e.diagnostic) diagnose({ stage: 'Analysis', state: 'failed', code: failure }); for (const item of batch) emit({ ...item, status: 'unknown', reason_code: failure }); }
  finally { clearTimeout(timer); if (token === epoch) { busy = false; phase = ''; pump(); } }
}
function render() { const visible = horizon(video.currentTime, video.duration, clock()).map(e => records.get(e.start_time) || e); $('timeline').replaceChildren(...visible.map(e => { const cell = document.createElement('div'); cell.className = 'cell ' + (e.status === 'classified' ? e.decision : ''); cell.title = `${stamp(e.start_time)}–${stamp(e.end_time)} ${e.decision} / ${e.reason_code}`; return cell; })); $('coverage').textContent = `${visible.filter(e => e.status === 'classified').length} / 90 classified`; $('events').textContent = JSON.stringify(visible, null, 2); $('position').textContent = `${stamp(video.currentTime)} / ${stamp(video.duration || 0)}`; $('skips').textContent = `${skipped.size} skipped segments`; $('buffer').textContent = `${Math.floor(bufferAhead(records, video.currentTime, video.duration))}s`; }
function tick() {
  if (mode !== 'none' && !loading && Number.isFinite(video.duration)) {
    pump(); const time = video.currentTime, base = Math.floor(time / 2) * 2, event = records.get(base), ahead = bufferAhead(records, time, video.duration), remaining = video.duration - time, problem = setupError() || ((event?.status !== 'classified' || ahead < Math.min(CONTRACT.lowWater, remaining)) ? failure : '');
    if (ahead < Math.min(CONTRACT.lowWater, remaining) - .01) buffering = true;
    if (ahead >= Math.min(CONTRACT.startupBuffer, remaining) - .01) buffering = false;
    $('status').textContent = problem ? explain(problem) : phase ? `${phase} · ${Math.floor((clock() - phaseStart) / 1000)}s elapsed` : `${mode === 'demo' ? 'Demo fixtures · no AI' : 'AI sampled-frame mode'} · ${Math.floor(ahead)}s of source decisions ready ahead`;
    if (problem) { hold(explain(problem)); }
    else if (wanted && remaining <= .04) { wanted = false; hold('Finished'); $('play').textContent = 'Play'; }
    else if (buffering) { hold(`Building analysis buffer · ${Math.floor(ahead)} / ${Math.ceil(Math.min(30, remaining))}s ready${wanted ? ' · playback starts automatically' : ''}`); }
    else if (wanted && event?.status !== 'classified') { buffering = true; hold('Rebuffering · waiting for analysis'); }
    else if (wanted && event.decision === 'skip') {
      hold('Skipping selected content…'); let end = event.end_time; for (let t = base; t < end; t += 2) { skipped.add(t); const next = records.get(end); if (next?.status === 'classified' && next.decision === 'skip') end = next.end_time; }
      record({ event_type: 'intervention', session: epoch, start_time: base, end_time: end, decision: 'skip' }); video.currentTime = Math.min(end, video.duration); pump();
    } else if (wanted && !video.seeking) {
      const next = records.get(base + 2); if (time >= base + 1.94 && (!next || next.status !== 'classified' || next.decision === 'skip')) { hold('Segment boundary…'); video.currentTime = Math.min(base + 2, video.duration); }
      else { $('cover').style.display = 'none'; video.muted = false; if (video.paused) video.play().catch(() => { wanted = false; hold('Press Play to allow playback.'); $('play').textContent = 'Play'; }); ctx.drawImage(video, 0, 0, canvas.width, canvas.height); }
    } else if (!wanted) { hold('Ready · press Play'); }
    if (clock() - lastPaint > 250) { render(); lastPaint = clock(); }
  } requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { wanted = false; hold('Paused while this tab is hidden.'); $('play').textContent = 'Play'; } });
window.addEventListener('pagehide', () => { cancel(); testCtl?.abort(); chatUI?.cancel(); video.pause(); }); requestAnimationFrame(tick);
