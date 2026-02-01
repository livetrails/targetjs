import { TUtil } from "./TUtil.js";
import { getManager } from "./App.js";

/**
 * It serves as a wrapper for all DOM operations.
 */
class $Dom {
    constructor(elemSelector) {
        if (typeof elemSelector === 'string') {
            this.selector = elemSelector;
            this.element = $Dom.query(elemSelector);
        } else if (elemSelector) {
            this.element = elemSelector;
        }

        this.hasRealChildren = false;
        this.slotModeEnabled = false;
        this.contentSlot = null;
        this.originalContent = undefined;
        this.textOnly = true;

        this.transformProp = null;
        this.initTransformProp();
    }

    create(tagName) {
        this.element = document.createElement(tagName);
        this.initTransformProp();
    }

    initTransformProp() {
        if (!this.element || !this.element.style) {
            this.transformProp = null;
            return;
        }

        const s = this.element.style;
        if ('transform' in s) {
            this.transformProp = 'transform';
        } else if ('webkitTransform' in s) {
            this.transformProp = 'webkitTransform';
        } else {
            this.transformProp = null;
        }
    }

    static createTemplate(html) {
        const $dom = new $Dom();
        $dom.create('template');
        $dom.innerHTML(html.trim());
        return $dom;
    }

    cloneTemplate() {
        return new $Dom(this.element.content?.cloneNode(true).children[0]);
    }

    clone() {
        return this.element.cloneNode(true);
    }

    exists() {
        return this.selector ? !!$Dom.query(this.selector) : false;
    }

    getElement() {
        return this.element;
    }

    supportsWAAPI() {
        return !!(this.element && typeof this.element.animate === 'function');
    }

    findContentSlot() {

        if (this.contentSlot && this.contentSlot.parentNode === this.element) {
            return this.contentSlot;
        }

        if (!this.element.firstElementChild) {
            return null;
        }

        const slot = this.element.querySelector(':scope > [data-tj-slot="content"]');
        if (slot) {
            this.contentSlot = slot;
        }
        return slot;
    }
    
    isNoSlotHost() {
        return this.element?.getAttribute('data-tj-no-slot') === 'true';
    }

    ensureContentSlotFirst() {
        let slot = this.findContentSlot();

        if (!slot) {
            slot = document.createElement('div');
            slot.setAttribute('data-tj-slot', 'content');
            this.element.insertBefore(slot, this.element.firstChild);
            this.contentSlot = slot;
        } else if (this.element.firstChild !== slot) {
            this.element.insertBefore(slot, this.element.firstChild);
        }

        return slot;
    }
    
    enableSlotMode() {
        if (this.slotModeEnabled) {
            return;
        }
        
        if (this.isNoSlotHost()) {
            this.slotModeEnabled = true;
            return;
        }        
        
        if (!this.element?.firstChild) {
            this.slotModeEnabled = true;
            return;
        }

        const slot = this.ensureContentSlotFirst();

        let n = slot.nextSibling;
        while (n) {
            const next = n.nextSibling;
            slot.appendChild(n);
            n = next;
        }

        this.slotModeEnabled = true;
    }    

    ensureSlotMode() {
        if (this.isNoSlotHost()) {
            this.slotModeEnabled = true;
            return;
        } 
        
        this.enableSlotMode();

        const slot = this.findContentSlot();
        if (slot && this.element.firstChild !== slot) {
            this.element.insertBefore(slot, this.element.firstChild);
        }
    }

    getComputedStyle(name) {
        if (!this.element) {
            return undefined;
        }
        
        const cs = window.getComputedStyle(this.element);
        return name ? cs.getPropertyValue(name) || cs[name] : cs;
    }

    contains(element) {
        return element instanceof Node && this.element.contains(element);
    }

    getTagName() {
        return this.element.tagName.toLowerCase();
    }

    setSelector(selector) {
        this.selector = selector;
    }

    setId(id) {
        this.attr('id', id[0] === '#' ? id.slice(1) : id);
    }

    getId() {
        return this.attr('id');
    }

    focus() {
        this.element.focus();
    }

    blur() {
        this.element.blur();
    }

    attr(name, value) {
        if (!this.element) {
            return;
        }

        if (TUtil.isDefined(value)) {
            this.element.setAttribute(name, value);
        } else {
            return this.element.getAttribute(name);
        }
    }

    value(value) {
        if (!this.element) {
            return;
        }

        const currentValue = this.element.value;
        if (TUtil.isDefined(value)) {
            this.element.value = value;
        }
        return currentValue;
    }

    select() {
        if (this.element && typeof this.element.select === 'function') {
            this.element.select();
        }
    }

    width(width) {
        if (TUtil.isDefined(width)) {
            this.element.style.width = TUtil.isNumber(width) ? `${width}px` : width;
        } else {
            return this.element.offsetWidth;
        }
    }

