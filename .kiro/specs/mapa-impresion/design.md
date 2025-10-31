# Documento de Diseño

## Visión General

La funcionalidad de exportación de mapas permitirá a los usuarios generar archivos PDF y PNG de alta calidad del mapa actual. La solución utilizará bibliotecas JavaScript especializadas para capturar el canvas del mapa Leaflet y convertirlo a los formatos requeridos, manteniendo la calidad visual y toda la información contextual.

## Arquitectura

### Componentes Principales

1. **Módulo de Exportación (MapExporter)**
   - Coordina el proceso de captura y exportación
   - Maneja la configuración de opciones de exportación
   - Gestiona el estado durante el proceso

2. **Capturador de Canvas (CanvasCapture)**
   - Captura el contenido visual del mapa Leaflet
   - Maneja la sincronización de tiles y marcadores
   - Asegura la calidad de la imagen capturada

3. **Generador de PDF (PDFGenerator)**
   - Convierte la imagen capturada a formato PDF
   - Añade metadatos y información contextual
   - Maneja diferentes tamaños de página

4. **Procesador de PNG (PNGProcessor)**
   - Optimiza la imagen para formato PNG
   - Ajusta resolución y calidad
   - Maneja la compresión

5. **Interfaz de Usuario (ExportUI)**
   - Botones de exportación en la barra de herramientas
   - Modal de configuración de opciones
   - Indicadores de progreso y mensajes

## Componentes y Interfaces

### Bibliotecas Externas Requeridas

```javascript
// Para captura de mapas Leaflet
import 'leaflet-image'; // o alternativa: html2canvas

// Para generación de PDF
import jsPDF from 'jspdf';

// Para manejo de imágenes
// Canvas API nativo del navegador
```

### Estructura de Clases

```javascript
class MapExporter {
  constructor(map, options = {}) {
    this.map = map;
    this.options = {
      defaultFormat: 'png',
      defaultSize: 'A4',
      defaultDPI: 300,
      includeMetadata: true,
      ...options
    };
  }

  async exportToPDF(customOptions = {}) { }
  async exportToPNG(customOptions = {}) { }
  showExportDialog() { }
}

class ExportConfiguration {
  constructor() {
    this.format = 'png';
    this.size = 'A4';
    this.dpi = 300;
    this.includeScale = true;
    this.includeLegend = true;
    this.includeAttribution = true;
  }
}
```

### Integración con el Código Existente

La funcionalidad se integrará en el archivo `index.html` existente:

1. **Ubicación de Botones**: Se añadirán en la sección `.toolbar-group` junto a "Actualizar datos"
2. **Inicialización**: Se creará después de la inicialización del mapa Leaflet
3. **Estilos**: Se utilizarán las clases CSS existentes para mantener consistencia visual

## Modelos de Datos

### Configuración de Exportación

```javascript
const ExportConfig = {
  format: 'pdf' | 'png',
  size: {
    preset: 'A4' | 'A3' | 'Letter' | 'custom',
    width: number,    // en píxeles
    height: number,   // en píxeles
    dpi: number      // 150, 300, 600
  },
  elements: {
    includeScale: boolean,
    includeLegend: boolean,
    includeAttribution: boolean,
    includeTimestamp: boolean,
    includeTitle: boolean
  },
  metadata: {
    title: string,
    author: string,
    subject: string,
    creator: 'SNIEn - SENER'
  }
}
```

### Metadatos del Mapa

```javascript
const MapMetadata = {
  timestamp: Date,
  baseLayer: string,
  selectedInstrument: string,
  selectedPlan: string,
  zoomLevel: number,
  center: {lat: number, lng: number},
  bounds: {
    north: number,
    south: number,
    east: number,
    west: number
  },
  markersCount: number
}
```

## Manejo de Errores

### Tipos de Errores Esperados

1. **Errores de Captura**
   - Tiles no cargados completamente
   - Problemas de conectividad con MapTiler
   - Canvas demasiado grande para el navegador

2. **Errores de Generación**
   - Memoria insuficiente para imágenes grandes
   - Formatos no soportados por el navegador
   - Fallos en la biblioteca jsPDF

3. **Errores de Descarga**
   - Bloqueo de descargas por el navegador
   - Espacio insuficiente en disco
   - Permisos de archivo

### Estrategias de Recuperación

```javascript
class ErrorHandler {
  static async handleCaptureError(error) {
    if (error.type === 'TILES_NOT_LOADED') {
      // Esperar y reintentar
      await this.waitForTiles();
      return this.retryCapture();
    }
    // Mostrar error al usuario con sugerencias
  }

  static handleMemoryError(error) {
    // Reducir resolución automáticamente
    // Sugerir configuración más pequeña
  }
}
```

## Estrategia de Pruebas

### Pruebas Unitarias

1. **Configuración de Exportación**
   - Validación de parámetros
   - Valores por defecto
   - Conversión de unidades

2. **Captura de Canvas**
   - Sincronización de tiles
   - Calidad de imagen
   - Manejo de marcadores

3. **Generación de Archivos**
   - Formato PDF correcto
   - Metadatos incluidos
   - Tamaños de archivo apropiados

### Pruebas de Integración

1. **Flujo Completo de Exportación**
   - PDF con diferentes mapas base
   - PNG con marcadores visibles
   - Configuraciones personalizadas

2. **Compatibilidad de Navegadores**
   - Chrome, Firefox, Safari, Edge
   - Dispositivos móviles
   - Diferentes resoluciones de pantalla

### Pruebas de Rendimiento

1. **Mapas con Muchos Marcadores**
   - Tiempo de captura
   - Uso de memoria
   - Calidad de imagen resultante

2. **Diferentes Resoluciones**
   - Exportación en alta resolución (600 DPI)
   - Tamaños de archivo generados
   - Tiempo de procesamiento

## Consideraciones de Implementación

### Rendimiento

1. **Optimización de Captura**
   - Esperar a que todos los tiles estén cargados
   - Usar requestAnimationFrame para sincronización
   - Implementar timeout para evitar bloqueos

2. **Gestión de Memoria**
   - Limpiar canvas temporales
   - Limitar resolución máxima
   - Procesar en chunks para archivos grandes

### Accesibilidad

1. **Controles de Interfaz**
   - Botones con etiquetas descriptivas
   - Soporte para navegación por teclado
   - Indicadores de progreso accesibles

2. **Mensajes de Estado**
   - Anuncios para lectores de pantalla
   - Mensajes de error claros
   - Confirmaciones de éxito

### Compatibilidad

1. **Navegadores Soportados**
   - Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
   - Detección de características (Canvas API, File API)
   - Fallbacks para navegadores antiguos

2. **Dispositivos Móviles**
   - Adaptación de interfaz para pantallas pequeñas
   - Limitaciones de memoria en dispositivos móviles
   - Optimización de tamaños de archivo