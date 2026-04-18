/// Startup Dashboard — Enigma Invest
///
/// Drawer navigation pattern (aligns with web sidebar):
///   - My Campaigns
///   - Milestones
///   - My Investors
///   - Profile
///   - Logout (drawer footer only — removed from header)
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/campaign_provider.dart';
import '../providers/startup_provider.dart';
import '../services/api_service.dart';
import '../utils/formatters.dart';
import 'startup_profile_screen.dart';

class StartupDashboard extends StatefulWidget {
  const StartupDashboard({super.key});

  @override
  State<StartupDashboard> createState() => _StartupDashboardState();
}

class _StartupDashboardState extends State<StartupDashboard> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CampaignProvider>(context, listen: false).fetchMyCampaigns();
      Provider.of<StartupProvider>(context, listen: false).fetchStartupData();
    });
  }

  Future<void> _logout(BuildContext context) async {
    await Provider.of<AuthProvider>(context, listen: false).logout();
    if (!context.mounted) return;
    Navigator.of(context).pushReplacementNamed('/login');
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final user = auth.user ?? {};
    final rawName = (user['fullName'] as String?) ??
        (user['email'] as String?)?.split('@').first ??
        'Startup';
    final firstName = rawName.split(' ').first;
    final initials = firstName.isNotEmpty ? firstName[0].toUpperCase() : 'S';
    final email = user['email'] as String? ?? '';

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
                  const _CampaignsTab(),
                  const _MilestonesTab(),
                  const _MyInvestorsTab(),
                  const StartupProfileScreen(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  Widget _buildHeader(String firstName, String initials, BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        children: [
          // Hamburger menu → opens drawer
          Builder(
            builder: (ctx) => GestureDetector(
              onTap: () => Scaffold.of(ctx).openDrawer(),
              child: CircleAvatar(
                radius: 24,
                backgroundColor: const Color(0xFF171f33),
                child: Text(
                  initials,
                  style: const TextStyle(
                    color: Color(0xFF4edea3),
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hi, $firstName 🚀',
                  style: const TextStyle(
                    color: Color(0xFFdae2fd),
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const Text(
                  'Startup',
                  style: TextStyle(
                    color: Color(0xFF4edea3),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          // Menu icon (alternative drawer trigger)
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

  // ── Drawer ─────────────────────────────────────────────────────────────────
  Widget _buildDrawer(
      BuildContext context, String name, String email, String initials) {
    const bg = Color(0xFF0d1628);
    const border = Color(0x3386948a);
    const accent = Color(0xFF4edea3);
    const textPrimary = Color(0xFFdae2fd);
    const textMuted = Color(0xFF86948a);

    final navItems = [
      {'icon': Icons.campaign_outlined, 'label': 'Campaigns', 'index': 0},
      {'icon': Icons.flag_outlined, 'label': 'Milestones', 'index': 1},
      {'icon': Icons.people_outline_rounded, 'label': 'My Investors', 'index': 2},
      {'icon': Icons.person_outline, 'label': 'Profile', 'index': 3},
    ];

    return Drawer(
      backgroundColor: bg,
      child: SafeArea(
        child: Column(
          children: [
            // ── User info header ────────────────────────────────────────────
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
                    child: Text(
                      initials,
                      style: const TextStyle(
                        color: accent,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            color: textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          email,
                          style: const TextStyle(
                            color: textMuted,
                            fontSize: 12,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0x334edea3),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Text(
                            'STARTUP',
                            style: TextStyle(
                              color: accent,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 8),

            // ── Nav section label ────────────────────────────────────────────
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20, vertical: 6),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'NAVIGATION',
                  style: TextStyle(
                    color: textMuted,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
            ),

            // ── Nav links ────────────────────────────────────────────────────
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: navItems.map((item) {
                  final idx = item['index'] as int;
                  final isActive = _currentIndex == idx;
                  return Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                    child: Material(
                      color: isActive
                          ? const Color(0x224edea3)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                      child: ListTile(
                        leading: Icon(
                          item['icon'] as IconData,
                          color: isActive ? accent : textMuted,
                          size: 22,
                        ),
                        title: Text(
                          item['label'] as String,
                          style: TextStyle(
                            color: isActive ? textPrimary : textMuted,
                            fontWeight: isActive
                                ? FontWeight.w700
                                : FontWeight.normal,
                            fontSize: 15,
                          ),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
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

            // ── Logout at bottom (drawer only) ───────────────────────────────
            Container(
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: border)),
              ),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: ListTile(
                  leading: const Icon(Icons.logout_rounded, color: Colors.redAccent),
                  title: const Text(
                    'Log out',
                    style: TextStyle(color: Colors.redAccent, fontSize: 15),
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  onTap: () => _logout(context),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Bottom nav ─────────────────────────────────────────────────────────────
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
          BottomNavigationBarItem(
              icon: Icon(Icons.campaign_outlined),
              activeIcon: Icon(Icons.campaign),
              label: 'Campaigns'),
          BottomNavigationBarItem(
              icon: Icon(Icons.flag_outlined),
              activeIcon: Icon(Icons.flag),
              label: 'Milestones'),
          BottomNavigationBarItem(
              icon: Icon(Icons.people_outline_rounded),
              activeIcon: Icon(Icons.people),
              label: 'Investors'),
          BottomNavigationBarItem(
              icon: Icon(Icons.person_outline),
              activeIcon: Icon(Icons.person),
              label: 'Profile'),
        ],
      ),
    );
  }
}

// ─── Campaigns Tab ─────────────────────────────────────────────────────────────

class _CampaignsTab extends StatelessWidget {
  const _CampaignsTab();

  @override
  Widget build(BuildContext context) {
    return Consumer<CampaignProvider>(
      builder: (context, provider, _) {
        if (provider.isLoading && provider.myCampaigns.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }

        if (provider.myCampaigns.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.campaign_outlined,
                    size: 72, color: Color(0xFF171f33)),
                const SizedBox(height: 16),
                const Text(
                  'No Campaigns Yet',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFdae2fd),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Create campaigns via the web dashboard\nand they\'ll appear here.',
                  style: TextStyle(color: Color(0xFFb7c8e1)),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () => provider.fetchMyCampaigns(),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: provider.myCampaigns.length,
            itemBuilder: (context, index) {
              final campaign =
                  provider.myCampaigns[index] as Map<String, dynamic>;
              return _StartupCampaignCard(campaign: campaign);
            },
          ),
        );
      },
    );
  }
}

class _StartupCampaignCard extends StatelessWidget {
  final Map<String, dynamic> campaign;
  const _StartupCampaignCard({required this.campaign});

  @override
  Widget build(BuildContext context) {
    final title = campaign['title'] as String? ?? 'Untitled';
    final goal = (campaign['fundingGoal'] as num?)?.toDouble() ?? 0;
    final raised = (campaign['currentRaised'] as num?)?.toDouble() ?? 0;
    final investorCount = (campaign['investorCount'] as num?)?.toInt() ?? 0;
    final progress = goal > 0 ? (raised / goal).clamp(0.0, 1.0) : 0.0;
    final progressPct = (progress * 100).toStringAsFixed(1);
    final status = campaign['status'] as String? ?? 'active';
    final deadline = campaign['deadline'] != null
        ? DateTime.tryParse(campaign['deadline'].toString())
        : null;
    final daysLeft = deadline?.difference(DateTime.now()).inDays;

    Color statusChipColor;
    switch (status) {
      case 'active':
        statusChipColor = Colors.green;
        break;
      case 'completed':
        statusChipColor = Colors.blue;
        break;
      case 'draft':
        statusChipColor = Colors.orange;
        break;
      case 'expired':
      case 'cancelled':
        statusChipColor = Colors.red;
        break;
      default:
        statusChipColor = Colors.grey;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      color: const Color(0xFF131b2e),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: statusChipColor.withOpacity(0.25)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(title,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                          color: Color(0xFFdae2fd))),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusChipColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                    border:
                        Border.all(color: statusChipColor.withOpacity(0.4)),
                  ),
                  child: Text(status.toUpperCase(),
                      style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: statusChipColor)),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                _StatPill(
                    icon: Icons.people_outline_rounded,
                    label: '$investorCount investors'),
                const SizedBox(width: 8),
                if (daysLeft != null)
                  _StatPill(
                      icon: Icons.timer_outlined,
                      label: '$daysLeft days left',
                      highlight: daysLeft < 7),
              ],
            ),
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 8,
                backgroundColor: const Color(0xFF171f33),
                valueColor: AlwaysStoppedAnimation<Color>(
                  progress >= 1.0 ? Colors.green : const Color(0xFF4edea3),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                RichText(
                  text: TextSpan(
                    style: const TextStyle(fontSize: 14),
                    children: [
                      TextSpan(
                        text: formatINR(raised),
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFdae2fd)),
                      ),
                      const TextSpan(
                        text: ' raised',
                        style: TextStyle(color: Color(0xFF86948a)),
                      ),
                    ],
                  ),
                ),
                Text(
                  '$progressPct% of ${formatINR(goal)}',
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFFb7c8e1)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool highlight;

  const _StatPill(
      {required this.icon, required this.label, this.highlight = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: highlight ? const Color(0x33FF0000) : const Color(0x334edea3),
        borderRadius: BorderRadius.circular(20),
        border:
            Border.all(color: highlight ? Colors.red : const Color(0xFF4edea3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon,
              size: 14,
              color: highlight ? Colors.red[300] : const Color(0xFF4edea3)),
          const SizedBox(width: 4),
          Text(label,
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: highlight
                      ? Colors.red[300]
                      : const Color(0xFF4edea3))),
        ],
      ),
    );
  }
}

// ─── Milestones Tab ────────────────────────────────────────────────────────────

class _MilestonesTab extends StatefulWidget {
  const _MilestonesTab();

  @override
  State<_MilestonesTab> createState() => _MilestonesTabState();
}

class _MilestonesTabState extends State<_MilestonesTab> {
  List<dynamic> _milestones = [];
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchMilestones();
  }

  Future<void> _fetchMilestones() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final campaignProvider =
          Provider.of<CampaignProvider>(context, listen: false);
      final campaigns = campaignProvider.myCampaigns;
      if (campaigns.isNotEmpty) {
        final campaignId =
            (campaigns.first as Map<String, dynamic>)['_id'] as String? ?? '';
        if (campaignId.isNotEmpty) {
          final res = await ApiService().getCampaignMilestones(campaignId);
          if (res['success'] == true) {
            _milestones = res['data'] as List<dynamic>? ?? [];
          } else {
            _error = res['message'] as String? ?? 'Failed to load milestones';
          }
        }
      }
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }

    if (mounted) setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 12),
            ElevatedButton(
                onPressed: _fetchMilestones, child: const Text('Retry')),
          ],
        ),
      );
    }

    if (_milestones.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.flag_outlined,
                size: 72, color: Color(0xFF171f33)),
            const SizedBox(height: 16),
            const Text('No Milestones',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFdae2fd))),
            const SizedBox(height: 8),
            const Text(
              'Milestones will appear here\nonce your campaign is live.',
              style: TextStyle(color: Color(0xFFb7c8e1)),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _fetchMilestones,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _milestones.length,
        itemBuilder: (context, index) {
          final milestone = _milestones[index] as Map<String, dynamic>;
          return _MilestoneCard(milestone: milestone, index: index);
        },
      ),
    );
  }
}

