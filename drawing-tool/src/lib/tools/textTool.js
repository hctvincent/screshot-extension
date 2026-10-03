/**
 * @class TextTool
 * Công cụ để thêm và chỉnh sửa văn bản trên canvas bằng cách sử dụng một <textarea> DOM.
 * Đã được refactor để sử dụng cấu trúc lớp hiện đại và arrow functions cho event handlers.
 */
export class TextTool {
    // --- Thuộc tính của lớp ---

    // Dependencies
    core;
    context;

    // Trạng thái công cụ
    isEditing = false;
    isMoving = false;

    // Tọa độ canvas và di chuyển
    canvasX = 0;
    canvasY = 0;
    moveOffsetX = 0;
    moveOffsetY = 0;

    // Các phần tử DOM được quản lý
    textWrapper = null;
    textarea = null;
    measureCtx = document.createElement('canvas').getContext('2d'); // đo chữ, không cần DOM

    // Hằng số và cài đặt font
    FONT_FAMILY = 'Helvetica';
    LINE_HEIGHT_MULTIPLIER = 1.25;
    WRAPPER_PADDING_PX = 3;
    TEXTAREA_BORDER_PX = 1;
    TEXTAREA_INTERNAL_PADDING_PX = 2;

    // Thuộc tính font động
    currentFontSizePx = 26;
    actualLineHeightPx = 0;

    /**
     * @param {object} core - Đối tượng core của ứng dụng vẽ.
     */
    constructor(core) {
        this.core = core;
        this.context = core.context;

        // Cập nhật lineHeight ban đầu dựa trên font size khởi tạo
        this._updateFontDependentMetrics();

        // Thiết lập các trình nghe sự kiện bên ngoài
        this._addToolSwitchListeners();
    }

    // --- Quản lý Font (Các phương thức này được gọi từ UI bên ngoài) ---

    increaseFontSize = (amount = 2) => {
        this.setFontSize(this.currentFontSizePx + amount);
    }

    decreaseFontSize = (amount = 2) => {
        this.setFontSize(this.currentFontSizePx - amount);
    }

    setFontSize = (size) => {
        if (size >= 8) { // Đặt giới hạn kích thước font tối thiểu
            this.currentFontSizePx = size;
            this._updateFontDependentMetrics();

            // Nếu đang trong chế độ chỉnh sửa, cập nhật textarea ngay lập tức
            if (this.isEditing) {
                this._applyStylesToTextarea();
                this._updateTextareaSize(); // <-- DÒNG SỬA LỖI QUAN TRỌNG
            }
        }
    }

    // Gọi từ core khi người dùng đổi màu: đổi màu chữ đang gõ ngay lập tức
    onColorChange = () => {
        this._applyStylesToTextarea();
    }

    // --- Event Handler chính của Canvas ---

    mousedown = (ev) => {
        // Nếu có một editor đang hoạt động, commit nó trước khi tạo cái mới.
        if (this.isEditing) {
            this._commitText();
        }

        this.isEditing = true;
        this.canvasX = ev._x;
        this.canvasY = ev._y;

        // Tạo các phần tử DOM để nhập liệu tại vị trí click
        this._createEditorElements(ev.clientX, ev.clientY);
    }
    

    // --- Các phương thức nội bộ (Private-like methods) ---

    _updateFontDependentMetrics() {
        this.actualLineHeightPx = Math.round(this.currentFontSizePx * this.LINE_HEIGHT_MULTIPLIER);
    }

