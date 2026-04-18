import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Supported language codes
const String kLangEn = 'en';
const String kLangHi = 'hi';
const String kLangMr = 'mr';

const String _prefKey = 'app_language';

class LanguageProvider extends ChangeNotifier {
  String _languageCode = kLangEn;

  String get languageCode => _languageCode;

  Locale get locale => Locale(_languageCode);

  /// Human-readable name for the current language
  String get languageName {
    switch (_languageCode) {
      case kLangHi:
        return 'हिंदी';
      case kLangMr:
        return 'मराठी';
      default:
        return 'English';
    }
  }

  LanguageProvider() {
    _loadFromPrefs();
  }

  /// Load previously saved language (called on app start)
  Future<void> _loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_prefKey);
    if (saved != null && [kLangEn, kLangHi, kLangMr].contains(saved)) {
      _languageCode = saved;
      notifyListeners();
    }
  }

  /// Set a new language and persist it
  Future<void> setLanguage(String code) async {
    if (_languageCode == code) return;
    _languageCode = code;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefKey, code);
  }

  /// True if this is the first time the user has ever set a language
  Future<bool> isFirstTimeSetting() async {
    final prefs = await SharedPreferences.getInstance();
    return !prefs.containsKey(_prefKey);
  }
}
