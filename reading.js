// Only ordinary Markdown paragraphs in the host chat are indented. Embedded
// HTML status panels, lists, code blocks and the saved message text stay intact.
export function initReading() {
  const chat = document.getElementById('chat');
  if (!chat) return { setEnabled() {}, cleanup() {} };
  const doc = chat.ownerDocument;
  const selector = '#chat > .mes.mist-letter .mes_text > p';
  const wrappers = new Set();
  const pending = new Set();
  let enabled = false;
  let alive = true;
  let scheduled = false;

  function prepare(paragraph) {
    if (!paragraph.isConnected || !paragraph.matches(selector) ||
        paragraph.querySelector('.mist-source-indent')) return;
    const walker = doc.createTreeWalker(paragraph, doc.defaultView.NodeFilter.SHOW_TEXT);
    const leading = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest('code, pre, textarea, svg')) break;
      const prefix = node.data.match(/^[\t\n\r\f \u00a0\u3000]+/)?.[0] || '';
      if (prefix) leading.push({ node, prefix });
      if (prefix.length !== node.data.length) break;
    }
    for (const { node: text, prefix } of leading) {
      const span = doc.createElement('span');
      span.className = 'mist-source-indent';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = prefix;
      text.before(span);
      text.deleteData(0, prefix.length);
      wrappers.add(span);
    }
  }

  function collect(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    if (!element) return;
    const paragraph = element.closest('p');
    if (paragraph?.matches(selector)) pending.add(paragraph);
    element.querySelectorAll(selector).forEach(p => pending.add(p));
  }

  const observer = new MutationObserver(records => {
    if (!enabled || !alive) return;
    for (const record of records) {
      collect(record.target);
      record.addedNodes.forEach(collect);
    }
    if (scheduled || !pending.size) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (alive && enabled) pending.forEach(prepare);
      pending.clear();
      // Virtualized histories can discard complete rows. Avoid retaining them.
      for (const span of wrappers) if (!span.isConnected) {
        span.replaceWith(doc.createTextNode(span.textContent));
        wrappers.delete(span);
      }
    });
  });

  function restore() {
    observer.disconnect();
    pending.clear();
    for (const span of wrappers) {
      const parent = span.parentNode;
      span.replaceWith(doc.createTextNode(span.textContent));
      parent?.normalize();
    }
    wrappers.clear();
  }

  return {
    setEnabled(value) {
      if (!alive || enabled === value) return;
      enabled = value;
      if (!enabled) { restore(); return; }
      chat.querySelectorAll(selector).forEach(prepare);
      observer.observe(chat, { subtree: true, childList: true, characterData: true });
    },
    cleanup() { alive = false; enabled = false; restore(); }
  };
}
