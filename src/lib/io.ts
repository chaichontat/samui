import saveAs from 'file-saver';
import type { ParseConfig, ParseResult } from 'papaparse';

type PapaparseInstance = (typeof import('papaparse'))['default'];

let papaparsePromise: Promise<PapaparseInstance> | null = null;

async function loadPapaparse() {
  if (!papaparsePromise) {
    papaparsePromise = import('papaparse').then((module) => module.default);
  }
  return papaparsePromise;
}

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
  return await handle
    .getFileHandle(name)
    .then((fh) => fh.getFile())
    .catch(() => alert(`Cannot get file ${name}`));
}

type CsvParseOptions<T> = ParseConfig<T> & { download?: boolean };

export async function fromCSV<T>(str: string, options?: CsvParseOptions<T>) {
  const Papa = await loadPapaparse();

  if (options?.download && !str.startsWith('http') && !str.startsWith('blob')) {
    str = location.origin + str;
  }

  return await new Promise<ParseResult<T> | undefined>((resolve) => {
    Papa.parse(str, {
      dynamicTyping: true,
      worker: true,
      delimiter: ',',
      skipEmptyLines: 'greedy',
      ...options,
      complete: (results) => resolve(results),
      error: (error) => {
        console.error('Failed to parse CSV', error);
        resolve(undefined);
      }
    });
  });
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
