package example.datastar

import zio._
import zio.http._
import zio.http.datastar._
import zio.http.endpoint.Endpoint
import zio.http.template2._
import zio.schema._

import java.time.format.DateTimeFormatter
import java.time.{Instant, ZoneId}

/**
 * Multi-client real-time chat using ZIO Hub for broadcasting.
 *
 * Demonstrates:
 * - ZIO Hub for broadcasting messages to all subscribers
 * - Two-phase SSE: initial history + streaming new messages
 * - readSignals[T] for form submission
 * - Service injection with ChatRoom.layer
 */
object ChatServer extends ZIOAppDefault {

  // ============================================================================
  // Domain Models
  // ============================================================================

  case class ChatMessage(
    id: String,
    username: String,
    content: String,
    timestamp: Long,
  )

  object ChatMessage {
    def apply(username: String, content: String): ChatMessage =
      ChatMessage(java.util.UUID.randomUUID().toString, username, content, System.currentTimeMillis())

    implicit val schema: Schema[ChatMessage] = DeriveSchema.gen[ChatMessage]
  }

  case class MessageRequest(username: String, message: String)

  object MessageRequest {
    implicit val schema: Schema[MessageRequest] = DeriveSchema.gen[MessageRequest]
  }

  // ============================================================================
  // ChatRoom Service
  // ============================================================================

  case class ChatRoom(
    messages: Ref[List[ChatMessage]],
    subscribers: Hub[ChatMessage],
  )

  object ChatRoom {
    def make: ZIO[Any, Nothing, ChatRoom] =
      for {
        messages <- Ref.make(List.empty[ChatMessage])
        hub <- Hub.unbounded[ChatMessage]
      } yield ChatRoom(messages, hub)

    def addMessage(message: ChatMessage): ZIO[ChatRoom, Nothing, Unit] =
      ZIO.serviceWithZIO[ChatRoom] { room =>
        for {
          _ <- room.messages.update(_ :+ message)
          _ <- room.subscribers.publish(message)
        } yield ()
      }

    def getMessages: ZIO[ChatRoom, Nothing, List[ChatMessage]] =
      ZIO.serviceWithZIO[ChatRoom](_.messages.get)

    def subscribe: ZIO[ChatRoom & Scope, Nothing, ZStream[Any, Nothing, ChatMessage]] =
      ZIO.serviceWithZIO[ChatRoom] { room =>
        room.subscribers.subscribe.map(ZStream.fromQueue(_))
      }

    val layer: ZLayer[Any, Nothing, ChatRoom] =
      ZLayer.fromZIO(make)
  }

  // ============================================================================
  // HTTP Routes and HTML
  // ============================================================================

  private val $username = Signal[String]("username")
  private val $message = Signal[String]("message")

  private val chatPage: Dom = html(
    head(
      meta(charset := "UTF-8"),
      meta(name := "viewport", content := "width=device-width, initial-scale=1.0"),
      title("ZIO Chat - Real-time Multi-Client Chat"),
      datastarScript,
      style.inlineCSS(css),
    ),
    body(
      dataInit := Endpoint(Method.GET / "chat" / "messages").out[String].datastarRequest(()),
      div(`class` := "header")(
        h1("ZIO Chat"),
        p(
          "Real-time Multi-Client Chat with ZIO, ZIO HTTP & Datastar",
        ),
      ),
      div(
        `class` := "container",
        dataSignals($username) := "",
        dataSignals($message) := "",
      )(
        div(`class` := "username-section")(
          label(`for` := "username")("Your Username"),
          input(
            `type` := "text",
            id := "username",
            placeholder := "Enter your username...",
            dataBind($username.name),
          ),
        ),
        div(`class` := "chat-container")(
          div(
            `class` := "messages",
            id := "messages",
          )(
            div(id := "message-list"),
          ),
          div(`class` := "input-area")(
            input(
              `type` := "text",
              id := "message",
              placeholder := "Type your message...",
              dataBind($message.name),
              required,
              dataOn.keydown := js"evt.code === 'Enter' && @post('/chat/send')",
            ),
            button(
              `type` := "submit",
              dataAttr("disabled") := js"(${$username.ref} === '' || ${$message.ref} === '')",
              dataOn.click := js"@post('/chat/send')",
            )("Send"),
          ),
        ),
      ),
    ),
  )

