import pako from 'pako';

export function chunk(objs: any[]) {
  const ptr = new Uint32Array(objs.length + 1);
  let curr = 0;
  let out = new Uint8Array(1048576);

  for (const [i, obj] of objs.entries()) {
    if (obj) {
      const comp = pako.gzip(JSON.stringify(obj));
      if (curr + comp.length > out.length) {
        // Double the size of the buffer if it's too small
        const x = new Uint8Array(out.length * 2);
        x.set(out);
        out = x;
      }
      out.set(comp, curr);
      curr += comp.length;
    }
    ptr[i + 1] = curr;
  }
  return { ptr, bytes: out.slice(0, ptr.at(-1)) };
}
