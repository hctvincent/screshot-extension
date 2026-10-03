import Croppr from "../croppr";
import Notifier from '../ui/notificationManager';
import {
  PencilTool,
  MarkerTool,
  RectTool,
  LineArrowTool,
  LineTool,
  EllipseTool,
  TextTool,
} from "../tools";
import Menu from "../menu/menu";

export default class DrawingCore {
  constructor(elem, options) {
    this.elem = elem;
    this.options = options;

    this.dpr = window.devicePixelRatio || 1;
    this.tool = null;
    this.cStep = -1;
    this.cPushArray = [];
    this.strokeStyle = "#ff0000";
    this.lineWidth = 8;
    this.toolSizeIndicatorTimeout = null;
    this.tools = {
      pencil: PencilTool,
      marker: MarkerTool,
      rect: RectTool,
      line: LineTool,
      lineArrow: LineArrowTool,
      ellipse: EllipseTool,
      text: TextTool,
    };
    this.tool_default = "pencil";
    this.canvaso = null;
    this.contexto = null;
    this.canvas = null;
    this.context = null;
    this.imgCroppedCanvas = null;
    this.ctxImgCrop = null;
    this.cropperImageElement = null;
    this.cropper = null;
    this.menu = null;
    this.canvasPic = new Image();
    this.canvasPic.crossOrigin = "Anonymous";
    this.isCropperVisible = false;
    this.init();
  }

  init = () => {
    if (!this.options.bgImage) {
      this._setup(null);
      return;
    }
    const bgImage = new Image();
    bgImage.crossOrigin = "Anonymous";
    bgImage.onload = () => this._setup(bgImage);
    bgImage.onerror = () => {
      console.error("Failed to load background image.");
      this._setup(null);
    };
    bgImage.src = this.options.bgImage;
  };

  // Canvas luôn dùng độ phân giải gốc của ảnh (pixel thật), còn kích thước hiển thị
  // do CSS quyết định. Mọi toạ độ chuột được quy đổi theo tỉ lệ hiển thị hiện tại
  // nên vẽ đúng trên mọi màn hình / mức zoom.
  _setup = (bgImage) => {
    const width = bgImage
      ? bgImage.naturalWidth
      : Math.round((this.options.width || window.innerWidth) * this.dpr);
    const height = bgImage
      ? bgImage.naturalHeight
      : Math.round((this.options.height || window.innerHeight) * this.dpr);
    this._createCanvas(width, height);
    if (bgImage) this.contexto.drawImage(bgImage, 0, 0, width, height);
    this.menu = new Menu(this.elem);
    this.cPush();
    this._initializeCropper();
    if (this.tools[this.tool_default]) {
      this.tool = new this.tools[this.tool_default](this);
    }
    this._addCanvasEventListeners();
    window.addEventListener("resize", this._handleResize);
  };

  _createCanvas = (width, height) => {
    this.canvaso = document.createElement("canvas");
    this.canvaso.id = "imageView";
    this.canvaso.width = width;
    this.canvaso.height = height;
    this.contexto = this.canvaso.getContext("2d");
    this.elem.appendChild(this.canvaso);
    this.canvas = document.createElement("canvas");
    this.canvas.id = "imageTemp";
    this.canvas.width = width;
    this.canvas.height = height;
    this.context = this.canvas.getContext("2d");
    this.imgCroppedCanvas = document.createElement("canvas");
    this.imgCroppedCanvas.id = "imgCroppedCanvas";
    this.ctxImgCrop = this.imgCroppedCanvas.getContext("2d");
  };

  _canvasEvent = (ev) => {
    const rect = this.syncTempTransform();
    ev._x = ev.clientX - rect.left;
    ev._y = ev.clientY - rect.top;

    const handler = this.tool ? this.tool[ev.type] : null;
    if (handler) {
      ev.preventDefault();
      handler(ev);
      if (
        ev.type === "mouseup" ||
        (ev.type === "mouseleave" && this.tool.isDrawing)
      ) {
        this.updateImage();
        this.updateCursorPosition(ev);
        this.showCursorDraw(true);
        
      }

      if (ev.type === "mousemove") {
        this.updateCursorPosition(ev);
        
      }
      if (ev.type === "mousedown") {
       this.showCursorDraw(false);
        
      }
      
    }
  };
  updateCursorSize() {
    if (this.cursorDraw) {
      this.cursorDraw.style.width = this.lineWidth + "px";
      this.cursorDraw.style.height = this.lineWidth + "px";
    }
  }

