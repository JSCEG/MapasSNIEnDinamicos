/**
 * Configuración de estilos y leyenda para Provincias Petroleras
 */

(function() {
    'use strict';

    // Paleta de colores elegante y equilibrada - Azules, Vinos y Verdes institucionales
    const PROVINCIAS_COLORS = {
        'BURGOS': '#8B3A62',                                            // 1. Vino elegante
        'CINTURON PLEGADO DE CHIAPAS': '#2E5266',                       // 2. Azul petróleo
        'CUENCAS DEL SURESTE': '#6C5B7B',                               // 3. Púrpura suave
        'GOLFO DE MEXICO PROFUNDO': '#1f7a62',                          // 4. Verde SENER profundo
        'PLATAFORMA DE YUCATAN': '#4A7C8C',                             // 5. Azul grisáceo
        'SABINAS - BURRO - PICACHOS': '#9B6B6B',                        // 6. Terracota suave
        'TAMPICO-MISANTLA': '#24a47a',                                  // 7. Verde SENER claro
        'VERACRUZ': '#5D8AA8',                                          // 8. Azul acero
        'CHIHUAHUA': '#7B9E87',                                         // 9. Verde salvia
        'CINTURON PLEGADO DE LA SIERRA MADRE ORIENTAL': '#8B7355',     // 10. Café elegante
        'GOLFO DE CALIFORNIA': '#6B4C4C',                               // 11. Vino chocolate
        'VIZCAINO-LA PURISIMA-IRAY': '#A67C52'                          // 12. Caramelo
    };

    // Función para obtener el color de una provincia
    function getProvinciaColor(nombre) {
        return PROVINCIAS_COLORS[nombre] || '#95A5A6';
    }

    // Función para aplicar estilo a las provincias
    function styleProvincias(feature) {
        const nombre = feature.properties.nombre;
        return {
            fillColor: getProvinciaColor(nombre),
            weight: 0,
            opacity: 0,
            color: 'transparent',
            fillOpacity: 0.75,
            // Efecto de sombra usando className
            className: 'provincia-polygon'
        };
    }

    // Función para crear popup con información de la provincia
    function createProvinciaPopup(feature) {
        const props = feature.properties;
        
        let html = `
            <div style="font-family: 'Montserrat', sans-serif; max-width: 300px;">
                <h3 style="margin: 0 0 6px 0; color: #2C3E50; font-size: 12px; border-bottom: 2px solid ${getProvinciaColor(props.nombre)}; padding-bottom: 3px;">
                    ${props.nombre}
                </h3>
                
                <div style="margin-bottom: 4px; font-size: 10px;">
                    <strong style="color: #34495E;">Situación:</strong> 
                    <span style="color: #7F8C8D;">${props.situacin || 'N/A'}</span>
                </div>
                
                <div style="margin-bottom: 4px; font-size: 10px;">
                    <strong style="color: #34495E;">Ubicación:</strong> 
                    <span style="color: #7F8C8D;">${props.ubicacin || 'N/A'}</span>
                </div>
                
                <div style="margin-bottom: 4px; font-size: 10px;">
                    <strong style="color: #34495E;">Área:</strong> 
                    <span style="color: #7F8C8D;">${parseFloat(props.rea_km2).toLocaleString('es-MX')} km²</span>
                </div>
                
                <hr style="border: none; border-top: 1px solid #BDC3C7; margin: 6px 0;">
                
                <h4 style="margin: 6px 0 3px 0; color: #2C3E50; font-size: 10px; font-weight: 600;">
                    📊 Plays Convencionales
                </h4>
                
                <div style="margin-bottom: 3px; font-size: 9px;">
                    <strong>Petróleo Crudo Equiv.:</strong> 
                    <span style="color: #E74C3C;">${props.recursos_p || 0} MMMBPCE</span>
                </div>
                
                <div style="margin-bottom: 3px; font-size: 9px;">
                    <strong>Petróleo:</strong> 
                    <span style="color: #E67E22;">${props.recursos_2 || 0} MMMB</span>
                </div>
                
                <div style="margin-bottom: 6px; font-size: 9px;">
                    <strong>Gas Natural:</strong> 
                    <span style="color: #3498DB;">${props.recursos_4 || 0} MMMPC</span>
                </div>
                
                <h4 style="margin: 6px 0 3px 0; color: #2C3E50; font-size: 10px; font-weight: 600;">
                    📊 Plays No Convencionales
                </h4>
                
                <div style="margin-bottom: 3px; font-size: 9px;">
                    <strong>Petróleo Crudo Equiv.:</strong> 
                    <span style="color: #E74C3C;">${props.recursos_1 || 0} MMMBPCE</span>
                </div>
                
                <div style="margin-bottom: 3px; font-size: 9px;">
                    <strong>Petróleo:</strong> 
                    <span style="color: #E67E22;">${props.recursos_3 || 0} MMMB</span>
                </div>
                
                <div style="margin-bottom: 6px; font-size: 9px;">
                    <strong>Gas Natural:</strong> 
                    <span style="color: #3498DB;">${props.recursos_5 || 0} MMMPC</span>
                </div>
                
                <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #BDC3C7; font-size: 9px; color: #95A5A6;">
                    <strong>Versión:</strong> ${props.versin || 'N/A'}
                </div>
            </div>
        `;
        
        return html;
    }

    // Función para crear la leyenda personalizada con datos del GeoJSON
    function createProvinciaLegend(geoJsonLayer) {
        const legend = L.control({ position: 'bottomleft' });

        legend.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'info legend provincias-legend');
            
            let html = `
                <h4 style="margin: 0 0 6px 0; font-size: 11px; font-weight: 600; color: #1f7a62;">
                    Provincias Petroleras
                </h4>
            `;

            // Crear array de provincias con sus IDs del GeoJSON
            const provincias = [];
            geoJsonLayer.eachLayer(function(layer) {
                const props = layer.feature.properties;
                provincias.push({
                    nombre: props.nombre,
                    id: props.Id,
                    color: getProvinciaColor(props.nombre)
                });
            });

            // Ordenar por ID
            provincias.sort((a, b) => a.id - b.id);

            // Agregar cada provincia con su color e ID del GeoJSON
            provincias.forEach(provincia => {
                html += `
                    <div style="margin-bottom: 3px; display: flex; align-items: center; font-size: 9px;">
                        <span style="
                            display: inline-block;
                            width: 12px;
                            height: 12px;
                            background-color: ${provincia.color};
                            border: 1px solid #2C3E50;
                            margin-right: 5px;
                            border-radius: 2px;
                            flex-shrink: 0;
                        "></span>
                        <span style="color: #162230; line-height: 1.2;">${provincia.nombre} <strong style="color: #1f7a62;">(${provincia.id})</strong></span>
                    </div>
                `;
            });

            div.innerHTML = html;
            return div;
        };

        return legend;
    }

    // Función para aplicar interactividad a las provincias
    function onEachProvinciaFeature(feature, layer) {
        // Popup
        layer.bindPopup(createProvinciaPopup(feature), {
            maxWidth: 450,
            className: 'provincia-popup'
        });

        // Agregar etiqueta con el ID en el centro de la provincia
        const nombre = feature.properties.nombre;
        const id = feature.properties.Id || '?';
        
        // Calcular el centro del polígono
        const center = layer.getBounds().getCenter();
        
        // Crear etiqueta permanente con el ID
        const label = L.marker(center, {
            icon: L.divIcon({
                className: 'provincia-label',
                html: `<div style="
                    background: rgba(255, 255, 255, 0.85);
                    border: 2px solid ${getProvinciaColor(nombre)};
                    border-radius: 50%;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 13px;
                    color: #2C3E50;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    font-family: 'Montserrat', sans-serif;
                ">${id}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            }),
            interactive: false
        });
        
        // Guardar referencia a la etiqueta en el layer
        layer.label = label;

        // Eventos de hover
        layer.on({
            mouseover: function(e) {
                const layer = e.target;
                layer.setStyle({
                    weight: 2.5,
                    opacity: 1,
                    fillOpacity: 0.95,
                    color: '#000000'
                });
                layer.bringToFront();
            },
            mouseout: function(e) {
                const layer = e.target;
                layer.setStyle({
                    weight: 0,
                    opacity: 0,
                    fillOpacity: 0.75,
                    color: 'transparent'
                });
            }
        });
    }

    // Variable global para guardar el grupo de etiquetas
    let provinciaLabelsGroup = null;

    // Función para agregar etiquetas al mapa
    function addProvinciaLabels(geoJsonLayer, map) {
        // Limpiar etiquetas anteriores si existen
        if (provinciaLabelsGroup) {
            map.removeLayer(provinciaLabelsGroup);
        }
        
        provinciaLabelsGroup = L.layerGroup();
        
        geoJsonLayer.eachLayer(function(layer) {
            if (layer.label) {
                layer.label.addTo(provinciaLabelsGroup);
            }
        });
        
        provinciaLabelsGroup.addTo(map);
        return provinciaLabelsGroup;
    }

    // Función para limpiar etiquetas
    function removeProvinciaLabels(map) {
        if (provinciaLabelsGroup) {
            map.removeLayer(provinciaLabelsGroup);
            provinciaLabelsGroup = null;
        }
    }

    // Exportar funciones globalmente
    window.ProvinciasPetroleras = {
        styleProvincias: styleProvincias,
        onEachProvinciaFeature: onEachProvinciaFeature,
        createProvinciaLegend: createProvinciaLegend,
        getProvinciaColor: getProvinciaColor,
        addProvinciaLabels: addProvinciaLabels,
        removeProvinciaLabels: removeProvinciaLabels
    };

    console.log('✅ Módulo de Provincias Petroleras cargado');
})();
