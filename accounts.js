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
  open.onclick = () => openDialog();
  bar.appendChild(open);
}

const DISMISS_KEY = 'poseRunnerAccountPromptDismissed';
const wasDismissed = () => {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return true; }
};
const rememberDismissed = () => {
  try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode */ }
};

/**
 * The sign-in dialog.
 *
 * An offer, never a gate: it always carries "play without an account" and does
 * not come back once dismissed. Shown once to first-time players, because a
 * link in the corner of the screen went unnoticed.
 */
function openDialog() {
  // One at a time: the bar's button stays clickable behind the backdrop, and
  // stacking dialogs leaves an orphan behind whichever one is dismissed.
  if (document.querySelector('.acct-backdrop')) return;

  let mode = 'register';   // most first-timers need an account

  const backdrop = el('div', 'acct-backdrop');
  const dialog = el('div', 'acct-dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');

  const title = el('h2', 'acct-title', 'Save your best run');
  const sub = el('p', 'acct-sub',
    'An account keeps your best score and puts you on the board. Entirely optional.');
  const googleSlot = el('div', 'acct-google');
  const orRow = el('div', 'acct-or');
  orRow.appendChild(el('span', null, 'or'));
  orRow.style.display = 'none';

  const form = el('form', 'acct-form');
  const email = el('input', 'acct-input');
  email.type = 'email'; email.placeholder = 'Email'; email.required = true; email.autocomplete = 'email';
  const pw = el('input', 'acct-input');
  pw.type = 'password'; pw.placeholder = 'Password'; pw.required = true;
  const err = el('p', 'acct-error');
  const notice = el('p', 'acct-notice');
  const primary = el('button', 'acct-primary', 'Create account');
  primary.type = 'submit';
  form.append(email, pw, err, notice, primary);

  const forgotRow = el('p', 'acct-switch');
  const forgotLink = el('button', 'acct-link', 'Forgot your password?');
  forgotLink.type = 'button';
  forgotRow.appendChild(forgotLink);
  forgotRow.style.display = 'none';

  const switchRow = el('p', 'acct-switch');
  const switchText = el('span', null, 'Already have an account? ');
  const switchLink = el('button', 'acct-link', 'Sign in');
  switchLink.type = 'button';
  switchRow.append(switchText, switchLink);

  const skip = el('button', 'acct-skip', 'Play without an account');
  skip.type = 'button';

  const close = () => { rememberDismissed(); backdrop.remove(); renderBar(); };

  function render() {
    err.textContent = '';
    notice.textContent = '';
    primary.disabled = false;
    const forgot = mode === 'forgot';
    title.textContent = forgot ? 'Reset your password' : 'Save your best run';
    sub.textContent = forgot
      ? "Enter the email you signed up with and we'll send a link to set a new password."
      : 'An account keeps your best score and puts you on the board. Entirely optional.';
    pw.style.display = forgot ? 'none' : '';
    pw.required = !forgot;
    pw.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    googleSlot.style.display = forgot ? 'none' : '';
    orRow.style.display = forgot || !googleSlot.hasChildNodes() ? 'none' : '';
    primary.textContent = forgot ? 'Send reset link' : mode === 'register' ? 'Create account' : 'Sign in';
    forgotRow.style.display = mode === 'login' ? '' : 'none';
    switchText.textContent =
      mode === 'register' ? 'Already have an account? ' : mode === 'login' ? 'New here? ' : '';
    switchLink.textContent =
      mode === 'register' ? 'Sign in' : mode === 'forgot' ? 'Back to sign in' : 'Create one';
    email.focus();
  }

  switchLink.onclick = () => {
    mode = mode === 'register' ? 'login' : mode === 'forgot' ? 'login' : 'register';
    render();
  };
  forgotLink.onclick = () => { mode = 'forgot'; render(); };
  skip.onclick = close;

  form.onsubmit = async (e) => {
    e.preventDefault();
    err.textContent = '';
    notice.textContent = '';
    primary.disabled = true;
    try {
      if (mode === 'forgot') {
        await pk.requestPasswordReset(email.value);
        // Same wording whichever it is — the server does not say whether the
        // address exists, and neither should this.
        notice.textContent = 'If that address has an account, a reset link is on its way.';
        return;
      }
      currentUser =
        mode === 'register'
          ? await pk.register(email.value, pw.value)
          : await pk.login(email.value, pw.value);
      rememberDismissed();
      backdrop.remove();
      renderBar();
      await syncBest();
    } catch (e2) {
      err.textContent = e2?.message || 'Something went wrong. Try again.';
      primary.disabled = false;
    }
  };

  dialog.append(title, sub, googleSlot, orRow, form, forgotRow, switchRow, skip);
  backdrop.appendChild(dialog);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  document.body.appendChild(backdrop);

  if (googleClientId) {
    mountGoogleButton(pk, {
      clientId: googleClientId,
      container: googleSlot,
      onSignedIn: async (u) => {
        currentUser = u;
        rememberDismissed();
        backdrop.remove();
        renderBar();
        await syncBest();
      },
      onError: () => { err.textContent = 'Google sign-in failed. Try email instead.'; },
      width: 260,
    }).then(() => render());
  }

  render();
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
    if (currentUser) await syncBest();
    // First-time players get the offer once; everyone else is left alone.
    else if (!wasDismissed()) openDialog();
  } catch {
    // Not signed in, or the service is unreachable.
  }
}
