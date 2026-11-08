// src/main.ts
import { parseCronExpression, getModeFromSelector, CronParseResult } from './tool.ts';
import { initTheme } from './theme.ts';
import { initModals } from './modals.ts';
import { showToast } from './toast.ts';
import { auditCookies } from './cookies.ts';
import { auditVault } from './vault.ts';

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatResult(result: CronParseResult): string {
  const lines: string[] = [];
  
  lines.push(`Mode: ${result.mode.toUpperCase()}`);
  lines.push(`Expression: ${result.expression}`);
  lines.push('');
  
  if (!result.valid) {
    lines.push('VALIDATION ERRORS:');
    result.errors.forEach(err => lines.push(`  - ${err}`));
    lines.push('');
    lines.push('FIELD DETAILS:');
  }

  result.fields.forEach(field => {
    const status = field.valid ? '✓' : '✗';
    lines.push(`${status} ${field.name}: ${field.raw}`);
    lines.push(`    → ${field.description}`);
    if (field.error) {
      lines.push(`    → Error: ${field.error}`);
    }
  });

  lines.push('');
  lines.push('EXPLANATION:');
  lines.push(result.explanation || '(none)');

  if (result.nextRuns.length > 0) {
    lines.push('');
    lines.push('NEXT 10 RUNS:');
    result.nextRuns.forEach((run, i) => {
      lines.push(`${String(i + 1).padStart(2)}. Local: ${run.local}`);
      lines.push(`    UTC:   ${run.utc}`);
    });
  }

  return lines.join('\n');
}

function renderResult(result: CronParseResult): void {
  const output = document.getElementById('output-region');
  if (!output) return;
  
  const formatted = formatResult(result);
  const pre = document.createElement('pre');
  pre.textContent = formatted;
  pre.style.whiteSpace = 'pre-wrap';
  pre.style.fontFamily = 'monospace';
  pre.style.fontSize = '0.875rem';
  pre.style.lineHeight = '1.6';
  
  output.innerHTML = '';
  output.appendChild(pre);
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initModals();
  auditCookies();
  auditVault();

  const input = document.getElementById('app-input') as HTMLTextAreaElement;
  const processBtn = document.getElementById('action-process') as HTMLButtonElement;
  const clearBtn = document.getElementById('action-clear') as HTMLButtonElement;
  const copyBtn = document.getElementById('action-copy') as HTMLButtonElement;
  const modeSelect = document.getElementById('mode-select') as HTMLSelectElement;

  if (!input || !processBtn || !clearBtn || !copyBtn || !modeSelect) {
    console.error('Required DOM elements not found');
    return;
  }

  processBtn.addEventListener('click', () => {
    const expression = input.value.trim();
    const mode = getModeFromSelector(modeSelect.value);
    
    if (!expression) {
      showToast('Please enter a cron expression');
      return;
    }

    try {
      const result = parseCronExpression(expression, mode);
      renderResult(result);
      showToast(result.valid ? 'Cron expression parsed successfully' : 'Invalid cron expression');
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    const output = document.getElementById('output-region');
    if (output) output.innerHTML = '<p class="placeholder">Enter a cron expression and click Explain Cron</p>';
    showToast('Cleared');
  });

  copyBtn.addEventListener('click', async () => {
    const output = document.getElementById('output-region');
    if (!output) return;
    
    const text = output.textContent || '';
    if (!text.trim() || text.includes('Enter a cron expression')) {
      showToast('Nothing to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!');
    } catch {
      showToast('Failed to copy');
    }
  });
});
