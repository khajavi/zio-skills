# Template2 Patterns Reference — FormWithBootstrap.scala

This document maps each pattern used in the generated code to the corresponding section in the zio-http-template2 skill.

---

## Quick Pattern Lookup

| Line(s) | Pattern | Skill Section | Example |
|---------|---------|---------------|---------|
| 25-32 | Multi-value attributes (tuple) | Step 2 | `className := ("container", "mt-5")` |
| 49-52 | Partial attributes + children | Step 2 | `label(...htmlFor...)(text)` |
| 59 | Boolean attribute | Step 2 | `required` |
| 23 | Dom type | Key Types | `val page: Dom` |
| 43-86 | Form structure | Step 6 | `form(...)(div(...label...input...))` |
| 100 | Response.html() | Integration | `Response.html(page)` |

---

## Pattern Breakdown by Code Section

### Section 1: Head Metadata (Lines 24-32)

**Pattern: Partial Attributes**

```scala
meta(charset := "UTF-8"),
meta(name := "viewport", content := "width=device-width, initial-scale=1"),
title("Bootstrap Form Example"),
link(
  rel := "stylesheet",
  href := "https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css"
)
```

**Skill Reference:** Step 2 — Partial Attributes (Require Values)

**Pattern Explanation:**
- `charset := "UTF-8"` — Uses `:=` operator for attribute that requires value
- `name := "viewport"` and `content := "..."` — Two separate attributes on same element
- `rel := "stylesheet"` and `href := "..."` — Multi-attribute void element

**Key Point:** Attributes must be named and given values using `:=`. This is type-safe at compile time.

---

### Section 2: Layout Wrapper (Lines 35-40)

**Pattern: Multi-Value Attributes (Tuple Syntax)**

```scala
div(`class` := ("container", "mt-5"))(
  div(`class` := ("row", "justify-content-center"))(
    div(`class` := ("col-md-6"))(
      div(`class` := "card")(
```

**Skill Reference:** Step 2 — Multi-Value Attributes (Space vs Comma Separated)

**Pattern Explanation:**
```scala
// ✅ CORRECT - Tuple syntax
div(`class` := ("container", "mt-5"))  // Renders as: class="container mt-5"

// ❌ WRONG - String syntax
div(`class` := "container mt-5")       // ERROR or mishandled
```

**Key Point:** CSS classes are space-separated. Use tuple syntax `("class1", "class2")` not string `"class1 class2"`. Template2 automatically converts the tuple to space-separated HTML.

**Bootstrap Classes Used:**
- `container` — Bootstrap container for responsive layout
- `mt-5` — Margin-top utility class
- `row` — Bootstrap grid row
- `justify-content-center` — Flexbox centering
- `col-md-6` — 6-column width on medium screens

---

### Section 3: Form Structure (Lines 43-86)

**Pattern: Form with Label+Input Linking**

```scala
form(
  action := "/submit",
  method := "POST"
)(
  // Username field group
  div(`class` := "form-group")(
    label(
      htmlFor := "username",
      `class` := "form-label"
    )("Username"),
    input(
      `type` := "text",
      `class` := "form-control",
      id := "username",
      name := "username",
      placeholder := "Enter your username",
      required,
      minlength := "3",
      maxlength := "20"
    )
  ),
  ...
)
```

**Skill Reference:** Step 6 — Forms and Input Patterns + Step 2 — Mixing Attributes and Children

**Pattern Explanation:**

1. **Form element** (lines 43-45)
   ```scala
   form(
     action := "/submit",    // Where form submits to
     method := "POST"        // HTTP method
   )(/* children */)
   ```

2. **Form-group wrapper** (line 48)
   ```scala
   div(`class` := "form-group")(/* label and input */)
   ```
   - Bootstrap convention: Each field in its own form-group div
   - Provides consistent spacing and styling

3. **Label with linking** (lines 49-52)
   ```scala
   label(
     htmlFor := "username",      // MUST match input's id
     `class` := "form-label"     // Bootstrap label styling
   )("Username")                 // Text content (child)
   ```
   - `htmlFor` links label to input — improves accessibility
   - User can click label to focus the input field
   - Screen readers announce the relationship

4. **Input with validation** (lines 53-62)
   ```scala
   input(
     `type` := "text",              // Text input
     `class` := "form-control",     // Bootstrap input styling
     id := "username",              // MUST match label's htmlFor
     name := "username",            // Form submission name
     placeholder := "Enter...",     // User guidance
     required,                      // Boolean attribute (no value)
     minlength := "3",             // Validation constraint
     maxlength := "20"             // Validation constraint
   )
   ```
   - `type := "text"` — HTML5 input type
   - `id := "username"` — Must match label's htmlFor
   - `required` — Browser enforces, no submit if empty
   - `minlength`/`maxlength` — Client-side length validation

**Key Point:** The three-part pattern is form > form-group > (label + input). Labels and inputs are linked via htmlFor/id for accessibility.

---

### Section 4: Email Field (Lines 64-77)

**Pattern: Type-Specific Input (email)**

```scala
div(`class` := "form-group")(
  label(
    htmlFor := "email",
    `class` := "form-label"
  )("Email"),
  input(
    `type` := "email",
    `class` := "form-control",
    id := "email",
    name := "email",
    placeholder := "Enter your email address",
    required
  )
)
```

**Skill Reference:** Step 6 — Input Types and Validation Attributes

**Pattern Explanation:**
- `type := "email"` — HTML5 email input
- Browser provides:
  - Native email validation (must contain @)
  - Email-specific keyboard on mobile devices
  - Automatic formatting hints
- `required` — No submission if empty
- No minlength/maxlength needed (HTML5 email validation is sufficient)

