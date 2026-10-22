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
            { id: 2, producto: "Papas Fritas", stock: 20, proveedor: "Bimbo", estado: "Notificado" }
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
            { id: 1, producto: "Pan de Molde", proveedor: "Bimbo", precio: 12.50 },
            { id: 2, producto: "Pan de Molde", proveedor: "Juanito", precio: 10.00 },
            { id: 3, producto: "Pan de Molde", proveedor: "Cotrina", precio: 8.50 }
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
                <button class="btn btn-sm ${btnClass} rounded-pill px-3" ${btnDisabled} onclick="cambiarEstadoReponer(${item.id})">
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
                <button class="btn btn-sm ${btnClass} rounded-pill px-3" ${btnDisabled} onclick="generarReclamo(${pedido.id})">
                    ${pedido.estado}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 3. FUNCIONES DE ACCIÓN (SIMULACIÓN DE ESTADOS)
// ==========================================

function cambiarEstadoReponer(id) {
    let datos = JSON.parse(localStorage.getItem('productosReponer'));
    const index = datos.findIndex(d => d.id === id);
    if (index !== -1) {
        datos[index].estado = 'Notificado';
        localStorage.setItem('productosReponer', JSON.stringify(datos));
        renderTablaReponer(); // Re-render reactivo
    }
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