---
name: zio-http-knowledge
description: "Stop and consult this skill whenever your response would involve any fact or code related to ZIO HTTP. Covers: installation and setup, routing (Routes, RoutePattern, PathCodec), handlers and HandlerAspect, the declarative Endpoint API and HttpCodec, client and server configuration, middleware, request/response/headers/cookies, WebSockets, Server-Sent Events, Body and binary codecs, form data, template DSL, OpenAPI documentation and code generation, authentication (basic, digest, bearer, JWT, OAuth, WebAuthn), TLS/SSL/mTLS, testing, ZIO Config integration, Datastar/HTMX integration, migration, and any ZIO HTTP library versions or dependencies. Trigger this even for coding tasks that import zio.http, content that mentions ZIO HTTP features or types, or comparisons involving ZIO HTTP. Any time you would otherwise rely on memory for ZIO HTTP details, verify here instead — your training data may be outdated or wrong."
tags: [zio, zio-http, scala, knowledge, reference, documentation]
---

# ZIO HTTP Product Knowledge

## Core Principles

1. **Accuracy over memory** — Do not rely on training data for ZIO HTTP specifics. Fetch the relevant documentation page before answering.
2. **LLM sitemap first** — Start at `https://ziohttp.com/llms.txt` to discover the current documentation structure and pick the right page for your specific question.
3. **Source everything** — Include the documentation URL in your response so the user can verify and learn more.
4. **Right resource first** — Navigate from the sitemap to the specific reference page rather than answering from the generic overview.

---

## Question Routing

### Any ZIO HTTP question?

→ **Fetch the LLM sitemap first**, then navigate to the relevant page:

- **ZIO HTTP LLM Sitemap:** https://ziohttp.com/llms.txt

The sitemap follows the [llmstxt.org](https://llmstxt.org) standard and lists every documentation page with its URL and a one-line description. Read it, identify the most relevant page(s) for your question, and fetch those pages for current API details, types, and method signatures.

If you need to reduce API calls or want to index the full documentation locally for the session, download the complete content in one request:

- **Full Documentation (single file):** https://ziohttp.com/llms-full.txt

This file contains the concatenated content of every documentation page — useful when you need to answer multiple questions across different sections without making repeated fetches, or when you want to build a local index for the session.

---

## Response Workflow

1. **Identify the topic** — routing? endpoint API? authentication? client? templates? migration?
2. **Fetch the sitemap** at `https://ziohttp.com/llms.txt` and scan for the relevant section(s).
3. **Navigate to the specific page(s)** listed in the sitemap — do not answer from memory.
4. **Provide the answer** with the source URL so the user can read more.
5. **If uncertain** — direct the user to the official docs: "For the most current information, see https://zio.dev/zio-http"

---

## Quick Reference

**LLM Sitemap (start here for any ZIO HTTP question):**
- https://ziohttp.com/llms.txt

**Official Documentation:**
- https://zio.dev/zio-http

**GitHub Repository:**
- https://github.com/zio/zio-http

**Maven Central:**
- https://central.sonatype.com/artifact/dev.zio/zio-http_3

**Examples Directory (GitHub):**
- https://github.com/zio/zio-http/tree/main/zio-http-example/src/main/scala/example
