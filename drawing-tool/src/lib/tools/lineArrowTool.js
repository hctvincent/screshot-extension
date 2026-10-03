/**
 * @class LineArrowTool
 * Công cụ để vẽ một đường thẳng có mũi tên ở cuối trên một canvas HTML.
 * Lớp này quản lý trạng thái và logic vẽ từ khi người dùng nhấn chuột,
 * di chuyển, cho đến khi nhả chuột.
 */
export class LineArrowTool {
  // --- Thuộc tính của lớp ---

  // Các dependency được truyền từ đối tượng core của ứng dụng
  context;
  canvas;
  core; // Giữ lại tham chiếu đến core để lấy các thuộc tính động (màu sắc, độ dày)

  // Trạng thái điều khiển việc vẽ
  isDrawing = false;

  // Tọa độ của đường thẳng
  startX = 0;
  startY = 0;
  currentX = 0;
  currentY = 0;

  /**
   * @param {object} core - Đối tượng core của ứng dụng vẽ.
   * @param {CanvasRenderingContext2D} core.context - Context 2D của canvas để vẽ.
   * @param {HTMLCanvasElement} core.canvas - Phần tử canvas.
   * @param {string} core.strokeStyle - Màu của đường vẽ.
   * @param {number} core.lineWidth - Độ dày của đường vẽ.
   */
  constructor(core) {
    // Lưu trữ các dependency quan trọng
    this.core = core;
    this.context = core.context;
    this.canvas = core.canvas;

    // Ràng buộc (bind) 'this' cho các event handler.
    // Điều này là bắt buộc để đảm bảo 'this' bên trong các phương thức này
    // luôn trỏ đến instance của LineArrowTool, ngay cả khi chúng được gọi
    // bởi các trình nghe sự kiện (event listeners).
    this.mousedown = this.mousedown.bind(this);
    this.mousemove = this.mousemove.bind(this);
    this.mouseup = this.mouseup.bind(this);
    this.mouseleave = this.mouseleave.bind(this);
  }

  // --- Các phương thức xử lý sự kiện (Event Handlers) ---

  /**
   * Được gọi khi người dùng nhấn chuột xuống.
   * Bắt đầu quá trình vẽ và ghi lại tọa độ điểm bắt đầu.
   * @param {MouseEvent} ev - Đối tượng sự kiện chuột.
   */
  mousedown(ev) {
    this.isDrawing = true;
    // Giả sử `ev._x` và `ev._y` là tọa độ đã được tính toán so với canvas
    this.startX = ev._x;
    this.startY = ev._y;
  }

  /**
   * Được gọi khi người dùng di chuyển chuột trong khi đang nhấn giữ.
   * Cập nhật tọa độ điểm cuối và vẽ lại đường thẳng và mũi tên.
   * @param {MouseEvent} ev - Đối tượng sự kiện chuột.
   */
  mousemove(ev) {
    // Nếu chưa bắt đầu vẽ thì không làm gì cả
    if (!this.isDrawing) return;

    this.currentX = ev._x;
    this.currentY = ev._y;

    // Chỉ vẽ lại nếu chuột thực sự đã di chuyển để tối ưu hóa hiệu suất
    if (this.startX !== this.currentX || this.startY !== this.currentY) {
      this.draw();
    }
  }

  /**
   * Được gọi khi người dùng nhả chuột.
   * Hoàn tất quá trình vẽ.
   * @param {MouseEvent} ev - Đối tượng sự kiện chuột.
   */
  mouseup(ev) {
    if (!this.isDrawing) return;

    // Cập nhật vị trí lần cuối và vẽ lại để đảm bảo hình ảnh cuối cùng là chính xác
    this.mousemove(ev);
    this.isDrawing = false;
    
    // GỢI Ý MỞ RỘNG:
    // Tại đây, bạn có thể muốn "đóng dấu" (stamp) hình vẽ cuối cùng lên
    // một canvas chính, trong khi bản xem trước được vẽ trên một canvas tạm thời.
    // Điều này cho phép bạn vẽ nhiều hình mà không xóa các hình đã có.
    // Ví dụ: core.commitDrawing(this.canvas);
  }

  /**
   * Được gọi khi chuột rời khỏi khu vực canvas.
   * Hủy quá trình vẽ để tránh các đường vẽ không mong muốn.
   */
  mouseleave() {
    this.isDrawing = false;
  }

  // --- Các phương thức vẽ (Drawing Methods) ---

