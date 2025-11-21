/**
 * Configuración de mapas para ELECTRICIDAD
 */

// ==========================================
// ELECTRICIDAD - VARIABLES GLOBALES
// ==========================================

// Variables para almacenar datos y estado
let electricityPermitsData = [];
let electricityStats = {
    byState: {}, // By EfId (Estado/Entidad Federativa)
    byGCR: {}, // By GCR geometry (calculated with Turf.js)
    byTech: {},
    matrix: {}, // GCR x Technology matrix
    totals: {
        capacity: 0,
        generation: 0,
        count: 0
    }
};
let currentFilter = null;
let currentFilteredData = [];

// Variables para gráficos
let electricityTechChart = null;
let electricityStatesChart = null;

const ELECTRICITY_MAPS = [
    {
        name: 'Permisos de Generación Eléctrica',
        geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/estados.geojson',
        geojsonUrlType: 'states',
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTxqJvqZxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqxqx/pub?gid=0&single=true&output=csv',
        googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/xxxxx/edit?usp=sharing',
        useClusters: true,
        enableSearch: true,
        mapType: 'electricity',
        descriptionTitle: 'Permisos de Generación Eléctrica',
        description: 'Mapa de permisos de generación eléctrica en México. Los marcadores están agrupados para facilitar la visualización.'
    }
];

// ==========================================
// ELECTRICIDAD - FUNCIONES PRINCIPALES
// ==========================================

function calculateElectricityStats(data) {
    const stats = {
        byState: {}, // By Estado (EfId)
        byGCR: {}, // By GCR (spatial)
        byTech: {},
        matrix: {}, // GCR x Technology
        totals: {
            capacity: 0,
            generation: 0,
            count: 0
        }
    };

    // Calculate by State and Technology
    data.forEach(row => {
        const capacity = parseFloat(row.CapacidadAutorizadaMW) || 0;
        const generation = parseFloat(row.Generación_estimada_anual) || 0;
        const state = (row.EfId || 'Sin Estado').trim();
        const tech = (row.Tecnología || 'Sin Tecnología').trim();

        // Totals
        stats.totals.capacity += capacity;
        stats.totals.generation += generation;
        stats.totals.count++;

        // By State (EfId)
        if (!stats.byState[state]) {
            stats.byState[state] = { capacity: 0, generation: 0, count: 0 };
        }
        stats.byState[state].capacity += capacity;
        stats.byState[state].generation += generation;
        stats.byState[state].count++;

        // By Technology
        if (!stats.byTech[tech]) {
            stats.byTech[tech] = { capacity: 0, generation: 0, count: 0 };
        }
        stats.byTech[tech].capacity += capacity;
        stats.byTech[tech].generation += generation;
        stats.byTech[tech].count++;
    });

    // Calculate by GCR using spatial analysis with Turf.js
    if (gcrGeometries) {
        const gcrAssignments = assignPermitsToGCR(data, gcrGeometries);

        Object.keys(gcrAssignments).forEach(gcrName => {
            const permits = gcrAssignments[gcrName];
            stats.byGCR[gcrName] = {
                capacity: 0,
                generation: 0,
                count: permits.length,
                technologies: {}
            };

            permits.forEach(row => {
                const capacity = parseFloat(row.CapacidadAutorizadaMW) || 0;
                const generation = parseFloat(row.Generación_estimada_anual) || 0;
                const tech = (row.Tecnología || 'Sin Tecnología').trim();

                stats.byGCR[gcrName].capacity += capacity;
                stats.byGCR[gcrName].generation += generation;

                // Track by technology within this GCR
                if (!stats.byGCR[gcrName].technologies[tech]) {
                    stats.byGCR[gcrName].technologies[tech] = {
                        capacity: 0,
                        generation: 0,
                        count: 0
                    };
                }
                stats.byGCR[gcrName].technologies[tech].capacity += capacity;
                stats.byGCR[gcrName].technologies[tech].generation += generation;
                stats.byGCR[gcrName].technologies[tech].count++;
            });
        });

        // Create matrix (for easy access)
        stats.matrix = stats.byGCR;
    }

    return stats;
}

function drawElectricityPermits(rows) {
    drawElectricityPermitsWithStats(rows);
}

