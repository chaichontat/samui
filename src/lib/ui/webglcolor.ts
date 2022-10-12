export class WebGLColorFunc {
  static normalize(band: string) {
    return ['/', ['band', ['var', band]], ['var', `${band}Max`]];
  }

  static mask(band: ReturnType<typeof this.normalize>, mask: string) {
    return ['*', band, ['var', mask]];
  }

  static clamp(band: unknown[], min = 0, max = 1) {
    return ['clamp', band, min, max];
  }

  static add(...x: unknown[]): unknown[] {
    if (x.length === 1) return x[0];
    if (x.length === 2) return ['+', x[0], x[1]];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return ['+', this.add(...x.slice(0, x.length - 1)), x[x.length - 1]];
  }

  static genColors(bands: string[]) {
    const cs = ['red', 'green', 'blue'].map((rgb) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.clamp(this.add(...bands.map((b) => this.mask(this.normalize(b), `${b}${rgb}Mask`))))
    );
    return ['array', ...cs, 1];
  }
}
