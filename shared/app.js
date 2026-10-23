/* =========================================================
   APP.JS: LÓGICA COMPARTIDA (módulos 1, 2 y 3)
   Se carga DESPUÉS de Bootstrap y ANTES del JS propio de cada módulo.
   Índice:
     1. AppConfig         -> constantes comunes (sedes, claves de localStorage)
     2. AppUtils          -> esc, normalize, paginación, mensajes y validación
     3. AppSede           -> última sede vista (compartida entre módulos)
     4. Sidebar           -> expandir / colapsar menú lateral
     5. AppNotifications  -> campana de notificaciones de la navbar
   ========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     1. CONFIGURACIÓN COMÚN
     --------------------------------------------------------- */
  const AppConfig = Object.freeze({
    SEDES: ['Panamericana', 'Av. Grau'],  // sedes disponibles en toda la app
    SEDE_KEY: 'modulo1_sede_v1',          // última sede vista (misma clave que ya usaba el módulo 1)
    NOTIF_KEY: 'notificaciones',          // clave de las notificaciones (misma que ya usaba el módulo 2)
    NOTIF_MAX: 30,                        // notificaciones que se conservan
    LOCALE: 'es-PE'
  });

  /* ---------------------------------------------------------
     2. UTILIDADES
     --------------------------------------------------------- */

  // Normaliza texto: sin tildes, minúsculas y espacios simples (para comparar y buscar)
  const normalize = (s) => String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');

  // Escapa HTML: los datos del usuario o de un Excel nunca se insertan sin escapar
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // ---- Paginación (misma apariencia en los 3 módulos) ----

  // Dibuja « 1 2 3 4 5 » con una ventana de hasta 5 números alrededor de la página actual
  function renderPagination(ul, current, pages) {
    if (pages <= 1) {
      ul.innerHTML = '';
      return;
    }
    const item = (label, page, { disabled = false, active = false, aria = '' } = {}) =>
      `<li class="page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}"><a class="page-link" href="#" data-page="${page}"${aria ? ` aria-label="${aria}"` : ''}>${label}</a></li>`;

    const first = Math.max(1, Math.min(current - 2, pages - 4));
    const last = Math.min(pages, first + 4);

    const parts = [item('&laquo;', current - 1, { disabled: current === 1, aria: 'Anterior' })];
    for (let p = first; p <= last; p++) parts.push(item(p, p, { active: p === current }));
    parts.push(item('&raquo;', current + 1, { disabled: current === pages, aria: 'Siguiente' }));
    ul.innerHTML = parts.join('');
  }

  // Delegación de eventos: llama a onChange(numeroDePagina) al hacer clic en un número o flecha
  function bindPagination(ul, onChange) {
    ul.addEventListener('click', (e) => {
      e.preventDefault();
      const link = e.target.closest('[data-page]');
      if (!link || link.parentElement.classList.contains('disabled')) return;
      onChange(Number(link.dataset.page));
    });
  }

  // ---- Mensajes dentro de un modal. type: 'warn' | 'error' ----
  function showBox(box, type, text, details = []) {
    box.className = `msg-box msg-${type}`;
    box.replaceChildren();

    const p = document.createElement('p');
    p.className = 'mb-0 fw-semibold';
    p.textContent = text;
    box.append(p);

    if (details.length) {
      const ul = document.createElement('ul');
      ul.className = 'mb-0 mt-2 ps-3 small';
      details.forEach((d) => {
        const li = document.createElement('li');
        li.textContent = d;
        ul.append(li);
      });
      box.append(ul);
    }
  }

  function hideBox(box) {
    box.className = 'msg-box d-none';
    box.replaceChildren();
  }

  // ---- Validación de formularios: cada campo vive dentro de un ".field" ----
  function setInvalid(input, message) {
    input.classList.toggle('is-invalid', Boolean(message));
    const field = input.closest('.field');
    const feedback = field && field.querySelector('.invalid-feedback');
    if (feedback) {
      feedback.textContent = message || '';
      feedback.classList.toggle('d-block', Boolean(message));
    }
  }

  function clearInvalid(form) {
    form.querySelectorAll('.is-invalid').forEach((input) => setInvalid(input, ''));
  }

  // Al escribir en un campo con error, se limpia su mensaje
  function autoClearInvalid(form) {
    const clear = (e) => {
      if (e.target.classList && e.target.classList.contains('is-invalid')) setInvalid(e.target, '');
    };
    form.addEventListener('input', clear);
    form.addEventListener('change', clear);
  }

  window.AppConfig = AppConfig;
  window.AppUtils = Object.freeze({
    esc, normalize, renderPagination, bindPagination,
    showBox, hideBox, setInvalid, clearInvalid, autoClearInvalid
  });

  /* ---------------------------------------------------------
     3. SEDE ACTIVA (compartida: la elegida en un módulo se recuerda en los demás)
     --------------------------------------------------------- */
  window.AppSede = Object.freeze({
    load() {
      try {
        const saved = localStorage.getItem(AppConfig.SEDE_KEY);
        return AppConfig.SEDES.includes(saved) ? saved : AppConfig.SEDES[0];
      } catch (e) {
        return AppConfig.SEDES[0];
      }
    },
    save(name) {
      try { localStorage.setItem(AppConfig.SEDE_KEY, name); } catch (e) { /* se ignora */ }
    }
  });

  /* ---------------------------------------------------------
     4. SIDEBAR COLAPSABLE
     (La navegación entre módulos se hace con enlaces normales)
     --------------------------------------------------------- */
  function initSidebar() {
    const body = document.body;
    const toggleBtn = document.getElementById('sidebarToggle');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!toggleBtn || !backdrop) return;

    const MOBILE_QUERY = window.matchMedia('(max-width: 991.98px)');
    const STORAGE_KEY = 'sidebarCollapsed';
    const isMobile = () => MOBILE_QUERY.matches;

    // Actualiza el atributo ARIA según el estado visible del menú
    function updateAria() {
      const expanded = isMobile()
        ? body.classList.contains('sidebar-open')
        : !body.classList.contains('sidebar-collapsed');
      toggleBtn.setAttribute('aria-expanded', String(expanded));
    }

    function toggleSidebar() {
      if (isMobile()) {
        // Móvil: abre/cierra el panel superpuesto
        body.classList.toggle('sidebar-open');
      } else {
        // Escritorio: alterna entre ancho completo y solo íconos
        body.classList.toggle('sidebar-collapsed');
        try {
          localStorage.setItem(STORAGE_KEY, body.classList.contains('sidebar-collapsed'));
        } catch (e) { /* localStorage no disponible: se ignora */ }
      }
      updateAria();
    }

    function closeMobileSidebar() {
      body.classList.remove('sidebar-open');
      updateAria();
    }

    // Restaurar preferencia guardada (solo escritorio)
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') body.classList.add('sidebar-collapsed');
    } catch (e) { /* se ignora */ }
    updateAria();

    toggleBtn.addEventListener('click', toggleSidebar);
    backdrop.addEventListener('click', closeMobileSidebar);

    // Tecla Escape cierra el menú en móvil
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isMobile()) closeMobileSidebar();
    });

    // Al cambiar de móvil a escritorio, se limpia el estado superpuesto
    MOBILE_QUERY.addEventListener('change', () => {
      body.classList.remove('sidebar-open');
      updateAria();
    });
  }

  /* ---------------------------------------------------------
     5. CAMPANA DE NOTIFICACIONES
     Estructura guardada en localStorage (clave NOTIF_KEY):
       [ { id, texto, fecha (ISO), leida }, ... ]  (la más nueva primero)
     "texto" admite solo <strong>, <b> y <em>; cualquier otra etiqueta se convierte en texto.
     Quien llame a add() debe escapar con AppUtils.esc() los datos variables.
     --------------------------------------------------------- */
  const Notifications = (() => {
    const ALLOWED_TAGS = ['STRONG', 'B', 'EM'];
    let badge = null;
    let body = null;

    function load() {
      try {
        const list = JSON.parse(localStorage.getItem(AppConfig.NOTIF_KEY));
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];  // JSON dañado o almacenamiento bloqueado
      }
    }

    function save(list) {
      try {
        localStorage.setItem(AppConfig.NOTIF_KEY, JSON.stringify(list));
        return true;
      } catch (e) {
        return false;
      }
    }

    // Deja pasar solo negritas/cursivas sin atributos; el resto se convierte en texto plano
    function sanitize(html) {
      const tpl = document.createElement('template');  // contenido inerte: no ejecuta nada
      tpl.innerHTML = String(html ?? '');
      const walk = (node) => {
        [...node.childNodes].forEach((child) => {
          if (child.nodeType !== 1) return;
          if (!ALLOWED_TAGS.includes(child.tagName)) {
            child.replaceWith(document.createTextNode(child.textContent));
            return;
          }
          [...child.attributes].forEach((a) => child.removeAttribute(a.name));
          walk(child);
        });
      };
      walk(tpl.content);
      return tpl.innerHTML;
    }

    function formatDate(iso) {
      const d = new Date(iso);
      if (isNaN(d)) return '';
      return d.toLocaleString(AppConfig.LOCALE, {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    }

    function render() {
      if (!badge || !body) return;
      const list = load();
      const unread = list.filter((n) => !n.leida).length;

      // Contador visible solo si hay no leídas
      badge.hidden = unread === 0;
      badge.textContent = unread > 99 ? '99+' : String(unread);

      body.replaceChildren();

      if (list.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'notif-empty';
        empty.textContent = 'No tienes notificaciones recientes.';
        body.append(empty);
        return;
      }

      list.forEach((n) => {
        const item = document.createElement('div');
        item.className = 'notif-item' + (n.leida ? '' : ' notif-unread');

        const text = document.createElement('div');
        text.innerHTML = sanitize(n.texto);

        const time = document.createElement('span');
        time.className = 'notif-time';
        const icon = document.createElement('i');
        icon.className = 'bi bi-clock me-1';
        time.append(icon, formatDate(n.fecha));

        item.append(text, time);
        body.append(item);
      });
    }

    // Agrega una notificación al inicio (global: la puede llamar cualquier módulo)
    function add(texto) {
      const list = load();
      list.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        texto: String(texto ?? ''),
        fecha: new Date().toISOString(),
        leida: false
      });
      save(list.slice(0, AppConfig.NOTIF_MAX));
      render();
    }

    function markAllRead() {
      save(load().map((n) => ({ ...n, leida: true })));
      render();
    }

    // Datos de demostración: solo si todavía no existe ninguna clave guardada
    function seedIfEmpty(seedList) {
      try {
        if (localStorage.getItem(AppConfig.NOTIF_KEY) === null) save(seedList);
      } catch (e) { /* se ignora */ }
      render();
    }

    function init() {
      badge = document.getElementById('notifBadge');
      body = document.getElementById('notifBody');
      const markBtn = document.getElementById('notifMarkRead');
      if (!badge || !body) return;

      if (markBtn) {
        markBtn.addEventListener('click', (e) => {
          e.stopPropagation();  // el menú no se cierra al marcar como leídas
          markAllRead();
        });
      }
      // Si otra pestaña cambia las notificaciones, esta se actualiza sola
      window.addEventListener('storage', (e) => {
        if (e.key === AppConfig.NOTIF_KEY) render();
      });
      render();
    }

    return { init, render, add, markAllRead, seedIfEmpty };
  })();

  window.AppNotifications = Notifications;
  window.agregarNotificacion = Notifications.add;  // alias de compatibilidad con el código anterior

  /* ---------------------------------------------------------
     Inicio
     --------------------------------------------------------- */
  function start() {
    initSidebar();
    Notifications.init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();