  /**
   * Chịu trách nhiệm chính cho việc vẽ đường thẳng và mũi tên lên canvas.
   * Phương thức này được gọi liên tục trong khi di chuyển chuột.
   */
  draw() {
    // Xóa toàn bộ canvas trước mỗi lần vẽ lại. Điều này tạo ra hiệu ứng
    // xem trước (preview) cho đường vẽ hiện tại.
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Bắt đầu một "path" mới để không bị ảnh hưởng bởi các thao tác vẽ trước đó.
    this.context.beginPath();

    // Lấy các thuộc tính style động từ đối tượng core
    const strokeStyle = this.core.strokeStyle;
    const lineWidth = this.core.lineWidth;

    // Thiết lập style cho context
    this.context.strokeStyle = strokeStyle;
    this.context.lineWidth = lineWidth;
    this.context.lineCap = 'round'; // Làm cho đầu của đường thẳng tròn và mượt hơn

    // Tính toán góc và kích thước mũi tên
    const angle = Math.atan2(this.currentY - this.startY, this.currentX - this.startX);
    // Kích thước mũi tên nên tỉ lệ thuận với độ dày của đường kẻ
    const arrowSize = lineWidth * 3.5;

    // --- Logic rút ngắn đường thẳng để khớp với mũi tên ---
    // Để đỉnh mũi tên chạm chính xác vào điểm cuối của đường thẳng,
    // ta cần vẽ đường thẳng ngắn hơn một chút so với vị trí chuột.
    const endX = this.currentX - (arrowSize * Math.cos(angle));
    const endY = this.currentY - (arrowSize * Math.sin(angle));

    // Vẽ đường thẳng
    this.context.moveTo(this.startX, this.startY);
    // Chỉ vẽ đường thẳng nếu nó đủ dài (chiều dài lớn hơn 0)
    // `Math.hypot` tính độ dài của vector (khoảng cách giữa 2 điểm)
    if (Math.hypot(endX - this.startX, endY - this.startY) > 0) {
      this.context.lineTo(endX, endY);
    }

    // Thực hiện vẽ đường thẳng lên canvas
    this.context.stroke();

    // Vẽ mũi tên tại vị trí chuột ban đầu (currentX, currentY)
    this.drawArrowhead(
      this.context,
      this.currentX, // Tọa độ thật của chuột
      this.currentY, // Tọa độ thật của chuột
      angle,
      arrowSize,
      strokeStyle  // Dùng màu của đường thẳng làm màu tô cho mũi tên
    );
    
    // (Không cần thiết) Kết thúc path, nhưng là một thói quen tốt
    this.context.closePath();
  }

  /**
   * Vẽ một mũi tên hình tam giác đặc, có đáy hơi lõm vào trong để tăng tính thẩm mỹ.
   * @param {CanvasRenderingContext2D} ctx - Context để vẽ.
   * @param {number} x - Tọa độ x của đỉnh mũi tên.
   * @param {number} y - Tọa độ y của đỉnh mũi tên.
   * @param {number} radians - Góc xoay của mũi tên (tính bằng radian).
   * @param {number} size - Kích thước (chiều dài) của mũi tên.
   * @param {string} fillStyle - Màu tô của mũi tên.
   */
  drawArrowhead(ctx, x, y, radians, size, fillStyle) {
    ctx.save(); // Lưu trạng thái hiện tại của context (transformations, styles)
    ctx.beginPath();
    
    // Di chuyển gốc tọa độ đến vị trí đỉnh mũi tên và xoay context
    ctx.translate(x, y);
    ctx.rotate(radians);
    
    // Vẽ hình dạng của mũi tên.
    // Đỉnh mũi tên sẽ ở tọa độ (0,0) của context đã được biến đổi.
    const width = size / 2;
    ctx.moveTo(0, 0);                 // Đỉnh mũi tên
    ctx.lineTo(-size, -width);        // Điểm ở đáy, bên trái
    ctx.lineTo(-size * 0.85, 0);      // Điểm giữa ở đáy (tạo hiệu ứng lõm)
    ctx.lineTo(-size, width);         // Điểm ở đáy, bên phải
    ctx.closePath();                  // Nối về điểm đầu tiên (0,0) để tạo hình kín
    
    // Tô màu cho mũi tên
    ctx.fillStyle = fillStyle;
    ctx.fill();
    
    ctx.restore(); // Khôi phục lại trạng thái context ban đầu đã lưu
  }
}