function drawElectricityPermitsWithStats(rows) {
    // Clear existing markers
    markersLayer.clearLayers();
    if (markersClusterGroup) {
        map.removeLayer(markersClusterGroup);
        markersClusterGroup = null;
    }

    // Store data for search
    electricityPermitsData = rows;

    // Load GCR geometries if not loaded
    if (!gcrGeometries) {
        fetch('https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson')
            .then(response => response.json())
            .then(data => {
                gcrGeometries = data;
                console.log('GCR geometries loaded:', gcrGeometries.features.map(f => f.properties.name));

                // Now calculate stats with GCR data
                electricityStats = calculateElectricityStats(rows);
                updateElectricityTotals(electricityStats);
                createFilterCards(electricityStats, 'state');
                createFilterCards(electricityStats, 'gcr');
                createFilterCards(electricityStats, 'tech');
                createMatrixView(electricityStats);

                // Create charts
                createElectricityCharts(electricityStats);

                // Show States layer by default (since "Por Estado" tab is active)
                showStatesLayer(null);
            })
            .catch(error => {
                console.error('Error loading GCR geometries:', error);
                // Calculate without GCR data
                electricityStats = calculateElectricityStats(rows);
                updateElectricityTotals(electricityStats);
                createFilterCards(electricityStats, 'state');
                createFilterCards(electricityStats, 'tech');

                // Create charts
                createElectricityCharts(electricityStats);

                // Show States layer by default
                showStatesLayer(null);
            });
    } else {
        // Calculate statistics
        electricityStats = calculateElectricityStats(rows);
        updateElectricityTotals(electricityStats);
        createFilterCards(electricityStats, 'state');
        createFilterCards(electricityStats, 'gcr');
        createFilterCards(electricityStats, 'tech');
        createMatrixView(electricityStats);

        // Create charts
        createElectricityCharts(electricityStats);

        // Show States layer by default (since "Por Estado" tab is active)
        showStatesLayer(null);
    }

    // Show filters panel
    const filtersPanel = document.getElementById('electricity-filters-panel');
    if (filtersPanel) {
        filtersPanel.style.display = 'block';
    }

    // Draw markers
    drawElectricityMarkersOnly(rows);
}

function drawElectricityMarkersOnly(rows) {
    if (!markersClusterGroup) {
        markersClusterGroup = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            iconCreateFunction: function (cluster) {
                const count = cluster.getChildCount();
                let c = ' marker-cluster-';
                if (count < 10) {
                    c += 'small';
                } else if (count < 100) {
                    c += 'medium';
                } else {
                    c += 'large';
                }
                return new L.DivIcon({
                    html: '<div><span>' + count + '</span></div>',
                    className: 'marker-cluster' + c,
                    iconSize: new L.Point(40, 40)
                });
            }
        });
    } else {
        markersClusterGroup.clearLayers();
    }

    rows.forEach(function (row) {
        const latRaw = row.lat || row.Lat || row.latitude || row.Latitude || row.latitud || '';
        const lngRaw = row.lng || row.Lng || row.lon || row.Lon || row.longitude || row.Longitud || '';
        const lat = parseFloat(latRaw.toString().replace(',', '.'));
        const lng = parseFloat(lngRaw.toString().replace(',', '.'));

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return;
        }

        const popup = [
            '<div style="font-family: \'Montserrat\', sans-serif; max-width: 300px;">',
            '<div style="margin-bottom: 8px;"><strong style="font-size: 14px; color: #601623;">' + (row.NumeroPermiso || 'N/A') + '</strong></div>',
            '<div><strong>Razón Social:</strong> ' + (row.RazonSocial || 'N/A') + '</div>',
            '<div><strong>Estado:</strong> ' + (row.EfId || 'N/A') + '</div>',
            '<div><strong>Municipio:</strong> ' + (row.MpoId || 'N/A') + '</div>',
            '<div><strong>Estatus:</strong> ' + (row.Estatus || 'N/A') + '</div>',
            '<div><strong>Tipo de Permiso:</strong> ' + (row.TipoPermiso || 'N/A') + '</div>',
            '<div><strong>Capacidad (MW):</strong> ' + (row.CapacidadAutorizadaMW || 'N/A') + '</div>',
            '<div><strong>Tecnología:</strong> ' + (row.Tecnología || 'N/A') + '</div>',
            '<div><strong>Fuente de Energía:</strong> ' + (row.FuenteEnergía || 'N/A') + '</div>',
            '<div><strong>Fecha de Otorgamiento:</strong> ' + (row.FechaOtorgamiento || 'N/A') + '</div>',
            '</div>'
        ].join('');

        const plantIcon = L.divIcon({
            className: 'electricity-marker-icon',
            html: '<img src="https://cdn.sassoapps.com/iconos_snien/planta_generacion.png" style="width: 32px; height: 32px;">',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16]
        });

        const marker = L.marker([lat, lng], {
            icon: plantIcon,
            zIndexOffset: 1000
        });

        marker.bindPopup(popup);
        marker.permitData = row;
        markersClusterGroup.addLayer(marker);
    });

    map.addLayer(markersClusterGroup);

    if (markersClusterGroup._featureGroup && map.getPane('markerPane')) {
        const markerPane = map.getPane('markerPane');
        markerPane.style.zIndex = 650;
    }
}

