import { validateHarnessSpec } from '../core/harness.js';
import { json } from '../core/json.js';
import { currentProfileHash, HARNESS_SPEC, readHarnessReceipt, sourcePath } from './harness.js';
import { fileHash, readJson, resolvePath, within } from './files.js';

/** Read-only impact and projection reports. A report never acknowledges a review or writes a member. */
export function harnessImpact(root: string, local = false) {
  root = resolvePath(root);
  const spec = readJson(within(root, HARNESS_SPEC)); validateHarnessSpec(spec);
  const receipt = readHarnessReceipt(root); if (!receipt) throw new Error('No generated harness receipt');
  const profileChanged = currentProfileHash(root) !== receipt.profile_sha256;
  const sources = receipt.sources.map(source => {
    let current: string | null = null;
    let status: 'unchanged' | 'changed' | 'unavailable' | 'pending' = 'pending';
    if (!source.member || local) {
      try { current = fileHash(sourcePath(root, source)); status = current === source.sha256 ? 'unchanged' : 'changed'; }
      catch { status = 'unavailable'; }
    }
    return { member: source.member, path: source.path, previous_sha256: source.sha256, current_sha256: current, status };
  });
  const affected = receipt.files.flatMap(file => file.logical_paths.flatMap(output => {
    const mapping = spec.provenance?.find(entry => entry.output === output);
    const dependencies = mapping?.sources ?? spec.sources;
    const reasons = sources.filter(source => source.status !== 'unchanged' && dependencies.some(dependency => json([dependency.member, dependency.path]) === json([source.member, source.path])));
    return reasons.length || profileChanged ? [{ output, dependency_scope: mapping ? 'explicit' : 'conservative', profile_changed: profileChanged, sources: reasons.map(source => ({ member: source.member, path: source.path, status: source.status })) }] : [];
  }));
  return { schema_version: 1, scope: local ? 'local' : 'shared', profile_changed: profileChanged, sources, affected };
}
export function harnessSync(root: string, local = false) {
  root = resolvePath(root);
  const spec = readJson(within(root, HARNESS_SPEC)); validateHarnessSpec(spec);
  const projections = (spec.projections ?? []).map(projection => {
    let sourceHash: string | null = null, targetHash: string | null = null;
    let status: 'passed' | 'failed' | 'pending' = 'pending';
    if (local || (!projection.source.member && !projection.target.member)) {
      try { sourceHash = fileHash(sourcePath(root, projection.source)); targetHash = fileHash(sourcePath(root, projection.target)); status = sourceHash === targetHash ? 'passed' : 'failed'; }
      catch { status = 'failed'; }
    }
    return { ...projection, source_sha256: sourceHash, target_sha256: targetHash, status };
  });
  return { schema_version: 1, observed_at: new Date().toISOString(), status: projections.some(row => row.status === 'failed') ? 'failed' : projections.some(row => row.status === 'pending') ? 'pending' : 'passed', projections, writes: 0 };
}