---

### Section 5: Submit Button (Lines 79-85)

**Pattern: Button with Multiple Classes**

```scala
div(`class` := ("d-grid", "gap-2"))(
  button(
    `type` := "submit",
    `class` := ("btn", "btn-primary")
  )("Submit")
)
```

**Skill Reference:** Step 2 — Multi-Value Attributes + Step 6 — Forms

**Pattern Explanation:**

1. **Wrapper div** (line 80)
   ```scala
   div(`class` := ("d-grid", "gap-2"))
   ```
   - `d-grid` — Bootstrap display grid
   - `gap-2` — Gap between grid items
   - Makes button full-width

2. **Button with tuple classes** (lines 81-84)
   ```scala
   button(
     `type` := "submit",              // Form submission button
     `class` := ("btn", "btn-primary") // Multiple classes as tuple
   )("Submit")                         // Button text (child)
   ```
   - `type := "submit"` — Submits form on click
   - `class := ("btn", "btn-primary")` — Tuple syntax for two classes
     - `btn` — Bootstrap button base class
     - `btn-primary` — Primary button style (blue)
   - Text "Submit" is the button label (child content)

**Key Point:** Button is not a void element—it contains text content as a child.

---

### Section 6: Script Tag (Line 92)

**Pattern: External JavaScript**

```scala
script.externalJs("https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js")
```

**Skill Reference:** Common Patterns — JavaScript in Pages

**Pattern Explanation:**
- `script.externalJs(url)` — Template2 helper for external scripts
- Bootstrap JavaScript bundle provides:
  - Modal, dropdown, tooltip functionality
  - Form validation enhancements
  - Other interactive components
- No attributes needed—just URL

---

### Section 7: Response Integration (Lines 96-103)

**Pattern: Serving Dom via ZIO HTTP**

```scala
override def run: ZIO[Any, Throwable, Unit] =
  Server
    .serve(
      Method.GET / Root -> handler {
        Response.html(page)
      }
    )
    .provide(Server.default)
```

**Skill Reference:** Integration with ZIO HTTP

**Pattern Explanation:**
- `val page: Dom` — The entire form is a single Dom value
- `Response.html(page)` — Converts Dom to HTML string + HTTP response
  - Sets Content-Type: text/html
  - Renders the Dom to HTML automatically
- `Server.serve(routes)` — Start ZIO HTTP server
- `.provide(Server.default)` — Use default server config

**Key Point:** The form is defined once as a `Dom` value, then served via `Response.html()`. No string rendering needed—template2 handles it.

---

## Common Mistakes Avoided

### ❌ Mistake 1: String Instead of Tuple for Classes

```scala
// WRONG
div(`class` := "container mt-5")

// RIGHT
div(`class` := ("container", "mt-5"))
```

**Why:** Template2's multi-value attribute handling requires tuple syntax. Strings are treated as a single value, not multiple classes.

---

### ❌ Mistake 2: Value on Boolean Attribute

```scala
// WRONG
input(required := "true")
input(required := "")

// RIGHT
input(required)
```

**Why:** Boolean attributes in HTML are present or absent. Template2's `required` syntax renders as `required` in HTML, which the browser interprets as "true." Adding a value is incorrect.

---

### ❌ Mistake 3: Children on Void Elements

```scala
// WRONG - COMPILE ERROR
input(`type` := "text")("Please enter text")

// RIGHT
input(
  `type` := "text",
  placeholder := "Please enter text"
)
```

**Why:** Input is a void element. Template2 enforces at compile time that void elements cannot have children. All meaning must come from attributes.

---

### ❌ Mistake 4: htmlFor Without Matching id

```scala
// WRONG - Link broken
label(htmlFor := "username")("Username"),
input(id := "other-id" ...)

// RIGHT - Links correctly
label(htmlFor := "username")("Username"),
input(id := "username" ...)
```

**Why:** The htmlFor must exactly match the input's id for the browser to link them. Mismatch breaks accessibility and clicking the label won't focus the input.

---

## Pattern Checklist

When building forms with template2, ensure:

- ✅ Form element has action and method attributes
- ✅ Each field wrapped in form-group div
- ✅ Label uses htmlFor := "field-id"
- ✅ Input uses id := "field-id" (matching label)
- ✅ Input has type, name, and required attributes
- ✅ Input uses class := "form-control" (Bootstrap)
- ✅ Label uses class := "form-label" (Bootstrap)
- ✅ Button uses class := ("btn", "btn-primary") tuple syntax
- ✅ CSS classes use tuple syntax, never strings
- ✅ Form is served via Response.html()

---

## Summary Table

| Element | Required Attributes | CSS Classes | Children? | Notes |
|---------|------------------|-------------|-----------|-------|
| form | action, method | None | Yes (divs, buttons) | POST to endpoint |
| div.form-group | class := "form-group" | form-group | Yes (label, input) | Wrapper for each field |
| label | htmlFor, class | form-label | Yes (text) | htmlFor must match input id |
| input | type, id, name, class | form-control | No (void) | id must match label htmlFor |
| button | type="submit", class | btn, btn-primary | Yes (text) | Submits form on click |

---

## References

- **Skill Document:** `/home/milad/sources/zio-skills/skills/zio-http-template2/SKILL.md`
- **Step 2:** Attributes and Children (tuple syntax explanation)
- **Step 3:** Void Elements (input element constraints)
- **Step 6:** Forms and Input Patterns (form structure)
- **Integration:** Using Response.html() with ZIO HTTP
- **Example:** `/home/milad/sources/zio-skills/skills/zio-http-template2/references/examples/FormWithValidation.scala`
