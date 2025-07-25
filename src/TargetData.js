import { getEvents, getResizeLastUpdate } from "./App.js";
import { TUtil } from "./TUtil.js";

class TargetData {
    
    static defaultActualValues() {
        return {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            leftMargin: 0,
            rightMargin: 0,
            topMargin: 0,
            bottomMargin: 0,
            opacity: 1,
            scale: 1,  
            scrollLeft: 0,
            scrollTop: 0,
            textOnly: true,
            borderRadius: 0,
            children: [],
            isInFlow: true,
            baseElement: 'div',
            canHaveDom: true,
            isIncluded: true,
            bracketThreshold: 10,
            bracketSize: 5,
            preventDefault: undefined,            
            canDeleteDom: undefined
        };
    }
    
    static transformOrder = {
        perspective: 0,
        translateX: 1,
        translateY: 1,
        translateZ: 1,
        translate: 1,
        translate3d: 1,        
        rotate: 2,
        rotateX: 2,
        rotateY: 2,
        rotateZ: 2,
        rotate3d: 2,
        skew: 3,
        skewX: 3,
        skewY: 3,        
        scale: 4,
        scaleX: 4,
        scaleY: 4,
        scaleZ: 4,
        scale3DX: 4,
        scale3DY: 4,
        scale3DZ: 4
    };      
    
    static defaultTargetStyles = {
        position: 'absolute', 
        left: 0, 
        top: 0,
        zIndex: 1
    };
    
    static transformMap = {
        x: true,
        y: true,
        z: true,
        translateX: true,
        translateY: true,
        translateZ: true,
        perspective: true,
        rotate: true,
        rotateX: true,
        rotateY: true,
        rotateZ: true,
        rotate3DX: true,
        rotate3DY: true,
        rotate3DZ: true,
        rotate3DAngle: true,
        scale: true,
        scaleX: true,
        scaleY: true,
        scaleZ: true,
        scale3DX: true,
        scale3DY: true,
        scale3DZ: true,
        skew: true,
        skewX: true,
        skewY: true
    };
  
    static dimMap = {
        width: true,
        height: true
    };
    
    static styleWithUnitMap = {
        fontSize: true,
        lineHeight: true,
        borderRadius: true,
        padding: true,
        left: true,
        top: true,
        letterSpacing: true
    }

    static colorMap = {
        color: true,
        background: true,
        backgroundColor: true
    };
    
    static styleTargetMap = {
        ...TargetData.transformMap,
        ...TargetData.dimMap,
        ...TargetData.styleWithUnitMap,
        ...TargetData.colorMap,
        opacity: true,
        zIndex: true,
        border: true,
        borderTop: true,
        borderLeft: true,
        borderRight: true,
        borderBottom: true
    };
    
    static asyncStyleTargetMap = {
        position: true, 
        css: true, 
        style: true, 
        textAlign: true, 
        boxSizing: true,
        transformStyle: true, 
        transformOrigin: true, 
        attributes: true, 
        justifyContent: true,
        alignItems: true, 
        display: true, 
        cursor: true, 
        fontFamily: true, 
        overflow: true,
        overflowX: true,
        overflowY: true,
        textDecoration: true, 
        boxShadow: true, 
        fontWeight: true,
        willChange: true
    };

    static scaleMap = { 
        scale: true, 
        scaleX: true, 
        scaleY: true, 
        scaleZ: true, 
        scale3DX: true, 
        scale3DY: true, 
        scale3DZ: true 
    };

    static rotate3D = { 
        rotate3DX: true, 
        rotate3DY: true, 
        rotate3DZ: true 
    };

    static attributeTargetMap = {
        lang: true, 
        autofocus: true, 
        placeholder: true, 
        autocomplete: true, 
        name: true,
        type: true, 
        src: true, 
        href: true, 
        method: true, 
        size: true, 
        value: true,
        maxlength: true, 
        minlength: true, 
        max: true, 
        min: true, 
        readonly: true,
        required: true, 
        alt: true, 
        disabled: true, 
        action: true, 
        accept: true,
        selected: true, 
        rows: true, 
        cols: true, 
        tabindex: true
    };

    static mustExecuteTargets = {
        width: true, 
        height: true, 
        heightFromDom: true, 
        widthFromDom: true,
        fetch: true
    };

    static coreTargetMap = { 
        x: true, 
        y: true 
    };
    
