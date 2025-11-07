import re

with open('js/map-config.js', 'r', encoding='utf-8') as f:
    content = f.read()
    lines = content.split('\n')
    
print(f"Total lines: {len(lines)}\n")

# Search for welcome-related code
for i, line in enumerate(lines, 1):
    if 'welcome' in line.lower():
        start = max(0, i-3)
        end = min(len(lines), i+3)
        print(f"Found at line {i}:")
        for j in range(start, end):
            marker = ">>>" if j == i-1 else "   "
            print(f"{marker} {j+1}: {lines[j]}")
        print()
