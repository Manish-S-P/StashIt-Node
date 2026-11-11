/**
 * Uploads a file straight to storage (Cloudflare R2) with a presigned URL.
 * We use XMLHttpRequest instead of fetch because it reports upload progress.
 */
export function putFile(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage refused the upload (${xhr.status}). Please try again.`));
    };
    xhr.onerror = () => reject(new Error('The upload was interrupted. Check your connection and try again.'));
    xhr.send(file);
  });
}

/** The type we tell storage about. Browsers leave it empty for unknown files. */
export const contentTypeOf = (file: File) => file.type || 'application/octet-stream';
