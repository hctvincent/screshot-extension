import Tesseract from 'tesseract.js';
import Croppr from "../croppr";
import Modal from "../ui/modal";
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
    this._createCanvas();
    this.menu = new Menu(this.elem);
    if (this.options.bgImage) {
      const bgImage = new Image();
      bgImage.crossOrigin = "Anonymous";
      bgImage.src = this.options.bgImage;
      bgImage.onload = () => {
        const displayWidth = this.canvaso.width / this.dpr;
        const displayHeight = this.canvaso.height / this.dpr;
        this.contexto.drawImage(bgImage, 0, 0, displayWidth, displayHeight);
        this.cPush();
        this._initializeCropper();
      };
    } else {
      this.cPush();
      this._initializeCropper();
    }
    if (this.tools[this.tool_default]) {
      this.tool = new this.tools[this.tool_default](this);
    }
    this._addCanvasEventListeners();
  };

  _createCanvas = () => {
    const width = this.options.width || window.innerWidth;
    const height = this.options.height || window.innerHeight;
    this.canvaso = document.createElement("canvas");
    this.canvaso.id = "imageView";
    this.canvaso.width = width * this.dpr;
    this.canvaso.height = height * this.dpr;
    this.canvaso.style.width = `${width}px`;
    this.canvaso.style.height = `${height}px`;
    this.contexto = this.canvaso.getContext("2d");
    this.contexto.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.elem.appendChild(this.canvaso);
    this.canvas = document.createElement("canvas");
    this.canvas.id = "imageTemp";
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.context = this.canvas.getContext("2d");
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.imgCroppedCanvas = document.createElement("canvas");
    this.imgCroppedCanvas.id = "imgCroppedCanvas";
    this.ctxImgCrop = this.imgCroppedCanvas.getContext("2d");
  };

  _canvasEvent = (ev) => {
    const rect = this.canvas.getBoundingClientRect();
    const zoomX = rect.width > 0 ? this.canvas.offsetWidth / rect.width : 1;
    const zoomY = rect.height > 0 ? this.canvas.offsetHeight / rect.height : 1;
    const mouseXInZoomedBox = ev.clientX - rect.left;
    const mouseYInZoomedBox = ev.clientY - rect.top;
    const logicalX = mouseXInZoomedBox * zoomX;
    const logicalY = mouseYInZoomedBox * zoomY;
    ev._x = logicalX;
    ev._y = logicalY;
    
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
  resizeCursor(t) {
    t.deltaY < 0 && this.lineWidth < 125 && (this.lineWidth++,
    this.cursorDraw.style.width = this.lineWidth + "px",
    this.cursorDraw.style.height = this.lineWidth + "px"),
    t.deltaY > 0 && this.lineWidth > 1 && (this.lineWidth--,
    this.cursorDraw.style.width = this.lineWidth + "px",
    this.cursorDraw.style.height = this.lineWidth + "px")
   }

   updateCursorPosition(e) {
    if (this.cursorDraw) {
      this.cursorDraw.style.top = e.offsetY;
      this.cursorDraw.style.left = e.offsetX;
    }
   }  

  updateImage = () => {
    this.contexto.save();
    this.contexto.setTransform(1, 0, 0, 1, 0, 0);
    this.contexto.drawImage(this.canvas, 0, 0);
    this.contexto.restore();
    this.cPush();
    this.updateCropprImage();
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.restore();
  };

  _redrawMainCanvasFromHistory = (dataUrl) => {
    this.canvasPic.src = dataUrl;
    this.canvasPic.onload = () => {
      this.contexto.save();
      this.contexto.setTransform(1, 0, 0, 1, 0, 0);
      this.contexto.clearRect(0, 0, this.canvaso.width, this.canvaso.height);
      this.contexto.drawImage(this.canvasPic, 0, 0);
      this.contexto.restore();
      this.context.save();
      this.context.setTransform(1, 0, 0, 1, 0, 0);
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.context.restore();
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
        requestAnimationFrame(() => {
          const regionEl = this.cropper.regionEl;
          if (regionEl && regionEl.clientWidth > 0) {           
            
            let cropprHandleContainer = document.querySelectorAll('.croppr-handleContainer');
            if(cropprHandleContainer) cropprHandleContainer.style.display = 'none';

            
            this.cropprX = regionEl.offsetLeft;
            this.cropprY = regionEl.offsetTop;
            this.cropprWidth = regionEl.clientWidth;
            this.cropprHeight = regionEl.clientHeight;
            
            
           

          }
        });
      },
      onCropEnd: (data) => {        
        this.cropprX = data.x;
        this.cropprY = data.y;
        this.cropprWidth = data.width;
        this.cropprHeight = data.height;
        if(this.menu && this.menu.menuElement) return;
        this.menu.createMenu(
          data.x,
          data.y,
        );
        let menuHeight = this.menu.menuElement.clientHeight;
        this.menu.setPosition(
          data.x / this.dpr,
          (data.y - menuHeight-10) / this.dpr,
        );
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
      onCropMove: (data) => {
        requestAnimationFrame(() => {
          
          if (this.menu && this.menu.menuElement) {
            let menuHeight = this.menu.menuElement.clientHeight;
            this.menu.setPosition(
              data.x / this.dpr,
              (data.y - menuHeight-10) / this.dpr,
            );
          } 
        });
      },
    });
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
    else if (id === "ocr") this._runOCROnCroppedArea();
    else this._copyImageToClipboard();
  };

  _handleClose = () => {
    null !== this.options.onClose && this.options.onClose()
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


  _runOCROnCroppedArea = () => {
    this._showOCRIndicator('Recognizing text...');

    // Gọi cropImage để lấy ảnh dưới dạng Data URL
    this.cropImage((destCanvas) => {
        if (!destCanvas) {
          console.error("Failed to get cropped image for OCR.");
          this._hideOCRIndicator("OCR Failed!");
            return;
        }

        // Sử dụng Tesseract để nhận dạng văn bản từ Data URL
        let dataUrl = destCanvas.toDataURL("image/png");
        Tesseract.recognize(
            dataUrl,
            'eng', // Ngôn ngữ nhận dạng, ví dụ: 'eng' (tiếng Anh), 'vie' (tiếng Việt)
            { 
                logger: m => {
                    // Hiển thị tiến trình cho người dùng
                    if (m.status === 'recognizing text') {
                        const progress = (m.progress * 100).toFixed(0);
                        this._showOCRIndicator(`Recognizing... ${progress}%`);
                    }
                } 
            }
        ).then(({ data: { text } }) => {
            console.log("Recognized Text:", text);
            this._hideOCRIndicator("Done!");
            
            // Hiển thị kết quả cho người dùng
            this._handleOCRResult(text);

        }).catch(err => {
            console.error("Tesseract Error:", err);
            this._hideOCRIndicator("OCR Error!");
        });

    });
  }

   /**
     * Xử lý kết quả văn bản nhận dạng được bằng cách hiển thị một modal.
     * @private
     * @param {string} text - Văn bản đã được nhận dạng.
     */
  _handleOCRResult = (text) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
          new Modal({
              title: "OCR Result",
              content: "No text could be recognized in the selected area.",
              actions: [{ label: 'Close', className: 'primary', onClick: modal => modal.close() }]
          });
          return;
      }

      // Tạo một textarea để hiển thị kết quả và cho phép người dùng chỉnh sửa
      const contentElement = document.createElement('textarea');
      contentElement.className = 'ocr-result-textarea';
      contentElement.value = trimmedText;

      // Tạo và hiển thị modal
      new Modal({
          title: "Recognized Text",
          content: contentElement,
          actions: [
              {
                  label: "Cancel",
                  onClick: (modal) => {
                      modal.close();
                  }
              },
              {
                  label: "Copy Text",
                  className: "primary", // Style nút chính
                  onClick: (modal) => {
                      navigator.clipboard.writeText(contentElement.value).then(() => {
                          //this._showToolSizeIndicator(" Copied to clipboard!");
                          Notifier.show({ message: `Copied to clipboard!`, type: 'success' });
                          modal.close(); // Đóng modal sau khi copy
                      }).catch(err => {
                          console.error("Failed to copy text:", err);
                          Notifier.show({ message: `Failed to copy text`, type: 'error' });
                          // Có thể hiển thị lỗi ngay trong modal
                      });
                  }
              }
          ]
      });
  }

  /**
   * Hiển thị một indicator toàn màn hình cho quá trình OCR.
   * @private
   * @param {string} message - Thông điệp cần hiển thị.
   */
  _showOCRIndicator = (message) => {
    if (!this.ocrIndicator) {
      this.ocrIndicator = document.createElement('div');
      Object.assign(this.ocrIndicator.style, {
        position: 'fixed',
        top: '0', left: '0',
        width: '100vw', height: '100vh',
        backgroundColor: 'transparent',
        color: 'black',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        fontFamily: 'sans-serif',
        zIndex: '10001',
        transition: 'opacity 0.3s'
      });
      document.body.appendChild(this.ocrIndicator);
    }
    this.ocrIndicator.textContent = message;
    this.ocrIndicator.style.opacity = '1';
    this.ocrIndicator.style.display = 'flex';
  }

  _hideOCRIndicator = (finalMessage) => {
    if (!this.ocrIndicator) return;
    this.ocrIndicator.textContent = finalMessage;
    setTimeout(() => {
        if (this.ocrIndicator) {
            this.ocrIndicator.style.opacity = '0';
            setTimeout(() => {
                if (this.ocrIndicator) this.ocrIndicator.style.display = 'none';
            }, 300);
        }
    }, 1500);
  }


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
    ev.preventDefault();
    if (!this.tool) return;
    this.resizeCursor(ev);
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