function updateElectricityTotals(stats) {
    const capacityEl = document.getElementById('total-capacity');
    const generationEl = document.getElementById('total-generation');
    const permitsEl = document.getElementById('total-permits');

    if (capacityEl) {
        capacityEl.textContent = stats.totals.capacity.toLocaleString('es-MX', { maximumFractionDigits: 2 }) + ' MW';
    }
    if (generationEl) {
        generationEl.textContent = stats.totals.generation.toLocaleString('es-MX', { maximumFractionDigits: 2 }) + ' GWh';
    }
    if (permitsEl) {
        permitsEl.textContent = stats.totals.count.toLocaleString('es-MX');
    }
}

function createFilterCards(stats, type) {
    let container, data;

    if (type === 'state') {
        container = document.getElementById('state-cards');
        data = stats.byState;
    } else if (type === 'gcr') {
        container = document.getElementById('gcr-cards');
        data = stats.byGCR;
    } else {
        container = document.getElementById('tech-cards');
        data = stats.byTech;
    }

    if (!container) return;

    container.innerHTML = '';

    const sortedKeys = Object.keys(data).sort((a, b) => data[b].capacity - data[a].capacity);

    sortedKeys.forEach(key => {
        const item = data[key];
        const card = document.createElement('div');
        card.className = 'filter-card';
        card.dataset.filterType = type;
        card.dataset.filterValue = key;

        card.innerHTML = `
            <div class="filter-card-header">
                <div class="filter-card-title">${key}</div>
                <div class="filter-card-count">${item.count}</div>
            </div>
            <div class="filter-card-stats">
                <div class="filter-stat">
                    <span class="filter-stat-label">⚡ Capacidad:</span>
                    <span class="filter-stat-value">${item.capacity.toLocaleString('es-MX', { maximumFractionDigits: 2 })} MW</span>
                </div>
                <div class="filter-stat">
                    <span class="filter-stat-label">🔋 Generación:</span>
                    <span class="filter-stat-value">${item.generation.toLocaleString('es-MX', { maximumFractionDigits: 2 })} GWh</span>
                </div>
            </div>
        `;

        card.addEventListener('click', function () {
            filterElectricityPermits(type, key);

            // Update active state
            container.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
        });

        container.appendChild(card);
    });
}

