import { $Dom } from "./$Dom.js";
import { SearchUtil } from "./SearchUtil.js";
import { TUtil } from "./TUtil.js";
import { TargetData } from "./TargetData.js";
import { TargetExecutor } from "./TargetExecutor.js";
import { tApp, getRunScheduler, tRoot, getLocationManager } from "./App.js";

/**
 * It provides a central place to manage all events. 
 */
class EventListener {
    static MAX_EVENT_QUEUE_SIZE = 10;
    static MAX_EVENT_TYPE_CAPACITY = 2;

    constructor() {
         this.$document = new $Dom(document);

        this.currentTouch = {
            deltaY: 0,
            deltaX: 0,
            prevDeltaX: 0,
            prevDeltaY: 0,
            pinchDelta: 0,
            key: '',
            manualMomentumFlag: false,
            orientation: 'none',
            dir: '',
            source: ''
        };
        
        this.lastEvent = undefined;

        this.touchTimeStamp = 0;

        this.cursor = { x: 0, y: 0 };
        this.start0 = undefined;
        this.start1 = undefined;
        this.end0 = undefined;
        this.end1 = undefined;
        this.touchCount = 0;
        this.canFindHandlers = true;
        
        this.swipeStartX = 0;
        this.swipeStartY = 0;
        
        this.currentEventName = '';
        this.currentEventType = '';
        this.currentOriginalEvent = undefined;
        this.currentKey = '';
        
        this.currentHandlers = { 
            touch: null, 
            scrollLeft: null, 
            scrollTop: null,
            swipe: null,
            pinch: null,
            focus: null,
            justFocused: null,
            blur: null,
            leave: null,
            enter: null,
            start: null,
            end: null,
            hover: null
        };
        
        this.eventQueue = [];
        
        this.attachedEventMap = {};
        this.eventTargetMap = {};
              
        this.allEvents = {};
        
        this.windowScrollX = window.scrollX | 0;
        this.windowScrollY = window.scrollY | 0;
        this.windowEpoch = 0;
        
        Object.values(TargetData.events).forEach(group => {
            Object.assign(this.allEvents, group);
        });     

        this.bindedHandleWindowEvent = this.handleWindowEvent.bind(this);
        this.bindedHandleEvent = this.handleEvent.bind(this);
        this.bindedParentHandleEvent = this.handleDocEvent.bind(this);
    }

    detachWindowEvents() {
        Object.keys(TargetData.events.windowEvents).forEach(key => {
            tApp.$window.detachEvent(key, this.bindedHandleWindowEvent);
        });
    }
    
    attachWindowEvents() {
        Object.keys(TargetData.events.windowEvents).forEach(key => {
            tApp.$window.addEvent(key, this.bindedHandleWindowEvent);
        });        
    }
    
    detachDocumentEvents() {         
        Object.keys(TargetData.events.documentEvents).forEach(key => {
            this.$document.detachEvent(key, this.bindedParentHandleEvent);
        });        
    }
    
    attachDocumentEvents() {
        Object.keys(TargetData.events.documentEvents).forEach(key => {
            this.$document.addEvent(key, this.bindedParentHandleEvent);
        });         
    }
    
    attachEvents(tmodels) {
        for (const tmodel of tmodels) {
            if (!tmodel.state().externalEventList) {
                continue;
            }
            for (const targetName of tmodel.state().externalEventList) {
                this.attachTargetEvents(tmodel, targetName);
            }
        }
    }
    
