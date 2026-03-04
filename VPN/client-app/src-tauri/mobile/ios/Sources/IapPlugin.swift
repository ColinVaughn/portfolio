import Foundation
import StoreKit
import Tauri
import WebKit

/// Tauri iOS IAP plugin wrapping StoreKit 2.
///
/// Provides product querying, purchase flow, and restore functionality
/// for App Store subscriptions.
@objc class IapPlugin: Plugin {

    /// Query available subscription products from the App Store.
    ///
    /// Input: { "product_ids": ["com.tunnely.pro.monthly", "com.tunnely.pro.yearly"] }
    /// Output: [{ "id": "...", "title": "...", "price": "...", "currency": "..." }]
    @objc func queryProducts(_ invoke: Invoke) {
        guard let args = invoke.args,
              let productIds = args["product_ids"] as? [String] else {
            invoke.reject("Missing product_ids argument")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: Set(productIds))
                var result: [[String: Any]] = []

                for product in products {
                    var item: [String: Any] = [
                        "id": product.id,
                        "title": product.displayName,
                        "description": product.description,
                        "price": product.displayPrice,
                        "price_decimal": NSDecimalNumber(decimal: product.price).doubleValue,
                        "currency": product.priceFormatStyle.currencyCode ?? "USD",
                    ]

                    if let subscription = product.subscription {
                        let period = subscription.subscriptionPeriod
                        let periodStr: String
                        switch period.unit {
                        case .month:
                            periodStr = period.value == 1 ? "P1M" : "P\(period.value)M"
                        case .year:
                            periodStr = period.value == 1 ? "P1Y" : "P\(period.value)Y"
                        case .week:
                            periodStr = "P\(period.value)W"
                        case .day:
                            periodStr = "P\(period.value)D"
                        @unknown default:
                            periodStr = "P1M"
                        }
                        item["billing_period"] = periodStr
                    }

                    result.append(item)
                }

                invoke.resolve(result)
            } catch {
                invoke.reject("Failed to query products: \(error.localizedDescription)")
            }
        }
    }

    /// Purchase a subscription product.
    ///
    /// Input: { "product_id": "com.tunnely.pro.monthly" }
    /// Output: { "transaction_id": "...", "product_id": "...", "signed_transaction": "..." }
    @objc func purchase(_ invoke: Invoke) {
        guard let args = invoke.args,
              let productId = args["product_id"] as? String else {
            invoke.reject("Missing product_id argument")
            return
        }

        Task {
            do {
                // Look up the product
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    invoke.reject("Product not found: \(productId)")
                    return
                }

                // Start the purchase
                let result = try await product.purchase()

                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        // Finish the transaction
                        await transaction.finish()

                        // Return the signed JWS transaction for server-side validation
                        let jwsRepresentation = verification.jwsRepresentation

                        invoke.resolve([
                            "transaction_id": String(transaction.id),
                            "product_id": transaction.productID,
                            "signed_transaction": jwsRepresentation,
                            "purchase_date": ISO8601DateFormatter().string(from: transaction.purchaseDate),
                            "expiry_date": transaction.expirationDate.map {
                                ISO8601DateFormatter().string(from: $0)
                            } ?? "",
                        ] as [String: Any])

                    case .unverified(_, let error):
                        invoke.reject("Transaction verification failed: \(error.localizedDescription)")
                    }

                case .userCancelled:
                    invoke.reject("Purchase cancelled by user")

                case .pending:
                    invoke.reject("Purchase is pending approval (Ask to Buy)")

                @unknown default:
                    invoke.reject("Unknown purchase result")
                }
            } catch {
                invoke.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    /// Restore previous purchases.
    ///
    /// Returns all active subscription transactions for server-side revalidation.
    /// Output: [{ "transaction_id": "...", "product_id": "...", "signed_transaction": "..." }]
    @objc func restorePurchases(_ invoke: Invoke) {
        Task {
            var restored: [[String: Any]] = []

            // Iterate through all current entitlements
            for await result in Transaction.currentEntitlements {
                switch result {
                case .verified(let transaction):
                    if transaction.productType == .autoRenewable {
                        restored.append([
                            "transaction_id": String(transaction.id),
                            "product_id": transaction.productID,
                            "signed_transaction": result.jwsRepresentation,
                            "purchase_date": ISO8601DateFormatter().string(from: transaction.purchaseDate),
                            "expiry_date": transaction.expirationDate.map {
                                ISO8601DateFormatter().string(from: $0)
                            } ?? "",
                        ] as [String: Any])
                    }
                case .unverified(_, _):
                    continue
                }
            }

            invoke.resolve(restored)
        }
    }
}
