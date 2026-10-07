import type { Condition, Variable } from '../../shared/types';
import { coerceValue, type VarValues } from './state';

export function evalCondition(c: Condition, vars: VarValues, variables: Variable[]): boolean {
  const def = variables.find((v) => v.id === c.variableId);
  if (!def) return false;
  const left = coerceValue(def.type, vars[def.id]);
  const right = coerceValue(def.type, c.value);
  switch (c.op) {
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    default:
      return false;
  }
}

export function evalConditions(conds: Condition[], logic: 'all' | 'any', vars: VarValues, variables: Variable[]): boolean {
  if (!conds || conds.length === 0) return true;
  return logic === 'any' ? conds.some((c) => evalCondition(c, vars, variables)) : conds.every((c) => evalCondition(c, vars, variables));
}

/** Replaces {VariableName} in text with the variable's current value. */
export function interpolate(text: string, vars: VarValues, variables: Variable[]): string {
  return String(text ?? '').replace(/\{([^{}]+)\}/g, (m, name: string) => {
    const def = variables.find((v) => v.name === name.trim());
    return def ? String(vars[def.id]) : m;
  });
}
