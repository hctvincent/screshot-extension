/**
 * A tool for erasing parts of the canvas.
 * It works by drawing a continuous line with the 'destination-out' composite operation,
 * which effectively makes the affected pixels transparent.
 */
export class EraserTool {
    constructor(core) {
        // IMPORTANT: Eraser should act on the main canvas (contexto)
        // because 'destination-out' needs existing content to erase.
        this.context = core.contexto; 
        this.core = core;

        // --- Tool State ---
        this.isDrawing = false;
        // The eraser size can be configured here or passed from the core
        this.eraserSize = core.lineWidth || 16;

        // Bind methods to ensure 'this' is correct
        this.mousedown = this.mousedown.bind(this);
        this.mousemove = this.mousemove.bind(this);
        this.mouseup = this.mouseup.bind(this);
        this.mouseleave = this.mouseleave.bind(this);
    }

    /**
     * Prepares the context for erasing. This is called by DrawingCore when the tool is selected.
     */
    activate() {
        // Set the composite operation to 'destination-out'.
        // Anything drawn will now erase the existing content.
        this.context.globalCompositeOperation = 'destination-out';
        this.context.lineWidth = this.eraserSize;
        this.context.lineCap = 'round'; // Makes the eraser feel smoother
        this.context.lineJoin = 'round';
    }

    /**
     * Resets the context when the tool is deselected. Called by DrawingCore.
     */
    deactivate() {
        // Reset to default drawing mode for other tools.
        this.context.globalCompositeOperation = 'source-over';
        // Reset line styles that might have been changed
        this.context.lineCap = 'butt';
        this.context.lineJoin = 'miter';
    }

    /**
     * Handles the mousedown event to start erasing.
     * @param {MouseEvent} e - The mouse event, with normalized _x and _y coordinates.
     */
    mousedown(e) {
        this.isDrawing = true;

        // Start a new path at the mouse position
        this.context.beginPath();
        this.context.moveTo(e._x, e._y);
    }

    /**
     * Handles the mousemove event to create the erase stroke.
     * @param {MouseEvent} e - The mouse event, with normalized _x and _y coordinates.
     */
    mousemove(e) {
        if (!this.isDrawing) return;

        // Draw a line to the new mouse position
        this.context.lineTo(e._x, e._y);
        this.context.stroke();
    }

    /**
     * Handles the mouseup event to finalize the erase action.
     * @param {MouseEvent} e - The mouse event.
     */
    mouseup(e) {
        if (this.isDrawing) {
            this.context.lineTo(e._x, e._y);
            this.context.stroke();
            this.isDrawing = false;
            
            // IMPORTANT: After erasing, we need to update the core's history
            // and the cropper's view.
            this.core.cPush();
            this.core.updateCropprImage();
        }
    }

    /**
     * Handles the mouseleave event to stop erasing.
     * @param {MouseEvent} e - The mouse event.
     */
    mouseleave(e) {
        if (this.isDrawing) {
            this.mouseup(e);
        }
    }
}