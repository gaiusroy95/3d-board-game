/** Tiny canvas texture for board labels (no external fonts/assets). */
export function createLabelTexture(text: string, options?: {
  width?: number;
  height?: number;
  fontSize?: number;
  color?: string;
  background?: string;
}): HTMLCanvasElement {
  const width = options?.width ?? 256;
  const height = options?.height ?? 64;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable for labels");
  }
  ctx.fillStyle = options?.background ?? "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = options?.color ?? "#f5f5f5";
  ctx.font = `600 ${options?.fontSize ?? 28}px "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2);
  return canvas;
}