  updateCursorPosition(e) {
    if (this.cursorDraw) {
      const rect = this.elem.getBoundingClientRect();
      this.cursorDraw.style.left = `${e.clientX - rect.left}px`;
      this.cursorDraw.style.top = `${e.clientY - rect.top}px`;
    }
  }

  // Tools làm việc theo đơn vị CSS px trên màn hình (giống cursor, textarea, cỡ bút);
  // transform quy đổi sang pixel thật của canvas theo tỉ lệ hiển thị lúc này.
  syncTempTransform = () => {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;
    this.context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    return rect;
  };

  // Xoá canvas tạm, không phụ thuộc transform hiện tại.
  clearTempCanvas = () => {
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.restore();
  };

  updateImage = () => {
    this.contexto.save();
    this.contexto.setTransform(1, 0, 0, 1, 0, 0);
    this.contexto.drawImage(this.canvas, 0, 0);
    this.contexto.restore();
    this.cPush();
    this.updateCropprImage();
    this.clearTempCanvas();
  };

  _redrawMainCanvasFromHistory = (dataUrl) => {
    this.canvasPic.src = dataUrl;
    this.canvasPic.onload = () => {
      this.contexto.save();
      this.contexto.setTransform(1, 0, 0, 1, 0, 0);
      this.contexto.clearRect(0, 0, this.canvaso.width, this.canvaso.height);
      this.contexto.drawImage(this.canvasPic, 0, 0);
      this.contexto.restore();
      this.clearTempCanvas();
      this.updateCropprImage();
    };
  };

  _initializeCropper = () => {
    this.cropperImageElement = document.createElement("img");
    this.cropperImageElement.src = this.canvaso.toDataURL();
    this.cropperImageElement.style.display = "none";
    document.body.appendChild(this.cropperImageElement);

    this.cropper = new Croppr(this.cropperImageElement, {
      startSize: [0, 0, "%"],
      onInitialize: (instance) => {
        if (!document.getElementById("imageTemp")) {
          instance.regionEl.parentNode.appendChild(this.canvas);
        }
        let cropprHandleContainer = document.querySelectorAll('.croppr-handleContainer');
        if(cropprHandleContainer) cropprHandleContainer[0].classList.add('is-hidden');
        this._cropprDisplaySize = this._getCropprDisplaySize(instance);
        this._setCropValue(instance.getValue("real"));
      },
      onCropEnd: (data) => {
        this._setCropValue(data);
        if(this.menu && this.menu.menuElement) return;
        this.menu.createMenu(0, 0);
        this._positionMenuAtRegion();
        let cropprHandleContainer = document.querySelectorAll('.croppr-handleContainer');
        if(cropprHandleContainer) cropprHandleContainer[0].classList.remove('is-hidden');
        this._setupMenuHandlers();
        this.createCursorDraw();
        this._handleKeyPress();
        

        // this.cropper.regionEl.addEventListener("dblclick", function(e)  {
        //   this.cropper.box.move(0, 0)
        //   this.cropper.box.resize(window.innerWidth, window.innerHeight, [0, 0])
        //   const t = this.cropper.eventBus;
        //   t.dispatchEvent(new CustomEvent("regionend", {
        //       detail: {
        //           mouseX: 0,
        //           mouseY: 0
        //       }
        //   }))
          

        // }.bind(this));
      },
      onCropMove: () => {
        requestAnimationFrame(this._positionMenuAtRegion);
      },
    });
  };

  // Vùng crop lưu theo pixel thật của ảnh (giống canvas), không phụ thuộc zoom.
  _setCropValue = (data) => {
    this.cropprX = data.x;
    this.cropprY = data.y;
    this.cropprWidth = data.width;
    this.cropprHeight = data.height;
  };

  _getCropprDisplaySize = (cropper = this.cropper) => {
    const rect = cropper.imageEl.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  };

  // Đặt menu ngay trên vùng crop, theo toạ độ hiển thị thực tế của region.
  _positionMenuAtRegion = () => {
    if (!this.menu || !this.menu.menuElement || !this.cropper) return;
    const region = this.cropper.regionEl.getBoundingClientRect();
    // Đặt left trước rồi mới đo chiều cao: menu có thể xuống dòng khi sát mép phải.
    this.menu.setPosition(region.left, region.top);
    const menuHeight = this.menu.menuElement.offsetHeight;
    this.menu.setPosition(region.left, region.top - menuHeight - 10);
    this.menu.hasBeenMoved = false;
  };

