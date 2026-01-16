
# TODO
 * [x] annotations and bookmarks.
 * [x] add some tests
 * [x] have a default for autopause to true 
 * [x] cleanup the log for the annotations parsing
 * [x] can we reduce the ANNOTATION_THRESHOLD_MS
 * [x] find a better name (rehearseur)
 * [x] add some key shortcuts
       right arrow : skip to the next bookmark and pause
       left arrow : Go back to the previous bookmark and pause.
       space : play/pause
 * [x] update the title of the page with the title from the annotations
 * [x] it would be great to support hashtags in the url to go directly on a bookmark
   ( and modify the url according during replay) 
 * [x] add some tests for the annotations parsing
 * [x] github actions : add some linting a builder, etc...
 * [x] ask claude to suggest some refactorings.
 * [x] change the logo
 * [ ] changing the size of the page, kills the current position
 * [ ] the top of the page is not shown on firefox
 * [ ] add a timestamp display that you can copy/paste
 * [ ] improve a lot the tests so the harness is harder
 * [ ] We should make a video/annotations that makes more sense
 * [ ] We should have a video of the whole thing to demo in the readme
 * [ ] make the table of content refoldable
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
 * [ ] be able to export a packed version in one single html file (possible ?) that you can run no server needed.
 * [ ] be able to export a pdf with a screenshot of each bookmark/section on a page.
 * [ ] to show or not a bookmark in the progressbar and in the table of content.
 