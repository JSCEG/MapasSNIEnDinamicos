/**
 * Configuración e inicialización del mapa principal
 */
document.addEventListener('DOMContentLoaded', function () {
    const MAP_CONTAINER_ID = 'map';
    const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS4QU5BVBEHmewrNOLjaKoqca3qH16zYKXzvYfMwhrMiW1mR4yUHNJlbIjDhQuDmWtN803Da7r4SZV6/pub?gid=0&single=true&output=csv';
    const REFRESH_MS = 0; // Cambia a 300000 para 5 minutos

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
            layer: createMapTilerLayer('0198a42c-5e08-77a1-9773-763ee4e12b32', 'personal', fallbackLight, 'SENER Azul')
        },
        'sener-light': {
            label: 'SENER Light',
            layer: createMapTilerLayer('0198a9af-dc7c-79d3-8316-a80767ad1d0f', 'amigo', fallbackLight, 'SENER Light')
        },
        'sener-oscuro': {
            label: 'SENER Oscuro',
            layer: createMapTilerLayer('0198a9f0-f135-7991-aaec-bea71681556e', 'amigo', fallbackDark, 'SENER Oscuro')
        },
        'google-satelite': {
            label: 'Google Satélite',
            layer: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                attribution: '&copy; Google',
                maxZoom: 20
            })
        }
    };

    const baseLayers = {};
    const baseLayersForControl = {};

    Object.entries(layerConfigs).forEach(function ([key, config]) {
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
        preferCanvas: true
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

    // Handle background for "None" basemap
    map.on('baselayerchange', function (e) {
        map.isBasemapActive = e.name !== 'Ninguno';
        if (e.name === 'Ninguno') {
            map.getContainer().style.backgroundColor = 'white';
        } else {
            map.getContainer().style.backgroundColor = '';
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

    // --- Instrument and Map Selection Logic ---

    const instrumentSelect = document.getElementById('instrument-select');
    const mapSelect = document.getElementById('map-select');
    map.createPane('gerenciasPane');
    const instrumentLayerGroup = L.layerGroup({ pane: 'gerenciasPane' }).addTo(map);

    const mapConfigurations = {
        'PLADESE': [
            {
                name: 'Regiones y enlaces del SEN en 2025',
                geojsonUrl: 'https://cdn.sassoapps.com/Mapas/Electricidad/gerenciasdecontrol.geojson',
                googleSheetUrl: 'URL_TO_PLADESE_MAPA1_SHEET' // This will be used later
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

    if (instrumentSelect) {
        instrumentSelect.addEventListener('change', function () {
            const selectedInstrument = this.value;
            mapSelect.innerHTML = '<option value="">Seleccione un mapa</option>'; // Clear previous options
            mapSelect.disabled = true;

            if (selectedInstrument && mapConfigurations[selectedInstrument]) {
                const maps = mapConfigurations[selectedInstrument];
                maps.forEach(mapConfig => {
                    const option = document.createElement('option');
                    option.value = mapConfig.name;
                    option.textContent = mapConfig.name;
                    mapSelect.appendChild(option);
                });
                mapSelect.disabled = false;
            }
        });
    }

    if (mapSelect) {
        mapSelect.addEventListener('change', async function () {
            const selectedMapName = this.value;
            const selectedInstrument = instrumentSelect.value;
            instrumentLayerGroup.clearLayers();
            removeLegend(); // Remove legend when changing map

            if (selectedMapName && selectedInstrument && mapConfigurations[selectedInstrument]) {
                const mapConfig = mapConfigurations[selectedInstrument].find(m => m.name === selectedMapName);
                if (mapConfig) {
                    console.log('Cargando mapa:', mapConfig.name);
                    if (mapConfig.geojsonUrl) {
                        await loadGeoJSON(mapConfig.geojsonUrl);
                    }
                    if (mapConfig.googleSheetUrl) {
                        // Future implementation: loadGoogleSheet(mapConfig.googleSheetUrl);
                        console.log('URL de Google Sheet:', mapConfig.googleSheetUrl);
                    }
                }
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
            div.innerHTML += '<strong>Regiones</strong>';

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

    function removeLegend() {
        if (legendControl) {
            map.removeControl(legendControl);
            legendControl = null;
        }
    }

    async function loadGeoJSON(url) {
        togglePreloader(true);
        try {
            const response = await fetch(url);
            const data = await response.json();

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

            function getRegionStyle(feature) {
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

            const geoJsonLayer = L.geoJSON(data, {
                style: getRegionStyle,
                onEachFeature: function (feature, layer) {
                    if (feature.properties && feature.properties.name) {
                        layer.bindTooltip(feature.properties.name, {
                            permanent: true,
                            direction: 'center',
                            className: 'region-label' // Optional: for custom styling
                        });
                    }

                    layer.on({
                        mouseover: function (e) {
                            const layer = e.target;
                            const originalColor = regionColors[feature.properties.name] || '#808080';
                            const darkerColor = darkenColor(originalColor, 20); // Darken by 20%

                            layer.setStyle({
                                weight: 5,
                                color: darkerColor,
                                dashArray: '',
                                fillOpacity: 0.9
                            });
                            layer.bringToFront();
                        },
                        mouseout: function (e) {
                            geoJsonLayer.resetStyle(e.target);
                        }
                    });
                }
            });

            instrumentLayerGroup.clearLayers(); // Clear before adding new layers
            instrumentLayerGroup.addLayer(geoJsonLayer);
            addLegend(regionColors); // Add legend to map

        } catch (error) {
            console.error('Error cargando GeoJSON:', error);
            // Optionally, show a notification to the user
        } finally {
            togglePreloader(false);
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
                fillColor: '#0077be',
                weight: 1,
                opacity: 1,
                color: 'white',
                fillOpacity: 0.5,
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

    function drawRows(rows) {
        markersLayer.clearLayers();
        const bounds = [];
        rows.forEach(function (row) {
            const latRaw = row.lat || row.Lat || row.latitude || '';
            const lngRaw = row.lng || row.Lng || row.lon || row.longitude || '';
            const lat = parseFloat(latRaw.toString().replace(',', '.'));
            const lng = parseFloat(lngRaw.toString().replace(',', '.'));
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
            }
            const title = row.titulo || row.Titulo || 'Registro';
            const description = row.descripcion || row.Descripcion || '';
            const popup = [
                '<div><span class="badge">Hoja</span></div>',
                '<strong>' + title + '</strong>',
                description ? '<div class="description">' + description + '</div>' : '',
                '<small>(' + lat.toFixed(5) + ', ' + lng.toFixed(5) + ')</small>'
            ].filter(Boolean).join('');
            L.marker([lat, lng]).bindPopup(popup).addTo(markersLayer);
            bounds.push([lat, lng]);
        });
        if (bounds.length) {
            const calculatedBounds = L.latLngBounds(bounds);
            map.fitBounds(bounds.length === 1 ? calculatedBounds.pad(0.25) : calculatedBounds.pad(0.2));
        }
    }

    async function loadAndRender(options) {
        const silent = options && options.silent;
        if (!silent) {
            togglePreloader(true);
        }
        try {
            const cacheBuster = 'cb=' + Date.now();
            const url = SHEET_CSV + (SHEET_CSV.includes('?') ? '&' : '?') + cacheBuster;
            const response = await fetch(url, { cache: 'no-store' });
            const csvText = await response.text();
            const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            drawRows(parsed.data);
            updateTimestamp();
        } catch (error) {
            console.error('Fallo de carga:', error);
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
    let currentMapTitle = 'Mapa SNIEn - Sistema Nacional de Información Energética'; // Default title

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => exportUI.openModal('pdf'));
    }

    if (exportPngBtn) {
        exportPngBtn.addEventListener('click', () => exportUI.openModal('png'));
    }

    // Update currentMapTitle when a new map is selected
    if (mapSelect) {
        mapSelect.addEventListener('change', async function () {
            const selectedMapName = this.value;
            const selectedInstrument = instrumentSelect.value;
            instrumentLayerGroup.clearLayers();
            removeLegend(); // Remove legend when changing map

            if (selectedMapName && selectedInstrument && mapConfigurations[selectedInstrument]) {
                const mapConfig = mapConfigurations[selectedInstrument].find(m => m.name === selectedMapName);
                if (mapConfig) {
                    currentMapTitle = mapConfig.name; // Update the current map title
                    console.log('currentMapTitle actualizado a:', currentMapTitle); // DEBUG
                    console.log('Cargando mapa:', mapConfig.name);
                    if (mapConfig.geojsonUrl) {
                        await loadGeoJSON(mapConfig.geojsonUrl);
                    }
                    if (mapConfig.googleSheetUrl) {
                        // Future implementation: loadGoogleSheet(mapConfig.googleSheetUrl);
                        console.log('URL de Google Sheet:', mapConfig.googleSheetUrl);
                    }
                }
            }
        });
    }
});