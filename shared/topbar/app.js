/* =========================================================
   LÓGICA JAVASCRIPT: sidebar colapsable y navegación
   ========================================================= */
(function () {
  'use strict';

  // ---------- Referencias al DOM ----------
  const body      = document.body;
  const toggleBtn = document.getElementById('sidebarToggle');
  const backdrop  = document.getElementById('sidebarBackdrop');
  const navItems  = document.querySelectorAll('.nav-item');
  const pageTitle = document.getElementById('pageTitle');

  const MOBILE_QUERY = window.matchMedia('(max-width: 991.98px)');
  const STORAGE_KEY  = 'sidebarCollapsed';

  // ---------- Utilidades ----------
  const isMobile = () => MOBILE_QUERY.matches;

  // Actualiza el atributo ARIA según el estado visible del menú
  function updateAria() {
    const expanded = isMobile()
      ? body.classList.contains('sidebar-open')
      : !body.classList.contains('sidebar-collapsed');
    toggleBtn.setAttribute('aria-expanded', String(expanded));
  }

  // ---------- Expandir / colapsar ----------
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

  // ---------- Restaurar preferencia guardada (solo escritorio) ----------
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'true') {
      body.classList.add('sidebar-collapsed');
    }
  } catch (e) { /* se ignora */ }
  updateAria();

  // ---------- Eventos ----------
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

  // Selección de módulo: marca la opción activa y actualiza el título
  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach((i) => i.classList.remove('active'));
      item.classList.add('active');
      pageTitle.textContent = item.dataset.title + ': Trazabilidad de Proveedores y Órdenes de Compra';
      if (isMobile()) closeMobileSidebar();
    });
  });
})();