import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
const out = 'dist';
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp('manifest.json', join(out, 'manifest.json'));
await cp('src', join(out, 'src'), { recursive: true });
await cp('assets', join(out, 'assets'), { recursive: true });
console.log(`Built unpacked extension in ${out}/`);
