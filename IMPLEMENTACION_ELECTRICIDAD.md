# Implementación del Mapa de Electricidad - Documentación Técnica

## Resumen

Se ha implementado el primer mapa de ELECTRICIDAD con visualización de ~1000 permisos de generación eléctrica usando clusters tipo semáforo y búsqueda en tiempo real.

---

## 🎯 Características Implementadas

### 1. Sistema de Clusters Semáforo
Los clusters cambian de color según la cantidad de elementos:
- **Verde** (RGB: 76, 175, 80): Menos elementos (< 10)
- **Ámbar** (RGB: 255, 152, 0): Cantidad media (10-100)
- **Rojo** (RGB: 244, 67, 54): Muchos elementos (> 100)

### 2. Icono Personalizado
- URL: `https://cdn.sassoapps.com/iconos_snien/planta_generacion.png`
- Tamaño: 32x32 píxeles
- Anchor: Centro del icono (16, 16)
- Popup anchor: Arriba del icono (0, -16)

### 3. Buscador por Número de Permiso
- Búsqueda en tiempo real mientras se escribe
- Centra el mapa automáticamente
- Abre el popup del permiso encontrado
- Timeout de 300ms para esperar animación del cluster

### 4. Z-Index Optimizado
Se creó un nuevo pane `electricityMarkersPane` con z-index 630:
```
Capas de abajo hacia arriba:
400 - municipalitiesPane
600 - gerenciasPane (default)
610 - connectionsPane
620 - nodesPane
630 - electricityMarkersPane ← NUEVO
```

---

## 📝 Archivos Modificados

### 1. `index.html`
**Cambios:**
- Agregado Leaflet MarkerCluster CSS
- Agregado Leaflet MarkerCluster JS
- Agregado campo de búsqueda en toolbar

```html
<!-- CSS -->
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />

<!-- JS -->
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>

<!-- Search Field -->
<div class="toolbar-group" id="search-group" style="display: none;">
    <label for="permit-search">Buscar permiso</label>
    <input type="text" id="permit-search" class="control" placeholder="Número de permiso">
</div>
```

### 2. `js/map-config.js`

#### A. Variables Globales Agregadas
```javascript
let markersClusterGroup = null;
let electricityPermitsData = [];
```

#### B. Nuevo Pane para Marcadores
```javascript
map.createPane('electricityMarkersPane');
const electricityMarkersPane = map.getPane('electricityMarkersPane');
if (electricityMarkersPane) {
    electricityMarkersPane.style.zIndex = 630;
    electricityMarkersPane.style.pointerEvents = 'auto';
}
```

#### C. Configuración del Mapa de ELECTRICIDAD
```javascript
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
        description: 'Mapa de permisos de generación de electricidad en México...'
    }
]
```

#### D. Nueva Función: `drawElectricityPermits(rows)`
Características:
- Crea icono personalizado con `L.icon()`
- Configura cluster group con `iconCreateFunction` personalizada
- Usa pane `electricityMarkersPane`
- Almacena datos del permiso en cada marcador

#### E. Función de Búsqueda
```javascript
permitSearchInput.addEventListener('input', function() {
    const searchTerm = this.value.trim().toUpperCase();
    // Busca en todos los marcadores del cluster
    // Centra el mapa y abre popup cuando encuentra
});
```

#### F. Modificación de `clearData()`
Ahora limpia también los clusters:
```javascript
if (markersClusterGroup) {
    map.removeLayer(markersClusterGroup);
    markersClusterGroup = null;
}
electricityPermitsData = [];
```

#### G. Modificación de `loadAndRender()`
Detecta si debe usar clusters:
```javascript
if (mapConfig && mapConfig.useClusters) {
    drawElectricityPermits(parsed.data);
} else {
    drawRows(parsed.data, mapConfig);
}
```

### 3. `css/main.css`

#### Estilos de Clusters Semáforo
```css
/* Verde - Menos elementos */
.marker-cluster-small {
    background-color: rgba(76, 175, 80, 0.5);
}
.marker-cluster-small div {
    background-color: rgba(76, 175, 80, 0.8);
}

/* Ámbar - Medio */
.marker-cluster-medium {
    background-color: rgba(255, 152, 0, 0.5);
}
.marker-cluster-medium div {
    background-color: rgba(255, 152, 0, 0.8);
}

/* Rojo - Muchos */
.marker-cluster-large {
    background-color: rgba(244, 67, 54, 0.5);
}
.marker-cluster-large div {
    background-color: rgba(244, 67, 54, 0.8);
}
```

#### Estilos del Campo de Búsqueda
```css
#search-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

#permit-search {
    min-width: 150px;
}
```

---

## 📊 Estructura de Datos CSV

Campos utilizados del CSV:
- `NumeroPermiso` - Identificador único
- `EfId` - Estado
- `MpoId` - Municipio
- `RazonSocial` - Empresa/titular
- `FechaOtorgamiento` - Fecha
- `lat`, `lon` - Coordenadas
- `Estatus` - Estado del permiso
- `TipoPermiso` - Tipo (GEN, etc.)
- `CapacidadAutorizadaMW` - Capacidad
- `Tecnología` - Tipo de generación
- `FuenteEnergía` - Fuente (Renovable, etc.)

---

## 🔄 Flujo de Operación

1. **Selección del Mapa**
   - Usuario selecciona "ELECTRICIDAD" → "Permisos de Generación"
   - Se muestra el campo de búsqueda
   - Se carga el GeoJSON de gerencias

2. **Carga de Datos**
   - Fetch del CSV desde Google Sheets
   - Parse con PapaParse
   - Detección de `useClusters: true`
   - Llamada a `drawElectricityPermits()`

3. **Renderizado**
   - Se crea icono personalizado
   - Se crea cluster group con función custom
   - Se iteran todos los permisos
   - Se crean marcadores con icono y popup
   - Se agrega cluster group al mapa en pane especial

4. **Búsqueda**
   - Usuario escribe en campo de búsqueda
   - Se busca en `markersClusterGroup`
   - Se centra mapa en coordenadas
   - Se espera 300ms para animación
   - Se abre popup del permiso

---

## 🎨 Paleta de Colores

### Clusters Semáforo
- **Verde**: `rgba(76, 175, 80, 0.8)` - #4CAF50
- **Ámbar**: `rgba(255, 152, 0, 0.8)` - #FF9800
- **Rojo**: `rgba(244, 67, 54, 0.8)` - #F44336

### Institucionales (texto)
- **Verde Profundo**: #1f7a62
- **Guinda**: #601623

---

## ✅ Testing

Para probar la implementación:

1. Abrir `test_electricity.html` para ver instrucciones
2. Abrir `index.html`
3. Click en "Comenzar"
4. Seleccionar "ELECTRICIDAD"
5. Seleccionar "Permisos de Generación de Electricidad"
6. Verificar:
   - ✓ Clusters con colores semáforo
   - ✓ Iconos de planta en marcadores individuales
   - ✓ Marcadores sobre gerencias (no debajo)
   - ✓ Campo de búsqueda visible
   - ✓ Búsqueda funcional
   - ✓ Popups con información completa

---

## 🚀 Próximos Pasos

Mapas pendientes con configuración similar:
- GAS NATURAL
- GAS L.P.
- PETROLIFEROS

---

**Fecha de Implementación**: 10 de Noviembre, 2025  
**Versión**: 1.0.0  
**Desarrollador**: Sistema SNIEn