function createMatrixView(stats) {
    const container = document.getElementById('matrix-view');
    if (!container) return;

    container.innerHTML = '';

    if (!stats.byGCR || Object.keys(stats.byGCR).length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--color-muted); padding: 40px;">No hay datos de GCR disponibles. Asegúrate de que el GeoJSON esté cargado.</p>';
        return;
    }

    // Sort GCRs by capacity
    const sortedGCRs = Object.keys(stats.byGCR).sort((a, b) =>
        stats.byGCR[b].capacity - stats.byGCR[a].capacity
    );

    sortedGCRs.forEach(gcrName => {
        const gcr = stats.byGCR[gcrName];

        const section = document.createElement('div');
        section.className = 'matrix-gcr-section';

        // Header
        const header = document.createElement('div');
        header.className = 'matrix-gcr-header';
        header.innerHTML = `
            <div class="matrix-gcr-title">${gcrName}</div>
            <div class="matrix-gcr-totals">
                <div class="matrix-total-item">
                    <span class="matrix-total-label">Permisos</span>
                    <span class="matrix-total-value">${gcr.count}</span>
                </div>
                <div class="matrix-total-item">
                    <span class="matrix-total-label">Capacidad</span>
                    <span class="matrix-total-value">${gcr.capacity.toLocaleString('es-MX', { maximumFractionDigits: 2 })} MW</span>
                </div>
                <div class="matrix-total-item">
                    <span class="matrix-total-label">Generación</span>
                    <span class="matrix-total-value">${gcr.generation.toLocaleString('es-MX', { maximumFractionDigits: 2 })} GWh</span>
                </div>
            </div>
        `;

        // Click on header to filter by this GCR
        header.addEventListener('click', function () {
            filterElectricityPermitsByGCRGeometry(gcrName);
        });

        section.appendChild(header);

        // Technology grid
        if (gcr.technologies && Object.keys(gcr.technologies).length > 0) {
            const techGrid = document.createElement('div');
            techGrid.className = 'matrix-tech-grid';

            // Sort technologies by capacity
            const sortedTechs = Object.keys(gcr.technologies).sort((a, b) =>
                gcr.technologies[b].capacity - gcr.technologies[a].capacity
            );

            sortedTechs.forEach(techName => {
                const tech = gcr.technologies[techName];

                const techCard = document.createElement('div');
                techCard.className = 'matrix-tech-card';
                techCard.innerHTML = `
                    <div class="matrix-tech-name">${techName}</div>
                    <div class="matrix-tech-stats">
                        <div class="matrix-tech-stat">
                            <span class="matrix-tech-stat-label">Permisos:</span>
                            <span class="matrix-tech-stat-value">${tech.count}</span>
                        </div>
                        <div class="matrix-tech-stat">
                            <span class="matrix-tech-stat-label">Capacidad:</span>
                            <span class="matrix-tech-stat-value">${tech.capacity.toLocaleString('es-MX', { maximumFractionDigits: 2 })} MW</span>
                        </div>
                        <div class="matrix-tech-stat">
                            <span class="matrix-tech-stat-label">Generación:</span>
                            <span class="matrix-tech-stat-value">${tech.generation.toLocaleString('es-MX', { maximumFractionDigits: 2 })} GWh</span>
                        </div>
                    </div>
                `;

                // Click on tech card to filter by GCR + Tech
                techCard.addEventListener('click', function (e) {
                    e.stopPropagation(); // Don't trigger GCR header click
                    filterElectricityPermitsByGCRAndTech(gcrName, techName);
                });

                techGrid.appendChild(techCard);
            });

            section.appendChild(techGrid);
        }

        container.appendChild(section);
    });
}

function filterElectricityPermits(type, value) {
    if (!markersClusterGroup || !electricityPermitsData.length) return;

    currentFilter = { type, value };

    // Clear search box
    clearSearchBox();

    // Clear existing cluster
    map.removeLayer(markersClusterGroup);
    markersClusterGroup.clearLayers();

    // Show/hide geometry layers based on filter type
    if (type === 'state') {
        showStatesLayer(value);
    } else if (type === 'gcr') {
        showGCRLayer(value);
    } else {
        // For technology filter, hide geometry layers
        hideGeometryLayers();
    }

    // Filter data
    let filteredData;
    if (type === 'state') {
        filteredData = electricityPermitsData.filter(row =>
            (row.EfId || 'Sin Estado').trim() === value
        );
    } else if (type === 'tech') {
        filteredData = electricityPermitsData.filter(row =>
            (row.Tecnología || 'Sin Tecnología').trim() === value
        );
    } else if (type === 'gcr') {
        // Filter using spatial analysis
        if (gcrGeometries) {
            const gcrAssignments = assignPermitsToGCR(electricityPermitsData, gcrGeometries);
            filteredData = gcrAssignments[value] || [];
        } else {
            filteredData = [];
        }
    }

    // Store filtered data for search
    currentFilteredData = filteredData;
    console.log('Filter applied:', type, value, '- Showing', filteredData.length, 'permits');

    // Recalculate stats for filtered data
    const filteredStats = calculateElectricityStats(filteredData);
    updateElectricityTotals(filteredStats);

    // Update charts with filtered data
    updateElectricityCharts(filteredStats);

    // Redraw markers with filtered data
    drawElectricityMarkersOnly(filteredData);
}

function filterElectricityPermitsByGCRGeometry(gcrName) {
    // Clear search box
    clearSearchBox();

    filterElectricityPermits('gcr', gcrName);

    // Show GCR layer with highlight
    showGCRLayer(gcrName);

    // Update active state in matrix view
    document.querySelectorAll('.matrix-gcr-section').forEach(section => {
        if (section.querySelector('.matrix-gcr-title').textContent === gcrName) {
            section.style.borderColor = 'var(--color-verde-profundo)';
            section.style.background = 'rgba(31, 122, 98, 0.03)';
        } else {
            section.style.borderColor = '#eef3f6';
            section.style.background = 'white';
        }
    });
}

