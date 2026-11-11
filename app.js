
const API_BASE = 'http://127.0.0.1:8000/api/v1';
const LOGIN_PAGE = 'login.html';
const HOME_PAGE = 'index.html';
 
const KEYS = {
    access: 'filmshelf_access',
    refresh: 'filmshelf_refresh',
    user: 'filmshelf_user',
};
 
function getAccess() { return localStorage.getItem(KEYS.access); }
function getRefresh() { return localStorage.getItem(KEYS.refresh); }
 
function saveTokens({ access, refresh }) {
    if (access) localStorage.setItem(KEYS.access, access);
    if (refresh) localStorage.setItem(KEYS.refresh, refresh);
}
 
function getUser() {
    try { return JSON.parse(localStorage.getItem(KEYS.user)); } catch { return null; }
}
 
function clearSession() {
    Object.values(KEYS).forEach(key => localStorage.removeItem(key));
}
 
function decodeJwt(token) {
    try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(payload));
    } catch {
        return null;
    }
}
 
// true, якщо токен прострочений (або спливе протягом skewSeconds секунд)
function isExpired(token, skewSeconds = 0) {
    const payload = token && decodeJwt(token);
    return !payload || !payload.exp || payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}
 
// Користувач вважається авторизованим, поки діє refresh токен
function isAuthenticated() {
    const refresh = getRefresh();
    if (!refresh) return false;
    if (isExpired(refresh)) {
        clearSession();
        return false;
    }
    return true;
}
 
let refreshPromise = null;
 
// Одночасні запити діляться одним запитом на оновлення
function refreshAccess() {
    if (!refreshPromise) {
        refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
}
 
async function doRefresh() {
    const refresh = getRefresh();
    if (!refresh || isExpired(refresh)) {
        clearSession();
        return false;
    }
    try {
        const res = await fetch(`${API_BASE}/auth/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh }),
        });
        if (res.ok) {
            saveTokens(await res.json()); // сервер повертає новий access і новий refresh
            return true;
        }
        if (res.status === 400 || res.status === 401) clearSession(); // refresh недійсний
        return false;
    } catch {
        return false;
    }
}
 
async function apiFetch(path, options = {}) {
    const { requireAuth = false, ...fetchOptions } = options;
    const headers = new Headers(fetchOptions.headers || {});
    if (fetchOptions.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
 
    const send = (useToken = true) => {
        const h = new Headers(headers);
        const access = getAccess();
        if (useToken && access) h.set('Authorization', `Bearer ${access}`);
        return fetch(`${API_BASE}${path}`, { ...fetchOptions, headers: h });
    };
 
    if (getRefresh() && isExpired(getAccess(), 10)) {
        await refreshAccess();
    }
 
    let response = await send();
 
    if (response.status === 401 && getRefresh()) {
        if (await refreshAccess()) {
            response = await send();
        } else if (requireAuth) {
            redirectToLogin();
        } else {
            response = await send(false);
        }
    } else if (response.status === 401 && requireAuth) {
        redirectToLogin();
    }
    return response;
}
 
function currentPageWithQuery() {
    const page = location.pathname.split('/').pop() || HOME_PAGE;
    return page + location.search;
}
 
function redirectToLogin() {
    clearSession();
    location.replace(`${LOGIN_PAGE}?next=${encodeURIComponent(currentPageWithQuery())}`);
}
 
function requireAuth() {
    if (!isAuthenticated()) {
        redirectToLogin();
        return false;
    }
    return true;
}
 
function redirectIfAuthenticated() {
    if (isAuthenticated()) {
        location.replace(HOME_PAGE);
        return true;
    }
    return false;
}
 
function getNextUrl() {
    const next = new URLSearchParams(location.search).get('next');
    if (!next) return HOME_PAGE;
    try {
        const url = new URL(next, location.href);
        if (url.origin === location.origin && url.pathname !== location.pathname) {
            return url.pathname.split('/').pop() + url.search + url.hash;
        }
    } catch { /* ігноруємо некоректний next */ }
    return HOME_PAGE;
}
 
async function fetchCurrentUser() {
    try {
        const res = await apiFetch('/me/');
        if (res.ok) {
            const user = await res.json();
            localStorage.setItem(KEYS.user, JSON.stringify(user));
            return user;
        }
    } catch { /* ігноруємо */ }
    return null;
}
 
function logout() {
    clearSession();
    location.replace(HOME_PAGE);
}
 
 
function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value);
    });
    node.append(...children.filter(child => child != null));
    return node;
}
 
async function renderHeader() {
    const header = document.getElementById('site-header');
    if (!header) return;
 
    const page = location.pathname.split('/').pop() || HOME_PAGE;
    const link = (href, text) => el('a', { href, text, class: page === href ? 'active' : '' });
 
    const authed = isAuthenticated();
    let user = authed ? getUser() : null;
 
    const draw = () => {
        const links = el('nav', { class: 'nav-links' }, link(HOME_PAGE, 'Каталог'));
        const right = el('div', { class: 'nav-user' });
 
        if (authed) {
            links.append(link('add-movie.html', 'Додати фільм'));
            right.append(
                el('span', { class: 'username', text: `👤 ${user ? user.username : '...'}` }),
                el('button', { id: 'logoutBtn', class: 'btn btn-secondary', text: 'Вийти', onclick: logout }),
            );
        } else {
            right.append(
                el('a', { href: LOGIN_PAGE, id: 'loginBtn', class: 'btn', text: 'Увійти' }),
                el('a', { href: 'register.html', class: 'btn btn-secondary', text: 'Реєстрація' }),
            );
        }
        header.replaceChildren(el('div', { class: 'header-inner' }, el('strong', { class: 'logo', text: '🎬 FilmShelf' }), links, right));
    };
 
    draw();
 
    if (authed && !user) {
        user = await fetchCurrentUser();
        if (isAuthenticated()) draw();
    }
}
 
document.addEventListener('DOMContentLoaded', renderHeader);