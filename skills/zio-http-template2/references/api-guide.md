# Template2 API Reference

Complete reference for ZIO HTTP template2 HTML DSL.

## Table of Contents

1. [Imports](#imports)
2. [Core Dom Types](#core-dom-types)
3. [HTML Elements](#html-elements)
4. [Partial Attributes](#partial-attributes)
5. [Boolean Attributes](#boolean-attributes)
6. [Multi-Value Attributes](#multi-value-attributes)
7. [Special Attributes](#special-attributes)
8. [Script Elements](#script-elements)
9. [Style Elements](#style-elements)
10. [Form Elements](#form-elements)
11. [Rendering and Integration](#rendering-and-integration)

---

## Imports

```scala
// All-in-one import for template2
import zio.http.template2._

// This includes:
// - All HTML elements (html, body, div, span, p, etc.)
// - All HTML attributes (id, class, href, etc.)
// - Css and Js interpolators
// - Dom types and utilities
```

---

## Core Dom Types

### Dom (Sealed Trait)

Base trait for all DOM nodes:

```scala
sealed trait Dom extends Modifier {
  def render: String                           // Render to compact HTML
  def render(indentation: Boolean): String    // Render with optional formatting
  def renderMinified: String                  // Render to minified HTML
  def transform(f: Dom => Dom): Dom           // Apply transformation function
  def find(predicate: Dom => Boolean): Option[Dom]      // Find first matching node
  def collect(predicate: PartialFunction[Dom, Dom]): List[Dom]  // Collect all matching nodes
  def filter(predicate: Dom => Boolean): Dom           // Filter nodes recursively
  def isEmpty: Boolean                        // Check if content is empty
}
```

### Dom.Element

Represents an HTML element:

```scala
case class Dom.Element private (
  tag: String,
  attributes: Map[String, String],
  children: List[Dom]
) extends Dom {
  def apply(modifiers: Modifier*): Dom.Element      // Add modifiers (attributes/children)
  def attr(name: String, value: String): Dom.Element  // Add or update attribute
  def addAttributes(attrs: Iterable[Dom.Attribute]): Dom.Element
  def addChildren(children: Iterable[Dom]): Dom.Element
  def removeAttr(name: String): Dom.Element
  def when(condition: Boolean)(mods: Modifier*): Dom.Element  // Conditional modifiers
  def whenSome[A](opt: Option[A])(f: A => Iterable[Modifier]): Dom.Element
}
```

### Dom.Text

Plain text content:

```scala
case class Dom.Text(content: String) extends Dom
```

### Dom.Fragment

Multiple DOM nodes grouped together:

```scala
case class Dom.Fragment(children: Iterable[Dom]) extends Dom
```

### Dom.Empty

No content (empty node):

```scala
object Dom.Empty extends Dom
```

### Modifier

Trait for things that can be applied to elements:

```scala
sealed trait Modifier {
  def modify(element: Dom.Element): Dom.Element
}
```

---

## HTML Elements

All standard HTML elements are available as Scala functions. Common categories:

### Structural & Semantic Elements

| Element | Usage | Void? |
|---------|-------|-------|
| `html()` | Root element | No |
| `head()` | Document head | No |
| `body()` | Document body | No |
| `header()` | Header section | No |
| `footer()` | Footer section | No |
| `nav()` | Navigation | No |
| `main()` | Main content | No |
| `article()` | Article content | No |
| `section()` | Thematic section | No |
| `aside()` | Sidebar/tangential | No |

### Text Content

| Element | Usage | Void? |
|---------|-------|-------|
| `p()` | Paragraph | No |
| `div()` | Generic container | No |
| `span()` | Inline container | No |
| `h1()...h6()` | Headings 1-6 | No |
| `blockquote()` | Block quote | No |
| `pre()` | Preformatted text | No |
| `code()` | Code snippet | No |
| `strong()` | Strong emphasis | No |
| `em()` | Emphasis | No |
| `mark()` | Marked/highlighted | No |
| `small()` | Small text | No |

### Lists

| Element | Usage | Void? |
|---------|-------|-------|
| `ul()` | Unordered list | No |
| `ol()` | Ordered list | No |
| `li()` | List item | No |
| `dl()` | Description list | No |
| `dt()` | Description term | No |
| `dd()` | Description details | No |

### Tables

| Element | Usage | Void? |
|---------|-------|-------|
| `table()` | Table container | No |
| `thead()` | Table head | No |
| `tbody()` | Table body | No |
| `tfoot()` | Table footer | No |
| `tr()` | Table row | No |
| `th()` | Table header cell | No |
| `td()` | Table data cell | No |
| `caption()` | Table caption | No |
| `col()` | Column metadata | Yes |
| `colgroup()` | Column group | No |

### Forms

| Element | Usage | Void? |
|---------|-------|-------|
| `form()` | Form container | No |
| `label()` | Form label | No |
| `input()` | Input field | Yes |
| `textarea()` | Multi-line text | No |
| `button()` | Button | No |
| `select()` | Dropdown list | No |
| `option()` | Dropdown option | No |
| `optgroup()` | Option group | No |
| `fieldset()` | Group controls | No |
| `legend()` | Fieldset title | No |

### Media

| Element | Usage | Void? |
|---------|-------|-------|
| `img()` | Image | Yes |
| `audio()` | Audio content | No |
| `video()` | Video content | No |
| `source()` | Media source | Yes |
| `track()` | Media track | Yes |
| `canvas()` | Canvas graphics | No |
| `svg()` | SVG graphics | No |

### Metadata & Document Structure

| Element | Usage | Void? |
|---------|-------|-------|
| `title()` | Document title | No |
| `meta()` | Metadata | Yes |
| `link()` | External resource | Yes |
| `base()` | Base URL | Yes |
| `style()` | Inline styles | No |
| `script()` | JavaScript | No |

### Interactive

| Element | Usage | Void? |
|---------|-------|-------|
| `details()` | Collapsible details | No |
| `summary()` | Details summary | No |
| `dialog()` | Dialog box | No |

---

## Partial Attributes

Partial attributes require a value. Use `:=` or `apply()`:

```scala
// Common partial attributes
id := "main"
href := "https://example.com"
src := "image.jpg"
alt := "Description"
name := "field-name"
value := "field-value"
placeholder := "Enter text..."
action := "/submit"
method := "POST"
type := "text"
min := "0"
max := "100"
rows := "5"
cols := "40"
htmlFor := "input-id"
role := "navigation"
title := "Tooltip text"
contentEditable := "true"
```

---

## Boolean Attributes

Boolean attributes represent on/off states. Just name them with no value:

```scala
// Common boolean attributes
required
disabled
autofocus
readonly
checked
selected
async
defer
ismap
declare
compact
noresize
nowrap
autoplay
controls
loop
muted
multiple
```

---

## Multi-Value Attributes

### Class and Classname

Space-separated CSS classes:

```scala
// Tuple syntax
className := ("container", "active", "large")

// Alternative
`class` := ("btn", "btn-primary")

// List/Iterable
className := List("card", "shadow")

// Single class
className := "container"
```

### Style Attribute

Semicolon-separated CSS properties:

```scala
styleAttr := "color: red; font-size: 14px"

// Or use the css interpolator
style.inlineCss(css"""
  color: red;
  font-size: 14px;
""")
```

### Data Attributes

Create custom data-* attributes:

```scala
data("id") := "12345"
data("role") := "admin"
data("tags") := ("react", "scala")
```

Renders as:
```html
<div data-id="12345" data-role="admin" data-tags="react,scala"></div>
```

### Aria Attributes

Accessibility attributes:

```scala
ariaLabel := "Close menu"
ariaExpanded := true
ariaHidden := true
role := "button"
```

---

## Special Attributes

### Dynamic Attribute Creation

For custom or non-standard attributes:

```scala
Dom.attr("x-data") := "{count: 0}"
Dom.attr("onclick") := js"handleClick()"
Dom.attr("custom-attr") := "value"
```

### Conditional Attributes

Apply attributes conditionally:

```scala
div(id := "main")
  .when(isActive)(`class` := "active")
  .when(isDisabled)(Dom.attr("disabled") := "")

// With Option
div(id := "user")
  .whenSome(userRole) { role =>
    Seq(data("role") := role)
  }
```

### Attribute Manipulation

```scala
val element = div(id := "myDiv")

// Update attribute
element.attr("title", "My Title")

// Add multiple
element.addAttributes(Seq(
  data("id") := "123",
  data("type") := "product"
))

// Remove attribute
element.removeAttr("title")
```

---

## Script Elements

### Inline JavaScript

```scala
script.inlineJs(js"""
  console.log('Hello');
  document.addEventListener('load', function() {
    console.log('Ready');
  });
""")
```

### External JavaScript

```scala
script.externalJs("https://cdn.example.com/lib.js")

// With attributes
script
  .externalJs("/app.js")
  .async
  .defer
  .integrity("sha384-hash")
  .crossOrigin("anonymous")
```

### ES6 Modules

```scala
script.externalModule("/js/app.js")
// Renders as: <script src="/js/app.js" type="module"></script>
```

### Script Attributes

```scala
.async          // Loads asynchronously
.defer          // Defers execution until DOM parsed
.integrity()    // Subresource integrity hash
.crossOrigin()  // CORS attribute
```

---

## Style Elements

### Inline CSS

```scala
style.inlineCss(css"""
  body {
    margin: 0;
    font-family: sans-serif;
  }
  .container {
    max-width: 1200px;
  }
""")
```

### External CSS

```scala
link(rel := "stylesheet", href := "https://example.com/styles.css")

// From resources
style.inlineResource("styles/main.css")
```

---

## Form Elements

### Basic Input Types

```scala
input(`type` := "text", name := "username")
input(`type` := "email", name := "email", required)
input(`type` := "password", name := "pwd")
input(`type` := "number", name := "age", min := "0", max := "120")
input(`type` := "checkbox", name := "agree")
input(`type` := "radio", name := "choice", value := "a")
input(`type` := "file", name := "upload")
input(`type` := "range", name := "volume", min := "0", max := "100")
input(`type` := "date", name := "birthday")
input(`type` := "time", name := "appointment")
```

### Validation Attributes

```scala
input(
  `type` := "text",
  required,          // Field required
  minlength := "3",  // Minimum characters
  maxlength := "50", // Maximum characters
  pattern := "[A-Z]+", // Regex pattern
  placeholder := "Enter text"
)

// Number validation
input(
  `type` := "number",
  min := "0",
  max := "100",
  step := "5"
)
```

### Select Dropdowns

```scala
select(name := "country")(
  option(value := "")("-- Select --"),
  option(value := "us")("United States"),
  option(value := "uk")("United Kingdom"),
  option(value := "ca")("Canada")
)

// With grouped options
select(name := "fruit")(
  optgroup(label := "Citrus")(
    option("Orange"),
    option("Lemon")
  ),
  optgroup(label := "Berries")(
    option("Strawberry"),
    option("Blueberry")
  )
)
```

### Textarea

```scala
textarea(
  name := "bio",
  rows := "5",
  cols := "40",
  placeholder := "Tell us about yourself"
)("")
```

### Form Buttons

```scala
button(`type` := "submit")("Submit")
button(`type` := "reset")("Clear")
button(`type` := "button")("Click Me")

// Button with attributes
button(
  `class` := ("btn", "btn-primary"),
  disabled
)("Disabled Button")
```

---

## Rendering and Integration

### Basic Rendering

```scala
val page: Dom = html(
  head(title("Home")),
  body(h1("Welcome"))
)

// Compact HTML
val html: String = page.render

// Formatted HTML
val pretty: String = page.render(indentation = true)

// Minified HTML
val minified: String = page.renderMinified
```

### ZIO HTTP Integration

#### Route Handler

```scala
val routes = Routes(
  Method.GET / "home" -> handler {
    Response.html(page)
  }
)
```

#### Endpoint API

```scala
val endpoint: Endpoint[Unit, Unit, ZNothing, Dom, None] =
  Endpoint(Method.GET / Root)
    .out[Dom](MediaType.text.`html`)

val route = endpoint.implementHandler(
  handler((_: Unit) => page)
)
```

---

## Common Patterns

### Building Component Functions

```scala
def badge(text: String, variant: String = "default"): Dom.Element =
  span(`class` := (s"badge", s"badge-$variant"))(text)

def card(title: String, content: Dom): Dom.Element =
  div(`class` := "card")(
    div(`class` := "card-header")(h3(title)),
    div(`class` := "card-body")(content)
  )

// Usage
badge("New", variant = "success")
card("Title", p("Content here"))
```

### Conditional Rendering

```scala
def userGreeting(user: Option[String]): Dom =
  user.map(name => p(s"Welcome, $name!"))
    .getOrElse(p("Please log in"))

// Or using if/else
def nav(isLoggedIn: Boolean): Dom.Element =
  if (isLoggedIn)
    a(href := "/logout")("Logout")
  else
    a(href := "/login")("Login")
```

### Mapping Collections

```scala
val items = List("Item 1", "Item 2", "Item 3")

ul(
  items.map(item => li(item))
)

// With indices
ol(
  items.zipWithIndex.map { case (item, idx) =>
    li(id := s"item-$idx")(item)
  }
)
```

---

## Type Aliases and Implicits

Template2 provides implicit conversions:

```scala
// String → Dom.Text
// Option[String] → Dom (Some renders as text, None renders as empty)
// Option[Dom] → Dom
// Iterable[Dom] → Dom.Fragment
// List[Dom] → Dom.Fragment
```

These allow natural, intuitive code:

```scala
div(
  "Text content",                      // String → Dom.Text
  None,                                // Option[String] → Dom.Empty
  Some(p("Paragraph")),                // Option[Dom] → p element
  List(span("a"), span("b"))           // Iterable[Dom] → Fragment
)
```
