import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface SampleAssetOptions {
  rootDir?: string;
  devRuntime?: boolean;
}

const svgCache = new Map<string, string>();

function isDevRuntime(): boolean {
  try {
    const astroDev = import.meta.env?.DEV;
    if (typeof astroDev === 'boolean') return astroDev;
    if (typeof astroDev === 'string') return astroDev === 'true';

    const astroProd = import.meta.env?.PROD;
    if (typeof astroProd === 'boolean') return !astroProd;
    if (typeof astroProd === 'string') return astroProd !== 'true';
  } catch {
    // WHY: import.meta.env is unavailable in the plain Node test runner.
  }

  return process.env.NODE_ENV !== 'production';
}

function resolveAssetsDir(rootDir = process.cwd()): string {
  return path.resolve(rootDir, 'config', 'media', 'sample-ads');
}

function sanitizeFileName(fileName: string): string | undefined {
  if (!/^[A-Za-z0-9._-]+$/.test(fileName)) return undefined;
  return fileName;
}

function resolveAssetPath(fileName: string, options: SampleAssetOptions): string | undefined {
  const safeFileName = sanitizeFileName(fileName);
  if (!safeFileName) return undefined;

  return path.join(resolveAssetsDir(options.rootDir), safeFileName);
}

function isEnabled(options: SampleAssetOptions): boolean {
  return options.devRuntime ?? isDevRuntime();
}

export function readSampleSvg(
  fileName: string,
  options: SampleAssetOptions = {},
): string | undefined {
  if (!isEnabled(options)) return undefined;

  const assetPath = resolveAssetPath(fileName, options);
  if (!assetPath || path.extname(assetPath).toLowerCase() !== '.svg') return undefined;
  if (!existsSync(assetPath)) return undefined;

  const cached = svgCache.get(assetPath);
  if (cached) return cached;

  const source = readFileSync(assetPath, 'utf8');
  svgCache.set(assetPath, source);
  return source;
}

export function resolveSampleVideoSource(
  fileName: string,
  options: SampleAssetOptions = {},
): string | undefined {
  if (!isEnabled(options)) return undefined;

  const assetPath = resolveAssetPath(fileName, options);
  if (!assetPath || path.extname(assetPath).toLowerCase() !== '.mp4') return undefined;
  if (!existsSync(assetPath)) return undefined;

  // WHY: Vite dev serves arbitrary workspace files through /@fs/.
  return `/@fs/${encodeURI(assetPath.replace(/\\/g, '/'))}`;
}
