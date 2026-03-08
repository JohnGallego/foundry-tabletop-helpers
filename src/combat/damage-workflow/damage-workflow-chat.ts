/**
 * Damage Workflow — Chat Output
 *
 * Constructs and posts a consolidated chat message showing the results
 * of a damage/save/condition workflow: each target's save roll, pass/fail,
 * damage or healing applied, condition changes, and concentration checks.
 */

import { Log } from "../../logger";
import { getGame } from "../../types";
import type { WorkflowResult, ConcentrationCheck } from "../combat-types";
import { WORKFLOW_LABELS } from "../combat-types";

/* ── Public API ───────────────────────────────────────────── */

/**
 * Post the workflow results as a chat message (whispered to GM).
 */
export async function postWorkflowChat(result: WorkflowResult): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ChatMessage = (globalThis as any).ChatMessage;
  if (!ChatMessage || typeof ChatMessage.create !== "function") {
    Log.warn("Damage Workflow: ChatMessage not available");
    return;
  }

  const content = buildChatHTML(result);
  const game = getGame();
  const whisper = game?.user?.id ? [game.user.id] : [];

  try {
    await ChatMessage.create({
      content,
      speaker: { alias: "Combat Workflow" },
      whisper,
    });
  } catch (err) {
    Log.error("Damage Workflow: failed to create chat message", err);
  }
}

/* ── HTML Construction ────────────────────────────────────── */

function buildChatHTML(result: WorkflowResult): string {
  const { input } = result;

  if (input.type === "saveForCondition") return buildConditionSaveHTML(result);
  if (input.type === "removeCondition") return buildRemoveConditionHTML(result);
  return buildDamageHTML(result);
}

/* ── Damage / Heal / Save Chat Card ──────────────────────── */

function buildDamageHTML(result: WorkflowResult): string {
  const { input, targets, concentrationChecks } = result;
  const typeLabel = WORKFLOW_LABELS[input.type];
  const isSave = input.type === "saveForHalf" || input.type === "saveOrNothing";
  const isHeal = input.type === "healing";

  // Header
  let header = `<strong>${esc(typeLabel)}</strong>`;
  if (isSave && input.dc && input.ability) {
    header += ` — DC ${input.dc} ${input.ability.toUpperCase()}`;
  }
  header += ` — ${input.amount} ${isHeal ? "healing" : (input.damageType ? esc(input.damageType) : "damage")}`;

  // Result rows
  const rows = targets.map((t) => {
    const nameCell = `<td class="fth-wf-name">${esc(t.name)}</td>`;

    let saveCell = "";
    if (isSave) {
      const passClass = t.saveSuccess ? "fth-wf-pass" : "fth-wf-fail";
      const passLabel = t.saveSuccess ? "Pass" : "Fail";
      const rollDisplay = t.saveRoll !== undefined ? String(t.saveRoll) : "—";
      saveCell = `<td class="fth-wf-save ${passClass}">${rollDisplay} <span class="fth-wf-badge">${passLabel}</span></td>`;
    }

    let effectCell: string;
    if (isHeal) {
      const healed = Math.abs(t.damageApplied);
      effectCell = `<td class="fth-wf-effect fth-wf-heal">+${healed}</td>`;
    } else {
      effectCell = `<td class="fth-wf-effect fth-wf-dmg">${t.damageApplied > 0 ? `-${t.damageApplied}` : "0"}</td>`;
    }

    const hpCell = `<td class="fth-wf-hp">${t.hpAfter}/${t.hpMax}</td>`;

    return `<tr>${nameCell}${saveCell}${effectCell}${hpCell}</tr>`;
  }).join("");

  // Summary
  const totalEffect = targets.reduce((sum, t) => sum + Math.abs(t.damageApplied), 0);
  const summaryLabel = isHeal
    ? `${totalEffect} HP healed`
    : `${totalEffect} total damage`;

  let saveSummary = "";
  if (isSave) {
    const passed = targets.filter((t) => t.saveSuccess).length;
    const failed = targets.length - passed;
    saveSummary = ` — ${passed} passed, ${failed} failed`;
  }

  // Concentration section
  const concSection = buildConcentrationSection(concentrationChecks);

  return `
    <div class="fth-workflow-result">
      <div class="fth-wf-header">${header}</div>
      <table class="fth-wf-table">
        <tbody>${rows}</tbody>
      </table>
      ${concSection}
      <div class="fth-wf-summary">${summaryLabel}${saveSummary}</div>
    </div>
  `;
}