    attachTargetEvents(tmodel, targetName) {
        const targetKey = `${tmodel.oid} ${targetName}`;
        
        const events = TargetData.targetToEventsMapping[targetName];
        if (!events || !Array.isArray(events) || events.length === 0) {         
            return undefined;
        }
        
        events.forEach(eventName => {
            
            const eventMap = TargetData.events[eventName];

            if (!eventMap) {
                return undefined;
            }
            
            Object.keys(eventMap).forEach(key => {
                const eventSpec = eventMap[key];
                const isWindow = !!eventSpec.windowEvent;
                const $dom = isWindow ? tApp.$window : (tmodel.hasDom() ? tmodel.$dom : null);
                
                if (!$dom) {
                    return false;
                }

                const attachMarkerKey = `${targetKey} ${isWindow ? 'win' : 'dom'}`;
                const alreadyMarked = this.eventTargetMap[attachMarkerKey] === $dom;
                const attachedKey = `${tmodel.oid} ${key} ${isWindow ? 'win' : 'dom'}`;
                
                const alreadyAttached = this.attachedEventMap[attachedKey] && this.attachedEventMap[attachedKey].$dom === $dom;
                
                if (!alreadyMarked || !alreadyAttached) {
                    $dom.detachEvent(key, this.bindedHandleEvent);
                    $dom.addEvent(key, this.bindedHandleEvent, eventSpec.capture, eventSpec.passive);
                    this.eventTargetMap[attachMarkerKey] = $dom;
                    this.attachedEventMap[attachedKey] = {$dom, event: key};
                }
            }); 
        });
    }

    detachAll() {
        const eventKeys = Object.keys(this.attachedEventMap);
        eventKeys.forEach(eventKey => {
            const { $dom, event } = this.attachedEventMap[eventKey];
            if ($dom.exists()) {
                $dom.detachEvent(event, this.bindedHandleEvent);
            }
        });
        this.attachedEventMap = {};
        this.eventTargetMap = {};
    }
    
    resetEventsOnTimeout() {
        if (this.currentTouch.deltaY || this.currentTouch.deltaX || this.currentTouch.pinchDelta) {
            const diff = this.touchTimeStamp - TUtil.now();
                                                
            if (diff > 100) {                         
                this.currentTouch.deltaY *= 0.95;
                this.currentTouch.deltaX *= 0.95;
                this.currentTouch.pinchDelta *= 0.95;
                
                if (Math.abs(this.currentTouch.deltaY) < 0.1) {
                    this.currentTouch.deltaY = 0;
                }
                if (Math.abs(this.currentTouch.deltaX) < 0.1) {
                    this.currentTouch.deltaX = 0;
                }
                if (Math.abs(this.currentTouch.pinchDelta) < 0.1) {
                    this.currentTouch.pinchDelta = 0;
                }                
                if (this.currentTouch.deltaX === 0 && this.currentTouch.deltaY === 0 && this.currentTouch.pinchDelta === 0) { 
                    this.touchTimeStamp = 0;
                }                
            }
            
            if (diff <= 0 || this.touchTimeStamp === 0) {
                this.currentTouch.deltaY = 0;
                this.currentTouch.deltaX = 0;
                this.currentTouch.pinchDelta = 0;
                this.currentTouch.dir = '';
                this.touchTimeStamp = 0;
            }
            
            getRunScheduler().schedule(10, 'scroll decay');      
        }
    }
    
    findEventHandlers({ tmodel, eventType }) {
        let clickHandler, swipeHandler, scrollLeftHandler, scrollTopHandler, pinchHandler, focusHandler, enterHandler, leaveHandler;
        
        if (tmodel) {
            clickHandler = SearchUtil.findFirstClickHandler(tmodel);
            swipeHandler = SearchUtil.findFirstSwipeHandler(tmodel);
            enterHandler = SearchUtil.findFirstEnterHandler(tmodel);
            leaveHandler = SearchUtil.findFirstLeaveHandler(tmodel);
            scrollLeftHandler = SearchUtil.findFirstScrollLeftHandler(tmodel, eventType);
            scrollTopHandler = SearchUtil.findFirstScrollTopHandler(tmodel, eventType);
            pinchHandler = SearchUtil.findFirstPinchHandler(tmodel);
            focusHandler = $Dom.hasFocus(tmodel) ? tmodel : this.currentHandlers.focus;
        }
                       
        if (this.currentHandlers.scrollLeft !== scrollLeftHandler || this.currentHandlers.scrollTop !== scrollTopHandler) {
            this.clearTouch();
        }

        if (this.currentHandlers.focus !== focusHandler) {
            this.currentHandlers.justFocused = focusHandler;
            this.currentHandlers.blur = this.currentHandlers.focus;
        }
       
        this.currentHandlers.hover = tmodel?.canHandleEvent('onHover') ? tmodel : undefined;
        
        this.currentHandlers.click = clickHandler;
        this.currentHandlers.swipe = swipeHandler;        
        this.currentHandlers.scrollLeft = scrollLeftHandler;        
        this.currentHandlers.scrollTop = scrollTopHandler;
        this.currentHandlers.pinch = pinchHandler;
        this.currentHandlers.focus = focusHandler;
        this.currentHandlers.enter = enterHandler;
        this.currentHandlers.leave = leaveHandler;
    }

