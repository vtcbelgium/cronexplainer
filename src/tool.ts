// src/tool.ts

export type CronMode = 'linux' | 'aws' | 'github';

export interface ParsedCronField {
  name: string;
  raw: string;
  description: string;
  values: number[];
  valid: boolean;
  error?: string;
}

export interface CronParseResult {
  mode: CronMode;
  expression: string;
  fields: ParsedCronField[];
  explanation: string;
  nextRuns: { local: string; utc: string }[];
  valid: boolean;
  errors: string[];
}

const FIELD_DEFINITIONS: Record<CronMode, { name: string; min: number; max: number; hasSeconds: boolean }[]> = {
  linux: [
    { name: 'Minute', min: 0, max: 59, hasSeconds: false },
    { name: 'Hour', min: 0, max: 23, hasSeconds: false },
    { name: 'Day of month', min: 1, max: 31, hasSeconds: false },
    { name: 'Month', min: 1, max: 12, hasSeconds: false },
    { name: 'Day of week', min: 0, max: 6, hasSeconds: false },
  ],
  aws: [
    { name: 'Minute', min: 0, max: 59, hasSeconds: false },
    { name: 'Hour', min: 0, max: 23, hasSeconds: false },
    { name: 'Day of month', min: 1, max: 31, hasSeconds: false },
    { name: 'Month', min: 1, max: 12, hasSeconds: false },
    { name: 'Day of week', min: 1, max: 7, hasSeconds: false },
  ],
  github: [
    { name: 'Minute', min: 0, max: 59, hasSeconds: false },
    { name: 'Hour', min: 0, max: 23, hasSeconds: false },
    { name: 'Day of month', min: 1, max: 31, hasSeconds: false },
    { name: 'Month', min: 1, max: 12, hasSeconds: false },
    { name: 'Day of week', min: 0, max: 6, hasSeconds: false },
  ],
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

function parseField(raw: string, min: number, max: number, name: string, mode: CronMode): ParsedCronField {
  const result: ParsedCronField = {
    name,
    raw,
    description: '',
    values: [],
    valid: true,
  };

  if (raw === '*') {
    result.values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    result.description = 'every value'; 
    return result;
  }

  const parts = raw.split(',');
  const allValues = new Set<number>();
  let hasError = false;
  let errorMsg = '';

  for (const part of parts) {
    if (part.includes('/')) {
      const [range, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step <= 0) {
        hasError = true;
        errorMsg = `Invalid step value: ${stepStr}`;
        break;
      }
      let rangeMin = min;
      let rangeMax = max;
      if (range !== '*') {
        if (range.includes('-')) {
          const [rMin, rMax] = range.split('-').map(s => parseInt(s, 10));
          if (isNaN(rMin) || isNaN(rMax)) {
            hasError = true;
            errorMsg = `Invalid range: ${range}`;
            break;
          }
          rangeMin = rMin;
          rangeMax = rMax;
        } else {
          const val = parseInt(range, 10);
          if (isNaN(val)) {
            hasError = true;
            errorMsg = `Invalid value: ${range}`;
            break;
          }
          rangeMin = val;
          rangeMax = val;
        }
      }
      for (let v = rangeMin; v <= rangeMax; v += step) {
        if (v >= min && v <= max) allValues.add(v);
      }
    } else if (part.includes('-')) {
      const [rMin, rMax] = part.split('-').map(s => parseInt(s, 10));
      if (isNaN(rMin) || isNaN(rMax)) {
        hasError = true;
        errorMsg = `Invalid range: ${part}`;
        break;
      }
      for (let v = rMin; v <= rMax; v++) {
        if (v >= min && v <= max) allValues.add(v);
      }
    } else {
      const val = parseInt(part, 10);
      if (isNaN(val)) {
        hasError = true;
        errorMsg = `Invalid value: ${part}`;
        break;
      }
      if (val >= min && val <= max) allValues.add(val);
    }
  }

  if (hasError) {
    result.valid = false;
    result.error = errorMsg;
    result.description = `Invalid: ${errorMsg}`;
    return result;
  }

  result.values = Array.from(allValues).sort((a, b) => a - b);

  if (result.values.length === 0) {
    result.valid = false;
    result.error = 'No valid values in range';
    result.description = 'No valid values';
    return result;
  }

  if (result.values.length === max - min + 1) {
    result.description = 'every value';
  } else if (result.values.length === 1) {
    result.description = `value ${result.values[0]}`;
  } else {
    const diffs = result.values.slice(1).map((v, i) => v - result.values[i]);
    const allSameStep = diffs.every(d => d === diffs[0]);
    if (allSameStep && diffs[0] > 1) {
      result.description = `every ${diffs[0]} value(s) from ${result.values[0]} to ${result.values[result.values.length - 1]}`;
    } else {
      result.description = `values: ${result.values.join(', ')}`;
    }
  }

  return result;
}

export function parseCronExpression(expression: string, mode: CronMode = 'linux'): CronParseResult {
  const trimmed = expression.trim();
  const errors: string[] = [];
  
  if (!trimmed) {
    return {
      mode,
      expression: trimmed,
      fields: [],
      explanation: '',
      nextRuns: [],
      valid: false,
      errors: ['Empty expression'],
    };
  }

  const parts = trimmed.split(/\s+/);
  const definitions = FIELD_DEFINITIONS[mode];
  
  if (parts.length !== definitions.length) {
    errors.push(`Expected ${definitions.length} fields, got ${parts.length}`);
  }

  const fields: ParsedCronField[] = [];
  for (let i = 0; i < definitions.length; i++) {
    const def = definitions[i];
    const raw = parts[i] || '';
    const parsed = parseField(raw, def.min, def.max, def.name, mode);
    fields.push(parsed);
    if (!parsed.valid && parsed.error) {
      errors.push(`${def.name}: ${parsed.error}`);
    }
  }

  const valid = errors.length === 0;
  let explanation = '';
  let nextRuns: { local: string; utc: string }[] = [];

  if (valid) {
    const descParts = fields.map(f => `${f.name}: ${f.description}`);
    explanation = `This cron runs when: ${descParts.join('; ')}.`;
    nextRuns = calculateNextRuns(fields, mode);
  } else {
    explanation = `Invalid cron expression: ${errors.join('; ')}`;
  }

  return {
    mode,
    expression: trimmed,
    fields,
    explanation,
    nextRuns,
    valid,
    errors,
  };
}

function calculateNextRuns(fields: ParsedCronField[], mode: CronMode): { local: string; utc: string }[] {
  const results: { local: string; utc: string }[] = [];
  let current = new Date();
  
  // Start from next minute
  current.setSeconds(0, 0);
  current.setMinutes(current.getMinutes() + 1);

  const minuteField = fields[0];
  const hourField = fields[1];
  const domField = fields[2];
  const monthField = fields[3];
  const dowField = fields[4];

  const minuteValues = minuteField.values;
  const hourValues = hourField.values;
  const domValues = domField.values;
  const monthValues = monthField.values;
  const dowValues = dowField.values;

  const isAws = mode === 'aws';
  
  while (results.length < 10) {
    const month = current.getMonth() + 1;
    const dayOfMonth = current.getDate();
    let dayOfWeek = current.getDay(); // 0 = Sunday
    if (isAws) dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // AWS: 1=Mon ... 7=Sun

    const matchesMinute = minuteValues.includes(current.getMinutes());
    const matchesHour = hourValues.includes(current.getHours());
    const matchesMonth = monthValues.includes(month);
    const matchesDom = domValues.includes(dayOfMonth);
    const matchesDow = dowValues.includes(dayOfWeek);

    // Cron logic: both DOM and DOW specified -> OR logic; otherwise AND
    const domSpecified = domField.raw !== '*';
    const dowSpecified = dowField.raw !== '*';
    let matchesDay = false;
    if (domSpecified && dowSpecified) {
      matchesDay = matchesDom || matchesDow;
    } else if (domSpecified) {
      matchesDay = matchesDom;
    } else if (dowSpecified) {
      matchesDay = matchesDow;
    } else {
      matchesDay = true;
    }

    if (matchesMinute && matchesHour && matchesMonth && matchesDay) {
      const localStr = current.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
      const utcStr = current.toISOString().replace('T', ' ').replace('Z', ' UTC');
      results.push({ local: localStr, utc: utcStr });
    }

    current.setMinutes(current.getMinutes() + 1);
    
    // Safety break
    if (results.length === 0 && current.getFullYear() > new Date().getFullYear() + 2) break;
  }

  return results;
}

export function getModeFromSelector(value: string): CronMode {
  switch (value) {
    case 'aws': return 'aws';
    case 'github': return 'github';
    default: return 'linux';
  }
}
