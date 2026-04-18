/// Campaign Provider — Enigma Invest
///
/// Manages campaign state: fetching active campaigns for investors
/// and a startup's own campaigns with milestone status.
///
/// Backend response envelope for list: { success, message, data: { campaigns: [...] } }
/// Backend response envelope for single: { success, message, data: { campaign: {...} } }
library;

import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class CampaignProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();

  List<dynamic> _campaigns = [];
  List<dynamic> _myCampaigns = []; // startup-specific: their own campaigns
  Map<String, dynamic>? _selectedCampaign;
  bool _isLoading = false;
  String? _error;

  // Getters
  List<dynamic> get campaigns => _campaigns;
  List<dynamic> get myCampaigns => _myCampaigns;
  Map<String, dynamic>? get selectedCampaign => _selectedCampaign;
  bool get isLoading => _isLoading;
  String? get error => _error;

  /// Fetch all active campaigns (for investor Discover tab)
  Future<void> fetchActiveCampaigns() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.getCampaigns(status: 'active');
      if (response['success'] == true) {
        // Backend sends: { data: { campaigns: [...] } }
        final data = response['data'] as Map<String, dynamic>? ?? {};
        _campaigns = data['campaigns'] as List<dynamic>? ?? [];
      } else {
        _error = response['message'] as String? ?? 'Failed to fetch campaigns';
      }
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Fetch the startup's own campaigns via GET /campaigns/my (startup role only)
  Future<void> fetchMyCampaigns() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.getMyStartupCampaigns();
      if (response['success'] == true) {
        // Backend sends: { data: { campaigns: [...] } }
        final data = response['data'] as Map<String, dynamic>? ?? {};
        _myCampaigns = data['campaigns'] as List<dynamic>? ?? [];
      } else {
        _error = response['message'] as String? ?? 'Failed to fetch your campaigns';
      }
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Fetch a single campaign's detailed view (milestones, stats, etc.)
  Future<void> fetchCampaignDetail(String campaignId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiService.getCampaignDetail(campaignId);
      if (response['success'] == true) {
        // Backend sends: { data: { campaign: {...} } }
        final data = response['data'] as Map<String, dynamic>? ?? {};
        _selectedCampaign = data['campaign'] as Map<String, dynamic>?;
      } else {
        _error = response['message'] as String? ?? 'Failed to fetch campaign details';
      }
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }

    _isLoading = false;
    notifyListeners();
  }

  void clearSelectedCampaign() {
    _selectedCampaign = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