    _createEditorElements(clientX, clientY) {
        this.textWrapper = document.createElement('div');
        Object.assign(this.textWrapper.style, {
            position: 'absolute',
            left: `${clientX}px`,
            top: `${clientY}px`,
            cursor: 'move',
            padding: `${this.WRAPPER_PADDING_PX}px`,
            zIndex: '1000', // Đảm bảo nó nổi trên các phần tử khác
        });

        this.textarea = document.createElement('textarea');
        this.textarea.setAttribute('class', 'text-tool-textarea');
        this.textarea.setAttribute('id', 'insertText');
        Object.assign(this.textarea.style, {
            padding: `${this.TEXTAREA_INTERNAL_PADDING_PX}px`,
            border: `${this.TEXTAREA_BORDER_PX}px dashed #888`,
            margin: '0',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            cursor: 'text',
            overflow: 'hidden',
            resize: 'none',
            boxSizing: 'border-box',
            outline: 'none',
            // Không tự xuống dòng: chỉ xuống dòng khi người dùng nhấn Enter,
            // giống hệt cách chữ được vẽ lên canvas.
            whiteSpace: 'pre',
            display: 'block',
        });
        this.textarea.wrap = 'off';
        this.textarea.spellcheck = false;

        this.textWrapper.appendChild(this.textarea);
        document.body.appendChild(this.textWrapper);

        this._applyStylesToTextarea();
        this._updateTextareaSize();
        this.textarea.focus();
        // 'input' chạy ngay khi nội dung đổi, trước khi trình duyệt vẽ frame,
        // nên textarea luôn đủ rộng cho ký tự mới => không bị giật/chớp.
        this.textarea.addEventListener('input', this._updateTextareaSize);
        this.textWrapper.addEventListener('mousedown', this._onTextWrapperMouseDown);
    }

    _applyStylesToTextarea() {
        if (!this.textarea) return;
        const fontStyle = `${this.currentFontSizePx}px ${this.FONT_FAMILY}`;
        
        this.textarea.style.font = fontStyle;
        this.textarea.style.lineHeight = `${this.actualLineHeightPx}px`;
        this.textarea.style.color = this.core.strokeStyle;
        
    }

    _updateTextareaSize = () => {
        if (!this.textarea) return;

        this.measureCtx.font = `${this.currentFontSizePx}px ${this.FONT_FAMILY}`;
        const lines = (this.textarea.value || ' ').split('\n');
        const maxWidth = Math.max(...lines.map((line) => this.measureCtx.measureText(line || ' ').width));

        const totalPaddingBorder = (this.TEXTAREA_INTERNAL_PADDING_PX * 2) + (this.TEXTAREA_BORDER_PX * 2);
        // Chừa thêm chỗ cho caret + ký tự kế tiếp để không bao giờ bị tràn trong lúc gõ.
        const caretRoom = Math.ceil(this.currentFontSizePx * 0.6);
        this.textarea.style.width = `${Math.ceil(maxWidth) + totalPaddingBorder + caretRoom}px`;
        this.textarea.style.height = `${(lines.length * this.actualLineHeightPx) + totalPaddingBorder}px`;
        this.textarea.scrollLeft = 0;
        this.textarea.scrollTop = 0;
    }

    // --- Các Event Handlers nội bộ cho DOM elements ---

    _onTextWrapperMouseDown = (e) => {
        if (e.target === this.textarea) return;

        e.preventDefault();
        this.isMoving = true;
        const wrapperRect = this.textWrapper.getBoundingClientRect();
        this.moveOffsetX = e.clientX - wrapperRect.left;
        this.moveOffsetY = e.clientY - wrapperRect.top;
        document.addEventListener('mousemove', this._onTextMouseMove);
        document.addEventListener('mouseup', this._onTextMouseUp, { once: true });
    }

    _onTextMouseMove = (e) => {
        if (!this.isMoving) return;
        e.preventDefault();
        this.textWrapper.style.left = `${e.clientX - this.moveOffsetX}px`;
        this.textWrapper.style.top = `${e.clientY - this.moveOffsetY}px`;
    }

    _onTextMouseUp = () => {
        if (!this.isMoving) return;
        this.isMoving = false;
        document.removeEventListener('mousemove', this._onTextMouseMove);
        
        if (this.textWrapper && this.core.canvas) {
            const canvasRect = this.core.canvas.getBoundingClientRect();
            const wrapperRect = this.textWrapper.getBoundingClientRect();
            this.canvasX = wrapperRect.left - canvasRect.left;
            this.canvasY = wrapperRect.top - canvasRect.top;
        }
        this.textarea?.focus();
    }
    
    // --- Logic chính ---

