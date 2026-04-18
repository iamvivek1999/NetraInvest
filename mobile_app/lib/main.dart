/// Main Entry Point — Enigma Invest
///
/// Enigma Invest is a MERN + Razorpay + blockchain-transparency startup
/// investment platform.
///
/// Sets up:
/// - Material App with dark indigo/violet fintech theme
/// - Provider state management (Auth, Campaign, Investment)
/// - Route configuration for investor and startup roles
/// - INR-only interface — NO crypto wallet needed to invest
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'providers/auth_provider.dart';
import 'providers/campaign_provider.dart';
import 'providers/investment_provider.dart';
import 'providers/startup_provider.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/investor_dashboard.dart';
import 'screens/startup_dashboard.dart';

void main() {
  runApp(const EnigmaInvestApp());
}

class EnigmaInvestApp extends StatelessWidget {
  const EnigmaInvestApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => CampaignProvider()),
        ChangeNotifierProvider(create: (_) => InvestmentProvider()),
        ChangeNotifierProvider(create: (_) => StartupProvider()),
      ],
      child: Consumer<AuthProvider>(
        builder: (context, authProvider, _) {
          return MaterialApp(
            title: 'Enigma Invest',
            debugShowCheckedModeBanner: false,

            // ============ Theme Configuration ============
            theme: ThemeData(
              brightness: Brightness.dark,
              primaryColor: const Color(0xFF4edea3),
              scaffoldBackgroundColor: const Color(0xFF0b1326),
              colorScheme: const ColorScheme.dark(
                primary: Color(0xFF4edea3),
                secondary: Color(0xFF10b981),
                surface: Color(0xFF171f33),
                background: Color(0xFF0b1326),
                onPrimary: Color(0xFF003824),
                onSurface: Color(0xFFdae2fd),
                onBackground: Color(0xFFdae2fd),
              ),
              appBarTheme: const AppBarTheme(
                backgroundColor: Colors.transparent,
                foregroundColor: Color(0xFFdae2fd),
                elevation: 0,
                centerTitle: true,
              ),
              cardTheme: CardThemeData(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: const BorderSide(color: Color(0x1A86948a)), // outline-variant/10
                ),
                color: const Color(0xB3171f33), // glass effect approximation (surface-container with opacity)
              ),
              elevatedButtonTheme: ElevatedButtonThemeData(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4edea3),
                  foregroundColor: const Color(0xFF003824),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 2,
                ),
              ),
              inputDecorationTheme: InputDecorationTheme(
                filled: true,
                fillColor: const Color(0xFF131b2e), // surface-container-low
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0x3386948a)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0x3386948a)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFF4edea3), width: 2),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              ),
              // Using Google Fonts for Plus Jakarta Sans
              textTheme: GoogleFonts.plusJakartaSansTextTheme(
                const TextTheme(
                  headlineLarge: TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: Color(0xFFdae2fd)),
                  headlineMedium: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFFdae2fd)),
                  bodyLarge: TextStyle(fontSize: 16, color: Color(0xFFdae2fd)),
                  bodyMedium: TextStyle(fontSize: 14, color: Color(0xFFb7c8e1)), // secondary color
                ),
              ),
              useMaterial3: true,
            ),

            // ============ Route Configuration ============
            initialRoute: authProvider.isAuthenticated
                ? _getHomeRoute(authProvider.userRole)
                : '/login',
            routes: {
              '/login': (context) => const LoginScreen(),
              '/register': (context) => const RegisterScreen(),
              '/investor-dashboard': (context) => const InvestorDashboard(),
              '/startup-dashboard': (context) => const StartupDashboard(),
            },
          );
        },
      ),
    );
  }

  String _getHomeRoute(String? role) {
    switch (role) {
      case 'investor':
        return '/investor-dashboard';
      case 'startup':
        return '/startup-dashboard';
      default:
        return '/login';
    }
  }
}
