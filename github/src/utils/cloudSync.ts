/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase/firebase';
import { RepositoryItem } from '../types/upscayl';
import {
  getAllRepositoryItems,
  saveRepositoryItem as saveLocalRepoItem,
  deleteRepositoryItem as deleteLocalRepoItem,
  clearAllRepositoryItems as clearLocalRepoItems,
} from './repoStorage';

function getUserPhotosCollectionPath(userId: string): string {
  return `users/${userId}/photos`;
}

/**
 * Saves a photo to both local IndexedDB and to Firebase Firestore (if logged in)
 */
export async function saveEnhancedPhoto(item: RepositoryItem): Promise<void> {
  // Always save locally for instant offline performance
  await saveLocalRepoItem(item);

  // If user is authenticated, sync to Firestore
  const user = auth.currentUser;
  if (user && user.uid) {
    const path = getUserPhotosCollectionPath(user.uid);
    try {
      const sanitizedId = item.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const docRef = doc(db, path, sanitizedId);
      
      const payload = {
        id: sanitizedId,
        userId: user.uid,
        userEmail: user.email || '',
        title: item.title.slice(0, 200),
        originalDataUrl: item.originalDataUrl.slice(0, 1048576),
        upscaledDataUrl: item.upscaledDataUrl.slice(0, 1048576),
        originalWidth: item.originalWidth,
        originalHeight: item.originalHeight,
        upscaledWidth: item.upscaledWidth,
        upscaledHeight: item.upscaledHeight,
        modelId: item.modelId,
        modelName: item.modelName,
        scaleFactor: item.scaleFactor,
        exportFormat: item.exportFormat,
        processingTimeMs: item.processingTimeMs,
        fileSizeEstimateKb: item.fileSizeEstimateKb,
        createdAt: item.createdAt || new Date().toISOString(),
      };

      await setDoc(docRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

/**
 * Deletes a photo from both local storage and Firebase
 */
export async function deleteEnhancedPhoto(id: string): Promise<void> {
  await deleteLocalRepoItem(id);

  const user = auth.currentUser;
  if (user && user.uid) {
    const path = getUserPhotosCollectionPath(user.uid);
    try {
      const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const docRef = doc(db, path, sanitizedId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

/**
 * Loads all items (syncing from Firestore if signed in, or IndexedDB)
 */
export async function loadAllPhotos(): Promise<RepositoryItem[]> {
  const localItems = await getAllRepositoryItems();
  const user = auth.currentUser;

  if (user && user.uid) {
    const path = getUserPhotosCollectionPath(user.uid);
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const cloudItems: RepositoryItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        cloudItems.push({
          id: data.id || d.id,
          title: data.title,
          originalDataUrl: data.originalDataUrl,
          upscaledDataUrl: data.upscaledDataUrl,
          originalWidth: data.originalWidth,
          originalHeight: data.originalHeight,
          upscaledWidth: data.upscaledWidth,
          upscaledHeight: data.upscaledHeight,
          modelId: data.modelId,
          modelName: data.modelName,
          scaleFactor: data.scaleFactor,
          exportFormat: data.exportFormat,
          processingTimeMs: data.processingTimeMs,
          createdAt: data.createdAt,
          fileSizeEstimateKb: data.fileSizeEstimateKb,
          tags: [data.modelName, `${data.scaleFactor}x`],
        });
      });

      // Merge and update local IndexedDB
      for (const item of cloudItems) {
        await saveLocalRepoItem(item);
      }

      return cloudItems.length > 0 ? cloudItems : localItems;
    } catch (error) {
      console.warn('Could not fetch cloud photos, using local cache:', error);
      return localItems;
    }
  }

  return localItems;
}

/**
 * Subscribes to live updates on user's cloud photos
 */
export function subscribeToUserPhotos(
  userId: string,
  onUpdate: (items: RepositoryItem[]) => void
): () => void {
  const path = getUserPhotosCollectionPath(userId);
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snap: QuerySnapshot<DocumentData>) => {
      const items: RepositoryItem[] = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          id: data.id || d.id,
          title: data.title,
          originalDataUrl: data.originalDataUrl,
          upscaledDataUrl: data.upscaledDataUrl,
          originalWidth: data.originalWidth,
          originalHeight: data.originalHeight,
          upscaledWidth: data.upscaledWidth,
          upscaledHeight: data.upscaledHeight,
          modelId: data.modelId,
          modelName: data.modelName,
          scaleFactor: data.scaleFactor,
          exportFormat: data.exportFormat,
          processingTimeMs: data.processingTimeMs,
          createdAt: data.createdAt,
          fileSizeEstimateKb: data.fileSizeEstimateKb,
          tags: [data.modelName, `${data.scaleFactor}x`],
        });
      });
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export { clearLocalRepoItems };
