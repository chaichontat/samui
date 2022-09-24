function getSampleList(winlocsearch: string) {
  const params = new URLSearchParams(winlocsearch);
  const url = params.get('url');
  const s = params.getAll('s');
  return s.map((ss) => `https://${url ?? ''}${ss}`);
}
