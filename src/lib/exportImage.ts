import { toPng } from 'html-to-image';

export async function exportElementAsPng(
  element: HTMLElement,
  filename: string = 'chart.png'
): Promise<void> {
  try {
    const dataUrl = await toPng(element, {
      backgroundColor: '#0f172a',
      quality: 1.0,
      pixelRatio: 2,
    });
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Failed to export image:', err);
    throw err;
  }
}
