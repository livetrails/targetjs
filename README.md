# TargetJS: A Novel JavaScript UI Framework for Simplified Development and Enhanced User Experience

**[targetjs.io](https://targetjs.io)** 
[![MIT LICENSE](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/livetrails/targetjs/blob/main/LICENSE) 
[![Stars](https://img.shields.io/github/stars/livetrails/targetjs.svg)](https://github.com/livetrails/targetjs/stargazers)
[![npm version](https://img.shields.io/npm/v/targetj.svg)](https://www.npmjs.com/package/targetj)

TargetJS is a modern JavaScript UI framework that simplifies front-end development. It introduces a unique paradigm: leveraging literal objects or HTML elements and extending their capabilities with built-in lifecycles and functional pipelines. The framework provides a unified solution for key aspects like UI rendering, animations, API interactions, state management, and event handling. This integrated approach leads to more compact code and allows for a stronger focus on user experience. TargetJS also supports backend generation of its specific HTML elements. 
Furthermore, it is also a highly performant web framework, as shown in the [framework benchmark](https://krausest.github.io/js-framework-benchmark/current.html).
## What Problems Does TargetJS Solve?

TargetJS addresses several common pain points in front-end development:

1.  **Complexity of Asynchronous Operations:**  Traditional JavaScript often involves complex handling of asynchronous operations (Promises, callbacks, `async/await`). TargetJS addresses this by providing a structured, synchronous, and predictable execution flow, allowing developers to avoid asynchronous operations altogether.
2.  **Scattered State Management:** Many frameworks require separate libraries or complex patterns for state management. In TargetJS, state management is inherently handled through its core concept of Targets, eliminating the need for direct state management.
3.  **Boilerplate and Verbosity:** TargetJS aims to reduce boilerplate code. The code is compact and follows a predictable execution flow. Method calls are not allowed, and loops and conditional statements are rarely needed.
4.  **Rigid Static Layer of HTML:** Many frameworks use HTML as the primary medium for generating the user interface. TargetJS makes JavaScript the primary driver, either by running directly or through a handful of HTML elements with superpowers.
5.  **Disjointed Development Workflow:**  Developers often juggle multiple tools and concepts (UI libraries, animation libraries, state managers, event handlers). TargetJS provides a *unified* solution, simplifying the learning curve and development process.
6.  **Difficult Animation Control:**  TargetJS makes animations first-class citizens. It also provides fine-grained control without requiring external libraries.
7.  **Complicated execution flow:** Other frameworks are based on reactive model which often lead to unpredictable execution flow while TargetJS execution is based on the order targets are written.
8.  **Performance Bottlenecks with Large Lists:** TargetJS optimizes rendering for large lists by using a tree structure that renders only the visible branches.

## Examples
### Quick Example: Growing and Shrinking Box

💡 What's happening here?
- Targets run initially in the order they appear in the code, so `background` runs first, followed by `width`. The `_` prefix indicates that a target is inactive by default, meaning `height` does not run initially.
- `background` sets the background to purple, and its lifecycle ends.
- `width` animates from 100 → 250 → 100px, in 50 steps with 10ms pauses.
- `height` follows `width` and scales dynamically with its value. The `$` postfix creates a functional pipeline where the target is triggered each time the preceding target runs. `prevTargetValue` refers to the previous target's value, which in this case is `width`.

![first example](https://targetjs.io/img/quick1_3.gif)

```bash
import { App } from "targetj";

App({
    background: "mediumpurple",
    width: [{ list: [100, 250, 100] }, 50, 10], //  width animates through 100 → 250 → 100, over 50 steps, 10ms interval
    _height$() { // `$` creates a reactive pipeline: the `height` updates each time `width` executes
      return this.prevTargetValue / 2;
    } 
});
```

Or in HTML (no JavaScript required), using tg- attributes that mirror object literal keys:
   
```html 
<div
   tg-background="mediumpurple"
   tg-width="[{ list: [100, 250, 100] }, 50, 10]"
   tg-height$="return this.prevTargetValue / 2;">
</div>
``` 

### Simple Loading API Example

In this example, we load one user and display its name.

- `fetch` is a special target that performs a data fetch when given a URL string. For more complex API requests, you can use the framework’s built-in `fetch()` function. See examples below.
- `html` sets the text content of the div to the user's name. Since the target name is prefixed with `_` and ends with `$`, it executes only when an API call returns a result. `prevTargetValue` refers to the result of the previous target, which, in this case, is the result of the API call.

![first example](https://targetjs.io/img/quick2_4.gif)

```bash
import { App } from "targetj";

App({
  fetch: "https://targetjs.io/api/randomUser?id=user0",
  _html$() {
    return this.prevTargetValue.name;
  }
});
```

Or in HTML:

```html 
<div
   tg-fetch="https://targetjs.io/api/randomUser?id=user0"
   tg-html$="return this.prevTargetValue?.name;">
</div>
``` 

### Loading Two Users Example

In this example, we load two separate users and display two purple boxes, each containing a user's name, based on our first example.

- `fetch` calls two APIs to retrieve details for two users.
- `children` is a special target that adds new items to the parent each time it executes. Since the target name is prefixed with _, it is inactive by default. Because it ends with $, it executes every time an API call returns a result.
TargetJS ensures that API results are processed in the same sequence as the API calls. For example, if the user1 API result arrives before user0, `children` will not execute until the result for user0 has been received.
  
![first example](https://targetjs.io/img/quick3_1.gif)

```bash
import { App, fetch } from "targetj";

App({
    fetch: ['https://targetjs.io/api/randomUser?id=user0', 'https://targetjs.io/api/randomUser?id=user1'],
    _children$() {
      return {
        background: "mediumpurple",
        html: this.prevTargetValue.name,
        width: [{ list: [100, 250, 100] }, 50, 10],
        _height$() { return this.prevTargetValue / 2; },
      };
    }
});
```
Or in HTML:

```html 
    <div tg-fetch="['https://targetjs.io/api/randomUser?id=user0',
         'https://targetjs.io/api/randomUser?id=user1']">
      <div
        tg-background="mediumpurple"
        tg-width="[{ list: [100, 250, 100] }, 50, 10]"
        tg-height$="return this.prevTargetValue / 2;"
        tg-html="return this.getParentValueAtMyIndex('fetch')?.name;">
      </div>
    </div>
``` 

## Table of Contents

1. [Installation](#installation)
2. [Key Features and Concepts](#key-features-and-concepts)
6. [Comparison with Other UI Frameworks](#comparison-with-other-ui-frameworks)
7. [The Core of TargetJS](#the-core-of-targetjs)
8. [Anatomy of a Target](#anatomy-of-a-target)
9. [Target Methods](#target-methods)
10. [Target Variables](#target-variables)
11. More Examples:
    - [Basic Example](#basic-example)
    - [Declarative and Imperative Targets Example](#declarative-and-imperative-targets-example)
    - [Infinite Loading and Scrolling Example](#infinite-loading-and-scrolling-example)
    - [Simple SPA Example](#simple-spa-example)
    - [Using TargetJS as a Library Example](#using-targetjs-as-a-library-example) 
12. [Special Target Names](#special-target-names)
13. [How to Debug in TargetJS](#how-to-debug-in-targetjs)
14. [Documentation](#documentation)
15. [License](#license)
16. [Contact](#contact)
17. [Call to Action](#call-to-action)

## **📦 Installation**

Install TargetJS via npm (note that there is no 's' at the end):

```bash
npm install targetj
```

## Key Features and Concepts

*   **Targets:** The fundamental building blocks of TargetJS. Targets provide a unified interface for properties and methods with built-in lifecycles. They can:
    *   Iterate towards values (useful for animations and transitions).
    *   Execute conditionally.
    *   Manage repeated executions.
    *   Control execution timing (useful for UI operations and advanced animations).
    *   Form synchronous execution pipelines (similar to assembling Lego).
    *   Track the execution progress of other targets.
    *   Declarative execution (execution follows the way the code is written).
    *   Compact code (No unnecessary function calls, minimal if statements and loops).
    *   Manage their own state.

*   **Unified Approach:**  Targets handle UI updates, API calls, animations, state, and events, reducing the need to learn and integrate multiple libraries.

*  **Unique computational paradigm:** TargetJS introduces a novel computational model by integrating multiple paradigms: Turing Completeness, the Von Neumann Execution Model, and Functional Programming. This results in:

   * Deterministic Execution Flow: Targets execute based on their activation order, initially following their order in the code. They run in sequence as part of the framework execution cycle. Everything in TargetJS is synchronous, and targets cannot be called directly.
   * Powerful Functional Pipeline: Targets can be structured as a functional pipeline with enhanced capabilities.

*   **Easy Integration:** Can be used as a library within existing projects.

## Comparison with Other UI Frameworks  

| Feature                               | TargetJS                                                              | Reactive Model Frameworks                                         |
|--------------------------------------|------------------------------------------------------------------------|-------------------------------------------------------------------|
| **Component Basic Structure**        | Provides a unified interface where methods and properties are treated identically.       | Methods and variables are distinct.                               |
| **Execution Order**                  | Targets are executed based on their activation order, which initially follows their appearance in the code. They run in a sequential and predictable manner. | Less predictable.                                                |
| **Function Calls**                   | Targets cannot be called directly. Execution is part of a framework execution cycle, ensuring synchronization. | Functions can be called directly and are less synchronous.        |
| **Autonomous Execution**             | Targets can self-activate and operate autonomously, and have the ability to schedule their execution by time. | Functions do not execute autonomously. Control flow with time is difficult.                          |
| **Execution Pipeline**               | Targets can form controlled pipelines; a target can activate when the preceding target executes or completes. | Function pipelines are limited.                                   |
| **Event Handling**                   | By activating targets, event handling becomes synchronous and consistent with the core execution model. | Events are handled asynchronously.                                |
| **State Management**                 | Unified within targets; no external state libraries needed.            | State management is often an issue.                               |
| **Animations**                       | Animations are handled directly by targets and are consistent with the rest of the program. | CSS transitions or external libraries.                            |
| **HTML and Nesting**                 | Built to enhance HTML elements with any logic and is less reliant on HTML blocks. | HTML structure is an integral part of UI frameworks.              |
| **CSS Handling**                     | CSS is optional; styles can be incorporated directly as targets.       | Styles are often separate from logic.                             |
| **API Calls**                        | API results are synchronous and can be chained in a pipeline.          | Usually handled with Promises, async/await, less structured execution. |
| **Large List Performance**           | Optimized with an internal tree structure; monitors only the visible branch. | Can require careful optimization.                                 |
| **Workflow Development**             | Targets offer a unified solution for UI, animation, event handling, API calls, and state management. | Multiple technologies and approaches.                             |
| **Execution Control by Time**        | TargetJS enables easy sequencing and parallelization for complex UI behaviors. | Not easily accomplished.                                          |


## The Core of TargetJS

TargetJS utilizes literal JavaScript objects or HTML elements for target definitions, providing a compact and readable format. The core principles are:

- Provide an internal wrapper (called "targets") for both properties and methods of the literal object.
- Execute targets sequentially, in the order they are written leveraging ES2015's guaranteed property order.
- Enable functional pipelines between adjacent targets.
- Add lifecycles, looping, and timing to targets, enabling them to execute or re-execute based on conditions or time.

That's the basic idea. Learn more [here](https://dev.to/ahmad_wasfi_f88513699c56d/targetjs-rethinking-ui-with-declarative-synchronous-pipelines-5bbi).

## Anatomy of a Target

Each target consists of the following:
1. Target Value and Actual Value. The target value refers to the value assigned to a property or the output produced by the `value()` method associated with the target defined in your program. The actual value is the value used by the rest of the application. When the target value differs from the actual value, TargetJS iteratively updates the actual value until it matches the target value. This process is managed by two additional variables: `step`, which dictates the number of iterations, and `interval`, which specifies the duration (in milliseconds) the system waits before executing the next iteration.

2. State: Targets have four states that control their lifecycles: `active`, `inactive`, `updating`, and `complete`.
   - `active`: This is the default state for all targets. It indicates that the target is ready to be executed, and the target value needs to be initialized from the variable it represents or its `value()` method needs to be executed to calculate its output.
   - `inactive`: Indicates that the target is not ready to be executed.
   - `updating`: Indicates that the actual value is being adjusted to reach the target value.
   - `complete`: Indicates that the target execution is finished, and the actual value has matched the target value.

4. Target Methods: All methods are optional. They are used to control the lifecycle of targets or serve as callbacks to reflect changes. The controlling methods are: enabledOn, loop, steps, cycles. The callbacks are: onValueChange, onStepsEnd, onImperativeStep, onImperativeEnd. More details in the method section.


## Target Methods

All methods and properties are optional, but they play integral roles in making targets useful for animation, API loading, event handling, and more:

1. **value**
If defined, value is the primary target method that will be executed. The target value will be calculated based on the result of this method.

2. **Prefix `_` to the target name**
It indicates that the target is in an inactive state and must be activated by an event or other targets.

3. **active**
This is only a property. It indicates whether the target is ready for execution. When set to false, it behaves similarly to a `_ `prefix. By default, all targets are active, so setting it to true is unnecessary.

15. **Postfix `$` to the target name**
A target name ending with $ indicates that it will be activated when the preceding target is executed. If the preceding target involves API calls, it will be activated
each time an API response is received, while ensuring the order of API calls is enforced. This means it will remain inactive until the first API result is received,
then the second, and so on.
  
17. **Postfix `$$` to the target name**
A target name ending with `$$` indicates indicates that it will be activated only after the preceding target has completed, along with all its imperative targets,
and after all API results have been received without error.

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
    
## More Examples

Below are examples of various TargetJS use cases:

## Basic Example

The examples below demonstrate different formats for writing target constructs. In each example, the values of `width`, `height`, and `opacity` are incrementally increased over 30 steps, with a 50ms pause between each step. 
You can view a live example here: https://targetjs.io/examples/overview.html.

![first example](https://targetjs.io/img/basic1_3.gif)

**Object**

```bash
import { App } from "targetj";

App({
    background: 'mediumpurple',
    width: {
        value: 250,        
        steps: 30,
        interval: 50
    },
    height: {
        value: 250,        
        steps: 30,
        interval: 50
    },
    opacity: {
        value: 0.15,        
        steps: 30,
        interval: 50
    }
 });
```
**Array**

```bash
import { App } from "targetj";

App({
    background: 'mediumpurple',
    width: [ 250, 30, 50], 
    height: [ 250, 30, 50],
    opacity: [ 0.15, 30, 50]
 });
```
**Imperative** (more in the next example)

```bash
import { App } from "targetj";

App({
    animate() {
      this.setTarget('background', 'mediumpurple');
      this.setTarget('width',[250, 30, 50]);
      this.setTarget('height', [250, 30, 50]);
      this.setTarget('opacity', [0.15, 30, 50]);
    }
});
```
**Imperative Multi-Targets**

```bash
import { App } from "targetj";

App({
    animate() {
      this.setTarget({
         background: 'mediumpurple',
         width: [ 250, 30, 50],
         height: [ 250, 30, 50],
         opacity: [ 0.15, 30, 50]
      });
    }
 });
```

**HTML**

```html 
  <div 
    tg-background="#fff"
    tg-width="[120, 30, 50]"
    tg-height="[120, 30, 50]"
    tg-opacity="[0.15, 30, 50]"
  >  
  </div>
 ```

## Declarative and Imperative Targets Example

Targets in TargetJS can be defined in two ways: declaratively or imperatively.

The declarative approach offers a structured method for defining targets, as seen in the previous example. However, orchestrating multiple targets with varying speeds and timings can be challenging. For instance, tracking the completion of multiple targets to trigger a new set of targets is not easily done using only declarative targets. To address this, TargetJS provides the setTarget function, allowing you to define multiple imperative targets from within a single declarative target. Additionally, the onImperativeStep and onImperativeEnd callbacks, defined in the declarative target, enable you to track each step of the imperative targets or just their completion.

By combining imperative and declarative targets with their functional pipeline, you gain a powerful toolset for designing complex interactions.

The following example demonstrates both declarative and imperative approaches. In the `animateLeftToRight` target, two imperative targets move a square across the screen 
from left to right. Once both `x` and `y` targets are completed, `animateLeftToRight` is considered complete. The `animateRightToLeft` target executes next because 
it is postfixed with `$$`, forming a pipeline that begins once the preceding target and all its imperative targets are complete. Similarly, the `waitOneSecond` target executes when `animateLeftToRight` completes,
introducing a 1-second pause. After that, `repeat` is executed, reactivating the animation pipeline and allowing the animation to continue indefinitely.

![declarative example](https://targetjs.io/img/declarative3.gif)

```bash
import { App, getScreenWidth, getScreenHeight } from "targetj";

App({
    children: {
      loop() { return this.getChildren().length < 10; },
      interval: 500,
      value: () => ({
          width: 50,
          height: 50,
          background: "brown",
          animateLeftToRight() {
              const width = this.getWidth();
              const parentWidth = this.getParentValue("width");
              this.setTarget("x", { list: [-width, parentWidth + width] }, 300);
              this.setTarget("y", Math.floor(Math.random() * (this.getParentValue("height") - this.getHeight())), 30);
          },
          _animateRightToLeft$$() {
            const width = this.getWidth();
            const parentWidth = this.getParentValue("width");
            this.setTarget("x", { list: [parentWidth + width, -width] }, 300);
          },
          _waitOneSecond$$() {
            this.setTarget('1second', 1, 1, 1000); //name, value, steps, interval 
          },
          _repeat$$() {
            this.activateTarget('animateLeftToRight');
          }
        })
    },
    width: getScreenWidth,
    height: getScreenHeight
});
```
Or in HTML:

```html 
<div
  tg-width="function() { return TargetJS.getScreenWidth(); }"
  tg-height="function() { return TargetJS.getScreenHeight(); }"
  tg-children="{ cycles: 9, interval: 500 }">
    <div
        tg-width="50"
        tg-height="50"
        tg-background="brown",
        tg-left2right="function() {
          const width = this.getWidth();
          const parentWidth = this.getParentValue('width');
          this.setTarget('x', { list: [ -width, parentWidth + width ] }, 400);
          this.setTarget('y', Math.floor(Math.random() * (this.getParentValue('height') - this.getHeight())), 30);
        }"
        tg-_right2left$$="function() {
          const width = this.getWidth();
          const parentWidth = this.getParentValue('width');
          this.setTarget('x', { list: [ parentWidth + width, -width ] }, 400);
        }"
        tg-_onesecond$$="function() {
          this.setTarget('1second', 1, 1, 1000);
        }"
        tg-_repeat$$="function() {
          this.activateTarget('left2right');
        }"
    >
    </div>
</div>
```

### Infinite Loading and Scrolling Example

In this example, we demonstrate a simple infinite scrolling application where each item dynamically triggers an API call to fetch and display its details.

- children: `children` is a special target that adds items to the container's children each time it is executed. The `onVisibleChildrenChange` event function detects changes in the visible children and activates the `children` target to add new items that fill the gaps.  
- load: Since the target name ends with `$`, it executes for every batch of 20 newly created children and fetches their details. The result will be an array containing the 20 fetched users. TargetJS ensures that the array maintains the order in which the API calls were made, rather than the order in which their responses were received.
- populate: Since the target name ends with `$$`, it executes only after all API calls have completed. It updates the content of each scrollable item with the name returned by the API.

TargetJS employs a tree-like structure to track visible branches, optimizing the scroller performance.

If you inspect the HTML elements in the browser's developer tools, you'll notice that the scroller’s elements are not nested inside the container. This is because nesting itself is a dynamic target that determines how elements are structured. This enables efficient reuse of HTML elements and unlocks new user experiences.

![Single page app](https://targetjs.io/img/infiniteScrolling11.gif)

```bash
import { App, getEvents, fetch, getScreenWidth, getScreenHeight } from "targetj";

App({
    domHolder: true,
    preventDefault: true,
    containerOverflowMode: "always",
    children() {
        const childrenCount = this.getChildren().length;
        return Array.from({ length: 20 }, (_, i) => ({
             id: 'scrollItem',
             width: [{list: [100, 250]}, 15],
             background: [{list: ["#FCE961", "#B388FF"]}, 15, 15],
             height: 48,
             color: "#C2FC61",
             textAlign: "center",
             lineHeight: 48,
             bottomMargin: 2,
             x() { return this.getCenterX(); },
             validateVisibilityInParent: true,
             html: childrenCount + i
         }));
    },
    _load$() {
        this.prevTargetValue.forEach(data =>
            fetch(this, "https://targetjs.io/api/randomUser", { id: data.oid }));
    },
    _populate$$() {
        this.prevTargetValue.forEach((data) => this.getChildByOid(data.id).setTarget("html", data.name));
    },
    onScroll() {
        this.setTarget("scrollTop", Math.max(0, this.getScrollTop() + getEvents().deltaY()));
    },
    onVisibleChildrenChange() {
        if (getEvents().dir() === "down" && this.visibleChildren.length * 50 < this.getHeight()) {
            this.activateTarget("children");
        }
    },
    width: getScreenWidth,
    height: getScreenHeight    
});
```

Or in HTML:

```HTML
<div
  tg-domHolder="true"
  tg-preventDefault="true"
  tg-containerOverflowMode="always"
  tg-width="return TargetJS.getScreenWidth();"
  tg-height="return TargetJS.getScreenHeight();"
  tg-children="function() {
    const childrenCount = this.getChildren().length;
    return Array.from({ length: 20 }, (_, i) => ({
      width: [{ list: [100, 250] }, 15],
      background: [{ list: ['#FCE961', '#B388FF'] }, 15, 15],
      height: 48,
      color: '#C2FC61',
      textAlign: 'center',
      lineHeight: 48,
      bottomMargin: 2,
      x: function() { return this.getCenterX(); },
      validateVisibilityInParent: true,
      html: childrenCount + i
    }));
  }"
  tg-_load$="function() {
    this.prevTargetValue.forEach(data =>
      TargetJS.fetch(this, 'https://targetjs.io/api/randomUser', { id: data.oid })
    );
  }"
  tg-_populate$$="function() {
    this.prevTargetValue.forEach((data) =>
      this.getChildByOid(data.id).setTarget('html', data.name)
    );
  }"
  tg-onScroll="function() {
    this.setTarget('scrollTop', Math.max(0, this.getScrollTop() + TargetJS.getEvents().deltaY()));
  }"
  tg-onVisibleChildrenChange="function() {
    if (TargetJS.getEvents().dir() === 'down' && this.visibleChildren.length * 50 < this.getHeight()) {
      this.activateTarget('children');
    }
  }"
></div>
```

## Simple SPA Example

Below is a simple single-page application that demonstrates how to build a fully-featured app using TargetJS. Each page is represented by a textarea. You’ll notice that when you type something, switch to another page, and then return to the same page, your input remains preserved. This also applies to the page's scroll position—when you return, the page will open at the same scroll position where you left it, rather than defaulting to the top.

You can now assemble your app by incorporating code segments from the examples on animation, event handling, API integration, and infinite scrolling provided above.

![Single page app](https://targetjs.io/img/singlePage2.gif)

```bash
import { App, getScreenHeight, getScreenWidth, getEvents, getPager } from "targetj";

App({
  domHolder: true,
  width() { return getScreenWidth(); },
  height() { return getScreenHeight(); },
  menubar() {
    return {
      children() {
        return ['home', 'page1', 'page2'].map(menu => {
          return {
            background: '#fce961',
            width: 100,
            height: 50,
            lineHeight: 50,
            itemOverflowMode: 'never',
            opacity: 0.5,
            cursor: 'pointer',
            html: menu,
            onEnter: function() {
              this.setTarget('opacity', 1, 20);
            },
            onLeave: function() {
              this.setTarget('opacity', 0.5, 20);
            },
            onClick: function() {
              this.setTarget('opacity', 0.5);
              getPager().updateBrowserUrl(menu);
              this.activateAncestorTarget('updateChildren');
            }
          };
        });
      },
      height: 50,
      width: function() { return getScreenWidth(); },
      onResize: ['width']
    };
  },
  page() {
    return {
      width: function() { return getScreenWidth(); },
      height: function() { return getScreenHeight() - 50; },
      baseElement: 'textarea',
      keepEventDefault: ['touchstart', 'touchend', 'mousedown', 'mouseup'],
      boxSizing: 'border-box',
      html: 'main page',
      onKey() {
        this.setTarget('html', this.$dom.value());
      }
    };
  },
  mainpage() {
    return Object.assign({}, this.val('page'), {
      background: '#e6f6fb',
      html: 'main page'
    });
  },
  page1() {
    return Object.assign({}, this.val('page'), {
      background: '#C2FC61',
      html: 'page1'
    });
  },
  page2() {
    return Object.assign({}, this.val('page'), {
      background: '#B388FF',
      html: 'page2'
    });
  },
  updateChildren() {
    const pageName = window.location.pathname.split('/').pop(); 
      
    if (this.hasChildren()) {
        this.removeChild(this.getLastChild());
    } else {
        this.addChild(this.val('menubar'));
    }
    this.addChild(this.val(pageName) ||  this.val('mainpage'));
  }  
});
```

Or in HTML:

```HTML
<div
  tg-domHolder="true"
  tg-width="return TargetJS.getScreenWidth();"
  tg-height="return TargetJS.getScreenHeight();"
  tg-menubar="function() {
    return {
      children: function() {
        return ['home', 'page1', 'page2'].map(function(menu) {
          return {
            background: '#fce961',
            width: 100,
            height: 50,
            lineHeight: 50,
            itemOverflowMode: 'never',
            opacity: 0.5,
            cursor: 'pointer',
            html: menu,
            onEnter: function() {
              this.setTarget('opacity', 1, 20);
            },
            onLeave: function() {
              this.setTarget('opacity', 0.5, 20);
            },
            onClick: function() {
              this.setTarget('opacity', 0.5);
              TargetJS.getPager().updateBrowserUrl(menu);
              this.activateAncestorTarget('update-children');
            }
          };
        });
      },
      height: 50,
      width: function() { return TargetJS.getScreenWidth(); },
      onResize: ['width']
    };
  }"
  tg-page="
    return {
      width: function() { return TargetJS.getScreenWidth(); },
      height: function() { return TargetJS.getScreenHeight() - 50; },
      baseElement: 'textarea',
      keepEventDefault: ['touchstart', 'touchend', 'mousedown', 'mouseup'],
      boxSizing: 'border-box',
      html: 'main page',
      onKey: function() {
        this.setTarget('html', this.$dom.value());
      },
      onResize: ['width', 'height']
    };"
  tg-mainpage="function() {
    return Object.assign({}, this.val('page'), {
      background: '#e6f6fb',
      html: 'main page'
    });
  }"
  tg-page1="function() {
    return Object.assign({}, this.val('page'), {
      background: '#C2FC61',
      html: 'page1'
    });
  }"
  tg-page2="function() {
    return Object.assign({}, this.val('page'), {
      background: '#B388FF',
      html: 'page2'
    });
  }"
  tg-test="function() { console.log('test'); }"
  tg-update-children="function() {
    const pageName = window.location.pathname.split('/').pop();       
  
    if (this.hasChildren()) {
        this.removeChild(this.getLastChild());
    } else {
        this.addChild(this.val('menubar'));
    }
    this.addChild(this.val(pageName) ||  this.val('mainpage'));
  }"
></div>
```

## Using TargetJS as a Library Example

Here is an example that creates 1000 rows. The first argument, 'rows,' is used to find an element with the ID 'rows.' If no such element exists, it will be created at the top of the page. The OnDomEvent target activates the targets defined in its value when the DOM is found or created, eliminating the need for conditions to verify the DOM's availability before executing the target.

The `rectTop`, `absY`, and `onWindowScroll` targets are used to track the visible rows during scrolling. TargetJS automatically divides a long list into a tree structure, efficiently managing only the visible branch. The `onWindowScroll` target updates the `absY` of the table, enabling TargetJS to identify the branch visible to the user. You can opt out of this algorithm by setting the `shouldBeBracketed` target to `false`.

![animation api example](https://targetjs.io/img/targetjsAsLibrary.gif) 

```bash
import { App, $Dom } from "targetj";

App({
    isVisible: true,
    containerOverflowMode: "always",
    rectTop() { return this.$dom.getBoundingClientRect().top + $Dom.getWindowScrollTop(); },
    absY() { return this.val('rectTop') - $Dom.getWindowScrollTop(); },
    defaultStyling: false,
    domHolder: true,
    onDomEvent: ["rectTop", "absY"],
    onWindowScroll: "absY",
    createRows: {
      parallel: true,
      cycles: 9,
      value() {
        const childrenLength = this.getChildren().length;
        Array.from({ length: 100 }, (_, i) => {
             this.addChild({
                 defaultStyling: false,
                 keepEventDefault: true,
                 height: 36,
                 width: [{ list: [100, 500, 200] }, 30],
                 background: "#b388ff",
                 canDeleteDom: false,
                 html: `row ${i + childrenLength}`,
            });
         })
      }
    }
});
```

## Special Target Namescan

All HTML style names and attributes are treated as special target names. The most commonly used style names and attributes have already been added to the framework, with the possibility of adding more in the future.

Examples:
- `width`, `height`: Set the dimensions of the object.
- `opacity`, `scale`, `rotate`: Adjust the opacity, scale, and rotation of the object.
- `zIndex`: Sets the z-order of the object.

In addition to styles and attribute names, we have the following special names:

1. **html**: Sets the content of the object, interpreted as text by default.
2. **children**: Adds new items to the parent each time it executes. Items can be either plain objects or instances of TModel for greater control.
4. **css**: A string that sets the CSS of the object.
5. **baseElement**: Sets the HTML tag of the object, defaulting to `div`.
6. **shouldBeBracketed**: A boolean flag that, when set to true (the default), enables the creation of an optimization tree for a container with more items than the `bracketThreshold` (another target with a default value of 10). This optimization ensures only the visible branch receives updates and get executed.
7. **x** and **y**: Sets the location of the object.
8. **scrollLeft** and **scrollTop**: Control the scrolling position of the object.
9. **leftMargin**, **rightMargin**, **topMargin**, **bottomMargin**: Set margins between objects.
10. **domHolder**: When set to true, indicates that the current object serves as the DOM holder for all of its descendant objects. It can also return a DOM element, in which case the current object and all descendants will be contained within that DOM element.
11. **domParent**: Set by the container or children to control which DOM container they are embedded in.
12. **isVisible**: An optional target to explicitly control the visibility of the object, bypassing TargetJS’s automatic calculation.
13. **canHaveDom**: A boolean flag that determines if the object can have a DOM element on the page.
14. **canDeleteDom**:  When set to true (the default), indicates that the object's DOM element will be removed when the object becomes invisible.
15. **canHandleEvents**: An optional target that directly specifies the events the object can handle. If not specified, it will specified by event targets defined in the object (see below).
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

## Debugging in TargetJS

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
