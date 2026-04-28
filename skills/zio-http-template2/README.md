# zio-http-template2 Skill

A comprehensive developer skill for building type-safe, composable HTML pages with ZIO HTTP's template2 DSL.

## What This Skill Teaches

Template2 is a modern HTML templating system for ZIO HTTP that brings compile-time safety and composability to web page building. This skill teaches agents how to:

1. **Build HTML pages** using the template2 DSL with proper element structure
2. **Use attributes correctly** (partial, boolean, and multi-value attributes)
3. **Avoid void element mistakes** (not adding children to self-closing elements)
4. **Render content conditionally** using Option.map, if/else, and .when() patterns
5. **Build reusable components** as Scala functions
6. **Style pages** with CSS (inline and external)
7. **Add interactivity** with JavaScript (inline and external)
8. **Use data attributes** and custom attributes
9. **Integrate with ZIO HTTP** via route handlers and Endpoint API

## Files

### Core Skill
- **SKILL.md** — Complete teaching content (~400 lines)
  - 6 numbered teaching steps
  - Common patterns section
  - ZIO HTTP integration examples
  - Key types reference
  - References

- **references/api-guide.md** — Full API reference
  - Complete element and attribute listings
  - Type definitions
  - Common patterns and examples
  - Rendering and integration guide

### Example Files
- **references/examples/BasicPage.scala** — Various HTML elements, nesting patterns
- **references/examples/FormWithValidation.scala** — Form structure with validation attributes
- **references/examples/ConditionalRendering.scala** — Option.map, if/else, .when(), .whenSome() patterns
- **references/examples/ReusableComponents.scala** — Component functions (card, button, form input, badge, progress bar)
- **references/examples/ScriptsAndStyles.scala** — CSS/JS integration, inline scripts, external scripts
- **references/examples/StyleAndDataAttributes.scala** — CSS classes, inline styles, data attributes, custom attributes

## Error Prevention

This skill specifically prevents 4 canonical agent mistakes:

1. **Mixing attributes and children incorrectly**
   - ❌ Wrong: Incorrect syntax when combining attributes and children
   - ✅ Right: Clear patterns shown in Step 2 and examples

2. **Multi-value attributes confusion**
   - ❌ Wrong: `className := "container active"` (string instead of tuple)
   - ✅ Right: `className := ("container", "active")` (proper tuple syntax)

3. **Void elements with children**
   - ❌ Wrong: `img(src := "...")("alt text")`
   - ✅ Right: `img(src := "...", alt := "alt text")`

4. **Conditional rendering issues**
   - ❌ Wrong: Improper use of Option or if/else
   - ✅ Right: `user.email.map(e => p(e))` and if/else patterns

## Evaluation

The skill has been validated with 4 test cases:

1. **eval-form-with-bootstrap-classes** (2 error types targeted)
   - Tests form structure and multi-value className handling
   - Assertions: 6

2. **eval-conditional-user-profile** (2 error types targeted)
   - Tests conditional rendering and void element handling
   - Assertions: 7

3. **eval-styled-card-component** (2 error types targeted)
   - Tests component composition and conditional attributes
   - Assertions: 6

4. **eval-advanced-page-with-scripts** (2 error types targeted)
   - Tests CSS/JS integration and style attribute patterns
   - Assertions: 8

**Total Assertions**: 27 across 4 evaluations
**Expected Improvement**: +10-15 percentage points from skill on error-prone patterns

## How to Use This Skill

When a user asks to:
- Build a web page with ZIO HTTP template2
- Create HTML pages in Scala
- Build reusable UI components
- Add forms to a ZIO HTTP application
- Style elements with CSS
- Add JavaScript to pages
- Handle conditional rendering
- Integrate with Endpoint API

The skill will be automatically triggered and guide the agent through proper patterns.

## Key Resources

- **SKILL.md** — Start here for complete teaching
- **references/api-guide.md** — Detailed API reference
- **references/examples/** — Working code examples
- **Official ZIO HTTP Documentation** — https://zio.dev/zio-http
- **GitHub Examples** — https://github.com/zio/zio-http/tree/main/zio-http-example/src/main/scala/example/template2

## Implementation Notes

All examples compile against **zio-http 3.11.0** and Scala 2.13 / 3.3.

### Imports Required
```scala
import zio.http._
import zio.http.template2._
```

### Key Type Aliases
```scala
type Dom = sealed trait representing HTML content
type Modifier = things that can be applied to elements (attributes/children)
type Attribute = HTML attribute
```

### Common Patterns

**Rendering:**
```scala
page.render                    // Compact HTML
page.render(indentation = true) // Pretty-printed
Response.html(page)            // HTTP response
```

**Attributes:**
```scala
id := "main"                   // Partial attribute
required                       // Boolean attribute
className := ("a", "b")        // Multi-value attribute
```

**Conditional:**
```scala
if (condition) element else Dom.empty
option.map(v => element)
element.when(condition)(attrs)
```

---

**Skill Status**: ✅ Ready for Production  
**Version**: 1.0  
**Last Updated**: 2026-04-28
