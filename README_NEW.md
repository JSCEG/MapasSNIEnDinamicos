# Mapas SNIEn Dinámicos

Sistema de mapas dinámicos para el Sistema Nacional de Información Energética (SNIEn).

## Instrumentos Disponibles

### PLADESE
- Regiones y enlaces del SEN en 2025
- Red nacional de gasoductos en 2024
- Municipios con localidades sin electrificar
- Pronóstico regional del PIB
- Pronósticos del consumo bruto
- Adiciones de Capacidad (múltiples mapas)

### ELECTRICIDAD ✨ NUEVO
- **Permisos de Generación de Electricidad**
  - ~1000 permisos visualizados con clusters
  - Iconos personalizados de plantas de generación
  - Sistema de clusters tipo semáforo:
    - 🟢 Verde: < 10 elementos
    - 🟠 Ámbar: 10-100 elementos
    - 🔴 Rojo: > 100 elementos
  - Buscador por número de permiso
  - Información detallada: capacidad, tecnología, fuente de energía, etc.

## Características Técnicas

- **Clusters inteligentes**: Agrupación automática de marcadores con colores semáforo
- **Búsqueda en tiempo real**: Encuentra permisos específicos al escribir
- **Z-index optimizado**: Marcadores siempre visibles sobre capas de regiones
- **Iconos personalizados**: Iconos SVG institucionales
- **Datos en tiempo real**: Integración con Google Sheets
- **Exportación**: PDF y PNG de alta calidad

## Cómo usar

1. Abre `index.html` en un navegador
2. Selecciona un instrumento (PLADESE, ELECTRICIDAD, etc.)
3. Elige el mapa específico
4. Interactúa con el mapa:
   - Haz zoom y pan
   - Haz clic en clusters para expandir
   - Haz clic en marcadores para ver detalles
   - Usa el buscador (si está disponible)
   - Exporta a PDF o PNG

## Estructura del Proyecto

```
├── index.html              # Aplicación principal
├── css/
│   └── main.css           # Estilos (incluye clusters semáforo)
├── js/
│   ├── map-config.js      # Configuración de mapas
│   ├── export-ui.js       # Sistema de exportación
│   └── ...
└── img/                   # Logos institucionales
```

## Tecnologías

- Leaflet 1.9.4
- Leaflet MarkerCluster 1.5.3
- MapTiler SDK
- PapaParse (CSV)
- jsPDF (Exportación PDF)
- html2canvas (Exportación PNG)

## Próximos Mapas

- GAS NATURAL
- GAS L.P.
- PETROLIFEROS
- PLADESHI
- PLATEASE
- PROSENER

---

**Secretaría de Energía - Sistema Nacional de Información Energética**
