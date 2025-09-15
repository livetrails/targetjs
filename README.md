# TargetJS: A Novel JavaScript UI Framework for Simplified Development and Enhanced User Experience

**[targetjs.io](https://targetjs.io)** 
[![MIT LICENSE](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/livetrails/targetjs/blob/main/LICENSE) 
[![Stars](https://img.shields.io/github/stars/livetrails/targetjs.svg)](https://github.com/livetrails/targetjs/stargazers)
[![npm version](https://img.shields.io/npm/v/targetj.svg)](https://www.npmjs.com/package/targetj)

TargetJS is a modern JavaScript UI framework that simplifies front-end development by introducing key concepts: unifying class methods and fields, autonomous and reactive methods, and execution flow that follows the written code. It provides a unified solution for key aspects like UI rendering, animations, APIs, state management, and event handling. This integrated approach leads to extreme compact code and an introduction of a new development paradigm. 
It can be used as a full-featured framework or as a lightweight library alongside other frameworks. It is also a highly performant web framework, as shown in the [framework benchmark](https://krausest.github.io/js-framework-benchmark/current.html).

## The Philosophy Behind TargetJS

Frameworks often promise simplicity, but frequently require extensive boilerplate and libraries as they inherit the same software approach rooted in early programming models and force it to fit building user interfaces by adding more complexity. User interfaces are dynamic and asynchronous and require a different paradigm.

TargetJS adopts a new approach. First, it unifies class methods and fields into a single construct called targets. Each target is given state, lifecycles, timing, iterations, and the autonomy to execute mimicking the behavior of living cells. Targets are essentially self-contained, intelligent blocks of code.

The second challenge is making these targets to fit and work together especially since UI operations are highly asynchronous. Instead of relying on traditional method calls and callbacks that don't address asynchronous nature well, TargetJS allows targets to react to the execution or completion of preceding targets. A subsequent target can run independently, execute whenever the previous one does, or wait until the previous target completes. Targets stack together like Lego pieces. It can address complex asynchronous workflow yet easy to understand.

For example, setting a value can implicitly define an animation, where the current value iteratively progresses until it reaches the new value. When the animation completes, the next target might initiate a fetch API call. Once the data is received, it can trigger another target that creates 10 new elements, each with its own animation and API call. A subsequent target can then be set to run only after all elements have completed their tasks. Throughout this sequence, no direct method calls are made. Targets simply react and chain together based on how the code is written.

Targets unlock a fundamentally new way of coding that simplifies everything from animation, UI updates, API calls, and state management. It also makes the code significantly more compact.

## Key Innovations and Concepts

1. Unifying Class Methods and Fields with Targets: A new construct called “targets” combines methods and fields, providing state, lifecycles, iteration, and timing mechanisms for both.
2. Declarative Reactive Targets: Targets can explicitly declare reactive execution triggered by the run or completion of their immediately preceding targets, whether synchronous or asynchronous.
3. All-in-One Solution: Offers a unified approach to UI rendering, API integration, state management, event handling, and animation.
4. Code-Ordered Execution: Targets are chained top to bottom and the execution flow generally follows the order in which the code is written.
5. Autonomous Methods: Methods in TargetJS are not directly callable. Instead, they are designed to execute themselves or react dynamically to the execution or completion of preedings targets. This enables declarative programming that inherently supports asynchronous operations without explicit plumbing like using async/await keywords.
6. Compactness: TargetJS allows developers to achieve interactive UIs with significantly less code.


## Examples: From like button → animated like + API (in 7 steps)

---

## 1) Like button (view only)

**What this shows:** One object defines a UI element without separate HTML/CSS. Static targets map directly to DOM styles/attributes.

  <img src="https://targetjs.io/img/likeButton.png" width="130" />

```javascript
import { App } from "targetj";

App({
  width: 220,
  height: 60,
  lineHeight: 60,
  textAlign: "center",
  borderRadius: 10,
  background: "#f5f5f5",
  html: "♡ Like"
});
```

---


## 2) Animation

**What this shows:** A mount-time animation that scales and changes the background over 12 steps, with 12ms pauses between steps. Targets without (`$`, `$$`, `_`) execute immediately in the order they are defined.

  <img src="https://targetjs.io/img/likeButton6.gif" width="130" />

```javascript
import { App } from "targetj";

App({
  width: 220,
  height: 60,
  lineHeight: 60,
  textAlign: "center",
  borderRadius: 10, 
  html: "♡ Like",
  scale: [ { list: [1.2, 1] }, 12, 12 ],
  background: [ { list: ["#ffe8ec", "#f5f5f5"] }, 12, 12 ]
});
```

## 3) Click → animation (imperative `setTarget`)

**What this shows:** Clicking plays the animations from the previous step using imperative `setTarget`.

  <img src="https://targetjs.io/img/likeButton4.gif" width="130" />

```javascript
import { App } from "targetj";

App({
  width: 220, height: 60, lineHeight: 60, textAlign: "center",
  borderRadius: 10, background: "#f5f5f5",
  cursor: "pointer", userSelect: "none",
  html: "♡ Like",

  onClick() {
    this.setTarget("scale",      { list: [1.2, 1] }, 12, 12);
    this.setTarget("background", { list: ["#ffe8ec", "#f5f5f5"] }, 12, 12);
    this.setTarget("html", "♥ Liked");
  }
});
```

---

## 4) Sequencing with `$$`: Adding a small heart after click

**What this shows:** A `$$` target (deferred) runs only after all prior targets finish (including `onClick()` and its animations). Here it adds a new heart element and runs its fly motion only once the click sequence has completed. Repeated clicks will delay adding the heart.

  <img src="https://targetjs.io/img/likeButton7.gif" width="130" />

```javascript
import { App } from "targetj";

App({
  width: 220, height: 60, lineHeight: 60, textAlign: "center",
  borderRadius: 10, background: "#f5f5f5", cursor: "pointer", userSelect: "none",
  html: "♡ Like",
  onClick() {
    this.setTarget("scale",      { list: [1.2, 1] }, 12, 12);
    this.setTarget("background", { list: ["#ffe8ec", "#f5f5f5"] }, 12, 12);
    this.setTarget("html", "♥ Liked");
  },
  heart$$: {
    html: "♥", color: "crimson", fontSize: 20,
    fly() {
      const cx = this.getCenterX(), cy = this.getCenterY();
      this.setTarget({
        opacity: { list: [0, 1, 1, 0.8, 0.1] },
        scale:   { list: [0.8, 1.4, 1.1, 0.9, 0.8] },
        rotate:  { list: [0, 12, -8, 6, 0] },
        x:       { list: [cx, cx + 22, cx - 16, cx + 10, cx] },
        y:       { list: [cy - 8, cy - 70, cy - 90, cy - 120, cy - 150] }
      }, 20);
    }
  }
});
```

---

## 5) Another `$$`: big heart, different motion

**What this shows:** Deferred addition of a new element using $$. `bigHeart$$` waits for `heart$$` to complete its animation, then adds a larger heart and runs its own animation.

  <img src="https://targetjs.io/img/likeButton8.gif" width="130" />

```javascript
import { App } from "targetj";

App({
  width: 220, height: 60, lineHeight: 60, textAlign: "center",
  borderRadius: 10, background: "#f5f5f5", cursor: "pointer", userSelect: "none",
  html: "♡ Like",

  onClick() {
    this.setTarget("scale",      { list: [1.2, 1] }, 12, 12);
    this.setTarget("background", { list: ["#ffe8ec", "#f5f5f5"] }, 12, 12);
    this.setTarget("html", "♥ Liked");
  },

  heart$$: {
    html: "♥", color: "crimson", fontSize: 20,
    fly() {
      const cx = this.getCenterX(), cy = this.getCenterY();
      this.setTarget({
        opacity: { list: [0, 1, 1, 0.8, 0.1] },
        scale:   { list: [0.8, 1.4, 1.1, 0.9, 0.8] },
        rotate:  { list: [0, 12, -8, 6, 0] },
        x:       { list: [cx, cx + 22, cx - 16, cx + 10, cx] },
        y:       { list: [cy - 8, cy - 70, cy - 90, cy - 120, cy - 150] }
      }, 20);
    }
  },
  bigHeart$$: {
    html: "♥", color: "blue", fontSize: 100,
    fly() {
      const cx = this.getCenterX(), cy = this.getCenterY();
      this.setTarget({
        opacity: { list: [0, 1, 1, 0.85, 0.6, 0.1] },
        scale:   { list: [0.4, 1.9, 1.2, 1.6, 1.0, 0.95] },
        rotate:  { list: [0, 4, -3, 4, -2, 0] },
        x:       { list: [cx, cx + 14, cx + 10, cx - 6, cx - 14, cx] },
        y:       { list: [cy, cy - 30, cy - 55, cy - 80, cy - 100, cy - 130] }
      }, 30);
    }
  }
});
```

---

## 6) `fetch$$`

**What this shows:** Networking is just another target. The POST happens **only after** all prior visual steps complete, since the target is postfixed with `$$`.

```javascript
App({
  // …same as step 5…

  fetch$$: { method: "POST", id: 123, url: "/api/like" }
});
```

---

## 7) Final version

**What this shows:** A Like button that consolidates the previous steps into a single component. After the POST completes, a cleanup `removeHearts$$` target runs to remove the two heart elements. The button also includes basic accessibility (role, tabIndex, and Enter to activate).

  <img src="https://targetjs.io/img/likeButton9.gif" width="130" />

```javascript
import { App } from "targetj";

App({
  likeButton: {
    width: 220, height: 60, lineHeight: 60, textAlign: "center",
    borderRadius: 10, background: "#f5f5f5", cursor: "pointer", userSelect: "none",
    role: "button", tabIndex: 0,
    html: "♡ Like",
    onClick() {
      this.setTarget("scale",      { list: [1.2, 1] }, 12, 12);
      this.setTarget("background", { list: ["#ffe8ec", "#f5f5f5"] }, 12, 12);
      this.setTarget("html", "♥ Liked");
    },
  
    heart$$: {
      html: "♥", color: "crimson", fontSize: 20,
      fly() {
        const cx = this.getCenterX(), cy = this.getCenterY();
        this.setTarget({
          opacity: { list: [0, 1, 1, 0.8, 0.1] },
          scale:   { list: [0.8, 1.4, 1.1, 0.9, 0.8] },
          rotate:  { list: [0, 12, -8, 6, 0] },
          x:       { list: [cx, cx + 22, cx - 16, cx + 10, cx] },
          y:       { list: [cy - 8, cy - 70, cy - 90, cy - 120, cy - 150] }
        }, 20);
      }
    },
  
    bigHeart$$: {
      html: "♥", color: "blue", fontSize: 100,
      fly() {
        const cx = this.getCenterX(), cy = this.getCenterY();
        this.setTarget({
          opacity: { list: [0, 1, 1, 0.85, 0.6, 0.1] },
          scale:   { list: [0.4, 1.9, 1.2, 1.6, 1.0, 0.95] },
          rotate:  { list: [0, 4, -3, 4, -2, 0] },
          x:       { list: [cx, cx + 14, cx + 10, cx - 6, cx - 14, cx] },
          y:       { list: [cy, cy - 30, cy - 55, cy - 80, cy - 100, cy - 130] }
        }, 30);
      }
    },  
    fetch$$: { method: "POST", id: 123, url: "/api/like" },
    removeHearts$$() { this.removeAll(); },
    onKey(e) { if (e.key === "Enter") this.activateTarget("onClick"); }
  }
});
```

Or in HTML (no JavaScript required), using tg- attributes that mirror object literal keys:

```html
  <div
    id="likeButton"
    tg-width="220"
    tg-height="60"
    tg-lineHeight="60"
    tg-textAlign="center"
    tg-borderRadius="10"
    tg-background="#f5f5f5"
    tg-cursor="pointer"
    tg-userSelect="none"
    tg-role="button"
    tg-html="♡ Like"
    tg-tabIndex="0"
    tg-onClick="function() {
      this.setTarget('scale', { list: [1.2, 1] }, 12, 12);
      this.setTarget('background', { list: ['#ffe8ec', '#f5f5f5'] }, 12, 12);
      this.setTarget('html', '♥ Liked');
    }"
    tg-heart$$="{ 
      html: '♥',
      color: 'crimson',
      fontSize: 20,
      fly() {
        const cx = this.getCenterX(), cy = this.getCenterY();
        this.setTarget({
          opacity: { list: [0, 1, 1, 0.8, 0.1] },
          scale:   { list: [0.8, 1.4, 1.1, 0.9, 0.8] },
          rotate:  { list: [0, 12, -8, 6, 0] },
          x:       { list: [cx, cx + 22, cx - 16, cx + 10, cx] },
          y:       { list: [cy - 8, cy - 70, cy - 90, cy - 120, cy - 150] }
        }, 20);
      }
    }"
    tg-bigHeart$$="{
      html: '♥',
      color: 'blue',
      fontSize: 100,
      fly() {
        const cx = this.getCenterX(), cy = this.getCenterY();
        this.setTarget({
          opacity: { list: [0, 1, 1, 0.85, 0.6, 0.1] },
          scale:   { list: [0.4, 1.9, 1.2, 1.6, 1.0, 0.95] },
          rotate:  { list: [0, 4, -3, 4, -2, 0] },
          x:       { list: [cx, cx + 14, cx + 10, cx - 6, cx - 14, cx] },
          y:       { list: [cy, cy - 30, cy - 55, cy - 80, cy - 100, cy - 130] }
        }, 30);
      }
    }"
    tg-fetch$$='{"method":"POST","id":123,"url":"/api/like"}'
    tg-removeHearts$$="function() { this.removeAll(); }"
    tg-onKey="function(e) { if (e.key === 'Enter') this.activateTarget('onClick'); }"  
  /></div>
```

---

## Final takeaway

- TargetJS treats time as a first-class concept. Instead of wiring callbacks and effects, you write a sequence of targets. 
$ reacts to the previous step; $$ defers until all prior steps finish. Animations, API calls, and child creation are all the same kind of thing: targets. 
So complex flows read top-to-bottom.
- Minimal plumbing yet full control to manage a flow of complex asynchronous operations.
  
## Table of Contents

1. [Targets: The Building Blocks of TargetJS](#targets-the-building-blocks-of-targetjs)
2. [Understanding TargetJS Syntax: Reactive Postfixes](#understanding-targetjs-syntax-reactive-postfixes)
3. [📦 Installation](#-installation)
6. [What Problems Does TargetJS Solve?](#what-problems-does-targetjs-solve)
11. More Examples:
    - [Loading Two Users Example](#loading-two-users-example)
    - [Infinite Loading and Scrolling Example](#infinite-loading-and-scrolling-example)
12. [Target Methods](#target-methods)
10. [Target Variables](#target-variables)
13. [Special Target Names](#special-target-names)
14. [How to Debug in TargetJS](#how-to-debug-in-targetjs)
15. [Documentation](#documentation)
16. [License](#license)
17. [Contact](#contact)
18. [💖 Support TargetJS](#-support-targetjs)

## Targets: The Building Blocks of TargetJS

Targets provide a unified interface for both class methods and fields. Each Target comes equipped with a built-in set of capabilities:

1. State Management: Targets are inherently stateful, enabling implicit state handling across your application.
2. Iterations: They can iterate towards defined values, making them perfect for creating animations.
3. Multiple or Conditional Execution: Targets can execute repeatedly or only under specific conditions.
4. Execution timing: Targets enable fine-grained control over when they execute.
5. Code-Ordered Execution: Targets execute sequentially and predictably in the order they are written within a JavaScript object, thanks to ES2015's guaranteed property order.

## Understanding TargetJS Syntax: Reactive Postfixes

TargetJS doesn't use `async/await` and rarely relies on traditional JavaScript constructs like loops or conditionals. Instead, it defines reactive behaviors using the `$` and `$$` postfixes on target names, unifying asynchronous operations such as API calls, animations, timers, and UI transitions. Although this convention may seem a bit cryptic at first, it offers a compact syntax.

**`$` Postfix (Immediate Reactivity):**

A target name ending with a single `$` (e.g., `height$`) indicates that this target will execute every time its immediately preceding target runs or emits a new value. If the preceding target involves an asynchronous operation like an API call, the reactive target activates when the response is received. If there are multiple API calls made, `$` postfix ensures that the target reacts to the first API result when it becomes available, then the second, and so on, maintaining a strict, code-ordered sequence of operations.

**`$$` Postfix (Full Completion Reactivity):**

A target name ending with a double `$$` (e.g., `fetch$$`) will activate only after its immediately preceding targets have fully and comprehensively completed all of their operations. This includes:

- The successful resolution of any timed sequences, such as animations.
- The completion and return of results from all associated API calls.
- The finalization of all tasks, animations, and API calls initiated by any dependent child targets that were themselves triggered by a preceding target.


## **📦 Installation**

**Via CDN**

Add the following `<script>` tag to your HTML to load TargetJS from a CDN (only 47KB compressed):

```html
<script src="https://unpkg.com/targetj@latest/dist/targetjs.js"></script>
```

This will add `TargetJS` to the global `window` object, making it accessible throughout your JavaScript such as `TargetJS.App(YourApp)`.
You can also use it directly in your HTML with custom attributes:

```html
<div
   tg-background="red"
   tg-width="[100, 50, 10]"
   tg-height="[100, 50, 10]">
</div>
```

**Via package manager**

Install TargetJS via npm (note: there's no "s" at the end):

```bash
npm install targetj
```

Then import it into your JavaScript code:

```javascript
import { App } from "targetj";
```

## What Problems Does TargetJS Solve?

TargetJS addresses several common pain points in front-end development:

1.  **Scattered State Management:** Many frameworks require separate libraries or complex patterns for state management. In TargetJS, state management is inherently handled throught its core concept of “targets” eliminating the need for explicit state management.
2.  **Complexity of Asynchronous Operations:**  Traditional JavaScript often involves complex handling of asynchronous operations (Promises, callbacks, `async/await`). TargetJS addresses this by providing a delactive reactive targets and synchronous execution flow.
3.  **Disjointed Development Workflow:**  Developers often juggle multiple tools and concepts (UI libraries, animation libraries, state managers, event handlers). TargetJS provides a unified solution.
4.  **Rigid Static Layer of HTML:** Many frameworks use HTML as the primary medium for generating the user interface. TargetJS makes JavaScript the primary driver, either by running directly or through a handful of HTML elements extended with superpowers.  
5.  **Boilerplate and Verbosity:** TargetJS aims to reduce boilerplate code. The code is compact and follows a predictable execution flow. Direct method calls are not allowed. Explicit loops and conditional statements are rarely needed.
6.  **Difficult Animation Control:**  TargetJS makes animations first-class citizens with fine-grained control.
7.  **Complicated execution flow:** TargetJS execution flow follows the order the code is written.
8.  **Performance Bottlenecks with Large Lists:** TargetJS optimizes rendering for large lists by using a tree structure that renders only the visible branches.
    
## More Examples

## Loading Five Users Example

In this example, we load five separate users and display five boxes, each containing a user's name and email.

- `fetch` calls five APIs to retrieve details for five users.
- `child` is a special target that adds a new item to the parent each time it executes. Because it ends with `$` in this example, it executes every time an API call returns a result.
- TargetJS ensures that API results are processed in the same sequence as the API calls. For example, if the user1 API result arrives before user0, `child` will not execute until the result for user0 has been received.

  <img src="https://targetjs.io/img/fetch-5-users.gif" width="130" />

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
        const user = this.prevTargetValue;
        return {
            width: 200,
            height: 65,
            borderRadius: 10,
            boxSizing: "border-box",
            padding: 10,
            fontSize: 14,
            background: "#f0f0f0",
            scale: [{ list: [0.8, 1] }, 14, 12],
            html$() {
              return `<div style="font-weight:600">${user.name}</div>
                <div style="opacity:.65">${user.email}</div>`;
            },
        };
    }
});
```

It can also be written using a target’s `cycles` and `intervals` properties/methods to fetch users at intervals instead of in a single batch. In this example, we set interval to 1000, making the API call once every second.

  <img src="https://targetjs.io/img/fetch-5-users2.gif" width="130" />


```javascript
App({
    gap: 10,
    fetch: {
        interval: 1000,
        cycles: 4,
        value(i) { return `https://targetjs.io/api/randomUser?id=user${i}`; }
    },
    child$() {   
        return {
          // …same as the previous example…
        };
    }
});
```

### Infinite Loading and Scrolling Example

In this advanced example, we demonstrate an infinite scrolling application where each item is animated, and upon completing its animation, it dynamically triggers an API call to fetch and display its details.

- children: `children` is a special target that adds several items to the container's children each time it is executed. The `onVisibleChildrenChange` event function detects changes in the visible children and activates the `children` target to add new items that fill the gaps.  

- loadItems: Since the target name ends with `$$`, it executes only after the newly created children finish their animations. It then iterates over all visible children and fetches their details. The result is an array of users. TargetJS ensures that this array preserves the order in which the API calls were made, not the order in which responses were received.

- populate: Since the target name ends with `$$`, it executes only after all API calls have completed. It updates the content of each scrollable item with the name returned by the API.

TargetJS employs a tree-like structure to track visible branches, optimizing the scroller performance.

We use the TModel class instead of a plain object to demonstrate how it can provide additional functionality and control. A plain object would also have worked in this example.

  <img src="https://targetjs.io/img/infiniteScrolling.gif" width="130" />

```javascript
import { App, TModel, getEvents, fetch, getScreenWidth, getScreenHeight } from "targetj";

App(new TModel("scroller", {
    domHolder: true,
    preventDefault: true,
    containerOverflowMode: "always",
    children() {  
        const childrenCount = this.getChildren().length;  
        return Array.from({ length: 20 }, (_, i) => ({
            width: [{list: [100, 250, 100]}, 50],
            x$() { return this.getCenterX(); },
            background: [{list: ["#FCE961", "#B388FF"]}, 15, 15],
            height: 48,
            color: "#C2FC61",
            textAlign: "center",
            lineHeight: 48,
            bottomMargin: 2,
            html: childrenCount + i,
            validateVisibilityInParent: true
        }));
    },
    loadItems$$() {
        this.visibleChildren.filter(child => !child.loaded).forEach(child => {
            child.loaded = true;
            fetch(this, `https://targetjs.io/api/randomUser?id=${child.oid}`);
        });
    },
    populate$$() {
        if (this.prevTargetValue) {
            this.prevTargetValue.forEach(data => this.getChildByOid(data.id).setTarget('html', data.name));
        }
    },
    onScroll() {
        this.setTarget("scrollTop", Math.max(0, this.getScrollTop() + getEvents().deltaY()));
    },
    onVisibleChildrenChange() {
       return !this.visibleChildren.length || this.getLastChild().getY() < this.getHeight() ? 'children' : 'loadItems$$';
    },
    width: getScreenWidth,
    height: getScreenHeight,
    onResize: 'width'
}));
```

We can reduce the number of API calls by triggering them only after scrolling stops as follows:

```javascript
    loadItems$$: {
        value() {
            this.visibleChildren.filter(child => !child.loaded).forEach(child => {
                child.loaded = true;
                fetch(this, `https://targetjs.io/api/randomUser?id=${child.oid}`);
            });
        },
        enabledOn() {
            return getEvents().deltaY() === 0;
        }
    }
```

Finally, in HTML:

```HTML
 <div
      id="scroller"
      tg-domHolder="true"
      tg-preventDefault="true"
      tg-containerOverflowMode="always"
      tg-width="return TargetJS.getScreenWidth();"
      tg-height="return TargetJS.getScreenHeight();"
      tg-children="function() {
        const childrenCount = this.getChildren().length;
        return Array.from({ length: 20 }, (_, i) => ({
          width: [{list: [100, 250, 100]}, 50],
          x$() { return this.getCenterX(); },
          background: [{ list: ['#FCE961', '#B388FF'] }, 15, 15],
          height: 48,
          color: '#C2FC61',
          textAlign: 'center',
          lineHeight: 48,
          bottomMargin: 2,
          html: childrenCount + i
        }));
      }"
      tg-load$$="function() {
        this.visibleChildren.filter(child => !child.loaded).forEach(child => {
            child.loaded = true;
            TargetJS.fetch(this, `https://targetjs.io/api/randomUser?id=${child.oid}`);
        });
      }"
      tg-populate$$="function() {
        if (this.prevTargetValue) {
            this.prevTargetValue.forEach(data => this.getChildByOid(data.id).setTarget('html', data.name));
        }
      }"
      tg-onScroll="function() {
        this.setTarget('scrollTop', Math.max(0, this.getScrollTop() + TargetJS.getEvents().deltaY()));
      }"
      tg-onVisibleChildrenChange="function() {
        return !this.visibleChildren.length || this.getLastChild().getY() < this.getHeight() ? 'children' : 'load$$';
      }"
></div>
```

## Target Methods

All methods and properties are optional, but they play integral roles in making targets useful for animation, API loading, event handling, and more:

1. **value**
If defined, value is the primary target method that will be executed. The target value will be calculated based on the result of this method.

2. **Prefix `_` to the target name**
It indicates that the target is in an inactive state and must be activated by an event or other targets.

3. **active**
This is only a property. It indicates whether the target is ready for execution. When set to false, it behaves similarly to a `_ `prefix. By default, all targets are active, so setting it to true is unnecessary.

15. **Postfix `$` to the target name**
A target name ending with $ indicates that it will be only activated when the preceding target is executed. If the preceding target involves API calls, it will be activated
each time an API response is received, while ensuring the order of API calls is enforced. This means it will remain inactive until the first API result is received,
then the second, and so on.
  
17. **Postfix `$$` to the target name**
A target name ending with `$$` indicates indicates that it will be activated only after the preceding target has completed, along with all its imperative targets,
and after all API results have been received.

2. **enabledOn**
Determines whether the target is eligible for execution. If enabledOn() returns false, the target remains active until it is enabled and gets executed.

3. **loop**
Controls the repetition of target execution. If loop() returns true, the target will continue to execute indefinitely. It can also be defined as a boolean instead of a method.

4. **cycles**
It works similarly to `loop`, but it specifies an explicit number of repetitions. It can also be combined with `loop`, in which case, once the specified cycles complete, they will rerun as long as `loop` returns true.

6. **interval**
It specifies the pause between each target execution or each actual value update when steps are defined.

7. **steps**
By default, the actual value is updated immediately after the target value. The steps option allows the actual value to be updated in iterations specified by the number of steps.

8. **easing**
An easing function that operates when steps are defined. It controls how the actual value is updated in relation to the steps.

9. **onValueChange**
This callback is triggered whenever there is a change returned by the target method, which is called value().

10. **onStepsEnd**
This method is invoked only after the final step of updating the actual value is completed, assuming the target has a defined steps value.

11. **onImperativeStep**
This callback tracks the progress of imperative targets defined within a declarative target. If there are multiple imperative targets, this method is called at each step,
identifiable by their target name. You can also use `on${targetName}Step` to track individual targets with their own callbacks. For example, `onWidthStep()` is called on each update of the `width` target.

13. **onImperativeEnd**
Similar to `onImperativeStep`, but it is triggered when an imperative target completes. If multiple targets are expected to complete, you can use `on${targetName}End` instead. For example, `onWidthEnd` is called when the `width` target gets completed.

13. **initialValue**
This is only property. It defines the initial value of the actual value.
   
18. **onSuccess**
An optional callback for targets that make API calls. It will be invoked for each API response received.

19. **onError**
Similar to the `onSuccess` but it will be invoked on every error.

## Target Variables
In all the target methods above, you can access the following variables:

1. **this.prevTargetValue**  
It holds the value of the preceding target. If the preceding target involves API calls, a single $ postfix means it will hold one API result at a time, as the target is
activated with each API response. If the target is postfixed with $$, it will have the results as an array, ordered by the sequence of API calls rather than the order in
which the responses are received.

2. **this.isPrevTargetUpdated()**
It returns `true` if the previous target has been updated. This method is useful when a target is activated externally, such as by a user event, rather than by the preceding target.

3. **this.key**
Represents the name of the current target.

4. **this.value**
Represents the current value of the target.


## Special Target Names

All HTML style names and attributes are treated as special target names. The most commonly used style names and attributes have already been added to the framework, with the possibility of adding more in the future.

Examples:
- `width`, `height`: Set the dimensions of the object.
- `opacity`, `scale`, `rotate`: Adjust the opacity, scale, and rotation of the object.
- `zIndex`: Sets the z-order of the object.

In addition to styles and attribute names, we have the following special names:

1. **html**: Sets the content of the object, interpreted as text by default.
2. **children**: Adds new items to the parent each time it executes. Items can be either plain objects or instances of TModel for greater control.
4. **css**: A string that sets the CSS of the object.
5. **element**: Sets the HTML tag of the object, defaulting to `div`.
6. **shouldBeBracketed**: A boolean flag that, when set to true (the default), enables the creation of an optimization tree for a container with more items than the `bracketThreshold` (another target with a default value of 10). This optimization ensures only the visible branch receives updates and get executed.
7. **x** and **y**: Sets the location of the object.
8. **scrollLeft** and **scrollTop**: Control the scrolling position of the object.
9. **leftMargin**, **rightMargin**, **topMargin**, **bottomMargin**: Set margins between objects.
10. **domHolder**: When set to true, indicates that the current object serves as the DOM holder for all of its descendant objects. It can also return a DOM element, in which case the current object and all descendants will be contained within that DOM element.
11. **domParent**: Set by the container or children to control which DOM container they are embedded in.
12. **isVisible**: An optional target to explicitly control the visibility of the object, bypassing TargetJS’s automatic calculation.
13. **canHaveDom**: A boolean flag that determines if the object can have a DOM element on the page.
14. **canDeleteDom**:  When set to true (the default), indicates that the object's DOM element will be removed when the object becomes invisible.
16. **widthFromDom** and **heightFromDom**: Boolean flags to explicilty control if the width and height should be derived from the DOM element.
17. **textOnly**: A boolean flag that specifies the content type as either text or HTML. The default value is false, indicating text.
18. **isInFlow**: A boolean flag that determines if the object will contribute to the content height and width of its parent.
19. **style**: An object to set the HTML style of the object, especially for style names that aren’t built-in.


Lastly, we have the event targets which their values can be an array of targets to activate on specific events or may implement the event handler directly.

**Example with Target Array:**
```javascript
onResize: [ 'width', 'height' ]  // Activates declarative 'width' and 'height' targets on screen resize.
```

**Example with Event handler:**
```javascript
onResize() { 
    this.setTarget('width', getScreenWidth());
    this.setTarget('height', getScreenHeight());
}
```

Here are all the event targets:
1. **onResize**: Triggered on screen resize events.
2. **onParentResize**: Activated when the parent’s width or height is updated.
3. **onFocus**: Triggered on focus events.
4. **onBlur**: Triggered on blur events.
5. **onClick**: Activated on click events.
6. **onTouchStart**: Called when `touchstart` or `mousedown` events occur.
7. **onTouch**: Generic handler for all touch events.
8. **onTouchEnd**: Called when `touchend` or `mouseup` events occur.
9. **onSwipe**: Activated on swipe events.
10. **onEnter**: Triggered when the mouse cursor enters the object’s DOM.
11. **onLeave**: Triggered when the mouse cursor leaves the object’s DOM.
12. **onScrollTop**: Called on top scroll events.
13. **onScrollLeft**: Called on left scroll events.
14. **onScroll**: Called on both scroll events.
15. **onWindowScroll**: Called on window scroll events.
16. **onKey**: Triggered by key events.
17. **onVisible**: Activated when the object becomes visible.
18. **onChildrenChange**: Triggered when the children count changes.
19. **onVisibleChildrenChange**: Triggered when the count of visible children changes.
20. **onDomEvent**: It accepts an array of targets and activates them when their associated object acquires a DOM element.

## How to Debug in TargetJS

TargetJS provides built-in debugging tools:

```bash
TargetJS.tApp.stop(); //Stops the application.
TargetJS.tApp.start(); //Restarts the application
TargetJS.tApp.throttle; //Slows down execution (in ms)
TargetJS.tApp.debugLevel = 1; // Logs cycle execution
```
- Use `t()` in the browser console to find an object by its oid.
- Use `t(oid).bug()` to inspect all the vital properities.
- Use `t(oid).logTree()` to inspect the UI structure.

## Documentation
Explore the potential of TargetJS and dive into our interactive documentation at www.targetjs.io.

## License
Distributed under the MIT License. See LICENSE for more information.

## Contact
Ahmad Wasfi - wasfi2@gmail.com

## 💖 Support TargetJS
- ⭐ Star this repo on GitHub to show your support!
- 🐛 Report issues & suggest features.
- 📢 Share TargetJS with your network.
