const events = ['MouseMove', 'MouseUp', 'MouseDown', 'DblClick'] as const;

export type MouseEventName = typeof events[number];
export type MouseEventHandlerName = `on${MouseEventName}`;

