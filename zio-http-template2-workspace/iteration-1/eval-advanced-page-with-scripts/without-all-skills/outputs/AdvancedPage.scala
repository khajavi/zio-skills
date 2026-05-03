package example.advanced

import zio._
import zio.http._
import zio.http.template2._

/**
 * Advanced HTML page demonstrating:
 * - Semantic HTML structure (header, nav, main, footer)
 * - Inline CSS using style.inlineCss() with css interpolator
 * - Inline JavaScript using script.inlineJs() with js interpolator
 * - Data attributes using data("key") := "value" syntax
 * - Multiple CSS classes on elements
 * - Interactive UI components
 */
object AdvancedPage extends ZIOAppDefault {

  case class Article(
    id: String,
    title: String,
    category: String,
    excerpt: String,
    readTime: Int,
    featured: Boolean,
    tags: List[String]
  )

  val articles = List(
    Article(
      "1",
      "Getting Started with ZIO",
      "Technology",
      "Learn the fundamentals of effect-oriented programming with ZIO...",
      5,
      true,
      List("zio", "scala", "functional")
    ),
    Article(
      "2",
      "Advanced Fiber Management",
      "Technology",
      "Deep dive into fiber scheduling and resource management...",
      8,
      true,
      List("zio", "concurrency", "advanced")
    ),
    Article(
      "3",
      "Building Web APIs",
      "Tutorial",
      "Create robust HTTP APIs using ZIO HTTP with type safety...",
      10,
      false,
      List("zio-http", "api", "tutorial")
    ),
    Article(
      "4",
      "Error Handling Patterns",
      "Best Practices",
      "Explore idiomatic error handling in ZIO applications...",
      7,
      false,
      List("zio", "errors", "patterns")
    )
  )

  def articleCard(article: Article): Dom.Element = {
    div(
      `class` := ("article-card", article.category.toLowerCase, if (article.featured) "featured" else ""),
      data("article-id") := article.id,
      data("category") := article.category,
      data("read-time") := article.readTime.toString,
      data("featured") := article.featured.toString,
      data("tags") := article.tags.mkString(",")
    )(
      div(`class` := ("card-header", "header-gradient"))(
        h3(`class` := "article-title")(article.title),
        if (article.featured)
          span(`class` := ("badge", "badge-featured", "badge-gold"))("Featured")
        else
          span(`class` := ("badge", "badge-standard"))("Article")
      ),
      div(`class` := ("card-body", "body-content"))(
        p(`class` := ("excerpt", "text-secondary"))(article.excerpt),
        div(`class` := ("tags-container", "flex-row"))(
          article.tags.map(tag =>
            span(`class` := ("tag", s"tag-${tag.replace(" ", "-").toLowerCase}"))(tag)
          )
        )
      ),
      div(`class` := ("card-footer", "footer-meta"))(
        div(`class` := ("meta-info", "flex-between"))(
          span(`class` := ("category-badge", "category-badge-default"))(article.category),
          span(`class` := ("read-time", "text-muted"))(`data-value` := article.readTime.toString)(
            s"${article.readTime} min read"
          )
        ),
        button(
          `class` := ("btn", "btn-primary", "btn-small"),
          `type` := "button",
          data("action") := "read-more",
          data("article-id") := article.id
        )("Read More →")
      )
    )
  }

