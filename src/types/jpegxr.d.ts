declare module 'jpegxr' {
  type JpegXrPixelInfo = {
    bgr: boolean;
    bitsPerPixel: number;
    channels: number;
    colorFormat: string;
    hasAlpha: boolean;
    premultipledAlpha: boolean;
  };

  type JpegXrDecodedImage = {
    bytes: Uint8Array;
    height: number;
    pixelInfo: JpegXrPixelInfo;
    width: number;
  };

  type JpegXrCodec = {
    decode(bytes: Uint8Array): JpegXrDecodedImage;
  };

  export default function jpegxr(): Promise<JpegXrCodec>;
}