    captureEvents() {
        this.currentTouch.prevDeltaX = 0;
        this.currentTouch.prevDeltaY = 0;

        this.currentHandlers.enter = undefined;
        this.currentHandlers.leave = undefined;
        this.currentHandlers.justFocused = undefined;
        this.currentHandlers.blur = undefined;
        this.currentHandlers.end = undefined;
        this.currentKey = this.currentTouch.key;
        
        if (this.eventQueue.length === 0) {
            this.currentEventName = '';
            this.currentEventType = '';
            this.currentOriginalEvent = undefined;
            this.currentKey = '';
            return;
        }

        const lastEvent = this.eventQueue.shift();
                           
        if (this.canFindHandlers) {
            this.findEventHandlers(lastEvent);
        }
        
        if (lastEvent.eventType === 'end' || lastEvent.eventType === 'click') {
            if (lastEvent.eventType === 'end') {
                this.currentHandlers.end =  this.currentHandlers.start;
                this.currentHandlers.end?.markLayoutDirty('end-event');
                this.currentHandlers.start = undefined;
            }
            this.canFindHandlers = true;
        }
        
        this.currentEventName = lastEvent.eventName;
        this.currentEventType = lastEvent.eventType;
        this.currentOriginalEvent = lastEvent.originalEvent;
        this.currentTouch.key = '';      
    }
    
    handleDocEvent(event) {
        this.handleEvent(event, true, false);
    }
    
    handleWindowEvent(event) {
        this.handleEvent(event, false, true);
    }
    
