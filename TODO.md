
# TODO
 * [x] annotations and bookmarks.
       I am interested in adding the following functionalites :
       - added an extra markdown file with "annotated" events that I am going to add.
       - the annotated events, will result in a number of things :
               * they can be a named bookmark in the progress bar. We will find the way to present the bookmark in a table of content.
               * It would be great if the table of content could be organised in a hierarchical way. 
               * on some bookmarks, the progress/play will stop
               * on some bookmarks, we will be able to use driver js to highlight some parts of the display or show some notes.  )
example of a markdown annotation file:

---
version: 1
title: demonstrating pyodide        
---
## Annotation: Creating a new cell {#intro}
---
timestamp: 5000
color: `#2196F3`
autopause: true
---

```driverjs
driverObj.highlight({
  element: '.jp-NotebookPanel-toolbar button',
  popover: {
    title: 'Title for the Popover',
    description: 'Description for it',
  },
});
```
 * [x] add some tests
 * [ ] improve a lot the tests so the harness is harder
 * [ ] find a better name
 * [ ] We should make a video that makes more sense
 * [ ] cleanup the log for the annotations parsing
 * [ ] add some key shortcuts
 * [ ] ask claude to suggest some refactorings.
 * [ ] make the table of content refoldable
 * [ ] have a default for autopause to true
 * [ ] when one clicks on drive.js annotation, the play should start again directly
 * [ ] annotations and bookmarks should be generated using genai. How will the model be able to read the json.
     we need to package the current project in two parts:
       - typescript library.
       - a cursor template project for quickstarts
     then create a video/demo of how to do that.
 * [ ] try again to leverage more claude/cursor by converting the json to toon, 
       adding a semantic database on top of the json/toon recording file etc...
       so claude/cursor can modify the json stream directly. The creation of the annotation file should be easy in
       claude/cursor. It means we should be able to read the recording json easily.Maybe we could build a summary.
 * [ ] change the logo
 * [ ] add some linting a builder, github actions etc...
 * [ ] package the code into 
 