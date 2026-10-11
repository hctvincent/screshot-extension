// file: lib/ui/notificationManager.js

/**
 * Editor toasts. They go through the extension's shared toaster (extension/ui/ui.js, Fluent
 * style, bottom center), so the editor, the full-page viewer and the Share panel all show
 * notifications in the same place and the same way.
 *
 *   const t = Notifier.show({ message: "Copying…", type: "loading", duration: null });
 *   t.update({ message: "Copied to clipboard", type: "success" });
 */
const INTENT = { info: "info", success: "success", error: "error", warning: "warning", loading: "progress" };

const toOptions = ({ message, body, type = "info", duration }) => ({
    intent: INTENT[type] || "info",
    title: message,
    body,
    ...(duration === undefined ? {} : { timeout: duration }),
});

const Notifier = {
    /**
     * @param {object} options
     * @param {string} options.message
     * @param {string} [options.body]
     * @param {'info'|'success'|'error'|'warning'|'loading'} [options.type='info']
     * @param {number|null} [options.duration] ms; null keeps it until updated or dismissed.
     */
    show(options) {
        const ui = typeof window !== 'undefined' && window.ScreshotUI;
        if (!ui) {
            // Outside the extension (the tool's own dev page): log instead of a toast.
            console.info(`[${options.type || 'info'}] ${options.message}`);
            return { update: () => {}, dismiss: () => {} };
        }
        const handle = ui.toast(toOptions(options));
        return {
            update: (next) => handle.update(toOptions({ ...options, ...next })),
            dismiss: handle.dismiss,
        };
    },
};

export default Notifier;