class _MilestoneCard extends StatelessWidget {
  final Map<String, dynamic> milestone;
  final int index;

  const _MilestoneCard({required this.milestone, required this.index});

  @override
  Widget build(BuildContext context) {
    final title = milestone['title'] as String? ?? 'Milestone ${index + 1}';
    final description = milestone['description'] as String? ?? '';
    final status = milestone['status'] as String? ?? 'pending';
    final disbursalAmount =
        (milestone['disbursalAmount'] as num?)?.toDouble();
    final targetDate = milestone['targetDate'] != null
        ? DateTime.tryParse(milestone['targetDate'].toString())
        : null;
    final dateStr =
        targetDate != null ? formatDate(targetDate) : null;

    IconData statusIcon;
    Color statusColor;
    String statusLabel;

    switch (status) {
      case 'disbursed':
        statusIcon = Icons.check_circle_rounded;
        statusColor = Colors.green;
        statusLabel = 'Disbursed';
        break;
      case 'approved':
        statusIcon = Icons.thumb_up_rounded;
        statusColor = Colors.blue;
        statusLabel = 'Approved';
        break;
      case 'submitted':
        statusIcon = Icons.pending_rounded;
        statusColor = Colors.orange;
        statusLabel = 'Under Review';
        break;
      case 'rejected':
        statusIcon = Icons.cancel_rounded;
        statusColor = Colors.red;
        statusLabel = 'Rejected';
        break;
      default:
        statusIcon = Icons.radio_button_unchecked;
        statusColor = Colors.grey;
        statusLabel = 'Pending';
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: const Color(0xFF131b2e),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: statusColor.withOpacity(0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      '${index + 1}',
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          color: statusColor),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(title,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          color: Color(0xFFdae2fd))),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(statusIcon, size: 12, color: statusColor),
                      const SizedBox(width: 4),
                      Text(statusLabel,
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: statusColor)),
                    ],
                  ),
                ),
              ],
            ),
            if (description.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(description,
                  style: const TextStyle(
                      fontSize: 14, color: Color(0xFF86948a)),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis),
            ],
            const SizedBox(height: 10),
            Row(
              children: [
                if (dateStr != null) ...[
                  const Icon(Icons.calendar_today_outlined,
                      size: 13, color: Color(0xFF86948a)),
                  const SizedBox(width: 4),
                  Text(dateStr,
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF86948a))),
                ],
                const Spacer(),
                if (disbursalAmount != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      formatINR(disbursalAmount),
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: statusColor),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─── My Investors Tab ──────────────────────────────────────────────────────────

