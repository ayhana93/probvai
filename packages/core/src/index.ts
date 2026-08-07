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
  PhoneStartResult,
  PhoneStartFailure,
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

export { providerByName, ProviderError } from './providers';
export type { ProviderErrorCode } from './providers';

// ── Генерация ──────────────────────────────────────────────────────────────
export { startGeneration, failGeneration } from './generation';
export type {
  StartGenerationInput,
  StartGenerationResult,
  StartGenerationFailure,
} from './generation';

export {
  checkAllBrakes,
  checkCooldown,
  checkGlobalDailyCap,
  checkUserDailyLimit,
  spentToday,
} from './limits';
export type { BrakeReason, BrakeResult } from './limits';

export { applyWatermark, shouldWatermark, hasEverPurchased } from './watermark';

export { buildShareImage } from './share';
export type { ShareImageOptions } from './share';

// ── Дреха от линк ──────────────────────────────────────────────────────────
export { extractGarment } from './extract-garment';
export type { ExtractResult, ExtractFailure } from './extract-garment';

export { MERCHANTS, merchantFor, affiliateUrl } from './merchants';
export type { Merchant, AffiliateNetwork } from './merchants';

export {
  safeFetch,
  parsePublicUrl,
  isPrivateAddress,
  BlockedRequestError,
} from './net-guard';
export type { BlockedReason } from './net-guard';

export { metaContent, linkHref, pageTitle } from './html-meta';

// ── Време ──────────────────────────────────────────────────────────────────
export { startOfDay, daysAgo } from './time';

// ── Опашка ─────────────────────────────────────────────────────────────────
export { QUEUES, getBoss, stopBoss } from './queue';
export type { QueueName } from './queue';
