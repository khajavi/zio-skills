---
name: zio-http-template2
description: >
  Use when building web applications with ZIO HTTP using template2 (HTML templating DSL).
  Also use when: building HTML pages in Scala, creating reusable UI components, adding forms
  to ZIO HTTP apps, styling elements with CSS classes, conditionally rendering content based
  on data, integrating JavaScript or CSS into pages, serving HTML from route handlers or
  Endpoint APIs. Template2 is a type-safe, composable HTML DSL that lets you write HTML
  directly in Scala with full compile-time checking.
tags: [zio, zio-http, template2, html, dsl, scala, web, ui, forms, components]
---

# Build Type-Safe Web Pages with ZIO HTTP Template2

Template2 is a modern, composable HTML DSL for Scala that brings compile-time safety and composability to web page building. Write HTML directly in Scala code without separate template files or string interpolation.

## Why Template2?

- **Type Safety**: Catch HTML errors at compile time
- **Composability**: Build reusable components as Scala functions
- **Pure Scala**: Everything is Scala code—no separate template language to learn
- **Integrated with ZIO HTTP**: Seamlessly serve pages from routes and Endpoints

---

## Step 1 — Import and Render

### Basic Setup

To use template2, import the package object:

```scala
import zio.http.template2._
```

This single import gives you access to all HTML elements, attributes, and utilities.

### Creating Your First Page

```scala
val page: Dom =
  html(
    head(title("Hello World")),
    body(
      h1("Hello, ZIO HTTP!"),
      p("This is my first template.")
    )
  )
```

### Rendering and Serving

Render the page to an HTML string:

```scala
page.render                    // Compact HTML
page.render(indentation = true) // Pretty-printed HTML
```

Serve it from a ZIO HTTP route:

```scala
Method.GET / "home" -> handler {
  Response.html(page)
}
```

The `Response.html()` method automatically renders the `Dom` and sets the `Content-Type` header to `text/html`.

### Key Types

- **`Dom`** — The sealed trait representing HTML elements, text, fragments, or empty content
- **`Response.html(dom: Dom)`** — Creates an HTTP response with the rendered HTML

---

## Step 2 — Attributes and Children

Template2 supports three types of attributes. Understanding them prevents a common source of agent confusion.

### Partial Attributes (Require Values)

Partial attributes must be given a value. Use `:=` operator or the apply method:

```scala
// Using := operator
div(
  id := "main",
  href := "https://example.com",
  name := "username"
)

// Using apply() method (equivalent)
div(
  id("main"),
  href("https://example.com"),
  name("username")
)
```

### Boolean Attributes (Presence/Absence)

Boolean attributes represent on/off states. Just name them—no value needed:

```scala
input(
  required,      // Renders as: required
  autofocus,     // Renders as: autofocus
  disabled       // Renders as: disabled
)
```

Renders as:
```html
<input required autofocus disabled/>
```

### Multi-Value Attributes ⭐ (Space vs Comma Separated)

Multi-value attributes handle multiple values. **CSS classes are space-separated; styles and data are comma-separated or semicolon-separated.**

```scala
// CSS classes (space-separated by default)
div(
  className := ("container", "active", "large")
)
// Renders as: <div class="container active large"></div>

// Alternative syntax
div(
  `class` := ("btn", "btn-primary")
)

// From a List or Iterable
val classes = List("card", "shadow")
div(className := classes)

// Inline styles (semicolon-separated)
div(
  styleAttr := "color: red; font-size: 14px"
)
// Renders as: <div style="color: red; font-size: 14px"></div>

// Custom separators for data attributes
div(
  data("tags") := ("react", "scala", "functional") // comma-separated
)
```

**Common mistake**: Passing a string instead of a tuple:
```scala
// ❌ WRONG
div(className := "container active")

// ✅ CORRECT
div(className := ("container", "active"))
```

### Mixing Attributes and Children

You can mix attributes and children in the same `apply()` call:

```scala
div(
  id := "main",
  `class` := "container",
  p("First paragraph"),      // Child
  data("section") := "intro", // Attribute
  p("Second paragraph")       // Child
)
```

Or separate them for clarity:

```scala
div(
  id := "main",
  `class` := "container",
  data("section") := "intro"
)(
  p("First paragraph"),
  p("Second paragraph")
)
```

Both render to:
```html
<div id="main" class="container" data-section="intro">
  <p>First paragraph</p>
  <p>Second paragraph</p>
</div>
```

