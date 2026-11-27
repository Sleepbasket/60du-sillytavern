// Only ordinary Markdown paragraphs in the host chat are indented. Embedded
// HTML status panels, lists, code blocks and the saved message text stay intact.
export function initReading() {
  const chat = document.getElementById('chat');
  if (!chat) return { setEnabled() {}, setQuoteEnabled() {}, cleanup() {} };
  const doc = chat.ownerDocument;
  const selector = '#chat > .mes.mist-letter .mes_text > p';
  const wrappers = new Set();
  const groups = new Set();
  const pending = new Set();
  let enabled = false;
  let quotesEnabled = false;
  let alive = true;
  let scheduled = false;

  function prepareIndent(paragraph) {
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

  function quoteNode(node) {
    return node?.nodeType === 1 && (node.tagName === 'Q' || node.classList.contains('mist-quote-group'));
  }
  function prepareQuotes(paragraph) {
    if (!paragraph.isConnected || !paragraph.matches(selector)) return;
    for (let first = paragraph.firstChild; first; first = first.nextSibling) {
      if (!quoteNode(first)) continue;
      const run = [first];
      let cursor = first.nextSibling;
      while (cursor) {
        const gaps = [];
        while (cursor?.nodeType === 3 && !cursor.textContent.trim()) {
          gaps.push(cursor);
          cursor = cursor.nextSibling;
        }
        if (!quoteNode(cursor)) break;
        run.push(...gaps, cursor);
        cursor = cursor.nextSibling;
      }
      if (run.filter(quoteNode).length < 2) continue;
      const group = first.classList.contains('mist-quote-group') ? first : doc.createElement('span');
      if (group !== first) {
        group.className = 'mist-quote-group';
        first.before(group);
      }
      for (const node of run) {
        if (node === group) continue;
        if (node.nodeType === 1 && node.classList.contains('mist-quote-group')) {
          group.append(...node.childNodes);
          node.remove();
          groups.delete(node);
        } else group.append(node);
      }
      groups.add(group);
      first = group;
    }
  }
  function prepare(paragraph) {
    if (enabled) prepareIndent(paragraph);
    if (quotesEnabled) prepareQuotes(paragraph);
  }
  function collect(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    if (!element) return;
    const paragraph = element.closest('p');
    if (paragraph?.matches(selector)) pending.add(paragraph);
    element.querySelectorAll(selector).forEach(p => pending.add(p));
  }

  const observer = new MutationObserver(records => {
    if ((!enabled && !quotesEnabled) || !alive) return;
    for (const record of records) {
      collect(record.target);
      record.addedNodes.forEach(collect);
    }
    if (scheduled || !pending.size) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (alive && (enabled || quotesEnabled)) pending.forEach(prepare);
      pending.clear();
      // Virtualized histories can discard complete rows. Avoid retaining them.
      for (const span of wrappers) if (!span.isConnected) {
        span.replaceWith(doc.createTextNode(span.textContent));
        wrappers.delete(span);
      }
      for (const group of groups) if (!group.isConnected) {
        group.replaceWith(...group.childNodes);
        groups.delete(group);
      }
    });
  });

  function restore() {
    for (const span of wrappers) {
      const parent = span.parentNode;
      span.replaceWith(doc.createTextNode(span.textContent));
      parent?.normalize();
    }
    wrappers.clear();
  }
  function restoreQuotes() {
    for (const group of groups) {
      const parent = group.parentNode;
      group.replaceWith(...group.childNodes);
      parent?.normalize();
    }
    groups.clear();
  }
  function watch() {
    chat.querySelectorAll(selector).forEach(prepare);
    if (enabled || quotesEnabled) observer.observe(chat, { subtree: true, childList: true, characterData: true });
  }

  return {
    setEnabled(value) {
      if (!alive || enabled === value) return;
      observer.disconnect();
      pending.clear();
      enabled = value;
      if (!enabled) restore();
      watch();
    },
    setQuoteEnabled(value) {
      if (!alive || quotesEnabled === value) return;
      observer.disconnect();
      pending.clear();
      quotesEnabled = value;
      if (!quotesEnabled) restoreQuotes();
      watch();
    },
    cleanup() {
      alive = false; enabled = false; quotesEnabled = false;
      observer.disconnect(); pending.clear();
      restore(); restoreQuotes();
    }
  };
}
