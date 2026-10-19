import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const out = 'dist';
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const archiveName = `supersurf-v${manifest.version}.zip`;
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp('manifest.json', join(out, 'manifest.json'));
await cp('src', join(out, 'src'), { recursive: true });
await cp('assets', join(out, 'assets'), { recursive: true });

const files = await collectFiles(out);
await writeFile(join(out, archiveName), createZip(files));

console.log(`Built unpacked extension in ${out}/`);
console.log(`Created release archive ${join(out, archiveName)} with manifest.json at its root.`);

async function collectFiles(root, current = root) {
  const entries = (await readdir(current, { withFileTypes: true }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const files = [];

  for (const entry of entries) {
    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(root, fullPath));
    } else if (entry.isFile() && !entry.name.endsWith('.zip')) {
      files.push({
        name: relative(root, fullPath).split(sep).join('/'),
        data: await readFile(fullPath)
      });
    }
  }
  return files;
}

// The archive uses the ZIP "store" method so the build remains dependency-free
// and works the same way on Windows, macOS and Linux.
function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const data = file.data;
    const checksum = crc32(data);
    const localHeader = Buffer.concat([
      u32(0x04034b50),
      u16(20), u16(0), u16(0), u16(0), u16(0x21),
      u32(checksum), u32(data.length), u32(data.length),
      u16(name.length), u16(0), name
    ]);
    localParts.push(localHeader, data);

    centralParts.push(Buffer.concat([
      u32(0x02014b50),
      u16(20), u16(20), u16(0), u16(0), u16(0), u16(0x21),
      u32(checksum), u32(data.length), u32(data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name
    ]));
    offset += localHeader.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.concat([
    u32(0x06054b50),
    u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralDirectory.length), u32(offset), u16(0)
  ]);
  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
