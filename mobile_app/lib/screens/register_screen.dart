/// Register Screen — Enigma Invest
///
/// Clean registration form: fullName, email, password, role (investor | startup).
/// No KYC, no wallet address, no Aadhaar — those are not part of Enigma's onboarding.
///
/// Backend endpoint: POST /api/v1/auth/register
/// Required fields: fullName, email, password, role
/// Role options: 'investor' | 'startup'
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  String _selectedRole = 'investor';
  bool _obscurePassword = true;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String _getHomeRoute(String? role) {
    if (role == 'investor') return '/investor-dashboard';
    if (role == 'startup') return '/startup-dashboard';
    return '/login'; // Deny admin
  }

  Future<void> _handleRegister() async {
    if (_formKey.currentState!.validate()) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);

      final success = await authProvider.register({
        'fullName': _nameController.text.trim(),
        'email': _emailController.text.trim(),
        'password': _passwordController.text,
        'role': _selectedRole,
      });

      if (success && mounted) {
        Navigator.of(context).pushNamedAndRemoveUntil(
            _getHomeRoute(authProvider.userRole), (route) => false);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                authProvider.error ?? 'Registration failed. Please try again.'),
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
      appBar: AppBar(
        title: const Text('Create Account'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header
                const Text(
                  'Join Enigma Invest',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFFdae2fd),
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 6),
                const Text(
                  'Start investing in startups or raise capital for your venture.',
                  style: TextStyle(fontSize: 13, color: Color(0xFFb7c8e1)),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),

                // ── Role Selection ──────────────────────────────────────
                Card(
                  color: const Color(0xFF131b2e), // surface-container-low
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: const BorderSide(color: Color(0x3386948a)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'I want to...',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                            color: Color(0xFFdae2fd),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Investor tile
                        _RoleTile(
                          icon: Icons.show_chart_rounded,
                          title: 'Invest',
                          subtitle: 'Discover and back promising startups',
                          value: 'investor',
                          groupValue: _selectedRole,
                          onChanged: (v) => setState(() => _selectedRole = v!),
                        ),
                        const SizedBox(height: 8),

                        // Startup tile
                        _RoleTile(
                          icon: Icons.rocket_launch_rounded,
                          title: 'Raise Capital',
                          subtitle: 'Create a campaign and attract investors',
                          value: 'startup',
                          groupValue: _selectedRole,
                          onChanged: (v) => setState(() => _selectedRole = v!),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // ── Basic Information ───────────────────────────────────
                const Text(
                  'Your Details',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                    color: Color(0xFFdae2fd),
                  ),
                ),
                const SizedBox(height: 16),

                // Full name
                TextFormField(
                  controller: _nameController,
                  style: const TextStyle(color: Color(0xFFdae2fd)),
                  decoration: const InputDecoration(
                    labelText: 'Full name',
                    labelStyle: TextStyle(color: Color(0xFF86948a)),
                    prefixIcon: Icon(Icons.person_outline, color: Color(0xFF86948a)),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) {
                      return 'Please enter your full name';
                    }
                    if (v.trim().length < 2) {
                      return 'Name must be at least 2 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

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
                    if (v == null || v.isEmpty) {
                      return 'Please enter your email';
                    }
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
                    helperText:
                        'At least 8 characters with 1 uppercase and 1 number',
                    helperStyle: const TextStyle(color: Color(0xFF86948a)),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                        color: const Color(0xFF86948a),
                      ),
                      onPressed: () =>
                          setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) {
                      return 'Please enter a password';
                    }
                    if (v.length < 8) {
                      return 'Password must be at least 8 characters';
                    }
                    if (!v.contains(RegExp(r'[A-Z]'))) {
                      return 'Password must contain at least one uppercase letter';
                    }
                    if (!v.contains(RegExp(r'[0-9]'))) {
                      return 'Password must contain at least one number';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 32),

                // Register button
                Consumer<AuthProvider>(
                  builder: (context, auth, _) {
                    return ElevatedButton(
                      onPressed: auth.isLoading ? null : _handleRegister,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
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
                          : Text(
                              _selectedRole == 'investor'
                                  ? 'Create Investor Account'
                                  : 'Create Startup Account',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                    );
                  },
                ),
                const SizedBox(height: 16),

                // Login link
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF4edea3),
                  ),
                  child: const Text('Already have an account? Log in →'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Role Selection Widget ────────────────────────────────────────────────────

class _RoleTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String value;
  final String groupValue;
  final ValueChanged<String?> onChanged;

  const _RoleTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.groupValue,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final isSelected = value == groupValue;
    return GestureDetector(
      onTap: () => onChanged(value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF2d3449) : const Color(0xFF171f33),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color:
                isSelected ? const Color(0xFF4edea3) : const Color(0x3386948a),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: isSelected
                  ? const Color(0xFF4edea3)
                  : const Color(0xFF86948a),
              size: 28,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: isSelected
                          ? const Color(0xFF4edea3)
                          : const Color(0xFFdae2fd),
                    ),
                  ),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFFb7c8e1),
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              isSelected
                  ? Icons.radio_button_checked
                  : Icons.radio_button_unchecked,
              color: isSelected
                  ? const Color(0xFF4edea3)
                  : const Color(0xFF86948a),
            ),
          ],
        ),
      ),
    );
  }
}
