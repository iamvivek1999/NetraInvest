/// API Service — Enigma Invest
///
/// HTTP client for backend API communication.
/// Matches the Enigma backend's response envelope:
///   { success: true, message: "...", token: "<jwt>", data: { ... } }
///
/// Base URL: http://localhost:5000/api/v1
///
/// Key differences from old Enigma Invest:
///  - Base URL is /api/v1 (not /api)
///  - JWT token is at response['token'] (top-level, not response['data']['token'])
///  - User object is at response['data']['user']
///  - Roles: investor | startup (not borrower | lender)
///  - No wallet or KYC endpoints
///  - New: campaigns, payments (Razorpay), investments, milestones
library;

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // ─── Base URL ─────────────────────────────────────────────────────────────
  // Android Emulator : use 10.0.2.2 (routes to PC localhost)
  // Physical phone via WiFi  : use your PC's LAN IP (run `ipconfig`)
  // Physical phone via USB   : run `adb reverse tcp:5000 tcp:5000` then use localhost
  // ─────────────────────────────────────────────────────────────────────────
  // ► To switch, comment/uncomment the line that matches your setup.
  // static const String baseUrl = 'http://10.0.2.2:5000/api/v1';      // Android Emulator
  // static const String baseUrl = 'http://localhost:5000/api/v1';       // USB (needs: adb reverse tcp:5000 tcp:5000)
  static const String baseUrl =
      'http://10.195.203.32:5000/api/v1'; // ◄ ACTIVE — WiFi (LAN IP)

  // ============ Token Management ============

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('auth_token');
  }

  Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', token);
  }

  Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
  }

  // ============ HTTP Helpers ============

  Future<Map<String, dynamic>> get(String endpoint) async {
    try {
      final token = await getToken();
      final headers = {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };
      final response = await http
          .get(Uri.parse('$baseUrl$endpoint'), headers: headers)
          .timeout(const Duration(seconds: 30));
      return _handleResponse(response);
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  Future<Map<String, dynamic>> post(
      String endpoint, Map<String, dynamic> body) async {
    try {
      final token = await getToken();
      final headers = {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };
      final response = await http
          .post(
            Uri.parse('$baseUrl$endpoint'),
            headers: headers,
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 30));
      return _handleResponse(response);
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  Future<Map<String, dynamic>> patch(
      String endpoint, Map<String, dynamic> body) async {
    try {
      final token = await getToken();
      final headers = {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };
      final response = await http
          .patch(
            Uri.parse('$baseUrl$endpoint'),
            headers: headers,
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 30));
      return _handleResponse(response);
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  Map<String, dynamic> _handleResponse(http.Response response) {
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    } else {
      throw Exception(
          data['message'] ?? 'Request failed (${response.statusCode})');
    }
  }

  // ============ Auth Endpoints ============

  /// POST /auth/register
  /// Backend envelope: { success, message, token, data: { user } }
  Future<Map<String, dynamic>> register(Map<String, dynamic> userData) async {
    final response = await post('/auth/register', userData);
    // Token is top-level in Enigma's response
    if (response['success'] == true && response['token'] != null) {
      await saveToken(response['token'] as String);
    }
    return response;
  }

  /// POST /auth/login
  /// Backend envelope: { success, message, token, data: { user } }
  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await post('/auth/login', {
      'email': email,
      'password': password,
    });
    // Token is top-level in Enigma's response
    if (response['success'] == true && response['token'] != null) {
      await saveToken(response['token'] as String);
    }
    return response;
  }

  /// GET /auth/me — validate stored JWT and return current user
  Future<Map<String, dynamic>> getMe() async {
    return await get('/auth/me');
  }

  Future<void> logout() async {
    await clearToken();
  }

  // ============ Campaign Endpoints ============

  /// GET /campaigns — list all active campaigns (investor: discover, startup: see own)
  Future<Map<String, dynamic>> getCampaigns({String? status}) async {
    final query = status != null ? '?status=$status' : '';
    return await get('/campaigns$query');
  }

  /// GET /campaigns/:id — single campaign detail
  Future<Map<String, dynamic>> getCampaignDetail(String campaignId) async {
    return await get('/campaigns/$campaignId');
  }

  /// GET /campaigns/my — startup's own campaigns (protected, startup role)
  Future<Map<String, dynamic>> getMyStartupCampaigns() async {
    return await get('/campaigns/my');
  }

  // ============ Investment Endpoints ============

  /// GET /investments/my — investor's own investment history
  Future<Map<String, dynamic>> getMyInvestments() async {
    return await get('/investments/my');
  }

  /// GET /investments/campaign/:campaignId — investments in a campaign (startup)
  Future<Map<String, dynamic>> getCampaignInvestments(String campaignId) async {
    return await get('/investments/campaign/$campaignId');
  }

  // ============ Payment Endpoints (Razorpay) ============

  /// POST /payments/create-order — creates a Razorpay order for a campaign
  Future<Map<String, dynamic>> createPaymentOrder({
    required String campaignId,
    required double amount,
  }) async {
    return await post('/payments/create-order', {
      'campaignId': campaignId,
      'amount': amount,
    });
  }

  /// POST /payments/verify — verifies Razorpay signature and records investment
  Future<Map<String, dynamic>> verifyPayment({
    required String campaignId,
    required double amount,
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    return await post('/payments/verify', {
      'campaignId': campaignId,
      'amount': amount,
      'razorpay_order_id': razorpayOrderId,
      'razorpay_payment_id': razorpayPaymentId,
      'razorpay_signature': razorpaySignature,
    });
  }

  // ============ Startup Profile Endpoints ============

  /// GET /startups/me — logged-in startup's own profile
  /// Response: { data: { profile: {...} } }
  Future<Map<String, dynamic>> getMyStartupProfile() async {
    return await get('/startups/me');
  }

  /// GET /startups/:id — any startup's public profile
  /// Response: { data: { profile: {...} } }
  Future<Map<String, dynamic>> getStartupProfile(String startupId) async {
    return await get('/startups/$startupId');
  }

  /// POST /startups — create the logged-in startup's profile
  /// Response: { data: { profile: {...} } }
  Future<Map<String, dynamic>> createStartupProfile(
      Map<String, dynamic> data) async {
    return await post('/startups', data);
  }

  /// PATCH /startups/:id — update the startup profile
  /// Response: { data: { profile: {...} } }
  Future<Map<String, dynamic>> updateStartupProfile(
    String profileId,
    Map<String, dynamic> data,
  ) async {
    return await patch('/startups/$profileId', data);
  }

  // ============ Investor Profile Endpoints ============

  /// GET /investors/me — full investor profile + investment summary
  /// Response: { data: { profile: {...}, investmentSummary: {...} } }
  Future<Map<String, dynamic>> getMyInvestorProfile() async {
    return await get('/investors/me');
  }

  /// POST /investors — create investor profile
  /// Response: { data: { profile: {...} } }
  Future<Map<String, dynamic>> createInvestorProfile(
      Map<String, dynamic> data) async {
    return await post('/investors', data);
  }

  /// PATCH /investors/me — update investor profile
  /// Response: { data: { profile: {...} } }
  Future<Map<String, dynamic>> updateInvestorProfile(
      Map<String, dynamic> data) async {
    return await patch('/investors/me', data);
  }

  // ============ Campaign Create/Update ============

  /// POST /campaigns — create a new campaign (startup role only)
  /// Response: { data: { campaign: {...} } }
  Future<Map<String, dynamic>> createCampaign(Map<String, dynamic> data) async {
    return await post('/campaigns', data);
  }

  /// PATCH /campaigns/:id — update a campaign (startup role only)
  /// Response: { data: { campaign: {...} } }
  Future<Map<String, dynamic>> updateCampaign(
    String campaignId,
    Map<String, dynamic> data,
  ) async {
    return await patch('/campaigns/$campaignId', data);
  }

  // ============ Milestones ============

  /// GET /campaigns/:campaignId/milestones
  /// Response: { data: { milestones: [...] } }
  Future<Map<String, dynamic>> getCampaignMilestones(String campaignId) async {
    return await get('/campaigns/$campaignId/milestones');
  }

  /// POST /campaigns/:campaignId/milestones — batch create milestones (startup)
  Future<Map<String, dynamic>> createMilestones(
    String campaignId,
    List<Map<String, dynamic>> milestones,
  ) async {
    return await post(
        '/campaigns/$campaignId/milestones', {'milestones': milestones});
  }

  // ============ Startup Investment Dashboard ============

  /// GET /investments/startup — all investments across startup's campaigns
  /// Response: { data: { investments: [...], summary: {...} } }
  Future<Map<String, dynamic>> getStartupInvestments() async {
    return await get('/investments/startup');
  }
}
