---
name: docs-module-ref
description: Write reference documentation for a module containing multiple related data types. Use when documenting a cohesive domain model (HTTP model, resource management) where types work together. Produces comprehensive type-level pages plus module-level narrative showing relationships, patterns, and composition.
argument-hint: "[module-name (e.g., 'http-model', 'resource-management')]"
allowed-tools: Read, Glob, Grep, Bash(sbt:*), Bash(sbt gh-query*), AskUserQuestion, Skill
---

# Module Reference Documentation

**REQUIRED BACKGROUND:** Use `docs-writing-style` for prose conventions, `docs-mdoc-conventions` for code block syntax, and `docs-data-type-ref` structure as baseline for type-level pages.

## Target Module

$ARGUMENTS

## Agent Workflow

**Phase 1 — Plan (Steps 1–3, no files yet)**

Complete Steps 1–3 (research, structure decision, loading writing skills). Before writing any file, create one task per remaining step: Step 4 through Step 9. Present the task list to the user for confirmation before proceeding.

**Phase 2 — Write (Steps 4–7)**

Execute Steps 4–7 in order. Mark each task `completed` as you finish it.

**Phase 3 — Verify (Step 8)**

Run mdoc verification. All code blocks must compile with zero errors.

**Phase 4 — Integrate (Step 9)**

Complete Step 9. All integration tasks must be done before claiming work complete.

## Overview

This skill produces comprehensive reference documentation for modules with multiple related types. Unlike `docs-data-type-ref` (single type), `docs-module-ref` emphasizes:
- **Module narrative:** How types work together, common patterns, architectural relationships
- **Type-level comprehensiveness:** Each type gets full `docs-data-type-ref` coverage, contextualized within the module
- **Multi-type examples:** Show composition and cross-type usage, not just single-type API

---

## Step 1: Research & Map the Module

Run `Skill({ name: "docs-research" })` to:
- Find all core and supporting types in the module
- Identify type relationships and dependencies
- Find tests, examples, and real-world usage patterns
- Review any existing partial documentation

Build a mental model of core types (primary exports), supporting types (helpers), their relationships, and data flow.

---

## Step 2: Decide Structure (Flat vs. Hierarchical)

Use `AskUserQuestion` to confirm the structure choice if the user wants to override the default:

**Default rule (apply this without asking):**

| Module shape                                                    | Default        |
|-----------------------------------------------------------------|----------------|
| ≤ 4 core types, or types always used together                   | **Flat**       |
| ≥ 5 core types, **or** ≥ 3 types with rich self-contained APIs  | **Hierarchical** |

Tell the user which applies and why, e.g.: "This module has 7 types with independent APIs, so I'll use hierarchical structure (index + individual type pages)."

**Flat** — Single file: `docs/reference/<module-name>.md`
- All types documented inline with `##` headings
- Example: `http-model.md` (140+ types)
- Best when types are tightly coupled or always used together

**Hierarchical** — Index + subpages: `docs/reference/<module-name>/index.md` + `docs/reference/<module-name>/<type>.md`
- Separate page per type, linked from module index
- Example: `resource-management/` (index.md, scope.md, resource.md, wire.md)
- Best when types have self-contained value and readers benefit from deep-dive pages

---

## Step 3: Load Writing Rule Skills

1. Load the `docs-writing-style` skill to ensure all prose follows ZIO documentation conventions (e.g., tone, formatting, terminology).
2. Load the `docs-mdoc-conventions` skill to ensure all code blocks follow mdoc syntax rules for proper rendering and compilation.

---

## Step 4: Write Module-Level Documentation

### File Location & Frontmatter

**Flat:** `docs/reference/<module-name>.md`

```yaml
---
id: <module-name-kebab-case>
title: "<Module Title>"
---
```

**Hierarchical:** `docs/reference/<module-name>/index.md`

```yaml
---
id: index
title: "<Module Title>"
---
```

### Module-Level Sections (BOTH STRUCTURES)

#### 1. Opening Definition (NO HEADING)

