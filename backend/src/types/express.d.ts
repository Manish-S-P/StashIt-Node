import type { StashDoc } from '../models/stash.model.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by the requireStash middleware once the stash token is verified. */
      auth?: {
        stash: StashDoc;
        tokenId: string;
      };
    }
  }
}

export {};
