package com.marketpane.app

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * The JS-facing half of the native HTTP bridge - see MarketPaneHttpServer.kt
 * for the NanoHTTPD side this wraps, and mobile/src/bridge/dispatchBridge.ts
 * for the JS side that listens for MarketPaneApiRequest and calls respond().
 */
class MarketPaneBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  private var server: MarketPaneHttpServer? = null

  override fun getName(): String = "MarketPaneBridge"

  @ReactMethod
  fun startServer(port: Double, promise: Promise) {
    if (server != null) {
      promise.resolve(null)
      return
    }
    try {
      val instance = MarketPaneHttpServer(port.toInt(), reactApplicationContext) { requestId, method, path, queryJson, body ->
        emitApiRequest(requestId, method, path, queryJson, body)
      }
      instance.start(30_000, false)
      server = instance
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("start_server_failed", e.message, e)
    }
  }

  @ReactMethod
  fun respond(requestId: String, status: Double, bodyJson: String) {
    server?.completeRequest(requestId, status.toInt(), bodyJson)
  }

  private fun emitApiRequest(requestId: String, method: String, path: String, queryJson: String, body: String) {
    val params = Arguments.createMap()
    params.putString("requestId", requestId)
    params.putString("method", method)
    params.putString("path", path)
    params.putString("query", queryJson)
    params.putString("body", body)
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("MarketPaneApiRequest", params)
  }
}
