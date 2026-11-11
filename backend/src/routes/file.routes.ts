import { Router } from 'express';
import { parseBody } from '../lib/validate.js';
import { getAuth, requireStash } from '../middleware/requireStash.js';
import { uploadUrlBody } from '../schemas/stash.schemas.js';
import { confirmUpload, deleteFile, getDownloadUrl, requestUpload } from '../services/file.service.js';
import { findActiveStash, toStashView } from '../services/stash.service.js';
import { stashGone } from '../lib/errors.js';

export const fileRouter = Router();

// Every file route needs a valid stash token.
fileRouter.use(requireStash);

/** Step 1: reserve space and get a presigned URL to upload the file to. */
fileRouter.post('/upload-url', async (req, res) => {
  const input = parseBody(uploadUrlBody, req.body);
  const upload = await requestUpload(getAuth(req).stash, input);
  res.status(201).json(upload);
});

/** Step 2: after uploading to storage, confirm it so the file appears in the stash. */
fileRouter.post('/:fileId/confirm', async (req, res) => {
  const { stash } = getAuth(req);
  await confirmUpload(stash, req.params.fileId);
  const fresh = await findActiveStash(String(stash._id));
  if (!fresh) throw stashGone();
  res.json({ stash: toStashView(fresh) });
});

/** A short-lived download link. May burn a burn-after-read stash. */
fileRouter.get('/:fileId/download-url', async (req, res) => {
  const { stash, tokenId } = getAuth(req);
  res.json(await getDownloadUrl(stash, tokenId, req.params.fileId));
});

fileRouter.delete('/:fileId', async (req, res) => {
  await deleteFile(getAuth(req).stash, req.params.fileId);
  res.status(204).end();
});
