import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import sharp from "sharp";

initializeApp();

const db = getFirestore();
const storage = getStorage();

function buildPublicUrl(bucketName, objectPath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

async function createVariant(localSourcePath, localTargetPath, maxEdge, quality) {
  const image = sharp(localSourcePath).rotate();
  const metadata = await image.metadata();
  const width = Number(metadata.width) || 0;
  const height = Number(metadata.height) || 0;
  const longest = Math.max(width, height, 1);
  const ratio = longest > maxEdge ? (maxEdge / longest) : 1;
  const targetWidth = Math.max(1, Math.round(width * ratio));
  const targetHeight = Math.max(1, Math.round(height * ratio));

  await image
    .resize({ width: targetWidth, height: targetHeight, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toFile(localTargetPath);

  return { width: targetWidth, height: targetHeight };
}

export const photoPipeline = onObjectFinalized({ region: "us-central1" }, async (event) => {
  const object = event.data;
  const objectPath = object.name || "";
  const bucketName = object.bucket;
  const contentType = object.contentType || "";

  if (!objectPath.startsWith("events/")) return;
  if (!objectPath.includes("/photos/")) return;
  if (!contentType.startsWith("image/")) return;
  if (objectPath.endsWith("_thumb.jpg")) return;
  if (objectPath.includes("/processed/")) return;

  const bucket = storage.bucket(bucketName);
  const originalFile = bucket.file(objectPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "photo-pipeline-"));

  const localOriginalPath = path.join(tempDir, "original");
  const localLargePath = path.join(tempDir, "large.jpg");
  const localThumbPath = path.join(tempDir, "thumb.jpg");

  try {
    await originalFile.download({ destination: localOriginalPath });

    const [largeMetrics, thumbMetrics] = await Promise.all([
      createVariant(localOriginalPath, localLargePath, 1920, 84),
      createVariant(localOriginalPath, localThumbPath, 480, 74)
    ]);

    const basePath = objectPath.replace(/\.[^/.]+$/, "");
    const processedLargePath = `${basePath}_processed.jpg`;
    const processedThumbPath = `${basePath}_processed_thumb.jpg`;
    const largeToken = crypto.randomUUID();
    const thumbToken = crypto.randomUUID();

    await Promise.all([
      bucket.upload(localLargePath, {
        destination: processedLargePath,
        metadata: {
          contentType: "image/jpeg",
          metadata: {
            firebaseStorageDownloadTokens: largeToken,
            source: objectPath,
            variant: "large"
          }
        }
      }),
      bucket.upload(localThumbPath, {
        destination: processedThumbPath,
        metadata: {
          contentType: "image/jpeg",
          metadata: {
            firebaseStorageDownloadTokens: thumbToken,
            source: objectPath,
            variant: "thumb"
          }
        }
      })
    ]);

    const snap = await db.collectionGroup("photos").where("storagePath", "==", objectPath).get();
    if (snap.empty) return;

    const batch = db.batch();
    for (const docSnap of snap.docs) {
      batch.set(docSnap.ref, {
        pipelineState: "processed",
        processedAt: new Date(),
        processedDownloadURL: buildPublicUrl(bucketName, processedLargePath, largeToken),
        processedThumbnailURL: buildPublicUrl(bucketName, processedThumbPath, thumbToken),
        processedStoragePath: processedLargePath,
        processedThumbnailPath: processedThumbPath,
        width: largeMetrics.width,
        height: largeMetrics.height
      }, { merge: true });
    }
    await batch.commit();
  } catch (error) {
    console.error("photoPipeline failed", { objectPath, error: error?.message || error });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
