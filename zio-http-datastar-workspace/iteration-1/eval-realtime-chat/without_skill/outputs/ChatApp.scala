package example.datastar

import zio._
import zio.http._
import zio.http.datastar._
import zio.http.template2._
import java.time.LocalTime
import java.time.format.DateTimeFormatter

object ChatApp extends ZIOAppDefault {

  // Message data class
  case class Message(username: String, text: String, timestamp: String)

  // ChatRoom service with Hub for broadcasting and Ref for history
  object ChatRoom {
    type ChatRoom = Has[Service]

    trait Service {
      def publish(message: Message): Task[Unit]
      def subscribe: Task[ZStream[Any, Nothing, Message]]
      def getHistory: Task[List[Message]]
    }

    class Live(
        hub: Hub[Message],
        historyRef: Ref[List[Message]],
    ) extends Service {
      def publish(message: Message): Task[Unit] =
        historyRef.update(msgs => (msgs :+ message).takeRight(50)) *> hub.publish(message)

      def subscribe: Task[ZStream[Any, Nothing, Message]] =
        hub.subscribe.map(_.take(Int.MaxValue))

      def getHistory: Task[List[Message]] =
        historyRef.get
    }

    val layer: URLayer[Any, ChatRoom] =
      ZLayer.scoped {
        for {
          hub <- Hub.unbounded[Message]
          historyRef <- Ref.make(List.empty[Message])
        } yield Has(new Live(hub, historyRef))
      }
  }

  val routes: Routes[ChatRoom, Response] = Routes(
    // Serve the HTML page
    Method.GET / "" -> handler {
      Response(
        headers = Headers(
          Header.ContentType(MediaType.text.html),
        ),
        body = Body.fromCharSequence(indexPage.render),
      )
    },
    // POST endpoint to send new messages
    Method.POST / "send-message" -> handler { (req: Request) =>
      for {
        body <- req.body.asString
        // Parse form data: username=value&message=value
        params = body.split("&").map { param =>
          val parts = param.split("=")
          if (parts.length >= 2) {
            (parts(0), java.net.URLDecoder.decode(parts.drop(1).mkString("="), "UTF-8"))
          } else {
            (parts(0), "")
          }
        }.toMap
        username = params.get("username").filter(_.nonEmpty).getOrElse("Anonymous")
        messageText = params.get("message").filter(_.nonEmpty).getOrElse("")
        timestamp = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"))
        message = Message(username, messageText, timestamp)
        chatRoom <- ZIO.service[ChatRoom.Service]
        _ <- chatRoom.publish(message)
      } yield Response.ok
    },
    // SSE endpoint - send history first, then stream new messages
    Method.GET / "chat-stream" -> events {
      handler {
        for {
          chatRoom <- ZIO.service[ChatRoom.Service]
          // Send message history first
          history <- chatRoom.getHistory
          _ <- ZIO.foreachDiscard(history) { msg =>
            ServerSentEventGenerator.patchElements(
              div(
                id("message"),
                className := "message",
                span(
                  className := "username",
                  s"${msg.username} [${msg.timestamp}]:",
                ),
                span(
                  className := "text",
                  msg.text,
                ),
                PatchElementOptions(
                  selector = Some(CssSelector.id("messages")),
                  mode = ElementPatchMode.Append,
                ),
              ),
            )
          }
          // Then subscribe to new messages
          stream <- chatRoom.subscribe
          _ <- stream.foreach { msg =>
            ServerSentEventGenerator.patchElements(
              div(
                id("message"),
                className := "message",
                span(
                  className := "username",
                  s"${msg.username} [${msg.timestamp}]:",
                ),
                span(
                  className := "text",
                  msg.text,
                ),
                PatchElementOptions(
                  selector = Some(CssSelector.id("messages")),
                  mode = ElementPatchMode.Append,
                ),
              ),
            )
          }
        } yield ()
      }
    },
  )

  def indexPage = html(
    head(
      meta(charset("UTF-8")),
      meta(name("viewport"), content("width=device-width, initial-scale=1.0")),
      title("Real-Time Chat - ZIO HTTP Datastar"),
      datastarScript,
      style.inlineCss(css),
    ),
    body(
      div(
        className := "container",
        h1("Real-Time Chat"),
        div(
          className := "chat-box",
          id("messages"),
        ),
        form(
          id("chatForm"),
          className := "chat-form",
          dataOn.submit := js"@post('/send-message')",
          div(
            label(
              `for`("username"),
              "Username:",
            ),
            input(
              `type` := "text",
              id("username"),
              name := "username",
              placeholder := "Enter your username",
              required,
              maxlength := "20",
            ),
          ),
          div(
            label(
              `for`("message"),
              "Message:",
            ),
            textarea(
              id("message"),
              name := "message",
              placeholder := "Type your message here...",
              required,
              rows := 3,
            ),
          ),
          button(
            `type` := "submit",
            "Send Message",
          ),
        ),
        // Auto-init SSE stream on page load
        script(
          raw(
            """
            document.addEventListener('DOMContentLoaded', () => {
              fetch('/chat-stream')
                .then(response => Datastar.processResponse(response));
            });
            """,
          ),
        ),
      ),
    ),
  )

  val css = css"""
    * {
      box-sizing: border-box;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .container {
      background: white;
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      max-width: 600px;
      width: 100%;
      padding: 30px;
      display: flex;
      flex-direction: column;
      height: 90vh;
      max-height: 800px;
    }
    h1 {
      color: #333;
      margin: 0 0 20px 0;
      text-align: center;
      font-size: 2rem;
    }
    .chat-box {
      flex: 1;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      padding: 15px;
      overflow-y: auto;
      background: #f9f9f9;
      margin-bottom: 20px;
    }
    .message {
      padding: 10px;
      margin-bottom: 10px;
      background: white;
      border-left: 3px solid #667eea;
      border-radius: 4px;
      animation: slideIn 0.3s ease;
    }
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .username {
      font-weight: 600;
      color: #667eea;
      display: inline-block;
      margin-right: 10px;
      font-size: 0.9rem;
    }
    .text {
      color: #333;
      word-wrap: break-word;
    }
    .chat-form {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    .chat-form > div {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    label {
      color: #555;
      font-weight: 500;
      font-size: 0.95rem;
    }
    input[type="text"],
    textarea {
      padding: 10px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      transition: border-color 0.3s ease;
    }
    input[type="text"]:focus,
    textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    textarea {
      resize: vertical;
      min-height: 60px;
    }
    button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
    }
    button:active {
      transform: translateY(0);
    }
    """

  override def run: ZIO[Any, Throwable, Unit] =
    ZIO.logInfo("Starting chat server on http://localhost:8080") *>
      Server
        .serve(routes)
        .provide(ChatRoom.layer, Server.default)
}
