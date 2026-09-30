/**
 * Embeddable Web Live Chat widget (issue #37). Plain ES2018 so it runs on any site; rendered
 * inside a shadow root so the host page's CSS cannot break it and vice versa. All customer
 * and agent text is inserted with textContent, never innerHTML.
 */
export function renderWidgetScript(apiBase: string, widgetKey: string): string {
  const config = JSON.stringify({ apiBase, widgetKey });
  return `(function () {
  'use strict';
  var CONFIG = ${config};
  if (window.__vynorWebchat && window.__vynorWebchat[CONFIG.widgetKey]) return;
  window.__vynorWebchat = window.__vynorWebchat || {};
  window.__vynorWebchat[CONFIG.widgetKey] = true;

  var BASE = CONFIG.apiBase + '/api/v1/webchat/' + encodeURIComponent(CONFIG.widgetKey);
  var STORE_KEY = 'vynor_webchat_' + CONFIG.widgetKey;
  var state = { open: false, visitor: null, messages: [], lastSeen: null, unread: 0, settings: null, timer: null, sending: false };

  function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  function randomId() {
    var bytes = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function request(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (state.visitor) headers['X-Visitor-Token'] = state.visitor.visitorToken;
    return fetch(BASE + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (json) {
          if (!res.ok) { var err = new Error((json && json.message) || 'Request failed'); err.status = res.status; throw err; }
          return json.data !== undefined ? json.data : json;
        });
      });
  }

  var host = document.createElement('div');
  host.setAttribute('data-vynor-webchat', CONFIG.widgetKey);
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  var style = document.createElement('style');
  root.appendChild(style);

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  var launcher = el('button', 'launcher'); launcher.setAttribute('aria-label', 'Open chat');
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var icon = document.createElementNS(SVG_NS, 'svg');
  [['viewBox', '0 0 24 24'], ['width', '26'], ['height', '26'], ['fill', 'none'], ['stroke', 'currentColor'],
   ['stroke-width', '2'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true']]
    .forEach(function (a) { icon.setAttribute(a[0], a[1]); });
  var iconPath = document.createElementNS(SVG_NS, 'path');
  iconPath.setAttribute('d', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
  icon.appendChild(iconPath);
  launcher.appendChild(icon);
  var badge = el('span', 'badge'); badge.hidden = true; launcher.appendChild(badge);
  var panel = el('section', 'panel'); panel.setAttribute('role', 'dialog'); panel.hidden = true;
  var header = el('header', 'header');
  var title = el('strong', 'title', 'Chat with us');
  var close = el('button', 'close', '\\u00d7'); close.setAttribute('aria-label', 'Close chat');
  header.appendChild(title); header.appendChild(close);
  var list = el('div', 'list'); list.setAttribute('aria-live', 'polite');
  var form = el('form', 'composer');
  var nameInput = el('input', 'name'); nameInput.placeholder = 'Your name (optional)'; nameInput.maxLength = 100;
  var row = el('div', 'row');
  var input = el('textarea', 'input'); input.rows = 1; input.placeholder = 'Type a message…'; input.maxLength = 4096;
  var send = el('button', 'send', 'Send'); send.type = 'submit';
  row.appendChild(input); row.appendChild(send);
  form.appendChild(nameInput); form.appendChild(row);
  var status = el('p', 'status');
  panel.appendChild(header); panel.appendChild(list); panel.appendChild(status); panel.appendChild(form);
  root.appendChild(panel); root.appendChild(launcher);

  function applyStyle(accent) {
    style.textContent = [
      ':host{all:initial}',
      '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
      '.launcher{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;border:0;background:' + accent + ';color:#fff;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.2);z-index:2147483646;display:flex;align-items:center;justify-content:center}',
      '.badge{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;border-radius:10px;background:#e5484d;color:#fff;font-size:12px;line-height:20px;padding:0 5px}',
      '.panel{position:fixed;right:20px;bottom:88px;width:min(370px,calc(100vw - 32px));height:min(560px,calc(100vh - 120px));background:#fff;color:#1c2024;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden;z-index:2147483647}',
      '.panel[hidden]{display:none}',
      '.header{background:' + accent + ';color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}',
      '.title{font-size:15px}',
      '.close{background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1}',
      '.list{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f7f8fa}',
      '.msg{max-width:80%;padding:8px 12px;border-radius:12px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word}',
      '.msg.in{align-self:flex-end;background:' + accent + ';color:#fff;border-bottom-right-radius:4px}',
      '.msg.out{align-self:flex-start;background:#fff;border:1px solid #e3e5e8;border-bottom-left-radius:4px}',
      '.msg .who{display:block;font-size:11px;opacity:.7;margin-bottom:2px}',
      '.status{margin:0;padding:0 14px;font-size:12px;color:#e5484d;min-height:0}',
      '.composer{border-top:1px solid #e3e5e8;padding:10px;display:flex;flex-direction:column;gap:6px;background:#fff}',
      '.name{border:1px solid #e3e5e8;border-radius:8px;padding:6px 10px;font-size:13px}',
      '.row{display:flex;gap:8px;align-items:flex-end}',
      '.input{flex:1;resize:none;border:1px solid #e3e5e8;border-radius:8px;padding:8px 10px;font-size:14px;max-height:120px}',
      '.send{border:0;border-radius:8px;background:' + accent + ';color:#fff;padding:9px 14px;font-size:14px;cursor:pointer}',
      '.send:disabled{opacity:.5;cursor:default}'
    ].join('');
  }
  applyStyle('#1F93FF');

  function render() {
    list.textContent = '';
    if (state.settings && state.settings.welcomeMessage) list.appendChild(el('div', 'msg out', state.settings.welcomeMessage));
    state.messages.forEach(function (m) {
      var bubble = el('div', 'msg ' + (m.direction === 'INBOUND' ? 'in' : 'out'));
      if (m.direction === 'OUTBOUND' && m.senderName) bubble.appendChild(el('span', 'who', m.senderName));
      bubble.appendChild(document.createTextNode(m.text));
      if (m.pending) bubble.style.opacity = '0.6';
      list.appendChild(bubble);
    });
    list.scrollTop = list.scrollHeight;
    badge.hidden = state.unread === 0; badge.textContent = String(state.unread);
  }

  function ensureVisitor() {
    if (state.visitor) return Promise.resolve(state.visitor);
    var stored = load() || {};
    return request('POST', '/sessions', { visitorId: stored.visitorId, visitorToken: stored.visitorToken }).then(function (v) {
      state.visitor = v; save({ visitorId: v.visitorId, visitorToken: v.visitorToken, name: stored.name || '' });
      if (stored.name) nameInput.value = stored.name;
      return v;
    });
  }

  function poll() {
    if (!state.visitor) return Promise.resolve();
    var q = '?visitorId=' + encodeURIComponent(state.visitor.visitorId) + (state.lastSeen ? '&after=' + encodeURIComponent(state.lastSeen) : '');
    return request('GET', '/messages' + q).then(function (rows) {
      if (!rows || !rows.length) return;
      rows.forEach(function (m) {
        state.messages = state.messages.filter(function (x) { return !(x.pending && x.direction === 'INBOUND' && x.text === m.text && m.direction === 'INBOUND'); });
        if (!state.messages.some(function (x) { return x.id === m.id; })) {
          state.messages.push(m);
          if (!state.open && m.direction === 'OUTBOUND') state.unread += 1;
        }
        state.lastSeen = m.createdAt;
      });
      render();
    }).catch(function () { /* transient network error: retry on next tick */ });
  }

  function schedule() {
    clearTimeout(state.timer);
    state.timer = setTimeout(function () { poll().then(schedule); }, state.open ? 3000 : 15000);
  }

  function toggle(open) {
    state.open = open; panel.hidden = !open;
    launcher.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    if (open) { state.unread = 0; render(); ensureVisitor().then(poll).then(schedule); setTimeout(function () { input.focus(); }, 50); }
  }

  launcher.addEventListener('click', function () { toggle(!state.open); });
  close.addEventListener('click', function () { toggle(false); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); } });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || state.sending) return;
    state.sending = true; send.disabled = true; status.textContent = '';
    var name = nameInput.value.trim();
    ensureVisitor().then(function (v) {
      var stored = load() || {}; stored.name = name; save(stored);
      var clientMessageId = randomId();
      state.messages.push({ id: 'local_' + clientMessageId, direction: 'INBOUND', text: text, pending: true });
      input.value = ''; render();
      var body = { visitorId: v.visitorId, clientMessageId: clientMessageId, text: text, pageUrl: location.href.slice(0, 2000) };
      if (name) body.name = name;
      return request('POST', '/messages', body).then(function () { setTimeout(poll, 1200); });
    }).catch(function (err) {
      if (err && err.status === 401) { state.visitor = null; save({}); }
      status.textContent = (err && err.message) || 'Message not sent. Please try again.';
    }).then(function () { state.sending = false; send.disabled = false; });
  });

  request('GET', '/config').then(function (settings) {
    state.settings = settings; title.textContent = settings.name || 'Chat with us';
    applyStyle(settings.accentColor || '#1F93FF'); render();
    if (load()) { ensureVisitor().then(poll).then(schedule); }
  }).catch(function () { host.remove(); });

  function mount() { document.body.appendChild(host); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
`;
}
