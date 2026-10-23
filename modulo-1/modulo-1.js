/* =========================================================
   MÓDULO 1: PRODUCTOS Y GANANCIAS
   (El sidebar, la campana de notificaciones y las utilidades comunes
    viven en ../shared/app.js)
   Organización del código:
     2.1  Configuración
     2.2  Utilidades
     2.3  Store      -> persistencia en localStorage
     2.4  Dominio    -> cálculos (margen, rotación), orden y búsqueda
     2.5  Excel      -> plantilla e importación con SheetJS
     2.6  Scanner    -> cámara y código de barras con html5-qrcode
     2.7  Estado y referencias al DOM
     2.8  UI         -> renderizado de la vista
     2.9  Acciones   -> importar, agregar producto, transferir
     2.10 Eventos e inicio
   ========================================================= */
(function () {
    'use strict';

    /* ---------------------------------------------------------
       2.1 CONFIGURACIÓN
       --------------------------------------------------------- */
    const STORAGE_KEY = 'modulo1_productos_v1';  // datos del módulo (clave propia)
    const { SEDES } = AppConfig;                 // sedes disponibles (compartidas en toda la app)
    const CURRENCY = 'S/';                       // símbolo de moneda
    const LOCALE = 'es-PE';                      // formato de números
    const PAGE_SIZE = 10;                        // filas por página
    const MAX_TRANSFERS_LOG = 200;               // traslados que se conservan en el registro
    const MAX_SUGGESTIONS = 500;                 // sugerencias en el buscador del traslado
    const MAX_BRAND_LENGTH = 60;                 // NUEVO: Campo Marca -> largo máximo (igual que el maxlength del input)

    // Columnas de la plantilla. "aliases" permite reconocer encabezados parecidos al importar.
    // El margen de ganancia no se importa: se calcula con precio y costo.
    // NUEVO: Campo Marca. Cada columna tiene ahora "excelHeader": el encabezado en MAYÚSCULAS que lleva la plantilla.
    //        Los aliases incluyen esos encabezados (con unidad) para que el archivo vuelva a importarse sin problemas.
    const COLUMNS = [
        { key: 'sku', header: 'SKU', excelHeader: 'SKU', required: true, aliases: ['sku', 'codigo', 'codigo sku', 'codigo de producto'], help: 'Código único del producto dentro de la sede', example: 'SKU-001' },
        { key: 'producto', header: 'Nombre del Producto', excelHeader: 'NOMBRE DEL PRODUCTO', required: true, aliases: ['nombre del producto', 'producto', 'nombre', 'descripcion'], help: 'Nombre del producto', example: 'Leche entera 1 L' },
        // NUEVO: Campo Marca (opcional, para que los archivos antiguos sin esta columna sigan importándose)
        { key: 'marca', header: 'Marca', excelHeader: 'MARCA', required: false, aliases: ['marca', 'fabricante'], help: 'Marca del producto. Si se deja vacío queda sin marca', example: 'Gloria' },
        { key: 'stock', header: 'Stock', excelHeader: 'STOCK', required: true, aliases: ['stock', 'cantidad', 'existencias'], help: 'Unidades disponibles', example: 120 },
        { key: 'costo', header: 'Costo', excelHeader: 'COSTO (S/)', required: true, aliases: ['costo', 'costo (s/)', 'costo unitario', 'costo por unidad'], help: `Costo por unidad en ${CURRENCY}`, example: 3.5 },
        { key: 'precio', header: 'Precio de Venta', excelHeader: 'PRECIO DE VENTA (S/)', required: true, aliases: ['precio de venta', 'precio de venta (s/)', 'precio venta', 'precio', 'pvp'], help: `Precio de venta por unidad en ${CURRENCY}`, example: 4.9 },
        { key: 'ventas', header: 'Ventas', excelHeader: 'VENTAS', required: false, aliases: ['ventas', 'unidades vendidas'], help: 'Unidades vendidas en el periodo. Si se deja vacío se asume 0', example: 360 },
        { key: 'rotacion', header: 'Rotación', excelHeader: 'ROTACIÓN', required: false, aliases: ['rotacion', 'indice de rotacion'], help: 'Veces que rota el inventario. Si se deja vacío se calcula como Ventas / Stock', example: 3 }
    ];

    // Columnas ordenables: etiqueta para el chip y tipo de dato
    const SORT_COLUMNS = {
        sku: { label: 'SKU', type: 'text' },
        producto: { label: 'nombre', type: 'text' },
        marca: { label: 'marca', type: 'text' },  // NUEVO: Campo Marca
        stock: { label: 'stock', type: 'number' },
        costo: { label: 'costo', type: 'number' },
        precio: { label: 'precio', type: 'number' },
        margen: { label: 'margen', type: 'number' },
        ventas: { label: 'ventas', type: 'number' },
        rotacion: { label: 'rotación', type: 'number' }
    };

    /* ---------------------------------------------------------
       2.2 UTILIDADES
       --------------------------------------------------------- */
    const $ = (id) => document.getElementById(id);

    // Utilidades comunes (escape HTML, normalización, paginación, mensajes y validación)
    const { esc, normalize, renderPagination, bindPagination, showBox, hideBox, setInvalid, clearInvalid, autoClearInvalid } = AppUtils;

    const isBlank = (v) => String(v ?? '').trim() === '';
    const isNonNegative = (n) => Number.isFinite(n) && n >= 0;
    const roundQty = (n) => Math.round(n * 1000) / 1000;  // evita errores de coma flotante

    const fmtNumber = (n) => Number(n).toLocaleString(LOCALE, { maximumFractionDigits: 2 });
    const fmtDecimal = (n) => Number(n).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtMoney = (n) => `${CURRENCY} ${fmtDecimal(n)}`;
    const fmtPercent = (n) => `${Number(n).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

    // Convierte a número aceptando coma decimal y símbolos de moneda; devuelve NaN si no es válido
    function parseNumber(v) {
        if (typeof v === 'number') return v;
        let s = String(v ?? '').replace(/[^\d.,\-]/g, '');
        if (s === '') return NaN;
        if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '');  // 1,234.50
        else s = s.replace(',', '.');                                     // 12,5
        return Number(s);
    }

    /* ---------------------------------------------------------
       2.3 STORE: persistencia en localStorage
       Estructura guardada en STORAGE_KEY:
       {
         sedes: { "Panamericana": { importedAt, fileName, products: [...] }, "Av. Grau": {...} },
         transfers: [ { id, fecha, origen, destino, sku, producto, cantidad, motivo } ]
       }
       Cada producto: { sku, producto, marca, stock, costo, precio, ventas, rotacion|null }
       (marca es nuevo: los productos guardados antes de este cambio no la tienen y se muestran con "—")
       --------------------------------------------------------- */
    const Store = {
        empty() {
            return { sedes: {}, transfers: [] };
        },

        // Lee y valida lo guardado; si algo falla, devuelve un almacén vacío
        load() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return Store.empty();
                const parsed = JSON.parse(raw);
                const data = Store.empty();
                SEDES.forEach((name) => {
                    const s = parsed && parsed.sedes && parsed.sedes[name];
                    if (s && Array.isArray(s.products)) {
                        data.sedes[name] = { importedAt: s.importedAt || null, fileName: s.fileName || '', products: s.products };
                    }
                });
                if (parsed && Array.isArray(parsed.transfers)) data.transfers = parsed.transfers;
                return data;
            } catch (e) {
                return Store.empty();  // JSON dañado o almacenamiento bloqueado
            }
        },

        save(data) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                return true;
            } catch (e) {
                return false;  // almacenamiento lleno o bloqueado
            }
        },

        clear() {
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* se ignora */ }
        },

        // Última sede vista (compartida con los demás módulos)
        loadSede() {
            return AppSede.load();
        },

        saveSede(name) {
            AppSede.save(name);
        }
    };

    /* ---------------------------------------------------------
       2.4 DOMINIO: cálculos, orden y búsqueda
       --------------------------------------------------------- */

    // Margen sobre el precio de venta: (precio - costo) / precio. Null si no hay precio.
    const calcMargen = (p) => (p.precio > 0 ? ((p.precio - p.costo) / p.precio) * 100 : null);

    // Rotación: la importada si existe; si no, ventas / stock. Null si no hay stock.
    const calcRotacion = (p) => (Number.isFinite(p.rotacion) ? p.rotacion : (p.stock > 0 ? p.ventas / p.stock : null));

    // Copia de los productos con las métricas calculadas (solo para mostrar)
    // NUEVO: Campo Marca -> los productos guardados antes del cambio no traen marca: se normaliza a ''
    const withMetrics = (products) => products.map((p) => ({ ...p, marca: p.marca ?? '', margen: calcMargen(p), rotacion: calcRotacion(p) }));

    // Dirección inicial al ordenar por una columna nueva: texto A-Z, números de mayor a menor
    const firstDirection = (key) => (SORT_COLUMNS[key].type === 'text' ? 'asc' : 'desc');

    // Compara dos filas según el orden actual. Los valores vacíos van siempre al final.
    function compareRows(a, b) {
        const { sortKey, sortDir } = state;
        const dir = sortDir === 'asc' ? 1 : -1;
        const va = a[sortKey];
        const vb = b[sortKey];

        if (SORT_COLUMNS[sortKey].type === 'text') {
            // NUEVO: Campo Marca -> los productos sin marca van siempre al final
            if (isBlank(va) || isBlank(vb)) return isBlank(va) && isBlank(vb) ? 0 : (isBlank(va) ? 1 : -1);
            return String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' }) * dir;
        }
        if (va == null || vb == null) return va == null && vb == null ? 0 : (va == null ? 1 : -1);
        return (va - vb) * dir || String(a.sku).localeCompare(String(b.sku), 'es', { numeric: true });
    }

    // Busca un producto por SKU exacto, nombre exacto o coincidencia parcial única
    function resolveProduct(products, query) {
        const q = normalize(query);
        if (!q) return { error: 'Ingresa el nombre o SKU del producto.' };

        const bySku = products.find((p) => normalize(p.sku) === q);
        if (bySku) return { product: bySku };

        const byName = products.filter((p) => normalize(p.producto) === q);
        if (byName.length === 1) return { product: byName[0] };

        const partial = products.filter((p) => normalize(`${p.sku} ${p.producto} ${p.marca ?? ''}`).includes(q));  // NUEVO: Campo Marca
        if (partial.length === 1) return { product: partial[0] };
        if (partial.length > 1 || byName.length > 1) {
            return { error: 'Hay varios productos que coinciden. Escribe el SKU exacto o elige uno de la lista.' };
        }
        return { error: 'No se encontró ese producto en la sede de origen.' };
    }

    /* ---------------------------------------------------------
       2.5 EXCEL: plantilla e importación (SheetJS)
       --------------------------------------------------------- */
    const Excel = {
        // NUEVO: Plantilla profesional. Descarga un libro con 2 hojas:
        //   "Productos"     -> bloque de instrucciones arriba + encabezados en MAYÚSCULAS + columnas anchas
        //   "Instrucciones" -> descripción, obligatoriedad y ejemplo de cada columna
        // Nota: SheetJS (versión gratuita) no escribe estilos de celda (negrita, colores), por eso el orden
        //       visual se logra con filas de instrucciones combinadas, alturas de fila y anchos de columna.
        downloadTemplate() {
            if (typeof XLSX === 'undefined') {
                throw new Error('No se pudo cargar la librería de Excel. Revisa tu conexión a internet.');
            }
            const wb = XLSX.utils.book_new();
            const lastCol = COLUMNS.length - 1;

            // NUEVO: filas de instrucciones que van encima de los encabezados (el importador las salta solo)
            const instructions = [
                'PLANTILLA DE CARGA DE PRODUCTOS · GRUPO SAN JOSÉ',
                'Completa los datos desde la fila {DATA}. No modifiques, muevas ni borres los encabezados de la fila {HEAD}.',
                'Obligatorios: SKU, NOMBRE DEL PRODUCTO, STOCK, COSTO (S/) y PRECIO DE VENTA (S/). Opcionales: MARCA, VENTAS y ROTACIÓN.',
                'El SKU no puede repetirse. Escribe solo números en stock, costo y precio. El margen de ganancia se calcula solo.'
            ];
            const headRow = instructions.length + 1;   // fila de Excel donde van los encabezados
            const dataRow = headRow + 1;               // primera fila para escribir productos
            const lines = instructions.map((t) => t.replace('{HEAD}', headRow).replace('{DATA}', dataRow));

            // Encabezados limpios y en mayúsculas (incluye la nueva columna MARCA)
            const aoa = lines.map((t) => [t]);
            aoa.push(COLUMNS.map((c) => c.excelHeader));
            const sheet = XLSX.utils.aoa_to_sheet(aoa);

            // NUEVO: ancho de columnas (en caracteres) para que nada se corte
            const widths = { sku: 18, producto: 40, marca: 22, stock: 12, costo: 16, precio: 24, ventas: 12, rotacion: 14 };
            sheet['!cols'] = COLUMNS.map((c) => ({ wch: widths[c.key] || 18 }));

            // NUEVO: cada línea de instrucciones ocupa todo el ancho de la tabla (celdas combinadas)
            sheet['!merges'] = lines.map((_, r) => ({ s: { r, c: 0 }, e: { r, c: lastCol } }));

            // NUEVO: alturas de fila (título y encabezados más altos)
            sheet['!rows'] = lines.map((_, r) => ({ hpx: r === 0 ? 28 : 20 })).concat([{ hpx: 26 }]);

            XLSX.utils.book_append_sheet(wb, sheet, 'Productos');

            // El ejemplo vive solo en la hoja de ayuda y nunca se importa
            const help = [['COLUMNA', 'OBLIGATORIA', 'DESCRIPCIÓN', 'EJEMPLO']]
                .concat(COLUMNS.map((c) => [c.excelHeader, c.required ? 'Sí' : 'No', c.help, c.example]));
            help.push(['MARGEN DE GANANCIA', 'No aplica', 'Se calcula automáticamente: (Precio de Venta - Costo) / Precio de Venta', '']);
            const helpSheet = XLSX.utils.aoa_to_sheet(help);
            helpSheet['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 80 }, { wch: 18 }];
            helpSheet['!rows'] = [{ hpx: 24 }];
            XLSX.utils.book_append_sheet(wb, helpSheet, 'Instrucciones');

            XLSX.writeFile(wb, 'plantilla_productos.xlsx');
        },

        // Lee el archivo y devuelve un workbook (CSV como texto UTF-8, Excel como binario)
        readWorkbook(file) {
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
        },

        // Convierte el archivo en productos limpios. Devuelve { rows, skipped, errors }
        async parse(file) {
            if (typeof XLSX === 'undefined') {
                throw new Error('No se pudo cargar la librería de Excel. Revisa tu conexión a internet.');
            }

            const wb = await Excel.readWorkbook(file);

            // Usa la hoja "Productos" si existe; si no, la primera
            const sheetName = wb.SheetNames.find((n) => normalize(n) === 'productos') || wb.SheetNames[0];
            const ws = wb.Sheets[sheetName];

            // NUEVO: se lee como matriz para poder saltar las filas de instrucciones de la plantilla.
            // Los encabezados se buscan en las primeras filas (la plantilla antigua los trae en la fila 1).
            const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: true });
            const firstRow = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).s.r : 0;  // fila inicial real de la hoja
            const headIdx = Excel.findHeaderRow(grid);
            const body = grid.slice(headIdx + 1);

            if (body.every((r) => r.every((v) => isBlank(v)))) {
                throw new Error('El archivo no contiene filas de datos. Completa la plantilla e inténtalo de nuevo.');
            }

            // Relaciona los encabezados del archivo con las claves internas (por posición de columna)
            const headerMap = {};  // índice de columna -> clave interna
            (grid[headIdx] || []).forEach((original, colIdx) => {
                const col = COLUMNS.find((c) => c.aliases.includes(normalize(original)));
                if (col && !Object.values(headerMap).includes(col.key)) headerMap[colIdx] = col.key;
            });

            const missing = COLUMNS.filter((c) => c.required && !Object.values(headerMap).includes(c.key));
            if (missing.length) {
                const err = new Error('Faltan columnas obligatorias. Usa la plantilla predeterminada.');
                err.details = missing.map((c) => c.header);
                throw err;
            }

            const rows = [];
            const errors = [];
            const seen = new Map();  // SKU normalizado -> fila donde apareció

            body.forEach((raw, i) => {
                const line = firstRow + headIdx + i + 2;  // fila real en Excel

                // Las filas totalmente vacías se ignoran sin contarlas como error
                if (raw.every((v) => isBlank(v))) return;

                const rec = {};
                Object.entries(headerMap).forEach(([colIdx, key]) => { rec[key] = raw[colIdx]; });

                const sku = String(rec.sku ?? '').trim();
                const producto = String(rec.producto ?? '').trim();
                const marca = String(rec.marca ?? '').trim();  // NUEVO: Campo Marca (opcional)
                const stock = parseNumber(rec.stock);
                const costo = parseNumber(rec.costo);
                const precio = parseNumber(rec.precio);
                const ventas = isBlank(rec.ventas) ? 0 : parseNumber(rec.ventas);
                const rotacion = isBlank(rec.rotacion) ? null : parseNumber(rec.rotacion);

                // Validaciones por fila: si falla una, la fila se omite y se informa
                const problems = [];
                if (!sku) problems.push('falta el SKU');
                else if (seen.has(normalize(sku))) problems.push(`SKU duplicado (ya aparece en la fila ${seen.get(normalize(sku))})`);
                if (!producto) problems.push('falta el nombre del producto');
                if (marca.length > MAX_BRAND_LENGTH) problems.push(`la marca supera ${MAX_BRAND_LENGTH} caracteres`);  // NUEVO: Campo Marca
                if (!isNonNegative(stock)) problems.push('stock inválido');
                if (!isNonNegative(costo)) problems.push('costo inválido');
                if (!isNonNegative(precio)) problems.push('precio de venta inválido');
                if (!isNonNegative(ventas)) problems.push('ventas inválidas');
                if (rotacion !== null && !isNonNegative(rotacion)) problems.push('rotación inválida');

                if (problems.length) {
                    errors.push(`Fila ${line}: ${problems.join(', ')}`);
                    return;
                }

                seen.set(normalize(sku), line);
                rows.push({ sku, producto, marca, stock, costo, precio, ventas, rotacion });  // NUEVO: marca se guarda con el producto
            });

            return { rows, skipped: errors.length, errors };
        },

        // NUEVO: busca la fila de encabezados dentro de las primeras filas (salta las instrucciones de la plantilla).
        // Es la primera fila donde al menos 2 celdas coinciden con un encabezado conocido; si no hay, usa la primera.
        findHeaderRow(grid) {
            const known = COLUMNS.flatMap((c) => c.aliases);
            const limit = Math.min(grid.length, 15);
            for (let i = 0; i < limit; i++) {
                const hits = grid[i].filter((v) => !isBlank(v) && known.includes(normalize(v))).length;
                if (hits >= 2) return i;
            }
            return 0;
        }
    };

    /* ---------------------------------------------------------
       2.6 SCANNER: cámara y código de barras (html5-qrcode)
       --------------------------------------------------------- */
    const Scanner = {
        instance: null,
        starting: false,
        running: false,
        stopRequested: false,

        isPermissionError(err) {
            return /permission|notallowed|denied/i.test(String((err && err.message) || err || ''));
        },

        // Traduce los errores de la cámara a mensajes comprensibles
        describeError(err) {
            const text = String((err && err.message) || err || '');
            if (Scanner.isPermissionError(err)) {
                return 'No se concedió el permiso para usar la cámara. Habilítalo en la configuración del navegador y vuelve a intentarlo.';
            }
            if (/notfound|no camera|devicenotfound|requested device not found/i.test(text)) {
                return 'No se encontró una cámara en este dispositivo.';
            }
            if (/notreadable|in use|could not start video/i.test(text)) {
                return 'No se pudo acceder a la cámara. Puede estar siendo usada por otra aplicación.';
            }
            return text || 'No se pudo iniciar la cámara.';
        },

        // Abre la cámara (pide permiso) y llama a onCode con el primer código detectado
        async start(onCode) {
            if (Scanner.starting || Scanner.running) return;

            if (typeof Html5Qrcode === 'undefined') {
                throw new Error('No se pudo cargar la librería del escáner. Revisa tu conexión a internet.');
            }
            if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('La cámara solo está disponible en páginas seguras (HTTPS o localhost).');
            }

            Scanner.starting = true;
            Scanner.stopRequested = false;
            let handled = false;  // evita procesar el mismo código varias veces

            const onSuccess = (text) => {
                if (handled) return;
                handled = true;
                if (navigator.vibrate) navigator.vibrate(80);
                onCode(text);
            };

            try {
                const F = Html5QrcodeSupportedFormats;
                const inst = new Html5Qrcode('barcodeReader', {
                    formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.CODE_93, F.ITF, F.CODABAR, F.QR_CODE],
                    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
                    verbose: false
                });
                Scanner.instance = inst;

                // Recuadro ancho y bajo: ideal para códigos de barras lineales
                const config = {
                    fps: 10,
                    qrbox: (w, h) => ({ width: Math.floor(w * 0.85), height: Math.floor(Math.max(Math.min(h * 0.6, 160), 60)) })
                };
                const noop = () => { };  // se llama en cada fotograma sin código: se ignora

                try {
                    // Cámara trasera si existe (aquí el navegador pide el permiso)
                    await inst.start({ facingMode: 'environment' }, config, onSuccess, noop);
                } catch (err) {
                    if (Scanner.isPermissionError(err)) throw err;
                    // Plan B: elegir una cámara de la lista
                    const cams = await Html5Qrcode.getCameras();
                    if (!cams || !cams.length) throw new Error('No se encontró una cámara en este dispositivo.');
                    await inst.start(cams[cams.length - 1].id, config, onSuccess, noop);
                }
                Scanner.running = true;
            } catch (err) {
                Scanner.starting = false;
                await Scanner.stop();
                throw err;
            }

            Scanner.starting = false;
            if (Scanner.stopRequested) await Scanner.stop();  // se pidió cerrar mientras arrancaba
        },

        // Apaga la cámara y libera el contenedor
        async stop() {
            if (Scanner.starting) {  // todavía arrancando: se cierra apenas termine
                Scanner.stopRequested = true;
                return;
            }
            const inst = Scanner.instance;
            Scanner.instance = null;
            Scanner.running = false;
            if (!inst) return;
            try { await inst.stop(); } catch (e) { /* no estaba activo */ }
            try { inst.clear(); } catch (e) { /* se ignora */ }
        }
    };

    /* ---------------------------------------------------------
       2.7 ESTADO Y REFERENCIAS AL DOM
       --------------------------------------------------------- */
    const el = {
        meta: $('importMeta'),
        filterVentas: $('filterVentas'),
        filterRotacion: $('filterRotacion'),
        sortChip: $('sortChip'),
        sortChipLabel: $('sortChipLabel'),
        sortChipDir: $('sortChipDir'),
        sortChipIcon: $('sortChipIcon'),
        search: $('searchInput'),
        tableBody: $('tableBody'),
        tableInfo: $('tableInfo'),
        pagination: $('pagination'),
        sortHeaders: document.querySelectorAll('th.sortable'),
        sedeSelect: $('sedeSelect'),
        toast: $('appToast'),
        toastText: $('toastText'),

        // Modal de importación
        importModal: $('importModal'),
        btnTemplate: $('btnTemplate'),
        importSede: $('importSede'),
        fileInput: $('fileInput'),
        btnImport: $('btnImport'),
        btnClear: $('btnClear'),
        importMessage: $('importMessage'),

        // Modal de producto
        productModal: $('productModal'),
        productForm: $('productForm'),
        productSede: $('productSede'),
        pSku: $('pSku'),
        pNombre: $('pNombre'),
        pMarca: $('pMarca'),  // NUEVO: Campo Marca
        pStock: $('pStock'),
        pVentas: $('pVentas'),
        pCosto: $('pCosto'),
        pPrecio: $('pPrecio'),
        productMessage: $('productMessage'),
        btnScan: $('btnScan'),
        btnScanIcon: $('btnScanIcon'),
        btnScanText: $('btnScanText'),
        scannerPanel: $('scannerPanel'),
        scannerStatus: $('scannerStatus'),
        scannerMessage: $('scannerMessage'),

        // Modal de traslado
        transferModal: $('transferModal'),
        transferForm: $('transferForm'),
        tOrigen: $('tOrigen'),
        tDestino: $('tDestino'),
        tProducto: $('tProducto'),
        transferProducts: $('transferProducts'),
        tCantidad: $('tCantidad'),
        tStockHint: $('tStockHint'),
        tMotivo: $('tMotivo'),
        transferMessage: $('transferMessage')
    };

    // Estado de la vista: datos guardados + sede, orden, búsqueda y página actuales
    const state = {
        data: Store.load(),
        sede: Store.loadSede(),
        search: '',
        sortKey: 'ventas',   // por defecto: los más vendidos primero
        sortDir: 'desc',
        page: 1
    };

    // Productos de una sede (arreglo vacío si no hay datos)
    const sedeProducts = (name, data = state.data) => (data.sedes[name] ? data.sedes[name].products : []);

    // Aplica un cambio sobre una copia de los datos y solo lo adopta si se pudo guardar.
    // Así la pantalla y el localStorage nunca quedan desfasados.
    function commit(mutator) {
        const draft = JSON.parse(JSON.stringify(state.data));
        mutator(draft);
        if (!Store.save(draft)) return false;
        state.data = draft;
        return true;
    }

    // Garantiza que exista la entrada de una sede dentro de los datos
    function ensureSede(draft, name) {
        if (!draft.sedes[name]) draft.sedes[name] = { importedAt: null, fileName: '', products: [] };
        return draft.sedes[name];
    }

    /* ---------------------------------------------------------
       2.8 UI: avisos (los mensajes y la validación son compartidos)
       --------------------------------------------------------- */

    // Aviso emergente de confirmación
    function notify(text) {
        el.toastText.textContent = text;
        bootstrap.Toast.getOrCreateInstance(el.toast, { delay: 4500 }).show();
    }

    const closeModal = (modalEl) => bootstrap.Modal.getOrCreateInstance(modalEl).hide();

    /* ---------------------------------------------------------
       2.8 UI: renderizado de la vista
       --------------------------------------------------------- */

    // Llena un <select> con las sedes (con opción de marcador opcional)
    function fillSedeOptions(select, { placeholder = false, exclude = null } = {}) {
        const options = SEDES.filter((s) => s !== exclude)
            .map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
        select.innerHTML = (placeholder ? '<option value="" disabled selected>Opción...</option>' : '') + options;
    }

    function renderMeta() {
        const sede = state.data.sedes[state.sede];
        const count = sede ? sede.products.length : 0;

        if (!count) {
            el.meta.textContent = `Sede ${state.sede} · aún no hay productos. Importa un Excel o agrega uno manualmente.`;
        } else if (sede.importedAt) {
            const when = new Date(sede.importedAt).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' });
            el.meta.textContent = `Sede ${state.sede} · Última importación: ${when} · ${sede.fileName} · ${count} productos`;
        } else {
            el.meta.textContent = `Sede ${state.sede} · ${count} productos registrados manualmente`;
        }
    }

    // Chip de orden, casillas del menú "Filtros" e iconos de los encabezados
    function renderSortControls() {
        const col = SORT_COLUMNS[state.sortKey];
        const asc = state.sortDir === 'asc';

        el.sortChipLabel.textContent = `Por ${col.label}`;
        el.sortChipDir.textContent = asc ? 'Asc.' : 'Desc.';
        el.sortChipIcon.className = `bi ${asc ? 'bi-arrow-up' : 'bi-arrow-down'}`;
        el.sortChip.setAttribute('aria-label', `Ordenado por ${col.label}, ${asc ? 'ascendente' : 'descendente'}. Cambiar el orden`);

        el.filterVentas.checked = state.sortKey === 'ventas';
        el.filterRotacion.checked = state.sortKey === 'rotacion';

        el.sortHeaders.forEach((th) => {
            const active = th.dataset.sort === state.sortKey;
            th.classList.toggle('sorted', active);
            th.setAttribute('aria-sort', active ? (asc ? 'ascending' : 'descending') : 'none');
            th.querySelector('.sort-icon').className = 'bi sort-icon ' + (active
                ? (asc ? 'bi-caret-up-fill' : 'bi-caret-down-fill')
                : 'bi-chevron-expand');
        });
    }

    function renderTable() {
        const all = withMetrics(sedeProducts(state.sede));
        const term = normalize(state.search);

        // 1) Filtrar por texto  2) Ordenar  3) Paginar
        const filtered = all.filter((r) => !term || normalize(`${r.sku} ${r.producto} ${r.marca}`).includes(term));  // NUEVO: Campo Marca (también se busca por marca)
        filtered.sort(compareRows);

        const total = filtered.length;
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        state.page = Math.min(state.page, pages);
        const start = (state.page - 1) * PAGE_SIZE;
        const slice = filtered.slice(start, start + PAGE_SIZE);

        // 4) Pintar filas o estado vacío
        if (slice.length === 0) {
            const text = all.length === 0
                ? `No hay productos en ${esc(state.sede)}. Importa un archivo Excel o agrega un producto.`
                : 'Ningún producto coincide con la búsqueda.';
            el.tableBody.innerHTML = `<tr class="table-empty"><td colspan="9">${text}</td></tr>`;
        } else {
            el.tableBody.innerHTML = slice.map((r) => {
                const margen = r.margen == null
                    ? '<span class="cell-empty">—</span>'
                    : `<span class="${r.margen < 0 ? 'margin-neg' : ''}">${fmtPercent(r.margen)}</span>`;
                const rotacion = r.rotacion == null
                    ? '<span class="cell-empty">—</span>'
                    : `${fmtDecimal(r.rotacion)}x`;
                // NUEVO: Campo Marca -> celda nueva (los productos sin marca muestran "—")
                const marcaCell = r.marca ? esc(r.marca) : '<span class="cell-empty">—</span>';
                return `<tr>
                    <td class="text-nowrap">${esc(r.sku)}</td>
                    <td>${esc(r.producto)}</td>
                    <td>${marcaCell}</td>
                    <td>${fmtNumber(r.stock)}</td>
                    <td class="text-nowrap">${fmtMoney(r.costo)}</td>
                    <td class="text-nowrap">${fmtMoney(r.precio)}</td>
                    <td class="text-nowrap">${margen}</td>
                    <td>${fmtNumber(r.ventas)}</td>
                    <td class="text-nowrap">${rotacion}</td>
                </tr>`;
            }).join('');
        }

        // 5) Información, paginación y controles de orden
        el.tableInfo.textContent = total ? `Mostrando ${start + 1}-${start + slice.length} de ${total}` : '';
        renderPagination(el.pagination, state.page, pages);
        renderSortControls();
    }

    function renderAll() {
        renderMeta();
        renderTable();
    }

    /* ---------------------------------------------------------
       2.9 ACCIONES: importar Excel
       --------------------------------------------------------- */
    async function handleImport() {
        const file = el.fileInput.files[0];
        if (!file) return;

        const target = el.importSede.value;
        hideBox(el.importMessage);
        el.btnImport.disabled = true;

        try {
            const result = await Excel.parse(file);

            if (result.rows.length === 0) {
                const err = new Error('No se encontró ninguna fila válida para importar.');
                err.details = result.errors.slice(0, 5);
                throw err;
            }

            // Guardado obligatorio en localStorage: reemplaza los productos de la sede elegida
            const saved = commit((draft) => {
                draft.sedes[target] = { importedAt: new Date().toISOString(), fileName: file.name, products: result.rows };
            });
            if (!saved) throw new Error('No se pudo guardar en el navegador (almacenamiento lleno o bloqueado).');

            // La vista pasa a la sede importada para mostrar el resultado
            state.sede = target;
            Store.saveSede(target);
            el.sedeSelect.value = target;
            state.search = '';
            el.search.value = '';
            state.page = 1;
            renderAll();
            el.fileInput.value = '';
            AppNotifications.add(`Se importaron <strong>${result.rows.length}</strong> productos en la sede <strong>${esc(target)}</strong>.`);

            if (result.skipped > 0) {
                // Se importó lo válido, pero se avisa de lo omitido y el modal queda abierto
                const more = result.skipped > 5 ? [`... y ${result.skipped - 5} filas más`] : [];
                showBox(
                    el.importMessage,
                    'warn',
                    `Se importaron ${result.rows.length} productos en ${target}. Se omitieron ${result.skipped} filas por errores.`,
                    [...result.errors.slice(0, 5), ...more]
                );
            } else {
                closeModal(el.importModal);
                notify(`Se importaron ${result.rows.length} productos en ${target}.`);
            }
        } catch (err) {
            showBox(el.importMessage, 'error', err.message, err.details || []);
            el.btnImport.disabled = !el.fileInput.files.length;
        }
    }

    function handleClear() {
        if (!window.confirm('Se eliminarán los productos de TODAS las sedes y el registro de traslados guardados en este navegador. ¿Continuar?')) return;
        Store.clear();
        state.data = Store.empty();
        state.page = 1;
        renderAll();
        el.fileInput.value = '';
        el.btnImport.disabled = true;
        closeModal(el.importModal);
        notify('Se eliminaron los datos guardados.');
    }

    /* ---------------------------------------------------------
       2.9 ACCIONES: agregar producto manualmente + escáner
       --------------------------------------------------------- */
    function handleSaveProduct(e) {
        e.preventDefault();
        hideBox(el.productMessage);

        const sku = el.pSku.value.trim();
        const nombre = el.pNombre.value.trim();
        const marca = el.pMarca.value.trim();  // NUEVO: Campo Marca (opcional)
        const stock = parseNumber(el.pStock.value);
        const costo = parseNumber(el.pCosto.value);
        const precio = parseNumber(el.pPrecio.value);
        const ventas = isBlank(el.pVentas.value) ? 0 : parseNumber(el.pVentas.value);

        // Cada validación marca su campo; si hay alguna falla, no se guarda
        let valid = true;
        const check = (input, ok, message) => {
            setInvalid(input, ok ? '' : message);
            if (!ok) valid = false;
        };

        const duplicated = sedeProducts(state.sede).some((p) => normalize(p.sku) === normalize(sku));
        check(el.pSku, sku !== '', 'Ingresa el código del producto.');
        if (sku) check(el.pSku, !duplicated, 'Este SKU ya existe en la sede.');
        check(el.pNombre, nombre !== '', 'Ingresa el nombre del producto.');
        check(el.pMarca, marca.length <= MAX_BRAND_LENGTH, `La marca no puede superar ${MAX_BRAND_LENGTH} caracteres.`);  // NUEVO: Campo Marca
        check(el.pStock, isNonNegative(stock), 'Ingresa un stock válido (0 o más).');
        check(el.pCosto, isNonNegative(costo), 'Ingresa un costo válido.');
        check(el.pPrecio, isNonNegative(precio), 'Ingresa un precio de venta válido.');
        check(el.pVentas, isNonNegative(ventas), 'Las ventas deben ser 0 o más.');

        if (!valid) {
            const firstInvalid = el.productForm.querySelector('.is-invalid');
            if (firstInvalid) firstInvalid.focus();
            return;
        }

        const saved = commit((draft) => {
            ensureSede(draft, state.sede).products.push({ sku, producto: nombre, marca, stock, costo, precio, ventas, rotacion: null });  // NUEVO: Campo Marca se guarda en localStorage con el resto
        });
        if (!saved) {
            showBox(el.productMessage, 'error', 'No se pudo guardar en el navegador (almacenamiento lleno o bloqueado).');
            return;
        }

        state.page = 1;
        renderAll();
        closeModal(el.productModal);
        notify(`Producto "${nombre}" agregado a ${state.sede}.`);
        AppNotifications.add(`Se agregó el producto <strong>${esc(nombre)}</strong> a la sede <strong>${esc(state.sede)}</strong>.`);
    }

    // --- Escáner: control de la interfaz ---
    function setScanButton(active) {
        el.btnScanText.textContent = active ? 'Detener cámara' : 'Escanear código de barras';
        el.btnScanIcon.className = `bi ${active ? 'bi-x-circle' : 'bi-upc-scan'} me-2`;
    }

    function hideScannerPanel() {
        el.scannerPanel.classList.add('d-none');
        setScanButton(false);
    }

    async function closeScanner() {
        await Scanner.stop();
        hideScannerPanel();
    }

    // Al detectar un código: se rellena el SKU, se apaga la cámara y se pasa al nombre
    function onBarcodeDetected(code) {
        el.pSku.value = String(code).trim();
        setInvalid(el.pSku, '');
        closeScanner().then(() => {
            notify(`Código detectado: ${el.pSku.value}`);
            el.pNombre.focus();
        });
    }

    async function openScanner() {
        hideBox(el.scannerMessage);
        el.scannerPanel.classList.remove('d-none');
        setScanButton(true);
        el.scannerStatus.textContent = 'Solicitando acceso a la cámara...';

        try {
            await Scanner.start(onBarcodeDetected);
            if (Scanner.running) el.scannerStatus.textContent = 'Apunta la cámara al código de barras.';
        } catch (err) {
            hideScannerPanel();
            showBox(el.scannerMessage, 'error', Scanner.describeError(err));
        }
    }

    function toggleScanner() {
        if (Scanner.running || Scanner.starting) closeScanner();
        else openScanner();
    }

    /* ---------------------------------------------------------
       2.9 ACCIONES: transferir a otra sede
       --------------------------------------------------------- */

    // Destino: todas las sedes menos el origen (si queda una sola, se elige sola)
    function fillDestinations() {
        const origen = el.tOrigen.value;
        fillSedeOptions(el.tDestino, { placeholder: true, exclude: origen || null });
        const options = SEDES.filter((s) => s !== origen);
        if (origen && options.length === 1) el.tDestino.value = options[0];
    }

    // Sugerencias del buscador: productos de la sede de origen
    function fillSuggestions() {
        el.transferProducts.innerHTML = sedeProducts(el.tOrigen.value)
            .slice(0, MAX_SUGGESTIONS)
            .map((p) => `<option value="${esc(p.sku)}">${esc(p.producto)}</option>`).join('');
    }

    // Muestra el stock disponible del producto elegido
    function updateTransferHint() {
        const { product } = resolveProduct(sedeProducts(el.tOrigen.value), el.tProducto.value);
        el.tStockHint.textContent = product
            ? `${product.producto} · stock disponible: ${fmtNumber(product.stock)}`
            : '';
    }

    function openTransferForm() {
        el.transferForm.reset();
        clearInvalid(el.transferForm);
        hideBox(el.transferMessage);
        fillSedeOptions(el.tOrigen, { placeholder: true });
        el.tOrigen.value = state.sede;  // por defecto, la sede que se está viendo
        fillDestinations();
        fillSuggestions();
        updateTransferHint();
    }

    function handleTransfer(e) {
        e.preventDefault();
        hideBox(el.transferMessage);

        const origen = el.tOrigen.value;
        const destino = el.tDestino.value;
        const qty = parseNumber(el.tCantidad.value);
        const motivo = el.tMotivo.value.trim();

        let valid = true;
        const check = (input, ok, message) => {
            setInvalid(input, ok ? '' : message);
            if (!ok) valid = false;
        };

        check(el.tOrigen, origen !== '', 'Selecciona la sede de origen.');
        check(el.tDestino, destino !== '', 'Selecciona la sede de destino.');
        if (origen && destino) check(el.tDestino, origen !== destino, 'El destino debe ser distinto al origen.');

        const found = origen ? resolveProduct(sedeProducts(origen), el.tProducto.value) : { error: 'Primero elige la sede de origen.' };
        check(el.tProducto, !found.error, found.error);

        check(el.tCantidad, Number.isFinite(qty) && qty > 0, 'Ingresa una cantidad mayor a 0.');
        if (found.product && Number.isFinite(qty) && qty > 0) {
            check(el.tCantidad, qty <= found.product.stock, `Stock disponible en el origen: ${fmtNumber(found.product.stock)}.`);
        }

        if (!valid) {
            const firstInvalid = el.transferForm.querySelector('.is-invalid');
            if (firstInvalid) firstInvalid.focus();
            return;
        }

        const product = found.product;
        const saved = commit((draft) => {
            // Descuenta del origen
            const src = sedeProducts(origen, draft).find((p) => p.sku === product.sku);
            src.stock = roundQty(src.stock - qty);

            // Suma al destino (o crea el producto si no existía allí)
            const dest = ensureSede(draft, destino);
            const existing = dest.products.find((p) => normalize(p.sku) === normalize(product.sku));
            if (existing) {
                existing.stock = roundQty(existing.stock + qty);
            } else {
                dest.products.push({ sku: src.sku, producto: src.producto, marca: src.marca ?? '', stock: qty, costo: src.costo, precio: src.precio, ventas: 0, rotacion: null });
            }

            // Registro del traslado (se conservan los más recientes)
            draft.transfers.unshift({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                fecha: new Date().toISOString(),
                origen,
                destino,
                sku: src.sku,
                producto: src.producto,
                cantidad: qty,
                motivo
            });
            draft.transfers = draft.transfers.slice(0, MAX_TRANSFERS_LOG);
        });

        if (!saved) {
            showBox(el.transferMessage, 'error', 'No se pudo guardar en el navegador (almacenamiento lleno o bloqueado).');
            return;
        }

        renderAll();
        closeModal(el.transferModal);
        notify(`Traslado registrado: ${fmtNumber(qty)} de "${product.producto}" de ${origen} a ${destino}.`);
        AppNotifications.add(`Traslado de <strong>${esc(fmtNumber(qty))}</strong> und. de <strong>${esc(product.producto)}</strong> de ${esc(origen)} a ${esc(destino)}.`);
    }

    /* ---------------------------------------------------------
       2.10 EVENTOS E INICIO
       --------------------------------------------------------- */

    // ---- Selector de sede ----
    el.sedeSelect.addEventListener('change', () => {
        state.sede = el.sedeSelect.value;
        Store.saveSede(state.sede);
        state.page = 1;
        renderAll();
    });

    // ---- Menú "Filtros": ordena por ventas o por rotación ----
    [el.filterVentas, el.filterRotacion].forEach((box) => {
        box.addEventListener('change', () => {
            if (box.checked) {
                state.sortKey = box.value;
                state.sortDir = 'desc';   // los de mayor ventas o rotación primero
            } else {
                state.sortKey = 'sku';    // sin criterio: orden alfabético por SKU
                state.sortDir = 'asc';
            }
            state.page = 1;
            renderTable();
        });
    });

    // ---- Chip: alterna ascendente / descendente ----
    el.sortChip.addEventListener('click', () => {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        state.page = 1;
        renderTable();
    });

    // ---- Tabla: ordenar al hacer clic (o Enter/Espacio) en un encabezado ----
    el.sortHeaders.forEach((th) => {
        const sortBy = () => {
            const key = th.dataset.sort;
            if (state.sortKey === key) {
                state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                state.sortKey = key;
                state.sortDir = firstDirection(key);
            }
            state.page = 1;
            renderTable();
        };
        th.addEventListener('click', sortBy);
        th.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortBy(); }
        });
    });

    // ---- Tabla: búsqueda y paginación ----
    el.search.addEventListener('input', () => {
        state.search = el.search.value;
        state.page = 1;
        renderTable();
    });

    bindPagination(el.pagination, (page) => {
        state.page = page;
        renderTable();
    });

    // ---- Modal de importación ----
    el.btnTemplate.addEventListener('click', () => {
        try {
            Excel.downloadTemplate();
        } catch (err) {
            showBox(el.importMessage, 'error', err.message);
        }
    });
    el.btnImport.addEventListener('click', handleImport);
    el.btnClear.addEventListener('click', handleClear);

    el.fileInput.addEventListener('change', () => {
        hideBox(el.importMessage);
        el.btnImport.disabled = !el.fileInput.files.length;
    });

    el.importModal.addEventListener('show.bs.modal', () => {
        el.importSede.value = state.sede;  // por defecto, la sede que se está viendo
    });

    el.importModal.addEventListener('hidden.bs.modal', () => {
        el.fileInput.value = '';
        el.btnImport.disabled = true;
        hideBox(el.importMessage);
    });

    // ---- Modal de agregar producto ----
    el.productForm.addEventListener('submit', handleSaveProduct);
    el.btnScan.addEventListener('click', toggleScanner);

    // Al escribir en un campo con error, se limpia su mensaje
    [el.productForm, el.transferForm].forEach(autoClearInvalid);

    el.productModal.addEventListener('show.bs.modal', () => {
        el.productForm.reset();
        clearInvalid(el.productForm);
        hideBox(el.productMessage);
        hideBox(el.scannerMessage);
        hideScannerPanel();
        el.productSede.textContent = state.sede;
    });

    // Importante: la cámara siempre se apaga al cerrar el modal
    el.productModal.addEventListener('hide.bs.modal', () => { closeScanner(); });
    window.addEventListener('pagehide', () => { Scanner.stop(); });

    // ---- Modal de traslado ----
    el.transferModal.addEventListener('show.bs.modal', openTransferForm);
    el.transferForm.addEventListener('submit', handleTransfer);

    el.tOrigen.addEventListener('change', () => {
        fillDestinations();
        fillSuggestions();
        updateTransferHint();
    });
    el.tProducto.addEventListener('input', updateTransferHint);
    el.tProducto.addEventListener('change', updateTransferHint);

    /* ---------------------------------------------------------
       Inicio: poblar selectores y repoblar la vista desde localStorage
       --------------------------------------------------------- */
    fillSedeOptions(el.sedeSelect);
    fillSedeOptions(el.importSede);
    el.sedeSelect.value = state.sede;
    renderAll();
})();