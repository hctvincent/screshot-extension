import {
    createElement,
    Move, Pencil, Highlighter, PenLine, MoveUpRight, Square, Circle, Type,
    Palette, Undo2, Redo2, Download, Copy, X,
} from 'lucide';

// Lucide icon -> chuỗi SVG để gán vào innerHTML của nút menu
const icon = (node) => createElement(node).outerHTML;

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
            li.className = 'toolSelect';
            
            const a = document.createElement('a');
            a.id = item.id;
            a.title = item.title;
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
        return [
            { id: 'move', title: 'Move', type: 'move', icon: icon(Move) },
            { id: 'pencil', title: 'Pencil', type: 'tool', icon: icon(Pencil) },
            { id: 'line', title: 'Line', type: 'tool', icon: icon(PenLine) },
            { id: 'marker', title: 'Marker', type: 'tool', icon: icon(Highlighter) },
            { id: 'lineArrow', title: 'Line Arrow', type: 'tool', icon: icon(MoveUpRight) },
            { id: 'rect', title: 'Rect', type: 'tool', icon: icon(Square) },
            { id: 'ellipse', title: 'Ellipse', type: 'tool', icon: icon(Circle) },
            { id: 'text', title: 'Text', type: 'tool', icon: icon(Type) },
            // It's better to create the color input with a label for accessibility
            { id: 'color-picker', title: 'Color', type: 'color', value: `<label for="inputColor" class="color-picker-label">${icon(Palette)}</label><input type="color" value="#ff0000" id="inputColor">`},
            { id: 'undo', title: 'Undo', type: 'control', icon: icon(Undo2) },
            { id: 'redo', title: 'Redo', type: 'control', icon: icon(Redo2) },
            { id: 'save', title: 'Save', type: 'action', icon: icon(Download) },
            { id: 'copy', title: 'Copy to Clipboard', type: 'action', icon: icon(Copy) },
            { id: 'close', title: 'Close', type: 'close', icon: icon(X) }
        ];
    }
}