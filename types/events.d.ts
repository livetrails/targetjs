export type UserEventTargetName =
| "onStart"
| "onEnd"
| "onKey"
| "onKeyDown"
| "onAnyKey"
| "onBlur"
| "onFocus"
| "onClick"
| "onAnyClick"
| "onHover"
| "onSwipe"
| "onAnySwipe"
| "onPinch"
| "onEnter"
| "onLeave"
| "onScroll"
| "onScrollLeft"
| "onScrollTop"
| "onScrollLeftEnd"
| "onScrollTopEnd"
| "onWindowScroll"
| "onWindowScrollTopEnd"
| "onWindowScrollLeftEnd"
| "onPopState"
| "onChange"
| "onInput"
| "onSubmit";

export type InternalEventTargetName =
| "onDomEvent"
| "onVisible"
| "onInvisible";

export type EventTargetName =
| UserEventTargetName
| InternalEventTargetName
| "onResize";

export type StandardEventTargetName =
Exclude<EventTargetName, "onResize">;
