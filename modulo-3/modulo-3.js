/* =========================================================
   SECCIÓN 1. SIDEBAR COLAPSABLE
   (La navegación entre módulos se hace con enlaces normales)
   ========================================================= */
(function () {
    'use strict';

    // ---------- Referencias al DOM ----------
    const body = document.body;
    const toggleBtn = document.getElementById('sidebarToggle');
    const backdrop = document.getElementById('sidebarBackdrop');

    const MOBILE_QUERY = window.matchMedia('(max-width: 991.98px)');
    const STORAGE_KEY = 'sidebarCollapsed';

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
})();


/* =========================================================
   SECCIÓN 2. MÓDULO 3: CONTROL DE MERMAS
   Flujo: Excel -> SheetJS -> validación -> localStorage -> tabla y gráficos
   ========================================================= */
(function () {
    'use strict';

    /* ---------------------------------------------------------
       2.1 CONFIGURACIÓN
       --------------------------------------------------------- */
    const STORAGE_KEY = 'modulo3_mermas_v1';  // clave de localStorage
    const CURRENCY = 'S/';                    // símbolo de moneda
    const LOCALE = 'es-PE';                   // formato de números
    const PAGE_SIZE = 10;                     // filas por página en la tabla
    const MAX_CAUSES = 8;                     // causas visibles en el Pareto (el resto se agrupa en "Otros")
    const MAX_FAMILIES = 5;                   // familias visibles en el gráfico de barras

    // Reglas de negocio basadas en los días restantes (ajústalas aquí)
    const DAYS_CRITICAL = 15;                 // menos de 15 días: estado crítico
    const DAYS_WARNING = 30;                  // hasta 30 días: se recomienda liquidar

    // Columnas de la plantilla. "aliases" permite reconocer encabezados parecidos al importar.
    const COLUMNS = [
        { key: 'sku', header: 'SKU', required: true, aliases: ['sku', 'codigo', 'codigo sku'] },
        { key: 'producto', header: 'Producto', required: true, aliases: ['producto', 'nombre', 'descripcion', 'nombre del producto'] },
        { key: 'familia', header: 'Familia', required: true, aliases: ['familia', 'categoria', 'familia de productos'] },
        { key: 'stock', header: 'Stock', required: true, aliases: ['stock', 'cantidad', 'unidades'] },
        { key: 'costo', header: 'Costo unitario', required: false, aliases: ['costo unitario', 'costo', 'costo por unidad'] },
        { key: 'vencimiento', header: 'Fecha de vencimiento', required: true, aliases: ['fecha de vencimiento', 'fecha vencimiento', 'vencimiento', 'fecha de vcto'] },
        { key: 'causa', header: 'Causa de vencimiento', required: false, aliases: ['causa de vencimiento', 'causa', 'motivo'] }
    ];

    /* ---------------------------------------------------------
       2.2 REFERENCIAS AL DOM Y ESTADO
       --------------------------------------------------------- */
    const el = {
        meta: document.getElementById('importMeta'),
        search: document.getElementById('searchInput'),
        statusFilter: document.getElementById('statusFilter'),
        tableBody: document.getElementById('tableBody'),
        tableInfo: document.getElementById('tableInfo'),
        pagination: document.getElementById('pagination'),
        sortHeaders: document.querySelectorAll('th.sortable'),
        paretoBox: document.getElementById('paretoBox'),
        familyBox: document.getElementById('familyBox'),
        familySubtitle: document.getElementById('familySubtitle'),
        modal: document.getElementById('importModal'),
        btnTemplate: document.getElementById('btnTemplate'),
        fileInput: document.getElementById('fileInput'),
        btnImport: document.getElementById('btnImport'),
        btnClear: document.getElementById('btnClear'),
        message: document.getElementById('importMessage')
    };

    // Estado de la vista: datos guardados + filtros, orden y página actuales
    const state = {
        data: null,            // { importedAt, fileName, rows: [...] } o null si no hay datos
        search: '',
        status: 'all',
        sortKey: 'dias',
        sortDir: 'asc',
        page: 1
    };

    let paretoChart = null;
    let familyChart = null;

    /* ---------------------------------------------------------
       2.3 UTILIDADES
       --------------------------------------------------------- */

    // Normaliza texto: sin tildes, minúsculas y espacios simples (para comparar encabezados)
    const normalize = (s) => String(s ?? '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim().replace(/\s+/g, ' ');

    // Escapa HTML: los datos del Excel nunca se insertan sin escapar
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    const fmtNumber = (n) => Number(n).toLocaleString(LOCALE);
    const fmtMoney = (n) => `${CURRENCY} ${Number(n).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // "2026-10-21" -> "21/10/2026"
    const fmtDate = (iso) => iso.split('-').reverse().join('/');

    // Lee una variable CSS de :root (así los gráficos usan la misma paleta que la interfaz)
    const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    /* ---------------------------------------------------------
       2.4 FECHAS Y NÚMEROS
       --------------------------------------------------------- */

    // Construye "YYYY-MM-DD" si la fecha existe realmente (rechaza 31/02, por ejemplo)
    function validISO(y, m, d) {
        const date = new Date(y, m - 1, d);
        if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    // Acepta: número serial de Excel, Date, "dd/mm/aaaa" y "aaaa-mm-dd"
    function parseDate(v) {
        if (v instanceof Date && !isNaN(v)) {
            return validISO(v.getFullYear(), v.getMonth() + 1, v.getDate());
        }
        if (typeof v === 'number' && v > 0 && v < 2958466) {
            // Excel cuenta los días desde 30/12/1899
            const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
            return validISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        }
        const s = String(v ?? '').trim();
        let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
        if (m) return validISO(+m[3], +m[2], +m[1]);
        m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
        if (m) return validISO(+m[1], +m[2], +m[3]);
        return null;
    }

    // Convierte a número aceptando coma decimal; devuelve NaN si no es válido
    function parseNumber(v) {
        if (typeof v === 'number') return v;
        const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.');
        return s === '' ? NaN : Number(s);
    }

    // Días entre hoy (00:00 local) y la fecha de vencimiento
    function daysUntil(iso) {
        const [y, m, d] = iso.split('-').map(Number);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.round((new Date(y, m - 1, d) - today) / 86400000);
    }

    /* ---------------------------------------------------------
       2.5 PERSISTENCIA (localStorage)
       --------------------------------------------------------- */
    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && Array.isArray(parsed.rows) ? parsed : null;
        } catch (e) {
            return null;  // JSON dañado o almacenamiento bloqueado
        }
    }

    function saveData(payload) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            return true;
        } catch (e) {
            return false;  // almacenamiento lleno o bloqueado
        }
    }

    function clearData() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* se ignora */ }
    }

    /* ---------------------------------------------------------
       2.6 PLANTILLA EXCEL (descarga)
       --------------------------------------------------------- */
    function downloadTemplate() {
        if (typeof XLSX === 'undefined') {
            showMessage('error', 'No se pudo cargar la librería de Excel. Revisa tu conexión a internet.');
            return;
        }

        const wb = XLSX.utils.book_new();

        // Hoja 1: solo encabezados, lista para rellenar
        const sheet = XLSX.utils.aoa_to_sheet([COLUMNS.map((c) => c.header)]);
        sheet['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(c.header.length + 4, 16) }));
        XLSX.utils.book_append_sheet(wb, sheet, 'Mermas');

        // Hoja 2: instrucciones (el ejemplo vive aquí y no se importa)
        const help = [
            ['Columna', 'Obligatoria', 'Descripción', 'Ejemplo'],
            ['SKU', 'Sí', 'Código único del producto', 'SKU-001'],
            ['Producto', 'Sí', 'Nombre del producto', 'Leche entera 1 L'],
            ['Familia', 'Sí', 'Familia o categoría del producto', 'Lácteos'],
            ['Stock', 'Sí', 'Unidades en inventario', 120],
            ['Costo unitario', 'No', `Costo por unidad en ${CURRENCY}. Si falta, el gráfico de familias usa unidades`, 3.5],
            ['Fecha de vencimiento', 'Sí', 'Formato dd/mm/aaaa o fecha de Excel', '31/12/2026'],
            ['Causa de vencimiento', 'No', 'Motivo por el que el producto vence', 'Baja rotación']
        ];
        const helpSheet = XLSX.utils.aoa_to_sheet(help);
        helpSheet['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 60 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, helpSheet, 'Instrucciones');

        XLSX.writeFile(wb, 'plantilla_mermas.xlsx');
    }

    /* ---------------------------------------------------------
       2.7 IMPORTACIÓN: lectura y validación del archivo
       --------------------------------------------------------- */

    // Lee el archivo y devuelve un workbook de SheetJS (CSV como texto UTF-8, Excel como binario)
    function readWorkbook(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const isCsv = /\.csv$/i.test(file.name);
            reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
            reader.onload = (e) => {
                try {
                    resolve(XLSX.read(e.target.result, { type: isCsv ? 'string' : 'array' }));
                } catch (err) {
                    reject(new Error('El archivo no es un Excel o CSV válido.'));
                }
            };
            if (isCsv) reader.readAsText(file, 'UTF-8');
            else reader.readAsArrayBuffer(file);
        });
    }

    // Convierte el archivo en filas limpias. Devuelve { rows, skipped, errors }
    async function parseFile(file) {
        if (typeof XLSX === 'undefined') {
            throw new Error('No se pudo cargar la librería de Excel. Revisa tu conexión a internet.');
        }

        const wb = await readWorkbook(file);

        // Usa la hoja "Mermas" si existe; si no, la primera
        const sheetName = wb.SheetNames.find((n) => normalize(n) === 'mermas') || wb.SheetNames[0];
        const json = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '', raw: true });

        if (json.length === 0) {
            throw new Error('El archivo no contiene filas de datos. Completa la plantilla e inténtalo de nuevo.');
        }

        // Relaciona los encabezados del archivo con las claves internas
        const headerMap = {};
        Object.keys(json[0]).forEach((original) => {
            const col = COLUMNS.find((c) => c.aliases.includes(normalize(original)));
            if (col && !Object.values(headerMap).includes(col.key)) headerMap[original] = col.key;
        });

        const missing = COLUMNS.filter((c) => c.required && !Object.values(headerMap).includes(c.key));
        if (missing.length) {
            const err = new Error('Faltan columnas obligatorias. Usa la plantilla predeterminada.');
            err.details = missing.map((c) => c.header);
            throw err;
        }

        const rows = [];
        const errors = [];

        json.forEach((raw, i) => {
            const line = i + 2;  // fila real en Excel (la 1 son los encabezados)

            // Las filas totalmente vacías se ignoran sin contarlas como error
            if (Object.values(raw).every((v) => String(v).trim() === '')) return;

            const rec = {};
            Object.entries(headerMap).forEach(([original, key]) => { rec[key] = raw[original]; });

            const sku = String(rec.sku ?? '').trim();
            const producto = String(rec.producto ?? '').trim();
            const familia = String(rec.familia ?? '').trim();
            const stock = parseNumber(rec.stock);
            const costoRaw = parseNumber(rec.costo);
            const vencimiento = parseDate(rec.vencimiento);

            // Validaciones por fila: si falla una, la fila se omite y se informa
            const problems = [];
            if (!sku) problems.push('falta el SKU');
            if (!producto) problems.push('falta el producto');
            if (!familia) problems.push('falta la familia');
            if (!Number.isFinite(stock) || stock < 0) problems.push('stock inválido');
            if (!vencimiento) problems.push('fecha de vencimiento inválida');
            if (rec.costo !== undefined && String(rec.costo).trim() !== '' && (!Number.isFinite(costoRaw) || costoRaw < 0)) {
                problems.push('costo unitario inválido');
            }

            if (problems.length) {
                errors.push(`Fila ${line}: ${problems.join(', ')}`);
                return;
            }

            rows.push({
                sku,
                producto,
                familia,
                stock,
                costo: Number.isFinite(costoRaw) ? costoRaw : 0,
                vencimiento,  // se guarda como "YYYY-MM-DD"
                causa: String(rec.causa ?? '').trim()
            });
        });

        return { rows, skipped: errors.length, errors };
    }

    /* ---------------------------------------------------------
       2.8 MODAL: mensajes y flujo de importación
       --------------------------------------------------------- */
    function showMessage(type, text, details = []) {
        el.message.className = `msg-box msg-${type}`;  // type: 'warn' | 'error'
        el.message.replaceChildren();

        const p = document.createElement('p');
        p.className = 'mb-0 fw-semibold';
        p.textContent = text;
        el.message.append(p);

        if (details.length) {
            const ul = document.createElement('ul');
            ul.className = 'mb-0 mt-2 ps-3 small';
            details.forEach((d) => {
                const li = document.createElement('li');
                li.textContent = d;
                ul.append(li);
            });
            el.message.append(ul);
        }
    }

    function hideMessage() {
        el.message.className = 'msg-box d-none';
        el.message.replaceChildren();
    }

    const closeModal = () => bootstrap.Modal.getOrCreateInstance(el.modal).hide();

    async function handleImport() {
        const file = el.fileInput.files[0];
        if (!file) return;

        hideMessage();
        el.btnImport.disabled = true;

        try {
            const result = await parseFile(file);

            if (result.rows.length === 0) {
                const err = new Error('No se encontró ninguna fila válida para importar.');
                err.details = result.errors.slice(0, 5);
                throw err;
            }

            // Guardado obligatorio en localStorage
            const payload = { importedAt: new Date().toISOString(), fileName: file.name, rows: result.rows };
            if (!saveData(payload)) {
                throw new Error('No se pudo guardar en el navegador (almacenamiento lleno o bloqueado).');
            }

            // Actualiza la vista con los nuevos datos
            state.data = payload;
            state.page = 1;
            renderAll();
            el.fileInput.value = '';

            if (result.skipped > 0) {
                // Se importó lo válido, pero se avisa de lo omitido y el modal queda abierto
                const more = result.skipped > 5 ? [`... y ${result.skipped - 5} filas más`] : [];
                showMessage(
                    'warn',
                    `Se importaron ${result.rows.length} filas. Se omitieron ${result.skipped} por errores.`,
                    [...result.errors.slice(0, 5), ...more]
                );
            } else {
                closeModal();
            }
        } catch (err) {
            showMessage('error', err.message, err.details || []);
            el.btnImport.disabled = !el.fileInput.files.length;
        }
    }

    function handleClear() {
        if (!window.confirm('Se eliminarán los datos guardados en este navegador. ¿Continuar?')) return;
        clearData();
        state.data = null;
        state.page = 1;
        renderAll();
        el.fileInput.value = '';
        el.btnImport.disabled = true;
        closeModal();
    }

    /* ---------------------------------------------------------
       2.9 REGLAS DE NEGOCIO: estado y acción por producto
       --------------------------------------------------------- */

    // Estado según los días restantes (la urgencia sube con la intensidad del rojo)
    function getStatus(dias) {
        if (dias < 0) return { key: 'expired', label: 'Vencido', cls: 'status-expired' };
        if (dias < DAYS_CRITICAL) return { key: 'critical', label: '<15', cls: 'status-critical' };
        if (dias <= DAYS_WARNING) return { key: 'warning', label: '15-30', cls: 'status-warning' };
        return { key: 'ok', label: '>30', cls: 'status-ok' };
    }

    // Acción recomendada: desechar si ya venció, liquidar si vence pronto, monitorear si hay margen
    function getActionHtml(dias) {
        if (dias < 0) {
            return `<span class="action-text" data-bs-toggle="tooltip" data-bs-title="Producto vencido: retíralo del inventario y registra la baja."><i class="bi bi-trash3"></i>Desechar</span>`;
        }
        if (dias <= DAYS_WARNING) {
            return `<span class="action-text" data-bs-toggle="tooltip" data-bs-title="Coordina con Marketing un descuento o promoción para rotar el stock antes del vencimiento.">Aplicar liquidación<i class="bi bi-info-circle"></i></span>`;
        }
        return `<span class="action-muted">Monitorear</span>`;
    }

    /* ---------------------------------------------------------
       2.10 RENDER: encabezado, tabla y paginación
       --------------------------------------------------------- */

    // Devuelve las filas guardadas con los días restantes calculados al momento
    const getRows = () => (state.data ? state.data.rows : []).map((r) => ({ ...r, dias: daysUntil(r.vencimiento) }));

    function renderMeta() {
        if (!state.data) {
            el.meta.textContent = 'Aún no se han importado datos.';
            return;
        }
        const when = new Date(state.data.importedAt).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' });
        el.meta.textContent = `Última importación: ${when} · ${state.data.fileName} · ${state.data.rows.length} registros`;
    }

    // Compara dos filas según la columna y dirección de orden actuales
    function compareRows(a, b) {
        const { sortKey, sortDir } = state;
        let result;
        if (sortKey === 'stock' || sortKey === 'dias') {
            result = a[sortKey] - b[sortKey];
        } else {
            result = String(a[sortKey]).localeCompare(String(b[sortKey]), 'es', { numeric: true, sensitivity: 'base' });
        }
        return sortDir === 'asc' ? result : -result;
    }

    function renderTable() {
        // Libera los tooltips anteriores antes de reemplazar las filas
        el.tableBody.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((node) => {
            const tip = bootstrap.Tooltip.getInstance(node);
            if (tip) tip.dispose();
        });

        const all = getRows();
        const term = normalize(state.search);

        // 1) Filtrar por texto y por estado
        const filtered = all.filter((r) => {
            const matchText = !term || normalize(`${r.sku} ${r.producto} ${r.familia}`).includes(term);
            const matchStatus = state.status === 'all' || getStatus(r.dias).key === state.status;
            return matchText && matchStatus;
        });

        // 2) Ordenar
        filtered.sort(compareRows);

        // 3) Paginar
        const total = filtered.length;
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        state.page = Math.min(state.page, pages);
        const start = (state.page - 1) * PAGE_SIZE;
        const slice = filtered.slice(start, start + PAGE_SIZE);

        // 4) Pintar filas o estado vacío
        if (slice.length === 0) {
            const text = all.length === 0
                ? 'No hay datos. Importa un archivo Excel para comenzar.'
                : 'Ningún producto coincide con los filtros.';
            el.tableBody.innerHTML = `<tr class="table-empty"><td colspan="7">${text}</td></tr>`;
        } else {
            el.tableBody.innerHTML = slice.map((r) => {
                const st = getStatus(r.dias);
                return `<tr>
                    <td class="text-nowrap">${esc(r.sku)}</td>
                    <td>${esc(r.producto)}</td>
                    <td>${esc(r.familia)}</td>
                    <td>${fmtNumber(r.stock)}</td>
                    <td class="text-nowrap">${fmtDate(r.vencimiento)}</td>
                    <td><div class="d-flex align-items-center gap-2"><span class="days-num">${r.dias}</span><span class="status-badge ${st.cls}">${st.label}</span></div></td>
                    <td class="text-center">${getActionHtml(r.dias)}</td>
                </tr>`;
            }).join('');
            el.tableBody.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((node) => new bootstrap.Tooltip(node));
        }

        // 5) Información, paginación e indicadores de orden
        el.tableInfo.textContent = total ? `Mostrando ${start + 1}-${start + slice.length} de ${total}` : '';
        renderPagination(pages);
        renderSortIndicators();
    }

    function renderPagination(pages) {
        if (pages <= 1) {
            el.pagination.innerHTML = '';
            return;
        }
        const item = (label, page, { disabled = false, active = false, aria = '' } = {}) =>
            `<li class="page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}"><a class="page-link" href="#" data-page="${page}"${aria ? ` aria-label="${aria}"` : ''}>${label}</a></li>`;

        // Ventana de hasta 5 números de página alrededor de la actual
        const first = Math.max(1, Math.min(state.page - 2, pages - 4));
        const last = Math.min(pages, first + 4);

        const parts = [item('&laquo;', state.page - 1, { disabled: state.page === 1, aria: 'Anterior' })];
        for (let p = first; p <= last; p++) parts.push(item(p, p, { active: p === state.page }));
        parts.push(item('&raquo;', state.page + 1, { disabled: state.page === pages, aria: 'Siguiente' }));
        el.pagination.innerHTML = parts.join('');
    }

    function renderSortIndicators() {
        el.sortHeaders.forEach((th) => {
            const active = th.dataset.sort === state.sortKey;
            const icon = th.querySelector('.sort-icon');
            th.classList.toggle('sorted', active);
            th.setAttribute('aria-sort', active ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
            icon.className = 'bi sort-icon ' + (active
                ? (state.sortDir === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill')
                : 'bi-chevron-expand');
        });
    }

    /* ---------------------------------------------------------
       2.11 RENDER: gráficos con Chart.js
       --------------------------------------------------------- */

    // Agrupa filas por una clave y suma un valor; devuelve [[clave, total], ...] de mayor a menor
    function groupSum(rows, keyFn, valueFn) {
        const map = new Map();
        rows.forEach((r) => map.set(keyFn(r), (map.get(keyFn(r)) || 0) + valueFn(r)));
        return [...map.entries()].sort((a, b) => b[1] - a[1]);
    }

    // Opciones y colores comunes a ambos gráficos
    function applyChartDefaults() {
        Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
        Chart.defaults.color = cssVar('--text-muted');
        Chart.defaults.borderColor = cssVar('--border');
    }

    // ---- Gráfico 1: Diagrama de Pareto (barras descendentes + línea de % acumulado) ----
    function renderPareto() {
        if (paretoChart) { paretoChart.destroy(); paretoChart = null; }

        const rows = state.data ? state.data.rows : [];
        el.paretoBox.classList.toggle('is-empty', rows.length === 0);
        if (rows.length === 0) return;

        // Frecuencia por causa; las causas menos frecuentes se agrupan en "Otros"
        let causes = groupSum(rows, (r) => r.causa || 'Sin especificar', () => 1);
        if (causes.length > MAX_CAUSES) {
            const rest = causes.slice(MAX_CAUSES - 1).reduce((acc, [, n]) => acc + n, 0);
            causes = [...causes.slice(0, MAX_CAUSES - 1), ['Otros', rest]];
        }

        // Porcentaje acumulado sobre el total de registros
        const total = causes.reduce((acc, [, n]) => acc + n, 0);
        let running = 0;
        const cumulative = causes.map(([, n]) => {
            running += n;
            return Math.round((running / total) * 1000) / 10;  // un decimal
        });

        paretoChart = new Chart(document.getElementById('paretoChart'), {
            type: 'bar',
            data: {
                labels: causes.map(([name]) => name),
                datasets: [
                    {
                        type: 'bar',
                        label: 'Frecuencia',
                        data: causes.map(([, n]) => n),
                        backgroundColor: cssVar('--red-500'),
                        borderRadius: 4,
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        type: 'line',
                        label: '% acumulado',
                        data: cumulative,
                        borderColor: cssVar('--red-900'),
                        backgroundColor: cssVar('--red-900'),
                        pointRadius: 4,
                        tension: 0,
                        yAxisID: 'y1',
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ctx.dataset.yAxisID === 'y1'
                                ? ` % acumulado: ${ctx.parsed.y.toLocaleString(LOCALE)}%`
                                : ` Frecuencia: ${ctx.parsed.y}`
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 45 } },
                    y: { beginAtZero: true, title: { display: true, text: 'Frecuencia' }, ticks: { precision: 0 } },
                    y1: {
                        position: 'right',
                        min: 0,
                        max: 100,
                        title: { display: true, text: '% acumulado' },
                        grid: { drawOnChartArea: false },
                        ticks: { callback: (v) => `${v}%` }
                    }
                }
            }
        });
    }

    // ---- Gráfico 2: barras horizontales por familia con más merma ----
    function renderFamilies() {
        if (familyChart) { familyChart.destroy(); familyChart = null; }

        const rows = state.data ? state.data.rows : [];
        el.familyBox.classList.toggle('is-empty', rows.length === 0);
        if (rows.length === 0) {
            el.familySubtitle.textContent = 'Pérdida por familia';
            return;
        }

        // Si hay costos, la merma se valoriza (stock x costo); si no, se cuentan unidades
        const hasCost = rows.some((r) => r.costo > 0);
        const valueFn = hasCost ? (r) => r.stock * r.costo : (r) => r.stock;
        const top = groupSum(rows, (r) => r.familia, valueFn).slice(0, MAX_FAMILIES);

        el.familySubtitle.textContent = hasCost ? `Pérdida valorizada por familia (${CURRENCY})` : 'Unidades por familia';
        const format = (n) => hasCost ? fmtMoney(n) : `${fmtNumber(n)} unid.`;

        familyChart = new Chart(document.getElementById('familyChart'), {
            type: 'bar',
            data: {
                labels: top.map(([name]) => name),
                datasets: [{
                    label: hasCost ? 'Pérdida' : 'Unidades',
                    data: top.map(([, n]) => n),
                    backgroundColor: cssVar('--red-600'),
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',  // barras horizontales
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => ` ${format(ctx.parsed.x)}` } }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { callback: (v) => hasCost ? `${CURRENCY} ${fmtNumber(v)}` : fmtNumber(v) } },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    /* ---------------------------------------------------------
       2.12 RENDER GENERAL Y EVENTOS
       --------------------------------------------------------- */
    function renderAll() {
        renderMeta();
        renderTable();
        renderPareto();
        renderFamilies();
    }

    // ---- Tabla: búsqueda y filtro por estado ----
    el.search.addEventListener('input', () => {
        state.search = el.search.value;
        state.page = 1;
        renderTable();
    });

    el.statusFilter.addEventListener('change', () => {
        state.status = el.statusFilter.value;
        state.page = 1;
        renderTable();
    });

    // ---- Tabla: ordenar al hacer clic (o Enter/Espacio) en un encabezado ----
    el.sortHeaders.forEach((th) => {
        const sortBy = () => {
            const key = th.dataset.sort;
            state.sortDir = state.sortKey === key && state.sortDir === 'asc' ? 'desc' : 'asc';
            state.sortKey = key;
            state.page = 1;
            renderTable();
        };
        th.addEventListener('click', sortBy);
        th.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortBy(); }
        });
    });

    // ---- Tabla: paginación (delegación de eventos) ----
    el.pagination.addEventListener('click', (e) => {
        e.preventDefault();
        const link = e.target.closest('[data-page]');
        if (!link || link.parentElement.classList.contains('disabled')) return;
        state.page = Number(link.dataset.page);
        renderTable();
    });

    // ---- Modal: plantilla, selección de archivo, importar y limpiar ----
    el.btnTemplate.addEventListener('click', downloadTemplate);
    el.btnImport.addEventListener('click', handleImport);
    el.btnClear.addEventListener('click', handleClear);

    el.fileInput.addEventListener('change', () => {
        hideMessage();
        el.btnImport.disabled = !el.fileInput.files.length;
    });

    // Al cerrar el modal se limpia el formulario
    el.modal.addEventListener('hidden.bs.modal', () => {
        el.fileInput.value = '';
        el.btnImport.disabled = true;
        hideMessage();
    });

    /* ---------------------------------------------------------
       2.13 INICIO: leer localStorage y repoblar la vista
       --------------------------------------------------------- */
    applyChartDefaults();
    state.data = loadData();
    renderAll();
})();