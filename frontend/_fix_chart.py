from pathlib import Path
p = Path('src/components/ChartSection.tsx')
s = p.read_text(encoding='utf-8')
old = '''            className={`px-2 py-1 rounded transition-colors ${
              interval === item
                ? 'bg-[#2B3139] text-[#F0B90B] font-bold'
                : 'text-[#848E9C] hover:text-[#EAECEF]'}
          >'''
new = '''            className={interval === item
              ? 'bg-[#2B3139] text-[#F0B90B] font-bold'
              : 'text-[#848E9C] hover:text-[#EAECEF']
          >'''
print('old found:', old in s)
if old in s:
    s = s.replace(old, new)
    p.write_text(s, encoding='utf-8')
    print('written')
else:
    print('not found; first 200 chars after marker:')
    i = s.find('px-2 py-1 rounded transition-colors')
    print(repr(s[i:i+200]))
