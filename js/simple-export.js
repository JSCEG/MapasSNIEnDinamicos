/**
 * Sistema de exportación simplificado para mapas
 * Usa dom-to-image para capturar el mapa como PNG
 */

(function() {
    'use strict';

    // Esperar a que el DOM esté listo
    document.addEventListener('DOMContentLoaded', function() {
        const exportBtn = document.getElementById('export-map-btn');
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        const exitFullscreenBtn = document.getElementById('exit-fullscreen-btn');
        const exportFullscreenBtn = document.getElementById('export-fullscreen-btn');
        const mapContainer = document.getElementById('map');
        const mapCard = document.querySelector('.map-card');
        
        if (!exportBtn || !mapContainer) {
            console.warn('Botón de exportación o contenedor de mapa no encontrado');
            return;
        }

        // Verificar si el mapa base actual es de MapTiler
        function isMapTilerActive() {
            // Acceder a las variables globales del map-config.js
            if (typeof window.currentBaseLayerName === 'undefined') {
                return false;
            }
            
            const mapTilerLayers = ['SENER Azul', 'SENER Light', 'SENER Oscuro'];
            return mapTilerLayers.includes(window.currentBaseLayerName);
        }

        // Mostrar modal de advertencia de MapTiler
        function showMapTilerWarning() {
            const modal = document.getElementById('maptiler-warning-modal');
            if (modal) {
                modal.style.display = 'flex';
                modal.setAttribute('aria-hidden', 'false');
                
                // Cerrar modal
                const closeButtons = modal.querySelectorAll('.maptiler-warning-close, .modal-overlay');
                closeButtons.forEach(btn => {
                    btn.addEventListener('click', function() {
                        modal.style.display = 'none';
                        modal.setAttribute('aria-hidden', 'true');
                    });
                });
            }
        }

        // Esperar a que todos los tiles se carguen
        function waitForTiles() {
            return new Promise((resolve) => {
                if (!window.map) {
                    resolve();
                    return;
                }

                let tilesLoading = 0;
                let tilesLoaded = 0;

                window.map.eachLayer(layer => {
                    if (layer instanceof L.TileLayer) {
                        layer.on('tileloadstart', () => tilesLoading++);
                        layer.on('tileload', () => {
                            tilesLoaded++;
                            if (tilesLoaded >= tilesLoading && tilesLoading > 0) {
                                setTimeout(resolve, 500);
                            }
                        });
                        layer.on('tileerror', () => {
                            tilesLoaded++;
                            if (tilesLoaded >= tilesLoading && tilesLoading > 0) {
                                setTimeout(resolve, 500);
                            }
                        });
                    }
                });

                // Timeout de seguridad
                setTimeout(() => resolve(), 3000);
            });
        }

        // Exportar mapa como PNG usando dom-to-image
        async function exportMapAsPNG() {
            // Verificar si MapTiler está activo
            if (isMapTilerActive()) {
                showMapTilerWarning();
                return;
            }

            // Mostrar overlay de progreso
            const progressOverlay = document.getElementById('export-progress-overlay');
            const progressMessage = progressOverlay ? progressOverlay.querySelector('.progress-message') : null;
            const progressPercentage = progressOverlay ? progressOverlay.querySelector('.progress-percentage') : null;
            const progressFill = progressOverlay ? progressOverlay.querySelector('.progress-fill') : null;

            if (progressOverlay) {
                progressOverlay.style.display = 'flex';
                if (progressMessage) progressMessage.textContent = 'Esperando carga de tiles...';
                if (progressPercentage) progressPercentage.textContent = '10%';
                if (progressFill) progressFill.style.width = '10%';
            }

            // Ocultar control de capas temporalmente
            const layersControl = document.querySelector('.leaflet-control-layers');
            const layersControlWasVisible = layersControl && layersControl.style.display !== 'none';
            if (layersControl) {
                layersControl.style.display = 'none';
            }

            // Ocultar botones flotantes de pantalla completa
            const fullscreenControls = document.getElementById('fullscreen-controls');
            const fullscreenControlsWasVisible = fullscreenControls && fullscreenControls.style.display !== 'none';
            if (fullscreenControls) {
                fullscreenControls.style.display = 'none';
            }

            // Ocultar atribución de Leaflet (créditos de tiles)
            const attribution = document.querySelector('.leaflet-control-attribution');
            const attributionWasVisible = attribution && attribution.style.display !== 'none';
            if (attribution) {
                attribution.style.display = 'none';
            }

            // Ocultar control de escala
            const scaleControl = document.querySelector('.leaflet-control-scale');
            const scaleControlWasVisible = scaleControl && scaleControl.style.display !== 'none';
            if (scaleControl) {
                scaleControl.style.display = 'none';
            }

            try {
                console.log('🔄 Esperando carga de tiles...');
                await waitForTiles();

                if (progressMessage) progressMessage.textContent = 'Capturando imagen del mapa...';
                if (progressPercentage) progressPercentage.textContent = '50%';
                if (progressFill) progressFill.style.width = '50%';

                console.log('🔄 Capturando imagen con dom-to-image (Calidad 4x - Alta Resolución)...');

                // Usar dom-to-image para capturar con máxima calidad
                // Escala 4x para imágenes de alta resolución
                const scale = 4;
                const dataUrl = await domtoimage.toPng(mapContainer, {
                    quality: 1.0,
                    width: mapContainer.offsetWidth * scale,
                    height: mapContainer.offsetHeight * scale,
                    style: {
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        // Mejorar renderizado de texto
                        '-webkit-font-smoothing': 'antialiased',
                        '-moz-osx-font-smoothing': 'grayscale',
                        'text-rendering': 'optimizeLegibility'
                    },
                    cacheBust: true,
                    // Configuración adicional para mejor calidad
                    bgcolor: '#ffffff',
                    filter: function(node) {
                        // Excluir todos los controles de Leaflet y botones flotantes
                        if (node.classList) {
                            return !node.classList.contains('leaflet-control-zoom') &&
                                   !node.classList.contains('leaflet-control-layers') &&
                                   !node.classList.contains('leaflet-control-attribution') &&
                                   !node.classList.contains('leaflet-control-scale') &&
                                   !node.classList.contains('fullscreen-controls') &&
                                   !node.classList.contains('fullscreen-control-btn');
                        }
                        if (node.id === 'fullscreen-controls') {
                            return false;
                        }
                        return true;
                    }
                });

                if (progressMessage) progressMessage.textContent = 'Descargando imagen...';
                if (progressPercentage) progressPercentage.textContent = '90%';
                if (progressFill) progressFill.style.width = '90%';

                // Descargar imagen
                const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                const mapTitle = window.currentMapTitle || 'mapa_snien';
                const filename = `${mapTitle.replace(/\s+/g, '_')}_${timestamp}.png`;

                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                if (progressPercentage) progressPercentage.textContent = '100%';
                if (progressFill) progressFill.style.width = '100%';

                const finalWidth = mapContainer.offsetWidth * scale;
                const finalHeight = mapContainer.offsetHeight * scale;
                console.log('✅ Exportación completada:', filename);
                console.log(`📐 Dimensiones: ${finalWidth}x${finalHeight}px (Escala ${scale}x)`);

                // Mostrar notificación de éxito
                if (typeof showNotification === 'function') {
                    showNotification(
                        'Exportación completada', 
                        `Imagen de alta resolución (${scale}x) guardada como: ${filename}`, 
                        'success'
                    );
                }

                // Cerrar overlay después de un momento
                setTimeout(() => {
                    if (progressOverlay) progressOverlay.style.display = 'none';
                    
                    // Restaurar control de capas
                    if (layersControl && layersControlWasVisible) {
                        layersControl.style.display = '';
                    }
                    
                    // Restaurar botones flotantes
                    if (fullscreenControls && fullscreenControlsWasVisible) {
                        fullscreenControls.style.display = '';
                    }
                    
                    // Restaurar atribución
                    if (attribution && attributionWasVisible) {
                        attribution.style.display = '';
                    }
                    
                    // Restaurar control de escala
                    if (scaleControl && scaleControlWasVisible) {
                        scaleControl.style.display = '';
                    }
                }, 1000);

            } catch (error) {
                console.error('❌ Error en exportación:', error);
                
                // Restaurar todos los controles en caso de error
                if (layersControl && layersControlWasVisible) {
                    layersControl.style.display = '';
                }
                
                if (fullscreenControls && fullscreenControlsWasVisible) {
                    fullscreenControls.style.display = '';
                }
                
                if (attribution && attributionWasVisible) {
                    attribution.style.display = '';
                }
                
                if (scaleControl && scaleControlWasVisible) {
                    scaleControl.style.display = '';
                }
                
                if (typeof showNotification === 'function') {
                    showNotification('Error en exportación', error.message, 'error');
                }

                if (progressOverlay) progressOverlay.style.display = 'none';
            }
        }

        // Toggle pantalla completa
        function toggleFullscreen() {
            if (!mapCard) return;

            if (!document.fullscreenElement) {
                // Entrar en pantalla completa
                mapCard.requestFullscreen().catch(err => {
                    console.error('Error al entrar en pantalla completa:', err);
                });
                
                // Invalidar tamaño del mapa después de un momento
                setTimeout(() => {
                    if (window.map && window.map.invalidateSize) {
                        window.map.invalidateSize();
                    }
                }, 100);
                
                if (fullscreenBtn) {
                    fullscreenBtn.querySelector('i').className = 'bi bi-fullscreen-exit';
                    fullscreenBtn.title = 'Salir de pantalla completa';
                }
            } else {
                // Salir de pantalla completa
                document.exitFullscreen();
                
                // Invalidar tamaño del mapa después de un momento
                setTimeout(() => {
                    if (window.map && window.map.invalidateSize) {
                        window.map.invalidateSize();
                    }
                }, 100);
                
                if (fullscreenBtn) {
                    fullscreenBtn.querySelector('i').className = 'bi bi-arrows-fullscreen';
                    fullscreenBtn.title = 'Pantalla completa';
                }
            }
        }

        // Event listeners
        exportBtn.addEventListener('click', function(e) {
            // Prevenir que el click se propague al mapa
            e.stopPropagation();
            e.preventDefault();
            exportMapAsPNG();
        });
        
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', function(e) {
                // Prevenir que el click se propague al mapa
                e.stopPropagation();
                e.preventDefault();
                toggleFullscreen();
            });
        }

        if (exitFullscreenBtn) {
            exitFullscreenBtn.addEventListener('click', function(e) {
                // Prevenir que el click se propague al mapa
                e.stopPropagation();
                e.preventDefault();
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                }
            });
        }

        if (exportFullscreenBtn) {
            exportFullscreenBtn.addEventListener('click', function(e) {
                // Prevenir que el click se propague al mapa
                e.stopPropagation();
                e.preventDefault();
                exportMapAsPNG();
            });
        }

        // Listener para cambios de pantalla completa
        document.addEventListener('fullscreenchange', function() {
            // Invalidar tamaño del mapa cuando cambia el estado de pantalla completa
            setTimeout(() => {
                if (window.map && window.map.invalidateSize) {
                    window.map.invalidateSize();
                }
            }, 100);
            
            if (fullscreenBtn) {
                if (document.fullscreenElement) {
                    fullscreenBtn.querySelector('i').className = 'bi bi-fullscreen-exit';
                    fullscreenBtn.title = 'Salir de pantalla completa (ESC)';
                } else {
                    fullscreenBtn.querySelector('i').className = 'bi bi-arrows-fullscreen';
                    fullscreenBtn.title = 'Pantalla completa';
                }
            }
        });

        // Prevenir propagación de clicks en el contenedor de controles flotantes
        const fullscreenControlsContainer = document.getElementById('fullscreen-controls');
        if (fullscreenControlsContainer) {
            fullscreenControlsContainer.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            fullscreenControlsContainer.addEventListener('mousedown', function(e) {
                e.stopPropagation();
            });
            fullscreenControlsContainer.addEventListener('mouseup', function(e) {
                e.stopPropagation();
            });
        }

        console.log('✅ Sistema de exportación simplificado inicializado');
    });
})();