    handleEvent(event, isDocEvent, isWindowEvent) {
        if (!event) {
            return;
        }

        const { type: originalName } = event; 
        const eventItem = this.allEvents[originalName];
                                                  
        if (!eventItem) {
            return;
        }
                                
        let { eventName, inputType, eventType, order: eventOrder, queue, rateLimit } = eventItem;
                
        const now = TUtil.now();
                
        const tmodel = this.getTModelFromEvent(event);
                        
        tmodel?.markLayoutDirty('event');
                
        const newEvent = { eventName, eventItem, eventType, originalName, tmodel, originalEvent: event, timeStamp: now };

        if (this.lastEvent?.eventItem) {
            const { eventItem: lastEventItem, timeStamp: lastTimeStamp } = this.lastEvent;
            const rate = now - lastTimeStamp;
           
            if (inputType && lastEventItem.inputType && lastEventItem.inputType !== inputType && eventOrder > lastEventItem.order) {
                return;
            }                  

            if (this.eventQueue.length > EventListener.MAX_EVENT_QUEUE_SIZE && rateLimit > 0 && rate < rateLimit) {
                let capacity = 0;
                for (let i = this.eventQueue.length - 1; i >= 0; i--) {
                    const queuedEvent = this.eventQueue[i];
                    if (queuedEvent.eventItem?.eventType === eventType) {
                        if (++capacity > EventListener.MAX_EVENT_TYPE_CAPACITY) {
                            if (this.preventDefault(tmodel, eventName)) {
                                event.preventDefault();
                                event.stopPropagation();
                            }                            
                            return;
                        }
                    } else {
                        break;
                    }
                }
            }
        }
                      
        this.lastEvent = newEvent;
                                        
        if (queue) {
            this.eventQueue.push(this.lastEvent);
        }

        let touch; 
                               
        switch (eventName) {
            case 'mousedown':
            case 'touchstart':
                this.clearStart();
                this.clearEnd();
                this.clearTouch();

                this.touchCount = this.countTouches(event) || 1;
                

                if (this.preventDefault(tmodel, eventName) && event.cancelable) {
                    event.preventDefault();
                }
                
                this.start0 = this.getTouch(event);
                this.start1 = this.getTouch(event, 1);
                
                this.cursor.x = this.start0.x;
                this.cursor.y = this.start0.y;
                
                this.currentHandlers.start = tmodel;
                this.findEventHandlers(newEvent); 
                this.canFindHandlers = false;
               
                this.swipeStartX = this.start0.x - (this.currentHandlers.swipe?.getX() ?? 0);
                this.swipeStartY = this.start0.y - (this.currentHandlers.swipe?.getY() ?? 0);
                
                event.stopPropagation();
                
                this.detachDocumentEvents();
                this.attachDocumentEvents();
                
                break;
                
            case 'mousemove':
            case 'touchmove': {
                touch = this.getTouch(event);

                this.cursor.x = touch.x;
                this.cursor.y = touch.y;
                if (this.preventDefault(tmodel, eventName) && event.cancelable) {
                    event.preventDefault();
                }
                
                if (this.touchCount > 0) {
                    this.touchTimeStamp = now + 10;
                    
                    this.move(event);
                    event.stopPropagation();
                    
                    this.currentHandlers.swipe?.markLayoutDirty('swipe-event');
                    
                } else if (this.isCurrentSource('wheel')) {
                    this.clearTouch();                    
                }
                break;
            }
            case 'mouseup':
            case 'touchend':
                
                this.detachDocumentEvents();
                if (this.preventDefault(tmodel, eventName) && event.cancelable) {
                    event.preventDefault();
                }
                
                this.end(event);
                                
                this.clearEnd();
                this.touchCount = 0;
                
                event.stopPropagation();
                break;                             
                
            case 'click':
                if (this.preventDefault(tmodel, eventName)) {
                    event.preventDefault();
                }
                      
                this.end0 = this.getTouch(event);
                                
                if (this.start0) {
                    const clickHandler = SearchUtil.findFirstClickHandler(tmodel);
                                        
                    if (clickHandler && clickHandler === this.currentHandlers.click && (clickHandler !== this.currentHandlers.swipe || this.getSwipeDistance() < 5)) {
                        this.eventQueue.length = 0;
                        this.eventQueue.push({ eventName, eventItem, eventType, originalName, tmodel, originalEvent: event, timeStamp: now });
                    }
                }
                        
                this.clearEnd();
                this.touchCount = 0; 

                event.stopPropagation();
                break;

            case 'wheel':
                if (this.preventDefault(tmodel, eventName)) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                this.touchTimeStamp = now + 500;
                this.wheel(event);
                break;

            case 'mouseleave':
                if (isDocEvent && this.touchCount > 0) {
                    this.detachDocumentEvents();

                    touch = this.getTouch(event);
                    this.cursor.x = touch.x;
                    this.cursor.y = touch.y;

                    this.end(event);

                    this.clearEnd();
                    this.touchCount = 0; 

                    event.stopPropagation(); 
                }
                              
                break;
                

            case 'key':
                this.currentTouch.key = event.which || event.keyCode;
                this.currentHandlers.focus?.markLayoutDirty('key-event');
                
                break;
                
            case 'keydown':
                this.currentTouch.key = event.which || event.keyCode;
                this.currentHandlers.focus?.markLayoutDirty('keydown-event');
                
                break;                
                
            case 'resize':
                this.windowEpoch++;
                this.resizeRoot();
                tApp.manager.getVisibles().forEach(t => {
                    t.markLayoutDirty('resize-event');
                });  
                break;
                
            case 'scroll':
                if (isWindowEvent) {
                    console.log("window scroll");
                    this.windowEpoch++;
                    this.windowScrollX = window.scrollX | 0;
                    this.windowScrollY = window.scrollY | 0;
                    getLocationManager().domIslandSet.forEach(t => {
                        t.markLayoutDirty('winScroll-event');
                    });
                } else {
                    tmodel.markLayoutDirty('winScroll-event');
                }
                break;
        }
        
        getRunScheduler().schedule(0, `${originalName}-${eventName}-${(event.target.tagName || '').toUpperCase()}`);
    }
    
