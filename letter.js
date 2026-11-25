export function initLetter() {
  const chat = $('#chat')[0];
  if (!chat) return () => {};
  const doc = chat.ownerDocument;
  const selector = '.mes[is_system="false"]:not([type="welcome_prompt"]):not([type="assistant_message"])';
  const hanDigits = '零一二三四五六七八九';
  let active = true;
  let scheduled = false;
  /* ===== 01. 基础工具 ===== */
  function make(cls, text = '', tag = 'div') {
    const el = doc.createElement(tag);
    el.className = cls;
    el.textContent = text;
    return el;
  }
  function setText(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
  }
  /* ===== 02. 中文数字 ===== */
  function hanNum(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return String(value);
    if (n === 0) return '零';
    if (n >= 10000) return String(n);
    const units = ['', '十', '百', '千'];
    let result = '';
    let pendingZero = false;
    String(n).split('').forEach((digit, i, arr) => {
      const d = Number(digit);
      const place = arr.length - i - 1;
      if (d === 0) {
        if (result) pendingZero = true;
        return;
      }
      if (pendingZero) {
        result += '零';
        pendingZero = false;
      }
      result += hanDigits[d] + units[place];
    });
    return result.replace(/^一十/, '十');
  }
  /* ===== 03. 中文留笺日期 ===== */
  function dateToLetter(raw) {
    const match = String(raw || '').match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})/);
    if (!match) return raw || '';
    const month = hanNum(Number(match[2]));
    const day = hanNum(Number(match[3]));
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    let period = '夜';
    if (hour < 5) period = '凌晨';
    else if (hour < 9) period = '清晨';
    else if (hour < 12) period = '上午';
    else if (hour === 12) period = '正午';
    else if (hour < 18) period = '午后';
    else if (hour < 20) period = '傍晚';
    const displayHour = hour === 0 ? '零' : hanNum(hour > 12 ? hour - 12 : hour);
    const displayMinute = minute === 0 ? '整' : hanNum(minute) + '分';
    return `${month}月${day}日 · ${period}${displayHour}时${displayMinute}`;
  }
  /* ===== 04. 落款 ===== */
  function signatureOf(name) {
    const clean = String(name || '')
      .replace(/[（(][^（）()]*[）)]/g, '')
      .trim();
    const parts = clean.split(/[·・•]/).map(x => x.trim()).filter(Boolean);
    if (parts.length > 1) return parts[parts.length - 1];
    const han = [...clean].filter(char => /\p{Script=Han}/u.test(char));
    if (han.length >= 2) return han.slice(-2).join('');
    const latin = clean.split(/\s+/).filter(Boolean);
    return latin.length > 1 ? latin[latin.length - 1] : clean;
  }
  /* ===== 05. 耗时与 Token ===== */
  function durationOf(raw) {
    const match = String(raw || '').trim().match(/(\d+(?:\.\d+)?)\s*(毫秒|ms|秒|seconds?|secs?|s)/i);
    if (!match) return '';
    return `成文 ${match[1]} ${/^(ms|毫秒)$/i.test(match[2]) ? '毫秒' : '秒'}`;
  }
  function tokensOf(raw) {
    const match = String(raw || '').trim().match(/^([\d,]+(?:\.\d+)?)\s*(?:t|tokens?)?$/i);
    return match ? `${match[1]} 词元` : '';
  }
  /* ===== 06. 用户原版艺术标题 ===== */
  const art = [
    ['一', 17.3913, 52.8205, 4.4565],
    ['盏', 22.1739, 50.5128, 6.8478],
    ['百', 28.1522, 45.6410, 8.3696],
    ['味', 30.9783, 63.8462, 7.0652],
    ['，', 38.1522, 67.4359, 3.3696],
    ['不', 36.5217, 51.5385, 7.9348],
    ['独', 43.9130, 51.7949, 5.5435],
    ['取', 48.8043, 62.5641, 4.7826],
    ['甘', 41.3043, 65.8974, 6.9565],
    ['。', 53.5870, 68.2051, 2.9348],
    ['Life is like tea,', 5.9783, 68.7179, 3.2609],
    ['Sweet', 10.9783, 76.9231, 3.1522, '#9C815D'],
    ['or', 19.2391, 76.9231, 3.1522],
    ['bitter', 23.0435, 76.9231, 3.1522, '#9C815D'],
    ['in one thought.', 31.4130, 82.8205, 3.1522]
  ];
  function makeOpening() {
    const opening = make('mist-letter-opening');
    opening.setAttribute('aria-label', '一盏百味，不独取甘。');
    const title = make('mist-letter-art-title');
    title.setAttribute('aria-hidden', 'true');
    art.forEach(([letter, x, y, size, color]) => {
      const span = make('', letter, 'span');
      span.style.left = `${x}%`;
      span.style.top = `${y}%`;
      span.style.fontSize = `${size}cqw`;
      span.style.transform = 'rotate(0deg)';
      span.style.color = color ? 'var(--mist-accent, #9C815D)' : 'var(--mist-ink, #38352F)';
      title.append(span);
    });
    opening.append(title);
    return opening;
  }
  /* ===== 07. 移动原生翻页按钮 ===== */
  function moveSwipeControls(mes, block) {
    const buttons = block.querySelector('.ch_name .mes_buttons');
    if (!buttons) return;
    let group = buttons.querySelector(':scope > .mist-letter-swipes');
    if (!group) {
      group = make('mist-letter-swipes');
      buttons.prepend(group);
    }
    const left = mes.querySelector(':scope > .swipe_left');
    const right = mes.querySelector(':scope > .swipeRightBlock');
    if (left) group.append(left);
    if (right) group.append(right);
  }
  /* ===== 08. 信首、落款 ===== */
  function updateLetter(mes) {
    if (!mes?.matches(selector)) return;
    const block = mes.querySelector(':scope > .mes_block');
    if (!block) return;
    let head = block.querySelector(':scope > .mist-letter-head');
    if (!head) {
      head = make('mist-letter-head');
      head.append(
        make('mist-letter-index'),
        make('mist-letter-head-details')
      );
      const details = head.querySelector('.mist-letter-head-details');
      details.append(
        make('mist-letter-date'),
        make('mist-letter-record')
      );
      block.prepend(head);
    }
    const index = head.querySelector('.mist-letter-index');
    const date = head.querySelector('.mist-letter-date');
    const record = head.querySelector('.mist-letter-record');
    const number = Number(mes.getAttribute('mesid'));
    if (Number.isInteger(number) && number >= 0) {
      setText(index, `第${hanNum(number + 1)}笺`);
    }
    const stamp = block.querySelector('.ch_name .timestamp')?.textContent?.trim()
      || mes.getAttribute('timestamp') || '';
    setText(date, dateToLetter(stamp));
    date.title = stamp;
    const avatar = mes.querySelector(':scope > .mesAvatarWrapper');
    const timer = durationOf(avatar?.querySelector('.mes_timer')?.textContent);
    const tokens = tokensOf(avatar?.querySelector('.tokenCounterDisplay')?.textContent);
    const pieces = [timer, tokens].filter(Boolean);
    const recordValue = pieces.join('|');
    if (record.dataset.value !== recordValue) {
      record.dataset.value = recordValue;
      record.replaceChildren(...pieces.map(value => make('', value, 'span')));
    }
    let sign = block.querySelector(':scope > .mist-letter-sign');
    if (!sign) {
      sign = make('mist-letter-sign');
      sign.append(make('mist-letter-sign-name', '', 'span'));
      block.append(sign);
    }
    const name = block.querySelector('.ch_name .name_text')?.textContent?.trim()
      || mes.getAttribute('ch_name') || '';
    setText(sign.querySelector('.mist-letter-sign-name'), signatureOf(name));
    moveSwipeControls(mes, block);
    mes.classList.add('mist-letter');
  }
  /* ===== 09. 同一本册子的连续排列 ===== */
