package com.marketpane.app

import android.content.Context
import fi.iki.elonen.NanoHTTPD
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

/**
 * Serves the bundled web app (assets/web-dist, copied there at build time
 * from web/dist - see android/app/build.gradle's copyWebDist task) directly
 * from the APK's own AssetManager, and forwards every /api call (and /health)
 * request to the JS dispatch bridge (mobile/src/bridge/dispatchBridge.ts,
 * which calls server/src/mobileDispatch.ts's dispatch() - the exact same
 * business logic server/src/index.ts's Express routes call on desktop).
 *
 * web/src/lib/api.ts always does fetch('http://localhost:8787/api/...') on
 * every platform, completely unaware that Android has no real Express
 * server behind that URL - only this one.
 *
 * The JS round-trip happens on a background thread (NanoHTTPD gives each
 * request its own worker thread), never the UI thread, so blocking here
 * with a CountDownLatch while the JS side computes a response is safe -
 * this is the standard, well-established pattern for a synchronous-feeling
 * native<->JS round trip in a classic (non-Fabric) React Native module.
 */
class MarketPaneHttpServer(
  port: Int,
  private val context: Context,
  private val onApiRequest: (requestId: String, method: String, path: String, queryJson: String, body: String) -> Unit
) : NanoHTTPD(port) {

  private data class PendingResponse(val latch: CountDownLatch = CountDownLatch(1), var status: Int = 500, var body: String = "")

  private val pending = ConcurrentHashMap<String, PendingResponse>()
  private val nextRequestId = AtomicLong(0)

  // Generous but finite - a hung JS bridge (e.g. before RootComponent has
  // mounted and registered its listener) must eventually surface as a real
  // error response instead of leaving the WebView's fetch() spinning forever.
  private val requestTimeoutSeconds = 20L

  fun completeRequest(requestId: String, status: Int, body: String) {
    val entry = pending[requestId] ?: return
    entry.status = status
    entry.body = body
    entry.latch.countDown()
  }

  override fun serve(session: IHTTPSession): Response {
    val uri = session.uri
    return if (uri == "/health" || uri.startsWith("/api/")) {
      serveApi(session)
    } else {
      serveStaticAsset(uri)
    }
  }

  private fun serveApi(session: IHTTPSession): Response {
    val requestId = "req-${nextRequestId.incrementAndGet()}"
    val entry = PendingResponse()
    pending[requestId] = entry

    val queryParams = session.parameters // Map<String, MutableList<String>>, already query-string-decoded
    val queryJson = buildString {
      append("{")
      queryParams.entries.forEachIndexed { index, (key, values) ->
        if (index > 0) append(",")
        append(jsonString(key)).append(":").append(jsonString(values.firstOrNull() ?: ""))
      }
      append("}")
    }

    val body = try {
      if (session.method == Method.POST || session.method == Method.PUT) {
        val files = HashMap<String, String>()
        session.parseBody(files)
        // NanoHTTPD's documented convention for a non-multipart POST body:
        // the whole raw payload lands in files["postData"].
        files["postData"] ?: ""
      } else {
        ""
      }
    } catch (e: IOException) {
      pending.remove(requestId)
      return newFixedLengthResponse(Response.Status.BAD_REQUEST, "application/json", "{\"error\":\"Could not read request body.\"}")
    }

    onApiRequest(requestId, session.method.name, session.uri, queryJson, body)

    val completed = entry.latch.await(requestTimeoutSeconds, TimeUnit.SECONDS)
    pending.remove(requestId)
    if (!completed) {
      return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "application/json", "{\"error\":\"The app's JavaScript bridge did not respond in time.\"}")
    }

    val status = Response.Status.lookup(entry.status) ?: Response.Status.INTERNAL_ERROR
    return newFixedLengthResponse(status, "application/json", entry.body)
  }

  private fun serveStaticAsset(uri: String): Response {
    val requestedPath = uri.removePrefix("/").ifEmpty { "index.html" }
    val assetPath = "web-dist/$requestedPath"

    val resolvedPath = if (looksLikeStaticFile(requestedPath) && assetExists(assetPath)) assetPath else "web-dist/index.html"

    return try {
      val stream = context.assets.open(resolvedPath)
      newChunkedResponse(Response.Status.OK, mimeTypeFor(resolvedPath), stream)
    } catch (e: IOException) {
      newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", "{\"error\":\"Not found.\"}")
    }
  }

  private fun assetExists(assetPath: String): Boolean = try {
    context.assets.open(assetPath).close()
    true
  } catch (e: IOException) {
    false
  }

  // A requested path with a file extension (assets/*.js, fonts, etc.) is a
  // real static file lookup; anything else (a client-side route like
  // /simulator) falls through to index.html - the same SPA-fallback shape
  // as server/src/index.ts's Express static-serving block.
  private fun looksLikeStaticFile(path: String): Boolean = path.substringAfterLast('/').contains('.')

  private fun mimeTypeFor(path: String): String = when (path.substringAfterLast('.')) {
    "html" -> "text/html"
    "js", "mjs" -> "application/javascript"
    "css" -> "text/css"
    "json" -> "application/json"
    "svg" -> "image/svg+xml"
    "png" -> "image/png"
    "woff" -> "font/woff"
    "woff2" -> "font/woff2"
    "ico" -> "image/x-icon"
    else -> "application/octet-stream"
  }

  private fun jsonString(value: String): String {
    val escaped = value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r")
    return "\"$escaped\""
  }
}
