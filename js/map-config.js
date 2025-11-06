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
        center: [24.1, -102],
        zoom: 4,
        minZoom: 5,
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
        if (lastUpdatedEl) {
            lastUpdatedEl.textContent = '--';
        }
    }

    // --- Instrument and Map Selection Logic ---

    const instrumentSelect = document.getElementById('instrument-select');
    const mapSelect = document.getElementById('map-select');
    const sheetInfoEl = document.getElementById('sheet-info');
    map.createPane('gerenciasPane');
    map.createPane('statesPane');
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
            }
            // ... other PLADESE maps can be added here
        ],
        'PLADESHI': [
            {
                name: 'Mapa 3 (PLADESHI)',
                geojsonUrl: 'URL_TO_PLADESHI_MAPA3.geojson',
                googleSheetUrl: 'URL_TO_PLADESHI_MAPA3_SHEET'
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
                styleFunction = function(feature) {
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

                styleFunction = function(feature) {
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

                let focusedRegion = null;

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

                            // Restyle all regions
                            geoJsonLayer.eachLayer(l => {
                                const regionColor = regionColors[l.feature.properties.name] || '#808080';
                                if (l.feature.properties.name === clickedRegionName) {
                                    l.setStyle({
                                        fillColor: regionColor,
                                        weight: 3,
                                        color: '#888',
                                        fillOpacity: 0,
                                        dashArray: ''
                                    });
                                    l.bringToFront();
                                } else {
                                    l.setStyle({
                                        fillColor: regionColor,
                                        weight: 1,
                                        color: '#ddd',
                                        fillOpacity: 0.1,
                                        dashArray: '3'
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
                                style: function(feature) {
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
                                onEachFeature: function(feature, layer) {
                                    const municipalityData = electrificationDataMap.get(feature.properties.CVEGEO);
                                    const pendientes = municipalityData ? municipalityData.PENDIENTE : 'N/A';
                                    const popupContent = `<strong>${feature.properties.NOMGEO}</strong><br>Localidades pendientes: ${pendientes}`;
                                    layer.bindPopup(popupContent);
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
                map.on('click', function(e) {
                    if (focusedRegion !== null) {
                        resetAllRegionsToInitialState();
                    }
                });

                addLegend(regionColors);
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

                styleFunction = function(feature) {
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

                    const insetStyleFunction = function(feature) {
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
                opacity: 1,
                color: '#8cb4e2',
                fillOpacity: 0.7,
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
        if (bounds.length) {
            const calculatedBounds = L.latLngBounds(bounds);
            map.fitBounds(bounds.length === 1 ? calculatedBounds.pad(0.25) : calculatedBounds.pad(0.2));
        }
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
                drawRows(parsed.data, mapConfig);
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

    // Event listeners
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            loadAndRender({ silent: false });
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
            if (selectedRegionBanner) {
                selectedRegionBanner.style.display = 'none'; // Hide region banner when changing map
            }
            clearData();

            if (!selectedMapName) {
                currentSheetUrl = null;
                updateSheetInfo(null, SELECT_MAP_MESSAGE);
                currentMapTitle = DEFAULT_MAP_TITLE;
                updateMapTitleDisplay(DEFAULT_MAP_TITLE);
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

                    if (mapConfig.name === 'Municipios con localidades sin electrificar') {
                        updateSheetInfo(mapConfig); // Update sheet info for this map
                        loadElectrificationMap(mapConfig);
                        return; // Stop further processing for this map for now
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
});
