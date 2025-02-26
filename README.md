# TargetJS: A Novel JavaScript UI Framework for Simplified Development and Enhanced User Experience

**[targetjs.io](https://targetjs.io)** 
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/livetrails/targetjs/blob/main/License) 
[![Stars](https://img.shields.io/github/stars/livetrails/targetjs.svg)](https://github.com/livetrails/targetjs/stargazers)
[![npm version](https://img.shields.io/npm/v/targetj.svg)](https://www.npmjs.com/package/targetj)

TargetJS is a modern JavaScript UI framework designed to simplify front-end development by introducing a unique paradigm centered around Targets, which function as **enhanced variables and methods** with **lifecycles**.  This approach provides a unified solution for UI rendering, animations, API interactions, state management, and event handling, resulting in more compact and maintainable code. TargetJS is also a highly performant web framework, as shown in the [framework benchmark](https://krausest.github.io/js-framework-benchmark/current.html).
## What Problems Does TargetJS Solve?

TargetJS addresses several common pain points in front-end development:

1.  **Complexity of Asynchronous Operations:**  Traditional JavaScript often involves complex handling of asynchronous operations (Promises, callbacks, `async/await`). TargetJS addresses this by providing a structured, synchronous, and predictable execution flow, allowing developers to avoid asynchronous operations altogether.
2.  **Scattered State Management:** Many frameworks require separate libraries or complex patterns for state management. In TargetJS, state management is inherently handled through its core concept of Targets, eliminating the need for direct state management.
3.  **Boilerplate and Verbosity:** TargetJS aims to reduce boilerplate code. The code is compact and follows a predictable execution flow. Method calls are not allowed, and loops and conditional statements are rarely needed.
4.  **Rigid Static Layer of HTML:** Many frameworks use HTML as the primary medium for generating the user interface. TargetJS minimizes reliance on traditional HTML and CSS, allowing JavaScript to be the primary player, resulting in a better and more dynamic user experience.
5.  **Disjointed Development Workflow:**  Developers often juggle multiple tools and concepts (UI libraries, animation libraries, state managers, event handlers). TargetJS provides a *unified* solution, simplifying the learning curve and development process.
6.  **Difficult Animation Control:**  TargetJS makes animations first-class citizens. Targets can iterate step-by-step towards new values and manage execution flow by time.  This provides fine-grained control over animations without external libraries.
7.  **Complicated execution flow:** other frameworks are based on reactive model which often lead to unpredictable execution flow while TargetJS execution is based on the order targets are written.
8.  **Performance Bottlenecks with Large Lists:** TargetJS optimizes rendering for large lists by using a tree structure that renders only the visible branches.

## Table of Contents

1. [Installation](#installation)
2. [Key Features and Concepts](#key-features-and-concepts)
5. Examples:
   - [Quick Example: Growing and Shrinking Box](#quick-example-growing-and-shrinking-box)   
   - [Simple Loading API Example](#simple-loading-api-example)
   - [Loading Two Users Example](#loading-two-users-example)
6. [Comparison with Other UI Frameworks](#comparison-with-other-ui-frameworks)
7. [Anatomy of a Target](#anatomy-of-a-target)
9. [Target Methods](#target-methods)
10. More Examples:
    - [Basic Example](#basic-example)
    - [Declarative and Imperative Targets Example](#declarative-and-imperative-targets-example)
    - [Infinite Loading and Scrolling Example](#infinite-loading-and-scrolling-example)
    - [Simple SPA Example](#simple-spa-example)
    - [Using TargetJS as a Library Example](#using-targetjs-as-a-library-example) 
11. [Special Target Names](#special-target-names)
12. [How to Debug in TargetJS](#how-to-debug-in-targetjs)
13. [Documentation](#documentation)
14. [License](#license)
15. [Contact](#contact)
16. [Call to Action](#call-to-action)

## **📦 Installation**

Install TargetJS via npm (note that there is no 's' at the end):

```bash
npm install targetj
```

## Key Features and Concepts

*   **Targets:** The fundamental building blocks of TargetJS. Targets provide a unified interface for variables and methods with built-in lifecycles. They can:
    *   Iterate towards values (useful for animations and transitions).
    *   Execute conditionally.
    *   Self-activate and operate autonomously.
    *   Form synchronous execution pipelines.
    *   Manage their own state.

*   **Unified Approach:**  Targets handle UI updates, API calls, animations, state, and events, reducing the need to learn and integrate multiple libraries.

*  **Unique computational paradigm:** TargetJS introduces a novel computational model by integrating multiple paradigms: Turing Completeness, the Von Neumann Execution Model, and Functional Programming. This results in:

   * Deterministic Execution Flow: Targets execute based on their activation order, initially following their order in the code. They run in sequence as part of the task processing cycle. Everything in TargetJS is synchronous, and targets cannot be called directly.
   * Powerful Functional Pipeline: Targets can be structured as a functional pipeline with enhanced capabilities.

*   **Easy Integration:** Can be used as a library within existing projects.

## Examples

### Quick Example: Growing and Shrinking Box

💡 What's happening here?
- Targets run initially in the order they appear in the code, so `width` runs first. The `_` prefix indicates that a target is inactive by default, meaning `height` does not run initially.
- `width` animates from 100 → 250 → 100px, in 50 steps with 10ms pauses.
- `height` follows `width` and scales dynamically with its value. The `$` postfix means it is activated each time `width` executes. this.prevTargetValue refers to the previous target's value, which in this case is `width`.

![first example](https://targetjs.io/img/quick1_3.gif)

```bash
import { App, TModel } from "targetj";

App(new TModel("box", {
    background: "mediumpurple",
    width: [{ list: [100, 250, 100] }, 50, 10], // Target values, steps, interval
    _height$() { // activated when width executes
      return this.prevTargetValue / 2;
    } 
}));
```

### Simple Loading API Example

In this example, we load one user and display its name

- `loadUser` calls the fetch API to retrieve user details.
- `html` sets the text content of the div to the user's name. Since the target name is prefixed with `_` and ends with `$`, it executes only when an API call returns a result. `prevTargetValue` refers to the result of the API call.

![first example](https://targetjs.io/img/quick2_4.gif)

```bash
import { App, TModel, getLoader } from "targetj";

App(new TModel("loadUser", {
    loadUser() {
      getLoader().fetch(this, "https://targetjs.io/api/randomUser", { id: "user0" });
    },
    _html$() {
      return this.prevTargetValue.name;
    }
}));
```

### Loading Two Users Example

In this example, we load two separate users and display two purple boxes, each containing a user's name, based on our first example.

- `loadUsers` calls two fetch APIs to retrieve details for two users.
- `children` is a special target that adds new items to the parent each time it executes. Since the target name is prefixed with _, it is inactive by default. Because it ends with $, it executes every time an API call returns a result.
TargetJS ensures that API results are processed in the same sequence as the API calls. For example, if the user1 API result arrives before user0, the children target will not execute until the result for user0 has been received.
  
![first example](https://targetjs.io/img/quick3_1.gif)

```bash
import { App, TModel, getLoader } from "targetj";

App(new TModel("loadUsers", {
    loadUsers() {
      getLoader().fetch(this, "https://targetjs.io/api/randomUser", { id: "user0" });
      getLoader().fetch(this, "https://targetjs.io/api/randomUser", { id: "user1" });
    },
    _children$() {
      return new TModel("user", {
        background: "mediumpurple",
        html: this.prevTargetValue.name,
        width: [{ list: [100, 250, 100] }, 50, 10],
        _height$() { return this.prevTargetValue / 2; },
      });
    }
}));
```

## Comparison with Other UI Frameworks  

| Feature                               | TargetJS                        | Reactive Model Frameworks             |
|--------------------------------------|-----------------------------------------------------------------|------------------------------------------------------|
| **Component Basic Structure**     | Components consist of Targets, providing a unified interface for methods and variables. | Components consist of methods and variables.
| **Execution Order**                   | Components consist of Targets, providing a unified interface for methods and variables. | Primarily data-driven, less predictable. |
| **Function Calls**                    | Targets cannot be called directly. Execution is part of a task cycle. | Functions execute reactively or are called imperatively. |
| **Autonomous Execution**              | Targets can self-activate and operate autonomously. | Functions do not execute autonomously. |
| **Execution Pipeline**                | Targets can form controlled pipelines; a target can activate when the preceding target executes or completes. | Functions are called whenever dependencies update. Execution order is not based on code appearance. |
| **Event Handling**                    | Primarily by activating Targets, making event handling consistent with the core execution model. | Events are handled through event listeners, subscriptions, or reactive bindings. |
| **State Management**                  | Unified within Targets; no external state libraries needed. | State is often managed through reactive stores. |
| **UI Organization and Animation**      | UI controlled by Targets; styles incorporated directly. Animations handled directly by Targets, with step-by-step updates. | Component-based rendering and reactivity. Animations via CSS transitions, JavaScript, or external libraries. |
| **HTML and Nesting**                   | Minimal HTML reliance; code is the primary driver. Dynamic nesting. | HTML structure is an integral part of UI frameworks. Components and templates define static layouts; JSX or templates are used.|
| **CSS Handling**                       | CSS is optional; styles can be incorporated directly as Targets. | External stylesheets, CSS-in-JS, or utility-first CSS (e.g., Tailwind). Styles are often separate from logic. |
| **API Calls**                          | Can be chained in a pipeline; the bottom target activates only when each call is completed in the order invoked or when all calls are complete. | Usually handled with Promises, async/await, or reactive effects; less structured execution. |
| **Large List Performance**             | Optimized with an internal tree structure; monitors only the visible branch. | Can require careful optimization for very large lists (e.g., virtualization).
| **Workflow development**               | Targets offer a unified solution for UI , animation, event handling, API calls, and state management | Multiple technologies, commands, and approaches.
| **Execution control by time**          | TargetJS enables easy sequencing and parallelization for complex UI behaviors. | Not easily accomplished


## Anatomy of a Target

Each target consists of the following:
1. Target Value and Actual Value. The target value refers to the value assigned to a variable or the output produced by the `value()` method associated with the target defined in your program. The actual value is the value used by the rest of the application. When the target value differs from the actual value, TargetJS iteratively updates the actual value until it matches the target value. This process is managed by two additional variables: `step`, which dictates the number of iterations, and `interval`, which specifies the duration (in milliseconds) the system waits before executing the next iteration.

2. State: Targets have four states that control their lifecycles: `active`, `inactive`, `updating`, and `complete`.
   - `active`: This is the default state for all targets. It indicates that the target is ready to be executed, and the target value needs to be initialized from the variable it represents or its `value()` method needs to be executed to calculate its output.
   - `inactive`: Indicates that the target is not ready to be executed.
   - `updating`: Indicates that the actual value is being adjusted to reach the target value.
   - `complete`: Indicates that the target execution is finished, and the actual value has matched the target value.

4. Target Methods: All methods are optional. They are used to control the lifecycle of targets or serve as callbacks to reflect changes. The controlling methods are: enabledOn, loop, steps, cycles. The callbacks are: onValueChange, onStepsEnd, onImperativeStep, onImperativeEnd. More details in the method section.


## Target methods

All methods and properties are optional, but they play integral roles in making targets useful for animation, API loading, event handling, and more:

1. **value**
If defined, value is the primary target method that will be executed. The target value will be calculated based on the result of this method.

2. **Prefix `_` to the target name**
It indicates that the target is in an inactive state and must be activated by an event, other targets, or a preceding target if postfixed with `$` or `$$`.

15. **Postfix `$` to the target name**
A target name ending with $ indicates that it will be activated when the preceding target is executed. If the preceding target involves API calls, it will be activated
each time an API response is received, while ensuring the order of API calls is enforced. This means it will remain inactive until the first API result is received,
then the second, and so on.
  
17. **Postfix `$$` to the target name**
A target name ending with `$$` indicates indicates that it will be activated only after the preceding target has completed, along with all its imperative targets,
and after all API results have been received without error.

17. **this.prevTargetValue**  
It holds the value of the preceding target. If the preceding target involves API calls, a single $ postfix means it will hold one API result at a time, as the target is
activated with each API response. If the target is postfixed with $$, it will have the results as an array, ordered by the sequence of API calls rather than the order in
which the responses are received.

19. **this.isPrevTargetUpdated()**
It returns `true` if the previous target has been updated. This method is useful when a target is activated externally, such as by a user event, rather than by the preceding target.  

2. **onEnabled**
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
This callbak is triggered whenever there is a change returned by the target method, which is called value().

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
    
## More examples

Below are examples of various TargetJS use cases:

## Basic Example

The examples below demonstrate different formats for writing target constructs. In each example, the values of `width`, `height`, and `opacity` are incrementally increased over 30 steps, with a 50ms pause between each step. 
You can view a live example here: https://targetjs.io/examples/overview.html.

![first example](https://targetjs.io/img/basic1_3.gif)

**Object**

```bash
import { App, TModel } from "targetj";

App(new TModel({
    background: '#fff',
    width: {
        value: 250,        
        steps: 30,
        stepInterval: 50
    },
    height: {
        value: 250,        
        steps: 30,
        stepInterval: 50
    },
    opacity: {
        value: 0.15,        
        steps: 30,
        stepInterval: 50
    }
 }));
```
**Array**

```bash
import { App, TModel } from "targetj";

App(new TModel({
    background: '#fff',
    width: [ 250, 30, 50], 
    height: [ 250, 30, 50],
    opacity: [ 0.15, 30, 50]
 }));
```
**Imperative** (more in the next example)

```bash
import { App, TModel } from "targetj";

    animate() {
      this.setTarget('background', '#fff');
      this.setTarget('width',[250, 30, 50]);
      this.setTarget('height', [250, 30, 50]);
      this.setTarget('opacity', [0.15, 30, 50]);
    },
```
**Imperative Multi-Targets**

```bash
import { App, TModel } from "targetj";

App(new TModel({
    animate() {
      this.setTarget({
         background: '#fff',
         width: [ 250, 30, 50],
         height: [ 250, 30, 50],
         opacity: [ 0.15, 30, 50]
      });
    }
 }));
```

## Declarative and Imperative Targets Example

Targets in TargetJS can be defined in two ways: declaratively or imperatively.

The declarative approach offers a structured method for defining targets, as seen in the previous example. However, orchestrating multiple targets with varying speeds and timings can be challenging. For instance, tracking the completion of multiple targets to trigger a new set of targets is not easily done using only declarative targets. To address this, TargetJS provides the setTarget function, allowing you to define multiple imperative targets from within a single declarative target. Additionally, the onImperativeStep and onImperativeEnd callbacks, defined in the declarative target, enable you to track each step of the imperative targets or just their completion.

By combining imperative and declarative targets with their functional pipeline, you gain a powerful toolset for designing complex interactions.

The following example demonstrates both declarative and imperative approaches. In the `animateLeftToRight` target, two imperative targets move a square across the screen 
from left to right. Once both `x` and `y` targets are completed, `animateLeftToRight` is considered complete. The `animateRightToLeft` target executes next because 
it is postfixed with `$$`, forming a pipeline that starts when the preceding target finishes. Similarly, the `waitOneSecond` target executes when `animateLeftToRight` completes,
introducing a 1-second pause. After that, `repeat` is executed, reactivating the animation pipeline and allowing the animation to continue indefinitely.

![declarative example](https://targetjs.io/img/declarative3.gif)

```bash
import { App, TModel, getScreenWidth, getScreenHeight } from "targetj";

App(new TModel("declarative", {
    children: {
      loop() { return this.getChildren().length < 10; },
      interval: 500,
      value: () =>
        new TModel("square", {
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
}));
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
import { App, TModel, getEvents, getLoader, getScreenWidth, getScreenHeight } from "targetj";

App(new TModel("scroller", {
    containerOverflowMode: "always",
    children() {
        const childrenCount = this.getChildren().length;
        return Array.from({ length: 20 }, (_, i) =>
            new TModel("scrollItem", {
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
            })
        );
    },
    _load$() {
        this.prevTargetValue.forEach(data =>
            getLoader().fetch(this, "https://targetjs.io/api/randomUser", { id: data.oid }));
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
}));
```

## Simple SPA Example

Below is a simple single-page application that demonstrates how to build a fully-featured app using TargetJS. Each page is represented by a textarea. You’ll notice that when you type something, switch to another page, and then return to the same page, your input remains preserved. This also applies to the page's scroll position—when you return, the page will open at the same scroll position where you left it, rather than defaulting to the top.

You can now assemble your app by incorporating code segments from the examples on animation, event handling, API integration, and infinite scrolling provided above.

![Single page app](https://targetjs.io/img/singlePage2.gif)

```bash
import { App, TModel, getScreenHeight, getScreenWidth, getEvents, getPager } from "targetj";

App(new TModel("simpleApp", {
    width() { return getScreenWidth(); },
    height() { return getScreenHeight(); },
    menubar() {
        return new TModel("menubar", {
            children() {
                return ["home", "page1", "page2"].map(menu => {
                    return new TModel("toolItem", {
                        canHandleEvents: "touch",
                        background: "#fce961",
                        width: 100,
                        height: 50,
                        lineHeight: 50,
                        itemOverflowMode: 'never',
                        opacity: 0.5,
                        cursor: "pointer",
                        html: menu,
                        onEnter() {
                          this.setTarget("opacity", 1, 20);
                        },
                        onLeave() {
                          this.setTarget("opacity", 0.5, 20);
                        },
                        onClick() {
                          this.setTarget("opacity", 0.5);
                          getPager().openLink(menu);
                        }
                    });
                });
            },
            height: 50,
            width() { return getScreenWidth(); },
            onResize: ["width"]
        }); 
    },
    page() {
        return new TModel({
            width() { return getScreenWidth(); },
            height() { return getScreenHeight() - 50; },
            baseElement: 'textarea',
            keepEventDefault: [ 'touchstart', 'touchend', 'mousedown', 'mouseup' ],
            boxSizing: 'border-box',
            html: "main page",
            onKey() { this.setTarget('html', this.$dom.value()); },
            onResize: [ "width", "height" ]
        });        
    },
    mainPage() {
        return new TModel({
            ...this.val('page').targets,
            background: "#e6f6fb",
            html: 'main page'
        });
    },
    page1() {
        return new TModel({
            ...this.val('page').targets,
            background: "#C2FC61",
            html: 'page1'
        });        
    },
    page2() {
        return new TModel({
            ...this.val('page').targets,
            background: "#B388FF",
            html: 'page2'
        });         
    },    
    children() {
        const pageName = window.location.pathname.split("/").pop();
        switch (pageName) {
          case "page1":
            return [ this.val('menubar'), this.val('page1')];
          case "page2":
            return [ this.val('menubar'), this.val('page2')];
          default:
            return [ this.val('menubar'), this.val('mainPage') ];
        }
    },
    onResize: ["width", "height"]
}));
```

## Using TargetJS as a Library Example

Here is an example that creates 1000 rows. The first argument, 'rows,' is used to find an element with the ID 'rows.' If no such element exists, it will be created at the top of the page. The OnDomEvent target activates the targets defined in its value when the DOM is found or created, eliminating the need for conditions to verify the DOM's availability before executing the target.

The `rectTop`, `absY`, and `onWindowScroll` targets are used to track the visible rows during scrolling. TargetJS automatically divides a long list into a tree structure, efficiently managing only the visible branch. The `onWindowScroll` target updates the `absY` of the table, enabling TargetJS to identify the branch visible to the user. You can opt out of this algorithm by setting the `shouldBeBracketed` target to `false`.

![animation api example](https://targetjs.io/img/targetjsAsLibrary.gif) 

```bash
import { App, TModel, $Dom } from "targetj";

App(new TModel("rows", {
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
          this.addChild(
            new TModel("row", {
              defaultStyling: false,
              keepEventDefault: true,
              height: 36,
              width: [{ list: [100, 500, 200] }, 30],
              background: "#b388ff",
              canDeleteDom: false,
              html: `row ${i + childrenLength}`,
            })
          );
        });
      }
    }
}));
```

## Special target names

All HTML style names and attributes are treated as special target names. The most commonly used style names and attributes have already been added to the framework, with the possibility of adding more in the future.

Examples:
- `width`, `height`: Set the dimensions of the object.
- `opacity`, `scale`, `rotate`: Adjust the opacity, scale, and rotation of the object.
- `zIndex`: Sets the z-order of the object.

In addition to styles and attribute names, we have the following special names:

1. **html**: Sets the content of the object, interpreted as text by default.
2. **style**: An object to set the HTML style of the object, especially for style names that aren’t built-in.
3. **css**: A string that sets the CSS of the object.
4. **baseElement**: Sets the HTML tag of the object, defaulting to `div`.
5. **x** and **y**: Sets the location of the object.
6. **scrollLeft** and **scrollTop**: Control the scrolling position of the object.
7. **leftMargin**, **rightMargin**, **topMargin**, **bottomMargin**: Set margins between objects.
8. **children**: Sets the `TModel` children of the object.
9. **domHolder**: When specified, it designates the parent or any ancestor as the DOM holder for its descendants.
10. **domParent**: Set by the container or children to control which DOM container they are embedded in.
11. **isVisible**: An optional target to explicitly control the visibility of the object, bypassing TargetJS’s automatic calculation.
12. **canHaveDom**: A boolean flag that determines if the object can have a DOM element on the page.
13. **canHandleEvents**: An optional target that directly specifies the events the object can handle. If not specified, it will specified by event targets defined in the object (see below).
14. **widthFromDom** and **heightFromDom**: Boolean flags to explicilty control if the width and height should be derived from the DOM element.
15. **textOnly**: A boolean flag that specifies the content type as either text or HTML. The default value is false, indicating text.
16. **isInFlow**: A boolean flag that determines if the object will contribute to the content height and width of its parent.

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