    resizeRoot() {
        TargetExecutor.executeDeclarativeTarget(tRoot(), 'screenWidth');
        TargetExecutor.executeDeclarativeTarget(tRoot(), 'screenHeight');
    }

    preventDefault(tmodel, eventName) {
        if (tmodel && (tmodel.preventDefault() === true || (Array.isArray(tmodel.preventDefault()) && tmodel.preventDefault().includes(eventName)))) {
            return true;
        }
        return false;
    }

    getTModelFromEvent(event) {
        let oid = event.target?.id;
        
        if (!oid || !tApp.manager.visibleOidMap[oid]) {
            oid = $Dom.findNearestParentWithId(event.target);
        }
        
        return tApp.manager.visibleOidMap[oid];
    }

    clearStart() {
        this.start0 = undefined;
        this.start1 = undefined;
    }
    
    clearEnd() {
        this.end0 = undefined;
        this.end1 = undefined;        
    }

    clearTouch() {
        this.currentTouch = {
            deltaY: 0,
            deltaX: 0,
            prevDeltaX: 0,
            prevDeltaY: 0,
            pinchDelta: 0,
            key: '',
            manualMomentumFlag: false,
            orientation: 'none',
            dir: '',
            source: ''
        };
    }

    clearAll() {
        this.clearStart();
        this.clearEnd();
        this.clearTouch();
        this.eventQueue.length = 0;
        this.touchTimeStamp = 0;
        this.touchCount = 0; 
        this.canFindHandlers = true;
        this.lastEvent = undefined;
        this.attachedEventMap = {};
        this.eventTargetMap = {};
        this.swipeStartX = 0;
        this.swipeStartY = 0;
    }

    deltaX() {
        return this.currentTouch.deltaX;
    }

    deltaY() {
        return this.currentTouch.deltaY;
    }
    
    cursorX() {
        return this.cursor.x;
    }
    
    cursorY() {
        return this.cursor.y;
    }
    
    swipeX() {
        return this.cursor.x - this.swipeStartX;
    }

    swipeY() {
        return this.cursor.y - this.swipeStartY;
    }
    
    getSwipeDistance() {
        if (this.start0 && this.end0) {
            return TUtil.distance(this.start0.originalX, this.start0.originalY, this.end0.x, this.end0.y);
        }
        
        return 0;
    }
    
    pinchDelta() {
        return this.currentTouch.pinchDelta;
    }

    dir() {
        return this.currentTouch.dir;
    }

    getScrollLeftHandler() {
        return this.currentHandlers.scrollLeft;
    }

    getScrollTopHandler() {
        return this.currentHandlers.scrollTop;
    }
    
    getWindowScrollX() { return this.windowScrollX; }
    getWindowScrollY() { return this.windowScrollY; }
    getWindowEpoch() { return this.windowEpoch; }

    getPinchHandler() {
        return this.currentHandlers.pinch;
    }

    getClickHandler() {
        return this.currentHandlers.click;
    }
    
    getTouchCount() {
        return this.touchCount;
    }

    isClickEvent() {
        return this.getEventType() === 'click';
    }
    
    isMoveEvent() {
        return this.getEventType() === 'move';
    }
    
