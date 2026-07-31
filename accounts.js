/**
 * Optional accounts for Pose Runner, backed by playkit.
 *
 * Everything here is additive: with no playkit URL configured (or the service
 * unreachable) the game behaves exactly as it did before — best score in
 * localStorage, no network calls. Pose detection never touches this module;
 * webcam frames still never leave the device.
 *
 * Configure by setting <meta name="playkit-url" content="https://..."> in
 * index.html. Leave it empty to disable accounts entirely.
 */
import { createPlaykit, mountGoogleButton } from './playkit.js';

const GAME_ID = 'webcam-pose-runner';
const BOARD = 'distance';
const LOCAL_BEST_KEY = 'poseRunnerBest';

const baseUrl =
  document.querySelector('meta[name="playkit-url"]')?.content?.trim() || '';
const googleClientId =
  document.querySelector('meta[name="google-client-id"]')?.content?.trim() || '';

export const accountsEnabled = Boolean(baseUrl);

const pk = accountsEnabled ? createPlaykit({ baseUrl, gameId: GAME_ID }) : null;

let currentUser = null;
let onBestChange = () => {};

function localBest() {
  return +(localStorage.getItem(LOCAL_BEST_KEY) || 0);
}

function setLocalBest(v) {
  localStorage.setItem(LOCAL_BEST_KEY, String(v));
  onBestChange(v);
}

// ---------- UI ----------

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function renderBar() {
  const bar = document.getElementById('account-bar');
  if (!bar) return;
  bar.innerHTML = '';

  if (currentUser) {
    bar.appendChild(el('span', 'acct-who', currentUser.displayName));
    const out = el('button', 'acct-link', 'Sign out');
    out.onclick = async () => {
      await pk.logout();
      currentUser = null;
      renderBar();
    };
    bar.appendChild(out);
    return;
  }

  const open = el('button', 'acct-link', 'Sign in');
  open.onclick = () => renderForm();
  bar.appendChild(open);
}

function renderForm() {
  const bar = document.getElementById('account-bar');
  bar.innerHTML = '';

  const form = el('form', 'acct-form');
  const tabs = el('div', 'acct-tabs');
  const googleSlot = el('div', 'acct-google');
  let mode = 'login';

  const loginTab = el('button', 'acct-tab is-on', 'Sign in');
  const regTab = el('button', 'acct-tab', 'Create');
  for (const t of [loginTab, regTab]) t.type = 'button';
  loginTab.onclick = () => {
    mode = 'login';
    loginTab.className = 'acct-tab is-on';
    regTab.className = 'acct-tab';
  };
  regTab.onclick = () => {
    mode = 'register';
    regTab.className = 'acct-tab is-on';
    loginTab.className = 'acct-tab';
  };
  tabs.append(loginTab, regTab);

  const email = el('input', 'acct-input');
  email.type = 'email';
  email.placeholder = 'Email';
  email.required = true;
  email.autocomplete = 'email';

  const pw = el('input', 'acct-input');
  pw.type = 'password';
  pw.placeholder = 'Password';
  pw.required = true;
  pw.autocomplete = 'current-password';

  const err = el('p', 'acct-error');
  const forgot = el('button', 'acct-link', 'Forgot your password?');
  forgot.type = 'button';
  forgot.onclick = async () => {
    err.textContent = '';
    if (!email.value) { err.textContent = 'Enter your email first.'; return; }
    try {
      await pk.requestPasswordReset(email.value);
      // Same wording whichever it is — the server does not say whether the
      // address exists, and neither should this.
      err.style.color = 'var(--cyan)';
      err.textContent = 'If that address has an account, a reset link is on its way.';
    } catch (e) {
      err.textContent = e?.message || 'Could not send a reset link.';
    }
  };

  const actions = el('div', 'acct-actions');
  const submit = el('button', 'acct-submit', 'Go');
  submit.type = 'submit';
  const cancel = el('button', 'acct-link', 'Cancel');
  cancel.type = 'button';
  cancel.onclick = renderBar;
  actions.append(submit, cancel);

  form.append(tabs, googleSlot, email, pw, err, actions, forgot);

  // Google renders its own button into the slot. If it can't load, the slot
  // stays empty and email sign-in is unaffected.
  if (googleClientId) {
    mountGoogleButton(pk, {
      clientId: googleClientId,
      container: googleSlot,
      onSignedIn: async (u) => { currentUser = u; renderBar(); await syncBest(); },
      onError: () => { err.textContent = 'Google sign-in failed. Try email instead.'; },
      width: 200,
    });
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    err.textContent = '';
    submit.disabled = true;
    try {
      currentUser =
        mode === 'register'
          ? await pk.register(email.value, pw.value)
          : await pk.login(email.value, pw.value);
      renderBar();
      await syncBest();
    } catch (e2) {
      err.textContent = e2?.message || 'Sign-in failed.';
      submit.disabled = false;
    }
  };

  bar.appendChild(form);
  email.focus();
}

// ---------- Score sync ----------

/**
 * Reconciles the local best with the cloud one. Whichever is higher wins, and
 * both ends end up holding it — so signing in on a new device doesn't wipe a
 * score, and playing offline doesn't lose one.
 */
async function syncBest() {
  if (!currentUser) return;
  try {
    const saved = await pk.loadProgress();
    const cloud = saved?.data?.best ?? 0;
    const local = localBest();
    const best = Math.max(cloud, local);

    if (best > cloud) await pk.saveProgress({ best }, saved?.version);
    if (best > local) setLocalBest(best);
  } catch {
    // Offline or service down — the local best still works.
  }
}

/** Called by the game when a run ends. Safe to call when signed out. */
export async function reportScore(score) {
  if (!accountsEnabled || !currentUser) return;
  try {
    await pk.submitScore(score, { board: BOARD });
    const saved = await pk.loadProgress();
    if (score > (saved?.data?.best ?? 0)) {
      await pk.saveProgress({ best: score }, saved?.version);
    }
  } catch {
    // A lost score must never interrupt the game-over screen.
  }
}

/** Top scores, or null when unavailable. Public — works signed out. */
export async function fetchLeaderboard(limit = 5) {
  if (!accountsEnabled) return null;
  try {
    return await pk.getLeaderboard({ board: BOARD, limit });
  } catch {
    return null;
  }
}

export function leaderboardHtml(entries) {
  if (!entries || entries.length === 0) return '';
  const rows = entries
    .map(
      (e) =>
        `<div class="lb-row${
          currentUser && e.displayName === currentUser.displayName ? ' is-me' : ''
        }"><span>${e.rank}</span><span>${escapeHtml(e.displayName)}</span><span>${Math.round(
          e.score,
        )}</span></div>`,
    )
    .join('');
  return `<div class="lb"><div class="lb-title">Longest runs</div>${rows}</div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Boots accounts. `onBest` is called if the cloud has a higher best score. */
export async function initAccounts(onBest) {
  if (!accountsEnabled) return;
  onBestChange = onBest || (() => {});
  renderBar();
  try {
    currentUser = await pk.restore();
    renderBar();
    await syncBest();
  } catch {
    // Not signed in, or the service is unreachable.
  }
}
