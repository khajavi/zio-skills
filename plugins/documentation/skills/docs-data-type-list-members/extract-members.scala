#!/usr/bin/env scala
/**
 * Scala-aware parser to extract public methods from Scala source files.
 * Categorizes methods into: companion object, direct API, and inherited.
 *
 * Run `scala extract-members.scala --help` for usage and exit codes.
 */

import scala.io.Source
import scala.util.Using
import java.io.File

case class MethodDef(
  name: String,
  isPrivate: Boolean,
  depth: Int,
  lineNum: Int,
  inCompanion: Boolean = false
)

object MethodExtractor {
  def extractMethods(filePath: String, typeName: Option[String] = None): (List[String], List[String], List[String]) = {
    val file = new File(filePath)
    if (!file.exists()) {
      System.err.println(s"Error: File not found: $filePath")
      return (List(), List(), List())
    }

    Using.resource(Source.fromFile(file)) { source =>
      val lines = source.getLines().toList
      val companionMethods = scala.collection.mutable.ListBuffer[MethodDef]()
      val directMethods = scala.collection.mutable.ListBuffer[MethodDef]()

      var depth = 0
      var currentTypeDepth = -1
      var inTargetType = typeName.isEmpty
      var inCompanionObject = false
      var companionDepth = -1
      var targetTypeStart = -1
      var parentTypes = scala.collection.mutable.Set[String]()

      lines.zipWithIndex.foreach { case (line, idx) =>
        val trimmed = line.trim
        val lineNum = idx + 1

        // Track brace depth
        val openBraces = line.count(_ == '{')
        val closeBraces = line.count(_ == '}')

        // Check if we're entering companion object (when we have a type name)
        if (typeName.isDefined && !inCompanionObject && depth == 0) {
          if (trimmed.matches(s"object\\s+${typeName.get}\\s*[({].*")) {
            inCompanionObject = true
            companionDepth = depth
          }
        }

        // Check if we're leaving companion object
        if (inCompanionObject && depth <= companionDepth && closeBraces > 0 && depth == 0) {
          inCompanionObject = false
          companionDepth = -1
        }

        // Check if we're entering target type
        if (typeName.isDefined && !inTargetType && !inCompanionObject && depth == 0) {
          if (trimmed.matches(s"(abstract\\s+)?(class|trait)\\s+${typeName.get}\\s*[\\[({].*")) {
            inTargetType = true
            currentTypeDepth = depth
            targetTypeStart = depth + openBraces

            // Extract parent types from extends/with clauses
            val extendsPattern = s"(class|trait)\\s+${typeName.get}[^{]*(extends|with)\\s+([^{]+)".r
            extendsPattern.findFirstMatchIn(line).foreach { m =>
              val parentClause = m.group(3)
              // Parse parent types (e.g., "Trait1 with Trait2" or "Class with Trait")
              parentClause.split("with").foreach { parent =>
                val parentName = parent.trim.split("[\\(\\[\\s]").head
                if (parentName.nonEmpty && !parentName.contains("=>")) {
                  parentTypes += parentName
                }
              }
            }

            // Also check following lines for extends/with
            if (idx + 1 < lines.length && lines(idx + 1).trim.startsWith("extends")) {
              val extendsLine = lines(idx + 1)
              val parentClause = extendsLine.dropWhile(_ != ' ')
              parentClause.split("with").foreach { parent =>
                val parentName = parent.trim.split("[\\(\\[\\s]").head
                if (parentName.nonEmpty && !parentName.contains("=>")) {
                  parentTypes += parentName
                }
              }
            }
          }
        }

        // Check if we're leaving target type
        if (inTargetType && typeName.isDefined && depth <= currentTypeDepth && closeBraces > 0) {
          if (idx > targetTypeStart && depth < targetTypeStart) {
            inTargetType = false
          }
        }

        // Extract methods
        if (inCompanionObject || inTargetType) {
          val methodPattern = """^(.*?)(override\s+|final\s+|inline\s+|implicit\s+)*(def|given)\s+([a-zA-Z_][a-zA-Z0-9_]*|\+\+|-|::|!|&|\||\^|~|<<|>>|==|!=|<|>|<=|>=|\*|/|%|@|#|$)(\s*\[|:|\(|\s|=)""".r

          val isPrivate = trimmed.matches("^(private|protected)\\s+.*") || trimmed.matches("^.*private\\[.*\\]\\s+.*")

          methodPattern.findFirstMatchIn(line).foreach { m =>
            val methodName = m.group(4)
            if (!methodName.startsWith("loop") && !methodName.startsWith("mk") && !methodName.startsWith("_") &&
                methodName != "source" && methodName != "toInterpreter") {
              if (inCompanionObject) {
                companionMethods += MethodDef(methodName, isPrivate, depth, lineNum, inCompanion = true)
              } else {
                directMethods += MethodDef(methodName, isPrivate, depth, lineNum, inCompanion = false)
              }
            }
          }
        }

        // Update depth
        depth += openBraces - closeBraces
        depth = math.max(0, depth)
      }

      val companionList = companionMethods
        .filter(m => !m.isPrivate)
        .map(_.name)
        .distinct
        .sorted
        .toList

      val directList = directMethods
        .filter(m => !m.isPrivate)
        .map(_.name)
        .distinct
        .sorted
        .toList

      // For now, inherited methods would require reading parent files
      // This is a placeholder - actual implementation would need file lookup
      (companionList, directList, List())
    }
  }
}

