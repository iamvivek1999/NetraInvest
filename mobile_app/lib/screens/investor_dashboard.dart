/// Investor Dashboard — Enigma Invest
///
/// Drawer navigation (mirrors web sidebar):
///   Discover → Control Center → Portfolio → Profile
///   Logout is in drawer footer only (not on home header)
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/campaign_provider.dart';
import '../providers/investment_provider.dart';
import '../utils/formatters.dart';
import 'startup_campaign_pitch_screen.dart';

class InvestorDashboard extends StatefulWidget {
  const InvestorDashboard({super.key});

  @override
  State<InvestorDashboard> createState() => _InvestorDashboardState();
}

class _InvestorDashboardState extends State<InvestorDashboard> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CampaignProvider>(context, listen: false).fetchActiveCampaigns();
      Provider.of<InvestmentProvider>(context, listen: false).fetchMyInvestments();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final user = auth.user ?? {};
    final rawName = (user['fullName'] as String?) ?? (user['email'] as String?)?.split('@').first ?? 'Investor';
    final email = (user['email'] as String?) ?? '';
    final firstName = rawName.split(' ').first;
    final initials = firstName.isNotEmpty ? firstName[0].toUpperCase() : 'I';

    return Scaffold(
      backgroundColor: const Color(0xFF0b1326),
      drawer: _buildDrawer(context, rawName, email, initials),
      bottomNavigationBar: _buildBottomNav(),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(firstName, initials, context),
            const SizedBox(height: 16),
            Expanded(
              child: IndexedStack(
                index: _currentIndex,
                children: [
                  const _DiscoverTab(),
                  const _ControlCenterTab(),
                  const _PortfolioTab(),
                  const _InvestorProfileTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Drawer ─────────────────────────────────────────────────────────────────
  Widget _buildDrawer(
      BuildContext context, String name, String email, String initials) {
    const bg = Color(0xFF0d1628);
    const border = Color(0x3386948a);
    const accent = Color(0xFF4edea3);
    const textPrimary = Color(0xFFdae2fd);
    const textMuted = Color(0xFF86948a);

    final navItems = [
      {'icon': Icons.explore_outlined, 'label': 'Discover', 'index': 0},
      {'icon': Icons.grid_view_outlined, 'label': 'Control Center', 'index': 1},
      {'icon': Icons.account_balance_wallet_outlined, 'label': 'Portfolio', 'index': 2},
      {'icon': Icons.person_outline, 'label': 'My Profile', 'index': 3},
    ];

    return Drawer(
      backgroundColor: bg,
      child: SafeArea(
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: border)),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: const Color(0xFF171f33),
                    child: Text(initials,
                        style: const TextStyle(
                            color: accent,
                            fontSize: 20,
                            fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name,
                            style: const TextStyle(
                                color: textPrimary,
                                fontSize: 16,
                                fontWeight: FontWeight.w700),
                            overflow: TextOverflow.ellipsis),
                        const SizedBox(height: 3),
                        Text(email,
                            style: const TextStyle(
                                color: textMuted, fontSize: 12),
                            overflow: TextOverflow.ellipsis),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0x224edea3),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Text('INVESTOR',
                              style: TextStyle(
                                  color: accent,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.8)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('NAVIGATION',
                    style: TextStyle(
                        color: textMuted,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2)),
              ),
            ),
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: navItems.map((item) {
                  final idx = item['index'] as int;
                  final isActive = _currentIndex == idx;
                  return Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 2),
                    child: Material(
                      color: isActive
                          ? const Color(0x224edea3)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                      child: ListTile(
                        leading: Icon(item['icon'] as IconData,
                            color: isActive ? accent : textMuted, size: 22),
                        title: Text(item['label'] as String,
                            style: TextStyle(
                                color:
                                    isActive ? textPrimary : textMuted,
                                fontWeight: isActive
                                    ? FontWeight.w700
                                    : FontWeight.normal,
                                fontSize: 15)),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                        onTap: () {
                          setState(() => _currentIndex = idx);
                          Navigator.pop(context);
                        },
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
            Container(
              decoration: const BoxDecoration(
                  border: Border(top: BorderSide(color: border))),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 8),
                child: ListTile(
                  leading: const Icon(Icons.logout_rounded,
                      color: Colors.redAccent),
                  title: const Text('Log out',
                      style:
                          TextStyle(color: Colors.redAccent, fontSize: 15)),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  onTap: () async {
                    await Provider.of<AuthProvider>(context, listen: false)
                        .logout();
                    if (!context.mounted) return;
                    Navigator.of(context).pushReplacementNamed('/login');
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(String firstName, String initials, BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        children: [
          Builder(
            builder: (ctx) => GestureDetector(
              onTap: () => Scaffold.of(ctx).openDrawer(),
              child: CircleAvatar(
                radius: 24,
                backgroundColor: const Color(0xFF171f33),
                child: Text(initials,
                    style: const TextStyle(
                        color: Color(0xFF4edea3),
                        fontSize: 18,
                        fontWeight: FontWeight.bold)),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Hi, $firstName 👋',
                    style: const TextStyle(
                        color: Color(0xFFdae2fd),
                        fontSize: 20,
                        fontWeight: FontWeight.w800)),
                const Text('Investor',
                    style: TextStyle(
                        color: Color(0xFF4edea3),
                        fontSize: 13,
                        fontWeight: FontWeight.w500)),
              ],
            ),
          ),
          Builder(
            builder: (ctx) => IconButton(
              icon: const Icon(Icons.menu_rounded, color: Color(0xFFdae2fd)),
              tooltip: 'Menu',
              onPressed: () => Scaffold.of(ctx).openDrawer(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomNav() {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0b1326),
        border: Border(top: BorderSide(color: Color(0x3386948a))),
      ),
      child: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (idx) => setState(() => _currentIndex = idx),
        backgroundColor: const Color(0xFF0b1326),
        selectedItemColor: const Color(0xFF4edea3),
        unselectedItemColor: const Color(0xFF86948a),
        type: BottomNavigationBarType.fixed,
        elevation: 0,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.explore_outlined), activeIcon: Icon(Icons.explore), label: 'Discover'),
          BottomNavigationBarItem(icon: Icon(Icons.grid_view_outlined), activeIcon: Icon(Icons.grid_view), label: 'Control Center'),
          BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet_outlined), activeIcon: Icon(Icons.account_balance_wallet), label: 'Invest'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

// ─── Discover Tab ────────────────────────────────────────────────────────────

class _DiscoverTab extends StatelessWidget {
  const _DiscoverTab();

  @override
  Widget build(BuildContext context) {
    return Consumer<CampaignProvider>(
      builder: (context, provider, _) {
        if (provider.isLoading && provider.campaigns.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }

        if (provider.campaigns.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.rocket_launch_outlined, size: 72, color: const Color(0xFF171f33)),
                const SizedBox(height: 16),
                const Text(
                  'No Active Campaigns',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFFdae2fd)),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Check back soon for new startup opportunities.',
                  style: TextStyle(color: Color(0xFFb7c8e1)),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () => provider.fetchActiveCampaigns(),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: provider.campaigns.length + 1,
            itemBuilder: (context, index) {
              // Earnings banner at top
              if (index == 0) {
                return _InvestBanner();
              }
              final campaign = provider.campaigns[index - 1] as Map<String, dynamic>;
              return _CampaignCard(campaign: campaign);
            },
          ),
        );
      },
    );
  }
}

class _InvestBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF171f33), Color(0xFF2d3449)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: const Color(0x334edea3)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Row(
        children: [
          Icon(Icons.verified_outlined, color: Color(0xFF4edea3), size: 32),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Backed by Blockchain Transparency',
                    style: TextStyle(color: Color(0xFF4edea3), fontSize: 12, fontWeight: FontWeight.w500)),
                SizedBox(height: 2),
                Text('Every investment is immutably logged.',
                    style: TextStyle(color: Color(0xFFdae2fd), fontSize: 15, fontWeight: FontWeight.bold)),
                SizedBox(height: 2),
                Text('Safe • Verifiable • Transparent',
                    style: TextStyle(color: Color(0xFFb7c8e1), fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CampaignCard extends StatelessWidget {
  final Map<String, dynamic> campaign;

  const _CampaignCard({required this.campaign});

  @override
  Widget build(BuildContext context) {
    final title = campaign['title'] as String? ?? 'Untitled Campaign';
    final description = campaign['description'] as String? ?? '';
    final goal = (campaign['fundingGoal'] as num?)?.toDouble() ?? 0;
    final raised = (campaign['currentRaised'] as num?)?.toDouble() ?? 0;
    final progress = goal > 0 ? (raised / goal).clamp(0.0, 1.0) : 0.0;
    final minInvestment = (campaign['minInvestment'] as num?)?.toDouble();
    final deadline = campaign['deadline'] != null
        ? DateTime.tryParse(campaign['deadline'].toString())
        : null;
    final daysLeft = deadline?.difference(DateTime.now()).inDays;
    final campaignId = campaign['_id'] as String? ?? campaign['id'] as String? ?? '';

    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (context) => StartupCampaignPitchScreen(campaign: campaign),
          ),
        );
      },
      child: Card(
        margin: const EdgeInsets.only(bottom: 16),
        color: const Color(0xFF131b2e),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Title + days left badge
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                        color: Color(0xFFdae2fd),
                      ),
                    ),
                  ),
                  if (daysLeft != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: daysLeft < 7 ? const Color(0x33FF0000) : const Color(0x334edea3),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: daysLeft < 7 ? Colors.red : const Color(0xFF4edea3),
                        ),
                      ),
                      child: Text(
                        '$daysLeft days left',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: daysLeft < 7 ? Colors.red[300] : const Color(0xFF4edea3),
                        ),
                      ),
                    ),
                ],
              ),

              if (description.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14, color: Color(0xFF86948a)),
                ),
              ],
              const SizedBox(height: 16),

              // Progress
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 8,
                  backgroundColor: const Color(0xFF171f33),
                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF4edea3)),
                ),
              ),
              const SizedBox(height: 8),

              // Raised / Goal
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${formatINR(raised)} raised',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: Color(0xFFdae2fd),
                    ),
                  ),
                  Text(
                    'Goal: ${formatINR(goal)}',
                    style: const TextStyle(fontSize: 12, color: Color(0xFFb7c8e1)),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              // Invest button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _showInvestDialog(context, campaign, campaignId),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF171f33),
                    foregroundColor: const Color(0xFF4edea3),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: const BorderSide(color: Color(0x334edea3)),
                    ),
                  ),
                  icon: const Icon(Icons.add_card_rounded, size: 18),
                  label: Text(
                    minInvestment != null
                        ? 'Invest (min ${formatINR(minInvestment)})'
                        : 'Invest Now',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showInvestDialog(BuildContext context, Map<String, dynamic> campaign, String campaignId) {
    final formKey = GlobalKey<FormState>();
    final amountController = TextEditingController();
    final minInvestment = (campaign['minInvestment'] as num?)?.toDouble() ?? 1000.0;
    final maxInvestment = (campaign['maxInvestment'] as num?)?.toDouble();

    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF131b2e),
        title: const Row(
          children: [
            Icon(Icons.add_card_rounded, color: Color(0xFF4edea3)),
            SizedBox(width: 8),
            Text('Invest', style: TextStyle(color: Color(0xFFdae2fd))),
          ],
        ),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                campaign['title'] as String? ?? '',
                style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFdae2fd)),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: amountController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Color(0xFFdae2fd)),
                decoration: InputDecoration(
                  labelText: 'Investment Amount (₹)',
                  labelStyle: const TextStyle(color: Color(0xFF86948a)),
                  prefixIcon: const Icon(Icons.currency_rupee, color: Color(0xFF86948a)),
                  helperText: 'Min: ${formatINR(minInvestment)}'
                      '${maxInvestment != null ? ' · Max: ${formatINR(maxInvestment)}' : ''}',
                  helperStyle: const TextStyle(color: Color(0xFF86948a)),
                  enabledBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF86948a))),
                  focusedBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Color(0xFF4edea3))),
                ),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Please enter an amount';
                  final amt = double.tryParse(v);
                  if (amt == null || amt <= 0) return 'Invalid amount';
                  if (amt < minInvestment) {
                    return 'Minimum investment is ${formatINR(minInvestment)}';
                  }
                  if (maxInvestment != null && amt > maxInvestment) {
                    return 'Maximum investment is ${formatINR(maxInvestment)}';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0x334edea3),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF4edea3)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.link_rounded, size: 16, color: Color(0xFF4edea3)),
                    SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'This investment will be logged to the blockchain for permanent transparency.',
                        style: TextStyle(fontSize: 11, color: Color(0xFF4edea3)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF86948a))),
          ),
          Consumer<InvestmentProvider>(
            builder: (context, invProvider, _) {
              return ElevatedButton(
                onPressed: invProvider.isLoading
                    ? null
                    : () async {
                        if (formKey.currentState!.validate()) {
                          Navigator.pop(dialogContext);
                          final amount = double.parse(amountController.text);
                          final ok = await invProvider.invest(
                            campaignId: campaignId,
                            amount: amount,
                          );
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                              content: Text(ok
                                  ? '✅ Investment confirmed! ${invProvider.lastTxHash != null ? 'Blockchain tx logged.' : ''}'
                                  : invProvider.error ?? 'Investment failed'),
                              backgroundColor: ok ? Colors.green : Colors.red,
                              duration: const Duration(seconds: 4),
                            ));
                          }
                        }
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4edea3),
                  foregroundColor: const Color(0xFF131b2e),
                ),
                child: const Text('Confirm', style: TextStyle(fontWeight: FontWeight.bold)),
              );
            },
          ),
        ],
      ),
    );
  }
}