    isResizeEvent() {
        return this.getEventType() === 'resize';
    }
    
    isSwipeEvent() {
        return this.hasDelta() && this.touchCount === 1;
    }
    
    isScrollEvent() {
        return this.hasDelta() && this.isCurrentSource('wheel');        
    }
    
    hasDelta() {
        return this.deltaX() !== 0 || this.deltaY() !== 0;
    }
    isEndEvent() {
        return this.getEventType() === 'end' || this.getEventType() === 'click';
    }
    
    isStartEvent() {
        return this.getEventType() === 'start';        
    }

    getEventName() {
        return this.currentEventName;
    }
    
    getCurrentOriginalEvent() {
        return this.currentOriginalEvent;
    }
    
    getEventType() {
        return this.currentEventType;
    }  
    
    isClickHandler(handler) {
        return this.getClickHandler() === handler && this.isClickEvent();
    }

    isEnterHandler(handler) {
        return handler === this.currentHandlers.enter && this.getEventName() === 'mouseenter';
    }
    
    isLeaveHandler(handler) {
        return handler === this.currentHandlers.leave && this.getEventName() === 'mouseleave';
    }
    
    isHoverHandler(handler) {
        return handler === this.currentHandlers.hover;
    }    
        
    isSwipeHandler(handler) {
        return handler === this.currentHandlers.swipe;
    }
    
    isStartHandler(handler) {
        return handler === this.currentHandlers.start;
    }
    
    isEndHandler(handler) {
        return handler === this.currentHandlers.end;
    } 
    
    onFocus(handler) {
        return this.currentHandlers.justFocused === handler;        
    }
    
    onBlur(handler) {
        return this.currentHandlers.blur === handler;        
    } 
    
    hasFocus(handler) {
        return this.currentHandlers.focus === handler;
    }

    isScrollLeftHandler(handler) {
        return this.currentHandlers.scrollLeft === handler;
    }

    isScrollTopHandler(handler) {
        return this.currentHandlers.scrollTop === handler;
    }

    isPinchHandler(handler) {
        return this.currentHandlers.pinch === handler;
    }

    isCurrentSource(source) {
        return this.currentTouch.source === source;
    }
    
    isFormHandler(tmodel) {
        const ev = this.currentOriginalEvent;
        const el = tmodel.$dom?.element;
        const tgt = ev?.target;
        return !!(el && tgt && (tgt === el || el.contains?.(tgt)));
    }
    
    getOrientation() {
        return this.currentTouch.orientation;
    }

    countTouches(event) {
        return event.touches?.length || event.originalEvent?.touches?.length;
    }

    getTouch(event, index = 0) {
        const e = event.touches?.[index] ||
            event.originalEvent?.touches?.[index] ||
            event;

        const x = TUtil.isDefined(e.clientX) ? e.clientX : e.pageX || 0;
        const y = TUtil.isDefined(e.clientY) ? e.clientY : e.pageY || 0;
        return {
            x,
            y,
            originalX: x,
            originalY: y,
            target: e.target,
            timeStamp: TUtil.now()
        };
    }

    move(event) {
        if (this.touchCount === 1) {
            this.start0.y = this.end0 ? this.end0.y : this.start0.y;
            this.start0.x = this.end0 ? this.end0.x : this.start0.x;
            
            this.end0 = this.getTouch(event);

            if (TUtil.isDefined(this.end0)) {
                const deltaX = this.start0.x - this.end0.x;
                const deltaY = this.start0.y - this.end0.y;
                this.setDeltaXDeltaY(deltaX, deltaY, 'touch');
            }
        } else if (this.touchCount >= 2) {
            this.end0 = this.getTouch(event);
            this.end1 = this.getTouch(event, 1);

            const length1 = TUtil.distance(this.start0.x, this.start0.y, this.start1.x, this.start1.y);
            const length2 = TUtil.distance(this.end0.x, this.end0.y, this.end1.x, this.end1.y);

            const diff = length2 - length1;

            this.currentTouch.pinchDelta = diff > 0 ? 0.3 : diff < 0 ? -0.3 : 0;
        }
    }

