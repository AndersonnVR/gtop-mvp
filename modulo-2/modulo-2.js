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

// ==========================================
// 1. INICIALIZACIÓN Y DATOS DE PRUEBA (MOCK)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    inicializarDatos();
    renderTablaReponer();
    renderTablaPedidos();
    
    // Aquí luego llamaremos a la inicialización de gráficos (Fase 3)
    initGraficos();
});

function inicializarDatos() {
    // Datos semilla para "Productos Próximos a Reponer"
    if (!localStorage.getItem('productosReponer')) {
        const mockReponer = [
            { id: 1, producto: "Coca-Cola 2L", stock: 50, proveedor: "Coca-Cola", estado: "Notificar" },
            { id: 2, producto: "Papas Fritas", stock: 20, proveedor: "Frito Lay", estado: "Notificado" },
            { id: 3, producto: "Agua San Luis 625ml", stock: 15, proveedor: "Backus", estado: "Notificar" },
            { id: 4, producto: "Inca Kola 1.5L", stock: 12, proveedor: "Coca-Cola", estado: "Notificar" },
            { id: 5, producto: "Galletas Casino", stock: 18, proveedor: "Alicorp", estado: "Notificado" },
            { id: 6, producto: "Leche Gloria 400g", stock: 10, proveedor: "Gloria", estado: "Notificar" },
            { id: 7, producto: "Cerveza Cristal  personal", stock: 8, proveedor: "Backus", estado: "Notificar" },
            { id: 8, producto: "Chocolate Sublime", stock: 14, proveedor: "Nestlé", estado: "Notificado" },
            { id: 9, producto: "Energizante Volt 300ml", stock: 9, proveedor: "AJE", estado: "Notificar" }
        ];

        localStorage.setItem('productosReponer', JSON.stringify(mockReponer));
    }

    // Datos semilla para "Pedidos"
    if (!localStorage.getItem('pedidos')) {
        const mockPedidos = [
            { id: 400, proveedor: "Bimbo", fechaProg: "02/08/2023", fechaEnt: "02/08/2023", completitud: "51/200", puntualidad: "5 min tarde", estado: "Generar reclamo" },
            { id: 250, proveedor: "Juanito", fechaProg: "02/08/2023", fechaEnt: "23/08/2023", completitud: "67/67", puntualidad: "0 min tarde", estado: "Generar reclamo" }
        ];
        localStorage.setItem('pedidos', JSON.stringify(mockPedidos));
    }

    // Datos semilla para "Comparador de Precios" (Lo usaremos en la Fase 3)
    if (!localStorage.getItem('catalogoPrecios')) {
        const mockPrecios = [
            // Coca-Cola 2L
            { id: 1, producto: "Coca-Cola 2L", proveedor: "Coca-Cola (Directo)", precio: 8.50 },
            { id: 2, producto: "Coca-Cola 2L", proveedor: "Mayorista Makro", precio: 8.20 },
            { id: 3, producto: "Coca-Cola 2L", proveedor: "Vega Supermayorista", precio: 8.35 },
            { id: 4, producto: "Coca-Cola 2L", proveedor: "Distribuidora San Juan", precio: 8.70 },
            // Leche Gloria 400g
            { id: 5, producto: "Leche Gloria 400g", proveedor: "Gloria (Directo)", precio: 3.80 },
            { id: 6, producto: "Leche Gloria 400g", proveedor: "Mayorista Makro", precio: 3.65 },
            { id: 7, producto: "Leche Gloria 400g", proveedor: "Vega Supermayorista", precio: 3.70 },
            // Cerveza Cristal personal
            { id: 8, producto: "Cerveza Cristal personal", proveedor: "Backus (Directo)", precio: 4.00 },
            { id: 9, producto: "Cerveza Cristal personal", proveedor: "Mayorista Makro", precio: 3.85 },
            { id: 10, producto: "Cerveza Cristal personal", proveedor: "Distribuidora San Juan", precio: 4.10 },
            // Chocolate Sublime
            { id: 11, producto: "Chocolate Sublime", proveedor: "Nestlé (Directo)", precio: 1.50 },
            { id: 12, producto: "Chocolate Sublime", proveedor: "Mayorista Makro", precio: 1.35 },
            { id: 13, producto: "Chocolate Sublime", proveedor: "Vega Supermayorista", precio: 1.40 },
            // Agua San Luis 625ml
            { id: 14, producto: "Agua San Luis 625ml", proveedor: "Backus (Directo)", precio: 2.00 },
            { id: 15, producto: "Agua San Luis 625ml", proveedor: "Coca-Cola (Directo)", precio: 1.90 },
            { id: 16, producto: "Agua San Luis 625ml", proveedor: "Mayorista Makro", precio: 1.80 }
        ];
        localStorage.setItem('catalogoPrecios', JSON.stringify(mockPrecios));
    }
}

