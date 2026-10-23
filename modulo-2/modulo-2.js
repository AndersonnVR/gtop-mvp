/* =========================================================
   MÓDULO 2: CONTROL DE PROVEEDORES
   Depende de ../shared/app.js (AppConfig, AppUtils, AppSede, AppNotifications),
   que ya se encarga del sidebar y de la campana de notificaciones.
   Índice:
     1. Constantes y almacenamiento
     2. Datos de demostración
     3. Utilidades de fechas y mensajes
     4. Tabla "Productos próximos a reponer" + modal de notificación
     5. Tabla "Pedidos" (edición en línea, reclamos)
     6. Modales: agregar pedido e importar Excel
     7. Gráficos (Chart.js)
     8. Orden de compra desde el comparador
     9. Selector de sede
    10. Inicio
   ========================================================= */
(function () {
    'use strict';

    const { esc, renderPagination, bindPagination, showBox, hideBox, setInvalid, clearInvalid, autoClearInvalid } = AppUtils;

    /* ---------------------------------------------------------
       1. CONSTANTES Y ALMACENAMIENTO
       --------------------------------------------------------- */
    const KEYS = {
        REPONER: 'productosReponer',
        PEDIDOS: 'pedidos',
        PRECIOS: 'catalogoPrecios'
    };
    const ROWS_PER_PAGE = 6;
    const EDITABLE_FIELDS = ['fechaEnt', 'completitud', 'puntualidad'];
    const $ = (id) => document.getElementById(id);

    // Lectura y escritura tolerantes a JSON dañado o almacenamiento bloqueado
    function readList(key) {
        try {
            const list = JSON.parse(localStorage.getItem(key));
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    function writeList(key, list) {
        try {
            localStorage.setItem(key, JSON.stringify(list));
            return true;
        } catch (e) {
            showToast('No se pudo guardar en el navegador (almacenamiento lleno o bloqueado).', 'warn');
            return false;
        }
    }

    // Los ID pueden ser números (formulario) o texto (Excel): siempre se comparan como texto
    const sameId = (a, b) => String(a) === String(b);

    const state = {
        pageReponer: 1,
        pagePedidos: 1,
        pendingReponerId: null,   // producto que se está notificando
        pendingReclamoId: null,   // pedido que se está reclamando
        stockChart: null,
        preciosChart: null
    };

    /* ---------------------------------------------------------
       2. DATOS DE DEMOSTRACIÓN (solo si no existe nada guardado)
       --------------------------------------------------------- */
    function seedData() {
        const seed = (key, list) => {
            try {
                if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(list));
            } catch (e) { /* se ignora */ }
        };

        seed(KEYS.REPONER, [
            { id: 1, producto: 'Coca-Cola 2L', stock: 50, proveedor: 'Coca-Cola', estado: 'Notificar' },
            { id: 2, producto: 'Papas Fritas', stock: 20, proveedor: 'Frito Lay', estado: 'Notificado' },
            { id: 3, producto: 'Agua San Luis 625ml', stock: 15, proveedor: 'Backus', estado: 'Notificar' },
            { id: 4, producto: 'Inca Kola 1.5L', stock: 12, proveedor: 'Coca-Cola', estado: 'Notificar' },
            { id: 5, producto: 'Galletas Casino', stock: 18, proveedor: 'Alicorp', estado: 'Notificado' },
            { id: 6, producto: 'Leche Gloria 400g', stock: 10, proveedor: 'Gloria', estado: 'Notificar' },
            { id: 7, producto: 'Cerveza Cristal personal', stock: 8, proveedor: 'Backus', estado: 'Notificar' },
            { id: 8, producto: 'Chocolate Sublime', stock: 14, proveedor: 'Nestlé', estado: 'Notificado' },
            { id: 9, producto: 'Energizante Volt 300ml', stock: 9, proveedor: 'AJE', estado: 'Notificar' }
        ]);

        seed(KEYS.PEDIDOS, [
            { id: 400, proveedor: 'Bimbo', fechaProg: '02/08/2023', fechaEnt: '02/08/2023', completitud: '51/200', puntualidad: '5 min tarde', estado: 'Generar reclamo' },
            { id: 250, proveedor: 'Juanito', fechaProg: '02/08/2023', fechaEnt: '23/08/2023', completitud: '67/67', puntualidad: '0 min tarde', estado: 'Generar reclamo' }
        ]);

        seed(KEYS.PRECIOS, [
            { id: 1, producto: 'Coca-Cola 2L', proveedor: 'Coca-Cola (Directo)', precio: 8.50 },
            { id: 2, producto: 'Coca-Cola 2L', proveedor: 'Mayorista Makro', precio: 8.20 },
            { id: 3, producto: 'Coca-Cola 2L', proveedor: 'Vega Supermayorista', precio: 8.35 },
            { id: 4, producto: 'Coca-Cola 2L', proveedor: 'Distribuidora San Juan', precio: 8.70 },
            { id: 5, producto: 'Leche Gloria 400g', proveedor: 'Gloria (Directo)', precio: 3.80 },
            { id: 6, producto: 'Leche Gloria 400g', proveedor: 'Mayorista Makro', precio: 3.65 },
            { id: 7, producto: 'Leche Gloria 400g', proveedor: 'Vega Supermayorista', precio: 3.70 },
            { id: 8, producto: 'Cerveza Cristal personal', proveedor: 'Backus (Directo)', precio: 4.00 },
            { id: 9, producto: 'Cerveza Cristal personal', proveedor: 'Mayorista Makro', precio: 3.85 },
            { id: 10, producto: 'Cerveza Cristal personal', proveedor: 'Distribuidora San Juan', precio: 4.10 },
            { id: 11, producto: 'Chocolate Sublime', proveedor: 'Nestlé (Directo)', precio: 1.50 },
            { id: 12, producto: 'Chocolate Sublime', proveedor: 'Mayorista Makro', precio: 1.35 },
            { id: 13, producto: 'Chocolate Sublime', proveedor: 'Vega Supermayorista', precio: 1.40 },
            { id: 14, producto: 'Agua San Luis 625ml', proveedor: 'Backus (Directo)', precio: 2.00 },
            { id: 15, producto: 'Agua San Luis 625ml', proveedor: 'Coca-Cola (Directo)', precio: 1.90 },
            { id: 16, producto: 'Agua San Luis 625ml', proveedor: 'Mayorista Makro', precio: 1.80 }
        ]);

        // Notificaciones de ejemplo: solo la primera vez que se abre cualquier módulo
        AppNotifications.seedIfEmpty([
            { id: 'seed-1', texto: 'Se le ha notificado al proveedor <strong>Coca-Cola</strong> para reponer <strong>Inca Kola 1.5L</strong>.', fecha: new Date().toISOString(), leida: false },
            { id: 'seed-2', texto: 'Reclamo legal generado para <strong>Juanito</strong> por incumplimiento del pedido #250.', fecha: new Date(Date.now() - 3600000).toISOString(), leida: false }
        ]);
    }

    /* ---------------------------------------------------------
       3. UTILIDADES DE FECHAS Y MENSAJES
       --------------------------------------------------------- */
    const pad = (n) => String(n).padStart(2, '0');

    // "2023-08-02" (input date) -> "02/08/2023" (formato de la tabla)
    function isoToDisplay(iso) {
        if (!iso) return '-';
        const p = String(iso).split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(iso);
    }

    // "02/08/2023" -> "2023-08-02"; si no tiene ese formato devuelve ''
    function displayToIso(text) {
        const m = String(text ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : '';
    }

    // Excel guarda las fechas como número de serie (ej. 45201): se convierte a DD/MM/AAAA
    function excelCellToDisplay(value) {
        if (value === null || value === undefined || value === '') return '-';
        if (value instanceof Date && !isNaN(value)) {
            return `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()}`;
        }
        if (typeof value === 'number' && value > 20000 && value < 80000) {
            const d = new Date(Math.round((value - 25569) * 86400 * 1000));
            return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
        }
        const text = String(value).trim();
        return text || '-';
    }

    const todayIso = () => {
        const d = new Date();
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    const longDate = () => new Date().toLocaleDateString(AppConfig.LOCALE, { year: 'numeric', month: 'long', day: 'numeric' });

    // Aviso emergente (mismo componente que el módulo 1). type: 'ok' | 'warn'
    function showToast(text, type = 'ok') {
        const el = $('appToast');
        if (!el) return;
        $('toastText').textContent = text;
        $('toastIcon').className = type === 'warn' ? 'bi bi-exclamation-triangle-fill' : 'bi bi-check-circle-fill';
        el.dataset.type = type;
        bootstrap.Toast.getOrCreateInstance(el, { delay: 4500 }).show();
    }

    const modalOf = (id) => bootstrap.Modal.getOrCreateInstance($(id));

    /* ---------------------------------------------------------
       4. TABLA "PRODUCTOS PRÓXIMOS A REPONER"
       --------------------------------------------------------- */

    // "Mostrando 1-6 de 9"
    function pageInfo(total, page, perPage) {
        if (total === 0) return '';
        const from = (page - 1) * perPage + 1;
        const to = Math.min(page * perPage, total);
        return `Mostrando ${from}–${to} de ${total}`;
    }

    function renderReponer() {
        const tbody = document.querySelector('#tablaReponer tbody');
        const all = readList(KEYS.REPONER);
        const pages = Math.max(1, Math.ceil(all.length / ROWS_PER_PAGE));
        state.pageReponer = Math.min(state.pageReponer, pages);

        if (all.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No hay productos próximos a reponer.</td></tr>';
        } else {
            const start = (state.pageReponer - 1) * ROWS_PER_PAGE;
            tbody.innerHTML = all.slice(start, start + ROWS_PER_PAGE).map((item) => {
                const done = item.estado === 'Notificado';
                return `<tr>
                    <td>${esc(item.producto)}</td>
                    <td>${esc(item.stock)}</td>
                    <td>${esc(item.proveedor)}</td>
                    <td class="text-center">
                        <button type="button" class="btn btn-sm btn-pill ${done ? 'btn-done' : 'btn-brand'}"
                            data-action="notificar" data-id="${esc(item.id)}" ${done ? 'disabled' : ''}>${esc(item.estado)}</button>
                    </td>
                </tr>`;
            }).join('');
        }

        $('infoReponer').textContent = pageInfo(all.length, state.pageReponer, ROWS_PER_PAGE);
        renderPagination($('paginacionReponer'), state.pageReponer, pages);
    }

    function openNotificarModal(id) {
        const item = readList(KEYS.REPONER).find((d) => sameId(d.id, id));
        if (!item) return;
        state.pendingReponerId = item.id;

        $('textoNotificacion').value = `ORDEN DE REPOSICIÓN DE INVENTARIO

Fecha: ${longDate()}
A: Departamento de Ventas y Despacho, ${item.proveedor}
De: Área de Compras - Grupo San José
Asunto: Solicitud formal de reposición de stock - ${item.producto}

Estimados señores de ${item.proveedor},

Por medio de la presente, nos dirigimos a ustedes para solicitar formalmente la pronta reposición de inventario correspondiente al producto "${item.producto}".

De acuerdo con nuestros registros actuales de trazabilidad, el nivel de stock ha descendido a ${item.stock} unidades, alcanzando el umbral mínimo establecido para garantizar nuestra continuidad operativa.

Solicitamos amablemente procesar esta orden a la brevedad y remitirnos la confirmación de recepción de este documento, así como la fecha estimada de entrega en nuestro almacén central.

Atentamente,

___________________________
Ana María
Jefa de Operaciones
Grupo San José`;

        modalOf('modalNotificarProveedor').show();
    }

    function confirmNotificacion() {
        const list = readList(KEYS.REPONER);
        const item = list.find((d) => sameId(d.id, state.pendingReponerId));
        if (item) {
            item.estado = 'Notificado';
            if (writeList(KEYS.REPONER, list)) {
                renderReponer();
                AppNotifications.add(`Se le ha notificado al proveedor <strong>${esc(item.proveedor)}</strong> para reponer <strong>${esc(item.producto)}</strong>.`);
            }
        }
        state.pendingReponerId = null;
        modalOf('modalNotificarProveedor').hide();
    }

    /* ---------------------------------------------------------
       5. TABLA "PEDIDOS"
       --------------------------------------------------------- */
    function renderPedidos() {
        const tbody = document.querySelector('#tablaPedidos tbody');
        const all = readList(KEYS.PEDIDOS);
        const pages = Math.max(1, Math.ceil(all.length / ROWS_PER_PAGE));
        state.pagePedidos = Math.min(state.pagePedidos, pages);

        if (all.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No hay pedidos registrados.</td></tr>';
        } else {
            const start = (state.pagePedidos - 1) * ROWS_PER_PAGE;
            const cell = (p, field) =>
                `<td class="editable-cell" tabindex="0" role="button" title="Clic para editar"
                    data-edit="${field}" data-id="${esc(p.id)}">${esc(p[field])}</td>`;

            tbody.innerHTML = all.slice(start, start + ROWS_PER_PAGE).map((p) => {
                const done = p.estado === 'Reclamado';
                return `<tr>
                    <td>${esc(p.id)}</td>
                    <td>${esc(p.proveedor)}</td>
                    <td>${esc(p.fechaProg)}</td>
                    ${cell(p, 'fechaEnt')}
                    ${cell(p, 'completitud')}
                    ${cell(p, 'puntualidad')}
                    <td class="text-center">
                        <button type="button" class="btn btn-sm btn-pill ${done ? 'btn-done' : 'btn-claim'}"
                            data-action="reclamar" data-id="${esc(p.id)}" ${done ? 'disabled' : ''}>${esc(p.estado)}</button>
                    </td>
                </tr>`;
            }).join('');
        }

        $('infoPedidos').textContent = pageInfo(all.length, state.pagePedidos, ROWS_PER_PAGE);
        renderPagination($('paginacionPedidos'), state.pagePedidos, pages);
    }

    // ---- Edición en línea ----
    function startEdit(td) {
        if (td.querySelector('input')) return;
        const field = td.dataset.edit;
        const id = td.dataset.id;
        if (!EDITABLE_FIELDS.includes(field)) return;

        const current = td.textContent.trim();
        const isDate = field === 'fechaEnt';

        const input = document.createElement('input');
        input.className = 'form-control form-control-sm editable-input';
        input.type = isDate ? 'date' : 'text';
        input.maxLength = 40;
        input.setAttribute('aria-label', 'Editar valor');
        input.value = isDate ? displayToIso(current) : (current === '-' ? '' : current);

        td.replaceChildren(input);
        input.focus();

        let finished = false;
        const finish = (save) => {
            if (finished) return;
            finished = true;
            if (save) saveEdit(id, field, input.value, isDate);
            else renderPedidos();
        };

        input.addEventListener('blur', () => finish(true));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
    }

    function saveEdit(id, field, rawValue, isDate) {
        let value = rawValue.trim();
        if (!value) value = '-';
        else if (isDate) value = isoToDisplay(value);

        const list = readList(KEYS.PEDIDOS);
        const pedido = list.find((p) => sameId(p.id, id));
        if (pedido) {
            pedido[field] = value;
            writeList(KEYS.PEDIDOS, list);
        }
        renderPedidos();
    }

    // ---- Reclamo legal ----
    function openReclamoModal(id) {
        const p = readList(KEYS.PEDIDOS).find((d) => sameId(d.id, id));
        if (!p) return;
        state.pendingReclamoId = p.id;

        $('textoReclamo').value = `AVISO DE INCUMPLIMIENTO DE CONTRATO Y RECLAMO FORMAL

Fecha: ${longDate()}
A: Representante Legal / Área de Despachos de ${p.proveedor}
De: Departamento Legal y Compras - Grupo San José
Asunto: Incumplimiento de orden de compra #${p.id}

Por medio del presente documento, dejamos constancia formal del incumplimiento en las condiciones de entrega de la Orden de Compra #${p.id}, lo cual constituye una violación directa a la "Cláusula de Cumplimiento de Plazos y Entregas Completas" estipulada en nuestro contrato marco de suministro comercial.

Detalle explícito de las infracciones constatadas:

1. INPUNTUALIDAD EN LA ENTREGA:
   - Nivel de retraso registrado: ${p.puntualidad}

2. INCOMPLETITUD DEL PEDIDO:
   - Nivel de completitud (Entregado/Solicitado): ${p.completitud}

Estas irregularidades generan un perjuicio directo en nuestra cadena de suministro y trazabilidad de inventario. Solicitamos una respuesta formal en un plazo no mayor a 48 horas con las medidas correctivas y la nota de crédito correspondiente a las penalidades del contrato.

Atentamente,

___________________________
Ana María
Jefa de Operaciones
Grupo San José`;

        modalOf('modalGenerarReclamo').show();
    }

    function confirmReclamo() {
        const list = readList(KEYS.PEDIDOS);
        const p = list.find((d) => sameId(d.id, state.pendingReclamoId));
        if (p) {
            p.estado = 'Reclamado';
            if (writeList(KEYS.PEDIDOS, list)) {
                renderPedidos();
                AppNotifications.add(`Se ha generado un reclamo formal a <strong>${esc(p.proveedor)}</strong> por incumplimiento en el pedido #${esc(p.id)}.`);
            }
        }
        state.pendingReclamoId = null;
        modalOf('modalGenerarReclamo').hide();
    }

    // Siguiente ID libre (evita duplicados con los pedidos existentes)
    function nextPedidoId(list) {
        const max = list.reduce((m, p) => {
            const n = Number(p.id);
            return Number.isFinite(n) && n > m ? n : m;
        }, 0);
        return max + 1;
    }

    /* ---------------------------------------------------------
       6. MODALES: AGREGAR PEDIDO E IMPORTAR EXCEL
       --------------------------------------------------------- */
    function initFormPedido() {
        const form = $('formAgregarPedido');
        const modalEl = $('modalAgregarPedido');
        autoClearInvalid(form);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            clearInvalid(form);

            const idInput = $('inputPedidoID');
            const provInput = $('inputPedidoProveedor');
            const progInput = $('inputFechaProg');
            const entInput = $('inputFechaEnt');
            const compInput = $('inputCompletitud');

            const list = readList(KEYS.PEDIDOS);
            const id = Number(idInput.value);
            let ok = true;
            const fail = (input, msg) => { if (ok) input.focus(); setInvalid(input, msg); ok = false; };

            if (!idInput.value || !Number.isInteger(id) || id < 1) fail(idInput, 'Ingresa un ID entero mayor a 0.');
            else if (list.some((p) => sameId(p.id, id))) fail(idInput, 'Ya existe un pedido con ese ID.');

            if (!provInput.value.trim()) fail(provInput, 'Ingresa el nombre del proveedor.');
            if (!progInput.value) fail(progInput, 'Selecciona la fecha programada.');
            if (entInput.value && progInput.value && entInput.value < progInput.value) {
                fail(entInput, 'No puede ser anterior a la fecha programada.');
            }
            if (!/^\d+\s*\/\s*\d+$/.test(compInput.value.trim())) fail(compInput, 'Usa el formato entregado/solicitado. Ej: 51/200.');
            if (!ok) return;

            list.unshift({
                id,
                proveedor: provInput.value.trim(),
                fechaProg: isoToDisplay(progInput.value),
                fechaEnt: isoToDisplay(entInput.value),
                completitud: compInput.value.replace(/\s+/g, ''),
                puntualidad: $('inputPuntualidad').value.trim() || '-',
                estado: 'Generar reclamo'
            });
            if (!writeList(KEYS.PEDIDOS, list)) return;

            state.pagePedidos = 1;
            renderPedidos();
            modalOf('modalAgregarPedido').hide();
            showToast(`Pedido #${id} agregado correctamente.`);
        });

        modalEl.addEventListener('hidden.bs.modal', () => {
            form.reset();
            clearInvalid(form);
        });
    }

    function initImportExcel() {
        const fileInput = $('fileInputPedidos');
        const btnProcess = $('btnProcesarExcel');
        const msg = $('importMessage');
        const modalEl = $('modalImportarExcel');

        // A. Plantilla con los encabezados correctos
        $('btnDescargarPlantillaPedidos').addEventListener('click', () => {
            if (typeof XLSX === 'undefined') {
                showBox(msg, 'error', 'No se pudo cargar la librería de Excel. Revisa tu conexión e inténtalo de nuevo.');
                return;
            }
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([
                ['ID', 'Proveedor', 'Fecha Programada', 'Fecha entregada', 'Completitud', 'Puntualidad'],
                [101, 'Ejemplo S.A.', '01/11/2023', '02/11/2023', '100/100', '1 día tarde']
            ]);
            XLSX.utils.book_append_sheet(wb, ws, 'Plantilla_Pedidos');
            XLSX.writeFile(wb, 'Plantilla_Carga_Pedidos.xlsx');
        });

        // B. El botón se habilita solo con un archivo elegido
        fileInput.addEventListener('change', () => {
            btnProcess.disabled = fileInput.files.length === 0;
            hideBox(msg);
        });

        // C. Procesar el archivo
        btnProcess.addEventListener('click', () => {
            const file = fileInput.files[0];
            if (!file) return;
            if (typeof XLSX === 'undefined') {
                showBox(msg, 'error', 'No se pudo cargar la librería de Excel. Revisa tu conexión e inténtalo de nuevo.');
                return;
            }

            const reader = new FileReader();
            reader.onerror = () => showBox(msg, 'error', 'No se pudo leer el archivo.');
            reader.onload = (ev) => {
                let rows;
                try {
                    const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
                    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
                } catch (err) {
                    showBox(msg, 'error', 'El archivo no es un Excel o CSV válido.');
                    return;
                }
                if (rows.length === 0) {
                    showBox(msg, 'error', 'El archivo no contiene filas para importar.');
                    return;
                }
                if (!('Proveedor' in rows[0]) || !('ID' in rows[0])) {
                    showBox(msg, 'error', 'No se encontraron los encabezados esperados.', ['Debe incluir al menos las columnas ID y Proveedor. Descarga la plantilla como referencia.']);
                    return;
                }

                const existing = readList(KEYS.PEDIDOS);
                const usedIds = new Set(existing.map((p) => String(p.id)));
                const imported = [];
                const skipped = [];
                let autoId = nextPedidoId(existing);

                rows.forEach((row, i) => {
                    const line = i + 2;  // la fila 1 es el encabezado
                    const proveedor = String(row['Proveedor'] ?? '').trim();
                    if (!proveedor) { skipped.push(`Fila ${line}: falta el proveedor.`); return; }

                    let id = String(row['ID'] ?? '').trim();
                    if (!id) {
                        while (usedIds.has(String(autoId))) autoId++;
                        id = String(autoId);
                    }
                    if (usedIds.has(id)) { skipped.push(`Fila ${line}: el ID ${id} ya existe.`); return; }
                    usedIds.add(id);

                    const numId = Number(id);
                    imported.push({
                        id: Number.isInteger(numId) && String(numId) === id ? numId : id,
                        proveedor,
                        fechaProg: excelCellToDisplay(row['Fecha Programada']),
                        fechaEnt: excelCellToDisplay(row['Fecha entregada']),
                        completitud: String(row['Completitud'] ?? '').trim() || '-',
                        puntualidad: String(row['Puntualidad'] ?? '').trim() || '-',
                        estado: 'Generar reclamo'
                    });
                });

                if (imported.length === 0) {
                    showBox(msg, 'error', 'No se importó ningún pedido.', skipped.slice(0, 6));
                    return;
                }
                if (!writeList(KEYS.PEDIDOS, imported.concat(existing))) return;

                state.pagePedidos = 1;
                renderPedidos();
                AppNotifications.add(`Se importaron <strong>${imported.length}</strong> pedidos desde Excel.`);
                fileInput.value = '';
                btnProcess.disabled = true;

                if (skipped.length) {
                    // Se queda abierto para que el usuario vea qué filas no entraron
                    const more = skipped.length > 6 ? [`…y ${skipped.length - 6} más.`] : [];
                    showBox(msg, 'warn', `Se importaron ${imported.length} pedidos. Se omitieron ${skipped.length}:`, skipped.slice(0, 6).concat(more));
                } else {
                    modalOf('modalImportarExcel').hide();
                    showToast(`Se importaron ${imported.length} pedidos.`);
                }
            };
            reader.readAsArrayBuffer(file);
        });

        modalEl.addEventListener('hidden.bs.modal', () => {
            fileInput.value = '';
            btnProcess.disabled = true;
            hideBox(msg);
        });
    }

    /* ---------------------------------------------------------
       7. GRÁFICOS (CHART.JS)
       Los colores salen de las variables de app.css para mantener la paleta.
       --------------------------------------------------------- */
    const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    function chartFont() {
        return { family: getComputedStyle(document.body).fontFamily, size: 12 };
    }

    function renderStockChart() {
        const canvas = $('stockPieChart');
        if (!canvas || typeof Chart === 'undefined') return;

        // Suma el stock por proveedor
        const totals = readList(KEYS.REPONER).reduce((acc, item) => {
            const name = item.proveedor || 'Sin proveedor';
            acc[name] = (acc[name] || 0) + (parseFloat(item.stock) || 0);
            return acc;
        }, {});

        // Alternan rojos y ámbar/neutros para distinguir porciones sin salir de la paleta
        const palette = ['--red-600', '--amber-400', '--red-300', '--red-900', '--amber-700', '--red-400', '--text-muted', '--red-200']
            .map(cssVar);
        const labels = Object.keys(totals);

        if (state.stockChart) state.stockChart.destroy();
        state.stockChart = new Chart(canvas, {
            type: 'pie',
            data: {
                labels,
                datasets: [{
                    data: Object.values(totals),
                    backgroundColor: labels.map((_, i) => palette[i % palette.length]),
                    borderWidth: 2,
                    borderColor: cssVar('--surface'),
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: chartFont() } },
                    tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed} unidades` } }
                }
            }
        });
    }

    function renderPricesChart(product) {
        const canvas = $('preciosBarChart');
        if (!canvas || typeof Chart === 'undefined') return;

        // Cotizaciones del producto, de la más barata a la más cara
        const quotes = readList(KEYS.PRECIOS)
            .filter((q) => q.producto === product)
            .sort((a, b) => a.precio - b.precio);

        // La más barata se resalta con el rojo de acento
        const colors = quotes.map((_, i) => (i === 0 ? cssVar('--red-600') : cssVar('--red-200')));

        if (state.preciosChart) state.preciosChart.destroy();
        state.preciosChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: quotes.map((q) => q.proveedor),
                datasets: [{
                    label: 'Precio de compra (S/)',
                    data: quotes.map((q) => q.precio),
                    backgroundColor: colors,
                    borderRadius: 4,
                    maxBarThickness: 22
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (c) => `S/ ${c.parsed.x.toFixed(2)}` } }
                },
                scales: {
                    x: { beginAtZero: true, title: { display: true, text: 'Precio (Soles)', font: chartFont() }, ticks: { font: chartFont() } },
                    y: { grid: { display: false }, ticks: { font: chartFont() } }
                }
            }
        });
    }

    function initPriceComparator() {
        const select = $('selectProductoPrecio');
        const products = [...new Set(readList(KEYS.PRECIOS).map((q) => q.producto))].sort();
        if (products.length === 0) return;

        select.replaceChildren(new Option('Seleccione un producto', '', false, false));
        select.options[0].disabled = true;
        products.forEach((p) => select.add(new Option(p, p)));

        select.addEventListener('change', () => renderPricesChart(select.value));

        // Se muestra el primer producto para que el gráfico no aparezca vacío
        select.value = products[0];
        renderPricesChart(products[0]);
    }

    /* ---------------------------------------------------------
       8. ORDEN DE COMPRA DESDE EL COMPARADOR
       --------------------------------------------------------- */
    function openCompraModal() {
        const product = $('selectProductoPrecio').value;
        if (!product) {
            showToast('Selecciona primero un producto en el comparador.', 'warn');
            return;
        }

        $('compraProducto').value = product;

        const quotes = readList(KEYS.PRECIOS)
            .filter((q) => q.producto === product)
            .sort((a, b) => a.precio - b.precio);

        const select = $('compraProveedor');
        select.replaceChildren();
        quotes.forEach((q, i) => {
            const opt = new Option(`${q.proveedor} (S/ ${Number(q.precio).toFixed(2)})`, String(q.precio), false, i === 0);
            opt.dataset.nombre = q.proveedor;
            select.add(opt);
        });

        $('compraCantidad').value = '';
        $('compraFecha').value = '';
        $('compraFecha').min = todayIso();
        updateUnitPrice();
        modalOf('modalOrdenCompra').show();
    }

    function updateUnitPrice() {
        const select = $('compraProveedor');
        if (select.options.length > 0) $('compraPrecioUnitario').value = parseFloat(select.value).toFixed(2);
        updateTotal();
    }

    function updateTotal() {
        const price = parseFloat($('compraPrecioUnitario').value) || 0;
        const qty = parseInt($('compraCantidad').value, 10) || 0;
        $('compraTotal').value = `S/ ${(price * qty).toFixed(2)}`;
    }

    function initFormCompra() {
        const form = $('formOrdenCompra');
        autoClearInvalid(form);
        $('compraProveedor').addEventListener('change', updateUnitPrice);
        $('compraCantidad').addEventListener('input', updateTotal);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            clearInvalid(form);

            const qtyInput = $('compraCantidad');
            const dateInput = $('compraFecha');
            const qty = Number(qtyInput.value);
            let ok = true;
            const fail = (input, msg) => { if (ok) input.focus(); setInvalid(input, msg); ok = false; };

            if (!qtyInput.value || !Number.isInteger(qty) || qty < 1) fail(qtyInput, 'Ingresa una cantidad entera mayor a 0.');
            if (!dateInput.value) fail(dateInput, 'Selecciona la fecha esperada de entrega.');
            else if (dateInput.value < todayIso()) fail(dateInput, 'La fecha no puede ser anterior a hoy.');
            if (!ok) return;

            const select = $('compraProveedor');
            const proveedor = select.options[select.selectedIndex].dataset.nombre;
            const producto = $('compraProducto').value;

            const list = readList(KEYS.PEDIDOS);
            const id = nextPedidoId(list);
            list.unshift({
                id,
                proveedor,
                fechaProg: isoToDisplay(dateInput.value),
                fechaEnt: '-',                 // pendiente de entrega
                completitud: 'En proceso',
                puntualidad: '-',
                estado: 'Generar reclamo'
            });
            if (!writeList(KEYS.PEDIDOS, list)) return;

            state.pagePedidos = 1;
            renderPedidos();
            AppNotifications.add(`Se ha generado una orden de compra por ${qty} und. de <strong>${esc(producto)}</strong> a <strong>${esc(proveedor)}</strong>.`);
            modalOf('modalOrdenCompra').hide();
            showToast(`Orden de compra #${id} generada.`);
        });

        $('modalOrdenCompra').addEventListener('hidden.bs.modal', () => {
            form.reset();
            clearInvalid(form);
            $('compraTotal').value = 'S/ 0.00';
        });
    }

    /* ---------------------------------------------------------
       9. SELECTOR DE SEDE (modo demostración)
       La sede elegida se comparte con los otros módulos (AppSede).
       --------------------------------------------------------- */
    function initSede() {
        const select = $('sedeSelect');
        select.replaceChildren(...AppConfig.SEDES.map((name) => new Option(name, name)));
        select.value = AppSede.load();

        select.addEventListener('change', () => {
            AppSede.save(select.value);
            AppNotifications.add(`Cargando panel operativo de la sede <strong>${esc(select.value)}</strong> (modo demostración unificado).`);

            // Efecto visual breve de "recarga" en las tablas
            const cards = document.querySelectorAll('.table-card');
            cards.forEach((c) => c.classList.add('is-reloading'));
            setTimeout(() => cards.forEach((c) => c.classList.remove('is-reloading')), 400);
        });
    }

    /* ---------------------------------------------------------
       10. INICIO Y EVENTOS (delegación: no hay onclick en el HTML)
       --------------------------------------------------------- */
    function bindEvents() {
        // Botones de acción en las tablas
        document.querySelector('#tablaReponer tbody').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="notificar"]');
            if (btn && !btn.disabled) openNotificarModal(btn.dataset.id);
        });

        const pedidosBody = document.querySelector('#tablaPedidos tbody');
        pedidosBody.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="reclamar"]');
            if (btn) {
                if (!btn.disabled) openReclamoModal(btn.dataset.id);
                return;
            }
            const td = e.target.closest('[data-edit]');
            if (td) startEdit(td);
        });
        // Teclado: Enter o espacio sobre una celda editable
        pedidosBody.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-edit]')) {
                e.preventDefault();
                startEdit(e.target);
            }
        });

        // Paginación
        bindPagination($('paginacionReponer'), (p) => { state.pageReponer = p; renderReponer(); });
        bindPagination($('paginacionPedidos'), (p) => { state.pagePedidos = p; renderPedidos(); });

        // Modales de documentos y comparador
        $('btnConfirmarNotificacion').addEventListener('click', confirmNotificacion);
        $('btnConfirmarReclamo').addEventListener('click', confirmReclamo);
        $('btnComprar').addEventListener('click', openCompraModal);

        // Si otra pestaña modifica los datos, esta se actualiza
        window.addEventListener('storage', (e) => {
            if (e.key === KEYS.PEDIDOS) renderPedidos();
            if (e.key === KEYS.REPONER) { renderReponer(); renderStockChart(); }
        });
    }

    function init() {
        seedData();
        initSede();
        renderReponer();
        renderPedidos();
        renderStockChart();
        initPriceComparator();
        initFormPedido();
        initImportExcel();
        initFormCompra();
        bindEvents();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();