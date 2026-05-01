package example.template2

import zio._
import zio.http._
import zio.http.template2._

/**
 * User profile page demonstrating:
 * - Option.map for optional email address
 * - Option.map for optional avatar image with img element (no children)
 * - if/else for conditional role badge that only shows for admins
 * - Semantic HTML structure
 */
object UserProfileExample extends ZIOAppDefault {

  case class User(
    name: String,
    email: Option[String],
    avatar: Option[String],
    isAdmin: Boolean
  )

  def userProfilePage(user: User): Dom =
    html(
      head(
        meta(charset := "UTF-8"),
        meta(name := "viewport", content := "width=device-width, initial-scale=1"),
        title(s"${user.name} - Profile")
      ),
      body(
        div(`class` := "profile-container")(
          // Profile card header
          article(`class` := "profile-card")(
            // User name (always shown)
            h1(user.name),

            // Optional avatar image - uses Option.map with img as void element
            user.avatar.map(avatarUrl =>
              div(`class` := "avatar-section")(
                img(src := avatarUrl, alt := s"${user.name}'s avatar")
              )
            ),

            // Optional email - uses Option.map
            user.email.map(emailAddr =>
              div(`class` := "email-section")(
                strong("Email: "),
                a(href := s"mailto:$emailAddr")(emailAddr)
              )
            ),

            // Role badge - conditional rendering for admin users
            if (user.isAdmin)
              div(`class` := "role-section")(
                span(`class` := "badge badge-admin")("Administrator")
              )
            else
              Dom.empty
          )
        )
      )
    )

  // Example users for testing different scenarios
  val adminUserWithAll = User(
    name = "Alice Admin",
    email = Some("alice@example.com"),
    avatar = Some("https://via.placeholder.com/150"),
    isAdmin = true
  )

  val regularUserWithEmail = User(
    name = "Bob User",
    email = Some("bob@example.com"),
    avatar = None,
    isAdmin = false
  )

  val userWithoutEmail = User(
    name = "Charlie NoEmail",
    email = None,
    avatar = Some("https://via.placeholder.com/150"),
    isAdmin = false
  )

  val minimalUser = User(
    name = "Diana Minimal",
    email = None,
    avatar = None,
    isAdmin = false
  )

  override def run: ZIO[Any, Throwable, Unit] =
    Server
      .serve(
        Routes(
          Method.GET / "user" / "admin" -> handler {
            Response.html(userProfilePage(adminUserWithAll))
          },
          Method.GET / "user" / "regular" -> handler {
            Response.html(userProfilePage(regularUserWithEmail))
          },
          Method.GET / "user" / "no-email" -> handler {
            Response.html(userProfilePage(userWithoutEmail))
          },
          Method.GET / "user" / "minimal" -> handler {
            Response.html(userProfilePage(minimalUser))
          },
          Method.GET / Root -> handler {
            Response.html(
              html(
                head(title("User Profiles")),
                body(
                  h1("User Profile Examples"),
                  ul(
                    li(a(href := "/user/admin")("Admin with All Fields")),
                    li(a(href := "/user/regular")("Regular User with Email")),
                    li(a(href := "/user/no-email")("User with Avatar but No Email")),
                    li(a(href := "/user/minimal")("Minimal User (Name Only)"))
                  )
                )
              )
            )
          }
        )
      )
      .provide(Server.default)
}
