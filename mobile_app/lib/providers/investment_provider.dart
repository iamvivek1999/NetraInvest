/// Investment Provider — Enigma Invest
///
/// Manages an investor's investment history and the Razorpay payment flow.
///
/// Payment flow (DEV_BYPASS_PAYMENT=true):
///   1. POST /payments/create-order → get fake orderId
///   2. Skip Razorpay checkout UI (no SDK in Flutter yet)
///   3. POST /payments/verify with dev placeholders → investment recorded
///
/// Backend response envelope: { success, message, data: { investment, blockchain } }
library;

import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class InvestmentProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();

  List<dynamic> _myInvestments = [];
  bool _isLoading = false;
  String? _error;
  String? _lastTxHash;

  // Getters
  List<dynamic> get myInvestments => _myInvestments;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get lastTxHash => _lastTxHash;

  /// Fetch all investments made by the logged-in investor
  Future<void> fetchMyInvestments() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.getMyInvestments();
      if (response['success'] == true) {
        // Backend sends: { data: { investments: [...], summary: {...} } }
        final data = response['data'] as Map<String, dynamic>? ?? {};
        _myInvestments = data['investments'] as List<dynamic>? ?? [];
      } else {
        _error = response['message'] as String? ?? 'Failed to fetch investments';
      }
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Complete the full Razorpay investment flow:
  ///   Step 1: Create order
  ///   Step 2: (In production, open Razorpay checkout UI — requires flutter_razorpay package)
  ///           In dev mode (DEV_BYPASS_PAYMENT=true), we pass placeholder IDs
  ///   Step 3: Verify payment and record investment
  ///
  /// Returns true on success. Check [error] on failure.
  Future<bool> invest({
    required String campaignId,
    required double amount,
  }) async {
    _isLoading = true;
    _error = null;
    _lastTxHash = null;
    notifyListeners();

    try {
      // Step 1: Create Razorpay order
      final orderRes = await _apiService.createPaymentOrder(
        campaignId: campaignId,
        amount: amount,
      );

      if (orderRes['success'] != true) {
        _error = orderRes['message'] as String? ?? 'Failed to create payment order';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      final orderId = orderRes['data']?['orderId'] as String? ?? '';
      final isDevMode = orderRes['data']?['_devMode'] == true;

      // Step 2: Payment gateway
      // In production: open Razorpay checkout, get back paymentId + signature
      // In dev mode (DEV_BYPASS_PAYMENT=true): use placeholder values
      String paymentId;
      String signature;

      if (isDevMode) {
        // Dev bypass — backend accepts any values when DEV_BYPASS_PAYMENT=true
        paymentId = 'dev_pay_${DateTime.now().millisecondsSinceEpoch}';
        signature = 'dev_signature_bypass';
      } else {
        // TODO: Integrate flutter_razorpay package for production
        // For now, mark as unsupported in non-dev mode
        _error = 'Razorpay SDK integration required for production. '
            'Set DEV_BYPASS_PAYMENT=true on backend for testing.';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      // Step 3: Verify payment — backend creates Investment document
      final verifyRes = await _apiService.verifyPayment(
        campaignId: campaignId,
        amount: amount,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
      );

      if (verifyRes['success'] == true) {
        // Capture blockchain tx hash if available
        final blockchain = verifyRes['data']?['blockchain'];
        if (blockchain != null) {
          _lastTxHash = blockchain['txHash'] as String?;
        }
        // Refresh investment list
        await fetchMyInvestments();
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _error = verifyRes['message'] as String? ?? 'Payment verification failed';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
