
class HtmlToCanvas {

    static async captureSource(element, width, height, excludeGpuLayer) {
        if (!element) {
            throw new Error("explodeChildren cannot capture a UI without a DOM element.");
        }

        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            throw new RangeError("explodeChildren requires positive dimensions before capturing.");
        }

        if (element instanceof HTMLImageElement) {
            return HtmlToCanvas.captureImage(element, width, height);
        }

        if (document.fonts?.ready) {
            await document.fonts.ready;
        }

        const pixelRatio = window.devicePixelRatio || 1;
        const canvas = document.createElement("canvas");

        canvas.width = Math.max(1, Math.round(width * pixelRatio));
        canvas.height = Math.max(1, Math.round(height * pixelRatio));

        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("Could not create a 2D context for explodeChildren capture.");
        }

        context.scale(pixelRatio, pixelRatio);

        const sourceRect = element.getBoundingClientRect();

        await HtmlToCanvas.drawElement(context, element, sourceRect, excludeGpuLayer);

        return {
            canvas,
            width,
            height,
            pixelRatio
        };
    }

    static async drawElement(context, element, sourceRect, excludeGpuLayer) {
        if (element === excludeGpuLayer?.()) {
            return;
        }
        
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);

        const x = rect.left - sourceRect.left;
        const y = rect.top - sourceRect.top;
        const width = rect.width;
        const height = rect.height;

        context.save();

        HtmlToCanvas.clipBorderRadius(context, style, x, y, width, height);

        if (style.backgroundColor !== "rgba(0, 0, 0, 0)") {
            context.fillStyle = style.backgroundColor;
            context.fillRect(x, y, width, height);
        }

        await HtmlToCanvas.drawBackgroundImage(context, style, x, y, width, height);

        if (element instanceof HTMLImageElement) {
            if (!element.complete) {
                await element.decode().catch(() => {});
            }

            context.drawImage(element, x, y, width, height);
            context.restore();
            return;
        }

        if (element instanceof HTMLCanvasElement) {
            await HtmlToCanvas.drawCanvas(context, element, x, y, width, height);
            context.restore();
            return;
        }

        context.restore();

        HtmlToCanvas.drawText(context, element, sourceRect);

        for (const child of element.children) {
            await HtmlToCanvas.drawElement(context, child, sourceRect);
        }
    }

    static async drawBackgroundImage(context, style, x, y, width, height) {
        const backgroundImage = style.backgroundImage;

        if (!backgroundImage || backgroundImage === "none") {
            return;
        }

        const match = backgroundImage.match(/url\((['"]?)(.*?)\1\)/);

        if (!match?.[2]) {
            return;
        }

        const image = await HtmlToCanvas.loadBackgroundImage(match[2]);

        if (!image) {
            return;
        }

        const imageWidth = image.naturalWidth;
        const imageHeight = image.naturalHeight;

        if (!imageWidth || !imageHeight) {
            return;
        }

        let drawWidth = width;
        let drawHeight = height;

        if (style.backgroundSize === "cover") {
            const scale = Math.max(width / imageWidth, height / imageHeight);

            drawWidth = imageWidth * scale;
            drawHeight = imageHeight * scale;
        } else if (style.backgroundSize === "contain") {
            const scale = Math.min(width / imageWidth, height / imageHeight);

            drawWidth = imageWidth * scale;
            drawHeight = imageHeight * scale;
        }

        const drawX = x + HtmlToCanvas.getBackgroundPosition(style.backgroundPositionX, width, drawWidth);
        const drawY = y + HtmlToCanvas.getBackgroundPosition(style.backgroundPositionY, height, drawHeight);

        context.save();

        context.beginPath();
        context.rect(x, y, width, height);
        context.clip();

        context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

        context.restore();
    }

    static async drawCanvas(context, canvas, x, y, width, height) {
        const source = typeof canvas.captureBitmap === "function"? await canvas.captureBitmap()  : canvas;

        if (!source) {
            return;
        }

        try {
            context.drawImage(source, x, y, width, height);
        } finally {
            if (source !== canvas) {
                source.close?.();
            }
        }
    }

    static getBackgroundPosition(position, containerSize, imageSize) {
        const remaining = containerSize - imageSize;

        if (!position) {
            return 0;
        }

        position = position.trim();

        if (position.endsWith("%")) {
            const percent = parseFloat(position);

            return Number.isFinite(percent) ? remaining * percent / 100 : 0;
        }

        if (position.endsWith("px")) {
            const pixels = parseFloat(position);

            return Number.isFinite(pixels) ? pixels : 0;
        }

        switch (position) {
            case "center":
                return remaining / 2;

            case "right":
            case "bottom":
                return remaining;

            default:
                return 0;
        }
    }

    static loadBackgroundImage(src) {
        return new Promise(resolve => {
            const image = new Image();

            try {
                const url = new URL(src, document.baseURI);

                if (url.origin !== window.location.origin) {
                    image.crossOrigin = "anonymous";
                }
            } catch {
            }

            image.onload = () => resolve(image);

            image.onerror = () => {
                console.warn(`Could not load explodeChildren background image: ${src}`);
                resolve(undefined);
            };

            image.src = src;
        });
    }

    static clipBorderRadius(context, style, x, y, width, height) {
        const radii = [
            parseFloat(style.borderTopLeftRadius) || 0,
            parseFloat(style.borderTopRightRadius) || 0,
            parseFloat(style.borderBottomRightRadius) || 0,
            parseFloat(style.borderBottomLeftRadius) || 0
        ];

        if (!radii.some(radius => radius > 0)) {
            return;
        }

        context.beginPath();
        context.roundRect(x, y, width, height, radii);
        context.clip();
    }

    static drawText(context, element, sourceRect) {
        const style = getComputedStyle(element);

        for (const node of element.childNodes) {
            if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) {
                continue;
            }

            const range = document.createRange();
            range.selectNodeContents(node);

            const rect = range.getBoundingClientRect();

            context.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].filter(Boolean).join(" ");
            context.fillStyle = style.color;
            context.textBaseline = "alphabetic";

            const metrics = context.measureText(node.textContent);
            const fontSize = parseFloat(style.fontSize);

            const ascent = metrics.fontBoundingBoxAscent ?? fontSize * 0.8;
            const descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.2;

            const x = rect.left - sourceRect.left;
            const y = rect.top - sourceRect.top + (rect.height - ascent - descent) / 2 + ascent;

            context.fillText(node.textContent, x, y);
        }
    }

    static captureImage(image, width, height) {
        const pixelRatio = window.devicePixelRatio || 1;
        const canvas = document.createElement("canvas");

        canvas.width = Math.max(1, Math.round(width * pixelRatio));
        canvas.height = Math.max(1, Math.round(height * pixelRatio));

        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("Could not create a 2D context for explodeChildren image capture.");
        }

        context.scale(pixelRatio, pixelRatio);
        context.drawImage(image, 0, 0, width, height);

        return {
            canvas,
            width,
            height,
            pixelRatio
        };
    }
}

export { HtmlToCanvas };
