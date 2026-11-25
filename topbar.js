export function initTopbar(getCharacter, onCharacter) {
  const $bar = $('#top-settings-holder');
  if (!$bar.length) return () => {};
  const bar = $bar[0];
  const $body = $('body');
  if (bar.__mistInstance) bar.__mistInstance.active = false;
  const state = { active: true, busy: false, requestId: 0 };
  bar.__mistInstance = state;
  $('#mist-pacman, #mist-reveal').remove();
  $bar.find('.mist-line-icon').remove();
  $bar.removeClass('mist-collapsed mist-eating mist-opening');
  $body.removeClass('mist-collapsed mist-character-open');
  const paths = {
    'ai-config-button': '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="11" cy="17" r="2"/>',
    'sys-settings-button': '<path d="M9 8V3M15 8V3M7 8h10v4a5 5 0 0 1-10 0V8ZM12 17v4"/>',
    'advanced-formatting-button': '<path d="M4 7V4h16v3M12 4v16M8 20h8"/>',
    'WI-SP-button': '<path d="M12 7v14M3 5c3-1 7-1 9 2 2-3 6-3 9-2v14c-3-1-7-1-9 2-2-3-6-3-9-2V5Z"/>',
    'user-settings-button': '<circle cx="12" cy="12" r="3"/><path d="M10 2h4l1 3 3 1 3-1 2 4-2 2v3l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-3L1 9l2-4 3 1 3-1 1-3Z"/>',
    'backgrounds-button': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',
    'extensions-settings-button': '<path d="M20 12v7a2 2 0 0 1-2 2h-5v-3a2 2 0 0 0-4 0v3H6a2 2 0 0 1-2-2v-5h3a2 2 0 0 0 0-4H4V6a2 2 0 0 1 2-2h5v3a2 2 0 0 0 4 0V4h3a2 2 0 0 1 2 2v4h-3a2 2 0 0 0 0 4h3Z"/>',
    'persona-management-button': '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    'rightNavHolder': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M5 17c0-3 8-3 8 0M15 8h4M15 12h4M15 16h4"/>'
  };
  Object.entries(paths).forEach(([id, path]) => {
    const icon = $bar.find(`#${id} > .drawer-toggle .drawer-icon`)[0];
    if (!icon) return;
    const svg = `<svg class="mist-line-icon" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
    icon.insertAdjacentHTML('beforeend', svg);
  });
  const $pac = $('<button>', {
    id: 'mist-pacman',
    type: 'button',
    title: '收起工具栏',
    'aria-label': '收起工具栏'
  });
  const $reveal = $('<button>', {
    id: 'mist-reveal',
    type: 'button',
    title: '展开工具栏',
    'aria-label': '展开工具栏'
  });
  const $photo = $('<img>', {
    class: 'mist-photo',
    alt: ''
  });
  const $title = $('<span>', {
    class: 'mist-title',
    text: '工具们。'
  });
  $reveal.append($photo, $title);
  $bar.append($pac, $reveal);
  $body.addClass('mist-ui-ready');
  const drawers = [...bar.querySelectorAll(':scope > .drawer')];
  drawers.forEach((drawer, index) => {
    drawer.style.setProperty('--mist-delay', `${(drawers.length - index - 1) * 45}ms`);
    drawer.style.setProperty('--mist-open-delay', `${index * 18}ms`);
  });
  async function updateCharacter() {
    if (!state.active) return;
    const request = ++state.requestId;
    const character = getCharacter();
    const name = character?.name || null;
    onCharacter?.(character);
    const hasCharacter = Boolean(name);
    $reveal.toggleClass('mist-character', hasCharacter);
    $body.toggleClass('mist-character-open', hasCharacter);
    $title.text(name || '工具们。');
    $photo.removeAttr('src');
    if (!hasCharacter) return;
    try {
      const avatar = character?.avatarUrl;
      if (!state.active || request !== state.requestId) return;
      if (avatar) $photo.attr('src', avatar);
    } catch (error) {
      console.warn('[慢焙手帖] 角色图片读取失败:', error);
    }
  }
  $photo.on('error.mist', () => $photo.removeAttr('src'));
  $pac.on('click.mist', () => {
    if (!state.active || state.busy) return;
    state.busy = true;
    updateCharacter();
    const first = drawers[0]?.getBoundingClientRect();
    const pac = $pac[0].getBoundingClientRect();
    const distance = first ? Math.max(0, pac.left - first.left) : 0;
    $pac.css('--mist-travel', `${distance}px`);
    $bar.addClass('mist-eating');
    const finish = () => {
      if (!state.active) return;
      $bar.removeClass('mist-eating').addClass('mist-collapsed');
      $body.addClass('mist-collapsed');
      state.busy = false;
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
    } else {
      setTimeout(finish, 580);
    }
  });
  $reveal.on('click.mist', () => {
    if (!state.active || state.busy) return;
    $bar.removeClass('mist-collapsed').addClass('mist-opening');
    $body.removeClass('mist-collapsed');
    setTimeout(() => {
      if (state.active) $bar.removeClass('mist-opening');
    }, 420);
  });
  const { eventSource, event_types, eventTypes } = SillyTavern.getContext();
  const chatChanged = (event_types || eventTypes)?.CHAT_CHANGED;
  if (eventSource && chatChanged) eventSource.on(chatChanged, updateCharacter);
  const cleanup = () => {
    state.active = false;
    $pac.off('.mist');
    $reveal.off('.mist');
    $photo.off('.mist');
    $('#mist-pacman, #mist-reveal').remove();
    $bar.find('.mist-line-icon').remove();
    $bar.removeClass('mist-collapsed mist-eating mist-opening');
    $body.removeClass('mist-ui-ready mist-collapsed mist-character-open');
    drawers.forEach(drawer => { drawer.style.removeProperty('--mist-delay'); drawer.style.removeProperty('--mist-open-delay'); });
    if (eventSource && chatChanged) eventSource.removeListener?.(chatChanged, updateCharacter);
    if (bar.__mistInstance === state) delete bar.__mistInstance;
  };
  updateCharacter();
  return cleanup;
}
