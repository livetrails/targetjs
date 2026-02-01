# TargetJS: JavaScript UI Framework for Simplified Development and Enhanced User Experience

**[targetjs.io](https://targetjs.io)** 
[![MIT LICENSE](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/livetrails/targetjs/blob/main/LICENSE) 
[![Stars](https://img.shields.io/github/stars/livetrails/targetjs.svg)](https://github.com/livetrails/targetjs/stargazers)
[![npm version](https://img.shields.io/npm/v/targetj.svg)](https://www.npmjs.com/package/targetj)

TargetJS is a modern JavaScript UI framework that simplifies front-end development with a code-ordered reactivity model and an ultra compact syntax. It provides a unified solution for key aspects like UI rendering, animations, APIs, state management, and event handling.
It can be used as a full-featured framework or as a lightweight library alongside other frameworks. It is also a highly performant web framework, as shown in the [framework benchmark](https://krausest.github.io/js-framework-benchmark/current.html).

## The Philosophy Behind TargetJS

Frameworks often promise simplicity, but frequently require extensive boilerplate and libraries as they inherit the same software approach rooted in early programming models and try to force it to fit UI development by adding more complexity. User interfaces are dynamic and asynchronous and require a different paradigm.

TargetJS adopts a new approach. First, it unifies class methods and fields into a single construct called targets. Each target is given state, lifecycles, timing, iterations, and the autonomy to execute mimicking the behavior of living cells. Targets are essentially self-contained, intelligent blocks of code.

The second challenge is making these targets fit and work together especially since UI operations are highly asynchronous. Instead of relying on traditional method calls and callbacks that don't address asynchronous nature well, TargetJS allows targets to react to the execution or completion of preceding targets. A subsequent target can run independently, execute whenever the previous one does, or wait until the previous target completes. Targets stack together like Lego pieces. It can address complex asynchronous workflow while remaining easy to understand.

For example, setting a value can implicitly define an animation, where the current value iteratively progresses until it reaches the new value. When the animation completes, the next target might initiate a fetch API call. Once the data is received, it can trigger another target that creates 10 new elements, each with its own animation and API call. A subsequent target can then be set to run only after all 10 elements have completed their tasks. Targets simply react and chain together based on how the code is written.

Furthermore, TargetJS adopts a Rebol-like style to make the code more compact.

## Key Innovations and Concepts

1.  Reactive targets: A new construct called “targets” unifies class methods and fields. Targets are self-contained units of code with their own state, lifecycles, and timing. They are designed to execute themselves or react dynamically to the run or completion of preceding targets. This enables the declarative programming of complex asynchronous flows without explicit callbacks.
2. All-in-One solution: Offers a unified approach to UI rendering, API integration, state management, event handling, and animation.
3. Code-ordered execution, Rebol-like style: less code and more readable code.

---

## Examples: Like Button → Animated Like with 4 Async Ops (in 7 Steps)

The example demonstrates how to run four asynchronous operations in a strict sequential sequence, where each step waits for the previous ones to complete. Any restart or delay in an operation delays the ones that follow. This is to showcase managing async operations rather than focusing on the user experience. We will show the example in 7 steps.

### 1) Like button (view only)

**What this shows:** One object defines a UI element without separate HTML/CSS. Static targets map directly to DOM styles/attributes. You can still use CSS if wanted.

  <img src="https://targetjs.io/img/likeButton.png" width="130" />

```javascript
import { App } from "targetj";

App({
  width: 220,
  height: 60,
  lineHeight: 60,
  textAlign: "center",
  borderRadius: 10,
  backgroundColor: "#f5f5f5",
  html: "♡ Like"
});
```

---


### 2) Animation

**What this shows:** A mount-time animation that scales and changes the `backgroundColor` over 12 steps, with 12ms pauses between steps. Targets without (`$`, `$$`, `_`) execute immediately in the order they are defined.

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
  scale: { value: [1.2, 1], steps: 12, interval: 12 },
  backgroundColor: { value: ["#ffe8ec", "#f5f5f5"], steps: 12, interval: 12 }
});
```

### 3) Click → animation (imperative `setTarget`)

**What this shows:** Clicking plays the animations from the previous step using imperative `setTarget`.

  <img src="https://targetjs.io/img/likeButton4.gif" width="130" />

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
  }
});
```

---

### 4) Sequencing with `$$`: Adding a small heart after click animation (first async op)

**What this shows:** A `$$` target (deferred) runs only after all prior targets finish (including `onClick()` and its animations). Here it adds a new heart element and runs its fly motion only once the click sequence has completed. Repeated clicks will delay adding the heart.

  <img src="https://targetjs.io/img/likeButton7.gif" width="130" />

```javascript
import { App } from "targetj";

App({
  width: 220, height: 60, lineHeight: 60, textAlign: "center",
  borderRadius: 10, backgroundColor: "#f5f5f5", cursor: "pointer", userSelect: "none",
  html: "♡ Like",
  onClick() {
    this.setTarget('scale', { value: [1.2, 1], steps: 8, interval: 12 });
    this.setTarget('backgroundColor', { value: [ '#ffe8ec', '#f5f5f5' ], steps: 12, interval: 12 });
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

### 5) Another `$$`: Adding a big heart (second async op)

**What this shows:** Deferred addition of a new element using $$. `bigHeart$$` waits for `heart$$` and the click sequence to complete their animation, then adds a larger heart and runs its own happy animation.

  <img src="https://targetjs.io/img/likeButton8.gif" width="130" />

```javascript
import { App } from "targetj";

App({
  width: 220, height: 60, lineHeight: 60, textAlign: "center",
  borderRadius: 10, backgroundColor: "#f5f5f5", cursor: "pointer", userSelect: "none",
  html: "♡ Like",

  onClick() {
    this.setTarget('scale', { value: [1.2, 1], steps: 8, interval: 12 });
    this.setTarget('backgroundColor', { value: [ '#ffe8ec', '#f5f5f5' ], steps: 12, interval: 12 });
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
    happyFly() {
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

### 6) `fetch$$` (third async op)

**What this shows:** Networking is just another target. The POST happens **only after** all prior visual steps complete, since the target is postfixed with `$$`. Similarly, repeated clicks delay `fetch$$`.

```javascript
App({
  // …same as step 5…

  fetch$$: { method: "POST", id: 123, url: "/api/like" }
});
```

---

### 7) Final version

**What this shows:** A Like button that consolidates the previous steps into a single component. After the POST completes, a cleanup `removeHearts$$` target (fourth  async op) runs to remove the two heart elements. The button also includes basic accessibility (role, tabIndex, and Enter to activate). Demo: [Like button](https://targetj.io/examples/quick.html).

  <img src="https://targetjs.io/img/likeButton9.gif" width="130" />

```javascript
import { App } from "targetj";

App({
  likeButton: {
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
      happyFly() {
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
    removeHearts$$() { this.removeChildren(); },
    onKey(e) { if (e.key === "Enter") this.activateTarget("onClick"); }
  }
});
```
---

### Final takeaway

- Instead of wiring callbacks and effects, you write a sequence of targets. `$$` defers until all prior steps finish. Animations, API calls, and child creation are all the same kind of thing: targets.
- Minimal plumbing yet full control to manage a flow of complex asynchronous operations.
  
## Table of Contents

1. [Targets: The Building Blocks of TargetJS](#targets-the-building-blocks-of-targetjs)
1. [Understanding TargetJS Syntax: Reactive Postfixes](#understanding-targetjs-syntax-reactive-postfixes)
1. [📦 Installation](#-installation)
1. [What Problems Does TargetJS Solve?](#what-problems-does-targetjs-solve)
1. More Examples:
    - [Loading Five Users Example](#loading-two-users-example)
    - [Infinite Loading and Scrolling Example](#infinite-loading-and-scrolling-example)
1. [Target Methods](#target-methods)
1. [Target Variables](#target-variables)
1. [Special Target Names](#special-target-names)
1. [How to Debug in TargetJS](#how-to-debug-in-targetjs)
1. [Documentation](#documentation)
1. [License](#license)
1. [Contact](#contact)
1. [💖 Support TargetJS](#-support-targetjs)

## Targets: The Building Blocks of TargetJS

Targets provide a unified interface for both class methods and fields. Each Target comes equipped with a built-in set of capabilities:

1. State Management: Targets are inherently stateful, enabling implicit state handling across your application.
2. Iterations: They can iterate towards defined values, making them perfect for creating animations.
3. Multiple or Conditional Execution: Targets can execute repeatedly or only under specific conditions.
4. Execution timing: Targets enable fine-grained control over when they execute.
5. Code-Ordered Execution: Targets execute sequentially and predictably in the order they are written within a JavaScript object, thanks to ES2015's guaranteed property order.

## Understanding TargetJS Syntax: Reactive Postfixes

TargetJS defines reactive behaviors using the `$` and `$$` postfixes on target names, unifying asynchronous operations such as API calls, animations, timers, and UI transitions. Although this convention may seem a bit cryptic at first, it offers a compact syntax.

**`$` Postfix (Immediate Reactivity):**

A target name ending with a single `$` (e.g., `height$`) indicates that this target will execute every time its immediately preceding target runs or emits a new value. If the preceding target involves an asynchronous operation like an API call, the reactive target activates when the response is received. If there are multiple API calls made, `$` postfix ensures that the target reacts to the first API result when it becomes available, then the second, and so on, maintaining a strict, code-ordered sequence of operations.

**`$$` Postfix (Deferred Reactivity):**

A target name ending with a double `$$` (e.g., `fetch$$`) will activate only after all the preceding targets have fully and comprehensively completed all of their operations. This includes:

- The successful resolution of any timed sequences, such as animations.
- The completion and return of results from all associated API calls.
- The finalization of all tasks, animations, and API calls initiated by any dependent child targets that were themselves triggered by a preceding target.

---

## **📦 Installation**

**Via package manager**

Install TargetJS via npm (note: there's no "s" at the end):

```bash
npm install targetj
```

Then import it into your JavaScript code:

```javascript
import { App } from "targetj";
```

**Via CDN**

Add the following `<script>` tag to your HTML to load TargetJS from a CDN (66KB gzipped):

```html
<script src="https://unpkg.com/targetj@latest/dist/targetjs.js"></script>
```

This exposes `TargetJS` on `window`, so you can initialize your app with `TargetJS.App(...)`. Make sure your code runs after the TargetJS script and the DOM are ready (use defer, place your script below it, or wait for `DOMContentLoaded`).

You can also use it without `App` by mounting a `TModel` object to an HTML element, for example:

```html
<div id='redbox'></div>

<script>
    new TargetJS.TModel({
        backgroundColor: 'red',
        width: { value: [100, 250, 100], steps: 20 },
        height: { value: [100, 250, 100], steps: 20 }
    }).mount('#redbox');
</script>
```
Or, directly in your HTML with `tg-` attributes:

```html
<div
   tg-background="red"
   tg-width="{ value: [100, 250, 100], steps: 20 }"
   tg-height="{ value: [100, 250, 100], steps: 20 }">
</div>
```

---

## What Problems Does TargetJS Solve?

TargetJS addresses several common pain points in front-end development:

1.  **Scattered State Management:** Many frameworks require separate libraries or complex patterns for state management. In TargetJS, state management is inherently handled through its core concept of “targets”.
2.  **Complexity of Asynchronous Operations:**  Traditional JavaScript often involves complex handling of asynchronous operations (Promises, callbacks, `async/await`). TargetJS addresses this by providing a declarative reactive targets and synchronous execution flow.
3.  **Disjointed Development Workflow:**  Developers often juggle multiple tools and concepts (UI libraries, animation libraries, event handlers). TargetJS provides a unified solution.
4.  **Rigid Static Layer of HTML:** Many frameworks use HTML as the primary medium for generating the user interface. TargetJS makes JavaScript the primary driver.  
5.  **Boilerplate and Verbosity:** TargetJS aims to reduce boilerplate code. The code is compact and follows a predictable execution flow.
6.  **Difficult Animation Control:**  TargetJS makes animations first-class citizens with fine-grained control.
8.  **Performance Bottlenecks with Large Lists:** TargetJS optimizes rendering for large lists by using a tree structure that renders only the visible branches.

---

## More Examples

### Loading Five Users Example

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
          backgroundColor: "#f0f0f0",
          scale: { values: [0.8, 1], steps: 14, interval: 12 },
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
});
```

It can also be written using a target’s `cycles` and `interval` properties/methods to fetch users at intervals instead of in a single batch. In this example, we set interval to 1000, making the API call once every second.

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

In this advanced example, we implement an infinite-scrolling application.

**Explanation:**

* `addChildren` is a special target that adds multiple items to the container’s children each time it executes. The `onVisibleChildrenChange` event detects changes in the visible children and activates `addChildren` to insert new items and fill any gaps.

* `photo` and `userName` each add a `div` element inside every item, serving as placeholders for the photo and user name.

* `pause$$` delays the execution of all targets that follow it by 100 ms.

* `fetch$$` retrieves the user’s details.

* `reveal$$` executes after `fetch$$`, revealing the user name and populating the photo with a random color.

* `wave$$` executes only after all preceding children have completed their targets, giving each user item a coordinated animation.

TargetJS employs a tree-like structure to track visible branches, optimizing scroller performance.


  <img src="https://targetjs.io/img/infiniteScrolling20.gif" width="130" />

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
      validateVisibilityInParent: true,
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
    cycles() { return this.visibleChildren.length - 1; },
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
});
```
---

## Target Methods

All methods and properties are optional, but they play integral roles in making targets useful for animation, API loading, event handling, and more:

1. **value**
If defined, value is the primary target method that will be executed. The target value will be calculated based on the result of this method.
`Value` can also be defined as a property.

1. **Postfix `$` to the target name** (Reactive): 
A target name ending with $ indicates that it will be only activated when the preceding target is executed. If the preceding target involves API calls, it will be activated
each time an API response is received, while ensuring the order of API calls is enforced. This means it will remain inactive until the first API result is received,
then the second, and so on.
  
1. **Postfix `$$` to the target name** (Deferred): 
A target name ending with `$$` indicates that it will be activated only after all the preceding targets have completed, along with all its imperative targets,
and after all API results have been received.

1. **Prefix `_` to the target name** (Inactive): 
It indicates that the target is in an inactive state and must be activated by an event or other targets explicitly.

1. **onComplete**
It gets executed when the target and all proceeding targets fully complete their execution. It is equivalent to `$$`, but is executed from the same target.

1. **enabledOn**
Determines whether the target is eligible for execution. If enabledOn() returns false, the target remains active until it is enabled and gets executed.

1. **loop**
Controls the repetition of target execution. If loop() returns true, the target will continue to execute indefinitely. It can also be defined as a boolean instead of a method.

1. **cycles**
It works similarly to `loop`, but it specifies an explicit number of repetitions. It can also be combined with `loop`, in which case, once the specified cycles complete, they will rerun as long as `loop` returns true. In other words, `loop` functions as an outer loop for `cycles`.

1. **interval**
It specifies the pause between each target execution or each actual value update when steps are defined.

1. **steps**
By default, the actual value is updated immediately after the target value. The steps option allows the actual value to be updated in iterations specified by the number of steps.

1. **easing**
A string that defines a predefined easing function that controls how the actual value is updated in relation to the steps.

1. **onValueChange**
This callback is triggered whenever there is a change returned by the target method/property `value`.

1. **onStepsEnd**
This method is invoked only after the final step of updating the actual value is completed, assuming the target has a defined steps value.

1. **onImperativeStep**
This callback tracks the progress of imperative targets defined within a declarative target. If there are multiple imperative targets, this method is called at each step,
identifiable by their target name. You can also use `on${targetName}Step` to track individual targets with their own callbacks. For example, `onWidthStep()` is called on each update of the `width` target.

1. **onImperativeEnd**
Similar to `onImperativeStep`, but it is triggered when an imperative target completes. If multiple targets are expected to complete, you can use `on${targetName}End` instead. For example, `onWidthEnd` is called when the `width` target gets completed.

1. **initialValue**
This is only a property. It defines the initial value of the actual value.

1. **active**
This is only a property. It indicates whether the target is ready for execution. When set to false, it behaves similarly to a `_` prefix. By default, all targets are active, so setting it to true is unnecessary.
   
1. **onSuccess**
An optional callback for targets that make API calls. It will be invoked for each API response received.

1. **onError**
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
3. **Child**: Similar to `children` but adds only one item.
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
