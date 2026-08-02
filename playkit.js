// Vendored from the playkit SDK — do not edit here.
// Source: playkit/sdk/src/index.ts
// Re-sync with: npm run vendor  (in playkit/sdk)
// src/index.ts
var PlaykitError = class extends Error {
  status;
  code;
  constructor(message, status, code) {
    super(message);
    this.name = "PlaykitError";
    this.status = status;
    this.code = code;
  }
};
var SaveConflictError = class extends PlaykitError {
  currentVersion;
  constructor(message, currentVersion) {
    super(message, 409, "version_conflict");
    this.name = "SaveConflictError";
    this.currentVersion = currentVersion;
  }
};
function createPlaykit(options) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const { gameId } = options;
  const hintKey = `playkit_seen:${baseUrl}`;
  function setSessionHint(on) {
    try {
      if (on) localStorage.setItem(hintKey, "1");
      else localStorage.removeItem(hintKey);
    } catch {
    }
  }
  function hasSessionHint() {
    try {
      return localStorage.getItem(hintKey) === "1";
    } catch {
      return true;
    }
  }
  let accessToken = null;
  let currentUser = null;
  let refreshInFlight = null;
  function setUser(user) {
    currentUser = user;
    options.onAuthChange?.(user);
  }
  async function parse(res) {
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    if (res.ok) return body;
    if (res.status === 409 && body.error === "version_conflict") {
      throw new SaveConflictError(body.message ?? "Save conflict", body.currentVersion ?? 0);
    }
    throw new PlaykitError(
      body.message ?? `Request failed (${res.status})`,
      res.status,
      body.error ?? "unknown"
    );
  }
  function request(path, init = {}, withAuth = false) {
    const headers = new Headers(init.headers);
    if (init.body) headers.set("content-type", "application/json");
    if (withAuth && accessToken) headers.set("authorization", `Bearer ${accessToken}`);
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      // Required so the refresh cookie travels cross-origin.
      credentials: "include"
    });
  }
  function refresh() {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        try {
          const res = await request("/auth/refresh", { method: "POST" });
          if (!res.ok) {
            accessToken = null;
            setUser(null);
            setSessionHint(false);
            return false;
          }
          const body = await res.json();
          accessToken = body.accessToken;
          setUser(body.user);
          setSessionHint(true);
          return true;
        } catch {
          return false;
        } finally {
          refreshInFlight = null;
        }
      })();
    }
    return refreshInFlight;
  }
  async function authed(path, init = {}) {
    if (!accessToken) {
      const ok = await refresh();
      if (!ok) throw new PlaykitError("Sign in to continue.", 401, "unauthorized");
    }
    let res = await request(path, init, true);
    if (res.status === 401) {
      const ok = await refresh();
      if (!ok) throw new PlaykitError("Your session expired. Sign in again.", 401, "unauthorized");
      res = await request(path, init, true);
    }
    return parse(res);
  }
  async function adoptSession(res) {
    const body = await parse(res);
    accessToken = body.accessToken;
    setUser(body.user);
    setSessionHint(true);
    return body.user;
  }
  return {
    get user() {
      return currentUser;
    },
    get isSignedIn() {
      return currentUser !== null;
    },
    /**
     * Call once on load. Silently resumes a session from a previous visit
     * (using the refresh cookie) and returns the user, or null if not signed in.
     *
     * Costs nothing for a player who has never signed in on this browser: it
     * returns without touching the network at all.
     */
    async restore() {
      if (!hasSessionHint()) return null;
      await refresh();
      return currentUser;
    },
    async register(email, password, displayName) {
      return adoptSession(
        await request("/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password, displayName })
        })
      );
    },
    async login(email, password) {
      return adoptSession(
        await request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
      );
    },
    /** Completes Google sign-in with the ID token from Google Identity Services. */
    async loginWithGoogle(idToken) {
      return adoptSession(
        await request("/auth/google", { method: "POST", body: JSON.stringify({ idToken }) })
      );
    },
    /**
     * Asks for a reset link. Resolves the same way whether or not the address
     * has an account — the server deliberately doesn't say, so the UI can't
     * either. Rejects only on a malformed address or rate limiting.
     */
    async requestPasswordReset(email) {
      await parse(
        await request("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email })
        })
      );
    },
    async logout() {
      try {
        await request("/auth/logout", { method: "POST" });
      } finally {
        accessToken = null;
        setUser(null);
        setSessionHint(false);
      }
    },
    async setDisplayName(displayName) {
      const body = await authed("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ displayName })
      });
      setUser(body.user);
      return body.user;
    },
    /** Returns null when this player has no cloud save yet. */
    async loadProgress() {
      const body = await authed(`/games/${gameId}/save`);
      return body.save ?? null;
    },
    /**
     * Writes the player's save. Pass `version` from the last load to get
     * conflict detection — a SaveConflictError means another device saved first.
     */
    async saveProgress(data, version) {
      const body = await authed(`/games/${gameId}/save`, {
        method: "PUT",
        body: JSON.stringify({ data, version })
      });
      return body.save;
    },
    async clearProgress() {
      await authed(`/games/${gameId}/save`, { method: "DELETE" });
    },
    async submitScore(score, opts = {}) {
      await authed(`/games/${gameId}/scores`, {
        method: "POST",
        body: JSON.stringify({ score, board: opts.board, meta: opts.meta })
      });
    },
    /** Public — works whether or not anyone is signed in. */
    async getLeaderboard(opts = {}) {
      const params = new URLSearchParams();
      if (opts.board) params.set("board", opts.board);
      if (opts.limit) params.set("limit", String(opts.limit));
      const query = params.toString();
      const res = await request(`/games/${gameId}/leaderboard${query ? `?${query}` : ""}`);
      const body = await parse(res);
      return body.entries;
    },
    async getMyRank(board) {
      const query = board ? `?board=${encodeURIComponent(board)}` : "";
      return authed(`/games/${gameId}/my-rank${query}`);
    }
  };
}
var GSI_SRC = "https://accounts.google.com/gsi/client";
var gsiPromise = null;
function loadGoogleIdentity() {
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      if (window.google?.accounts?.id) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google script failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google script failed to load"));
    document.head.appendChild(s);
  });
  return gsiPromise;
}
async function mountGoogleButton(pk, opts) {
  if (!opts.clientId) return false;
  try {
    await loadGoogleIdentity();
  } catch {
    return false;
  }
  const google = window.google;
  if (!google?.accounts?.id) return false;
  google.accounts.id.initialize({
    client_id: opts.clientId,
    callback: async (response) => {
      if (!response?.credential) return;
      try {
        opts.onSignedIn(await pk.loginWithGoogle(response.credential));
      } catch (err) {
        opts.onError?.(err);
      }
    }
  });
  google.accounts.id.renderButton(opts.container, {
    type: "standard",
    theme: opts.theme ?? "filled_black",
    size: opts.size ?? "large",
    text: "continue_with",
    shape: "rectangular",
    width: opts.width ?? 220
  });
  return true;
}
export {
  PlaykitError,
  SaveConflictError,
  createPlaykit,
  mountGoogleButton
};
//# sourceMappingURL=playkit.js.map
