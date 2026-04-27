package chat

import zio._
import zio.http._
import zio.http.datastar._
import zio.http.endpoint.Endpoint
import zio.http.template2._
import zio.schema._

import java.time.format.DateTimeFormatter
import java.time.{Instant, ZoneId}

/**
 * Real-time multi-client chat application using ZIO HTTP and Datastar.
 *
 * Features:
 * - Multiple users can connect and chat simultaneously
 * - Messages broadcast to all connected users in real-time
 * - New users see message history on connection
 * - Form with username and message inputs
 * - Messages display with username and timestamp
 * - Uses ZIO Hub for broadcasting messages to all subscribers
 * - Two-phase SSE: send history first, then subscribe to Hub for new messages
 */
object ChatApp extends ZIOAppDefault {

  // ============================================================================
  // Domain Models
  // ============================================================================

  /**
   * Represents a single chat message with metadata.
   */
  case class ChatMessage(
    id: String,
    username: String,
    content: String,
    timestamp: Long,
  )

  object ChatMessage {
    /**
     * Factory constructor to generate message with UUID and current timestamp.
     */
    def apply(username: String, content: String): ChatMessage =
      ChatMessage(
        java.util.UUID.randomUUID().toString,
        username,
        content,
        System.currentTimeMillis(),
      )

    implicit val schema: Schema[ChatMessage] = DeriveSchema.gen[ChatMessage]
  }

  /**
   * Form data for posting a new message.
   */
  case class MessageRequest(username: String, message: String)

  object MessageRequest {
    implicit val schema: Schema[MessageRequest] = DeriveSchema.gen[MessageRequest]
  }

  // ============================================================================
  // ChatRoom Service Layer
  // ============================================================================

  /**
   * ChatRoom service handles message persistence and broadcasting.
   *
   * - `messages`: Ref storing message history (all messages ever sent)
   * - `subscribers`: Hub for broadcasting new messages to all connected SSE clients
   */
  case class ChatRoom(
    messages: Ref[List[ChatMessage]],
    subscribers: Hub[ChatMessage],
  )

  object ChatRoom {

    /**
     * Create a new ChatRoom with empty history and unbounded broadcast hub.
     */
    def make: ZIO[Any, Nothing, ChatRoom] =
      for {
        messages <- Ref.make(List.empty[ChatMessage])
        hub <- Hub.unbounded[ChatMessage]
      } yield ChatRoom(messages, hub)

    /**
     * Add a message to history and broadcast it to all subscribers.
     */
    def addMessage(message: ChatMessage): ZIO[ChatRoom, Nothing, Unit] =
      ZIO.serviceWithZIO[ChatRoom] { room =>
        for {
          _ <- room.messages.update(_ :+ message)
          _ <- room.subscribers.publish(message)
        } yield ()
      }

    /**
     * Retrieve all messages in history.
     */
    def getMessages: ZIO[ChatRoom, Nothing, List[ChatMessage]] =
      ZIO.serviceWithZIO[ChatRoom](_.messages.get)

    /**
     * Subscribe to new messages from the Hub.
     * Returns a stream of ChatMessages for each new message published.
     */
    def subscribe: ZIO[ChatRoom & Scope, Nothing, ZStream[Any, Nothing, ChatMessage]] =
      ZIO.serviceWithZIO[ChatRoom] { room =>
        room.subscribers.subscribe.map(ZStream.fromQueue(_))
      }

    /**
     * ZLayer providing ChatRoom as a service dependency.
     */
    val layer: ZLayer[Any, Nothing, ChatRoom] =
      ZLayer.fromZIO(make)
  }

  // ============================================================================
  // Signal Definitions
  // ============================================================================

  /**
   * Signal for the username input field.
   * Bound to the HTML input with dataBind.
   */
  private val $username = Signal[String]("username")

  /**
   * Signal for the message input field.
   * Bound to the HTML input with dataBind.
   */
  private val $message = Signal[String]("message")

  // ============================================================================
  // HTML Page and Templates
  // ============================================================================

  /**
   * Render a single chat message with timestamp and username.
   */
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