// ==========================================
// 2. RENDERIZADO DE TABLAS
// ==========================================

function renderTablaReponer() {
    const tbody = document.querySelector('#tablaReponer tbody');
    const datos = JSON.parse(localStorage.getItem('productosReponer')) || [];
    
    tbody.innerHTML = ''; // Limpiar tabla

    if (datos.length === 0) {
        tbody.innerHTML = `<tr class="table-empty"><td colspan="4">No hay productos próximos a reponer.</td></tr>`;
        return;
    }

    datos.forEach(item => {
        // Lógica visual para el botón de acción según tu diseño
        const btnClass = item.estado === 'Notificar' ? 'btn-brand' : 'btn-light text-muted border';
        const btnDisabled = item.estado === 'Notificado' ? 'disabled' : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.producto}</td>
            <td>${item.stock}</td>
            <td>${item.proveedor}</td>
            <td class="text-center">
                <button class="btn btn-sm ${btnClass} rounded-pill px-3" ${btnDisabled} onclick="abrirModalNotificar(${item.id})"">
                    ${item.estado}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTablaPedidos() {
    const tbody = document.querySelector('#tablaPedidos tbody');
    const datos = JSON.parse(localStorage.getItem('pedidos')) || [];
    
    tbody.innerHTML = '';

    if (datos.length === 0) {
        tbody.innerHTML = `<tr class="table-empty"><td colspan="7">No hay pedidos registrados.</td></tr>`;
        return;
    }

    datos.forEach(pedido => {
        // Lógica visual para el botón de reclamo según tu diseño
        const btnClass = pedido.estado === 'Generar reclamo' ? 'btn-outline-warning text-dark border-warning' : 'btn-light text-muted border';
        const btnDisabled = pedido.estado === 'Reclamado' ? 'disabled' : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${pedido.id}</td>
            <td>${pedido.proveedor}</td>
            <td>${pedido.fechaProg}</td>
            <td>${pedido.fechaEnt}</td>
            <td>${pedido.completitud}</td>
            <td>${pedido.puntualidad}</td>
            <td class="text-center">
                <button class="btn btn-sm ${btnClass} rounded-pill px-3" ${btnDisabled} onclick="abrirModalReclamo(${pedido.id})">
                    ${pedido.estado}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 7. LÓGICA DE RECLAMOS LEGALES A PROVEEDORES
// ==========================================

let idPedidoPorReclamar = null;

// Escuchar el clic del botón de confirmar en el modal de reclamos
document.addEventListener('DOMContentLoaded', () => {
    const btnConfirmarReclamo = document.getElementById('btnConfirmarReclamo');
    if (btnConfirmarReclamo) {
        btnConfirmarReclamo.addEventListener('click', confirmarReclamo);
    }
});

function abrirModalReclamo(id) {
    const datos = JSON.parse(localStorage.getItem('pedidos')) || [];
    const pedido = datos.find(d => d.id === id);
    if (!pedido) return;

    idPedidoPorReclamar = id;
    
    // Fecha actual para la emisión del documento
    const fechaHoy = new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Redacción formal y legal del reclamo
    const documentoLegal = `AVISO DE INCUMPLIMIENTO DE CONTRATO Y RECLAMO FORMAL

Fecha: ${fechaHoy}
A: Representante Legal / Área de Despachos de ${pedido.proveedor}
De: Departamento Legal y Compras - Grupo San José
Asunto: Incumplimiento de orden de compra #${pedido.id}

Por medio del presente documento, dejamos constancia formal del incumplimiento en las condiciones de entrega de la Orden de Compra #${pedido.id}, lo cual constituye una violación directa a la "Cláusula de Cumplimiento de Plazos y Entregas Completas" estipulada en nuestro contrato marco de suministro comercial.

Detalle explícito de las infracciones constatadas:

1. INPUNTUALIDAD EN LA ENTREGA:
   - Nivel de retraso registrado:  ${pedido.puntualidad}

2. INCOMPLETITUD DEL PEDIDO:
   - Nivel de completitud (Entregado/Solicitado): ${pedido.completitud}

Estas irregularidades generan un perjuicio directo en nuestra cadena de suministro y trazabilidad de inventario. Solicitamos una respuesta formal en un plazo no mayor a 48 horas con las medidas correctivas y la nota de crédito correspondiente a las penalidades del contrato.

Atentamente,

___________________________
Ana María
Jefa de Operaciones
Grupo San José`;

    // Inyectar el texto en el modal
    document.getElementById('textoReclamo').value = documentoLegal;
    
    // Mostrar el modal
    const modalEl = document.getElementById('modalGenerarReclamo');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

function confirmarReclamo() {
    if (!idPedidoPorReclamar) return;
    
    let datos = JSON.parse(localStorage.getItem('pedidos'));
    const index = datos.findIndex(d => d.id === idPedidoPorReclamar);
    
    if (index !== -1) {
        // Actualizar el estado en LocalStorage
        datos[index].estado = 'Reclamado';
        localStorage.setItem('pedidos', JSON.stringify(datos));
        
        // Re-renderizar la tabla para actualizar el estado visual del botón
        renderTablaPedidos();
    }
    
    // Cerrar el modal
    const modalEl = document.getElementById('modalGenerarReclamo');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    
    idPedidoPorReclamar = null;
}

// ==========================================
// 3. FUNCIONES DE ACCIÓN (SIMULACIÓN DE ESTADOS)
// ==========================================

// ==========================================
// 6. LÓGICA DE NOTIFICACIÓN A PROVEEDORES
// ==========================================

let idProductoPorNotificar = null; // Guarda temporalmente el ID que se está procesando

// 1. Escuchar el clic del botón de confirmar en el modal
document.addEventListener('DOMContentLoaded', () => {
    // Asegurarse de que el botón exista antes de asignarle el evento
    const btnConfirmar = document.getElementById('btnConfirmarNotificacion');
    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', confirmarNotificacion);
    }
});

function abrirModalNotificar(id) {
    const datos = JSON.parse(localStorage.getItem('productosReponer')) || [];
    const item = datos.find(d => d.id === id);
    if (!item) return;

    idProductoPorNotificar = id; // Guardamos el ID en memoria
    
    // Generar fecha actual en formato peruano
    const fechaHoy = new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Plantilla formal del documento legal/comercial
    const documentoFormal = `ORDEN DE REPOSICIÓN DE INVENTARIO

Fecha: ${fechaHoy}
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

    // Inyectar el texto en el textarea
    document.getElementById('textoNotificacion').value = documentoFormal;
    
    // Instanciar y mostrar el modal usando la API de Bootstrap
    const modalEl = document.getElementById('modalNotificarProveedor');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

function confirmarNotificacion() {
    if (!idProductoPorNotificar) return;
    
    let datos = JSON.parse(localStorage.getItem('productosReponer'));
    const index = datos.findIndex(d => d.id === idProductoPorNotificar);
    
    if (index !== -1) {
        // Actualizar el estado
        datos[index].estado = 'Notificado';
        localStorage.setItem('productosReponer', JSON.stringify(datos));
        
        // Re-renderizar la tabla para que el botón cambie a gris y diga "Notificado"
        renderTablaReponer();
    }
    
    // Cerrar el modal
    const modalEl = document.getElementById('modalNotificarProveedor');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    
    // Limpiar la variable temporal
    idProductoPorNotificar = null;
}

function generarReclamo(id) {
    let datos = JSON.parse(localStorage.getItem('pedidos'));
    const index = datos.findIndex(d => d.id === id);
    if (index !== -1) {
        datos[index].estado = 'Reclamado';
        localStorage.setItem('pedidos', JSON.stringify(datos));
        renderTablaPedidos();
    }
}

// ==========================================
// 4. LÓGICA DE MODALES Y VALIDACIONES
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initFormularioPedidos();
    initImportadorExcel();
});

// --- Función auxiliar para formatear fechas de YYYY-MM-DD a DD/MM/YYYY ---
function formatearFecha(fechaStr) {
    if (!fechaStr) return "-";
    const partes = fechaStr.split('-');
    if (partes.length !== 3) return fechaStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// --- Módulo: Agregar Pedido Manualmente ---
function initFormularioPedidos() {
    const form = document.getElementById('formAgregarPedido');
    const modalEl = document.getElementById('modalAgregarPedido');
    
    if (!form || !modalEl) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // 1. Validaciones de HTML5 + Bootstrap
        if (!this.checkValidity()) {
            e.stopPropagation();
            this.classList.add('was-validated');
            return;
        }

        // 2. Construir el objeto del nuevo pedido
        const nuevoPedido = {
            id: parseInt(document.getElementById('inputPedidoID').value),
            proveedor: document.getElementById('inputPedidoProveedor').value,
            fechaProg: formatearFecha(document.getElementById('inputFechaProg').value),
            fechaEnt: formatearFecha(document.getElementById('inputFechaEnt').value),
            completitud: document.getElementById('inputCompletitud').value,
            puntualidad: document.getElementById('inputPuntualidad').value || "-",
            estado: "Generar reclamo" // Acción por defecto asignada por el sistema
        };

        // 3. Actualizar LocalStorage
        const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
        pedidos.unshift(nuevoPedido); // Agregar al inicio de la tabla
        localStorage.setItem('pedidos', JSON.stringify(pedidos));

        // 4. Actualizar UI y limpiar
        renderTablaPedidos();
        form.reset();
        form.classList.remove('was-validated');
        
        // Cerrar modal de Bootstrap de forma programática
        bootstrap.Modal.getInstance(modalEl).hide();
    });
}

// --- Módulo: Importar Pedidos vía Excel ---
function initImportadorExcel() {
    const btnDescargar = document.getElementById('btnDescargarPlantillaPedidos');
    const fileInput = document.getElementById('fileInputPedidos');
    const btnProcesar = document.getElementById('btnProcesarExcel');
    const modalEl = document.getElementById('modalImportarExcel');

    if (!btnDescargar || !fileInput || !btnProcesar) return;

    // A. Descargar la plantilla con los encabezados correctos
    btnDescargar.addEventListener('click', () => {
        const wb = XLSX.utils.book_new();
        // Encabezados idénticos a la tabla, excluyendo "Acción"
        const wsData = [
            ["ID", "Proveedor", "Fecha Programada", "Fecha entregada", "Completitud", "Puntualidad"],
            [101, "Ejemplo S.A.", "01/11/2023", "02/11/2023", "100/100", "1 día tarde"] // Fila de ejemplo
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Pedidos");
        XLSX.writeFile(wb, "Plantilla_Carga_Pedidos.xlsx");
    });

    // B. Habilitar botón de importar solo si hay un archivo seleccionado
    fileInput.addEventListener('change', (e) => {
        btnProcesar.disabled = e.target.files.length === 0;
    });

    // C. Procesar el Excel subido
    btnProcesar.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Leer la primera hoja del Excel
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convertir la hoja a un array de objetos JSON
            // defval: "-" asigna un guion a las celdas vacías para que la tabla no muestre "undefined"
            const excelRows = XLSX.utils.sheet_to_json(worksheet, { defval: "-" });

            // Mapear los datos leídos al formato de nuestro LocalStorage
            const nuevosPedidos = excelRows.map(row => ({
                id: row['ID'] || Date.now(), 
                proveedor: row['Proveedor'] || "Sin Nombre",
                fechaProg: row['Fecha Programada'],
                fechaEnt: row['Fecha entregada'],
                completitud: row['Completitud'],
                puntualidad: row['Puntualidad'],
                estado: "Generar reclamo" // Acción inyectada automáticamente
            }));

            // Fusionar con los pedidos existentes y guardar
            const pedidosExistentes = JSON.parse(localStorage.getItem('pedidos')) || [];
            const pedidosActualizados = nuevosPedidos.concat(pedidosExistentes);
            localStorage.setItem('pedidos', JSON.stringify(pedidosActualizados));

            // Actualizar UI y limpiar modal
            renderTablaPedidos();
            fileInput.value = "";
            btnProcesar.disabled = true;
            bootstrap.Modal.getInstance(modalEl).hide();
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// ==========================================
// 5. GRÁFICOS (CHART.JS)
// ==========================================

// Variable global para almacenar la instancia del gráfico y poder destruirla/actualizarla
let stockChartInstance = null;

// Llama a esta función dentro de tu DOMContentLoaded principal (descomenta initGraficos(); en el bloque 1)
function initGraficos() {
    renderGraficoStock();
    // Aquí inicializaremos el comparador de precios más adelante
}

function renderGraficoStock() {
    const ctx = document.getElementById('stockPieChart');
    if (!ctx) return;

    // Obtener los datos que alimentan la tabla "Productos Próximos a Reponer"
    const datosReponer = JSON.parse(localStorage.getItem('productosReponer')) || [];

    // 1. Agrupar y sumar el stock por proveedor usando reduce()
    const stockPorProveedor = datosReponer.reduce((acumulador, item) => {
        const proveedor = item.proveedor || "Sin Proveedor";
        // Convertir stock a número por si acaso se guardó como string
        const stock = parseFloat(item.stock) || 0; 
        
        acumulador[proveedor] = (acumulador[proveedor] || 0) + stock;
        return acumulador;
    }, {});

    // Separar en dos arreglos: uno para las etiquetas (proveedores) y otro para los valores (stock)
    const labels = Object.keys(stockPorProveedor);
    const dataValues = Object.values(stockPorProveedor);

    // 2. Destruir la instancia previa si existe (vital para actualizar el gráfico sin "fantasmas" de Chart.js)
    if (stockChartInstance) {
        stockChartInstance.destroy();
    }

    // 3. Renderizar el gráfico de pastel
    stockChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: [
                    '#3b7b9b', // Azul oscuro (basado en tu mockup)
                    '#e69a4e', // Naranja (basado en tu mockup)
                    '#f6c85f', // Amarillo
                    '#63a695', // Verde agua
                    '#d94848', // Rojo acento de tu módulo 2
                    '#7b6c6c'  // Gris muteado
                ],
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Permite que el gráfico se adapte al alto de la tarjeta
            plugins: {
                legend: {
                    position: 'right', // Coloca los nombres a la derecha como en tu diseño
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        font: { size: 12, family: '"Segoe UI", system-ui, sans-serif' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) { label += ': '; }
                            label += context.parsed + ' unidades';
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// Variable global para el gráfico de precios
let preciosChartInstance = null;

// Asegúrate de agregar esta llamada dentro de tu initGraficos()
function initGraficos() {
    renderGraficoStock();
    initComparadorPrecios();
}

function initComparadorPrecios() {
    const selectEl = document.getElementById('selectProductoPrecio');
    const datosPrecios = JSON.parse(localStorage.getItem('catalogoPrecios')) || [];
    
    if (!selectEl || datosPrecios.length === 0) return;

    // 1. Obtener lista de productos únicos para el desplegable
    const productosUnicos = [...new Set(datosPrecios.map(item => item.producto))].sort();
    
    // 2. Poblar el select
    selectEl.innerHTML = '<option value="" selected disabled>Seleccione un producto</option>';
    productosUnicos.forEach(producto => {
        const option = document.createElement('option');
        option.value = producto;
        option.textContent = producto;
        selectEl.appendChild(option);
    });

    // 3. Escuchar cambios para actualizar el gráfico
    selectEl.addEventListener('change', (e) => {
        renderGraficoPrecios(e.target.value, datosPrecios);
    });

    // 4. Renderizar automáticamente el primer producto para que no se vea vacío
    if (productosUnicos.length > 0) {
        selectEl.value = productosUnicos[0];
        renderGraficoPrecios(productosUnicos[0], datosPrecios);
    }
}

function renderGraficoPrecios(productoSeleccionado, datosTotales) {
    const ctx = document.getElementById('preciosBarChart');
    if (!ctx) return;

    // 1. Filtrar las cotizaciones solo del producto seleccionado
    const cotizaciones = datosTotales.filter(item => item.producto === productoSeleccionado);
    
    // 2. Ordenar de menor a mayor precio (mejor UX: el más barato aparece arriba)
    cotizaciones.sort((a, b) => a.precio - b.precio);

    const labels = cotizaciones.map(item => item.proveedor);
    const dataValues = cotizaciones.map(item => item.precio);

    // 3. Asignar colores: Azul corporativo por defecto, Rojo acento (#c0392b) para el más barato
    const backgroundColors = dataValues.map((precio, index) => 
        index === 0 ? '#c0392b' : '#3b7b9b' // El índice 0 siempre será el más barato por el sort()
    );

    if (preciosChartInstance) {
        preciosChartInstance.destroy();
    }

    // 4. Configurar el gráfico de barras horizontales
    preciosChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Precio de compra (S/)',
                data: dataValues,
                backgroundColor: backgroundColors,
                borderRadius: 4, // Bordes ligeramente redondeados
                barThickness: 20 // Grosor similar al de tu diseño
            }]
        },
        options: {
            indexAxis: 'y', // Convierte el gráfico de barras a horizontal
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Ocultamos la leyenda superior para ahorrar espacio
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            // Formato de moneda para el tooltip
                            return `S/ ${context.parsed.x.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Precio (Soles)'
                    }
                },
                y: {
                    grid: {
                        display: false // Limpiar líneas horizontales para que se vea más limpio
                    }
                }
            }
        }
    });
}

