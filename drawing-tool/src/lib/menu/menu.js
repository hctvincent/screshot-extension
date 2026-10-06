import { ICONS } from './icons';

/**
 * Manages the creation, rendering, and interaction of a draggable toolbar menu.
 */
export default class Menu {
    /**
     * @param {HTMLElement} elem - The main container element for the drawing core.
     * @param {Array<Object>} [menuConfig] - Optional custom menu configuration.
     */
    constructor(elem, menuConfig) {
        this.elem = elem;
        
        // --- DOM Elements ---
        this.menuElement = null; // The main <ul> element for the menu

        // --- Drag State ---
        this.isDragging = false;
        this.hasBeenMoved = false; // true khi người dùng đã tự kéo menu
        this.startX = 0;
        this.startY = 0;
        this.startLeft = 0;
        this.startTop = 0;

        // --- Event Handlers (pre-bound) ---
        // Binding here avoids creating new functions in event listeners, which is more performant.
        this._onDragStart = this._onDragStart.bind(this);
        this._onDrag = this._onDrag.bind(this);
        this._onDragEnd = this._onDragEnd.bind(this);
        
        // Use the provided menu config or a default one
        this.menuConfig = menuConfig || this._getDefaultMenuConfig();
    }

    /**
     * Creates and displays the menu at a specific position.
     * @param {number} top - The initial top position.
     * @param {number} left - The initial left position.
     */
    createMenu(top, left) {
        if (this.menuElement) {
            // If menu already exists, just update its position
            this.setPosition(left, top);
            return;
        }

        this.menuElement = document.createElement('ul');
        this.menuElement.className = 'drawing-menu';
        
        // Render menu items
        this.menuConfig.forEach(item => {
            const li = document.createElement('li');
            if (item.type === 'separator') {
                li.className = 'separator';
                li.setAttribute('role', 'separator');
                this.menuElement.appendChild(li);
                return;
            }
            li.className = 'toolSelect';
            
            const a = document.createElement('a');
            a.id = item.id;
            a.title = item.title;
            a.setAttribute('aria-label', item.title);
            a.className = item.type;
            a.dataset.type = item.type;
            a.innerHTML = item.icon ? item.icon : item.value;

            // Add drag listener specifically to the move handle
            if (item.type === 'move') {
                a.addEventListener('mousedown', this._onDragStart, false);
                a.addEventListener('touchstart', this._onDragStart, { passive: false }); // Use passive:false for touch
            }

            li.appendChild(a);
            this.menuElement.appendChild(li);
        });

        document.body.appendChild(this.menuElement);
        this.setPosition(left, top);
    }
    
    /**
     * Sets the position of the menu, constrained within the viewport.
     * @param {number} left - The new left position.
     * @param {number} top - The new top position.
     */
    setPosition(left, top) {
        if (!this.menuElement) return;

        // Constrain the menu within the window boundaries
        const menuWidth = this.menuElement.clientWidth;
        const menuHeight = this.menuElement.clientHeight;

        if (top < 0) top = 0;
        if (top > window.innerHeight - menuHeight) top = window.innerHeight - menuHeight;
        if (left < 0) left = 0;
        if (left > window.innerWidth - menuWidth) left = window.innerWidth - menuWidth;

        this.menuElement.style.left = `${left}px`;
        this.menuElement.style.top = `${top}px`;
    }

    /**
     * Removes the menu from the DOM and cleans up event listeners.
     */
    destroy() {
        if (this.menuElement) {
            // Remove drag listeners from the move handle
            const moveHandle = this.menuElement.querySelector('#move');
            if(moveHandle) {
                moveHandle.removeEventListener('mousedown', this._onDragStart, false);
                moveHandle.removeEventListener('touchstart', this._onDragStart, false);
            }

            // Remove drag listeners from the window (if they are active)
            this._removeDragListeners();

            // Remove the menu element from the DOM
            this.menuElement.parentNode.removeChild(this.menuElement);
            this.menuElement = null;
        }
    }

    // --- Private Methods for Dragging ---

