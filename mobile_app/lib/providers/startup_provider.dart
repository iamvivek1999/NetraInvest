import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

/// Startup Provider — Enigma Invest
/// 
/// Manages the state for the currently logged-in startup user,
/// including their profile and campaign details.
class StartupProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();

  Map<String, dynamic>? _profile;
  Map<String, dynamic>? _activeCampaign;
  List<dynamic> _milestones = [];
  
  bool _isLoading = false;
  String? _error;

  // Getters
  Map<String, dynamic>? get profile => _profile;
  Map<String, dynamic>? get activeCampaign => _activeCampaign;
  List<dynamic> get milestones => _milestones;
  bool get isLoading => _isLoading;
  String? get error => _error;

  /// Fetch profile and campaign data for the current user
  Future<void> fetchStartupData() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // 1. Fetch Profile
      final profileRes = await _apiService.getMyStartupProfile();
      if (profileRes['success'] == true) {
        _profile = profileRes['data']['profile'];
      }

      // 2. Fetch Campaigns
      final campaignRes = await _apiService.getMyStartupCampaigns();
      if (campaignRes['success'] == true) {
        final List<dynamic> campaigns = campaignRes['data']['campaigns'] ?? [];
        if (campaigns.isNotEmpty) {
          // For now, take the first (likely only) active/draft campaign
          _activeCampaign = campaigns.first;
          
          // 3. Fetch Milestones if there is a campaign
          final campaignId = _activeCampaign!['_id'] ?? _activeCampaign!['id'];
          final milestoneRes = await _apiService.getCampaignMilestones(campaignId);
          if (milestoneRes['success'] == true) {
            _milestones = milestoneRes['data']['milestones'] ?? [];
          }
        }
      }
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearData() {
    _profile = null;
    _activeCampaign = null;
    _milestones = [];
    _error = null;
    notifyListeners();
  }
}
