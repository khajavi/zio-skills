package example.template2

import zio._
import zio.http._
import zio.http.template2._

/**
 * Demonstrates conditional rendering patterns:
 * - Using Option.map for optional fields
 * - Using if/else for different content branches
 * - Using .when() for conditional attributes
 * - Using .whenSome() for optional attributes
 */
object ConditionalRenderingExample extends ZIOAppDefault {

  case class User(
    id: String,
    name: String,
    email: Option[String],
    avatar: Option[String],
    role: Option[String],
    isActive: Boolean
  )

  def userProfile(user: User): Dom =
    html(
      head(
        meta(charset := "UTF-8"),
        title(s"${user.name} - Profile")
      ),
      body(
        div(`class` := "container")(
          div(`class` := "profile-card")(
            // Header with conditional styling
            div(
              `class` := "profile-header"
            ).when(user.isActive)(
              `class` := "active"
            )(
              h1(user.name),
              if (user.isActive)
                span(`class` := "badge badge-active")("Active")
              else
                span(`class` := "badge badge-inactive")("Inactive")
            ),
            // Avatar section - only shows if avatar exists
            user.avatar.map(avatarUrl =>
              div(`class` := "profile-avatar")(
                img(src := avatarUrl, alt := s"${user.name}'s avatar")
              )
            ),
            // Email section - only shows if email exists
            user.email.map(emailAddr =>
              div(`class` := "profile-email")(
                strong("Email: "),
                a(href := s"mailto:$emailAddr")(emailAddr)
              )
            ),
            // Role badge - only shows for admin/moderator
            user.role.flatMap {
              case "admin" =>
                Some(
                  div(`class` := "role-section")(
                    span(`class` := "badge badge-admin")("Administrator"),
                    p("You have full access to all features.")
                  )
                )
              case "moderator" =>
                Some(
                  div(`class` := "role-section")(
                    span(`class` := "badge badge-moderator")("Moderator"),
                    p("You can moderate user content.")
                  )
                )
              case _ =>
                None
            },
            // Action buttons
            div(`class` := "actions")(
              button(
                `class` := "btn btn-primary"
              )("Edit Profile"),
              user.email.map(_ =>
                button(
                  `class` := "btn btn-secondary"
                )("Send Message")
              ),
              if (user.isActive)
                button(
                  `class` := "btn btn-danger"
                )("Deactivate")
              else
                Dom.empty
            )
          ),
          // Additional info section
          section(
            h2("Account Information"),
            dl(
              dt("User ID"),
              dd(user.id),
              dt("Status"),
              dd(
                if (user.isActive) "Active" else "Inactive"
              ),
              user.role.map { role =>
                Seq(
                  dt("Role"),
                  dd(role.capitalize)
                )
              }.getOrElse(Seq(
                dt("Role"),
                dd("Standard User")
              ))
            )
          )
        )
      )
    )

  // Example users
  val adminUser = User(
    id = "1",
    name = "Alice Admin",
    email = Some("alice@example.com"),
    avatar = Some("https://via.placeholder.com/150"),
    role = Some("admin"),
    isActive = true
  )

  val regularUser = User(
    id = "2",
    name = "Bob User",
    email = Some("bob@example.com"),
    avatar = None,
    role = None,
    isActive = true
  )

  val inactiveUser = User(
    id = "3",
    name = "Charlie Inactive",
    email = None,
    avatar = Some("https://via.placeholder.com/150"),
    role = Some("moderator"),
    isActive = false
  )

  override def run: ZIO[Any, Throwable, Unit] =
    Server
      .serve(
        Routes(
          Method.GET / "user" / "1" -> handler {
            Response.html(userProfile(adminUser))
          },
          Method.GET / "user" / "2" -> handler {
            Response.html(userProfile(regularUser))
          },
          Method.GET / "user" / "3" -> handler {
            Response.html(userProfile(inactiveUser))
          },
          Method.GET / Root -> handler {
            Response.html(
              html(
                head(title("User Profiles")),
                body(
                  h1("Example User Profiles"),
                  ul(
                    li(a(href := "/user/1")("Admin User")),
                    li(a(href := "/user/2")("Regular User")),
                    li(a(href := "/user/3")("Inactive User"))
                  )
                )
              )
            )
          }
        )
      )
      .provide(Server.default)
}