def printUsage(toStderr: Boolean = false): Unit = {
  val out = if (toStderr) System.err else System.out
  out.println("""Usage: scala extract-members.scala [--json] <source-file> [<type-name>]
                |
                |Parses a Scala source file and prints public methods grouped into
                |sections: companion-object members, direct public API of the named
                |type, and inherited methods. If <type-name> is omitted, all top-level
                |public methods are printed.
                |
                |Arguments:
                |  <source-file>   Path to the .scala file to parse (required).
                |  <type-name>     Optional class/trait/object name to focus on.
                |                  When omitted, all public top-level methods are listed.
                |
                |Options:
                |  --json          Emit machine-readable JSON instead of the default
                |                  human-readable sectioned output. The schema is:
                |                    {
                |                      "sourceFile": "<path>",
                |                      "typeName":   "<name>" | null,
                |                      "companion":  ["foo", "bar", …],
                |                      "publicApi":  ["baz", …],
                |                      "inherited":  []
                |                    }
                |  -h, --help      Print this help message and exit.
                |
                |Default text output sections (each preceded by '===' header line):
                |  === Companion Object Members ===
                |  === Public API ===
                |  === Inherited Methods ===
                |
                |Exit codes:
                |  0  Success — at least one public member was extracted.
                |  1  No public members found in the file or named type.
                |  2  Invocation error (missing arguments, file not found).
                |
                |Examples:
                |  scala extract-members.scala src/main/scala/zio/Chunk.scala Chunk
                |  scala extract-members.scala Reader.scala Reader \
                |    | check-method-coverage.sh Reader docs/reference/reader.md
                |  scala extract-members.scala --json Reader.scala Reader | jq '.publicApi'""".stripMargin)
}

// Minimal JSON string-escape for member names (handles backslash, quote, control chars).
def jsonEscape(s: String): String = {
  val sb = new StringBuilder(s.length + 2)
  sb.append('"')
  s.foreach {
    case '"'  => sb.append("\\\"")
    case '\\' => sb.append("\\\\")
    case '\b' => sb.append("\\b")
    case '\f' => sb.append("\\f")
    case '\n' => sb.append("\\n")
    case '\r' => sb.append("\\r")
    case '\t' => sb.append("\\t")
    case c if c < 0x20 => sb.append(f"\\u${c.toInt}%04x")
    case c    => sb.append(c)
  }
  sb.append('"')
  sb.toString
}

def jsonArray(items: List[String]): String =
  items.map(jsonEscape).mkString("[", ",", "]")

def emitJson(
  sourceFile: String,
  typeName: Option[String],
  companion: List[String],
  publicApi: List[String],
  inherited: List[String],
): Unit = {
  val typeNameJson = typeName.fold("null")(jsonEscape)
  println(
    s"""{"sourceFile":${jsonEscape(sourceFile)},""" +
    s""""typeName":$typeNameJson,""" +
    s""""companion":${jsonArray(companion)},""" +
    s""""publicApi":${jsonArray(publicApi)},""" +
    s""""inherited":${jsonArray(inherited)}}"""
  )
}

@main def run(args: String*): Unit = {
  // Argument parsing — handle --help / -h first, then the optional --json flag.
  args.headOption match {
    case Some("-h") | Some("--help") =>
      printUsage()
      System.exit(0)
    case None =>
      printUsage(toStderr = true)
      System.exit(2)
    case _ =>
  }

  // Strip --json from anywhere in the argument list (positional args remain).
  val jsonOutput = args.contains("--json")
  val positional = args.filter(_ != "--json")

  if (positional.isEmpty) {
    System.err.println("Error: <source-file> is required")
    printUsage(toStderr = true)
    System.exit(2)
  }
  if (positional.length > 2) {
    System.err.println(s"Error: expected at most 2 positional arguments, got ${positional.length}")
    printUsage(toStderr = true)
    System.exit(2)
  }

  val sourceFile = positional(0)
  val typeName = if (positional.length > 1) Some(positional(1)) else None

  if (!new File(sourceFile).exists()) {
    System.err.println(s"Error: File not found: $sourceFile")
    System.exit(2)
  }

  val (companionMethods, directMethods, inheritedMethods) =
    MethodExtractor.extractMethods(sourceFile, typeName)

  if (jsonOutput) {
    emitJson(sourceFile, typeName, companionMethods, directMethods, inheritedMethods)
    val hasAny = companionMethods.nonEmpty || directMethods.nonEmpty || inheritedMethods.nonEmpty
    System.exit(if (hasAny) 0 else 1)
  } else {
    var hasOutput = false

    if (companionMethods.nonEmpty) {
      println("=== Companion Object Members ===")
      companionMethods.foreach(println)
      hasOutput = true
    }

    if (directMethods.nonEmpty) {
      if (hasOutput) println()
      println("=== Public API ===")
      directMethods.foreach(println)
      hasOutput = true
    }

    if (inheritedMethods.nonEmpty) {
      if (hasOutput) println()
      println("=== Inherited Methods ===")
      inheritedMethods.foreach(println)
      hasOutput = true
    }

    if (!hasOutput) {
      System.err.println(s"No public members found${typeName.map(t => s" for type $t").getOrElse("")} in $sourceFile")
      System.exit(1) // No members found.
    } else {
      System.exit(0) // Success.
    }
  }
}