    static ignoreRerun = {
        ...TargetData.coreTargetMap,
        isVisible: true        
    };
        
    static ignoreTargetMethodNameMap = {
        ...TargetData.coreTargetMap,
        isVisible: true
    };

    static cssFunctionMap = {
        skew: { x: 0, y: 0 },
        translate3d: { x: 0, y: 0, z: 0 },
        rotate3d: { x: 0, y: 0, z: 0, a: 0 },
        scale3d: { x: 0, y: 0, z: 0 }
    };

    static bypassInitialProcessingTargetMap = {
        onChildrenChange: true, 
        onVisibleChildrenChange: true, 
        onPageClose: true
    };
    
    static controlTargetMap = {
        defaultStyling: true,
        styling: true,
        reuseDomDefinition: true,
        useWindowFrame: true,
        canDeleteDom: true,
        domHolder: true,
        interval: true,
        onDomEvent: true,
        canHaveDom: true
    };
    
    static events = {
        mouseStart: {
            pointerdown: { eventName: 'mousedown', inputType: 'pointer', eventType: 'start', order: 2, windowEvent: false, queue: true, rateLimit: 0 },
            mousedown: { eventName: 'mousedown', inputType: 'mouse', eventType: 'start', order: 3, windowEvent: false, queue: true, rateLimit: 0 }
        },

        mouseEnd: {
            pointerup: { eventName: 'mouseup', inputType: 'pointer', eventType: 'end', order: 2, windowEvent: false, queue: true, rateLimit: 0 },
            mouseup: { eventName: 'mouseup', inputType: 'mouse', eventType: 'end', order: 3, windowEvent: false, queue: true, rateLimit: 0 }
        },

        clickEvents: {
            click: { eventName: 'click', inputType: 'mouse', eventType: 'click', order: 1, windowEvent: false, queue: false, rateLimit: 0 }
        },

        touchStart: {
            touchstart: { eventName: 'touchstart', inputType: 'touch', eventType: 'start', order: 1, windowEvent: false, queue: true, rateLimit: 0 }
        },

        touchEnd: {
            touchend: { eventName: 'touchend', inputType: 'touch', eventType: 'end', order: 1, windowEvent: false, queue: true, rateLimit: 0 }
        },

        cancelEvents: {
            touchcancel: { eventName: 'touchend', inputType: 'touch', eventType: 'cancel', order: 1, windowEvent: false, queue: true, rateLimit: 0 },
            pointercancel: { eventName: 'mousecancel', inputType: 'pointer', eventType: 'cancel', order: 2, windowEvent: false, queue: true, rateLimit: 0 },
            mousecancel: { eventName: 'mouseup', inputType: 'mouse', eventType: 'cancel', order: 3, windowEvent: false, queue: true, rateLimit: 0 }
        },

        windowEvents: {
            keyup: { eventName: 'key', inputType: '', eventType: 'key', order: 1, windowEvent: true, queue: true, rateLimit: 50 },
            keydown: { eventName: 'keydown', inputType: '', eventType: 'keydown', order: 1, windowEvent: true, queue: true, rateLimit: 50 },            
            blur: { eventName: 'blur', inputType: 'mouse', eventType: 'cancel', order: 2, windowEvent: true, queue: true, rateLimit: 0 },
            resize: { eventName: 'resize', inputType: '', eventType: 'resize', order: 1, windowEvent: true, queue: true, rateLimit: 50 },
            orientationchange: { eventName: 'resize', inputType: '', eventType: 'resize', order: 1, windowEvent: true, queue: true, rateLimit: 50 }
        },

        windowScroll: {
            scroll: { eventName: 'scroll', inputType: '', eventType: 'windowScroll', order: 1, windowEvent: true, queue: true, rateLimit: 50 }
        },

        leaveEvents: {
            pointerleave: { eventName: 'mouseleave', inputType: 'pointer', eventType: 'leave', order: 2, windowEvent: false, queue: true, rateLimit: 0 },
            mouseleave: { eventName: 'mouseleave', inputType: 'mouse', eventType: 'leave', order: 3, windowEvent: false, queue: true, rateLimit: 0 }
        },

        enterEvents: {
            pointerenter: { eventName: 'mouseenter', inputType: 'pointer', eventType: 'enter', order: 2, windowEvent: false, queue: true, rateLimit: 0 },
            mouseenter: { eventName: 'mouseenter', inputType: 'mouse', eventType: 'enter', order: 3, windowEvent: false, queue: true, rateLimit: 0 }
        },

        moveEvents: {
            touchmove: { eventName: 'touchmove', inputType: 'touch', eventType: 'move', order: 1, windowEvent: false, queue: true, rateLimit: 50 },
            pointermove: { eventName: 'mousemove', inputType: 'pointer', eventType: 'move', order: 2, windowEvent: false, queue: true, rateLimit: 50 },
            mousemove: { eventName: 'mousemove', inputType: 'mouse', eventType: 'move', order: 3, windowEvent: false, queue: true, rateLimit: 50 }
        },

        documentEvents: {
            touchmove: { eventName: 'touchmove', inputType: 'touch', eventType: 'move', order: 1, windowEvent: false, queue: true, rateLimit: 50 },
            pointermove: { eventName: 'mousemove', inputType: 'pointer', eventType: 'move', order: 2, windowEvent: false, queue: true, rateLimit: 50 },
            mousemove: { eventName: 'mousemove', inputType: 'mouse', eventType: 'move', order: 3, windowEvent: false, queue: true, rateLimit: 50 },
            mouseleave: { eventName: 'mouseleave', inputType: 'mouse', eventType: 'leave', order: 3, windowEvent: false, queue: true, rateLimit: 50 },
            pointerup: { eventName: 'mouseup', inputType: 'pointer', eventType: 'end', order: 2, windowEvent: false, queue: true, rateLimit: 0 },
            mouseup: { eventName: 'mouseup', inputType: 'mouse', eventType: 'end', order: 3, windowEvent: false, queue: true, rateLimit: 0 },
            touchend: { eventName: 'touchend', inputType: 'touch', eventType: 'end', order: 1, windowEvent: false, queue: true, rateLimit: 0 }
        },

        wheelEvents: {
            wheel: { eventName: 'wheel', inputType: '', eventType: 'wheel', order: 1, windowEvent: false, queue: true, rateLimit: 50 },
            mousewheel: { eventName: 'wheel', inputType: '', eventType: 'wheel', order: 1, windowEvent: false, queue: true, rateLimit: 50 }
        }
    };
    
