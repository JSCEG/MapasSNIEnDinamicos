/**
 * Configuración e inicialización del mapa principal
 */
document.addEventListener('DOMContentLoaded', function () {
    const MAP_CONTAINER_ID = 'map';
    const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4QU5BVBEHmewrNOLjaKoqca3qH16zYKXzvYfMwhrMiW1mR4yUHNJlbIjDhQuDmWtN803Da7r4SZV6/pub?gid=0&single=true&output=csv';
    const REFRESH_MS = 0; // Cambia a 300000 para 5 minutos
    const NO_SHEET_MESSAGE = 'Este mapa no obtiene valores de Excel; son solo capas, shapes o GeoJSON.';
    const SELECT_MAP_MESSAGE = 'Seleccione un mapa para ver su hoja de calculo.';
    let currentSheetUrl = SHEET_CSV;
    const NODE_MARKER_OPTIONS = {
        radius: 3,
        fillColor: '#1f7a62',
        color: '#ffffff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9
    };

    /**
     * Helper function to draw a rounded rectangle on a canvas context.
     */
    function roundRect(ctx, x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
        return ctx;
    }

    const mapContainer = document.getElementById(MAP_CONTAINER_ID);
    if (!mapContainer) {
        console.error('No se encontró el contenedor del mapa.');
        return;
    }

    const preloader = document.getElementById('preloader');
    const lastUpdatedEl = document.getElementById('last-updated');
    const refreshBtn = document.getElementById('refresh-data');

    // Configuración de límites del mapa
    const mexicoBounds = L.latLngBounds(
        [14.0, -118.0],
        [33.5, -86.0]
    );

    // Configuración de graticule (retícula de coordenadas)
    const GRATICULE_STEP = 5;
    const GRATICULE_FINE_STEP = 0.5;
    const GRATICULE_PADDING_DEGREES = 10;

    const graticuleBounds = L.latLngBounds(
        [
            mexicoBounds.getSouth() - GRATICULE_PADDING_DEGREES,
            mexicoBounds.getWest() - GRATICULE_PADDING_DEGREES
        ],
        [
            mexicoBounds.getNorth() + GRATICULE_PADDING_DEGREES,
            mexicoBounds.getEast() + GRATICULE_PADDING_DEGREES
        ]
    );

    // Generar coordenadas de graticule
    const graticuleLatitudes = [];
    for (
        let lat = Math.floor(graticuleBounds.getSouth() / GRATICULE_STEP) * GRATICULE_STEP;
        lat <= Math.ceil(graticuleBounds.getNorth() / GRATICULE_STEP) * GRATICULE_STEP;
        lat += GRATICULE_STEP
    ) {
        graticuleLatitudes.push(lat);
    }

    const graticuleLongitudes = [];
    for (
        let lng = Math.floor(graticuleBounds.getWest() / GRATICULE_STEP) * GRATICULE_STEP;
        lng <= Math.ceil(graticuleBounds.getEast() / GRATICULE_STEP) * GRATICULE_STEP;
        lng += GRATICULE_STEP
    ) {
        graticuleLongitudes.push(lng);
    }

    const graticuleWest = Math.min(...graticuleLongitudes) - GRATICULE_STEP;
    const graticuleEast = Math.max(...graticuleLongitudes) + GRATICULE_STEP;
    const graticuleSouth = Math.min(...graticuleLatitudes) - GRATICULE_STEP;
    const graticuleNorth = Math.max(...graticuleLatitudes) + GRATICULE_STEP;

    // Configuración de capas de MapTiler
    const mapTilerKeys = {
        personal: 'jAAFQsMBZ9a6VIm2dCwg',
        amigo: 'xRR3xCujdkUjxkDqlNTG'
    };

    const mapTilerAttribution = '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    const fallbackAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    function hasMapTilerSDK() {
        return typeof L !== 'undefined' &&
            typeof L.maptiler !== 'undefined' &&
            typeof L.maptiler.maptilerLayer === 'function';
    }

    function buildMapTilerUrl(styleId, apiKey) {
        return 'https://api.maptiler.com/maps/' + styleId + '/256/{z}/{x}/{y}.png?key=' + apiKey;
    }

    let map;
    let geoJsonLayer; // Declare geoJsonLayer globally

    function createMapTilerLayer(styleId, keyName, fallbackUrl, name) {
        const apiKey = mapTilerKeys[keyName];
        const fallbackLayer = fallbackUrl ? L.tileLayer(fallbackUrl, {
            attribution: fallbackAttribution,
            maxZoom: 18
        }) : null;

        if (!apiKey) {
            console.warn('No existe API key para', keyName, '; usando fallback para', name);
            return fallbackLayer;
        }

        if (hasMapTilerSDK()) {
            try {
                const layer = L.maptiler.maptilerLayer({
                    apiKey: apiKey,
                    style: styleId,
                    maxZoom: 18
                });
                if (layer && layer.options && !layer.options.maxZoom) {
                    layer.options.maxZoom = 18;
                }
                return layer;
            } catch (error) {
                console.warn('Error creando ' + name + ' con MapTiler SDK:', error);
            }
        } else {
            console.warn('MapTiler SDK no disponible; usando fallback para ' + name);
        }

        if (fallbackLayer) {
            return fallbackLayer;
        }

        return L.tileLayer(buildMapTilerUrl(styleId, apiKey), {
            attribution: mapTilerAttribution,
            maxZoom: 18
        });
    }

    // URLs de fallback
    const fallbackLight = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    const fallbackDark = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    // Configuración de capas de mapa
    const layerConfigs = {
        'sener-azul': {
            label: 'SENER Azul',
            creator: () => createMapTilerLayer('0198a42c-5e08-77a1-9773-763ee4e12b32', 'personal', fallbackLight, 'SENER Azul')
        },
        'sener-light': {
            label: 'SENER Light',
            creator: () => createMapTilerLayer('0198a9af-dc7c-79d3-8316-a80767ad1d0f', 'amigo', fallbackLight, 'SENER Light')
        },
        'sener-oscuro': {
            label: 'SENER Oscuro',
            creator: () => createMapTilerLayer('0198a9f0-f135-7991-aaec-bea71681556e', 'amigo', fallbackDark, 'SENER Oscuro')
        },
        'google-satelite': {
            label: 'Google Satélite',
            creator: () => L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                attribution: '&copy; Google',
                maxZoom: 20
            })
        },
        'carto-light': {
            label: 'CartoDB Light',
            creator: () => L.tileLayer(fallbackLight, {
                attribution: fallbackAttribution,
                maxZoom: 18
            })
        },
        'carto-dark': {
            label: 'CartoDB Dark',
            creator: () => L.tileLayer(fallbackDark, {
                attribution: fallbackAttribution,
                maxZoom: 18
            })
        }
    };

    const baseLayers = {};
    const baseLayersForControl = {};

    Object.entries(layerConfigs).forEach(function ([key, config]) {
        config.layer = config.creator();
        if (config.layer) {
            baseLayers[key] = config.layer;
            baseLayersForControl[config.label] = config.layer;
        }
    });

    // Add a "None" layer for a white background
    const noBaseLayer = L.layerGroup();
    baseLayersForControl['Ninguno'] = noBaseLayer;


    const baseKeys = Object.keys(baseLayers);
    if (!baseKeys.length) {
        console.error('No hay mapas base disponibles.');
        return;
    }

    const defaultBaseKey = baseLayers['sener-light'] ? 'sener-light' : baseKeys[0];
    const activeBaseLayer = baseLayers[defaultBaseKey];

    // Inicializar el mapa
    map = L.map(MAP_CONTAINER_ID, {
        center: [23.6345, -102.5528],  // Centro de México
        zoom: 5.2,  // Zoom para escala de ~500km
        minZoom: 4,  // Permitir más alejamiento
        maxZoom: 18,
        maxBounds: graticuleBounds,
        maxBoundsViscosity: 1,
        layers: activeBaseLayer ? [activeBaseLayer] : [],
        zoomControl: false,
        preferCanvas: false // Disable canvas rendering to fall back to SVG for better event handling
    });
    map.isBasemapActive = true; // Initialize the flag

    // Añadir controles
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({
        position: 'bottomleft',
        imperial: false,
        maxWidth: 180,
        updateWhenIdle: true
    }).addTo(map);

    let currentBaseLayerName = 'SENER Light';

    // Handle background for "None" basemap
    map.on('baselayerchange', function (e) {
        currentBaseLayerName = e.name;
        map.isBasemapActive = e.name !== 'Ninguno';

        if (e.name === 'Ninguno') {
            map.getContainer().style.backgroundColor = 'white';
            insetControllers.forEach(controller => {
                if (controller.baseLayer) {
                    controller.map.removeLayer(controller.baseLayer);
                }
                controller.map.getContainer().style.backgroundColor = 'white';
            });
        } else {
            map.getContainer().style.backgroundColor = '';
            const newLayerConfig = Object.values(layerConfigs).find(config => config.label === e.name);
            if (newLayerConfig && newLayerConfig.creator) {
                insetControllers.forEach(controller => {
                    if (controller.baseLayer) {
                        controller.map.removeLayer(controller.baseLayer);
                    }
                    const newInsetBaseLayer = newLayerConfig.creator();
                    if (newInsetBaseLayer) {
                        newInsetBaseLayer.addTo(controller.map);
                        controller.baseLayer = newInsetBaseLayer;
                    }
                    controller.map.getContainer().style.backgroundColor = '';
                });
            }
        }
    });

    // Contenedor para los logos institucionales
    const logoContainer = L.DomUtil.create('div', 'logos-control-wrapper', map.getContainer());
    logoContainer.innerHTML = `
        <div class="logos-container">
            <img src="img/logo_sener.png" alt="SENER" class="logo-sener" />
            <img src="img/snien.png" alt="SNIEn" class="logo-snien" />
        </div>
    `;



    // Crear capa de graticule (líneas de latitud y longitud)
    function createGraticule() {
        const graticuleLayer = L.layerGroup();

        // Líneas de latitud (horizontales)
        graticuleLatitudes.forEach(function (lat) {
            const latlngs = [];
            for (let lng = graticuleWest; lng <= graticuleEast; lng += GRATICULE_FINE_STEP) {
                latlngs.push([lat, lng]);
            }

            L.polyline(latlngs, {
                color: '#601623',
                weight: 1.5,
                opacity: 0.5,
                dashArray: '3, 6'
            }).addTo(graticuleLayer);
        });

        // Líneas de longitud (verticales)
        graticuleLongitudes.forEach(function (lng) {
            const latlngs = [];
            for (let lat = graticuleSouth; lat <= graticuleNorth; lat += GRATICULE_FINE_STEP) {
                latlngs.push([lat, lng]);
            }

            L.polyline(latlngs, {
                color: '#601623',
                weight: 1.5,
                opacity: 0.5,
                dashArray: '3, 6'
            }).addTo(graticuleLayer);
        });

        return graticuleLayer;
    }

    // Capa ligera para mostrar etiquetas de coordenadas junto a las líneas de graticule
    const GraticuleLabels = L.Layer.extend({
        initialize: function (options = {}) {
            L.setOptions(this, options);
            this._latitudes = Array.isArray(options.latitudes) && options.latitudes.length ? options.latitudes : graticuleLatitudes;
            this._longitudes = Array.isArray(options.longitudes) && options.longitudes.length ? options.longitudes : graticuleLongitudes;
        },

        onAdd: function (map) {
            this._map = map;
            this._container = L.DomUtil.create('div', 'graticule-labels-control', map.getContainer());
            this._container.style.pointerEvents = 'none';

            this._topLabels = L.DomUtil.create('div', 'graticule-labels-top', this._container);
            this._bottomLabels = L.DomUtil.create('div', 'graticule-labels-bottom', this._container);
            this._leftLabels = L.DomUtil.create('div', 'graticule-labels-left', this._container);
            this._rightLabels = L.DomUtil.create('div', 'graticule-labels-right', this._container);

            map.on('move zoom viewreset resize', this._updateLabels, this);
            if (this.options.targetLayer) {
                map.on('overlayadd overlayremove', this._updateLabels, this);
            }

            this._updateLabels();
        },

        onRemove: function (map) {
            map.off('move zoom viewreset resize', this._updateLabels, this);
            if (this.options.targetLayer) {
                map.off('overlayadd overlayremove', this._updateLabels, this);
            }

            if (this._container) {
                L.DomUtil.remove(this._container);
                this._container = null;
                this._topLabels = null;
                this._bottomLabels = null;
                this._leftLabels = null;
                this._rightLabels = null;
            }

            this._map = null;
        },

        _formatLongitude: function (lng) {
            const hemisphere = lng < 0 ? 'O' : 'E';
            const absValue = Math.abs(Math.round(lng));
            return `${absValue}&deg;00'00" ${hemisphere}`;
        },

        _formatLatitude: function (lat) {
            const hemisphere = lat >= 0 ? 'N' : 'S';
            const absValue = Math.abs(Math.round(lat));
            return `${absValue}&deg;00'00" ${hemisphere}`;
        },

        _clearLabels: function () {
            if (!this._topLabels) {
                return;
            }
            this._topLabels.innerHTML = '';
            this._bottomLabels.innerHTML = '';
            this._leftLabels.innerHTML = '';
            this._rightLabels.innerHTML = '';
        },

        _updateLabels: function () {
            if (!this._map || !this._container) {
                return;
            }

            const shouldShow = !this.options.targetLayer || this._map.hasLayer(this.options.targetLayer);
            this._container.style.display = shouldShow ? '' : 'none';

            if (!shouldShow) {
                this._clearLabels();
                return;
            }

            const bounds = this._map.getBounds();
            const size = this._map.getSize();
            const north = bounds.getNorth();
            const south = bounds.getSouth();
            const west = bounds.getWest();
            const east = bounds.getEast();
            const longitudes = Array.isArray(this._longitudes) ? this._longitudes : [];
            const latitudes = Array.isArray(this._latitudes) ? this._latitudes : [];

            this._clearLabels();

            longitudes.forEach((lng) => {
                if (lng < west - 0.1 || lng > east + 0.1) {
                    return;
                }

                const topPoint = this._map.latLngToContainerPoint([north, lng]);
                if (topPoint.x < 0 || topPoint.x > size.x) {
                    return;
                }

                const labelText = this._formatLongitude(lng);

                const topLabel = L.DomUtil.create('div', 'graticule-label-item', this._topLabels);
                topLabel.innerHTML = labelText;
                topLabel.style.left = topPoint.x + 'px';
                topLabel.style.position = 'absolute';

                const bottomLabel = L.DomUtil.create('div', 'graticule-label-item', this._bottomLabels);
                bottomLabel.innerHTML = labelText;
                bottomLabel.style.left = topPoint.x + 'px';
                bottomLabel.style.position = 'absolute';
            });

            latitudes.forEach((lat) => {
                if (lat < south - 0.1 || lat > north + 0.1) {
                    return;
                }

                const leftPoint = this._map.latLngToContainerPoint([lat, west]);
                if (leftPoint.y < 0 || leftPoint.y > size.y) {
                    return;
                }

                const labelText = this._formatLatitude(lat);

                const leftLabel = L.DomUtil.create('div', 'graticule-label-item', this._leftLabels);
                leftLabel.innerHTML = labelText;
                leftLabel.style.top = leftPoint.y + 'px';
                leftLabel.style.position = 'absolute';

                const rightPoint = this._map.latLngToContainerPoint([lat, east]);
                const rightLabel = L.DomUtil.create('div', 'graticule-label-item', this._rightLabels);
                rightLabel.innerHTML = labelText;
                rightLabel.style.top = rightPoint.y + 'px';
                rightLabel.style.position = 'absolute';
            });
        }
    });

    const graticuleLayer = createGraticule();
    const graticuleLabels = new GraticuleLabels({ targetLayer: graticuleLayer, latitudes: graticuleLatitudes, longitudes: graticuleLongitudes });
    map.createPane('marinasPane');
    const marinasLayer = L.layerGroup({ pane: 'marinasPane' }).addTo(map);

    graticuleLayer.addTo(map);
    graticuleLabels.addTo(map);
    marinasLayer.addTo(map);

    // Crear overlays para el control de capas
    const overlays = {
        'Retícula (Lat/Lon)': graticuleLayer,
        'Regiones Marinas': marinasLayer
    };

    if (Object.keys(baseLayersForControl).length) {
        L.control.layers(baseLayersForControl, overlays, { position: 'topright', collapsed: true }).addTo(map);
    }

    // Configurar vista inicial del mapa
    let currentBaseLayer = activeBaseLayer || null;

    map.fitBounds(mexicoBounds.pad(-0.15));

    const markersLayer = L.layerGroup().addTo(map);
    let markersClusterGroup = null;
    let electricityPermitsData = []; // Store electricity permits data for search
    let currentFilteredData = []; // Store currently filtered/visible permits
    let currentFilter = null; // Store current filter {type: 'gcr'|'tech', value: 'name'}
    let gcrGeometries = null; // Store GCR geometries from GeoJSON
    let statesGeometries = null; // Store States geometries from GeoJSON
    let gcrLayerGroup = null; // Layer for GCR highlighting
    let statesLayerGroup = null; // Layer for States highlighting
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

    // Funciones auxiliares
    function togglePreloader(show) {
        if (!preloader) {
            return;
        }
        preloader.classList.toggle('hidden', !show);
    }

    const insetBoundsLayerGroup = L.layerGroup().addTo(map);
    let insetControllers = [];

    function clearInsetMarkers() {
        insetControllers.forEach(controller => {
            if (controller.markersLayer && typeof controller.markersLayer.clearLayers === 'function') {
                controller.markersLayer.clearLayers();
            }
        });
    }

    function clearInsetPolygons() {
        insetControllers.forEach(controller => {
            if (controller.polygonsLayer && typeof controller.polygonsLayer.clearLayers === 'function') {
                controller.polygonsLayer.clearLayers();
            }
        });
    }

    function clearInsetLines() {
        insetControllers.forEach(controller => {
            if (controller.linesLayer && typeof controller.linesLayer.clearLayers === 'function') {
                controller.linesLayer.clearLayers();
            }
        });
    }

    function clearInsetLayers() {
        clearInsetMarkers();
        clearInsetPolygons();
        clearInsetLines();
    }

    function destroyInsetMaps() {
        clearInsetLayers();
        insetControllers.forEach(controller => {
            if (controller.map) {
                controller.map.remove();
            }
            if (controller.container && controller.container.parentNode) {
                controller.container.parentNode.removeChild(controller.container);
            }
        });
        insetControllers = [];
        insetBoundsLayerGroup.clearLayers();
    }

    function createInsetMaps(insets) {
        destroyInsetMaps();
        if (!Array.isArray(insets) || !insets.length) {
            return;
        }
        const mapContainerEl = map.getContainer();
        const defaultPositions = [
            { top: '18px', right: '18px' },
            { bottom: '18px', right: '18px' },
            { top: '18px', left: '18px' },
            { bottom: '18px', left: '18px' }
        ];

        insets.forEach((insetConfig, index) => {
            const container = document.createElement('div');
            container.className = 'map-inset';
            const widthValue = insetConfig.size && insetConfig.size.width !== undefined ? insetConfig.size.width : 220;
            const heightValue = insetConfig.size && insetConfig.size.height !== undefined ? insetConfig.size.height : 160;
            container.style.width = typeof widthValue === 'number' ? widthValue + 'px' : String(widthValue);
            container.style.height = typeof heightValue === 'number' ? heightValue + 'px' : String(heightValue);

            const position = insetConfig.position || defaultPositions[index] || defaultPositions[0];
            ['top', 'right', 'bottom', 'left'].forEach(prop => {
                if (position && position[prop] !== undefined) {
                    const value = position[prop];
                    container.style[prop] = typeof value === 'number' ? value + 'px' : value;
                }
            });

            const titleEl = document.createElement('div');
            titleEl.className = 'map-inset__title';
            titleEl.textContent = insetConfig.label || 'Detalle';
            container.appendChild(titleEl);

            const insetMapEl = document.createElement('div');
            insetMapEl.className = 'map-inset__map';
            container.appendChild(insetMapEl);

            mapContainerEl.appendChild(container);

            const insetMap = L.map(insetMapEl, {
                attributionControl: true,
                zoomControl: false,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                boxZoom: false,
                keyboard: false,
                tap: false,
                inertia: false
            });

            container.addEventListener('mouseover', () => {
                insetMap.dragging.enable();
                insetMap.scrollWheelZoom.enable();
                insetMap.doubleClickZoom.enable();
                insetMap.boxZoom.enable();
            });

            container.addEventListener('mouseout', () => {
                insetMap.dragging.disable();
                insetMap.scrollWheelZoom.disable();
                insetMap.doubleClickZoom.disable();
                insetMap.boxZoom.disable();
            });

            const initialLayerConfig = Object.values(layerConfigs).find(config => config.label === currentBaseLayerName);
            let initialInsetBaseLayer;
            if (initialLayerConfig && initialLayerConfig.creator) {
                initialInsetBaseLayer = initialLayerConfig.creator();
            } else {
                // Fallback to a default layer if something goes wrong
                initialInsetBaseLayer = L.tileLayer(fallbackLight, {
                    attribution: fallbackAttribution,
                    maxZoom: 18
                });
            }
            initialInsetBaseLayer.addTo(insetMap);

            const insetPolygonsLayer = L.layerGroup().addTo(insetMap);
            const insetLinesLayer = L.layerGroup().addTo(insetMap);
            const insetMarkersLayer = L.layerGroup().addTo(insetMap);

            let rectangle;
            if (Array.isArray(insetConfig.bounds) && insetConfig.bounds.length === 2) {
                rectangle = L.rectangle(insetConfig.bounds, {
                    color: '#1f7a62',
                    weight: 1.5,
                    dashArray: '4',
                    fill: false,
                    interactive: false
                }).addTo(insetBoundsLayerGroup);
            }

            if (Array.isArray(insetConfig.center) && insetConfig.center.length === 2) {
                insetMap.setView(insetConfig.center, insetConfig.zoom || 7);
            } else if (Array.isArray(insetConfig.bounds) && insetConfig.bounds.length === 2) {
                insetMap.fitBounds(insetConfig.bounds);
            }

            insetControllers.push({
                container,
                map: insetMap,
                baseLayer: initialInsetBaseLayer,
                polygonsLayer: insetPolygonsLayer,
                linesLayer: insetLinesLayer,
                markersLayer: insetMarkersLayer,
                config: insetConfig,
                rectangle
            });
        });
    }

    function getNodeMarkerOptions(includePane) {
        const options = {
            radius: NODE_MARKER_OPTIONS.radius,
            fillColor: NODE_MARKER_OPTIONS.fillColor,
            color: NODE_MARKER_OPTIONS.color,
            weight: NODE_MARKER_OPTIONS.weight,
            opacity: NODE_MARKER_OPTIONS.opacity,
            fillOpacity: NODE_MARKER_OPTIONS.fillOpacity
        };
        if (includePane) {
            options.pane = 'nodesPane';
        }
        return options;
    }

    function clearData() {
        markersLayer.clearLayers();
        clearInsetMarkers();
        
        // Clear cluster group if exists
        if (markersClusterGroup) {
            map.removeLayer(markersClusterGroup);
            markersClusterGroup = null;
        }
        
        // Clear electricity permits data
        electricityPermitsData = [];
        currentFilteredData = [];
        currentFilter = null;
        // Don't clear gcrGeometries and statesGeometries - we can reuse them
        
        // Clear search box
        clearSearchBox();
        
        // Hide geometry layers
        hideGeometryLayers();
        
        // Hide filters panel
        const filtersPanel = document.getElementById('electricity-filters-panel');
        if (filtersPanel) {
            filtersPanel.style.display = 'none';
        }
        
        if (lastUpdatedEl) {
            lastUpdatedEl.textContent = '--';
        }
    }

    // --- Instrument and Map Selection Logic ---

    const instrumentSelect = document.getElementById('instrument-select');
    const mapSelect = document.getElementById('map-select');
    const sheetInfoEl = document.getElementById('sheet-info');
    map.createPane('gerenciasPane');
    map.getPane('gerenciasPane').style.zIndex = 400; // Set explicit z-index for gerencias
    map.createPane('statesPane');
    map.getPane('statesPane').style.zIndex = 400; // Same level as gerencias
    const instrumentLayerGroup = L.layerGroup({ pane: 'gerenciasPane' }).addTo(map);
    map.createPane('connectionsPane');
    const connectionsLayerGroup = L.layerGroup({ pane: 'connectionsPane' }).addTo(map);
    map.createPane('municipalitiesPane');
    map.getPane('municipalitiesPane').style.zIndex = 450;
    const municipalitiesLayerGroup = L.layerGroup({ pane: 'municipalitiesPane' }).addTo(map);
    map.createPane('nodesPane');
    const nodesPane = map.getPane('nodesPane');
    if (nodesPane) {
        nodesPane.style.zIndex = 620;
        nodesPane.style.pointerEvents = 'auto';
    }
    
    // Create pane for electricity permits markers (above gerencias)
    map.createPane('electricityMarkersPane');
    const electricityMarkersPane = map.getPane('electricityMarkersPane');
    if (electricityMarkersPane) {
        electricityMarkersPane.style.zIndex = 650; // Increased to be well above everything
        electricityMarkersPane.style.pointerEvents = 'auto';
    }
    
    const connectionsPane = map.getPane('connectionsPane');
    if (connectionsPane) {
        connectionsPane.style.zIndex = 610;
        connectionsPane.style.pointerEvents = 'none';
    }

    const mapTitleDisplay = document.getElementById('map-title-display');
    const selectedRegionBanner = document.getElementById('selected-region-banner');
    const selectedRegionText = document.getElementById('selected-region-text');
    const DEFAULT_MAP_TITLE = [
        'Mapa SNIEn - Sistema Nacional de Informaci',
        String.fromCharCode(243),
        'n Energ',
        String.fromCharCode(233),
        'tica'
    ].join('');

    function updateMapTitleDisplay(title) {
        if (!mapTitleDisplay) {
            return;
        }
        mapTitleDisplay.textContent = title && title.trim() ? title : DEFAULT_MAP_TITLE;
    }
    updateMapTitleDisplay(DEFAULT_MAP_TITLE);
    let currentMapTitle = DEFAULT_MAP_TITLE;
    let municipalitiesData = null;
    let electrificationData = null;
    let focusedRegion = null; // Track currently focused region for electrification map
    let pibSenData = null; // Store SEN data for PIB map
    let pibSinData = null; // Store SIN data for PIB map
    let capacityTotals = null; // Store totals for capacity additions map

    const mapConfigurations = {
        'PLADESE': [
            {
                name: 'Regiones y enlaces del SEN en 2025',
                geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
                geojsonUrlType: 'regions',
                connectionsGeojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/lienas.geojson',
                //googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRBhcrQHIMTSx9uf7i-iRPCm1i5JT20AYRqKsMBn-JZa4jHNFUKuftYnU5N0IdeQ3IUeyE_tr8Swnjo/pub?gid=0&single=true&output=csv',
                googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRmiZTItq8d5z_ljlcWJjvYW1pEZ-TG2sFdOgjJPZZXeXHreDN0EcYOS6APs4L8zmsCjmCxVg4C_y4S/pub?gid=0&single=true&output=csv',
                //googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1XuB7E8Vz4OqNf6lzGUr_8JJ9QE9ksqwSqSSx58yr-Gw/edit?usp=sharing',
                googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/18bRXnlygfBG0uJ5Z6RGvut6RlvC3Tip6-VjTQ6PrtzM/edit?usp=sharing',
                descriptionTitle: 'Diagnóstico del sector eléctrico',
                description: 'El suministro eléctrico es uno de los principales servicios capaces de impulsar y generar prosperidad y desarrollo para todos los sectores del país: desde un hogar, hasta comercios, el campo, otros servicios públicos y la industria. En esta sección se presenta un diagnóstico con las principales características que guarda el sector eléctrico nacional y su evolución de 2010 a 2024, como lo son: la demanda y el consumo, el consumo final, las pérdidas eléctricas, la infraestructura de transmisión y distribución, la red de gasoductos, la cobertura eléctrica, las tarifas eléctricas, las emisiones de gases de efecto invernadero, la cobertura del servicio eléctrico, la innovación, así como el desarrollo tecnológico y de capacidades.<br><br>El SEN se compone de 8 Gerencias de Control Regional (GCR) con 100 regiones de transmisión (Figura 2.1) y enlaces equivalentes que interconectan a estas y a las GCR. La GCR Baja California contiene tres sistemas interconectados: El Sistema Interconectado de Baja California (SIBC), el Sistema Interconectado de Baja California Sur (SIBCS) y el Sistema Interconectado de Mulegé (SIMUL). Por su parte, las GCR Central (CEN), Noreste (NES), Noroeste (NOR), Norte (NTE), Occidental (OCC), Oriental (ORI) y Peninsular (PEN) conforman el Sistema Interconectado Nacional (SIN).',
                insets: [
                    {
                        label: 'Detalle Baja California',
                        center: [23.2, -110.5],
                        zoom: 7,
                        size: { width: 220, height: 160 },
                        position: { bottom: '18px', left: '18px' },
                        bounds: [
                            [21.5, -112.5],
                            [24.8, -108.5]
                        ]
                    },
                    {
                        label: 'Detalle Peninsular',
                        center: [20.9, -87.4],
                        zoom: 7,
                        size: { width: 220, height: 160 },
                        position: { top: '18px', right: '18px' },
                        bounds: [
                            [19.5, -89.2],
                            [22.2, -85.5]
                        ]
                    }
                ]
            },
            {
                name: 'Red nacional de gasoductos en 2024',
                geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/estados.geojson',
                geojsonUrlType: 'states',
                googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSR7XevbKi6yGLS8hLXmWnBZIvOWu4xB45B0-VA7CNIleOY_88YGzZf9W_zf0GVIb5k5pHzSI7RE7tY/pub?gid=0&single=true&output=csv',
                googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1xcApSZqIxPsu4x59_pHZ1Ym62id52CyIIXVC7AopQhM/edit?usp=sharing',
                descriptionTitle: 'Evolución de la red nacional de gasoductos',
                description: 'La generación de energía eléctrica a partir de tecnologías con funcionamiento basado en el consumo de gas natural (principalmente Turbogás y Ciclo Combinado) ha tomado relevancia en el contexto nacional. Con una TMCA de 3.1% en la generación eléctrica de estas dos tecnologías durante el periodo 2010-2024 (Ver Tabla 2.2), se ha tenido que construir y adaptar la infraestructura para ello. En esta sección se reporta la infraestructura existente para abastecer el combustible necesario para la generación de energía eléctrica.',
                pipelineGeojsonUrls: [
                    'https://cdn.sassoapps.com/Mapas/Electricidad/Ductos%20de%20Importacion.geojson',
                    'https://cdn.sassoapps.com/Mapas/Electricidad/Ductos%20integrados%20a%20SISTRANGAS.geojson',
                    'https://cdn.sassoapps.com/Mapas/Electricidad/Ductos%20no%20integrados%20a%20SISTRANGAS.geojson'
                ]
            },
            {
                name: 'Municipios con localidades sin electrificar',
                geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
                geojsonUrlType: 'interactive-regions',
                municipalitiesGeojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/municipios.geojson',
                googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRrctgh6EBDr8aCcqVWA5X03JtFm1E0NRb2h6bOrQMqO9qVr58MAgqtnHsRfqjzJgR7VqVtvqNUJRM-/pub?gid=0&single=true&output=csv',
                googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/182C6iNiTUcUI5HHVlNGg0IOJHoGYeI47uYwAaehC6E8/edit?usp=sharing',
                regionDescriptions: {
                    // Descriptions will be added later
                }
            },
            {
                name: 'Pronóstico regional del PIB, escenario de planeación 2025 - 2030 y 2025-2039',
                geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
                geojsonUrlType: 'pib-forecast',
                googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSVE7N8gjuivL9JiM59vFBjiej5k48foC60TrSRGXjEAbJXvW0NXTZ3Fq0-kWzY73kmMPSq68xtpZE2/pub?gid=0&single=true&output=csv',
                googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1NumCWqCiRd6Ph1vXOrsc1lcyv4Hx-v_1Lve1QIV2kdE/edit?usp=sharing',
                descriptionTitle: 'Pronóstico regional del PIB, escenario de planeación 2025 - 2030 y 2025-2039',
                description: 'El periodo de estudio 2025-2039, se estima que la participación en el PIB de los sectores de la economía mexicana se comporte de la siguiente manera: se estima que el PIB del sector primario crezca en promedio 1.9% por año, mientras que el Sector Industrial y el Sector Servicios lo harán a una tasa de 2.5% cada uno. En la composición sectorial del PIB, se prevé que, en 2039, el sector Agrícola represente el 3.1% del PIB Nacional, mientras que el Industrial y el de Servicios integrarán el 33.5% y 63.4%, respectivamente.<br><br>El Servicio Público de Energía Eléctrica se distribuye a través de las diferentes entidades responsables de carga los cuales se desagregan en seis sectores por el uso final de la energía eléctrica, con una diferente participación en el Consumo Eléctrico Nacional: residencial, comercial, servicios, agrícola, empresa mediana y gran industria.<br><br>Para el 2024 el SEN tuvo un consumo final de 304,011 GWh, siendo 1.8% mayor al del año previo. En cuanto a los usuarios con servicio de energía eléctrica crecieron 1.7% respecto al 2023, llegando a 49 millones de clientes. Los sectores empresa mediana y la gran industria consumieron el 60.6 % del consumo final, con solo el 0.9% del total de los usuarios. En el sector residencial, se alberga la mayor cantidad de usuarios con 89.2%, los cuales consumen sólo el 27.1% del SEN. El 12.4% restante del consumo final es utilizado por los usuarios de los sectores comercial con 5.9%, bombeo agrícola con 5.2% y servicios 1.3%.<br><br>Con el propósito de fomentar el crecimiento económico del país, se creó el Plan México, una estrategia gubernamental de largo plazo, que tiene como propósitos: incrementar la inversión, la creación de nuevos empleos, la proveeduría y consumo nacional en sectores estratégicos, disminución de la pobreza y la desigualdad, entre otros. Para ello, se planteó garantizar el acceso universal a la electricidad mediante el fortalecimiento de la infraestructura eléctrica del país. Por lo que, el Plan México contempla además de obras de electrificación, aumentos en la capacidad de generación pública y capacidad de generación mixta (pública y privada), además de proyectos de transmisión y distribución, con énfasis en las áreas marginadas. Se dará continuidad al programa de cobertura eléctrica nacional con fines sociales y comunitarios, permitiendo así el desarrollo local y regional, con la premisa de asegurar que las tarifas no aumenten en términos reales.<br><br>El Plan México regionaliza sus proyectos en Polos de Desarrollo Económico para el Bienestar (PODECOBIS), los primeros 15 polos estarán ubicados en 14 estados en los que se busca desarrollar zonas industriales, sin dejar de lado los servicios y el turismo. Dentro de ramas industriales contempladas están: agroindustria, aeroespacial, automotriz, bienes de consumo, farmacéutica y dispositivos médicos, electrónica y semiconductores, energía, química y petroquímica, textil y calzado, y economía circular.<br><br>Como parte de las inversiones estratégicas derivadas del Plan México, se continuará con la expansión y rehabilitación de redes ferroviarias mediante proyectos como los trenes México-Querétaro, México-Pachuca, Saltillo-Nuevo Laredo, Querétaro-Irapuato, Tren Insurgente y Tren Maya de Carga, así como la modernización de puertos y carreteras. Con estas acciones, se busca posicionar a México como nodo estratégico en las cadenas de suministro, impulsando la inversión en logística y comercio, y promoviendo el crecimiento y el desarrollo económico.<br><br>Las expectativas de crecimiento del PIB presentan un comportamiento diferenciado entre el mediano y largo plazo, ya que, en este último, la incertidumbre es mayor. Para el periodo 2025-2030, por Gerencia de Control Regional (GCR), se espera que los sistemas de Baja california y Mulegé (SIBCS y SIMUL) presenten la mayor TMCA con 3.1%, mientras que el menor crecimiento del PIB se estima ocurra en la GCR NTE, con 2.0%. Tanto el SIN como el SEN se proyecta un crecimiento de 2.5% anual en el mismo periodo. En el periodo 2025-2039, los SIBCS y SIMUL se prevé que continúen con mayor crecimiento y, en contraste, en la GCR NTE y ORI se estima la menor TMCA, con 2.2%. Para el SIN y el SEN se espera una TMCA de 2.5% cada uno.'
            },
            {
                name: 'Pronósticos del consumo bruto 2025 - 2030 y 2025 - 2039',
                geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
                geojsonUrlType: 'consumption-forecast',
                googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQytuUc9Cmf9kOvPCmLkYEOObPEP_rM1bSb9_awO0wYqdLAKw4x_b9FLEBSVGoGXKbDuK8nK4ge2cjM/pub?gid=0&single=true&output=csv',
                googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1XdFM-P6c3N4wS5arzJ3K4hUcIMibCeBX5iz3IQ_3U2A/edit?usp=sharing',
                descriptionTitle: 'Pronósticos del consumo bruto',
                description: 'Se presentan las TMCA de los tres escenarios para cada una de las GCR que integran el SIN en el periodo de estudio. Tomando en cuenta el escenario de planeación, el cual es considerado como el escenario principal para la realización de estudios y evaluación de proyectos, se observa que, la península de Yucatán presenta la TMCA más alta con un crecimiento de 3.6% en el escenario bajo, 3.9% en el escenario de planeación y 4.3% en el escenario alto. Por el contrario, en las GCR Central, Oriental, Norte y Noroeste se esperan crecimientos menores a 1.9% en el escenario bajo. Los crecimientos de estas GCR en el escenario alto oscilan entre 2.4% y 2.7%, y en el escenario de planeación se estiman incrementos de 2% a 2.2%. La GCR Noreste y Occidental crecerán en el escenario de planeación 2.8% y 2.7%, respectivamente, mientras que para el escenario alto se estiman crecimientos ligeramente superiores al 3% y para el bajo se estima 2.4% para el Noreste y 2.3% el Occidental. En lo que refiere al escenario de planeación, se estima que la GCR Peninsular tenga un mayor crecimiento, con una TMCA de 3.9%, seguida de las GCR Noreste y Occidental con crecimientos promedio de 2.8% y 2.7%, respectivamente. En cuanto a los Sistemas Interconectados, el SIBC crecerá en promedio 3.4%, mientras que el SIBCS y SIMUL se calcula avancen 3.1% y 1.8%, en ese orden.'
            },
            {
                name: 'Adiciones de Capacidad de proyectos de fortalecimiento de la CFE 2025 - 2027',
                geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
                geojsonUrlType: 'capacity-additions',
                googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR6orBJGbqI8xr6TkOUaJM7I-8RbE7inbex6PrKWHdgTUif8EBFljKuzFR42OqoroQ87kAGpZt_ry-J/pub?gid=0&single=true&output=csv',
                googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1wnpAefR4rLYhOFEzsjas_ujkDvxAlHJ7EFr0pJi-Ve4/edit?usp=sharing',
                descriptionTitle: 'Adiciones de Capacidad de proyectos de fortalecimiento de la CFE 2025 - 2027',
                description: 'Como parte del fortalecimiento de la CFE durante la administración del Gobierno Federal en el periodo 2018-2024 se impulsaron proyectos de fortalecimiento correspondientes a modernización, rehabilitación y construcción de nuevas centrales. El PVIRCE considera la adición de 2,963 MW para el horizonte 2025-2027, de los cuales 2,330 MW corresponden a tecnología de ciclo combinado, 173 MW de turbogás y 460 MW de hidroeléctricas. En la Figura 4.3 se muestra la distribución de estos proyectos por tecnología y GCR.'
            },
            {
                name: 'Adiciones de capacidad de proyectos del Estado 2027 - 2030',
                geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
                geojsonUrlType: 'capacity-additions',
                googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSuLWC7WRjRZ-Kicm-0rWJd9beVu4jAwsABNLcixRUCr6XvC0pVvrgPXJW-qh-44AvmLt6gYBDwdoms/pub?gid=0&single=true&output=csv',
                googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1M39eRP0lyefgfZsZXKWsRSAXhQPHg54T8uaNZYEew-w/edit?usp=sharing',
                descriptionTitle: 'Adiciones de capacidad de proyectos del Estado',
                description: 'En la presente administración del Gobierno Federal el PVIRCE considera la adición de 14,046 MW para el horizonte 2027-2030 por parte del Estado, con una participación del 77% de energías limpias, de las cuales el 60% corresponde a renovables, en la mapa se muestra la distribución de estos proyectos por tecnología y GCR.'
            },
            {
                name: 'Adiciones de capacidad por Particulares',
                geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
                geojsonUrlType: 'capacity-additions',
                googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRIo6nqNkppQCVqqsUC1LNKSw8n9AyslhakQb_3gB7bccFP1Tb7ssDX1ycdMe0rTSlSrWXpH_CSTMna/pub?gid=0&single=true&output=csv',
                googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1Pkudx2FB2ta7jsm-Sx3TUzUpNlT7LF6sgi6Rs-Oi-NU/edit?usp=sharing',
                descriptionTitle: 'Adiciones de capacidad de proyectos con prelación 2025 - 2030',
                description: 'De 2025 a 2030 se espera adicionar 3,590 MW de capacidad de generación que cuentan con contrato de interconexión como se observa en mapa'
            },
            {
                name: 'Adición de capacidad para desarrollarse por particulares 2026 - 2030',
                geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
                geojsonUrlType: 'capacity-additions',
                googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTYfjJ8D1nJGd7IFKOzzg_e7Dpn77RyyeQM1MVFLg4pN4CB7TR1hj_5Zt2igXlDiht8p7hVs-aIp3DQ/pub?gid=0&single=true&output=csv',
                googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/1jGSjieGMNeCyk_agXzDNF90J2srt-89Ungq4Bwda8HY/edit?usp=sharing',
                descriptionTitle: 'Adición de capacidad para desarrollarse por particulares 2026 - 2030',
                description: 'La SENER determinó también 7,405 MW de adiciones de capacidad con base a la Planeación Vinculante, que pueden ser desarrollados por particulares durante el periodo 2026 a 2030, con la participación de fuentes de generación renovables como se observa en la Figura 4.6. De los cuales 1,638 MW de capacidad de generación, y 900 MW de rebombeo hidráulico, corresponden a proyectos estratégicos para cumplir con la política energética nacional, definidos por la SENER.\nAdicionalmente, a dicha capacidad el CENACE y CNE, podrán atender y priorizar las solicitudes de otorgamiento de permisos de generación de energía eléctrica, así como la elaboración de estudios de interconexión para la figura de autoconsumo y la modalidad de cogeneración que pretendan desarrollar los particulares y que se encuentren alineados con los criterios de planeación vinculante. Asimismo, los trámites relacionados con el proceso de conexión de Centros de Carga podrán ser priorizados tomando en cuenta la política nacional atendiendo el crecimiento de la demanda de energía eléctrica en cumplimiento de las leyes, reglamentos y demás disposiciones jurídicas aplicables.'
            }
            // ... other PLADESE maps can be added here
        ],
        'PLADESHI': [
            {
                name: 'En construcción',
                underConstruction: true
            }
        ],
        'PLATEASE': [
            {
                name: 'En construcción',
                underConstruction: true
            }
        ],
        'PROSENER': [
            {
                name: 'En construcción',
                underConstruction: true
            }
        ],
        'ELECTRICIDAD': [
            {
                name: 'Permisos de Generación de Electricidad',
                geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
                geojsonUrlType: 'regions',
                googleSheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTuFBY3k10223uLmvRWSycRyAea6NjtKVLTHuTnpFMQZgWyxoCqwbXNNjTSY9nTleUoxKDtuuP_bbtn/pub?gid=0&single=true&output=csv',
                googleSheetEditUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTuFBY3k10223uLmvRWSycRyAea6NjtKVLTHuTnpFMQZgWyxoCqwbXNNjTSY9nTleUoxKDtuuP_bbtn/pub?gid=0&single=true&output=csv',
                useClusters: true,
                enableSearch: true,
                descriptionTitle: 'Permisos de Generación de Electricidad',
                description: 'Mapa de permisos de generación de electricidad en México. Los marcadores están agrupados para facilitar la visualización. Haga clic en un grupo para ampliar o en un marcador individual para ver los detalles del permiso.'
            }
        ],
        'GAS NATURAL': [
            {
                name: 'En construcción',
                underConstruction: true
            }
        ],
        'GAS L.P.': [
            {
                name: 'En construcción',
                underConstruction: true
            }
        ],
        'PETROLIFEROS': [
            {
                name: 'En construcción',
                underConstruction: true
            }
        ]
        // ... other instruments will be added here
    };

    function hasValidSheetUrl(url) {
        const trimmed = (url || '').trim();
        return Boolean(trimmed) && !trimmed.startsWith('URL_TO_');
    }

    function getDisplaySheetUrl(url) {
        const trimmed = (url || '').trim();
        if (!trimmed) {
            return '';
        }
        try {
            const sheetUrl = new URL(trimmed);
            const output = sheetUrl.searchParams.get('output');
            if (output && output.toLowerCase() === 'csv') {
                sheetUrl.searchParams.set('output', 'html');
                return sheetUrl.toString();
            }
            if (!output && trimmed.includes('/pub?')) {
                return trimmed.replace('/pub?', '/pubhtml?');
            }
            return sheetUrl.toString();
        } catch (error) {
            return trimmed;
        }
    }

    function updateSheetInfo(mapConfig, fallbackMessage) {
        if (!sheetInfoEl) {
            return;
        }
        sheetInfoEl.innerHTML = '';

        const viewUrl = mapConfig && mapConfig.googleSheetUrl ? (mapConfig.googleSheetUrl || '').trim() : '';
        const editUrl = mapConfig && mapConfig.googleSheetEditUrl ? (mapConfig.googleSheetEditUrl || '').trim() : '';

        const hasViewUrl = hasValidSheetUrl(viewUrl);
        const hasEditUrl = hasValidSheetUrl(editUrl);

        if (hasViewUrl || hasEditUrl) {
            if (hasViewUrl) {
                const displayUrl = getDisplaySheetUrl(viewUrl);
                if (/^https?:\/\//i.test(displayUrl)) {
                    const link = document.createElement('a');
                    link.href = displayUrl;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = 'Ver datos';
                    sheetInfoEl.appendChild(link);
                }
            }

            if (hasViewUrl && hasEditUrl) {
                sheetInfoEl.appendChild(document.createTextNode(' | '));
            }

            if (hasEditUrl) {
                const link = document.createElement('a');
                link.href = editUrl;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = 'Editar datos';
                sheetInfoEl.appendChild(link);
            }
        } else {
            sheetInfoEl.textContent = fallbackMessage || NO_SHEET_MESSAGE;
        }
    }

    updateSheetInfo(null, SELECT_MAP_MESSAGE);

    if (instrumentSelect) {
        instrumentSelect.addEventListener('change', function () {
            const selectedInstrument = this.value;
            mapSelect.innerHTML = '<option value="">Seleccione un mapa</option>'; // Clear previous options
            mapSelect.disabled = true;
            mapSelect.value = '';
            instrumentLayerGroup.clearLayers();
            connectionsLayerGroup.clearLayers();
            municipalitiesLayerGroup.clearLayers();
            destroyInsetMaps();
            removeLegend();

            if (selectedInstrument && mapConfigurations[selectedInstrument]) {
                const maps = mapConfigurations[selectedInstrument];
                maps.forEach(mapConfig => {
                    const option = document.createElement('option');
                    option.value = mapConfig.name;
                    option.textContent = mapConfig.name;
                    mapSelect.appendChild(option);
                });
                mapSelect.disabled = false;
                currentSheetUrl = null;
                clearData();
                updateSheetInfo(null, SELECT_MAP_MESSAGE);
                currentMapTitle = DEFAULT_MAP_TITLE;
                updateMapTitleDisplay(DEFAULT_MAP_TITLE);
            } else {
                currentSheetUrl = null;
                updateSheetInfo(null, SELECT_MAP_MESSAGE);
                clearData();
                connectionsLayerGroup.clearLayers();
                destroyInsetMaps();
                currentMapTitle = DEFAULT_MAP_TITLE;
                updateMapTitleDisplay(DEFAULT_MAP_TITLE);
            }
        });
    }

    let legendControl;

    function addLegend(colors) {
        if (legendControl) {
            map.removeControl(legendControl);
        }

        legendControl = L.control({ position: 'bottomright' });

        legendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML += '<strong>Gerencias de Control Regional</strong>';

            for (const key in colors) {
                if (colors.hasOwnProperty(key)) {
                    const color = colors[key];
                    const item = L.DomUtil.create('div', 'legend-item', div);
                    item.innerHTML = `<i style="background:${color}"></i> ${key}`;
                }
            }
            return div;
        };

        legendControl.addTo(map);
    }

    function addGasLegend() {
        if (legendControl) {
            map.removeControl(legendControl);
        }

        legendControl = L.control({ position: 'bottomright' });

        legendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML += '<strong>Simbología</strong>';
            div.innerHTML += '<div class="legend-item"><i style="background: #7a1c32; width: 20px; height: 3px; border: none;"></i> Ducto de gas</div>';
            div.innerHTML += '<div class="legend-item"><i style="background: #1f7a62; border-radius: 50%;"></i> Centrales de Ciclo Combinado</div>';
            return div;
        };

        legendControl.addTo(map);
    }

    let municipalitiesLegendControl;

    function addMunicipalitiesLegend() {
        if (municipalitiesLegendControl) {
            map.removeControl(municipalitiesLegendControl);
        }

        municipalitiesLegendControl = L.control({ position: 'bottomleft' });

        municipalitiesLegendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            const grades = [0, 1, 21, 41, 61, 81];
            const colors = ['#F2D7D9', '#E0B0B6', '#CC8893', '#B86070', '#A3384D', '#601623'];
            const labels = ['0', '1 - 20', '21 - 40', '41 - 60', '61 - 80', '> 80'];

            div.innerHTML += '<strong>Número de localidades sin electrificar por municipio</strong><br>';

            for (let i = 0; i < grades.length; i++) {
                div.innerHTML +=
                    '<i style="background:' + colors[i] + '"></i> ' +
                    labels[i] + '<br>';
            }

            return div;
        };

        municipalitiesLegendControl.addTo(map);
    }

    function removeMunicipalitiesLegend() {
        if (municipalitiesLegendControl) {
            map.removeControl(municipalitiesLegendControl);
            municipalitiesLegendControl = null;
        }
    }



    function removeLegend() {
        if (legendControl) {
            map.removeControl(legendControl);
            legendControl = null;
        }
    }

    let pibLegendControl;

    function addPIBLegend(senData, sinData) {
        if (pibLegendControl) {
            map.removeControl(pibLegendControl);
        }

        pibLegendControl = L.control({ position: 'bottomleft' });

        pibLegendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = '<strong>Tasa de Crecimiento PIB</strong><br>';
            div.innerHTML += '<div class="legend-item"><i style="background: #1f7a62; width: 20px; height: 3px; border: none;"></i> 2025-2030</div>';
            div.innerHTML += '<div class="legend-item"><i style="background: #601623; width: 20px; height: 3px; border: none;"></i> 2025-2039</div>';

            // Add SEN and SIN data if available
            if (senData || sinData) {
                div.innerHTML += '<br><strong style="font-size: 11px;">TMCA (%)</strong><br>';
                div.innerHTML += '<div style="font-size: 11px; line-height: 1.6;">';

                if (senData) {
                    div.innerHTML += '<div><strong>SEN:</strong></div>';
                    if (senData['2025-2030']) {
                        div.innerHTML += '<div style="color: #1f7a62; margin-left: 8px;">2025-2030: ' + senData['2025-2030'] + '%</div>';
                    }
                    if (senData['2025-2039']) {
                        div.innerHTML += '<div style="color: #601623; margin-left: 8px;">2025-2039: ' + senData['2025-2039'] + '%</div>';
                    }
                }

                if (sinData) {
                    div.innerHTML += '<div style="margin-top: 4px;"><strong>SIN:</strong></div>';
                    if (sinData['2025-2030']) {
                        div.innerHTML += '<div style="color: #1f7a62; margin-left: 8px;">2025-2030: ' + sinData['2025-2030'] + '%</div>';
                    }
                    if (sinData['2025-2039']) {
                        div.innerHTML += '<div style="color: #601623; margin-left: 8px;">2025-2039: ' + sinData['2025-2039'] + '%</div>';
                    }
                }

                div.innerHTML += '</div>';
            }

            return div;
        };

        pibLegendControl.addTo(map);
    }

    function addConsumptionLegend(senData, sinData) {
        if (pibLegendControl) {
            map.removeControl(pibLegendControl);
        }

        pibLegendControl = L.control({ position: 'bottomleft' });

        pibLegendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = '<strong>Pronóstico de Consumo Bruto</strong><br>';
            div.innerHTML += '<div class="legend-item"><i style="background: #1f7a62; width: 20px; height: 3px; border: none;"></i> 2025-2030</div>';
            div.innerHTML += '<div class="legend-item"><i style="background: #601623; width: 20px; height: 3px; border: none;"></i> 2025-2039</div>';

            // Add SEN and SIN data if available
            if (senData || sinData) {
                div.innerHTML += '<br><strong style="font-size: 11px;">TMCA (%)</strong><br>';
                div.innerHTML += '<div style="font-size: 11px; line-height: 1.6;">';

                if (senData) {
                    div.innerHTML += '<div><strong>SEN<sup>2</sup>:</strong></div>';
                    if (senData['2025-2030']) {
                        div.innerHTML += '<div style="color: #1f7a62; margin-left: 8px;">2025-2030: ' + senData['2025-2030'] + '%</div>';
                    }
                    if (senData['2025-2039']) {
                        div.innerHTML += '<div style="color: #601623; margin-left: 8px;">2025-2039: ' + senData['2025-2039'] + '%</div>';
                    }
                }

                if (sinData) {
                    div.innerHTML += '<div style="margin-top: 4px;"><strong>SIN<sup>2</sup>:</strong></div>';
                    if (sinData['2025-2030']) {
                        div.innerHTML += '<div style="color: #1f7a62; margin-left: 8px;">2025-2030: ' + sinData['2025-2030'] + '%</div>';
                    }
                    if (sinData['2025-2039']) {
                        div.innerHTML += '<div style="color: #601623; margin-left: 8px;">2025-2039: ' + sinData['2025-2039'] + '%</div>';
                    }
                }

                div.innerHTML += '</div>';
            }

            return div;
        };

        pibLegendControl.addTo(map);
    }

    function addCapacityLegend(totals, mapName) {
        if (pibLegendControl) {
            map.removeControl(pibLegendControl);
        }

        pibLegendControl = L.control({ position: 'bottomleft' });

        pibLegendControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = '<strong>Adiciones de Capacidad (MW)</strong><br>';
            
            // Add dynamic legend items with institutional colors
            if (totals && totals.columnNames) {
                const colors = ['#939594', '#6A1C32', '#235B4E', '#DDC9A4', '#10302B', '#BC955C', '#9F2240', '#A16F4A'];
                totals.columnNames.forEach((col, index) => {
                    if (totals.columns[col] > 0) {
                        const color = colors[index % colors.length];
                        div.innerHTML += `<div class="legend-item"><i style="background: ${color}; width: 20px; height: 10px; border: none;"></i> ${col}</div>`;
                    }
                });
            }
            
            // Add totals if available
            if (totals && totals.columns) {
                div.innerHTML += '<br><div style="border-top: 1px solid #ddd; padding-top: 8px; margin-top: 8px;">';
                div.innerHTML += '<strong style="font-size: 11px;">TOTALES</strong><br>';
                
                const colors = ['#939594', '#6A1C32', '#235B4E', '#DDC9A4', '#10302B', '#BC955C', '#9F2240', '#A16F4A'];
                totals.columnNames.forEach((col, index) => {
                    if (totals.columns[col] > 0) {
                        const color = colors[index % colors.length];
                        div.innerHTML += `<div style="font-size: 11px; color: ${color}; margin-top: 2px;">${col}: ${totals.columns[col].toLocaleString('es-MX')} MW</div>`;
                    }
                });
                
                // Add storage info for specific map
                if (mapName === 'Adiciones de capacidad de proyectos del Estado 2027 - 2030') {
                    div.innerHTML += `<div style="font-size: 11px; color: #555; margin-top: 6px; font-style: italic;">Almacenamiento: 2,480 MW</div>`;
                }
                
                div.innerHTML += `<div style="font-size: 12px; font-weight: bold; margin-top: 6px; color: #1a1a1a;">TOTAL: ${totals.total.toLocaleString('es-MX')} MW</div>`;
                div.innerHTML += '</div>';
            }
            
            return div;
        };

        pibLegendControl.addTo(map);
    }

    function removePIBLegend() {
        if (pibLegendControl) {
            map.removeControl(pibLegendControl);
            pibLegendControl = null;
        }
    }

    async function loadGeoJSON(url, options) {
        const showPreloader = !(options && options.silent);
        const type = options && options.type || 'regions';

        if (showPreloader) {
            togglePreloader(true);
        }
        try {
            const response = await fetch(url);
            const data = await response.json();

            let styleFunction;
            let onEachFeatureFunction;

            if (type === 'states') {
                styleFunction = function (feature) {
                    return {
                        fillColor: '#E0E0E0',
                        fill: true,
                        weight: 1,
                        opacity: 1,
                        color: 'white',
                        fillOpacity: 0.7,
                        pane: 'statesPane'
                    };
                }
            } else if (type === 'interactive-regions') {
                const regionColors = {
                    "Baja California": "#939594",
                    "Central": "#6A1C32",
                    "Noreste": "#235B4E",
                    "Noroeste": "#DDC9A4",
                    "Norte": "#10302B",
                    "Occidental": "#BC955C",
                    "Oriental": "#9F2240",
                    "Peninsular": "#A16F4A"
                };

                styleFunction = function (feature) {
                    const color = regionColors[feature.properties.name] || '#808080';
                    return {
                        fillColor: color,
                        fill: true,
                        weight: 0,
                        opacity: 1,
                        color: 'transparent',
                        dashArray: '3',
                        fillOpacity: 0.7,
                        pane: 'gerenciasPane' // Use the same pane for shadow
                    };
                }

                // Descripciones de las Gerencias de Control Regional
                const gcrDescriptions = {
                    "Central": {
                        title: "GCR Central",
                        description: "La GCR Central ocupa aproximadamente el 3.8% del territorio nacional. En 2024, concentró el 24.8% de la población (32.8 millones de personas) y atendió al 21.2% de las personas usuarias finales de energía eléctrica. Su consumo per cápita de energía se estima en 1,777 kWh/habitante. Sus principales Centros de Carga se encuentran en la industria de la construcción (cementeras), industria del acero, el Sistema de Transporte Colectivo-Metro, armadoras automotrices, refinería de Miguel Hidalgo (Tula) y las plantas de bombeo Cutzamala.<br><br>La GCR Central se divide en tres regiones: Valle de México Norte, Valle de México Centro y Valle de México Sur, las cuales representaron el 39.4%, 18.9% y 41.6%, respectivamente de la demanda máxima de esta GCR, para 2024. Al interior de la región Valle de México Norte destaca la zona Cuautitlán como la que concentra la mayor proporción de la demanda máxima (17.1%), seguido de Tula (12.5%) y Azteca (11.9%). Las zonas con mayor crecimiento entre 2023 y 2024 fueron Pachuca y Tula con un alza de 8.0% y 5.4%, respectivamente.<br><br>En la región Valle de México Centro, la zona Polanco y Chapingo abarcaron en conjunto el 42.2% de la demanda máxima. El mayor crecimiento durante 2024 lo registró la zona Polanco con una tasa anual de 8.0%. En lo que respecta a la región Valle de México Sur, la zona Lázaro Cárdenas destaca porque, además de concentrar el 20.1% de la demanda máxima también tuvo la tasa de crecimiento anual más elevada de la región durante 2024 con 4.3%.<br><br>En la GCR Central hay 212 localidades que no están electrificadas, repartidas en los estados de Guerrero, Hidalgo, México, Michoacán y Puebla."
                    },
                    "Baja California": {
                        title: "GCR de Baja California",
                        description: "La GCR de Baja California, opera el SIBC, el SIBCS, y el SIMUL. El SIBC ocupa el 3.6% del territorio nacional aproximadamente. En 2024, la población representó cerca de 3.1%, esto es, 4.1 millones de personas. Este Sistema atendió al 3.5% de las personas usuarias finales, con un consumo per cápita de energía eléctrica de 4,139 kWh por habitante. Los principales Centros de Carga pertenecen a las industrias siderúrgica, vidriera, plantas de bombeo de agua, aeroespacial, fabricación de rines de aluminio, automotriz, cementera y minera, y están localizadas en las zonas Mexicali, Tijuana y Ensenada.<br><br>En el SIBC, la zona Mexicali representa casi la mitad de la demanda máxima (48.8%), seguido por Tijuana-Tecate con 32.0%. Las zonas que registraron la tasa de crecimiento anual más alta durante 2024 también fueron Tijuana-Tecate y Mexicali con 3.7% y 3.1%, respectivamente.<br><br>Los SIBCS y SIMUL en conjunto abarcan aproximadamente el 3.8% del territorio nacional. En 2024, su población representó cerca del 0.7%, lo cual equivale a 0.9 millones de personas. El Sistema atendió al 0.8% de las personas usuarias finales, con un consumo per cápita de energía eléctrica de 3,941 kWh por habitante.<br><br>El SIBCS representa el 95.3% de la demanda máxima mientras que el SIMUL el 4.7% restante. El primero registró una tasa de crecimiento anual durante 2024 de 3.2% mientras que, el segundo, de 1.4%. Las zonas de mayor crecimiento fueron Los Cabos con 4.2% y Santa Rosalía con 2.4%.<br><br>En la GCR de Baja California hay 1,056 localidades que no están electrificadas que están distribuidas en los estados Baja California, Baja California Sur y Sonora."
                    },
                    "Noreste": {
                        title: "GCR Noreste",
                        description: "La GCR Noreste ocupa el 14.8% del territorio nacional, aproximadamente. En 2024, sus habitantes ascendieron cerca de 13.6 millones de personas, es decir, el 10.3% de la población del país. En 2024, la GCR NES atendió al 10.7% de las personas usuarias finales del servicio de energía eléctrica con un consumo de energía eléctrica per cápita de 4,640 kWh por habitante, siendo la GCR con el mayor consumo. Los principales Centros de Carga se concentran en las industrias siderúrgica, minera y de refinación de petróleo localizadas en las zonas Monterrey, Monclova, Concepción del Oro y Tampico.<br><br>La zona Monterrey representa casi la mitad de la demanda máxima en la GCR Noreste con 47.4%, le siguen Saltillo con 9.7%, Reynosa y Tampico con 8% cada una. Las zonas que registraron la tasa de crecimiento anual más alta durante 2024 fueron Cerralvo con un incremento cercano al 13%, Nueva Rosita con 9.6% y Río Verde con 5.6%.<br><br>En la GCR Noreste hay 767 localidades que no están electrificadas que están distribuidas en los estados Coahuila, Hidalgo, Nuevo León, San Luis Potosí, Tamaulipas y Veracruz."
                    },
                    "Noroeste": {
                        title: "GCR Noroeste",
                        description: "La GCR Noroeste ocupa alrededor de 12.1% del territorio nacional. En 2024, sus habitantes ascendieron a 6.3 millones de personas aproximadamente, lo que representa cerca del 4.7% de la población del país. En ese año, la GCR Noroeste atendió al 4.7% de las personas usuarias finales, con un consumo per cápita de 4,487 kWh por habitante. Los principales centros de carga se presentan en las industrias minera, cementera y automotriz, localizadas en las zonas Cananea, Hermosillo y Caborca.<br><br>La zona Hermosillo es la que representa el porcentaje más alto de participación en la demanda de esta GCR con 21.3%, seguida de Culiacán y Cananea Nacozari con 16.5% y 9.5%, respectivamente. Durante 2024, la zona con mayor crecimiento fue Agrícola Hermosillo con 3.5%.<br><br>En la GCR Noroeste hay 617 localidades que no están electrificadas que están distribuidas en los estados de Sinaloa y Sonora."
                    },
                    "Norte": {
                        title: "GCR Norte",
                        description: "La GCR Norte ocupa alrededor del 21.2% del territorio nacional. En 2024, sus habitantes ascendieron cerca de 6.9 millones de personas, lo que representa el 5.2% de la población del país. En ese año, la GCR Norte atendió al 5% de las personas usuarias finales del servicio de energía eléctrica con un consumo per cápita de 4,604 kWh por habitante.<br><br>Los principales Centros de Carga se agrupan en las industrias minera y metalúrgica, industria cementera, madera y papel, manufactura y agrícola. La zona Torreón es la que representa el porcentaje más alto de participación en la demanda en la GCR NTE con 24%, seguida de Ciudad Juárez con 21.9%. Las zonas que registraron el crecimiento anual más alto fueron: Casas Grandes y Durango con 5.8% y 4.9%, respectivamente.<br><br>En la GCR Norte hay 2,357 localidades que no están electrificadas que están distribuidas en los estados Chihuahua, Coahuila, Durango y Zacatecas."
                    },
                    "Occidental": {
                        title: "GCR Occidental",
                        description: "La GCR Occidental ocupa aproximadamente el 15% del territorio nacional y, durante 2024, se estima que albergó al 21.3% de la población (28.2 millones de personas). En ese mismo año, la GCR Occidental atendió al 24.2% de las personas usuarias finales mientras que, su consumo per cápita de energía eléctrica resultó de 2,709 kWh/habitante. Los principales Centros de Carga se presentan en las industrias siderúrgica, minera, cementera, automotriz e industrias conexas, las cuales se localizan principalmente en los estados de Jalisco, Guanajuato, Querétaro, Aguascalientes, Zacatecas y San Luis Potosí.<br><br>Al igual que la GCR Central, la GCR Occidental también se divide en tres regiones. La región Jalisco representó el 28.6% de la demanda máxima integrada mientras que, las regiones Bajío y Centro Occidente, el 59.9% y 11.5%, respectivamente.<br><br>En la Región Jalisco, la zona Metropolitana Hidalgo concentró el 17.3% de la demanda máxima, mientras que la zona que registró el mayor crecimiento fue Los Altos con una tasa anual de 7.2%. En el Bajío, la zona San Luis Potosí tiene la mayor concentración de demanda con 15.6% de la demanda, en tanto que la zona de mayor crecimiento fue Salamanca con 6.4%. En la región Centro Occidente, la zona Colima participa con el 30.3% de la demanda máxima. Por otro lado, la zona Apatzingán registró la tasa de crecimiento anual más alta con 3.0% durante 2024.<br><br>En la GCR Occidental hay 3,010 localidades que no están electrificadas que están distribuidas en los estados de Aguascalientes, Colima, Guanajuato, Hidalgo, Jalisco, Michoacán, Nayarit, Querétaro, San Luis Potosí y Zacatecas."
                    },
                    "Oriental": {
                        title: "GCR Oriental",
                        description: "La GCR Oriental ocupa el 18.5% del territorio nacional aproximadamente, concentrando en 2024 el 25.7% de la población (34.1 millones de personas) y atendió al 25.3% de las personas usuarias finales con un consumo per cápita de 1,680 kWh/habitante. Los principales Centros de Carga se encuentran en las industrias siderúrgica, petroquímica y del plástico, cementera y automotriz, además de la minería. Estas empresas están localizadas principalmente en los estados de Veracruz, Puebla, Tlaxcala y Guerrero.<br><br>Para el análisis de la demanda máxima, la GCR Oriental se divide en cuatro regiones. Durante 2024, la región Oriente representó el 35.8%, la Sureste el 29.9%, la Centro Oriente el 21.6% y la Centrosur el 12.7%. Al interior de éstas, en la región Oriente, la zona Coatzacoalcos presentó la mayor concentración de demanda con 28.8% y un crecimiento anual de 6.3%, solo después de la zona Tuxtlas con 6.4 %. En las regiones Sureste, Centro Oriente y Centro Sur, las zonas más representativas en cuanto a demanda son: Villahermosa (25.4%), Puebla (42.6%) y Acapulco (29.1%). En cuanto al crecimiento anual registrado durante 2024, destacan las zonas Oaxaca con 8.2% de la región Sureste, la zona San Martín con 5.7 % en la región Centro Oriente y la zona Chilpancingo con 12%, ésta última pertenece a la región Centro Sur.<br><br>En la GCR Oriental hay 4,160 localidades que no están electrificadas que están distribuidas en los estados de Chiapas, Guerrero, Morelos, Oaxaca, Puebla, Tabasco, Tlaxcala y Veracruz."
                    },
                    "Peninsular": {
                        title: "GCR Peninsular",
                        description: "La GCR Peninsular ocupa el 7.2% del territorio nacional aproximadamente. Se estima que, en 2024, la población de esta GCR ascendió a 5.5 millones de personas, es decir, el 4.2% del total de los habitantes. Esta GCR atendió al 4.6% de las personas usuarias finales mientras que, su consumo de energía eléctrica per cápita resultó de 3,038 kWh por habitante. Los principales Centros de Carga provienen de la industria del turismo además de una cementera, una procesadora de aceites y semillas, así como una embotelladora de cervezas.<br><br>La zona Mérida representa el 30.3% de la demanda máxima en la GCR Peninsular, seguida por Cancún en menor porcentaje con un 25.1% y Riviera Maya con 15.8%. Las zonas que registraron la tasa de crecimiento anual más alta durante 2024 fueron Ticul con 24.6%, Campeche con 9.6% y Motul con 8.6%.<br><br>En la GCR Peninsular hay 1,001 localidades que no están electrificadas que están distribuidas en los estados Campeche, Quintana Roo y Yucatán."
                    }
                };

                function resetAllRegionsToInitialState() {
                    focusedRegion = null;
                    geoJsonLayer.eachLayer(l => {
                        geoJsonLayer.resetStyle(l);
                    });
                    municipalitiesLayerGroup.clearLayers();

                    // Remove municipalities legend and restore gerencias legend
                    removeMunicipalitiesLegend();
                    if (legendControl) {
                        map.removeControl(legendControl);
                    }
                    addLegend(regionColors);

                    if (selectedRegionBanner) {
                        selectedRegionBanner.style.display = 'none';
                    }

                    // Hide description
                    if (mapDescriptionEl) {
                        mapDescriptionEl.style.display = 'none';
                    }
                }

                onEachFeatureFunction = function (feature, layer) {
                    layer.on({
                        mouseover: function (e) {
                            if (focusedRegion === null) {
                                e.target.setStyle({ weight: 5, color: '#000' });
                                e.target.bringToFront();
                            }
                        },
                        mouseout: function (e) {
                            if (focusedRegion === null) {
                                geoJsonLayer.resetStyle(e.target);
                            }
                        },
                        click: function (e) {
                            L.DomEvent.stopPropagation(e);
                            const clickedRegionName = feature.properties.name;

                            // Si se hace clic en la misma región seleccionada, restablecer todo
                            if (focusedRegion === clickedRegionName) {
                                resetAllRegionsToInitialState();
                                return;
                            }

                            focusedRegion = clickedRegionName;

                            if (legendControl) {
                                map.removeControl(legendControl);
                            }

                            if (selectedRegionBanner && selectedRegionText) {
                                selectedRegionText.textContent = 'Gerencia de Control Regional: ' + clickedRegionName;
                                selectedRegionBanner.style.display = 'block';
                            }

                            // Update description
                            if (mapDescriptionEl) {
                                const titleEl = document.getElementById('map-description-title');
                                const contentEl = document.getElementById('map-description-content');
                                const gcrInfo = gcrDescriptions[clickedRegionName];

                                if (gcrInfo && titleEl && contentEl) {
                                    titleEl.innerHTML = gcrInfo.title;
                                    contentEl.innerHTML = gcrInfo.description;
                                    mapDescriptionEl.style.display = 'block';
                                } else {
                                    mapDescriptionEl.style.display = 'none';
                                }
                            }

                            // Restyle all regions
                            geoJsonLayer.eachLayer(l => {
                                const regionColor = regionColors[l.feature.properties.name] || '#808080';
                                if (l.feature.properties.name === clickedRegionName) {
                                    l.setStyle({
                                        fillColor: regionColor,
                                        weight: 2,
                                        color: '#999',
                                        fillOpacity: 0,
                                        dashArray: '5, 5',
                                        className: 'gerencia-focused'
                                    });
                                    l.bringToFront();
                                } else {
                                    l.setStyle({
                                        fillColor: regionColor,
                                        weight: 1,
                                        color: '#ddd',
                                        fillOpacity: 0.1,
                                        dashArray: '3',
                                        className: ''
                                    });
                                }
                            });

                            // Filter and display municipalities
                            municipalitiesLayerGroup.clearLayers();
                            if (!municipalitiesData || !electrificationData) {
                                console.warn('Municipality or electrification data not loaded yet.');
                                return;
                            }

                            const electrificationDataMap = new Map(electrificationData.map(row => [row.CVEGEO, row]));

                            const filteredFeatures = municipalitiesData.features.filter(f => {
                                const municipalityData = electrificationDataMap.get(f.properties.CVEGEO);
                                return municipalityData && municipalityData.GCR === clickedRegionName;
                            });

                            // Log de diagnóstico
                            const municipiosEnSheet = electrificationData.filter(row => row.GCR === clickedRegionName);
                            console.log('=== DIAGNÓSTICO GERENCIA: ' + clickedRegionName + ' ===');
                            console.log('Municipios en Google Sheets para esta GCR:', municipiosEnSheet.length);
                            console.log('Municipios encontrados en GeoJSON:', filteredFeatures.length);
                            console.log('CVEGEOs en Google Sheets:', municipiosEnSheet.map(m => m.CVEGEO));
                            console.log('CVEGEOs encontrados en GeoJSON:', filteredFeatures.map(f => f.properties.CVEGEO));
                            console.log('===========================================');

                            function getColor(pendientes) {
                                const p = parseInt(pendientes, 10);
                                if (isNaN(p)) return '#ccc';
                                if (p === 0) return '#F2D7D9';
                                if (p <= 20) return '#E0B0B6';
                                if (p <= 40) return '#CC8893';
                                if (p <= 60) return '#B86070';
                                if (p <= 80) return '#A3384D';
                                return '#601623';
                            }

                            const municipalitiesLayer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }, {
                                style: function (feature) {
                                    const municipalityData = electrificationDataMap.get(feature.properties.CVEGEO);

                                    if (!municipalityData || municipalityData.PENDIENTE === undefined || municipalityData.PENDIENTE === null) {
                                        return {
                                            fillOpacity: 0,
                                            opacity: 0,
                                            interactive: false
                                        };
                                    }

                                    const pendientes = municipalityData.PENDIENTE;
                                    return {
                                        fillColor: getColor(pendientes),
                                        weight: 1,
                                        opacity: 1,
                                        color: 'white',
                                        fillOpacity: 0.8
                                    };
                                },
                                onEachFeature: function (feature, layer) {
                                    const municipalityData = electrificationDataMap.get(feature.properties.CVEGEO);
                                    const pendientes = municipalityData ? municipalityData.PENDIENTE : 'N/A';
                                    const gcr = municipalityData ? municipalityData.GCR : 'N/A';
                                    const cvegeo = feature.properties.CVEGEO || 'N/A';
                                    const nomgeo = feature.properties.NOMGEO || 'Sin nombre';

                                    const popupContent = `
                                        <div style="font-family: 'Montserrat', sans-serif;">
                                            <strong style="font-size: 14px; color: #601623;">${nomgeo}</strong><br>
                                            <strong>CVEGEO:</strong> ${cvegeo}<br>
                                            <strong>GCR:</strong> ${gcr}<br>
                                            <strong>Localidades pendientes:</strong> ${pendientes}
                                        </div>
                                    `;

                                    // Usar tooltip en lugar de popup
                                    layer.bindTooltip(popupContent, {
                                        permanent: false,
                                        direction: 'top',
                                        className: 'municipality-tooltip'
                                    });

                                    layer.on('mouseover', function (e) {
                                        console.log('Municipio hover:', {
                                            CVEGEO: cvegeo,
                                            NOMGEO: nomgeo,
                                            GCR: gcr,
                                            PENDIENTE: pendientes
                                        });
                                    });
                                }
                            });

                            municipalitiesLayerGroup.addLayer(municipalitiesLayer);
                            if (typeof municipalitiesLayer.bringToFront === 'function') {
                                municipalitiesLayer.bringToFront();
                            }
                            addMunicipalitiesLegend();

                            if (filteredFeatures.length > 0) {
                                const municipalitiesBounds = municipalitiesLayer.getBounds();
                                map.fitBounds(municipalitiesBounds.pad(0.1));
                            }
                        }
                    });
                }

                // Evento para hacer clic fuera de las gerencias y restablecer todo
                map.on('click', function (e) {
                    if (focusedRegion !== null) {
                        resetAllRegionsToInitialState();
                    }
                });

                addLegend(regionColors);
            } else if (type === 'pib-forecast') {
                const regionColors = {
                    "Baja California": "#939594",
                    "Central": "#6A1C32",
                    "Noreste": "#235B4E",
                    "Noroeste": "#DDC9A4",
                    "Norte": "#10302B",
                    "Occidental": "#BC955C",
                    "Oriental": "#9F2240",
                    "Peninsular": "#A16F4A"
                };

                styleFunction = function (feature) {
                    const color = regionColors[feature.properties.name] || '#808080';
                    return {
                        fillColor: color,
                        fill: true,
                        weight: 2,
                        opacity: 1,
                        color: '#555',
                        dashArray: '3',
                        fillOpacity: 0.7,
                        pane: 'gerenciasPane'
                    };
                }

                onEachFeatureFunction = function (feature, layer) {
                    layer.on({
                        mouseover: function (e) {
                            const targetLayer = e.target;
                            const originalColor = regionColors[feature.properties.name] || '#808080';
                            const darkerColor = darkenColor(originalColor, 20);

                            targetLayer.setStyle({
                                weight: 5,
                                color: darkerColor,
                                dashArray: '',
                                fillOpacity: 0.9
                            });
                            targetLayer.bringToFront();
                        },
                        mouseout: function (e) {
                            geoJsonLayer.resetStyle(e.target);
                        }
                    });
                }
                // Add gerencias legend and PIB legend
                addLegend(regionColors);
                addPIBLegend(pibSenData, pibSinData);
            } else if (type === 'consumption-forecast') {
                const regionColors = {
                    "Baja California": "#939594",
                    "Central": "#6A1C32",
                    "Noreste": "#235B4E",
                    "Noroeste": "#DDC9A4",
                    "Norte": "#10302B",
                    "Occidental": "#BC955C",
                    "Oriental": "#9F2240",
                    "Peninsular": "#A16F4A"
                };

                styleFunction = function (feature) {
                    const color = regionColors[feature.properties.name] || '#808080';
                    return {
                        fillColor: color,
                        fill: true,
                        weight: 2,
                        opacity: 1,
                        color: '#555',
                        dashArray: '3',
                        fillOpacity: 0.7,
                        pane: 'gerenciasPane'
                    };
                }

                onEachFeatureFunction = function (feature, layer) {
                    layer.on({
                        mouseover: function (e) {
                            const targetLayer = e.target;
                            const originalColor = regionColors[feature.properties.name] || '#808080';
                            const darkerColor = darkenColor(originalColor, 20);

                            targetLayer.setStyle({
                                weight: 5,
                                color: darkerColor,
                                dashArray: '',
                                fillOpacity: 0.9
                            });
                            targetLayer.bringToFront();
                        },
                        mouseout: function (e) {
                            geoJsonLayer.resetStyle(e.target);
                        }
                    });
                }
                // Add gerencias legend and consumption legend
                addLegend(regionColors);
                addConsumptionLegend(pibSenData, pibSinData);
            } else if (type === 'capacity-additions') {
                const regionColors = {
                    "Baja California": "#939594",
                    "Central": "#6A1C32",
                    "Noreste": "#235B4E",
                    "Noroeste": "#DDC9A4",
                    "Norte": "#10302B",
                    "Occidental": "#BC955C",
                    "Oriental": "#9F2240",
                    "Peninsular": "#A16F4A"
                };

                styleFunction = function(feature) {
                    const color = regionColors[feature.properties.name] || '#808080';
                    return {
                        fillColor: color,
                        fill: true,
                        weight: 2,
                        opacity: 1,
                        color: '#555',
                        dashArray: '3',
                        fillOpacity: 0.7,
                        pane: 'gerenciasPane'
                    };
                }

                onEachFeatureFunction = function (feature, layer) {
                    layer.on({
                        mouseover: function (e) {
                            const targetLayer = e.target;
                            const originalColor = regionColors[feature.properties.name] || '#808080';
                            const darkerColor = darkenColor(originalColor, 20);

                            targetLayer.setStyle({
                                weight: 5,
                                color: darkerColor,
                                dashArray: '',
                                fillOpacity: 0.9
                            });
                            targetLayer.bringToFront();
                        },
                        mouseout: function (e) {
                            geoJsonLayer.resetStyle(e.target);
                        }
                    });
                }
                // Add gerencias legend and capacity legend
                addLegend(regionColors);
                addCapacityLegend(capacityTotals);
            } else { // regions
                const regionColors = {
                    "Baja California": "#939594",
                    "Central": "#6A1C32",
                    "Noreste": "#235B4E",
                    "Noroeste": "#DDC9A4",
                    "Norte": "#10302B",
                    "Occidental": "#BC955C",
                    "Oriental": "#9F2240",
                    "Peninsular": "#A16F4A"
                };

                styleFunction = function (feature) {
                    const color = regionColors[feature.properties.name] || '#808080'; // Default color
                    return {
                        fillColor: color,
                        fill: true,
                        weight: 0, // No default border
                        opacity: 1,
                        color: 'transparent', // Transparent border by default
                        dashArray: '3',
                        fillOpacity: 0.7, // Set fillOpacity to 0.7 as requested
                        pane: 'gerenciasPane'
                    };
                }

                onEachFeatureFunction = function (feature, layer) {
                    layer.on({
                        mouseover: function (e) {
                            const targetLayer = e.target;
                            const originalColor = regionColors[feature.properties.name] || '#808080';
                            const darkerColor = darkenColor(originalColor, 20); // Darken by 20%

                            targetLayer.setStyle({
                                weight: 5,
                                color: darkerColor,
                                dashArray: '',
                                fillOpacity: 0.9
                            });
                            targetLayer.bringToFront();
                        },
                        mouseout: function (e) {
                            geoJsonLayer.resetStyle(e.target);
                        }
                    });
                }
                addLegend(regionColors);
            }

            geoJsonLayer = L.geoJSON(data, { // Assign to global geoJsonLayer
                style: styleFunction,
                onEachFeature: onEachFeatureFunction
            });

            instrumentLayerGroup.clearLayers(); // Clear before adding new layers
            instrumentLayerGroup.addLayer(geoJsonLayer);

            if (insetControllers.length) {
                insetControllers.forEach(controller => {
                    controller.polygonsLayer.clearLayers();

                    const insetStyleFunction = function (feature) {
                        const style = styleFunction(feature);
                        delete style.pane;
                        return style;
                    };

                    const insetLayer = L.geoJSON(data, {
                        style: insetStyleFunction
                    });
                    controller.polygonsLayer.addLayer(insetLayer);
                    if (typeof controller.polygonsLayer.bringToBack === 'function') {
                        controller.polygonsLayer.bringToBack();
                    }
                });
            }

        } catch (error) {
            console.error('Error cargando GeoJSON:', error);
            // Optionally, show a notification to the user
        } finally {
            if (showPreloader) {
                togglePreloader(false);
            }
        }
    }

    async function loadConnectionsGeoJSON(url, options) {
        const showPreloader = options && options.showPreloader;
        const clear = options && options.clear !== undefined ? options.clear : true;

        if (showPreloader) {
            togglePreloader(true);
        }
        try {
            if (clear) {
                connectionsLayerGroup.clearLayers();
            }
            const response = await fetch(url);
            const data = await response.json();
            const baseStyle = {
                color: '#7a1c32',
                weight: 3,
                opacity: 0.92
            };
            const connectionsLayer = L.geoJSON(data, {
                style: function (feature) {
                    const props = feature && feature.properties ? feature.properties : {};
                    const color = props.color || baseStyle.color;
                    const weight = Number(props.weight) || baseStyle.weight;
                    const opacity = typeof props.opacity === 'number' ? props.opacity : baseStyle.opacity;
                    return {
                        color: color,
                        weight: weight,
                        opacity: opacity,
                        pane: 'connectionsPane',
                        className: 'connections-line'
                    };
                }
            });
            connectionsLayerGroup.addLayer(connectionsLayer);
            if (typeof connectionsLayerGroup.bringToFront === 'function') {
                connectionsLayerGroup.bringToFront();
            }

            if (insetControllers.length) {
                insetControllers.forEach(controller => {
                    controller.linesLayer.clearLayers();
                    const insetLinesLayer = L.geoJSON(data, {
                        style: function (feature) {
                            const props = feature && feature.properties ? feature.properties : {};
                            const color = props.color || baseStyle.color;
                            const weight = Number(props.weight) || baseStyle.weight;
                            const opacity = typeof props.opacity === 'number' ? props.opacity : baseStyle.opacity;
                            return {
                                color: color,
                                weight: weight,
                                opacity: opacity,
                                interactive: false,
                                className: 'connections-line'
                            };
                        }
                    });
                    controller.linesLayer.addLayer(insetLinesLayer);
                    if (typeof controller.linesLayer.bringToFront === 'function') {
                        controller.linesLayer.bringToFront();
                    }
                    if (typeof controller.markersLayer.bringToFront === 'function') {
                        controller.markersLayer.bringToFront();
                    }
                });
            }
        } catch (error) {
            console.error('Error cargando GeoJSON de líneas:', error);
        } finally {
            if (showPreloader) {
                togglePreloader(false);
            }
        }
    }

    function createGradientPattern(color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const size = 200;
        canvas.width = size;
        canvas.height = size;

        const lighterColor = lightenColor(color, 40);
        const gradient = context.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, lighterColor);

        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);

        return canvas;
    }

    function lightenColor(hex, percent) {
        hex = hex.replace(/[^0-9a-f]/gi, '');
        if (hex.length < 6) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        percent = percent || 0;

        var rgb = "#", c, i;
        for (i = 0; i < 3; i++) {
            c = parseInt(hex.substr(i * 2, 2), 16);
            c = Math.round(Math.min(Math.max(0, c + (c * percent / 100)), 255)).toString(16);
            rgb += ("00" + c).substr(c.length);
        }

        return rgb;
    }

    function darkenColor(hex, percent) {
        let f = parseInt(hex.slice(1), 16),
            R = f >> 16,
            G = (f >> 8) & 0x00ff,
            B = f & 0x0000ff;
        return "#" + (
            0x1000000 +
            (Math.round((R * (100 - percent)) / 100) * 0x10000) +
            (Math.round((G * (100 - percent)) / 100) * 0x100) +
            (Math.round((B * (100 - percent)) / 100))
        ).toString(16).slice(1);
    }

    async function loadMarinasGeoJSON(url) {
        try {
            const response = await fetch(url);
            const data = await response.json();

            const marinaStyle = {
                fillColor: '#bcd7f6',
                weight: 1,
                opacity: 0.5,
                color: '#8cb4e2',
                fillOpacity: 0.3,
                pane: 'marinasPane'
            };

            const geoJsonLayer = L.geoJSON(data, {
                style: marinaStyle,
                onEachFeature: function (feature, layer) {
                    if (feature.properties && feature.properties.name) {
                        layer.bindTooltip(feature.properties.name, {
                            permanent: false,
                            direction: 'center',
                            className: 'marina-label'
                        });
                    }
                }
            });
            marinasLayer.addLayer(geoJsonLayer);
        } catch (error) {
            console.error('Error cargando GeoJSON de marinas:', error);
        }
    }


    function updateTimestamp() {
        if (!lastUpdatedEl) {
            return;
        }
        const now = new Date();
        lastUpdatedEl.textContent = now.toLocaleString('es-MX', {
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function drawRows(rows, mapConfig) {
        markersLayer.clearLayers();
        clearInsetMarkers();
        const bounds = [];
        rows.forEach(function (row) {
            const latRaw = row.lat || row.Lat || row.latitude || row.Latitude || row.latitud || '';
            const lngRaw = row.lng || row.Lng || row.lon || row.Lon || row.longitude || row.Longitud || '';
            const lat = parseFloat(latRaw.toString().replace(',', '.'));
            const lng = parseFloat(lngRaw.toString().replace(',', '.'));
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
            }

            let popup = '';
            if (mapConfig && mapConfig.name === 'Red nacional de gasoductos en 2024') {
                popup = [
                    '<div><strong>Permiso:</strong> ' + (row.NumeroPermiso || 'N/A') + '</div>',
                    '<div><strong>Razón Social:</strong> ' + (row.RazonSocial || 'N/A') + '</div>',
                    '<div><strong>Capacidad (MW):</strong> ' + (row.CapacidadAutorizadaMW || 'N/A') + '</div>',
                    '<div><strong>Generación Anual:</strong> ' + (row.Generación_estimada_anual || 'N/A') + '</div>',
                    '<div><strong>Inversión (mdls):</strong> ' + (row.Inversion_estimada_mdls || 'N/A') + '</div>',
                    '<div><strong>Energético:</strong> ' + (row.Energetico_primario || 'N/A') + '</div>',
                    '<div><strong>Actividad:</strong> ' + (row.Actividad_economica || 'N/A') + '</div>',
                    '<div><strong>Tecnología:</strong> ' + (row.Tecnología || 'N/A') + '</div>',
                    '<div><strong>País de Origen:</strong> ' + (row.PaísDeOrigen || 'N/A') + '</div>',
                    '<div><strong>Tipo de Empresa:</strong> ' + (row.Tipo_Empresa || 'N/A') + '</div>'
                ].join('');
            } else {
                const idValue = row.id || row.ID || row.Id || row.identificador || row.Identificador || '';
                const name = row.name || row.Name || row.nombre || row.Nombre || row.titulo || row.Titulo || 'Registro';
                const description = row.descripcion || row.Descripcion || row.description || row.Description || '';
                const badgeLabel = idValue ? 'ID ' + idValue : 'Hoja';
                popup = [
                    '<div><span class="badge">' + badgeLabel + '</span></div>',
                    '<strong>' + name + '</strong>',
                    description ? '<div class="description">' + description + '</div>' : '',
                    '<small>(' + lat.toFixed(5) + ', ' + lng.toFixed(5) + ')</small>'
                ].filter(Boolean).join('');
            }

            let markerOptions = getNodeMarkerOptions(true);
            if (mapConfig && mapConfig.name === 'Red nacional de gasoductos en 2024') {
                markerOptions.radius = 6;
            }

            const marker = L.circleMarker([lat, lng], markerOptions);
            marker.bindPopup(popup);
            if (row.id || row.ID || row.Id) {
                marker.bindTooltip(String(row.id || row.ID || row.Id), {
                    permanent: true,
                    direction: 'top',
                    className: 'node-label',
                    offset: [0, -6]
                });
            }
            marker.addTo(markersLayer);
            if (insetControllers.length) {
                insetControllers.forEach(controller => {
                    const insetMarkerOptions = getNodeMarkerOptions(false);
                    const insetMarker = L.circleMarker([lat, lng], insetMarkerOptions);
                    insetMarker.bindPopup(popup);
                    if (row.id || row.ID || row.Id) {
                        insetMarker.bindTooltip(String(row.id || row.ID || row.Id), {
                            permanent: true,
                            direction: 'top',
                            className: 'node-label',
                            offset: [0, -6]
                        });
                    }
                    controller.markersLayer.addLayer(insetMarker);
                    if (typeof controller.markersLayer.bringToFront === 'function') {
                        controller.markersLayer.bringToFront();
                    }
                });
            }
            bounds.push([lat, lng]);
        });
        // Don't auto-fit bounds, keep the default center and zoom
        // if (bounds.length) {
        //     const calculatedBounds = L.latLngBounds(bounds);
        //     map.fitBounds(bounds.length === 1 ? calculatedBounds.pad(0.25) : calculatedBounds.pad(0.2));
        // }
    }

    // Electricity filters and statistics functions
    
    // Function to load and display GCR layer with highlighting
    function showGCRLayer(highlightGCR = null) {
        console.log('showGCRLayer called with:', highlightGCR);
        
        // FORCE remove States layer completely
        if (statesLayerGroup) {
            console.log('FORCE Removing States layer');
            try {
                map.removeLayer(statesLayerGroup);
            } catch(e) {
                console.warn('Error removing states layer:', e);
            }
            statesLayerGroup = null;
        }
        
        // FORCE remove existing GCR layer completely
        if (gcrLayerGroup) {
            console.log('FORCE Removing existing GCR layer');
            try {
                map.removeLayer(gcrLayerGroup);
            } catch(e) {
                console.warn('Error removing GCR layer:', e);
            }
            gcrLayerGroup = null;
        }
        
        // Double check - remove all layers from gerenciasPane
        map.eachLayer(function(layer) {
            if (layer.options && layer.options.pane === 'gerenciasPane') {
                console.log('Found stray layer in gerenciasPane, removing');
                map.removeLayer(layer);
            }
        });
        
        if (!gcrGeometries) {
            console.warn('GCR geometries not loaded');
            return;
        }
        
        console.log('Creating NEW GCR layer with highlighting:', highlightGCR);
        
        gcrLayerGroup = L.geoJSON(gcrGeometries, {
            style: function(feature) {
                const isHighlighted = highlightGCR && feature.properties.name === highlightGCR;
                
                return {
                    fillColor: isHighlighted ? '#1f7a62' : '#ffffff',
                    fillOpacity: isHighlighted ? 0.4 : 0.2,
                    color: isHighlighted ? '#1f7a62' : '#5e6b7e',
                    weight: isHighlighted ? 3 : 2,
                    opacity: isHighlighted ? 1 : 0.7
                };
            },
            onEachFeature: function(feature, layer) {
                const gcrName = feature.properties.name;
                
                // Tooltip
                layer.bindTooltip(gcrName, {
                    permanent: false,
                    direction: 'center',
                    className: 'gcr-tooltip'
                });
                
                // Click to filter
                layer.on('click', function(e) {
                    L.DomEvent.stopPropagation(e);
                    filterElectricityPermits('gcr', gcrName);
                    
                    document.querySelectorAll('#gcr-cards .filter-card').forEach(card => {
                        if (card.dataset.filterValue === gcrName) {
                            card.classList.add('active');
                            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        } else {
                            card.classList.remove('active');
                        }
                    });
                });
            },
            pane: 'gerenciasPane'
        }).addTo(map);
        
        console.log('GCR layer added to map - bringing to back');
        
        if (gcrLayerGroup) {
            gcrLayerGroup.bringToBack();
        }
    }
    
    // Function to load and display States layer with highlighting
    function showStatesLayer(highlightState = null) {
        console.log('showStatesLayer called with:', highlightState);
        
        // FORCE remove GCR layer completely
        if (gcrLayerGroup) {
            console.log('FORCE Removing GCR layer');
            try {
                map.removeLayer(gcrLayerGroup);
            } catch(e) {
                console.warn('Error removing GCR layer:', e);
            }
            gcrLayerGroup = null;
        }
        
        // FORCE remove existing States layer completely
        if (statesLayerGroup) {
            console.log('FORCE Removing existing States layer');
            try {
                map.removeLayer(statesLayerGroup);
            } catch(e) {
                console.warn('Error removing states layer:', e);
            }
            statesLayerGroup = null;
        }
        
        // Double check - remove all layers from gerenciasPane
        map.eachLayer(function(layer) {
            if (layer.options && layer.options.pane === 'gerenciasPane') {
                console.log('Found stray layer in gerenciasPane, removing');
                map.removeLayer(layer);
            }
        });
        
        // Load states GeoJSON if not loaded
        if (!statesGeometries) {
            console.log('Loading states GeoJSON...');
            fetch('https://cdn.sassoapps.com/Mapas/Electricidad/estados.geojson')
                .then(response => {
                    console.log('States GeoJSON response:', response.status);
                    return response.json();
                })
                .then(data => {
                    console.log('States geometries loaded:', data.features.length, 'states');
                    statesGeometries = data;
                    displayStatesLayer(highlightState);
                })
                .catch(error => {
                    console.error('Error loading States geometries:', error);
                });
        } else {
            console.log('States geometries already loaded, displaying...');
            displayStatesLayer(highlightState);
        }
    }
    
    function displayStatesLayer(highlightState) {
        console.log('displayStatesLayer called with:', highlightState);
        
        if (!statesGeometries) {
            console.error('States geometries not loaded!');
            return;
        }
        
        console.log('Creating NEW states layer with', statesGeometries.features?.length, 'features');
        
        // Helper function to normalize state names for comparison
        function normalizeStateName(name) {
            if (!name) return '';
            // Remove leading numbers and spaces (e.g., "09 CDMX" -> "CDMX")
            return name.replace(/^\d+\s*/, '').trim().toUpperCase();
        }
        
        // Helper function to get the main state name (without "de Zaragoza", etc.)
        function getMainStateName(name) {
            const normalized = normalizeStateName(name);
            // Remove common suffixes
            return normalized
                .replace(/\s+DE\s+ZARAGOZA$/i, '')
                .replace(/\s+DE\s+JUAREZ$/i, '')
                .replace(/\s+DE\s+IGNACIO\s+DE\s+LA\s+LLAVE$/i, '')
                .trim();
        }
        
        const normalizedHighlight = normalizeStateName(highlightState);
        const mainHighlight = getMainStateName(highlightState);
        
        statesLayerGroup = L.geoJSON(statesGeometries, {
            style: function(feature) {
                const stateName = feature.properties.name || feature.properties.NOMGEO || feature.properties.NOM_ENT || feature.properties.estado;
                const normalizedStateName = normalizeStateName(stateName);
                const mainStateName = getMainStateName(stateName);
                
                // Check if highlighted using flexible matching
                let isHighlighted = false;
                if (highlightState) {
                    // Try exact match first
                    if (normalizedStateName === normalizedHighlight) {
                        isHighlighted = true;
                    }
                    // Try main name match (Coahuila matches Coahuila de Zaragoza)
                    else if (mainStateName === mainHighlight) {
                        isHighlighted = true;
                    }
                    // Try partial match in both directions
                    else if (normalizedStateName.includes(mainHighlight) || 
                             mainHighlight.includes(normalizedStateName)) {
                        isHighlighted = true;
                    }
                }
                
                console.log('State:', stateName, '| Normalized:', normalizedStateName, '| Main:', mainStateName, '| Highlight?', isHighlighted);
                
                return {
                    fillColor: isHighlighted ? '#601623' : '#ffffff',
                    fillOpacity: isHighlighted ? 0.4 : 0.25,
                    color: isHighlighted ? '#601623' : '#5e6b7e',
                    weight: isHighlighted ? 3 : 2,
                    opacity: isHighlighted ? 1 : 0.8
                };
            },
            onEachFeature: function(feature, layer) {
                const stateName = feature.properties.name || feature.properties.NOMGEO || feature.properties.NOM_ENT || feature.properties.estado;
                
                if (stateName) {
                    layer.bindTooltip(stateName, {
                        permanent: false,
                        direction: 'center',
                        className: 'state-tooltip'
                    });
                    
                    layer.on('click', function(e) {
                        L.DomEvent.stopPropagation(e);
                        
                        console.log('State clicked:', stateName);
                        
                        // Helper function to normalize state names
                        function normalizeStateName(name) {
                            if (!name) return '';
                            return name.replace(/^\d+\s*/, '').trim().toUpperCase();
                        }
                        
                        // Helper function to get the main state name (without "de Zaragoza", etc.)
                        function getMainStateName(name) {
                            const normalized = normalizeStateName(name);
                            // Remove common suffixes
                            return normalized
                                .replace(/\s+DE\s+ZARAGOZA$/i, '')
                                .replace(/\s+DE\s+JUAREZ$/i, '')
                                .replace(/\s+DE\s+IGNACIO\s+DE\s+LA\s+LLAVE$/i, '')
                                .trim();
                        }
                        
                        const normalizedClickedState = normalizeStateName(stateName);
                        const mainClickedState = getMainStateName(stateName);
                        
                        console.log('Normalized:', normalizedClickedState, '| Main:', mainClickedState);
                        
                        // Find matching state in data
                        const matchingState = Object.keys(electricityStats.byState).find(state => {
                            const normalizedDataState = normalizeStateName(state);
                            const mainDataState = getMainStateName(state);
                            
                            // Try exact match first
                            if (normalizedDataState === normalizedClickedState) return true;
                            
                            // Try main name match (Coahuila matches Coahuila de Zaragoza)
                            if (mainDataState === mainClickedState) return true;
                            
                            // Try partial match in both directions
                            if (normalizedDataState.includes(mainClickedState) || 
                                mainClickedState.includes(normalizedDataState)) return true;
                            
                            return false;
                        });
                        
                        console.log('Matching state in data:', matchingState);
                        
                        if (matchingState) {
                            filterElectricityPermits('state', matchingState);
                            
                            document.querySelectorAll('#state-cards .filter-card').forEach(card => {
                                if (card.dataset.filterValue === matchingState) {
                                    card.classList.add('active');
                                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                } else {
                                    card.classList.remove('active');
                                }
                            });
                        }
                    });
                }
            },
            pane: 'gerenciasPane'
        }).addTo(map);
        
        console.log('States layer added to map - bringing to back');
        
        if (statesLayerGroup) {
            statesLayerGroup.bringToBack();
        }
    }
    
    // Function to hide both layers
    function hideGeometryLayers() {
        console.log('hideGeometryLayers called - FORCE removing all');
        
        // FORCE remove GCR
        if (gcrLayerGroup) {
            console.log('FORCE Removing GCR layer');
            try {
                map.removeLayer(gcrLayerGroup);
            } catch(e) {
                console.warn('Error removing GCR layer:', e);
            }
            gcrLayerGroup = null;
        }
        
        // FORCE remove States
        if (statesLayerGroup) {
            console.log('FORCE Removing States layer');
            try {
                map.removeLayer(statesLayerGroup);
            } catch(e) {
                console.warn('Error removing states layer:', e);
            }
            statesLayerGroup = null;
        }
        
        // Clean up any stray layers in gerenciasPane
        let removed = 0;
        map.eachLayer(function(layer) {
            if (layer.options && layer.options.pane === 'gerenciasPane') {
                console.log('Found stray layer in gerenciasPane, removing');
                map.removeLayer(layer);
                removed++;
            }
        });
        
        console.log('All geometry layers hidden. Removed', removed, 'stray layers');
    }
    
    // Function to assign permits to GCRs using Turf.js spatial analysis
    function assignPermitsToGCR(data, gcrGeoJSON) {
        const assignments = {};
        
        if (!gcrGeoJSON || !gcrGeoJSON.features) {
            console.warn('GCR GeoJSON not loaded');
            return assignments;
        }
        
        data.forEach(row => {
            const latRaw = row.lat || row.Lat || row.latitude || row.Latitude || row.latitud || '';
            const lngRaw = row.lng || row.Lng || row.lon || row.Lon || row.longitude || row.Longitud || '';
            const lat = parseFloat(latRaw.toString().replace(',', '.'));
            const lng = parseFloat(lngRaw.toString().replace(',', '.'));
            
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
            }
            
            // Create point using Turf
            const point = turf.point([lng, lat]);
            
            // Check which GCR polygon contains this point
            for (const feature of gcrGeoJSON.features) {
                const gcrName = feature.properties.name;
                
                try {
                    if (turf.booleanPointInPolygon(point, feature)) {
                        if (!assignments[gcrName]) {
                            assignments[gcrName] = [];
                        }
                        assignments[gcrName].push(row);
                        break; // Stop after finding the first match
                    }
                } catch (e) {
                    console.warn('Error checking point in polygon:', e);
                }
            }
        });
        
        return assignments;
    }
    
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
            
            card.addEventListener('click', function() {
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
            header.addEventListener('click', function() {
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
                    techCard.addEventListener('click', function(e) {
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
        
        // Redraw all markers
        if (electricityPermitsData.length) {
            drawElectricityMarkersOnly(electricityPermitsData);
        }
    }
    
    function drawElectricityMarkersOnly(rows) {
        if (!markersClusterGroup) {
            markersClusterGroup = L.markerClusterGroup({
                maxClusterRadius: 50,
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true,
                iconCreateFunction: function(cluster) {
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

    async function loadAndRender(options) {
        const silent = options && options.silent;
        const sourceUrl = (currentSheetUrl || '').trim();
        if (!hasValidSheetUrl(sourceUrl)) {
            clearData();
            return;
        }
        const expectedUrl = sourceUrl;
        if (!silent) {
            togglePreloader(true);
        }
        try {
            const cacheBuster = 'cb=' + Date.now();
            const url = sourceUrl + (sourceUrl.includes('?') ? '&' : '?') + cacheBuster;
            const response = await fetch(url, { cache: 'no-store' });
            const csvText = await response.text();
            const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            if (expectedUrl === (currentSheetUrl || '').trim()) {
                const selectedInstrument = instrumentSelect.value;
                const mapConfig = selectedInstrument && mapConfigurations[selectedInstrument] ? mapConfigurations[selectedInstrument].find(m => m.name === currentMapTitle) : null;
                
                // Use cluster function for electricity permits
                if (mapConfig && mapConfig.useClusters) {
                    drawElectricityPermits(parsed.data);
                } else {
                    drawRows(parsed.data, mapConfig);
                }
                
                updateTimestamp();
            }
        } catch (error) {
            console.error('Fallo de carga:', error);
        } finally {
            if (!silent) {
                togglePreloader(false);
            }
        }
    }

    async function loadElectrificationMap(mapConfig) {
        togglePreloader(true);
        try {
            // Fetch both data sources in parallel
            const [municipalitiesResponse, sheetResponse] = await Promise.all([
                fetch(mapConfig.municipalitiesGeojsonUrl),
                fetch(mapConfig.googleSheetUrl)
            ]);

            municipalitiesData = await municipalitiesResponse.json();
            const csvText = await sheetResponse.text();
            electrificationData = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;

            // Load the regional control areas
            if (mapConfig.geojsonUrl) {
                await loadGeoJSON(mapConfig.geojsonUrl, { type: mapConfig.geojsonUrlType });
            }

        } catch (error) {
            console.error('Error loading electrification map:', error);
        } finally {
            togglePreloader(false);
        }
    }

    async function loadPIBForecastMap(mapConfig) {
        togglePreloader(true);
        try {
            // Load GeoJSON and Google Sheets data in parallel
            const [geoJsonResponse, sheetResponse] = await Promise.all([
                fetch(mapConfig.geojsonUrl),
                fetch(mapConfig.googleSheetUrl + (mapConfig.googleSheetUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now())
            ]);

            const geoJsonData = await geoJsonResponse.json();
            const csvText = await sheetResponse.text();
            const pibData = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;

            // Create a map for quick lookup
            const pibDataMap = new Map(pibData.map(row => [row.GCR, row]));

            // Extract SEN and SIN data from columns G, H, I
            pibSenData = null;
            pibSinData = null;

            if (pibData.length > 0) {
                pibSenData = { '2025-2030': 'N/A', '2025-2039': 'N/A' };
                pibSinData = { '2025-2030': 'N/A', '2025-2039': 'N/A' };

                // Look for rows with SISTEMA, TMCA(%), AÑOS columns
                pibData.forEach(row => {
                    const sistema = row['SISTEMA'] || '';
                    const tmca = row['TMCA(%)'] || row['TMACA(%)'] || '';
                    const años = row['AÑOS'] || row['ANOS'] || '';

                    console.log('Row:', sistema, tmca, años);

                    if (sistema.includes('SEN')) {
                        if (años.includes('2025-2030')) {
                            pibSenData['2025-2030'] = tmca;
                            console.log('Found SEN 2025-2030:', tmca);
                        }
                        if (años.includes('2025-2039') || años.includes('2025- 2039')) {
                            pibSenData['2025-2039'] = tmca;
                            console.log('Found SEN 2025-2039:', tmca);
                        }
                    }

                    if (sistema.includes('SIN')) {
                        if (años.includes('2025-2030')) {
                            pibSinData['2025-2030'] = tmca;
                            console.log('Found SIN 2025-2030:', tmca);
                        }
                        if (años.includes('2025-2039') || años.includes('2025- 2039')) {
                            pibSinData['2025-2039'] = tmca;
                            console.log('Found SIN 2025-2039:', tmca);
                        }
                    }
                });
            }

            console.log('Final SEN data:', pibSenData);
            console.log('Final SIN data:', pibSinData);

            // Specific coordinates for Baja California regions
            const bajaCaliforniaCoords = {
                'Baja California': { lat: 32.3, lng: -115.5 },      // Cerca de la frontera (Tijuana/Mexicali)
                'Baja California Sur': { lat: 23.5, lng: -110.0 },  // Cerca de Los Cabos (era Mulegé)
                'Mulegé': { lat: 28.5, lng: -113.0 }                // Centro-norte península (era Baja California Sur)
            };

            // Load GeoJSON first
            await loadGeoJSON(mapConfig.geojsonUrl, { type: mapConfig.geojsonUrlType });

            // Add labels for each region using the loaded layer
            if (geoJsonLayer) {
                geoJsonLayer.eachLayer(layer => {
                    const regionName = layer.feature.properties.name;
                    const pibInfo = pibDataMap.get(regionName);

                    if (pibInfo) {
                        // Get the center of the layer bounds
                        const bounds = layer.getBounds();
                        let center = bounds.getCenter();

                        // Override position for Baja California to move it to the border
                        if (regionName === 'Baja California') {
                            center = L.latLng(bajaCaliforniaCoords['Baja California'].lat, bajaCaliforniaCoords['Baja California'].lng);
                        }

                        // Create two markers for each value
                        const gcrName = regionName;
                        const value2025_2030 = pibInfo['2025-2030'] || 'N/A';
                        const value2025_2039 = pibInfo['2025-2039'] || 'N/A';

                        console.log('Creating labels for:', regionName, gcrName, value2025_2030, value2025_2039);

                        // Create single marker with both values
                        const marker = L.marker([center.lat, center.lng], {
                            icon: L.divIcon({
                                className: 'pib-label',
                                html: `<div class="pib-label-content">
                                    <div class="pib-label-id">${gcrName}</div>
                                    <div class="pib-row pib-row-2030">
                                        <span class="pib-value">${value2025_2030}%</span>
                                    </div>
                                    <div class="pib-row pib-row-2039">
                                        <span class="pib-value">${value2025_2039}%</span>
                                    </div>
                                </div>`,
                                iconSize: [80, 42]
                            })
                        });

                        marker.addTo(markersLayer);
                    }
                });
            }

            // Add special points for Baja California Sur and Mulegé
            ['Baja California Sur', 'Mulegé'].forEach(regionName => {
                const pibInfo = pibDataMap.get(regionName);
                const coords = bajaCaliforniaCoords[regionName];

                if (pibInfo && coords) {
                    const gcrName = regionName;
                    const value2025_2030 = pibInfo['2025-2030'] || 'N/A';
                    const value2025_2039 = pibInfo['2025-2039'] || 'N/A';

                    console.log('Creating special point for:', regionName, gcrName, value2025_2030, value2025_2039);

                    const marker = L.marker([coords.lat, coords.lng], {
                        icon: L.divIcon({
                            className: 'pib-label',
                            html: `<div class="pib-label-content">
                                <div class="pib-label-id">${gcrName}</div>
                                <div class="pib-row pib-row-2030">
                                    <span class="pib-value">${value2025_2030}%</span>
                                </div>
                                <div class="pib-row pib-row-2039">
                                    <span class="pib-value">${value2025_2039}%</span>
                                </div>
                            </div>`,
                            iconSize: [80, 42]
                        })
                    });

                    marker.addTo(markersLayer);
                }
            });

            updateTimestamp();

        } catch (error) {
            console.error('Error loading PIB forecast map:', error);
        } finally {
            togglePreloader(false);
        }
    }

    async function loadConsumptionForecastMap(mapConfig) {
        // Reutilizar la misma función que PIB pero con el nuevo Google Sheets
        await loadPIBForecastMap(mapConfig);
    }

    async function loadCapacityAdditionsMap(mapConfig) {
        togglePreloader(true);
        try {
            // Load GeoJSON and Google Sheets data in parallel
            const [geoJsonResponse, sheetResponse] = await Promise.all([
                fetch(mapConfig.geojsonUrl),
                fetch(mapConfig.googleSheetUrl + (mapConfig.googleSheetUrl.includes('?') ? '&' : '?') + 'cb=' + Date.now())
            ]);

            const geoJsonData = await geoJsonResponse.json();
            const csvText = await sheetResponse.text();
            const capacityData = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;

            // Get dynamic column names (excluding Id, GCR, and UNIDADES)
            const allColumns = capacityData.length > 0 ? Object.keys(capacityData[0]) : [];
            const capacityColumns = allColumns.filter(col => 
                col !== 'Id' && col !== 'GCR' && col !== 'UNIDADES' && col.trim() !== ''
            );

            console.log('Capacity columns found:', capacityColumns);

            // Create a map for quick lookup
            const capacityDataMap = new Map();
            
            // Calculate totals by column and row
            const columnTotals = {};
            capacityColumns.forEach(col => columnTotals[col] = 0);
            let grandTotal = 0;

            capacityData.forEach(row => {
                const gcrName = row.GCR;
                let rowTotal = 0;
                const rowData = { GCR: gcrName };
                
                capacityColumns.forEach(col => {
                    const value = parseFloat(row[col] || 0);
                    rowData[col] = value;
                    rowTotal += value;
                    columnTotals[col] += value;
                });
                
                rowData.TOTAL = rowTotal;
                grandTotal += rowTotal;
                capacityDataMap.set(gcrName, rowData);
            });

            // Store totals globally
            capacityTotals = {
                columns: columnTotals,
                total: grandTotal,
                columnNames: capacityColumns
            };

            console.log('Capacity totals:', capacityTotals);

            // Specific coordinates for Baja California regions
            const bajaCaliforniaCoords = {
                'Baja California': { lat: 32.3, lng: -115.5 },
                'Baja California Sur': { lat: 23.5, lng: -110.0 },  // Cerca de Los Cabos (era Mulegé)
                'Mulegé': { lat: 28.5, lng: -113.0 }                // Centro-norte península (era Baja California Sur)
            };

            // Load GeoJSON first
            await loadGeoJSON(mapConfig.geojsonUrl, { type: mapConfig.geojsonUrlType });

            // Add labels for each region
            if (geoJsonLayer) {
                geoJsonLayer.eachLayer(layer => {
                    const regionName = layer.feature.properties.name;
                    const capacityInfo = capacityDataMap.get(regionName);

                    if (capacityInfo) {
                        const bounds = layer.getBounds();
                        let center = bounds.getCenter();

                        // Override position for Baja California
                        if (regionName === 'Baja California') {
                            center = L.latLng(bajaCaliforniaCoords['Baja California'].lat, bajaCaliforniaCoords['Baja California'].lng);
                        }

                        const gcrName = regionName;
                        const total = capacityInfo.TOTAL || 0;

                        // Only show label if there's capacity > 0
                        if (total > 0) {
                            // Build label HTML dynamically
                            let labelHTML = `<div class="pib-label-content">
                                <div class="pib-label-id">${gcrName}</div>`;
                            
                            // Add each capacity type with institutional colors
                            const colors = ['#939594', '#6A1C32', '#235B4E', '#DDC9A4', '#10302B', '#BC955C', '#9F2240', '#A16F4A'];
                            capacityColumns.forEach((col, index) => {
                                const value = capacityInfo[col] || 0;
                                if (value > 0) {
                                    const color = colors[index % colors.length];
                                    labelHTML += `<div class="pib-row" style="color: ${color};">
                                        <span class="pib-value">${value.toLocaleString('es-MX')} MW</span>
                                    </div>`;
                                }
                            });
                            
                            labelHTML += `<div style="border-top: 1px solid #333; margin-top: 2px; padding-top: 2px;">
                                <span style="font-size: 12px; font-weight: 800; color: #1a1a1a;">${total.toLocaleString('es-MX')} MW</span>
                            </div></div>`;

                            const marker = L.marker([center.lat, center.lng], {
                                icon: L.divIcon({
                                    className: 'pib-label',
                                    html: labelHTML,
                                    iconSize: [90, 60 + (capacityColumns.filter(col => (capacityInfo[col] || 0) > 0).length * 5)]
                                })
                            });

                            marker.addTo(markersLayer);
                        }
                    }
                });
            }

            // Add special points for Baja California Sur and Mulegé if they have capacity
            ['Baja California Sur', 'Mulegé'].forEach(regionName => {
                const capacityInfo = capacityDataMap.get(regionName);
                const coords = bajaCaliforniaCoords[regionName];

                if (capacityInfo && coords) {
                    const gcrName = regionName;
                    const total = capacityInfo.TOTAL || 0;

                    if (total > 0) {
                        // Build label HTML dynamically
                        let labelHTML = `<div class="pib-label-content">
                            <div class="pib-label-id">${gcrName}</div>`;
                        
                        // Add each capacity type with institutional colors
                        const colors = ['#939594', '#6A1C32', '#235B4E', '#DDC9A4', '#10302B', '#BC955C', '#9F2240', '#A16F4A'];
                        capacityColumns.forEach((col, index) => {
                            const value = capacityInfo[col] || 0;
                            if (value > 0) {
                                const color = colors[index % colors.length];
                                labelHTML += `<div class="pib-row" style="color: ${color};">
                                    <span class="pib-value">${value.toLocaleString('es-MX')} MW</span>
                                </div>`;
                            }
                        });
                        
                        labelHTML += `<div style="border-top: 1px solid #333; margin-top: 2px; padding-top: 2px;">
                            <span style="font-size: 12px; font-weight: 800; color: #1a1a1a;">${total.toLocaleString('es-MX')} MW</span>
                        </div></div>`;

                        const marker = L.marker([coords.lat, coords.lng], {
                            icon: L.divIcon({
                                className: 'pib-label',
                                html: labelHTML,
                                iconSize: [90, 60 + (capacityColumns.filter(col => (capacityInfo[col] || 0) > 0).length * 5)]
                            })
                        });

                        marker.addTo(markersLayer);
                    }
                }
            });

            // Add legend with capacity totals
            addCapacityLegend(capacityTotals, mapConfig.name);

            updateTimestamp();

        } catch (error) {
            console.error('Error loading capacity additions map:', error);
        } finally {
            togglePreloader(false);
        }
    }

    // Event listeners
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async function () {
            const selectedInstrument = instrumentSelect.value;
            const selectedMapName = mapSelect.value;

            if (selectedInstrument && selectedMapName && mapConfigurations[selectedInstrument]) {
                const mapConfig = mapConfigurations[selectedInstrument].find(m => m.name === selectedMapName);

                // Si es el mapa de electrificación
                if (mapConfig && mapConfig.name === 'Municipios con localidades sin electrificar') {
                    togglePreloader(true);
                    try {
                        // Recargar solo los datos del Google Sheets
                        const cacheBuster = 'cb=' + Date.now();
                        const url = mapConfig.googleSheetUrl + (mapConfig.googleSheetUrl.includes('?') ? '&' : '?') + cacheBuster;
                        const response = await fetch(url, { cache: 'no-store' });
                        const csvText = await response.text();
                        electrificationData = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;

                        console.log('Datos de electrificación actualizados:', electrificationData.length, 'registros');

                        // Si hay una región enfocada, actualizar los municipios mostrados
                        if (focusedRegion) {
                            // Trigger click event on the focused region to refresh municipalities
                            municipalitiesLayerGroup.clearLayers();

                            const electrificationDataMap = new Map(electrificationData.map(row => [row.CVEGEO, row]));
                            const filteredFeatures = municipalitiesData.features.filter(f => {
                                const municipalityData = electrificationDataMap.get(f.properties.CVEGEO);
                                return municipalityData && municipalityData.GCR === focusedRegion;
                            });

                            // Re-render municipalities with updated data
                            const regionColors = {
                                "Baja California": "#939594",
                                "Central": "#6A1C32",
                                "Noreste": "#235B4E",
                                "Noroeste": "#DDC9A4",
                                "Norte": "#10302B",
                                "Occidental": "#BC955C",
                                "Oriental": "#9F2240",
                                "Peninsular": "#A16F4A"
                            };

                            function getColor(pendientes) {
                                const p = parseInt(pendientes, 10);
                                if (isNaN(p)) return '#ccc';
                                if (p === 0) return '#F2D7D9';
                                if (p <= 20) return '#E0B0B6';
                                if (p <= 40) return '#CC8893';
                                if (p <= 60) return '#B86070';
                                if (p <= 80) return '#A3384D';
                                return '#601623';
                            }

                            const municipalitiesLayer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }, {
                                style: function (feature) {
                                    const municipalityData = electrificationDataMap.get(feature.properties.CVEGEO);
                                    if (!municipalityData || municipalityData.PENDIENTE === undefined || municipalityData.PENDIENTE === null) {
                                        return { fillOpacity: 0, opacity: 0, interactive: false };
                                    }
                                    const pendientes = municipalityData.PENDIENTE;
                                    return {
                                        fillColor: getColor(pendientes),
                                        weight: 1,
                                        opacity: 1,
                                        color: 'white',
                                        fillOpacity: 0.8
                                    };
                                },
                                onEachFeature: function (feature, layer) {
                                    const municipalityData = electrificationDataMap.get(feature.properties.CVEGEO);
                                    const pendientes = municipalityData ? municipalityData.PENDIENTE : 'N/A';
                                    const gcr = municipalityData ? municipalityData.GCR : 'N/A';
                                    const cvegeo = feature.properties.CVEGEO || 'N/A';
                                    const nomgeo = feature.properties.NOMGEO || 'Sin nombre';

                                    const popupContent = `
                                        <div style="font-family: 'Montserrat', sans-serif;">
                                            <strong style="font-size: 14px; color: #601623;">${nomgeo}</strong><br>
                                            <strong>CVEGEO:</strong> ${cvegeo}<br>
                                            <strong>GCR:</strong> ${gcr}<br>
                                            <strong>Localidades pendientes:</strong> ${pendientes}
                                        </div>
                                    `;

                                    layer.bindTooltip(popupContent, {
                                        permanent: false,
                                        direction: 'top',
                                        className: 'municipality-tooltip'
                                    });

                                    layer.on('mouseover', function (e) {
                                        console.log('Municipio hover:', {
                                            CVEGEO: cvegeo,
                                            NOMGEO: nomgeo,
                                            GCR: gcr,
                                            PENDIENTE: pendientes
                                        });
                                    });
                                }
                            });

                            municipalitiesLayerGroup.addLayer(municipalitiesLayer);
                            if (typeof municipalitiesLayer.bringToFront === 'function') {
                                municipalitiesLayer.bringToFront();
                            }
                        }

                        updateTimestamp();
                    } catch (error) {
                        console.error('Error actualizando datos de electrificación:', error);
                    } finally {
                        togglePreloader(false);
                    }
                } else if (mapConfig && mapConfig.name === 'Pronóstico regional del PIB, escenario de planeación 2025 - 2030 y 2025-2039') {
                    // Recargar datos del mapa PIB
                    await loadPIBForecastMap(mapConfig);
                } else if (mapConfig && mapConfig.name === 'Pronósticos del consumo bruto 2025 - 2030 y 2025 - 2039') {
                    // Recargar datos del mapa de consumo
                    await loadConsumptionForecastMap(mapConfig);
                } else if (mapConfig && mapConfig.name === 'Adiciones de Capacidad de proyectos de fortalecimiento de la CFE 2025 - 2027') {
                    // Recargar datos del mapa de adiciones de capacidad CFE
                    await loadCapacityAdditionsMap(mapConfig);
                } else if (mapConfig && mapConfig.name === 'Adiciones de capacidad de proyectos del Estado 2027 - 2030') {
                    // Recargar datos del mapa de adiciones de capacidad del Estado
                    await loadCapacityAdditionsMap(mapConfig);
                } else if (mapConfig && mapConfig.name === 'Adiciones de capacidad por Particulares') {
                    // Recargar datos del mapa de adiciones de capacidad por Particulares
                    await loadCapacityAdditionsMap(mapConfig);
                } else if (mapConfig && mapConfig.name === 'Adición de capacidad para desarrollarse por particulares 2026 - 2030') {
                    // Recargar datos del mapa de adiciones de capacidad para desarrollarse por Particulares
                    await loadCapacityAdditionsMap(mapConfig);
                } else {
                    // Para otros mapas, usar la función normal
                    loadAndRender({ silent: false });
                }
            } else {
                loadAndRender({ silent: false });
            }
        });
    }

    // Cargar datos iniciales
    loadAndRender({ silent: false });
    loadMarinasGeoJSON('https://cdn.sassoapps.com/Mapas/Electricidad/regionmarinamx.geojson');

    if (REFRESH_MS > 0) {
        setInterval(function () {
            loadAndRender({ silent: true });
        }, REFRESH_MS);
    }

    // Inicializar sistema de exportación de mapas
    let mapExporter;
    let exportUI = new ExportUI(); // Initialize exportUI here
    console.log('ExportUI inicializado correctamente');
    window.exportUI = exportUI; // Make available globally

    try {
        mapExporter = new MapExporter(map);
        console.log('MapExporter inicializado correctamente');

        // Hacer disponible globalmente para pruebas
        window.mapExporter = mapExporter;

        // Probar la funcionalidad de captura después de que el mapa esté completamente cargado
        setTimeout(async () => {
            try {
                const testResult = await mapExporter.testCapture();
                console.log('Prueba de captura:', testResult);
            } catch (error) {
                console.warn('Error en prueba de captura:', error);
            }
        }, 2000);

    } catch (error) {
        console.error('Error inicializando sistema de exportación:', error);
    }

    // Make map available globally for access from other modules
    window.map = map;

    // --- Export Button Event Listeners ---
    const exportPdfBtn = document.getElementById('export-pdf');
    const exportPngBtn = document.getElementById('export-png');

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => exportUI.openModal('pdf'));
    }

    if (exportPngBtn) {
        exportPngBtn.addEventListener('click', () => exportUI.openModal('png'));
    }

    // Update currentMapTitle when a new map is selected
    const mapDescriptionEl = document.getElementById('map-description');

    if (mapSelect) {
        mapSelect.addEventListener('change', async function () {
            const selectedMapName = this.value;
            const selectedInstrument = instrumentSelect.value;
            instrumentLayerGroup.clearLayers();
            connectionsLayerGroup.clearLayers();
            municipalitiesLayerGroup.clearLayers();
            destroyInsetMaps();
            removeLegend(); // Remove legend when changing map
            removeMunicipalitiesLegend(); // Remove municipalities legend when changing map
            removePIBLegend(); // Remove PIB legend when changing map
            if (selectedRegionBanner) {
                selectedRegionBanner.style.display = 'none'; // Hide region banner when changing map
            }
            clearData();

            if (!selectedMapName) {
                currentSheetUrl = null;
                updateSheetInfo(null, SELECT_MAP_MESSAGE);
                currentMapTitle = DEFAULT_MAP_TITLE;
                updateMapTitleDisplay(DEFAULT_MAP_TITLE);
                
                // Hide search field
                const searchGroup = document.getElementById('search-group');
                if (searchGroup) {
                    searchGroup.style.display = 'none';
                }
                
                if (mapDescriptionEl) {
                    mapDescriptionEl.innerHTML = '';
                    mapDescriptionEl.style.display = 'none';
                }
                if (selectedRegionBanner) {
                    selectedRegionBanner.style.display = 'none';
                }
                return;
            }

            if (selectedInstrument && mapConfigurations[selectedInstrument]) {
                const mapConfig = mapConfigurations[selectedInstrument].find(m => m.name === selectedMapName);
                if (mapConfig) {
                    // Check if map is under construction
                    if (mapConfig.underConstruction) {
                        currentMapTitle = mapConfig.name;
                        updateMapTitleDisplay(currentMapTitle);
                        
                        // Show construction message
                        if (mapDescriptionEl) {
                            const titleEl = document.getElementById('map-description-title');
                            const contentEl = document.getElementById('map-description-content');
                            
                            if (titleEl) {
                                titleEl.innerHTML = '<i class="bi bi-cone-striped"></i> En Construcción';
                                titleEl.style.color = '#f0ad4e';
                            }
                            if (contentEl) {
                                contentEl.innerHTML = 'Este mapa está actualmente en desarrollo. Pronto estará disponible con información actualizada.';
                            }
                            mapDescriptionEl.style.display = 'block';
                        }
                        
                        // Show construction overlay on map
                        const constructionOverlay = document.createElement('div');
                        constructionOverlay.id = 'construction-overlay';
                        constructionOverlay.style.cssText = `
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            background: rgba(255, 255, 255, 0.9);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            z-index: 1000;
                            pointer-events: none;
                        `;
                        constructionOverlay.innerHTML = `
                            <div style="text-align: center; font-family: 'Montserrat', sans-serif;">
                                <i class="bi bi-cone-striped" style="font-size: 80px; color: #f0ad4e; display: block; margin-bottom: 20px;"></i>
                                <h2 style="color: #601623; font-size: 32px; margin: 0 0 10px 0;">En Construcción</h2>
                                <p style="color: #555; font-size: 18px; margin: 0;">Este mapa estará disponible próximamente</p>
                            </div>
                        `;
                        
                        // Remove existing construction overlay if any
                        const existing = document.getElementById('construction-overlay');
                        if (existing) existing.remove();
                        
                        // Add to map container
                        document.getElementById('map').appendChild(constructionOverlay);
                        
                        currentSheetUrl = null;
                        updateSheetInfo(null, 'Mapa en construcción');
                        return;
                    }
                    
                    // Remove construction overlay if switching from construction map
                    const existing = document.getElementById('construction-overlay');
                    if (existing) existing.remove();
                    
                    currentMapTitle = mapConfig.name; // Update the current map title
                    updateMapTitleDisplay(currentMapTitle);

                    if (mapDescriptionEl) {
                        const titleEl = document.getElementById('map-description-title');
                        const contentEl = document.getElementById('map-description-content');

                        if (mapConfig.description) {
                            if (titleEl) {
                                titleEl.innerHTML = mapConfig.descriptionTitle || '';
                            }
                            if (contentEl) {
                                contentEl.innerHTML = mapConfig.description || '';
                            }
                            mapDescriptionEl.style.display = 'block';
                        } else {
                            if (titleEl) titleEl.innerHTML = '';
                            if (contentEl) contentEl.innerHTML = '';
                            mapDescriptionEl.style.display = 'none';
                        }
                    }

                    // Show/hide search field based on map config
                    const searchGroup = document.getElementById('search-group');
                    if (searchGroup) {
                        searchGroup.style.display = mapConfig.enableSearch ? 'flex' : 'none';
                    }

                    if (mapConfig.name === 'Municipios con localidades sin electrificar') {
                        updateSheetInfo(mapConfig); // Update sheet info for this map
                        loadElectrificationMap(mapConfig);
                        return; // Stop further processing for this map for now
                    }

                    if (mapConfig.name === 'Pronóstico regional del PIB, escenario de planeación 2025 - 2030 y 2025-2039') {
                        updateSheetInfo(mapConfig);
                        await loadPIBForecastMap(mapConfig);
                        return;
                    }

                    if (mapConfig.name === 'Pronósticos del consumo bruto 2025 - 2030 y 2025 - 2039') {
                        updateSheetInfo(mapConfig);
                        await loadConsumptionForecastMap(mapConfig);
                        return;
                    }

                    if (mapConfig.name === 'Adiciones de Capacidad de proyectos de fortalecimiento de la CFE 2025 - 2027') {
                        updateSheetInfo(mapConfig);
                        await loadCapacityAdditionsMap(mapConfig);
                        return;
                    }

                    if (mapConfig.name === 'Adiciones de capacidad de proyectos del Estado 2027 - 2030') {
                        updateSheetInfo(mapConfig);
                        await loadCapacityAdditionsMap(mapConfig);
                        return;
                    }

                    if (mapConfig.name === 'Adiciones de capacidad por Particulares') {
                        updateSheetInfo(mapConfig);
                        await loadCapacityAdditionsMap(mapConfig);
                        return;
                    }

                    if (mapConfig.name === 'Adición de capacidad para desarrollarse por particulares 2026 - 2030') {
                        updateSheetInfo(mapConfig);
                        await loadCapacityAdditionsMap(mapConfig);
                        return;
                    }

                    if (Array.isArray(mapConfig.insets) && mapConfig.insets.length) {
                        createInsetMaps(mapConfig.insets);
                    }
                    if (mapConfig.geojsonUrl) {
                        if (mapConfig.name === 'Red nacional de gasoductos en 2024') {
                            addGasLegend();
                        }
                        await loadGeoJSON(mapConfig.geojsonUrl, { type: mapConfig.geojsonUrlType });
                    }
                    if (mapConfig.connectionsGeojsonUrl) {
                        const showPreloader = !mapConfig.geojsonUrl;
                        await loadConnectionsGeoJSON(mapConfig.connectionsGeojsonUrl, { showPreloader, clear: true });
                    }
                    if (mapConfig.pipelineGeojsonUrls && Array.isArray(mapConfig.pipelineGeojsonUrls)) {
                        for (let i = 0; i < mapConfig.pipelineGeojsonUrls.length; i++) {
                            const url = mapConfig.pipelineGeojsonUrls[i];
                            const isFirst = i === 0;
                            // If there was no connectionsGeojsonUrl, the first pipeline layer should clear the group.
                            const shouldClear = isFirst && !mapConfig.connectionsGeojsonUrl;
                            await loadConnectionsGeoJSON(url, { showPreloader: false, clear: shouldClear });
                        }
                    }
                    if (mapConfig.googleSheetUrl && hasValidSheetUrl(mapConfig.googleSheetUrl)) {
                        currentSheetUrl = mapConfig.googleSheetUrl;
                        updateSheetInfo(mapConfig);
                        await loadAndRender({ silent: false });
                    } else {
                        currentSheetUrl = null;
                        updateSheetInfo(null);
                    }
                    return;
                }
            }

            currentSheetUrl = null;
            updateSheetInfo(null, SELECT_MAP_MESSAGE);
            currentMapTitle = DEFAULT_MAP_TITLE;
            updateMapTitleDisplay(DEFAULT_MAP_TITLE);
            if (mapDescriptionEl) {
                mapDescriptionEl.innerHTML = '';
                mapDescriptionEl.style.display = 'none';
            }
        });
    }

    // Search functionality for electricity permits
    const permitSearchInput = document.getElementById('permit-search');
    const searchSuggestionsEl = document.getElementById('search-suggestions');
    const searchHelpBtn = document.getElementById('search-help-btn');
    let selectedSuggestionIndex = -1;
    
    // Search help button
    if (searchHelpBtn) {
        searchHelpBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            openSearchHelpModal();
        });
    }
    
    // Search help modal functions
    function openSearchHelpModal() {
        const modal = document.getElementById('search-help-modal');
        const statusEl = document.getElementById('search-help-status');
        
        if (!modal) return;
        
        // Update status text dynamically
        const hasFilter = currentFilteredData.length > 0;
        if (statusEl) {
            if (hasFilter) {
                statusEl.innerHTML = `
                    <i class="bi bi-funnel" style="margin-right: 6px;"></i>
                    <strong>Filtro activo:</strong> Buscando solo en ${currentFilteredData.length} permiso(s) filtrado(s).
                `;
                statusEl.style.borderLeftColor = 'var(--color-guinda)';
            } else {
                statusEl.innerHTML = `
                    <i class="bi bi-globe" style="margin-right: 6px;"></i>
                    <strong>Sin filtro:</strong> Buscando en todos los ${electricityPermitsData.length} permisos disponibles.
                `;
                statusEl.style.borderLeftColor = 'var(--color-verde-profundo)';
            }
        }
        
        // Show modal
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }
    
    function closeSearchHelpModal() {
        const modal = document.getElementById('search-help-modal');
        if (!modal) return;
        
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        
        // Restore body scroll
        document.body.style.overflow = '';
    }
    
    // Event listeners for closing the modal
    const searchHelpModalCloseButtons = document.querySelectorAll('.search-help-modal-close');
    searchHelpModalCloseButtons.forEach(btn => {
        btn.addEventListener('click', closeSearchHelpModal);
    });
    
    // Close on overlay click
    const searchHelpModal = document.getElementById('search-help-modal');
    if (searchHelpModal) {
        const overlay = searchHelpModal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', closeSearchHelpModal);
        }
        
        // Close on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && searchHelpModal.style.display === 'flex') {
                closeSearchHelpModal();
            }
        });
    }
    
    if (permitSearchInput) {
        // Input event for live suggestions
        permitSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.trim();
            
            if (!searchTerm || searchTerm.length < 2) {
                hideSuggestions();
                return;
            }
            
            if (!electricityPermitsData.length) {
                return;
            }
            
            // Search and show suggestions
            showSearchSuggestions(searchTerm);
        });
        
        // Keydown for navigation
        permitSearchInput.addEventListener('keydown', function(e) {
            const suggestions = document.querySelectorAll('.search-suggestion-item');
            
            if (!suggestions.length) return;
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
                updateSuggestionSelection(suggestions);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
                updateSuggestionSelection(suggestions);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
                    suggestions[selectedSuggestionIndex].click();
                }
            } else if (e.key === 'Escape') {
                hideSuggestions();
            }
        });
        
        // Click outside to close
        document.addEventListener('click', function(e) {
            if (!permitSearchInput.contains(e.target) && !searchSuggestionsEl.contains(e.target)) {
                hideSuggestions();
            }
        });
    }
    
    function showSearchSuggestions(searchTerm) {
        const upperSearch = searchTerm.toUpperCase();
        
        // Determine which dataset to search
        // If there's an active filter, search only in filtered data
        // Otherwise, search in all data
        const dataToSearch = currentFilteredData.length > 0 ? currentFilteredData : electricityPermitsData;
        
        console.log('Searching in:', currentFilteredData.length > 0 ? 'filtered data (' + currentFilteredData.length + ' permits)' : 'all data (' + electricityPermitsData.length + ' permits)');
        
        // Find matches
        const matches = dataToSearch.filter(row => {
            const permitNumber = (row.NumeroPermiso || '').toUpperCase();
            const razonSocial = (row.RazonSocial || '').toUpperCase();
            return permitNumber.includes(upperSearch) || razonSocial.includes(upperSearch);
        }).slice(0, 8); // Limit to 8 results
        
        if (!searchSuggestionsEl) return;
        
        if (matches.length === 0) {
            const noResultsMsg = currentFilteredData.length > 0 
                ? 'No se encontraron resultados en el filtro actual' 
                : 'No se encontraron resultados';
            searchSuggestionsEl.innerHTML = '<div class="search-no-results">' + noResultsMsg + '</div>';
            searchSuggestionsEl.style.display = 'block';
            return;
        }
        
        // Create suggestion items
        searchSuggestionsEl.innerHTML = '';
        
        matches.forEach((row, index) => {
            const item = document.createElement('div');
            item.className = 'search-suggestion-item';
            item.dataset.index = index;
            
            item.innerHTML = `
                <div class="suggestion-permit">${row.NumeroPermiso || 'S/N'}</div>
                <div class="suggestion-company">${row.RazonSocial || 'Sin razón social'}</div>
                <div class="suggestion-details">${row.EfId || ''} • ${row.CapacidadAutorizadaMW || '0'} MW • ${row.Tecnología || ''}</div>
            `;
            
            item.addEventListener('click', function() {
                selectPermit(row);
            });
            
            searchSuggestionsEl.appendChild(item);
        });
        
        searchSuggestionsEl.style.display = 'block';
        selectedSuggestionIndex = -1;
    }
    
    function updateSuggestionSelection(suggestions) {
        suggestions.forEach((item, index) => {
            if (index === selectedSuggestionIndex) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    function selectPermit(row) {
        if (!markersClusterGroup) return;
        
        // Find marker with this permit
        let found = false;
        markersClusterGroup.eachLayer(function(layer) {
            if (layer.permitData && layer.permitData.NumeroPermiso === row.NumeroPermiso) {
                const latLng = layer.getLatLng();
                map.setView(latLng, 12);
                
                setTimeout(function() {
                    layer.openPopup();
                }, 300);
                
                found = true;
                return false;
            }
        });
        
        if (found) {
            // Update search input
            permitSearchInput.value = row.NumeroPermiso || '';
            hideSuggestions();
        }
    }
    
    function hideSuggestions() {
        if (searchSuggestionsEl) {
            searchSuggestionsEl.style.display = 'none';
            searchSuggestionsEl.innerHTML = '';
        }
        selectedSuggestionIndex = -1;
    }
    
    function clearSearchBox() {
        if (permitSearchInput) {
            permitSearchInput.value = '';
        }
        hideSuggestions();
    }

    // Event listeners for electricity filters
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            
            console.log('Tab clicked:', targetTab);
            
            // Update tabs
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Update content
            document.querySelectorAll('.filter-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(targetTab + '-filters').classList.add('active');
            
            // Show/hide layers based on tab
            if (targetTab === 'state') {
                // Tab "Por Estado" - Mostrar Estados, ocultar GCR
                console.log('Showing States layer');
                showStatesLayer(null);
            } else if (targetTab === 'gcr') {
                // Tab "Por Gerencia" - Mostrar GCR, ocultar Estados
                console.log('Showing GCR layer');
                showGCRLayer(null);
            } else if (targetTab === 'tech') {
                // Tab "Por Tecnología" - Ocultar ambas (nivel nacional)
                console.log('Hiding all layers');
                hideGeometryLayers();
            } else if (targetTab === 'matrix') {
                // Tab "Vista Detallada" - Mostrar GCR, ocultar Estados
                console.log('Showing GCR layer for matrix');
                showGCRLayer(null);
            }
        });
    });
    
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', function() {
            resetElectricityFilters();
        });
    }
    
    // Click on map (outside polygons) to reset filter
    map.on('click', function(e) {
        // Only reset if we're on electricity map and have a filter active
        if (!electricityPermitsData.length || !currentFilter) {
            return;
        }
        
        // Check if click was on a polygon (it would have been stopped)
        // If we get here, it means click was NOT on a polygon
        resetElectricityFilters();
    });

    // Welcome screen handling
    const welcomeScreen = document.getElementById('welcome-screen');
    const welcomeStartBtn = document.getElementById('welcome-start-btn');
    
    if (welcomeScreen && welcomeStartBtn) {
        // Show welcome screen on load
        welcomeScreen.style.display = 'flex';
        
        // Hide welcome screen when start button is clicked
        welcomeStartBtn.addEventListener('click', function() {
            welcomeScreen.style.display = 'none';
        });
    }
});