Immediately after frontmatter, state what the module provides:
- Concise statement of module purpose in 1-3 sentences
- List core types as inline code: `` `Type1`, `Type2`, `Type3` ``
- Scala code block showing structural shape of 2-3 main types (plain `` ```scala `` without mdoc)

**Example:**

```
    `zio-http-model` is a **pure, zero-dependency HTTP data model** for building clients and servers. 
    It provides immutable types representing requests, responses, headers, URLs, paths, and HTTP primitives.
    Core types: `Request`, `Response`, `URL`, `Headers`, `Body`, `Method`, `Status`.
    
    ```scala
    final case class Request(method: Method, url: URL, headers: Headers, body: Body, version: Version)
    final case class Response(status: Status, headers: Headers, body: Body, version: Version)
    final case class URL(scheme: Option[Scheme], host: Option[String], port: Option[Int], ...)
    ```
```

Then continue with `## Introduction` or `## Motivation` heading.

#### 2. Introduction (if hierarchical) OR Motivation (if flat)

**Hierarchical:** Brief welcome section explaining the module's role and what readers will learn.

**Flat:** Why use this module over alternatives? Problem it solves, advantages, bullet points.

#### 3. Motivation / Use Case

Answer: What problem does it solve? Why use it over alternatives?
- Include advantages as bullet points or ASCII art
- Compare with standard library or other libraries if relevant

#### 4. Installation

```scala
libraryDependencies += "dev.zio" %% "<module-name>" % "@VERSION@"
```

For Scala.js: use `%%%` instead of `%%`.

Supported Scala versions: 2.13.x and 3.x

#### 5. Overview (Hierarchical ONLY, optional for Flat)

Brief introduction to each core type (2-3 sentences each):
- What each type does
- Its role in the module
- Link to individual type page (hierarchical) or section (flat)

#### 6. How They Work Together (CRITICAL)

**THIS SECTION IS THE CENTERPIECE — don't skip it.**

This section explains both the **workflow** (usage sequence) and **architecture** (type relationships). Include BOTH:

**A) Workflow/Usage Sequence:**
Numbered steps showing the typical order types are used together:
- Example: "1. Create URL → 2. Create Request → 3. Send → 4. Receive Response"
- Each step should mention which type(s) are involved
- Show the progression from setup through execution to result

**B) Architecture Diagram:**
ASCII diagram showing how types depend on and compose with each other:
- Use `──>` to show "contains" or "uses"
- Use `├─>` and `└─>` to show alternatives or sub-relationships
- Show all four core types and their relationships
- Example: "Request contains Method, URL, Headers, Body; Response contains Status, Headers, Body"

**What NOT to do:**
- Don't just list patterns here (that goes in Section 7: Common Patterns)
- Don't make the diagram so large that it overwhelms; keep it to 15-20 lines max
- Don't explain individual methods (that goes in type-level pages)

**Example for Resource Management (Workflow + Architecture):**
```
Workflow:
1. Define dependencies using Wire.shared[T] (macro inspects constructors)
2. Compose wires with Resource.from[App](wire1, wire2, ...)
3. Allocate within a scope: scope.allocate(resource)
4. Use scoped values via $ accessor
5. Cleanup automatic when scope exits

Architecture:
Wire ──> Resource ──> Scope
         (defines what)  (manages how)  (manages when)
- Wire describes constructor dependencies
- Resource wraps them into a managed lifecycle
- Scope controls allocation and cleanup
```

**Example for HTTP Model (Workflow + Architecture):**
```
Workflow:
1. Build URL with scheme, host, path, query parameters
2. Create Request with method, URL, headers, body
3. Send Request via Client
4. Receive Response with status, headers, body
5. Extract data from Response

Architecture:
Request ──> Method (HTTP verb: GET, POST, etc.)
         ├─> URL ──> Scheme (HTTP, HTTPS, WS, WSS)
         │       ├─> Path (URL path segments)
         │       └─> QueryParams (parameters)
         ├─> Headers (collection of typed headers)
         └─> Body (content + ContentType)

Response ──> Status (HTTP code: 200, 404, etc.)
          ├─> Headers (same as Request)
          └─> Body (response content)
```

**Example for HTTP Testkit (Workflow + Architecture):**
```
Workflow:
1. Choose testing pattern: Direct routes, mocking external APIs, or integration testing
2. Provide the appropriate test type (TestServer for routes, TestClient for API mocks, TestChannel for WebSockets)
3. Configure routes/responses via addRoute, addRequestResponse, installSocketApp
4. Make HTTP requests via standard Client interface
5. Assert on responses

Architecture:
TestServer ──> Routes (what to test)
            └─> Handler (executes route logic)
            
TestClient ──> Request/Response pairs (API mocks)
            └─> Handler (computes responses)

TestChannel ──> WebSocketApp (what to test)
              └─> WebSocketFrame (bidirectional messages)

HttpTestAspect ──> TestServer/TestClient (configures behavior by mode)
                └─> Mode.Dev/Prod/Preprod (mode configuration)
```

#### 7. Common Patterns

Named architectural patterns specific to the module:
- Decision trees for choosing between types/variants (e.g., "use Shared vs Unique?")
- Typical use cases organized by scenario
- Examples showing realistic multi-type composition (not just single-type snippets)

