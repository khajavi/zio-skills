import zio.http.template2._

/**
 * AdvancedPage demonstrates a complete, production-ready web application using template2.
 * Shows comprehensive use of:
 * - Semantic HTML structure (header, nav, main, footer)
 * - Inline CSS with style.inlineCss(css"""...""") for layout and styling
 * - Inline JavaScript with script.inlineJs(js"""...""") for interactivity
 * - Data attributes using data("key") := "value" pattern
 * - Multiple CSS classes using tuple syntax: className := ("class1", "class2")
 * - Conditional rendering and component composition
 * - Form handling with proper accessibility attributes
 */
object AdvancedPage:

  /**
   * Renders inline CSS for the entire application.
   * Demonstrates proper integration of CSS with template2 using css""" """ syntax.
   */
  def pageStyles: Dom =
    style.inlineCss(css"""
      * {
        box-sizing: border-box;
      }

      html, body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        background-color: #f8f9fa;
        color: #333;
      }

      /* Semantic HTML Structure */
      header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        position: sticky;
        top: 0;
        z-index: 100;
      }

      header h1 {
        margin: 0;
        font-size: 28px;
        padding: 0 20px;
      }

      nav {
        background-color: #fff;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        gap: 0;
      }

      nav a {
        display: block;
        padding: 12px 20px;
        text-decoration: none;
        color: #333;
        transition: all 0.3s ease;
        border-bottom: 3px solid transparent;
      }

      nav a:hover {
        background-color: #f0f0f0;
        border-bottom-color: #667eea;
      }

      nav a.active {
        background-color: #667eea;
        color: white;
        border-bottom-color: #667eea;
      }

      main {
        max-width: 1200px;
        margin: 40px auto;
        padding: 0 20px;
      }

      footer {
        background-color: #2c3e50;
        color: white;
        text-align: center;
        padding: 40px 20px;
        margin-top: 60px;
      }

      footer p {
        margin: 5px 0;
      }

      /* Main content sections */
      section {
        margin-bottom: 40px;
      }

      section h2 {
        color: #667eea;
        border-bottom: 2px solid #667eea;
        padding-bottom: 10px;
        margin-bottom: 20px;
      }

      /* Card layout with multiple classes */
      .card {
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
        overflow: hidden;
        transition: box-shadow 0.3s ease, transform 0.3s ease;
      }

      .card:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        transform: translateY(-2px);
      }

      .card-header {
        background-color: #f8f9fa;
        padding: 20px;
        border-bottom: 1px solid #e0e0e0;
      }

      .card-title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
      }

      .card-body {
        padding: 20px;
      }

      .card-footer {
        background-color: #f8f9fa;
        padding: 15px 20px;
        border-top: 1px solid #e0e0e0;
        text-align: right;
      }

      /* Badge styling with multiple classes */
      .badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        margin-right: 8px;
      }

      .badge-primary {
        background-color: #667eea;
        color: white;
      }

      .badge-success {
        background-color: #48bb78;
        color: white;
      }

      .badge-warning {
        background-color: #ecc94b;
        color: #333;
      }

      .badge-danger {
        background-color: #f56565;
        color: white;
      }

      /* Form styling */
      .form-group {
        margin-bottom: 20px;
      }

      .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: #333;
      }

      .form-group input,
      .form-group textarea,
      .form-group select {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-family: inherit;
        font-size: 14px;
        transition: border-color 0.3s ease;
      }

      .form-group input:focus,
      .form-group textarea:focus,
      .form-group select:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }

      .form-group textarea {
        resize: vertical;
        min-height: 100px;
      }

      /* Button styling with multiple classes */
      .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: none;
        display: inline-block;
      }

      .btn-primary {
        background-color: #667eea;
        color: white;
      }

      .btn-primary:hover {
        background-color: #5568d3;
      }

      .btn-secondary {
        background-color: #6c757d;
        color: white;
      }

      .btn-secondary:hover {
        background-color: #5a6268;
      }

      .btn-success {
        background-color: #48bb78;
        color: white;
      }

      .btn-success:hover {
        background-color: #38a169;
      }

      .btn-danger {
        background-color: #f56565;
        color: white;
      }

      .btn-danger:hover {
        background-color: #e53e3e;
      }

      .btn-lg {
        padding: 15px 30px;
        font-size: 16px;
      }

      .btn-sm {
        padding: 6px 12px;
        font-size: 12px;
      }

      /* Interactive elements */
      .interactive-item {
        padding: 15px;
        margin: 10px 0;
        background-color: #f0f0f0;
        border-left: 4px solid #667eea;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.3s ease;
      }

      .interactive-item:hover {
        background-color: #e8e8e8;
      }

      .interactive-item.active {
        background-color: #e8eaf6;
        border-left-color: #667eea;
      }

      .counter-display {
        font-size: 24px;
        font-weight: bold;
        color: #667eea;
        text-align: center;
        padding: 20px;
      }

      /* Grid layout */
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
      }

      /* Alert messages with multiple classes */
      .alert {
        padding: 15px;
        border-radius: 4px;
        margin-bottom: 20px;
        border-left: 4px solid;
      }

      .alert-info {
        background-color: #e7f3ff;
        border-left-color: #2196f3;
        color: #0c5aa0;
      }

      .alert-success {
        background-color: #e8f5e9;
        border-left-color: #4caf50;
        color: #2e7d32;
      }

      .alert-warning {
        background-color: #fff3e0;
        border-left-color: #ff9800;
        color: #e65100;
      }

      .alert-danger {
        background-color: #ffebee;
        border-left-color: #f44336;
        color: #c62828;
      }

      .progress {
        width: 100%;
        height: 24px;
        background-color: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
        margin: 10px 0;
      }

      .progress-bar {
        height: 100%;
        background-color: #667eea;
        transition: width 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        font-weight: 600;
      }

      .toggle-switch {
        position: relative;
        display: inline-block;
        width: 50px;
        height: 24px;
      }

      .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: 0.3s;
        border-radius: 24px;
      }

      .toggle-slider::before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: 0.3s;
        border-radius: 50%;
      }

      input:checked + .toggle-slider {
        background-color: #667eea;
      }

      input:checked + .toggle-slider::before {
        transform: translateX(26px);
      }

      .fade-in {
        animation: fadeIn 0.5s ease-in;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .list-item {
        padding: 12px 15px;
        border-bottom: 1px solid #e0e0e0;
      }

      .list-item:last-child {
        border-bottom: none;
      }

      .list-item:hover {
        background-color: #f8f9fa;
      }
    """)

  /**
   * Renders inline JavaScript for interactive functionality.
   * Demonstrates proper integration of JavaScript with template2 using js""" """ syntax.
   */
  def pageScripts: Dom =
    script.inlineJs(js"""
      document.addEventListener('DOMContentLoaded', function() {
        console.log('Advanced page loaded with semantic HTML, CSS, and JavaScript!');

        // Initialize counter functionality
        const counterBtn = document.getElementById('increment-btn');
        const decrementBtn = document.getElementById('decrement-btn');
        const counterDisplay = document.getElementById('counter-display');
        const resetBtn = document.getElementById('reset-btn');

        if (counterDisplay) {
          let counter = parseInt(counterDisplay.getAttribute('data-counter-value') || '0');

          function updateDisplay() {
            counterDisplay.textContent = counter;
            counterDisplay.setAttribute('data-counter-value', counter);

            // Add visual feedback
            counterDisplay.style.animation = 'none';
            setTimeout(() => {
              counterDisplay.style.animation = 'fadeIn 0.3s ease-in';
            }, 10);
          }

          if (counterBtn) {
            counterBtn.addEventListener('click', function() {
              counter++;
              updateDisplay();
              console.log('Counter incremented to: ' + counter);
            });
          }

          if (decrementBtn) {
            decrementBtn.addEventListener('click', function() {
              counter--;
              updateDisplay();
              console.log('Counter decremented to: ' + counter);
            });
          }

          if (resetBtn) {
            resetBtn.addEventListener('click', function() {
              counter = 0;
              updateDisplay();
              console.log('Counter reset to 0');
            });
          }
        }

        // Toggle interactive items
        const toggleItems = document.querySelectorAll('[data-toggleable="true"]');
        toggleItems.forEach(item => {
          item.addEventListener('click', function(e) {
            if (e.target === item) {
              item.classList.toggle('active');
              const itemId = item.getAttribute('data-item-id');
              console.log('Toggled item: ' + itemId);
            }
          });
        });

        // Form submission handler
        const feedbackForm = document.getElementById('feedback-form');
        if (feedbackForm) {
          feedbackForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const nameInput = document.getElementById('feedback-name');
            const messageInput = document.getElementById('feedback-message');
            if (nameInput && messageInput) {
              const name = nameInput.value;
              const message = messageInput.value;
              console.log('Form submitted - Name: ' + name + ', Message: ' + message);
              alert('Thank you for your feedback, ' + name + '!');
              feedbackForm.reset();
            }
          });
        }

        // Progress bar animation
        const progressBars = document.querySelectorAll('[data-progress-value]');
        progressBars.forEach(bar => {
          const value = parseInt(bar.getAttribute('data-progress-value') || '0');
          const barFill = bar.querySelector('.progress-bar');
          if (barFill) {
            setTimeout(() => {
              barFill.style.width = value + '%';
              barFill.textContent = value + '%';
            }, 300);
          }
        });

        // Navigation active state
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('[data-nav-link="true"]');
        navLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href === currentPath || (currentPath === '/' && href === '/')) {
            link.classList.add('active');
          }
        });

        // Keyboard shortcut for counter increment
        document.addEventListener('keydown', function(e) {
          if (e.ctrlKey && e.key === 'ArrowUp') {
            e.preventDefault();
            if (counterBtn) counterBtn.click();
            console.log('Keyboard shortcut: Ctrl+UpArrow pressed');
          }
        });

        // Log all data attributes for debugging
        console.log('Interactive elements initialized:');
        document.querySelectorAll('[data-*]').forEach(el => {
          const attrs = el.dataset;
          if (Object.keys(attrs).length > 0) {
            console.log('Element data attributes:', attrs);
          }
        });
      });
    """)

  /**
   * Reusable card component with semantic structure
   */
  def semanticCard(
    title: String,
    badge: Option[String] = None,
    badgeType: String = "primary"
  )(content: Dom*): Dom.Element =
    div(
      `class` := ("card", "fade-in"),
      data("card-id") := title.toLowerCase.replace(" ", "-")
    )(
      div(`class` := "card-header")(
        h3(`class` := "card-title")(
          title,
          badge.map(b =>
            span(
              `class` := ("badge", s"badge-$badgeType"),
              data("badge-type") := badgeType
            )(b)
          )
        )
      ),
      div(`class` := "card-body")(
        content
      )
    )

  /**
   * Interactive counter component
   */
  def counterSection: Dom.Element =
    semanticCard("Interactive Counter", Some("Interactive"))(
      div(
        p("Click the buttons below to update the counter:"),
        div(
          `class` := "counter-display",
          id := "counter-display",
          data("counter-value") := "0"
        )("0"),
        div(
          `class` := ("grid",),
          style := "margin-top: 20px;"
        )(
          button(
            id := "decrement-btn",
            `class` := ("btn", "btn-lg", "btn-danger"),
            `type` := "button",
            data("action") := "decrement"
          )("- Decrement"),
          button(
            id := "reset-btn",
            `class` := ("btn", "btn-lg", "btn-secondary"),
            `type` := "button",
            data("action") := "reset"
          )("Reset"),
          button(
            id := "increment-btn",
            `class` := ("btn", "btn-lg", "btn-success"),
            `type` := "button",
            data("action") := "increment"
          )("+ Increment")
        ),
        p(
          `class` := "alert alert-info",
          data("hint-type") := "keyboard-shortcut"
        )("💡 Tip: Use Ctrl+UpArrow to increment the counter")
      )
    )

  /**
   * Toggleable items section
   */
  def toggleableItemsSection: Dom.Element =
    semanticCard("Toggleable Items", Some("Interactive"), "warning")(
      p("Click any item to toggle its active state (uses data attributes):"),
      div(
        `class` := "interactive-item",
        data("toggleable") := "true",
        data("item-id") := "feature-1"
      )("✓ Feature 1: Advanced filtering", span(style := "float: right;")("→")),
      div(
        `class` := "interactive-item",
        data("toggleable") := "true",
        data("item-id") := "feature-2"
      )("✓ Feature 2: Real-time updates", span(style := "float: right;")("→")),
      div(
        `class` := "interactive-item",
        data("toggleable") := "true",
        data("item-id") := "feature-3"
      )("✓ Feature 3: Offline support", span(style := "float: right;")("→")),
      div(
        `class` := "interactive-item",
        data("toggleable") := "true",
        data("item-id") := "feature-4"
      )("✓ Feature 4: Mobile optimized", span(style := "float: right;")("→"))
    )

  /**
   * Progress bars section with data attributes
   */
  def progressSection: Dom.Element =
    semanticCard("Progress Indicators", Some("Status"), "success")(
      div(
        p("Project Alpha:", style := "margin: 10px 0; font-weight: 500;"),
        div(
          `class` := "progress",
          data("progress-value") := "75",
          data("project") := "alpha"
        )(
          div(`class` := "progress-bar", style := "width: 0%;")("0%")
        ),
        p("Project Beta:", style := "margin: 10px 0; font-weight: 500;"),
        div(
          `class` := "progress",
          data("progress-value") := "45",
          data("project") := "beta"
        )(
          div(`class` := "progress-bar", style := "width: 0%;")("0%")
        ),
        p("Project Gamma:", style := "margin: 10px 0; font-weight: 500;"),
        div(
          `class` := "progress",
          data("progress-value") := "90",
          data("project") := "gamma"
        )(
          div(`class` := "progress-bar", style := "width: 0%;")("0%")
        )
      )
    )

  /**
   * Form section with accessibility
   */
  def feedbackFormSection: Dom.Element =
    semanticCard("Feedback Form", Some("Form"), "primary")(
      form(
        id := "feedback-form",
        `class` := "form",
        data("form-type") := "feedback",
        data("fields") := ("name", "message")
      )(
        div(`class` := "form-group")(
          label(htmlFor := "feedback-name", data("label-for") := "name")("Your Name"),
          input(
            `type` := "text",
            id := "feedback-name",
            name := "name",
            placeholder := "Enter your name",
            required,
            data("field-type") := "text"
          )
        ),
        div(`class` := "form-group")(
          label(htmlFor := "feedback-message", data("label-for") := "message")("Message"),
          textarea(
            id := "feedback-message",
            name := "message",
            placeholder := "Tell us what you think...",
            required,
            data("field-type") := "textarea"
          )("")
        ),
        div(`class` := "form-group")(
          button(
            `type` := "submit",
            `class` := ("btn", "btn-primary", "btn-lg"),
            data("action") := "submit"
          )("Send Feedback")
        )
      )
    )

  /**
   * Alert messages section demonstrating multiple class usage
   */
  def alertsSection: Dom.Element =
    semanticCard("Alert Messages", Some("Layout"), "danger")(
      div(
        `class` := ("alert", "alert-info"),
        data("alert-type") := "info",
        data("dismissible") := "true"
      )("ℹ️ This is an informational alert with multiple CSS classes"),
      div(
        `class` := ("alert", "alert-success"),
        data("alert-type") := "success",
        data("dismissible") := "true"
      )("✓ Success! Operation completed without errors"),
      div(
        `class` := ("alert", "alert-warning"),
        data("alert-type") := "warning",
        data("dismissible") := "true"
      )("⚠️ Warning: Please review your input before proceeding"),
      div(
        `class` := ("alert", "alert-danger"),
        data("alert-type") := "danger",
        data("dismissible") := "true"
      )("✕ Error: An unexpected issue occurred")
    )

  /**
   * Main page structure with semantic HTML
   */
  def main(args: Array[String]): Unit =
    val page: Dom =
      html(
        head(
          title("Advanced Page with Semantic HTML, CSS, and JavaScript"),
          meta(charset := "UTF-8"),
          meta(name := "viewport", content := "width=device-width, initial-scale=1.0"),
          pageStyles
        ),
        body(
          // SEMANTIC HEADER
          header(
            h1("Advanced Page Builder with Template2")
          ),

          // SEMANTIC NAVIGATION
          nav(
            a(
              href := "/",
              `class` := "nav-link",
              data("nav-link") := "true",
              data("page") := "home"
            )("Home"),
            a(
              href := "/features",
              `class` := "nav-link",
              data("nav-link") := "true",
              data("page") := "features"
            )("Features"),
            a(
              href := "/docs",
              `class` := "nav-link",
              data("nav-link") := "true",
              data("page") := "docs"
            )("Documentation"),
            a(
              href := "/about",
              `class` := "nav-link",
              data("nav-link") := "true",
              data("page") := "about"
            )("About")
          ),

          // SEMANTIC MAIN CONTENT
          main(
            section(
              h2("Welcome to Template2 Advanced Features"),
              p(
                "This page demonstrates a comprehensive example of building a production-ready web application "
                + "using ZIO HTTP's template2 DSL."
              ),
              p(
                "Key features demonstrated:"
              ),
              ul(
                li("Semantic HTML5 structure (header, nav, main, footer)"),
                li("Inline CSS using style.inlineCss(css\"\"\"...\"\"\") with layout and styling"),
                li("Inline JavaScript using script.inlineJs(js\"\"\"...\"\"\") for interactivity"),
                li("Data attributes on interactive elements using data(\"key\") := \"value\""),
                li("Multiple CSS classes using tuple syntax: className := (\"class1\", \"class2\")"),
                li("Reusable component functions for card layouts"),
                li("Conditional rendering based on data"),
                li("Form handling with proper accessibility attributes")
              )
            ),

            section(
              h2("Interactive Components"),
              p("These components use both CSS classes and JavaScript for interactivity:"),
              counterSection,
              toggleableItemsSection,
              progressSection
            ),

            section(
              h2("Form and Validation"),
              feedbackFormSection
            ),

            section(
              h2("Alert and Status Messages"),
              alertsSection
            ),

            section(
              h2("Component Gallery"),
              div(
                `class` := "grid",
                data("section") := "gallery"
              )(
                semanticCard("Card 1", Some("Featured"), "primary")(
                  p("This card demonstrates the reusable semanticCard component."),
                  p("Click for more details...")
                ),
                semanticCard("Card 2", Some("New"), "success")(
                  p("Each card uses semantic HTML structure."),
                  p("Multiple CSS classes for styling and layout.")
                ),
                semanticCard("Card 3", Some("Popular"), "warning")(
                  p("Cards are composable and reusable."),
                  p("Built with template2 DSL in pure Scala.")
                )
              )
            ),

            section(
              h2("Implementation Details"),
              semanticCard("Semantic HTML Structure")(
                ul(
                  li(
                    strong("&lt;header&gt;"),
                    " - Contains the main title and site branding"
                  ),
                  li(
                    strong("&lt;nav&gt;"),
                    " - Navigation links with data attributes for tracking"
                  ),
                  li(
                    strong("&lt;main&gt;"),
                    " - Primary content area with semantic sections"
                  ),
                  li(
                    strong("&lt;footer&gt;"),
                    " - Footer with copyright and additional links"
                  )
                )
              ),
              semanticCard("CSS Integration")(
                ul(
                  li(
                    "Inline CSS using ",
                    code("style.inlineCss(css\"\"\"...\"\"\")")
                  ),
                  li(
                    "Multiple classes applied with tuples: ",
                    code("className := (\"class1\", \"class2\")")
                  ),
                  li("Flexbox and Grid for responsive layouts"),
                  li("Transitions and animations for visual feedback"),
                  li("Mobile-first responsive design")
                )
              ),
              semanticCard("JavaScript Integration")(
                ul(
                  li(
                    "Inline JavaScript using ",
                    code("script.inlineJs(js\"\"\"...\"\"\")")
                  ),
                  li("Event listeners for interactive elements"),
                  li("Data attributes for element identification"),
                  li("DOM manipulation and state management"),
                  li("Keyboard shortcuts and accessibility")
                )
              ),
              semanticCard("Data Attributes")(
                ul(
                  li(
                    "Pattern: ",
                    code("data(\"key\") := \"value\"")
                  ),
                  li("Used for: element identification, state tracking, configuration"),
                  li("Enables JavaScript to query and manipulate elements"),
                  li("Provides semantic meaning to interactive elements"),
                  li("Example: data(\"item-id\"), data(\"action\"), data(\"status\")")
                )
              )
            )
          ),

          // SEMANTIC FOOTER
          footer(
            p("Built with ZIO HTTP Template2"),
            p(
              "© 2026 Advanced Template2 Examples. All rights reserved."
            ),
            p(
              "For more information, visit ",
              a(href := "https://zio.dev/zio-http")("ZIO HTTP Documentation")
            )
          ),

          pageScripts
        )
      )

    // Render and print the complete HTML
    println(page.render(indentation = true))
    println("\n\n=== Successfully compiled and rendered AdvancedPage ===")
    println("✓ Semantic HTML structure (header, nav, main, footer)")
    println("✓ Inline CSS with style.inlineCss(css\"\"\"...\"\"\")")
    println("✓ Inline JavaScript with script.inlineJs(js\"\"\"...\"\"\")")
    println("✓ Data attributes using data(\"key\") := \"value\" pattern")
    println("✓ Multiple CSS classes using tuple syntax")
    println("✓ Reusable components and conditional rendering")
    println("\n")
