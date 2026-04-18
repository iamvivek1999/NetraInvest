/// Auth Provider — Enigma Invest
///
/// Manages authentication state for investor and startup roles.
///
/// Enigma backend response envelope:
///   POST /auth/login → { success, message, token, data: { user } }
///   GET  /auth/me    → { success, message, data: { user } }
///
/// Roles: 'investor' | 'startup' | 'admin'
library;

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();

  bool _isAuthenticated = false;
  String? _userRole;
  Map<String, dynamic>? _userData;
  bool _isLoading = false;
  String? _error;

  // Getters
  bool get isAuthenticated => _isAuthenticated;
  String? get userRole => _userRole;
  Map<String, dynamic>? get userData => _userData;
  Map<String, dynamic>? get user => _userData; // alias
  bool get isLoading => _isLoading;
  String? get error => _error;

  AuthProvider() {
    _restoreSession();
  }

  /// Restore session from SharedPreferences on app start
  Future<void> _restoreSession() async {
    final token = await _apiService.getToken();
    if (token == null) return;

    final prefs = await SharedPreferences.getInstance();
    final role = prefs.getString('user_role');
    final userDataJson = prefs.getString('user_data_json');

    if (role != null && userDataJson != null) {
      if (role == 'admin') {
        await _apiService.logout();
        await prefs.remove('user_role');
        await prefs.remove('user_data_json');
        return;
      }

      _isAuthenticated = true;
      _userRole = role;
      _userData = jsonDecode(userDataJson) as Map<String, dynamic>;
      notifyListeners();
    }
  }

  /// Login with email + password
  /// Backend returns: { success, message, token (top-level), data: { user } }
  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.login(email, password);

      if (response['success'] == true) {
        // Token is saved by ApiService.login automatically
        // User is nested inside data.user
        final user = response['data']?['user'] as Map<String, dynamic>?;
        if (user == null) {
          _error = 'Invalid response from server.';
          _isLoading = false;
          notifyListeners();
          return false;
        }

        _isAuthenticated = true;
        _userRole = user['role'] as String?;

        if (_userRole == 'admin') {
          _isAuthenticated = false;
          _userRole = null;
          _error = 'Admin access is restricted to the web platform.';
          _isLoading = false;
          await _apiService.logout();
          notifyListeners();
          return false;
        }

        _userData = user;

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user_role', _userRole ?? '');
        await prefs.setString('user_data_json', jsonEncode(user));

        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _error = response['message'] as String? ?? 'Login failed';
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

  /// Register a new account
  /// Backend returns same envelope as login
  Future<bool> register(Map<String, dynamic> userData) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.register(userData);

      if (response['success'] == true) {
        final user = response['data']?['user'] as Map<String, dynamic>?;
        if (user == null) {
          _error = 'Invalid response from server.';
          _isLoading = false;
          notifyListeners();
          return false;
        }

        _isAuthenticated = true;
        _userRole = user['role'] as String?;

        if (_userRole == 'admin') {
          _isAuthenticated = false;
          _userRole = null;
          _error = 'Admin access is restricted to the web platform.';
          _isLoading = false;
          await _apiService.logout();
          notifyListeners();
          return false;
        }

        _userData = user;

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user_role', _userRole ?? '');
        await prefs.setString('user_data_json', jsonEncode(user));

        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _error = response['message'] as String? ?? 'Registration failed';
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

  /// Logout — clear token and local state
  Future<void> logout() async {
    await _apiService.logout();

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('user_role');
    await prefs.remove('user_data_json');

    _isAuthenticated = false;
    _userRole = null;
    _userData = null;
    notifyListeners();
  }

  /// Refresh user data from server (e.g. after profile update)
  Future<void> refreshUser() async {
    try {
      final response = await _apiService.getMe();
      if (response['success'] == true) {
        final user = response['data']?['user'] as Map<String, dynamic>?;
        if (user != null) {
          _userData = user;
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('user_data_json', jsonEncode(user));
          notifyListeners();
        }
      }
    } catch (_) {
      // Non-critical: silently ignore refresh failures
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
