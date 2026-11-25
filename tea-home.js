export function initTeaHome() {
  const doc = $('#chat')[0]?.ownerDocument || document;
  const state = {
    active: true,
    panel: null,
    list: null,
    root: null,
    title: null,
    originalTitle: '',
    groups: [],
    timer: null,
    expanded: new Set()
  };
  const teaLabels = ['今日头牌', '近日常飲', '私藏一味'];
  const pinSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6ZM12 14v7"/></svg>';
  /* ===== 01. ELEMENT HELPERS ===== */
  function make(tag, cls = '', value = '') {
    const el = doc.createElement(tag);
    el.className = cls;
    el.textContent = value;
    return el;
  }
  function button(cls, action, text = '') {
    const el = make('button', cls, text);
    el.type = 'button';
    el.dataset.teaAction = action;
    return el;
  }
  /* ===== 02. CHAT DATA ===== */
  function dateOf(row) {
    return row.querySelector('.chatDate')?.textContent?.trim() || '';
  }
  function timeOf(row) {
    const text = row.querySelector('.chatDate')?.title || dateOf(row);
    const match = text.match(/(\d{4})[\/年.-](\d{1,2})[\/月.-](\d{1,2})(?:日)?(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!match) return 0;
    return Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] || 0),
      Number(match[5] || 0)
    );
  }
  function titleOf(row) {
    return row.querySelector('.chatName span:last-child')?.textContent?.trim()
      || row.dataset.file
      || '未命名对话';
  }
  function isPinned(row) {
    const pin = row.querySelector('.pinChat');
    return Boolean(
      pin?.classList.contains('active') ||
      pin?.getAttribute('aria-pressed') === 'true' ||
      row.classList.contains('pinned') ||
      row.classList.contains('pinnedChat') ||
      row.querySelector('.recentChatPinned')
    );
  }
  function statsOf(row) {
    const count = row.querySelector('.chatStats .counterBlock small')
      ?.textContent?.trim() || '';
    const rawSize = row.querySelector('.chatStats .fileSize')
      ?.textContent?.trim() || '';
    const size = rawSize.replace(/\s*(KB|MB|GB)$/i, ' $1');
    return [
      count ? `已售 ${count} 杯` : '',
      size ? `净重 ${size}` : ''
    ].filter(Boolean).join(' · ');
  }
  function previewOf(row) {
    let raw = row.querySelector('.chatMessage')?.textContent?.trim() || '';
    if (!raw) return '暂无可读预览';
    const content = raw.match(/<content\b[^>]*>([\s\S]*?)<\/content>/i);
    if (content) {
      raw = content[1];
    } else {
      raw = raw
        .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, ' ')
        .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, ' ')
        .split(/<(?:thinking|think|zt|section|details)\b/i)[0];
    }
    raw = raw
      .replace(/:::newspaper[^\n]*/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/^\s*#{1,6}\s+.*$/gm, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();
    if (!raw || /^(?:Phase【|Step\s*\d+|去重|文风修正)/i.test(raw)) {
      return '暂无可读预览';
    }
    return raw.slice(0, 140);
  }
  /* ===== 03. CHARACTER GROUPING ===== */
  function getGroups() {
    const map = new Map();
    const rows = [...state.list.querySelectorAll(':scope > .recentChat')];
    rows.forEach((row, position) => {
      const groupId = row.dataset.group?.trim() || '';
      const avatar = row.dataset.avatar?.trim() || '';
      const name = row.querySelector('.characterName')?.textContent?.trim()
        || '未命名角色';
      const key = groupId
        ? `group:${groupId}`
        : `character:${avatar || name}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          groupId,
          avatar,
          name,
          rows: [],
          position
        });
      }
      map.get(key).rows.push(row);
    });
    const groups = [...map.values()];
    groups.forEach(group => {
      group.rows.sort((a, b) =>
        Number(isPinned(b)) - Number(isPinned(a)) ||
        timeOf(b) - timeOf(a)
      );
      group.latestTime = Math.max(0, ...group.rows.map(timeOf));
      group.pinned = group.rows.some(isPinned);
    });
    groups.sort((a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.latestTime - a.latestTime ||
      a.position - b.position
    );
    return groups;
  }
  /* ===== 04. IMAGES & PIN ===== */
  function setPhoto(img, group) {
    const fallback = group.rows[0].querySelector('.avatar img')?.src || '';
    const full = group.avatar && !group.groupId
      ? `/characters/${encodeURIComponent(group.avatar)}`
      : '';
    img.alt = group.name;
    img.loading = 'lazy';
    img.onerror = () => {
      img.onerror = null;
      if (fallback && img.src !== fallback) img.src = fallback;
      else img.removeAttribute('src');
    };
    if (full) img.src = full;
    else if (fallback) img.src = fallback;
  }
  function createPin(cls = 'mist-tea-pin') {
    const pin = make('span', cls);
    pin.title = '包含置顶的聊天';
    pin.innerHTML = pinSVG;
    return pin;
  }
  /* ===== 05. NATIVE CHAT ACTIONS ===== */
  function makeActions(row, rowIndex, primary = false) {
    const cls = primary
      ? 'mist-tea-actions mist-tea-primary-actions'
      : 'mist-tea-actions';
    const actions = make('div', cls);
    const choices = [
      ['pin', isPinned(row) ? '取消置顶' : '置顶'],
      ['rename', '重命名'],
      ['delete', '删除']
    ];
    choices.forEach(([action, label]) => {
      const item = button('mist-tea-action', action, label);
      item.dataset.rowIndex = String(rowIndex);
      actions.append(item);
    });
    return actions;
  }
  function makeMenuButton(primary = false) {
    const dots = button('mist-tea-dots', 'menu', '⋯');
    dots.dataset.menuType = primary ? 'primary' : 'history';
    dots.title = '聊天操作';
    dots.setAttribute('aria-label', '聊天操作');
    dots.setAttribute('aria-expanded', 'false');
    return dots;
  }
  function makeCount(group) {
    if (group.rows.length === 1) {
      return make('span', 'mist-tea-single-count', '1 包');
    }
    const isOpen = state.expanded.has(group.key);
    const toggle = button('mist-tea-toggle', 'toggle');
    toggle.textContent = `${group.rows.length} 包 ${isOpen ? '−' : '+'}`;
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.title = isOpen ? '收起其他聊天' : '展开其他聊天';
    return toggle;
  }
  function makeOtherCount(group) {
    if (group.rows.length === 1) {
      return make('span', 'mist-tea-single-count', '1 包');
    }
    const isOpen = state.expanded.has(group.key);
    const toggle = button('mist-tea-other-toggle', 'toggle');
    toggle.textContent = `${group.rows.length} 包 ${isOpen ? '−' : '+'}`;
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.title = isOpen ? '收起其他聊天' : '展开其他聊天';
    return toggle;
  }
  /* ===== 06. EXPANDED HISTORY ===== */
  function makeHistory(group) {
    if (group.rows.length <= 1) return null;
    const history = make('div', 'mist-tea-history');
    history.hidden = !state.expanded.has(group.key);
    // 主展示聊天已经在外层，因此这里从第二段开始
    group.rows.slice(1).forEach((row, index) => {
      const rowIndex = index + 1;
      const entry = make('div', 'mist-tea-convo-entry');
      const open = button('mist-tea-convo-open', 'open');
      open.dataset.rowIndex = String(rowIndex);
      const heading = make('span', 'mist-tea-convo-heading');
      heading.append(make('span', 'mist-tea-convo-title', titleOf(row)));
      const stats = statsOf(row);
      if (stats) {
        heading.append(make('span', 'mist-tea-convo-stats', stats));
      }
      heading.append(make('span', 'mist-tea-convo-date', dateOf(row)));
      open.append(
        heading,
        make('span', 'mist-tea-convo-preview', previewOf(row))
      );
      entry.append(
        open,
        makeMenuButton(false),
        makeActions(row, rowIndex, false)
      );
      history.append(entry);
    });
    return history;
  }
  /* ===== 07. TOP THREE TEA BAGS ===== */
  function makeTea(group, index) {
    const card = make('article', 'mist-tea-card');
    card.dataset.groupIndex = String(index);
    const paperWrap = make('div', 'mist-tea-paper-wrap');
    const paper = make('div', 'mist-tea-paper');
    const main = button('mist-tea-main', 'open');
    main.dataset.rowIndex = '0';
    const top = make('div', 'mist-tea-top');
    const labelStack = make('div', 'mist-tea-label-stack');
    const indexWrap = make('div', 'mist-tea-index-wrap');
    indexWrap.append(
      make('span', 'mist-tea-index', teaLabels[index])
    );
    if (group.pinned) indexWrap.append(createPin());
    labelStack.append(indexWrap);
    const stats = statsOf(group.rows[0]);
    if (stats) {
      const sales = make('div', 'mist-tea-sales');
      stats.split(' · ').forEach(value => {
        sales.append(make('span', '', value));
      });
      labelStack.append(sales);
    }
    const stamp = make('div', 'mist-tea-stamp');
    const img = make('img');
    setPhoto(img, group);
    stamp.append(img);
    top.append(labelStack, stamp);
    main.append(
      top,
      make('h3', 'mist-tea-name', group.name),
      make('div', 'mist-tea-chat-title', titleOf(group.rows[0])),
      make('div', 'mist-tea-preview', previewOf(group.rows[0]))
    );
    const foot = make('div', 'mist-tea-foot');
    const tools = make('div', 'mist-tea-foot-tools');
    tools.append(
      makeMenuButton(true),
      makeCount(group)
    );
    foot.append(
      make('span', '', dateOf(group.rows[0])),
      tools
    );
    paper.append(main, foot);
    paperWrap.append(
      paper,
      makeActions(group.rows[0], 0, true)
    );
    card.append(paperWrap);
    const history = makeHistory(group);
    if (history) card.append(history);
    return card;
  }
  /* ===== 08. OTHER TEA TAGS ===== */
  function makeOther(group, index) {
    const item = make('article', 'mist-tea-other-item');
    item.dataset.groupIndex = String(index);
    const head = make('div', 'mist-tea-other-head');
    const main = button('mist-tea-other-main', 'open');
    main.dataset.rowIndex = '0';
    const info = make('span', 'mist-tea-other-text');
    const name = make('span', 'mist-tea-other-name');
    name.append(
      make('span', 'mist-tea-other-name-label', group.name)
    );
    if (group.pinned) {
      name.append(createPin('mist-tea-other-pin'));
    }
    const stats = statsOf(group.rows[0]);
    if (stats) {
      name.append(make('span', 'mist-tea-other-stats', stats));
    }
    info.append(
      name,
      make(
        'span',
        'mist-tea-other-preview',
        `${titleOf(group.rows[0])} · ${previewOf(group.rows[0])}`
      )
    );
    main.append(
      make('span', 'mist-tea-other-no', String(index + 1).padStart(2, '0')),
      info,
      make('span', 'mist-tea-other-date', dateOf(group.rows[0]))
    );
    const tools = make('div', 'mist-tea-other-tools');
    tools.append(
      makeMenuButton(true),
      makeOtherCount(group)
    );
    head.append(
      main,
      tools,
      makeActions(group.rows[0], 0, true)
    );
    item.append(head);
    const history = makeHistory(group);
    if (history) item.append(history);
    return item;
  }
  /* ===== 09. RENDER ===== */
  function render() {
    if (
      !state.active ||
      !state.list?.isConnected ||
      !state.root?.isConnected
    ) return;
    state.groups = getGroups();
    const fragment = doc.createDocumentFragment();
    if (!state.groups.length) {
      fragment.append(
        make('p', 'mist-tea-empty', '今天还没有泡好的故事。')
      );
      state.root.replaceChildren(fragment);
      return;
    }
    const featured = make('div', 'mist-tea-featured');
    state.groups.slice(0, 3).forEach((group, index) => {
      featured.append(makeTea(group, index));
    });
    fragment.append(featured);
    if (state.groups.length > 3) {
      const others = make('section', 'mist-tea-others');
      others.append(
        make('h3', 'mist-tea-others-heading', '其他口味。')
      );
      state.groups.slice(3).forEach((group, index) => {
        others.append(makeOther(group, index + 3));
      });
      fragment.append(others);
    }
    state.root.replaceChildren(fragment);
  }
  /* ===== 10. MENU INTERACTIONS ===== */
  function closeMenus() {
    state.root?.querySelectorAll(
      '.mist-primary-menu-open, .mist-actions-open'
    ).forEach(host => {
      host.classList.remove(
        'mist-primary-menu-open',
        'mist-actions-open'
      );
      host.querySelectorAll('.mist-tea-dots').forEach(dots => {
        dots.setAttribute('aria-expanded', 'false');
      });
    });
  }
  function onClick(event) {
    const btn = event.target.closest?.('[data-tea-action]');
    if (!btn || !state.root?.contains(btn)) return;
    event.preventDefault();
    event.stopPropagation();
    const card = btn.closest('[data-group-index]');
    const group = state.groups[Number(card?.dataset.groupIndex)];
    if (!group) return;
    const action = btn.dataset.teaAction;
    /* 只允许多存档角色展开 */
    if (action === 'toggle') {
      if (group.rows.length <= 1) return;
      closeMenus();
      const history = card.querySelector('.mist-tea-history');
      if (!history) return;
      const next = history.hidden;
      history.hidden = !next;
      if (next) state.expanded.add(group.key);
      else state.expanded.delete(group.key);
      btn.textContent = `${group.rows.length} 包 ${next ? '−' : '+'}`;
      btn.setAttribute('aria-expanded', String(next));
      btn.title = next ? '收起其他聊天' : '展开其他聊天';
      return;
    }
    /* 外层主存档与内部其他存档使用独立菜单 */
    if (action === 'menu') {
      const primary = btn.dataset.menuType === 'primary';
      const host = primary
        ? card
        : btn.closest('.mist-tea-convo-entry');
      if (!host) return;
      const cls = primary
        ? 'mist-primary-menu-open'
        : 'mist-actions-open';
      const wasOpen = host.classList.contains(cls);
      closeMenus();
      if (!wasOpen) {
        host.classList.add(cls);
        btn.setAttribute('aria-expanded', 'true');
      }
      return;
    }
    /* 使用原生记录索引，0 始终表示外层主存档 */
    const rowIndex = Number(btn.dataset.rowIndex || 0);
    const row = group.rows[rowIndex];
    if (!row?.isConnected) return;
    if (action === 'open') {
      closeMenus();
      row.click();
      return;
    }
    const selector = {
      pin: '.pinChat',
      rename: '.renameChat',
      delete: '.deleteChat'
    }[action];
    if (!selector) return;
    const nativeButton = row.querySelector(selector);
    if (!nativeButton) {
      console.warn('[茶包首页] 未找到原生聊天操作：', action);
      return;
    }
    closeMenus();
    nativeButton.click();
  }
  function onOutsideClick(event) {
    if (!state.root?.isConnected) return;
    if (event.target.closest?.('.mist-tea-dots, .mist-tea-actions')) {
      return;
    }
    closeMenus();
  }
  function onKeydown(event) {
    if (event.key === 'Escape') closeMenus();
  }
  /* ===== 11. PAGE LIFECYCLE ===== */
  function unmount() {
    state.root?.remove();
    state.panel?.classList.remove('mist-tea-ready');
    if (
      state.title?.isConnected &&
      state.title.textContent === '今日飲茶？'
    ) {
      state.title.textContent = state.originalTitle;
    }
    state.panel = null;
    state.list = null;
    state.root = null;
    state.title = null;
    state.groups = [];
  }
  function reconcile() {
    if (!state.active) return;
    const panel = doc.querySelector('#chat .welcomePanel');
    const list = panel?.querySelector('.recentChatList');
    if (!panel || !list) {
      if (state.panel) unmount();
      return;
    }
    if (
      state.panel !== panel ||
      state.list !== list ||
      !state.root?.isConnected
    ) {
      unmount();
      state.panel = panel;
      state.list = list;
      state.title = panel.querySelector('.recentChatsTitle');
      state.originalTitle = state.title?.textContent || '最近的聊天';
      state.root = make('div', 'mist-tea-archive');
      state.root.addEventListener('click', onClick);
      list.parentNode.insertBefore(state.root, list);
      panel.classList.add('mist-tea-ready');
      if (state.title) state.title.textContent = '今日飲茶？';
    }
    render();
  }
  function schedule() {
    clearTimeout(state.timer);
    state.timer = setTimeout(reconcile, 80);
  }
  /* ===== 12. OBSERVE NATIVE LIST CHANGES ===== */
  const Observer = doc.defaultView?.MutationObserver || MutationObserver;
  const observer = new Observer(mutations => {
    if (!state.active) return;
    const relevant = mutations.some(mutation => {
      const target = mutation.target.nodeType === 1
        ? mutation.target
        : mutation.target.parentElement;
      if (
        state.root &&
        (target === state.root || state.root.contains(target))
      ) return false;
      if (mutation.type === 'attributes') {
        return Boolean(
          state.list &&
          (target === state.list || state.list.contains(target))
        );
      }
      if (
        state.list &&
        (target === state.list || state.list.contains(target))
      ) return true;
      return [...mutation.addedNodes, ...mutation.removedNodes].some(node => {
        if (node.nodeType !== 1 || node === state.root) return false;
        return node.matches?.('.welcomePanel, .recentChatList') ||
          node.querySelector?.('.welcomePanel, .recentChatList');
      });
    });
    if (relevant) schedule();
  });
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'aria-pressed']
  });
  doc.addEventListener('click', onOutsideClick, true);
  doc.addEventListener('keydown', onKeydown, true);
  /* ===== 13. CLEANUP ===== */
  const cleanup = () => {
    state.active = false;
    observer.disconnect();
    clearTimeout(state.timer);
    doc.removeEventListener('click', onOutsideClick, true);
    doc.removeEventListener('keydown', onKeydown, true);
    unmount();
  };
  reconcile();
  return cleanup;
}
