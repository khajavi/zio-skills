# Template2 Conditional Rendering Patterns - Quick Reference

This document shows the three key patterns demonstrated in UserProfile.scala

---

## Pattern 1: Optional Fields with Option.map

### Use Case
Display content only when an optional field is present.

### Syntax
```scala
optionalField.map(value => element(value))
```

### Example: Email Field
```scala
case class User(
  name: String,
  email: Option[String]
)

// In rendering:
user.email.map(emailAddr =>
  div(`class` := "email-section")(
    label("Email"),
    a(href := s"mailto:$emailAddr")(emailAddr)
  )
)
```

### What Happens
- If `email` is `Some("user@example.com")`: Renders the div with email content
- If `email` is `None`: Renders nothing (`Dom.Empty`)

### Key Points
- `Option[Dom]` is automatically converted to `Dom`
- `None` produces `Dom.Empty`, which renders as nothing
- Perfect for optional fields in data models

---

## Pattern 2: Void Elements (img, input, br, hr, etc.)

### Important Rule
Void elements are self-closing HTML elements that **cannot have children**. All content must go in attributes.

### ❌ WRONG
```scala
// COMPILE ERROR: img cannot have children
img(src := "photo.jpg")(
  "image description"  // ❌ CHILDREN NOT ALLOWED
)
```

### ✅ CORRECT
```scala
// All content in attributes
img(
  src := "photo.jpg",
  alt := "image description"  // Alt text goes HERE
)
```

### Example: Optional Avatar with img
```scala
case class User(
  name: String,
  avatar: Option[String]  // URL of image
)

// In rendering:
user.avatar.map(avatarUrl =>
  div(`class` := "avatar-section")(
    img(
      src := avatarUrl,
      alt := s"${user.name}'s avatar"  // ← Alt is an ATTRIBUTE
    )
  )
)
```

### Common Void Elements
- `img` — images
- `input` — form inputs
- `br` — line break
- `hr` — horizontal rule
- `meta` — metadata
- `link` — stylesheets
- `area`, `base`, `col`, `embed`, `source`, `track`, `wbr`

### Key Points
- Void elements cannot have children (compile error if attempted)
- Use attributes for all semantic content
- `alt` attribute is crucial for `img` accessibility
- Template2's type system prevents this error at compile time

---

## Pattern 3: Conditional Rendering with if/else or when()

### Use Case 1: Boolean Condition with if/else

```scala
case class User(
  name: String,
  isAdmin: Boolean
)

// In rendering:
if (user.isAdmin)
  div(`class` := "admin-badge")(
    span("Administrator")
  )
else
  Dom.empty  // or omit this line if it comes last
```

### Use Case 2: Conditional Attributes with when()

```scala
val isActive = true

div(
  id := "user-profile"
).when(isActive)(
  `class` := "active",
  ariaExpanded := true
)
```

**Result when `isActive = true`**:
```html
<div id="user-profile" class="active" aria-expanded="true"></div>
```

**Result when `isActive = false`**:
```html
<div id="user-profile"></div>
```

### Use Case 3: Optional Attributes with whenSome()

```scala
val maybeRole: Option[String] = Some("admin")

div(
  id := "user"
).whenSome(maybeRole) { role =>
  Seq(
    data("role") := role,
    `class` := s"user-$role"
  )
}
```

### Comparison Table

| Pattern | Use Case | Syntax |
|---------|----------|--------|
| `if/else` | Boolean element choice | `if (cond) elem else Dom.empty` |
| `.when()` | Boolean attribute addition | `elem.when(cond)(attr := val)` |
| `.whenSome()` | Optional attribute addition | `elem.whenSome(option) { v => Seq(attrs) }` |
| `.map()` on Option | Optional content | `option.map(v => elem(v))` |

### Key Points
- Use `if/else` when you want to show/hide entire elements
- Use `.when()` for conditional attributes
- Use `.whenSome()` for optional attributes
- Always return `Dom` from conditionals (use `Dom.empty` if nothing)

---

## Complete Example: Combining All Patterns

```scala
case class User(
  name: String,
  email: Option[String],      // Pattern 1: Optional field
  avatar: Option[String],     // Pattern 2: Optional image (void element)
  isAdmin: Boolean            // Pattern 3: Conditional badge
)

def userProfile(user: User): Dom =
  article(`class` := "profile")(
    h1(user.name),
    
    // PATTERN 1: Optional email with Option.map
    user.email.map(addr =>
      div(`class` := "email")(
        a(href := s"mailto:$addr")(addr)
      )
    ),
    
    // PATTERN 2: Optional avatar with img (void element, no children)
    user.avatar.map(url =>
      img(
        src := url,
        alt := s"${user.name}'s avatar"
      )
    ),
    
    // PATTERN 3: Conditional admin badge with if/else
    if (user.isAdmin)
      span(`class` := "badge")("Admin")
    else
      Dom.empty
  )
```

---

## Common Mistakes

### ❌ Mistake 1: String for alt text on img
```scala
// ❌ WRONG: children on void element
img(src := "photo.jpg")("Photo description")

// ✅ CORRECT: use alt attribute
img(src := "photo.jpg", alt := "Photo description")
```

### ❌ Mistake 2: Forgetting Dom.empty
```scala
// ❌ WRONG: type error, else branch missing
div(
  if (condition) p("Text")
  // Missing else! What if condition is false?
)

// ✅ CORRECT: always return Dom
div(
  if (condition) p("Text") else Dom.empty
)
```

### ❌ Mistake 3: Using map on non-Option
```scala
// ❌ WRONG: String is not Option
user.name.map(name => p(name))

// ✅ CORRECT: Only use map on Option, not on raw values
p(user.name)

// ✓ OR if it were Option:
user.maybeEmail.map(email => p(email))
```

### ❌ Mistake 4: Ignoring void element restriction
```scala
// ❌ WRONG: trying to add children to void element
input(`type` := "text")("placeholder text")

// ✅ CORRECT: use placeholder attribute
input(`type` := "text", placeholder := "Enter text")
```

---

## Testing These Patterns

The UserProfile.scala file includes four test scenarios:

- `/user/1` — Admin with full profile (name, email, avatar, badge)
- `/user/2` — Regular user with email only
- `/user/3` — User with avatar only
- `/user/4` — Minimal user (only name)

Each demonstrates how the patterns handle:
- Present optional fields → rendered
- Missing optional fields → nothing rendered
- Admin status → badge shown/hidden
- Proper img rendering → no children, all info in attributes

---

## References

- **SKILL.md**: Full template2 documentation
- **ConditionalRendering.scala**: Working example in zio-http repo
- **UserProfile.scala**: Evaluation implementation showing all patterns
- Template2 API: `zio.http.template2._`