/* ── Save for Condition Chat Card ────────────────────────── */

function buildConditionSaveHTML(result: WorkflowResult): string {
  const { input, targets } = result;
  const condLabel = input.conditionLabel ?? input.conditionId ?? "condition";

  let header = `<strong>Save vs Condition</strong>`;
  if (input.dc && input.ability) {
    header += ` — DC ${input.dc} ${input.ability.toUpperCase()}`;
  }
  header += ` — ${esc(condLabel)}`;

  const rows = targets.map((t) => {
    const nameCell = `<td class="fth-wf-name">${esc(t.name)}</td>`;
    const passClass = t.saveSuccess ? "fth-wf-pass" : "fth-wf-fail";
    const passLabel = t.saveSuccess ? "Pass" : "Fail";
    const rollDisplay = t.saveRoll !== undefined ? String(t.saveRoll) : "—";
    const saveCell = `<td class="fth-wf-save ${passClass}">${rollDisplay} <span class="fth-wf-badge">${passLabel}</span></td>`;

    let statusCell: string;
    if (t.saveSuccess) {
      statusCell = `<td class="fth-wf-effect fth-wf-cond-resisted">Resisted</td>`;
    } else if (t.conditionApplied) {
      statusCell = `<td class="fth-wf-effect fth-wf-cond-applied"><span class="fth-wf-badge fth-wf-cond-badge">${esc(condLabel)}</span></td>`;
    } else {
      statusCell = `<td class="fth-wf-effect fth-wf-cond-skipped">Skipped</td>`;
    }

    return `<tr>${nameCell}${saveCell}${statusCell}</tr>`;
  }).join("");

  const passed = targets.filter((t) => t.saveSuccess).length;
  const failed = targets.length - passed;

  return `
    <div class="fth-workflow-result">
      <div class="fth-wf-header">${header}</div>
      <table class="fth-wf-table">
        <tbody>${rows}</tbody>
      </table>
      <div class="fth-wf-summary">${passed} resisted, ${failed} affected</div>
    </div>
  `;
}

/* ── Remove Condition Chat Card ──────────────────────────── */

function buildRemoveConditionHTML(result: WorkflowResult): string {
  const { input, targets } = result;
  const condLabel = input.conditionLabel ?? input.conditionId ?? "condition";

  const header = `<strong>Remove Condition</strong> — ${esc(condLabel)}`;

  const rows = targets.map((t) => {
    const nameCell = `<td class="fth-wf-name">${esc(t.name)}</td>`;
    const statusCell = t.conditionApplied
      ? `<td class="fth-wf-effect fth-wf-cond-removed">Removed</td>`
      : `<td class="fth-wf-effect fth-wf-cond-absent">Not present</td>`;
    return `<tr>${nameCell}${statusCell}</tr>`;
  }).join("");

  const removed = targets.filter((t) => t.conditionApplied).length;

  return `
    <div class="fth-workflow-result">
      <div class="fth-wf-header">${header}</div>
      <table class="fth-wf-table">
        <tbody>${rows}</tbody>
      </table>
      <div class="fth-wf-summary">${removed} of ${targets.length} removed</div>
    </div>
  `;
}

/* ── Concentration Check Section ─────────────────────────── */

function buildConcentrationSection(checks?: ConcentrationCheck[]): string {
  if (!checks || checks.length === 0) return "";

  const rows = checks.map((c) => {
    const passClass = c.success ? "fth-wf-pass" : "fth-wf-fail";
    const badge = c.success
      ? `<span class="fth-wf-badge">Held</span>`
      : `<span class="fth-wf-badge fth-wf-conc-lost">LOST</span>`;
    return `<tr>
      <td class="fth-wf-name">${esc(c.name)}</td>
      <td class="fth-wf-save ${passClass}">${c.roll} vs DC ${c.dc} ${badge}</td>
    </tr>`;
  }).join("");

  return `
    <div class="fth-wf-conc-section">
      <div class="fth-wf-conc-header"><i class="fa-solid fa-brain"></i> Concentration</div>
      <table class="fth-wf-table">
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* ── Helpers ──────────────────────────────────────────────── */

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
