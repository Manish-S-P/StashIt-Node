import { Router } from 'express';
import { signStashToken } from '../lib/security.js';
import { parseBody } from '../lib/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { getAuth, requireStash } from '../middleware/requireStash.js';
import { createStashBody, unlockStashBody, updateStashBody } from '../schemas/stash.schemas.js';
import { createStash, toStashView, unlockStash, updateExpiry } from '../services/stash.service.js';

// Routes only speak HTTP: read the request, call a service, send the response.
// The rules live in the services.
export const stashRouter = Router();

/** Create a stash. Returns a token so the creator is "inside" right away. */
stashRouter.post('/stashes', authLimiter, async (req, res) => {
  const input = parseBody(createStashBody, req.body);
  const stash = await createStash(input);
  res.status(201).json({ token: signStashToken(String(stash._id)), stash: toStashView(stash) });
});

/** Open an existing stash with its title and password. */
stashRouter.post('/stashes/unlock', authLimiter, async (req, res) => {
  const input = parseBody(unlockStashBody, req.body);
  const stash = await unlockStash(input);
  res.json({ token: signStashToken(String(stash._id)), stash: toStashView(stash) });
});

/** The stash this token belongs to. */
stashRouter.get('/stash', requireStash, (req, res) => {
  res.json({ stash: toStashView(getAuth(req).stash) });
});

/** Change when the stash expires (counted from now). */
stashRouter.patch('/stash', requireStash, async (req, res) => {
  const { expiresInMinutes } = parseBody(updateStashBody, req.body);
  const stash = await updateExpiry(getAuth(req).stash, expiresInMinutes);
  res.json({ stash: toStashView(stash) });
});
