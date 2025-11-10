"""
Script de verificación de la implementación del mapa de electricidad
"""

import os
import re

def check_file_exists(filepath, description):
    """Verifica si un archivo existe"""
    exists = os.path.exists(filepath)
    status = "✓" if exists else "✗"
    print(f"{status} {description}: {filepath}")
    return exists

def check_string_in_file(filepath, search_string, description):
    """Verifica si una cadena existe en un archivo"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            found = search_string in content
            status = "✓" if found else "✗"
            print(f"{status} {description}")
            return found
    except Exception as e:
        print(f"✗ Error leyendo {filepath}: {e}")
        return False

def main():
    print("=" * 60)
    print("VERIFICACIÓN DE IMPLEMENTACIÓN - MAPA DE ELECTRICIDAD")
    print("=" * 60)
    print()
    
    base_path = r"C:\Proyectos\38.-Mapas Dinamicos SNIEn"
    
    # Verificar archivos principales
    print("1. Archivos principales:")
    print("-" * 60)
    check_file_exists(os.path.join(base_path, "index.html"), "index.html")
    check_file_exists(os.path.join(base_path, "js", "map-config.js"), "map-config.js")
    check_file_exists(os.path.join(base_path, "css", "main.css"), "main.css")
    check_file_exists(os.path.join(base_path, "test_electricity.html"), "test_electricity.html")
    check_file_exists(os.path.join(base_path, "IMPLEMENTACION_ELECTRICIDAD.md"), "Documentación técnica")
    print()
    
    # Verificar inclusión de Leaflet MarkerCluster en HTML
    print("2. Leaflet MarkerCluster en index.html:")
    print("-" * 60)
    html_path = os.path.join(base_path, "index.html")
    check_string_in_file(html_path, "leaflet.markercluster", "Plugin MarkerCluster CSS")
    check_string_in_file(html_path, "leaflet.markercluster.js", "Plugin MarkerCluster JS")
    check_string_in_file(html_path, 'id="permit-search"', "Campo de búsqueda")
    check_string_in_file(html_path, 'id="search-group"', "Grupo de búsqueda")
    print()
    
    # Verificar configuración en map-config.js
    print("3. Configuración en map-config.js:")
    print("-" * 60)
    js_path = os.path.join(base_path, "js", "map-config.js")
    check_string_in_file(js_path, "ELECTRICIDAD", "Sección ELECTRICIDAD")
    check_string_in_file(js_path, "Permisos de Generación de Electricidad", "Nombre del mapa")
    check_string_in_file(js_path, "useClusters: true", "Configuración de clusters")
    check_string_in_file(js_path, "enableSearch: true", "Habilitación de búsqueda")
    check_string_in_file(js_path, "drawElectricityPermits", "Función de dibujado")
    check_string_in_file(js_path, "electricityMarkersPane", "Pane de marcadores")
    check_string_in_file(js_path, "planta_generacion.png", "Icono personalizado")
    check_string_in_file(js_path, "permitSearchInput", "Listener de búsqueda")
    print()
    
    # Verificar estilos en main.css
    print("4. Estilos en main.css:")
    print("-" * 60)
    css_path = os.path.join(base_path, "css", "main.css")
    check_string_in_file(css_path, "marker-cluster-small", "Cluster pequeño (verde)")
    check_string_in_file(css_path, "marker-cluster-medium", "Cluster mediano (ámbar)")
    check_string_in_file(css_path, "marker-cluster-large", "Cluster grande (rojo)")
    check_string_in_file(css_path, "76, 175, 80", "Color verde")
    check_string_in_file(css_path, "255, 152, 0", "Color ámbar")
    check_string_in_file(css_path, "244, 67, 54", "Color rojo")
    check_string_in_file(css_path, "#search-group", "Estilos de búsqueda")
    print()
    
    # Verificar URL del CSV
    print("5. Integración con Google Sheets:")
    print("-" * 60)
    csv_url = "2PACX-1vTuFBY3k10223uLmvRWSycRyAea6NjtKVLTHuTnpFMQZgWyxoCqwbXNNjTSY9nTleUoxKDtuuP_bbtn"
    check_string_in_file(js_path, csv_url, "URL del CSV de permisos")
    print()
    
    print("=" * 60)
    print("VERIFICACIÓN COMPLETADA")
    print("=" * 60)
    print()
    print("Siguiente paso: Abrir index.html en el navegador y probar:")
    print("  1. Seleccionar ELECTRICIDAD")
    print("  2. Seleccionar Permisos de Generación de Electricidad")
    print("  3. Verificar clusters de colores (verde, ámbar, rojo)")
    print("  4. Verificar iconos de planta en marcadores")
    print("  5. Probar búsqueda de permisos")
    print()

if __name__ == "__main__":
    main()
