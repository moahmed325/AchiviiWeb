/**
 * The first-step share card as a 1200×630 PNG (the size X and LinkedIn show in full). Drawn on a canvas from the
 * app's own tokens, read from the page at the moment of drawing, so the image matches the card on screen.
 */
export const SHARE_CARD_SIZE = { width: 1200, height: 630 };

interface ShareCardInput {
  goalText: string;
  dayNumber: number;
  site: string;
}

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Splits `text` into at most `maxLines` lines that fit `width`, ending with an ellipsis if it had to stop early. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  const words = text.split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i += 1) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= width || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = words[i];
    if (lines.length === maxLines - 1) {
      let rest = words.slice(i).join(' ');
      while (rest.length > 1 && ctx.measureText(`${rest}…`).width > width) rest = rest.slice(0, -1);
      lines.push(rest === words.slice(i).join(' ') ? rest : `${rest.trimEnd()}…`);
      return lines;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderShareCard({ goalText, dayNumber, site }: ShareCardInput): Promise<Blob> {
  const { width, height } = SHARE_CARD_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  await document.fonts?.ready;

  const background = token('--color-background');
  const text = token('--color-text');
  const secondary = token('--color-text-secondary');
  const gold = token('--color-achievement');
  const line = token('--color-border-strong');
  const sans = token('--font-ui');
  const mono = token('--font-ui-mono');
  const pad = 88;

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = gold;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, width - 48, height - 48);
  ctx.globalAlpha = 1;

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = text;
  ctx.font = `600 30px ${sans}`;
  ctx.fillText('Achivii', pad, pad + 20);

  ctx.fillStyle = gold;
  ctx.font = `500 26px ${mono}`;
  ctx.fillText(`DAY ${dayNumber} OF 90`, pad, 228);

  ctx.fillStyle = text;
  ctx.font = `600 64px ${sans}`;
  wrap(ctx, goalText.trim(), width - pad * 2, 2).forEach((l, i) => ctx.fillText(l, pad, 312 + i * 76));

  // The 90 days as a line, lit up to this day.
  const lineY = 478;
  const lineEnd = width - pad;
  ctx.fillStyle = line;
  ctx.fillRect(pad, lineY - 1, lineEnd - pad, 2);
  const reached = pad + Math.max(18, ((lineEnd - pad) * dayNumber) / 90);
  ctx.fillStyle = gold;
  ctx.fillRect(pad, lineY - 1.5, reached - pad, 3);
  ctx.beginPath();
  ctx.arc(reached, lineY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lineEnd, lineY, 7, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = `400 24px ${sans}`;
  ctx.fillStyle = secondary;
  ctx.fillText('Day 1', pad, lineY + 52);
  ctx.textAlign = 'right';
  ctx.fillStyle = gold;
  ctx.fillText('Day 90', lineEnd, lineY + 52);
  ctx.fillStyle = secondary;
  ctx.fillText(`One step a day · ${site}`, lineEnd, pad + 20);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the card'))), 'image/png'),
  );
}