  val page: Dom =
    html(
      head(
        meta(charset := "UTF-8"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1.0"),
        title("Advanced Page with Semantic HTML, CSS, and JavaScript"),
        style.inlineCss(css"""
          /* Reset and Global Styles */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          :root {
            --primary-color: #667eea;
            --primary-dark: #764ba2;
            --secondary-color: #f093fb;
            --success-color: #48bb78;
            --warning-color: #ed8936;
            --danger-color: #f56565;
            --light-bg: #f7fafc;
            --dark-text: #2d3748;
            --border-color: #e2e8f0;
            --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
            --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
            --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.1);
          }

          html, body {
            width: 100%;
            height: 100%;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            color: var(--dark-text);
            line-height: 1.6;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }

          /* Header Styles */
          header {
            background: linear-gradient(90deg, var(--primary-color) 0%, var(--primary-dark) 100%);
            color: white;
            padding: 20px 0;
            box-shadow: var(--shadow-md);
            position: sticky;
            top: 0;
            z-index: 100;
          }

          header .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          header h1 {
            font-size: 1.8rem;
            font-weight: 700;
            margin: 0;
          }

          header .tagline {
            font-size: 0.9rem;
            opacity: 0.9;
            margin-left: 10px;
          }

          /* Navigation Styles */
          nav {
            background: rgba(255, 255, 255, 0.95);
            border-bottom: 2px solid var(--border-color);
            position: sticky;
            top: 70px;
            z-index: 99;
          }

          nav .nav-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            display: flex;
            align-items: center;
            gap: 30px;
            height: 50px;
          }

          nav a {
            color: var(--dark-text);
            text-decoration: none;
            font-weight: 500;
            padding: 8px 12px;
            border-radius: 4px;
            transition: all 0.3s ease;
            cursor: pointer;
          }

          nav a:hover {
            background: var(--light-bg);
            color: var(--primary-color);
          }

          nav a.active {
            color: var(--primary-color);
            border-bottom: 3px solid var(--primary-color);
            padding-bottom: 5px;
          }

          /* Main Content Styles */
          main {
            flex: 1;
            max-width: 1200px;
            margin: 40px auto;
            width: 100%;
            padding: 0 20px;
          }

          .page-header {
            margin-bottom: 40px;
            text-align: center;
          }

          .page-header h2 {
            font-size: 2.5rem;
            margin-bottom: 15px;
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          .page-header p {
            font-size: 1.1rem;
            color: #718096;
            max-width: 600px;
            margin: 0 auto;
          }

          /* Filter and Search Section */
          .filters-section {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: var(--shadow-md);
            margin-bottom: 40px;
          }

          .filter-group {
            margin-bottom: 20px;
          }

          .filter-group:last-child {
            margin-bottom: 0;
          }

          .filter-group label {
            display: block;
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--dark-text);
          }

          .filter-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            align-items: center;
          }

          .filter-btn {
            padding: 8px 16px;
            border: 2px solid var(--border-color);
            background: white;
            color: var(--dark-text);
            cursor: pointer;
            border-radius: 20px;
            transition: all 0.3s ease;
            font-size: 0.95rem;
            font-weight: 500;
            user-select: none;
          }

          .filter-btn:hover {
            border-color: var(--primary-color);
            color: var(--primary-color);
            transform: translateY(-2px);
          }

          .filter-btn.active {
            background: var(--primary-color);
            color: white;
            border-color: var(--primary-color);
          }

          /* Articles Grid */
          .articles-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
          }

          /* Article Card Styles */
          .article-card {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: var(--shadow-sm);
            transition: all 0.3s ease;
            border: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
          }

          .article-card:hover {
            transform: translateY(-8px);
            box-shadow: var(--shadow-lg);
            border-color: var(--primary-color);
          }

          .article-card.featured {
            border: 2px solid var(--secondary-color);
            position: relative;
          }

          .article-card.featured::before {
            content: '✨ Featured';
            position: absolute;
            top: 10px;
            right: 10px;
            background: var(--secondary-color);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 700;
            z-index: 10;
          }

          .article-card.technology {
            border-left: 4px solid #667eea;
          }

          .article-card.tutorial {
            border-left: 4px solid #48bb78;
          }

          .article-card.bestpractices {
            border-left: 4px solid #ed8936;
          }

          /* Card Header */
          .card-header {
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 10px;
            min-height: 80px;
          }

          .header-gradient {
            background: linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%);
            border-bottom: 1px solid var(--border-color);
          }

          .article-title {
            margin: 0;
            color: var(--dark-text);
            font-size: 1.2rem;
            font-weight: 600;
            line-height: 1.4;
            flex: 1;
          }

          .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 700;
            white-space: nowrap;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .badge-featured {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
          }

          .badge-gold {
            background: #fbbf24;
            color: #78350f;
          }

          .badge-standard {
            background: var(--light-bg);
            color: var(--dark-text);
          }

          /* Card Body */
          .card-body {
            flex: 1;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 15px;
          }

          .body-content {
            background: white;
            border-bottom: 1px solid var(--border-color);
          }

          .excerpt {
            margin: 0;
            color: #718096;
            line-height: 1.6;
            font-size: 0.95rem;
          }

          .text-secondary {
            color: #718096;
          }

          .text-muted {
            color: #a0aec0;
            font-size: 0.85rem;
          }

          .flex-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
          }

          .tags-container {
            margin-top: 10px;
          }

          .tag {
            display: inline-block;
            padding: 4px 10px;
            background: var(--light-bg);
            border-radius: 4px;
            font-size: 0.8rem;
            color: #4a5568;
            font-weight: 500;
            transition: all 0.2s ease;
            cursor: default;
          }

          .tag:hover {
            background: var(--primary-color);
            color: white;
          }

          .tag-zio {
            background: #e0e7ff;
            color: #3730a3;
          }

          .tag-scala {
            background: #fef3c7;
            color: #92400e;
          }

          .tag-functional {
            background: #dcfce7;
            color: #15803d;
          }

          .tag-concurrency {
            background: #fce7f3;
            color: #831843;
          }

          .tag-advanced {
            background: #f3e8ff;
            color: #581c87;
          }

          .tag-zio-http {
            background: #e0f2fe;
            color: #0c4a6e;
          }

          .tag-api {
            background: #fed7aa;
            color: #7c2d12;
          }

          .tag-tutorial {
            background: #d1fae5;
            color: #065f46;
          }

          .tag-errors {
            background: #fee2e2;
            color: #7f1d1d;
          }

          .tag-patterns {
            background: #f5f3ff;
            color: #4c1d95;
          }

          /* Card Footer */
          .card-footer {
            padding: 15px 20px;
            background: var(--light-bg);
            border-top: 1px solid var(--border-color);
          }

          .footer-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
          }

          .meta-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
            flex: 1;
          }

          .flex-between {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .category-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .category-badge-default {
            background: var(--primary-color);
            color: white;
          }

          .read-time {
            font-size: 0.85rem;
            color: #a0aec0;
          }

          /* Button Styles */
          button {
            cursor: pointer;
            font-family: inherit;
            transition: all 0.3s ease;
            border: none;
            outline: none;
            font-weight: 600;
          }

          .btn {
            padding: 10px 20px;
            border-radius: 4px;
            font-size: 0.95rem;
            transition: all 0.3s ease;
          }

          .btn-primary {
            background: var(--primary-color);
            color: white;
          }

          .btn-primary:hover:not(:disabled) {
            background: var(--primary-dark);
            transform: translateY(-2px);
            box-shadow: var(--shadow-md);
          }

          .btn-primary:active:not(:disabled) {
            transform: translateY(0);
          }

          .btn-small {
            padding: 8px 16px;
            font-size: 0.85rem;
          }

          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          /* Footer Styles */
          footer {
            background: #2d3748;
            color: #cbd5e0;
            padding: 40px 20px 20px;
            text-align: center;
            margin-top: auto;
          }

          footer .footer-container {
            max-width: 1200px;
            margin: 0 auto;
          }

          footer h3 {
            color: white;
            margin-bottom: 15px;
          }

          footer p {
            margin: 10px 0;
            font-size: 0.95rem;
          }

          footer a {
            color: var(--primary-color);
            text-decoration: none;
            transition: color 0.3s ease;
          }

          footer a:hover {
            color: var(--secondary-color);
            text-decoration: underline;
          }

          .footer-links {
            margin: 20px 0;
            display: flex;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
          }

          .footer-links a {
            font-size: 0.9rem;
          }

          .copyright {
            border-top: 1px solid #4a5568;
            padding-top: 20px;
            margin-top: 20px;
            color: #a0aec0;
            font-size: 0.85rem;
          }

          /* Responsive Design */
          @media (max-width: 768px) {
            header .container {
              flex-direction: column;
              gap: 10px;
              text-align: center;
            }

            nav .nav-container {
              gap: 15px;
              flex-wrap: wrap;
            }

            main {
              margin: 20px auto;
            }

            .page-header h2 {
              font-size: 1.8rem;
            }

            .articles-grid {
              grid-template-columns: 1fr;
            }

            .filters-section {
              padding: 20px;
            }

            .filter-buttons {
              flex-direction: column;
              align-items: flex-start;
            }

            .filter-btn {
              width: 100%;
            }

            .meta-info {
              flex-direction: column;
              align-items: flex-start;
            }

            footer .footer-links {
              flex-direction: column;
              gap: 10px;
            }
          }
        """)
      ),
      body(
        header(
          div(`class` := "container")(
            div(
              h1("Article Hub"),
              span(`class` := "tagline")("Discover quality content")
            )
          )
        ),
        nav(
          div(`class` := "nav-container")(
            a(
              href := "#",
              `class` := ("nav-link", "active"),
              data("nav") := "all"
            )("All Articles"),
            a(
              href := "#",
              `class` := "nav-link",
              data("nav") := "featured"
            )("Featured"),
            a(
              href := "#",
              `class` := "nav-link",
              data("nav") := "technology"
            )("Technology"),
            a(
              href := "#",
              `class` := "nav-link",
              data("nav") := "tutorials"
            )("Tutorials")
          )
        ),
        main(
          div(`class` := "page-header")(
            h2("Discover Great Articles"),
            p("Browse our collection of curated articles on technology, tutorials, and best practices.")
          ),
          section(`class` := "filters-section")(
            div(`class` := "filter-group")(
              label("Filter by Category"),
              div(`class` := "filter-buttons")(
                button(
                  `class` := ("filter-btn", "active"),
                  `type` := "button",
                  data("filter") := "all"
                )("All Categories"),
                button(
                  `class` := "filter-btn",
                  `type` := "button",
                  data("filter") := "technology"
                )("Technology"),
                button(
                  `class` := "filter-btn",
                  `type` := "button",
                  data("filter") := "tutorial"
                )("Tutorials"),
                button(
                  `class` := "filter-btn",
                  `type` := "button",
                  data("filter") := "bestpractices"
                )("Best Practices")
              )
            ),
            div(`class` := "filter-group")(
              label("Reading Time"),
              div(`class` := "filter-buttons")(
                button(
                  `class` := ("filter-btn", "active"),
                  `type` := "button",
                  data("filter-time") := "all"
                )("All"),
                button(
                  `class` := "filter-btn",
                  `type` := "button",
                  data("filter-time") := "quick",
                  data("max-time") := "5"
                )("Quick (≤5 min)"),
                button(
                  `class` := "filter-btn",
                  `type` := "button",
                  data("filter-time") := "medium",
                  data("min-time") := "5",
                  data("max-time") := "10"
                )("Medium (5-10 min)"),
                button(
                  `class` := "filter-btn",
                  `type` := "button",
                  data("filter-time") := "long",
                  data("min-time") := "10"
                )("Long (10+ min)")
              )
            )
          ),
          section(
            div(`class` := "articles-grid")(
              articles.map(articleCard)
            )
          )
        ),
        footer(
          div(`class` := "footer-container")(
            h3("Article Hub"),
            p("Your source for high-quality technical articles and tutorials."),
            div(`class` := "footer-links")(
              a(href := "#", data("footer-link") := "about")("About"),
              a(href := "#", data("footer-link") := "contact")("Contact"),
              a(href := "#", data("footer-link") := "privacy")("Privacy"),
              a(href := "#", data("footer-link") := "terms")("Terms")
            ),
            div(`class` := "copyright")(
              p("© 2024 Article Hub. All rights reserved.")
            )
          )
        ),
        script.inlineJs(js"""
          // Navigation link activation
          const navLinks = document.querySelectorAll('[data-nav]');
          navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
              e.preventDefault();
              navLinks.forEach(l => l.classList.remove('active'));
              this.classList.add('active');
              const nav = this.dataset.nav;
              console.log('Navigation clicked:', nav);
            });
          });

          // Category filter functionality
          const categoryFilters = document.querySelectorAll('[data-filter]:not([data-filter-time])');
          categoryFilters.forEach(btn => {
            btn.addEventListener('click', function() {
              categoryFilters.forEach(b => b.classList.remove('active'));
              this.classList.add('active');
              const filter = this.dataset.filter;
              console.log('Category filter applied:', filter);
              filterArticles();
            });
          });

          // Reading time filter functionality
          const timeFilters = document.querySelectorAll('[data-filter-time]');
          timeFilters.forEach(btn => {
            btn.addEventListener('click', function() {
              timeFilters.forEach(b => b.classList.remove('active'));
              this.classList.add('active');
              const filterTime = this.dataset.filterTime;
              console.log('Time filter applied:', filterTime);
              filterArticles();
            });
          });

          // Filter articles based on current selections
          function filterArticles() {
            const activeCategory = document.querySelector('[data-filter].active').dataset.filter;
            const activeTime = document.querySelector('[data-filter-time].active').dataset.filterTime;
            const articles = document.querySelectorAll('.article-card');

            articles.forEach(article => {
              let showArticle = true;

              // Check category filter
              if (activeCategory !== 'all') {
                const category = article.dataset.category.toLowerCase();
                showArticle = showArticle && category === activeCategory;
              }

              // Check time filter
              if (activeTime !== 'all') {
                const readTime = parseInt(article.dataset.readTime);
                if (activeTime === 'quick') {
                  showArticle = showArticle && readTime <= 5;
                } else if (activeTime === 'medium') {
                  showArticle = showArticle && readTime > 5 && readTime <= 10;
                } else if (activeTime === 'long') {
                  showArticle = showArticle && readTime > 10;
                }
              }

              // Toggle visibility
              article.style.display = showArticle ? 'flex' : 'none';
            });
          }

          // Read more button functionality
          const readMoreBtns = document.querySelectorAll('[data-action="read-more"]');
          readMoreBtns.forEach(btn => {
            btn.addEventListener('click', function() {
              const articleId = this.dataset.articleId;
              const card = this.closest('.article-card');
              const title = card.querySelector('.article-title').textContent;
              alert('Opening article #' + articleId + ': ' + title);
              console.log('Read more clicked for article:', articleId);
            });
          });

          // Footer link tracking
          const footerLinks = document.querySelectorAll('[data-footer-link]');
          footerLinks.forEach(link => {
            link.addEventListener('click', function(e) {
              e.preventDefault();
              const linkType = this.dataset.footerLink;
              console.log('Footer link clicked:', linkType);
            });
          });

          // Add animation on page load
          window.addEventListener('load', function() {
            const cards = document.querySelectorAll('.article-card');
            cards.forEach((card, index) => {
              card.style.opacity = '0';
              card.style.transform = 'translateY(20px)';
              setTimeout(() => {
                card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
              }, index * 50);
            });
          });
        """)
      )
    )

  override def run: ZIO[Any, Throwable, Unit] =
    Server
      .serve(
        Method.GET / Root -> handler {
          Response.html(page)
        }
      )
      .provide(Server.default)
}
