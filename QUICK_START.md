# 🎯 INTEGRACIÓN RÁPIDA - Sistema de Etiquetas Inteligentes

## ✅ Estado Actual
- Sistema SmartLabels creado y cargado en el HTML
- Listo para usar con cualquier conjunto de marcadores

## 🚀 Activación Manual (Método Rápido)

### Opción 1: Activar desde la Consola del Navegador

1. Abre el mapa "Regiones y enlaces del SEN en 2025"
2. Abre la consola del navegador (F12)
3. Ejecuta este código:

```javascript
// Recopilar todos los marcadores de nodos del mapa
const nodeMarkers = [];
map.eachLayer(function(layer) {
    // Buscar marcadores que tengan tooltips permanentes (los números de nodos)
    if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        const tooltip = layer.getTooltip();
        if (tooltip && tooltip.options.permanent) {
            nodeMarkers.push(layer);
        }
    }
});

console.log('📊 Nodos encontrados:', nodeMarkers.length);

// Inicializar sistema de etiquetas inteligentes
if (window.SmartLabels && nodeMarkers.length > 0) {
    window.SmartLabels.initialize(map, nodeMarkers);
    console.log('✅ Sistema de etiquetas inteligentes activado!');
} else {
    console.warn('⚠️ No se encontraron nodos o SmartLabels no está cargado');
}
```

### Opción 2: Crear Botón de Activación

Agrega este código en `map-config.js` después de que se cargue el mapa:

```javascript
// Crear botón para activar etiquetas inteligentes
function createSmartLabelsButton() {
    const button = document.createElement('button');
    button.id = 'activate-smart-labels-btn';
    button.className = 'btn-secondary btn-icon';
    button.title = 'Activar Etiquetas Inteligentes';
    button.innerHTML = '<i class="bi bi-magic"></i>';
    button.style.cssText = `
        position: absolute;
        bottom: 130px;
        right: 10px;
        z-index: 1000;
        width: 40px;
        height: 40px;
        border-radius: 4px;
        background: white;
        border: 2px solid rgba(0,0,0,0.2);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    `;
    
    button.addEventListener('click', function() {
        const nodeMarkers = [];
        map.eachLayer(function(layer) {
            if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
                const tooltip = layer.getTooltip();
                if (tooltip && tooltip.options.permanent) {
                    nodeMarkers.push(layer);
                }
            }
        });
        
        if (window.SmartLabels && nodeMarkers.length > 0) {
            if (window.SmartLabels.isInitialized()) {
                window.SmartLabels.cleanup(map);
                button.style.background = 'white';
                button.title = 'Activar Etiquetas Inteligentes';
                console.log('🔴 Etiquetas inteligentes desactivadas');
            } else {
                window.SmartLabels.initialize(map, nodeMarkers);
                button.style.background = '#1f7a62';
                button.style.color = 'white';
                button.title = 'Desactivar Etiquetas Inteligentes';
                console.log('✅ Etiquetas inteligentes activadas');
            }
        }
    });
    
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.appendChild(button);
    }
}

// Llamar esta función cuando se cargue el mapa "Regiones y enlaces del SEN en 2025"
// Por ejemplo, después de cargar los nodos:
if (mapConfig.name === 'Regiones y enlaces del SEN en 2025') {
    createSmartLabelsButton();
}
```

## 🔧 Ajustar Configuración

Si las etiquetas se mueven demasiado o muy poco, edita `js/smart-labels.js`:

```javascript
const CONFIG = {
    labelPadding: 5,           // ↑ Aumentar para más espacio
    minDistance: 20,           // ↑ Aumentar para más separación
    leaderLineColor: '#1f7a62', // Color de las líneas
    leaderLineWidth: 1.5,      // Grosor de las líneas
    maxIterations: 50,         // ↑ Aumentar para mejor posicionamiento
    forceStrength: 0.3,        // ↑ Aumentar para más repulsión
    anchorForce: 0.1           // ↓ Disminuir para permitir más movimiento
};
```

## 📝 Ejemplo de Salida Esperada

Cuando ejecutes el código, verás en la consola:

```
📦 Módulo SmartLabels cargado
📊 Nodos encontrados: 100
🎯 Inicializando sistema de etiquetas inteligentes...
🔄 Iniciando reposicionamiento de 100 etiquetas...
✅ Reposicionamiento completado en 23 iteraciones
📊 Etiquetas con leader lines: 15
✅ Sistema de etiquetas inteligentes inicializado
```

## 🎨 Resultado Visual

- ✅ Etiquetas separadas sin empalmes
- ✅ Líneas punteadas verdes conectando etiquetas reposicionadas
- ✅ Etiquetas cerca de sus nodos originales cuando es posible

## 🐛 Si No Funciona

1. **Verifica que SmartLabels esté cargado:**
   ```javascript
   console.log(window.SmartLabels); // Debe mostrar un objeto
   ```

2. **Verifica que hay marcadores:**
   ```javascript
   let count = 0;
   map.eachLayer(layer => {
       if (layer instanceof L.Marker || layer instanceof L.CircleMarker) count++;
   });
   console.log('Marcadores totales:', count);
   ```

3. **Revisa la consola** para mensajes de error

## ⏭️ Próximo Paso Recomendado

Una vez que confirmes que funciona con la activación manual, podemos integrarlo permanentemente en el código para que se active automáticamente cuando se cargue este mapa específico.

¿Quieres probarlo primero con la activación manual?
