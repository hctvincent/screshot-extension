/**
 * @class MarkerTool
 * Công cụ để vẽ với hiệu ứng bút dạ quang (highlighter).
 * Tạo ra các nét vẽ phẳng, trong suốt, mô phỏng một dải băng màu.
 */
export class MarkerTool {
    // --- Thuộc tính của lớp ---
    context;
    core;
    isDrawing = false;
    points = []; // Mảng lưu các điểm của toàn bộ nét vẽ hiện tại

    /**
     * @param {object} core - Đối tượng core của ứng dụng vẽ.
     * @param {CanvasRenderingContext2D} core.context - Context 2D của canvas tạm thời.
     * @param {string} core.strokeStyle - Màu của bút vẽ.
     * @param {number} core.lineWidth - Độ dày của bút vẽ.
     */
    constructor(core) {
        this.core = core;
        this.context = core.context;
    }

    // --- Các phương thức xử lý sự kiện (định nghĩa bằng Arrow Functions) ---

    mousedown = (ev) => {
        this.isDrawing = true;
        // Bắt đầu một nét vẽ mới với điểm đầu tiên
        this.points = [{ x: ev._x, y: ev._y }];
    }

    mousemove = (ev) => {
        if (!this.isDrawing) return;

        // Thêm điểm mới vào mảng
        this.points.push({ x: ev._x, y: ev._y });
        
        // Vẽ lại toàn bộ đường cong đã được làm mịn trên canvas tạm thời
        this.draw();
    }

    mouseup = () => {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        
        // Logic `updateImage` trong DrawingCore sẽ xử lý việc "in" bản vẽ cuối cùng
        // lên canvas chính.
        
        // Xóa mảng điểm để chuẩn bị cho nét vẽ tiếp theo.
        this.points = [];
    }

    mouseleave = () => {
        // Nếu chuột rời đi, coi như kết thúc nét vẽ
        if (this.isDrawing) {
            // Không gọi mouseup trực tiếp để tránh gọi updateImage 2 lần nếu
            // người dùng nhả chuột ngoài canvas. Chỉ cần reset trạng thái.
            this.isDrawing = false;
            this.points = [];
            // Xóa canvas tạm thời để không còn hình preview "ma"
            this.core.clearTempCanvas();
        }
    }

    // --- Phương thức vẽ chính ---

    /**
     * Chịu trách nhiệm vẽ lại toàn bộ đường cong đã được làm mịn.
     * Được gọi trong mỗi lần mousemove để tạo hiệu ứng preview.
     */
    draw = () => {
        // Xóa canvas tạm thời trước mỗi lần vẽ lại để chỉ hiển thị nét vẽ hiện tại
        this.core.clearTempCanvas();

        if (this.points.length < 2) return;
        this.context.save();
      
        // Thiết lập các thuộc tính cho hiệu ứng marker
        this.context.globalAlpha = 0.5; // Độ trong suốt đặc trưng của highlighter
        this.context.lineWidth = this.core.lineWidth * 2;
        this.context.strokeStyle = this.core.strokeStyle;
        this.context.lineCap = 'round';
        this.context.lineJoin = 'round';

        this.context.beginPath();
        // Bắt đầu từ điểm đầu tiên
        this.context.moveTo(this.points[0].x, this.points[0].y);

        // Thuật toán làm mịn đường cong cho toàn bộ các điểm
        for (let i = 1; i < this.points.length - 2; i++) {
            // Tính trung điểm của điểm hiện tại và điểm tiếp theo
            const xc = (this.points[i].x + this.points[i + 1].x) / 2;
            const yc = (this.points[i].y + this.points[i + 1].y) / 2;
            // Vẽ một đường cong bậc hai đến trung điểm đó,
            // sử dụng điểm hiện tại làm điểm kiểm soát.
            this.context.quadraticCurveTo(this.points[i].x, this.points[i].y, xc, yc);
        }

        // Vẽ đoạn cuối cùng nối đến 2 điểm cuối
        if (this.points.length > 2) {
             this.context.quadraticCurveTo(
                this.points[this.points.length - 2].x,
                this.points[this.points.length - 2].y,
                this.points[this.points.length - 1].x,
                this.points[this.points.length - 1].y
            );
        } else if (this.points.length === 2) {
            // Nếu chỉ có 2 điểm, vẽ đường thẳng
            this.context.lineTo(this.points[1].x, this.points[1].y);
        }
       

        this.context.stroke();
        this.context.restore();
    }

    // (Tùy chọn) Thêm phương thức destroy để dọn dẹp nếu cần
    destroy = () => {
        // MarkerTool không tạo ra event listener toàn cục nên không cần dọn dẹp nhiều
        this.points = [];
        this.isDrawing = false;
    }
}