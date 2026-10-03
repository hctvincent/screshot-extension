/**
 * @class LineTool
 * Công cụ để vẽ một đường thẳng đơn giản trên canvas.
 * Cho phép vẽ đường thẳng theo các góc cố định (0, 45, 90 độ) khi giữ phím Shift.
 */
export class LineTool {
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
     * @param {string} core.strokeStyle - Màu của đường vẽ.
     * @param {number} core.lineWidth - Độ dày của đường vẽ.
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
     * Cập nhật và vẽ lại đường thẳng khi di chuyển chuột.
     * @param {MouseEvent} ev - Đối tượng sự kiện, chứa tọa độ _x, _y và trạng thái phím Shift.
     */
    mousemove(ev) {
        if (!this.isDrawing) return;

        this.currentX = ev._x;
        this.currentY = ev._y;
        
        // Gọi phương thức vẽ, truyền vào trạng thái phím Shift để vẽ đường thẳng góc
        this.draw(ev.shiftKey);
    }

    /**
     * Hoàn tất quá trình vẽ khi nhả chuột.
     * @param {MouseEvent} ev - Đối tượng sự kiện.
     */
    mouseup(ev) {
        if (!this.isDrawing) return;

        this.mousemove(ev); // Vẽ lại lần cuối
        this.isDrawing = false;

        // GỢI Ý: this.core.commitDrawing();
    }

    /**
     * Hủy quá trình vẽ nếu chuột rời khỏi canvas.
     */
    mouseleave() {
        this.isDrawing = false;
    }

    // --- Phương thức vẽ chính ---

    /**
     * Chịu trách nhiệm vẽ đường thẳng lên canvas.
     * @param {boolean} [snapToAxis=false] - Nếu là true, sẽ "bắt dính" đường thẳng vào các góc 0, 45, 90 độ.
     */
    draw(snapToAxis = false) {
        // Xóa canvas để vẽ lại frame mới
        this.core.clearTempCanvas();

        let endX = this.currentX;
        let endY = this.currentY;

        if (snapToAxis) {
            // Logic bắt dính vào các góc cố định
            const dx = this.currentX - this.startX;
            const dy = this.currentY - this.startY;
            const angle = Math.atan2(dy, dx) * 180 / Math.PI; // Chuyển sang độ để dễ làm tròn

            // Làm tròn góc đến bội số gần nhất của 45
            const snappedAngle = Math.round(angle / 45) * 45;
            const snappedRadians = snappedAngle * Math.PI / 180; // Chuyển lại radian
            const distance = Math.hypot(dx, dy); // Giữ nguyên độ dài của đường thẳng

            // Tính toán lại điểm cuối dựa trên góc đã được làm tròn
            endX = this.startX + distance * Math.cos(snappedRadians);
            endY = this.startY + distance * Math.sin(snappedRadians);
        }

        // Bắt đầu một path mới
        this.context.beginPath();

        // Thiết lập style từ core object
        this.context.strokeStyle = this.core.strokeStyle;
        this.context.lineWidth = this.core.lineWidth;
        this.context.lineCap = 'round'; // Làm cho đầu đường thẳng mượt hơn

        // Vẽ đường thẳng
        this.context.moveTo(this.startX, this.startY);
        this.context.lineTo(endX, endY);

        // Thực hiện vẽ
        this.context.stroke();
    }
}