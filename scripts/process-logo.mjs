/**
 * Process logo: remove background, keep only the dark emblem (graduation cap + S).
 * Makes light/pastel pixels transparent, keeps dark pixels as black.
 */
import { createReadStream, createWriteStream, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const inputPath = join(root, 'public', 'logo-source.png');
const outputPath = join(root, 'public', 'logo.png');

if (!existsSync(inputPath)) {
  console.error('Input image not found at:', inputPath);
  process.exit(1);
}

const threshold = 100; // Pixels darker than this = emblem. Lighter = background (transparent).

createReadStream(inputPath)
  .pipe(new PNG())
  .on('parsed', function () {
    const data = this.data;
    const width = this.width;
    const height = this.height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        if (luminance > threshold) {
          data[idx + 3] = 0; // transparent
        } else {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = Math.min(255, 255 - luminance); // slight anti-aliasing
        }
      }
    }

    this.pack().pipe(createWriteStream(outputPath)).on('finish', () => {
      console.log('Logo saved to', outputPath);
    });
  })
  .on('error', (err) => {
    console.error(err);
    process.exit(1);
  });