**Example for Resource Management:**
- Shared Singletons (database connections)
- Per-Request Instances (session state)
- Manual Construction (custom initialization)
- Resource Composition (chaining dependencies)

#### 8. Integration Points

Explain how types in this module relate to each other and integrate with other modules.

**Structure:**

**A) Within-Module Integration:**
Show which core types depend on or use each other:
- Use this format: "Type1 uses Type2 to [achieve X]"
- Show data flows: "Type1 contains Type2, which contains Type3"
- If types are alternatives (choose one), explain when to pick each
- Keep this section 5-10 bullet points

**B) External Module Integration:**
Show how this module integrates with other modules in the same library:
- What types from other modules does this module use?
- What types from other modules use this module?
- Format: "[This Module] ↔ [Other Module]: [what they exchange]"
- Keep this section 3-5 bullet points; defer details to per-type pages

**Example for Resource Management (Within Module):**
```
- Wire describes component dependencies; it's used to bootstrap Resource
- Resource wraps Wire into a managed lifecycle with automatic cleanup
- Scope manages the allocation and finalization of all Resources
- Wire and Resource are typically used together: Wire defines structure, Resource manages it
```

**Example for Resource Management (External Integration):**
```
- Resource Management ↔ ZIO Core: Resource builds on ZIO's effect system for allocation and cleanup
- Resource Management ↔ Dependency Injection: Wire macro integrates with ZIO's reflection-based dependency resolution
- Resource Management ↔ Schema: Resource instances can use Schema for configuration deserialization
```

**Example for HTTP Testkit (Within Module):**
```
- TestServer and TestClient are independent: choose one based on what you're testing
- TestChannel is used specifically for WebSocket testing, not HTTP
- HttpTestAspect can wrap any of the three (TestServer, TestClient, TestChannel) to test mode-dependent behavior
- Typically you'll use one primary type per test file, with HttpTestAspect as a wrapper
```

**Example for HTTP Testkit (External Integration):**
```
- HTTP Testkit ↔ HTTP Core: Uses Routes, Handler, Request, Response, Client from the main library
- HTTP Testkit ↔ ZIO Core: Uses ZIO environment and effects for dependency injection and test execution
```

---

## Step 5: Write Type-Level Documentation (Flat Structure)

**For flat (.md) files:** Write type sections inline using `##` headings.

**Structure for each type:**
1. **Opening definition (no heading for first type):** Brief definition, type signature, key properties
2. **Subsections by category:**
    - **Predefined Instances** (if applicable): List variants, constants
    - **Parsing/Creating** (if applicable): How to construct or parse values
    - **Key Operations**: 2-3 main methods per functionality group
    - **Rendering** (if applicable): How to convert to string/wire format

**Coverage:** Load and call Skill(`docs-data-type-ref`) for structure as a reference, but lighter:
- Document every public method, but group concisely
- Show 1 example per operation group, not exhaustive edge cases
- Performance notes inline where relevant (O(1), O(n), etc.)
- Link to module-level integration section for composition examples

**Example (http-model.md):**

```markdown
    ## Method
    
    `Method` represents standard HTTP methods as case objects.
    
    ### Predefined Methods
    GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, TRACE, CONNECT with examples.
    
    ### Parsing
    fromString("GET") returns Some(Method.GET).
    
    ### Rendering
    Method.GET.name returns "GET".
    
    ## Status
    
    `Status` is an opaque type alias for Int, providing zero-allocation status codes.
    
    ### Predefined Status Codes
    1xx Informational, 2xx Success, 3xx Redirection, 4xx Client Errors, 5xx Server Errors with examples.
```

---

## Step 6: Write Type-Level Documentation (Hierarchical Structure)

**For hierarchical structures:** Create individual type pages in the module subdirectory.

**File location:** `docs/reference/<module-name>/<type-name-kebab-case>.md`

**Frontmatter:**
```yaml
---
id: <type-name-kebab-case>
title: "<TypeName>"
---
```

**Structure:** Follow `docs-data-type-ref` COMPLETELY. "Completely" means:

- ✅ Opening definition: What is this type, what does it do?
- ✅ Motivation: Why use this type? When is it needed?
- ✅ Creating/Construction: How to create instances (constructors, factory methods, builders)
- ✅ Core Operations: Group methods by functionality, document each group with 1-2 examples
- ✅ Common Patterns: Realistic usage scenarios specific to this type
- ✅ API Reference (if applicable): Table of all public methods with signatures and brief descriptions
- ✅ Integration Points: How this type relates to other types in the module and external modules
- ✅ Examples: 2-3 runnable code examples showing key workflows

