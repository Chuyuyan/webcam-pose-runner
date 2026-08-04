/* Tiny i18n with graceful fallback, ported from Investment Time Machine.
   Classic script, loaded first: exposes window.T for the game module and
   accounts.js. Static HTML text is marked with data-i18n and swapped by a
   walker (original English is kept in data-en, so toggling back is exact).
   Anything missing from the dictionary simply stays English. */
(function () {
  const ZH = {
    // hero / menus
    'A runner you play with your body.': '用身体玩的跑酷游戏。',
    'Camera Mode': '体感模式',
    'Keyboard Mode': '键盘模式',
    'Use Keyboard Mode': '改用键盘模式',
    'Resume': '继续',
    'Run again': '再来一局',
    'or jump in place': '或原地跳一下',
    'or press Space': '或按空格键',
    'Swipe sideways to switch lanes': '左右滑动切换跑道',
    'Swipe up, or tap anywhere, to jump': '上滑或点击任意位置跳跃',
    'Swipe down to slide': '下滑铲地滑行',
    'Switch lanes': '切换跑道',
    'Jump': '跳跃',
    'Slide': '滑铲',
    'Pause': '暂停',
    'Mute (M)': '静音（M）',
    'Recalibrate (C)': '重新校准（C）',
    'Stand 1–2 m from your camera: step sideways to switch lanes,': '站在距摄像头 1–2 米处：左右跨步切换跑道，',
    'jump in place, crouch to slide.': '原地跳跃，下蹲滑铲。',
    'Everything runs locally in your browser — no video ever leaves your device.': '一切都在你的浏览器本地运行——视频绝不离开你的设备。',
    // overlays
    'Loading pose model…': '正在加载姿态模型……',
    'First load takes ~5–10 s': '首次加载约需 5–10 秒',
    'Camera unavailable': '摄像头不可用',
    'Line yourself up': '站好位置',
    'Jump in place to start!': '原地跳一下开始！',
    'PAUSED': '已暂停',
    'RUN COMPLETE': '本局结束',
    'DISTANCE': '距离',
    'COINS': '金币',
    'BEST': '最佳',
    'NEW BEST': '新纪录',
    'Starting camera…': '正在启动摄像头……',
    // calibration / live hints
    'Come closer': '离近一点',
    'Calibrated': '校准完成',
    'Keep your upper body in frame': '让上半身保持在画面里',
    "Can't see you — step back, upper body in frame": '看不到你——退后一点，让上半身入框',
    'Jump!': '跳！',
    'Left lane': '左道',
    'Center lane': '中道',
    'Right lane': '右道',
    'HIGH JUMP': '超级跳',
    'Step into the box in the camera preview, top left, and stand upright.': '走进左上角摄像头预览里的框内，站直。',
    'The box turns green when your framing is good — hold it for 2 seconds.': '取景合适时框会变绿——保持 2 秒。',
    'Good framing is what makes the controls precise: too far away and the pose reading gets noisy, too close and your arms leave the frame.': '取景好，操作才精准：太远姿态读数会发抖，太近手臂会出画。',
    'Tap to start': '点击开始',
    'Press any arrow key to start': '按任意方向键开始',
    'Step left / right to switch lanes · Jump in place · Crouch to slide<br>Press C anytime to recalibrate': '左右跨步切换跑道 · 原地跳跃 · 下蹲滑铲<br>随时按 C 重新校准',
    'Swipe ← → to switch lanes · swipe ↑ or tap to jump · swipe ↓ to slide': '左右滑切换跑道 · 上滑或点击跳跃 · 下滑铲地',
    '← → switch lanes · ↑ jump · ↓ slide': '← → 切换跑道 · ↑ 跳跃 · ↓ 滑铲',
    'Camera permission was denied. Allow it and refresh, or play with the keyboard.': '摄像头权限被拒。允许后刷新，或改用键盘玩。',
    'Could not load the model or camera (the model loads from a CDN — check your connection). You can still play with the keyboard.': '模型或摄像头加载失败（模型来自 CDN——检查网络）。你仍可以用键盘玩。',
    'Hold still…': '保持不动……',
    'Longest runs': '最远纪录',
    // account dialog
    'Sign in': '登录',
    'Sign out': '退出登录',
    'Save your best run': '保存你的最佳成绩',
    'Email': '邮箱',
    'Password': '密码',
    'Create account': '注册账号',
    'Send reset link': '发送重置链接',
    'Reset your password': '重置密码',
    'Forgot your password?': '忘记密码？',
    'Already have an account? ': '已有账号？',
    'New here? ': '第一次来？',
    'Back to sign in': '返回登录',
    'Create one': '注册一个',
    'Play without an account': '不用账号，直接玩',
    'Google sign-in failed. Try email instead.': 'Google 登录失败，试试邮箱登录。',
    'If that address has an account, a reset link is on its way.': '如果这个邮箱有账号，重置链接已经在路上了。',
    'Something went wrong. Try again.': '出了点问题，请再试一次。',
    'Top runs': '排行榜',
    'you': '你',
  };

  const KEY = 'pr_lang';
  let lang = (function () {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'zh' || saved === 'en') return saved;
      return (navigator.language || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
    } catch (e) { return 'en'; }
  })();

  function T(s) {
    if (lang !== 'zh' || s == null) return s;
    return ZH[s] || s;
  }

  function applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      if (!el.dataset.en) el.dataset.en = el.textContent.trim();
      el.textContent = lang === 'zh' ? (ZH[el.dataset.en] || el.dataset.en) : el.dataset.en;
    });
  }

  let globe = null;
  function refreshGlobe() {
    if (!globe) return;
    globe.querySelector('span').textContent = lang === 'zh' ? 'EN' : '中';
    globe.title = lang === 'zh' ? 'Switch to English' : '切换到中文';
    globe.setAttribute('aria-label', globe.title);
  }

  function setLang(next) {
    lang = next;
    try { localStorage.setItem(KEY, next); } catch (e) { /* private mode */ }
    applyStatic();
    refreshGlobe();
  }

  function mount() {
    const style = document.createElement('style');
    style.textContent =
      '.lang-globe{position:fixed;left:12px;bottom:12px;z-index:500;display:flex;align-items:center;gap:5px;height:40px;padding:0 12px;border-radius:20px;background:rgba(15,18,26,.92);border:1px solid rgba(255,255,255,.2);color:#e7ecf3;font:700 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 14px rgba(0,0,0,.4)}' +
      '.lang-globe:hover{border-color:rgba(255,255,255,.45)}.lang-globe svg{display:block}';
    document.head.appendChild(style);
    globe = document.createElement('button');
    globe.className = 'lang-globe';
    globe.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
      '<ellipse cx="12" cy="12" rx="4" ry="9" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
      '<path d="M3.6 9h16.8 M3.6 15h16.8" stroke="currentColor" stroke-width="1.3" fill="none"/></svg><span></span>';
    globe.addEventListener('click', function () { setLang(lang === 'zh' ? 'en' : 'zh'); });
    document.body.appendChild(globe);
    refreshGlobe();
    applyStatic();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  window.T = T;
  window.i18nLang = function () { return lang; };
})();
