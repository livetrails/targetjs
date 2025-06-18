# TargetJS: A Novel JavaScript UI Framework for Simplified Development and Enhanced User Experience

**[targetjs.io](https://targetjs.io)** 
[![MIT LICENSE](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/livetrails/targetjs/blob/main/LICENSE) 
[![Stars](https://img.shields.io/github/stars/livetrails/targetjs.svg)](https://github.com/livetrails/targetjs/stargazers)
[![npm version](https://img.shields.io/npm/v/targetj.svg)](https://www.npmjs.com/package/targetj)

TargetJS is a modern JavaScript UI framework that simplifies front-end development by introducing two new key concepts: unifying methods and variables, and reactive methods. It provides a unified solution for key aspects like UI rendering, animations, APIs, state management, and event handling. This integrated approach leads to more compact code and allows for a stronger focus on user experience. It can be used as a full-featured framework or as a lightweight library alongside other frameworks.
Furthermore, it is also a highly performant web framework, as shown in the [framework benchmark](https://krausest.github.io/js-framework-benchmark/current.html).

## Key Innovations and Concepts

1. Unifying Methods and Variables with Targets: A new construct called “targets” combines methods and variables, providing state, iteration, and timing mechanisms for both.
2. Declarative Reactive Targets: Targets can explicitly declare reactive execution triggered by the run or completion of their immediately preceding targets, whether synchronous or asynchronous.
3. All-in-One Solution: Offers a unified approach to UI rendering, API integration, state management, event handling, and animation.
4. Code-Ordered Execution: The execution flow generally follows the order in which the code is written.

## Examples

To demostrate the power and simplicity of TargetJS, let's explore its concepts through practical examples. We'll begin with a simple animation and incrementally expand it to demonstrate API integration, event handling, and dynamic UI updates.

### Growing and Shrinking Box: Declarative Animation

```javascript
import { App } from 'targetj';

App({
    background: 'mediumpurple',
    width: [{ list: [100, 250, 100] }, 50, 10], // width animates through 100 → 250 → 100, over 50 steps with 10ms interval
    height$() { // `$` creates a reactive target: `height` executes each time `width` updates
      return this.prevTargetValue / 2;
    } 
});
```

![first example](https://targetjs.io/img/git1.gif)

**Explanation**

Targets execute precisely in the order they are defined:

1. `background`: This target runs first, setting the element's background color to `mediumpurple`. Once the assignment is complete, its lifecycle ends.
2. `width`: Next, the `width` target takes over. It's configured to animate through a list of values (100, 250, 100), performing 50 steps with a 10ms pause between each step, creating a grow-then-shrink effect.
3. `height$`: Finally, the `height$` target demonstrates TargetJS's reactivity. Because its name ends with a single `$` postfix, `height$` is explicitly declared to react whenever its immediately preceding target (`width`) executes on every step. As `width` animates and changes its value, `height$` automatically re-runs, setting its value to half of width's value.

The example above can also be implemented directly in HTML, utilizing tg- attributes that mirror the object literal keys used in JavaScript:
   
```html 
<div
   tg-background="mediumpurple"
   tg-width="[{ list: [100, 250, 100] }, 50, 10]"
   tg-height$="return this.prevTargetValue / 2;">
</div>
```
Or a combination of JavaScript and HTML, linked together using the same HTML ID.

### Adding an API Call

Let's extend our previous example to demonstrate how TargetJS handles asynchronous operations. We'll fetch user details from an API, but we also want this API call to initiate only after the box animation has fully completed.

```javascript
import { App } from 'targetj';

App({
    background: 'mediumpurple',
    width: [{ list: [100, 250, 100] }, 50, 10],
    height$() { return this.prevTargetValue / 2; },
    fetch$$: 'https://targetjs.io/api/randomUser?id=user0', // `$$` ensures this runs only after width and height animation is complete
    html$() { // `$` ensures this runs when the API response is resolved
        return this.prevTargetValue.name; // `prevTargetValue` holds the result from the previous target (i.e., the API response)
    }
});
```

![second example](https://targetjs.io/img/git2.gif)

**Explanation**

This example introduces two new targets:

1. `fetch$$`: `fetch` target is a specialized target designed to retrieve data when given a URL string. Since its name ends with a `$$` postfix, as previously discussed, this indicates that `fetch$$` will activate only after preceding targets fully completed all of its operations. This guarantees the API call is initiated just after the animation finishes.

2.  `html$`: Following `fetch$$`, the `html` target is responsible for setting the text content of the `div` element to the fetched user's name. The `$` postfix here signifies that `html$` is a reactive target that executes each time its immediately preceding target (`fetch$$`) provides a result. In this context, `this.prevTargetValue` will hold the resolved data from the API call, allowing `html$` to dynamically display the user's name as soon as it's available.

Together, these targets orchestrate the flow: animation completes, then the API call happens, then the UI updates with the fetched data, all managed declaratively and in code order.

### Attaching a Click Handler

Let's expand our box further by adding a click handler. The goal is to change the box's background color to orange when clicked, pause for two seconds, and then revert the background back to its original mediumpurple.

```javascript
import { App } from 'targetj';

App({
    background: 'mediumpurple',
    width: [{ list: [100, 250, 100] }, 50, 10],
    height$() { return this.prevTargetValue / 2; },
    fetch$$: 'https://targetjs.io/api/randomUser?id=user0',
    html$() { return this.prevTargetValue.name; },
    onClick() { // Special target that runs when the element is clicked
        this.setTarget('background', 'orange', 30, 10); // Animates background to orange over 30 steps
    },
    pause$$: { interval: 2000 }, // `$$` ensures this runs only after the preceding 'onClick' animation is fully complete
    purpleAgain$$() { // `$$` ensures this runs only after `pause$$` completes (2-second interval)
        this.setTarget('background', 'mediumpurple', 30, 10); // Animates background back to mediumpurple
    }
});
```

![third example](https://targetjs.io/img/git3.gif)

**Explanation:**

1. `onClick`: This is a special TargetJS function that automatically runs whenever the associated element is clicked. Inside, `this.setTarget('background', 'orange', 30, 10)` imperatively triggers a new animation, changing the background color to orange over 30 steps.
2. `pause$$`: Notice the `$$` postfix. This `pause$$` target is configured with an interval of 2000 milliseconds (2 seconds). Crucially, its `$$` postfix means it will only begin its 2-second pause after its immediately preceding target (onClick) has fully completed its animation of changing the background to orange.
3. `purpleAgain$$`: Also ending with `$$`, this target executes only after the `pause$$` target has finished its 2-second execution. It then uses this.setTarget again to animate the background color back to `mediumpurple`.

This sequence demonstrates how TargetJS allows you to define complex, timed flow with a guaranteeing execution order.

### Let's Make it More Complicated :)

Let’s expand the previous example by creating 10 boxes instead of just one. Each box will be added with a slight delay (100ms) and undergo its own task from the previous example. Once all these individual box processes (creation, animation, and API calls) are complete, we'll trigger a final collective action: changing all their backgrounds to green.

```javascript
import { App } from 'targetj';

App({
    width: 500,
    children: { // A special target that adds a new list of childen each time it executes.
        cycles: 9, // Creates 10 children (from cycle 0 to 9)
        interval: 100, // Adds a new child every 100 milliseconds
        value(cycle) {
            return {
                baseWidth: 250,
                baseHeight: 125,
                background: 'mediumpurple',
                width: [{ list: [100, 250, 100] }, 50, 10],
                height$() { return this.prevTargetValue / 2; },
                fetch$$: `https://targetjs.io/api/randomUser?id=user${cycle}`,
                html$() { return this.prevTargetValue.name; },
                onClick() { this.setTarget('background', 'orange', 30, 10); },
                pause$$: { interval: 2000 },
                purpleAgain$$() { this.setTarget('background', 'mediumpurple', 30, 10); }
            };
        }
    },
    greenify$$() { // `$$` ensures this runs only after all children have completed all their tasks
        this.getChildren().forEach(child => child.setTarget("background", "green", 30, 10)); // Iterates and animates each child's background
    } 
});
```

![first example](https://targetjs.io/img/git4_1.gif)

**Explanation:**

This advanced example demonstrates TargetJS's capability to manage complex, dynamic UI scenarios:

1. `children`: A special target construct used to create a collection of child objects. Each time it executes, a new list objects is added to the parent. The `cycles` property specifies that the value function will run 10 times (from `cycle` 0 to 9), thus creating 10 individual box objects.
The `interval` property ensures that each new box is created and added to the UI every 100 milliseconds.
The `value(cycle)` function return the same object element from the previous example.

2. `greenify$$`: This target demonstrates the `$$` postfix's full completion reactivity at a higher level. The `greenify$$` target will execute only after the entire children target has comprehensively completed all of its work. This includes:

- The creation of all 10 child boxes.
- The completion of each individual child's width animation.
- The successful return of all 10 API calls (`fetch`) for each child.
- The population of all user names (`html`) for each child.

Only when all tasks initiated by children are finished will `greenify$$` runs. It then uses `this.getChildren().forEach(child => child.setTarget("background", "green", 30, 10))` to iterate over all the created child boxes and animate their backgrounds to green.

## Table of Contents

1. [Targets: The Building Blocks of TargetJS](#targets-the-building-blocks-of-targetjs)
2. [Understanding TargetJS Syntax: Reactive Postfixes](#understanding-targetjs-syntax-reactive-postfixes)
3. [📦 Installation](#-installation)
6. [What Problems Does TargetJS Solve?](#what-problems-does-targetjs-solve)
9. [Target Methods](#target-methods)
10. [Target Variables](#target-variables)
11. More Examples:
    - [Basic Example](#basic-example)
    - [Loading Two Users Example](#loading-two-users-example)
    - [Declarative and Imperative Targets Example](#declarative-and-imperative-targets-example)
    - [Infinite Loading and Scrolling Example](#infinite-loading-and-scrolling-example)
12. [Special Target Names](#special-target-names)
13. [How to Debug in TargetJS](#how-to-debug-in-targetjs)
14. [Documentation](#documentation)
15. [License](#license)
16. [Contact](#contact)
17. [💖 Support TargetJS](#-support-targetjs)

## Targets: The Building Blocks of TargetJS

Targets provide a unified interface for both variables and methods. Each Target comes equipped with a built-in set of capabilities:

1. State Management: Targets are inherently stateful, enabling implicit state handling across your application.
2. Iterations: They can iterate towards defined values, making them perfect for creating animations.
3. Multiple or Conditional Execution: Targets can execute repeatedly or only under specific conditions.
4. Execution timing: Targets enable fine-grained control over when they execute.
5. Code-Ordered Execution: Targets execute sequentially and predictably in the order they are written within a JavaScript object, thanks to ES2015's guaranteed property order.

## Understanding TargetJS Syntax: Reactive Postfixes

TargetJS uses the postfixes `$` and `$$` appended to target names for defining reactive behaviors. While initially appearing a bit cryptic, this convention provides a compact syntax.

**`$` Postfix (Immediate Reactivity):**

A target name ending with a single `$` (e.g., `height$`) indicates that this target will execute every time its immediately preceding target runs or emits a new value. If the preceding target involves an asynchronous operation like an API call, the reactive target activates when the response is received. If there are multiple API calls made, `$` postfix ensures that the target reacts to the first API result when it becomes available, then the second, and so on, maintaining a strict, code-ordered sequence of operations.

**`$$` Postfix (Full Completion Reactivity):**

A target name ending with a double `$$` (e.g., `fetch$$`) will activate only after its immediately preceding targets have fully and comprehensively completed all of their operations. This includes:

- The successful resolution of any timed sequences, such as animations.
- The completion and return of results from all associated API calls.
- The finalization of all tasks, animations, and API calls initiated by any dependent child targets that were themselves triggered by a preceding target.


## **📦 Installation**

**Via CDN**

Add the following `<script>` tag to your HTML to load TargetJS from a CDN (only 44KB compressed):

```html
<script src="https://ltstaticfiles.s3.us-east-1.amazonaws.com/targetjs.js"></script>
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

3. **this.value**
Represents the current value of the target.
    
## More Examples

Below are examples of various TargetJS use cases:

## Basic Example

The examples below demonstrate different formats for writing target constructs. In each example, the values of `width`, `height`, and `opacity` are incrementally increased over 30 steps, with a 50ms pause between each step. 
You can view a live example here: https://targetjs.io/examples/overview.html.

![first example](https://targetjs.io/img/basic1_3.gif)

**Object**

```javascript
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

```javascript
import { App } from "targetj";

App({
    background: 'mediumpurple',
    width: [ 250, 30, 50], 
    height: [ 250, 30, 50],
    opacity: [ 0.15, 30, 50]
 });
```
**Imperative** (more in the next example)

```javascript
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

```javascript
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

## Loading Two Users Example

In this example, we load two separate users and display two purple boxes, each containing a user's name, based on our first example.

- `fetch` calls two APIs to retrieve details for two users.
- `children` is a special target that adds new items to the parent each time it executes. Because it ends with $, it executes every time an API call returns a result.
- TargetJS ensures that API results are processed in the same sequence as the API calls. For example, if the user1 API result arrives before user0, `children` will not execute until the result for user0 has been received.
  
![first example](https://targetjs.io/img/quick3_1.gif)

```javascript
import { App, fetch } from "targetj";

App({
    fetch: ['https://targetjs.io/api/randomUser?id=user0', 'https://targetjs.io/api/randomUser?id=user1'],
    children$() {
      return {
        background: "mediumpurple",
        html: this.prevTargetValue.name,
        width: [{ list: [100, 250, 100] }, 50, 10],
        height$() { return this.prevTargetValue / 2; },
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

## Declarative and Imperative Targets Example

Targets in TargetJS can be defined in two ways: declaratively or imperatively.

The declarative approach offers a structured method for defining targets, as seen in the previous example. However, orchestrating multiple targets with varying speeds and timings can be challenging. For instance, tracking the completion of multiple targets to trigger a new set of targets is not easily done using only declarative targets. To address this, TargetJS provides the setTarget function, allowing you to define multiple imperative targets from within a single declarative target. Additionally, the onImperativeStep and onImperativeEnd callbacks, defined in the declarative target, enable you to track each step of the imperative targets or just their completion.

By combining imperative and declarative targets with their functional pipeline, you gain a powerful toolset for designing complex interactions.

The following example demonstrates both declarative and imperative approaches. In the `animateLeftToRight` target, two imperative targets move a square across the screen 
from left to right. Once both `x` and `y` targets are completed, `animateLeftToRight` is considered complete. The `animateRightToLeft` target executes next because 
it is postfixed with `$$`, forming a pipeline that begins once the preceding target and all its imperative targets are complete. Similarly, the `waitOneSecond` target executes when `animateLeftToRight` completes,
introducing a 1-second pause. After that, `repeat` is executed, reactivating the animation pipeline and allowing the animation to continue indefinitely.

![declarative example](https://targetjs.io/img/declarative3.gif)

```javascript
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
          animateRightToLeft$$() {
            const width = this.getWidth();
            const parentWidth = this.getParentValue("width");
            this.setTarget("x", { list: [parentWidth + width, -width] }, 300);
          },
          waitOneSecond$$: {
            interval: 1000,
          },
          repeat$$() {
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
        tg-right2left$$="function() {
          const width = this.getWidth();
          const parentWidth = this.getParentValue('width');
          this.setTarget('x', { list: [ parentWidth + width, -width ] }, 400);
        }"
        tg-onesecond$$="function() {
          this.setTarget('1second', 1, 1, 1000);
        }"
        tg-repeat$$="function() {
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

```javascript
import { App, getEvents, fetch, getScreenWidth, getScreenHeight } from "targetj";

App({
    id: "scroller",
    domHolder: true,
    preventDefault: true,
    containerOverflowMode: "always",
    children() {
        const childrenCount = this.getChildren().length;
        return Array.from({ length: 20 }, (_, i) => ({
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
    load$() {
        this.prevTargetValue.forEach(data =>
            fetch(this, "https://targetjs.io/api/randomUser", { id: data.oid }));
    },
    populate$$() {
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
  tg-load$="function() {
    this.prevTargetValue.forEach(data =>
      TargetJS.fetch(this, 'https://targetjs.io/api/randomUser', { id: data.oid })
    );
  }"
  tg-populate$$="function() {
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