  // Khi cửa sổ đổi kích thước hoặc người dùng zoom, ảnh hiển thị đổi kích thước theo.
  // Croppr giữ box theo CSS px nên phải scale box theo tỉ lệ mới để vẫn khớp với ảnh.
  _handleResize = () => {
    if (this.cropper && this.cropper.box && this._cropprDisplaySize) {
      const prev = this._cropprDisplaySize;
      const next = this._getCropprDisplaySize();
      if (prev.width > 0 && prev.height > 0 && next.width > 0 && next.height > 0) {
        const rx = next.width / prev.width;
        const ry = next.height / prev.height;
        const box = this.cropper.box;
        box.set(box.x1 * rx, box.y1 * ry, box.x2 * rx, box.y2 * ry);
        this.cropper.redraw();
        this._cropprDisplaySize = next;
      }
    }
    // cropper.redraw() cập nhật DOM trong requestAnimationFrame, nên đặt menu sau đó.
    requestAnimationFrame(this._repositionMenuAfterResize);
  };

  _repositionMenuAfterResize = () => {
    if (this.menu && this.menu.menuElement) {
      if (this.menu.isDragging || this.menu.hasBeenMoved) {
        // Giữ vị trí người dùng đã kéo, chỉ ép lại vào trong cửa sổ.
        this.menu.setPosition(this.menu.menuElement.offsetLeft, this.menu.menuElement.offsetTop);
      } else {
        this._positionMenuAtRegion();
      }
    }
  };

  

  _setupMenuHandlers = () => {
    const toolSelectLinks = document.querySelectorAll(".toolSelect a");
    toolSelectLinks.forEach((item) => {
      const id = item.id;
      const type = item.dataset.type;
      switch (type) {
        case "tool":
          item.addEventListener("click", (e) =>
            this._handleToolSelection(e, id, toolSelectLinks)
          );
          break;
        case "control":
          item.addEventListener("click", () => this._handleUndoRedo(id));
          break;
        case "action":
          item.addEventListener("click", () => this._handleActions(id));
          break;
        case "close":
          item.addEventListener("click", () => this._handleClose());
          break;
      }
    });
    const colorInput = document.getElementById("inputColor");
    if (colorInput) {
      colorInput.addEventListener("change", (e) => {
        this.strokeStyle = e.target.value;
        if (this.tool && typeof this.tool.onColorChange === "function") {
          this.tool.onColorChange(this.strokeStyle);
        }
      });
    }
  };

  _handleToolSelection = (e, id, toolSelectLinks) => {
    e.preventDefault();
    const currentLink = e.currentTarget;
    if (this.tool && typeof this.tool.destroy === "function") {
      this.tool.destroy();
    }
    if (currentLink.classList.contains("active")) {
      currentLink.classList.remove("active");
      this.tool = null;
      this.canvas.style.zIndex = 0;
      this.showCropprHandles(true);
      this.showCursorDraw(false);
    } else {
      toolSelectLinks.forEach((link) => link.classList.remove("active"));
      currentLink.classList.add("active");
      this.tool = new this.tools[id](this);
      this.canvas.style.zIndex = 10;
      this.showCropprHandles(false);
      this.showCursorDraw(true);
    }
  };

  
  _handleKeyPress = () => {
    document.addEventListener("keydown", t => {
          if (t.ctrlKey && "KeyP" == t.code) {
              document.getElementById("pencil").click()
          }
          if (t.ctrlKey && "KeyX" == t.code) {
              document.getElementById("marker").click()
          }
          if (t.ctrlKey && "KeyL" == t.code) {
              document.getElementById("line").click()
          }
          if (t.ctrlKey && "KeyA" == t.code) {
              document.getElementById("lineArrow").click()
          }
          if (t.ctrlKey && "KeyU" == t.code) {
              document.getElementById("rect").click()
          }
          if (t.ctrlKey && "KeyE" == t.code) {
              document.getElementById("ellipse").click()
          }
          if (t.ctrlKey && "KeyT" == t.code) {
              document.getElementById("text").click()
          }
          if (t.ctrlKey && "KeyI" == t.code) {
              document.getElementById("inputColor").click()
          }
          if (t.ctrlKey && "KeyZ" == t.code && this.cUndo(),
          t.ctrlKey && "KeyY" == t.code && this.cRedo(),
          t.ctrlKey && "KeyG" == t.code) {
              //document.getElementById("link").click()
          }
          if (t.ctrlKey && "KeyO" == t.code) {
              document.getElementById("view").click()
          }
          if (t.ctrlKey && "KeyC" == t.code) {
              document.getElementById("copy").click()
          }
          if (t.ctrlKey && "KeyS" == t.code) {
              document.getElementById("save").click()
          }
          if ("Escape" == t.code) {
              document.getElementById("close").click()
          }
      }
      , !1)
    
  }
  _handleUndoRedo = (id) => {
    if (id === "undo") this.cUndo();
    else this.cRedo();
  };

