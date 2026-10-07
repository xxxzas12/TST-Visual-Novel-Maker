// Test helper: rewrites the family name of a TrueType/OpenType font so tests get a font whose
// name exists nowhere on the system (proves TSTVN loads imported files without Windows installing them).

function checksum(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i += 4) sum = (sum + buf.readUInt32BE(i)) >>> 0;
  return sum;
}

function nameTable(family) {
  const recs = [
    [1, family],
    [2, 'Regular'],
    [4, family],
    [6, family.replace(/[^A-Za-z0-9-]/g, '')],
    [16, family],
  ];
  const strings = recs.map(([, s]) => Buffer.from(s, 'utf16le').swap16());
  const header = Buffer.alloc(6 + recs.length * 12);
  header.writeUInt16BE(0, 0);
  header.writeUInt16BE(recs.length, 2);
  header.writeUInt16BE(header.length, 4);
  let off = 0;
  recs.forEach(([id], i) => {
    const r = 6 + i * 12;
    header.writeUInt16BE(3, r); // Windows
    header.writeUInt16BE(1, r + 2); // Unicode BMP
    header.writeUInt16BE(0x409, r + 4); // en-US
    header.writeUInt16BE(id, r + 6);
    header.writeUInt16BE(strings[i].length, r + 8);
    header.writeUInt16BE(off, r + 10);
    off += strings[i].length;
  });
  return Buffer.concat([header, ...strings]);
}

/** Returns a copy of a single-font file (.ttf/.otf) whose family name is `family`. */
export function renameFontFamily(src, family) {
  const numTables = src.readUInt16BE(4);
  let rec = -1;
  for (let i = 0; i < numTables; i++) {
    if (src.toString('ascii', 12 + i * 16, 16 + i * 16) === 'name') rec = 12 + i * 16;
  }
  if (rec < 0) throw new Error('font has no name table');
  const table = nameTable(family);
  const padded = Buffer.alloc(Math.ceil(table.length / 4) * 4);
  table.copy(padded);
  const base = Buffer.alloc(Math.ceil(src.length / 4) * 4);
  src.copy(base);
  const out = Buffer.concat([base, padded]);
  out.writeUInt32BE(checksum(padded), rec + 4);
  out.writeUInt32BE(base.length, rec + 8);
  out.writeUInt32BE(table.length, rec + 12);
  return out;
}
