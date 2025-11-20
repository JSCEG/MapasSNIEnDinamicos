# Sistema de Etiquetas Inteligentes - Guía de Implementación

## 📋 Descripción

El sistema de etiquetas inteligentes (`smart-labels.js`) proporciona:

1. ✅ **Detección automática de colisiones** entre etiquetas de nodos
2. ✅ **Reposicionamiento inteligente** usando algoritmo force-directed
3. ✅ **Leader lines automáticas** (líneas de conexión) cuando las etiquetas se alejan de sus nodos
4. ✅ **Actualización dinámica** en zoom y pan del mapa

## 🚀 Cómo Usar

### Paso 1: El script ya está cargado en index.html

```html
<script src="js/smart-labels.js"></script>
```

### Paso 2: Inicializar después de crear los marcadores de nodos

Después de crear tus marcadores de nodos en el mapa, llama a:

```javascript
// Ejemplo: Después de agregar todos los nodos al mapa
const nodeMarkers = []; // Array con todos tus marcadores de nodos

// Inicializar el sistema de etiquetas inteligentes
if (window.SmartLabels) {
    window.SmartLabels.initialize(map, nodeMarkers);
}
```

### Paso 3: Actualizar cuando el mapa cambie (opcional)

Si quieres que las etiquetas se reposicionen cuando el usuario hace zoom o pan:

```javascript
map.on('zoomend moveend', function() {
    if (window.SmartLabels && window.SmartLabels.isInitialized()) {
        window.SmartLabels.update(map);
    }
});
```

### Paso 4: Limpiar al cambiar de mapa

Cuando el usuario cambia a otro mapa:

```javascript
if (window.SmartLabels && window.SmartLabels.isInitialized()) {
    window.SmartLabels.cleanup(map);
}
```

## 🔧 Configuración

Puedes ajustar la configuración en `smart-labels.js`:

```javascript
const CONFIG = {
    labelPadding: 5,           // Padding alrededor de cada etiqueta
    minDistance: 20,           // Distancia mínima entre etiquetas
    leaderLineColor: '#1f7a62', // Color de las líneas de conexión
    leaderLineWidth: 1.5,      // Grosor de las líneas
    leaderLineDash: [3, 3],    // Patrón de línea punteada
    maxIterations: 50,         // Iteraciones máximas del algoritmo
    forceStrength: 0.3,        // Fuerza de repulsión entre etiquetas
    anchorForce: 0.1           // Fuerza de atracción hacia el nodo original
};
```

## 📝 Ejemplo Completo

```javascript
// En la función que carga el mapa "Regiones y enlaces del SEN en 2025"
async function loadSENRegionsMap(mapConfig) {
    // ... código existente para cargar el mapa ...
    
    // Crear array para almacenar marcadores de nodos
    const nodeMarkers = [];
    
    // Ejemplo: Crear marcadores de nodos
    nodesData.forEach(node => {
        const marker = L.circleMarker([node.lat, node.lng], {
            radius: 3,
            fillColor: '#1f7a62',
            color: '#ffffff',
            weight: 1,
            fillOpacity: 0.9
        });
        
        // Agregar tooltip con el número del nodo
        marker.bindTooltip(node.id.toString(), {
            permanent: true,
            direction: 'center',
            className: 'node-label'
        });
        
        marker.addTo(map);
        nodeMarkers.push(marker);
    });
    
    // Inicializar sistema de etiquetas inteligentes
    if (window.SmartLabels) {
        window.SmartLabels.initialize(map, nodeMarkers);
        
        // Actualizar en zoom/pan
        map.on('zoomend moveend', function() {
            window.SmartLabels.update(map);
        });
    }
}
```

## 🎨 Estilos CSS

Las leader lines se crean dinámicamente y no requieren CSS adicional.
Las etiquetas de nodos usan la clase `.node-label` que ya está definida en `main.css`.

## 🐛 Troubleshooting

### Las etiquetas no se reposicionan
- Verifica que los marcadores tengan tooltips permanentes
- Asegúrate de que `window.SmartLabels` esté definido
- Revisa la consola para mensajes de debug

### Las leader lines no aparecen
- Las líneas solo aparecen cuando una etiqueta se aleja más de 15px de su nodo original
- Verifica que el algoritmo esté detectando colisiones

### Performance lento
- Reduce `maxIterations` en la configuración
- Considera no actualizar en cada `moveend`, solo en `zoomend`

## 📊 Logs de Debug

El sistema imprime logs útiles en la consola:

```
🎯 Inicializando sistema de etiquetas inteligentes...
🔄 Iniciando reposicionamiento de X etiquetas...
✅ Reposicionamiento completado en Y iteraciones
📊 Etiquetas con leader lines: Z
```

## 🔄 Estado Actual

- ✅ Sistema creado e integrado en el HTML
- ⏳ **PENDIENTE**: Integrar con la función que carga los nodos del mapa SEN
- ⏳ **PENDIENTE**: Identificar dónde se crean los marcadores de nodos actualmente

## 📞 Próximos Pasos

1. Encontrar la función que carga los nodos en el mapa "Regiones y enlaces del SEN en 2025"
2. Modificar esa función para recopilar los marcadores en un array
3. Llamar a `SmartLabels.initialize()` después de crear todos los marcadores
4. Probar y ajustar la configuración según sea necesario