  private def messageTemplate(msg: ChatMessage): Dom = {
    val time = Instant
      .ofEpochMilli(msg.timestamp)
      .atZone(ZoneId.systemDefault())
      .format(DateTimeFormatter.ofPattern("HH:mm:ss"))

    div(`class` := "message")(
      div(`class` := "message-header")(
        span(`class` := "message-username")(msg.username),
        span(`class` := "message-time")(time),
      ),
      div(`class` := "message-content")(msg.content),
    )
  }

  private val routes = Routes(
    Method.GET / "chat" -> handler {
      Response.text(chatPage.render).addHeader("Content-Type", "text/html")
    },
    // SSE endpoint - two-phase: send history, then stream new messages
    Method.GET / "chat" / "messages" -> events {
      handler {
        for {
          // Phase 1: Send all existing messages at once
          messages <- ChatRoom.getMessages
          _ <- ServerSentEventGenerator.patchElements(
                 messages.map(messageTemplate),
                 PatchElementOptions(
                   selector = Some(CssSelector.id("message-list")),
                   mode = ElementPatchMode.Inner,
                 ),
               )
          // Phase 2: Subscribe to Hub and stream new messages as they arrive
          stream <- ChatRoom.subscribe
          _ <- stream
                 .mapZIO { message =>
                   ServerSentEventGenerator.patchElements(
                     messageTemplate(message),
                     PatchElementOptions(
                       selector = Some(CssSelector.id("message-list")),
                       mode = ElementPatchMode.Append,
                     ),
                   )
                 }
                 .runDrain
        } yield ()
      }
    },
    // POST endpoint - receive message and broadcast
    Method.POST / "chat" / "send" -> handler { (req: Request) =>
      for {
        rq <- req.readSignals[MessageRequest]
        msg = ChatMessage(username = rq.username, content = rq.message)
        _ <- ChatRoom.addMessage(msg)
      } yield Response.ok
    },
  ) @@ Middleware.debug

  override def run: ZIO[Any, Throwable, Unit] =
    Server
      .serve(routes)
      .provide(
        Server.default,
        ChatRoom.layer,  // Inject ChatRoom service
      )

  // ============================================================================
  // CSS
  // ============================================================================

  private val css = css"""
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .header {
      text-align: center;
      color: white;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
    }
    .header p {
      font-size: 1.1rem;
      opacity: 0.9;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 600px;
    }
    .username-section {
      padding: 20px;
      border-bottom: 2px solid #e0e0e0;
    }
    .username-section label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #333;
    }
    .username-section input {
      width: 100%;
      padding: 10px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 16px;
    }
    .username-section input:focus {
      outline: none;
      border-color: #667eea;
    }
    .chat-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      padding: 20px;
    }
    .messages {
      flex: 1;
      overflow-y: auto;
      margin-bottom: 20px;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 10px;
      background: #fafafa;
    }
    #message-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .message {
      background: white;
      padding: 12px;
      border-left: 3px solid #667eea;
      border-radius: 4px;
      word-wrap: break-word;
    }
    .message-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 0.9rem;
    }
    .message-username {
      font-weight: 600;
      color: #667eea;
    }
    .message-time {
      color: #999;
      font-size: 0.85rem;
    }
    .message-content {
      color: #333;
      line-height: 1.4;
    }
    .input-area {
      display: flex;
      gap: 10px;
    }
    .input-area input {
      flex: 1;
      padding: 10px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 16px;
    }
    .input-area input:focus {
      outline: none;
      border-color: #667eea;
    }
    .input-area button {
      padding: 10px 25px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .input-area button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
    }
    .input-area button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    """
}