class _MyInvestorsTab extends StatefulWidget {
  const _MyInvestorsTab();

  @override
  State<_MyInvestorsTab> createState() => _MyInvestorsTabState();
}

class _MyInvestorsTabState extends State<_MyInvestorsTab> {
  List<dynamic> _investments = [];
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final res = await ApiService().getStartupInvestments();
      if (res['success'] == true) {
        final data = res['data'];
        _investments = (data is Map ? (data['investments'] ?? data['data'] ?? []) : data) as List;
      } else {
        _error = res['message'] as String? ?? 'Failed to load investors';
      }
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
    }
    if (mounted) setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.redAccent)),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: _fetch, child: const Text('Retry')),
          ],
        ),
      );
    }

    if (_investments.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.people_outline_rounded,
                size: 72, color: Color(0xFF171f33)),
            SizedBox(height: 16),
            Text('No Investors Yet',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFdae2fd))),
            SizedBox(height: 8),
            Text(
              'Investors who fund your campaigns\nwill appear here.',
              style: TextStyle(color: Color(0xFFb7c8e1)),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _fetch,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _investments.length,
        itemBuilder: (context, index) {
          final inv = _investments[index] as Map<String, dynamic>;
          final investor = inv['investorId'] as Map<String, dynamic>? ?? {};
          final campaign = inv['campaignId'] as Map<String, dynamic>? ?? {};
          final name = investor['fullName'] as String? ?? 'Anonymous';
          final amount = (inv['amount'] as num?)?.toDouble() ?? 0;
          final status = inv['status'] as String? ?? 'unverified';
          final date = inv['createdAt'] != null
              ? formatDate(inv['createdAt'])
              : '—';
          final campaignTitle = campaign['title'] as String? ?? 'Campaign';

          Color statusColor;
          switch (status) {
            case 'confirmed':
              statusColor = Colors.green;
              break;
            case 'failed':
              statusColor = Colors.red;
              break;
            default:
              statusColor = Colors.orange;
          }

          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            color: const Color(0xFF131b2e),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: Color(0x3386948a)),
            ),
            child: ListTile(
              contentPadding: const EdgeInsets.all(14),
              leading: CircleAvatar(
                backgroundColor:
                    statusColor.withOpacity(0.15),
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : 'I',
                  style: TextStyle(
                      color: statusColor, fontWeight: FontWeight.bold),
                ),
              ),
              title: Text(name,
                  style: const TextStyle(
                      color: Color(0xFFdae2fd),
                      fontWeight: FontWeight.w600)),
              subtitle: Text(
                '$campaignTitle · $date',
                style:
                    const TextStyle(color: Color(0xFF86948a), fontSize: 12),
              ),
              trailing: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatINR(amount),
                    style: const TextStyle(
                        color: Color(0xFF4edea3),
                        fontWeight: FontWeight.bold,
                        fontSize: 15),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(status,
                        style: TextStyle(
                            color: statusColor,
                            fontSize: 10,
                            fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