  _handleActions = (id) => {
    if (id === "save") this._saveImage();
    else this._copyImageToClipboard();
  };

  _handleClose = () => {
    this.options.onClose?.();
  };

  _saveImage = () => {
    this.cropImage((destCanvas) => {
      let dataURL = destCanvas.toDataURL("image/png");
      let el = document.createElement("a");
      el.href = dataURL;
      el.download = "screenshoteasy.png";
      el.click();
    });
  };


  /**
   * Crops the image and copies it to the user's clipboard.
   * @private
   */
  
  _copyImageToClipboard = () => {
    // Gọi cropImage và truyền vào một callback để xử lý blob dữ liệu ảnh
    this.cropImage((destCanvas) => {
      if (!destCanvas) {
        console.error("Failed to generate image blob for copying.");
        // (Tùy chọn) Hiển thị thông báo lỗi cho người dùng        
        Notifier.show({ message: `Failed to copy image to clipboard`, type: 'error' });
        return;
      }

      destCanvas.toBlob((blob) => {
        if (!blob) {
          console.error("Failed to convert canvas to blob");
          Notifier.show({ message: `Failed to copy image to clipboard`, type: 'error' });
          return;
        }

        const item = new ClipboardItem({ [blob.type]: blob });

        navigator.clipboard
          .write([item])
          .then(() => {
            console.log("Image copied to clipboard successfully!");           
            Notifier.show({ message: `Copied to clipboard!`, type: 'success' });
          })
          .catch((err) => {
            console.error("Failed to copy image to clipboard:", err);
            Notifier.show({ message: `Failed to copy image to clipboard`, type: 'error' });
            
          });
      }, "image/png");
    });
  };

  _addCanvasEventListeners = () => {
    this.canvas.addEventListener("mousedown", this._canvasEvent);
    this.canvas.addEventListener("mousemove", this._canvasEvent);
    this.canvas.addEventListener("mouseup", this._canvasEvent);
    this.canvas.addEventListener("mouseleave", this._canvasEvent);
    this.canvas.addEventListener("wheel", this._handleWheel, {
      passive: false,
    });
  };

  _handleWheel = (ev) => {
    if (ev.ctrlKey) return; // Ctrl + lăn chuột: để trình duyệt zoom
    ev.preventDefault();
    if (!this.tool) return;
    const direction = Math.sign(ev.deltaY);
    if (this.tool instanceof TextTool) {
      const amount = 2;
      if (direction > 0) this.tool.decreaseFontSize(amount);
      else this.tool.increaseFontSize(amount);
      //Notifier.show({ message: `Font Size: ${this.tool.currentFontSizePx}` });
      this._showToolSizeIndicator(`Font Size: ${this.tool.currentFontSizePx}`);
    } else {
      const amount = ev.shiftKey ? 5 : 1;
      if (direction > 0) this.lineWidth = Math.max(1, this.lineWidth - amount);
      else this.lineWidth = Math.min(100, this.lineWidth + amount);
      this.updateCursorSize();
      this._showToolSizeIndicator(`Brush Size: ${this.lineWidth}`);
    }
  };

