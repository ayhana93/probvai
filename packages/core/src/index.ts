export { env, requireEnv, adminEmails, resetEnvCache } from './env';
export type { Env } from './env';

// ── Кредити: единственият път до баланса ───────────────────────────────────
export {
  spendCredit,
  addCredits,
  refundCredit,
  getBalance,
  getLedgerSum,
} from './credits';
export type { CreditResult, CreditFailure } from './credits';

export {
  reconcileFreeCredits,
  grantSignupCredits,
  grantEmailVerifiedCredits,
  grantPhoneVerifiedCredits,
  RISK_POINTS_RETURNING_DELETED,
} from './free-credits';
export type { FreeCreditOutcome, FreeCreditResult } from './free-credits';

// ── Самоличности ───────────────────────────────────────────────────────────
export {
  sha256Hex,
  normalizeEmail,
  normalizePhone,
  isPlausiblePhone,
  hashEmail,
  hashPhone,
} from './hash';

// ── Изображения и файлове ──────────────────────────────────────────────────
export {
  sniffImageFormat,
  prepareUserImage,
  MIME_BY_FORMAT,
  EXT_BY_FORMAT,
} from './image';
export type {
  ImageFormat,
  PrepareResult,
  PreparedImage,
  PrepareFailure,
} from './image';

export {
  ALLOWED_IMAGE_TYPES,
  buildKey,
  userPrefix,
  keyBelongsTo,
  uploadUserImage,
  putObject,
  getSignedUrl,
  getObject,
  deleteObject,
  deletePrefix,
  resetStorageClient,
} from './storage';
export type {
  ImageKind,
  AllowedImageType,
  StoredImage,
  UploadResult,
  UploadFailure,
} from './storage';

// ── Съобщения ──────────────────────────────────────────────────────────────
export { sendEmail, alertAdmin } from './mail';
export type { EmailMessage, SendResult } from './mail';

export { sendSms } from './sms';
export type { SmsResult } from './sms';

export { startPhoneVerification, verifyPhoneCode } from './phone';
export type {
  StartResult,
  StartFailure,
  VerifyResult,
  VerifyFailure,
} from './phone';

// ── Доставчици ─────────────────────────────────────────────────────────────
export {
  ALLOWED_ASPECT_RATIOS,
  DEFAULT_ASPECT_RATIO,
  PROVIDER_NAMES,
  isAllowedAspectRatio,
  registerProvider,
  activeProvider,
} from './providers';
export type {
  AspectRatio,
  ProviderName,
  TryOnProvider,
  RunInput,
  PollResult,
} from './providers';

// ── Опашка ─────────────────────────────────────────────────────────────────
export { QUEUES, getBoss, stopBoss } from './queue';
export type { QueueName } from './queue';