// ─── Portfolio Tab ────────────────────────────────────────────────────────────

class _PortfolioTab extends StatelessWidget {
  const _PortfolioTab();

  @override
  Widget build(BuildContext context) {
    return Consumer<InvestmentProvider>(
      builder: (context, provider, _) {
        if (provider.isLoading && provider.myInvestments.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }

        if (provider.myInvestments.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.account_balance_wallet_outlined, size: 72, color: const Color(0xFF171f33)),
                const SizedBox(height: 16),
                const Text(
                  'No Investments Yet',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFFdae2fd)),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Back a startup from the Discover tab to get started.',
                  style: TextStyle(color: Color(0xFFb7c8e1)),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }

        // Total invested
        double total = 0;
        for (final inv in provider.myInvestments) {
          total += ((inv as Map)['amount'] as num?)?.toDouble() ?? 0.0;
        }

        return RefreshIndicator(
          onRefresh: () => provider.fetchMyInvestments(),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: provider.myInvestments.length + 1,
            itemBuilder: (context, index) {
              if (index == 0) {
                return _PortfolioSummaryCard(totalInvested: total);
              }
              final inv = provider.myInvestments[index - 1] as Map<String, dynamic>;
              return _InvestmentCard(investment: inv);
            },
          ),
        );
      },
    );
  }
}

