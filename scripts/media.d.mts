export function pngBuffer(width: number, height: number, painter: (x: number, y: number) => [number, number, number, number]): Buffer;
export function wavBuffer(seconds: number, freq: number, volume?: number): Buffer;
export function backgroundPainter(top: string, bottom: string, width: number, height: number): (x: number, y: number) => [number, number, number, number];
export function characterPainter(color: string, expression: string, width: number, height: number): (x: number, y: number) => [number, number, number, number];
export function makeSampleAssets(root: string, opts?: { big?: boolean }): Promise<string>;
