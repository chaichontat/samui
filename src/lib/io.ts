import Papa, { type ParseConfig, type ParseResult } from 'papaparse';

function download(name: string, blob: Blob) {
  const elem = window.document.createElement('a');
  elem.href = window.URL.createObjectURL(blob);
  elem.download = name;
  document.body.appendChild(elem);
  elem.click();
  document.body.removeChild(elem);
}

export async function fromCSV<T>(url: string, options?: ParseConfig<T>) {
  let out: ParseResult<T> | undefined;
  let res: () => void;
  const promise: Promise<void> = new Promise((resolve) => (res = resolve));

  Papa.parse(url, {
    download: true,
    dynamicTyping: true,
    header: true,
    skipEmptyLines: 'greedy',
    complete: (results: Papa.ParseResult<T>) => {
      out = results;
      res();
    },
    ...options
  });
  await promise;
  console.log(url, out);
  return out;
}

export function toCSV(name: string, obj: object[] | string) {
  if (!obj.length) return;

  if (typeof obj === 'string') {
    const blob = new Blob([obj], { type: 'text/csv' });
    download(name, blob);
    return;
  }

  const key = Object.keys(obj[0]);
  const out = [key.join(',')];
  for (const o of obj) {
    out.push(key.map((k) => o[k]).join(','));
  }
  const blob = new Blob([out.join('\n')], { type: 'text/csv' });
  download(name, blob);
}

export function toJSON(name: string, obj: object | any[] | string | number) {
  const blob = new Blob([JSON.stringify(obj)], {
    type: 'application/json'
  });
  download(name, blob);
}

export async function getFileInput(currentTarget: EventTarget & HTMLInputElement) {
  if (!currentTarget.files) return;
  return await currentTarget.files[0].text();
}
