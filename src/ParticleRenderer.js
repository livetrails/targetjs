import { ColorUtil } from "./ColorUtil.js";
import { TUtil } from "./TUtil.js";

/**
 * It renders GPU-backed children using WebGPU.
 */
class ParticleRenderer {
    constructor(tmodel) {
        this.tmodel = tmodel;

        this.canvas = undefined;
        this.device = undefined;
        this.context = undefined;
        this.format = undefined;

        this.pipeline = undefined;
        this.bindGroup = undefined;

        this.particleBuffer = undefined;
        this.targetParticleBuffer = undefined;
        this.uniformBuffer = undefined;

        this.transitionStep = 0;
        this.transitionActive = false;
        this.particleCount = 0;
        
        this.canvasLayer = undefined;
        
        this.canvasX = 0;
        this.canvasY = 0;

        this.initializationPromise = undefined;
    }

    async init() {
        if (this.device) {
            return true;
        }

        if (!this.tmodel.hasDom()) {
            return false;
        }

        if (!this.initializationPromise) {
            this.initializationPromise = this.initialize().catch(error => {
                this.initializationPromise = undefined;
                throw error;
            });
        }

        await this.initializationPromise;

        return !!this.device;
    }

    async initialize() {
        if (!navigator.gpu) {
            throw new Error("WebGPU is not supported by this browser.");
        }

        if (!globalThis.GPUBufferUsage) {
            throw new Error("GPUBufferUsage is not available in this WebGPU environment.");
        }

        this.createCanvas();

        const adapter = await navigator.gpu.requestAdapter();

        if (!adapter) {
            throw new Error("Unable to obtain a WebGPU adapter.");
        }

        this.device = await adapter.requestDevice();
        this.context = this.canvas.getContext("webgpu");

        if (!this.context) {
            throw new Error("Unable to obtain a WebGPU canvas context.");
        }

        this.format = navigator.gpu.getPreferredCanvasFormat();

        this.resizeCanvas();

        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: "premultiplied"
        });

        this.createUniformBuffer();
        this.createPipeline();
    }

    createCanvas() {
        if (this.canvas) {
            return;
        }

        const parent = this.tmodel.$dom?.element;

        if (!parent) {
            throw new Error("Unable to create a GPU child layer without a parent DOM element.");
        }
        
        const oldLayer = parent.querySelector('[data-targetjs-gpu-layer="true"]');

        if (oldLayer) {
            oldLayer.remove();
        }

        this.canvasLayer = document.createElement("div");
        this.canvasLayer.setAttribute("data-targetjs-gpu-layer", "true");
        Object.assign(this.canvasLayer.style, {
            position: "absolute",
            left: "0px",
            top: "0px",
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: "0"
        });

        this.canvas = document.createElement("canvas");
        this.canvas.setAttribute("data-targetjs-gpu-children", "true");

        Object.assign(this.canvas.style, {
            position: "absolute",
            left: "0px",
            top: "0px",
            width: "1px",
            height: "1px",
            display: "block",
            pointerEvents: "none"
        });

        this.canvasLayer.appendChild(this.canvas);
        parent.prepend(this.canvasLayer);
        
        this.onScroll = () => this.tmodel.requestParticleRender();

        this.scrollElements = [
            ...new Set([
                this.tmodel.$dom?.element,
                this.tmodel.getParent()?.$dom?.element
            ].filter(Boolean))
        ];

        for (const element of this.scrollElements) {
            element.addEventListener("scroll", this.onScroll, { passive: true });
        }      
    }

    createUniformBuffer() {
        this.uniformBuffer = this.device.createBuffer({
            size: 32,
            usage: globalThis.GPUBufferUsage.UNIFORM | globalThis.GPUBufferUsage.COPY_DST
        });
    }

    createPipeline() {
        const shaderModule = this.device.createShaderModule({
            code: `
                struct Uniforms {
                    viewport: vec2f,
                    contentOffset: vec2f,
                    step: f32,
                    transitionActive: f32,
                    padding: vec2f,
                }

                @group(0) @binding(0)
                var<uniform> uniforms: Uniforms;

                struct VertexOutput {
                    @builtin(position) position: vec4f,
                    @location(0) localPosition: vec2f,
                    @location(1) backgroundColor: vec4f,
                    @location(2) size: vec2f,
                    @location(3) borderRadius: f32,
                }

                fn getProgress(step: f32, steps: f32) -> f32 {
                    if (uniforms.transitionActive < 0.5) {
                        return 0.0;
                    }

                    if (steps < 0.0) {
                        return 0.0;
                    }

                    if (steps == 0.0) {
                        return 1.0;
                    }

                    return clamp(step / steps, 0.0, 1.0);
                }

                @vertex
                fn vertexMain(
                    @location(0) childPosition: vec2f,
                    @location(1) childSize: vec2f,
                    @location(2) childBackgroundColor: vec4f,
                    @location(3) childGeometry: vec2f,
                    @location(4) targetPosition: vec2f,
                    @location(5) targetSize: vec2f,
                    @location(6) targetBackgroundColor: vec4f,
                    @location(7) targetGeometry: vec2f,
                    @location(8) targetPositionSteps: vec2f,
                    @location(9) targetSizeSteps: vec2f,
                    @location(10) targetBackgroundColorSteps: f32,
                    @location(11) targetGeometrySteps: vec2f,
                    @location(12) childScale: f32,
                    @location(13) targetScale: f32,
                    @location(14) targetScaleSteps: f32,
                    @builtin(vertex_index) vertexIndex: u32
                ) -> VertexOutput {
                    let corners = array<vec2f, 6>(
                        vec2f(-1.0, -1.0),
                        vec2f( 1.0, -1.0),
                        vec2f(-1.0,  1.0),
                        vec2f(-1.0,  1.0),
                        vec2f( 1.0, -1.0),
                        vec2f( 1.0,  1.0)
                    );

                    let xProgress = getProgress(uniforms.step, targetPositionSteps.x);
                    let yProgress = getProgress(uniforms.step, targetPositionSteps.y);
                    let widthProgress = getProgress(uniforms.step, targetSizeSteps.x);
                    let heightProgress = getProgress(uniforms.step, targetSizeSteps.y);
                    let backgroundColorProgress = getProgress(uniforms.step, targetBackgroundColorSteps);
                    let borderRadiusProgress = getProgress(uniforms.step, targetGeometrySteps.x);
                    let rotateProgress = getProgress(uniforms.step, targetGeometrySteps.y);
                    let scaleProgress = getProgress(uniforms.step, targetScaleSteps);
            
                    let position = vec2f(
                        mix(childPosition.x, targetPosition.x, xProgress),
                        mix(childPosition.y, targetPosition.y, yProgress)
                    );

                    let size = vec2f(
                        mix(childSize.x, targetSize.x, widthProgress),
                        mix(childSize.y, targetSize.y, heightProgress)
                    );

                    let backgroundColor = mix(childBackgroundColor, targetBackgroundColor, backgroundColorProgress);
                    let borderRadius = mix(childGeometry.x, targetGeometry.x, borderRadiusProgress);
                    let rotate = mix(childGeometry.y, targetGeometry.y, rotateProgress);
                    let scale = mix(childScale, targetScale, scaleProgress);

                    let localPosition = corners[vertexIndex];
                    let localPixelPosition = localPosition * size * 0.5 * scale;

                    let angle = rotate * 3.141592653589793 / 180.0;
                    let cosine = cos(angle);
                    let sine = sin(angle);

                    let rotatedPosition = vec2f(
                        localPixelPosition.x * cosine - localPixelPosition.y * sine,
                        localPixelPosition.x * sine + localPixelPosition.y * cosine
                    );

                    let elementCenter = position - uniforms.contentOffset + size * 0.5;
                    let pixelPosition = elementCenter + rotatedPosition;

                    let clipPosition = vec2f(
                        pixelPosition.x / uniforms.viewport.x * 2.0 - 1.0,
                        1.0 - pixelPosition.y / uniforms.viewport.y * 2.0
                    );

                    var output: VertexOutput;

                    output.position = vec4f(clipPosition, 0.0, 1.0);
                    output.localPosition = localPosition;
                    output.backgroundColor = backgroundColor;
                    output.size = size;
                    output.borderRadius = borderRadius;

                    return output;
                }
                @fragment
                fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
                    let halfSize = max(input.size * 0.5, vec2f(0.0001));
                    let radius = clamp(input.borderRadius, 0.0, min(halfSize.x, halfSize.y));
                    let pixelPosition = input.localPosition * halfSize;
                    let q = abs(pixelPosition) - (halfSize - vec2f(radius));
                    let distance = length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - radius;
                    let aa = max(fwidth(distance), 0.0001);

                    if (radius <= 0.0) {
                        return input.backgroundColor;
                    }

                    let coverage = 1.0 - smoothstep(-aa, aa, distance);

                    if (coverage <= 0.0) {
                        discard;
                    }

                    let alpha = input.backgroundColor.a * coverage;

                    return vec4f(input.backgroundColor.rgb * alpha, alpha);
                }
            `
        });

        this.pipeline = this.device.createRenderPipeline({
            layout: "auto",

            vertex: {
                module: shaderModule,
                entryPoint: "vertexMain",

                buffers: [
                    {
                        arrayStride: 80,
                        stepMode: "instance",

                        attributes: [
                            { shaderLocation: 0, offset: 0, format: "float32x2" },
                            { shaderLocation: 1, offset: 8, format: "float32x2" },
                            { shaderLocation: 2, offset: 16, format: "float32x4" },
                            { shaderLocation: 3, offset: 32, format: "float32x2" },
                            { shaderLocation: 12, offset: 68, format: "float32" }
                        ]
                    },
                    {
                        arrayStride: 80,
                        stepMode: "instance",

                        attributes: [
                            { shaderLocation: 4, offset: 0, format: "float32x2" },
                            { shaderLocation: 5, offset: 8, format: "float32x2" },
                            { shaderLocation: 6, offset: 16, format: "float32x4" },
                            { shaderLocation: 7, offset: 32, format: "float32x2" },
                            { shaderLocation: 8, offset: 40, format: "float32x2" },
                            { shaderLocation: 9, offset: 48, format: "float32x2" },
                            { shaderLocation: 10, offset: 56, format: "float32" },
                            { shaderLocation: 11, offset: 60, format: "float32x2" },
                            { shaderLocation: 13, offset: 68, format: "float32" },
                            { shaderLocation: 14, offset: 72, format: "float32" }
                        ]
                    }
                ]
            },

            fragment: {
                module: shaderModule,
                entryPoint: "fragmentMain",
                targets: [{
                    format: this.format,
                    blend: {
                        color: {
                            srcFactor: "one",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add"
                        },
                        alpha: {
                            srcFactor: "one",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add"
                        }
                    }
                }]            
            },
            primitive: {
                topology: "triangle-list"
            }
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),

            entries: [{
                binding: 0,
                resource: {
                    buffer: this.uniformBuffer
                }
            }]
        });
    }

    toNumber(value, defaultValue = 0) {
        const number = typeof value === "string" ? parseFloat(value) : Number(value);

        return Number.isFinite(number) ? number : defaultValue;
    }

    getBackgroundColor(value) {
        if (!TUtil.isDefined(value)) {
            return [0, 0, 0, 0];
        }

        if (Array.isArray(value)) {
            return [
                this.toNumber(value[0], 0),
                this.toNumber(value[1], 0),
                this.toNumber(value[2], 0),
                this.toNumber(value[3], 0)
            ];
        }

        const color = ColorUtil.color2Integers(value);

        if (!color) {
            return [0, 0, 0, 0];
        }

        let alpha = this.toNumber(color[3], 1);

        if (alpha > 1) {
            alpha /= 255;
        }

        return [
            this.toNumber(color[0], 0) / 255,
            this.toNumber(color[1], 0) / 255,
            this.toNumber(color[2], 0) / 255,
            alpha
        ];
    }

    getTargetStep(steps, key) {
        if (!steps || !Object.prototype.hasOwnProperty.call(steps, key)) {
            return -1;
        }

        return Math.max(0, this.toNumber(steps[key], 0));
    }

    writeParticleData(particleData, offset, values, steps, x = values?.x, y = values?.y) {
        values ||= {};

        const backgroundColor = this.getBackgroundColor(values.backgroundColor);
        const opacity = Math.max(0, Math.min(1, this.toNumber(values.opacity, 1)));

        particleData[offset] = this.toNumber(x, 0);
        particleData[offset + 1] = this.toNumber(y, 0);
        particleData[offset + 2] = this.toNumber(values.width, 0);
        particleData[offset + 3] = this.toNumber(values.height, 0);

        particleData[offset + 4] = backgroundColor[0];
        particleData[offset + 5] = backgroundColor[1];
        particleData[offset + 6] = backgroundColor[2];
        particleData[offset + 7] = backgroundColor[3] * opacity;
        particleData[offset + 8] = Math.max(0, this.toNumber(values.borderRadius, 0));
        particleData[offset + 9] = this.toNumber(values.rotate, 0);

        particleData[offset + 10] = this.getTargetStep(steps, "x");
        particleData[offset + 11] = this.getTargetStep(steps, "y");
        particleData[offset + 12] = this.getTargetStep(steps, "width");
        particleData[offset + 13] = this.getTargetStep(steps, "height");

        const backgroundColorSteps = this.getTargetStep(steps, "backgroundColor");
        const opacitySteps = this.getTargetStep(steps, "opacity");

        particleData[offset + 14] = opacitySteps >= 0 ? opacitySteps : backgroundColorSteps;
        particleData[offset + 15] = this.getTargetStep(steps, "borderRadius");
        particleData[offset + 16] = this.getTargetStep(steps, "rotate");
        particleData[offset + 17] = this.toNumber(values.scale, 1);
        particleData[offset + 18] = this.getTargetStep(steps, "scale");        
    }

    createChildData(children) {
        const particleData = new Float32Array(children.length * 20);

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const values = child.actualValues;
            const { x, y } = this.getParticlePosition(child, values);

            this.writeParticleData(particleData, i * 20, values, undefined, x, y);
        }

        return particleData;
    }

    createParticleData(values, targetSteps) {
        const particleData = new Float32Array(values.length * 20);

        for (let i = 0; i < values.length; i++) {
            const child = this.tmodel.childHandles[i];
            const { x, y } = this.getParticlePosition(child, values[i]);

            this.writeParticleData(particleData, i * 20, values[i], targetSteps?.[i], x, y);
        }

        return particleData;
    }

    uploadParticleBuffer(buffer, particleData) {
        if (!particleData.length) {
            buffer?.destroy();
            return undefined;
        }

        if (!buffer || buffer.size !== particleData.byteLength) {
            buffer?.destroy();

            buffer = this.device.createBuffer({
                size: particleData.byteLength,
                usage: globalThis.GPUBufferUsage.VERTEX | globalThis.GPUBufferUsage.COPY_DST
            });
        }

        this.device.queue.writeBuffer(buffer, 0, particleData);

        return buffer;
    }

    async setParticles(children) {
        children = Array.isArray(children) ? children : [children];

        const initialized = await this.init();

        if (!initialized) {
            return false;
        }

        const particleData = this.createChildData(children);

        this.particleCount = children.length;
        this.particleBuffer = this.uploadParticleBuffer(this.particleBuffer, particleData);
        this.targetParticleBuffer = this.uploadParticleBuffer(this.targetParticleBuffer, particleData);

        this.transitionStep = 0;
        this.transitionActive = false;

        this.render();

        return true;
    }

    async updateParticles(children) {
        children = Array.isArray(children) ? children : [children];

        const initialized = await this.init();

        if (!initialized) {
            return false;
        }

        const particleData = this.createChildData(children);

        this.particleCount = children.length;
        this.particleBuffer = this.uploadParticleBuffer(this.particleBuffer, particleData);

        if (!children.length || !this.transitionActive) {
            this.targetParticleBuffer = this.uploadParticleBuffer(this.targetParticleBuffer, particleData);
        }

        if (!children.length) {
            this.transitionStep = 0;
            this.transitionActive = false;
        }

        this.render();

        return true;
    }

    async setTargetParticles(values, steps, generation = this.tmodel.childGeneration) {
        values = Array.isArray(values) ? values : [values];

        const initialized = await this.init();

        if (!initialized || generation !== this.tmodel.childGeneration) {
            return false;
        }

        const currentChildren = this.tmodel.childHandles;

        if (values.length !== currentChildren.length) {
            return false;
        }

        if (this.particleCount !== currentChildren.length || !this.particleBuffer) {
            const currentParticleData = this.createChildData(currentChildren);

            this.particleCount = currentChildren.length;
            this.particleBuffer = this.uploadParticleBuffer(this.particleBuffer, currentParticleData);
        }

        const particleData = this.createParticleData(values, steps);

        this.targetParticleBuffer = this.uploadParticleBuffer(this.targetParticleBuffer, particleData);

        this.transitionStep = 0;
        this.transitionActive = true;

        this.render();

        return true;
    }

    setTransitionStep(step) {
        step = Math.max(0, this.toNumber(step, 0));

        if (step === this.transitionStep) {
            return;
        }

        this.transitionStep = step;
        this.render();
    }

    getRenderWidth() {
        const modelWidth = Number(this.tmodel.getWidth()) || 1;
        const parentWidth = Number(this.tmodel.getParent().getWidth()) || window.innerWidth || 1;

        return Math.max(1, Math.min(modelWidth, parentWidth));
    }

    getRenderHeight() {
        const modelHeight = Number(this.tmodel.getHeight()) || 1;
        const parentHeight = Number(this.tmodel.getParent()?.getHeight()) || window.innerHeight || 1;

        return Math.max(1, Math.min(modelHeight, parentHeight));
    }
    
    updateCanvasLayerWidthHeight() {
        if (!this.canvasLayer) {
            return;
        }

        const height = Math.max(this.getRenderHeight(), Number(this.tmodel.getContentHeight()) || 0);
        const width = Math.max(this.getRenderWidth(), Number(this.tmodel.getContentWidth()) || 0);

        const cssHeight = `${height}px`;
        const cssWidth = `${width}px`;

        if (this.canvasLayer.style.height !== cssHeight) {
            this.canvasLayer.style.height = cssHeight;
        }
        
        if (this.canvasLayer.style.width !== cssWidth) {
            this.canvasLayer.style.width = cssWidth;
        }
    }

    resizeCanvas() {
        if (!this.canvas || !this.device) {
            return;
        }

        const width = this.getRenderWidth();
        const height = this.getRenderHeight();
        const requestedPixelRatio = window.devicePixelRatio || 1;
        const maxTextureDimension = this.device.limits?.maxTextureDimension2D || 8192;
        const pixelRatio = Math.min(requestedPixelRatio, maxTextureDimension / width, maxTextureDimension / height);

        const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
        const pixelHeight = Math.max(1, Math.round(height * pixelRatio));

        const cssWidth = `${width}px`;
        const cssHeight = `${height}px`;

        if (this.canvas.style.width !== cssWidth) {
            this.canvas.style.width = cssWidth;
        }

        if (this.canvas.style.height !== cssHeight) {
            this.canvas.style.height = cssHeight;
        }

        if (this.canvas.width !== pixelWidth) {
            this.canvas.width = pixelWidth;
        }

        if (this.canvas.height !== pixelHeight) {
            this.canvas.height = pixelHeight;
        }
        
        this.updateCanvasLayerWidthHeight();
    }
    
    repositionCanvas() {
        if (!this.canvas || !this.canvasLayer || !this.tmodel.hasDom()) {
            return false;
        }
        
        const tmodel = this.tmodel;
        const parent = tmodel.getParent();

        const domScrollLeft = parent?.$dom?.getScrollLeft() || tmodel.$dom.getScrollLeft() || 0;
        const domScrollTop = parent?.$dom?.getScrollTop() || tmodel.$dom.getScrollTop() || 0;
               
        const scrollLeft = tmodel.getScrollLeft();
        const scrollTop = tmodel.getScrollTop(); 
        
        const x = domScrollLeft - tmodel.x;
        const y = domScrollTop - tmodel.y;
        
        this.canvasX = scrollLeft + x;
        this.canvasY = scrollTop + y;

        const transform = `translate3d(${x}px, ${y}px, 0px)`;

        if (this.canvas.style.transform !== transform) {
            this.canvas.style.transform = transform;
            return true;
        }

        return false;
    }

    getParticlePosition(child, values = child?.actualValues) {
        const layoutScrollLeft = Number(this.tmodel.getScrollLeft()) || 0;
        const layoutScrollTop = Number(this.tmodel.getScrollTop()) || 0;

        return {
            x: child.allTargetMap.x ? values.x : child.x + layoutScrollLeft,
            y: child.allTargetMap.y ? values.y : child.y + layoutScrollTop
        };
    }

    updateUniforms() {
        const width = this.getRenderWidth();
        const height = this.getRenderHeight();

        this.device.queue.writeBuffer(
            this.uniformBuffer,
            0,
            new Float32Array([width, height, this.canvasX, this.canvasY, this.transitionStep, this.transitionActive ? 1 : 0, 0, 0])
        );
    }
    
    async waitForPresentedFrame() {
        if (this.device) {
            await this.device.queue.onSubmittedWorkDone();
        }

        await new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });
    }
    
    render() {
        if (!this.device || !this.context) {
            return;
        }

        this.resizeCanvas();
        this.repositionCanvas();
        
        const canDraw = this.pipeline && this.bindGroup && this.particleBuffer && this.targetParticleBuffer && this.particleCount > 0;

        if (canDraw) {
            this.updateUniforms();
        }

        const commandEncoder = this.device.createCommandEncoder();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        if (canDraw) {
            renderPass.setPipeline(this.pipeline);
            renderPass.setBindGroup(0, this.bindGroup);
            renderPass.setVertexBuffer(0, this.particleBuffer);
            renderPass.setVertexBuffer(1, this.targetParticleBuffer);
            renderPass.draw(6, this.particleCount);
        }

        renderPass.end();

        this.device.queue.submit([
            commandEncoder.finish()
        ]);
    }
    
    completeTransition() {
        if (!this.targetParticleBuffer || !this.transitionActive) {
            return;
        }

        const previousBuffer = this.particleBuffer;

        this.particleBuffer = this.targetParticleBuffer;
        this.targetParticleBuffer = previousBuffer;

        this.transitionStep = 0;
        this.transitionActive = false;

        this.render();
    }
    
    captureBitmap() {
        if (!this.canvas || !this.device) {
            return;
        }

        this.render();

        return createImageBitmap(this.canvas);
    }

    destroy() {
        for (const element of this.scrollElements ?? []) {
            element.removeEventListener("scroll", this.onScroll);
        }

        this.scrollElements = undefined;
        this.onScroll = undefined;
        
        this.particleBuffer?.destroy();
        this.targetParticleBuffer?.destroy();
        this.uniformBuffer?.destroy();

        this.context?.unconfigure();
        this.canvasLayer?.remove();
        
        this.particleBuffer = undefined;
        this.targetParticleBuffer = undefined;
        this.uniformBuffer = undefined;

        this.bindGroup = undefined;
        this.pipeline = undefined;

        this.context = undefined;
        this.device = undefined;
        this.canvasLayer = undefined;
        this.canvas = undefined;
        this.format = undefined;

        this.transitionStep = 0;
        this.transitionActive = false;
        this.particleCount = 0;

        this.initializationPromise = undefined;
    }
}

export { ParticleRenderer };