// ==========================================
// 8. FLUJO DE ORDEN DE COMPRA DESDE COMPARADOR
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initFormularioCompra();
    
    // Listeners para hacer el cálculo del total reactivo
    document.getElementById('compraProveedor')?.addEventListener('change', actualizarPrecioUnitario);
    document.getElementById('compraCantidad')?.addEventListener('input', calcularTotalCompra);
});

function abrirModalCompra() {
    const selectProducto = document.getElementById('selectProductoPrecio');
    const productoSeleccionado = selectProducto.value;

    if (!productoSeleccionado) {
        alert("Por favor, seleccione un producto en el comparador primero.");
        return;
    }

    // 1. Bloquear el input con el nombre del producto
    document.getElementById('compraProducto').value = productoSeleccionado;

    // 2. Extraer del LocalStorage solo las cotizaciones del producto seleccionado
    const datosPrecios = JSON.parse(localStorage.getItem('catalogoPrecios')) || [];
    const cotizaciones = datosPrecios.filter(item => item.producto === productoSeleccionado);
    
    // 3. Ordenar por precio para destacar la mejor opción de compra
    cotizaciones.sort((a, b) => a.precio - b.precio);

    // 4. Llenar el select de proveedores dinámicamente
    const selectProveedor = document.getElementById('compraProveedor');
    selectProveedor.innerHTML = '';
    
    cotizaciones.forEach((cot, index) => {
        const option = document.createElement('option');
        option.value = cot.precio; // Guardamos el precio en el 'value' para multiplicar fácilmente
        option.dataset.nombre = cot.proveedor; // Guardamos el nombre en un 'data-attribute'
        option.textContent = `${cot.proveedor} (S/ ${cot.precio.toFixed(2)})`;
        
        if(index === 0) option.selected = true; // Preselecciona el más barato
        selectProveedor.appendChild(option);
    });

    // 5. Reiniciar inputs del formulario
    document.getElementById('compraCantidad').value = '';
    document.getElementById('compraTotal').value = 'S/ 0.00';
    document.getElementById('compraFecha').value = '';
    actualizarPrecioUnitario(); 

    // 6. Abrir Modal
    const modalEl = document.getElementById('modalOrdenCompra');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

function actualizarPrecioUnitario() {
    const selectProveedor = document.getElementById('compraProveedor');
    const inputPrecio = document.getElementById('compraPrecioUnitario');
    
    if (selectProveedor.options.length > 0) {
        const precio = parseFloat(selectProveedor.value);
        inputPrecio.value = precio.toFixed(2);
        calcularTotalCompra(); // Recalcular total si el usuario cambia de proveedor
    }
}

function calcularTotalCompra() {
    const precio = parseFloat(document.getElementById('compraPrecioUnitario').value) || 0;
    const cantidad = parseInt(document.getElementById('compraCantidad').value) || 0;
    const total = precio * cantidad;
    document.getElementById('compraTotal').value = `S/ ${total.toFixed(2)}`;
}

function initFormularioCompra() {
    const form = document.getElementById('formOrdenCompra');
    const modalEl = document.getElementById('modalOrdenCompra');

    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // Validación de campos vacíos manejada por Bootstrap
        if (!this.checkValidity()) {
            e.stopPropagation();
            this.classList.add('was-validated');
            return;
        }

        // Obtener el nombre del proveedor desde el dataset de la opción seleccionada
        const selectProveedor = document.getElementById('compraProveedor');
        const proveedorNombre = selectProveedor.options[selectProveedor.selectedIndex].dataset.nombre;
        
        // Formatear la fecha (de YYYY-MM-DD del input nativo a DD/MM/YYYY para tu tabla)
        const fechaInput = document.getElementById('compraFecha').value;
        const partesFecha = fechaInput.split('-');
        const fechaFormateada = `${partesFecha[2]}/${partesFecha[1]}/${partesFecha[0]}`;

        // Crear el nuevo registro para la Tabla de Pedidos
        const nuevaOrden = {
            id: Math.floor(Math.random() * 900) + 100, // Generar un ID ficticio de 3 dígitos
            proveedor: proveedorNombre,
            fechaProg: fechaFormateada,
            fechaEnt: "-", // Pendiente de entrega
            completitud: "En proceso",
            puntualidad: "-",
            estado: "Generar reclamo"
        };

        // Guardar en LocalStorage
        const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
        pedidos.unshift(nuevaOrden); // Agregamos al principio de la tabla
        localStorage.setItem('pedidos', JSON.stringify(pedidos));

        // Actualizar visualmente la tabla inferior
        renderTablaPedidos();

        // Limpiar formulario y cerrar modal
        form.reset();
        form.classList.remove('was-validated');
        bootstrap.Modal.getInstance(modalEl).hide();
    });
}