---

## Step 3 — Void Elements

Void elements are self-closing HTML elements that cannot have children. Attempting to add children to void elements causes a compile error.

### Void Element List

Common void elements: `br`, `hr`, `input`, `img`, `meta`, `link`, `area`, `base`, `col`, `embed`, `source`, `track`, `wbr`

### Correct Void Element Usage

```scala
// ✅ CORRECT - Use attributes to convey meaning
img(
  src := "photo.jpg",
  alt := "A scenic photo"
)
// Renders as: <img src="photo.jpg" alt="A scenic photo"/>

input(
  `type` := "text",
  name := "username",
  placeholder := "Enter username"
)
// Renders as: <input type="text" name="username" placeholder="Enter username"/>

// ❌ WRONG - Void elements cannot have children
// img(src := "photo.jpg")("image description")  // COMPILE ERROR
```

**Key principle**: For void elements, all information goes in attributes, not in children.

---

## Step 4 — Conditional Rendering

Build dynamic pages that show different content based on data. Template2 provides multiple patterns for conditional rendering.

### Using if/else

```scala
val isLoggedIn: Boolean = true

def navbar: Dom.Element =
  nav(
    if (isLoggedIn)
      ul(
        li(a(href := "/dashboard")("Dashboard")),
        li(a(href := "/logout")("Logout"))
      )
    else
      ul(
        li(a(href := "/login")("Login")),
        li(a(href := "/signup")("Sign Up"))
      )
  )
```

### Using Option.map for Optional Content

When you have `Option[T]`, use `.map` to conditionally render:

```scala
case class User(name: String, email: Option[String], avatar: Option[String])

def userCard(user: User): Dom.Element =
  div(`class` := "user-card")(
    h3(user.name),
    user.email.map(email => p(s"Email: $email")),  // Renders only if Some
    user.avatar.map(url => img(src := url))         // Optional image
  )
```

**Key insight**: `Option[Dom]` is implicitly converted to `Dom`. If the Option is `None`, it renders as nothing (`Dom.Empty`).

### Conditional Attributes with .when()

Apply attributes conditionally:

```scala
val isActive: Boolean = true

div(
  id := "container"
).when(isActive)(
  `class` := "active",
  ariaExpanded := true
)
```

Renders as: `<div id="container" class="active" aria-expanded="true"></div>` when `isActive` is true.

### Conditional Attributes with .whenSome()

Apply attributes when an Option is Some:

```scala
val maybeEmail: Option[String] = Some("user@example.com")

div(
  id := "user"
).whenSome(maybeEmail) { email =>
  Seq(
    data("email") := email,
    titleAttr := s"User: $email"
  )
}
```

### Using Dom.empty

Explicitly render nothing:

```scala
div(
  if (showMessage) p("Important message") else Dom.empty
)
```

---

## Step 5 — Reusable Components

Build reusable UI components using Scala functions. A component is simply a function that returns `Dom.Element`.

### Simple Button Component

```scala
def button(text: String, variant: String = "primary"): Dom.Element =
  button(
    `class` := (s"btn", s"btn-$variant"),
    role := "button"
  )(text)

// Usage
button("Click Me")                    // btn-primary (default)
button("Cancel", variant = "danger")  // btn-danger
```

### Card Component with Optional Sections

```scala
def card(
  title: Option[String] = None,
  footer: Option[Dom] = None,
)(content: Dom*): Dom.Element = {
  div(`class` := "card")(
    title.map(t => div(`class` := "card-header")(h5(t))),
    div(`class` := "card-body")(content),
    footer.map(f => div(`class` := "card-footer")(f))
  )
}

// Usage
card(
  title = Some("User Profile"),
  footer = Some(button("Save"))
)(
  p("Name: John Doe"),
  p("Email: john@example.com")
)
```

### Form Input Component

```scala
def formInput(
  label: String,
  inputType: String = "text",
  required: Boolean = false,
  placeholder: Option[String] = None
): Dom.Element =
  div(`class` := "form-group")(
    label(htmlFor := label.toLowerCase)(label),
    input(
      `type` := inputType,
      id := label.toLowerCase,
      name := label.toLowerCase,
      placeholder := placeholder.getOrElse(""),
      if (required) Some(scala.reflect.classTag[Unit]).flatMap(_ => Some(Dom.attr("required") := "")) else Dom.empty
    )
  )
```

**Better approach using `.when()`:**

