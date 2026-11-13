export * from './core/types.js';
export { evaluate, validateEvidence, compareArtifacts, markdown, EvidenceError, timestamp } from './core/evidence.js';
export { validateManifest, componentModel, documentFreshness, checkWorkspaceScope, WorkspaceError } from './core/registry.js';
export { planOnboarding, validateOnboarding, OnboardingError } from './core/onboarding.js';
export type { OnboardingProfile, OnboardingPlan, PlatformProfile, ToolPolicy, ToolRequirement, DocumentRequirement, ExistingDocumentChoice } from './core/onboarding.js';
export { validateHarnessSelection, validateHarnessSpec, renderHarness, evaluateGuard, hookOutput, HarnessError } from './core/harness.js';
export type { HarnessTarget, HarnessPart, HarnessLayout, HarnessSelection, HarnessSpec, HarnessRuntimes, GeneratedArtifact, CommandGuard, HookCase } from './core/harness.js';
export { documentCommands, commandReference, makeDeclarations } from './core/commands.js';
export { validateDiagnosticSpec, validateVerificationRecord, evaluateVerification } from './core/verification.js';
export type { DiagnosticSpec, DiagnosticCheck, VerificationCheck, VerificationObservation, VerificationRecord } from './core/verification.js';
export { validateReadinessPlan, READINESS_AREAS } from './core/readiness.js';
export type { ReadinessPlan, ReadinessArea } from './core/readiness.js';
export { requiredDocumentTopics, DOCUMENT_TOPICS } from './core/documentation.js';
export type { DocumentTopic, DocumentCoverage } from './core/documentation.js';

export { parseLocalContext, renderLocalContext, validateLocalContext } from './core/local-context.js';
