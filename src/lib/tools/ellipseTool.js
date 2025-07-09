/**
 * @class EllipseTool
 * Công cụ để vẽ hình elip (hoặc hình tròn) trên canvas.
 * Lớp này quản lý trạng thái và logic vẽ từ khi người dùng nhấn chuột,
 * di chuyển, cho đến khi nhả chuột.
 */
export class EllipseTool {
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
     * Cập nhật và vẽ lại hình elip khi di chuyển chuột.
     * @param {MouseEvent} ev - Đối tượng sự kiện, chứa tọa độ _x, _y và trạng thái phím Shift.
     */
    mousemove(ev) {
        if (!this.isDrawing) return;

        this.currentX = ev._x;
        this.currentY = ev._y;
        
        // Gọi phương thức vẽ, truyền vào trạng thái phím Shift để vẽ hình tròn
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

        // GỢI Ý MỞ RỘNG:
        // Tại đây, ứng dụng core có thể "in" hình vẽ từ canvas tạm thời
        // sang canvas chính.
        // Ví dụ: this.core.commitDrawing();
    }

    /**
     * Hủy quá trình vẽ nếu chuột rời khỏi canvas.
     */
    mouseleave() {
        // Coi như việc vẽ đã kết thúc nếu chuột rời đi
        if (this.isDrawing) {
            this.isDrawing = false;
        }
    }

    // --- Phương thức vẽ chính ---

    /**
     * Chịu trách nhiệm vẽ hình elip hoặc hình tròn lên canvas.
     * @param {boolean} [isPerfectCircle=false] - Nếu là true, sẽ vẽ một hình tròn hoàn hảo.
     */
    draw(isPerfectCircle = false) {
        // Xóa canvas để vẽ lại frame mới (phù hợp cho canvas xem trước)
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Tính toán chiều rộng và chiều cao của hình chữ nhật bao quanh elip
        let width = this.currentX - this.startX;
        let height = this.currentY - this.startY;

        if (isPerfectCircle) {
            // Để vẽ hình tròn, ép chiều rộng và chiều cao bằng nhau
            // Dựa trên kích thước lớn hơn và giữ nguyên dấu (hướng vẽ)
            const maxDimension = Math.max(Math.abs(width), Math.abs(height));
            width = maxDimension * Math.sign(width);
            height = maxDimension * Math.sign(height);
        }

        // Tính toán bán kính và tâm của elip
        const radiusX = Math.abs(width) / 2;
        const radiusY = Math.abs(height) / 2;
        const centerX = this.startX + width / 2;
        const centerY = this.startY + height / 2;

        // Bắt đầu một path mới
        this.context.beginPath();

        // Thiết lập style từ core object
        this.context.strokeStyle = this.core.strokeStyle;
        this.context.lineWidth = this.core.lineWidth;

        // Sử dụng phương thức `ellipse` của canvas API - đây là cách hiện đại và hiệu quả nhất.
        // context.ellipse(tâmX, tâmY, bánKínhX, bánKínhY, gócXoay, gócBắtĐầu, gócKếtThúc);
        this.context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);

        // Vẽ đường viền của elip
        this.context.stroke();
    }
}