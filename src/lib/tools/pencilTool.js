/**
 * @class PencilTool
 * Công cụ để vẽ tự do với hiệu ứng bút chì.
 * Tạo ra các đường cong mượt mà, liền mạch dựa trên chuyển động của chuột.
 */
export class PencilTool {
    // --- Thuộc tính của lớp ---
    context;
    core;
    isDrawing = false;
    points = []; // Mảng lưu các điểm của nét vẽ hiện tại

    /**
     * @param {object} core - Đối tượng core của ứng dụng vẽ.
     * @param {CanvasRenderingContext2D} core.context - Context 2D của canvas.
     * @param {string} core.strokeStyle - Màu của bút chì.
     * @param {number} core.lineWidth - Độ dày của nét bút chì.
     */
    constructor(core) {
        this.core = core;
        this.context = core.context;

        // Ràng buộc 'this' cho các event handler
        this.mousedown = this.mousedown.bind(this);
        this.mousemove = this.mousemove.bind(this);
        this.mouseup = this.mouseup.bind(this);
        this.mouseleave = this.mouseleave.bind(this);
    }

    // --- Các phương thức xử lý sự kiện ---

    /**
     * Bắt đầu một nét vẽ mới khi nhấn chuột.
     * @param {MouseEvent} ev - Đối tượng sự kiện, chứa tọa độ _x, _y đã được chuẩn hóa.
     */
    mousedown(ev) {
        this.isDrawing = true;
        
        // Bắt đầu một path mới cho nét vẽ này
        this.context.beginPath();
        
        // Ghi lại điểm đầu tiên
        this.points = [{ x: ev._x, y: ev._y }];
        this.context.moveTo(ev._x, ev._y);
    }

    /**
     * Tiếp tục vẽ khi di chuyển chuột.
     * @param {MouseEvent} ev - Đối tượng sự kiện.
     */
    mousemove(ev) {
        if (!this.isDrawing) return;

        this.points.push({ x: ev._x, y: ev._y });
        
        // Vẽ một đoạn cong mượt mà
        this.drawSegment();
    }

    /**
     * Hoàn tất nét vẽ khi nhả chuột.
     */
    mouseup() {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Kết thúc path hiện tại và dọn dẹp mảng điểm
        this.context.closePath();
        this.points = [];

        // GỢI Ý: this.core.commitDrawing();
    }

    /**
     * Hủy quá trình vẽ nếu chuột rời khỏi canvas.
     */
    mouseleave() {
        if (this.isDrawing) {
            this.mouseup();
        }
    }

    // --- Phương thức vẽ chính ---

    /**
     * Vẽ một đoạn cong (segment) của đường vẽ dựa trên các điểm cuối cùng.
     * Kỹ thuật này giúp tạo ra một đường cong liền mạch thay vì các đường thẳng gãy khúc.
     */
    drawSegment() {
        // Cần ít nhất 2 điểm để vẽ một đoạn
        if (this.points.length < 2) return;

        // Thiết lập các thuộc tính cho bút chì
        // Bút chì thường không trong suốt, nên không cần `globalAlpha`
        this.context.lineWidth = this.core.lineWidth;
        this.context.strokeStyle = this.core.strokeStyle;
        this.context.lineCap = 'round';
        this.context.lineJoin = 'round';

        // Lấy các điểm cần thiết để vẽ đường cong
        const startPoint = this.points[this.points.length - 2];
        const endPoint = this.points[this.points.length - 1];

        // Tính toán trung điểm để làm điểm kết thúc cho đường cong bậc hai,
        // giúp các đoạn nối với nhau một cách mượt mà.
        const midPoint = {
            x: (startPoint.x + endPoint.x) / 2,
            y: (startPoint.y + endPoint.y) / 2,
        };

        // Vẽ một đường cong bậc hai (quadratic curve)
        // Điểm kiểm soát (control point) là `startPoint`.
        // Điểm kết thúc là `midPoint`.
        // Lệnh `beginPath` và `moveTo` đã được gọi trong `mousedown`.
        this.context.quadraticCurveTo(startPoint.x, startPoint.y, midPoint.x, midPoint.y);
        
        // Thực hiện vẽ đoạn cong lên canvas
        this.context.stroke();
    }
}