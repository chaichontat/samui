import saveAs from 'file-saver';
import Papa, { type ParseConfig, type ParseResult } from 'papaparse';

export type Url = { url: string; type: 'local' | 'network' };

export async function convertLocalToNetwork(
  handle: FileSystemDirectoryHandle,
  url: Url
): Promise<Url> {
  if (url.type === 'local') {
    return { url: URL.createObjectURL(await getFile(handle, url.url)), type: 'network' };
  }
  return url;
}

export async function getFile(handle: FileSystemDirectoryHandle, name: string) {
  return await handle.getFileHandle(name).then((fh) => fh.getFile());
}

export async function fromCSV<T>(str: string, options?: ParseConfig<T> | { download: boolean }) {
  let out: ParseResult<T> | undefined;
  let res: () => void;
  const promise: Promise<void> = new Promise((resolve) => (res = resolve));

  //@ts-ignore
  if (options?.download) {
    str = str.startsWith('http') || str.startsWith('blob') ? str : location.origin + str;
  }

  //@ts-ignore
  Papa.parse(str, {
    dynamicTyping: true,
    header: true,
    worker: true,
    delimiter: ',',
    skipEmptyLines: 'greedy',
    complete: (results: Papa.ParseResult<T>) => {
      out = results;
      res();
    },
    ...options
  });
  await promise;
  return out;
}

export function toCSV(name: string, obj: object[] | string) {
  if (!obj.length) return;
  console.log('toCSV', obj);

  if (typeof obj === 'string') {
    const blob = new Blob([obj], { type: 'text/csv' });
    saveAs(blob, name);
    return;
  }

  const key = Object.keys(obj[0]);
  const out = [key.join(',')];
  for (const o of obj) {
    //@ts-ignore
    out.push(key.map((k) => o[k]).join(','));
  }
  const blob = new Blob([out.join('\n')], { type: 'text/csv' });
  saveAs(blob, name);
}

export function toJSON(name: string, obj: object | any[] | string | number) {
  const regex = /"(-|)([0-9]+(?:\.[0-9]+)?)(e-?[0-9]+)?"/g;
  const s = JSON.stringify(obj).replace(regex, '$1$2$3');
  const blob = new Blob([s], {
    type: 'application/json'
  });
  saveAs(blob, name);
}

export async function getFileFromEvent({
  currentTarget
}: {
  currentTarget: EventTarget & HTMLInputElement;
}) {
  if (!currentTarget.files) return;
  return await currentTarget.files[0].text();
}