    /**
     * Initiates the drag operation on mousedown/touchstart.
     * @private
     * @param {MouseEvent|TouchEvent} e - The event object.
     */
    _onDragStart(e) {
        // Prevent default browser actions, like text selection or page scrolling on touch
        e.preventDefault();
        
        this.isDragging = true;
        this.menuElement.classList.add('is-dragging');

        const coords = this._getEventCoords(e);
        this.startX = coords.x;
        this.startY = coords.y;

        this.startLeft = this.menuElement.offsetLeft;
        this.startTop = this.menuElement.offsetTop;

        // IMPORTANT: Attach move/end listeners to the window ONLY when dragging starts.
        window.addEventListener('mousemove', this._onDrag, false);
        window.addEventListener('mouseup', this._onDragEnd, false);
        window.addEventListener('touchmove', this._onDrag, { passive: false });
        window.addEventListener('touchend', this._onDragEnd, false);
    }

    /**
     * Handles the dragging movement.
     * @private
     * @param {MouseEvent|TouchEvent} e - The event object.
     */
    _onDrag(e) {
        if (!this.isDragging) return;
        
        // Prevent scrolling while dragging
        e.preventDefault();

        const coords = this._getEventCoords(e);
        const newLeft = this.startLeft + (coords.x - this.startX);
        const newTop = this.startTop + (coords.y - this.startY);

        this.setPosition(newLeft, newTop);
        this.hasBeenMoved = true;
    }

    /**
     * Finalizes the drag operation on mouseup/touchend.
     * @private
     */
    _onDragEnd() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.menuElement.classList.remove('is-dragging');
        
        // IMPORTANT: Remove listeners from the window to stop tracking mouse movements.
        this._removeDragListeners();
    }

    /**
     * Helper to remove all drag-related window event listeners.
     * @private
     */
    _removeDragListeners() {
        window.removeEventListener('mousemove', this._onDrag, false);
        window.removeEventListener('mouseup', this._onDragEnd, false);
        window.removeEventListener('touchmove', this._onDrag, false);
        window.removeEventListener('touchend', this._onDragEnd, false);
    }

    /**
     * A helper function to get unified coordinates from both mouse and touch events.
     * @private
     * @param {MouseEvent|TouchEvent} e - The event object.
     * @returns {{x: number, y: number}} - The page coordinates.
     */
    _getEventCoords(e) {
        if (e.touches && e.touches.length) {
            return { x: e.touches[0].pageX, y: e.touches[0].pageY };
        }
        return { x: e.pageX, y: e.pageY };
    }
    
    /**
     * Provides the default configuration for menu items.
     * @private
     * @returns {Array<Object>}
     */
    _getDefaultMenuConfig() {
        const sep = { type: 'separator' };
        return [
            { id: 'move', title: 'Drag to move the toolbar', type: 'move', icon: ICONS.grip },
            sep,
            { id: 'pencil', title: 'Pencil (Ctrl+Alt+P)', type: 'tool', icon: ICONS.pencil },
            { id: 'line', title: 'Line (Ctrl+Alt+L)', type: 'tool', icon: ICONS.line },
            { id: 'marker', title: 'Highlighter (Ctrl+Alt+H)', type: 'tool', icon: ICONS.highlighter },
            { id: 'lineArrow', title: 'Arrow (Ctrl+Alt+A)', type: 'tool', icon: ICONS.arrow },
            { id: 'rect', title: 'Rectangle (Ctrl+Alt+R)', type: 'tool', icon: ICONS.rect },
            { id: 'ellipse', title: 'Ellipse (Ctrl+Alt+E)', type: 'tool', icon: ICONS.ellipse },
            { id: 'text', title: 'Text (Ctrl+Alt+T)', type: 'tool', icon: ICONS.text },
            { id: 'blur', title: 'Blur sensitive info (Ctrl+Alt+B)', type: 'tool', icon: ICONS.blur },
            sep,
            // The swatch itself is the button: it always shows the current color.
            { id: 'color-picker', title: 'Color (Ctrl+Alt+K)', type: 'color', value: '<input type="color" value="#ff0000" id="inputColor" aria-label="Color">' },
            sep,
            { id: 'undo', title: 'Undo (Ctrl+Alt+Z)', type: 'control', icon: ICONS.undo },
            { id: 'redo', title: 'Redo (Ctrl+Alt+Y)', type: 'control', icon: ICONS.redo },
            sep,
            { id: 'copy', title: 'Copy to clipboard (Ctrl+Alt+C)', type: 'action', icon: ICONS.copy },
            { id: 'save', title: 'Download PNG (Ctrl+Alt+S)', type: 'action', icon: ICONS.download },
            sep,
            { id: 'close', title: 'Close (Esc)', type: 'close', icon: ICONS.close },
        ];
    }
}