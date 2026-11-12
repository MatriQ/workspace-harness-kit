import type { OnboardingProfile } from './onboarding.js';
export type Check = 'deployment' | 'version' | 'technical' | 'business';
export type ObservationStatus = 'passed' | 'failed' | 'pending' | 'not run';
export type Verdict = 'passed' | 'failed' | 'pending';
export interface Target { environment: string; identity: string }
export interface Artifact {
  kind: 'git_commit' | 'oci_manifest_digest' | 'oci_index_digest' | 'package_version' | 'runtime_revision';
  value: string;
  platform?: string;
}
export interface ReleaseComponent {
  id: string;
  artifact: Artifact;
  required_checks: Check[];
  not_applicable: Partial<Record<Check, string>>;
  criteria: Partial<Record<Check, string>>;
}
export interface Journey { id: string; components: string[]; criterion: string }
export interface Observation {
  component?: string;
  journey?: string;
  check: Check;
  attempt: number;
  status: ObservationStatus;
  target: Target;
  observed_at: string;
  summary: string;
  evidence: string[];
  artifact?: Artifact;
  artifacts?: Record<string, Artifact>;
}
export interface EvidenceRecord {
  schema_version: 1;
  release: string;
  capability?: string;
  scope: { target: Target; max_age_seconds: number; components: ReleaseComponent[]; journeys: Journey[] };
  observations: Observation[];
}
export interface AttemptResult {
  attempt: number;
  status: ObservationStatus;
  reported_status: ObservationStatus;
  reason: string;
  summary: string;
  target: Target;
  observed_at: string;
  evidence: string[];
  artifact?: Artifact;
  artifacts?: Record<string, Artifact>;
}
export interface CheckResult {
  subject: 'component' | 'journey';
  id: string;
  check: Check;
  criterion?: string;
  status: ObservationStatus | 'not applicable';
  reason: string;
  attempts: AttemptResult[];
  recovered: boolean;
  expected_artifact?: Artifact;
  expected_artifacts?: Record<string, Artifact>;
}
export interface EvaluationResult {
  schema_version: 1;
  release: string;
  target: Target;
  evaluated_at: string;
  verdict: Verdict;
  checks: CheckResult[];
}
export interface Fingerprint { path: string; sha256: string }
export interface DocumentReview extends Fingerprint { sources: Fingerprint[]; onboarding_sha256?: string }
export type AdoptionMode = 'register' | 'analyze' | 'init';
export interface Member {
  id: string;
  mode: AdoptionMode;
  language?: string;
  remote?: string;
  documents?: string[];
  sources?: Fingerprint[];
  source_files?: string[];
  document_reviews?: DocumentReview[];
  depends_on?: string[];
  [key: string]: unknown;
}
export interface Component { id: string; member: string; path?: string; [key: string]: unknown }
export type RelationshipType = 'starts_after' | 'deploys_after' | 'consumes' | 'validated_by' | 'requires';
export interface Relationship { from: string; to: string; type: RelationshipType }
export interface Capability { id: string; requires: string[]; [key: string]: unknown }
export interface WorkspaceManifest {
  schema_version: 1;
  language: string;
  members: Member[];
  documents?: string[];
  components?: Component[];
  relationships?: Relationship[];
  capabilities?: Capability[];
  onboarding?: OnboardingProfile;
  [key: string]: unknown;
}
export interface Binding { path: string; git_common_dir: string }
export interface LocalManifest { schema_version: 1; checkouts: Record<string, Binding> }
