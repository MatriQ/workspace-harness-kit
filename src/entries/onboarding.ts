import { onboardingMain } from '../cli/onboarding.js';
process.exitCode = onboardingMain(process.argv.slice(2));
