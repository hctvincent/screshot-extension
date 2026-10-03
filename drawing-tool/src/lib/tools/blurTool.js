/**
 * @class BlurTool
 * Kéo một vùng chữ nhật để làm mờ thông tin nhạy cảm (email, token, số tài khoản...).
 * Vùng được thu nhỏ rồi phóng to lại, nên chi tiết gốc bị mất hẳn chứ không chỉ bị phủ,
 * và không thể khôi phục từ ảnh đã xuất.
 */
export class BlurTool {
    context;
    core;
    isDrawing = false;
    startX = 0;
    startY = 0;
    currentX = 0;
    currentY = 0;

    // Kích thước mỗi "ô" khi thu nhỏ, tính theo CSS px trên màn hình.
    static BLOCK_SIZE = 18;

    constructor(core) {
        this.core = core;
        this.context = core.context;
        this.scratch = document.createElement('canvas');
        this.scratchCtx = this.scratch.getContext('2d');
    }

    mousedown = (ev) => {
        this.isDrawing = true;
        this.startX = this.currentX = ev._x;
        this.startY = this.currentY = ev._y;
    }

    mousemove = (ev) => {
        if (!this.isDrawing) return;
        this.currentX = ev._x;
        this.currentY = ev._y;
        this.draw();
    }

    mouseup = (ev) => {
        if (!this.isDrawing) return;
        this.mousemove(ev);
        this.isDrawing = false;
    }

    // DrawingCore gọi updateImage sau mouseleave khi đang kéo, nên vùng đã xem trước được giữ lại.
    mouseleave = () => {
        this.isDrawing = false;
    }

    // Vẽ vùng đã làm mờ lên canvas tạm; DrawingCore sẽ ghép nó vào ảnh chính khi thả chuột.
    draw = () => {
        this.core.clearTempCanvas();

        const x = Math.min(this.startX, this.currentX);
        const y = Math.min(this.startY, this.currentY);
        const w = Math.abs(this.currentX - this.startX);
        const h = Math.abs(this.currentY - this.startY);
        if (w < 2 || h < 2) return;

        // Context tạm đang có transform CSS px -> pixel thật; ảnh nguồn (canvaso) tính theo pixel thật.
        const { a: scaleX, d: scaleY } = this.context.getTransform();
        const source = this.core.canvaso;
        const sx = Math.max(0, Math.round(x * scaleX));
        const sy = Math.max(0, Math.round(y * scaleY));
        const sw = Math.min(source.width - sx, Math.round(w * scaleX));
        const sh = Math.min(source.height - sy, Math.round(h * scaleY));
        if (sw <= 0 || sh <= 0) return;

        const block = BlurTool.BLOCK_SIZE * scaleX;
        this.scratch.width = Math.max(1, Math.round(sw / block));
        this.scratch.height = Math.max(1, Math.round(sh / block));
        this.scratchCtx.imageSmoothingEnabled = true;
        this.scratchCtx.imageSmoothingQuality = 'high';
        this.scratchCtx.drawImage(source, sx, sy, sw, sh, 0, 0, this.scratch.width, this.scratch.height);

        this.context.save();
        this.context.imageSmoothingEnabled = true;
        this.context.imageSmoothingQuality = 'high';
        this.context.drawImage(this.scratch, 0, 0, this.scratch.width, this.scratch.height, sx / scaleX, sy / scaleY, sw / scaleX, sh / scaleY);
        this.context.restore();
    }

    destroy = () => {
        this.isDrawing = false;
    }
}
