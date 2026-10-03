/**
 * @class RectTool
 * Công cụ để vẽ hình chữ nhật (hoặc hình vuông) trên canvas.
 */
export class RectTool {
    // --- Thuộc tính của lớp ---
    context;
    canvas;
    core;
    isDrawing = false;
    startX = 0;
    startY = 0;
    currentX = 0;
    currentY = 0;

    /**
     * @param {object} core - Đối tượng core của ứng dụng vẽ.
     * @param {CanvasRenderingContext2D} core.context - Context 2D của canvas.
     * @param {HTMLCanvasElement} core.canvas - Phần tử canvas.
     * @param {string} core.strokeStyle - Màu của đường viền.
     * @param {number} core.lineWidth - Độ dày của đường viền.
     */
    constructor(core) {
        this.core = core;
        this.context = core.context;
        this.canvas = core.canvas;

        // Ràng buộc 'this' cho các event handler
        this.mousedown = this.mousedown.bind(this);
        this.mousemove = this.mousemove.bind(this);
        this.mouseup = this.mouseup.bind(this);
        this.mouseleave = this.mouseleave.bind(this);
    }

    // --- Các phương thức xử lý sự kiện ---

    /**
     * Bắt đầu quá trình vẽ khi nhấn chuột.
     * @param {MouseEvent} ev - Đối tượng sự kiện, chứa tọa độ _x, _y đã được chuẩn hóa.
     */
    mousedown(ev) {
        this.isDrawing = true;
        this.startX = ev._x;
        this.startY = ev._y;
    }

    /**
     * Cập nhật và vẽ lại hình chữ nhật khi di chuyển chuột.
     * @param {MouseEvent} ev - Đối tượng sự kiện, chứa tọa độ _x, _y và trạng thái phím Shift.
     */
    mousemove(ev) {
        if (!this.isDrawing) return;

        this.currentX = ev._x;
        this.currentY = ev._y;
        
        // Gọi phương thức vẽ, truyền vào trạng thái phím Shift để vẽ hình vuông
        this.draw(ev.shiftKey);
    }

    /**
     * Hoàn tất quá trình vẽ khi nhả chuột.
     * @param {MouseEvent} ev - Đối tượng sự kiện.
     */
    mouseup(ev) {
        if (!this.isDrawing) return;

        // Vẽ lại lần cuối cùng để đảm bảo hình ảnh cuối cùng là chính xác
        this.mousemove(ev);
        this.isDrawing = false;

        // GỢI Ý: this.core.commitDrawing();
    }

    /**
     * Hủy quá trình vẽ nếu chuột rời khỏi canvas.
     */
    mouseleave() {
        if (this.isDrawing) {
            this.isDrawing = false;
        }
    }

    // --- Phương thức vẽ chính ---

    /**
     * Chịu trách nhiệm vẽ hình chữ nhật hoặc hình vuông lên canvas.
     * @param {boolean} [isPerfectSquare=false] - Nếu là true, sẽ vẽ một hình vuông hoàn hảo.
     */
    draw(isPerfectSquare = false) {
        // Xóa canvas để vẽ lại frame mới (phù hợp cho canvas xem trước)
        this.core.clearTempCanvas();

        // Tính toán chiều rộng và chiều cao dựa trên điểm bắt đầu và điểm hiện tại
        let width = this.currentX - this.startX;
        let height = this.currentY - this.startY;

        if (isPerfectSquare) {
            // Để vẽ hình vuông, ép chiều rộng và chiều cao có cùng giá trị tuyệt đối.
            // Dựa trên kích thước lớn hơn để đảm bảo hình vuông bao trọn vùng người dùng kéo.
            const maxDimension = Math.max(Math.abs(width), Math.abs(height));
            // Giữ lại dấu (hướng vẽ) của width và height ban đầu.
            width = maxDimension * Math.sign(width);
            height = maxDimension * Math.sign(height);
        }

        // Tính toán tọa độ góc trên bên trái (x, y) để vẽ
        // `strokeRect` yêu cầu tọa độ góc trên bên trái và chiều rộng/cao dương.
        const rectX = width > 0 ? this.startX : this.startX + width;
        const rectY = height > 0 ? this.startY : this.startY + height;
        const rectWidth = Math.abs(width);
        const rectHeight = Math.abs(height);
        
        // Không vẽ nếu chiều rộng hoặc cao bằng 0
        if (rectWidth === 0 || rectHeight === 0) return;

        // Thiết lập style từ core object
        this.context.strokeStyle = this.core.strokeStyle;
        this.context.lineWidth = this.core.lineWidth;

        // Sử dụng phương thức `strokeRect` của canvas API, rất hiệu quả.
        this.context.strokeRect(rectX, rectY, rectWidth, rectHeight);
    }
}