
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
        
        this.explodeFragmentBuffer = undefined;
        this.explodeTexture = undefined;
        this.explodeSampler = undefined;
        this.explodeSourceCanvas = undefined;
        this.explodeTextureReady = false;

        this.transitionStep = 0;
        this.transitionActive = false;
        this.particleCount = 0;
        
        this.canvasLayer = undefined;
        
        // Canvas origin and viewport are in the owning TModel's local content space.
        this.canvasX = 0;
        this.canvasY = 0;
        this.canvasBounds = undefined;
        this.canvasSize = undefined;
        this.boundsDirty = true;
        this.currentParticleData = undefined;
        this.targetParticleData = undefined;

        this.initializationPromise = undefined;
    }

    async init() {
        if (this.device) {
            this.mountCanvasLayer();
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
            alphaMode: "premultiplied",
            usage:
                globalThis.GPUTextureUsage.RENDER_ATTACHMENT |
                globalThis.GPUTextureUsage.COPY_SRC
        });

        this.createUniformBuffer();
        this.createExplodeResources();
        this.createPipeline();
    }

    createCanvas() {
        if (this.canvas) {
            this.mountCanvasLayer();
            return;
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

        this.canvas.captureBitmap = () => this.captureBitmap();

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

        if (!this.mountCanvasLayer()) {
            throw new Error("Unable to mount GPU child layer.");
        }

        this.onScroll = () => this.tmodel.requestParticleRender();

        this.updateScrollElements();
    }

    createUniformBuffer() {
        this.uniformBuffer = this.device.createBuffer({
            size: 32,
            usage: globalThis.GPUBufferUsage.UNIFORM | globalThis.GPUBufferUsage.COPY_DST
        });
    }
    
    createExplodeResources() {
        this.explodeSampler = this.device.createSampler({
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            magFilter: "linear",
            minFilter: "linear"
        });

        this.explodeTexture = this.device.createTexture({
            size: { width: 1, height: 1 },
            format: "rgba8unorm",
            usage: globalThis.GPUTextureUsage.TEXTURE_BINDING | globalThis.GPUTextureUsage.COPY_DST
        });

        this.device.queue.writeTexture({ texture: this.explodeTexture },
            new Uint8Array([0, 0, 0, 0]), { bytesPerRow: 4 },
            { width: 1, height: 1 });

        this.explodeTextureReady = false;
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
            
                @group(0) @binding(1)
                var explodeSampler: sampler;

                @group(0) @binding(2)
                var explodeTexture: texture_2d<f32>;

                struct VertexOutput {
                    @builtin(position) position: vec4f,
                    @location(0) localPosition: vec2f,
                    @location(1) backgroundColor: vec4f,
                    @location(2) size: vec2f,
                    @location(3) borderRadius: f32,
                    @location(4) sourceUv: vec2f,
                    @location(5) useImage: f32,
                    @location(6) opacity: f32,
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
                    @location(10) targetColorOpacitySteps: vec2f,
                    @location(11) targetGeometrySteps: vec2f,
                    @location(12) childScaleOpacity: vec2f,
                    @location(13) targetScaleOpacity: vec2f,
                    @location(14) targetScaleSteps: f32,
                    @location(15) explodeData: vec4f,
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
                    let backgroundColorProgress = getProgress(uniforms.step, targetColorOpacitySteps.x);
                    let opacityProgress = getProgress(uniforms.step, targetColorOpacitySteps.y);
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
                    let scale = mix(childScaleOpacity.x, targetScaleOpacity.x, scaleProgress);
                    let opacity = mix(childScaleOpacity.y, targetScaleOpacity.y, opacityProgress);

                    let localPosition = corners[vertexIndex];
            
                    let useImage = explodeData.w >= 0.0;
                    let sourceV1 = select(-explodeData.w - 1.0, explodeData.w, useImage);
                    let localUv = localPosition * 0.5 + vec2f(0.5);
                    let sourceUv = mix(explodeData.xy, vec2f(explodeData.z, sourceV1), localUv);
            
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
                    output.opacity = opacity;
            
                    output.sourceUv = sourceUv;
                    output.useImage = select(0.0, 1.0, useImage);

                    return output;
                }

                @fragment
                fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
                    var color = input.backgroundColor;

                    if (input.useImage > 0.5) {
                        color = textureSampleLevel(explodeTexture, explodeSampler, input.sourceUv, 0.0);
                    }

                    let halfSize = max(input.size * 0.5, vec2f(0.0001));
                    let radius = clamp(input.borderRadius, 0.0, min(halfSize.x, halfSize.y));
                    let pixelPosition = input.localPosition * halfSize;
                    let q = abs(pixelPosition) - (halfSize - vec2f(radius));
                    let distance = length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - radius;
                    let aa = max(fwidth(distance), 0.0001);
                    let roundedCoverage = 1.0 - smoothstep(-aa, aa, distance);
                    let coverage = select(1.0, roundedCoverage, radius > 0.0);

                    if (coverage <= 0.0) {
                        discard;
                    }

                    let alpha = color.a * input.opacity * coverage;

                    return vec4f(color.rgb * alpha, alpha);
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
                        arrayStride: 84,
                        stepMode: "instance",

                        attributes: [
                            { shaderLocation: 0, offset: 0, format: "float32x2" },
                            { shaderLocation: 1, offset: 8, format: "float32x2" },
                            { shaderLocation: 2, offset: 16, format: "float32x4" },
                            { shaderLocation: 3, offset: 32, format: "float32x2" },
                            { shaderLocation: 12, offset: 72, format: "float32x2" }
                        ]
                    },
                    {
                        arrayStride: 84,
                        stepMode: "instance",

                        attributes: [
                            { shaderLocation: 4, offset: 0, format: "float32x2" },
                            { shaderLocation: 5, offset: 8, format: "float32x2" },
                            { shaderLocation: 6, offset: 16, format: "float32x4" },
                            { shaderLocation: 7, offset: 32, format: "float32x2" },
                            { shaderLocation: 8, offset: 40, format: "float32x2" },
                            { shaderLocation: 9, offset: 48, format: "float32x2" },
                            { shaderLocation: 10, offset: 56, format: "float32x2" },
                            { shaderLocation: 11, offset: 64, format: "float32x2" },
                            { shaderLocation: 13, offset: 72, format: "float32x2" },
                            { shaderLocation: 14, offset: 80, format: "float32" }
                        ]
                    },
                    {
                        arrayStride: 16,
                        stepMode: "instance",

                        attributes: [
                            { shaderLocation: 15, offset: 0, format: "float32x4" }
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

        this.createBindGroup();
    }
    
    createBindGroup() {
        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),

            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniformBuffer
                    }
                },
                {
                    binding: 1,
                    resource: this.explodeSampler
                },
                {
                    binding: 2,
                    resource: this.explodeTexture.createView()
                }
            ]
        });
    }
    
    createExplodeSourceCanvas(source) {
        const width = source?.width;
        const height = source?.height;

        if (!width || !height) {
            return;
        }

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("Could not create a 2D context for the explode source copy.");
        }

        context.drawImage(source, 0, 0, width, height);

        return canvas;
    }
    
    async setExplodeSource(capture) {
        const source = capture?.bitmap ?? capture?.canvas;

        if (!source) {
            return false;
        }

        const sourceCanvas = capture?.canvas ?? this.createExplodeSourceCanvas(source);

        if (!sourceCanvas) {
            return false;
        }

        const initialized = await this.init();

        if (!initialized) {
            return false;
        }

        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const texture = this.device.createTexture({
            size: { width, height },
            format: "rgba8unorm",
            usage: globalThis.GPUTextureUsage.TEXTURE_BINDING |
                globalThis.GPUTextureUsage.COPY_DST |
                globalThis.GPUTextureUsage.RENDER_ATTACHMENT
        });

        this.device.queue.copyExternalImageToTexture(
            { source: sourceCanvas },
            { texture },
            { width, height }
        );

        this.explodeTexture?.destroy();

        this.explodeSourceCanvas = sourceCanvas;
        this.explodeTexture = texture;
        this.explodeTextureReady = true;

        this.updateExplodeFragmentBuffer(this.tmodel.childHandles);

        this.createBindGroup();

        this.render();

        return true;
    }
    
    captureExplodeSourceBitmap() {
        if (!this.explodeSourceCanvas) {
            return;
        }

        return createImageBitmap(this.explodeSourceCanvas);
    }

    createExplodeFragmentData(children) {
        const data = new Float32Array(children.length * 4);
        const state = this.tmodel.explodeChildrenState;
        const sourceWidth = state?.width || 1;
        const sourceHeight = state?.height || 1;

        for (let index = 0; index < children.length; index++) {
            const child = children[index];
            const childIndex = Number.isInteger(child?.index) ? child.index : index;
            const fragment = this.tmodel.getExplodeFragment(childIndex);
            const offset = index * 4;

            if (!fragment) {
                data[offset] = 0;
                data[offset + 1] = 0;
                data[offset + 2] = 0;
                data[offset + 3] = -1;

                continue;
            }

            const u0 = fragment.x / sourceWidth;
            const v0 = fragment.y / sourceHeight;
            const u1 = (fragment.x + fragment.width) / sourceWidth;
            const v1 = (fragment.y + fragment.height) / sourceHeight;
            const hasBackground = TUtil.isDefined(child.actualValues.backgroundColor);

            const useImage = this.explodeTextureReady && !hasBackground;
            data[offset] = u0;
            data[offset + 1] = v0;
            data[offset + 2] = u1;

            // A negative fourth value means image:false.
            data[offset + 3] = useImage ? v1 : -(v1 + 1);
        }

        return data;
    }
    
    updateExplodeFragmentBuffer(children) {
        const data = this.createExplodeFragmentData(children);

        this.explodeFragmentBuffer = this.uploadParticleBuffer(this.explodeFragmentBuffer, data);
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
        particleData[offset + 7] = backgroundColor[3];

        particleData[offset + 8] = Math.max(0, this.toNumber(values.borderRadius, 0));
        particleData[offset + 9] = this.toNumber(values.rotate, 0);

        particleData[offset + 10] = this.getTargetStep(steps, "x");
        particleData[offset + 11] = this.getTargetStep(steps, "y");
        particleData[offset + 12] = this.getTargetStep(steps, "width");
        particleData[offset + 13] = this.getTargetStep(steps, "height");
        particleData[offset + 14] = this.getTargetStep(steps, "backgroundColor");
        particleData[offset + 15] = this.getTargetStep(steps, "opacity");
        particleData[offset + 16] = this.getTargetStep(steps, "borderRadius");
        particleData[offset + 17] = this.getTargetStep(steps, "rotate");

        particleData[offset + 18] = this.toNumber(values.scale, 1);
        particleData[offset + 19] = opacity;
        particleData[offset + 20] = this.getTargetStep(steps, "scale");
    }

    createChildData(children) {
        const particleData = new Float32Array(children.length * 21);

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const values = child.actualValues;
            const { x, y } = this.getParticlePosition(child, values);

            this.writeParticleData(particleData, i * 21, values, undefined, x, y);
        }

        return particleData;
    }

    createParticleData(values, targetSteps) {
        const particleData = new Float32Array(values.length * 21);

        for (let i = 0; i < values.length; i++) {
            const child = this.tmodel.childHandles[i];
            const { x, y } = this.getParticlePosition(child, values[i]);

            this.writeParticleData(particleData, i * 21, values[i], targetSteps?.[i], x, y);
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
        
        this.updateExplodeFragmentBuffer(children);
        
        this.particleCount = children.length;
        this.currentParticleData = particleData;
        this.targetParticleData = particleData;
        this.particleBuffer = this.uploadParticleBuffer(this.particleBuffer, particleData);
        this.targetParticleBuffer = this.uploadParticleBuffer(this.targetParticleBuffer, particleData);

        this.transitionStep = 0;
        this.transitionActive = false;
        this.boundsDirty = true;

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
        
        this.updateExplodeFragmentBuffer(children);
        
        this.particleCount = children.length;
        this.currentParticleData = particleData;
        this.particleBuffer = this.uploadParticleBuffer(this.particleBuffer, particleData);

        if (!children.length || !this.transitionActive) {
            this.targetParticleData = particleData;
            this.targetParticleBuffer = this.uploadParticleBuffer(this.targetParticleBuffer, particleData);
        }

        if (!children.length) {
            this.transitionStep = 0;
            this.transitionActive = false;
        }
        
        this.boundsDirty = true;
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
            this.currentParticleData = currentParticleData;
            this.particleBuffer = this.uploadParticleBuffer(this.particleBuffer, currentParticleData);
        }

        const particleData = this.createParticleData(values, steps);

        this.targetParticleData = particleData;
        this.targetParticleBuffer = this.uploadParticleBuffer(this.targetParticleBuffer, particleData);

        this.transitionStep = 0;
        this.transitionActive = true;
        this.boundsDirty = true;

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
        return Math.max(1, Number(this.tmodel.getWidth()) || 1);
    }

    getRenderHeight() {
        return Math.max(1, Number(this.tmodel.getHeight()) || 1);
    }

    getParticleBounds() {
        const modelWidth = this.getRenderWidth();
        const modelHeight = this.getRenderHeight();
        const viewport = this.tmodel.managesOwnScroll();
        const bounds = this.canvasBounds;

        if (!this.boundsDirty && bounds?.modelWidth === modelWidth && bounds?.modelHeight === modelHeight && bounds?.viewport === viewport) {
            return bounds;
        }

        const calculated = viewport ? { x: 0, y: 0, width: modelWidth, height: modelHeight } : this.calculateParticleBounds();

        this.canvasBounds = { ...calculated, modelWidth, modelHeight, viewport };
        this.boundsDirty = false;

        return this.canvasBounds;
    }
    
    calculateParticleBounds() {
        let left = 0;
        let top = 0;
        let right = this.getRenderWidth();
        let bottom = this.getRenderHeight();
        const current = this.currentParticleData;
        const target = this.targetParticleData ?? current;
        const stride = 21;
        const count = Math.min(this.particleCount, (current?.length ?? 0) / stride);
        const safety = 2;

        for (let i = 0; i < count; i++) {
            const j = i * stride;
            const a = current;
            const b = target && target.length >= j + stride ? target : current;

            const minX = Math.min(a[j], b[j]);
            const maxX = Math.max(a[j], b[j]);
            const minY = Math.min(a[j + 1], b[j + 1]);
            const maxY = Math.max(a[j + 1], b[j + 1]);
            const minWidth = Math.min(a[j + 2], b[j + 2]);
            const maxWidth = Math.max(a[j + 2], b[j + 2]);
            const minHeight = Math.min(a[j + 3], b[j + 3]);
            const maxHeight = Math.max(a[j + 3], b[j + 3]);
            const maxScale = Math.max(Math.abs(a[j + 18]), Math.abs(b[j + 18]));
            const radius = Math.hypot(
                Math.max(Math.abs(a[j + 2]), Math.abs(b[j + 2])),
                Math.max(Math.abs(a[j + 3]), Math.abs(b[j + 3]))
            ) * maxScale * 0.5 + safety;

            left = Math.min(left, minX + minWidth / 2 - radius);
            right = Math.max(right, maxX + maxWidth / 2 + radius);
            top = Math.min(top, minY + minHeight / 2 - radius);
            bottom = Math.max(bottom, maxY + maxHeight / 2 + radius);
        }

        const x = Math.floor(left);
        const y = Math.floor(top);

        return {
            x,
            y,
            width: Math.max(1, Math.ceil(right) - x),
            height: Math.max(1, Math.ceil(bottom) - y)
        };
    }

    updateCanvasLayerWidthHeight() {
        if (!this.canvasLayer) {
            return;
        }

        const viewport = this.getParticleBounds().viewport;
        const modelWidth = this.getRenderWidth();
        const modelHeight = this.getRenderHeight();

        const width = viewport ? Math.max(modelWidth, Number(this.tmodel.getContentWidth()) || 0) : modelWidth;
        const height = viewport ? Math.max(modelHeight, Number(this.tmodel.getContentHeight()) || 0) : modelHeight;

        if (this.canvasLayer.style.width !== `${width}px`) {
            this.canvasLayer.style.width = `${width}px`;
        }

        if (this.canvasLayer.style.height !== `${height}px`) {
            this.canvasLayer.style.height = `${height}px`;
        }
    }

    resizeCanvas() {
        if (!this.canvas || !this.device) {
            return false;
        }

        const bounds = this.getParticleBounds();
        const { width, height, modelWidth, modelHeight } = bounds;
        const devicePixelRatio = window.devicePixelRatio || 1;
        const maxDimension = this.device.limits?.maxTextureDimension2D || 8192;

        const pixelRatio = Math.min(devicePixelRatio, maxDimension / width, maxDimension / height);

        const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
        const pixelHeight = Math.max(1, Math.round(height * pixelRatio));

        const previous = this.canvasSize;

        if (previous && previous.width === width && previous.height === height &&
            previous.pixelWidth === pixelWidth && previous.pixelHeight === pixelHeight &&
            previous.modelWidth === modelWidth && previous.modelHeight === modelHeight) {
            return false;
        }

        if (!previous || previous.width !== width) {
            this.canvas.style.width = `${width}px`;
        }

        if (!previous || previous.height !== height) {
            this.canvas.style.height = `${height}px`;
        }

        if (this.canvas.width !== pixelWidth) {
            this.canvas.width = pixelWidth;
        }

        if (this.canvas.height !== pixelHeight) {
            this.canvas.height = pixelHeight;
        }

        if (!previous || previous.modelWidth !== modelWidth || previous.modelHeight !== modelHeight) {
            this.updateCanvasLayerWidthHeight();
        }

        this.canvasSize = {
            width,
            height,
            pixelWidth,
            pixelHeight,
            modelWidth,
            modelHeight
        };

        return true;
    }

    repositionCanvas() {
        if (!this.canvas || !this.canvasLayer || !this.tmodel.hasDom()) {
            return false;
        }

        const bounds = this.getParticleBounds();
        const scrollLeft = Number(this.tmodel.$dom?.getScrollLeft() ?? this.tmodel.getScrollLeft() ?? 0) || 0;
        const scrollTop = Number(this.tmodel.$dom?.getScrollTop() ?? this.tmodel.getScrollTop() ?? 0) || 0;

        // Canvas origin in the scroller's content coordinates.
        const contentX = bounds.x + (this.tmodel.managesOwnScroll() ? scrollLeft : 0);
        const contentY = bounds.y + (this.tmodel.managesOwnScroll() ? scrollTop : 0);

        // Internally mounted canvases scroll with their DOM parent.
        // External canvases do not, so their CSS position remains fixed.
        const x = this.tmodel.managesOwnScroll() && !this.externalCanvasHost ? contentX : bounds.x;

        const y = this.tmodel.managesOwnScroll() && !this.externalCanvasHost ? contentY : bounds.y;

        const nextX = this.tmodel.managesOwnScroll() ? contentX : bounds.x + (this.externalCanvasHost ? scrollLeft : 0);

        const nextY = this.tmodel.managesOwnScroll() ? contentY : bounds.y + (this.externalCanvasHost ? scrollTop : 0);

        let changed = nextX !== this.canvasX || nextY !== this.canvasY;

        this.canvasX = nextX;
        this.canvasY = nextY;

        const left = `${x}px`;
        const top = `${y}px`;

        if (this.canvas.style.left !== left) {
            this.canvas.style.left = left;
            changed = true;
        }

        if (this.canvas.style.top !== top) {
            this.canvas.style.top = top;
            changed = true;
        }

        if (this.canvas.style.transform !== "none") {
            this.canvas.style.transform = "none";
            changed = true;
        }

        return changed;
    }
    
    getParticlePosition(child, values = child?.actualValues) {
        return {
            x: child.allTargetMap.x ? values.x : child.x,
            y: child.allTargetMap.y ? values.y : child.y
        };
    }

    updateUniforms() {
        const bounds = this.canvasBounds ?? this.getParticleBounds();

        this.device.queue.writeBuffer(
            this.uniformBuffer,
            0,
            new Float32Array([
                bounds.width, bounds.height, this.canvasX, this.canvasY,
                this.transitionStep, this.transitionActive ? 1 : 0, 0, 0
            ])
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

        if (!this.mountCanvasLayer()) {
            return;
        }

        this.resizeCanvas();
        this.repositionCanvas();

        const commandEncoder = this.device.createCommandEncoder();

        this.encodeRenderPass(commandEncoder, this.context.getCurrentTexture().createView());

        this.device.queue.submit([commandEncoder.finish()]);
    }

    completeTransition() {
        if (!this.targetParticleBuffer || !this.transitionActive) {
            return;
        }

        const previousBuffer = this.particleBuffer;

        this.particleBuffer = this.targetParticleBuffer;
        this.targetParticleBuffer = previousBuffer;
        this.currentParticleData = this.targetParticleData;

        this.transitionStep = 0;
        this.transitionActive = false;
        this.boundsDirty = true;
        this.render();
    }
    
    async captureBitmap() {
        if (!this.canvas || !this.device || !this.context) {
            return;
        }
        
        this.resizeCanvas();
        this.repositionCanvas();

        const width = this.canvas.width;
        const height = this.canvas.height;
        const bytesPerRow = Math.ceil(width * 4 / 256) * 256;

        const buffer = this.device.createBuffer({
            size: bytesPerRow * height,
            usage:
                globalThis.GPUBufferUsage.COPY_DST |
                globalThis.GPUBufferUsage.MAP_READ
        });

        const texture = this.context.getCurrentTexture();
        const commandEncoder = this.device.createCommandEncoder();

        this.encodeRenderPass(commandEncoder, texture.createView());

        commandEncoder.copyTextureToBuffer(
            { texture },
            { buffer, bytesPerRow },
            { width, height }
        );

        this.device.queue.submit([commandEncoder.finish()]);

        await buffer.mapAsync(globalThis.GPUMapMode.READ);

        const mapped = new Uint8Array(buffer.getMappedRange());
        const pixels = new Uint8ClampedArray(width * height * 4);
        const rowSize = width * 4;

        for (let y = 0; y < height; y++) {
            pixels.set(mapped.subarray(y * bytesPerRow, y * bytesPerRow + rowSize), y * rowSize);
        }

        buffer.unmap();
        buffer.destroy();

        if (this.format.startsWith("bgra")) {
            for (let i = 0; i < pixels.length; i += 4) {
                const red = pixels[i];

                pixels[i] = pixels[i + 2];
                pixels[i + 2] = red;
            }
        }

        for (let i = 0; i < pixels.length; i += 4) {
            const alpha = pixels[i + 3];

            if (alpha > 0 && alpha < 255) {
                const scale = 255 / alpha;

                pixels[i] = Math.min(255, Math.round(pixels[i] * scale));
                pixels[i + 1] = Math.min(255, Math.round(pixels[i + 1] * scale));
                pixels[i + 2] = Math.min(255, Math.round(pixels[i + 2] * scale));
            }
        }

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        context.putImageData(new ImageData(pixels, width, height), 0, 0);

        return createImageBitmap(canvas);
    }    

    updateScrollElements() {
        const nextElements = [
            ...new Set([
                this.tmodel.$dom?.element,
                this.tmodel.getParent()?.$dom?.element
            ].filter(Boolean))
        ];

        for (const element of this.scrollElements ?? []) {
            if (!nextElements.includes(element)) {
                element.removeEventListener("scroll", this.onScroll);
            }
        }

        for (const element of nextElements) {
            if (!(this.scrollElements ?? []).includes(element)) {
                element.addEventListener("scroll", this.onScroll, { passive: true });
            }
        }

        this.scrollElements = nextElements;
    }
    
    canHostCanvasLayer(element) {
        return !new Set([
            "IMG", "INPUT", "CANVAS", "VIDEO",
            "IFRAME", "OBJECT", "EMBED"
        ]).has(element.tagName);
    }


    getCanvasMount() {
        const source = this.tmodel.$dom?.element;

        if (!source) {
            return;
        }

        const external = !!this.tmodel.explodeChildrenState || !this.canHostCanvasLayer(source);

        return {
            source,
            host: external ? source.parentElement : source,
            external
        };
    }

    mountCanvasLayer() {
        if (!this.canvasLayer) {
            return false;
        }

        const mount = this.getCanvasMount();

        if (!mount?.host) {
            return false;
        }

        const { source, host, external } = mount;

        if (this.canvasLayer.parentElement !== host) {
            if (external) {
                source.after(this.canvasLayer);
            } else {
                host.prepend(this.canvasLayer);
            }
        }

        this.canvasHost = host;
        this.externalCanvasHost = external;

        if (external) {
            this.canvasLayer.style.left = source.style.left || "0px";
            this.canvasLayer.style.top = source.style.top || "0px";
            this.canvasLayer.style.transform = source.style.transform || "none";
            this.canvasLayer.style.transformOrigin = source.style.transformOrigin || "50% 50%";
            this.canvasLayer.style.zIndex = this.tmodel.explodeChildrenState ? String((Number(source.style.zIndex) || 0) + 1) : source.style.zIndex || "0";
        } else {
            this.canvasLayer.style.left = "0px";
            this.canvasLayer.style.top = "0px";
            this.canvasLayer.style.transform = "none";
            this.canvasLayer.style.zIndex = "0";
        }

        this.updateScrollElements();

        return true;
    }
    
    encodeRenderPass(commandEncoder, view) {
        const canDraw = this.pipeline && this.bindGroup && this.particleBuffer && this.targetParticleBuffer &&
            this.explodeFragmentBuffer && this.particleCount > 0;

        if (canDraw) {
            this.updateUniforms();
        }

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view,
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
            renderPass.setVertexBuffer(2, this.explodeFragmentBuffer);

            const explodeState = this.tmodel.explodeChildrenState;
            const firstInstance = this.explodeTextureReady && explodeState ? explodeState.firstExplodeChild ?? 0 : 0;
            const instanceCount = this.particleCount - firstInstance;

            if (instanceCount > 0) {
                renderPass.draw(6, instanceCount, 0, firstInstance);
            }
        }

        renderPass.end();
    }

    destroy() {
        for (const element of this.scrollElements ?? []) {
            element.removeEventListener("scroll", this.onScroll);
        }

        this.canvasSize = undefined;
        this.canvasBounds = undefined;
        this.boundsDirty = true;
        
        this.scrollElements = undefined;
        this.onScroll = undefined;
        
        this.particleBuffer?.destroy();
        this.targetParticleBuffer?.destroy();
        this.uniformBuffer?.destroy();
       
        this.context?.unconfigure();
        this.canvasLayer?.remove();
        
        this.explodeFragmentBuffer?.destroy();
        this.explodeTexture?.destroy();
        
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
        this.canvasBounds = undefined;
        this.currentParticleData = undefined;
        this.targetParticleData = undefined;
                
        this.explodeFragmentBuffer = undefined;
        this.explodeTexture = undefined;
        this.explodeSampler = undefined;
        this.explodeSourceCanvas = undefined;
        this.explodeTextureReady = false;

        this.initializationPromise = undefined;
    }
}

export { ParticleRenderer };
