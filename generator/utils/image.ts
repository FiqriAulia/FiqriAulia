import imageConfig from '#data/image-config.json';
import type { ImagePiece } from '#types';
import { getMonorepoDirpath } from 'get-monorepo-root';
import { hash } from 'hasha';
import fs from 'node:fs';
import nullthrows from 'nullthrows-es';
import path from 'pathe';
import sharp from 'sharp';

export async function generateImagePieces(
	{ imageFilepath }: { imageFilepath: string },
) {
	const monorepoDirpath = nullthrows(getMonorepoDirpath(import.meta.url));
	const generatedDirpath = path.join(monorepoDirpath, 'generated');

	await fs.promises.rm(generatedDirpath, { recursive: true, force: true });
	await fs.promises.mkdir(generatedDirpath, { recursive: true });

	const lineHeight = 6;

	let currentY = 0;
	const image = sharp(imageFilepath);
	const { width: imageWidth, height: imageHeight } = await image.metadata();
	if (!imageWidth || !imageHeight) {
		throw new Error('Could not get image dimensions');
	}

	const crops: {
		left: number;
		top: number;
		width: number;
		height: number;
		href: string | null;
	}[] = [];

	for (const row of imageConfig.rows) {
		let currentX = 0;

		for (const link of row.links) {
			const { leftX, rightX, href: unparsedHref } = link;
			const href = unparsedHref.replace(
				'${LATEST_CONTENT_URL}',
				'https://www.tiktok.com/@leonsilicon/video/7350626104736025862',
			);

			// If this image link is not directly next to the previous image link,
			// we need to crop the image inbetween and create a non-link image
			if (currentX < leftX) {
				crops.push({
					left: currentX,
					top: currentY,
					width: leftX - currentX,
					height: row.bottomY - currentY,
					href: null,
				});
			}

			crops.push({
				left: leftX,
				top: currentY,
				width: rightX - leftX,
				height: row.bottomY - currentY,
				href,
			});

			currentX = rightX;
		}

		if (currentX < imageWidth) {
			crops.push({
				left: currentX,
				top: currentY,
				width: imageWidth - currentX,
				height: row.bottomY - currentY,
				href: null,
			});
		}

		currentY = row.bottomY + lineHeight;
	}

	const imagePieces: ImagePiece[] = await Promise.all(
		crops.map(async (crop) => {
			const { href, ...dimensions } = crop;
			const buffer = await image.clone().extract(dimensions).toFormat('png')
				.toBuffer();
			const bufferHash = await hash(buffer);
			const filepath = path.join(
				monorepoDirpath,
				'generated',
				`${bufferHash}.png`,
			);
			await fs.promises.writeFile(filepath, buffer);

			return {
				filepath,
				href,
				width: dimensions.width,
				height: dimensions.height,
			};
		}),
	);

	return imagePieces;
}