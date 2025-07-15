// file: lib/ui/NotificationManager.js

/**
 * Manages displaying toast/indicator notifications.
 * Implemented as a Singleton to ensure only one manager instance controls notifications.
 */
class NotificationManager {
    static instance;

    constructor() {
        if (NotificationManager.instance) {
            return NotificationManager.instance;
        }

        this.container = null;
        this.activeNotification = null;
        this.hideTimeout = null;

        NotificationManager.instance = this;
    }

    /**
     * Gets the singleton instance of the NotificationManager.
     * @returns {NotificationManager}
     */
    static getInstance() {
        if (!NotificationManager.instance) {
            NotificationManager.instance = new NotificationManager();
        }
        return NotificationManager.instance;
    }

    /**
     * Creates the main container for notifications if it doesn't exist.
     * @private
     */
    _createContainer() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);
    }

    /**
     * Displays a notification.
     * @param {object} options
     * @param {string} options.message - The message to display.
     * @param {'info' | 'success' | 'error' | 'loading'} [options.type='info'] - The type of notification.
     * @param {number | null} [options.duration=2000] - Duration in ms. `null` for persistent.
     */
    show({ message, type = 'info', duration = 2000 }) {
        this._createContainer();

        // If a notification is already showing, hide it first before showing the new one.
        if (this.activeNotification) {
            this._hide();
        }

        // Clear any pending hide timeouts
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        // Create the new notification element
        this.activeNotification = document.createElement('div');
        this.activeNotification.className = `notification-toast notification-${type}`;
        this.activeNotification.textContent = message;

        this.container.appendChild(this.activeNotification);

        // Trigger enter animation
        requestAnimationFrame(() => {
            this.activeNotification.classList.add('is-visible');
        });

        // Set a timeout to hide it, unless duration is null
        if (duration !== null) {
            this.hideTimeout = setTimeout(() => {
                this._hide();
            }, duration);
        }
    }

    /**
     * Hides the currently active notification.
     * @private
     */
    _hide() {
        if (!this.activeNotification) return;

        const elToHide = this.activeNotification;
        this.activeNotification = null;

        elToHide.classList.remove('is-visible');

        // Remove the element from the DOM after the animation completes
        elToHide.addEventListener('transitionend', () => {
            if (elToHide.parentNode) {
                elToHide.parentNode.removeChild(elToHide);
            }
        }, { once: true });
    }
}

// Export the singleton instance directly for easy use
const Notifier = NotificationManager.getInstance();
export default Notifier;