function filterElectricityPermitsByGCRAndTech(gcrName, techName) {
    if (!gcrGeometries || !electricityPermitsData.length) return;

    // Clear search box
    clearSearchBox();

    // Get permits in this GCR
    const gcrAssignments = assignPermitsToGCR(electricityPermitsData, gcrGeometries);
    const gcrPermits = gcrAssignments[gcrName] || [];

    // Filter by technology
    const filteredData = gcrPermits.filter(row =>
        (row.Tecnología || 'Sin Tecnología').trim() === techName
    );

    currentFilter = { type: 'gcr-tech', gcr: gcrName, tech: techName };

    // Store filtered data for search
    currentFilteredData = filteredData;
    console.log('GCR+Tech filter applied:', gcrName, '+', techName, '- Showing', filteredData.length, 'permits');

    // Show GCR layer with highlight
    showGCRLayer(gcrName);

    // Clear existing cluster
    if (markersClusterGroup) {
        map.removeLayer(markersClusterGroup);
        markersClusterGroup.clearLayers();
    }

    // Recalculate stats
    const filteredStats = calculateElectricityStats(filteredData);
    updateElectricityTotals(filteredStats);

    // Redraw markers
    drawElectricityMarkersOnly(filteredData);
}

function resetElectricityFilters() {
    currentFilter = null;
    currentFilteredData = []; // Clear filtered data - search will use all data

    console.log('Filters reset - searching in all', electricityPermitsData.length, 'permits');

    // Clear search box
    clearSearchBox();

    // Remove active class from all cards
    document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));

    // Reset matrix view highlighting
    document.querySelectorAll('.matrix-gcr-section').forEach(section => {
        section.style.borderColor = '#eef3f6';
        section.style.background = 'white';
    });

    // Show layer based on active tab
    const activeTab = document.querySelector('.filter-tab.active');
    if (activeTab) {
        const tabType = activeTab.dataset.tab;

        if (tabType === 'state') {
            // Tab "Por Estado" - Mostrar Estados sin highlighting
            showStatesLayer(null);
        } else if (tabType === 'gcr') {
            // Tab "Por Gerencia" - Mostrar GCR sin highlighting
            showGCRLayer(null);
        } else if (tabType === 'tech') {
            // Tab "Por Tecnología" - Ocultar capas
            hideGeometryLayers();
        } else if (tabType === 'matrix') {
            // Tab "Vista Detallada" - Mostrar GCR sin highlighting
            showGCRLayer(null);
        }
    } else {
        // Default: show states layer
        showStatesLayer(null);
    }

    // Recalculate stats for all data
    updateElectricityTotals(electricityStats);

    // Update charts with all data
    updateElectricityCharts(electricityStats);

    // Redraw all markers
    if (electricityPermitsData.length) {
        drawElectricityMarkersOnly(electricityPermitsData);
    }
}

// ==========================================
// ELECTRICIDAD - FUNCIONES DE GRÁFICOS
// ==========================================

function createElectricityCharts(stats) {
    createElectricityTechChart(stats);
    createElectricityStatesChart(stats);
}