class _PortfolioSummaryCard extends StatelessWidget {
  final double totalInvested;
  const _PortfolioSummaryCard({required this.totalInvested});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF171f33), Color(0xFF2d3449)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: const Color(0x334edea3)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Total Invested',
            style: TextStyle(color: Color(0xFF86948a), fontSize: 13),
          ),
          const SizedBox(height: 4),
          Text(
            formatINR(totalInvested),
            style: const TextStyle(
              color: Color(0xFFdae2fd),
              fontSize: 32,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Across all campaigns',
            style: TextStyle(color: Color(0xFFb7c8e1), fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _InvestmentCard extends StatelessWidget {
  final Map<String, dynamic> investment;
  const _InvestmentCard({required this.investment});

  @override
  Widget build(BuildContext context) {
    final amount = (investment['amount'] as num?)?.toDouble() ?? 0;
    final status = investment['status'] as String? ?? 'confirmed';
    final campaign = investment['campaignId'] as Map<String, dynamic>?;
    final campaignTitle = campaign?['title'] as String? ?? 'Campaign';
    final txHash = investment['blockchainTxHash'] as String?;
    final blockchainStatus = investment['blockchainStatus'] as String?;
    final confirmedAt = investment['confirmedAt'] != null
        ? DateTime.tryParse(investment['confirmedAt'].toString())
        : null;
    final dateStr = confirmedAt != null
        ? formatDate(confirmedAt)
        : '—';

    Color statusColor;
    switch (status) {
      case 'confirmed':
        statusColor = Colors.green;
        break;
      case 'unverified':
        statusColor = Colors.orange;
        break;
      default:
        statusColor = Colors.grey;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: const Color(0xFF131b2e),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            // Status icon
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                status == 'confirmed' ? Icons.check_circle_rounded : Icons.hourglass_top_rounded,
                color: statusColor,
                size: 22,
              ),
            ),
            const SizedBox(width: 12),
            // Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    campaignTitle,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFFdae2fd)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(dateStr, style: const TextStyle(fontSize: 12, color: Color(0xFF86948a))),
                  if (txHash != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.link_rounded, size: 12, color: Color(0xFF4edea3)),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            '${txHash.substring(0, 16)}…',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF4edea3)),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ] else if (blockchainStatus == 'failed') ...[
                    const SizedBox(height: 4),
                    const Row(
                      children: [
                        Icon(Icons.warning_amber_rounded, size: 12, color: Colors.orange),
                        SizedBox(width: 4),
                        Text(
                          'Blockchain log pending',
                          style: TextStyle(fontSize: 11, color: Colors.orange),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            // Amount
            Text(
              formatINR(amount),
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 15,
                color: Color(0xFF4edea3),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Control Center Tab ───────────────────────────────────────────────────

class _ControlCenterTab extends StatelessWidget {
  const _ControlCenterTab();

  @override
  Widget build(BuildContext context) {
    return Consumer<InvestmentProvider>(
      builder: (context, provider, _) {
        double totalInvested = 0;
        for (final inv in provider.myInvestments) {
          totalInvested += ((inv as Map)['amount'] as num?)?.toDouble() ?? 0.0;
        }
        final activeDeals = provider.myInvestments.map((i) => (i as Map)['campaignId']?['_id']).toSet().length;
        final totalExits = 0; // Mocked for now

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Portfolio Hero
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF4edea3), Color(0xFF10b981)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: const [
                  BoxShadow(color: Color(0x334edea3), blurRadius: 20, offset: Offset(0, 10)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Total Portfolio Value',
                      style: TextStyle(color: Color(0xFF003824), fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                  const SizedBox(height: 8),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(formatINR(totalInvested),
                          style: const TextStyle(color: Color(0xFF002113), fontSize: 32, fontWeight: FontWeight.w800, letterSpacing: -1)),
                      const SizedBox(width: 8),
                      if (totalInvested > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(color: const Color(0xFF002113).withOpacity(0.2), borderRadius: BorderRadius.circular(12)),
                          child: const Text('+12.4%', style: TextStyle(color: Color(0xFF002113), fontSize: 12, fontWeight: FontWeight.bold)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(16)),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('ACTIVE DEALS', style: TextStyle(color: Color(0xFF003824), fontSize: 10, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 4),
                              Text('$activeDeals', style: const TextStyle(color: Color(0xFF002113), fontSize: 20, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(16)),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('TOTAL EXITS', style: TextStyle(color: Color(0xFF003824), fontSize: 10, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 4),
                              Text('$totalExits'.padLeft(2, '0'), style: const TextStyle(color: Color(0xFF002113), fontSize: 20, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Fund Deployment Tracker
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Fund Deployment', style: TextStyle(color: Color(0xFFdae2fd), fontSize: 18, fontWeight: FontWeight.bold)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: const Color(0xFF4edea3).withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                  child: const Row(
                    children: [
                      Icon(Icons.circle, color: Color(0xFF4edea3), size: 8),
                      SizedBox(width: 4),
                      Text('BLOCKCHAIN SYNCED', style: TextStyle(color: Color(0xFF4edea3), fontSize: 10, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF131b2e).withOpacity(0.7),
                border: Border.all(color: const Color(0xFF3c4a42).withOpacity(0.2)),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Seed Series Alpha Fund', style: TextStyle(color: Color(0xFFbbcabf), fontSize: 12, fontWeight: FontWeight.w500)),
                          Text('₹5,00,000 Milestone', style: TextStyle(color: Color(0xFFdae2fd), fontSize: 16, fontWeight: FontWeight.bold)),
                        ],
                      ),
                      const Text('72%', style: TextStyle(color: Color(0xFF4edea3), fontSize: 14, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: const LinearProgressIndicator(
                      value: 0.72,
                      minHeight: 8,
                      backgroundColor: Color(0xFF2d3449),
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF4edea3)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _buildDeploymentCategory(Icons.rocket_launch, 'R&D', '₹120k'),
                      const SizedBox(width: 8),
                      _buildDeploymentCategory(Icons.groups, 'Hiring', '₹240k'),
                      const SizedBox(width: 8),
                      _buildDeploymentCategory(Icons.campaign, 'GTM', '₹140k'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Startup Health Index (Mock)
            const Text('Startup Health Index', style: TextStyle(color: Color(0xFFdae2fd), fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF131b2e).withOpacity(0.7),
                border: Border.all(color: const Color(0xFF3c4a42).withOpacity(0.2)),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      // High Health
                      Expanded(
                        child: Column(
                          children: [
                            Container(width: double.infinity, height: 40, decoration: BoxDecoration(color: const Color(0xFF4edea3).withOpacity(0.2), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF4edea3).withOpacity(0.3))), child: const Center(child: Text('LY', style: TextStyle(color: Color(0xFF4edea3), fontSize: 10, fontWeight: FontWeight.bold)))),
                            const SizedBox(height: 8),
                            Container(width: double.infinity, height: 80, decoration: BoxDecoration(color: const Color(0xFF4edea3), borderRadius: BorderRadius.circular(12)), child: const Center(child: Text('Neuro\nLink', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF003824), fontSize: 10, fontWeight: FontWeight.bold)))),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Mid Health
                      Expanded(
                        child: Column(
                          children: [
                            Container(width: double.infinity, height: 60, decoration: BoxDecoration(color: const Color(0xFF4edea3).withOpacity(0.6), borderRadius: BorderRadius.circular(12)), child: const Center(child: Text('Eco\nFuel', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF003824), fontSize: 10, fontWeight: FontWeight.bold)))),
                            const SizedBox(height: 8),
                            Container(width: double.infinity, height: 30, decoration: BoxDecoration(color: const Color(0xFF4edea3).withOpacity(0.3), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF4edea3).withOpacity(0.2))), child: const Center(child: Text('BT', style: TextStyle(color: Color(0xFF4edea3), fontSize: 10, fontWeight: FontWeight.bold)))),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Stable
                      Expanded(
                        child: Container(
                          width: double.infinity,
                          height: 120,
                          decoration: BoxDecoration(color: const Color(0xFF2d3449), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF3c4a42).withOpacity(0.2))),
                          child: const Center(child: RotatedBox(quarterTurns: 3, child: Text('STEADY GROWTH', style: TextStyle(color: Color(0xFFbbcabf), fontSize: 10, fontWeight: FontWeight.bold)))),
                        ),
                      ),
                      const SizedBox(width: 8),
                      // High Risk
                      Expanded(
                        child: Column(
                          children: [
                            Container(width: double.infinity, height: 30, decoration: BoxDecoration(color: const Color(0xFFfc7c78).withOpacity(0.3), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFfc7c78).withOpacity(0.4))), child: const Center(child: Text('RX', style: TextStyle(color: Color(0xFFffb3af), fontSize: 10, fontWeight: FontWeight.bold)))),
                            const SizedBox(height: 8),
                            Container(width: double.infinity, height: 40, decoration: BoxDecoration(color: const Color(0xFF93000a).withOpacity(0.4), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFffb4ab).withOpacity(0.2))), child: const Center(child: Text('Quantum\nX', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFFffb4ab), fontSize: 10, fontWeight: FontWeight.bold)))),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      const Text('CRITICAL RISK', style: TextStyle(color: Color(0xFFbbcabf), fontSize: 10, fontWeight: FontWeight.bold)),
                      Expanded(
                        child: Container(
                          margin: const EdgeInsets.symmetric(horizontal: 12),
                          height: 4,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(colors: [Color(0xFFffb4ab), Color(0xFF2d3449), Color(0xFF4edea3)]),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                      const Text('UNICORN POTENTIAL', style: TextStyle(color: Color(0xFFbbcabf), fontSize: 10, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Recent Ledger
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Recent Ledger', style: TextStyle(color: Color(0xFFdae2fd), fontSize: 18, fontWeight: FontWeight.bold)),
                TextButton(onPressed: () {}, child: const Text('SEE ALL', style: TextStyle(color: Color(0xFF4edea3), fontSize: 12, fontWeight: FontWeight.bold))),
              ],
            ),
            // Example transactions mock
            _buildLedgerItem(Icons.account_balance_wallet, 'Dividend Payout', 'Solar Grid Solutions', '+₹4,200.00', '2h ago', true),
            const SizedBox(height: 12),
            _buildLedgerItem(Icons.description, 'Capital Call', 'A.I. Genesis Fund', '-₹15,000.00', 'Yesterday', false),
            const SizedBox(height: 80),
          ],
        );
      },
    );
  }

  Widget _buildDeploymentCategory(IconData icon, String title, String amount) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: const Color(0xFF131b2e),
          border: Border.all(color: const Color(0xFF3c4a42).withOpacity(0.1)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, color: const Color(0xFF4edea3), size: 18),
            const SizedBox(height: 4),
            Text(title, style: const TextStyle(color: Color(0xFFbbcabf), fontSize: 9, fontWeight: FontWeight.bold)),
            Text(amount, style: const TextStyle(color: Color(0xFFdae2fd), fontSize: 12, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _buildLedgerItem(IconData icon, String title, String subtitle, String amount, String time, bool isPositive) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF131b2e).withOpacity(0.7),
        border: Border.all(color: const Color(0xFF3c4a42).withOpacity(0.1)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: isPositive ? const Color(0xFF4edea3).withOpacity(0.1) : const Color(0xFF3a4a5f),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: isPositive ? const Color(0xFF4edea3) : const Color(0xFFb7c8e1), size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Color(0xFFdae2fd), fontSize: 14, fontWeight: FontWeight.bold)),
                Text(subtitle, style: const TextStyle(color: Color(0xFFbbcabf), fontSize: 10)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(amount, style: TextStyle(color: isPositive ? const Color(0xFF4edea3) : const Color(0xFFdae2fd), fontSize: 14, fontWeight: FontWeight.bold)),
              Text(time, style: const TextStyle(color: Color(0xFFbbcabf), fontSize: 10)),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Investor Profile Tab ─────────────────────────────────────────────────

class _InvestorProfileTab extends StatefulWidget {
  const _InvestorProfileTab();

  @override
  State<_InvestorProfileTab> createState() => _InvestorProfileTabState();
}

class _InvestorProfileTabState extends State<_InvestorProfileTab> {
  Map<String, dynamic>? _profile;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final user = auth.user ?? {};
      setState(() {
        _profile = user;
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());

    final user = _profile ?? {};
    final name = user['fullName'] as String? ?? 'Investor';
    final email = user['email'] as String? ?? '';
    final initials = name.isNotEmpty ? name[0].toUpperCase() : 'I';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Profile Hero Card
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF131b2e),
              borderRadius: BorderRadius.circular(20),
              border: const Border.fromBorderSide(
                  BorderSide(color: Color(0x3386948a))),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: const Color(0xFF4edea3).withOpacity(0.15),
                  child: Text(initials,
                      style: const TextStyle(
                          color: Color(0xFF4edea3),
                          fontSize: 28,
                          fontWeight: FontWeight.bold)),
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          style: const TextStyle(
                              color: Color(0xFFdae2fd),
                              fontSize: 20,
                              fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Text(email,
                          style: const TextStyle(
                              color: Color(0xFF86948a), fontSize: 13)),
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF4edea3).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text('INVESTOR',
                            style: TextStyle(
                                color: Color(0xFF4edea3),
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.8)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Investment Stats (live)
          const Text('Investment Overview',
              style: TextStyle(
                  color: Color(0xFFdae2fd),
                  fontSize: 16,
                  fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),

          Consumer<InvestmentProvider>(
            builder: (context, provider, _) {
              double total = 0;
              for (final inv in provider.myInvestments) {
                total += ((inv as Map)['amount'] as num?)?.toDouble() ?? 0.0;
              }
              final uniqueCampaigns = provider.myInvestments
                  .map((i) => (i as Map)['campaignId']?['_id'])
                  .where((id) => id != null)
                  .toSet()
                  .length;

              return Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  _ProfileStatCard(
                      icon: Icons.account_balance_wallet_outlined,
                      label: 'Total Invested',
                      value: formatINR(total)),
                  _ProfileStatCard(
                      icon: Icons.business_outlined,
                      label: 'Campaigns',
                      value: '$uniqueCampaigns'),
                  _ProfileStatCard(
                      icon: Icons.receipt_long_outlined,
                      label: 'Transactions',
                      value: '${provider.myInvestments.length}'),
                ],
              );
            },
          ),

          const SizedBox(height: 28),

          // Account info section
          const Text('Account',
              style: TextStyle(
                  color: Color(0xFFdae2fd),
                  fontSize: 16,
                  fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),

          _InfoRow(label: 'Name', value: name),
          _InfoRow(label: 'Email', value: email),
          _InfoRow(
              label: 'Role',
              value: (user['role'] as String?)?.toUpperCase() ?? 'INVESTOR'),
          _InfoRow(
              label: 'Member since',
              value: user['createdAt'] != null
                  ? formatDate(user['createdAt'])
                  : '—'),
        ],
      ),
    );
  }
}

class _ProfileStatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _ProfileStatCard(
      {required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 150,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF131b2e),
        borderRadius: BorderRadius.circular(16),
        border: const Border.fromBorderSide(
            BorderSide(color: Color(0x3386948a))),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: const Color(0xFF4edea3), size: 24),
          const SizedBox(height: 10),
          Text(value,
              style: const TextStyle(
                  color: Color(0xFFdae2fd),
                  fontSize: 18,
                  fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(label,
              style: const TextStyle(
                  color: Color(0xFF86948a), fontSize: 11)),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF131b2e),
        borderRadius: BorderRadius.circular(12),
        border: const Border.fromBorderSide(
            BorderSide(color: Color(0x2286948a))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  color: Color(0xFF86948a), fontSize: 13)),
          Text(value,
              style: const TextStyle(
                  color: Color(0xFFdae2fd),
                  fontSize: 13,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