    _commitText = () => {
        if (this.textarea && this.textarea.value.trim()) {
            // Commit có thể đến từ nút menu (không qua sự kiện canvas) hoặc sau khi zoom,
            // nên đồng bộ lại tỉ lệ và lấy vị trí textarea so với canvas ngay lúc này.
            const canvasRect = this.core.syncTempTransform();
            const textareaRect = this.textarea.getBoundingClientRect();
            const inset = this.TEXTAREA_BORDER_PX + this.TEXTAREA_INTERNAL_PADDING_PX;
            const textToDraw = this.textarea.value;
            // Góc trên-trái vùng chữ của textarea, quy về toạ độ canvas.
            const drawX = textareaRect.left - canvasRect.left + inset;
            const drawY = textareaRect.top - canvasRect.top + inset;
            
            this._drawTextOnCanvas(textToDraw, drawX, drawY);
            this.core.updateImage();
        }
        this._removeEditorElements();
        this.isEditing = false;
    }

    _removeEditorElements() {
        if (this.textarea) {
            this.textarea.removeEventListener('input', this._updateTextareaSize);
        }
        if (this.textWrapper) {
            this.textWrapper.removeEventListener('mousedown', this._onTextWrapperMouseDown);
            this.textWrapper.parentNode?.removeChild(this.textWrapper);
            this.textWrapper = null;
        }
        this.textarea = null;
    }

    _drawTextOnCanvas(text, x, y) {
        const lines = text.split('\n');
        const font = `${this.currentFontSizePx}px ${this.FONT_FAMILY}`;
        this.context.save();
        this.context.font = font;
        this.context.fillStyle = this.core.strokeStyle;
        this.context.textBaseline = 'alphabetic';

        // Textarea đặt baseline theo CSS: mỗi dòng cao lineHeight, phần chữ (ascent + descent
        // của font) nằm giữa dòng. Tính baseline y hệt vậy để chữ vẽ ra trùng khít chỗ đã gõ.
        const metrics = this.context.measureText('Hg');
        const ascent = metrics.fontBoundingBoxAscent;
        const descent = metrics.fontBoundingBoxDescent;
        const baselineOffset = (this.actualLineHeightPx - (ascent + descent)) / 2 + ascent;

        for (let i = 0; i < lines.length; i++) {
            this.context.fillText(lines[i], x, y + (i * this.actualLineHeightPx) + baselineOffset);
        }
        this.context.restore();
    }

    _addToolSwitchListeners() {
        const toolSelectors = document.querySelectorAll('.toolSelect a, .toolSelect div');
        
        this._handleToolSwitch = (e) => {
            if (!this.isEditing) return;

            const clickedTool = e.currentTarget;
            const isFontSizeControl = clickedTool.id === 'increaseFontSizeBtn' || clickedTool.id === 'decreaseFontSizeBtn';
            
            if (isFontSizeControl) return;

            const isTextToolButton = clickedTool.dataset.tool === 'text' || clickedTool.id === 'text';
            const isColorPicker = clickedTool.querySelector('input[type="color"]');
            const isControlOrMove = clickedTool.classList.contains('control') || clickedTool.classList.contains('move');

            // Màu được cập nhật qua onColorChange khi người dùng chọn màu
            if (isColorPicker) return;
            
            if (!isTextToolButton && !isControlOrMove) {
                this._commitText();
            }
        };

        toolSelectors.forEach(item => {
            item.addEventListener('click', this._handleToolSwitch);
        });
    }

    // Dọn dẹp khi công cụ không còn được sử dụng
    destroy = () => {
        this._commitText();

        // Gỡ bỏ event listener của tool switch
        if (this._handleToolSwitch) {
            const toolSelectors = document.querySelectorAll('.toolSelect a, .toolSelect div');
            toolSelectors.forEach(item => {
                item.removeEventListener('click', this._handleToolSwitch);
            });
        }

        // Gỡ bỏ các event listener toàn cục (nếu còn)
        document.removeEventListener('mousemove', this._onTextMouseMove);
        document.removeEventListener('mouseup', this._onTextMouseUp);
    }
}