**Coverage rule:** Every public method/function related to this type must appear somewhere in the page (either in Core Operations with examples, or in an API Reference section with brief descriptions).

**Recontextualization for Module Context:**

Add a **"Role in Module"** subsection at the start (after opening definition, before Motivation):
```markdown
### Role in Module

[2-3 sentences describing how this type fits within the larger module.]

**Typically used with:** [List other types this composes with, e.g., "TestServer uses Routes, which use Handler"]

**Complementary types:**
- Type1 — [brief relationship]
- Type2 — [brief relationship]
```

**In each major section, add recontextualization notes:**
- **Motivation:** "This is a [core/supporting] type in the module. Use it when..."
- **Core Operations:** When showing composition, note: "This method composes with [OtherType] to [achieve X]"
- **Integration Points:** Split into two subsections:
  - **Within Module:** How does this type interact with other types in the same module?
  - **External Modules:** How does it integrate with types from other modules?

**Example recontextualization for TestServer type page:**

```markdown
### Role in Module

`TestServer` is the **primary type for integration testing** in zio-http-testkit. 
It provides a simulated HTTP server that accepts configured routes and responds to requests.

**Typically used with:** Routes (what to test), Handler (route logic), Client (to make requests), HttpTestAspect (mode configuration)

**Complementary types:**
- TestClient — For mocking external API dependencies
- TestChannel — For testing WebSocket handlers
- HttpTestAspect — For testing mode-dependent behavior

...

## Integration Points

### Within Module

- **Routes & Handler:** TestServer executes routes and their handlers. Each route you add becomes a matcher for incoming requests.
- **HttpTestAspect:** Can wrap TestServer to test behavior under different modes (Dev, Prod, Preprod).
- **Client:** Works with the standard `Client` interface to make requests to the simulated server.

### External Modules

- **zio-http:** TestServer uses core HTTP types (Request, Response, Status) from the main HTTP library.
- **zio:** Uses ZIO environment for dependency injection and effect management.
```

**Special handling:**
- **Comparison sections:** If comparing types within the module (e.g., "TestServer vs TestClient"), write this in the module index (Step 4, Section 7: Common Patterns) rather than per-type pages
- **Avoid duplication:** Don't repeat the module-level workflow (that's in Step 4, Section 6). Reference it instead: "See [How They Work Together](./index.md#how-they-work-together) for the overall workflow."

---

## Step 7: Running the Examples

Decide where to place runnable examples:

**Option 1: Module-level examples** (recommended for most modules)
- Single section in module index or dedicated examples page
- Shows cross-type workflows (e.g., "Create a Request, send it, parse the Response")
- Use `Skill({ name: "docs-examples" })` to write and document companion projects

**Option 2: Per-type examples** (only if each type has standalone value)
- Examples in individual type pages (flat structure) or individual type files (hierarchical)
- Use `Skill({ name: "docs-examples" })` separately for each type

Choose one approach per module for consistency.

---

## Step 8: Verify Documentation

Run mdoc to verify all code blocks compile and render correctly:

**Single flat file:**
```bash
sbt "docs/mdoc --watch --in docs/reference/<module-name>.md"
```

**Hierarchical directory:**
```bash
sbt "docs/mdoc --watch --in docs/reference/<module-name>/"
```

Success criterion: All code blocks compile with zero `[error]` lines.

---

## Step 9: Integration & Format

Use the **`docs-integrate`** skill for the full checklist:
1. Update `sidebars.js` with category entry (hierarchical) or single entry (flat)
2. Update `docs/index.md` with module link and brief description
3. Add cross-references from related docs
4. Verify mdoc compilation (zero [error] lines)
5. Verify all relative links work

### sidebars.js Updates

**Flat structure:**
```javascript
{
  type: "doc",
  id: "reference/<module-name>"
}
```

**Hierarchical structure:**
```javascript
{
  type: "category",
  label: "HTTP Model",
  link: { type: "doc", id: "reference/<module-name>/index" },
  items: [
    "reference/<module-name>/<type-name-1>",
    "reference/<module-name>/<type-name-2>",
    "reference/<module-name>/<type-name-3>",
    // ... more types
  ]
}
```

### docs/index.md Update

Add line under "Reference Documentation" section:

```markdown
- [HTTP Model](./reference/<module-name>.md) — Pure, zero-dependency HTTP data model for requests, responses, and primitives.
```

### Scala Code Formatting
```bash
sbt scalafmtAll
```

### Lint Check
```bash
sbt check
```

---
