// file: lib/ui/modal.js

/**
 * A reusable modal component for displaying information and actions.
 */
export default class Modal {
    /**
     * @param {object} options
     * @param {string} options.title - The title of the modal.
     * @param {string | HTMLElement} options.content - The content of the modal (can be a string or an HTML element).
     * @param {Array<object>} [options.actions] - An array of action buttons to display.
     * @param {string} actions.label - The button's text.
     * @param {string} [actions.className] - CSS class for the button.
     * @param {function(modalInstance): void} actions.onClick - The callback function when the button is clicked.
     */
    constructor({ title, content, actions = [] }) {
        this.title = title;
        this.content = content;
        this.actions = actions;

        this._createElements();
        this._bindEvents();
        this._addEventListeners();

        document.body.appendChild(this.overlay);
        
        // Trigger enter animation
        requestAnimationFrame(() => {
            this.overlay.classList.add('is-visible');
            this.modalContainer.classList.add('is-visible');
        });
    }

    _createElements() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';

        this.modalContainer = document.createElement('div');
        this.modalContainer.className = 'modal-container';

        const header = document.createElement('div');
        header.className = 'modal-header';

        const titleEl = document.createElement('h2');
        titleEl.className = 'modal-title';
        titleEl.textContent = this.title;

        this.closeButton = document.createElement('button');
        this.closeButton.className = 'modal-close-button';
        this.closeButton.innerHTML = '×'; // 'X' icon
        this.closeButton.setAttribute('aria-label', 'Close modal');

        header.appendChild(titleEl);
        header.appendChild(this.closeButton);

        const body = document.createElement('div');
        body.className = 'modal-body';
        if (typeof this.content === 'string') {
            const contentParagraph = document.createElement('p');
            contentParagraph.textContent = this.content;
            body.appendChild(contentParagraph);
        } else if (this.content instanceof HTMLElement) {
            body.appendChild(this.content);
        }

        this.modalContainer.appendChild(header);
        this.modalContainer.appendChild(body);

        if (this.actions.length > 0) {
            const footer = document.createElement('div');
            footer.className = 'modal-footer';
            this.actions.forEach(action => {
                const button = document.createElement('button');
                button.textContent = action.label;
                button.className = `modal-action-button ${action.className || ''}`;
                button.addEventListener('click', () => action.onClick(this));
                footer.appendChild(button);
            });
            this.modalContainer.appendChild(footer);
        }

        this.overlay.appendChild(this.modalContainer);
    }

    _bindEvents() {
        this.close = this.close.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);
    }

    _addEventListeners() {
        this.closeButton.addEventListener('click', this.close);
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
        document.addEventListener('keydown', this._handleKeyDown);
    }

    _removeEventListeners() {
        document.removeEventListener('keydown', this._handleKeyDown);
    }

    _handleKeyDown(e) {
        if (e.key === 'Escape') {
            this.close();
        }
    }

    /**
     * Closes and removes the modal from the DOM.
     */
    close() {
        this._removeEventListeners();
        this.modalContainer.classList.remove('is-visible');
        this.overlay.classList.remove('is-visible');
        
        // Wait for the animation to finish before removing from DOM
        this.overlay.addEventListener('transitionend', () => {
            if (this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
        }, { once: true });
    }
}