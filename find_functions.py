import re

with open('js/map-config.js', 'r', encoding='utf-8') as f:
    content = f.read()
    lines = content.split('\n')
    
# Search for highlighting functions
functions = ['showStatesLayer', 'showGCRLayer', 'filterElectricity', 'hideGeometryLayers']

for func in functions:
    print(f"\n=== Searching for: {func} ===")
    found = False
    for i, line in enumerate(lines, 1):
        if func in line:
            found = True
            start = max(0, i-2)
            end = min(len(lines), i+5)
            print(f"\nFound at line {i}:")
            for j in range(start, end):
                marker = ">>>" if j == i-1 else "   "
                print(f"{marker} {j+1}: {lines[j]}")
    
    if not found:
        print(f"NOT FOUND in file")