function createElectricityTechChart(stats) {
    const ctx = document.getElementById('electricity-tech-chart');
    if (!ctx) return;

    // Destroy existing chart
    if (electricityTechChart) {
        electricityTechChart.destroy();
    }

    // Prepare data
    const technologies = Object.keys(stats.byTech).sort((a, b) =>
        stats.byTech[b].capacity - stats.byTech[a].capacity
    );

    const data = technologies.map(tech => stats.byTech[tech].capacity);
    const colors = [
        '#1f7a62', '#601623', '#24a47a', '#8B1E3F', '#0D5C4A',
        '#C41E3A', '#165845', '#7a2432', '#2d9575', '#4a0e16'
    ];

    electricityTechChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: technologies,
            datasets: [{
                label: 'Capacidad (MW)',
                data: data,
                backgroundColor: colors.slice(0, technologies.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: {
                            family: "'Montserrat', sans-serif",
                            size: 11
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Capacidad por Tecnología',
                    font: {
                        family: "'Montserrat', sans-serif",
                        size: 14,
                        weight: 'bold'
                    },
                    color: '#601623'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value.toLocaleString('es-MX')} MW (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createElectricityStatesChart(stats) {
    const ctx = document.getElementById('electricity-states-chart');
    if (!ctx) return;

    // Destroy existing chart
    if (electricityStatesChart) {
        electricityStatesChart.destroy();
    }

    // Get top 10 states by capacity
    const states = Object.keys(stats.byState).sort((a, b) =>
        stats.byState[b].capacity - stats.byState[a].capacity
    ).slice(0, 10);

    const data = states.map(state => stats.byState[state].capacity);

    electricityStatesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: states,
            datasets: [{
                label: 'Capacidad (MW)',
                data: data,
                backgroundColor: '#1f7a62',
                borderColor: '#0D5C4A',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Top 10 Estados por Capacidad',
                    font: {
                        family: "'Montserrat', sans-serif",
                        size: 14,
                        weight: 'bold'
                    },
                    color: '#601623'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed.x || 0;
                            return `${value.toLocaleString('es-MX')} MW`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return value.toLocaleString('es-MX');
                        }
                    }
                }
            }
        }
    });
}

function updateElectricityCharts(stats) {
    updateElectricityTechChart(stats);
    updateElectricityStatesChart(stats);
}

function updateElectricityTechChart(stats) {
    if (!electricityTechChart) {
        createElectricityTechChart(stats);
        return;
    }

    const technologies = Object.keys(stats.byTech).sort((a, b) =>
        stats.byTech[b].capacity - stats.byTech[a].capacity
    );
    const data = technologies.map(tech => stats.byTech[tech].capacity);

    electricityTechChart.data.labels = technologies;
    electricityTechChart.data.datasets[0].data = data;
    electricityTechChart.update();
}

function updateElectricityStatesChart(stats) {
    if (!electricityStatesChart) {
        createElectricityStatesChart(stats);
        return;
    }

    const states = Object.keys(stats.byState).sort((a, b) =>
        stats.byState[b].capacity - stats.byState[a].capacity
    ).slice(0, 10);
    const data = states.map(state => stats.byState[state].capacity);

    electricityStatesChart.data.labels = states;
    electricityStatesChart.data.datasets[0].data = data;
    electricityStatesChart.update();
}

// ==========================================
// ELECTRICIDAD - EVENT LISTENERS
// ==========================================

// Inicializar event listeners cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
    // Event listeners para tabs de Electricidad
    const electricityTabs = document.querySelectorAll('.filter-tab');
    electricityTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const targetTab = this.dataset.tab;

            console.log('Electricity tab clicked:', targetTab);

            // Reset filters when changing tabs
            if (currentFilter) {
                console.log('Resetting Electricity filters on tab change');
                currentFilter = null;
                currentFilteredData = [];

                // Restore all markers
                if (electricityPermitsData.length) {
                    drawElectricityMarkersOnly(electricityPermitsData);
                }

                // Update totals to show all data
                updateElectricityTotals(electricityStats);

                // Update charts to show all data
                updateElectricityCharts(electricityStats);
            }

            // Remove active class from all cards
            document.querySelectorAll('.filter-card').forEach(card => {
                card.classList.remove('active');
            });

            // Reset matrix view highlighting
            document.querySelectorAll('.matrix-gcr-section').forEach(section => {
                section.style.borderColor = '#eef3f6';
                section.style.background = 'white';
            });

            // Update tabs
            electricityTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Update content
            document.querySelectorAll('.filter-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(targetTab + '-filters').classList.add('active');

            // Show/hide layers based on tab
            if (targetTab === 'state') {
                console.log('Showing States layer');
                showStatesLayer(null);
            } else if (targetTab === 'gcr') {
                console.log('Showing GCR layer');
                showGCRLayer(null);
            } else if (targetTab === 'tech') {
                console.log('Hiding geometry layers');
                hideGeometryLayers();
            } else if (targetTab === 'matrix') {
                console.log('Showing GCR layer for matrix view');
                showGCRLayer(null);
            }
        });
    });

    // Reset button for Electricity
    const resetElectricityBtn = document.getElementById('reset-filters-btn');
    if (resetElectricityBtn) {
        resetElectricityBtn.addEventListener('click', function () {
            resetElectricityFilters();
        });
    }
});

// Exportar para uso en map-config.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ELECTRICITY_MAPS;
}
