# TargetJS: JavaScript UI framework and library - Programming the Front-End with a New Paradigm

Welcome to TargetJS, a powerful JavaScript UI framework and library that you might find redefines front-end development. (https://targetjs.io)

**TargetJS** distinguishes itself by introducing **targets** as its core innovation. Targets provide methods and variable assignments with **life cycles**, allowing them to operate **independently** and **autonomously**, mimicking the behavior of living cells.

TargetJS execution flow is well structured, predictable, synchronous, compact, and easy to understand. It simplifies handling timing and asynchronous operations. 

Targets also offer one unified solution for UI, API handling, animation, state management, and event handling.

TargetJS introduces a unique paradigm by blending multiple computational models:

- **Turing Completeness**: Targets can execute continuously, conditionally skip execution, and modify values dynamically.  
- **Von Neumann Execution Model**: Targets are executed based on their activation order, which initially follows the order they appear in the code. Targets cannot also be called directly. This makes the execution flow more predictable, easier to understand, and performant.  
- **Functional Programming**: Targets can be composed to transform data in a pipeline-like manner, similar to functional programming. It also has ability to observe the execution of the preceding target. This keeps the pipeline execution again simple, easy to understand, and performant.

We believe TargetJS will enhance productivity and make the coding experience more enjoyable and user-centric.

---

## Table of Contents

1. [Installation](#installation)
2. [Comparison with Other UI Frameworks](#Comparison-with-other-ui-frameworks)
3. [What are Targets?](#what-are-targets)
4. Examples:
   - [Quick Example](#quick-example)   
   - [Loading API Example](#loading-api-example)
   - [Draggable Animation Example](#draggable-animation-example)
   - [Infinite Scrolling Example](#infinite-scrolling-example)
6. [Why TargetJS?](#why-targetjs)
7. [Integration with Existing Pages](#integration-with-existing-pages)
8. [Anatomy of a Target](#anatomy-of-a-target)
9. [How TargetJS Operates](#how-targetjs-operates)
10. [Target Methods](#target-methods)
11. More Examples:
   - [Simple Example](#simple-example)
   - [Declarative and Imperative Targets Example](#declarative-and-imperative-targets-example)
   - [Another Loading Data Example](#another-loading-data-example)
   - [Animation API Comparison Example](#animation-api-comparison-example)
   - [Simple Single Page App Example](#simple-single-page-app-example)
   - [Using TargetJS as a Library Example](#using-targetjs-as-a-library-example) 
11. [Special Target Names](#special-target-names)
12. [How to Debug in TargetJS](#how-to-debug-in-targetjs)
13. [Documentation](#documentation)
14. [License](#license)
15. [Contact](#contact)

⭐ We appreciate your star, it helps!

---

## Comparison with Other UI Frameworks  

| Feature                               | TargetJS                        | Reactive Model Frameworks             |
|--------------------------------------|-----------------------------------------------------------------|------------------------------------------------------|
| **Component Basic Structure**     | Components consist of targets, which internally provide unified interface for methods and variables | Components consist of methods and variables
| **Execution Order**                   | Targets are executed based on their activation order, which initially follows their appearance in the code. They run in a sequential and predictable manner | Execution is mainly **driven by data changes** and less predictable. |
| **Function Calls**                    | Functions (or Targets in TargetJS) **cannot be called directly**. TargetJS executes all active targets in sequence as part of its task cycle | Functions **re-execute reactively** when dependencies change or are imperatively called. |
| **Flow Control**                      | Execution is structured by a **deterministic task cycle**. **No direct invocation, only activation** | The flow is **data-driven**, and execution order depends on observed changes. |
| **Autonomous Execution**              | **Targets can self-activate and operate autonomously**. | Functions do not execute autonomously. |
| **Execution Pipeline**                | **Targets can form a controlled execution pipeline**, where a target can be activated when the **preceding target in the code is executed**. | Functions are called **whenever dependencies update**. Execution order is not based on code appearance. |
| **Event Handling**                    | **Events in TargetJS are handled primarily by activating targets**, making event handling consistent with the core execution model. | Events are handled through **event listeners, subscriptions, or reactive bindings**. |
| **State Management**                  | **State is managed by targets**, which provide a **unified interface** for both methods and functions, eliminating the need for external state libraries. | State is often managed through reactive stores. |
| **UI Organization and Animation**      | **UI is primarily controlled by targets**, with styles incorporated directly within them. **Animations are handled directly by targets**, which iterate step by step towards new values and allow **pauses between updates**. | UI is updated via **component-based rendering and reactivity**. Animations are often handled via **CSS transitions, imperative JavaScript animations, or external libraries**. |
| **HTML and Nesting**                   | **TargetJS minimizes the role of HTML** and strives to make **code the primary player** in user experience rather than relying on a static HTML layer. **HTML Nesting is managed as a target**, making the structure dynamic, simplified, and only as deep as necessary**. | HTML structure is an **integral part** of UI frameworks. Components and templates define **static layouts**, and **JSX, templates, or compiled HTML structures** are used to organize UI elements. |
| **CSS Handling**                       | **CSS is optional**: Instead of relying on external stylesheets, **styles can be incorporated directly as targets**. This allows styles to be **dynamically updated** and easily accessible from the rest of the code. | CSS is usually handled through **external stylesheets, CSS-in-JS (styled-components, Emotion), or Tailwind**. Styles are often **separate from logic**. |
| **API Calls**                          | **API calls can be chained together in a pipeline**, where the **bottom target is activated only when all API calls are complete**. | API calls are usually handled with **Promises, async/await, or reactive effects**, which result in a less structured execution. |

**Other Advantages of TargetJS**:

### Unified Approach for Development  

Targets offer a **unified solution** for **UI**, **animation**, **event handling**, **API calls**, and **state management**, rather than working with multiple technologies, 
commands, and approaches. This simplifies development and makes **TargetJS** easier to learn.

### Execution Control with Time 

TargetJS enables developers to control the execution timing of targets, allowing for the sequencing and parallelization of numerous actions, which simplifies the development of complex UI behaviors.
 
### High Performance for large Lists

**TargetJS** optimizes performance by internally building a **tree structure** where there is a long list of components. The TargetJS task cycle monitors only 
the **visible branch** of the tree, ensuring high performance of pages with large lists of UI items.

### Enhanced User Experience  

With its simplified and unified approach, eliminating the need for a static HTML layer and CSS files, along with the dynamic nature of targets, we believe TargetJS enables developers
to focus on the user experience more than other frameworks.

---

## Installation

To install TargetJS, run the following command in your terminal:

```bash
npm install targetj
```
---

## What are targets?

In TargetJS, **targets** serve as the core building blocks of components, replacing traditional variables and methods. Each component is composed of a set of targets.

Targets provide a **unified approach** for addressing **animation**, **user interface**, **program flow control**, **state management**, **event handling**, **API calls**, and more. They achieve this by offering a consistent interface for variable assignments and methods, enabling them to operate autonomously and manage their own life cycles.

### For example:
- **Variables**:
  - Can iterate step by step toward a specified value instead of being instantly assigned.
  - Can introduce pauses between steps, adjust their progression dynamically, and trigger callbacks upon completion.
- **Methods**:
  - Can execute themselves when specific conditions are met.
  - Can adjust pauses between executions, limit the number of executions, track the progress of other variables or methods, and activate the life cycles of additional methods, and more.

Targets follow a simple execution pattern, despite they can operate continuously and autonomously:  

- They initially execute in the order they appear in the code.  
- Each target can also listen to the one directly above it, encouraging related targets to be placed closer together and eliminating the need for extra constructs for observability.  
- They can form a functional transformation pipeline. 
---

## Examples

### Quick example

In our first quick example, which demonstrates a simple functional pipeline, a purple `div` will grow from `100px` to `250px` and then shrink back to `100px` in 50 steps for each transformation, with each step occurring at a minimum interval of 10 milliseconds. The `height` target will activate whenever the `width` target executes, using the `width` value to proportionally adjust the `height`. Similarly, the `scale` target will take the `height` value and update whenever the `height` target executes.

Notice that no CSS is required, and HTML is not needed.

![first example](https://targetjs.io/img/quickExample8.gif)

```bash
import { App, TModel, getEvents } from "targetj";

App(new TModel('quickExample', {
    background: '#B388FF',
    width: [ { list: [ 100, 250, 100 ] }, 50, 10 ],
    _height$() { return this.prevTargetValue / 2; },
    _scale$() { return this.prevTargetValue / 50; },
    onSwipe() { 
      this.setTarget({ x: getEvents().swipeX(this), y: getEvents().swipeY(this) });
    }   
}));
```

### Loading API Example

In this example, we load two separate users, and once both API calls return results, we display their names and briefly flash the background. 

All targets without a prefix `_` execute in the order they appear in the code. Targets prefixed with `_` are inactive by default and must be activated externally. Target names ending with `$` indicate that they will activate when the previous target completes, allowing them to form a functional execution pipeline.

The `html` target initializes the text content of the `div` to `"loading"`. If no `baseElement` target is specified, the `div` is the default element. Then, the `loadUsers` target executes. Once both API results are retrieved, the `displayName` target runs, accessing the results in an array ordered by the sequence in which the APIs were called.

The execution pipeline then continues, gradually expanding the width and height while transitioning the background color from yellow to purple over 15 steps, with 15-millisecond pauses between each step.

![first example](https://targetjs.io/img/loadingExample6.gif)

```bash
import { App, TModel, getLoader } from "targetj";

App(new TModel('apiCall', {
    html: 'Loading...',
    loadUsers() {
      getLoader().fetch(this, "https://targetjs.io/api/randomUser", { id: "user0" });
      getLoader().fetch(this, "https://targetjs.io/api/randomUser", { id: "user1" });      
    },
    _displayName$$() {
        const [ user0, user1 ] = this.prevTargetValue;
        this.setTarget("html", `${user0.name} ${user1.name}`);
    },
    _width$: 200,
    _height$: 200,
    _background$: [{ list: ["#FCE961", "#B388FF"] }, 15, 15]
}));
```

### Draggable Animation Example 

In this example, we reimplement the first example above and expand on it using imperative targets instead of declarative targets. We will further explore this concept in the Declarative and Imperative Targets Example below.

`color`, `html`, `textAlign`, `moves`, and `animate` are all targets. These targets are executed in the same order they appear in the program. `color`, `html`, `textAlign`, `moves` get competed and their life cycle end.
The `moves` target prepares the data required for the `animate` target before execution. The `animate` target accesses the moves generated by the previous target using `this.prevTargetValue`, then generates a list of imperative targets for each style included in each move. Although it is not needed in this example, we can also use `isPrevTargetUpdated()` to check if the previous target value has been updated, allowing us to skip unnecessary execution and improve performance.

The target `animate` remains active with an indefinite lifecycle specified by the `loop` property. After each animation cycle, there is a one-second pause, defined by the `interval` property. Both `loop` and `interval` can also be defined as methods, which will be explained further below. The `setTarget` method defines an imperative target that executes the assigment in 30 steps. The `animate` target starts a new cycle after all the imperative targets have been completed or at least one second pass specified in the interval value given that the imperative targets get executed less than 1 second.

You'll also find `quickStart`, the first argument in the `TModel` constructor. If an HTML element with the same ID already exists on the page, it will be used in the new instance of `TModel`, and the animation will be applied to it. If no such element exists, TargetJS will create one.

You can view the live example at [https://targetjs.io/examples/quick.html](https://targetjs.io/examples/quick.html). Click on "Show Code" to see how the code is executed.

![first example](https://targetjs.io/img/quickExample3.gif)

```bash
import { App, TModel, getEvents } from "targetj";

App(new TModel('quickStart', {
    color: '#fff',
    html: 'Drag me',
    textAlign: 'center',
    moves: [
        { scale: 1, width: 200, height: 200, lineHeight: 200, background: 'blue', borderRadius: 0 },
        { scale: 1.5, width: 150, height: 150,lineHeight: 150, background: 'red', borderRadius: 75 },
        { scale: 1, width: 100, height: 100, lineHeight: 100, background: 'orange', borderRadius: 50 }
    ],
    animate: {
        loop: true,
        cycles() { return this.prevTargetValue.length - 1; },
        interval: 1000,
        value(cycle) {
            const move = this.prevTargetValue[cycle];
            const x = (this.getParentValue('width') - move.width) / 2;
            const y = (this.getParentValue('height') - move.height) / 2;
            this.setTarget({ ...move, x, y }, 30);
        },
        enabledOn() {
            return getEvents().getTouchCount() === 0;
        }
    },
    onSwipe() { 
        this.setTarget({ x: getEvents().swipeX(this), y: getEvents().swipeY(this) });
    }
}));
```

### Infinite Scrolling Example

This example demonstrates how to handle scroll events and implement a simple infinite scrolling application. The `containerOverflowMode` system target ensures that all items in the scroller overflow and stack beneath each other. The `children` target dynamically adds items to the container's children. The `onVisibleChildrenChange` event function detects changes in the visible children and activates the `children` target to create new items that fill the gaps. 

Internally, TargetJS maintains a tree-like structure to track the visible branches of the tree, optimizing the performance of the scroller. You can opt out of tree-structure optimization by setting `shouldBeBracketed` target to false.

Each item's width will start at 100px and expand to 250px over 15 steps, executed as quickly as the device allows. Simultaneously, the background will transition from yellow to purple in 15 steps, with each step occurring every 15 milliseconds.

If you inspect the HTML elements in the browser's developer tools, you'll notice that the scroller's elements are not nested inside the container. This is because nesting is another target that can dynamically control how elements are nested. This facilitates the reuse of HTML elements and opens the door to new user experiences.

![Single page app](https://targetjs.io/img/infiniteScrolling6.gif)

```bash
import { App, TModel, getEvents, getScreenHeight, getScreenWidth, } from "targetj";

App(new TModel({
    containerOverflowMode: 'always',
    children() { 
        const childrenCount = this.getChildren().length;
        return Array.from({ length: 10 }, (_, i) => 
            new TModel('scrollItem', {
                width: [{ list: [100, 250] }, 15],
                background: [{ list: ["#FCE961", "#B388FF"] }, 15, 15],              
                height: 32,
                color: '#C2FC61',
                textAlign: 'center',
                lineHeight: 32,               
                bottomMargin: 2,
                x() { return this.getCenterX(); },                
                html: childrenCount + i
            })
        ); 
    },          
    width() { return getScreenWidth(); },
    height() { return getScreenHeight(); },  
    onResize: [ 'width', 'height' ],
    onScroll() {
        this.setTarget('scrollTop', Math.max(0, this.getScrollTop() + getEvents().deltaY()));
    },
    onVisibleChildrenChange() { 
        if (getEvents().dir() !== 'up' && this.visibleChildren.length * 34 < this.getHeight()) {
            this.activateTarget('children');
        }
    }
}));
```

---

## Why TargetJS?

Imagine building a single-page web app using a unified approach for API integration, animations, event handling, and more—without having to manage asynchronous calls, loops, callbacks, promises, timeouts, state management, CSS, HTML attributes, tags, HTML nesting, and more. That’s what TargetJS offers: it simplifies the entire development process with a new, simplified approach.

---

## Integration with Existing Pages

It is possible to integrate TargetJS as a library into your existing page. TargetJS is designed to work as either a library or a framework. It was developed to be flexible and compatible with many libraries allowing you to enhance your page with minimal changes. You can find an example at the end of this page.

---

## Anatomy of a Target

Each target consists of the following:
1. Target Value and Actual Value. The target value refers to the value assigned to a variable or the output produced by the `value()` method associated with the target defined in your program. The actual value is the value used by the rest of the application. When the target value differs from the actual value, TargetJS iteratively updates the actual value until it matches the target value. This process is managed by two additional variables: `step`, which dictates the number of iterations, and `interval`, which specifies the duration (in milliseconds) the system waits before executing the next iteration.

2. State: Targets have four states that control their lifecycles: `active`, `inactive`, `updating`, and `complete`.
   - `active`: This is the default state for all targets. It indicates that the target is ready to be executed, and the target value needs to be initialized from the variable it represents or its `value()` method needs to be executed to calculate its output.
   - `inactive`: Indicates that the target is not ready to be executed.
   - `updating`: Indicates that the actual value is being adjusted to reach the target value.
   - `complete`: Indicates that the target execution is finished, and the actual value has matched the target value.

4. Target Methods: All methods are optional. They are used to control the lifecycle of targets or serve as callbacks to reflect changes. The controlling methods are: enabledOn, loop, steps, cycles. The callbacks are: onValueChange, onStepsEnd, onImperativeStep, onImperativeEnd. More details in the method section.

---

## How TargetJS Operates

All targets are in the active state by default and ready for execution unless explicitly set as inactive or their name is prefixed with an underscore (_). They can also include an enabledOn function that delays their execution until the specified conditions are met.

The target task monitors all active targets, and if a target is enabled, it will be executed. The target task executes active targets in the order they are defined in the program. The target value is generated either from the result of a method or from a static value defined in the target. For simple targets without steps, cycles, or loops, the actual value is set immediately based on the target value. Once executed, the target’s state becomes complete, and it will not be executed again.

If the target has loop or cycle methods defined, its value method will be re-executed. The number of executions will be determined by the cycles or will continue as long as the loop condition returns true. A pause can be inserted by setting the `interval`, which can be a fixed value defined as a property or dynamic, defined as a function.

If the target has steps defined, its state changes to updating, and the actual value is updated iteratively until it reaches the target value, according to the number of steps and pauses specified by `steps` and `intervals`.

A target can reactivate itself in the `onStepsEnd` callback once all steps are completed, or in the `onImperativeEnd` callback when all imperative targets initiated by that target are finished, allowing it to re-execute.

Targets can also be reactivated externally, either directly by calling activateTarget() or through user events.

---

## Target methods

All methods and properties are optional, but they play integral roles in making targets useful for animation, API loading, event handling, and more:

1. **value**
If defined, value is the primary target method that will be executed. The target value will be calculated based on the result of value().

2. **active**
This is only property. It indicates that the target is in an inactive state and is not ready to be executed. It must be activated first, for example, by a user event, before it can execute. You can also prefix the target name with '_' to achieve the same effect as setting active to false.

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
   - `onImperativeStep()`: This callback tracks the progress of imperative targets defined within a declarative target. If there are multiple imperative targets, this method is called at each step, identifiable by their target name. You can also use `on${targetName}Step` to track individual targets with their own callbacks. For example, `onWidthStep()` is called on each update of the `width` target.

11. **onImperativeEnd**
   - Similar to `onImperativeStep`, but it is triggered when an imperative target completes. If multiple targets are expected to complete, you can use `on${targetName}End` instead. For example, `onWidthEnd` is called when the `width` target gets completed.

13. **initialValue**
This is only property. It defines the initial value of the actual value.

14. **activateNextTarget**  
    This is a string property that specifies the target to be activated when this target executes. If the name ends with `$`, the target will only activate after the current target and all of its imperative targets have completed.

15. **Postfix `$` to the target name**  
    A target name ending with `$` indicates that it will be activated when the preceding target is executed or updated. It works similarly to `activateNextTarget`, but it only applies to the target that appears next to it.
    
16. **Postfix `$$` to the target name**  
    A target name ending with `$$` indicates that it will be activated only after the preceding target and all of its imperative targets have completed. It works similarly to `activateNextTarget` when it ends with `$`, but it applies only to the target immediately following it.
    
17. **this.prevTargetValue** and **this.isPrevTargetUpdated()**  
`this.prevTargetValue` holds the value of the previous target, while `this.isPrevTargetUpdated()` returns `true` if the previous target has been updated. This method is useful when a target is activated externally, such as by a user event, rather than by the preceding target.  

---

## More examples

Below are examples of various TargetJS use cases:

## Simple example

In the example below, we incrementally increase the values of width, height, and opacity in 30 steps, with a 50-millisecond pause between each step. You can view a live example here: https://targetjs.io/examples/overview.html.

![first example](https://targetjs.io/img/firstExample.gif)


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

It can also be written in a more compact form using arrays (view a live example at https://targetjs.io/examples/overview2.html):

```bash
import { App, TModel } from "targetj";

App(new TModel({
    background: '#fff',
    width: [ 250, 30, 50],
    height: [ 250, 30, 50],
    opacity: [ 0.15, 30, 50]
 }));
```

---

## Declarative and Imperative Targets Example

Targets in TargetJS can be defined in two ways: declaratively or imperatively.

The declarative approach offers a structured method for defining targets, as seen in the previous example. However, orchestrating multiple targets with varying speeds and timings can be challenging. For instance, tracking the completion of multiple targets to trigger a new set of targets is not easily done using only declarative targets. To address this, TargetJS provides the setTarget function, allowing you to define multiple imperative targets from within a single declarative target. Additionally, the onImperativeStep and onImperativeEnd callbacks, defined in the declarative target, enable you to track each step of the imperative targets or just their completion.

By combining both declarative and imperative targets, you gain a powerful toolset for designing complex interactions.

The following example demonstrates both declarative and imperative approaches. In the `animate` target, two imperative targets are set to move a square across the screen. Once both `x` and `y` targets are completed, the `animate` target will re-execute because `loop` is defined as `true`, causing it to continue indefinitely. Additionally, we can add `onImperativeEnd()` to trigger when either the `x` or `y` target completes. We can also use `onXEnd` or `onYEnd` to listen specifically for the completion of the `x` or `y` target, respectively.

![declarative example](https://targetjs.io/img/declarative.gif)

```bash
import { App, TModel, getScreenWidth, getScreenHeight } from "targetj";

App(
  new TModel("declarative", {
    children: {
      loop() { return this.getChildren().length < 10; },
      interval: 500,
      value: () =>
        new TModel("square", {
          width: 50,
          height: 50,
          background: "brown",
          animate: {
            loop: true,
            value() {
              const width = this.getWidth();
              const parentWidth = this.getParentValue("width");
              this.setTarget("x", { list: [-width, parentWidth + width] }, Math.floor(30 + parentWidth * Math.random()));
              this.setTarget("y", Math.floor(Math.random() * (this.getParentValue("height") - this.getHeight())), 30);
            }
          },
        }),
    },
    width: getScreenWidth,
    height: getScreenHeight
  })
);
```
---

## Another Loading Data Example

Calling backend APIs is simplified through the use of targets in TargetJS. It also provides a `Loader` class, as seen in the earlier example, which is accessible via `getLoader()`.

In the example below, we define a target named load. Inside the value function, we make the API call using fetch(). The second argument specifies the API URL, and the third argument contains the query parameters passed to the API. A fourth optional parameter, omitted in this example, can specify a cache ID if we want to cache the result. This cache ID can also be used to retrieve the cached data. If it’s not specified, the result will always come from the API. 

Once the API response is received, it activates the `children` target to create the user and add it to its children. Notice that `prevTargetValue` will have a different value in each occurrence.  

- In the `height` target, it reflects the `width` value.  
- In the `lineHeight` target, it reflects the `height` value.  
- In the `html` target, it holds the retrieved user value, as it is not inside a function and takes the value from `loader`.  

You can also define `onSuccess` and `onError` callbacks in `loader`, which will be executed based on the result returned.

![api loading example](https://targetjs.io/img/loadingExample2.gif)

```bash
import { App, TModel, getLoader, getScreenHeight, getScreenWidth, Moves } from "targetj";

App(new TModel("apiCall", {
    height() { return getScreenHeight(); },
    width: 250,
    load: {
      interval: 1000,
      cycles: 4,
      value: function (cycle) {
        getLoader().fetch(this, "https://targetjs.io/api/randomUser", { id: `user${cycle}` });
      }
    },
    _children$() {
      return new TModel("user", {
        width: [120, 50, 30],
        height$() { return this.prevTargetValue / 2; },
        lineHeight$() { return this.prevTargetValue; },
        html: this.prevTargetValue.name,        
        bottomMargin: 5,
        rightMargin: 5,
        textAlign: "center",
        backgroundColor: "#B388FF",
        overflow: "hidden"
      });
    }
}));
```
---

## Animation API Comparison Example

TargetJS provides efficient, easy-to-control UI animation and manipulation through special targets that reflect HTML style names, such as `width`, `height`, `scale`, `rotate`, and `opacity`. 

Below is a comparison between implementing animations in TargetJS versus using the Animation API. While the Animation API may still offer a slight performance edge, TargetJS comes very close.

![animation api example](https://targetjs.io/img/animationComparison2.gif)

```bash
import { App, TModel, getScreenHeight, getScreenWidth } from "targetj";

App(new TModel('compare', {
    domHolder: true,
    addAnimateChild() {
        this.addChild(new TModel('animation', {
            width: 150,
            height: 150,
            animate: {
                value() {
                    var keyframes = [{
                        transform: 'translate(0, 0) rotate(0deg) scale(1)',
                        width: '80px',
                        height: '80px',
                        background: 'orange'
                    }, {
                        transform: 'translate(50px, 100px) rotate(180deg) scale(1.5)',
                        width: '120px',
                        height: '120px',
                        background: 'brown'
                    }, {
                        transform: 'translate(150px, 0) rotate(360deg) scale(1)',
                        width: '100px',
                        height: '100px',
                        background: 'crimson'
                    }, {
                        transform: 'translate(0, 0) rotate(360deg) scale(1)',
                        width: '150px',
                        height: '150px',
                        background: 'purple'
                    }];

                    return this.$dom.animate(keyframes, {
                        duration: 4000, 
                        iterations: 1
                    });
                },
                enabledOn: function() {
                    return this.hasDom();
                }
            }
        }));
    },
    addDomChild() {
        this.addChild(new TModel('dom', {
            color: 'white',
            html: 'TargetJ',
            setup() {
                this.setTarget({ x: 200, y: 0, rotate: 0, scale: 1, width: 80, height: 80, background: 'orange' });
            },
            step1$() {
                this.setTarget({ x: 250, y: 100, rotate: 180, scale: 1.5, width: 120, height: 120, background: 'brown' }, 160);                
            },
            _step2$$() {
                this.setTarget({ x: 350, y: 0, rotate: 360, scale: 1, width: 100, height: 100, background: 'crimson' }, 160);                
            },            
            _step3$$() {
                this.setTarget({ x: 200, y: 0, rotate: 360, scale: 1, width: 150, height: 150, background: 'purple' }, 160);                
            }                                                   
        }));
    },
    _restartOnBothComplete$$() {
        this.getChild(0).activateTarget('animate');
        this.getChild(1).activateTarget('setup');
    },
    width() { return getScreenWidth(); },
    height() { return getScreenHeight(); }    
}));
```

---

## Simple Single Page App Example

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
---

## Using TargetJS as a Library Example

Here is an example that creates 1000 rows. The first argument, 'rows,' is used to find an element with the ID 'rows.' If no such element exists, it will be created at the top of the page. The OnDomEvent target activates the targets defined in its value when the DOM is found or created, eliminating the need for conditions to verify the DOM's availability before executing the target. Additionally, the parallel property creates subtasks, which improve browser performance.

The `rectTop`, `absY`, and `onWindowScroll` targets are used to track the visible rows during scrolling. TargetJS automatically divides a long list into a tree structure, efficiently managing only the visible branch. The `onWindowScroll` target updates the `absY` of the table, enabling TargetJS to identify the branch visible to the user. You can opt out of this algorithm by setting the `shouldBeBracketed` target to `false`.

![animation api example](https://targetjs.io/img/targetjsAsLibrary.gif) 

```bash
import { App, TModel, $Dom } from "targetj";

App(new TModel("rows", {
    isVisible: true,
    containerOverflowMode: "always",
    rectTop() { return this.$dom.getBoundingClientRect().top; },
    absY() { return this.prevTargetValue - $Dom.getWindowScrollTop(); },
    defaultStyling: false,
    domHolder: true,
    onDomEvent: ["rectTop", "absY"],
    onWindowScroll: "absY",
    createRows: {
        parallel: true,
        cycles: 9,
        value() {
            const childrenLength = this.getChildren().length;
            Array.from({length: 100}, (_, i) => {
                this.addChild(new TModel("row", {
                    keepEventDefault: true,
                    height: 36,
                    width: [{list: [100, 500, 200]}, 30],
                    background: "#b388ff",
                    canDeleteDom: false,
                    html: `row ${i + childrenLength}`,
                }));
            });
        }
    }
}));
```
---

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
5. **x** and **y*: Sets the location of the object.
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
21. 

---

## How to debug in TargetJS
1. TargetJS.tApp.stop(): Stops the application.
2. TargetJS.tApp.start(): Restarts the application
3. TargetJS.tApp.throttle: Slows down the application. This represents the pause in milliseconds before starting another TargetJS task cycle. It is zero by default.
4. TargetJS.tApp.debugLevel: Logs information about the TargetJS task cycle when set to 1. It is zero by default.
5. Use `t()` in the browser console to find an object by its oid, which corresponds to the ID of the HTML element..
6. Use `t(oid).bug()` to inspect all the vital properities of an object.
7. Use `t(oid).logTree()` to inspect the internal children structure including brackets of a container.

---
   
## Documentation
Explore the potential of TargetJS and dive into our interactive documentation at www.targetjs.io.

---

## License
Distributed under the MIT License. See LICENSE for more information.

---

## Contact
Ahmad Wasfi - wasfi2@gmail.com