    static attributesToTargets = {
        onstart: 'onStart',
        onend: 'onEnd',
        onkey: 'onKey',
        onkeydown: 'onKeyDown',
        onanykey: 'onAnyKey',
        onclick: 'onClick',
        onanyclick: 'onAnyClick',
        onhover: 'onHover',
        onswipe: 'onSwipe',
        onanyswipe: 'onAnySwipe',        
        onpinch: 'onPinch',
        onenter: 'onEnter',
        onleave: 'onLeave',
        onblur: 'onBlur',
        onfocus: 'onFocus',
        onscroll: 'onScroll',
        onscrollleft: 'onScrollLeft',
        onscrolltop: 'onScrollTop',        
        onwindowscroll: 'onWindowScroll',
        onvisible: 'onVisible',
        onresize: 'onResize',
        textalign: 'textAlign',
        preventdefault: 'preventDefault',
        translatex: 'translateX',
        translatey: 'translateY',
        translatez: 'translateZ',
        rotate3dx: 'rotate3DX',
        rotate3dy: 'rotate3DY',
        rotate3dz: 'rotate3DZ',
        rotate3dangle: 'rotate3DAngle',
        scale3dx: 'scale3DX',
        scale3dy: 'scale3DY',
        scale3dz: 'scale3DZ',
        skewx: 'skewX',
        skewy: 'skewY',
        fontsize: 'fontSize',
        borderradius: 'borderRadius',
        letterspacing: 'letterSpacing',
        backgroundcolor: 'backgroundColor',
        bordertop: 'borderTop',
        borderleft: 'borderLeft',
        borderright: 'borderRight',
        borderbottom: 'borderBottom',
        boxsizing: 'boxSizing',
        transformstyle: 'transformStyle', 
        transformorigin: 'transformOrigin', 
        justifycontent: 'justifyContent',
        alignitems: 'alignItems', 
        fontfamily: 'fontFamily', 
        overflowx: 'overflowX',
        overflowy: 'overflowY',
        textdecoration: 'textDecoration', 
        boxshadow: 'boxShadow', 
        fontweight: 'fontWeight',
        willchange: 'willChange',
        domholder: 'domHolder',
        shouldcalculatechildtargets: 'shouldCalculateChildTargets',
        coretargets: 'coreTargets',
        domparent: 'domParent',
        containeroverflowmode: 'containerOverflowMode',
        itemoverflowmode: 'itemOverflowMode',
        onvisiblechildrenchange: 'onVisibleChildrenChange',
        onchildrenchange: 'onChildrenChange',
        isvisible: 'isVisible',
        isinflow: 'isInFlow'
    };
    
