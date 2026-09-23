/**
 * One-shot check for getPlanLimits / resolvePlanType.
 * Run: npx tsx scripts/verify-plan-limits.ts
 */
import { getPlanLimits, resolvePlanType, PLAN_LIMITS } from '../src/types';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

// Missing / unknown / legacy BASIC must not yield undefined limits (the crash in App.tsx)
assert(resolvePlanType(undefined) === 'PERSONAL_BASIC', 'undefined should map to PERSONAL_BASIC');
assert(resolvePlanType(null) === 'PERSONAL_BASIC', 'null should map to PERSONAL_BASIC');
assert(resolvePlanType('BASIC') === 'PERSONAL_BASIC', 'legacy BASIC should map to PERSONAL_BASIC');
assert(resolvePlanType('GARBAGE') === 'PERSONAL_BASIC', 'unknown plan should fall back to PERSONAL_BASIC');

const basicLimits = getPlanLimits('BASIC');
assert(basicLimits === PLAN_LIMITS.PERSONAL_BASIC, 'BASIC limits should equal PERSONAL_BASIC');
assert(typeof basicLimits.tasks === 'number', 'BASIC limits.tasks must be defined');
assert(typeof basicLimits.modules === 'number', 'BASIC limits.modules must be defined');
assert(basicLimits.maxUsers === 5, 'BASIC maxUsers should be 5');

// Current keys pass through
assert(resolvePlanType('PERSONAL_PLUS') === 'PERSONAL_PLUS', 'PERSONAL_PLUS should pass through');
assert(getPlanLimits('INSTITUTION_PLUS').maxUsers === Infinity, 'INSTITUTION_PLUS maxUsers should be Infinity');

// Higher-tier legacy keys map to Plus, not an undefined lookup
assert(resolvePlanType('INTERMEDIATE') === 'PERSONAL_PLUS', 'INTERMEDIATE should map to PERSONAL_PLUS');
assert(resolvePlanType('INSTITUTION_ADVANCED') === 'INSTITUTION_PLUS', 'INSTITUTION_ADVANCED should map to INSTITUTION_PLUS');
assert(getPlanLimits('INTERMEDIATE').tasks === Infinity, 'INTERMEDIATE should inherit Plus task limit');

// Reproduce the toggleModule crash condition: this must not throw
const modules = 4;
const activeCount = 4;
const isActivating = true;
const wouldBlock = isActivating && activeCount >= getPlanLimits('BASIC').modules;
assert(wouldBlock === true, 'module limit check must run without throwing and enforce BASIC/PERSONAL_BASIC cap');

console.log('verify-plan-limits: all checks passed');