  _showToolSizeIndicator = (textContent) => {
    let indicator = document.getElementById("toolSizeIndicator");
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.id = "toolSizeIndicator";
      Object.assign(indicator.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        color: "white",
        padding: "10px 20px",
        borderRadius: "8px",
        fontSize: "18px",
        fontFamily: "sans-serif",
        zIndex: "9999",
        pointerEvents: "none",
        transition: "opacity 0.5s ease-out",
        whiteSpace: "nowrap",
      });
      document.body.appendChild(indicator);
    }
    indicator.textContent = textContent;
    indicator.style.opacity = 1;
    if (this.toolSizeIndicatorTimeout)
      clearTimeout(this.toolSizeIndicatorTimeout);
    this.toolSizeIndicatorTimeout = setTimeout(() => {
      indicator.style.opacity = 0;
    }, 1200);
  };

  showCropprHandles = (enable) => {
    const displayStyle = enable ? "block" : "none";
    document.querySelectorAll(".croppr-handle").forEach((item) => {
      item.style.display = displayStyle;
    });
  };

  showCursorDraw = (enable) => {
    if (!this.cursorDraw) return;
    const displayStyle = enable ? "block" : "none";
    this.cursorDraw.style.display = displayStyle;
  };

  updateCropprImage = () => {
    if (this.cPushArray.length === 0) return;
    const cropprImage = document.getElementById("cropprImage");
    const cropprImageClipped = document.getElementById("cropprImageClipped");
    const latestImageData = this.cPushArray[this.cStep];
    if (cropprImage) cropprImage.src = latestImageData;
    if (cropprImageClipped) cropprImageClipped.src = latestImageData;
    
  };

  cPush = () => {
    const currentDataUrl = this.canvaso.toDataURL();
    if (this.cStep === -1 || this.cPushArray[this.cStep] !== currentDataUrl) {
      this.cStep++;
      if (this.cStep < this.cPushArray.length)
        this.cPushArray.length = this.cStep;
      this.cPushArray.push(currentDataUrl);
    }
  };

  cUndo = () => {
    if (this.cStep > 0) {
      this.cStep--;
      this._redrawMainCanvasFromHistory(this.cPushArray[this.cStep]);
    }
  };

  cRedo = () => {
    if (this.cStep < this.cPushArray.length - 1) {
      this.cStep++;
      this._redrawMainCanvasFromHistory(this.cPushArray[this.cStep]);
    }
  };

  cropImage = (cb = () => {}) => {
    if (this.cPushArray.length === 0 || this.cStep < 0) return;

    const imageFromHistory = new Image();
    imageFromHistory.src = this.cPushArray[this.cStep];

    imageFromHistory.onerror = () => {
      console.error("Failed to load image from history for cropping.");
    };

    imageFromHistory.onload = () => {
      const destCanvas = this.imgCroppedCanvas;
      const destCtx = this.ctxImgCrop;

      destCanvas.width = this.cropprWidth;
      destCanvas.height = this.cropprHeight;

      // Xóa canvas
      destCtx.clearRect(0, 0, this.cropprWidth, this.cropprHeight);

      // Tọa độ crop nguồn trên ảnh gốc (pixel vật lý)
      const sx = this.cropprX;
      const sy = this.cropprY;
      let sWidth = this.cropprWidth;
      let sHeight = this.cropprHeight;

      // Vẽ vào canvas với kích thước logic
      destCtx.drawImage(
        imageFromHistory,
        sx,
        sy,
        sWidth,
        sHeight,
        0,
        0,
        this.cropprWidth,
        this.cropprHeight
      );
      
      cb(destCanvas);
     
    };
  };

  

  createCursorDraw = () => {
      this.cursorDraw = document.createElement("div");
      this.cursorDraw.className = "cursor-draw";
      this.cursorDraw.id = "cursorDraw";      
      Object.assign(this.cursorDraw.style, { 
        width: this.lineWidth + "px", 
        height: this.lineWidth + "px",         
      }); 
      this.elem.appendChild(this.cursorDraw);
  }

  destroy = () => {
    console.log("Destroying DrawingCore instance...");
    this.canvas.removeEventListener("mousedown", this._canvasEvent);
    this.canvas.removeEventListener("mousemove", this._canvasEvent);
    this.canvas.removeEventListener("mouseup", this._canvasEvent);
    this.canvas.removeEventListener("mouseleave", this._canvasEvent);
    this.canvas.removeEventListener("wheel", this._handleWheel);
    window.removeEventListener("resize", this._handleResize);

    if (this.cropper) this.cropper.destroy();
    if (this.menu && typeof this.menu.destroy === "function")
      this.menu.destroy();
    if (this.tool && typeof this.tool.destroy === "function")
      this.tool.destroy();

    if (this.cropperImageElement && this.cropperImageElement.parentNode) {
      this.cropperImageElement.parentNode.removeChild(this.cropperImageElement);
    }
    while (this.elem.firstChild) {
      this.elem.removeChild(this.elem.firstChild);
    }

    const indicator = document.getElementById("toolSizeIndicator");
    if (indicator) indicator.parentNode.removeChild(indicator);
  };
}
