# TargetJS: State as Destination, UI as Sequence

**[targetjs.io](https://targetjs.io)** 
[![MIT LICENSE](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/livetrails/targetjs/blob/main/LICENSE) 
[![Stars](https://img.shields.io/github/stars/livetrails/targetjs.svg)](https://github.com/livetrails/targetjs/stargazers)
[![npm version](https://img.shields.io/npm/v/targetj.svg)](https://www.npmjs.com/package/targetj)

TargetJS is a high-performance JavaScript UI framework with ultra-compact syntax. It replaces the "State → Render" model with "State → transition → Render". It unifies UI, animations, APIs, event handling, and state into self-contained "Targets" that stack together like intelligent Lego pieces using Code-Ordered Reactivity.

It can be used as a full-featured framework or as a lightweight library alongside other frameworks. It is also a highly performant web framework, as shown in the [framework benchmark](https://krausest.github.io/js-framework-benchmark/current.html).


## What problems TargetJS solves

**UI frameworks model the final result, not transition**

Traditional frameworks model the UI as a function of state: change state, re-render the UI. When state changes from A → B, the UI immediately jumps to B. The framework doesn’t naturally represent the journey from A → B. But modern, rich user experiences are more like: A → transition → B.

TargetJS treats state as a destination. Values are not only assigned. They can be approached over time through configurable steps. This makes transitions a native part of state change. TargetJS also delivers CSS-level transition efficiency.

**Fragmentation across multiple mental models**

In many applications, state, animation, events, loading, timing, and callbacks are all handled through separate concepts or APIs. This creates glue code and a mental split between them.

TargetJS unifies them under one concept and one model. Methods and fields are unified and both become reactive units with their own state, lifecycle, timing, execution conditions, looping, and callbacks. This shifts fields from passive values to active participants, reducing boilerplate and keeping application logic consolidated.

**UI sequences are difficult to trace in code**

UIs often follow sequences like this:

Click → animate button → fetch data → render results → animate items → highlight one item

In traditional code, that sequence is often scattered across different places such as event handlers, effects, promises, and callbacks.

TargetJS code order and target reactivity allow the implementation to more closely mirror the actual UI sequence.

With its compact style, TargetJS makes the journey from A → B explicit and efficient, with significantly less code than traditional frameworks.

## ⚡ Quick Start (30 Seconds)

**1. Install**

```bash
npm install targetj
```

**2. The "Hello World" Sequence**

This creates a blue box that grows, then turns red, and then logs "Hello World" in order.

```javascript
import { App } from "targetj";

App({
  backgroundColor: 'blue', // Starts immediately
  width: { value: [100, 200], steps: 100, interval: 8 }, // Starts immediately: animate width from 100px to 200px in 100 steps with 8 ms interval per step.
  height: { value: [100, 200], steps: 100, interval: 8 }, // Starts immediately: animate height.
  backgroundColor$$: { value: 'red', steps: 100, interval: 8 }, // Wait ($$) for width/height to finish
  done$$() { console.log("Hello World!"); } // 3. Waits ($$) for the background color, width/height to finish
}).mount("#app");
```

## Targets

In TargetJS, targets are the fundamental unit of behavior instead of methods. 
Methods and properties both are internally transformed into targets that the framework schedules and executes.


### Execution Syntax

Target names can include special symbols that determine **when they execute**.

| Symbol | Name | Behavior |
|------|------|------|
| `name` | Standard | Runs immediately in the order it appears. |
| `name$` | Reactive | Runs every time the previous sibling target runs. |
| `name$$` | Deferred | Runs only after the entire preceding target chain (including children, animations, and API calls) completes. |
| `_name` | Inactive | Does not run automatically. Trigger it manually via `.activateTarget()`. |


### Target Controls

A target can also be defined as an object with optional controls that manage its lifecycle and execution.

| Property | Description |
|------|------|
| `value` | The data or function that determines the target's state. |
| `steps` | Turns a value change into an animation. |
| `interval` | Delay (ms) between steps or executions. |
| `cycles` | Number of times the target repeats. |
| `loop` | Boolean form of repetition for continuous execution. |
| `active` | Boolean property controlling when `value` is executed. |
| `enabledOn` | Determines whether the target is enabled for execution. |
| `easing` | Predefined easing function controlling how values update over steps. |
| `onComplete` | Callback triggered when this target (and its children) finishes. |
| `onValueChange` | Callback triggered when the target emits a new value. |

## Examples: Like Button → Animated Like (in 3 Steps)

Let’s see how TargetJS handles a complex interaction that would usually require 50+ lines of React/CSS. The example demonstrates how to run four asynchronous operations in a strict sequential sequence. In other words, each step has to wait for all the previous ones to complete.

### 1) Like button

One object defines a UI element without separate HTML/CSS. Static targets map directly to DOM styles/attributes. You can still use CSS if wanted.

<img src="https://targetjs.io/img/likeButton6.gif" width="130" />

```html
<div id="likeButton"></div>
```

```javascript
import { App } from "targetj";

App({
  width: 220,
  height: 60,
  lineHeight: 60,
  textAlign: "center",
  borderRadius: 10, 
  html: "♡ Like",
  // Runs immediately on mount
  scale: { value: [1.2, 1], steps: 12, interval: 12 },
  backgroundColor: { value: ["#ffe8ec", "#f5f5f5"], steps: 12, interval: 12 }
}).mount("#likeButton");
```

### 2) Adding the Interaction

We move the animation into an `onClick` and add a deferred heart animation.

<img src="https://targetjs.io/img/likeButton-step2-2.gif" width="130" />

```html
<div id="likeButton"></div>
```
```javascript
import { App } from "targetj";

App({
  width: 220, height: 60, lineHeight: 60, textAlign: "center",
  borderRadius: 10, backgroundColor: "#f5f5f5",
  cursor: "pointer", userSelect: "none",
  html: "♡ Like",
  onClick() {
    this.setTarget('scale', { value: [1.2, 1], steps: 8, interval: 12 });
    this.setTarget('backgroundColor', { value: [ '#ffe8ec', '#f5f5f5' ], steps: 12, interval: 12 });
  },
  heart$$: {  // Wait for the button animation to finish, THEN add and animate the heart.
    html: "♥", color: "crimson", fontSize: 20,
    fly() {
      const cx = (this.parent.getWidth() - this.getWidth()) / 2;
      this.setTarget('x', { value: [cx, cx + 22, cx - 16, cx + 10, cx ], steps: 50, cycles: 2 }); // Repeat it twice
      this.setTarget('y', { value: [0, -120], steps: 400 });
    }
  }  
}).mount("#likeButton");
```

### 3) The Full Async Workflow

We handle UI, two animations, a POST request, and a cleanup.

<img src="https://targetjs.io/img/likeButton-step3-4.gif" width="130" />

```html
<div id="likeButton"></div>
```

```javascript
import { App } from "targetj";

App({
  width: 220, height: 60, lineHeight: 60, textAlign: "center",
  borderRadius: 10, backgroundColor: "#f5f5f5", cursor: "pointer", userSelect: "none",
  role: "button", tabIndex: 0,
  html: "♡ Like",
  onClick() {
    this.setTarget('scale', { value: [1.2, 1], steps: 8, interval: 12 });
    this.setTarget('backgroundColor', { value: [ '#ffe8ec', '#f5f5f5' ], steps: 12, interval: 12 });
  },
  heart$$: {
    html: "♥", color: "crimson", fontSize: 20,
    fly() {
      const cx = (this.parent.getWidth() - this.getWidth()) / 2;
      this.setTarget('x', { value: [cx, cx + 22, cx - 16, cx + 10, cx ], steps: 50, cycles: 2 }); // Repeat it twice
      this.setTarget('y', { value: [0, -120], steps: 400 });
    }
  },
  fetch$$: { method: "POST", id: 123, url: "/api/like" }, // Wait for the heart to finish, THEN fetch
  removeHearts$$() { this.removeChildren(); }, // Wait for fetch to finish, THEN cleanup
  onKey(e) { if (e.key === "Enter") this.activateTarget("onClick"); } 
}).mount("#likeButton");
```

### Summary

Each target has its own state and lifecycle. Targets execute automatically in the order they are written. `$$` defers execution until all prior sibling targets (including their children) are fully complete. Animations, API calls, event handling, and child creation are all treated uniformly as targets. Complex asynchronous flows can be structured by organizing work into parent and child targets. In addition, targets provide built-in capabilities such as `onComplete` callbacks, `enabledOn`, looping with delays, and more. This also makes the code more compact, as it avoids using extra variables to track progress and reduces the need for loops and conditional statements.

---

## Table of Contents

1. [📦 Alternative Installation Via CDN](#-alternative-installation-via-cdn)
1. [Using TargetJS as a Library](#using-targetjs-as-a-library)
1. [🚀 Why TargetJS?](#-why-targetjs)
1. Deeper Examples:
    - [Loading Five Users Example](#loading-five-users-example)
    - [Infinite Loading and Scrolling Example](#infinite-loading-and-scrolling-example)
1. [Special Target Names](#special-target-names)
1. [How to Debug in TargetJS](#how-to-debug-in-targetjs)
1. [Documentation](#documentation)
1. [License](#license)
1. [Contact](#contact)
1. [💖 Support TargetJS](#-support-targetjs)

## 📦 Alternative Installation Via CDN

Add the following `<script>` tag to your HTML to load TargetJS from a CDN:

```html
<script src="https://unpkg.com/targetj@latest/dist/targetjs.js"></script>
```

This exposes `TargetJS` on `window`, so you can initialize your app with `TargetJS.App(...)`.

>  Ensure your code runs after the DOM is ready (use `defer`, place your script at the bottom of the `<body>`, or wrap it in a `DOMContentLoaded` listener).

```html
<div id='redbox'></div>

<script>
    TargetJS.App({
        backgroundColor: 'red',
        width: { value: [100, 250, 100], steps: 20 },
        height: { value: [100, 250, 100], steps: 20 }
    }).mount('#redbox');
</script>
```

### Zero-JS Declarative HTML

TargetJS can also be used as a "no-code" library. Elements with tg- attributes are discovered and activated automatically.

```html
<div
   tg-background="red"
   tg-width="{ value: [100, 250, 100], steps: 20 }"
   tg-height="{ value: [100, 250, 100], steps: 20 }">
</div>
```

## Using TargetJS as a Library

TargetJS can run inside an existing app mounted into a DOM element managed by another framework.

### React (mount + cleanup)

```javascript
import React, { useLayoutEffect, useRef } from "react";
import { App as TApp } from "targetj";

export default function TargetIsland() {
  const hostRef = useRef(null);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    TApp({
      width: { value: [100, 500], steps: 100 },
      height: 200,
      backgroundColor: "purple",
      onClick() { console.log("click"); }
    }).mount(el);

    return () => {
      TApp.unmount();
    };
  }, []);

  return <div ref={hostRef} style={{ width: 100, height: 200, overflow: "hidden" }} />;
}
```

## 🚀 Why TargetJS?

1. Zero Boilerplate Async: The $$ postfix handles the "wait" for you.
2. Unified State: State isn't "elsewhere". It's built into every Target.
3. Animation by Default: High-performance animations are baked into the logic.
4. Ultra-Compact: Write 70% less code than standard frameworks.
5. Lower Cognitive Load: Code reads from top to bottom, exactly how the user experiences the interaction.

## Deeper Examples

### Loading Five Users Example

In this example, we load five separate users and display five boxes, each containing a user's name and email.

- `fetch` calls five APIs to retrieve details for five users.
- `child` is a special target that adds a new item to the parent each time it executes. Because it ends with `$` in this example, it executes every time an API call returns a result.
- TargetJS ensures that API results are processed in the same sequence as the API calls. For example, if the user1 API result arrives before user0, `child` will not execute until the result for user0 has been received.

  <img src="https://targetjs.io/img/fetch-5-users.gif" width="130" />

```html
<div id="users"></div>
```
```javascript
import { App } from "targetj";

App({
    gap: 10,
    fetch: ['https://targetjs.io/api/randomUser?id=user0',
        'https://targetjs.io/api/randomUser?id=user1',
        'https://targetjs.io/api/randomUser?id=user2',
        'https://targetjs.io/api/randomUser?id=user3',
        'https://targetjs.io/api/randomUser?id=user4'
    ],
    child$() {
        // prevTargetValue Holds the previous target’s value. For fetch targets, this is each API result in code order,
        // not the order in which responses arrive in the browser.
        const user = this.prevTargetValue;
        return {
          width: 200,
          height: 65,
          borderRadius: 10,
          boxSizing: "border-box",
          padding: 10,
          fontSize: 14,
          backgroundColor: "#f0f0f0",
          scale: { value: [0.8, 1], steps: 14, interval: 12 },
          userName$$: {
            padding: "10px 0 5px 10px",
            boxSizing: "border-box",
            fontWeight: 600,
            opacity: { value: [0, 1], steps: 50 },
            html: user.name
          },
          userEmail$$: {
            paddingLeft: 10,
            boxSizing: "border-box",
            opacity: { value: [0, 0.7], steps: 50 },
            html: user.email
          }
       };
    }
}).mount("#users");
```

It can also be written using a target’s `cycles` and `interval` properties/methods to fetch users at intervals instead of in a single batch. In this example, we set interval to 1000, making the API call once every second.

  <img src="https://targetjs.io/img/fetch-5-users2.gif" width="130" />


```javascript
App({
    gap: 10,
    fetch: {
        interval: 1000,
        cycles: 5,
        value(i) { return `https://targetjs.io/api/randomUser?id=user${i}`; }
    },
    child$() {   
        return {
          // …same as the previous example…
        };
    }
}).mount("#users");
```

### Infinite Loading and Scrolling Example

In this advanced example, we implement an infinite-scrolling application.

* `addChildren` is a special target that adds multiple items to the container’s children each time it executes. The `onVisibleChildrenChange` event detects changes in the visible children and activates `addChildren` to insert new items and fill any gaps.

* `photo` and `userName` each add a `div` element inside every item, serving as placeholders for the photo and user name.

* `pause$$` delays the execution of all targets that follow it by 100 ms.

* `fetch$$` retrieves the user’s details.

* `reveal$$` executes after `fetch$$`, revealing the user name and populating the photo with a random color.

* `wave$$` executes only after all preceding children have completed their targets, giving each user item a coordinated animation.

TargetJS employs a tree-like structure to track visible branches, optimizing scroller performance.


  <img src="https://targetjs.io/img/infiniteScrolling20.gif" width="130" />

```html
<div id="userList"></div>
```

```javascript
import { App, getEvents, getScreenWidth, getScreenHeight } from "targetj";

App({
  preventDefault: true,
  width: 250,
  height() { return getScreenHeight(); },
  x() { return (getScreenWidth() - this.getWidth()) / 2; },
  containerOverflowMode: "always",
  addChildren() {
    return Array.from({ length: 10 }, (_, i) => ({
      height: 56,
      width() { return this.parent.getWidth(); },
      bottomMargin: 8,
      borderRadius: 12,
      backgroundColor: "white",
      boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
      photo: {
        x: 10, y: 10, width: 34, height: 34,
        borderRadius: "50%",
        backgroundColor: "#ddd"
      },
      userName: {
        x: 60, y: 10, width: 180, height: 30,
        overflow: "hidden",
        borderRadius: 5,
        backgroundColor: "#ddd"
      },
      pause$$: { interval: 100 },
      fetch$$: "https://targetjs.io/api/randomUser",
      reveal$$() {
        const userName = this.getChild("userName");
        userName.setTarget("html", this.val("fetch$$").name);
        userName.setTarget("backgroundColor", { value: "white", steps: 20 });
        this.getChild("photo").setTarget("backgroundColor", { value: "#" + Math.random().toString(16).slice(-6), steps: 20 });
      },
    }));
  },
  wave$$: {
    interval: 30,
    cycles() { return this.visibleChildren.length; },
    value(i) {
      const child = this.visibleChildren[i];
      child.setTarget("scale", { value: [1, 1.06, 1], steps: 18 });
      child.setTarget("opacity", { value: [1, 0.92, 1], steps: 18 });
    }
  },
  onScroll() {
    this.setTarget("scrollTop", Math.max(0, this.getScrollTop() + getEvents().deltaY()));
  },
  onVisibleChildrenChange() {
    const visibleCount = this.visibleChildren.length;
    if (getEvents().dir() !== "up" && visibleCount * 64 < this.getHeight()) {
      this.activateTarget("addChildren");
    }
  }
}).mount("#userList");
```
---

## Special Target Names

Some target names have built-in meaning and interact directly with the DOM, layout system, or browser events.  
Because these behaviors are expressed as targets, they still participate in the same execution system and dependency flows as any other target.

**Styles**

These targets update CSS properties and transforms:

- `width`, `height`
- `opacity`
- `x`, `y`, `z`
- `rotate`, `rotateX`, `rotateY`, `rotateZ`
- `scale`
- `backgroundColor`, `color`

These can be animated simply by adding `steps`.

**Structure**

These targets define the structure of the interface:

- `children` or `addChildren` – adds new children each time the target executes
- `html` – inner HTML content, often simple text
- `element` – specify the DOM element type (e.g., `div`, `canvas`)

**Events**

These targets respond to browser events:

- `onClick`
- `onScroll`
- `onKey`
- `onResize`
- `onEnter` / `onLeave`
- `onVisibleChildrenChange`

## How to Debug in TargetJS

TargetJS provides built-in debugging tools:

```javascript
TargetJS.tApp.stop(); // Stop the application.
TargetJS.tApp.start(); // Restart the application
TargetJS.tApp.throttle = 0; // Slow down execution (milliseconds between cycles)
TargetJS.tApp.debugLevel = 1; // Log cycle execution
```
- Use `t()` in the browser console to find an object by its oid.
- Use `t(oid).bug()` to inspect all the vital properties.
- Use `t(oid).logTree()` to inspect the UI structure.

## Documentation
Explore the potential of TargetJS and dive into our interactive documentation at www.targetjs.io.

## License
Distributed under the MIT License. See LICENSE for more information.

## Contact
Ahmad Wasfi - wasfi2@gmail.com

## 💖 Support TargetJS

If you would like to show some appreciation:

- ⭐ Star this repo on GitHub to show your support!
- 🐛 Report issues & suggest features.
- 📢 Share TargetJS with your network.