    height(height) {
        if (TUtil.isDefined(height)) {
            this.element.style.height = TUtil.isNumber(height) ? `${height}px` : height;
        } else {
            return this.element.offsetHeight;
        }
    }

    css(css) {
        if (TUtil.isDefined(css)) {
            this.element.className = css;
        } else {
            return this.element.className;
        }
    }

    setStyleByMap(attrMap) {
        Object.keys(attrMap).forEach(key => {
            this.style(key, attrMap[key]);
        });
    }

    style(name, value) {
        if (arguments.length === 2) {
            this.element.style[name] = value;
        } else if (arguments.length === 1) {
            return this.element.style[name];
        } else {
            return this.element.style;
        }
    }

    getStyleValue(name) {
        const styleValue = this.style(name);
        const numericValue = TUtil.isDefined(styleValue) ? styleValue.replace(/[^-\d.]/g, '') : 0;
        return parseFloat(numericValue);
    }

    getBoundingClientRect() {
        return this.element.getBoundingClientRect();
    }

    isXYWithinElement(x, y) {
        const rect = this.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    parent() {
        return this.element ? this.element.parentElement : null;
    }

    detach() {
        $Dom.detach(this.element);
    }

    child(index) {
        return this.element.children[index];
    }

    elementCount() {
        return this.element.children.length;
    }

    swapElements(element1, element2) {
        const nextSibling = element2.nextSibling;
        if (nextSibling === element1) {
            this.element.insertBefore(element1, element2);
        } else {
            this.element.insertBefore(element2, element1);
            this.element.insertBefore(element1, nextSibling);
        }
    }

    insertAfterContentSlot(node) {
        if (!this.element) {
            return;
        }

        if (this.isNoSlotHost()) {
            this.element.appendChild(node);
            return;
        }        

        const slot = this.ensureContentSlotFirst();
        const after = slot ? slot.nextSibling : this.element.firstChild;

        if (after) {
            this.element.insertBefore(node, after);
        } else {
            this.element.appendChild(node);
        }
    }

    insertFirst$Dom($dom) {
        this.ensureSlotMode();
        this.insertAfterContentSlot($dom.element);
        this.hasRealChildren = true;
    }

    relocate(tmodel, orderIndex) {
        this.ensureSlotMode();

        const slot = this.findContentSlot();
        const offset = slot ? 1 : 0;
        const idx = orderIndex + offset;

        this.element.insertBefore(tmodel.$dom.element, this.element.children[idx] || null);
    }

    appendTModel$Dom(tmodel) {
        this.ensureSlotMode();
        this.element.appendChild(tmodel.$dom.element);
        this.hasRealChildren = true;
    }

    append$Dom($dom) {
        this.ensureSlotMode();
        this.element.appendChild($dom.element);
        this.hasRealChildren = true;
    }

    appendElement(element) {
        this.ensureSlotMode();
        this.element.appendChild(element);
        this.hasRealChildren = true;
    }

    removeElement(element) {
        if (!element) {
            return;
        }
        const parent = element.parentNode;

        if (parent === this.element) {
            this.element.removeChild(element);
            return true;
        }
        
        if (parent) {
            parent.removeChild(element);
            return false;
        }        
    }

    html(html) {
        if (TUtil.isDefined(html)) {            
            if (this.isNoSlotHost() || !this.hasRealChildren) {
                this.element.innerHTML = html;
            } else {
                const slot = this.ensureContentSlotFirst();
                slot.innerHTML = html;
            }

            this.originalContent = html;
            this.textOnly = false;
        }
    }

    text(text) {
        if (TUtil.isDefined(text)) {
            if (this.isNoSlotHost() || !this.hasRealChildren) {
                this.element.textContent = text;
            } else {
                const slot = this.ensureContentSlotFirst();
                slot.textContent = text;
            }

            this.originalContent = text;
            this.textOnly = true;
        }
    }

    clearContent() {
        if (!this.element) {
            return;
        }

        if (this.isNoSlotHost() || !this.hasRealChildren) {
            this.element.innerHTML = this.originalContent || '';
            return;
        }

        const slot = this.ensureContentSlotFirst();
        slot.innerHTML = this.originalContent || '';
    }

    deleteAll() {
        if (!this.element) {
            return;
        }

        this.element.innerHTML = this.originalContent || '';
        this.hasRealChildren = false;
        this.contentSlot = null;
        this.slotModeEnabled = false;
    }

    outerHTML(html) {
        this.element.outerHTML = html;
    }

    isEmpty() {
        return this.element.innerHTML === '';
    }

    innerHTML(html) {
        if (TUtil.isDefined(html)) {
            this.element.innerHTML = html;
        } else {
            return this.element.innerHTML;
        }
    }

    innerText(text) {
        if (TUtil.isDefined(text)) {
            this.element.innerText = text;
        } else {
            return this.element.innerText;
        }
    }

    addClass(className) {
        const oldValue = this.attr('class');
        const newValue = !oldValue ? className : oldValue.includes(className) ? oldValue : `${oldValue} ${className}`;

        if (newValue !== oldValue) {
            this.attr('class', newValue);
        }
    }

    addEvent(type, fn, capture, passive) {
        if (!this.element.addEventListener) {
            this.element.attachEvent(`on${type}`, fn);
        } else {
            this.element.addEventListener(type, fn, { capture: !!capture, passive: !!passive });
        }
    }

    detachEvent(type, fn) {
        if (this.element.removeEventListener) {
            this.element.removeEventListener(type, fn, false);
        } else if (this.element.detachEvent) {
            this.element.detachEvent(`on${type}`, fn);
        } else {
            this.element[`on${type}`] = null;
        }
    }

    transform(transformString) {
        this.element.style[this.transformProp] = transformString;
    }

    animate(keyFrames, options) {
        return this.element.animate(keyFrames, options);
    }

    getContext(type, selector) {
        const element = TUtil.isDefined(selector) ? $Dom.query(selector) : this.query('canvas');
        return element ? element.getContext(type) : undefined;
    }

    query(query) {
        return this.element.querySelector(query);
    }

    queryAll(query) {
        return this.element.querySelectorAll(query);
    }

    findFirstByClass(className) {
        return $Dom.findFirstByClass(className, this.element);
    }

    findFirstByTag(tagName) {
        return $Dom.findFirstByTag(tagName, this.element);
    }

    getScrollTop() {
        return this.element?.scrollTop ?? 0;
    }

    getScrollLeft() {
        return this.element?.scrollLeft ?? 0;
    }

    static createDocumentFragment() {
        return document.createDocumentFragment();
    }

    static query(selector) {
        return selector[0] === '#'
            ? $Dom.findById(selector)
            : selector[0] === '.'
            ? $Dom.findFirstByClass(selector)
            : $Dom.findFirstByTag(selector);
    }

    static querySelector(selector) {
        return document.querySelector(selector);
    }

    static findById(id) {
        return document.getElementById(id[0] === '#' ? id.slice(1) : id);
    }

    static findFirstByClass(className, element) {
        const elements = $Dom.findByClass(className, element);
        return elements.length > 0 ? elements[0] : null;
    }

    static findFirstByTag(tagName, element) {
        const elements = $Dom.findByTag(tagName, element);
        return elements.length > 0 ? elements[0] : null;
    }

    static findByTag(tagName, element = document) {
        return element.getElementsByTagName(tagName);
    }

    static findByClass(className, element = document) {
        return element.getElementsByClassName(className[0] === '.' ? className.slice(1) : className);
    }

    static findNearestParentWithId(element) {
        while (element) {
            const oid = typeof element.getAttribute === 'function' && element.getAttribute("id") ? element.getAttribute("id") : null;
            if (oid && getManager().visibleOidMap[oid]) {
                return oid;
            }

            element = element.parentElement;
        }
    }

    static detach(element) {
        const parent = TUtil.isDefined(element) ? element.parentElement : null;
        if (parent) {
            parent.removeChild(element);
        }
    }

    static hasFocus(tmodel) {
        return tmodel.hasDom() && document.activeElement === tmodel.$dom.element;
    }

    static getWindowScrollTop() {
        return window.pageYOffset || document.documentElement.scrollTop || 0;
    }

    static getWindowScrollLeft() {
        return window.pageXOffset || document.documentElement.scrollLeft || 0;
    }

    static getScreenWidth() {
        return document.documentElement.clientWidth || document.body.clientWidth;
    }

    static getScreenHeight() {
        return document.documentElement.clientHeight || document.body.clientHeight;
    }

    static ready(callback) {
        const $doc = new $Dom(document);
        $doc.addEvent('DOMContentLoaded', callback);
    }

    static ajax(query) {
        const xhr = new XMLHttpRequest();

        let params = '';
        if (query.data) {
            params = Object.keys(query.data).map((key) => `${key}=${encodeURIComponent(query.data[key])}`).join('&');
        }

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    const response = query.dataType === 'json' ? JSON.parse(this.responseText) : this.responseText;
                    query.success(response);
                } else {
                    query.error(xhr.status);
                }
            }
        };

        if (query.type === 'POST') {
            xhr.open(query.type, query.url, true);
            xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
            xhr.send(params);
        } else {
            query.url += !params ? '' : query.url > '' && query.url.indexOf('?') >= 0 ? `&${params}` : `?${params}`;
            xhr.open(query.type, query.url, true);
            xhr.send();
        }
    }
}

export { $Dom };