  /**
   * Main chat page HTML.
   *
   * - Initialize signals for username and message inputs
   * - Render form with username input and message input
   * - Message list container for real-time updates
   * - dataInit triggers SSE endpoint on page load
   */
  private val chatPage: Dom = html(
    head(
      meta(charset := "UTF-8"),
      meta(name := "viewport", content := "width=device-width, initial-scale=1.0"),
      title("Real-Time Multi-Client Chat - ZIO HTTP + Datastar"),
      datastarScript,
      style.inlineCSS(css),
    ),
    body(
      dataInit := Endpoint(Method.GET / "chat" / "messages")
        .out[String]
        .datastarRequest(()),
      div(`class` := "header")(
        h1("Real-Time Chat"),
        p("Multiple users chatting simultaneously with ZIO, ZIO HTTP & Datastar"),
      ),
      div(
        `class` := "container",
        dataSignals($username) := "",
        dataSignals($message) := "",
      )(
        div(`class` := "username-section")(
          label(`for` := "username-input")("Your Username"),
          input(
            `type` := "text",
            id := "username-input",
            placeholder := "Enter your username...",
            dataBind($username.name),
            required,
          ),
        ),
        div(`class` := "chat-container")(
          div(
            `class` := "messages",
            id := "message-list",
          )(
            // Messages will be appended here by SSE updates
          ),
          div(`class` := "input-area")(
            input(
              `type` := "text",
              id := "message-input",
              placeholder := "Type your message...",
              dataBind($message.name),
              required,
              dataOn.keydown := js"evt.code === 'Enter' && @post('/chat/send')",
            ),
            button(
              `type` := "button",
              dataAttr("disabled") := js"(${$username.ref} === '' || ${$message.ref} === '')",
              dataOn.click := js"@post('/chat/send')",
            )("Send"),
          ),
        ),
      ),
    ),
  )

  // ============================================================================
  // HTTP Routes
  // ============================================================================

  private val routes = Routes(
    /**
     * GET /chat - Serve the main chat page.
     */
    Method.GET / "chat" -> handler {
      Response.text(chatPage.render).addHeader("Content-Type", "text/html")
    },

    /**
     * GET /chat/messages - SSE endpoint for real-time message updates.
     *
     * Two-phase pattern:
     * 1. Send all existing messages from history
     * 2. Subscribe to Hub and stream new messages as they arrive
     *
     * This ensures new clients see the full conversation history
     * before receiving real-time updates.
     */
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

    /**
     * POST /chat/send - Receive a new message and broadcast it.
     *
     * Reads form signals (username and message) from the request,
     * creates a ChatMessage, adds it to the service (which broadcasts),
     * and returns 200 OK.
     */
    Method.POST / "chat" / "send" -> handler { (req: Request) =>
      for {
        rq <- req.readSignals[MessageRequest]
        msg = ChatMessage(username = rq.username, content = rq.message)
        _ <- ChatRoom.addMessage(msg)
      } yield Response.ok
    },
  ) @@ Middleware.debug

  // ============================================================================
  // Server Setup
  // ============================================================================

  override def run: ZIO[Any, Throwable, Unit] =
    Server
      .serve(routes)
      .provide(
        Server.default,
        ChatRoom.layer,  // Inject ChatRoom service
      )

  // ============================================================================
  // CSS Styling
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
      font-weight: 700;
    }
    .header p {
      font-size: 1.1rem;
      opacity: 0.9;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 700px;
    }
    .username-section {
      padding: 20px;
      border-bottom: 2px solid #e0e0e0;
    }
    .username-section label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: #333;
      font-size: 0.95rem;
    }
    .username-section input {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 16px;
      transition: border-color 0.3s;
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
      gap: 15px;
    }
    .messages {
      flex: 1;
      overflow-y: auto;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 15px;
      background: #fafafa;
    }
    #message-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .message {
      background: white;
      padding: 14px;
      border-left: 4px solid #667eea;
      border-radius: 4px;
      word-wrap: break-word;
      animation: slideIn 0.3s ease-out;
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
    .message-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 0.9rem;
    }
    .message-username {
      font-weight: 700;
      color: #667eea;
    }
    .message-time {
      color: #999;
      font-size: 0.85rem;
    }
    .message-content {
      color: #333;
      line-height: 1.5;
      word-break: break-word;
    }
    .input-area {
      display: flex;
      gap: 10px;
      align-items: stretch;
    }
    .input-area input {
      flex: 1;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 16px;
      transition: border-color 0.3s;
    }
    .input-area input:focus {
      outline: none;
      border-color: #667eea;
    }
    .input-area button {
      padding: 12px 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .input-area button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
    }
    .input-area button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .input-area button:active:not(:disabled) {
      transform: translateY(0);
    }
    """
}