function sync() {
  if (!active) return;
  const messages = [...chat.children].filter(el => el.matches?.(selector));
  const currentOpening = chat.querySelector(':scope > .mist-letter-opening');
  if (!messages.length) {
    currentOpening?.remove();
    return;
  }
  // 只允许真实的第 0 楼拥有开篇题签
  const firstRealMessage = messages.find(mes => mes.getAttribute('mesid') === '0');
  if (firstRealMessage) {
    const opening = currentOpening || makeOpening();
    if (opening.nextElementSibling !== firstRealMessage) {
      chat.insertBefore(opening, firstRealMessage);
    }
  } else {
    currentOpening?.remove();
  }
  // 仅处理当前真正存在的 DOM 节点
  messages.forEach((mes, index) => {
    updateLetter(mes);
    mes.classList.toggle('mist-letter-last', index === messages.length - 1);
  });
}
  function scheduleSync() {
    if (!active || scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (active) sync();
    });
  }
  /* ===== 10. 监听聊天与原生数据 ===== */
  const observer = new MutationObserver(records => {
    let needsSync = false;
    for (const record of records) {
      const el = record.target.nodeType === 1
        ? record.target
        : record.target.parentElement;
      if (!el) continue;
      if (el.closest('.mist-letter-opening, .mist-letter-head, .mist-letter-sign')) continue;
      if (el.closest('.mes_text, .mes_reasoning_details, .extraMesButtons, .mist-letter-swipes')) continue;
      if (el === chat) {
        needsSync = true;
        break;
      }
      if (el.closest('.mes_timer, .tokenCounterDisplay, .timestamp, .name_text')) {
        needsSync = true;
        break;
      }
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.(selector) || node.querySelector?.(selector)) {
          needsSync = true;
          break;
        }
      }
      if (needsSync) break;
    }
    if (needsSync) scheduleSync();
  });
  observer.observe(chat, {
    childList: true,
    subtree: true,
    characterData: true
  });
  /* ===== 11. 清理与恢复原生结构 ===== */
  const cleanup = () => {
    active = false;
    observer.disconnect();
    chat.querySelectorAll('.mes.mist-letter').forEach(mes => {
      const group = mes.querySelector('.mist-letter-swipes');
      const block = mes.querySelector(':scope > .mes_block');
      if (group && block) {
        const left = group.querySelector('.swipe_left');
        const right = group.querySelector('.swipeRightBlock');
        if (left) mes.insertBefore(left, block);
        if (right) mes.append(right);
        group.remove();
      }
      mes.classList.remove('mist-letter', 'mist-letter-last');
    });
    chat.querySelectorAll('.mist-letter-opening, .mist-letter-head, .mist-letter-sign')
      .forEach(el => el.remove());
  };
  sync();
  return cleanup;
}
