export { env, requireEnv, adminEmails, resetEnvCache } from './env';
export type { Env } from './env';

// ── Кредити: единственият път до баланса ───────────────────────────────────
export {
  spendCredit,
  addCredits,
  revokeCredits,
  refundCredit,
  getBalance,
  getLedgerSum,
} from './credits';
export type { CreditResult, CreditFailure } from './credits';

// ── Плащания ───────────────────────────────────────────────────────────────
export {
  PURCHASE_STEP_CREDITS,
  quoteCredits,
  createCheckoutSession,
  verifyWebhook,
  handleStripeEvent,
  stripeClient,
  resetStripeClient,
} from './payments';
export type {
  PriceQuote,
  QuoteResult,
  QuoteFailure,
  CheckoutInput,
  CheckoutResult,
  WebhookOutcome,
} from './payments';

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
  storageConfigured,
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

export { purchaseEmail } from './emails';
export type { PurchaseEmail } from './emails';

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
export { buildPrompt, MAX_USER_PROMPT } from './prompt';

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

export { MERCHANTS, merchantFor, affiliateUrl, searchUrl } from './merchants';
export type { Merchant, AffiliateNetwork } from './merchants';

// ── Стил, профил, нива ─────────────────────────────────────────────────────
export {
  STYLE_CATEGORIES,
  STYLE_INFO,
  isStyleCategory,
  categorize,
  classifyByVision,
} from './style';
export type { StyleInfo, CategorizeInput } from './style';

export {
  GENDERS,
  MIN_AGE,
  MAX_AGE,
  PUBLIC_WARDROBE_MIN_AGE,
  isGender,
  completeProfile,
  ageFromBirthYear,
  mayPublish,
} from './profile';
export type { ProfileInput, ProfileResult, ProfileFailure } from './profile';

export { detectGenderByVision, personGenderFor } from './person';

// ── Акаунти с парола ───────────────────────────────────────────────────────
export {
  hashPassword,
  verifyPassword,
  hashAnswer,
  verifyAnswer,
  normalizeAnswer,
  passwordProblem,
  MIN_PASSWORD_LENGTH,
} from './password';

export {
  SECURITY_QUESTIONS,
  isSecurityQuestion,
  questionText,
  decoyQuestionFor,
} from './security-questions';
export type { SecurityQuestion } from './security-questions';

export {
  registerWithPassword,
  verifyCredentials,
  questionForEmail,
  resetWithAnswer,
  clearResetAttempts,
} from './accounts';
export type {
  RegisterInput,
  RegisterResult,
  RegisterFailure,
  LoginResult,
  ResetResult,
  ResetFailure,
  QuestionLookup,
} from './accounts';

export {
  RANKS,
  VIP,
  rankFor,
  tierFrom,
  tierFor,
  awardXp,
  recordSpend,
  hasQueuePriority,
  vipThresholdCents,
} from './tier';
export type { Rank, TierState } from './tier';

// ── Lookbook ───────────────────────────────────────────────────────────────
export {
  PAGE_SIZE,
  newSeed,
  lookbookFeed,
  looksPublishedAfter,
  setPublished,
  toggleLike,
  toggleSave,
  savedLooks,
  likedLooks,
  publicLookImageUrl,
} from './lookbook';
export type {
  LookItem,
  LookPage,
  LikedLook,
  FeedOptions,
  ToggleResult,
  PublishResult,
  PublishFailure,
} from './lookbook';

// ── Предложения за покупка ─────────────────────────────────────────────────
export { blocksFor, waitCards } from './recommendations';
export type { RecoBlock, RecoLink, RecoKind, RecoInput, WaitCard } from './recommendations';

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
