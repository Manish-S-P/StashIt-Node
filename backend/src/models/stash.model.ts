import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

/**
 * Files live inside their stash document (embedded), because a stash and its files
 * are always read and changed together. One read gets everything.
 */
const fileSchema = new Schema(
  {
    fileId: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    contentType: { type: String, required: true },
    // "pending" = space reserved, upload in progress. "ready" = uploaded and verified.
    status: { type: String, enum: ['pending', 'ready'], required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const stashSchema = new Schema(
  {
    /** The title as the user typed it, for display. */
    title: { type: String, required: true },
    /** Normalised title ("My Notes " -> "my notes"). The unique index lives here. */
    titleKey: { type: String, required: true, unique: true },
    /** Argon2 hash. The password itself is never stored. */
    passwordHash: { type: String, required: true },
    files: { type: [fileSchema], default: [] },
    /** Bytes used, including space reserved by uploads still in progress. */
    totalSize: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
    burnAfterRead: { type: Boolean, required: true, default: false },
    /** Set by the first download of a burn-after-read stash. */
    burnedAt: { type: Date, default: null },
    /** Token id of the visitor who triggered the burn; only they keep access. */
    burnHolder: { type: String, default: null },
    failedAttempts: { type: Number, required: true, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

// Safety net: MongoDB deletes stash documents 1 hour after they expire.
// The cleanup job normally removes them (and their files) long before this.
stashSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 });
// Lets the cleanup job find burned stashes quickly.
stashSchema.index({ burnedAt: 1 });

export type StashFile = InferSchemaType<typeof fileSchema>;
export type StashDoc = InferSchemaType<typeof stashSchema> & { _id: Types.ObjectId };

export const Stash = model('Stash', stashSchema);
