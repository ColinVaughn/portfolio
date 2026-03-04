package org.tunnely.client

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import com.android.billingclient.api.*
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

/**
 * Tauri plugin for Google Play Billing.
 *
 * Wraps the Google Play Billing Library v6+ to provide
 * product querying, purchase flow, and restore functionality.
 */
@TauriPlugin
class IapPlugin(private val activity: Activity) : Plugin(activity) {

    private var billingClient: BillingClient? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // Cache pending invokes for purchase flow (since the purchase result
    // comes back asynchronously via PurchasesUpdatedListener)
    private val pendingPurchaseInvokes = ConcurrentHashMap<String, Invoke>()

    // Product details cache
    private val productDetailsCache = ConcurrentHashMap<String, ProductDetails>()

    override fun load(webView: app.tauri.plugin.WebView) {
        super.load(webView)
        initBillingClient()
    }

    private fun initBillingClient() {
        billingClient = BillingClient.newBuilder(activity)
            .setListener { result, purchases ->
                handlePurchaseResult(result, purchases)
            }
            .enablePendingPurchases()
            .build()
    }

    private fun ensureConnected(onReady: () -> Unit, onError: (String) -> Unit) {
        val client = billingClient ?: run {
            onError("Billing client not initialized")
            return
        }

        if (client.isReady) {
            onReady()
            return
        }

        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    onReady()
                } else {
                    onError("Billing setup failed: ${result.debugMessage}")
                }
            }

            override fun onBillingServiceDisconnected() {
                // Will reconnect on next operation
            }
        })
    }

    /**
     * Query available subscription products from Google Play.
     *
     * Input: { "product_ids": ["tunnely_pro_monthly", "tunnely_pro_yearly"] }
     * Output: [{ "id": "...", "title": "...", "price": "...", "currency": "..." }]
     */
    @Command
    fun queryProducts(invoke: Invoke) {
        val args = invoke.parseArgs(JSONObject::class.java)
        val productIds = args.getJSONArray("product_ids")
        val ids = mutableListOf<String>()
        for (i in 0 until productIds.length()) {
            ids.add(productIds.getString(i))
        }

        ensureConnected(
            onReady = {
                val params = QueryProductDetailsParams.newBuilder()
                    .setProductList(
                        ids.map { id ->
                            QueryProductDetailsParams.Product.newBuilder()
                                .setProductId(id)
                                .setProductType(BillingClient.ProductType.SUBS)
                                .build()
                        }
                    )
                    .build()

                billingClient?.queryProductDetailsAsync(params) { result, details ->
                    if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                        val products = JSONArray()
                        details.forEach { detail ->
                            productDetailsCache[detail.productId] = detail

                            val subscriptionOffers = detail.subscriptionOfferDetails
                            if (subscriptionOffers != null && subscriptionOffers.isNotEmpty()) {
                                val offer = subscriptionOffers[0]
                                val pricingPhase = offer.pricingPhases.pricingPhaseList[0]

                                products.put(JSONObject().apply {
                                    put("id", detail.productId)
                                    put("title", detail.title)
                                    put("description", detail.description)
                                    put("price", pricingPhase.formattedPrice)
                                    put("price_micros", pricingPhase.priceAmountMicros)
                                    put("currency", pricingPhase.priceCurrencyCode)
                                    put("billing_period", pricingPhase.billingPeriod)
                                    put("offer_token", offer.offerToken)
                                })
                            }
                        }
                        invoke.resolve(products)
                    } else {
                        invoke.reject("Failed to query products: ${result.debugMessage}")
                    }
                }
            },
            onError = { invoke.reject(it) }
        )
    }

    /**
     * Launch the Google Play purchase flow for a subscription.
     *
     * Input: { "product_id": "tunnely_pro_monthly", "offer_token": "..." }
     * Output: { "purchase_token": "...", "product_id": "...", "order_id": "..." }
     */
    @Command
    fun purchase(invoke: Invoke) {
        val args = invoke.parseArgs(JSONObject::class.java)
        val productId = args.getString("product_id")
        val offerToken = args.optString("offer_token", "")

        val productDetails = productDetailsCache[productId]
        if (productDetails == null) {
            invoke.reject("Product not found. Call queryProducts first.")
            return
        }

        ensureConnected(
            onReady = {
                // Store the invoke to resolve when purchase completes
                pendingPurchaseInvokes[productId] = invoke

                val offerDetails = if (offerToken.isNotEmpty()) {
                    productDetails.subscriptionOfferDetails?.find {
                        it.offerToken == offerToken
                    }
                } else {
                    productDetails.subscriptionOfferDetails?.firstOrNull()
                }

                if (offerDetails == null) {
                    pendingPurchaseInvokes.remove(productId)
                    invoke.reject("No subscription offer available")
                    return@ensureConnected
                }

                val purchaseParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(
                        listOf(
                            BillingFlowParams.ProductDetailsParams.newBuilder()
                                .setProductDetails(productDetails)
                                .setOfferToken(offerDetails.offerToken)
                                .build()
                        )
                    )
                    .build()

                val result = billingClient?.launchBillingFlow(activity, purchaseParams)
                if (result?.responseCode != BillingClient.BillingResponseCode.OK) {
                    pendingPurchaseInvokes.remove(productId)
                    invoke.reject("Failed to launch purchase flow: ${result?.debugMessage}")
                }
                // Purchase result handled in PurchasesUpdatedListener
            },
            onError = { invoke.reject(it) }
        )
    }

    /**
     * Handle purchase results from the PurchasesUpdatedListener callback.
     */
    private fun handlePurchaseResult(result: BillingResult, purchases: List<Purchase>?) {
        if (result.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (purchase in purchases) {
                if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                    // Acknowledge the purchase (required within 3 days)
                    if (!purchase.isAcknowledged) {
                        val ackParams = AcknowledgePurchaseParams.newBuilder()
                            .setPurchaseToken(purchase.purchaseToken)
                            .build()

                        billingClient?.acknowledgePurchase(ackParams) { ackResult ->
                            if (ackResult.responseCode != BillingClient.BillingResponseCode.OK) {
                                android.util.Log.w("IapPlugin", "Failed to acknowledge: ${ackResult.debugMessage}")
                            }
                        }
                    }

                    // Resolve the pending invoke
                    for (productId in purchase.products) {
                        val invoke = pendingPurchaseInvokes.remove(productId)
                        invoke?.resolve(JSONObject().apply {
                            put("purchase_token", purchase.purchaseToken)
                            put("product_id", productId)
                            put("order_id", purchase.orderId ?: "")
                        })
                    }
                }
            }
        } else if (result.responseCode == BillingClient.BillingResponseCode.USER_CANCELED) {
            // Reject all pending invokes
            pendingPurchaseInvokes.forEach { (_, invoke) ->
                invoke.reject("Purchase canceled by user")
            }
            pendingPurchaseInvokes.clear()
        } else {
            pendingPurchaseInvokes.forEach { (_, invoke) ->
                invoke.reject("Purchase failed: ${result.debugMessage}")
            }
            pendingPurchaseInvokes.clear()
        }
    }

    /**
     * Restore previous purchases (e.g., after app reinstall).
     *
     * Output: [{ "purchase_token": "...", "product_id": "..." }]
     */
    @Command
    fun restorePurchases(invoke: Invoke) {
        ensureConnected(
            onReady = {
                val params = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()

                billingClient?.queryPurchasesAsync(params) { result, purchases ->
                    if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                        val restored = JSONArray()
                        purchases.forEach { purchase ->
                            if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                                purchase.products.forEach { productId ->
                                    restored.put(JSONObject().apply {
                                        put("purchase_token", purchase.purchaseToken)
                                        put("product_id", productId)
                                        put("order_id", purchase.orderId ?: "")
                                    })
                                }
                            }
                        }
                        invoke.resolve(restored)
                    } else {
                        invoke.reject("Failed to restore purchases: ${result.debugMessage}")
                    }
                }
            },
            onError = { invoke.reject(it) }
        )
    }

    override fun onDestroy() {
        billingClient?.endConnection()
        scope.cancel()
        super.onDestroy()
    }
}
