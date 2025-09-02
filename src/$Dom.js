import { TUtil } from "./TUtil.js";
import { getManager, getBrowser } from "./App.js";

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

        this.childrenCount = 0;
        this.$domParent = undefined;
        this.originalContent = undefined;
        this.textOnly = true;
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
        if (this.selector) {
            this.element = $Dom.query(this.selector);
        }
        return this.element ? !!this.element.parentElement : false;
    }
    
    contains(element) {
        return element instanceof Node && this.element.contains(element);
    }

    create(tagName) {
        this.element = document.createElement(tagName);
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

        return (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
        );
    }

    parent() {
        return this.element ? this.element.parentElement : null;
    }

    detach() {
        $Dom.detach(this.element);
        if (this.$domParent && this.$domParent.childrenCount > 0) {
            this.$domParent.childrenCount--;
        }
    }
    
    child(index) {
        return this.element.children[index];
    }

    append$Dom($dom) {
        this.element.appendChild($dom.element);
    }
    
    appendElement(element) {
        this.element.appendChild(element);
    }
    
    removeElement(element) {
        this.element.removeChild(element);        
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

    insertFirst$Dom($dom) {
        if (this.element.firstChild) {
            this.element.insertBefore($dom.element, this.element.firstChild);
        } else {
            this.append$Dom($dom);
        }
    }
    
    relocate(tmodel, orderIndex) {
        this.element.insertBefore(tmodel.$dom.element, this.element.children[orderIndex])
    }

    appendTModel$Dom(tmodel) {
        if (this.childrenCount === 0 && this.element.children.length > 1 && tmodel.getDomParent() &&
            tmodel.getDomParent().getHtml() && tmodel.getDomParent().getHtml() === this.originalContent) {
            this.element.innerHTML = `<div>${this.html()}</div>`;
        }

        this.element.appendChild(tmodel.$dom.element);
        tmodel.$dom.$domParent = this;
        this.childrenCount++;
    }
    
    deleteAll() {
        this.element.innerHTML = this.originalContent || '';
        this.childrenCount = 0;
    }
   
    html(html) {
        if (TUtil.isDefined(html)) {
            if (this.childrenCount > 0) {
                const element = document.createElement('div');
                element.innerHTML = html;

                if (TUtil.isDefined(this.originalContent)) {
                    this.element.replaceChild(element, this.element.firstChild);
                } else {
                    this.element.insertBefore(element, this.element.firstChild);
                }

                this.originalContent = html;
                this.textOnly = false;

            } else {
                this.element.innerHTML = html;
                this.originalContent = html;
                this.textOnly = false;
            }
        } else {
            return TUtil.isDefined(this.originalContent) ? this.originalContent : this.element.innerHTML;
        }
    }

    text(text) {
        if (TUtil.isDefined(text)) {
            if (this.childrenCount > 0) {
                const element = document.createTextNode(text);
                if (TUtil.isDefined(this.originalContent)) {
                    this.element.replaceChild(element, this.element.firstChild);
                } else {
                    this.element.insertBefore(element, this.element.firstChild);
                }

                this.originalContent = text;
                this.textOnly = true;

            } else {
                this.element.textContent = text;
                this.originalContent = text;
                this.textOnly = true;
            }
        } else {
            return TUtil.isDefined(this.originalContent) ? this.originalContent : this.element.textContent;
        }
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
        this.element.style[getBrowser().style.transform] = transformString;
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

    static query(selector) {
        return selector[0] === '#' ? $Dom.findById(selector) : selector[0] === '.' ? $Dom.findFirstByClass(selector) : $Dom.findFirstByTag(selector);
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
        
        let params = "";
        if (query.data) {
            params = Object.keys(query.data).map(key => `${key}=${encodeURIComponent(query.data[key])}`).join('&');
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
            query.url += !params ? "" : query.url > "" && query.url.indexOf("?") >= 0 ? `&${params}` : `?${params}`;
            xhr.open(query.type, query.url, true);
            xhr.send();
        }
    }
}

export { $Dom };
