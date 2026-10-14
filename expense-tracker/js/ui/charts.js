// Two small SVG charts: a donut for the category breakdown and a bar chart
// for the monthly trend. They return markup strings.

import { esc } from './dom.js';

/**
 * segments: [{ value, color }]. The center shows two lines of text.
 * `label` is read by screen readers in place of the drawing.
 */
export function donut(segments, { size = 128, thickness = 16, centerTop = '', centerBottom = '', label = '' } = {}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const gap = segments.length > 1 ? 2 : 0;
  let offset = 0;

  const arcs = total
    ? segments
        .map((s) => {
          const length = (s.value / total) * c;
          const dash = Math.max(0.5, length - gap);
          const arc = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${esc(s.color)}" stroke-width="${thickness}" stroke-dasharray="${dash} ${c - dash}" stroke-dashoffset="${-offset}"/>`;
          offset += length;
          return arc;
        })
        .join('')
    : '';

  return `
    <svg class="donut" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${thickness}"/>
      <g transform="rotate(-90 ${size / 2} ${size / 2})">${arcs}</g>
      <text class="donut-total" x="50%" y="${size / 2 - 2}" text-anchor="middle">${esc(centerTop)}</text>
      <text class="donut-caption" x="50%" y="${size / 2 + 14}" text-anchor="middle">${esc(centerBottom)}</text>
    </svg>`;
}

/**
 * series: [{ label, value, valueLabel, current }]. Optional `budget` draws a
 * dashed line at that value.
 */
export function bars(series, { width = 320, height = 168, budget = 0, label = '' } = {}) {
  const top = 18;
  const bottom = 22;
  const chartH = height - top - bottom;
  const max = Math.max(1, budget, ...series.map((s) => s.value)) * 1.08;
  const slot = width / series.length;
  const barW = Math.min(32, slot * 0.56);
  const y = (v) => top + chartH - (v / max) * chartH;

  const items = series
    .map((s, i) => {
      const x = i * slot + (slot - barW) / 2;
      const h = Math.max(s.value ? 3 : 0, (s.value / max) * chartH);
      const cx = x + barW / 2;
      return `
        <rect class="bar${s.current ? ' is-current' : ''}" x="${x}" y="${top + chartH - h}" width="${barW}" height="${h}" rx="6"/>
        ${s.value ? `<text class="bar-value" x="${cx}" y="${top + chartH - h - 5}" text-anchor="middle">${esc(s.valueLabel)}</text>` : ''}
        <text class="bar-label" x="${cx}" y="${height - 5}" text-anchor="middle">${esc(s.label)}</text>`;
    })
    .join('');

  const line = budget
    ? `<line class="budget-line" x1="0" x2="${width}" y1="${y(budget)}" y2="${y(budget)}"/>`
    : '';

  return `<svg class="bars" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">${line}${items}</svg>`;
}