    static targetToEventsMapping = {
        onStart: [ 'touchStart', 'mouseStart' ],
        onEnd: [ ],
        onKey: [ ],
        onKeyDown: [ ],
        onAnyKey: [ ],
        onBlur: [ ],
        onFocus: [ ],
        onClick: [ 'clickEvents', 'touchStart', 'mouseStart' ],
        onAnyClick: [ 'clickEvents', 'touchStart', 'mouseStart' ],
        onHover: [ 'moveEvents' ],
        onSwipe: [ 'touchStart', 'mouseStart' ],
        onAnySwipe: [ 'touchStart', 'mouseStart' ],        
        onPinch: [ 'touchStart' ],
        onEnter: [ 'enterEvents' ],
        onLeave: [ 'leaveEvents' ],
        onScroll: [ 'touchStart', 'mouseStart', 'wheelEvents' ],
        onScrollLeft: [ 'touchStart', 'mouseStart', 'wheelEvents' ],
        onScrollTop: [ 'touchStart', 'mouseStart', 'wheelEvents' ],        
        onWindowScroll: [ 'windowScroll' ]
    };

    static touchEventMap = {
        onStart: tmodel => getEvents().isStartHandler(tmodel),
        onEnd: tmodel => getEvents().isEndHandler(tmodel),
        onAnySwipe: () => getEvents().isSwipeEvent() && TUtil.isDefined(getEvents().swipeStartX),
        onHover: tmodel => getEvents().isMoveEvent() && getEvents().isHoverHandler(tmodel),

        onClick: tmodel => getEvents().isClickEvent() && getEvents().isClickHandler(tmodel),
        onAnyClick: () => getEvents().isClickEvent(),
        onEnter: tmodel => getEvents().isEnterHandler(tmodel),
        onLeave: tmodel => getEvents().isLeaveHandler(tmodel),        
        onSwipe: tmodel => getEvents().isSwipeHandler(tmodel) && getEvents().isSwipeEvent() && TUtil.isDefined(getEvents().swipeStartX) 
    };

    static internalEventMap = {
        onDomEvent: tmodel => tmodel.hasDomNow,
        onVisible: tmodel => tmodel.isNowVisible,
        onResize: tmodel => {            
            const lastUpdate = tmodel.getDimLastUpdate();
            const parent = tmodel.getParent();
            const resizeLastUpdate = parent ? Math.max(parent.getDimLastUpdate(), getResizeLastUpdate()) : getResizeLastUpdate();
            return lastUpdate > 0 && resizeLastUpdate > lastUpdate;
        }       
    };

    static allEventMap = {
        ...TargetData.touchEventMap,
      
        onFocus: tmodel => getEvents().onFocus(tmodel),
        onBlur: tmodel => getEvents().onBlur(tmodel),
        onPinch: tmodel => getEvents().isPinchHandler(tmodel),
        onKey: tmodel => getEvents().getEventType() === 'key' && getEvents().currentKey && getEvents().currentHandlers.focus === tmodel && getEvents().currentHandlers.justFocused !== tmodel,
        onKeyDown: tmodel => getEvents().getEventType() === 'keydown' && getEvents().currentKey && getEvents().currentHandlers.focus === tmodel && getEvents().currentHandlers.justFocused !== tmodel,
        onAnyKey: () => getEvents().getEventType() === 'key' && getEvents().currentKey,
        onScroll: tmodel => (getEvents().isScrollLeftHandler(tmodel) && getEvents().deltaX()) || (getEvents().isScrollTopHandler(tmodel) && getEvents().deltaY()),
        onScrollTop: tmodel => getEvents().getOrientation() !== 'horizontal' && getEvents().isScrollTopHandler(tmodel) && getEvents().deltaY(), 
        onScrollLeft: tmodel => getEvents().getOrientation() !== 'vertical' && getEvents().isScrollLeftHandler(tmodel) && getEvents().deltaX(),
        onWindowScroll: () => getEvents().getEventType() === 'windowScroll'        
    };
}

export { TargetData };