    end() {
        if (this.touchCount <= 1 && this.start0) {
                        
            let deltaX = 0, deltaY = 0, period = 0, startPeriod = 0;
            
            if (TUtil.isDefined(this.end0)) {
                deltaX = this.start0.originalX - this.end0.x;
                deltaY = this.start0.originalY - this.end0.y;
                startPeriod = TUtil.now() - this.start0.timeStamp;
                period = startPeriod < 250 ? TUtil.now() - this.start0.timeStamp : 0;
            }
            let momentum;
                        
            if (this.currentTouch.orientation === 'horizontal' && Math.abs(deltaX) > 0 && period > 0) {
                momentum = TUtil.momentum(0, deltaX, period);
                this.touchTimeStamp = this.end0.timeStamp + momentum.duration;
                if ((this.touchTimeStamp - TUtil.now()) > 0) {                
                    this.currentTouch.deltaX = momentum.distance;
                    this.currentTouch.manualMomentumFlag = true;
                }
            } else if (this.currentTouch.orientation === 'vertical' && Math.abs(deltaY) > 0 && period > 0) {
                momentum = TUtil.momentum(0, deltaY, period);
                this.touchTimeStamp = this.end0.timeStamp + momentum.duration;
                if ((this.touchTimeStamp - TUtil.now()) > 0) {                    
                    this.currentTouch.deltaY = momentum.distance;
                    this.currentTouch.manualMomentumFlag = true;
                }
            } 
        }
    }

    setDeltaXDeltaY(deltaX, deltaY, source) {
        const diff = Math.abs(deltaX) - Math.abs(deltaY);
        
        if (diff >= 1) {
            if (this.currentTouch.orientation === 'none' ||
                    (this.currentTouch.orientation === 'vertical' && diff >= 2) ||
                    this.currentTouch.orientation === 'horizontal') {
                this.currentTouch.orientation = 'horizontal';
            }
        } else if (this.currentTouch.orientation === 'none' || 
                (this.currentTouch.orientation === 'horizontal' && diff <= -2) || 
                this.currentTouch.orientation === 'vertical') {
            this.currentTouch.orientation = 'vertical';
        }
        
        if (this.currentTouch.orientation === 'horizontal') {
            this.currentTouch.dir = deltaX < 0 ? 'left' : deltaX > 0 ? 'right' : this.currentTouch.dir;            
        }  else {
            this.currentTouch.dir = deltaY < 0 ? 'up' : deltaY > 0 ? 'down' : this.currentTouch.dir;            
        }
        
        this.currentTouch.source = source;

        // Accumulate movement deltas before they get reset in `captureEvents` to sync with the task cycle when movement is too fast
        this.currentTouch.prevDeltaX += deltaX;              
        this.currentTouch.prevDeltaY += deltaY;
        
        this.currentTouch.deltaX = this.currentTouch.prevDeltaX;        
        this.currentTouch.deltaY = this.currentTouch.prevDeltaY;
    }

    wheel(event) {
        let deltaX = 0;
        let deltaY = 0;

        this.currentTouch.pinchDelta = 0;

        this.start0 = this.getTouch(event);

        if (event.ctrlKey && 'deltaY' in event) {
            this.currentTouch.pinchDelta = -event.deltaY / 10;
        } else if ('deltaX' in event) {
            deltaX = event.deltaX;
            deltaY = event.deltaY;
        } else if ('wheelDeltaX' in event) {
            deltaX = -event.wheelDeltaX / 120;
            deltaY = -event.wheelDeltaY / 120;
        } else if ('wheelDelta' in event) {
            deltaX = -event.wheelDelta / 120;
        } else if ('detail' in event) {
            deltaX = event.detail / 3;
        }

        this.setDeltaXDeltaY(deltaX, deltaY, 'wheel');
    }
}

export { EventListener };