```scala
def formInput(
  label: String,
  inputType: String = "text",
  required: Boolean = false,
  placeholder: Option[String] = None
): Dom.Element = {
  val inp = input(
    `type` := inputType,
    id := label.toLowerCase,
    name := label.toLowerCase
  ).when(required)(Dom.attr("required") := "")
  
  div(`class` := "form-group")(
    label(htmlFor := label.toLowerCase)(label),
    placeholder.fold(inp)(p => inp.attr("placeholder", p))
  )
}
```

---

## Step 6 — Forms and Input Patterns

Forms are a fundamental part of web applications. Template2 makes it easy to build properly structured forms.

### Basic Form Structure

```scala
val loginForm: Dom.Element =
  form(
    action := "/login",
    method := "POST"
  )(
    div(`class` := "form-group")(
      label(htmlFor := "username")("Username"),
      input(
        `type` := "text",
        id := "username",
        name := "username",
        required,
        placeholder := "Enter username"
      )
    ),
    div(`class` := "form-group")(
      label(htmlFor := "password")("Password"),
      input(
        `type` := "password",
        id := "password",
        name := "password",
        required,
        placeholder := "Enter password"
      )
    ),
    button(
      `type` := "submit",
      `class` := "btn btn-primary"
    )("Login")
  )
```

### Input Types and Validation Attributes

```scala
form(
  input(
    `type` := "email",
    name := "email",
    required,
    placeholder := "you@example.com"
  ),
  input(
    `type` := "number",
    name := "age",
    min := "18",
    max := "100"
  ),
  textarea(
    name := "bio",
    rows := "5",
    cols := "40",
    placeholder := "Tell us about yourself"
  )(""),
  input(
    `type` := "checkbox",
    name := "agree",
    id := "agree",
    required
  ),
  label(htmlFor := "agree")("I agree to the terms")
)
```

### Linked Labels

Always link labels to inputs using `htmlFor` and `id`:

```scala
label(htmlFor := "email")("Email Address"),
input(`type` := "email", id := "email", name := "email")
```

This improves accessibility and usability.

---

## Common Patterns

### CSS Classes and Styling

**Static classes:**
```scala
div(`class` := ("container", "main"))
```

**Conditional classes:**
```scala
val isDisabled = true
button(
  `class` := ("btn", "btn-primary")
).when(isDisabled)(
  `class` := ("btn", "btn-disabled")
)
```

**Classes from a collection:**
```scala
val extraClasses = List("shadow", "rounded")
div(className := ("card" +: extraClasses))
```

### JavaScript in Pages

**Inline JavaScript:**
```scala
script.inlineJs(js"""
  console.log('Page loaded!');
  document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM ready');
  });
""")
```

**External JavaScript:**
```scala
script.externalJs("https://cdn.example.com/lib.js")

// With attributes
script
  .externalJs("/app.js")
  .async
  .defer
  .integrity("sha384-...")
```

**ES6 Modules:**
```scala
script.externalModule("/js/app.js")
// Renders as: <script src="/js/app.js" type="module"></script>
```

### CSS in Pages

**Inline CSS:**
```scala
style.inlineCss(css"""
  body {
    margin: 0;
    font-family: sans-serif;
  }
  .container {
    max-width: 1200px;
    margin: 0 auto;
  }
""")
```

**External CSS:**
```scala
link(rel := "stylesheet", href := "https://example.com/styles.css")

// Load from resources
style.inlineResource("styles/main.css")
```

### Data Attributes

```scala
div(
  data("user-id") := "12345",
  data("role") := "admin"
)("Content")
// Renders as: <div data-user-id="12345" data-role="admin">Content</div>
```

### Custom Attributes

For attributes not predefined, use `Dom.attr()`:

```scala
div(
  Dom.attr("x-data") := "{count: 0}",
  Dom.attr("x-text") := "count"
)("Click me")
```

### Dynamic Attribute Manipulation

```scala
val element = div(id := "myDiv", `class` := "container")

// Add or update an attribute
val updated = element.attr("title", "My Title")

// Add multiple attributes
val updatedWithData =
  div(name("item")).addAttributes(
    data("id") := "123",
    data("type") := "product"
  )

// Remove an attribute
val removed = updated.removeAttr("title")
```

### Mapping Over Collections

Generate lists of elements:

```scala
val items = List("Apple", "Banana", "Cherry")

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

## Integration with ZIO HTTP

### Using Response.html() with Route Handlers

```scala
import zio.http._
import zio.http.template2._

