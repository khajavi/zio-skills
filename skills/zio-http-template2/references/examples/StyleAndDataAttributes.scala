package example.template2

import zio._
import zio.http._
import zio.http.template2._

/**
 * Demonstrates styling and data attribute patterns:
 * - CSS classes (single, multiple, conditional, from collections)
 * - Inline styles
 * - Data attributes
 * - Custom attributes
 * - Attribute manipulation
 */
object StyleAndDataAttributesExample extends ZIOAppDefault {

  case class Product(
    id: String,
    name: String,
    price: Double,
    inStock: Boolean,
    category: String,
    tags: List[String]
  )

  val products = List(
    Product("1", "Laptop", 999.99, true, "Electronics", List("computers", "portable")),
    Product("2", "Mouse", 29.99, true, "Electronics", List("accessories", "peripherals")),
    Product("3", "Keyboard", 79.99, false, "Electronics", List("accessories", "peripherals")),
    Product("4", "Monitor", 299.99, true, "Electronics", List("displays", "accessories"))
  )

  def productCard(product: Product): Dom.Element = {
    div(
      `class` := ("product-card", product.category.toLowerCase),
      data("product-id") := product.id,
      data("in-stock") := product.inStock.toString,
      data("price") := product.price.toString,
      data("tags") := product.tags
    ).when(product.inStock)(
      `class` := "in-stock"
    ).when(!product.inStock)(
      `class` := "out-of-stock"
    )(
      div(`class` := "card-header")(
        h3(product.name),
        // Conditional stock badge
        if (product.inStock)
          span(`class` := ("badge", "badge-success"))("In Stock")
        else
          span(`class` := ("badge", "badge-danger"))("Out of Stock")
      ),
      div(`class` := "card-body")(
        p(`class` := "price")(s"$${product.price}"),
        p(`class` := "category")(product.category),
        // Tags display
        div(`class` := "tags")(
          product.tags.map(tag =>
            span(`class` := ("tag", s"tag-$tag"))(tag)
          )
        )
      ),
      div(`class` := "card-footer")(
        button(
          `class` := "btn btn-primary",
          data("action") := "add-to-cart",
          data("product-id") := product.id
        ).when(!product.inStock)(
          Dom.attr("disabled") := ""
        )(
          if (product.inStock) "Add to Cart" else "Currently Unavailable"
        )
      )
    )
  }

  val page: Dom =
    html(
      head(
        meta(charset := "UTF-8"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1"),
        title("Styles and Data Attributes Example"),
        style.inlineCss(css"""
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f0f2f5;
            padding: 20px;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
          }
          h1 {
            color: #333;
            margin-bottom: 30px;
            text-align: center;
          }
          .filters {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .filters h2 {
            color: #333;
            margin-bottom: 15px;
            font-size: 1.2rem;
          }
          .filter-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 15px;
          }
          .filter-btn {
            padding: 8px 16px;
            border: 2px solid #ddd;
            background: white;
            cursor: pointer;
            border-radius: 20px;
            transition: all 0.3s ease;
            font-size: 0.95rem;
          }
          .filter-btn:hover {
            border-color: #667eea;
            color: #667eea;
          }
          .filter-btn.active {
            background: #667eea;
            color: white;
            border-color: #667eea;
          }
          .products-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
          }
          .product-card {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            border-left: 4px solid #ccc;
          }
          .product-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
          }
          .product-card.Electronics {
            border-left-color: #667eea;
          }
          .product-card.in-stock {
            opacity: 1;
          }
          .product-card.out-of-stock {
            opacity: 0.7;
            background: #f9f9f9;
          }
          .card-header {
            padding: 15px;
            background: #f5f5f5;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: start;
            gap: 10px;
          }
          .card-header h3 {
            margin: 0;
            color: #333;
            font-size: 1.1rem;
            flex: 1;
          }
          .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85rem;
            font-weight: 600;
            white-space: nowrap;
          }
          .badge-success {
            background: #d4edda;
            color: #155724;
          }
          .badge-danger {
            background: #f8d7da;
            color: #721c24;
          }
          .card-body {
            padding: 15px;
          }
          .price {
            font-size: 1.5rem;
            color: #667eea;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .category {
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 10px;
          }
          .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }
          .tag {
            display: inline-block;
            padding: 4px 10px;
            background: #f0f0f0;
            border-radius: 4px;
            font-size: 0.85rem;
            color: #555;
          }
          .tag-computers {
            background: #e3f2fd;
            color: #1565c0;
          }
          .tag-accessories {
            background: #f3e5f5;
            color: #6a1b9a;
          }
          .tag-peripherals {
            background: #e8f5e9;
            color: #2e7d32;
          }
          .tag-displays {
            background: #fff3e0;
            color: #e65100;
          }
          .tag-portable {
            background: #fce4ec;
            color: #c2185b;
          }
          .card-footer {
            padding: 15px;
            background: #f9f9f9;
            border-top: 1px solid #eee;
          }
          .btn {
            display: block;
            width: 100%;
            padding: 10px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            transition: background 0.3s ease;
          }
          .btn:hover:not(:disabled) {
            background: #764ba2;
          }
          .btn:disabled {
            background: #ccc;
            cursor: not-allowed;
            opacity: 0.6;
          }
          .color-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
          }
          .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.9rem;
            color: #666;
          }
          .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 3px;
          }
        """)
      ),
      body(
        div(`class` := "container")(
          h1("Products with Styles and Data Attributes"),
          // Filters
          div(`class` := "filters")(
            h2("Filter by Category"),
            div(`class` := "filter-buttons")(
              button(`class` := ("filter-btn", "active"), data("filter") := "all")("All Products"),
              button(`class` := "filter-btn", data("filter") := "electronics")("Electronics")
            ),
            h2("Stock Status"),
            div(`class` := "filter-buttons")(
              button(`class` := ("filter-btn", "active"), data("filter") := "all-stock")("All"),
              button(`class` := "filter-btn", data("filter") := "in-stock")("In Stock"),
              button(`class` := "filter-btn", data("filter") := "out-of-stock")("Out of Stock")
            ),
            div(`class` := "color-legend")(
              div(`class` := "legend-item")(
                div(`class` := "legend-color", styleAttr := "background: #667eea;")(),
                span("Electronics products")
              ),
              div(`class` := "legend-item")(
                div(`class` := "legend-color", styleAttr := "background: #d4edda;")(),
                span("In stock")
              ),
              div(`class` := "legend-item")(
                div(`class` := "legend-color", styleAttr := "background: #f8d7da;")(),
                span("Out of stock")
              )
            )
          ),
          // Products grid
          div(`class` := "products-grid")(
            products.map(productCard)
          )
        ),
        script.inlineJs(js"""
          // Filter functionality
          const filterBtns = document.querySelectorAll('.filter-btn');
          const productCards = document.querySelectorAll('.product-card');

          filterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
              const filter = this.dataset.filter;
              console.log('Filter clicked:', filter);
              this.classList.toggle('active');
            });
          });

          // Add to cart functionality
          const addButtons = document.querySelectorAll('[data-action="add-to-cart"]');
          addButtons.forEach(btn => {
            btn.addEventListener('click', function() {
              const productId = this.dataset.productId;
              alert('Added product ' + productId + ' to cart!');
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
