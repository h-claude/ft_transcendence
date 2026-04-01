import sharp from "sharp";

export const ImageController = {
	/**
	 * @param {Buffer} buffer
	 */
	async resizeImageIfTooBig(buffer, maxW = 512, maxH = 512) {
		/** @type{import("sharp").Sharp} */
		const image = sharp(buffer);
		/** @type{import("sharp").Metadata} */
		const metadata = await image.metadata();
		if (!metadata.width || !metadata.height) {
			throw new Error("invalid image: dimensions not found");
		}

		if (metadata.width > maxW || metadata.height > maxH) {
			const ratio = Math.min(maxW / metadata.width, maxH / metadata.height);
			return image
					.resize({
						width: Math.round(metadata.width * ratio),
						height: Math.round(metadata.height * ratio),
						fit: "inside",
						withoutEnlargement: true,
					})
					.webp({quality: 80})
					.toBuffer();
		}
		return (buffer);
	}
}
