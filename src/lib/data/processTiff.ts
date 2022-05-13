import GeoTIFF, { fromArrayBuffer, fromBlob, fromUrl, fromUrls } from 'geotiff';

export async function process(f: File) {
  const tif = await fromArrayBuffer(await f.arrayBuffer());
  console.log(tif);
}