val page: Dom = html(
  head(title("Home")),
  body(h1("Welcome"))
)

val routes = Routes(
  Method.GET / "home" -> handler {
    Response.html(page)
  }
)

Server
  .serve(routes)
  .provide(Server.default)
```

### Using Endpoint API with out[Dom]

For type-safe endpoints, specify `out[Dom]` with the HTML media type:

```scala
import zio.http.endpoint._
import zio.http.template2._

val homepage: Endpoint[Unit, Unit, ZNothing, Dom, None] =
  Endpoint(Method.GET / Root)
    .out[Dom](MediaType.text.`html`)

val page: Dom = html(
  head(title("Home")),
  body(h1("Welcome"))
)

val route =
  homepage.implementHandler(handler((_: Unit) => page))

Server
  .serve(route)
  .provide(Server.default)
```

### Side-by-Side Comparison

| Aspect | Route Handler | Endpoint API |
|--------|---------------|--------------|
| **Type Safety** | Runtime checked | Compile-time checked |
| **Use Case** | Simple routes | Complex APIs with request/response types |
| **Setup** | Quick | More verbose but more precise |
| **Testing** | Manual testing | Type-safe test generation |

---

## Key Types Reference

| Type | Purpose |
|------|---------|
| `Dom` | Sealed trait representing HTML content (Element, Text, Fragment, Empty) |
| `Dom.Element` | An HTML element with tag, attributes, and children |
| `Dom.Text` | Plain text content |
| `Dom.Fragment` | Multiple Dom nodes grouped together |
| `Dom.Empty` | Represents no content (for conditionals) |
| `Modifier` | Trait for things applied to elements (attributes, children) |
| `Dom.Attribute` | An HTML attribute (id, class, data, etc.) |
| `Response.html()` | HTTP response builder for Dom content |
| `Endpoint.out[Dom]()` | Declare Dom as endpoint output type |

---

## Traversing and Transforming DOM

### Finding Elements

```scala
val element = div(
  p(`class` := "important")("Important"),
  p("Normal"),
  span("Other")
)

// Find first matching element
val firstP: Option[Dom] = element.find {
  case el: Dom.Element => el.tag == "p"
  case _ => false
}

// Collect all matching elements
val allParagraphs: List[Dom] = element.collect {
  case el: Dom.Element if el.tag == "p" => el
}

// Filter elements recursively
val filtered = element.filter {
  case el: Dom.Element => el.tag != "span"
  case _ => true
}
```

### Transforming DOM

```scala
val page: Dom = html(/* ... */)

// Transform by applying a function
val transformed = page.transform { dom =>
  // Custom transformation logic
  dom
}
```

---

## Next Steps

Explore related skills:
- **zio-http-scaffold** — Project structure and setup
- **zio-http-datastar** — Real-time reactive patterns with Server-Sent Events
- **zio-http-knowledge** — ZIO HTTP API reference and best practices

---

## Common Failures

| Symptom                                                              | Likely cause                                                                | Fix                                                                                                  |
|----------------------------------------------------------------------|-----------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| `type mismatch; found String, required (String, String)`             | Passing a CSS class as a bare string instead of `(name, value)` tuple.      | Use the `class :=` form or pass `("class", "btn-primary")`. See the attribute-types section.        |
| Conditional class doesn't render                                     | `.when(...)` was used on a `Boolean`, not on the attribute.                 | Apply `.when(condition)` on the attribute itself: `(class := "active").when(isActive)`.             |
| Form submission posts no values                                      | Missing `name` attribute on inputs, or the form's `action`/`method` is wrong. | Every submittable input needs `name := "<key>"`; the form needs `method := "post"`.                |
| Boolean attribute rendered as `disabled="false"` instead of omitted  | Used `disabled := false` (string assignment) instead of the boolean form.   | Use `disabled.when(false)` to omit, or `disabled := true` only when you want it present.            |
| Page renders but CSS / JS doesn't load                               | Used a relative path that breaks under Docusaurus / nested routes.          | Prefer absolute paths from the site root, or use the helper that resolves base-URL automatically.   |

---

## References

- **Full API Reference**: See `references/api-guide.md` for complete element and attribute listings
- **Working Examples**: See `references/examples/` for real-world patterns
- **Official Documentation**: https://zio.dev/zio-http
- **GitHub Examples**: https://github.com/zio/zio-http/tree/main/zio-http-example/src/main/scala/example/template2
