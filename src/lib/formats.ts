/**
 * File format classification, image detection, and MIME type helpers.
 * @spec EDT-002
 */

export const RASTER_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif']);
export const VECTOR_EXTENSIONS = new Set(['svg']);
export const OTHER_BINARY_EXTENSIONS = new Set(['pdf', 'epub', 'bin', 'zip', 'tar', 'gz', 'wasm', 'exe', 'dylib', 'so']);

export function getFileExtension(path: string): string {
	const lastDot = path.lastIndexOf('.');
	return lastDot === -1 ? '' : path.slice(lastDot + 1).toLowerCase();
}

/** Check if file is a renderable graphic (SVG or raster image). */
export function isGraphic(path: string): boolean {
	const ext = getFileExtension(path);
	return RASTER_EXTENSIONS.has(ext) || VECTOR_EXTENSIONS.has(ext);
}

/** Check if file is a raster image. */
export function isRasterImage(path: string): boolean {
	const ext = getFileExtension(path);
	return RASTER_EXTENSIONS.has(ext);
}

/** Check if file is a raster image or general binary format. */
export function isBinary(path: string): boolean {
	const ext = getFileExtension(path);
	return RASTER_EXTENSIONS.has(ext) || OTHER_BINARY_EXTENSIONS.has(ext);
}

/**
 * Check if file can be edited in Edit mode.
 * Raster images and binary files are not editable.
 */
export function isEditable(path: string): boolean {
	return !isBinary(path);
}

/** Return MIME type for common graphics and binary files. */
export function getMimeType(path: string): string {
	const ext = getFileExtension(path);
	switch (ext) {
		case 'png':
			return 'image/png';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'gif':
			return 'image/gif';
		case 'webp':
			return 'image/webp';
		case 'bmp':
			return 'image/bmp';
		case 'ico':
			return 'image/x-icon';
		case 'avif':
			return 'image/avif';
		case 'svg':
			return 'image/svg+xml';
		case 'pdf':
			return 'application/pdf';
		case 'epub':
			return 'application/epub+zip';
		default:
			return 'application/octet-stream';
	}
}
