/// Login Screen — Enigma Invest
///
/// Routes to:
///   investor → /investor-dashboard
///   startup  → /startup-dashboard
///   admin    → /investor-dashboard (admin uses web panel, not mobile)
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String _getHomeRoute(String? role) {
    if (role == 'investor') return '/investor-dashboard';
    if (role == 'startup') return '/startup-dashboard';
    // Deny admin access on mobile
    return '/login';
  }

  Future<void> _handleLogin() async {
    if (_formKey.currentState!.validate()) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final success = await authProvider.login(
        _emailController.text.trim(),
        _passwordController.text,
      );

      if (success && mounted) {
        if (authProvider.userRole == 'admin') {
           authProvider.logout();
           ScaffoldMessenger.of(context).showSnackBar(
             const SnackBar(
               content: Text('Admin access is not supported on the mobile app. Please use the web panel.'),
               backgroundColor: Colors.red,
             ),
           );
           return;
        }
        final route = _getHomeRoute(authProvider.userRole);
        Navigator.of(context).pushNamedAndRemoveUntil(route, (route) => false);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(authProvider.error ?? 'Login failed. Please try again.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0b1326),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: const Color(0xFF171f33),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFF4edea3).withOpacity(0.3)),
                  ),
                  child: const Icon(
                    Icons.trending_up_rounded,
                    color: Color(0xFF4edea3),
                    size: 44,
                  ),
                ),
                const SizedBox(height: 20),

                // App name
                const Text(
                  'Enigma Invest',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFFdae2fd),
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Transparent startup investment platform',
                  style: TextStyle(fontSize: 14, color: Color(0xFFb7c8e1)),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 40),

                // Login card
                Card(
                  color: const Color(0xFF131b2e), // surface-container-low
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: const BorderSide(color: Color(0x3386948a)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Welcome back',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFdae2fd),
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Log in to your investor or startup account.',
                            style: TextStyle(fontSize: 13, color: Color(0xFFb7c8e1)),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 24),

                          // Email
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            style: const TextStyle(color: Color(0xFFdae2fd)),
                            decoration: const InputDecoration(
                              labelText: 'Email address',
                              labelStyle: TextStyle(color: Color(0xFF86948a)),
                              prefixIcon: Icon(Icons.email_outlined, color: Color(0xFF86948a)),
                            ),
                            validator: (v) {
                              if (v == null || v.isEmpty) return 'Please enter your email';
                              if (!v.contains('@')) return 'Please enter a valid email';
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),

                          // Password
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            style: const TextStyle(color: Color(0xFFdae2fd)),
                            decoration: InputDecoration(
                              labelText: 'Password',
                              labelStyle: const TextStyle(color: Color(0xFF86948a)),
                              prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFF86948a)),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                  color: const Color(0xFF86948a),
                                ),
                                onPressed: () => setState(
                                  () => _obscurePassword = !_obscurePassword,
                                ),
                              ),
                            ),
                            validator: (v) {
                              if (v == null || v.isEmpty) return 'Please enter your password';
                              return null;
                            },
                          ),
                          const SizedBox(height: 24),

                          // Login button
                          Consumer<AuthProvider>(
                            builder: (context, auth, _) {
                              return ElevatedButton(
                                onPressed: auth.isLoading ? null : _handleLogin,
                                style: ElevatedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  backgroundColor: const Color(0xFF4edea3),
                                  foregroundColor: const Color(0xFF003824),
                                ),
                                child: auth.isLoading
                                    ? const SizedBox(
                                        height: 20,
                                        width: 20,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          valueColor:
                                              AlwaysStoppedAnimation<Color>(Color(0xFF003824)),
                                        ),
                                      )
                                    : const Text(
                                        'Log in',
                                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                      ),
                              );
                            },
                          ),
                          const SizedBox(height: 16),

                          // Register link
                          TextButton(
                            onPressed: () => Navigator.of(context).pushNamed('/register'),
                            style: TextButton.styleFrom(
                              foregroundColor: const Color(0xFF4edea3),
                            ),
                            child: const Text("Don't have an account? Create one →"),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
