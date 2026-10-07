// Screshot toolbar icon set.
//
// Grid: 20×20 viewBox rendered at exactly 20×20 CSS px (no scaling).
// Stroke: 1.5px, round caps and joins, currentColor.
// Pixel alignment: straight edges sit on .25/.75 coordinates, so on 2x displays a 1.5px
// stroke covers exactly 3 device pixels with no anti-aliased fringe.
// Keylines: shapes share one 12.5×10.5 box (x 3.75–16.25, y 4.75–15.25); diagonal icons
// run corner to corner from (4.75, 15.25) to (15.25, 4.75) so every glyph has the same weight.

const svg = (body) =>
    `<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
    // Drag handle for the toolbar (6 dots).
    grip: svg(
        [7.5, 12.5].flatMap((x) => [5.5, 10, 14.5].map((y) => `<circle cx="${x}" cy="${y}" r="1.25" fill="currentColor" stroke="none"/>`)).join('')
    ),
    pencil: svg(
        '<path d="M12.75 4.25a1.77 1.77 0 0 1 2.5 0l.5.5a1.77 1.77 0 0 1 0 2.5L7.5 15.5l-3.75.75.75-3.75z"/><path d="M11.25 5.75l3 3"/>'
    ),
    line: svg('<path d="M6.25 13.75l7.5-7.5"/><circle cx="5" cy="15" r="1.5"/><circle cx="15" cy="5" r="1.5"/>'),
    // Long marker body with a chisel tip, and the highlighted stroke it leaves.
    highlighter: svg(
        '<path d="M12.75 3.75l3.5 3.5-6 6-3.5-3.5z"/><path d="M6.75 9.75l-2 4 1.5 1.5 4-2"/><path d="M11.75 16.25h4.5"/>'
    ),
    arrow: svg('<path d="M4.75 15.25l10.5-10.5"/><path d="M8.25 4.75h7v7"/>'),
    rect: svg('<rect x="3.75" y="4.75" width="12.5" height="10.5" rx="2"/>'),
    ellipse: svg('<ellipse cx="10" cy="10" rx="6.25" ry="5.25"/>'),
    text: svg('<path d="M4.75 6.25v-1.5h10.5v1.5"/><path d="M10 4.75v10.5"/><path d="M7.75 15.25h4.5"/>'),
    // Pixelated square: the blur tool pixelates the region.
    blur: svg(
        '<rect x="3.75" y="3.75" width="12.5" height="12.5" rx="2"/>' +
            [[6.25, 6.25], [11.25, 6.25], [8.75, 8.75], [6.25, 11.25], [11.25, 11.25]]
                .map(([x, y]) => `<rect x="${x}" y="${y}" width="2.5" height="2.5" fill="currentColor" stroke="none"/>`)
                .join('')
    ),
    undo: svg('<path d="M7.25 4.75L3.75 8.25l3.5 3.5"/><path d="M3.75 8.25h8a4 4 0 0 1 0 8h-2"/>'),
    redo: svg('<path d="M12.75 4.75l3.5 3.5-3.5 3.5"/><path d="M16.25 8.25h-8a4 4 0 0 0 0 8h2"/>'),
    copy: svg(
        '<rect x="7.25" y="7.25" width="9" height="9" rx="1.75"/><path d="M12.75 7.25v-1.5a2 2 0 0 0-2-2h-5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h1.5"/>'
    ),
    download: svg(
        '<path d="M10 3.75v8.5"/><path d="M6.25 8.75L10 12.5l3.75-3.75"/><path d="M3.75 13.75v.5a2 2 0 0 0 2 2h8.5a2 2 0 0 0 2-2v-.5"/>'
    ),
    // Link (share by link).
    share: svg(
        '<path d="M8.25 11.75l3.5-3.5"/><path d="M10.75 6.25l1.25-1.25a3.18 3.18 0 0 1 4.5 4.5l-1.25 1.25"/><path d="M9.25 13.75L8 15a3.18 3.18 0 0 1-4.5-4.5l1.25-1.25"/>'
    ),
    close: svg('<path d="M5.25 5.25l9.5 9.5"/><path d="M14.75 5.25l-9.5 9.5"/>'),
};
