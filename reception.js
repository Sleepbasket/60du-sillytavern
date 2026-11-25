export function initReception() {
  const doc = $('#chat')[0]?.ownerDocument || document;
  const LOGO_URL = 'https://s1.tcxz.top/autoupload/8912c/20261114/ZBMZ/780X636/tea_assistant_logo_no_outer_leaf.png/webp';
  let active = true;
  let source = null;
  let reception = null;
  let timer = null;
  const Observer = doc.defaultView?.MutationObserver || MutationObserver;
  /* ===== THEME CHECK ===== */
  function themeEnabled() {
    return doc.body?.classList.contains('mist-ui-ready');
  }
  /* ===== FIND NATIVE ASSISTANT ===== */
  function findWelcomeAssistant() {
    const welcome = doc.querySelector('#chat .welcomePanel.mist-tea-ready');
    if (!welcome) return null;
    const messages = doc.querySelectorAll(
      '#chat .mes[type="assistant_message"][ch_name="Assistant"][mesid="0"]'
    );
    return [...messages].find(message => {
      const content = message.querySelector('.mes_text')?.textContent || '';
      return content.includes('如果您已连接到一个 API');
    }) || null;
  }
  /* ===== CREATE RECEPTION ===== */
  function createReception() {
    const root = doc.createElement('section');
    root.className = 'mist-tea-reception';
    root.setAttribute('aria-label', '茶小二欢迎台');
    root.innerHTML = `
      <div class="mist-reception-header">
        <div class="mist-reception-logo">
          <img alt="茶小二">
        </div>
        <div class="mist-reception-copy">
          <span class="mist-reception-eyebrow">YOUR LITTLE TEA ASSISTANT</span>
          <h2 class="mist-reception-title">Hi，茶小二在此。</h2>
          <p class="mist-reception-description">如果您已连接到一个 API，试着问我点什么吧！</p>
        </div>
      </div>
      <div class="mist-reception-bottom">
        <div class="mist-reception-note">
          <span class="mist-reception-note-label">Tips</span>
          <span class="mist-reception-note-text">
            可以通过角色设置中的「更多…」菜单，将喜欢的角色设为欢迎页面的助手。
          </span>
        </div>
      </div>`;
    root.querySelector('.mist-reception-logo img').src = LOGO_URL;
    return root;
  }
  /* ===== REMOVE RECEPTION ===== */
  function unmount() {
    reception?.remove();
    source?.classList.remove('mist-tea-assistant-source');
    reception = null;
    source = null;
  }
  /* ===== SYNC WITH WELCOME PAGE ===== */
  function reconcile() {
    if (!active) return;
    if (!themeEnabled()) {
      if (source || reception) unmount();
      return;
    }
    const next = findWelcomeAssistant();
    if (!next) {
      if (source || reception) unmount();
      return;
    }
    if (source === next && reception?.isConnected) return;
    unmount();
    source = next;
    reception = createReception();
    source.classList.add('mist-tea-assistant-source');
    source.insertAdjacentElement('afterend', reception);
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(reconcile, 80);
  }
  /* ===== WATCH PAGE CHANGES ===== */
  const pageObserver = new Observer(mutations => {
    if (!active) return;
    const relevant = mutations.some(mutation => {
      const target = mutation.target;
      if (reception && (target === reception || reception.contains(target))) {
        return false;
      }
      if (target.nodeType === 1 && target.closest?.('#chat .welcomePanel')) {
        return true;
      }
      return [...mutation.addedNodes, ...mutation.removedNodes].some(node => {
        if (node.nodeType !== 1 || node === reception) return false;
        return node.matches?.('#chat, .welcomePanel, .mes') ||
          node.querySelector?.('#chat, .welcomePanel, .mes');
      });
    });
    if (relevant) schedule();
  });
  pageObserver.observe(doc.body, {
    childList: true,
    subtree: true
  });
  /* ===== WATCH CSS THEME CHANGES ===== */
  const themeObserver = new Observer(schedule);
  if (doc.head) {
    themeObserver.observe(doc.head, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  /* ===== CLEANUP ===== */
  const cleanup = () => {
    active = false;
    pageObserver.disconnect();
    themeObserver.disconnect();
    clearTimeout(timer);
    unmount();
  };
  reconcile();
  return cleanup;
}
